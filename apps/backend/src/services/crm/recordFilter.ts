/**
 * Общий модуль фильтрации/сравнения CRM-записей — ЕДИНЫЙ источник семантики для:
 *  - Data Hub / GET /api/records (routes/records.ts),
 *  - движка отчётов (services/reportBuilder.ts, модуль 14 Reports & Dashboards).
 *
 * Раньше эти чистые функции жили внутри routes/records.ts. Вынесены сюда, чтобы Report Builder
 * фильтровал записи ИДЕНТИЧНО Data Hub (критерий приёмки M18-1: «Filter сужает выборку идентично
 * Data Hub, включая AI-атрибуты»). Никакой бизнес-логики маршрутов здесь нет — только predicate/compare
 * над сырыми value-строками записи (Prisma Value) и метаданными атрибута {id,key,type}.
 */

import { AttributeType } from '@prisma/client';

export type FilterOp = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'in' | 'is_empty' | 'is_not_empty';

export type RecordFilterLike = {
  attributeKey: string;
  op: FilterOp;
  value?: unknown;
};

/** Минимальные метаданные атрибута, достаточные для фильтра/группировки. */
export type AttributeLite = {
  id: string;
  key: string;
  type: AttributeType;
};

export type CompiledFilterLike = RecordFilterLike & { attribute: AttributeLite };

/** Сырая value-строка (Prisma Value) — те поля, что читает getValueForAttribute. */
export type FilterableValueRow = {
  attributeId: string;
  textValue?: string | null;
  longTextValue?: string | null;
  numberValue?: unknown; // Prisma.Decimal | null
  currencyAmount?: unknown; // Prisma.Decimal | null
  currencyCode?: string | null; // M24-3: для mixed-currency агрегатов
  booleanValue?: boolean | null;
  dateValue?: Date | null;
  userValueId?: string | null;
  jsonValue?: unknown;
};

export type FilterableRecord = { values: ReadonlyArray<FilterableValueRow> };

export function decimalToNumber(value: unknown): number | null {
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

export function valueToDateMs(value: unknown): number | null {
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

export function isObjectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

export function normalizeObjectLabel(value: Record<string, unknown>): string {
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

export function flattenToStrings(value: unknown): string[] {
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

export function isEmptyValue(value: unknown): boolean {
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

/** Достаёт «сырое» значение атрибута из value-строки записи (число/дата/текст/id) для фильтра/сортировки. */
export function getValueForAttribute(record: FilterableRecord, attribute: AttributeLite): unknown {
  const value = record.values.find((item) => item.attributeId === attribute.id);

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
      return value.dateValue ?? null;

    case AttributeType.USER:
      return value.userValueId ?? value.jsonValue ?? null;

    case AttributeType.MULTI_SELECT:
    case AttributeType.RELATIONSHIP:
    case AttributeType.JSON:
    default:
      return value.jsonValue ?? value.textValue ?? value.longTextValue ?? null;
  }
}

export function compareLooseEquals(actual: unknown, expected: unknown): boolean {
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

export function compareContains(actual: unknown, expected: unknown): boolean {
  const expectedText = flattenToStrings(expected).join(' ').trim().toLowerCase();

  if (!expectedText) {
    return true;
  }

  return flattenToStrings(actual).some((actualValue) => actualValue.toLowerCase().includes(expectedText));
}

export function compareGreaterOrLess(actual: unknown, expected: unknown, direction: 'gt' | 'lt'): boolean {
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

export function matchesFilter(record: FilterableRecord, filter: CompiledFilterLike): boolean {
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

// ───────────────────────── M24-1: AND/OR filter tree ─────────────────────────
// Канонический фильтр представления — дерево: лист (условие) | группа (AND/OR + children).
// Бэкенд-вычисление фильтра ВЕЗДЕ идёт через этот модуль (Data Hub, list-views, reports) —
// второго фильтр-движка нет. Лист переиспользует существующий matchesFilter (одна семантика).

export type FilterLeaf = { attributeKey: string; op: FilterOp; value?: unknown };
export type FilterGroupOp = 'AND' | 'OR';
export type FilterGroup = { op: FilterGroupOp; children: FilterNode[] };
export type FilterNode = FilterLeaf | FilterGroup;

export type CompiledLeaf = FilterLeaf & { attribute: AttributeLite };
export type CompiledGroup = { op: FilterGroupOp; children: CompiledNode[] };
export type CompiledNode = CompiledLeaf | CompiledGroup;

export const MAX_FILTER_TREE_DEPTH = 5;
export const MAX_FILTER_TREE_NODES = 120;

export class FilterTreeError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, code = 'INVALID_FILTER_TREE', statusCode = 422) {
    super(message);
    this.name = 'FilterTreeError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function isRawGroup(node: unknown): node is { op: unknown; children: unknown } {
  return typeof node === 'object' && node !== null && 'children' in (node as Record<string, unknown>);
}

/** Поддерживается ли оператор для типа атрибута (S084). Запрещаем заведомо бессмысленные пары. */
export function operatorSupportsType(op: FilterOp, type: AttributeType): boolean {
  if (op === 'is_empty' || op === 'is_not_empty') {
    return true; // пустота/непустота применима к любому типу
  }

  switch (type) {
    case AttributeType.TEXT:
    case AttributeType.LONG_TEXT:
    case AttributeType.EMAIL:
    case AttributeType.PHONE:
    case AttributeType.URL:
      return op === 'eq' || op === 'neq' || op === 'contains';

    case AttributeType.NUMBER:
    case AttributeType.CURRENCY:
    case AttributeType.DATE:
    case AttributeType.DATETIME:
      return op === 'eq' || op === 'neq' || op === 'gt' || op === 'lt';

    case AttributeType.SELECT:
    case AttributeType.USER:
      return op === 'eq' || op === 'neq' || op === 'in';

    case AttributeType.MULTI_SELECT:
    case AttributeType.RELATIONSHIP:
      return op === 'in'; // has-any-of (Q7: contains для multi/rel/user не вводим)

    case AttributeType.BOOLEAN:
      return op === 'eq' || op === 'neq';

    case AttributeType.JSON:
    default:
      return op === 'eq' || op === 'neq' || op === 'contains';
  }
}

const FILTER_OPS: ReadonlySet<string> = new Set<FilterOp>(['eq', 'neq', 'contains', 'gt', 'lt', 'in', 'is_empty', 'is_not_empty']);

/**
 * Компилирует сырое дерево фильтра.
 *  - strict=true (create/preview/save): неизвестный attributeKey / неподходящий op↔type / пустая группа /
 *    глубина>5 / превышение узлов → FilterTreeError (→422).
 *  - strict=false (open saved view / records-query): невалидные листья ОТСЕИВАЮТСЯ (lenient) с warning;
 *    пустые после отсева группы схлопываются; дерево всё равно применяется к остатку.
 * Возвращает компилированное дерево (листья несут attribute) или null (нет ограничений) + warnings.
 */
export function compileFilterTree(
  raw: unknown,
  attributeByKey: (key: string) => AttributeLite | undefined,
  opts: { strict: boolean },
): { tree: CompiledNode | null; warnings: string[] } {
  const warnings: string[] = [];
  let nodeCount = 0;

  function walk(node: unknown, depth: number): CompiledNode | null {
    nodeCount += 1;
    if (nodeCount > MAX_FILTER_TREE_NODES) {
      throw new FilterTreeError(`Filter has too many conditions (max ${MAX_FILTER_TREE_NODES}).`, 'INVALID_FILTER_TREE');
    }

    if (isRawGroup(node)) {
      const group = node as { op: unknown; children: unknown };
      const op = group.op === 'OR' ? 'OR' : 'AND';

      if (depth >= MAX_FILTER_TREE_DEPTH) {
        throw new FilterTreeError(`Filter groups nested deeper than ${MAX_FILTER_TREE_DEPTH} levels.`, 'INVALID_FILTER_TREE');
      }
      if (!Array.isArray(group.children)) {
        throw new FilterTreeError('Filter group must have children.', 'INVALID_FILTER_TREE');
      }

      const children: CompiledNode[] = [];
      for (const child of group.children) {
        const compiled = walk(child, depth + 1);
        if (compiled) children.push(compiled);
      }

      if (!children.length) {
        if (opts.strict) {
          throw new FilterTreeError('Filter group must contain at least one condition.', 'INVALID_FILTER_TREE');
        }
        warnings.push('Empty filter group was dropped.');
        return null;
      }

      return { op, children };
    }

    // лист-условие
    const leaf = node as { attributeKey?: unknown; op?: unknown; value?: unknown };
    if (typeof leaf.attributeKey !== 'string' || typeof leaf.op !== 'string' || !FILTER_OPS.has(leaf.op)) {
      if (opts.strict) {
        throw new FilterTreeError('Filter condition is malformed.', 'INVALID_FILTER_TREE');
      }
      warnings.push('Malformed filter condition was dropped.');
      return null;
    }

    const op = leaf.op as FilterOp;
    const attribute = attributeByKey(leaf.attributeKey);
    if (!attribute) {
      if (opts.strict) {
        throw new FilterTreeError(`Filter attribute "${leaf.attributeKey}" was not found.`, 'FILTER_ATTRIBUTE_NOT_FOUND');
      }
      warnings.push(`Filter on "${leaf.attributeKey}" was skipped — attribute no longer exists.`);
      return null;
    }

    if (!operatorSupportsType(op, attribute.type)) {
      if (opts.strict) {
        throw new FilterTreeError(`Operator "${op}" is not supported for attribute "${leaf.attributeKey}".`, 'UNSUPPORTED_OPERATOR_FOR_TYPE');
      }
      warnings.push(`Filter on "${leaf.attributeKey}" was skipped — operator no longer valid.`);
      return null;
    }

    return { attributeKey: leaf.attributeKey, op, value: leaf.value, attribute };
  }

  if (raw === null || raw === undefined) {
    return { tree: null, warnings };
  }

  const compiled = walk(raw, 0);
  return { tree: compiled, warnings };
}

function isCompiledGroup(node: CompiledNode): node is CompiledGroup {
  return (node as CompiledGroup).children !== undefined;
}

/** Вычисляет компилированное дерево на записи. AND=every, OR=some; лист → matchesFilter (тот же движок). */
export function matchesCompiledTree(record: FilterableRecord, node: CompiledNode): boolean {
  if (isCompiledGroup(node)) {
    if (!node.children.length) {
      return node.op === 'AND'; // вакуумная истина для AND
    }
    return node.op === 'AND'
      ? node.children.every((child) => matchesCompiledTree(record, child))
      : node.children.some((child) => matchesCompiledTree(record, child));
  }
  return matchesFilter(record, node);
}

/** Строит плоское AND-дерево из legacy-фильтров (миграция-на-чтение, когда filterTree=NULL). */
export function flatFiltersToTree(filters: ReadonlyArray<FilterLeaf>): FilterGroup | null {
  if (!filters.length) {
    return null;
  }
  return { op: 'AND', children: filters.map((f) => ({ attributeKey: f.attributeKey, op: f.op, value: f.value })) };
}

/**
 * Derived плоская AND-проекция верхнего уровня дерева (для back-compat ViewFilter[]).
 * Для OR/вложенных деревьев проекция лоссовая (берём листья верхнего AND либо все листья) —
 * filterTree остаётся источником истины, ViewFilter[] лишь индикативен.
 */
export function treeToFlatLeaves(node: FilterNode | null): Array<{ leaf: FilterLeaf; group: number }> {
  if (!node) return [];
  const out: Array<{ leaf: FilterLeaf; group: number }> = [];
  // МОНОТОННЫЙ счётчик групп: каждая ветвь любого OR → свой уникальный номер (без коллизий между
  // независимыми OR-блоками в смешанном дереве). Проекция всё равно лоссовая для глубокой вложенности —
  // источник истины это filterTree; group здесь лишь индикативен для back-compat ViewFilter[].
  let nextGroup = 1;

  function collect(n: FilterNode, group: number): void {
    if (isRawGroup(n)) {
      const g = n as FilterGroup;
      if (g.op === 'OR') {
        g.children.forEach((child) => collect(child, nextGroup++));
      } else {
        g.children.forEach((child) => collect(child, group));
      }
    } else {
      out.push({ leaf: n as FilterLeaf, group });
    }
  }

  collect(node, 0);
  return out;
}

export type CompiledSortLike = { attribute: AttributeLite; dir: 'asc' | 'desc' };

/**
 * Общая сортировка записей (тот же движок для Data Hub и list-views): пустые ВСЕГДА вниз
 * независимо от направления (баг C3), затем сравнение compareRecordValues, затем tie-break.
 */
export function sortFilterableRecords<T extends FilterableRecord>(records: T[], sorts: CompiledSortLike[], tieBreak: (a: T, b: T) => number): T[] {
  return [...records].sort((left, right) => {
    for (const sort of sorts) {
      const leftValue = getValueForAttribute(left, sort.attribute);
      const rightValue = getValueForAttribute(right, sort.attribute);
      const leftEmpty = isEmptyValue(leftValue);
      const rightEmpty = isEmptyValue(rightValue);
      if (leftEmpty || rightEmpty) {
        if (leftEmpty && rightEmpty) continue;
        return leftEmpty ? 1 : -1;
      }
      const comparison = compareRecordValues(leftValue, rightValue);
      if (comparison !== 0) {
        return sort.dir === 'desc' ? -comparison : comparison;
      }
    }
    return tieBreak(left, right);
  });
}

export function compareRecordValues(left: unknown, right: unknown): number {
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
