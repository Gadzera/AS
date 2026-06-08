import { Router, Request, Response, NextFunction } from 'express';
import { AttributeType, FilterOperator, Prisma, PrismaClient, SortDirection, ViewType } from '@prisma/client';
import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireOrg);

const keySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/, 'Key must start with a lowercase letter and contain only lowercase letters, numbers, "_" or "-"');

const viewTypeSchema = z.enum(['table', 'board']);
const filterOpSchema = z.enum(['eq', 'neq', 'contains', 'gt', 'lt', 'in', 'is_empty', 'is_not_empty']);
const sortDirSchema = z.enum(['asc', 'desc']);

const viewFilterSchema = z.object({
  attributeKey: keySchema,
  op: filterOpSchema,
  value: z.unknown().optional(),
});

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
  objectKey: keySchema,
});

const createViewSchema = z.object({
  objectKey: keySchema,
  name: z.string().trim().min(1).max(120),
  type: viewTypeSchema.default('table'),
  filters: z.array(viewFilterSchema).default([]),
  sorts: z.array(viewSortSchema).default([]),
  columns: z.array(viewColumnSchema).default([]),
});

const updateViewSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: viewTypeSchema.optional(),
  filters: z.array(viewFilterSchema).optional(),
  sorts: z.array(viewSortSchema).optional(),
  columns: z.array(viewColumnSchema).optional(),
});

type ApiViewType = z.infer<typeof viewTypeSchema>;
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

type CrmObjectForView = {
  id: string;
  key: string;
  attributes: CrmAttributeForView[];
};

type NormalizedColumn = {
  attribute: CrmAttributeForView;
  order: number;
  width?: number;
  isVisible: boolean;
};

const viewInclude = {
  object: {
    select: {
      key: true,
    },
  },
  groupByAttribute: {
    select: {
      key: true,
      name: true,
    },
  },
  columns: {
    include: {
      attribute: {
        select: {
          id: true,
          key: true,
          name: true,
          type: true,
        },
      },
    },
    orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  filters: {
    include: {
      attribute: {
        select: {
          id: true,
          key: true,
          name: true,
          type: true,
        },
      },
    },
    orderBy: [{ group: 'asc' as const }, { order: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  sorts: {
    include: {
      attribute: {
        select: {
          id: true,
          key: true,
          name: true,
          type: true,
        },
      },
    },
    orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }],
  },
} satisfies Prisma.ViewInclude;

type ViewWithRelations = Prisma.ViewGetPayload<{ include: typeof viewInclude }>;

class ViewValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ViewValidationError';
    this.statusCode = statusCode;
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

function toPrismaViewType(type: ApiViewType): ViewType {
  return type === 'board' ? ViewType.BOARD : ViewType.TABLE;
}

function fromPrismaViewType(type: ViewType): ApiViewType {
  return type === ViewType.BOARD ? 'board' : 'table';
}

function toPrismaSortDirection(direction: ApiSortDir): SortDirection {
  return direction === 'desc' ? SortDirection.DESC : SortDirection.ASC;
}

function fromPrismaSortDirection(direction: SortDirection): ApiSortDir {
  return direction === SortDirection.DESC ? 'desc' : 'asc';
}

function toNullableJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function buildAttributeMap(attributes: CrmAttributeForView[]): Map<string, CrmAttributeForView> {
  return new Map(attributes.map((attribute) => [attribute.key, attribute]));
}

async function findCrmObject(orgId: string, objectKey: string): Promise<CrmObjectForView | null> {
  return prisma.object.findFirst({
    where: {
      orgId,
      key: objectKey,
      archivedAt: null,
    },
    select: {
      id: true,
      key: true,
      attributes: {
        where: {
          isArchived: false,
        },
        select: {
          id: true,
          key: true,
          name: true,
          type: true,
          order: true,
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });
}

async function findView(orgId: string, viewId: string): Promise<ViewWithRelations | null> {
  return prisma.view.findFirst({
    where: {
      id: viewId,
      orgId,
      archivedAt: null,
    },
    include: viewInclude,
  });
}

function normalizeColumns(columns: ApiViewColumn[], attributes: CrmAttributeForView[]): NormalizedColumn[] {
  const attributeMap = buildAttributeMap(attributes);
  const sourceColumns = columns.length
    ? columns
    : attributes.map((attribute, index) => ({
        attributeKey: attribute.key,
        order: index,
        isVisible: true,
      }));

  const usedAttributeIds = new Set<string>();

  return sourceColumns.map((column, index) => {
    const attribute = attributeMap.get(column.attributeKey);

    if (!attribute) {
      throw new ViewValidationError(`Атрибут "${column.attributeKey}" не найден в объекте.`);
    }

    if (usedAttributeIds.has(attribute.id)) {
      throw new ViewValidationError(`Колонка "${column.attributeKey}" указана несколько раз.`);
    }

    usedAttributeIds.add(attribute.id);

    return {
      attribute,
      order: column.order ?? index,
      width: 'width' in column ? column.width : undefined,
      isVisible: column.isVisible ?? true,
    };
  });
}

function validateFilters(filters: ApiViewFilter[], attributes: CrmAttributeForView[]): Array<ApiViewFilter & { attribute: CrmAttributeForView }> {
  const attributeMap = buildAttributeMap(attributes);

  return filters.map((filter) => {
    const attribute = attributeMap.get(filter.attributeKey);

    if (!attribute) {
      throw new ViewValidationError(`Атрибут фильтра "${filter.attributeKey}" не найден в объекте.`);
    }

    return {
      ...filter,
      attribute,
    };
  });
}

function validateSorts(sorts: ApiViewSort[], attributes: CrmAttributeForView[]): Array<ApiViewSort & { attribute: CrmAttributeForView }> {
  const attributeMap = buildAttributeMap(attributes);

  return sorts.map((sort) => {
    const attribute = attributeMap.get(sort.attributeKey);

    if (!attribute) {
      throw new ViewValidationError(`Атрибут сортировки "${sort.attributeKey}" не найден в объекте.`);
    }

    return {
      ...sort,
      attribute,
    };
  });
}

function getDefaultBoardGroupByAttributeId(type: ApiViewType, attributes: CrmAttributeForView[]): string | undefined {
  if (type !== 'board') {
    return undefined;
  }

  const stageAttribute = attributes.find((attribute) => attribute.key === 'stage' && attribute.type === AttributeType.SELECT);
  const firstSelectAttribute = attributes.find((attribute) => attribute.type === AttributeType.SELECT);

  return stageAttribute?.id ?? firstSelectAttribute?.id;
}

function serializeView(view: ViewWithRelations) {
  return {
    id: view.id,
    objectKey: view.object?.key ?? null,
    name: view.name,
    type: fromPrismaViewType(view.type),
    isDefault: view.isDefault,
    order: view.order,
    groupByAttributeKey: view.groupByAttribute?.key ?? null,
    config: view.config,
    filters: view.filters.map((filter) => ({
      id: filter.id,
      attributeKey: filter.attribute?.key ?? null,
      attributeName: filter.attribute?.name ?? null,
      op: filterOperatorFromPrisma[filter.operator] ?? 'eq',
      value: filter.value,
      group: filter.group,
      order: filter.order,
    })),
    sorts: view.sorts.map((sort) => ({
      id: sort.id,
      attributeKey: sort.attribute?.key ?? null,
      attributeName: sort.attribute?.name ?? null,
      dir: fromPrismaSortDirection(sort.direction),
      order: sort.order,
    })),
    columns: view.columns.map((column) => ({
      id: column.id,
      attributeKey: column.attribute.key,
      attributeName: column.attribute.name,
      attributeType: column.attribute.type,
      order: column.order,
      width: column.width,
      isVisible: column.isVisible,
      config: column.config,
    })),
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}

async function writeViewParts(
  tx: Prisma.TransactionClient,
  orgId: string,
  viewId: string,
  crmObject: CrmObjectForView,
  parts: {
    filters?: ApiViewFilter[];
    sorts?: ApiViewSort[];
    columns?: ApiViewColumn[];
  },
): Promise<void> {
  if (parts.columns) {
    const columns = normalizeColumns(parts.columns, crmObject.attributes);

    await tx.viewColumn.deleteMany({ where: { viewId, orgId } });

    if (columns.length) {
      await tx.viewColumn.createMany({
        data: columns.map((column) => ({
          orgId,
          viewId,
          attributeId: column.attribute.id,
          order: column.order,
          width: column.width,
          isVisible: column.isVisible,
        })),
      });
    }
  }

  if (parts.filters) {
    const filters = validateFilters(parts.filters, crmObject.attributes);

    await tx.viewFilter.deleteMany({ where: { viewId, orgId } });

    if (filters.length) {
      await tx.viewFilter.createMany({
        data: filters.map((filter, index) => ({
          orgId,
          viewId,
          attributeId: filter.attribute.id,
          operator: filterOperatorToPrisma[filter.op],
          value: toNullableJsonValue(filter.value),
          group: 0,
          order: index,
        })),
      });
    }
  }

  if (parts.sorts) {
    const sorts = validateSorts(parts.sorts, crmObject.attributes);

    await tx.viewSort.deleteMany({ where: { viewId, orgId } });

    if (sorts.length) {
      await tx.viewSort.createMany({
        data: sorts.map((sort, index) => ({
          orgId,
          viewId,
          attributeId: sort.attribute.id,
          direction: toPrismaSortDirection(sort.dir),
          order: index,
        })),
      });
    }
  }
}

function handleRouteError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ViewValidationError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  next(err);
}

// GET /api/views?objectKey=
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const query = listViewsQuerySchema.parse(req.query);
    const crmObject = await findCrmObject(orgId, query.objectKey);

    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }

    const views = await prisma.view.findMany({
      where: {
        orgId,
        objectId: crmObject.id,
        archivedAt: null,
      },
      include: viewInclude,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    res.json({ views: views.map((view) => serializeView(view)) });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// POST /api/views
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = createViewSchema.parse(req.body);
    const crmObject = await findCrmObject(orgId, data.objectKey);

    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }

    const createdView = await prisma.$transaction(async (tx) => {
      const lastView = await tx.view.findFirst({
        where: {
          orgId,
          objectId: crmObject.id,
          archivedAt: null,
        },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const view = await tx.view.create({
        data: {
          orgId,
          objectId: crmObject.id,
          name: data.name,
          type: toPrismaViewType(data.type),
          order: (lastView?.order ?? -1) + 1,
          groupByAttributeId: getDefaultBoardGroupByAttributeId(data.type, crmObject.attributes),
          config: {
            source: 'object',
            schemaVersion: 1,
          } as Prisma.InputJsonObject,
          createdById: req.user!.userId,
        },
      });

      await writeViewParts(tx, orgId, view.id, crmObject, {
        columns: data.columns.length ? data.columns : normalizeColumns([], crmObject.attributes).map((column) => ({
          attributeKey: column.attribute.key,
          order: column.order,
          width: column.width,
          isVisible: column.isVisible,
        })),
        filters: data.filters,
        sorts: data.sorts,
      });

      const savedView = await tx.view.findFirst({
        where: { id: view.id, orgId },
        include: viewInclude,
      });

      if (!savedView) {
        throw new Error('View was not found after creation');
      }

      return savedView;
    });

    res.status(201).json(serializeView(createdView));
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// GET /api/views/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const view = await findView(orgId, req.params.id);

    if (!view) {
      res.status(404).json({ error: 'View not found' });
      return;
    }

    res.json(serializeView(view));
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// PATCH /api/views/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const data = updateViewSchema.parse(req.body);
    const existingView = await prisma.view.findFirst({
      where: {
        id: req.params.id,
        orgId,
        archivedAt: null,
      },
      include: {
        object: {
          select: {
            key: true,
          },
        },
      },
    });

    if (!existingView) {
      res.status(404).json({ error: 'View not found' });
      return;
    }

    if (!existingView.object?.key) {
      res.status(400).json({ error: 'Only object views are supported in this endpoint' });
      return;
    }

    const crmObject = await findCrmObject(orgId, existingView.object.key);

    if (!crmObject) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }

    const updatedView = await prisma.$transaction(async (tx) => {
      await tx.view.update({
        where: { id: existingView.id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.type !== undefined
            ? {
                type: toPrismaViewType(data.type),
                groupByAttributeId: getDefaultBoardGroupByAttributeId(data.type, crmObject.attributes),
              }
            : {}),
        },
      });

      await writeViewParts(tx, orgId, existingView.id, crmObject, {
        columns: data.columns,
        filters: data.filters,
        sorts: data.sorts,
      });

      const savedView = await tx.view.findFirst({
        where: { id: existingView.id, orgId },
        include: viewInclude,
      });

      if (!savedView) {
        throw new Error('View was not found after update');
      }

      return savedView;
    });

    res.json(serializeView(updatedView));
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// DELETE /api/views/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId!;
    const existingView = await prisma.view.findFirst({
      where: {
        id: req.params.id,
        orgId,
        archivedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!existingView) {
      res.status(404).json({ error: 'View not found' });
      return;
    }

    const archivedView = await prisma.view.update({
      where: { id: existingView.id },
      data: { archivedAt: new Date() },
      include: viewInclude,
    });

    res.json(serializeView(archivedView));
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

export default router;