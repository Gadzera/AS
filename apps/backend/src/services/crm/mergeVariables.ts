/**
 * M28-2 — Merge-переменные (правка GPT #3): переменные НЕ «магические».
 *
 * Контракт «available variables for record» отдаёт ИМЕННО тот набор токенов, который backend
 * умеет резолвить стабильно. UI показывает только их; произвольные deep-path не принимаются.
 *
 * Область (честная и стабильная, без второго движка — поверх существующих Value/serialize):
 *  • record.<attrKey> — скалярные атрибуты самой записи (НЕ relationship/json), сэмпл = отображаемое значение;
 *  • record.name      — displayName записи;
 *  • recipient.email / recipient.name — резолвятся из выбранного получателя на этапе preview/send.
 *
 * Резолвер {{token}}:
 *  • unresolved — токен, которого НЕТ в контракте (backend не умеет резолвить) → блок отправки (422);
 *  • empty      — токен известен, но значение пустое → не молчим, показываем в preview (предупреждение).
 */
import { AttributeType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type MergeVariable = {
  token: string;        // напр. 'record.value' | 'recipient.email'
  label: string;        // человекочитаемое имя
  group: 'record' | 'recipient';
  sample: string | null; // пример значения (для record.* — текущее; для recipient.* — null до выбора)
};

// Скалярные типы, которые умеем подставлять строкой. RELATIONSHIP/JSON исключены намеренно.
const SCALAR_TYPES = new Set<AttributeType>([
  AttributeType.TEXT, AttributeType.LONG_TEXT, AttributeType.NUMBER, AttributeType.BOOLEAN,
  AttributeType.DATE, AttributeType.DATETIME, AttributeType.SELECT, AttributeType.MULTI_SELECT,
  AttributeType.CURRENCY, AttributeType.EMAIL, AttributeType.PHONE, AttributeType.URL, AttributeType.USER,
]);

type ValueRow = {
  attributeId: string;
  textValue: string | null;
  longTextValue: string | null;
  numberValue: unknown;
  booleanValue: boolean | null;
  dateValue: Date | null;
  jsonValue: unknown;
  userValueId: string | null;
  currencyAmount: unknown;
  currencyCode: string | null;
  userValue?: { name: string | null; email: string } | null;
  attribute: { type: AttributeType; options?: { value: string; label: string }[] };
};

// Превращает Value в стабильную строку-подстановку (или null, если пусто).
function valueToMergeString(v: ValueRow): string | null {
  const t = v.attribute.type;
  switch (t) {
    case AttributeType.TEXT:
    case AttributeType.EMAIL:
    case AttributeType.PHONE:
    case AttributeType.URL:
      return v.textValue && v.textValue.trim() ? v.textValue.trim() : null;
    case AttributeType.LONG_TEXT:
      return v.longTextValue && v.longTextValue.trim() ? v.longTextValue.trim() : null;
    case AttributeType.NUMBER:
      return v.numberValue != null ? String(v.numberValue) : null;
    case AttributeType.BOOLEAN:
      return v.booleanValue == null ? null : v.booleanValue ? 'Yes' : 'No';
    case AttributeType.DATE:
      return v.dateValue ? v.dateValue.toISOString().slice(0, 10) : null;
    case AttributeType.DATETIME:
      return v.dateValue ? v.dateValue.toISOString() : null;
    case AttributeType.SELECT: {
      if (!v.textValue) return null;
      const opt = v.attribute.options?.find((o) => o.value === v.textValue);
      return opt ? opt.label : v.textValue;
    }
    case AttributeType.MULTI_SELECT: {
      const arr = Array.isArray(v.jsonValue) ? (v.jsonValue as string[]) : [];
      if (arr.length === 0) return null;
      const labels = arr.map((raw) => v.attribute.options?.find((o) => o.value === raw)?.label ?? raw);
      return labels.join(', ');
    }
    case AttributeType.CURRENCY: {
      if (v.currencyAmount == null) return null;
      const code = v.currencyCode ?? 'USD';
      const num = Number(String(v.currencyAmount));
      if (!Number.isFinite(num)) return `${String(v.currencyAmount)} ${code}`;
      try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(num); }
      catch { return `${num} ${code}`; }
    }
    case AttributeType.USER:
      return v.userValue ? v.userValue.name ?? v.userValue.email : null;
    default:
      return null;
  }
}

const RECIPIENT_VARS: MergeVariable[] = [
  { token: 'recipient.email', label: 'Recipient email', group: 'recipient', sample: null },
  { token: 'recipient.name', label: 'Recipient name', group: 'recipient', sample: null },
];

/**
 * Список доступных переменных для записи (контракт «available variables»).
 *
 * Контракт строится по СХЕМЕ объекта (все скалярные атрибуты), а не по наличию значения у записи —
 * иначе пустой атрибут стал бы «неизвестным» токеном. Сэмпл = текущее значение записи (или null).
 * Это разводит «empty» (известный, но пустой) и «unresolved» (несуществующий) на этапе резолва.
 */
export async function listRecordVariables(orgId: string, recordId: string): Promise<MergeVariable[]> {
  const record = await prisma.record.findFirst({
    where: { id: recordId, orgId, archivedAt: null },
    select: { id: true, displayName: true, objectId: true },
  });
  if (!record) return [];

  // схема: скалярные атрибуты объекта (стабильный набор токенов)
  const attributes = await prisma.attribute.findMany({
    where: { orgId, objectId: record.objectId, isArchived: false, archivedAt: null },
    orderBy: { order: 'asc' },
    select: { id: true, key: true, name: true, type: true, options: { where: { isArchived: false }, select: { value: true, label: true } } },
  });
  const scalar = attributes.filter((a) => SCALAR_TYPES.has(a.type));

  // значения записи по этим атрибутам (left-join: нет значения → null)
  const values = await prisma.value.findMany({
    where: { orgId, recordId, attributeId: { in: scalar.map((a) => a.id) } },
    select: {
      attributeId: true, textValue: true, longTextValue: true, numberValue: true, booleanValue: true,
      dateValue: true, jsonValue: true, userValueId: true, currencyAmount: true, currencyCode: true,
      userValue: { select: { name: true, email: true } },
    },
  });
  const valueByAttr = new Map(values.map((v) => [v.attributeId, v]));

  const seen = new Set<string>();
  const vars: MergeVariable[] = [];
  // record.name всегда доступен и резолвится в displayName записи (UI-плейсхолдеры предлагают именно его).
  // Добавляем ПЕРВЫМ в seen → одноимённый атрибут (key='name') не продублирует токен ниже.
  vars.push({ token: 'record.name', label: 'Record name', group: 'record', sample: record.displayName ?? null });
  seen.add('record.name');

  for (const attr of scalar) {
    const token = `record.${attr.key}`;
    if (seen.has(token)) continue; // дедуп токенов
    seen.add(token);
    const v = valueByAttr.get(attr.id);
    const sample = v ? valueToMergeString({ ...v, attribute: { type: attr.type, options: attr.options } } as unknown as ValueRow) : null;
    vars.push({ token, label: attr.name, group: 'record', sample });
  }

  return [...vars, ...RECIPIENT_VARS];
}

export type MergeContext = {
  recordValues: Map<string, string | null>; // 'record.<key>' / 'record.name' → значение
  recipient: { email: string; name: string | null };
};

export type MergeResult = { output: string; unresolved: string[]; empty: string[] };

const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Строит контекст резолва из доступных переменных записи + выбранного получателя.
 */
export async function buildMergeContext(
  orgId: string,
  recordId: string,
  recipient: { email: string; name: string | null }
): Promise<MergeContext> {
  const vars = await listRecordVariables(orgId, recordId);
  const recordValues = new Map<string, string | null>();
  for (const v of vars) if (v.group === 'record') recordValues.set(v.token, v.sample);
  return { recordValues, recipient };
}

// Резолв одного токена: undefined = неизвестен (unresolved); '' / null = пусто (empty).
function resolveToken(token: string, ctx: MergeContext): string | null | undefined {
  if (token === 'recipient.email') return ctx.recipient.email || null;
  if (token === 'recipient.name') return ctx.recipient.name || null;
  if (ctx.recordValues.has(token)) return ctx.recordValues.get(token) ?? null;
  return undefined; // неизвестный токен
}

/**
 * Резолвит {{merge}} в строке. unresolved = неизвестные токены (блок отправки),
 * empty = известные, но пустые (предупреждение). Неизвестные оставляем в тексте как есть (видно в preview).
 */
export function resolveMerge(template: string, ctx: MergeContext): MergeResult {
  const unresolved = new Set<string>();
  const empty = new Set<string>();
  const output = (template ?? '').replace(TOKEN_RE, (whole, token: string) => {
    const val = resolveToken(token, ctx);
    if (val === undefined) { unresolved.add(token); return whole; } // неизвестный — оставляем литералом
    if (val === null || val === '') { empty.add(token); return ''; }   // пустой — подставляем пусто, но отмечаем
    return val;
  });
  return { output, unresolved: Array.from(unresolved), empty: Array.from(empty) };
}
