// M30 — list-specific атрибуты (process lists): коэрция и сериализация значений ListEntryValue.
// Самодостаточно (не завязано на тяжёлый object-Value слой). Типы — подмножество AttributeType,
// БЕЗ RELATIONSHIP/JSON (вне scope M30, утв. GPT). Хранение — те же typed-колонки, что у Value.
import { Prisma, AttributeType } from '@prisma/client';

// Типы list-атрибутов, разрешённые в M30 (RELATIONSHIP/JSON исключены).
export const LIST_ATTR_TYPES: AttributeType[] = [
  AttributeType.TEXT,
  AttributeType.LONG_TEXT,
  AttributeType.NUMBER,
  AttributeType.CURRENCY,
  AttributeType.SELECT,
  AttributeType.MULTI_SELECT,
  AttributeType.DATE,
  AttributeType.DATETIME,
  AttributeType.BOOLEAN,
  AttributeType.USER,
  AttributeType.EMAIL,
  AttributeType.PHONE,
  AttributeType.URL,
];
const LIST_ATTR_TYPE_SET = new Set<AttributeType>(LIST_ATTR_TYPES);
export function isAllowedListAttrType(type: AttributeType): boolean {
  return LIST_ATTR_TYPE_SET.has(type);
}

export interface ListAttrOption {
  value: string;
  label: string;
  color?: string | null;
  order?: number;
}

// Опции SELECT/MULTI_SELECT хранятся в config.options (без отдельной таблицы).
export function readListAttrOptions(config: unknown): ListAttrOption[] {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return [];
  const raw = (config as { options?: unknown }).options;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o, i) => {
      if (!o || typeof o !== 'object') return null;
      const obj = o as Record<string, unknown>;
      const value = String(obj.value ?? obj.key ?? '').trim();
      if (!value) return null;
      return {
        value,
        label: String(obj.label ?? obj.name ?? value),
        color: typeof obj.color === 'string' ? obj.color : null,
        order: typeof obj.order === 'number' ? obj.order : i,
      } as ListAttrOption;
    })
    .filter((o): o is ListAttrOption => o !== null)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// Ошибка коэрции — превращается роутом в 400/422.
export class ListValueError extends Error {
  code: string;
  constructor(message: string, code = 'INVALID_LIST_VALUE') {
    super(message);
    this.code = code;
  }
}

// Полный набор typed-колонок ListEntryValue (неиспользуемые — null). jsonValue: массив (MULTI_SELECT) или null.
export interface ListValueStorage {
  textValue: string | null;
  longTextValue: string | null;
  numberValue: Prisma.Decimal | null;
  booleanValue: boolean | null;
  dateValue: Date | null;
  jsonValue: unknown[] | null;
  userValueId: string | null;
  currencyAmount: Prisma.Decimal | null;
  currencyCode: string | null;
}
function emptyStorage(): ListValueStorage {
  return {
    textValue: null, longTextValue: null, numberValue: null, booleanValue: null, dateValue: null,
    jsonValue: null, userValueId: null, currencyAmount: null, currencyCode: null,
  };
}

function isClear(raw: unknown): boolean {
  return raw === null || raw === undefined || raw === '' || (Array.isArray(raw) && raw.length === 0);
}

// Коэрция сырого ввода под тип list-атрибута. clear=true → значение нужно удалить.
// userValidator — опциональная проверка, что userId принадлежит орг (для USER-типа).
export interface CoerceResult { clear: boolean; storage: ListValueStorage }
export function coerceListEntryValue(
  type: AttributeType,
  raw: unknown,
  options: ListAttrOption[] = [],
  userValidator?: (userId: string) => boolean,
): CoerceResult {
  if (!isAllowedListAttrType(type)) throw new ListValueError(`Type ${type} is not allowed for list attributes`, 'LIST_ATTR_TYPE_NOT_ALLOWED');
  if (isClear(raw)) return { clear: true, storage: emptyStorage() };
  const s = emptyStorage();
  const optValues = new Set(options.map((o) => o.value));

  switch (type) {
    case AttributeType.TEXT:
    case AttributeType.EMAIL:
    case AttributeType.PHONE:
    case AttributeType.URL: {
      s.textValue = String(raw).trim();
      if (!s.textValue) return { clear: true, storage: emptyStorage() };
      if (type === AttributeType.EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.textValue)) throw new ListValueError('Invalid email');
      break;
    }
    case AttributeType.LONG_TEXT: {
      s.longTextValue = String(raw);
      if (!s.longTextValue.trim()) return { clear: true, storage: emptyStorage() };
      break;
    }
    case AttributeType.NUMBER: {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new ListValueError('Invalid number');
      s.numberValue = new Prisma.Decimal(n);
      break;
    }
    case AttributeType.CURRENCY: {
      // {amount, currencyCode} или просто число.
      let amount: number;
      let code = 'USD';
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const o = raw as Record<string, unknown>;
        amount = Number(o.amount);
        if (typeof o.currencyCode === 'string' && o.currencyCode.trim()) code = o.currencyCode.trim().toUpperCase();
      } else {
        amount = Number(raw);
      }
      if (!Number.isFinite(amount)) throw new ListValueError('Invalid currency amount');
      s.currencyAmount = new Prisma.Decimal(amount);
      s.currencyCode = code;
      break;
    }
    case AttributeType.BOOLEAN: {
      s.booleanValue = raw === true || raw === 'true' || raw === 1 || raw === '1';
      break;
    }
    case AttributeType.DATE:
    case AttributeType.DATETIME: {
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) throw new ListValueError('Invalid date');
      s.dateValue = d;
      break;
    }
    case AttributeType.SELECT: {
      const token = String(raw).trim();
      if (!token) return { clear: true, storage: emptyStorage() };
      if (optValues.size && !optValues.has(token)) throw new ListValueError(`Unknown option "${token}"`, 'INVALID_OPTION');
      s.textValue = token;
      break;
    }
    case AttributeType.MULTI_SELECT: {
      const arr = (Array.isArray(raw) ? raw : [raw]).map((x) => String(x).trim()).filter(Boolean);
      if (!arr.length) return { clear: true, storage: emptyStorage() };
      if (optValues.size) {
        for (const t of arr) if (!optValues.has(t)) throw new ListValueError(`Unknown option "${t}"`, 'INVALID_OPTION');
      }
      s.jsonValue = Array.from(new Set(arr));
      break;
    }
    case AttributeType.USER: {
      const uid = String(raw).trim();
      if (!uid) return { clear: true, storage: emptyStorage() };
      if (userValidator && !userValidator(uid)) throw new ListValueError('User is not a member of this workspace', 'INVALID_USER');
      s.userValueId = uid;
      break;
    }
    default:
      throw new ListValueError(`Unsupported type ${type}`, 'LIST_ATTR_TYPE_NOT_ALLOWED');
  }
  return { clear: false, storage: s };
}

// Строка ListEntryValue из БД для сериализации (typed-колонки + опц. userValue).
export interface ListEntryValueRow {
  textValue: string | null;
  longTextValue: string | null;
  numberValue: Prisma.Decimal | null;
  booleanValue: boolean | null;
  dateValue: Date | null;
  jsonValue: unknown;
  userValueId: string | null;
  userValue?: { id: string; email: string; name: string | null } | null;
  currencyAmount: Prisma.Decimal | null;
  currencyCode: string | null;
}

function decToJson(v: Prisma.Decimal | null): number | string | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : v.toString();
}

// Сериализация значения list-атрибута в JS (совместима по форме с object-values, SELECT резолвит опцию).
export function serializeListEntryValue(type: AttributeType, row: ListEntryValueRow, options: ListAttrOption[] = []): unknown {
  switch (type) {
    case AttributeType.TEXT:
    case AttributeType.EMAIL:
    case AttributeType.PHONE:
    case AttributeType.URL:
      return row.textValue;
    case AttributeType.SELECT: {
      const opt = options.find((o) => o.value === row.textValue);
      return opt ? { value: opt.value, label: opt.label, color: opt.color ?? null } : row.textValue;
    }
    case AttributeType.LONG_TEXT:
      return row.longTextValue;
    case AttributeType.NUMBER:
      return decToJson(row.numberValue);
    case AttributeType.BOOLEAN:
      return row.booleanValue;
    case AttributeType.DATE:
    case AttributeType.DATETIME:
      return row.dateValue ? row.dateValue.toISOString() : null;
    case AttributeType.MULTI_SELECT: {
      const arr = Array.isArray(row.jsonValue) ? row.jsonValue.map((x) => String(x)) : [];
      return arr.map((t) => {
        const opt = options.find((o) => o.value === t);
        return opt ? { value: opt.value, label: opt.label, color: opt.color ?? null } : t;
      });
    }
    case AttributeType.CURRENCY:
      return { amount: decToJson(row.currencyAmount), currencyCode: row.currencyCode };
    case AttributeType.USER:
      return row.userValue ? { id: row.userValue.id, email: row.userValue.email, name: row.userValue.name } : row.userValueId;
    default:
      return null;
  }
}

// true, если storage представляет «пустое» значение (для no-op/clear проверок).
export function isEmptyStorage(s: ListValueStorage): boolean {
  return s.textValue === null && s.longTextValue === null && s.numberValue === null && s.booleanValue === null &&
    s.dateValue === null && s.jsonValue === null && s.userValueId === null &&
    s.currencyAmount === null && s.currencyCode === null;
}

// Сравнение storage с существующей строкой ListEntryValue — для no-op detection (не пишем при отсутствии изменения).
export function storageMatchesRow(s: ListValueStorage, row: ListEntryValueRow): boolean {
  const dec = (a: Prisma.Decimal | null, b: Prisma.Decimal | null): boolean => {
    if (a === null || b === null) return a === b;
    return new Prisma.Decimal(a).equals(b);
  };
  const arr = (a: unknown): string => JSON.stringify(Array.isArray(a) ? a.map((x) => String(x)) : null);
  return (row.textValue ?? null) === s.textValue
    && (row.longTextValue ?? null) === s.longTextValue
    && dec(row.numberValue ?? null, s.numberValue)
    && (row.booleanValue ?? null) === s.booleanValue
    && ((row.dateValue ? row.dateValue.getTime() : null) === (s.dateValue ? s.dateValue.getTime() : null))
    && arr(row.jsonValue) === arr(s.jsonValue)
    && (row.userValueId ?? null) === s.userValueId
    && dec(row.currencyAmount ?? null, s.currencyAmount)
    && (row.currencyCode ?? null) === s.currencyCode;
}
