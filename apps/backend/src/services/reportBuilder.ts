/**
 * Report Builder — движок конфигурируемых отчётов над CRM-объектами/списками (модуль 14, M18-1).
 *
 * Считает результат отчёта (INSIGHT / FUNNEL) на ЖИВЫХ записях: загружает источник (object|list),
 * фильтрует ИДЕНТИЧНО Data Hub (общий matchesFilter из crm/recordFilter), группирует по атрибуту
 * (с учётом типа: select→label/order, user→имя, bool→Yes/No, date→день, multi-select→explode),
 * считает метрику (count / sum / avg по number|currency) и сегментирует на серии. FUNNEL — стадии
 * по упорядоченному status-атрибуту с conversion-формулой. Drill отдаёт реальные записи бакета.
 *
 * Строгая валидация на create/preview; на ОТКРЫТИИ существующего отчёта (archived/missing атрибут)
 * — warning, не краш. HISTORICAL/TIME_IN_STAGE/STAGE_CHANGE в M18-1 не поддержаны (оживают в M18-2).
 */

import { createHash } from 'crypto';
import { AttributeType, Prisma, PrismaClient, ReportSourceType, ReportType, ReportVisualization } from '@prisma/client';
import {
  type AttributeLite,
  type CompiledFilterLike,
  type FilterableRecord,
  type RecordFilterLike,
  matchesFilter,
} from './crm/recordFilter';
import { decimalToNumber } from './crm/recordFilter';
import { recordSerializationInclude } from './crm/values';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

// configHash фиксирует «что считаем»: источник, метрика, группировка, сегмент, фильтры, тип.
// НЕ включает name/visualization. Снапшоты с разным configHash не смешиваются в одной historical-линии.
export function configHash(cfg: ReportConfigInput): string {
  const norm = {
    type: cfg.type,
    sourceType: cfg.sourceType,
    sourceObjectId: cfg.sourceObjectId ?? null,
    sourceListId: cfg.sourceListId ?? null,
    metric: cfg.metric,
    groupByAttributeId: cfg.groupByAttributeId ?? null,
    segmentByAttributeId: cfg.segmentByAttributeId ?? null,
    filters: cfg.filters ?? [],
  };
  return createHash('sha1').update(JSON.stringify(norm)).digest('hex');
}

// ── Типы конфигурации отчёта ───────────────────────────────────────────────────
export type MetricSpec = { kind: 'count' } | { kind: 'sum' | 'avg'; attributeId: string };

export type ReportConfigInput = {
  type: ReportType;
  sourceType: ReportSourceType;
  sourceObjectId?: string | null;
  sourceListId?: string | null;
  metric: MetricSpec;
  groupByAttributeId?: string | null;
  segmentByAttributeId?: string | null;
  filters: RecordFilterLike[];
  visualization: ReportVisualization;
  config?: { stageOrder?: string[]; dateRange?: { from?: string; to?: string } } | null;
};

export class ReportValidationError extends Error {
  statusCode = 400;
  code: string;
  field?: string;
  constructor(code: string, message: string, field?: string) {
    super(message);
    this.name = 'ReportValidationError';
    this.code = code;
    this.field = field;
  }
}

// Типы, требующие упорядоченный status/select-атрибут как группировку (стадию).
const STAGE_TYPES: ReportType[] = [ReportType.FUNNEL, ReportType.TIME_IN_STAGE, ReportType.STAGE_CHANGE];
// Группировать/сегментировать можно по всему, кроме relationship/json (нет плоского значения для бакета).
const GROUPABLE = new Set<AttributeType>([
  AttributeType.SELECT, AttributeType.MULTI_SELECT, AttributeType.USER, AttributeType.BOOLEAN,
  AttributeType.DATE, AttributeType.DATETIME, AttributeType.NUMBER, AttributeType.CURRENCY,
  AttributeType.TEXT, AttributeType.EMAIL, AttributeType.PHONE, AttributeType.URL, AttributeType.LONG_TEXT,
]);
const NUMERIC_METRIC_TYPES = new Set<AttributeType>([AttributeType.NUMBER, AttributeType.CURRENCY]);

// Сентинелы бакетов с управляющим символом  — не может встретиться в сохранённом текстовом
// значении атрибута, поэтому не коллизирует с реальным значением «__empty__»/«__all__» (адверс-ревью M4).
const EMPTY_KEY = '__aisdr_empty__';
const EMPTY_LABEL = '—';
const ALL_KEY = '__aisdr_all__';
// Потолок числа бакетов для high-cardinality группировок (TEXT/USER/NUMBER/...). SELECT/BOOLEAN —
// перечислимые, ограничены опциями, не режутся. Превышение → честный warning (no silent caps).
const MAX_BUCKETS = 50;

type AttrOption = { id: string; value: string; label: string; order: number };
type AttrFull = { id: string; key: string; name: string; type: AttributeType; isArchived: boolean; options: AttrOption[] };

type LoadedSource = {
  objectId: string;
  objectKey: string;
  attributesById: Map<string, AttrFull>;
  attributesByKey: Map<string, AttrFull>;
  liveAttributeIds: Set<string>;
  records: SourceRecord[];
};

type SourceRecord = Prisma.RecordGetPayload<{ include: typeof recordSerializationInclude }>;

// ── Результат отчёта (общий для preview / open / saved) ─────────────────────────
// value: number | null — null означает «нет данных» (например avg по бакету, где НИ ОДНА запись
// не имеет значения метрики). Для count/sum пустое = 0; для avg пустое = null (адверс-ревью M1).
export type ReportSegment = { key: string; label: string; value: number | null };
export type ReportBucket = {
  key: string;
  label: string;
  value: number | null;
  records: number; // сколько записей в бакете (== value для count; для sum/avg — вклад)
  segments?: ReportSegment[];
  conversionFromFirst?: number | null; // funnel
  conversionFromPrevious?: number | null; // funnel
};
export type HistoryPoint = { snapshotAt: string; buckets: { key: string; label: string; value: number | null }[] };
export type ReportResult = {
  type: ReportType;
  visualization: ReportVisualization;
  metricLabel: string;
  metricKind: 'count' | 'sum' | 'avg';
  currencyCode: string | null;
  metricUnit?: string | null; // напр. 'days' для time-in-stage
  groupByLabel: string | null;
  segmentByLabel: string | null;
  buckets: ReportBucket[];
  segmentKeys: ReportSegment[]; // distinct сегменты (легенда/колонки таблицы)
  history?: HistoryPoint[]; // historical: серия снапшотов во времени
  totalRecords: number;
  warnings: string[];
};

// ── Загрузка источника ──────────────────────────────────────────────────────────
async function loadAttributes(objectId: string): Promise<{ byId: Map<string, AttrFull>; byKey: Map<string, AttrFull>; liveIds: Set<string> }> {
  const attrs = await prisma.attribute.findMany({
    where: { objectId },
    select: {
      id: true, key: true, name: true, type: true, isArchived: true,
      options: { where: { isArchived: false }, orderBy: { order: 'asc' }, select: { id: true, value: true, label: true, order: true } },
    },
    orderBy: { order: 'asc' },
  });
  const byId = new Map<string, AttrFull>();
  const byKey = new Map<string, AttrFull>();
  const liveIds = new Set<string>();
  for (const a of attrs) {
    const full: AttrFull = { id: a.id, key: a.key, name: a.name, type: a.type, isArchived: a.isArchived, options: a.options };
    byId.set(a.id, full);
    byKey.set(a.key, full);
    if (!a.isArchived) liveIds.add(a.id);
  }
  return { byId, byKey, liveIds };
}

export async function loadSource(orgId: string, cfg: { sourceType: ReportSourceType; sourceObjectId?: string | null; sourceListId?: string | null }): Promise<LoadedSource> {
  if (cfg.sourceType === ReportSourceType.OBJECT) {
    if (!cfg.sourceObjectId) throw new ReportValidationError('REPORT_SOURCE_REQUIRED', 'Report needs a data source', 'sourceObjectId');
    const obj = await prisma.object.findFirst({ where: { id: cfg.sourceObjectId, orgId, archivedAt: null }, select: { id: true, key: true } });
    if (!obj) throw new ReportValidationError('REPORT_SOURCE_NOT_FOUND', 'Source object not found', 'sourceObjectId');
    const { byId, byKey, liveIds } = await loadAttributes(obj.id);
    const records = await prisma.record.findMany({ where: { orgId, objectId: obj.id, archivedAt: null }, include: recordSerializationInclude });
    return { objectId: obj.id, objectKey: obj.key, attributesById: byId, attributesByKey: byKey, liveAttributeIds: liveIds, records };
  }
  // LIST
  if (!cfg.sourceListId) throw new ReportValidationError('REPORT_SOURCE_REQUIRED', 'Report needs a data source', 'sourceListId');
  const list = await prisma.list.findFirst({ where: { id: cfg.sourceListId, orgId, archivedAt: null }, select: { id: true, primaryObjectId: true, primaryObject: { select: { key: true } } } });
  if (!list) throw new ReportValidationError('REPORT_SOURCE_NOT_FOUND', 'Source list not found', 'sourceListId');
  const { byId, byKey, liveIds } = await loadAttributes(list.primaryObjectId);
  const entries = await prisma.listEntry.findMany({ where: { listId: list.id, archivedAt: null }, include: { record: { include: recordSerializationInclude } } });
  const records = entries.map((e) => e.record).filter((r): r is SourceRecord => !!r && r.archivedAt === null);
  return { objectId: list.primaryObjectId, objectKey: list.primaryObject?.key ?? '', attributesById: byId, attributesByKey: byKey, liveAttributeIds: liveIds, records };
}

// ── Резолв бакета(ов) записи по group/segment-атрибуту (с учётом типа) ──────────
type Bucket = { key: string; label: string; order: number };
const EMPTY_BUCKET: Bucket = { key: EMPTY_KEY, label: EMPTY_LABEL, order: Number.MAX_SAFE_INTEGER };

function findOption(attr: AttrFull, token: string): AttrOption | undefined {
  return attr.options.find((o) => o.value === token || o.id === token);
}

function bucketsForRecord(record: SourceRecord, attr: AttrFull): Bucket[] {
  const row = record.values.find((v) => v.attributeId === attr.id);
  if (!row) return [EMPTY_BUCKET];

  switch (attr.type) {
    case AttributeType.SELECT: {
      const token = row.textValue ?? null;
      if (token === null || token === '') return [EMPTY_BUCKET];
      const opt = findOption(attr, token);
      return [opt ? { key: opt.value, label: opt.label, order: opt.order } : { key: token, label: token, order: Number.MAX_SAFE_INTEGER - 1 }];
    }
    case AttributeType.MULTI_SELECT: {
      const tokens = Array.isArray(row.jsonValue) ? row.jsonValue.map((t) => String(t)) : [];
      if (!tokens.length) return [EMPTY_BUCKET];
      return tokens.map((t) => {
        const opt = findOption(attr, t);
        return opt ? { key: opt.value, label: opt.label, order: opt.order } : { key: t, label: t, order: Number.MAX_SAFE_INTEGER - 1 };
      });
    }
    case AttributeType.USER: {
      const id = row.userValueId ?? null;
      if (!id) return [EMPTY_BUCKET];
      const label = row.userValue?.name || row.userValue?.email || id;
      return [{ key: id, label, order: 0 }];
    }
    case AttributeType.BOOLEAN: {
      if (row.booleanValue === null || row.booleanValue === undefined) return [EMPTY_BUCKET];
      return [row.booleanValue ? { key: 'true', label: 'Yes', order: 0 } : { key: 'false', label: 'No', order: 1 }];
    }
    case AttributeType.DATE:
    case AttributeType.DATETIME: {
      if (!row.dateValue) return [EMPTY_BUCKET];
      const day = row.dateValue.toISOString().slice(0, 10);
      return [{ key: day, label: day, order: 0 }];
    }
    case AttributeType.NUMBER: {
      const n = decimalToNumber(row.numberValue);
      if (n === null) return [EMPTY_BUCKET];
      return [{ key: String(n), label: String(n), order: n }];
    }
    case AttributeType.CURRENCY: {
      const n = decimalToNumber(row.currencyAmount);
      if (n === null) return [EMPTY_BUCKET];
      return [{ key: String(n), label: String(n), order: n }];
    }
    case AttributeType.TEXT:
    case AttributeType.EMAIL:
    case AttributeType.PHONE:
    case AttributeType.URL:
    case AttributeType.LONG_TEXT: {
      const t = (row.textValue ?? row.longTextValue ?? '').trim();
      if (!t) return [EMPTY_BUCKET];
      return [{ key: t, label: t, order: Number.MAX_SAFE_INTEGER - 1 }];
    }
    default:
      return [EMPTY_BUCKET];
  }
}

// Числовое значение метрики для записи (sum/avg). null → запись не вносит вклад.
function recordMetricValue(record: SourceRecord, metricAttr: AttrFull | null): number | null {
  if (!metricAttr) return null;
  const row = record.values.find((v) => v.attributeId === metricAttr.id);
  if (!row) return null;
  if (metricAttr.type === AttributeType.CURRENCY) return decimalToNumber(row.currencyAmount);
  if (metricAttr.type === AttributeType.NUMBER) return decimalToNumber(row.numberValue);
  return null;
}

// Возвращает единый код валюты метрики ИЛИ помечает mixed=true, если в выборке >1 валюты
// (тогда суммировать разнородные суммы нельзя без конвертации — честный warning, без валютного лейбла).
function currencyCodeFor(records: SourceRecord[], metricAttr: AttrFull | null): { code: string | null; mixed: boolean } {
  if (!metricAttr || metricAttr.type !== AttributeType.CURRENCY) return { code: null, mixed: false };
  const codes = new Set<string>();
  for (const r of records) {
    const row = r.values.find((v) => v.attributeId === metricAttr.id);
    if (row?.currencyCode && row.currencyAmount !== null && row.currencyAmount !== undefined) codes.add(row.currencyCode);
  }
  if (codes.size > 1) return { code: null, mixed: true };
  return { code: codes.size === 1 ? [...codes][0] : null, mixed: false };
}

// ── Компиляция фильтров (lenient: неизвестный/archived атрибут → warning, не краш) ─
function compileFiltersLenient(filters: RecordFilterLike[], byKey: Map<string, AttrFull>, liveIds: Set<string>, warnings: string[]): CompiledFilterLike[] {
  const out: CompiledFilterLike[] = [];
  for (const f of filters) {
    const attr = byKey.get(f.attributeKey);
    if (!attr || !liveIds.has(attr.id)) {
      warnings.push(`Filter on "${f.attributeKey}" was skipped — attribute is archived or no longer exists.`);
      continue;
    }
    const lite: AttributeLite = { id: attr.id, key: attr.key, type: attr.type };
    out.push({ ...f, attribute: lite });
  }
  return out;
}

// ── Агрегация: бакеты × сегменты × метрика ─────────────────────────────────────
type Aggregator = { sum: number; countWithValue: number; recordCount: number };
function freshAgg(): Aggregator { return { sum: 0, countWithValue: 0, recordCount: 0 }; }
function aggValue(a: Aggregator, kind: 'count' | 'sum' | 'avg'): number | null {
  if (kind === 'count') return a.recordCount;
  if (kind === 'sum') return a.sum; // сумма пустого = 0 (корректно)
  return a.countWithValue > 0 ? a.sum / a.countWithValue : null; // avg без значений = null, не 0
}

function metricLabelFor(metric: MetricSpec, metricAttr: AttrFull | null): string {
  if (metric.kind === 'count') return 'Count of records';
  const name = metricAttr?.name ?? 'value';
  return metric.kind === 'sum' ? `Sum of ${name}` : `Average of ${name}`;
}

type ResolvedConfig = { metricAttr: AttrFull | null; groupAttr: AttrFull | null; segmentAttr: AttrFull | null; warnings: string[] };

/**
 * Резолв атрибутов конфигурации.
 *  - strict (create/update/preview): любая невалидность → ReportValidationError (400).
 *  - lenient (открытие/drill сохранённого отчёта): archived/missing атрибут → warning + degrade
 *    (метрика без значения / без группировки / без сегмента), отчёт ОТКРЫВАЕТСЯ и НЕ падает.
 * Неподдержанный тип и отсутствие источника — всегда ошибка (нельзя посчитать).
 */
export function resolveConfig(cfg: ReportConfigInput, src: LoadedSource, strict: boolean): ResolvedConfig {
  const warnings: string[] = [];

  const fail = (code: string, msg: string, field: string, warn: string): never | void => {
    if (strict) throw new ReportValidationError(code, msg, field);
    warnings.push(warn);
  };

  // metric
  let metricAttr: AttrFull | null = null;
  if (cfg.metric.kind === 'sum' || cfg.metric.kind === 'avg') {
    if (!cfg.metric.attributeId) {
      fail('REPORT_METRIC_INVALID', `${cfg.metric.kind} needs a numeric attribute`, 'metric', 'Metric attribute is not set — values are unavailable.');
    } else {
      const a = src.attributesById.get(cfg.metric.attributeId);
      if (!a || a.isArchived) fail('REPORT_METRIC_INVALID', 'Metric attribute not found in source', 'metric', 'Metric attribute was archived or removed — values are no longer available.');
      else if (!NUMERIC_METRIC_TYPES.has(a.type)) fail('REPORT_METRIC_INVALID', `${cfg.metric.kind} works only on number or currency attributes`, 'metric', 'Metric attribute is not numeric — values are unavailable.');
      else metricAttr = a;
    }
  } else if (cfg.metric.kind !== 'count') {
    throw new ReportValidationError('REPORT_METRIC_INVALID', 'Unknown metric', 'metric');
  }

  // group
  let groupAttr: AttrFull | null = null;
  if (cfg.groupByAttributeId) {
    const a = src.attributesById.get(cfg.groupByAttributeId);
    if (!a || a.isArchived) fail('REPORT_GROUP_INVALID', 'Group attribute not found in source', 'groupByAttributeId', 'Group-by attribute was archived or removed — showing a single bucket.');
    else if (!GROUPABLE.has(a.type)) fail('REPORT_GROUP_INVALID', `Cannot group by ${a.type} attribute`, 'groupByAttributeId', 'Group-by attribute cannot be grouped — showing a single bucket.');
    else groupAttr = a;
  }

  // segment
  let segmentAttr: AttrFull | null = null;
  if (cfg.segmentByAttributeId) {
    const a = src.attributesById.get(cfg.segmentByAttributeId);
    if (!a || a.isArchived) fail('REPORT_SEGMENT_INVALID', 'Segment attribute not found in source', 'segmentByAttributeId', 'Segment attribute was archived or removed — segmentation dropped.');
    else if (!GROUPABLE.has(a.type)) fail('REPORT_SEGMENT_INVALID', `Cannot segment by ${a.type} attribute`, 'segmentByAttributeId', 'Segment attribute cannot be segmented — segmentation dropped.');
    else segmentAttr = a;
  }

  // funnel / time-in-stage / stage-change требуют упорядоченный status/select-атрибут как стадию
  if (STAGE_TYPES.includes(cfg.type)) {
    if (!groupAttr || groupAttr.type !== AttributeType.SELECT) {
      fail('STAGE_ATTRIBUTE_REQUIRED', `${cfg.type} needs a status / select stage attribute`, 'groupByAttributeId', 'Stage attribute is unavailable — nothing to show.');
      groupAttr = groupAttr && groupAttr.type === AttributeType.SELECT ? groupAttr : null;
    }
  }

  return { metricAttr, groupAttr, segmentAttr, warnings };
}

// ── Главный расчёт отчёта ───────────────────────────────────────────────────────
export async function computeReport(orgId: string, cfg: ReportConfigInput, strict = false, reportId?: string): Promise<ReportResult> {
  const src = await loadSource(orgId, cfg);
  const { metricAttr, groupAttr, segmentAttr, warnings } = resolveConfig(cfg, src, strict);

  const compiled = compileFiltersLenient(cfg.filters ?? [], src.attributesByKey, src.liveAttributeIds, warnings);
  const filtered = compiled.length
    ? src.records.filter((r) => compiled.every((f) => matchesFilter(r as FilterableRecord, f)))
    : src.records;

  const metricKind = cfg.metric.kind;
  const cur = currencyCodeFor(filtered, metricAttr);
  const currencyCode = cur.code;
  if (cur.mixed) warnings.push('Records use more than one currency — amounts are summed without conversion and the currency label is hidden.');
  const metricLabel = metricLabelFor(cfg.metric, metricAttr);

  // M18-2: историч./стадийные типы
  if (cfg.type === ReportType.HISTORICAL) {
    return buildHistorical(orgId, cfg, reportId, groupAttr, currencyCode, metricLabel, metricKind, warnings);
  }
  if (cfg.type === ReportType.TIME_IN_STAGE && groupAttr) {
    return buildTimeInStage(orgId, groupAttr, filtered, warnings);
  }
  if (cfg.type === ReportType.STAGE_CHANGE && groupAttr) {
    return buildStageChange(orgId, cfg, groupAttr, filtered, warnings);
  }
  if (cfg.type === ReportType.FUNNEL && groupAttr) {
    return buildFunnel({ cfg, src, groupAttr, metricAttr, filtered, warnings, metricKind, currencyCode, metricLabel });
  }

  return buildInsight({ cfg, groupAttr, segmentAttr, metricAttr, filtered, warnings, metricKind, currencyCode, metricLabel });
}

function buildInsight(p: {
  cfg: ReportConfigInput; groupAttr: AttrFull | null; segmentAttr: AttrFull | null; metricAttr: AttrFull | null;
  filtered: SourceRecord[]; warnings: string[]; metricKind: 'count' | 'sum' | 'avg'; currencyCode: string | null; metricLabel: string;
}): ReportResult {
  const { cfg, groupAttr, segmentAttr, metricAttr, filtered, warnings, metricKind, currencyCode, metricLabel } = p;

  // Multi-select группировка/сегментация: запись считается в КАЖДОМ своём значении (pivot),
  // поэтому сумма по бакетам может превышать число записей — честно предупреждаем (адверс-ревью M3).
  if ((groupAttr && groupAttr.type === AttributeType.MULTI_SELECT) || (segmentAttr && segmentAttr.type === AttributeType.MULTI_SELECT)) {
    warnings.push('Records with multiple values are counted in each matching group — totals can exceed the record count.');
  }

  // bucketKey -> { label, order, agg, perSegment: Map<segKey, agg> }
  const groups = new Map<string, { label: string; order: number; agg: Aggregator; segs: Map<string, { label: string; order: number; agg: Aggregator }> }>();
  const segMeta = new Map<string, { label: string; order: number }>();

  for (const rec of filtered) {
    const gBuckets = groupAttr ? bucketsForRecord(rec, groupAttr) : [{ key: ALL_KEY, label: 'All records', order: 0 }];
    const mv = recordMetricValue(rec, metricAttr);
    const sBuckets = segmentAttr ? bucketsForRecord(rec, segmentAttr) : [];

    for (const gb of gBuckets) {
      let g = groups.get(gb.key);
      if (!g) { g = { label: gb.label, order: gb.order, agg: freshAgg(), segs: new Map() }; groups.set(gb.key, g); }
      applyToAgg(g.agg, mv);

      if (segmentAttr) {
        for (const sb of sBuckets.length ? sBuckets : [EMPTY_BUCKET]) {
          if (!segMeta.has(sb.key)) segMeta.set(sb.key, { label: sb.label, order: sb.order });
          let s = g.segs.get(sb.key);
          if (!s) { s = { label: sb.label, order: sb.order, agg: freshAgg() }; g.segs.set(sb.key, s); }
          applyToAgg(s.agg, mv);
        }
      }
    }
  }

  const orderedSegKeys = [...segMeta.entries()].sort(sortByOrderThenLabel).map(([key, m]) => ({ key, label: m.label, value: 0 as number | null }));

  // Упорядочивание: перечислимые группы (SELECT/BOOLEAN) — по порядку опций; остальные
  // (USER/TEXT/NUMBER/DATE/...) — по значению метрики убыв., затем потолок MAX_BUCKETS (адверс-ревью C1).
  const enumerable = !!groupAttr && (groupAttr.type === AttributeType.SELECT || groupAttr.type === AttributeType.BOOLEAN);
  let entries = [...groups.entries()];
  if (enumerable || !groupAttr) {
    entries.sort(([, a], [, b]) => sortMeta(a, b));
  } else {
    entries.sort(([, a], [, b]) => {
      const va = aggValue(a.agg, metricKind), vb = aggValue(b.agg, metricKind);
      if (va === vb) return sortMeta(a, b);
      if (va === null) return 1;
      if (vb === null) return -1;
      return vb - va;
    });
    if (entries.length > MAX_BUCKETS) {
      warnings.push(`Showing the top ${MAX_BUCKETS} groups by ${metricKind} — ${entries.length - MAX_BUCKETS} more not shown.`);
      entries = entries.slice(0, MAX_BUCKETS);
    }
  }

  const buckets: ReportBucket[] = entries.map(([key, g]) => {
    const segments = segmentAttr
      ? orderedSegKeys.map((sk) => ({ key: sk.key, label: sk.label, value: round2(aggValue(g.segs.get(sk.key)?.agg ?? freshAgg(), metricKind)) }))
      : undefined;
    return { key, label: g.label, value: round2(aggValue(g.agg, metricKind)), records: g.agg.recordCount, segments };
  });

  return {
    type: cfg.type, visualization: cfg.visualization, metricLabel, metricKind, currencyCode,
    groupByLabel: groupAttr?.name ?? null, segmentByLabel: segmentAttr?.name ?? null,
    buckets, segmentKeys: orderedSegKeys, totalRecords: filtered.length, warnings,
  };
}

function buildFunnel(p: {
  cfg: ReportConfigInput; src: LoadedSource; groupAttr: AttrFull; metricAttr: AttrFull | null;
  filtered: SourceRecord[]; warnings: string[]; metricKind: 'count' | 'sum' | 'avg'; currencyCode: string | null; metricLabel: string;
}): ReportResult {
  const { cfg, groupAttr, metricAttr, filtered, warnings, metricKind, currencyCode, metricLabel } = p;

  // Порядок стадий: config.stageOrder (валидные опции) либо порядок опций атрибута.
  const optionByValue = new Map(groupAttr.options.map((o) => [o.value, o]));
  let stageValues: string[];
  const requested = cfg.config?.stageOrder?.filter((v) => optionByValue.has(v));
  if (requested && requested.length) {
    stageValues = requested;
    if (requested.length !== groupAttr.options.length) warnings.push('Funnel stage order covers a subset of available stages.');
  } else {
    stageValues = [...groupAttr.options].sort((a, b) => a.order - b.order).map((o) => o.value);
  }

  // Метрика по каждой стадии (записи, находящиеся В этой стадии сейчас).
  const perStage = new Map<string, Aggregator>(stageValues.map((v) => [v, freshAgg()]));
  let droppedRecords = 0; // записи в стадиях ВНЕ выбранного порядка — НЕ молча, считаем и предупреждаем (адверс-ревью C2)
  for (const rec of filtered) {
    const row = rec.values.find((v) => v.attributeId === groupAttr.id);
    const token = row?.textValue ?? null;
    const opt = token !== null ? findOption(groupAttr, token) : undefined;
    const key = opt?.value ?? token;
    const agg = key !== null ? perStage.get(key) : undefined;
    if (!agg) { droppedRecords += 1; continue; }
    applyToAgg(agg, recordMetricValue(rec, metricAttr));
  }
  if (droppedRecords > 0) warnings.push(`${droppedRecords} record(s) sit in stages outside this funnel and are excluded from the conversion.`);

  const firstValue = stageValues.length ? aggValue(perStage.get(stageValues[0])!, metricKind) : null;
  let prevValue: number | null = null;
  const buckets: ReportBucket[] = stageValues.map((v) => {
    const opt = optionByValue.get(v)!;
    const agg = perStage.get(v)!;
    const value = round2(aggValue(agg, metricKind));
    const conversionFromFirst = firstValue !== null && firstValue > 0 && value !== null ? round4(value / firstValue) : null;
    const conversionFromPrevious = prevValue !== null && prevValue > 0 && value !== null ? round4(value / prevValue) : null;
    prevValue = value;
    return { key: v, label: opt.label, value, records: agg.recordCount, conversionFromFirst, conversionFromPrevious };
  });

  return {
    type: cfg.type, visualization: ReportVisualization.FUNNEL, metricLabel, metricKind, currencyCode,
    groupByLabel: groupAttr.name, segmentByLabel: null,
    buckets, segmentKeys: [], totalRecords: filtered.length, warnings,
  };
}

function applyToAgg(agg: Aggregator, metricValue: number | null): void {
  agg.recordCount += 1;
  if (metricValue !== null) { agg.sum += metricValue; agg.countWithValue += 1; }
}
function sortMeta(a: { order: number; label: string }, b: { order: number; label: string }): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.label.localeCompare(b.label, 'ru');
}
function sortByOrderThenLabel(a: [string, { order: number; label: string }], b: [string, { order: number; label: string }]): number {
  return sortMeta(a[1], b[1]);
}
function round2(n: number | null): number | null { return n === null ? null : Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }

// ── M18-2: стадийные/историч. расчёты ──────────────────────────────────────────
function stageLabel(attr: AttrFull, token: string | null): string {
  if (token === null) return EMPTY_LABEL;
  return attr.options.find((o) => o.value === token || o.id === token)?.label ?? token;
}
function stageOrder(attr: AttrFull, token: string | null): number {
  if (token === null) return Number.MAX_SAFE_INTEGER;
  return attr.options.find((o) => o.value === token || o.id === token)?.order ?? Number.MAX_SAFE_INTEGER - 1;
}
function startOfDayMs(d: Date): number { return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }

// TIME IN STAGE (S288): среднее время, проведённое записями в каждой стадии (из StageTransition).
async function buildTimeInStage(orgId: string, groupAttr: AttrFull, filtered: SourceRecord[], warnings: string[]): Promise<ReportResult> {
  const recordIds = filtered.map((r) => r.id);
  const base: ReportResult = {
    type: ReportType.TIME_IN_STAGE, visualization: ReportVisualization.BAR, metricLabel: `Avg time in ${groupAttr.name}`,
    metricKind: 'avg', currencyCode: null, metricUnit: 'days', groupByLabel: groupAttr.name, segmentByLabel: null,
    buckets: [], segmentKeys: [], totalRecords: filtered.length, warnings,
  };
  if (!recordIds.length) { warnings.push('No records in scope.'); return base; }

  const transitions = await prisma.stageTransition.findMany({
    where: { orgId, attributeId: groupAttr.id, recordId: { in: recordIds } },
    orderBy: [{ recordId: 'asc' }, { changedAt: 'asc' }, { id: 'asc' }], // id-tiebreaker: детерминизм при равном changedAt
    select: { recordId: true, toValue: true, changedAt: true },
  });
  if (!transitions.length) { warnings.push('Not enough stage history yet — time in stage will populate as records move between stages.'); return base; }

  const nowMs = new Date().getTime();
  const perStage = new Map<string, { totalMs: number; count: number }>();
  let i = 0;
  while (i < transitions.length) {
    const rid = transitions[i].recordId;
    let j = i;
    while (j < transitions.length && transitions[j].recordId === rid) j++;
    const seq = transitions.slice(i, j); // переходы одной записи по времени
    for (let k = 0; k < seq.length; k++) {
      const stage = seq[k].toValue;
      if (stage === null) continue; // «нет стадии» — не считаем
      const enteredMs = seq[k].changedAt.getTime();
      const exitedMs = k < seq.length - 1 ? seq[k + 1].changedAt.getTime() : nowMs; // последняя — текущая стадия
      const dur = Math.max(0, exitedMs - enteredMs);
      const agg = perStage.get(stage) ?? { totalMs: 0, count: 0 };
      agg.totalMs += dur; agg.count += 1; perStage.set(stage, agg);
    }
    i = j;
  }

  base.buckets = [...perStage.entries()]
    .map(([token, a]) => ({ key: token, label: stageLabel(groupAttr, token), value: round2(a.totalMs / a.count / DAY_MS), records: a.count, order: stageOrder(groupAttr, token) }))
    .sort((x, y) => x.order - y.order)
    .map(({ order: _o, ...b }) => b);
  return base;
}

// STAGE CHANGE (S289): количество переходов from→to за период (из StageTransition).
async function buildStageChange(orgId: string, cfg: ReportConfigInput, groupAttr: AttrFull, filtered: SourceRecord[], warnings: string[]): Promise<ReportResult> {
  const recordIds = filtered.map((r) => r.id);
  const range = cfg.config?.dateRange;
  const where: Prisma.StageTransitionWhereInput = { orgId, attributeId: groupAttr.id, recordId: { in: recordIds } };
  if (range?.from || range?.to) where.changedAt = { ...(range.from ? { gte: new Date(range.from) } : {}), ...(range.to ? { lte: new Date(range.to) } : {}) };

  const base: ReportResult = {
    type: ReportType.STAGE_CHANGE, visualization: ReportVisualization.BAR, metricLabel: `Stage changes in ${groupAttr.name}`,
    metricKind: 'count', currencyCode: null, groupByLabel: groupAttr.name, segmentByLabel: null,
    buckets: [], segmentKeys: [], totalRecords: filtered.length, warnings,
  };
  if (!recordIds.length) { warnings.push('No records in scope.'); return base; }

  const transitions = await prisma.stageTransition.findMany({ where, select: { fromValue: true, toValue: true } });
  if (!transitions.length) { warnings.push('No stage changes recorded yet for this attribute and period.'); return base; }

  const counts = new Map<string, { from: string | null; to: string | null; n: number }>();
  for (const t of transitions) {
    const key = `${t.fromValue ?? '∅'}->${t.toValue ?? '∅'}`;
    const c = counts.get(key) ?? { from: t.fromValue, to: t.toValue, n: 0 };
    c.n += 1; counts.set(key, c);
  }
  let buckets = [...counts.entries()].map(([key, c]) => ({
    key, label: `${c.from === null ? '(new)' : stageLabel(groupAttr, c.from)} → ${stageLabel(groupAttr, c.to)}`, value: c.n, records: c.n,
  })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  if (buckets.length > MAX_BUCKETS) { warnings.push(`Showing the top ${MAX_BUCKETS} transitions — ${buckets.length - MAX_BUCKETS} more not shown.`); buckets = buckets.slice(0, MAX_BUCKETS); }
  base.buckets = buckets;
  return base;
}

// HISTORICAL (S286): серия снапшотов во времени по сохранённому отчёту (X = snapshotAt, не date-атрибут).
async function buildHistorical(orgId: string, cfg: ReportConfigInput, reportId: string | undefined, groupAttr: AttrFull | null, currencyCode: string | null, metricLabel: string, metricKind: 'count' | 'sum' | 'avg', warnings: string[]): Promise<ReportResult> {
  const base: ReportResult = {
    type: ReportType.HISTORICAL, visualization: ReportVisualization.LINE, metricLabel, metricKind, currencyCode,
    groupByLabel: groupAttr?.name ?? null, segmentByLabel: null, buckets: [], segmentKeys: [], history: [], totalRecords: 0, warnings,
  };
  if (!reportId) { warnings.push('Save the report to start tracking history — snapshots accumulate over time.'); return base; }

  const hash = configHash(cfg);
  const rows = await prisma.reportSnapshot.findMany({
    where: { orgId, reportId, configHash: hash }, orderBy: { snapshotAt: 'asc' },
    select: { snapshotAt: true, bucketKey: true, bucketLabel: true, metricValue: true },
  });
  if (!rows.length) { warnings.push('Not enough historical data yet — snapshots will appear here as they accumulate (or run Backfill on the report).'); return base; }

  const byTime = new Map<string, { snapshotAt: string; buckets: { key: string; label: string; value: number | null }[] }>();
  for (const r of rows) {
    const ts = r.snapshotAt.toISOString();
    const point = byTime.get(ts) ?? { snapshotAt: ts, buckets: [] };
    point.buckets.push({ key: r.bucketKey, label: r.bucketLabel, value: decimalToNumber(r.metricValue) });
    byTime.set(ts, point);
  }
  const history = [...byTime.values()];
  base.history = history;
  base.buckets = history[history.length - 1]?.buckets.map((b) => ({ key: b.key, label: b.label, value: b.value, records: 0 })) ?? [];
  base.totalRecords = base.buckets.reduce((s, b) => s + (b.value ?? 0), 0);
  return base;
}

// ── Снапшот-джоба (идемпотентная) + backfill из StageTransition ──────────────────
type ReportRowForSnapshot = {
  id: string; orgId: string; type: ReportType; sourceType: ReportSourceType; sourceObjectId: string | null; sourceListId: string | null;
  metric: unknown; groupByAttributeId: string | null; segmentByAttributeId: string | null; filters: unknown; visualization: ReportVisualization; config: unknown;
};
function rowToCfg(row: ReportRowForSnapshot): ReportConfigInput {
  return {
    type: row.type, sourceType: row.sourceType, sourceObjectId: row.sourceObjectId, sourceListId: row.sourceListId,
    metric: (row.metric ?? { kind: 'count' }) as MetricSpec, groupByAttributeId: row.groupByAttributeId, segmentByAttributeId: row.segmentByAttributeId,
    filters: Array.isArray(row.filters) ? (row.filters as ReportConfigInput['filters']) : [], visualization: row.visualization,
    config: (row.config ?? null) as ReportConfigInput['config'],
  };
}

// Записать снапшот текущего среза historical-отчёта на момент snapshotAt (идемпотентно).
async function writeSnapshot(report: ReportRowForSnapshot, snapshotAt: Date): Promise<number> {
  const cfg = rowToCfg(report);
  const hash = configHash(cfg);
  // Гейт идемпотентности: если снапшот на этот момент уже есть — не пересчитываем (дешёвый scheduler-тик).
  const already = await prisma.reportSnapshot.count({ where: { reportId: report.id, configHash: hash, snapshotAt } });
  if (already > 0) return 0;
  // считаем текущий срез как INSIGHT (count/sum/avg by group)
  const insight = await computeReport(report.orgId, { ...cfg, type: ReportType.INSIGHT }, false).catch(() => null);
  if (!insight) return 0;
  const data = insight.buckets.map((b) => ({
    orgId: report.orgId, reportId: report.id, configHash: hash, snapshotAt,
    bucketKey: b.key, segmentKey: '', bucketLabel: b.label, metricValue: new Prisma.Decimal(b.value ?? 0),
  }));
  if (!data.length) return 0;
  const res = await prisma.reportSnapshot.createMany({ data, skipDuplicates: true }); // идемпотентно по @@unique
  return res.count;
}

// Джоба воркера: снапшот всех historical-отчётов на «сегодня» (по cadence). Идемпотентна.
export async function snapshotHistoricalReports(orgId?: string): Promise<{ reports: number; written: number }> {
  const reports = await prisma.report.findMany({
    where: { type: ReportType.HISTORICAL, archivedAt: null, ...(orgId ? { orgId } : {}) },
    select: { id: true, orgId: true, type: true, sourceType: true, sourceObjectId: true, sourceListId: true, metric: true, groupByAttributeId: true, segmentByAttributeId: true, filters: true, visualization: true, config: true },
  });
  let written = 0;
  const now = new Date();
  const snapAt = new Date(startOfDayMs(now)); // дневной бакет (UTC) — повторный прогон в тот же день дедуплится
  for (const r of reports) written += await writeSnapshot(r as ReportRowForSnapshot, snapAt).catch(() => 0);
  return { reports: reports.length, written };
}

// Backfill: реконструировать прошлые недельные снапшоты count-by-stage из StageTransition (real history).
// Работает для HISTORICAL по SELECT-стадии с метрикой count. Иначе — только текущий снапшот.
export async function backfillReportHistory(orgId: string, reportId: string, weeks = 8): Promise<{ written: number; mode: string }> {
  const row = await prisma.report.findFirst({ where: { id: reportId, orgId, archivedAt: null } });
  if (!row) return { written: 0, mode: 'not_found' };
  const report = row as unknown as ReportRowForSnapshot;
  const cfg = rowToCfg(report);
  const hash = configHash(cfg);

  const groupAttr = cfg.groupByAttributeId ? await prisma.attribute.findFirst({ where: { id: cfg.groupByAttributeId }, select: { id: true, type: true, options: { where: { isArchived: false }, select: { value: true, label: true, order: true, id: true } } } }) : null;
  const metric = cfg.metric;
  const stageReconstructable = !!groupAttr && groupAttr.type === AttributeType.SELECT && metric.kind === 'count' && cfg.sourceType === ReportSourceType.OBJECT && !!cfg.sourceObjectId;

  // всегда пишем текущий снапшот
  let written = await writeSnapshot(report, new Date(startOfDayMs(new Date())));

  if (!stageReconstructable) return { written, mode: 'current_only' };

  // реконструкция: для каждой прошлой недели — стадия каждой записи = toValue последнего перехода ≤ T
  const recs = await prisma.record.findMany({ where: { orgId, objectId: cfg.sourceObjectId!, archivedAt: null }, select: { id: true } });
  const recordIds = recs.map((r) => r.id);
  if (!recordIds.length) return { written, mode: 'stage_no_records' };
  const transitions = await prisma.stageTransition.findMany({
    where: { orgId, attributeId: groupAttr!.id, recordId: { in: recordIds } },
    orderBy: [{ changedAt: 'asc' }, { id: 'asc' }], select: { recordId: true, toValue: true, changedAt: true },
  });
  const labelOf = (token: string | null) => token === null ? EMPTY_LABEL : (groupAttr!.options.find((o) => o.value === token || o.id === token)?.label ?? token);

  const todayStart = startOfDayMs(new Date());
  const rows: { orgId: string; reportId: string; configHash: string; snapshotAt: Date; bucketKey: string; segmentKey: string; bucketLabel: string; metricValue: Prisma.Decimal }[] = [];
  for (let w = weeks; w >= 1; w--) {
    const T = todayStart - w * 7 * DAY_MS; // конец недели w назад (UTC-полночь)
    const Tdate = new Date(T);
    const stageAt = new Map<string, string | null>(); // recordId → стадия на момент T
    for (const t of transitions) {
      if (t.changedAt.getTime() <= T) stageAt.set(t.recordId, t.toValue);
    }
    const counts = new Map<string, number>();
    for (const rid of recordIds) {
      const st = stageAt.get(rid);
      if (st === undefined) continue; // запись ещё не имела стадии на момент T
      const k = st ?? EMPTY_KEY;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const [k, n] of counts) rows.push({ orgId, reportId, configHash: hash, snapshotAt: Tdate, bucketKey: k, segmentKey: '', bucketLabel: labelOf(k === EMPTY_KEY ? null : k), metricValue: new Prisma.Decimal(n) });
  }
  if (rows.length) { const res = await prisma.reportSnapshot.createMany({ data: rows, skipDuplicates: true }); written += res.count; }
  return { written, mode: 'stage_reconstructed' };
}

// ── Drill-in: реальные записи бакета (+segment), с per-record metricValue для sum/avg ─
export type DrillRecord = { recordId: string; displayName: string; href: string; metricValue: number | null };
export type DrillResult = { bucketKey: string; segmentKey: string | null; total: number; records: DrillRecord[] };

export async function drillReport(orgId: string, cfg: ReportConfigInput, bucketKey: string, segmentKey: string | null): Promise<DrillResult> {
  const src = await loadSource(orgId, cfg);
  const { metricAttr, groupAttr, segmentAttr, warnings } = resolveConfig(cfg, src, false);

  const compiled = compileFiltersLenient(cfg.filters ?? [], src.attributesByKey, src.liveAttributeIds, warnings);
  const filtered = compiled.length
    ? src.records.filter((r) => compiled.every((f) => matchesFilter(r as FilterableRecord, f)))
    : src.records;

  const matches = filtered.filter((rec) => {
    const gKeys = groupAttr ? bucketsForRecord(rec, groupAttr).map((b) => b.key) : ['__all__'];
    if (!gKeys.includes(bucketKey)) return false;
    if (segmentKey && segmentAttr) {
      const sKeys = bucketsForRecord(rec, segmentAttr).map((b) => b.key);
      if (!sKeys.includes(segmentKey)) return false;
    }
    return true;
  });

  const records: DrillRecord[] = matches.slice(0, 200).map((rec) => ({
    recordId: rec.id,
    displayName: rec.displayName || '(no name)',
    href: `/crm/${src.objectKey}/${rec.id}`,
    metricValue: metricAttr ? recordMetricValue(rec, metricAttr) : null,
  }));

  return { bucketKey, segmentKey: segmentKey ?? null, total: matches.length, records };
}
