import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, ListType, Prisma } from '@prisma/client';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';
import { serializeRecord, recordSerializationInclude } from '../services/crm/values';
import { runWorkflows } from '../services/workflows';
import { assertAccess, buildResolver, meets, resolveAccess } from '../services/permissions';
import { compileFilterTree, matchesCompiledTree, sortFilterableRecords, type AttributeLite, type CompiledSortLike } from '../services/crm/recordFilter';
import { computeCalculations, CALC_TYPES, type CalcRequest, type CalcType } from '../services/crm/recordAggregate';
import { compileListRule, computeDynamicMembers, readListRule, hasListRule, type DynamicMember } from '../services/crm/listMembership';
import { validateStages, readStages, firstStageKey, stageKeySet, LIST_STAGE_DEFAULTS, type PipelineStage } from '../services/crm/listPipeline';
import { audit } from '../services/audit';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

const listInclude = {
  primaryObject: { select: { id: true, key: true, singularName: true, pluralName: true, icon: true } },
  _count: { select: { entries: { where: { archivedAt: null } } } },
} as const;

const createSchema = z.object({
  name: z.string().min(1).max(120),
  objectKey: z.string().min(1).optional(),
  primaryObjectId: z.string().optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(80).optional(),
  color: z.string().max(40).optional(),
  type: z.nativeEnum(ListType).optional(),
  // LST-1: rule (filterTree) для DYNAMIC. Для остальных типов игнорируется.
  rule: z.unknown().optional(),
  // LST-2: stages для PIPELINE. Если не заданы — посеются дефолтные. Для остальных типов игнорируется.
  stages: z.array(z.unknown()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(80).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
  // LST-1: правка правила DYNAMIC-списка. null = очистить (пустой список). undefined = не трогать.
  rule: z.unknown().optional(),
});

const previewRuleSchema = z.object({
  objectKey: z.string().min(1).optional(),
  primaryObjectId: z.string().optional(),
  rule: z.unknown(),
});

const addEntriesSchema = z.object({ recordIds: z.array(z.string().min(1)).min(1).max(500) });

// LST-2: правка стадий PIPELINE. moveToStage — куда переселить entries удаляемых стадий.
const configStagesSchema = z.object({
  stages: z.array(z.unknown()).min(1),
  moveToStage: z.string().min(1).optional(),
});
// LST-2: перемещение entry между стадиями/позициями. position — желаемый индекс в колонке (0..n).
const moveEntrySchema = z.object({
  stage: z.string().min(1),
  position: z.number().int().min(0).optional(),
});

// ── LST-1 helpers ────────────────────────────────────────────────────────────
const attrSelectForRule = { where: { isArchived: false }, select: { id: true, key: true, type: true } } as const;

/** RBAC шаг 2: после LIST READ требуется OBJECT READ на primaryObject (план Q5). */
async function objectReadable(req: Request, primaryObjectId: string): Promise<boolean> {
  const lvl = await resolveAccess(req.user!.orgId!, { userId: req.user!.userId, role: req.user!.role }, 'OBJECT', primaryObjectId);
  return meets(lvl, 'READ');
}

/** Метаданные-only summary для audit правила (НЕ кладём весь filterTree). */
function ruleAuditSummary(listId: string, matchedCount: number, hadRule: boolean): string {
  return `list ${listId} rule ${hadRule ? 'set' : 'cleared'} · matched ${matchedCount}`;
}

/**
 * LST-2: транзакция уровня Serializable с ретраем на P2034 (write-conflict/deadlock).
 * Защищает rebalance позиций колонки от гонок параллельных move (иначе дубли/дыры в position).
 */
async function runSerializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034' && attempt < 4) continue;
      throw e;
    }
  }
}

// GET /api/lists?objectKey=
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const objectKey = typeof req.query.objectKey === 'string' ? req.query.objectKey : undefined;
    const all = await prisma.list.findMany({
      where: { orgId, archivedAt: null, ...(objectKey ? { primaryObject: { key: objectKey } } : {}) },
      include: listInclude,
      orderBy: [{ createdAt: 'desc' }],
    });
    // RBAC: скрываем списки с уровнем NONE (S355 — No access не виден)
    const resolver = await buildResolver(orgId, { userId: req.user!.userId, role: req.user!.role }, 'LIST');
    const lists = all.filter((l) => meets(resolver(l.id), 'READ'));
    res.json({ lists });
  } catch (err) {
    next(err);
  }
});

// POST /api/lists
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'LIST', 'READ_WRITE'))) return;
    const data = createSchema.parse(req.body);

    const obj = data.primaryObjectId
      ? await prisma.object.findFirst({ where: { orgId, id: data.primaryObjectId, archivedAt: null }, select: { id: true, attributes: attrSelectForRule } })
      : data.objectKey
        ? await prisma.object.findFirst({ where: { orgId, key: data.objectKey, archivedAt: null }, select: { id: true, attributes: attrSelectForRule } })
        : null;
    if (!data.primaryObjectId && !data.objectKey) { res.status(400).json({ error: 'objectKey or primaryObjectId is required' }); return; }
    if (!obj) { res.status(400).json({ error: 'Object not found' }); return; }
    const primaryObjectId = obj.id;

    const type = data.type ?? ListType.STATIC;

    // LST-1: rule осмыслен только для DYNAMIC. Валидируем strict ДО create — невалид → 422 без создания списка.
    let config: Record<string, unknown> | undefined;
    let matchedCount: number | undefined;
    let warnings: string[] = [];
    if (type === ListType.DYNAMIC && hasListRule(data.rule)) {
      const attrByKey = new Map<string, AttributeLite>(obj.attributes.map((a) => [a.key, a]));
      compileListRule(data.rule, (k) => attrByKey.get(k), { strict: true }); // throws ListRuleError → 422
      const computed = await computeDynamicMembers(prisma, orgId, primaryObjectId, data.rule, (k) => attrByKey.get(k));
      matchedCount = computed.records.length;
      warnings = computed.warnings;
      config = { rule: data.rule };
    } else if (type === ListType.DYNAMIC) {
      // DYNAMIC без правила = честно пустой список (не «все»). config.rule отсутствует.
      matchedCount = 0;
    } else if (type === ListType.PIPELINE) {
      // LST-2: PIPELINE всегда имеет стадии. Заданы — валидируем strict (→422); иначе — КОПИЯ дефолтных
      // (не ссылка на module-level массив — иначе общий мутабельный стейт между списками/орг).
      const stages = data.stages ? validateStages(data.stages) : LIST_STAGE_DEFAULTS.map((s) => ({ ...s }));
      config = { stages };
    }

    const list = await prisma.list.create({
      data: {
        orgId,
        name: data.name,
        description: data.description ?? null,
        icon: data.icon ?? null,
        color: data.color ?? null,
        primaryObjectId,
        type,
        config: config ? (config as Prisma.InputJsonValue) : undefined,
        createdById: req.user!.userId,
      },
      include: listInclude,
    });

    if (type === ListType.DYNAMIC) {
      await audit({ orgId, actorId: req.user!.userId, action: 'LIST_RULE_UPDATED', targetType: 'list', targetId: list.id, summary: ruleAuditSummary(list.id, matchedCount ?? 0, Boolean(config)) });
    } else if (type === ListType.PIPELINE) {
      const stages = (config?.stages as PipelineStage[]) ?? [];
      await audit({ orgId, actorId: req.user!.userId, action: 'LIST_STAGE_CONFIG_UPDATED', targetType: 'list', targetId: list.id, summary: `list ${list.id} pipeline created · stages [${stages.map((s) => s.key).join(', ')}]` });
    }
    res.status(201).json({ ...list, ...(matchedCount !== undefined ? { matchedCount } : {}), ...(warnings.length ? { warnings } : {}) });
  } catch (err) {
    next(err);
  }
});

// POST /api/lists/preview-rule — live-предпросмотр matchedCount правила DYNAMIC до сохранения списка.
// Путь литеральный (не :id) — регистрируем ДО роутов /:id, чтобы Express не перехватил.
router.post('/preview-rule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'LIST', 'READ_WRITE'))) return;
    const data = previewRuleSchema.parse(req.body);
    const obj = data.primaryObjectId
      ? await prisma.object.findFirst({ where: { orgId, id: data.primaryObjectId, archivedAt: null }, select: { id: true, attributes: attrSelectForRule } })
      : data.objectKey
        ? await prisma.object.findFirst({ where: { orgId, key: data.objectKey, archivedAt: null }, select: { id: true, attributes: attrSelectForRule } })
        : null;
    if (!data.primaryObjectId && !data.objectKey) { res.status(400).json({ error: 'objectKey or primaryObjectId is required' }); return; }
    if (!obj) { res.status(400).json({ error: 'Object not found' }); return; }
    // Preview раскрывает число записей объекта → требует OBJECT READ (как и сам список).
    if (!(await objectReadable(req, obj.id))) {
      res.status(403).json({ error: "You don't have read access to this object", code: 'PERMISSION_DENIED' });
      return;
    }
    const attrByKey = new Map<string, AttributeLite>(obj.attributes.map((a) => [a.key, a]));
    // strict-валидация — кривое правило отражаем как 422 в namespace списка (для UI до сохранения).
    compileListRule(data.rule, (k) => attrByKey.get(k), { strict: true });
    const computed = await computeDynamicMembers(prisma, orgId, obj.id, data.rule, (k) => attrByKey.get(k));
    res.json({ matchedCount: computed.records.length, hasRule: hasListRule(data.rule), warnings: computed.warnings, truncated: computed.truncated });
  } catch (err) {
    next(err);
  }
});

// GET /api/lists/:id — список + его записи (резолв значений через serializeRecord)
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'LIST', 'READ', req.params.id))) return;
    const list = await prisma.list.findFirst({
      where: { id: req.params.id, orgId, archivedAt: null },
      include: listInclude,
    });
    if (!list) { res.status(404).json({ error: 'List not found' }); return; }

    // RBAC шаг 2 (план Q5): LIST READ есть; теперь нужен OBJECT READ на primaryObject.
    const canReadObject = await objectReadable(req, list.primaryObjectId);

    if (list.type === ListType.DYNAMIC) {
      const attrs = await prisma.attribute.findMany({ where: { objectId: list.primaryObjectId, isArchived: false }, select: { id: true, key: true, type: true } });
      const attrByKey = new Map<string, AttributeLite>(attrs.map((a) => [a.key, a]));
      const rule = readListRule(list.config);
      const computed = await computeDynamicMembers(prisma, orgId, list.primaryObjectId, rule, (k) => attrByKey.get(k));
      const matchedCount = computed.records.length;
      if (!canReadObject) {
        // Скрываем записи И само правило (не раскрываем какие условия совпали). Только число.
        res.json({ list: { ...list, config: null }, records: [], restrictedSource: true, hiddenCount: matchedCount });
        return;
      }
      const records = computed.records.map((r) => ({ entryId: null as string | null, stage: null as string | null, ...serializeRecord(r) }));
      res.json({ list, records, matchedCount, ...(computed.warnings.length ? { warnings: computed.warnings } : {}) });
      return;
    }

    // STATIC / PIPELINE — ручное членство через ListEntry.
    if (!canReadObject) {
      const hiddenCount = await prisma.listEntry.count({ where: { listId: list.id, orgId, archivedAt: null, record: { archivedAt: null } } });
      res.json({ list, records: [], restrictedSource: true, hiddenCount });
      return;
    }

    const entries = await prisma.listEntry.findMany({
      where: { listId: list.id, orgId, archivedAt: null, record: { archivedAt: null } },
      include: { record: { include: recordSerializationInclude } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    const records = entries.map((e) => ({ entryId: e.id, stage: e.stage, ...serializeRecord(e.record) }));
    res.json({ list, records });
  } catch (err) {
    next(err);
  }
});

// GET /api/lists/:id/records — записи списка с применением view (filterTree + sorts).
// M24-1: паритет с object table-view — ОБЩИЙ фильтр/сорт-движок (recordFilter.ts), тот же, что Data Hub.
function jsonObjectQuery(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return undefined; }
  }
  return raw;
}

router.get('/:id/records', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'LIST', 'READ', req.params.id))) return;

    const list = await prisma.list.findFirst({
      where: { id: req.params.id, orgId, archivedAt: null },
      select: {
        id: true,
        type: true,
        config: true,
        primaryObject: {
          select: { id: true, attributes: { where: { isArchived: false }, select: { id: true, key: true, type: true } } },
        },
      },
    });
    if (!list?.primaryObject) { res.status(404).json({ error: 'List not found' }); return; }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const filterTree = jsonObjectQuery(req.query.filterTree);
    const sortsRaw = jsonObjectQuery(req.query.sorts);
    const calcsRaw = jsonObjectQuery(req.query.calcs);

    const attrByKey = new Map<string, AttributeLite>(list.primaryObject.attributes.map((a) => [a.key, a]));

    // RBAC шаг 2: нет OBJECT READ → метаданные без записей (honest hiddenCount, без значений/правила).
    const canReadObject = await objectReadable(req, list.primaryObject.id);

    // Кандидаты до view-фильтра: DYNAMIC = computed-by-rule (1-я ступень); STATIC/PIPELINE = ListEntry.
    let records: DynamicMember[];
    let entryByRecordId: Map<string, { id: string; stage: string | null }>;
    let membershipWarnings: string[] = [];

    if (list.type === ListType.DYNAMIC) {
      const rule = readListRule(list.config);
      const computed = await computeDynamicMembers(prisma, orgId, list.primaryObject.id, rule, (k) => attrByKey.get(k));
      records = computed.records;
      membershipWarnings = computed.warnings;
      entryByRecordId = new Map(); // DYNAMIC: ListEntry не используется
    } else {
      const entries = await prisma.listEntry.findMany({
        where: { listId: list.id, orgId, archivedAt: null, record: { archivedAt: null } },
        include: { record: { include: recordSerializationInclude } },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      });
      // entry ↔ record 1:1 (ListEntry @@unique[listId,recordId]) → восстанавливаем entry после фильтра/сорта
      entryByRecordId = new Map(entries.map((e) => [e.record.id, { id: e.id, stage: e.stage }]));
      records = entries.map((e) => e.record);
    }

    if (!canReadObject) {
      res.json({ records: [], calculations: [], restrictedSource: true, hiddenCount: records.length, pagination: { page, limit, total: records.length, totalPages: Math.ceil(records.length / limit) } });
      return;
    }

    // view-фильтр поверх членства (2-я ступень для DYNAMIC; обычный фильтр для STATIC) — lenient, ОБЩИЙ движок
    if (filterTree !== undefined && filterTree !== null) {
      const { tree } = compileFilterTree(filterTree, (k) => attrByKey.get(k), { strict: false });
      if (tree) records = records.filter((record) => matchesCompiledTree(record, tree));
    }

    // сортировка через ОБЩИЙ sortFilterableRecords (пустые вниз), tie-break = свежесть записи
    const sorts: CompiledSortLike[] = Array.isArray(sortsRaw)
      ? (sortsRaw as Array<{ attributeKey?: unknown; dir?: unknown }>)
          .map((s) => {
            const attribute = typeof s.attributeKey === 'string' ? attrByKey.get(s.attributeKey) : undefined;
            return attribute ? { attribute, dir: s.dir === 'desc' ? ('desc' as const) : ('asc' as const) } : null;
          })
          .filter((s): s is CompiledSortLike => s !== null)
      : [];

    if (sorts.length) {
      records = sortFilterableRecords(records, sorts, (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    const total = records.length;
    const paged = records.slice((page - 1) * limit, (page - 1) * limit + limit);
    const out = paged.map((record) => {
      const entry = entryByRecordId.get(record.id); // DYNAMIC: entry отсутствует → entryId/stage null
      return { entryId: entry?.id ?? null, stage: entry?.stage ?? null, ...serializeRecord(record) };
    });

    // M24-3: калькуляции по ПОЛНОМУ filtered-set списка (до пагинации) — паритет с object table.
    const calcs: CalcRequest[] = Array.isArray(calcsRaw)
      ? (calcsRaw as Array<{ attributeKey?: unknown; type?: unknown }>)
          .filter((c) => typeof c.attributeKey === 'string' && typeof c.type === 'string' && CALC_TYPES.has(c.type))
          .map((c) => ({ attributeKey: c.attributeKey as string, type: c.type as CalcType }))
      : [];
    const calculations = calcs.length ? computeCalculations(records, (k) => attrByKey.get(k), calcs) : [];

    res.json({ records: out, calculations, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, ...(membershipWarnings.length ? { warnings: membershipWarnings } : {}) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/lists/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'LIST', 'READ_WRITE', req.params.id))) return;
    const data = updateSchema.parse(req.body);
    const existing = await prisma.list.findFirst({
      where: { id: req.params.id, orgId, archivedAt: null },
      select: { id: true, type: true, config: true, primaryObjectId: true },
    });
    if (!existing) { res.status(404).json({ error: 'List not found' }); return; }

    // LST-1: правка rule. data.rule===undefined → поле не трогали; null/значение → меняем правило.
    const ruleTouched = data.rule !== undefined;
    let nextConfig: { rule?: unknown } | undefined;
    let matchedCount: number | undefined;
    let ruleWarnings: string[] = [];
    if (ruleTouched) {
      if (existing.type !== ListType.DYNAMIC) {
        res.status(400).json({ error: 'Membership rule is only valid for dynamic lists', code: 'LIST_RULE_REQUIRES_DYNAMIC' });
        return;
      }
      const base = (existing.config && typeof existing.config === 'object' && !Array.isArray(existing.config)) ? { ...(existing.config as Record<string, unknown>) } : {};
      if (data.rule === null || !hasListRule(data.rule)) {
        // Очистка правила → честно пустой список.
        delete (base as Record<string, unknown>).rule;
        nextConfig = base as { rule?: unknown };
        matchedCount = 0;
      } else {
        const attrs = await prisma.attribute.findMany({ where: { objectId: existing.primaryObjectId, isArchived: false }, select: { id: true, key: true, type: true } });
        const attrByKey = new Map<string, AttributeLite>(attrs.map((a) => [a.key, a]));
        compileListRule(data.rule, (k) => attrByKey.get(k), { strict: true }); // throws ListRuleError → 422
        const computed = await computeDynamicMembers(prisma, orgId, existing.primaryObjectId, data.rule, (k) => attrByKey.get(k));
        matchedCount = computed.records.length;
        ruleWarnings = computed.warnings;
        nextConfig = { ...base, rule: data.rule };
      }
    }

    const list = await prisma.list.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.color !== undefined && { color: data.color }),
        ...(nextConfig !== undefined && { config: nextConfig as Prisma.InputJsonValue }),
      },
      include: listInclude,
    });

    if (ruleTouched) {
      await audit({ orgId, actorId: req.user!.userId, action: 'LIST_RULE_UPDATED', targetType: 'list', targetId: list.id, summary: ruleAuditSummary(list.id, matchedCount ?? 0, hasListRule(data.rule)) });
    }
    res.json({ ...list, ...(matchedCount !== undefined ? { matchedCount } : {}), ...(ruleWarnings.length ? { warnings: ruleWarnings } : {}) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/lists/:id — soft-archive
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'LIST', 'FULL', req.params.id))) return;
    const existing = await prisma.list.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true, isSystem: true } });
    if (!existing) { res.status(404).json({ error: 'List not found' }); return; }
    if (existing.isSystem) { res.status(400).json({ error: 'System lists cannot be deleted' }); return; }
    await prisma.list.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/lists/:id/entries — добавить записи (того же объекта)
router.post('/:id/entries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'LIST', 'READ_WRITE', req.params.id))) return;
    const data = addEntriesSchema.parse(req.body);
    const list = await prisma.list.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true, primaryObjectId: true, type: true, config: true } });
    if (!list) { res.status(404).json({ error: 'List not found' }); return; }
    // LST-1: DYNAMIC = computed membership, ручное добавление запрещено (членство определяется только rule).
    if (list.type === ListType.DYNAMIC) {
      res.status(409).json({ error: 'Dynamic list membership is computed from its rule and cannot be edited manually', code: 'LIST_DYNAMIC_READONLY_MEMBERSHIP' });
      return;
    }

    // LST-2: для PIPELINE новые записи попадают в ПЕРВУЮ стадию, в конец её колонки (append).
    const isPipeline = list.type === ListType.PIPELINE;
    const pipelineStages = isPipeline ? readStages(list.config) : [];
    const defaultStage = isPipeline ? firstStageKey(pipelineStages) : null;
    const pipelineKeys = stageKeySet(pipelineStages);
    let nextPos = 0;
    if (isPipeline && defaultStage) {
      const agg = await prisma.listEntry.aggregate({ where: { listId: list.id, orgId, archivedAt: null, stage: defaultStage }, _max: { position: true } });
      nextPos = (agg._max.position ?? -1) + 1;
    }

    const found = await prisma.record.findMany({
      where: { id: { in: data.recordIds }, orgId, objectId: list.primaryObjectId, archivedAt: null },
      select: { id: true },
    });
    // LST-2: append-порядок = порядок ВВОДА пользователя (не порядок БД), с дедупом дублей во вводе.
    const foundIds = new Set(found.map((r) => r.id));
    const seenInput = new Set<string>();
    const orderedIds = data.recordIds.filter((id) => foundIds.has(id) && !seenInput.has(id) && (seenInput.add(id), true));

    let added = 0;
    const addedEntries: { entryId: string; recordId: string }[] = [];
    for (const rid of orderedIds) {
      const existing = await prisma.listEntry.findUnique({ where: { listId_recordId: { listId: list.id, recordId: rid } } });
      if (existing) {
        if (existing.archivedAt) {
          // реактивация: для PIPELINE возвращаем в прежнюю стадию, ТОЛЬКО если она ещё существует; иначе — в первую.
          const reStage = existing.stage && pipelineKeys.has(existing.stage) ? existing.stage : defaultStage;
          await prisma.listEntry.update({ where: { id: existing.id }, data: { archivedAt: null, addedById: req.user!.userId, ...(isPipeline ? { stage: reStage, position: nextPos++ } : {}) } });
          added += 1;
          addedEntries.push({ entryId: existing.id, recordId: rid });
        }
        continue;
      }
      const entry = await prisma.listEntry.create({ data: { orgId, listId: list.id, recordId: rid, addedById: req.user!.userId, ...(isPipeline ? { stage: defaultStage, position: nextPos++ } : {}) }, select: { id: true } });
      added += 1;
      addedEntries.push({ entryId: entry.id, recordId: rid });
    }

    // M17-2: RECORD_ADDED_TO_LIST — реально провязан (write-сервис существует). Ключ list-add:<listEntryId> (per-entry).
    for (const e of addedEntries) {
      await runWorkflows({ orgId, trigger: 'RECORD_ADDED_TO_LIST', recordId: e.recordId, objectId: list.primaryObjectId, idempotencyKey: `list-add:${e.entryId}` }).catch(() => undefined);
    }

    res.json({ added, requested: data.recordIds.length, skipped: data.recordIds.length - orderedIds.length, entries: addedEntries });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/lists/:id/entries/:recordId — убрать запись из списка
router.delete('/:id/entries/:recordId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'LIST', 'READ_WRITE', req.params.id))) return;
    const list = await prisma.list.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { type: true } });
    if (!list) { res.status(404).json({ error: 'List not found' }); return; }
    // LST-1: DYNAMIC = computed membership, ручное удаление запрещено.
    if (list.type === ListType.DYNAMIC) {
      res.status(409).json({ error: 'Dynamic list membership is computed from its rule and cannot be edited manually', code: 'LIST_DYNAMIC_READONLY_MEMBERSHIP' });
      return;
    }
    const entry = await prisma.listEntry.findFirst({
      where: { listId: req.params.id, recordId: req.params.recordId, orgId, archivedAt: null },
      select: { id: true },
    });
    if (!entry) { res.status(404).json({ error: 'Entry not found' }); return; }
    await prisma.listEntry.update({ where: { id: entry.id }, data: { archivedAt: new Date() } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// PATCH /api/lists/:id/config — стадии PIPELINE (LST-2). RBAC LIST READ_WRITE (как rename).
// Guards: ≥1 стадия, уникальные keys (422), нельзя удалить стадию с entries без moveToStage (409),
// reorder/label/color НЕ двигают entries (членство по key стабильно).
router.patch('/:id/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'LIST', 'READ_WRITE', req.params.id))) return;
    const data = configStagesSchema.parse(req.body);
    const list = await prisma.list.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true, type: true, config: true } });
    if (!list) { res.status(404).json({ error: 'List not found' }); return; }
    if (list.type !== ListType.PIPELINE) {
      res.status(400).json({ error: 'Stages are only valid for pipeline lists', code: 'LIST_STAGES_REQUIRE_PIPELINE' });
      return;
    }

    const nextStages = validateStages(data.stages); // throws StageConfigError → 422 (INVALID_STAGES / DUPLICATE_STAGE_KEY)
    const prevStages = readStages(list.config);
    const nextKeys = stageKeySet(nextStages);
    const removedKeys = prevStages.map((s) => s.key).filter((k) => !nextKeys.has(k));

    // entries в удаляемых стадиях нельзя осиротить — требуем moveToStage (входит в новые стадии).
    if (removedKeys.length) {
      const affected = await prisma.listEntry.count({ where: { listId: list.id, orgId, archivedAt: null, stage: { in: removedKeys } } });
      if (affected > 0) {
        if (!data.moveToStage) {
          res.status(409).json({ error: 'Some stages still have records — provide moveToStage to relocate them before removing.', code: 'STAGE_HAS_ENTRIES', removedKeys, affected });
          return;
        }
        if (!nextKeys.has(data.moveToStage)) {
          res.status(422).json({ error: 'moveToStage must be one of the new stages.', code: 'INVALID_STAGES' });
          return;
        }
        // переселяем entries удаляемых стадий в конец moveToStage (сохраняя порядок). Serializable — гонки move.
        const moveToStage = data.moveToStage;
        await runSerializable(async (tx) => {
          const agg = await tx.listEntry.aggregate({ where: { listId: list.id, orgId, archivedAt: null, stage: moveToStage }, _max: { position: true } });
          let pos = (agg._max.position ?? -1) + 1;
          const orphans = await tx.listEntry.findMany({ where: { listId: list.id, orgId, archivedAt: null, stage: { in: removedKeys } }, orderBy: [{ stage: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
          for (const o of orphans) await tx.listEntry.update({ where: { id: o.id }, data: { stage: moveToStage, position: pos++ } });
        });
      }
    }

    const baseConfig = (list.config && typeof list.config === 'object' && !Array.isArray(list.config)) ? { ...(list.config as Record<string, unknown>) } : {};
    baseConfig.stages = nextStages;
    const updated = await prisma.list.update({ where: { id: list.id }, data: { config: baseConfig as Prisma.InputJsonValue }, include: listInclude });

    const addedKeys = nextStages.map((s) => s.key).filter((k) => !prevStages.some((p) => p.key === k));
    await audit({ orgId, actorId: req.user!.userId, action: 'LIST_STAGE_CONFIG_UPDATED', targetType: 'list', targetId: list.id, summary: `list ${list.id} stages updated · keys [${nextStages.map((s) => s.key).join(', ')}]${removedKeys.length ? ` · removed [${removedKeys.join(', ')}]${data.moveToStage ? `→${data.moveToStage}` : ''}` : ''}${addedKeys.length ? ` · added [${addedKeys.join(', ')}]` : ''}` });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/lists/:id/entries/:recordId/move — перенос entry в стадию/позицию (LST-2).
// RBAC LIST READ_WRITE. Идемпотентно (та же stage+index → no-op без Activity). position — устойчивый rank:
// переписываем колонку 0..n-1 (rebalance), порядок стабилен после reload и при нескольких move подряд.
router.patch('/:id/entries/:recordId/move', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    if (!(await assertAccess(req, res, 'LIST', 'READ_WRITE', req.params.id))) return;
    const data = moveEntrySchema.parse(req.body);
    const list = await prisma.list.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, select: { id: true, name: true, type: true, config: true, primaryObjectId: true } });
    if (!list) { res.status(404).json({ error: 'List not found' }); return; }
    if (list.type !== ListType.PIPELINE) {
      res.status(400).json({ error: 'Stage moves are only valid for pipeline lists', code: 'LIST_MOVE_REQUIRES_PIPELINE' });
      return;
    }
    const stages = readStages(list.config);
    if (!stageKeySet(stages).has(data.stage)) {
      res.status(422).json({ error: `Unknown stage "${data.stage}" for this pipeline.`, code: 'INVALID_STAGE' });
      return;
    }

    // Serializable + retry: rebalance позиций колонки защищён от гонок параллельных move (без дублей/дыр).
    const result = await runSerializable(async (tx) => {
      const entry = await tx.listEntry.findFirst({ where: { listId: list.id, recordId: req.params.recordId, orgId, archivedAt: null }, select: { id: true, stage: true } });
      if (!entry) return { notFound: true as const };

      const targetEntries = await tx.listEntry.findMany({ where: { listId: list.id, orgId, archivedAt: null, stage: data.stage }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
      const sameStage = entry.stage === data.stage;
      const without = targetEntries.filter((e) => e.id !== entry.id);
      const desired = data.position == null ? without.length : Math.max(0, Math.min(without.length, data.position));

      // no-op: та же стадия и тот же итоговый индекс → ничего не делаем (без Activity/workflow)
      if (sameStage) {
        const curIdx = targetEntries.findIndex((e) => e.id === entry.id);
        if (curIdx === desired) return { noop: true as const, from: entry.stage, to: data.stage };
      }

      // rebalance целевой колонки: вставляем entry на desired, переписываем позиции 0..n-1
      const ordered = [...without.map((e) => e.id)];
      ordered.splice(desired, 0, entry.id);
      for (let i = 0; i < ordered.length; i++) {
        await tx.listEntry.update({ where: { id: ordered[i] }, data: { position: i, ...(ordered[i] === entry.id ? { stage: data.stage } : {}) } });
      }
      // если стадия сменилась — уплотняем исходную колонку (0..m-1)
      if (!sameStage && entry.stage) {
        const src = await tx.listEntry.findMany({ where: { listId: list.id, orgId, archivedAt: null, stage: entry.stage }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
        let i = 0;
        for (const e of src) await tx.listEntry.update({ where: { id: e.id }, data: { position: i++ } });
      }
      // Activity ВНУТРИ транзакции (детерминированный id, событие не теряется при сбое после commit позиций).
      // payload.listId — для M27-1 activity-redaction (зритель без LIST READ не увидит имя списка в title).
      const activity = await tx.activity.create({
        data: { orgId, recordId: req.params.recordId, type: 'LIST_STAGE_CHANGED', title: `Stage ${entry.stage ?? '—'} → ${data.stage} in list ${list.name}`, actorId: req.user!.userId, payload: { listId: list.id, from: entry.stage, to: data.stage } as Prisma.InputJsonValue },
        select: { id: true },
      });
      return { moved: true as const, from: entry.stage, to: data.stage, activityId: activity.id };
    });

    if ('notFound' in result) { res.status(404).json({ error: 'Entry not found' }); return; }
    if ('noop' in result) { res.json({ moved: false, stage: data.stage }); return; }

    await audit({ orgId, actorId: req.user!.userId, action: 'LIST_ENTRY_STAGE_MOVED', targetType: 'list', targetId: list.id, summary: `list ${list.id} · record ${req.params.recordId} · stage ${result.from ?? '—'}→${result.to}` });
    // LST-2: move триггерит существующий канонический триггер LIST_ENTRY_UPDATED (M17). Ключ per-activity → каждый
    // реальный move = отдельное событие (A→B→A не дедупится). Move ≠ record-attribute-update (RECORD_UPDATED не шлём).
    await runWorkflows({ orgId, trigger: 'LIST_ENTRY_UPDATED', recordId: req.params.recordId, objectId: list.primaryObjectId, idempotencyKey: `list-move:${result.activityId}` }).catch(() => undefined);

    res.json({ moved: true, from: result.from, to: result.to });
  } catch (err) {
    next(err);
  }
});

export default router;
