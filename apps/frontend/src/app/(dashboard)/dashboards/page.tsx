'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import { useToast } from '@/components/ui/Toast';
import {
  reportBuilderApi,
  dashboardsApi,
  type ReportBuilderMeta,
  type RbObject,
  type RbAttribute,
  type ReportRow,
  type ReportResult,
  type ReportConfigPayload,
  type ReportType,
  type ReportVisualization,
  type ReportFilterInput,
  type ReportFilterOp,
  type ReportDrillResult,
  type DashboardListItem,
  type DashboardDetail,
  type DashboardWidgetItem,
} from '@/lib/api';
import {
  LayoutDashboard, Plus, Database, ListChecks, BarChart3, LineChart, Table2, Filter as FilterIcon,
  Hash, X, Trash2, Save, Loader2, ChevronRight, AlertTriangle, TrendingDown, TrendingUp, Layers, Grid3x3, FileBarChart,
  ArrowLeft, ArrowRight, Maximize2, Minimize2, Lock,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────────
   /dashboards — Report Builder (модуль 14, M18-1). Reports library + конструктор
   отчёта над CRM-объектами/списками (INSIGHT/FUNNEL) с живым preview и drill-in.
   Отдельно от /reports (наша AI-SDR outbound-аналитика). Светлая Bold-тема.
   ────────────────────────────────────────────────────────────────────────────── */

const REPORT_TYPES: { key: ReportType; label: string; desc: string; enabled: boolean }[] = [
  { key: 'INSIGHT', label: 'Insight', desc: 'Pivot — count / sum / avg by attribute', enabled: true },
  { key: 'FUNNEL', label: 'Funnel', desc: 'Conversion across a stage attribute', enabled: true },
  { key: 'HISTORICAL', label: 'Historical', desc: 'Snapshots over time', enabled: true },
  { key: 'TIME_IN_STAGE', label: 'Time in stage', desc: 'Avg time spent per stage', enabled: true },
  { key: 'STAGE_CHANGE', label: 'Stage change', desc: 'Transitions between stages', enabled: true },
];
// Типы, чья группировка — обязательно SELECT-стадия.
const STAGE_TYPED: ReportType[] = ['FUNNEL', 'TIME_IN_STAGE', 'STAGE_CHANGE'];
// Типы, где пользователь выбирает метрику (count/sum/avg). Time-in-stage/Stage-change — метрика фиксирована.
const METRIC_TYPED: ReportType[] = ['INSIGHT', 'FUNNEL', 'HISTORICAL'];

const VIZ: { key: ReportVisualization; label: string; icon: React.ReactNode }[] = [
  { key: 'BAR', label: 'Bar', icon: <BarChart3 size={13} /> },
  { key: 'LINE', label: 'Line', icon: <LineChart size={13} /> },
  { key: 'TABLE', label: 'Table', icon: <Table2 size={13} /> },
  { key: 'FUNNEL', label: 'Funnel', icon: <TrendingDown size={13} /> },
];

const FILTER_OPS: { key: ReportFilterOp; label: string }[] = [
  { key: 'eq', label: 'is' }, { key: 'neq', label: 'is not' }, { key: 'contains', label: 'contains' },
  { key: 'gt', label: '>' }, { key: 'lt', label: '<' }, { key: 'in', label: 'in (comma)' },
  { key: 'is_empty', label: 'is empty' }, { key: 'is_not_empty', label: 'is not empty' },
];

const GROUPABLE_TYPES = new Set(['SELECT', 'MULTI_SELECT', 'USER', 'BOOLEAN', 'DATE', 'DATETIME', 'NUMBER', 'CURRENCY', 'TEXT', 'EMAIL', 'PHONE', 'URL', 'LONG_TEXT']);
const NUMERIC_TYPES = new Set(['NUMBER', 'CURRENCY']);

const TYPE_CHIP: Record<string, string> = {
  INSIGHT: 'bg-brand-50 text-brand-700', FUNNEL: 'bg-violet-50 text-violet-700',
  HISTORICAL: 'bg-sky-50 text-sky-700', TIME_IN_STAGE: 'bg-amber-50 text-amber-700', STAGE_CHANGE: 'bg-emerald-50 text-emerald-700',
};

const SERIES_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7', '#14b8a6', '#f43f5e'];

type BuilderState = {
  id: string | null;
  name: string;
  type: ReportType;
  sourceType: 'OBJECT' | 'LIST';
  sourceObjectId: string | null;
  sourceListId: string | null;
  metricKind: 'count' | 'sum' | 'avg';
  metricAttributeId: string | null;
  groupByAttributeId: string | null;
  segmentByAttributeId: string | null;
  filters: ReportFilterInput[];
  visualization: ReportVisualization;
  config: { stageOrder?: string[]; dateRange?: { from?: string; to?: string } } | null;
};

function blankBuilder(): BuilderState {
  return {
    id: null, name: '', type: 'INSIGHT', sourceType: 'OBJECT', sourceObjectId: null, sourceListId: null,
    metricKind: 'count', metricAttributeId: null, groupByAttributeId: null, segmentByAttributeId: null,
    filters: [], visualization: 'BAR', config: null,
  };
}

// `in` хранится в редакторе строкой; на отправке сплитим по запятым в массив (адверс-ревью M6).
function normalizeFilters(filters: ReportFilterInput[]): ReportFilterInput[] {
  return filters.map((f) => {
    if (f.op === 'in' && typeof f.value === 'string') return { ...f, value: f.value.split(',').map((s) => s.trim()).filter(Boolean) };
    return f;
  });
}

function buildPayload(b: BuilderState): ReportConfigPayload {
  return {
    name: b.name || 'Untitled report',
    type: b.type,
    sourceType: b.sourceType,
    sourceObjectId: b.sourceType === 'OBJECT' ? b.sourceObjectId : null,
    sourceListId: b.sourceType === 'LIST' ? b.sourceListId : null,
    metric: b.metricKind === 'count' ? { kind: 'count' } : { kind: b.metricKind, attributeId: b.metricAttributeId ?? '' },
    groupByAttributeId: b.groupByAttributeId,
    segmentByAttributeId: b.segmentByAttributeId,
    filters: normalizeFilters(b.filters),
    visualization: b.visualization,
    config: b.config, // round-trip stageOrder/dateRange — не затираем при save
  };
}

function reportToBuilder(r: ReportRow): BuilderState {
  return {
    id: r.id, name: r.name, type: r.type, sourceType: r.sourceType,
    sourceObjectId: r.sourceObjectId, sourceListId: r.sourceListId,
    metricKind: r.metric.kind, metricAttributeId: r.metric.kind === 'count' ? null : r.metric.attributeId,
    groupByAttributeId: r.groupByAttributeId, segmentByAttributeId: r.segmentByAttributeId,
    filters: r.filters ?? [], visualization: r.visualization, config: r.config ?? null,
  };
}

export default function DashboardsPage() {
  const toast = useToast();
  const [meta, setMeta] = useState<ReportBuilderMeta | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [preview, setPreview] = useState<ReportResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [drill, setDrill] = useState<{ bucketKey: string; bucketLabel: string; segmentKey: string | null } | null>(null);
  const [view, setView] = useState<'reports' | 'dashboards'>('reports');
  const reqIdRef = useRef(0);

  useEffect(() => { reportBuilderApi.meta().then(setMeta).catch(() => toast.error('Could not load sources')); }, [toast]);
  const loadReports = useCallback(() => { reportBuilderApi.list().then(setReports).catch(() => {}); }, []);
  useEffect(() => { loadReports(); }, [loadReports]);

  // Атрибуты текущего источника (object напрямую или object списка).
  const sourceAttributes = useMemo<RbAttribute[]>(() => {
    if (!meta || !builder) return [];
    let obj: RbObject | undefined;
    if (builder.sourceType === 'OBJECT' && builder.sourceObjectId) obj = meta.objects.find((o) => o.id === builder.sourceObjectId);
    else if (builder.sourceType === 'LIST' && builder.sourceListId) {
      const list = meta.lists.find((l) => l.id === builder.sourceListId);
      if (list) obj = meta.objects.find((o) => o.id === list.primaryObjectId);
    }
    return obj?.attributes ?? [];
  }, [meta, builder]);

  const groupable = useMemo(() => sourceAttributes.filter((a) => GROUPABLE_TYPES.has(a.type)), [sourceAttributes]);
  const numericAttrs = useMemo(() => sourceAttributes.filter((a) => NUMERIC_TYPES.has(a.type)), [sourceAttributes]);
  const selectAttrs = useMemo(() => sourceAttributes.filter((a) => a.type === 'SELECT'), [sourceAttributes]);

  // Живой preview: debounce при изменении конфигурации.
  const runPreview = useCallback((b: BuilderState) => {
    const hasSource = (b.sourceType === 'OBJECT' && b.sourceObjectId) || (b.sourceType === 'LIST' && b.sourceListId);
    if (!hasSource) { setPreview(null); setPreviewError(null); return; }
    if (METRIC_TYPED.includes(b.type) && (b.metricKind === 'sum' || b.metricKind === 'avg') && !b.metricAttributeId) { setPreview(null); setPreviewError('Pick a numeric attribute for the metric.'); return; }
    if (STAGE_TYPED.includes(b.type) && !b.groupByAttributeId) { setPreview(null); setPreviewError('Pick a stage (status / select) attribute.'); return; }
    const myReq = ++reqIdRef.current;
    setPreviewLoading(true);
    reportBuilderApi.preview(buildPayload(b))
      .then((res) => { if (myReq === reqIdRef.current) { setPreview(res); setPreviewError(null); } })
      .catch((e) => { if (myReq === reqIdRef.current) { setPreview(null); setPreviewError(e?.response?.data?.error ?? 'Could not compute preview'); } })
      .finally(() => { if (myReq === reqIdRef.current) setPreviewLoading(false); });
  }, []);

  useEffect(() => {
    if (!builder) return;
    const t = setTimeout(() => runPreview(builder), 350);
    return () => clearTimeout(t);
  }, [builder, runPreview]);

  function patch(p: Partial<BuilderState>) { setBuilder((b) => (b ? { ...b, ...p } : b)); }

  // Смена типа отчёта: подобрать визуализацию, сбросить метрику/группу под ограничения типа.
  function changeType(t: ReportType) {
    if (!builder) return;
    const viz: ReportVisualization = t === 'FUNNEL' ? 'FUNNEL' : t === 'HISTORICAL' ? 'LINE'
      : (t === 'TIME_IN_STAGE' || t === 'STAGE_CHANGE') ? 'BAR'
        : (builder.visualization === 'FUNNEL' || builder.visualization === 'LINE') ? 'BAR' : builder.visualization;
    const metricKind = METRIC_TYPED.includes(t) ? builder.metricKind : 'count';
    const grpOk = !STAGE_TYPED.includes(t) || (!!builder.groupByAttributeId && selectAttrs.some((a) => a.id === builder.groupByAttributeId));
    patch({
      type: t, visualization: viz, metricKind,
      groupByAttributeId: grpOk ? builder.groupByAttributeId : null,
      metricAttributeId: METRIC_TYPED.includes(t) ? builder.metricAttributeId : null,
      segmentByAttributeId: t === 'INSIGHT' ? builder.segmentByAttributeId : null,
    });
  }

  async function backfillHistory() {
    if (!builder?.id) return;
    try { const r = await reportBuilderApi.backfillHistory(builder.id); toast.success('History built', `${r.written} snapshot point(s)`); runPreview(builder); }
    catch { toast.error('Could not build history'); }
  }

  function openNew() { setBuilder(blankBuilder()); setPreview(null); setPreviewError(null); }
  function openReport(r: ReportRow) { setBuilder(reportToBuilder(r)); setPreview(null); setPreviewError(null); }
  function closeBuilder() { setBuilder(null); setPreview(null); setPreviewError(null); }

  async function save() {
    if (!builder) return;
    if (!builder.name.trim()) { toast.error('Name the report first'); return; }
    setSaving(true);
    try {
      const payload = buildPayload(builder);
      if (builder.id) {
        const { report } = await reportBuilderApi.update(builder.id, payload);
        toast.success('Report updated', report.name);
        setBuilder(reportToBuilder(report));
      } else {
        const cid = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `rb-${Date.now()}`;
        const { report } = await reportBuilderApi.create(payload, cid);
        toast.success('Report saved', report.name);
        setBuilder(reportToBuilder(report));
      }
      loadReports();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not save report';
      toast.error(msg);
    } finally { setSaving(false); }
  }

  async function removeReport(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try { await reportBuilderApi.remove(id); setReports((p) => p.filter((r) => r.id !== id)); if (builder?.id === id) closeBuilder(); toast.success('Report deleted'); }
    catch { toast.error('Could not delete'); }
  }

  function onBucketClick(bucketKey: string, bucketLabel: string, segmentKey: string | null) {
    if (!builder?.id) { toast.error('Save the report to drill into its records'); return; }
    setDrill({ bucketKey, bucketLabel, segmentKey });
  }

  return (
    <>
      <Topbar title="Dashboards" subtitle="Report builder · your CRM data" icon={<LayoutDashboard size={18} strokeWidth={1.85} />} />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-6xl space-y-4">
          {/* Reports | Dashboards toggle */}
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 shadow-xs">
            {([['reports', 'Reports', <FileBarChart key="r" size={13} />], ['dashboards', 'Dashboards', <Grid3x3 key="d" size={13} />]] as const).map(([k, label, icon]) => (
              <button key={k} type="button" onClick={() => setView(k)}
                className={['inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors', view === k ? 'bg-brand-600 text-white shadow-brand' : 'text-ink-muted hover:bg-surface-2'].join(' ')}>
                {icon} {label}
              </button>
            ))}
          </div>

          {view === 'dashboards' ? (
            <DashboardsView reports={reports} />
          ) : (
          <>
          {/* Reports library */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-ink">Reports library</h2>
              <p className="text-[12px] text-ink-subtle">Build reports on objects and lists, then arrange them on a dashboard.</p>
            </div>
            <button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-[12.5px] font-semibold text-white shadow-brand hover:bg-brand-700">
              <Plus size={14} /> New report
            </button>
          </div>

          {reports.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface py-12 text-ink-subtle">
              <BarChart3 size={22} />
              <p className="text-[13px]">No reports yet — click <b>New report</b> to build one on your CRM data.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {reports.map((r) => (
                <button key={r.id} type="button" onClick={() => openReport(r)}
                  className={['group rounded-xl border bg-surface p-3 text-left shadow-xs transition-colors hover:border-brand-200 hover:bg-brand-50/30', builder?.id === r.id ? 'border-brand-300 ring-1 ring-brand-200' : 'border-line'].join(' ')}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{r.name}</span>
                    <span role="button" tabIndex={0} onClick={(e) => removeReport(r.id, e)} className="shrink-0 text-ink-subtle opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"><Trash2 size={13} /></span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${TYPE_CHIP[r.type] ?? 'bg-surface-2 text-ink-muted'}`}>{r.type.replace('_', ' ')}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-subtle">{r.sourceType === 'OBJECT' ? <Database size={11} /> : <ListChecks size={11} />} {r.sourceType === 'OBJECT' ? 'Object' : 'List'}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-subtle">· {r.metric.kind}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Builder */}
          {builder && (
            <div className="rounded-2xl border border-line bg-surface shadow-sm">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <input value={builder.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Report name…"
                    className="w-64 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-semibold text-ink outline-none focus:border-brand-400" />
                  {builder.id && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">saved</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-brand hover:bg-brand-700 disabled:opacity-60">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {builder.id ? 'Update' : 'Save report'}
                  </button>
                  <button type="button" onClick={closeBuilder} className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-2"><X size={16} /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr]">
                {/* Config panel */}
                <div className="space-y-4 border-r border-line p-4">
                  {/* type */}
                  <Field label="Report type">
                    <div className="grid grid-cols-1 gap-1.5">
                      {REPORT_TYPES.map((t) => (
                        <button key={t.key} type="button" onClick={() => changeType(t.key)}
                          className={['flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-[12px] transition-colors',
                            builder.type === t.key ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line text-ink-muted hover:bg-surface-2'].join(' ')}>
                          <span><span className="font-semibold">{t.label}</span><span className="ml-1.5 text-[10.5px] text-ink-subtle">{t.desc}</span></span>
                        </button>
                      ))}
                    </div>
                  </Field>

                  {/* source */}
                  <Field label="Data source">
                    <div className="mb-1.5 flex gap-1">
                      {(['OBJECT', 'LIST'] as const).map((st) => (
                        <button key={st} type="button" onClick={() => patch({ sourceType: st, sourceObjectId: null, sourceListId: null, groupByAttributeId: null, segmentByAttributeId: null, metricAttributeId: null, filters: [] })}
                          className={['flex-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold transition-colors', builder.sourceType === st ? 'bg-brand-600 text-white' : 'bg-surface-2 text-ink-muted hover:bg-surface-2/70'].join(' ')}>
                          {st === 'OBJECT' ? 'Object' : 'List'}
                        </button>
                      ))}
                    </div>
                    {builder.sourceType === 'OBJECT' ? (
                      <Select value={builder.sourceObjectId ?? ''} onChange={(v) => patch({ sourceObjectId: v || null, groupByAttributeId: null, segmentByAttributeId: null, metricAttributeId: null, filters: [] })}>
                        <option value="">Select an object…</option>
                        {meta?.objects.map((o) => <option key={o.id} value={o.id}>{o.pluralName}</option>)}
                      </Select>
                    ) : (
                      <Select value={builder.sourceListId ?? ''} onChange={(v) => patch({ sourceListId: v || null, groupByAttributeId: null, segmentByAttributeId: null, metricAttributeId: null, filters: [] })}>
                        <option value="">Select a list…</option>
                        {meta?.lists.map((l) => <option key={l.id} value={l.id}>{l.name}{l.primaryObjectName ? ` · ${l.primaryObjectName}` : ''}</option>)}
                      </Select>
                    )}
                  </Field>

                  {/* metric — только для типов с выбираемой метрикой */}
                  {METRIC_TYPED.includes(builder.type) && (
                  <Field label="Metric">
                    <div className="mb-1.5 flex gap-1">
                      {(['count', 'sum', 'avg'] as const).map((mk) => (
                        <button key={mk} type="button" onClick={() => patch({ metricKind: mk, metricAttributeId: mk === 'count' ? null : builder.metricAttributeId })}
                          className={['flex-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold capitalize transition-colors', builder.metricKind === mk ? 'bg-brand-600 text-white' : 'bg-surface-2 text-ink-muted hover:bg-surface-2/70'].join(' ')}>
                          {mk === 'count' ? <Hash size={11} className="mx-auto" /> : mk === 'sum' ? 'Sum' : 'Avg'}
                        </button>
                      ))}
                    </div>
                    {builder.metricKind !== 'count' && (
                      <Select value={builder.metricAttributeId ?? ''} onChange={(v) => patch({ metricAttributeId: v || null })}>
                        <option value="">Select number/currency attribute…</option>
                        {numericAttrs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </Select>
                    )}
                    {builder.metricKind !== 'count' && numericAttrs.length === 0 && <p className="mt-1 text-[10.5px] text-amber-600">This source has no number/currency attributes.</p>}
                  </Field>
                  )}

                  {/* group by — для стадийных типов только SELECT-стадия */}
                  <Field label={STAGE_TYPED.includes(builder.type) ? 'Stage attribute' : 'Group by'}>
                    <Select value={builder.groupByAttributeId ?? ''} onChange={(v) => patch({ groupByAttributeId: v || null })}>
                      <option value="">{STAGE_TYPED.includes(builder.type) ? 'Select a status / select attribute…' : 'None'}</option>
                      {(STAGE_TYPED.includes(builder.type) ? selectAttrs : groupable).map((a) => <option key={a.id} value={a.id}>{a.name}{a.aiEnabled ? ' · AI' : ''}</option>)}
                    </Select>
                    {builder.type === 'HISTORICAL' && (
                      <button type="button" onClick={backfillHistory} disabled={!builder.id} className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-ink-muted hover:bg-surface-2 disabled:opacity-50" title={builder.id ? 'Build snapshot history now' : 'Save the report first'}>
                        <TrendingUp size={11} /> Backfill history
                      </button>
                    )}
                  </Field>

                  {/* period (stage-change only) — окно подсчёта переходов */}
                  {builder.type === 'STAGE_CHANGE' && (
                    <Field label="Period">
                      <div className="flex flex-wrap gap-1">
                        {([['All time', 0], ['7 days', 7], ['30 days', 30], ['90 days', 90]] as const).map(([label, days]) => {
                          const fromIso = days ? new Date(Date.now() - days * 86400000).toISOString() : undefined;
                          const curFrom = builder.config?.dateRange?.from;
                          const active = days === 0 ? !curFrom : !!curFrom && Math.abs((Date.now() - new Date(curFrom).getTime()) / 86400000 - days) < 1;
                          return (
                            <button key={label} type="button" onClick={() => patch({ config: { ...builder.config, dateRange: fromIso ? { from: fromIso } : undefined } })}
                              className={['rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-colors', active ? 'bg-brand-600 text-white' : 'bg-surface-2 text-ink-muted hover:bg-surface-2/70'].join(' ')}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                  )}

                  {/* segment by (insight only) */}
                  {builder.type === 'INSIGHT' && (
                    <Field label="Segment by">
                      <Select value={builder.segmentByAttributeId ?? ''} onChange={(v) => patch({ segmentByAttributeId: v || null })}>
                        <option value="">None</option>
                        {groupable.filter((a) => a.id !== builder.groupByAttributeId).map((a) => <option key={a.id} value={a.id}>{a.name}{a.aiEnabled ? ' · AI' : ''}</option>)}
                      </Select>
                    </Field>
                  )}

                  {/* filters */}
                  <Field label="Filters">
                    <FiltersEditor filters={builder.filters} attributes={sourceAttributes} onChange={(f) => patch({ filters: f })} />
                  </Field>

                  {/* visualization — пользователь выбирает только для Insight */}
                  {builder.type === 'INSIGHT' && (
                    <Field label="Visualization">
                      <div className="flex gap-1">
                        {VIZ.filter((v) => v.key !== 'FUNNEL').map((v) => (
                          <button key={v.key} type="button" onClick={() => patch({ visualization: v.key })}
                            className={['inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold transition-colors', builder.visualization === v.key ? 'bg-brand-600 text-white' : 'bg-surface-2 text-ink-muted hover:bg-surface-2/70'].join(' ')}>
                            {v.icon} {v.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                  )}
                </div>

                {/* Preview panel */}
                <div className="p-4">
                  <PreviewPane result={preview} loading={previewLoading} error={previewError} onBucketClick={onBucketClick} drillable={!!builder.id} />
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </div>

      {drill && builder?.id && <DrillModal reportId={builder.id} bucketKey={drill.bucketKey} bucketLabel={drill.bucketLabel} segmentKey={drill.segmentKey} onClose={() => setDrill(null)} />}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-subtle">{label}</p>
      {children}
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink outline-none focus:border-brand-400">
      {children}
    </select>
  );
}

function FiltersEditor({ filters, attributes, onChange }: { filters: ReportFilterInput[]; attributes: RbAttribute[]; onChange: (f: ReportFilterInput[]) => void }) {
  const add = () => onChange([...filters, { attributeKey: attributes[0]?.key ?? '', op: 'eq', value: '' }]);
  const upd = (i: number, p: Partial<ReportFilterInput>) => onChange(filters.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  const del = (i: number) => onChange(filters.filter((_, idx) => idx !== i));
  const noValue = (op: ReportFilterOp) => op === 'is_empty' || op === 'is_not_empty';
  return (
    <div className="space-y-1.5">
      {filters.map((f, i) => (
        <div key={i} className="flex items-center gap-1">
          <select value={f.attributeKey} onChange={(e) => upd(i, { attributeKey: e.target.value })} className="min-w-0 flex-1 rounded-md border border-line bg-surface px-1.5 py-1 text-[11px] text-ink outline-none">
            {attributes.map((a) => <option key={a.id} value={a.key}>{a.name}</option>)}
          </select>
          <select value={f.op} onChange={(e) => { const op = e.target.value as ReportFilterOp; upd(i, noValue(op) ? { op, value: '' } : { op }); }} className="shrink-0 rounded-md border border-line bg-surface px-1 py-1 text-[11px] text-ink outline-none">
            {FILTER_OPS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          {!noValue(f.op) && (
            <input value={String(f.value ?? '')} onChange={(e) => upd(i, { value: e.target.value })} placeholder="value"
              className="w-20 shrink-0 rounded-md border border-line bg-surface px-1.5 py-1 text-[11px] text-ink outline-none" />
          )}
          <button type="button" onClick={() => del(i)} className="shrink-0 text-ink-subtle hover:text-rose-600"><X size={13} /></button>
        </div>
      ))}
      <button type="button" onClick={add} disabled={!attributes.length} className="inline-flex items-center gap-1 rounded-md border border-dashed border-line px-2 py-1 text-[11px] font-semibold text-ink-muted hover:bg-surface-2 disabled:opacity-50">
        <FilterIcon size={11} /> Add filter
      </button>
    </div>
  );
}

/* ── Preview pane: рендер результата (bar / line / table / funnel) ── */
function PreviewPane({ result, loading, error, onBucketClick, drillable }: {
  result: ReportResult | null; loading: boolean; error: string | null;
  onBucketClick: (key: string, label: string, segment: string | null) => void; drillable: boolean;
}) {
  if (error) return <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-2 text-center text-ink-subtle"><AlertTriangle size={20} className="text-amber-500" /><p className="text-[12.5px] text-amber-700">{error}</p></div>;
  if (loading && !result) return <div className="flex h-full min-h-[260px] items-center justify-center gap-2 text-ink-subtle"><Loader2 size={16} className="animate-spin" /> Computing…</div>;
  if (!result) return <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-2 text-ink-subtle"><BarChart3 size={22} /><p className="text-[12.5px]">Pick a source to preview the chart.</p></div>;

  const fmt = (n: number | null) => n === null ? '—'
    : result.currencyCode ? `${result.currencyCode} ${n.toLocaleString('en-US')}`
      : result.metricUnit ? `${n.toLocaleString('en-US')} ${result.metricUnit}`
        : n.toLocaleString('en-US');
  // Drill осмыслен только для INSIGHT/FUNNEL (bucketKey = значение группы → реальные записи).
  const canDrill = drillable && (result.type === 'INSIGHT' || result.type === 'FUNNEL');

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h3 className="text-[13px] font-bold text-ink">{result.metricLabel}</h3>
        {result.groupByLabel && <span className="text-[11.5px] text-ink-subtle">by {result.groupByLabel}{result.segmentByLabel ? ` · split by ${result.segmentByLabel}` : ''}</span>}
        <span className="ml-auto text-[11px] text-ink-subtle">{result.totalRecords} record{result.totalRecords === 1 ? '' : 's'}</span>
      </div>

      {result.warnings.length > 0 && (
        <div className="mb-3 space-y-1">
          {result.warnings.map((w, i) => <p key={i} className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700"><AlertTriangle size={11} /> {w}</p>)}
        </div>
      )}

      {result.type === 'HISTORICAL' ? (
        <HistoryChart result={result} fmt={fmt} />
      ) : result.buckets.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-1.5 text-ink-subtle"><Layers size={20} /><p className="text-[12.5px]">No data for this configuration yet.</p></div>
      ) : result.type === 'FUNNEL' ? (
        <FunnelChart result={result} fmt={fmt} onBucketClick={onBucketClick} drillable={canDrill} />
      ) : result.visualization === 'TABLE' ? (
        <TableChart result={result} fmt={fmt} onBucketClick={onBucketClick} drillable={canDrill} />
      ) : result.visualization === 'LINE' ? (
        <LineChartView result={result} fmt={fmt} />
      ) : (
        <BarChart result={result} fmt={fmt} onBucketClick={onBucketClick} drillable={canDrill} />
      )}

      {canDrill && result.buckets.length > 0 && result.type !== 'FUNNEL' && result.visualization !== 'LINE' && (
        <p className="mt-2 text-[10.5px] text-ink-subtle">Click any bar / row to drill into the records behind it.</p>
      )}
    </div>
  );
}

function BarChart({ result, fmt, onBucketClick, drillable }: { result: ReportResult; fmt: (n: number | null) => string; onBucketClick: (k: string, l: string, s: string | null) => void; drillable: boolean }) {
  const max = Math.max(1, ...result.buckets.map((b) => b.value ?? 0));
  const hasSeg = result.segmentKeys.length > 0;
  return (
    <div className="space-y-2">
      {hasSeg && (
        <div className="mb-1 flex flex-wrap gap-2">
          {result.segmentKeys.map((s, i) => <span key={s.key} className="inline-flex items-center gap-1 text-[10.5px] text-ink-muted"><span className="h-2 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} /> {s.label}</span>)}
        </div>
      )}
      {result.buckets.map((b) => (
        <button key={b.key} type="button" onClick={() => drillable && onBucketClick(b.key, b.label, null)} className={['flex w-full items-center gap-3 rounded-lg px-1 py-0.5 text-left', drillable ? 'hover:bg-surface-2/60' : 'cursor-default'].join(' ')}>
          <span className="flex w-28 shrink-0 items-center gap-0.5 truncate text-[12px] font-medium text-ink-muted" title={b.label}>{b.label}{drillable && <ChevronRight size={11} className="shrink-0 text-ink-subtle" />}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-surface-2">
            {hasSeg ? (
              <div className="flex h-full">
                {result.segmentKeys.map((s, i) => {
                  const seg = b.segments?.find((x) => x.key === s.key);
                  const v = seg?.value ?? 0;
                  return v > 0 ? <div key={s.key} title={`${s.label}: ${fmt(v)}`} style={{ width: `${(v / max) * 100}%`, background: SERIES_COLORS[i % SERIES_COLORS.length] }} /> : null;
                })}
              </div>
            ) : (
              <div className="flex h-full items-center rounded-md bg-gradient-to-r from-brand-500 to-brand-400 px-2" style={{ width: `${Math.max(((b.value ?? 0) / max) * 100, 4)}%` }} />
            )}
          </div>
          <span className="w-20 shrink-0 text-right text-[11.5px] font-semibold tabular-nums text-ink">{fmt(b.value)}</span>
        </button>
      ))}
    </div>
  );
}

function TableChart({ result, fmt, onBucketClick, drillable }: { result: ReportResult; fmt: (n: number | null) => string; onBucketClick: (k: string, l: string, s: string | null) => void; drillable: boolean }) {
  const hasSeg = result.segmentKeys.length > 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-line text-left text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">
            <th className="py-2 pr-3">{result.groupByLabel ?? 'Group'}</th>
            {hasSeg ? result.segmentKeys.map((s) => <th key={s.key} className="px-2 text-right">{s.label}</th>) : null}
            <th className="px-2 text-right">{result.metricLabel}</th>
          </tr>
        </thead>
        <tbody>
          {result.buckets.map((b) => (
            <tr key={b.key} className={['border-b border-line/60 last:border-0', drillable ? 'cursor-pointer hover:bg-surface-2/50' : ''].join(' ')} onClick={() => drillable && onBucketClick(b.key, b.label, null)}>
              <td className="py-2 pr-3 font-semibold text-ink">{b.label}</td>
              {hasSeg ? result.segmentKeys.map((s) => <td key={s.key} className="px-2 text-right tabular-nums text-ink-muted">{fmt(b.segments?.find((x) => x.key === s.key)?.value ?? null)}</td>) : null}
              <td className="px-2 text-right font-semibold tabular-nums text-ink">{fmt(b.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LineChartView({ result, fmt }: { result: ReportResult; fmt: (n: number | null) => string }) {
  const W = 640, H = 200, padL = 8, padB = 22, padT = 8;
  const n = result.buckets.length;
  const max = Math.max(1, ...result.buckets.map((b) => b.value ?? 0));
  const x = (i: number) => padL + (n <= 1 ? (W - padL - 8) / 2 : (i / (n - 1)) * (W - padL - 8));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const line = result.buckets.map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(b.value ?? 0).toFixed(1)}`).join(' ');
  const every = Math.ceil(n / 8);
  return (
    <div style={{ fontFeatureSettings: 'normal' }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 220 }} preserveAspectRatio="none">
        {[0, 0.5, 1].map((f, i) => <line key={i} x1={padL} y1={y(max * f)} x2={W} y2={y(max * f)} stroke="var(--line)" strokeWidth={1} />)}
        <path d={line} fill="none" stroke="var(--brand-500)" strokeWidth={2} strokeLinejoin="round" />
        {result.buckets.map((b, i) => <circle key={b.key} cx={x(i)} cy={y(b.value ?? 0)} r={2.5} fill="var(--brand-600)" />)}
        {result.buckets.map((b, i) => (i % every === 0 || i === n - 1) ? <text key={b.key} x={x(i)} y={H - 6} fontSize={9} fill="var(--ink-subtle)" textAnchor="middle">{b.label.slice(0, 10)}</text> : null)}
      </svg>
      <p className="mt-1 text-[11px] text-ink-subtle">Peak {fmt(max)} · {n} points</p>
    </div>
  );
}

// Historical: мультисерийная линия по снапшотам (X = snapshotAt, серия = бакет группировки).
function HistoryChart({ result, fmt }: { result: ReportResult; fmt: (n: number | null) => string }) {
  const history = result.history ?? [];
  if (history.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-center text-ink-subtle">
        <TrendingUp size={22} />
        <p className="max-w-xs text-[12.5px]">Not enough historical data yet. Snapshots accumulate daily — or click <b>Backfill history</b> to reconstruct from stage history.</p>
      </div>
    );
  }
  // серии = объединение ключей бакетов по всем точкам
  const seriesMap = new Map<string, string>();
  history.forEach((p) => p.buckets.forEach((b) => { if (!seriesMap.has(b.key)) seriesMap.set(b.key, b.label); }));
  const series = [...seriesMap.entries()];
  const W = 660, H = 220, padL = 8, padB = 24, padT = 8;
  const n = history.length;
  const allVals = history.flatMap((p) => p.buckets.map((b) => b.value ?? 0));
  const max = Math.max(1, ...allVals);
  const x = (i: number) => padL + (n <= 1 ? (W - padL - 8) / 2 : (i / (n - 1)) * (W - padL - 8));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const every = Math.ceil(n / 7);
  const valAt = (pi: number, key: string) => history[pi].buckets.find((b) => b.key === key)?.value ?? 0;
  return (
    <div style={{ fontFeatureSettings: 'normal' }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 240 }} preserveAspectRatio="none">
        {[0, 0.5, 1].map((f, i) => <line key={i} x1={padL} y1={y(max * f)} x2={W} y2={y(max * f)} stroke="var(--line)" strokeWidth={1} />)}
        {series.map(([key], si) => {
          const d = history.map((_p, pi) => `${pi === 0 ? 'M' : 'L'}${x(pi).toFixed(1)},${y(valAt(pi, key)).toFixed(1)}`).join(' ');
          return <path key={key} d={d} fill="none" stroke={SERIES_COLORS[si % SERIES_COLORS.length]} strokeWidth={2} strokeLinejoin="round" />;
        })}
        {history.map((p, i) => (i % every === 0 || i === n - 1) ? <text key={i} x={x(i)} y={H - 7} fontSize={9} fill="var(--ink-subtle)" textAnchor="middle">{p.snapshotAt.slice(5, 10)}</text> : null)}
      </svg>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {series.map(([key, label], si) => <span key={key} className="inline-flex items-center gap-1 text-[10.5px] text-ink-muted"><span className="h-2 w-3 rounded-full" style={{ background: SERIES_COLORS[si % SERIES_COLORS.length] }} /> {label}</span>)}
      </div>
      <p className="mt-1 text-[11px] text-ink-subtle">{n} snapshot{n === 1 ? '' : 's'} · peak {fmt(max)}</p>
    </div>
  );
}

function FunnelChart({ result, fmt, onBucketClick, drillable }: { result: ReportResult; fmt: (n: number | null) => string; onBucketClick: (k: string, l: string, s: string | null) => void; drillable: boolean }) {
  const max = Math.max(1, ...result.buckets.map((b) => b.value ?? 0));
  return (
    <div className="space-y-2">
      {result.buckets.map((b) => {
        const pct = Math.round(((b.value ?? 0) / max) * 100);
        return (
          <button key={b.key} type="button" onClick={() => drillable && onBucketClick(b.key, b.label, null)} className={['flex w-full items-center gap-3 rounded-lg px-1 py-0.5 text-left', drillable ? 'hover:bg-surface-2/60' : 'cursor-default'].join(' ')}>
            <span className="flex w-28 shrink-0 items-center gap-0.5 truncate text-[12px] font-semibold text-ink-muted" title={b.label}>{b.label}{drillable && <ChevronRight size={11} className="text-ink-subtle" />}</span>
            <div className="h-7 flex-1 overflow-hidden rounded-lg bg-surface-2">
              <div className="flex h-full items-center rounded-lg bg-gradient-to-r from-violet-500 to-violet-400 px-2" style={{ width: `${Math.max(pct, 5)}%` }}>
                <span className="text-[11px] font-bold text-white">{fmt(b.value)}</span>
              </div>
            </div>
            <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-ink-subtle">
              {b.conversionFromPrevious !== null && b.conversionFromPrevious !== undefined ? `${Math.round(b.conversionFromPrevious * 100)}% prev` : '—'}
              {b.conversionFromFirst !== null && b.conversionFromFirst !== undefined ? ` · ${Math.round(b.conversionFromFirst * 100)}% total` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Drill modal: реальные записи бакета. Источник — ЛИБО сохранённый отчёт (reportId),
      ЛИБО виджет дашборда (dashboardId+widgetId, DSH-3). Один и тот же DrillResult/верстка. ── */
function DrillModal({ reportId, dashboardId, widgetId, bucketKey, bucketLabel, segmentKey, onClose }: { reportId?: string; dashboardId?: string; widgetId?: string; bucketKey: string; bucketLabel: string; segmentKey: string | null; onClose: () => void }) {
  const [data, setData] = useState<ReportDrillResult | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const p = reportId
      ? reportBuilderApi.drill(reportId, bucketKey, segmentKey)
      : dashboardsApi.drillWidget(dashboardId!, widgetId!, bucketKey, segmentKey);
    p.then(setData).catch(() => setErr(true));
  }, [reportId, dashboardId, widgetId, bucketKey, segmentKey]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h3 className="text-[14px] font-extrabold text-ink">Records · {bucketLabel}</h3>
            <p className="text-[11.5px] text-ink-subtle">{!data && !err ? 'Loading…' : err ? 'Could not load' : `${data!.total} record${data!.total === 1 ? '' : 's'} contributing to this value`}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-ink-subtle hover:bg-surface-2"><X size={16} /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!data ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-ink-subtle">{err ? 'Error' : <><Loader2 size={14} className="animate-spin" /> Loading records…</>}</div>
          ) : data.records.length === 0 ? (
            <p className="py-10 text-center text-[12.5px] text-ink-subtle">No records in this bucket.</p>
          ) : data.records.map((r) => (
            <Link key={r.recordId} href={r.href} className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-surface-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand-700">{r.displayName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '–'}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{r.displayName}</span>
              {r.metricValue !== null && <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink-muted">{r.metricValue.toLocaleString('en-US')}</span>}
            </Link>
          ))}
        </div>
        {data && data.records.length < data.total && (
          <div className="border-t border-line px-4 py-2 text-[11px] text-ink-subtle">Showing the first {data.records.length} of {data.total} records.</div>
        )}
      </div>
    </div>
  );
}

/* ════════════════ Dashboards view: грид виджетов-отчётов (M18-2) ════════════════ */
function DashboardsView({ reports }: { reports: ReportRow[] }) {
  const toast = useToast();
  const [list, setList] = useState<DashboardListItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DashboardDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // DSH-3: drill-in из конкретного виджета (по клику на бакет/строку)
  const [wDrill, setWDrill] = useState<{ widgetId: string; bucketKey: string; bucketLabel: string; segmentKey: string | null } | null>(null);

  const loadList = useCallback(() => { dashboardsApi.list().then(setList).catch(() => {}); }, []);
  useEffect(() => { loadList(); }, [loadList]);
  const loadDetail = useCallback((id: string) => { setLoading(true); dashboardsApi.get(id).then(setDetail).catch(() => setDetail(null)).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (openId) loadDetail(openId); else setDetail(null); }, [openId, loadDetail]);

  async function createDashboard() {
    const name = window.prompt('Dashboard name:', 'Revenue dashboard');
    if (!name) return;
    // clientRequestId → идемпотентность: случайный двойной submit не плодит второй дашборд
    try { const d = await dashboardsApi.create(name, null, crypto.randomUUID()); setList((p) => [d, ...p.filter((x) => x.id !== d.id)]); setOpenId(d.id); toast.success('Dashboard created', name); }
    catch { toast.error('Could not create dashboard'); }
  }
  async function removeDashboard(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try { await dashboardsApi.remove(id); setList((p) => p.filter((d) => d.id !== id)); if (openId === id) setOpenId(null); toast.success('Dashboard deleted'); }
    catch { toast.error('Could not delete'); }
  }
  async function addWidget(reportId: string) {
    if (!openId) return;
    try { await dashboardsApi.addWidget(openId, reportId, crypto.randomUUID()); setAddOpen(false); loadDetail(openId); loadList(); toast.success('Widget added', 'Linked — updates when the report changes.'); }
    catch (e: unknown) { const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error; toast.error('Could not add widget', m ?? 'You may not have access to that report’s data.'); }
  }
  // DSH-2: inline снимок — копируем текущий config отчёта в immutable-виджет (изменение отчёта его НЕ меняет)
  async function addSnapshot(r: ReportRow) {
    if (!openId) return;
    const cfg: ReportConfigPayload = { name: `${r.name} (snapshot)`, type: r.type, sourceType: r.sourceType, sourceObjectId: r.sourceObjectId, sourceListId: r.sourceListId, metric: r.metric, groupByAttributeId: r.groupByAttributeId, segmentByAttributeId: r.segmentByAttributeId, filters: r.filters, visualization: r.visualization, config: r.config };
    try { await dashboardsApi.addWidgetInline(openId, cfg, crypto.randomUUID()); setAddOpen(false); loadDetail(openId); loadList(); toast.success('Snapshot added', 'Frozen report config, detached from the report — data stays live.'); }
    catch (e: unknown) { const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error; toast.error('Could not add snapshot', m ?? 'You may not have access to that report’s data.'); }
  }
  async function removeWidget(widgetId: string) {
    if (!openId) return;
    // remove виджета НЕ удаляет Report — только убирает с дашборда
    try { await dashboardsApi.removeWidget(openId, widgetId); loadDetail(openId); loadList(); }
    catch { toast.error('Could not remove widget'); }
  }
  // reorder: меняем местами order соседних виджетов (оба PATCH персистятся, переживает reload)
  async function moveWidget(idx: number, dir: -1 | 1) {
    if (!openId || !detail) return;
    const ws = detail.widgets;
    const j = idx + dir;
    if (j < 0 || j >= ws.length) return;
    const a = ws[idx]; const b = ws[j];
    try { await Promise.all([dashboardsApi.patchWidget(openId, a.id, { order: b.order }), dashboardsApi.patchWidget(openId, b.id, { order: a.order })]); loadDetail(openId); }
    catch { toast.error('Could not reorder'); }
  }
  // resize: переключаем ширину виджета half(6)↔full(12) — реальный PATCH, переживает reload
  async function resizeWidget(w: DashboardWidgetItem) {
    if (!openId) return;
    const nextW = w.w >= 9 ? 6 : 12;
    try { await dashboardsApi.patchWidget(openId, w.id, { w: nextW }); loadDetail(openId); }
    catch { toast.error('Could not resize'); }
  }

  if (openId && detail) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setOpenId(null)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-ink-muted hover:bg-surface-2">← Dashboards</button>
            <h2 className="text-[15px] font-bold text-ink">{detail.dashboard.name}</h2>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">{detail.widgets.length} widget{detail.widgets.length === 1 ? '' : 's'}</span>
          </div>
          <div className="relative">
            <button type="button" onClick={() => setAddOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-[12.5px] font-semibold text-white shadow-brand hover:bg-brand-700"><Plus size={14} /> Add widget</button>
            {addOpen && (
              <div className="absolute right-0 z-20 mt-1 max-h-80 w-80 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                <p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink-subtle">Add a report widget</p>
                {reports.length === 0 ? <p className="px-2 py-2 text-[11.5px] text-ink-subtle">No saved reports yet. Build one in the Reports tab.</p> : reports.map((r) => (
                  <div key={r.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                    <span className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${TYPE_CHIP[r.type] ?? 'bg-surface-2 text-ink-muted'}`}>{r.type.replace('_', ' ')}</span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink" title={r.name}>{r.name}</span>
                    {/* Live = linked (обновляется при смене отчёта); Snapshot = inline immutable */}
                    <button type="button" onClick={() => addWidget(r.id)} title="Add live — updates when the report changes" className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">Live</button>
                    {/* Snapshot = inline immutable config. HISTORICAL копит снапшоты по reportId → как inline всегда пуст: кнопку гасим, объясняем почему. */}
                    {r.type === 'HISTORICAL' ? (
                      <span title="Historical reports track snapshots over time and need a saved report — add as Live" className="shrink-0 inline-flex cursor-not-allowed items-center gap-0.5 rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-subtle opacity-50"><Lock size={9} /> Snapshot</span>
                    ) : (
                      <button type="button" onClick={() => addSnapshot(r)} title="Add snapshot — frozen report config, detached from the report (data stays live)" className="shrink-0 inline-flex items-center gap-0.5 rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"><Lock size={9} /> Snapshot</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{[0, 1].map((i) => <div key={i} className="skeleton h-64 rounded-xl" />)}</div>
        ) : detail.widgets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface py-14 text-ink-subtle"><Grid3x3 size={22} /><p className="text-[13px]">Empty dashboard — click <b>Add widget</b> to place a report here.</p></div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {detail.widgets.map((w, idx) => (
              <div key={w.id} className={`rounded-2xl border border-line bg-surface p-4 shadow-xs ${w.w >= 9 ? 'lg:col-span-2' : ''}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {(w.reportType ?? w.report?.type) && <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase ${TYPE_CHIP[(w.reportType ?? w.report?.type) as string] ?? 'bg-surface-2 text-ink-muted'}`}>{((w.reportType ?? w.report?.type) as string).replace('_', ' ')}</span>}
                    {w.inline && <span className="shrink-0 inline-flex items-center gap-0.5 rounded bg-surface-2 px-1 py-0.5 text-[9px] font-bold uppercase text-ink-muted" title="Snapshot — frozen report config, detached from the source report (data stays live)"><Lock size={8} /> Snapshot</span>}
                    <h3 className="min-w-0 truncate text-[13px] font-bold text-ink">{w.title ?? w.report?.name ?? 'Removed report'}</h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 text-ink-subtle">
                    {/* reorder — реальный PATCH widget.order, переживает reload */}
                    <button type="button" disabled={idx === 0} onClick={() => moveWidget(idx, -1)} title="Move left" className="rounded p-0.5 hover:bg-surface-2 hover:text-ink disabled:opacity-30"><ArrowLeft size={13} /></button>
                    <button type="button" disabled={idx === detail.widgets.length - 1} onClick={() => moveWidget(idx, 1)} title="Move right" className="rounded p-0.5 hover:bg-surface-2 hover:text-ink disabled:opacity-30"><ArrowRight size={13} /></button>
                    {/* resize — реальный PATCH widget.w (half↔full), переживает reload */}
                    <button type="button" onClick={() => resizeWidget(w)} title={w.w >= 9 ? 'Half width' : 'Full width'} className="rounded p-0.5 hover:bg-surface-2 hover:text-ink">{w.w >= 9 ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>
                    <button type="button" onClick={() => removeWidget(w.id)} title="Remove from dashboard (keeps the report)" className="rounded p-0.5 hover:bg-surface-2 hover:text-rose-600"><X size={14} /></button>
                  </div>
                </div>
                {w.missing ? (
                  <div className="flex min-h-[180px] flex-col items-center justify-center gap-1.5 text-ink-subtle"><AlertTriangle size={18} className="text-amber-500" /><p className="text-[12px]">Report unavailable or archived.</p></div>
                ) : w.restricted ? (
                  <div className="flex min-h-[180px] flex-col items-center justify-center gap-1.5 text-ink-subtle"><Lock size={18} className="text-ink-subtle" /><p className="text-[12px]">You don’t have access to this report’s data.</p></div>
                ) : (
                  // DSH-3: виджет drill-able (если не missing/restricted); PreviewPane сам разрешит drill только для INSIGHT/FUNNEL
                  <PreviewPane result={w.result} loading={false} error={null} onBucketClick={(key, label, seg) => setWDrill({ widgetId: w.id, bucketKey: key, bucketLabel: label, segmentKey: seg })} drillable />
                )}
              </div>
            ))}
          </div>
        )}
        {wDrill && openId && <DrillModal dashboardId={openId} widgetId={wDrill.widgetId} bucketKey={wDrill.bucketKey} bucketLabel={wDrill.bucketLabel} segmentKey={wDrill.segmentKey} onClose={() => setWDrill(null)} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-ink">Dashboards</h2>
          <p className="text-[12px] text-ink-subtle">Arrange saved reports on a canvas. Historical, time-in-stage and stage-change widgets live here too.</p>
        </div>
        <button type="button" onClick={createDashboard} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-[12.5px] font-semibold text-white shadow-brand hover:bg-brand-700"><Plus size={14} /> New dashboard</button>
      </div>
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface py-12 text-ink-subtle"><Grid3x3 size={22} /><p className="text-[13px]">No dashboards yet — click <b>New dashboard</b> to assemble report widgets.</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((d) => (
            <button key={d.id} type="button" onClick={() => setOpenId(d.id)} className="group rounded-xl border border-line bg-surface p-3.5 text-left shadow-xs transition-colors hover:border-brand-200 hover:bg-brand-50/30">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ink">{d.name}</span>
                <span role="button" tabIndex={0} onClick={(e) => removeDashboard(d.id, e)} className="shrink-0 text-ink-subtle opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"><Trash2 size={13} /></span>
              </div>
              {d.description && <p className="mt-0.5 truncate text-[11.5px] text-ink-subtle">{d.description}</p>}
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-ink-muted"><Grid3x3 size={11} /> {d.widgetCount} widget{d.widgetCount === 1 ? '' : 's'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
