import { Router, Request, Response, NextFunction } from 'express';

import { ActivityType, AttributeType, Prisma, PrismaClient } from '@prisma/client';

import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';
import { assertAccess, buildResolver, meets, resolveAccess } from '../services/permissions';
import {
  CrmValueValidationError,
  recordSerializationInclude,
  serializeRecord,
  writeValues,
} from '../services/crm/values';
// Фильтр/сравнение записей вынесены в общий модуль — Data Hub и Report Builder используют ИДЕНТИЧНУЮ семантику.
import {
  compareRecordValues,
  compileFilterTree,
  getValueForAttribute,
  isEmptyValue,
  matchesCompiledTree,
  matchesFilter,
  type AttributeLite,
} from '../services/crm/recordFilter';
import { computeCalculations, type CalcRequest } from '../services/crm/recordAggregate';
import { triggerAutoRerunForChange } from '../services/ai/index';
import { runWorkflows } from '../services/workflows';
import { redactActivities, collectOtherRecordIds } from '../services/crm/activityRedaction';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

const keySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/, 'Key must start with a lowercase letter and contain only lowercase letters, numbers, "_" or "-"');

// Ключи атрибутов в БД могут быть camelCase (employeeRange, estimatedArr) — разрешаем верхний регистр.
const attributeKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, 'Attribute key must start with a letter and contain only letters, numbers, "_" or "-"');

const objectLookupBase = z.object({
  objectId: z.string().min(1).optional(),
  objectKey: keySchema.optional(),
});

const requireObjectRef = (data: { objectId?: string; objectKey?: string }) =>
  Boolean(data.objectId || data.objectKey);
const objectRefMsg = { message: 'objectId or objectKey is required' } as const;

const objectLookupSchema = objectLookupBase.refine(requireObjectRef, objectRefMsg);

const filterOpSchema = z.enum(['eq', 'neq', 'contains', 'gt', 'lt', 'in', 'is_empty', 'is_not_empty']);
const sortDirSchema = z.enum(['asc', 'desc']);

const recordFilterSchema = z.object({
  attributeKey: attributeKeySchema,
  op: filterOpSchema,
  value: z.unknown().optional(),
});

const recordSortSchema = z.object({
  attributeKey: attributeKeySchema,
  dir: sortDirSchema.default('asc'),
});

const recordColumnSchema = z.object({
  attributeKey: attributeKeySchema,
  order: z.number().int().min(0).optional(),
  width: z.number().int().min(60).max(800).optional(),
  isVisible: z.boolean().optional(),
});

// M24-3: запрос калькуляции колонки
const calcTypeSchema = z.enum(['count', 'sum', 'avg', 'min', 'max', 'empty']);
const calcRequestSchema = z.object({ attributeKey: attributeKeySchema, type: calcTypeSchema });

function jsonArrayParam<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return [];
    }

    const rawValue = Array.isArray(value) ? value[0] : value;

    if (typeof rawValue === 'string') {
      try {
        return JSON.parse(rawValue);
      } catch (_err) {
        return rawValue;
      }
    }

    return rawValue;
  }, z.array(itemSchema).default([]));
}

// M24-1: одиночный JSON-объект из query (filterTree). undefined → не задан.
function jsonObjectParam() {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch (_err) {
        return undefined;
      }
    }
    return raw;
  }, z.unknown().optional());
}

const listRecordsQuerySchema = objectLookupBase
  .extend({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    search: z.string().trim().max(200).optional(),
    filters: jsonArrayParam(recordFilterSchema),
    // M24-1: канонический AND/OR filter tree (если задан — заменяет плоский filters[]).
    filterTree: jsonObjectParam(),
    sorts: jsonArrayParam(recordSortSchema),
    columns: jsonArrayParam(recordColumnSchema),
    // M24-3: per-column calculations (lenient — невалидные → skippedReason)
    calcs: jsonArrayParam(calcRequestSchema),
  })
  .refine(requireObjectRef, objectRefMsg);

const createRecordSchema = objectLookupBase
  .extend({
    values: z.record(z.unknown()).default({}),
  })
  .refine(requireObjectRef, objectRefMsg);

const updateRecordSchema = z.object({
  values: z.record(z.unknown()).default({}),
});

type RecordFilter = z.infer<typeof recordFilterSchema>;
type RecordSort = z.infer<typeof recordSortSchema>;

type CrmAttributeForRecords = {
  id: string;
  key: string;
  type: AttributeType;
};

type CrmObjectForRecords = {
  id: string;
  key: string;
  primaryAttribute: {
    id: string;
    type: AttributeType;
  } | null;
  attributes: CrmAttributeForRecords[];
};

type SerializedRecordPayload = Prisma.RecordGetPayload<{ include: typeof recordSerializationInclude }>;
type SerializedValuePayload = SerializedRecordPayload['values'][number];

type CompiledFilter = RecordFilter & { attribute: CrmAttributeForRecords };
type CompiledSort = RecordSort & { attribute: CrmAttributeForRecords };

class RecordsQueryValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'RecordsQueryValidationError';
    this.statusCode = statusCode;
  }
}

function handleRouteError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof CrmValueValidationError || err instanceof RecordsQueryValidationError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  next(err);
}

function isPrimaryTextSearchType(type: AttributeType): boolean {
  return (
    type === AttributeType.TEXT ||
    type === AttributeType.LONG_TEXT ||
    type === AttributeType.EMAIL ||
    type === AttributeType.PHONE ||
    type === AttributeType.URL
  );
}

async function findCrmObject(orgId: string, objectId?: string, objectKey?: string): Promise<CrmObjectForRecords | null> {
  return prisma.object.findFirst({
    where: {
      orgId,
      archivedAt: null,
      ...(objectId ? { id: objectId } : { key: objectKey! }),
    },
    select: {
      id: true,
      key: true,
      primaryAttribute: {
        select: {
          id: true,
          type: true,
        },
      },
      attributes: {
        where: {
          isArchived: false,
        },
        select: {
          id: true,
          key: true,
          type: true,
        },
      },
    },
  });
}

function buildRecordSearchWhere(crmObject: CrmObjectForRecords, search?: string): Prisma.RecordWhereInput {
  const trimmedSearch = search?.trim();

  if (!trimmedSearch) {
    return {};
  }

  if (crmObject.primaryAttribute && isPrimaryTextSearchType(crmObject.primaryAttribute.type)) {
    return {
      values: {
        some: {
          attributeId: crmObject.primaryAttribute.id,
          OR: [
            {
              textValue: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
            {
              longTextValue: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
          ],
        },
      },
    };
  }

  return {
    searchText: {
      contains: trimmedSearch,
      mode: 'insensitive',
    },
  };
}

function buildAttributeMap(attributes: CrmAttributeForRecords[]): Map<string, CrmAttributeForRecords> {
  return new Map(attributes.map((attribute) => [attribute.key, attribute]));
}

// M24-1: lookup атрибута по ключу для filter tree (lenient-компиляция против реальных атрибутов источника).
function attributeByKeyFor(crmObject: CrmObjectForRecords): (key: string) => AttributeLite | undefined {
  const map = buildAttributeMap(crmObject.attributes);
  return (key: string) => map.get(key);
}

// Применяет фильтр (filterTree приоритетнее плоского filters[]) к записям; lenient — невалидные листья отсеиваются.
function applyRecordFilter(
  records: SerializedRecordPayload[],
  crmObject: CrmObjectForRecords,
  opts: { filterTree?: unknown; filters: CompiledFilter[] },
): SerializedRecordPayload[] {
  if (opts.filterTree !== undefined && opts.filterTree !== null) {
    const { tree } = compileFilterTree(opts.filterTree, attributeByKeyFor(crmObject), { strict: false });
    return tree ? records.filter((record) => matchesCompiledTree(record, tree)) : records;
  }
  return opts.filters.length ? records.filter((record) => opts.filters.every((filter) => matchesFilter(record, filter))) : records;
}

function compileFilters(filters: RecordFilter[], crmObject: CrmObjectForRecords): CompiledFilter[] {
  const attributeMap = buildAttributeMap(crmObject.attributes);

  return filters.map((filter) => {
    const attribute = attributeMap.get(filter.attributeKey);

    if (!attribute) {
      throw new RecordsQueryValidationError(`Атрибут фильтра "${filter.attributeKey}" не найден в объекте.`);
    }

    return {
      ...filter,
      attribute,
    };
  });
}

function compileSorts(sorts: RecordSort[], crmObject: CrmObjectForRecords): CompiledSort[] {
  const attributeMap = buildAttributeMap(crmObject.attributes);

  return sorts.map((sort) => {
    const attribute = attributeMap.get(sort.attributeKey);

    if (!attribute) {
      throw new RecordsQueryValidationError(`Атрибут сортировки "${sort.attributeKey}" не найден в объекте.`);
    }

    return {
      ...sort,
      attribute,
    };
  });
}

function compareRecordsByDefault(left: SerializedRecordPayload, right: SerializedRecordPayload): number {
  const updatedDiff = right.updatedAt.getTime() - left.updatedAt.getTime();
  if (updatedDiff !== 0) return updatedDiff;

  return right.createdAt.getTime() - left.createdAt.getTime();
}

function sortRecords(records: SerializedRecordPayload[], sorts: CompiledSort[]): SerializedRecordPayload[] {
  return [...records].sort((left, right) => {
    for (const sort of sorts) {
      const leftValue = getValueForAttribute(left, sort.attribute);
      const rightValue = getValueForAttribute(right, sort.attribute);

      // Пустые/null значения ВСЕГДА уходят вниз, независимо от направления
      // (иначе при desc null-записи всплывали наверх — баг, найденный на приёмке C3).
      const leftEmpty = isEmptyValue(leftValue);
      const rightEmpty = isEmptyValue(rightValue);
      if (leftEmpty || rightEmpty) {
        if (leftEmpty && rightEmpty) continue; // равны по этому ключу → следующий sort
        return leftEmpty ? 1 : -1;
      }

      const comparison = compareRecordValues(leftValue, rightValue);
      if (comparison !== 0) {
        return sort.dir === 'desc' ? -comparison : comparison;
      }
    }

    return compareRecordsByDefault(left, right);
  });
}

// GET /api/records
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const query = listRecordsQuerySchema.parse(req.query);

    const crmObject = await findCrmObject(orgId, query.objectId, query.objectKey);

    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', crmObject.id))) return;

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const filters = compileFilters(query.filters, crmObject);
    const sorts = compileSorts(query.sorts, crmObject);

    const where: Prisma.RecordWhereInput = {
      orgId,
      objectId: crmObject.id,
      archivedAt: null,
      ...buildRecordSearchWhere(crmObject, query.search),
    };

    const records = await prisma.record.findMany({
      where,
      include: recordSerializationInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const filteredRecords = applyRecordFilter(records, crmObject, { filterTree: query.filterTree, filters });
    const sortedRecords = sorts.length ? sortRecords(filteredRecords, sorts) : filteredRecords;
    const paginatedRecords = sortedRecords.slice(skip, skip + limit);
    const total = filteredRecords.length;

    // M24-3: калькуляции по ПОЛНОМУ filtered-set (до пагинации) — page size не влияет на агрегат.
    const calculations = query.calcs.length ? computeCalculations(filteredRecords, attributeByKeyFor(crmObject), query.calcs as CalcRequest[]) : [];

    res.json({
      records: paginatedRecords.map((record) => serializeRecord(record)),
      calculations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// ─── Резолвер scope «текущего вида» → recordIds (для массового AI-прогона, M9.2) ──
// Backend сам вычисляет, какие записи попадают в ТЕКУЩИЙ ВИД (objectKey + filters + search),
// чтобы bulk-run шёл строго по виду, а не по всему объекту. Зеркалит выборку GET /records.
export async function resolveScopeRecordIds(
  orgId: string,
  params: { objectKey?: string; objectId?: string; search?: string; filters?: RecordFilter[]; filterTree?: unknown },
): Promise<{ objectId: string; objectKey: string; recordIds: string[] }> {
  const crmObject = await findCrmObject(orgId, params.objectId, params.objectKey);
  if (!crmObject) {
    throw new RecordsQueryValidationError('Object not found');
  }

  const filters = compileFilters(params.filters ?? [], crmObject);
  const where: Prisma.RecordWhereInput = {
    orgId,
    objectId: crmObject.id,
    archivedAt: null,
    ...buildRecordSearchWhere(crmObject, params.search),
  };

  const records = await prisma.record.findMany({
    where,
    include: recordSerializationInclude,
  });

  const filtered = applyRecordFilter(records, crmObject, { filterTree: params.filterTree, filters });

  return { objectId: crmObject.id, objectKey: crmObject.key, recordIds: filtered.map((r) => r.id) };
}

export { recordFilterSchema };

// POST /api/records
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = createRecordSchema.parse(req.body);

    const crmObject = await findCrmObject(orgId, data.objectId, data.objectKey);

    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', crmObject.id))) return;

    let createdActivityId = '';
    const createdRecord = await prisma.$transaction(async (tx) => {
      const record = await tx.record.create({
        data: {
          orgId,
          objectId: crmObject.id,
          createdById: req.user!.userId,
          updatedById: req.user!.userId,
        },
      });

      await writeValues(tx, record, data.values, { enforceRequired: true, actorId: req.user!.userId });

      const act = await tx.activity.create({
        data: {
          orgId,
          recordId: record.id,
          actorId: req.user!.userId,
          type: ActivityType.RECORD_CREATED,
          title: 'Record created',
          payload: {
            objectId: crmObject.id,
            objectKey: crmObject.key,
            valueKeys: Object.keys(data.values),
          } as Prisma.InputJsonValue,
        },
      });
      createdActivityId = act.id;

      const savedRecord = await tx.record.findFirst({
        where: {
          id: record.id,
          orgId,
        },
        include: recordSerializationInclude,
      });

      if (!savedRecord) {
        throw new Error('Record was not found after creation');
      }

      return savedRecord;
    });

    // M17-2: RECORD_CREATED — fire ТОЛЬКО на создание, post-commit, ключ rec-created:<recordId>:<activityId>.
    await runWorkflows({ orgId, trigger: 'RECORD_CREATED', recordId: createdRecord.id, objectId: crmObject.id, idempotencyKey: `rec-created:${createdRecord.id}:${createdActivityId}` }).catch(() => undefined);

    res.status(201).json(serializeRecord(createdRecord));
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// GET /api/records/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const record = await prisma.record.findFirst({
      where: {
        id: req.params.id,
        orgId,
        archivedAt: null,
      },
      include: recordSerializationInclude,
    });

    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', record.objectId))) return;

    res.json(await withResolvedRelationships(orgId, record.id, serializeRecord(record)));
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// Заменяет в сериализованной записи значения RELATIONSHIP-атрибутов (хранятся как target-id)
// на читаемые [{ id, displayName }] из таблицы RelationshipValue (источник истины) — чтобы
// пикер связей показывал имена, а не сырые id. Для одиночной записи (drawer) N+1 не страшен.
async function withResolvedRelationships(orgId: string, recordId: string, serialized: any) {
  try {
    const rels = await prisma.relationshipValue.findMany({
      where: { orgId, sourceRecordId: recordId },
      include: { targetRecord: { select: { id: true, displayName: true } }, sourceAttribute: { select: { key: true } } },
    });
    if (!rels.length) return serialized;
    const byKey: Record<string, { id: string; displayName: string | null }[]> = {};
    for (const r of rels) {
      (byKey[r.sourceAttribute.key] ||= []).push({ id: r.targetRecord.id, displayName: r.targetRecord.displayName });
    }
    serialized.values = { ...(serialized.values ?? {}) };
    for (const [key, arr] of Object.entries(byKey)) serialized.values[key] = arr;
  } catch { /* резолв не критичен */ }
  return serialized;
}

/* ════════════════ REL-2: обратная сторона связей (reverse relationships) ════════════════
 * Reverse-группа записи = source-записи, ссылающиеся на неё через forward-связь (RelationshipValue,
 * targetRecordId=эта запись, sourceAttributeId=def.sourceAttributeId). Проекция forward-данных:
 *  • read списка → READ на SOURCE-объект (иначе hiddenCount без утечки id/имён);
 *  • edit (add/remove) → READ_WRITE на forward-source; пишем ТОЛЬКО forward RelationshipValue (через writeValues);
 *  • cap 25 + total + hasMore; MANY_TO_ONE/ONE_TO_ONE source-side → rebind (перевешиваем source-record).
 */
const REVERSE_PAGE = 25;
const REVERSE_MAX = 100;
const reverseAddSchema = z.object({ sourceRecordId: z.string().min(1) });

// forward source-record держит РОВНО одну цель ⇔ его forward-кардинальность ограничивает source до одной цели.
function sourceHoldsOne(card: string): boolean {
  return card === 'MANY_TO_ONE' || card === 'ONE_TO_ONE';
}

type ReverseDef = { attr: { id: string; key: string; name: string; config: Prisma.JsonValue }; def: { sourceObjectId: string; sourceAttributeId: string; cardinality: string; sourceObject: { key: string } } };

// reverse-атрибуты целевого объекта + их определения
async function loadReverseDefs(objectId: string): Promise<ReverseDef[]> {
  const attrs = await prisma.attribute.findMany({
    where: { objectId, isArchived: false, reverseRelationshipDefinitions: { some: { archivedAt: null } } },
    select: { id: true, key: true, name: true, config: true, reverseRelationshipDefinitions: { where: { archivedAt: null }, select: { sourceObjectId: true, sourceAttributeId: true, cardinality: true, sourceObject: { select: { key: true } } }, take: 1 } },
  });
  return attrs.filter((a) => a.reverseRelationshipDefinitions.length > 0).map((a) => ({ attr: { id: a.id, key: a.key, name: a.name, config: a.config }, def: a.reverseRelationshipDefinitions[0] }));
}

async function resolveReverseGroup(req: Request, orgId: string, targetRecordId: string, rd: ReverseDef, skip: number, limit: number) {
  const u = { userId: req.user!.userId, role: req.user!.role };
  const level = await resolveAccess(orgId, u, 'OBJECT', rd.def.sourceObjectId);
  const canRead = meets(level, 'READ');
  const cfg = rd.attr.config as { reverseOfLabel?: string } | null | undefined;
  const base = { attributeId: rd.attr.id, attributeKey: rd.attr.key, name: rd.attr.name, sourceObjectKey: rd.def.sourceObject.key, reverseOfLabel: cfg?.reverseOfLabel ?? null, cardinality: rd.def.cardinality };
  const total = await prisma.relationshipValue.count({ where: { orgId, targetRecordId, sourceAttributeId: rd.def.sourceAttributeId } });
  if (!canRead) {
    // RBAC: нет READ на source-объект → только число скрытых, без id/имён (правка GPT)
    return { ...base, total, hasMore: false, hiddenCount: total, records: [] as { id: string; displayName: string | null; href: string }[], editable: false };
  }
  const rows = await prisma.relationshipValue.findMany({
    where: { orgId, targetRecordId, sourceAttributeId: rd.def.sourceAttributeId },
    select: { sourceRecord: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: 'desc' }, skip, take: limit,
  });
  return {
    ...base, total, hasMore: skip + rows.length < total, hiddenCount: 0,
    records: rows.map((r) => ({ id: r.sourceRecord.id, displayName: r.sourceRecord.displayName, href: `/crm/${rd.def.sourceObject.key}/${r.sourceRecord.id}` })),
    editable: meets(level, 'READ_WRITE'),
  };
}

// GET /api/records/:id/reverse — все reverse-группы (первые 25 в каждой)
router.get('/:id/reverse', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const record = await prisma.record.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true, objectId: true } });
    if (!record) { res.status(404).json({ error: 'Record not found' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', record.objectId))) return;
    const defs = await loadReverseDefs(record.objectId);
    const groups = await Promise.all(defs.map((rd) => resolveReverseGroup(req, orgId, record.id, rd, 0, REVERSE_PAGE)));
    res.json({ groups });
  } catch (err) { handleRouteError(err, res, next); }
});

// GET /api/records/:id/reverse/:attributeId?skip&limit — пагинация одной группы (expand)
router.get('/:id/reverse/:attributeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const record = await prisma.record.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true, objectId: true } });
    if (!record) { res.status(404).json({ error: 'Record not found' }); return; }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', record.objectId))) return;
    const rd = (await loadReverseDefs(record.objectId)).find((x) => x.attr.id === req.params.attributeId);
    if (!rd) { res.status(404).json({ error: 'Reverse field not found' }); return; }
    const skip = Math.max(0, parseInt(String(req.query.skip ?? '0'), 10) || 0);
    const limit = Math.min(REVERSE_MAX, Math.max(1, parseInt(String(req.query.limit ?? String(REVERSE_PAGE)), 10) || REVERSE_PAGE));
    res.json({ group: await resolveReverseGroup(req, orgId, record.id, rd, skip, limit) });
  } catch (err) { handleRouteError(err, res, next); }
});

// общий мутатор reverse-связи: перезаписывает forward-набор source-записи (writeValues) + Activity обе стороны + workflows.
async function mutateReverseLink(req: Request, res: Response, next: NextFunction, mode: 'add' | 'remove', sourceRecordId: string): Promise<void> {
  const orgId = req.user!.orgId!;
  const target = await prisma.record.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true, objectId: true } });
  if (!target) { res.status(404).json({ error: 'Record not found' }); return; }
  if (!(await assertAccess(req, res, 'OBJECT', 'READ', target.objectId))) return;
  const rd = (await loadReverseDefs(target.objectId)).find((x) => x.attr.id === req.params.attributeId);
  if (!rd) { res.status(404).json({ error: 'Reverse field not found' }); return; }
  // edit = READ_WRITE на forward-source (правка GPT)
  if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', rd.def.sourceObjectId))) return;
  const source = await prisma.record.findFirst({ where: { id: sourceRecordId, orgId, objectId: rd.def.sourceObjectId, archivedAt: null }, select: { id: true, orgId: true, objectId: true } });
  if (!source) { res.status(404).json({ error: 'Source record not found', code: 'REVERSE_SOURCE_NOT_FOUND' }); return; }

  // forward-набор source-записи: rebind для source-holds-one, иначе add/remove в множестве
  const existing = await prisma.relationshipValue.findMany({ where: { orgId, sourceRecordId: source.id, sourceAttributeId: rd.def.sourceAttributeId }, select: { targetRecordId: true } });
  const cur = existing.map((e) => e.targetRecordId);
  let nextTargets: string[];
  if (mode === 'add') nextTargets = sourceHoldsOne(rd.def.cardinality) ? [target.id] : Array.from(new Set([...cur, target.id]));
  else nextTargets = cur.filter((t) => t !== target.id);

  let changed: string[] = [];
  let srcActId = '';
  await prisma.$transaction(async (tx) => {
    changed = await writeValues(tx, source, { [rd.def.sourceAttributeId]: nextTargets }, { actorId: req.user!.userId });
    if (changed.length === 0) return; // нет реальных изменений → без Activity/триггеров
    const srcAct = await tx.activity.create({ data: { orgId, recordId: source.id, actorId: req.user!.userId, type: ActivityType.RECORD_UPDATED, title: mode === 'add' ? 'Relationship linked' : 'Relationship unlinked', payload: { reverse: true, forwardAttributeId: rd.def.sourceAttributeId, targetRecordId: target.id } as Prisma.InputJsonValue } });
    srcActId = srcAct.id;
    // Activity на ОБЕ стороны (правка GPT)
    await tx.activity.create({ data: { orgId, recordId: target.id, actorId: req.user!.userId, type: ActivityType.RECORD_UPDATED, title: mode === 'add' ? 'Reverse relationship linked' : 'Reverse relationship unlinked', payload: { reverse: true, reverseAttributeId: rd.attr.id, sourceRecordId: source.id } as Prisma.InputJsonValue } });
  });

  // forward-запись изменилась → те же триггеры, что у обычной правки source-записи
  if (changed.length > 0) {
    await runWorkflows({ orgId, trigger: 'RECORD_UPDATED', recordId: source.id, objectId: source.objectId, idempotencyKey: `rec-updated:${source.id}:${srcActId}` }).catch(() => undefined);
    for (const attrId of changed) {
      await runWorkflows({ orgId, trigger: 'ATTRIBUTE_UPDATED', recordId: source.id, objectId: source.objectId, idempotencyKey: `attr-updated:${source.id}:${attrId}:${srcActId}` }).catch(() => undefined);
    }
  }
  res.json({ group: await resolveReverseGroup(req, orgId, target.id, rd, 0, REVERSE_PAGE) });
}

// POST /api/records/:id/reverse/:attributeId { sourceRecordId } — привязать source-запись к этой (через forward)
router.post('/:id/reverse/:attributeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = reverseAddSchema.parse(req.body);
    await mutateReverseLink(req, res, next, 'add', body.sourceRecordId);
  } catch (err) { handleRouteError(err, res, next); }
});

// DELETE /api/records/:id/reverse/:attributeId/:sourceRecordId — снять привязку (удалить forward-связь)
router.delete('/:id/reverse/:attributeId/:sourceRecordId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await mutateReverseLink(req, res, next, 'remove', req.params.sourceRecordId);
  } catch (err) { handleRouteError(err, res, next); }
});

// PATCH /api/records/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = updateRecordSchema.parse(req.body);

    const existingRecord = await prisma.record.findFirst({
      where: {
        id: req.params.id,
        orgId,
        archivedAt: null,
      },
      select: {
        id: true,
        orgId: true,
        objectId: true,
      },
    });

    if (!existingRecord) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', existingRecord.objectId))) return;

    let changedAttrs: string[] = [];
    let updActivityId = '';
    const updatedRecord = await prisma.$transaction(async (tx) => {
      await tx.record.update({
        where: { id: existingRecord.id },
        data: {
          updatedById: req.user!.userId,
        },
      });

      changedAttrs = await writeValues(tx, existingRecord, data.values, { actorId: req.user!.userId });

      const act = await tx.activity.create({
        data: {
          orgId,
          recordId: existingRecord.id,
          actorId: req.user!.userId,
          type: ActivityType.RECORD_UPDATED,
          title: 'Record updated',
          payload: {
            recordId: existingRecord.id,
            valueKeys: Object.keys(data.values),
            changedAttributeIds: changedAttrs,
          } as Prisma.InputJsonValue,
        },
      });
      updActivityId = act.id;

      const savedRecord = await tx.record.findFirst({
        where: {
          id: existingRecord.id,
          orgId,
        },
        include: recordSerializationInclude,
      });

      if (!savedRecord) {
        throw new Error('Record was not found after update');
      }

      return savedRecord;
    });

    // M17-2: RECORD_UPDATED — fire ТОЛЬКО при РЕАЛЬНОМ изменении (no-op write → changedAttrs пуст → не fire).
    // ATTRIBUTE_UPDATED — по одному на каждый реально изменившийся атрибут (ключ с attributeId).
    if (changedAttrs.length > 0) {
      await runWorkflows({ orgId, trigger: 'RECORD_UPDATED', recordId: existingRecord.id, objectId: existingRecord.objectId, idempotencyKey: `rec-updated:${existingRecord.id}:${updActivityId}` }).catch(() => undefined);
      for (const attrId of changedAttrs) {
        await runWorkflows({ orgId, trigger: 'ATTRIBUTE_UPDATED', recordId: existingRecord.id, objectId: existingRecord.objectId, idempotencyKey: `attr-updated:${existingRecord.id}:${attrId}:${updActivityId}` }).catch(() => undefined);
        // M25-2: auto-rerun зависимых AI-полей (opt-in, recursion-guarded, idempotent по updActivityId)
        await triggerAutoRerunForChange({ orgId, recordId: existingRecord.id, objectId: existingRecord.objectId, changedAttributeId: attrId, sourceActivityId: updActivityId }).catch(() => undefined);
      }
    }

    res.json(await withResolvedRelationships(orgId, updatedRecord.id, serializeRecord(updatedRecord)));
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// PATCH /api/records/:id/move — переместить запись по SELECT-атрибуту (board drag-drop, V2).
// RBAC: MEMBER не имеет write-доступа к перемещению карточек → 403. Пишет descriptive Activity (аудит).
// M24-2: value=null/'' → переместить в «No stage» (очистка значения). Required-атрибут очистить нельзя (422).
const moveRecordSchema = z.object({
  attributeKey: attributeKeySchema,
  value: z.string().max(200).nullable().optional(),
});

router.patch('/:id/move', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const data = moveRecordSchema.parse(req.body);
    // clearing учитывает пробелы (как isClearInput в writeValues) — консистентный required-guard
    const clearing = data.value == null || data.value.trim() === '';

    const existing = await prisma.record.findFirst({
      where: { id: req.params.id, orgId, archivedAt: null },
      include: recordSerializationInclude,
    });

    if (!existing) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }
    // RBAC: перемещение карточки = write по объекту (MEMBER без READ_WRITE → 403).
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', existing.objectId))) return;

    // M24-2: атрибут группировки должен существовать; required нельзя сбросить в «No stage».
    const attr = await prisma.attribute.findFirst({
      where: { objectId: existing.objectId, key: data.attributeKey, isArchived: false },
      select: { isRequired: true },
    });
    if (!attr) {
      res.status(404).json({ error: 'Attribute not found' });
      return;
    }
    if (clearing && attr.isRequired) {
      res.status(422).json({ error: 'This field is required — a card can’t be moved to “No stage”.', code: 'REQUIRED_CANNOT_CLEAR' });
      return;
    }

    // прежнее значение атрибута — для записи «from → to» в timeline
    const before = serializeRecord(existing) as { values?: Record<string, unknown> };
    const fromRaw = before.values?.[data.attributeKey];
    const fromLabel = fromRaw && typeof fromRaw === 'object'
      ? ((fromRaw as Record<string, unknown>).label ?? (fromRaw as Record<string, unknown>).value ?? null)
      : (fromRaw ?? null);
    const toLabel = clearing ? 'No stage' : String(data.value);

    let changedAttrs: string[] = [];
    let moveActivityId = '';
    const updated = await prisma.$transaction(async (tx) => {
      await tx.record.update({ where: { id: existing.id }, data: { updatedById: req.user!.userId } });

      changedAttrs = await writeValues(
        tx,
        { id: existing.id, orgId, objectId: existing.objectId },
        { [data.attributeKey]: clearing ? null : data.value },
        { enforceRequired: false, actorId: req.user!.userId },
      );

      const act = await tx.activity.create({
        data: {
          orgId,
          recordId: existing.id,
          actorId: req.user!.userId,
          type: ActivityType.RECORD_UPDATED,
          title: `${data.attributeKey} changed${fromLabel ? `: ${String(fromLabel)} → ${toLabel}` : `: ${toLabel}`}`,
          payload: {
            attributeKey: data.attributeKey,
            from: fromLabel ?? null,
            to: clearing ? null : data.value,
            via: 'board',
          } as Prisma.InputJsonValue,
        },
      });
      moveActivityId = act.id;

      const saved = await tx.record.findFirst({ where: { id: existing.id, orgId }, include: recordSerializationInclude });
      if (!saved) throw new Error('Record was not found after move');
      return saved;
    });

    // M24-2 (адверс H1): board-move = реальное изменение → ТЕ ЖЕ workflow-триггеры, что и PATCH /:id
    // (иначе автоматизация «stage→won» не срабатывала на board-drag). idempotency-ключи совпадают по форме.
    if (changedAttrs.length > 0) {
      await runWorkflows({ orgId, trigger: 'RECORD_UPDATED', recordId: existing.id, objectId: existing.objectId, idempotencyKey: `rec-updated:${existing.id}:${moveActivityId}` }).catch(() => undefined);
      for (const attrId of changedAttrs) {
        await runWorkflows({ orgId, trigger: 'ATTRIBUTE_UPDATED', recordId: existing.id, objectId: existing.objectId, idempotencyKey: `attr-updated:${existing.id}:${attrId}:${moveActivityId}` }).catch(() => undefined);
        await triggerAutoRerunForChange({ orgId, recordId: existing.id, objectId: existing.objectId, changedAttributeId: attrId, sourceActivityId: moveActivityId }).catch(() => undefined);
      }
    }

    res.json(serializeRecord(updated));
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// GET /api/records/:id/activities — история активностей записи (S061)
router.get('/:id/activities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    // M27-2: чтение activities допустимо и на archived записи (read-only, согласовано с notes/tasks GET).
    const existingRecord = await prisma.record.findFirst({
      where: { id: req.params.id, orgId },
      select: { id: true, objectId: true },
    });

    if (!existingRecord) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ', existingRecord.objectId))) return;

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const [activities, total] = await prisma.$transaction([
      prisma.activity.findMany({
        where: { recordId: existingRecord.id, orgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          payload: true,
          createdAt: true,
          actor: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.activity.count({ where: { recordId: existingRecord.id, orgId } }),
    ]);

    // M27-1 redaction (правка GPT #1): активность, раскрывающая ДРУГУЮ запись/список, видна только при доступе
    // зрителя к той сущности; иначе — { type, actor, createdAt, redacted:true }. Сырой payload наружу не отдаём.
    const viewer = { userId: req.user!.userId, role: req.user!.role };
    const [objectResolver, listResolver] = await Promise.all([
      buildResolver(orgId, viewer, 'OBJECT'),
      buildResolver(orgId, viewer, 'LIST'),
    ]);
    const otherRecordIds = collectOtherRecordIds(activities);
    const recordObject = new Map<string, string>();
    if (otherRecordIds.length) {
      const others = await prisma.record.findMany({ where: { id: { in: otherRecordIds }, orgId }, select: { id: true, objectId: true } });
      for (const r of others) recordObject.set(r.id, r.objectId);
    }
    const safe = redactActivities(activities, { objectAccess: objectResolver, listAccess: listResolver, recordObject });

    res.json({
      activities: safe,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// POST /api/records/bulk-archive — массовое архивирование записей (S066)
router.post('/bulk-archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const data = z
      .object({ ids: z.array(z.string().min(1)).min(1).max(500) })
      .parse(req.body);

    // Проверяем, что все записи принадлежат организации
    const records = await prisma.record.findMany({
      where: { id: { in: data.ids }, orgId, archivedAt: null },
      select: { id: true, objectId: true },
    });

    // RBAC: архивируем только записи объектов, где есть READ_WRITE (S355). Ничего не разрешено → 403.
    const resolver = await buildResolver(orgId, { userId: req.user!.userId, role: req.user!.role }, 'OBJECT');
    const validIds = records.filter((r) => meets(resolver(r.objectId), 'READ_WRITE')).map((r) => r.id);

    if (records.length === 0) {
      res.status(400).json({ error: 'No valid records found' });
      return;
    }
    if (validIds.length === 0) {
      res.status(403).json({ error: 'You don’t have write access to these records', code: 'PERMISSION_DENIED', entityKind: 'OBJECT', needed: 'READ_WRITE' });
      return;
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.record.updateMany({
        where: { id: { in: validIds }, orgId },
        data: { archivedAt: now, updatedById: req.user!.userId },
      });

      // Одна bulk-активность за всё архивирование
      await tx.activity.createMany({
        data: validIds.map((recordId) => ({
          orgId,
          recordId,
          actorId: req.user!.userId,
          type: ActivityType.RECORD_ARCHIVED,
          title: 'Record archived (bulk)',
          payload: { recordId, batch: true } as Prisma.InputJsonValue,
        })),
      });
    });

    res.json({ archived: validIds.length, ids: validIds });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// POST /api/records/import — массовый импорт из распарсенного CSV (маппинг колонок + дедуп)
const importSchema = objectLookupBase
  .extend({
    rows: z.array(z.record(z.unknown())).min(1).max(2000),
    mapping: z.record(z.string()), // csvColumn -> attributeKey
    dedupeKey: z.string().optional(), // attributeKey для дедупликации (companies=domain, people=email)
  })
  .refine(requireObjectRef, objectRefMsg);

function normalizeDedupe(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

router.post('/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = importSchema.parse(req.body);

    const crmObject = await findCrmObject(orgId, data.objectId, data.objectKey);
    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', crmObject.id))) return;

    const attributes = await prisma.attribute.findMany({
      where: { objectId: crmObject.id, orgId, isArchived: false },
      select: { key: true, type: true },
    });
    const validKeys = new Set(attributes.map((a) => a.key));
    const typeByKey = new Map(attributes.map((a) => [a.key, a.type]));

    // Лёгкая коэрция значения CSV под тип атрибута (CSV всегда строки).
    const coerce = (attr: string, raw: string): unknown => {
      const type = typeByKey.get(attr);
      const v = raw.trim();
      if (type === AttributeType.URL && v && !/^https?:\/\//i.test(v)) return 'https://' + v;
      if (type === AttributeType.NUMBER || type === AttributeType.CURRENCY) {
        const n = Number(v.replace(/[^0-9.\-]/g, ''));
        return Number.isFinite(n) ? n : undefined;
      }
      if (type === AttributeType.BOOLEAN) return /^(true|yes|1|да|y)$/i.test(v);
      return v;
    };

    const map = Object.entries(data.mapping).filter(([, attr]) => validKeys.has(attr));
    if (map.length === 0) {
      res.status(400).json({ error: 'Нет валидного маппинга колонок на атрибуты', code: 'NO_MAPPING' });
      return;
    }

    const dedupeKey = data.dedupeKey && validKeys.has(data.dedupeKey) ? data.dedupeKey : undefined;

    // Карта существующих записей по ключу дедупликации (domain/email).
    const dedupeMap = new Map<string, string>();
    if (dedupeKey) {
      const existing = await prisma.record.findMany({
        where: { orgId, objectId: crmObject.id, archivedAt: null },
        include: recordSerializationInclude,
      });
      for (const r of existing) {
        const v = (serializeRecord(r).values as Record<string, unknown>)[dedupeKey];
        if (v) dedupeMap.set(normalizeDedupe(v), r.id);
      }
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < data.rows.length; i += 1) {
      const row = data.rows[i];
      const values: Record<string, unknown> = {};
      for (const [col, attr] of map) {
        const raw = row[col];
        if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
          const coerced = coerce(attr, String(raw));
          if (coerced !== undefined) values[attr] = coerced;
        }
      }
      if (Object.keys(values).length === 0) {
        skipped += 1;
        continue;
      }

      const dv = dedupeKey ? values[dedupeKey] : undefined;
      const dupId = dedupeKey && dv ? dedupeMap.get(normalizeDedupe(dv)) : undefined;

      try {
        if (dupId) {
          await prisma.$transaction(async (tx) => {
            const rec = await tx.record.findFirst({ where: { id: dupId, orgId } });
            if (!rec) throw new Error('Запись не найдена');
            await writeValues(tx, rec, values, { enforceRequired: false, actorId: req.user!.userId });
            await tx.record.update({ where: { id: dupId }, data: { updatedById: req.user!.userId } });
          });
          updated += 1;
        } else {
          const newId = await prisma.$transaction(async (tx) => {
            const rec = await tx.record.create({
              data: { orgId, objectId: crmObject.id, createdById: req.user!.userId, updatedById: req.user!.userId },
            });
            await writeValues(tx, rec, values, { enforceRequired: false, actorId: req.user!.userId });
            await tx.activity.create({
              data: {
                orgId,
                recordId: rec.id,
                actorId: req.user!.userId,
                type: ActivityType.RECORD_CREATED,
                title: 'Record imported (CSV)',
                payload: { objectKey: crmObject.key, imported: true } as Prisma.InputJsonValue,
              },
            });
            return rec.id;
          });
          if (dedupeKey && dv) dedupeMap.set(normalizeDedupe(dv), newId); // защита от дублей внутри файла
          created += 1;
        }
      } catch (e) {
        errors.push({ row: i + 1, error: (e instanceof Error ? e.message : 'failed').slice(0, 160) });
      }
    }

    res.status(201).json({ created, updated, skipped, errors, total: data.rows.length, dedupeKey: dedupeKey ?? null });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// AI-SDR стадии (Pipeline Radar). Пишутся в атрибут agent_stage (не last_agent_action — он аудит).
const AGENT_STAGES = [
  'sourced', 'researching', 'ready_to_engage', 'engaging', 'in_conversation',
  'meeting_set', 'handed_off', 'nurture', 'recycle', 'suppressed', 'disqualified',
];

// POST /api/records/bulk-stage — проставить agent_stage выбранным записям (Push to Pipeline)
const bulkStageSchema = objectLookupBase
  .extend({ ids: z.array(z.string().min(1)).min(1).max(500), stage: z.string().min(1) })
  .refine(requireObjectRef, objectRefMsg);

router.post('/bulk-stage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = bulkStageSchema.parse(req.body);
    if (!AGENT_STAGES.includes(data.stage)) {
      res.status(400).json({ error: 'Unknown stage', code: 'BAD_STAGE', allowed: AGENT_STAGES });
      return;
    }

    const crmObject = await findCrmObject(orgId, data.objectId, data.objectKey);
    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', crmObject.id))) return;

    // Гарантируем наличие атрибута agent_stage (создаём один раз).
    let stageAttr = await prisma.attribute.findFirst({
      where: { objectId: crmObject.id, orgId, key: 'agent_stage', isArchived: false },
      select: { id: true },
    });
    if (!stageAttr) {
      const maxOrder = await prisma.attribute.aggregate({
        where: { objectId: crmObject.id, orgId },
        _max: { order: true },
      });
      stageAttr = await prisma.attribute.create({
        data: {
          orgId,
          objectId: crmObject.id,
          key: 'agent_stage',
          name: 'Agent stage',
          type: AttributeType.TEXT,
          isSystem: false,
          isRequired: false,
          isUnique: false,
          isPrimary: false,
          order: (maxOrder._max.order ?? 0) + 1,
        },
        select: { id: true },
      });
    }

    const records = await prisma.record.findMany({
      where: { id: { in: data.ids }, orgId, objectId: crmObject.id, archivedAt: null },
      select: { id: true },
    });

    let staged = 0;
    for (const rec of records) {
      try {
        await prisma.$transaction(async (tx) => {
          const full = await tx.record.findFirst({ where: { id: rec.id, orgId } });
          if (!full) return;
          await writeValues(tx, full, { agent_stage: data.stage }, { enforceRequired: false, actorId: req.user!.userId });
          await tx.activity.create({
            data: {
              orgId,
              recordId: rec.id,
              actorId: req.user!.userId,
              type: ActivityType.VALUE_UPDATED,
              title: `Pushed to Pipeline: ${data.stage}`,
              payload: { agent_stage: data.stage, action: 'PUSHED_TO_PIPELINE' } as Prisma.InputJsonValue,
            },
          });
        });
        staged += 1;
      } catch {
        /* пропускаем сбойную запись */
      }
    }

    res.json({ staged, stage: data.stage });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// POST /api/records/enroll-campaign — записать выбранные записи в кампанию (Add to campaign)
// Recipient-first: создаём Lead из записи (нужен email) + CampaignLead. Без email — skip с причиной.
const enrollSchema = objectLookupBase
  .extend({ recordIds: z.array(z.string().min(1)).min(1).max(500), campaignId: z.string().min(1) })
  .refine(requireObjectRef, objectRefMsg);

function pickValue(values: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = values[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim()) return v[0].trim();
  }
  return undefined;
}

router.post('/enroll-campaign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = enrollSchema.parse(req.body);

    const crmObject = await findCrmObject(orgId, data.objectId, data.objectKey);
    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', crmObject.id))) return;
    const campaign = await prisma.campaign.findFirst({ where: { id: data.campaignId, orgId } });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    if (!(await assertAccess(req, res, 'SEQUENCE', 'READ_WRITE', campaign.id))) return;

    const records = await prisma.record.findMany({
      where: { id: { in: data.recordIds }, orgId, objectId: crmObject.id, archivedAt: null },
      include: recordSerializationInclude,
    });

    let enrolled = 0;
    const skipped: { name: string; reason: string }[] = [];

    for (const rec of records) {
      const values = serializeRecord(rec).values as Record<string, unknown>;
      const displayName = serializeRecord(rec).displayName || 'Record';
      const email = pickValue(values, ['email', 'contact_email', 'work_email']);
      if (!email) {
        skipped.push({ name: displayName, reason: 'нет email — нужен research/контакт' });
        continue;
      }
      const fullName =
        pickValue(values, ['decision_makers', 'contact_name', 'full_name', 'name']) || displayName;
      const parts = fullName.split(/\s+/);
      const firstName = parts[0] || 'Contact';
      const lastName = parts.slice(1).join(' ') || (pickValue(values, ['name']) ?? 'Contact');
      const company = pickValue(values, ['company', 'name']) || displayName;

      try {
        await prisma.$transaction(async (tx) => {
          // Лид по email — дедуп в рамках org.
          let lead = await tx.lead.findFirst({ where: { orgId, email } });
          if (!lead) {
            lead = await tx.lead.create({
              data: {
                orgId,
                firstName,
                lastName,
                email,
                company,
                industry: pickValue(values, ['industry']) ?? null,
                source: 'datahub',
                status: 'NEW',
              },
            });
          }
          const existing = await tx.campaignLead.findFirst({
            where: { campaignId: campaign.id, leadId: lead.id },
          });
          if (!existing) {
            await tx.campaignLead.create({
              data: { campaignId: campaign.id, leadId: lead.id, currentStep: 0, status: 'PENDING', nextSendAt: new Date() },
            });
          }
        });
        enrolled += 1;
      } catch (e) {
        skipped.push({ name: displayName, reason: (e instanceof Error ? e.message : 'failed').slice(0, 80) });
      }
    }

    res.json({ enrolled, skipped, campaign: { id: campaign.id, name: campaign.name } });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// DELETE /api/records/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;

    const existingRecord = await prisma.record.findFirst({
      where: {
        id: req.params.id,
        orgId,
        archivedAt: null,
      },
      select: {
        id: true,
        objectId: true,
      },
    });

    if (!existingRecord) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }
    if (!(await assertAccess(req, res, 'OBJECT', 'READ_WRITE', existingRecord.objectId))) return;

    const archivedRecord = await prisma.$transaction(async (tx) => {
      const record = await tx.record.update({
        where: { id: existingRecord.id },
        data: {
          archivedAt: new Date(),
          updatedById: req.user!.userId,
        },
        include: recordSerializationInclude,
      });

      await tx.activity.create({
        data: {
          orgId,
          recordId: existingRecord.id,
          actorId: req.user!.userId,
          type: ActivityType.RECORD_ARCHIVED,
          title: 'Record archived',
          payload: {
            recordId: existingRecord.id,
            objectId: existingRecord.objectId,
          } as Prisma.InputJsonValue,
        },
      });

      return record;
    });

    res.json(serializeRecord(archivedRecord));
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

export default router;