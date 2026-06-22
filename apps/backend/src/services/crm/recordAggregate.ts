/**
 * M24-3: per-column calculations (S092) — count/sum/avg/min/max/empty по filtered-set.
 * Общий движок (object Data Hub + list table-view). Read-only агрегаты поверх serialized values;
 * считается по ПОЛНОЙ выборке (после filter/search/RBAC), ДО пагинации. Никаких мутаций.
 */

import { AttributeType } from '@prisma/client';
import {
  decimalToNumber,
  getValueForAttribute,
  isEmptyValue,
  valueToDateMs,
  type AttributeLite,
  type FilterableRecord,
  type FilterableValueRow,
} from './recordFilter';

export type CalcType = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'empty';

export const CALC_TYPES: ReadonlySet<string> = new Set<CalcType>(['count', 'sum', 'avg', 'min', 'max', 'empty']);

export type CalcRequest = { attributeKey: string; type: CalcType };

export type CalcResult = {
  attributeKey: string;
  type: CalcType;
  value: number | string | null;
  count: number; // знаменатель/число НЕпустых значений колонки (для avg = делитель)
  emptyCount?: number;
  currencyCode?: string;
  mixedCurrency?: boolean;
  skippedReason?: string;
};

/** Поддерживается ли calc для типа атрибута (S092). */
export function calcSupportsType(type: CalcType, attrType: AttributeType): boolean {
  if (type === 'count' || type === 'empty') return true; // применимо к любому типу
  if (type === 'sum' || type === 'avg') return attrType === AttributeType.NUMBER || attrType === AttributeType.CURRENCY;
  if (type === 'min' || type === 'max') {
    return (
      attrType === AttributeType.NUMBER ||
      attrType === AttributeType.CURRENCY ||
      attrType === AttributeType.DATE ||
      attrType === AttributeType.DATETIME
    );
  }
  return false;
}

function rowFor(record: FilterableRecord, attribute: AttributeLite): FilterableValueRow | undefined {
  return record.values.find((v) => v.attributeId === attribute.id);
}

/** Числовое значение атрибута для агрегата (+ currencyCode для CURRENCY). null если пусто. */
function numericValue(record: FilterableRecord, attribute: AttributeLite): { num: number | null; code: string | null } {
  const row = rowFor(record, attribute);
  if (!row) return { num: null, code: null };
  if (attribute.type === AttributeType.CURRENCY) {
    return { num: decimalToNumber(row.currencyAmount), code: row.currencyCode ?? null };
  }
  return { num: decimalToNumber(row.numberValue), code: null };
}

function dateMsValue(record: FilterableRecord, attribute: AttributeLite): number | null {
  const row = rowFor(record, attribute);
  if (!row) return null;
  return valueToDateMs(row.dateValue ?? null);
}

/**
 * Вычисляет один calc по полному набору записей.
 * isEmpty/непусто — через getValueForAttribute+isEmptyValue (та же семантика, что фильтр).
 */
export function computeOneCalculation(
  records: ReadonlyArray<FilterableRecord>,
  attribute: AttributeLite,
  type: CalcType,
): CalcResult {
  const base: CalcResult = { attributeKey: attribute.key, type, value: null, count: 0 };

  if (!calcSupportsType(type, attribute.type)) {
    return { ...base, skippedReason: 'UNSUPPORTED_FOR_TYPE' };
  }

  // непустые/пустые по той же семантике, что фильтр (getValueForAttribute → isEmptyValue)
  let nonEmpty = 0;
  let empty = 0;
  for (const r of records) {
    const v = getValueForAttribute(r, attribute);
    if (isEmptyValue(v)) empty += 1;
    else nonEmpty += 1;
  }

  if (type === 'count') return { ...base, value: nonEmpty, count: nonEmpty, emptyCount: empty };
  if (type === 'empty') return { ...base, value: empty, count: nonEmpty, emptyCount: empty };

  // числовые/денежные/даты
  if (type === 'sum' || type === 'avg') {
    const codes = new Set<string>();
    let hasNullCode = false; // адверс L1: запись с amount, но без currencyCode — неизвестная валюта
    let sum = 0;
    let n = 0;
    for (const r of records) {
      const { num, code } = numericValue(r, attribute);
      if (num === null) continue;
      if (attribute.type === AttributeType.CURRENCY) { if (code) codes.add(code); else hasNullCode = true; }
      sum += num;
      n += 1;
    }
    // mixed: >1 кода ИЛИ известный код + значения без кода (не суммируем молча разные валюты)
    if (attribute.type === AttributeType.CURRENCY && (codes.size > 1 || (codes.size >= 1 && hasNullCode))) {
      return { ...base, value: null, count: n, mixedCurrency: true, skippedReason: 'MIXED_CURRENCY' };
    }
    const code = attribute.type === AttributeType.CURRENCY ? [...codes][0] : undefined;
    if (type === 'sum') return { ...base, value: n ? sum : null, count: n, ...(code ? { currencyCode: code } : {}) };
    return { ...base, value: n ? sum / n : null, count: n, ...(code ? { currencyCode: code } : {}) };
  }

  // min/max
  const isDate = attribute.type === AttributeType.DATE || attribute.type === AttributeType.DATETIME;
  if (isDate) {
    let best: number | null = null;
    let n = 0;
    for (const r of records) {
      const ms = dateMsValue(r, attribute);
      if (ms === null) continue;
      n += 1;
      if (best === null) best = ms;
      else best = type === 'min' ? Math.min(best, ms) : Math.max(best, ms);
    }
    return { ...base, value: best === null ? null : new Date(best).toISOString(), count: n };
  }

  // числовая/денежная min/max — валюты не смешиваем (вкл. null-код = неизвестная валюта)
  const codes = new Set<string>();
  let hasNullCode = false;
  let best: number | null = null;
  let n = 0;
  for (const r of records) {
    const { num, code } = numericValue(r, attribute);
    if (num === null) continue;
    if (attribute.type === AttributeType.CURRENCY) { if (code) codes.add(code); else hasNullCode = true; }
    n += 1;
    if (best === null) best = num;
    else best = type === 'min' ? Math.min(best, num) : Math.max(best, num);
  }
  if (attribute.type === AttributeType.CURRENCY && (codes.size > 1 || (codes.size >= 1 && hasNullCode))) {
    return { ...base, value: null, count: n, mixedCurrency: true, skippedReason: 'MIXED_CURRENCY' };
  }
  const code = attribute.type === AttributeType.CURRENCY ? [...codes][0] : undefined;
  return { ...base, value: best, count: n, ...(code ? { currencyCode: code } : {}) };
}

/**
 * Вычисляет набор калькуляций. lenient: неизвестный attributeKey → skippedReason, не падение.
 * attributeByKey возвращает метаданные атрибута источника.
 */
export const MAX_CALCULATIONS = 40;

export function computeCalculations(
  records: ReadonlyArray<FilterableRecord>,
  attributeByKey: (key: string) => AttributeLite | undefined,
  calcs: ReadonlyArray<CalcRequest>,
): CalcResult[] {
  const out: CalcResult[] = [];
  const seen = new Set<string>();
  // cap (анти-DoS): не более MAX_CALCULATIONS уникальных калькуляций за запрос
  for (const c of calcs.slice(0, MAX_CALCULATIONS * 2)) {
    if (out.length >= MAX_CALCULATIONS) break;
    if (!c || typeof c.attributeKey !== 'string' || !CALC_TYPES.has(c.type)) continue;
    const dedup = `${c.attributeKey}:${c.type}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    const attribute = attributeByKey(c.attributeKey);
    if (!attribute) {
      out.push({ attributeKey: c.attributeKey, type: c.type, value: null, count: 0, skippedReason: 'ATTRIBUTE_NOT_FOUND' });
      continue;
    }
    out.push(computeOneCalculation(records, attribute, c.type));
  }
  return out;
}

/** Нормализует calcs-конфиг {attributeKey: type} → стабильный список (для dirty-сигнатуры/персиста). */
export function normalizeCalcsConfig(raw: unknown): CalcRequest[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([k, v]) => typeof k === 'string' && typeof v === 'string' && CALC_TYPES.has(v as CalcType))
    .map(([attributeKey, type]) => ({ attributeKey, type: type as CalcType }))
    .sort((a, b) => (a.attributeKey === b.attributeKey ? a.type.localeCompare(b.type) : a.attributeKey.localeCompare(b.attributeKey)));
  return entries;
}
