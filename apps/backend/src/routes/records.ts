import { Router, Request, Response, NextFunction } from 'express';

import { ActivityType, AttributeType, Prisma, PrismaClient } from '@prisma/client';

import { z } from 'zod';

import { authenticate, requireOrg } from '../middleware/auth';
import {
  CrmValueValidationError,
  recordSerializationInclude,
  serializeRecord,
  writeValues,
} from '../services/crm/values';

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

const listRecordsQuerySchema = objectLookupBase
  .extend({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    search: z.string().trim().max(200).optional(),
    filters: jsonArrayParam(recordFilterSchema),
    sorts: jsonArrayParam(recordSortSchema),
    columns: jsonArrayParam(recordColumnSchema),
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

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === 'object' && 'toNumber' in value) {
    const decimalValue = value as { toNumber: () => number };
    const parsed = decimalValue.toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function valueToDateMs(value: unknown): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  }

  return null;
}

function isObjectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function normalizeObjectLabel(value: Record<string, unknown>): string {
  const label =
    value.displayName ??
    value.name ??
    value.label ??
    value.title ??
    value.value ??
    value.key ??
    value.id ??
    JSON.stringify(value);

  return String(label);
}

function flattenToStrings(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenToStrings(item));
  }

  if (value instanceof Date) {
    return [value.toISOString()];
  }

  if (isObjectValue(value)) {
    return [normalizeObjectLabel(value)];
  }

  return [String(value)];
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (isObjectValue(value)) {
    return Object.keys(value).length === 0;
  }

  return false;
}

function getValueForAttribute(record: SerializedRecordPayload, attribute: CrmAttributeForRecords): unknown {
  const value = record.values.find((item: SerializedValuePayload) => item.attributeId === attribute.id);

  if (!value) {
    return null;
  }

  switch (attribute.type) {
    case AttributeType.TEXT:
    case AttributeType.EMAIL:
    case AttributeType.PHONE:
    case AttributeType.URL:
    case AttributeType.SELECT:
      return value.textValue ?? value.jsonValue ?? null;

    case AttributeType.LONG_TEXT:
      return value.longTextValue ?? value.textValue ?? null;

    case AttributeType.NUMBER:
      return decimalToNumber(value.numberValue);

    case AttributeType.CURRENCY:
      return decimalToNumber(value.currencyAmount);

    case AttributeType.BOOLEAN:
      return value.booleanValue;

    case AttributeType.DATE:
    case AttributeType.DATETIME:
      return value.dateValue;

    case AttributeType.USER:
      return value.userValueId ?? value.jsonValue ?? null;

    case AttributeType.MULTI_SELECT:
    case AttributeType.RELATIONSHIP:
    case AttributeType.JSON:
    default:
      return value.jsonValue ?? value.textValue ?? value.longTextValue ?? null;
  }
}

function compareLooseEquals(actual: unknown, expected: unknown): boolean {
  if (isEmptyValue(actual) && isEmptyValue(expected)) {
    return true;
  }

  const actualValues = flattenToStrings(actual).map((value) => value.trim().toLowerCase()).filter(Boolean);
  const expectedValues = flattenToStrings(expected).map((value) => value.trim().toLowerCase()).filter(Boolean);

  if (!actualValues.length || !expectedValues.length) {
    return false;
  }

  return actualValues.some((actualValue) => expectedValues.includes(actualValue));
}

function compareContains(actual: unknown, expected: unknown): boolean {
  const expectedText = flattenToStrings(expected).join(' ').trim().toLowerCase();

  if (!expectedText) {
    return true;
  }

  return flattenToStrings(actual).some((actualValue) => actualValue.toLowerCase().includes(expectedText));
}

function compareGreaterOrLess(actual: unknown, expected: unknown, direction: 'gt' | 'lt'): boolean {
  const actualNumber = decimalToNumber(actual);
  const expectedNumber = decimalToNumber(expected);

  if (actualNumber !== null && expectedNumber !== null) {
    return direction === 'gt' ? actualNumber > expectedNumber : actualNumber < expectedNumber;
  }

  const actualDate = valueToDateMs(actual);
  const expectedDate = valueToDateMs(expected);

  if (actualDate !== null && expectedDate !== null) {
    return direction === 'gt' ? actualDate > expectedDate : actualDate < expectedDate;
  }

  const actualText = flattenToStrings(actual).join(' ').toLowerCase();
  const expectedText = flattenToStrings(expected).join(' ').toLowerCase();

  if (!actualText || !expectedText) {
    return false;
  }

  const result = actualText.localeCompare(expectedText, 'ru');
  return direction === 'gt' ? result > 0 : result < 0;
}

function matchesFilter(record: SerializedRecordPayload, filter: CompiledFilter): boolean {
  const actualValue = getValueForAttribute(record, filter.attribute);

  switch (filter.op) {
    case 'eq':
      return compareLooseEquals(actualValue, filter.value);

    case 'neq':
      return !compareLooseEquals(actualValue, filter.value);

    case 'contains':
      return compareContains(actualValue, filter.value);

    case 'gt':
      return compareGreaterOrLess(actualValue, filter.value, 'gt');

    case 'lt':
      return compareGreaterOrLess(actualValue, filter.value, 'lt');

    case 'in': {
      const expectedValues = Array.isArray(filter.value) ? filter.value : [filter.value];
      return expectedValues.some((expectedValue) => compareLooseEquals(actualValue, expectedValue));
    }

    case 'is_empty':
      return isEmptyValue(actualValue);

    case 'is_not_empty':
      return !isEmptyValue(actualValue);

    default:
      return true;
  }
}

function compareRecordValues(left: unknown, right: unknown): number {
  const leftIsEmpty = isEmptyValue(left);
  const rightIsEmpty = isEmptyValue(right);

  if (leftIsEmpty && rightIsEmpty) return 0;
  if (leftIsEmpty) return 1;
  if (rightIsEmpty) return -1;

  const leftNumber = decimalToNumber(left);
  const rightNumber = decimalToNumber(right);

  if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  const leftDate = valueToDateMs(left);
  const rightDate = valueToDateMs(right);

  if (leftDate !== null && rightDate !== null && leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  const leftText = flattenToStrings(left).join(' ').toLowerCase();
  const rightText = flattenToStrings(right).join(' ').toLowerCase();

  return leftText.localeCompare(rightText, 'ru');
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

    const filteredRecords = filters.length
      ? records.filter((record) => filters.every((filter) => matchesFilter(record, filter)))
      : records;
    const sortedRecords = sorts.length ? sortRecords(filteredRecords, sorts) : filteredRecords;
    const paginatedRecords = sortedRecords.slice(skip, skip + limit);
    const total = filteredRecords.length;

    res.json({
      records: paginatedRecords.map((record) => serializeRecord(record)),
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

    const createdRecord = await prisma.$transaction(async (tx) => {
      const record = await tx.record.create({
        data: {
          orgId,
          objectId: crmObject.id,
          createdById: req.user!.userId,
          updatedById: req.user!.userId,
        },
      });

      await writeValues(tx, record, data.values, { enforceRequired: true });

      await tx.activity.create({
        data: {
          orgId,
          recordId: record.id,
          actorId: req.user!.userId,
          type: ActivityType.RECORD_CREATED,
          title: 'Запись создана',
          payload: {
            objectId: crmObject.id,
            objectKey: crmObject.key,
            valueKeys: Object.keys(data.values),
          } as Prisma.InputJsonValue,
        },
      });

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

    res.json(serializeRecord(record));
  } catch (err) {
    handleRouteError(err, res, next);
  }
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

    const updatedRecord = await prisma.$transaction(async (tx) => {
      await tx.record.update({
        where: { id: existingRecord.id },
        data: {
          updatedById: req.user!.userId,
        },
      });

      await writeValues(tx, existingRecord, data.values);

      await tx.activity.create({
        data: {
          orgId,
          recordId: existingRecord.id,
          actorId: req.user!.userId,
          type: ActivityType.RECORD_UPDATED,
          title: 'Запись обновлена',
          payload: {
            recordId: existingRecord.id,
            valueKeys: Object.keys(data.values),
          } as Prisma.InputJsonValue,
        },
      });

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

    res.json(serializeRecord(updatedRecord));
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
          title: 'Запись архивирована',
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