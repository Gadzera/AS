import { Router, Request, Response, NextFunction } from 'express';
import { ActivityType, AttributeType, FilterOperator, Prisma, PrismaClient, SortDirection, ViewScope, ViewType } from '@prisma/client';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';
import { assertAccess, buildResolver, meets } from '../services/permissions';
import {
  compileFilterTree,
  flatFiltersToTree,
  treeToFlatLeaves,
  FilterTreeError,
  type AttributeLite,
  type FilterLeaf,
  type FilterNode,
} from '../services/crm/recordFilter';
import { calcSupportsType, CALC_TYPES, MAX_CALCULATIONS, type CalcType } from '../services/crm/recordAggregate';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

const keySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, 'Key must start with a letter and contain only letters, numbers, "_" or "-"');

const viewTypeSchema = z.enum(['table', 'board']);
const viewScopeSchema = z.enum(['personal', 'shared']);
const filterOpSchema = z.enum(['eq', 'neq', 'contains', 'gt', 'lt', 'in', 'is_empty', 'is_not_empty']);
const sortDirSchema = z.enum(['asc', 'desc']);

const viewFilterSchema = z.object({
  attributeKey: keySchema,
  op: filterOpSchema,
  value: z.unknown().optional(),
});

// filterTree принимаем как сырой unknown (НЕ рекурсивная zod-схема — иначе глубокое/широкое дерево
// в пределах body-лимита переполнит стек/заблокирует event-loop ДО cap'а). Всю валидацию (глубина≤5,
// узлы≤120, op↔type, существование attributeKey) делает compileFilterTree, чей обход бросает на
// первом превышении (depth≥5 / nodeCount>120) ДО глубокой рекурсии. То же, что в records.ts/lists.ts.
const filterTreeRawSchema = z.unknown();

const viewSortSchema = z.object({
  attributeKey: keySchema,
  dir: sortDirSchema.default('asc'),
});

const viewColumnSchema = z.object({
  attributeKey: keySchema,
  order: z.number().int().min(0).optional(),
  width: z.number().int().min(60).max(800).optional(),
  isVisible: z.boolean().optional(),
});

const listViewsQuerySchema = z.object({
  objectKey: keySchema.optional(),
  listId: z.string().min(1).optional(),
}).refine((d) => Boolean(d.objectKey || d.listId), { message: 'objectKey or listId is required' });

const viewConfigSchema = z.record(z.any()).refine((v) => JSON.stringify(v).length <= 8000, 'View config too large');

const createViewSchema = z.object({
  objectKey: keySchema.optional(),
  listId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  type: viewTypeSchema.default('table'),
  scope: viewScopeSchema.default('personal'),
  filters: z.array(viewFilterSchema).optional(),
  filterTree: filterTreeRawSchema.nullable().optional(),
  sorts: z.array(viewSortSchema).default([]),
  columns: z.array(viewColumnSchema).default([]),
  groupByAttributeKey: keySchema.nullable().optional(),
  config: viewConfigSchema.optional(),
}).refine((d) => Boolean(d.objectKey || d.listId), { message: 'objectKey or listId is required' });

const updateViewSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: viewTypeSchema.optional(),
  scope: viewScopeSchema.optional(),
  filters: z.array(viewFilterSchema).optional(),
  filterTree: filterTreeRawSchema.nullable().optional(),
  sorts: z.array(viewSortSchema).optional(),
  columns: z.array(viewColumnSchema).optional(),
  groupByAttributeKey: keySchema.nullable().optional(),
  config: viewConfigSchema.optional(),
});

type ApiViewType = z.infer<typeof viewTypeSchema>;
type ApiViewScope = z.infer<typeof viewScopeSchema>;
type ApiFilterOp = z.infer<typeof filterOpSchema>;
type ApiSortDir = z.infer<typeof sortDirSchema>;
type ApiViewFilter = z.infer<typeof viewFilterSchema>;
type ApiViewSort = z.infer<typeof viewSortSchema>;
type ApiViewColumn = z.infer<typeof viewColumnSchema>;

type CrmAttributeForView = {
  id: string;
  key: string;
  name: string;
  type: AttributeType;
  order: number;
};

// Источник представления: объект ИЛИ список (records списка — записи его primaryObject).
type ViewSource = {
  kind: 'object' | 'list';
  objectId: string;
  objectKey: string;
  listId: string | null;
  attributes: CrmAttributeForView[];
};

type NormalizedColumn = {
  attribute: CrmAttributeForView;
  order: number;
  width?: number;
  isVisible: boolean;
};

const viewInclude = {
  object: { select: { key: true } },
  list: { select: { id: true, name: true } },
  groupByAttribute: { select: { key: true, name: true } },
  columns: {
    include: { attribute: { select: { id: true, key: true, name: true, type: true } } },
    orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  filters: {
    include: { attribute: { select: { id: true, key: true, name: true, type: true } } },
    orderBy: [{ group: 'asc' as const }, { order: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  sorts: {
    include: { attribute: { select: { id: true, key: true, name: true, type: true } } },
    orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }],
  },
} satisfies Prisma.ViewInclude;

type ViewWithRelations = Prisma.ViewGetPayload<{ include: typeof viewInclude }>;

class ViewValidationError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.name = 'ViewValidationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const filterOperatorToPrisma: Record<ApiFilterOp, FilterOperator> = {
  eq: FilterOperator.EQUALS,
  neq: FilterOperator.NOT_EQUALS,
  contains: FilterOperator.CONTAINS,
  gt: FilterOperator.GREATER_THAN,
  lt: FilterOperator.LESS_THAN,
  in: FilterOperator.IN,
  is_empty: FilterOperator.IS_EMPTY,
  is_not_empty: FilterOperator.IS_NOT_EMPTY,
};

const filterOperatorFromPrisma: Partial<Record<FilterOperator, ApiFilterOp>> = {
  [FilterOperator.EQUALS]: 'eq',
  [FilterOperator.NOT_EQUALS]: 'neq',
  [FilterOperator.CONTAINS]: 'contains',
  [FilterOperator.GREATER_THAN]: 'gt',
  [FilterOperator.LESS_THAN]: 'lt',
  [FilterOperator.IN]: 'in',
  [FilterOperator.IS_EMPTY]: 'is_empty',
  [FilterOperator.IS_NOT_EMPTY]: 'is_not_empty',
};

const toPrismaViewType = (t: ApiViewType): ViewType => (t === 'board' ? ViewType.BOARD : ViewType.TABLE);
const fromPrismaViewType = (t: ViewType): ApiViewType => (t === ViewType.BOARD ? 'board' : 'table');
const toPrismaScope = (s: ApiViewScope): ViewScope => (s === 'shared' ? ViewScope.SHARED : ViewScope.PERSONAL);
const fromPrismaScope = (s: ViewScope): ApiViewScope => (s === ViewScope.SHARED ? 'shared' : 'personal');
const toPrismaSortDirection = (d: ApiSortDir): SortDirection => (d === 'desc' ? SortDirection.DESC : SortDirection.ASC);
const fromPrismaSortDirection = (d: SortDirection): ApiSortDir => (d === SortDirection.DESC ? 'desc' : 'asc');

function toNullableJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function buildAttributeMap(attributes: CrmAttributeForView[]): Map<string, CrmAttributeForView> {
  return new Map(attributes.map((a) => [a.key, a]));
}

function attributeByKeyFn(source: ViewSource): (key: string) => AttributeLite | undefined {
  const map = buildAttributeMap(source.attributes);
  return (key: string) => map.get(key);
}

// ── Резолв источника по входу (objectKey | listId) ──
async function resolveSourceFromInput(orgId: string, input: { objectKey?: string; listId?: string }): Promise<ViewSource | null> {
  if (input.listId) {
    const list = await prisma.list.findFirst({
      where: { id: input.listId, orgId, archivedAt: null },
      select: {
        id: true,
        primaryObject: {
          select: {
            id: true,
            key: true,
            attributes: {
              where: { isArchived: false },
              select: { id: true, key: true, name: true, type: true, order: true },
              orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });
    if (!list?.primaryObject) return null;
    return { kind: 'list', listId: list.id, objectId: list.primaryObject.id, objectKey: list.primaryObject.key, attributes: list.primaryObject.attributes };
  }

  if (input.objectKey) {
    const object = await prisma.object.findFirst({
      where: { orgId, key: input.objectKey, archivedAt: null },
      select: {
        id: true,
        key: true,
        attributes: {
          where: { isArchived: false },
          select: { id: true, key: true, name: true, type: true, order: true },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!object) return null;
    return { kind: 'object', listId: null, objectId: object.id, objectKey: object.key, attributes: object.attributes };
  }

  return null;
}

async function resolveSourceFromView(orgId: string, view: { objectId: string | null; listId: string | null }): Promise<ViewSource | null> {
  if (view.listId) return resolveSourceFromInput(orgId, { listId: view.listId });
  if (view.objectId) {
    const object = await prisma.object.findFirst({ where: { orgId, id: view.objectId, archivedAt: null }, select: { key: true } });
    if (!object) return null;
    return resolveSourceFromInput(orgId, { objectKey: object.key });
  }
  return null;
}

// ── RBAC: тихая проверка уровня доступа к источнику (без отправки ответа) ──
async function sourceLevelMeets(orgId: string, user: { userId: string; role: string }, source: ViewSource, required: 'READ' | 'READ_WRITE' | 'FULL'): Promise<boolean> {
  const kind = source.kind === 'list' ? 'LIST' : 'OBJECT';
  const entityId = source.kind === 'list' ? source.listId! : source.objectId;
  const resolver = await buildResolver(orgId, { userId: user.userId, role: user.role }, kind);
  return meets(resolver(entityId), required);
}

// Может ли пользователь ВИДЕТЬ вид: PERSONAL — только владелец; любой — нужен READ к источнику.
async function canSeeView(orgId: string, user: { userId: string; role: string }, view: { scope: ViewScope; createdById: string | null }, source: ViewSource): Promise<boolean> {
  if (view.scope === ViewScope.PERSONAL && view.createdById !== user.userId) return false;
  return sourceLevelMeets(orgId, user, source, 'READ');
}

// Уровень для управления видом: SHARED → FULL; PERSONAL (свой) → READ_WRITE.
function manageLevelFor(scope: ViewScope): 'READ_WRITE' | 'FULL' {
  return scope === ViewScope.SHARED ? 'FULL' : 'READ_WRITE';
}

function normalizeColumns(columns: ApiViewColumn[], attributes: CrmAttributeForView[]): NormalizedColumn[] {
  const attributeMap = buildAttributeMap(attributes);
  const sourceColumns = columns.length ? columns : attributes.map((a, i) => ({ attributeKey: a.key, order: i, isVisible: true }));
  const used = new Set<string>();

  return sourceColumns.map((column, index) => {
    const attribute = attributeMap.get(column.attributeKey);
    if (!attribute) throw new ViewValidationError(`Атрибут "${column.attributeKey}" не найден в источнике.`);
    if (used.has(attribute.id)) throw new ViewValidationError(`Колонка "${column.attributeKey}" указана несколько раз.`);
    used.add(attribute.id);
    return { attribute, order: column.order ?? index, width: 'width' in column ? column.width : undefined, isVisible: column.isVisible ?? true };
  });
}

function validateSorts(sorts: ApiViewSort[], attributes: CrmAttributeForView[]): Array<ApiViewSort & { attribute: CrmAttributeForView }> {
  const attributeMap = buildAttributeMap(attributes);
  return sorts.map((sort) => {
    const attribute = attributeMap.get(sort.attributeKey);
    if (!attribute) throw new ViewValidationError(`Атрибут сортировки "${sort.attributeKey}" не найден в источнике.`);
    return { ...sort, attribute };
  });
}

// Канонический фильтр из входа: filterTree (если задан) ИЛИ flat filters[] → дерево.
// strict-валидация (create/save) → 422 на неизвестный атрибут / op↔type / глубину.
function prepareFilter(
  data: { filterTree?: unknown; filters?: ApiViewFilter[] },
  source: ViewSource,
): { filterTreeRaw: FilterNode | null; derived: Array<{ leaf: FilterLeaf; group: number }> } | undefined {
  const byKey = attributeByKeyFn(source);

  if (data.filterTree !== undefined) {
    // strict-валидация (бросает FilterTreeError→422 на глубину/узлы/op↔type/неизвестный attr) — cap внутри обхода
    const { tree } = compileFilterTree(data.filterTree, byKey, { strict: true });
    const raw = (data.filterTree ?? null) as FilterNode | null;
    return { filterTreeRaw: tree ? raw : null, derived: treeToFlatLeaves(tree ? raw : null) };
  }

  if (data.filters !== undefined) {
    const raw = flatFiltersToTree(data.filters as FilterLeaf[]);
    // strict-валидация плоских фильтров через тот же движок
    compileFilterTree(raw, byKey, { strict: true });
    return { filterTreeRaw: raw, derived: treeToFlatLeaves(raw) };
  }

  return undefined;
}

// M24-3: strict-валидация config.calcs на save (неизвестный attr / неподдержанный тип / неподходящая пара → 422).
function validateCalcsConfig(config: Record<string, unknown> | undefined, source: ViewSource): void {
  const calcs = config?.calcs;
  if (calcs === undefined || calcs === null) return;
  if (typeof calcs !== 'object' || Array.isArray(calcs)) {
    throw new ViewValidationError('Calculations config must be an object.', 422, 'INVALID_CALCULATION');
  }
  if (Object.keys(calcs as object).length > MAX_CALCULATIONS) {
    throw new ViewValidationError(`Too many calculations (max ${MAX_CALCULATIONS}).`, 422, 'INVALID_CALCULATION');
  }
  const byKey = attributeByKeyFn(source);
  for (const [attributeKey, type] of Object.entries(calcs as Record<string, unknown>)) {
    if (typeof type !== 'string' || !CALC_TYPES.has(type)) {
      throw new ViewValidationError(`Invalid calculation type for "${attributeKey}".`, 422, 'INVALID_CALCULATION');
    }
    const attr = byKey(attributeKey);
    if (!attr) {
      throw new ViewValidationError(`Calculation attribute "${attributeKey}" was not found.`, 422, 'INVALID_CALCULATION');
    }
    if (!calcSupportsType(type as CalcType, attr.type)) {
      throw new ViewValidationError(`Calculation "${type}" is not supported for "${attributeKey}".`, 422, 'INVALID_CALCULATION');
    }
  }
}

function getDefaultBoardGroupByAttributeId(type: ApiViewType, attributes: CrmAttributeForView[], requestedKey?: string | null): string | undefined {
  if (type !== 'board') {
    // адверс M2: явный groupBy на table-view — контрактная ошибка, не тихое обнуление
    if (requestedKey) throw new ViewValidationError('Group-by applies only to board views.', 422, 'GROUP_BY_REQUIRES_BOARD');
    return undefined;
  }
  if (requestedKey) {
    const requested = attributes.find((a) => a.key === requestedKey);
    if (!requested) throw new ViewValidationError(`Group-by атрибут "${requestedKey}" не найден.`, 422, 'GROUP_BY_ATTRIBUTE_NOT_FOUND');
    if (!isGroupable(requested.type)) throw new ViewValidationError(`Атрибут "${requestedKey}" нельзя использовать для группировки.`, 422, 'GROUP_BY_ATTRIBUTE_NOT_ELIGIBLE');
    return requested.id;
  }
  const stage = attributes.find((a) => a.key === 'stage' && a.type === AttributeType.SELECT);
  const firstSelect = attributes.find((a) => a.type === AttributeType.SELECT);
  return stage?.id ?? firstSelect?.id;
}

// Board-группировка: дискретные значения. STATUS-атрибуты в этой модели = SELECT (напр. stage/agent_stage).
function isGroupable(type: AttributeType): boolean {
  return type === AttributeType.SELECT || type === AttributeType.USER;
}

// Канонический filterTree для ответа: View.filterTree ИЛИ миграция legacy ViewFilter[] → плоский AND.
function canonicalFilterTree(view: ViewWithRelations): FilterNode | null {
  if (view.filterTree !== null && view.filterTree !== undefined) {
    return view.filterTree as unknown as FilterNode;
  }
  const flat: FilterLeaf[] = view.filters
    .filter((f) => f.attribute?.key)
    .map((f) => ({ attributeKey: f.attribute!.key, op: filterOperatorFromPrisma[f.operator] ?? 'eq', value: f.value as unknown }));
  return flatFiltersToTree(flat);
}

function serializeView(view: ViewWithRelations, source?: ViewSource) {
  const filterTree = canonicalFilterTree(view);
  let filterWarnings: string[] = [];
  if (source) {
    const { warnings } = compileFilterTree(filterTree, attributeByKeyFn(source), { strict: false });
    filterWarnings = warnings;
  }

  return {
    id: view.id,
    source: view.listId ? 'list' : 'object',
    objectKey: view.object?.key ?? null,
    listId: view.listId ?? null,
    name: view.name,
    type: fromPrismaViewType(view.type),
    scope: fromPrismaScope(view.scope),
    isDefault: view.isDefault,
    isOwner: true, // проставляется на выдаче (см. ниже)
    order: view.order,
    groupByAttributeKey: view.groupByAttribute?.key ?? null,
    config: view.config,
    filterTree,
    filterWarnings,
    filters: view.filters.map((f) => ({
      id: f.id,
      attributeKey: f.attribute?.key ?? null,
      attributeName: f.attribute?.name ?? null,
      op: filterOperatorFromPrisma[f.operator] ?? 'eq',
      value: f.value,
      group: f.group,
      order: f.order,
    })),
    sorts: view.sorts.map((s) => ({
      id: s.id,
      attributeKey: s.attribute?.key ?? null,
      attributeName: s.attribute?.name ?? null,
      dir: fromPrismaSortDirection(s.direction),
      order: s.order,
    })),
    columns: view.columns.map((c) => ({
      id: c.id,
      attributeKey: c.attribute.key,
      attributeName: c.attribute.name,
      attributeType: c.attribute.type,
      order: c.order,
      width: c.width,
      isVisible: c.isVisible,
      config: c.config,
    })),
    createdById: view.createdById,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}

async function writeViewParts(
  tx: Prisma.TransactionClient,
  orgId: string,
  viewId: string,
  source: ViewSource,
  parts: {
    derivedFilters?: Array<{ leaf: FilterLeaf; group: number }>;
    sorts?: ApiViewSort[];
    columns?: ApiViewColumn[];
  },
): Promise<void> {
  const attributeMap = buildAttributeMap(source.attributes);

  if (parts.columns) {
    const columns = normalizeColumns(parts.columns, source.attributes);
    await tx.viewColumn.deleteMany({ where: { viewId, orgId } });
    if (columns.length) {
      await tx.viewColumn.createMany({
        data: columns.map((c) => ({ orgId, viewId, attributeId: c.attribute.id, order: c.order, width: c.width, isVisible: c.isVisible })),
      });
    }
  }

  if (parts.derivedFilters) {
    await tx.viewFilter.deleteMany({ where: { viewId, orgId } });
    const rows = parts.derivedFilters
      .map(({ leaf, group }, index) => {
        const attribute = attributeMap.get(leaf.attributeKey);
        if (!attribute) return null;
        return {
          orgId,
          viewId,
          attributeId: attribute.id,
          operator: filterOperatorToPrisma[leaf.op as ApiFilterOp],
          value: toNullableJsonValue(leaf.value),
          group,
          order: index,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length) {
      await tx.viewFilter.createMany({ data: rows });
    }
  }

  if (parts.sorts) {
    const sorts = validateSorts(parts.sorts, source.attributes);
    await tx.viewSort.deleteMany({ where: { viewId, orgId } });
    if (sorts.length) {
      await tx.viewSort.createMany({
        data: sorts.map((s, index) => ({ orgId, viewId, attributeId: s.attribute.id, direction: toPrismaSortDirection(s.dir), order: index })),
      });
    }
  }
}

function handleRouteError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof FilterTreeError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof ViewValidationError) {
    res.status(err.statusCode).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
    return;
  }
  next(err);
}

async function logViewActivity(
  tx: Prisma.TransactionClient,
  orgId: string,
  actorId: string | undefined,
  type: ActivityType,
  view: { id: string; name: string },
  extra?: Record<string, unknown>,
): Promise<void> {
  await tx.activity.create({
    data: {
      orgId,
      recordId: null,
      actorId: actorId ?? null,
      type,
      title:
        type === ActivityType.VIEW_CREATED
          ? `View created: ${view.name}`
          : type === ActivityType.VIEW_UPDATED
          ? `View updated: ${view.name}`
          : `View deleted: ${view.name}`,
      payload: { viewId: view.id, name: view.name, ...(extra ?? {}) } as Prisma.InputJsonValue,
    },
  });
}

// GET /api/views?objectKey= | ?listId=
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const user = { userId: req.user!.userId, role: req.user!.role };
    const query = listViewsQuerySchema.parse(req.query);
    const source = await resolveSourceFromInput(orgId, query);

    if (!source) {
      res.status(404).json({ error: query.listId ? 'List not found' : 'Object not found' });
      return;
    }
    // Источник недоступен (нет READ) → 404 (скрываем существование видов).
    if (!(await sourceLevelMeets(orgId, user, source, 'READ'))) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const views = await prisma.view.findMany({
      where: {
        orgId,
        archivedAt: null,
        ...(source.kind === 'list' ? { listId: source.listId } : { objectId: source.objectId, listId: null }),
        // PERSONAL — только свои; SHARED — всем (READ к источнику уже проверен).
        OR: [{ scope: ViewScope.SHARED }, { scope: ViewScope.PERSONAL, createdById: user.userId }],
      },
      include: viewInclude,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    res.json({
      views: views.map((view) => ({ ...serializeView(view, source), isOwner: view.createdById === user.userId })),
    });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// POST /api/views
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const user = { userId: req.user!.userId, role: req.user!.role };
    const data = createViewSchema.parse(req.body);
    const source = await resolveSourceFromInput(orgId, { objectKey: data.objectKey, listId: data.listId });

    if (!source) {
      res.status(404).json({ error: data.listId ? 'List not found' : 'Object not found' });
      return;
    }

    const scope = toPrismaScope(data.scope);
    // RBAC: PERSONAL → READ_WRITE; SHARED → FULL. Недоступный источник (нет READ) → 404.
    if (!(await sourceLevelMeets(orgId, user, source, 'READ'))) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (!(await sourceLevelMeets(orgId, user, source, manageLevelFor(scope)))) {
      res.status(403).json({ error: scope === ViewScope.SHARED ? 'Sharing a view requires full access to the source' : 'Creating a view requires edit access', code: 'INSUFFICIENT_PERMISSIONS' });
      return;
    }

    const filterPrep = prepareFilter(data, source);
    validateCalcsConfig(data.config, source);
    const groupById = getDefaultBoardGroupByAttributeId(data.type, source.attributes, data.groupByAttributeKey);

    const createdView = await prisma.$transaction(async (tx) => {
      const lastView = await tx.view.findFirst({
        where: { orgId, archivedAt: null, ...(source.kind === 'list' ? { listId: source.listId } : { objectId: source.objectId }) },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const view = await tx.view.create({
        data: {
          orgId,
          objectId: source.kind === 'object' ? source.objectId : null,
          listId: source.kind === 'list' ? source.listId : null,
          name: data.name,
          type: toPrismaViewType(data.type),
          scope,
          order: (lastView?.order ?? -1) + 1,
          groupByAttributeId: groupById,
          // filterTree пишется ВМЕСТЕ с derived ViewFilter[] в ОДНОЙ транзакции (Q1).
          filterTree: filterPrep ? toNullableJsonValue(filterPrep.filterTreeRaw ?? undefined) : Prisma.JsonNull,
          config: { source: source.kind, schemaVersion: 1, ...(data.config ?? {}) } as Prisma.InputJsonObject,
          createdById: user.userId,
        },
      });

      await writeViewParts(tx, orgId, view.id, source, {
        columns: data.columns.length
          ? data.columns
          : normalizeColumns([], source.attributes).map((c) => ({ attributeKey: c.attribute.key, order: c.order, width: c.width, isVisible: c.isVisible })),
        derivedFilters: filterPrep ? filterPrep.derived : [],
        sorts: data.sorts,
      });

      const saved = await tx.view.findFirst({ where: { id: view.id, orgId }, include: viewInclude });
      if (!saved) throw new Error('View was not found after creation');
      await logViewActivity(tx, orgId, user.userId, ActivityType.VIEW_CREATED, saved, { source: source.kind, type: data.type, scope: data.scope });
      return saved;
    });

    res.status(201).json({ ...serializeView(createdView, source), isOwner: true });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// GET /api/views/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const user = { userId: req.user!.userId, role: req.user!.role };
    const view = await prisma.view.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, include: viewInclude });

    if (!view) {
      res.status(404).json({ error: 'View not found' });
      return;
    }
    const source = await resolveSourceFromView(orgId, view);
    if (!source || !(await canSeeView(orgId, user, view, source))) {
      res.status(404).json({ error: 'View not found' });
      return;
    }

    res.json({ ...serializeView(view, source), isOwner: view.createdById === user.userId });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// PATCH /api/views/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const user = { userId: req.user!.userId, role: req.user!.role };
    const data = updateViewSchema.parse(req.body);
    const existing = await prisma.view.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, include: viewInclude });

    if (!existing) {
      res.status(404).json({ error: 'View not found' });
      return;
    }
    const source = await resolveSourceFromView(orgId, existing);
    // Скрытие (404): источник недоступен / чужой PERSONAL.
    if (!source || !(await canSeeView(orgId, user, existing, source))) {
      res.status(404).json({ error: 'View not found' });
      return;
    }
    // Доступен, но уровня мало (403). Целевой scope = новый, если меняем; иначе текущий.
    const targetScope = data.scope ? toPrismaScope(data.scope) : existing.scope;
    const needed = manageLevelFor(existing.scope) === 'FULL' || manageLevelFor(targetScope) === 'FULL' ? 'FULL' : 'READ_WRITE';
    if (!(await sourceLevelMeets(orgId, user, source, needed))) {
      res.status(403).json({ error: 'You don’t have permission to change this view', code: 'INSUFFICIENT_PERMISSIONS' });
      return;
    }

    // system-вид: имя/тип/scope менять нельзя; фильтры/сорт/колонки — можно (по правам выше).
    if (existing.isDefault && (data.name !== undefined || data.type !== undefined || data.scope !== undefined)) {
      res.status(403).json({ error: 'System view name/type/scope can’t be changed — use “Save as view”', code: 'SYSTEM_VIEW_READONLY' });
      return;
    }

    const filterPrep = prepareFilter(data, source);
    validateCalcsConfig(data.config, source);
    const nextViewType = data.type ?? fromPrismaViewType(existing.type);
    // Явный groupByAttributeKey (включая null = очистить) приоритетен; иначе для board наследуем существующую
    // группировку, а для table НЕ наследуем — иначе смена board→table падала бы GROUP_BY_REQUIRES_BOARD на
    // leftover-группировке (и `?? existing.key` затирал бы даже явный null). Фикс корректен и для object-видов.
    const requestedGroupKey =
      data.groupByAttributeKey !== undefined
        ? data.groupByAttributeKey
        : nextViewType === 'board'
        ? existing.groupByAttribute?.key ?? null
        : null;
    const groupById =
      data.type !== undefined || data.groupByAttributeKey !== undefined
        ? getDefaultBoardGroupByAttributeId(nextViewType, source.attributes, requestedGroupKey)
        : undefined;

    // GPT-уточнение #1: legacy-вид (filterTree=NULL) при ПЕРВОМ PATCH канонизируется —
    // даже если PATCH не трогает фильтр, пишем canonical tree из legacy ViewFilter[].
    // НО: если у legacy-фильтра есть system-field условие (ViewFilter.field, не attribute), дерево его
    // представить не может → НЕ авто-мигрируем (иначе тихая потеря фильтра по системному полю).
    const hasSystemFieldFilter = existing.filters.some((f) => f.field != null && f.attributeId == null);
    const legacyMigrate = !filterPrep && existing.filterTree === null && !hasSystemFieldFilter;
    const filterTreeToWrite: FilterNode | null | undefined = filterPrep
      ? (filterPrep.filterTreeRaw ?? null)
      : legacyMigrate
      ? canonicalFilterTree(existing)
      : undefined;

    const updatedView = await prisma.$transaction(async (tx) => {
      await tx.view.update({
        where: { id: existing.id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.type !== undefined ? { type: toPrismaViewType(data.type) } : {}),
          ...(data.scope !== undefined ? { scope: toPrismaScope(data.scope) } : {}),
          ...(data.type !== undefined || data.groupByAttributeKey !== undefined ? { groupByAttributeId: groupById ?? null } : {}),
          ...(filterTreeToWrite !== undefined ? { filterTree: toNullableJsonValue(filterTreeToWrite ?? undefined) } : {}),
          // адверс M2: мёржим существующий config (частичный PATCH без calcs не затирает их)
          ...(data.config !== undefined ? { config: { ...((existing.config as Record<string, unknown>) ?? {}), source: source.kind, schemaVersion: 1, ...data.config } as Prisma.InputJsonObject } : {}),
        },
      });

      await writeViewParts(tx, orgId, existing.id, source, {
        columns: data.columns,
        derivedFilters: filterPrep ? filterPrep.derived : undefined,
        sorts: data.sorts,
      });

      const saved = await tx.view.findFirst({ where: { id: existing.id, orgId }, include: viewInclude });
      if (!saved) throw new Error('View was not found after update');
      const scopeChanged = data.scope !== undefined && data.scope !== fromPrismaScope(existing.scope);
      await logViewActivity(tx, orgId, user.userId, ActivityType.VIEW_UPDATED, saved, {
        fields: Object.keys(data),
        ...(scopeChanged ? { scopeChangedTo: data.scope } : {}),
      });
      return saved;
    });

    res.json({ ...serializeView(updatedView, source), isOwner: updatedView.createdById === user.userId });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// DELETE /api/views/:id (soft-archive)
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const user = { userId: req.user!.userId, role: req.user!.role };
    const existing = await prisma.view.findFirst({ where: { id: req.params.id, orgId, archivedAt: null }, include: viewInclude });

    if (!existing) {
      res.status(404).json({ error: 'View not found' });
      return;
    }
    const source = await resolveSourceFromView(orgId, existing);
    if (!source || !(await canSeeView(orgId, user, existing, source))) {
      res.status(404).json({ error: 'View not found' });
      return;
    }
    if (!(await sourceLevelMeets(orgId, user, source, manageLevelFor(existing.scope)))) {
      res.status(403).json({ error: 'You don’t have permission to delete this view', code: 'INSUFFICIENT_PERMISSIONS' });
      return;
    }
    if (existing.isDefault) {
      res.status(403).json({ error: 'System view can’t be deleted', code: 'SYSTEM_VIEW_READONLY' });
      return;
    }

    const archivedView = await prisma.$transaction(async (tx) => {
      const updated = await tx.view.update({ where: { id: existing.id }, data: { archivedAt: new Date() }, include: viewInclude });
      await logViewActivity(tx, orgId, user.userId, ActivityType.VIEW_DELETED, updated);
      return updated;
    });

    res.json({ ...serializeView(archivedView, source), isOwner: archivedView.createdById === user.userId });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

export default router;
