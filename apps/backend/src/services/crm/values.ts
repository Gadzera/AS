import { AttributeType, Prisma, PrismaClient, RelationshipCardinality, ValueSource } from '@prisma/client';
import type { Attribute, AttributeOption, RelationshipDefinition, Value } from '@prisma/client';

type CrmTransaction = Pick<
  PrismaClient,
  'attribute' | 'record' | 'relationshipDefinition' | 'relationshipValue' | 'user' | 'value' | 'stageTransition'
>;

type ValuesByAttribute = { [attributeKeyOrId: string]: unknown };

type MinimalRecord = {
  id: string;
  orgId: string;
  objectId: string;
};

type AttributeForWrite = Attribute & {
  options: AttributeOption[];
  sourceRelationshipDefinitions: RelationshipDefinition[];
  // REL-1: непустой ⇒ это reverse-атрибут (управляется forward-стороной, прямая запись запрещена).
  reverseRelationshipDefinitions: RelationshipDefinition[];
};

type ValueStorageData = {
  textValue: string | null;
  longTextValue: string | null;
  numberValue: Prisma.Decimal | null;
  booleanValue: boolean | null;
  dateValue: Date | null;
  jsonValue: unknown;
  userValueId: string | null;
  currencyAmount: Prisma.Decimal | null;
  currencyCode: string | null;
};

type SerializableValue = Value & {
  attribute: Attribute & {
    options?: AttributeOption[];
  };
  userValue?: {
    id: string;
    email: string;
    name: string;
  } | null;
};

type SerializableRelationshipValue = {
  sourceAttribute: (Attribute & {
    sourceRelationshipDefinitions?: Pick<RelationshipDefinition, 'cardinality'>[];
  }) | null;
  targetRecord: {
    id: string;
    objectId: string;
    displayName: string | null;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
    object?: {
      id: string;
      key: string;
      singularName: string;
      pluralName: string;
    } | null;
  } | null;
};

type SerializableRecord = {
  id: string;
  orgId: string;
  objectId: string;
  displayName: string | null;
  searchText: string | null;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  object?: {
    id: string;
    key: string;
    singularName: string;
    pluralName: string;
  } | null;
  values?: SerializableValue[];
  sourceRelationships?: SerializableRelationshipValue[];
};

export type SerializedRecord = {
  id: string;
  orgId: string;
  objectId: string;
  objectKey: string | null;
  displayName: string | null;
  searchText: string | null;
  values: { [attributeKey: string]: unknown };
  // M29-1: происхождение текущего значения по атрибуту (для значка AI/Manual в UI). Только для скалярных Value (не relationship).
  valueMeta: { [attributeKey: string]: { source: ValueSource; lastAiRunId: string | null } };
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type WriteValuesOptions = {
  enforceRequired?: boolean;
  // M18-2: кто изменил значения — попадёт в StageTransition.changedById (для аудита переходов стадий).
  actorId?: string | null;
  // M29-1: происхождение записи. По умолчанию MANUAL (ручная правка). Импорт передаёт IMPORT, воркфлоу/система — SYSTEM.
  // НЕ AI: AI-значения пишет только services/ai (saveAiValue). Provenance меняется ТОЛЬКО при реальном изменении значения.
  valueSource?: ValueSource;
};

export class CrmValueValidationError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'CrmValueValidationError';
    this.statusCode = 400;
  }
}

export const recordSerializationInclude = Prisma.validator<Prisma.RecordInclude>()({
  object: true,
  values: {
    include: {
      attribute: {
        include: {
          options: {
            where: { isArchived: false },
            orderBy: { order: 'asc' },
          },
        },
      },
      userValue: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  sourceRelationships: {
    include: {
      sourceAttribute: {
        include: {
          sourceRelationshipDefinitions: {
            where: { archivedAt: null },
            select: {
              cardinality: true,
            },
          },
        },
      },
      targetRecord: {
        include: {
          object: true,
        },
      },
    },
  },
});

function isPlainObject(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isClearInput(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0);
}

function hasRequiredValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function emptyValueStorage(): ValueStorageData {
  return {
    textValue: null,
    longTextValue: null,
    numberValue: null,
    booleanValue: null,
    dateValue: null,
    jsonValue: Prisma.DbNull,
    userValueId: null,
    currencyAmount: null,
    currencyCode: null,
  };
}

function normalizeString(raw: unknown, fieldName: string): string {
  if (typeof raw === 'string') {
    return raw.trim();
  }

  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw);
  }

  if (raw instanceof Date) {
    return raw.toISOString();
  }

  if (isPlainObject(raw) || Array.isArray(raw)) {
    return JSON.stringify(raw);
  }

  throw new CrmValueValidationError(`${fieldName} must be a string-compatible value`);
}

function normalizeDecimal(raw: unknown, fieldName: string): Prisma.Decimal {
  if (!(typeof raw === 'number' || typeof raw === 'string' || raw instanceof Prisma.Decimal)) {
    throw new CrmValueValidationError(`${fieldName} must be a number`);
  }

  if (typeof raw === 'string' && raw.trim().length === 0) {
    throw new CrmValueValidationError(`${fieldName} must be a number`);
  }

  try {
    const decimal = new Prisma.Decimal(raw as string | number | Prisma.Decimal);

    if (!decimal.isFinite()) {
      throw new Error('Decimal is not finite');
    }

    return decimal;
  } catch (_err) {
    throw new CrmValueValidationError(`${fieldName} must be a valid number`);
  }
}

function normalizeBoolean(raw: unknown): boolean {
  if (typeof raw === 'boolean') {
    return raw;
  }

  if (typeof raw === 'number') {
    if (raw === 1) {
      return true;
    }

    if (raw === 0) {
      return false;
    }
  }

  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();

    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }

  throw new CrmValueValidationError('BOOLEAN value must be true or false');
}

function normalizeDate(raw: unknown, fieldName: string): Date {
  if (!(raw instanceof Date || typeof raw === 'string' || typeof raw === 'number')) {
    throw new CrmValueValidationError(`${fieldName} must be a date`);
  }

  const date = raw instanceof Date ? raw : new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new CrmValueValidationError(`${fieldName} must be a valid date`);
  }

  return date;
}

function normalizeEmail(raw: unknown): string {
  const email = normalizeString(raw, 'EMAIL value').toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    throw new CrmValueValidationError('EMAIL value must be a valid email address');
  }

  return email;
}

function normalizeUrl(raw: unknown): string {
  const url = normalizeString(raw, 'URL value');

  try {
    return new URL(url).toString();
  } catch (_err) {
    throw new CrmValueValidationError('URL value must be a valid URL with protocol');
  }
}

function normalizeCurrency(raw: unknown): { amount: Prisma.Decimal; currencyCode: string } {
  let amountRaw: unknown = raw;
  let currencyCode = 'USD';

  if (isPlainObject(raw)) {
    amountRaw = raw.amount;

    if (typeof raw.currencyCode === 'string' && raw.currencyCode.trim().length > 0) {
      currencyCode = raw.currencyCode.trim().toUpperCase();
    } else if (typeof raw.currency === 'string' && raw.currency.trim().length > 0) {
      currencyCode = raw.currency.trim().toUpperCase();
    }
  }

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    throw new CrmValueValidationError('CURRENCY currencyCode must be a 3-letter ISO code');
  }

  return {
    amount: normalizeDecimal(amountRaw, 'CURRENCY amount'),
    currencyCode,
  };
}

function normalizeJson(raw: unknown): Prisma.InputJsonValue {
  try {
    const jsonText = JSON.stringify(raw);

    if (jsonText === undefined) {
      throw new Error('Value is not JSON serializable');
    }

    return JSON.parse(jsonText) as Prisma.InputJsonValue;
  } catch (_err) {
    throw new CrmValueValidationError('JSON value must be JSON-serializable');
  }
}

function extractOptionToken(raw: unknown): string {
  if (typeof raw === 'string') {
    const token = raw.trim();

    if (token.length === 0) {
      throw new CrmValueValidationError('SELECT value cannot be empty');
    }

    return token;
  }

  if (isPlainObject(raw)) {
    if (typeof raw.value === 'string' && raw.value.trim().length > 0) {
      return raw.value.trim();
    }

    if (typeof raw.id === 'string' && raw.id.trim().length > 0) {
      return raw.id.trim();
    }

    if (typeof raw.label === 'string' && raw.label.trim().length > 0) {
      return raw.label.trim();
    }
  }

  throw new CrmValueValidationError('SELECT value must match an existing option value or id');
}

function extractRecordId(raw: unknown): string {
  if (typeof raw === 'string') {
    const id = raw.trim();

    if (id.length === 0) {
      throw new CrmValueValidationError('RELATIONSHIP value cannot be empty');
    }

    return id;
  }

  if (isPlainObject(raw) && typeof raw.id === 'string' && raw.id.trim().length > 0) {
    return raw.id.trim();
  }

  throw new CrmValueValidationError('RELATIONSHIP value must be a record id or an object with id');
}

function extractUserId(raw: unknown): string {
  if (typeof raw === 'string') {
    const id = raw.trim();

    if (id.length === 0) {
      throw new CrmValueValidationError('USER value cannot be empty');
    }

    return id;
  }

  if (isPlainObject(raw) && typeof raw.id === 'string' && raw.id.trim().length > 0) {
    return raw.id.trim();
  }

  throw new CrmValueValidationError('USER value must be a user id or an object with id');
}

export function validateValue(attributeType: AttributeType, raw: unknown): unknown {
  if (raw === null || raw === undefined) {
    return null;
  }

  switch (attributeType) {
    case AttributeType.TEXT:
    case AttributeType.PHONE:
      return normalizeString(raw, `${attributeType} value`);

    case AttributeType.LONG_TEXT:
      return normalizeString(raw, 'LONG_TEXT value');

    case AttributeType.NUMBER:
      return normalizeDecimal(raw, 'NUMBER value');

    case AttributeType.BOOLEAN:
      return normalizeBoolean(raw);

    case AttributeType.DATE:
    case AttributeType.DATETIME:
      return normalizeDate(raw, `${attributeType} value`);

    case AttributeType.SELECT:
      return extractOptionToken(raw);

    case AttributeType.MULTI_SELECT:
      if (!Array.isArray(raw)) {
        throw new CrmValueValidationError('MULTI_SELECT value must be an array');
      }

      return raw.map((item) => extractOptionToken(item));

    case AttributeType.CURRENCY:
      return normalizeCurrency(raw);

    case AttributeType.EMAIL:
      return normalizeEmail(raw);

    case AttributeType.URL:
      return normalizeUrl(raw);

    case AttributeType.USER:
      return extractUserId(raw);

    case AttributeType.RELATIONSHIP:
      if (Array.isArray(raw)) {
        return raw.map((item) => extractRecordId(item));
      }

      return [extractRecordId(raw)];

    case AttributeType.JSON:
      return normalizeJson(raw);

    default:
      throw new CrmValueValidationError(`Unsupported attribute type: ${String(attributeType)}`);
  }
}

function findOption(attribute: AttributeForWrite, token: string): AttributeOption | undefined {
  return attribute.options.find((option) => option.id === token || option.value === token || option.label === token);
}

function resolveSelectValue(attribute: AttributeForWrite, raw: unknown): string {
  const token = validateValue(AttributeType.SELECT, raw) as string;
  const option = findOption(attribute, token);

  if (!option) {
    throw new CrmValueValidationError(`Value for "${attribute.key}" must match an existing option`);
  }

  return option.value;
}

function resolveMultiSelectValue(attribute: AttributeForWrite, raw: unknown): string[] {
  const tokens = validateValue(AttributeType.MULTI_SELECT, raw) as string[];
  const values = new Set<string>();

  for (const token of tokens) {
    const option = findOption(attribute, token);

    if (!option) {
      throw new CrmValueValidationError(`Value "${token}" for "${attribute.key}" must match an existing option`);
    }

    values.add(option.value);
  }

  return Array.from(values);
}

function isSingleSourceRelationship(cardinality: RelationshipCardinality): boolean {
  return cardinality === RelationshipCardinality.ONE_TO_ONE || cardinality === RelationshipCardinality.MANY_TO_ONE;
}

function requiresUniqueTarget(cardinality: RelationshipCardinality): boolean {
  return cardinality === RelationshipCardinality.ONE_TO_ONE || cardinality === RelationshipCardinality.ONE_TO_MANY;
}

async function buildRelationshipStorage(
  tx: CrmTransaction,
  record: MinimalRecord,
  attribute: AttributeForWrite,
  raw: unknown
): Promise<ValueStorageData> {
  const targetIds = Array.from(new Set(validateValue(AttributeType.RELATIONSHIP, raw) as string[]));
  const storage = emptyValueStorage();

  const relationshipDefinition =
    attribute.sourceRelationshipDefinitions[0] ??
    (await tx.relationshipDefinition.findFirst({
      where: {
        orgId: record.orgId,
        sourceAttributeId: attribute.id,
        archivedAt: null,
      },
    }));

  if (!relationshipDefinition) {
    throw new CrmValueValidationError(`Relationship definition for "${attribute.key}" was not found`);
  }

  if (isSingleSourceRelationship(relationshipDefinition.cardinality) && targetIds.length > 1) {
    throw new CrmValueValidationError(`Relationship "${attribute.key}" accepts only one target record`);
  }

  if (targetIds.length > 0) {
    const targetRecords = await tx.record.findMany({
      where: {
        orgId: record.orgId,
        objectId: relationshipDefinition.targetObjectId,
        id: { in: targetIds },
        archivedAt: null,
      },
      select: { id: true },
    });

    const existingTargetIds = new Set(targetRecords.map((targetRecord) => targetRecord.id));
    const missingTargetId = targetIds.find((targetId) => !existingTargetIds.has(targetId));

    if (missingTargetId) {
      throw new CrmValueValidationError(`Relationship target record "${missingTargetId}" was not found`);
    }

    if (requiresUniqueTarget(relationshipDefinition.cardinality)) {
      const conflictingRelationship = await tx.relationshipValue.findFirst({
        where: {
          orgId: record.orgId,
          sourceAttributeId: attribute.id,
          targetRecordId: { in: targetIds },
          NOT: {
            sourceRecordId: record.id,
          },
        },
        select: { id: true },
      });

      if (conflictingRelationship) {
        throw new CrmValueValidationError(`One or more target records are already linked by "${attribute.key}"`);
      }
    }
  }

  await tx.relationshipValue.deleteMany({
    where: {
      orgId: record.orgId,
      sourceRecordId: record.id,
      sourceAttributeId: attribute.id,
    },
  });

  for (const targetId of targetIds) {
    await tx.relationshipValue.create({
      data: {
        orgId: record.orgId,
        sourceRecordId: record.id,
        sourceAttributeId: attribute.id,
        targetRecordId: targetId,
      },
    });
  }

  storage.jsonValue = targetIds as Prisma.InputJsonValue;

  return storage;
}

async function buildValueStorage(
  tx: CrmTransaction,
  record: MinimalRecord,
  attribute: AttributeForWrite,
  raw: unknown
): Promise<ValueStorageData> {
  const storage = emptyValueStorage();

  switch (attribute.type) {
    case AttributeType.TEXT:
    case AttributeType.PHONE:
      storage.textValue = validateValue(attribute.type, raw) as string;
      return storage;

    case AttributeType.LONG_TEXT:
      storage.longTextValue = validateValue(attribute.type, raw) as string;
      return storage;

    case AttributeType.NUMBER:
      storage.numberValue = validateValue(attribute.type, raw) as Prisma.Decimal;
      return storage;

    case AttributeType.BOOLEAN:
      storage.booleanValue = validateValue(attribute.type, raw) as boolean;
      return storage;

    case AttributeType.DATE:
    case AttributeType.DATETIME:
      storage.dateValue = validateValue(attribute.type, raw) as Date;
      return storage;

    case AttributeType.SELECT:
      storage.textValue = resolveSelectValue(attribute, raw);
      return storage;

    case AttributeType.MULTI_SELECT:
      storage.jsonValue = resolveMultiSelectValue(attribute, raw) as Prisma.InputJsonValue;
      return storage;

    case AttributeType.CURRENCY: {
      const normalizedCurrency = validateValue(attribute.type, raw) as {
        amount: Prisma.Decimal;
        currencyCode: string;
      };

      storage.currencyAmount = normalizedCurrency.amount;
      storage.currencyCode = normalizedCurrency.currencyCode;
      return storage;
    }

    case AttributeType.EMAIL:
    case AttributeType.URL:
      storage.textValue = validateValue(attribute.type, raw) as string;
      return storage;

    case AttributeType.USER: {
      const userId = validateValue(attribute.type, raw) as string;
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          orgId: record.orgId,
        },
        select: { id: true },
      });

      if (!user) {
        throw new CrmValueValidationError(`User "${userId}" was not found in organization`);
      }

      storage.userValueId = user.id;
      return storage;
    }

    case AttributeType.RELATIONSHIP:
      return buildRelationshipStorage(tx, record, attribute, raw);

    case AttributeType.JSON:
      storage.jsonValue = validateValue(attribute.type, raw) as Prisma.InputJsonValue;
      return storage;

    default:
      throw new CrmValueValidationError(`Unsupported attribute type: ${String(attribute.type)}`);
  }
}

function decimalToString(value: Prisma.Decimal | null): string | null {
  return value ? value.toString() : null;
}

function decimalToJson(value: Prisma.Decimal | null): number | string | null {
  if (!value) {
    return null;
  }

  const text = value.toString();
  const numberValue = Number(text);

  if (Number.isFinite(numberValue)) {
    return numberValue;
  }

  return text;
}

function valueToPlainString(value: Value & { attribute: Attribute }): string | null {
  if (value.textValue) {
    return value.textValue;
  }

  if (value.longTextValue) {
    return value.longTextValue;
  }

  if (value.numberValue) {
    return value.numberValue.toString();
  }

  if (value.booleanValue !== null) {
    return value.booleanValue ? 'true' : 'false';
  }

  if (value.dateValue) {
    return value.dateValue.toISOString();
  }

  if (value.userValueId) {
    return value.userValueId;
  }

  if (value.currencyAmount) {
    return `${value.currencyAmount.toString()} ${value.currencyCode ?? ''}`.trim();
  }

  if (value.jsonValue !== null && value.jsonValue !== undefined) {
    if (Array.isArray(value.jsonValue)) {
      return value.jsonValue.map((item) => String(item)).join(' ');
    }

    if (typeof value.jsonValue === 'object') {
      return JSON.stringify(value.jsonValue);
    }

    return String(value.jsonValue);
  }

  return null;
}

async function refreshRecordSearchFields(tx: CrmTransaction, recordId: string, orgId: string): Promise<void> {
  const record = await tx.record.findFirst({
    where: {
      id: recordId,
      orgId,
    },
    include: {
      object: {
        select: {
          primaryAttributeId: true,
        },
      },
      values: {
        include: {
          attribute: true,
        },
      },
    },
  });

  if (!record) {
    return;
  }

  const primaryValue =
    (record.object.primaryAttributeId
      ? record.values.find((value) => value.attributeId === record.object.primaryAttributeId)
      : undefined) ?? record.values.find((value) => value.attribute.isPrimary);

  const searchableChunks = record.values
    .map((value) => valueToPlainString(value))
    .filter((value): value is string => Boolean(value && value.trim().length > 0));

  const primaryDisplayName = primaryValue ? valueToPlainString(primaryValue) : null;
  const displayName = primaryDisplayName && primaryDisplayName.trim().length > 0 ? primaryDisplayName : searchableChunks[0] ?? null;
  const searchText = searchableChunks.join(' ').slice(0, 4000);

  await tx.record.update({
    where: { id: record.id },
    data: {
      displayName,
      searchText: searchText.length > 0 ? searchText : null,
    },
  });
}

// M17-2: сравнение storage с существующим Value по колонкам (для ATTRIBUTE_UPDATED — fire только на РЕАЛЬНОЕ изменение).
// storage использует Prisma.DbNull/JsonNull-сентинелы для «пусто» — приводим их к null, иначе jsonValue вечно «отличается».
function nullish(v: unknown): boolean {
  return v == null || v === Prisma.DbNull || v === Prisma.JsonNull || v === Prisma.AnyNull;
}
function valueColEq(col: string, a: unknown, b: unknown): boolean {
  if (nullish(a) && nullish(b)) return true;
  if (nullish(a) || nullish(b)) return false;
  if (col === 'dateValue') return new Date(a as string).getTime() === new Date(b as string).getTime();
  // Сравнение по масштабу колонки: numberValue Decimal(18,6), currencyAmount Decimal(18,2) — иначе sub-scale
  // ввод (напр. 1.0000005) даёт ложное «изменение» против округлённого сохранённого значения.
  if (col === 'numberValue') return Number(String(a)).toFixed(6) === Number(String(b)).toFixed(6);
  if (col === 'currencyAmount') return Number(String(a)).toFixed(2) === Number(String(b)).toFixed(2);
  if (col === 'jsonValue') return JSON.stringify(a) === JSON.stringify(b);
  return String(a) === String(b);
}
const VALUE_COLS = ['textValue', 'longTextValue', 'numberValue', 'booleanValue', 'dateValue', 'jsonValue', 'userValueId', 'currencyAmount', 'currencyCode'] as const;
function valuesDiffer(prev: Record<string, unknown>, storage: Record<string, unknown>): boolean {
  return VALUE_COLS.some((c) => !valueColEq(c, prev[c], storage[c]));
}

/** Возвращает id атрибутов, чьё значение РЕАЛЬНО изменилось (для ATTRIBUTE_UPDATED/RECORD_UPDATED триггеров). */
export async function writeValues(
  tx: CrmTransaction,
  record: MinimalRecord,
  valuesByAttrKeyOrId: ValuesByAttribute,
  options: WriteValuesOptions = {}
): Promise<string[]> {
  const attributes = await tx.attribute.findMany({
    where: {
      orgId: record.orgId,
      objectId: record.objectId,
      isArchived: false,
      archivedAt: null,
    },
    include: {
      options: {
        where: { isArchived: false },
        orderBy: { order: 'asc' },
      },
      sourceRelationshipDefinitions: {
        where: { archivedAt: null },
      },
      // REL-1: back-relation — определения, где этот атрибут является reverse-стороной
      reverseRelationshipDefinitions: {
        where: { archivedAt: null },
      },
    },
  });

  const attributesById = new Map<string, AttributeForWrite>();
  const attributesByKey = new Map<string, AttributeForWrite>();

  for (const attribute of attributes) {
    attributesById.set(attribute.id, attribute);
    attributesByKey.set(attribute.key, attribute);
  }

  const entries = Object.entries(valuesByAttrKeyOrId);
  const resolvedEntries = entries.map(([keyOrId, rawValue]) => {
    const attribute = attributesById.get(keyOrId) ?? attributesByKey.get(keyOrId);

    if (!attribute) {
      throw new CrmValueValidationError(`Attribute "${keyOrId}" was not found for record object`);
    }

    // REL-1: reverse-атрибут управляется forward-стороной — прямая запись запрещена (без RelationshipValue на reverseAttributeId).
    if (attribute.reverseRelationshipDefinitions.length > 0) {
      throw new CrmValueValidationError(`Attribute "${attribute.key}" is a managed reverse relationship and cannot be written directly — edit the relationship from the source record`);
    }

    return { attribute, rawValue };
  });

  if (options.enforceRequired) {
    const providedRequiredAttributeIds = new Set(
      resolvedEntries
        .filter(({ attribute, rawValue }) => attribute.isRequired && hasRequiredValue(rawValue))
        .map(({ attribute }) => attribute.id)
    );

    const missingRequiredAttribute = attributes.find(
      (attribute) => attribute.isRequired && !providedRequiredAttributeIds.has(attribute.id)
    );

    if (missingRequiredAttribute) {
      throw new CrmValueValidationError(`Required attribute "${missingRequiredAttribute.key}" is missing`);
    }
  }

  // M17-2: снимок существующих значений ДО записи — чтобы вычислить РЕАЛЬНО изменившиеся атрибуты.
  const existingValues = await tx.value.findMany({
    where: { orgId: record.orgId, recordId: record.id, attributeId: { in: resolvedEntries.map((e) => e.attribute.id) } },
  });
  const existingByAttr = new Map(existingValues.map((v) => [v.attributeId, v as unknown as Record<string, unknown>]));
  const changedAttributeIds: string[] = [];
  // M18-2: переходы стадий (только SELECT, только РЕАЛЬНОЕ изменение) — основа Time-in-stage/Stage-change.
  const pendingTransitions: { attributeId: string; fromValue: string | null; toValue: string | null }[] = [];
  const asToken = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

  for (const { attribute, rawValue } of resolvedEntries) {
    if (attribute.isRequired && !hasRequiredValue(rawValue)) {
      throw new CrmValueValidationError(`Required attribute "${attribute.key}" cannot be empty`);
    }

    if (isClearInput(rawValue)) {
      if (existingByAttr.has(attribute.id)) {
        changedAttributeIds.push(attribute.id); // очистка существующего значения = изменение
        if (attribute.type === AttributeType.SELECT) {
          pendingTransitions.push({ attributeId: attribute.id, fromValue: asToken(existingByAttr.get(attribute.id)?.textValue), toValue: null });
        }
      }

      await tx.relationshipValue.deleteMany({
        where: {
          orgId: record.orgId,
          sourceRecordId: record.id,
          sourceAttributeId: attribute.id,
        },
      });

      await tx.value.deleteMany({
        where: {
          orgId: record.orgId,
          recordId: record.id,
          attributeId: attribute.id,
        },
      });

      continue;
    }

    const storage = await buildValueStorage(tx, record, attribute, rawValue);
    const prev = existingByAttr.get(attribute.id);
    const didChange = !prev || valuesDiffer(prev, storage as unknown as Record<string, unknown>);
    if (didChange) {
      changedAttributeIds.push(attribute.id);
      // SELECT-переход: записываем ТОЛЬКО при реальной смене токена опции (no-op не доходит сюда).
      if (attribute.type === AttributeType.SELECT) {
        const fromToken = asToken(prev?.textValue);
        const toToken = asToken(storage.textValue);
        if (fromToken !== toToken) pendingTransitions.push({ attributeId: attribute.id, fromValue: fromToken, toValue: toToken });
      }
    }

    // M29-1: происхождение не-AI записи (по умолчанию ручная). Новое значение всегда помечается источником;
    // существующее — ТОЛЬКО при реальном изменении (no-op upsert не должен флипать AI→MANUAL).
    const writeSource = options.valueSource ?? ValueSource.MANUAL;

    const createData = {
      orgId: record.orgId,
      recordId: record.id,
      attributeId: attribute.id,
      textValue: storage.textValue,
      longTextValue: storage.longTextValue,
      numberValue: storage.numberValue,
      booleanValue: storage.booleanValue,
      dateValue: storage.dateValue,
      jsonValue: storage.jsonValue,
      userValueId: storage.userValueId,
      currencyAmount: storage.currencyAmount,
      currencyCode: storage.currencyCode,
      source: writeSource,
      lastAiRunId: null,
    } as Prisma.ValueUncheckedCreateInput;

    const updateData = {
      textValue: storage.textValue,
      longTextValue: storage.longTextValue,
      numberValue: storage.numberValue,
      booleanValue: storage.booleanValue,
      dateValue: storage.dateValue,
      jsonValue: storage.jsonValue,
      userValueId: storage.userValueId,
      currencyAmount: storage.currencyAmount,
      currencyCode: storage.currencyCode,
    } as Prisma.ValueUncheckedUpdateInput;

    // provenance обновляем только если значение реально изменилось ручной/импорт-записью
    if (didChange) {
      updateData.source = writeSource;
      updateData.lastAiRunId = null;
    }

    await tx.value.upsert({
      where: {
        recordId_attributeId: {
          recordId: record.id,
          attributeId: attribute.id,
        },
      },
      create: createData,
      update: updateData,
    });
  }

  await refreshRecordSearchFields(tx, record.id, record.orgId);

  // M18-2: фиксируем переходы стадий (атомарно в той же tx). Пустой массив → запись не идёт.
  if (pendingTransitions.length) {
    await tx.stageTransition.createMany({
      data: pendingTransitions.map((t) => ({
        orgId: record.orgId,
        recordId: record.id,
        objectId: record.objectId,
        attributeId: t.attributeId,
        fromValue: t.fromValue,
        toValue: t.toValue,
        changedById: options.actorId ?? null,
      })),
    });
  }

  return changedAttributeIds;
}

function serializeOption(option: AttributeOption): { id: string; value: string; label: string; color: string | null } {
  return {
    id: option.id,
    value: option.value,
    label: option.label,
    color: option.color,
  };
}

function serializeValue(value: SerializableValue): unknown {
  switch (value.attribute.type) {
    case AttributeType.TEXT:
    case AttributeType.EMAIL:
    case AttributeType.PHONE:
    case AttributeType.URL:
    case AttributeType.SELECT: {
      if (value.attribute.type === AttributeType.SELECT) {
        const option = value.attribute.options?.find((item) => item.value === value.textValue || item.id === value.textValue);
        return option ? serializeOption(option) : value.textValue;
      }

      return value.textValue;
    }

    case AttributeType.LONG_TEXT:
      return value.longTextValue;

    case AttributeType.NUMBER:
      return decimalToJson(value.numberValue);

    case AttributeType.BOOLEAN:
      return value.booleanValue;

    case AttributeType.DATE:
    case AttributeType.DATETIME:
      return value.dateValue ? value.dateValue.toISOString() : null;

    case AttributeType.MULTI_SELECT: {
      const rawValues = Array.isArray(value.jsonValue) ? value.jsonValue.map((item) => String(item)) : [];
      const options = value.attribute.options ?? [];

      return rawValues.map((rawValue) => {
        const option = options.find((item) => item.value === rawValue || item.id === rawValue);
        return option ? serializeOption(option) : rawValue;
      });
    }

    case AttributeType.CURRENCY:
      return {
        amount: decimalToJson(value.currencyAmount),
        amountText: decimalToString(value.currencyAmount),
        currencyCode: value.currencyCode,
      };

    case AttributeType.USER:
      return value.userValue
        ? {
            id: value.userValue.id,
            email: value.userValue.email,
            name: value.userValue.name,
          }
        : value.userValueId;

    case AttributeType.RELATIONSHIP:
      if (Array.isArray(value.jsonValue)) {
        return value.jsonValue;
      }

      return value.jsonValue ?? null;

    case AttributeType.JSON:
      return value.jsonValue;

    default:
      return null;
  }
}

function serializeRelationshipTarget(targetRecord: SerializableRelationshipValue['targetRecord']): unknown {
  if (!targetRecord) {
    return null;
  }

  return {
    id: targetRecord.id,
    objectId: targetRecord.objectId,
    objectKey: targetRecord.object?.key ?? null,
    displayName: targetRecord.displayName,
    createdAt: targetRecord.createdAt.toISOString(),
    updatedAt: targetRecord.updatedAt.toISOString(),
    archivedAt: targetRecord.archivedAt ? targetRecord.archivedAt.toISOString() : null,
  };
}

export function serializeRecord(record: SerializableRecord): SerializedRecord {
  const values: { [attributeKey: string]: unknown } = {};
  // M29-1: параллельная карта происхождения значений (не меняет форму `values`).
  const valueMeta: { [attributeKey: string]: { source: ValueSource; lastAiRunId: string | null } } = {};

  for (const value of record.values ?? []) {
    values[value.attribute.key] = serializeValue(value);
    valueMeta[value.attribute.key] = { source: value.source, lastAiRunId: value.lastAiRunId };
  }

  const relationshipGroups: {
    [attributeKey: string]: {
      isSingle: boolean;
      items: unknown[];
    };
  } = {};

  for (const relationshipValue of record.sourceRelationships ?? []) {
    const sourceAttribute = relationshipValue.sourceAttribute;

    if (!sourceAttribute) {
      continue;
    }

    const definition = sourceAttribute.sourceRelationshipDefinitions?.[0];
    const isSingle = definition ? isSingleSourceRelationship(definition.cardinality) : false;
    const serializedTarget = serializeRelationshipTarget(relationshipValue.targetRecord);

    if (!relationshipGroups[sourceAttribute.key]) {
      relationshipGroups[sourceAttribute.key] = {
        isSingle,
        items: [],
      };
    }

    if (serializedTarget) {
      relationshipGroups[sourceAttribute.key].items.push(serializedTarget);
    }
  }

  for (const [attributeKey, group] of Object.entries(relationshipGroups)) {
    values[attributeKey] = group.isSingle ? group.items[0] ?? null : group.items;
  }

  return {
    id: record.id,
    orgId: record.orgId,
    objectId: record.objectId,
    objectKey: record.object?.key ?? null,
    displayName: record.displayName,
    searchText: record.searchText,
    values,
    valueMeta,
    createdById: record.createdById,
    updatedById: record.updatedById,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    archivedAt: record.archivedAt ? record.archivedAt.toISOString() : null,
  };
}