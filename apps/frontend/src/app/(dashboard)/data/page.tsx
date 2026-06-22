'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Database,
  Bot,
  Sparkles,
  Search,
  Plus,
  Upload,
  FlaskConical,
  Send,
  Radar,
  ScanEye,
  AlertTriangle,
  ShieldCheck,
  Globe,
  User,
  FileSearch,
  Layers,
  Banknote,
  Loader2,
  CheckCircle2,
  Table2,
  LayoutGrid,
  Lock,
  History,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Topbar from '@/components/layout/Topbar';
import RecordDrawer from '@/components/data/RecordDrawer';
import BulkRunPanel, { type BulkAiAttr } from '@/components/data/BulkRunPanel';
import ReviewQueue from '@/components/data/ReviewQueue';
import CreateRecordModal from '@/components/data/CreateRecordModal';
import ImportModal from '@/components/data/ImportModal';
import ImportHistoryModal from '@/components/data/ImportHistoryModal';
import DataHubControls, { type QueryState } from '@/components/data/DataHubControls';
import BulkActionModal, { type BulkMode } from '@/components/data/BulkActionModal';
import ViewsBar from '@/components/data/ViewsBar';
import DataHubBoard from '@/components/data/DataHubBoard';
import {
  listObjects,
  listRecords,
  getObject,
  runAiForRecord,
  moveRecord,
  createView,
  updateView,
  listViews,
  deleteView,
  bulkStageRecords,
  enrollRecordsToCampaign,
  getAiMetrics,
  type AiMetrics,
  type CrmObject,
  type CrmRecord,
  type CrmAttribute,
  type CrmView,
  type CrmViewFilter,
  type CrmViewSort,
  type CrmFilterNode,
  type CrmViewScope,
  type CrmCalcType,
  type CrmCalcRequest,
  type CrmCalcResult,
} from '@/lib/crmApi';
import CalcFooter from '@/components/data/CalcFooter';
import { campaignsApi, teamApi } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

/* ──────────────────────────────────────────────────────────────────────────
   Data Hub (/data) — Agent-enriched data foundation. ЖИВЫЕ ДАННЫЕ из backend
   (objects/records). M5/V1: настоящие Views — селектор представлений, персист
   filters/sorts/columns в БД, активный вид в localStorage. Вся фильтрация идёт
   через backend → counts в UI совпадают с backend results (нет клиентского
   предиката поверх выборки).
   ────────────────────────────────────────────────────────────────────────── */

const sourceDot: Record<string, string> = { AI: 'bg-brand-500', web: 'bg-cyan-500', mailbox: 'bg-violet-500', human: 'bg-emerald-500', import: 'bg-ink-subtle' };
function confColor(v: number): string { return v >= 85 ? 'text-emerald-600' : v >= 60 ? 'text-amber-600' : 'text-rose-600'; }

// Ячейка ICP-fit: показываем САМО число icp_fit (с тоном High/Mid/Low) + ОТДЕЛЬНО подписанную
// provenance-confidence (%). Так фильтр/сортировка по icp_fit видимы и проверяемы глазами,
// а confidence не путается с самим скором.
function IcpCell({ icp, fit, conf, source, warn }: { icp: number | null; fit: string | null; conf?: number | null; source?: string; warn?: boolean }) {
  if (icp == null || !fit) return <span className="text-[11px] text-ink-subtle">— not scored</span>;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${fitTone(fit)}`} title={`${fit} ICP fit · score ${icp}`}>{icp}</span>
      {conf != null && (
        <span className="inline-flex shrink-0 items-center gap-1" title="Provenance confidence (how sure the agent is)">
          {source && <span className={`h-1.5 w-1.5 rounded-full ${sourceDot[source] ?? 'bg-ink-subtle'}`} title={`source: ${source}`} />}
          <span className={`text-[10px] font-semibold ${warn ? 'text-rose-600' : confColor(conf)}`}>{conf}%</span>
          <span className="text-[9px] font-medium uppercase tracking-[0.04em] text-ink-subtle">conf</span>
          {source === 'AI' && <Sparkles size={9} className="text-brand-500" />}
          {warn && <AlertTriangle size={10} className="text-rose-500" />}
        </span>
      )}
    </div>
  );
}

const fitTone = (f: string) => f === 'High' ? 'bg-emerald-50 text-emerald-700' : f === 'Mid' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600';
const signalTone: Record<string, string> = { Hiring: 'bg-brand-50 text-brand-700', Funding: 'bg-emerald-50 text-emerald-700', Intent: 'bg-orange-50 text-orange-600', Tech: 'bg-violet-50 text-violet-700', Pain: 'bg-rose-50 text-rose-600' };
const enrichTone = (s: string) => /enrich/i.test(s) ? 'bg-emerald-50 text-emerald-700' : /research/i.test(s) ? 'bg-violet-50 text-violet-700' : /partial|stale/i.test(s) ? 'bg-amber-50 text-amber-700' : /below|disqual/i.test(s) ? 'bg-rose-50 text-rose-600' : 'bg-surface-2 text-ink-muted';

// строка таблицы из реальной записи
interface Row {
  id: string; name: string; domain: string; initials: string; tone: string;
  icp: number | null; fit: string | null; conf: number | null; source?: string; fitWarn?: boolean;
  signals: string[]; dm: string; dmWarn?: boolean; enrich?: string; lastAction?: string; segment?: string; employees?: string; needsReview?: boolean; researched?: boolean;
}
const TONES = ['from-[#6366f1] to-[#8b5cf6]', 'from-[#06b6d4] to-[#4f46e5]', 'from-[#8b5cf6] to-[#d946ef]', 'from-[#10b981] to-[#06b6d4]', 'from-[#f59e0b] to-[#f43f5e]', 'from-[#f43f5e] to-[#8b5cf6]'];
function initials(n: string) { return (n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }
function num(v: unknown): number | null { return typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(+v) ? +v : null; }
function str(v: unknown): string | undefined { return typeof v === 'string' ? v : undefined; }
function arr(v: unknown): string[] { return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; }

function toRow(r: CrmRecord, i: number): Row {
  const v = r.values || {};
  const icp = num(v.icp_fit);
  const conf = num(v.icp_confidence);
  const fit = icp == null ? null : icp >= 85 ? 'High' : icp >= 60 ? 'Mid' : 'Low';
  const dm = str(v.decision_makers) ?? '—';
  const enrich = str(v.enrichment_status);
  const name = r.displayName || str(v.name) || 'Untitled';
  const domain = (str(v.domain) ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const needsReview = (conf != null && conf < 60) || /partial|needs review/i.test(enrich ?? '');
  return {
    id: r.id, name, domain, initials: initials(name), tone: TONES[i % TONES.length],
    icp, fit, conf, source: str(v.source), fitWarn: needsReview && fit != null,
    signals: arr(v.signals), dm, dmWarn: /missing|^-$|^—$/i.test(dm), enrich, lastAction: str(v.last_agent_action),
    segment: str(v.segment), employees: str(v.employeeRange) ?? str(v.employees), needsReview,
    researched: !!(str(v.ai_research) || str(v.ai_brief)),
  };
}

// человекочитаемые подписи AI-SDR стадий (в тостах/UI вместо сырого enum)
const STAGE_LABELS: Record<string, string> = {
  sourced: 'Sourced', researching: 'Researching', ready_to_engage: 'Ready to engage',
  engaging: 'Engaging', in_conversation: 'In conversation', meeting_set: 'Meeting set',
  handed_off: 'Handed off', nurture: 'Nurture', recycle: 'Recycle', suppressed: 'Suppressed',
  disqualified: 'Disqualified',
};
const stageLabel = (s: string) => STAGE_LABELS[s] ?? s;

// Пресеты быстрых фильтров — все на РЕАЛЬНЫХ атрибутах companies (backend filter).
// `needs` — какие атрибуты обязаны существовать у объекта, иначе пресет скрыт.
interface Preset { key: string; label: string; tone: string; filters: CrmViewFilter[]; needs: string[] }
const PRESETS: Preset[] = [
  { key: 'needs_review', label: 'Needs review', tone: 'bg-rose-500', needs: ['icp_confidence'], filters: [{ attributeKey: 'icp_confidence', op: 'lt', value: '60' }] },
  { key: 'missing_dm', label: 'Missing decision-maker', tone: 'bg-amber-500', needs: ['decision_makers'], filters: [{ attributeKey: 'decision_makers', op: 'is_empty' }] },
  { key: 'ready', label: 'Ready for campaign', tone: 'bg-emerald-500', needs: ['icp_fit', 'enrichment_status'], filters: [{ attributeKey: 'icp_fit', op: 'gt', value: '79' }, { attributeKey: 'enrichment_status', op: 'contains', value: 'enrich' }] },
];

// видимость колонок, сохранённая в config представления
function hiddenFromConfig(config: Record<string, unknown> | null | undefined): string[] {
  if (!config || typeof config !== 'object') return [];
  const hc = (config as Record<string, unknown>).hiddenCols;
  return Array.isArray(hc) ? hc.filter((x): x is string => typeof x === 'string') : [];
}

// M24-3: калькуляции, сохранённые в config представления { attributeKey: type }
const CALC_TYPES_SET = new Set<CrmCalcType>(['count', 'sum', 'avg', 'min', 'max', 'empty']);
function calcsFromConfig(config: Record<string, unknown> | null | undefined): Record<string, CrmCalcType> {
  const raw = config && typeof config === 'object' ? (config as Record<string, unknown>).calcs : null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, CrmCalcType> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'string' && CALC_TYPES_SET.has(v as CrmCalcType)) out[k] = v as CrmCalcType;
  return out;
}
function calcsToRequests(calcs: Record<string, CrmCalcType> | undefined): CrmCalcRequest[] {
  return Object.entries(calcs ?? {}).map(([attributeKey, type]) => ({ attributeKey, type }));
}
// нормализованная сигнатура calcs (порядок ключей не влияет — нет ложного dirty после reload)
function calcsSig(calcs: Record<string, CrmCalcType> | undefined): string {
  return Object.keys(calcs ?? {}).sort().map((k) => `${k}:${calcs![k]}`).join(',');
}

// M24-1: нормализованная сигнатура filter tree (порядок узлов значим; значения коэрсятся к строке,
// пустые ops без value — чтобы dirty не «дрожал» после reload из-за number↔string).
function treeSig(node: CrmFilterNode | null | undefined): string {
  if (!node) return '';
  if ('children' in node) return `(${node.op}:${node.children.map(treeSig).join(',')})`;
  const v = node.op === 'is_empty' || node.op === 'is_not_empty'
    ? ''
    : node.value == null ? '' : Array.isArray(node.value) ? node.value.map(String).join('|') : String(node.value);
  return `${node.attributeKey}.${node.op}.${v}`;
}

// стабильная сигнатура запроса (для детекта несохранённых изменений)
function qSig(filters: CrmViewFilter[], sorts: CrmViewSort[], hidden: string[], tree?: CrmFilterNode | null, calcs?: Record<string, CrmCalcType>): string {
  const f = filters.map((x) => ({ a: x.attributeKey, o: x.op, v: x.op === 'is_empty' || x.op === 'is_not_empty' ? '' : (x.value == null ? '' : String(x.value)) }));
  const s = sorts.map((x) => ({ a: x.attributeKey, d: x.dir }));
  return JSON.stringify({ f, s, h: [...hidden].sort(), t: treeSig(tree), c: calcsSig(calcs) });
}

export default function DataHubPage() {
  const [objects, setObjects] = useState<CrmObject[]>([]);
  // стартуем с 'companies' (как на сервере); реальный объект восстановим в эффекте после гидрации (см. ниже),
  // иначе чтение localStorage в инициализаторе ломает SSR-гидрацию (server≠client).
  const [objectKey, setObjectKey] = useState('companies');
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [objectTotal, setObjectTotal] = useState<number | null>(null); // unfiltered total объекта — для различения двух empty-state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attrs, setAttrs] = useState<CrmAttribute[]>([]);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [search, setSearch] = useState('');
  // query-фундамент: backend-фильтры/сортировка + локальная видимость колонок + bulk-modal
  const [query, setQuery] = useState<QueryState>({ filters: [], sorts: [] });
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<BulkMode | null>(null);
  const [campaignList, setCampaignList] = useState<{ id: string; name: string }[]>([]);
  // Views (M5): сохранённые представления объекта + активное
  const [views, setViews] = useState<CrmView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(true);
  // Board/Kanban (V2): сырые записи, тип представления, атрибут группировки, лок перетаскиваемой карточки
  const [records, setRecords] = useState<CrmRecord[]>([]);
  const [calculations, setCalculations] = useState<CrmCalcResult[]>([]); // M24-3 footer-агрегаты из backend
  const [aiMetrics, setAiMetrics] = useState<AiMetrics | null>(null); // M9.7 — метрики из реальных AI-значений
  const [viewType, setViewType] = useState<'table' | 'board'>('table');
  const [groupByKey, setGroupByKey] = useState<string>('');
  const [boardBusyId, setBoardBusyId] = useState<string | null>(null);

  useEffect(() => { const u = getStoredUser(); setCanManage(!u || u.role !== 'MEMBER'); }, []);
  useEffect(() => { listObjects().then(setObjects).catch(() => {}); }, []);
  // запоминаем активный объект ЯВНО при смене (не реактивным эффектом — иначе StrictMode/первый рендер
  // перетирают сохранённое значение до восстановления). См. switchObject и deep-link-эффект ниже.
  const persistObject = (key: string) => { if (typeof window !== 'undefined') { try { localStorage.setItem('dh_object', key); } catch { /* noop */ } } };

  // применить вид (или All records при v=null) к текущему запросу
  function applyView(v: CrmView | null, persist = true) {
    if (v) {
      setQuery({
        filters: (v.filters ?? []).map((f) => ({ attributeKey: f.attributeKey, op: f.op, value: f.value })),
        filterTree: v.filterTree ?? null,
        sorts: (v.sorts ?? []).map((s) => ({ attributeKey: s.attributeKey, dir: s.dir })),
        calcs: calcsFromConfig(v.config),
      });
      setHiddenCols(new Set(hiddenFromConfig(v.config)));
      setViewType(v.type === 'board' ? 'board' : 'table');
      if (v.type === 'board' && v.groupByAttributeKey) setGroupByKey(v.groupByAttributeKey);
      setActiveViewId(v.id);
      if (persist && typeof window !== 'undefined') localStorage.setItem('dh_view_' + objectKey, v.id);
    } else {
      setQuery({ filters: [], sorts: [] });
      setHiddenCols(new Set());
      setViewType('table');
      setActiveViewId(null);
      if (persist && typeof window !== 'undefined') localStorage.removeItem('dh_view_' + objectKey);
    }
    setSelected(new Set());
  }

  // загрузка сохранённых видов + восстановление активного при смене объекта
  useEffect(() => {
    let alive = true;
    listViews(objectKey)
      .then((vs) => {
        if (!alive) return;
        const saved = vs.filter((v) => !v.isDefault);
        setViews(saved);
        const storedId = typeof window !== 'undefined' ? localStorage.getItem('dh_view_' + objectKey) : null;
        const match = storedId ? saved.find((v) => v.id === storedId) : null;
        applyView(match ?? null, false);
      })
      .catch(() => { if (alive) { setViews([]); applyView(null, false); } });
    return () => { alive = false; };
  }, [objectKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link из командной палитры (⌘K): ?object=&q=&record=&new=1
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const obj = sp.get('object');
    const qParam = sp.get('q');
    const rec = sp.get('record');
    // объект: deep-link приоритетнее; иначе восстанавливаем последний активный (после гидрации — без SSR-mismatch)
    if (obj) { setObjectKey(obj); persistObject(obj); }
    else { try { const saved = localStorage.getItem('dh_object'); if (saved) setObjectKey(saved); } catch { /* noop */ } }
    if (qParam) setSearch(qParam);
    if (rec) setOpenId(rec);
    if (sp.get('new') === '1') setShowCreate(true);
  }, []);

  // События палитры (когда пользователь уже на /data)
  useEffect(() => {
    function onOpenRecord(e: Event) {
      const d = (e as CustomEvent).detail as { object?: string; record?: string };
      if (d?.object) { setObjectKey(d.object); persistObject(d.object); }
      if (d?.record) setOpenId(d.record);
    }
    function onNewRecord() { setShowCreate(true); }
    window.addEventListener('data:open-record', onOpenRecord);
    window.addEventListener('data:new-record', onNewRecord);
    return () => {
      window.removeEventListener('data:open-record', onOpenRecord);
      window.removeEventListener('data:new-record', onNewRecord);
    };
  }, []);

  // атрибуты объекта (для AI-enrichment, drawer, create)
  useEffect(() => {
    let alive = true;
    getObject(objectKey).then((o) => { if (alive) setAttrs(o.attributes ?? []); }).catch(() => { if (alive) setAttrs([]); });
    return () => { alive = false; };
  }, [objectKey]);

  // список кампаний (для bulk «Add to campaign»)
  useEffect(() => {
    campaignsApi.list().then((cs) => setCampaignList(cs.map((c) => ({ id: c.id, name: c.name })))).catch(() => {});
  }, []);

  // unfiltered total объекта (без фильтров/поиска) — чтобы honest различать «объект пуст» vs «фильтр сузил до 0»
  useEffect(() => {
    let alive = true;
    setObjectTotal(null);
    listRecords({ objectKey, limit: 1 }).then((r) => { if (alive) setObjectTotal(r.pagination?.total ?? 0); }).catch(() => { if (alive) setObjectTotal(0); });
    return () => { alive = false; };
  }, [objectKey]);

  // только заполненные фильтры уходят в backend (для is_empty/is_not_empty значение не нужно)
  const validFilters = (fs: CrmViewFilter[]) => fs.filter((f) => f.op === 'is_empty' || f.op === 'is_not_empty' || (f.value != null && String(f.value) !== ''));

  // записи: реагируют на объект, поиск, фильтры и сортировку (backend listRecords)
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    const t = setTimeout(() => {
      listRecords({ objectKey, limit: 100, search: search.trim() || undefined, filterTree: query.filterTree ?? undefined, filters: validFilters(query.filters), sorts: query.sorts, calcs: calcsToRequests(query.calcs) })
        .then((res) => { if (!alive) return; setRecords(res.records); setRows(res.records.map(toRow)); setTotal(res.pagination?.total ?? res.records.length); setCalculations(res.calculations ?? []); })
        .catch((e) => { if (alive) setError(e?.response?.data?.error ?? 'Failed to load records'); })
        .finally(() => { if (alive) setLoading(false); });
    }, search ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [objectKey, search, query]); // eslint-disable-line react-hooks/exhaustive-deps

  // M9.7 — метрики object-wide (не зависят от поиска/фильтров): грузим при смене объекта.
  useEffect(() => {
    let alive = true;
    getAiMetrics(objectKey).then((m) => { if (alive) setAiMetrics(m); }).catch(() => { if (alive) setAiMetrics(null); });
    return () => { alive = false; };
  }, [objectKey]);

  const objectId = useMemo(() => objects.find((o) => o.key === objectKey)?.id, [objects, objectKey]);
  const objectLabel = useMemo(() => objects.find((o) => o.key === objectKey)?.singularName ?? 'Record', [objects, objectKey]);
  const objectPlural = useMemo(() => objects.find((o) => o.key === objectKey)?.pluralName ?? 'Records', [objects, objectKey]);

  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // AI-атрибут для enrichment: предпочитаем RESEARCH, иначе любой включённый.
  const aiAttr = useMemo(
    () => attrs.find((a) => a.aiEnabled && a.aiType === 'RESEARCH') ?? attrs.find((a) => a.aiEnabled),
    [attrs],
  );
  const costPer = aiAttr?.aiType === 'RESEARCH' ? 10 : 1;

  // ── M9.2 bulk-run: AI-атрибуты объекта + панель массового прогона ──
  const [bulkOpen, setBulkOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false); // M9.3 review queue
  const aiAttrs = useMemo<BulkAiAttr[]>(
    () => attrs.filter((a) => a.aiEnabled && a.aiType).map((a) => ({ id: a.id, name: a.name, aiType: a.aiType as BulkAiAttr['aiType'] })),
    [attrs],
  );
  const recordNameById = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.id, r.name));
    return m;
  }, [rows]);

  // ── Board/Kanban (V2/M24-2): группировка по SELECT ИЛИ USER + перенос карточки ──
  const selectAttrs = useMemo(() => attrs.filter((a) => (a.type === 'SELECT' && (a.options?.length ?? 0) > 0) || a.type === 'USER'), [attrs]);
  const canBoard = selectAttrs.length > 0;
  // дефолтный атрибут группировки при смене объекта (предпочитаем stage/agent_stage)
  useEffect(() => {
    if (!selectAttrs.length) { setGroupByKey(''); return; }
    setGroupByKey((prev) => (selectAttrs.some((a) => a.key === prev) ? prev : (selectAttrs.find((a) => a.key === 'stage') ?? selectAttrs.find((a) => a.key === 'agent_stage') ?? selectAttrs[0]).key));
  }, [selectAttrs]);
  const groupAttr = useMemo(() => attrs.find((a) => a.key === groupByKey && (a.type === 'SELECT' || a.type === 'USER')) ?? null, [attrs, groupByKey]);
  // M24-2: участники org — колонки board при группировке по USER-атрибуту
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => { teamApi.members().then((r) => setUserOptions(r.members.map((m) => ({ value: m.id, label: m.name || m.email })))).catch(() => setUserOptions([])); }, []);

  // перенос карточки: оптимистично + реальный PATCH в БД + откат при ошибке. to=null → «No stage» (очистка).
  async function moveCard(recordId: string, _from: string | null, to: string | null) {
    if (!groupAttr) return;
    const isUser = groupAttr.type === 'USER';
    const label = to == null ? 'No stage' : isUser ? (userOptions.find((u) => u.value === to)?.label ?? to) : ((groupAttr.options ?? []).find((o) => o.value === to)?.label ?? to);
    const opt = isUser ? undefined : (groupAttr.options ?? []).find((o) => o.value === to);
    const optimistic = to == null ? null : isUser ? { id: to, name: label } : (opt ? { id: opt.id, value: opt.value, label: opt.label, color: opt.color } : to);
    const prev = records;
    setRecords((rs) => rs.map((r) => (r.id === recordId ? { ...r, values: { ...(r.values || {}), [groupAttr.key]: optimistic } } : r)));
    setBoardBusyId(recordId);
    try {
      await moveRecord(recordId, groupAttr.key, to);
      flash(`Moved to “${label}” · saved to DB`);
    } catch (e: any) {
      setRecords(prev); // откат карточки к прежней колонке
      const msg = e?.response?.status === 403 ? (e?.response?.data?.error ?? 'No permission to move') : (e?.response?.data?.error ?? 'Move failed — reverted');
      flash(msg);
    } finally {
      setBoardBusyId(null);
    }
  }

  // M9.7 — метрики из реального backend (AI-filled / evidence / needs review / credits).
  // Дёргается вместе с reload() → после run / bulk-run / review approve/reject/edit / failure числа пересчитываются.
  function refreshMetrics() {
    getAiMetrics(objectKey).then(setAiMetrics).catch(() => setAiMetrics(null));
  }

  async function reload() {
    const res = await listRecords({ objectKey, limit: 100, search: search.trim() || undefined, filterTree: query.filterTree ?? undefined, filters: validFilters(query.filters), sorts: query.sorts, calcs: calcsToRequests(query.calcs) });
    setRecords(res.records);
    setRows(res.records.map(toRow));
    setTotal(res.pagination?.total ?? res.records.length);
    setCalculations(res.calculations ?? []);
    // обновим unfiltered total (мог измениться после create/import/stage)
    listRecords({ objectKey, limit: 1 }).then((r) => setObjectTotal(r.pagination?.total ?? 0)).catch(() => {});
    refreshMetrics();
  }

  // Колонки таблицы (видимость персистится в view.config).
  const COLUMNS = [
    { key: 'icp', label: 'ICP-fit' },
    { key: 'signals', label: 'Buying signals' },
    { key: 'dm', label: 'Decision-makers' },
    { key: 'enrich', label: 'Enrichment' },
    { key: 'lastAction', label: 'Last agent action' },
    { key: 'segment', label: 'Segment' },
    { key: 'employees', label: 'Employees' },
  ];
  const toggleCol = (key: string) => setHiddenCols((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const colVisible = (key: string) => !hiddenCols.has(key);

  // ── Views: выбор / сохранение / обновление / переименование / удаление ──
  const activeView = useMemo(() => views.find((v) => v.id === activeViewId) ?? null, [views, activeViewId]);
  const savedSig = useMemo(() => qSig(activeView?.filters ?? [], activeView?.sorts ?? [], hiddenFromConfig(activeView?.config), activeView?.filterTree, calcsFromConfig(activeView?.config)), [activeView]);
  const currentSig = qSig(query.filters, query.sorts, [...hiddenCols], query.filterTree, query.calcs);
  const savedType = activeView?.type ?? 'table';
  // M24-2: смена board groupBy = dirty (board groupBy персистится в saved-view, table/board — разные конфиги).
  const savedGroupBy = activeView?.groupByAttributeKey ?? '';
  const groupByDirty = viewType === 'board' && !!activeView && savedType === 'board' && groupByKey !== savedGroupBy;
  const dirty = currentSig !== savedSig || viewType !== savedType || groupByDirty;
  // что именно отличается от сохранённого вида (для честного бейджа Unsaved)
  const dirtySummary = useMemo(() => {
    const savedF = activeView?.filters ?? [];
    const savedS = activeView?.sorts ?? [];
    const savedH = hiddenFromConfig(activeView?.config);
    const parts: string[] = [];
    if (viewType !== (activeView?.type ?? 'table')) parts.push('layout');
    if (qSig(query.filters, [], [], query.filterTree) !== qSig(savedF, [], [], activeView?.filterTree)) parts.push('filters');
    if (qSig([], query.sorts, []) !== qSig([], savedS, [])) parts.push('sort');
    if (qSig([], [], [...hiddenCols]) !== qSig([], [], savedH)) parts.push('columns');
    if (calcsSig(query.calcs) !== calcsSig(calcsFromConfig(activeView?.config))) parts.push('calculations');
    if (groupByDirty) parts.push('group-by');
    return parts.length === 0 ? 'changes' : parts.join(' · ');
  }, [activeView, query, hiddenCols, viewType, groupByDirty]);

  function selectView(id: string | null) {
    if (id === null) { applyView(null); return; }
    const v = views.find((x) => x.id === id);
    if (v) applyView(v);
  }
  async function refreshViews(): Promise<CrmView[]> {
    const vs = await listViews(objectKey);
    const saved = vs.filter((v) => !v.isDefault);
    setViews(saved);
    return saved;
  }
  async function saveNewView(name: string, scope: CrmViewScope = 'personal') {
    try {
      const created = await createView({ objectKey, name, type: viewType, scope, filterTree: query.filterTree ?? null, filters: validFilters(query.filters), sorts: query.sorts, groupByAttributeKey: viewType === 'board' ? groupByKey || null : null, config: { hiddenCols: [...hiddenCols], calcs: query.calcs ?? {} } });
      const saved = await refreshViews();
      applyView(saved.find((x) => x.id === created.id) ?? created);
      flash(`View “${name}” saved · ${scope === 'shared' ? 'shared with workspace' : 'private to you'}`);
    } catch (e: any) { flash(e?.response?.data?.error ?? 'Failed to save view'); }
  }
  async function updateActiveView() {
    if (!activeViewId || !canManage) return;
    try {
      await updateView(activeViewId, { type: viewType, filterTree: query.filterTree ?? null, filters: validFilters(query.filters), sorts: query.sorts, groupByAttributeKey: viewType === 'board' ? groupByKey || null : null, config: { hiddenCols: [...hiddenCols], calcs: query.calcs ?? {} } });
      const saved = await refreshViews();
      applyView(saved.find((x) => x.id === activeViewId) ?? null, false);
      flash('View updated');
    } catch (e: any) { flash(e?.response?.data?.error ?? 'Failed to update view'); }
  }
  async function renameView(id: string, name: string) {
    if (!canManage) return;
    try { await updateView(id, { name }); await refreshViews(); flash(`Renamed to “${name}”`); }
    catch (e: any) { flash(e?.response?.data?.error ?? 'Failed to rename view'); }
  }
  // M24-2: share/unshare сохранённого вида (PATCH scope) — управление SHARED требует FULL (backend 403).
  async function shareView(id: string, scope: CrmViewScope) {
    if (!canManage) return;
    try { await updateView(id, { scope }); await refreshViews(); flash(scope === 'shared' ? 'View shared with workspace' : 'View made private'); }
    catch (e: any) { flash(e?.response?.data?.error ?? 'Failed to change sharing'); }
  }
  async function removeView(id: string) {
    if (!canManage) return;
    try {
      await deleteView(id);
      const saved = await refreshViews();
      if (activeViewId === id) applyView(null);
      else void saved;
      flash('View deleted');
    } catch (e: any) { flash(e?.response?.data?.error ?? 'Failed to delete view'); }
  }
  function resetToSaved() { applyView(activeView, false); }

  // применить пресет быстрого фильтра (ad-hoc, не сохранённый вид)
  function applyPreset(p: Preset) {
    setQuery({ filters: p.filters.map((f) => ({ ...f })), sorts: [] });
    setActiveViewId(null);
    setSelected(new Set());
  }

  // ── bulk-действия (через review-modal) ──
  async function doStage(stage: string) {
    const ids = [...selected];
    if (!ids.length) return;
    const r = await bulkStageRecords({ objectKey, ids, stage });
    await reload();
    setSelected(new Set());
    flash(`Push to Pipeline: ${r.staged} записей → стадия «${stageLabel(r.stage)}»`);
  }
  async function doEnroll(campaignId: string) {
    const ids = [...selected];
    if (!ids.length) return;
    const r = await enrollRecordsToCampaign({ objectKey, recordIds: ids, campaignId });
    setSelected(new Set());
    flash(`В кампанию «${r.campaign.name}»: записано ${r.enrolled}${r.skipped.length ? `, пропущено ${r.skipped.length} (нет email)` : ''}`);
  }
  async function onBulkConfirm(payload: { campaignId?: string; stage?: string; name?: string }) {
    if (payload.campaignId) await doEnroll(payload.campaignId);
    else if (payload.stage) await doStage(payload.stage);
    else if (payload.name) await saveNewView(payload.name);
  }
  // выбрать «готовые» аккаунты (icp>=80 + enriched) — для suggested-действий
  function selectReady() {
    const ids = rows.filter((r) => (r.icp ?? 0) >= 80 && /enrich/i.test(r.enrich ?? '')).map((r) => r.id);
    if (ids.length) setSelected(new Set(ids));
  }

  // Реальный запуск AI-исследования по записям (M2). Списывает кредиты, пишет AiRun + Value.
  async function enrich(ids: string[]) {
    if (!aiAttr) { flash('This object has no AI attribute for enrichment'); return; }
    if (ids.length === 0) { flash('Select records first'); return; }
    setBusy(new Set(ids));
    let ok = 0;
    for (const id of ids) {
      try {
        const r = await runAiForRecord({ attributeId: aiAttr.id, recordId: id, source: 'BULK' });
        if (r.status === 'SUCCEEDED') ok += 1;
      } catch { /* пропускаем сбойную запись */ }
      setBusy((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
    await reload();
    setSelected(new Set());
    flash(`Agent researched ${ok} ${ok === 1 ? 'account' : 'accounts'} · −${ok * costPer} credits`);
    window.dispatchEvent(new CustomEvent('credits:refresh'));
  }

  let toastTimer: ReturnType<typeof setTimeout>;
  function flash(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setToast(''), 4000);
  }
  const running = busy.size > 0;

  // proof strip из реальных записей текущего вида (backend-выборка)
  const q = useMemo(() => {
    const withIcp = rows.filter((r) => r.icp != null);
    const enriched = rows.filter((r) => /enrich/i.test(r.enrich ?? ''));
    const needsReview = rows.filter((r) => r.needsReview);
    const missingDm = rows.filter((r) => r.dmWarn);
    const ready = rows.filter((r) => (r.icp ?? 0) >= 80 && /enrich/i.test(r.enrich ?? ''));
    const aiFilled = rows.reduce((s, r) => s + (r.icp != null ? 1 : 0) + r.signals.length + (r.enrich ? 1 : 0) + (r.segment ? 1 : 0), 0);
    const avg = withIcp.length ? Math.round(withIcp.reduce((s, r) => s + (r.icp ?? 0), 0) / withIcp.length) : 0;
    return {
      evidence: rows.length ? Math.round((enriched.length / rows.length) * 100) : 0,
      aiFilled, needsReview: needsReview.length, missingDm: missingDm.length, avg, ready: ready.length,
    };
  }, [rows]);

  // M9.7 — Evidence / AI-filled / Needs review берём из backend-метрик (реальные AI-значения), fallback на клиентский q.
  const needsReviewVal = aiMetrics?.needsReview ?? q.needsReview;
  const quality = [
    { label: 'Evidence coverage', value: `${aiMetrics?.evidenceCoverage ?? q.evidence}%`, sub: aiMetrics ? `${aiMetrics.recordsWithEvidence} of ${aiMetrics.totalRecords} records` : undefined },
    { label: 'AI-filled fields', value: (aiMetrics?.aiFilled ?? q.aiFilled).toLocaleString(), sub: aiMetrics ? `${aiMetrics.aiFilled} filled of ${aiMetrics.aiCellsTotal} AI cells · ${aiMetrics.aiFilledPct}%` : undefined },
    { label: 'Needs review', value: String(needsReviewVal), sub: undefined },
    { label: 'Missing DMs', value: String(q.missingDm), sub: undefined },
    { label: 'ICP-fit avg', value: String(q.avg), sub: undefined },
    { label: 'Records', value: String(total), sub: undefined },
    { label: 'Campaign-ready', value: String(q.ready), sub: undefined },
  ];

  // доступные пресеты (по наличию реальных атрибутов у объекта) + их счётчики из текущей выборки
  const attrKeys = useMemo(() => new Set(attrs.map((a) => a.key)), [attrs]);
  const presetCount: Record<string, number> = { needs_review: needsReviewVal, missing_dm: q.missingDm, ready: q.ready };
  const availablePresets = PRESETS.filter((p) => p.needs.every((k) => attrKeys.has(k)));

  // suggested-действия контекстны: каждое disabled с причиной, если применять не к чему (ноль мёртвых элементов)
  const hasFilter = validFilters(query.filters).length > 0;
  const suggested = [
    { label: 'Run research on selected', icon: <FlaskConical size={12} />, act: () => enrich([...selected]), disabled: selected.size === 0 || !aiAttr, reason: !aiAttr ? 'No AI attribute on this object' : 'Select records first' },
    { label: 'Create view from filter', icon: <Layers size={12} />, act: () => setBulk('segment'), disabled: !hasFilter, reason: 'Add a filter first' },
    { label: 'Add ready accounts to campaign', icon: <Send size={12} />, act: () => { selectReady(); setBulk('campaign'); }, disabled: q.ready === 0, reason: 'No campaign-ready records' },
    { label: 'Push qualified to Pipeline', icon: <Radar size={12} />, act: () => { selectReady(); setBulk('stage'); }, disabled: q.ready === 0, reason: 'No qualified records' },
  ];

  const objectTabs = objects.length ? objects.slice(0, 8).map((o) => ({ key: o.key, label: o.pluralName })) : [{ key: 'companies', label: 'Companies' }];
  const filterCount = validFilters(query.filters).length;
  const hasQuery = filterCount > 0 || !!search.trim();

  // переключение объекта: синхронно сбрасываем запрос (восстановит свой вид через эффект)
  function switchObject(key: string) {
    if (key === objectKey) return;
    setObjectKey(key);
    persistObject(key);
    setQuery({ filters: [], sorts: [] });
    setHiddenCols(new Set());
    setActiveViewId(null);
    setViewType('table');
    setSelected(new Set());
  }

  return (
    <>
      <Topbar
        title="Data Hub"
        subtitle="Foundation · Agent-enriched records"
        icon={<Database size={18} strokeWidth={1.85} />}
        actions={
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setShowImport(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink-muted shadow-xs hover:bg-surface-2"><Upload size={14} /> Import</button>
            <button type="button" onClick={() => setShowHistory(true)} title="Import history & rollback" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink-muted shadow-xs hover:bg-surface-2"><History size={14} /> History</button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink-muted shadow-xs hover:bg-surface-2"><Plus size={14} /> New record</button>
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="brand-gradient inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <ScanEye size={14} strokeWidth={2.2} /> Review fields <span className="rounded-full bg-white/25 px-1.5 text-[11px] font-bold">{needsReviewVal}</span>
            </button>
          </div>
        }
      />

      {/* object + controls bar */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface/70 px-4">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
          <Bot size={13} /> Agent enriched {rows.length} records
        </span>
        <span className="text-[11px] text-ink-subtle">· evidence coverage {aiMetrics?.evidenceCoverage ?? q.evidence}%</span>
        <div className="ml-2 inline-flex h-8 max-w-[46%] items-center gap-0.5 overflow-x-auto rounded-lg border border-line bg-surface-2/60 p-0.5">
          {objectTabs.map((o) => (
            <button key={o.key} type="button" onClick={() => switchObject(o.key)} className={['inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors', o.key === objectKey ? 'bg-surface text-brand-700 shadow-xs ring-1 ring-inset ring-brand-100' : 'text-ink-muted hover:text-ink'].join(' ')}>{o.label}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {/* Table ↔ Board переключатель (только если у объекта есть SELECT-атрибут для группировки) */}
          {canBoard && (
            <div className="inline-flex h-8 items-center rounded-lg border border-line bg-surface-2/60 p-0.5" role="tablist" aria-label="View layout">
              <button type="button" onClick={() => setViewType('table')} title="Table view" className={['inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-semibold transition-colors', viewType === 'table' ? 'bg-surface text-brand-700 shadow-xs ring-1 ring-inset ring-brand-100' : 'text-ink-muted hover:text-ink'].join(' ')}><Table2 size={13} /> Table</button>
              <button type="button" onClick={() => setViewType('board')} title="Board view" className={['inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-semibold transition-colors', viewType === 'board' ? 'bg-surface text-brand-700 shadow-xs ring-1 ring-inset ring-brand-100' : 'text-ink-muted hover:text-ink'].join(' ')}><LayoutGrid size={13} /> Board</button>
            </div>
          )}
          {viewType === 'board' && selectAttrs.length > 1 && (
            <select value={groupByKey} onChange={(e) => setGroupByKey(e.target.value)} title="Group board by" className="h-8 rounded-lg border border-line bg-surface px-2 text-[12px] font-medium text-ink-muted focus:border-brand-400 focus:outline-none">
              {selectAttrs.map((a) => <option key={a.key} value={a.key}>by {a.name}</option>)}
            </select>
          )}
          <div className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12px] text-ink-muted focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
            <Search size={13} className="text-ink-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-28 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-subtle focus:w-40"
            />
          </div>
          {viewType === 'table' && <DataHubControls attrs={attrs} query={query} onChange={setQuery} columns={COLUMNS} hiddenCols={hiddenCols} onToggleCol={toggleCol} />}
          {canManage && aiAttrs.length > 0 && (
            <button type="button" onClick={() => setBulkOpen(true)} title="Run AI on records (bulk)" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-100"><Sparkles size={13} /> Run AI</button>
          )}
        </div>
      </div>

      {/* Views bar (M5/V1) */}
      <ViewsBar
        views={views}
        activeViewId={activeViewId}
        dirty={dirty}
        dirtySummary={dirtySummary}
        canManage={canManage}
        onSelect={selectView}
        onSaveNew={saveNewView}
        onUpdate={updateActiveView}
        onRename={renameView}
        onDelete={removeView}
        onShare={shareView}
        onReset={resetToSaved}
      />

      {/* data quality proof strip — только в табличном режиме (board показывает stage-метрики в колонках) */}
      {viewType === 'table' && (
        <div className="flex shrink-0 items-stretch divide-x divide-line overflow-x-auto border-b border-line bg-surface">
          {quality.map((qi) => (
            <div key={qi.label} className="flex min-w-[104px] flex-1 flex-col px-3 py-1.5" title={qi.sub}>
              <span className="text-[14px] font-extrabold leading-none text-ink">{qi.value}</span>
              <span className="mt-0.5 truncate text-[9.5px] font-medium uppercase tracking-[0.03em] text-ink-subtle">{qi.label}</span>
              {qi.sub && <span className="mt-0.5 truncate text-[9px] font-medium text-ink-subtle/80">{qi.sub}</span>}
            </div>
          ))}
          {/* M9.7 — кредит-chip: связь Data Hub с реальными списаниями (полный ledger — в Settings → Billing & Credits) */}
          {aiMetrics && (
            <div className="flex min-w-[150px] flex-col justify-center bg-brand-50/40 px-3 py-1.5" title="AI credits — spent on AI runs vs remaining balance. Full ledger in Settings → Billing & Credits.">
              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.03em] text-brand-700"><Sparkles size={10} /> AI credits</span>
              <span className="mt-0.5 text-[11px] font-semibold text-ink">spent {aiMetrics.credits.spentOnAi.toLocaleString('en-US')} · remaining {aiMetrics.credits.remaining.toLocaleString('en-US')}</span>
            </div>
          )}
        </div>
      )}

      {/* body */}
      <div className={['flex', viewType === 'board' ? 'h-[calc(100vh-11rem)]' : 'h-[calc(100vh-13.5rem)]'].join(' ')}>
        {viewType === 'board' ? (
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* board header: группировка + подтверждение, что сумма карточек = backend total */}
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink"><LayoutGrid size={13} className="text-brand-600" /> Board · grouped by {groupAttr?.name ?? '—'}</span>
              <span className="text-[11px] text-ink-subtle">· {records.length} {objectPlural.toLowerCase()} across {groupAttr?.type === 'USER' ? userOptions.length : (groupAttr?.options?.length ?? 0)} {groupAttr?.type === 'USER' ? (userOptions.length === 1 ? 'owner' : 'owners') : 'stages'} (+ No stage) · cards total = backend {total}</span>
              {boardBusyId && <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700"><Loader2 size={11} className="animate-spin" /> saving…</span>}
              {!canManage && <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200" title="Members can view the board but can't move cards"><Lock size={11} /> View-only · can’t move deals</span>}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {loading ? (
                <div className="flex h-full items-center justify-center gap-2 text-[13px] text-ink-subtle"><Loader2 size={16} className="animate-spin" /> Loading board…</div>
              ) : error ? (
                <div className="flex h-full items-center justify-center text-[13px] text-rose-600">{error}</div>
              ) : !groupAttr ? (
                <div className="flex h-full items-center justify-center text-[13px] text-ink-subtle">This object has no select attribute to group by.</div>
              ) : records.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-subtle">
                  <LayoutGrid size={26} /> <p className="text-[13px]">No {objectPlural.toLowerCase()} to show on the board.</p>
                  {hasQuery && <button type="button" onClick={() => { applyView(null); setSearch(''); }} className="text-[12px] font-semibold text-brand-700 hover:underline">Clear filters</button>}
                </div>
              ) : (
                <DataHubBoard records={records} groupAttr={groupAttr} userOptions={userOptions} canManage={canManage} busyId={boardBusyId} onMove={moveCard} onOpen={(id) => setOpenId(id)} />
              )}
            </div>
          </section>
        ) : (
        <>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selected.size > 0 && (
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-brand-50/60 px-4">
              <span className="text-[12px] font-bold text-brand-800">{selected.size} selected</span>
              <div className="flex items-center gap-1.5">
                {canManage && aiAttrs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBulkOpen(true)}
                    title="Server-side bulk AI run with progress, ledger and partial errors"
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-brand-300 bg-brand-600 px-2.5 text-[11.5px] font-semibold text-white shadow-xs transition-colors hover:bg-brand-700"
                  >
                    <Sparkles size={12} /> Run AI · bulk
                  </button>
                )}
                <BulkBtn icon={<Send size={12} />} label="Add to campaign" onClick={() => setBulk('campaign')} />
                <BulkBtn icon={<Layers size={12} />} label="Save as view" onClick={() => setBulk('segment')} />
                <BulkBtn icon={<Radar size={12} />} label="Push to Pipeline" onClick={() => setBulk('stage')} />
              </div>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-[11.5px] font-medium text-ink-muted hover:text-ink">Clear</button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-[13px] text-ink-subtle"><Loader2 size={16} className="animate-spin" /> Loading records…</div>
            ) : error ? (
              <div className="flex h-full items-center justify-center text-[13px] text-rose-600">{error}</div>
            ) : rows.length === 0 && objectTotal === 0 ? (
              // ОБЪЕКТ ПУСТ — в объекте нет НИ ОДНОЙ записи (unfiltered total = 0)
              <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-subtle">
                <Database size={28} /> <p className="text-[13px] font-medium text-ink">No {objectPlural.toLowerCase()} yet</p>
                <p className="text-[11.5px]">This object has no records at all. Add the first one to get started.</p>
                <div className="mt-1 flex items-center gap-2">
                  <button type="button" onClick={() => setShowCreate(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white hover:bg-brand-700"><Plus size={13} /> New record</button>
                  <button type="button" onClick={() => setShowImport(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12px] font-semibold text-ink-muted hover:bg-surface-2"><Upload size={13} /> Import CSV</button>
                </div>
              </div>
            ) : rows.length === 0 ? (
              // ФИЛЬТР/ПОИСК/ВИД ничего не вернул, НО в объекте записи ЕСТЬ (objectTotal > 0)
              <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-subtle">
                <FileSearch size={26} /> <p className="text-[13px] font-medium text-ink">No {objectPlural.toLowerCase()} match {activeView ? `view “${activeView.name}”` : filterCount ? 'this filter' : 'your search'}</p>
                <p className="text-[11.5px]">0 of {objectTotal ?? total} {objectPlural.toLowerCase()} — you narrowed the view, the object is not empty.</p>
                <button type="button" onClick={() => { applyView(null); setSearch(''); }} className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12px] font-semibold text-brand-700 hover:bg-brand-50"><Radar size={13} /> Clear filters · show all {objectTotal ?? ''}</button>
              </div>
            ) : (
              <table className="w-full border-separate border-spacing-0 text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface text-[10px] font-bold uppercase tracking-[0.05em] text-ink-subtle">
                    <th className="border-b border-line px-2 py-2"><span className="sr-only">select</span></th>
                    <th className="border-b border-line px-3 py-2">{objectLabel}</th>
                    {colVisible('icp') && <th className="border-b border-line px-3 py-2">ICP-fit</th>}
                    {colVisible('signals') && <th className="border-b border-line px-3 py-2">Buying signals</th>}
                    {colVisible('dm') && <th className="border-b border-line px-3 py-2">Decision-makers</th>}
                    {colVisible('enrich') && <th className="border-b border-line px-3 py-2">Enrichment</th>}
                    {colVisible('lastAction') && <th className="border-b border-line px-3 py-2">Last agent action</th>}
                    {colVisible('segment') && <th className="border-b border-line px-3 py-2">Segment</th>}
                    {colVisible('employees') && <th className="border-b border-line px-3 py-2 text-ink-subtle/70">Employees</th>}
                    <th className="border-b border-line px-2 py-2"><span className="sr-only">actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const sel = selected.has(c.id);
                    return (
                      <tr key={c.id} className={['group text-[12px] transition-colors', sel ? 'bg-brand-50/50' : 'hover:bg-brand-50/30', c.needsReview ? 'ring-1 ring-inset ring-rose-100' : ''].join(' ')}>
                        <td className="border-b border-line px-2 py-2"><input type="checkbox" checked={sel} onChange={() => toggle(c.id)} className="h-3.5 w-3.5 rounded border-line text-brand-600 focus:ring-brand-300" /></td>
                        <td className="border-b border-line px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[10px] font-bold text-white shadow-sm ${c.tone}`}>{c.initials}</span>
                            <button type="button" onClick={() => setOpenId(c.id)} className="min-w-0 text-left">
                              <p className="truncate font-bold text-ink hover:text-brand-700 hover:underline">{c.name}</p>
                              {c.domain && <p className="inline-flex items-center gap-1 truncate text-[10px] text-ink-subtle"><Globe size={9} /> {c.domain}</p>}
                            </button>
                          </div>
                        </td>
                        {colVisible('icp') && (
                          <td className="border-b border-line px-3 py-2">
                            <IcpCell icp={c.icp} fit={c.fit} conf={c.conf} source={c.source} warn={c.fitWarn} />
                          </td>
                        )}
                        {colVisible('signals') && (
                          <td className="border-b border-line px-3 py-2">
                            {c.signals.length === 0 ? <span className="text-[11px] text-ink-subtle">—</span> : (
                              <div className="flex flex-wrap gap-1">{c.signals.map((s) => <span key={s} className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${signalTone[s] ?? 'bg-surface-2 text-ink-muted'}`}>{s}</span>)}</div>
                            )}
                          </td>
                        )}
                        {colVisible('dm') && (
                          <td className="border-b border-line px-3 py-2">
                            <span className={['inline-flex items-center gap-1 text-[11px] font-medium', c.dmWarn ? 'text-rose-600' : 'text-ink-muted'].join(' ')}>
                              {c.dmWarn ? <AlertTriangle size={10} /> : <User size={10} className="text-ink-subtle" />} {c.dm}
                            </span>
                          </td>
                        )}
                        {colVisible('enrich') && (
                          <td className="border-b border-line px-3 py-2">{c.enrich ? <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${enrichTone(c.enrich)}`}>{c.enrich}</span> : c.researched ? <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold bg-violet-50 text-violet-700"><CheckCircle2 size={10} /> Researched</span> : <span className="text-[11px] text-ink-subtle">—</span>}</td>
                        )}
                        {colVisible('lastAction') && <td className="border-b border-line px-3 py-2 text-ink-muted">{c.lastAction ?? '—'}</td>}
                        {colVisible('segment') && <td className="border-b border-line px-3 py-2">{c.segment ? <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-muted">{c.segment}</span> : <span className="text-[11px] text-ink-subtle">—</span>}</td>}
                        {colVisible('employees') && <td className="border-b border-line px-3 py-2 text-ink-subtle">{c.employees ?? '—'}</td>}
                        <td className="border-b border-line px-2 py-2 text-right">
                          <button
                            type="button"
                            disabled={busy.has(c.id) || !aiAttr}
                            onClick={() => enrich([c.id])}
                            title={aiAttr ? 'Run AI research on this account' : 'No AI attribute configured'}
                            className="inline-flex h-6 items-center gap-1 rounded-md border border-line bg-surface px-1.5 text-[10.5px] font-semibold text-brand-700 opacity-0 shadow-xs transition-opacity hover:bg-brand-50 disabled:cursor-not-allowed group-hover:opacity-100 disabled:opacity-0"
                          >
                            {busy.has(c.id) ? <Loader2 size={10} className="animate-spin" /> : <FlaskConical size={10} />}
                            {busy.has(c.id) ? 'Running' : 'Run AI'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {/* M24-3: footer-калькуляции (S092) — агрегаты по filtered-set из backend */}
          {!loading && !error && (objectTotal ?? 0) > 0 && (
            <CalcFooter attrs={attrs} calcs={query.calcs ?? {}} results={calculations} canManage={canManage} onChange={(c) => setQuery({ ...query, calcs: c })} />
          )}
        </section>

        {/* right attention rail */}
        <aside className="hidden w-[288px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface/60 p-3 xl:flex">
          <p className="px-0.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-subtle">Quick filters</p>
          <div className="space-y-0.5">
            {availablePresets.map((a) => {
              const isActive = activeViewId === null && qSig(query.filters, [], []) === qSig(a.filters, [], []);
              return (
                <button key={a.key} type="button" onClick={() => applyPreset(a)} className={['flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-surface-2 hover:text-ink', isActive ? 'bg-surface-2 text-ink ring-1 ring-inset ring-brand-100' : 'text-ink-muted'].join(' ')}>
                  <span className={`h-1.5 w-1.5 rounded-full ${a.tone}`} />
                  <span className="flex-1 truncate text-left">{a.label}</span>
                  <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-subtle">{presetCount[a.key] ?? 0}</span>
                </button>
              );
            })}
            {availablePresets.length === 0 && <p className="px-0.5 py-1 text-[11px] text-ink-subtle">No quick filters for this object.</p>}
          </div>
          {/* Suggested actions: на пустом объекте (objectTotal===0) блок скрыт — онбординг идёт через центральные CTA */}
          {objectTotal !== 0 && (
            <>
              <p className="mt-4 px-0.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-subtle">Suggested actions</p>
              <div className="space-y-1.5">
                {suggested.map((s) => {
                  const isResearch = s.label.startsWith('Run research');
                  const off = s.disabled || (isResearch && running);
                  return (
                    <button
                      key={s.label}
                      type="button"
                      disabled={off}
                      onClick={s.act}
                      title={s.disabled ? s.reason : undefined}
                      className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-[11.5px] font-medium text-ink-muted shadow-xs transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface"
                    >
                      <span className="text-brand-500">{isResearch && running ? <Loader2 size={12} className="animate-spin" /> : s.icon}</span>
                      <span className="flex-1 truncate text-left">{s.label}</span>
                      {isResearch && selected.size > 0 && <span className="rounded-full bg-brand-50 px-1.5 text-[10px] font-bold text-brand-700">{selected.size}</span>}
                      {s.disabled && <span className="text-[9.5px] font-medium text-ink-subtle">{s.reason}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <p className="mt-4 px-0.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-subtle">Data operations</p>
          <div className="space-y-1.5 rounded-xl border border-line bg-surface p-2.5 text-[11px]">
            <Op icon={<FileSearch size={11} className="text-brand-500" />} label="Object" value={objectKey} />
            <Op icon={<ShieldCheck size={11} className={hasQuery && total === 0 ? 'text-rose-500' : 'text-emerald-600'} />} label="Records in view" value={String(total)} />
            <Op icon={<Database size={11} className="text-ink-subtle" />} label="Object total" value={objectTotal == null ? '—' : String(objectTotal)} />
            <Op icon={<Layers size={11} className="text-violet-500" />} label="Saved views" value={String(views.length)} />
            <Op icon={<Banknote size={11} className="text-ink-subtle" />} label="Objects" value={String(objects.length || 1)} />
          </div>
        </aside>
        </>
        )}
      </div>

      {/* record drawer (M4) */}
      <AnimatePresence>
        {openId && (
          <RecordDrawer
            recordId={openId}
            attrs={attrs}
            onClose={() => setOpenId(null)}
            onChanged={() => { void reload(); }}
          />
        )}
      </AnimatePresence>

      {/* create record (M0) */}
      <AnimatePresence>
        {showCreate && (
          <CreateRecordModal
            objectKey={objectKey}
            objectLabel={objectLabel}
            attrs={attrs}
            onClose={() => setShowCreate(false)}
            onCreated={() => { void reload(); flash('Record created'); }}
          />
        )}
      </AnimatePresence>

      {/* import CSV */}
      <AnimatePresence>
        {showImport && (
          <ImportModal
            objectKey={objectKey}
            objectLabel={objectPlural}
            attrs={attrs}
            onClose={() => setShowImport(false)}
            onImported={(res) => { void reload(); flash(`Imported: +${res.created} created, ${res.updated} updated`); }}
          />
        )}
      </AnimatePresence>

      {/* import history + rollback (M20-2) */}
      <AnimatePresence>
        {showHistory && (
          <ImportHistoryModal
            objectId={objectId}
            onClose={() => setShowHistory(false)}
            onRolledBack={() => { void reload(); flash('Import rolled back'); }}
          />
        )}
      </AnimatePresence>

      {/* bulk review-modal (кампания / стадия / сохранить вид) */}
      <AnimatePresence>
        {bulk && (
          <BulkActionModal
            mode={bulk}
            count={selected.size}
            campaigns={campaignList}
            onConfirm={onBulkConfirm}
            onClose={() => setBulk(null)}
          />
        )}
      </AnimatePresence>

      {/* M9.2 — массовый запуск AI: preflight + progress + ledger + per-record результаты */}
      <BulkRunPanel
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        aiAttrs={aiAttrs}
        defaultAttributeId={aiAttr?.id}
        objectKey={objectKey}
        filters={validFilters(query.filters)}
        search={search.trim() || undefined}
        selectedRecordIds={[...selected]}
        viewTotal={total}
        recordName={(id) => recordNameById.get(id) ?? id}
        canManage={canManage}
        onCompleted={() => { void reload(); window.dispatchEvent(new CustomEvent('credits:refresh')); setSelected(new Set()); }}
      />

      {/* M9.3 — очередь ревью низкоуверенных AI-значений */}
      <ReviewQueue
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        objectKey={objectKey}
        canManage={canManage}
        onChanged={() => { void reload(); }}
      />

      {/* toast — подтверждение AI-прогона / операций с видами */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[12.5px] font-semibold text-ink shadow-lg">
          <span className="brand-gradient flex h-6 w-6 items-center justify-center rounded-lg text-white"><Sparkles size={12} /></span>
          {toast}
        </div>
      )}
    </>
  );
}

function BulkBtn({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-brand-200 bg-surface px-2 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-50">{icon} {label}</button>;
}
function Op({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-ink-muted">{icon} {label}</span><span className="font-bold text-ink">{value}</span></div>;
}
