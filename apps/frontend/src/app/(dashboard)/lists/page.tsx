'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ListChecks,
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  Search,
  Check,
  Users,
  ListPlus,
  ArrowUpRight,
  Filter as FilterIcon,
  Table2,
  LayoutGrid,
  Sparkles,
  ShieldAlert,
  Info,
  Columns3,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowDownUp,
  Tag,
  Settings2,
  Bookmark,
  Save,
  Upload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/layout/Topbar';
import FilterTreeBuilder from '@/components/data/FilterTreeBuilder';
import DataHubBoard from '@/components/data/DataHubBoard';
import PipelineBoard from '@/components/data/PipelineBoard';
import CalcFooter from '@/components/data/CalcFooter';
import ImportModal from '@/components/data/ImportModal';
import {
  listLists,
  getList,
  createList,
  updateList,
  archiveList,
  addListEntries,
  removeListEntry,
  listObjects,
  listRecords,
  listListRecords,
  previewListRule,
  updateListStages,
  moveListEntry,
  moveRecord,
  getObject,
  listViews,
  createView,
  updateView,
  deleteView,
  createListAttribute,
  updateListAttribute,
  deleteListAttribute,
  writeListEntryValues,
  type CrmListAttribute,
  type CrmList,
  type ListDetailResponse,
  type ListRecordEntry,
  type PipelineStage,
  type CrmObject,
  type CrmRecord,
  type CrmRecordValue,
  type CrmAttribute,
  type CrmFilterNode,
  type CrmCalcType,
  type CrmCalcResult,
  type CrmViewSort,
  type CrmView,
} from '@/lib/crmApi';
import { teamApi } from '@/lib/api';
import { useT } from '@/i18n';

function countLeaves(node: CrmFilterNode | null): number {
  if (!node) return 0;
  if ('children' in node) return node.children.reduce((s, c) => s + countLeaves(c), 0);
  return 1;
}

/* ──────────────────────────────────────────────────────────────────────────
   Lists (S100–S109) — кураторские коллекции записей (как Lists в Attio).
   STATIC-список: вручную собранный набор записей одного объекта. Живой CRUD:
   /api/lists ... entries. Светлая Bold-тема.
   ────────────────────────────────────────────────────────────────────────── */

function valText(v: CrmRecordValue | undefined): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => valText(x as CrmRecordValue)).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('amount' in o) return String(o.amount ?? '');
    return String(o.displayName ?? o.name ?? o.label ?? o.value ?? '');
  }
  return String(v);
}

function Modal({ open, onClose, title, icon, children, footer }: {
  open: boolean; onClose: () => void; title: string; icon: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f0f0e]/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
          <span className="brand-gradient flex h-7 w-7 items-center justify-center rounded-lg text-white">{icon}</span>
          <h2 className="text-[14px] font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-ink"><X size={15} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/40 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
const inputCls = 'h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

// M30-2: namespace-префикс ключа list-поля в общем движке filter/sort/calc (backend разрешает list:<key>).
const LIST_KEY_PREFIX = 'list:';
// Утверждённые типы list-атрибута (зеркало backend LIST_ATTR_TYPES).
const LIST_FIELD_TYPES: CrmAttribute['type'][] = ['TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'SELECT', 'MULTI_SELECT', 'DATE', 'DATETIME', 'BOOLEAN', 'USER', 'EMAIL', 'PHONE', 'URL'];

// M30-3: persist list-views. Состояние вида целиком кладём в View.config.listState (общий View-слой,
// listId-scope) — sort/groupBy по list-полям (list:<key>) нельзя в реляционные ViewSort/groupByAttributeId
// (FK на Attribute, которого у list-поля нет), поэтому единый JSON-blob. Активный вид — в localStorage.
interface ListViewState {
  v: 1;
  viewType: 'table' | 'board';
  filterTree: CrmFilterNode | null;
  sorts: CrmViewSort[];
  calcs: Record<string, CrmCalcType>;
  groupByKey: string;
}
const activeViewLsKey = (listId: string) => `aisdr:listview:${listId}`;
function readListState(v: CrmView): ListViewState | null {
  const s = (v.config as { listState?: unknown } | null | undefined)?.listState;
  if (!s || typeof s !== 'object') return null;
  const o = s as Partial<ListViewState>;
  return {
    v: 1,
    viewType: o.viewType === 'board' ? 'board' : 'table',
    filterTree: (o.filterTree as CrmFilterNode | null) ?? null,
    sorts: Array.isArray(o.sorts) ? (o.sorts as CrmViewSort[]) : [],
    calcs: o.calcs && typeof o.calcs === 'object' ? (o.calcs as Record<string, CrmCalcType>) : {},
    groupByKey: typeof o.groupByKey === 'string' ? o.groupByKey : '',
  };
}

export default function ListsPage() {
  const t = useT();
  const router = useRouter();
  const [lists, setLists] = useState<CrmList[]>([]);
  const [objects, setObjects] = useState<CrmObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ListDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState('');

  // M30: list-specific поля — inline-редактирование ячеек + быстрое добавление поля.
  const [editCell, setEditCell] = useState<{ id: string; key: string } | null>(null);
  const [cellDraft, setCellDraft] = useState<string>('');
  const [cellSaving, setCellSaving] = useState(false);
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [nfName, setNfName] = useState('');
  const [nfType, setNfType] = useState<CrmAttribute['type']>('TEXT');
  const [nfOptions, setNfOptions] = useState('');
  const [nfSaving, setNfSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false); // LST-2: manage pipeline stages

  // M24-1: list table-view — AND/OR фильтр через ОБЩИЙ движок (listListRecords → recordFilter.ts).
  const [listAttrs, setListAttrs] = useState<CrmAttribute[]>([]);
  const [filterTree, setFilterTree] = useState<CrmFilterNode | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  // M30-2: сортировка list table-view (общий движок recordSort; list-поля адресуются ключом list:<key>).
  const [sorts, setSorts] = useState<CrmViewSort[]>([]);
  // M30-2: полный менеджер list-полей (add/edit/reorder/archive + опции).
  const [manageFieldsOpen, setManageFieldsOpen] = useState(false);
  // M30-4: импорт CSV в список (только STATIC/PIPELINE; DYNAMIC — членство вычислено).
  const [importOpen, setImportOpen] = useState(false);
  // M30-3: сохранённые виды списка (общий View-слой, listId-scope) + активный вид (persist в localStorage).
  const [savedViews, setSavedViews] = useState<CrmView[]>([]);
  const [savedViewsFor, setSavedViewsFor] = useState<string | null>(null); // listId, для которого загружены savedViews
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [viewBusy, setViewBusy] = useState(false);
  const appliedViewRef = useRef<string>(''); // listId, для которого уже выполнено авто-применение из localStorage
  const [filtered, setFiltered] = useState<ListRecordEntry[] | null>(null);
  const [filteredMeta, setFilteredMeta] = useState<{ restrictedSource?: boolean; hiddenCount?: number } | null>(null);
  const [filtering, setFiltering] = useState(false);
  // M24-3: ad-hoc footer-калькуляции для list table (паритет с object); считает backend
  const [listCalcs, setListCalcs] = useState<Record<string, CrmCalcType>>({});
  const [listCalculations, setListCalculations] = useState<CrmCalcResult[]>([]);
  // M24-2: list BOARD-view — те же DataHubBoard + drag через moveRecord (паритет с object board).
  const [listViewType, setListViewType] = useState<'table' | 'board'>('table');
  const [groupByKey, setGroupByKey] = useState('');
  const [boardBusyId, setBoardBusyId] = useState<string | null>(null);
  const [userOpts, setUserOpts] = useState<{ value: string; label: string }[]>([]);

  function showToast(m: string) { setToast(m); window.setTimeout(() => setToast(''), 4000); }

  const loadLists = useCallback(async () => {
    try {
      const ls = await listLists();
      setLists(ls);
      setSelectedId((k) => k ?? ls[0]?.id ?? null);
    } catch { /* no-op */ } finally { setLoading(false); }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try { setDetail(await getList(id)); } catch { setDetail(null); } finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { void loadLists(); }, [loadLists]);
  useEffect(() => { listObjects().then(setObjects).catch(() => {}); }, []);
  useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [selectedId, loadDetail]);

  // M30-3: сохранённые виды текущего списка (общий View-слой, listId-scope). Чужие/object-виды не подмешиваем.
  // savedViewsFor фиксирует, ДЛЯ КАКОГО списка загружены виды — иначе авто-восстановление ловит stale-виды.
  useEffect(() => {
    if (!selectedId) { setSavedViews([]); setSavedViewsFor(null); return; }
    let alive = true;
    setSavedViewsFor(null);
    listViews({ listId: selectedId })
      .then((vs) => { if (alive) { setSavedViews(vs.filter((v) => Boolean(v.listId) || v.source === 'list')); setSavedViewsFor(selectedId); } })
      .catch(() => { if (alive) { setSavedViews([]); setSavedViewsFor(selectedId); } });
    return () => { alive = false; };
  }, [selectedId]);

  // M30-3: собрать состояние вида из текущего UI / применить состояние вида в UI.
  const buildListState = useCallback((): ListViewState => ({ v: 1, viewType: listViewType, filterTree, sorts, calcs: listCalcs, groupByKey }), [listViewType, filterTree, sorts, listCalcs, groupByKey]);
  const applyListState = useCallback((s: ListViewState | null) => {
    if (!s) return;
    setListViewType(s.viewType);
    setFilterTree(s.filterTree);
    setSorts(s.sorts);
    setListCalcs(s.calcs);
    setGroupByKey(s.groupByKey);
    setShowFilter(Boolean(s.filterTree));
  }, []);

  // M30-3: после reload восстанавливаем активный вид (id в localStorage) — ОДИН раз на список, СТРОГО когда
  // savedViews загружены ИМЕННО для этого списка (savedViewsFor===id) и detail готов (groupChoices/list-поля
  // доступны → board group-by по list:<key> восстановится). Гейт по savedViewsFor исключает гонку со stale-видами.
  useEffect(() => {
    const id = detail?.list.id;
    if (!id || appliedViewRef.current === id) return;
    if (savedViewsFor !== id) return; // ждём виды именно текущего списка
    appliedViewRef.current = id;      // решение принимается один раз
    let storedId: string | null = null;
    try { storedId = localStorage.getItem(activeViewLsKey(id)); } catch { /* no-op */ }
    if (!storedId) return;
    const v = savedViews.find((x) => x.id === storedId);
    if (v) { setActiveViewId(v.id); applyListState(readListState(v)); }
    else {
      // вид удалён — чистим ссылку и приводим view-стейт к дефолтам (reset выше был пропущен из-за hasStored)
      try { localStorage.removeItem(activeViewLsKey(id)); } catch { /* no-op */ }
      setActiveViewId(null); setFilterTree(null); setSorts([]); setListCalcs({}); setShowFilter(false);
      setListViewType(detail?.list.type === 'PIPELINE' ? 'board' : 'table');
    }
  }, [detail?.list.id, savedViewsFor, savedViews, applyListState]);

  // M30-3: активный вид + признак «есть несохранённые изменения» (текущее состояние ≠ сохранённому).
  const activeView = useMemo(() => savedViews.find((v) => v.id === activeViewId) ?? null, [savedViews, activeViewId]);
  const activeDirty = useMemo(() => (activeView ? JSON.stringify(buildListState()) !== JSON.stringify(readListState(activeView)) : false), [activeView, buildListState]);

  // при смене списка — сбрасываем фильтр/калькуляции и грузим атрибуты объекта списка (для builder).
  // M30-3: если у списка есть сохранённый активный вид (id в localStorage) — НЕ чистим view-стейт здесь,
  // его выставит восстановление (иначе reset, срабатывая на догрузке detail, затирал бы restored-стейт).
  useEffect(() => {
    const id = detail?.list.id;
    let hasStored = false;
    if (id) { try { hasStored = Boolean(localStorage.getItem(activeViewLsKey(id))); } catch { /* no-op */ } }
    if (!hasStored) {
      setFilterTree(null); setFiltered(null); setFilteredMeta(null); setShowFilter(false); setListCalcs({}); setListCalculations([]); setSorts([]); setActiveViewId(null);
    }
    setSaveViewOpen(false); setSaveViewName('');
    const key = detail?.list.primaryObject?.key;
    if (key) getObject(key).then((o) => setListAttrs(o.attributes ?? [])).catch(() => setListAttrs([]));
    else setListAttrs([]);
  }, [detail?.list.id, detail?.list.primaryObject?.key]);

  // применяем filterTree + calcs к записям списка ЧЕРЕЗ backend (тот же recordFilter/recordAggregate, что Data Hub)
  const hasCalcs = Object.keys(listCalcs).length > 0;
  const hasSorts = sorts.length > 0;
  const sortsSig = JSON.stringify(sorts);
  useEffect(() => {
    const id = detail?.list.id;
    if (!id || (!filterTree && !hasCalcs && !hasSorts)) { setFiltered(null); setListCalculations([]); return; }
    let alive = true;
    setFiltering(true);
    listListRecords(id, { filterTree, limit: 200, sorts, calcs: Object.entries(listCalcs).map(([attributeKey, type]) => ({ attributeKey, type })) })
      .then((r) => { if (alive) { setFiltered(r.records as ListRecordEntry[]); setListCalculations(r.calculations ?? []); setFilteredMeta({ restrictedSource: r.restrictedSource, hiddenCount: r.hiddenCount }); } })
      .catch(() => { if (alive) { setFiltered([]); setListCalculations([]); setFilteredMeta(null); } })
      .finally(() => { if (alive) setFiltering(false); });
    return () => { alive = false; };
  }, [detail?.list.id, filterTree, listCalcs, sortsSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const records = ((filterTree || hasCalcs || hasSorts) ? filtered : detail?.records) ?? [];

  // LST-1: DYNAMIC = вычисляемое членство (rule). restrictedSource — нет OBJECT READ (записи и правило скрыты).
  const isDynamic = detail?.list.type === 'DYNAMIC';
  const isPipeline = detail?.list.type === 'PIPELINE'; // LST-2
  const pipelineStages: PipelineStage[] = useMemo(() => (detail?.list.config?.stages ?? []) as PipelineStage[], [detail?.list.config?.stages]);
  const viewActive = Boolean(filterTree || hasCalcs || hasSorts);
  const restricted = (viewActive ? filteredMeta?.restrictedSource : detail?.restrictedSource) ?? false;
  const hiddenCount = (viewActive ? filteredMeta?.hiddenCount : detail?.hiddenCount) ?? 0;
  const matchedCount = detail?.matchedCount;

  // M30: list-specific поля (колонки на ListEntry). Определения — из detail; значения — в row.listValues.
  // Для DYNAMIC значений нет (членство вычислено, ListEntry отсутствует) → list-поля не показываем.
  const listFields: CrmListAttribute[] = useMemo(() => (detail?.listAttributes ?? []), [detail?.listAttributes]);
  const showListFields = !isDynamic && listFields.length > 0;

  // M30-2: единый маркер list-поля (◇) во всех общих движках (filter/sort/calc/board-group). Синтетический
  // CrmAttribute адресуется ключом list:<key> — backend разрешает namespace и считает по ListEntryValue.
  const listFieldAttrs: CrmAttribute[] = useMemo(() => (showListFields ? listFields : []).map((a) => ({
    id: a.id, key: `${LIST_KEY_PREFIX}${a.key}`, name: `◇ ${a.name}`, type: a.type, order: 1000 + a.order, isPrimary: false,
    options: a.options.map((o) => ({ key: o.value, value: o.value, label: o.label, color: o.color, order: o.order })),
  })), [showListFields, listFields]);
  // Объединённые атрибуты для фильтра/сортировки/калькуляций: object-поля + list-поля (с маркером ◇).
  const engineAttrs: CrmAttribute[] = useMemo(() => [...listAttrs, ...listFieldAttrs], [listAttrs, listFieldAttrs]);

  // M24-2 + M30-2: board группируется по SELECT/USER — объекта ИЛИ списка (process-list). list-поля помечены ◇.
  const groupChoices = useMemo<{ key: string; label: string; isList: boolean; attr: CrmAttribute }[]>(() => {
    const objs = listAttrs
      .filter((a) => (a.type === 'SELECT' && (a.options?.length ?? 0) > 0) || a.type === 'USER')
      .map((a) => ({ key: a.key, label: a.name, isList: false, attr: a }));
    const lists = (showListFields ? listFields : [])
      .filter((a) => (a.type === 'SELECT' && a.options.length > 0) || a.type === 'USER')
      .map((a) => ({
        key: `${LIST_KEY_PREFIX}${a.key}`, label: `◇ ${a.name}`, isList: true,
        attr: { id: a.id, key: a.key, name: a.name, type: a.type, order: a.order, isPrimary: false,
          options: a.options.map((o) => ({ key: o.value, value: o.value, label: o.label, color: o.color, order: o.order })) } as CrmAttribute,
      }));
    return [...objs, ...lists];
  }, [listAttrs, showListFields, listFields]);
  const canBoard = groupChoices.length > 0;
  const groupChoice = useMemo(() => groupChoices.find((g) => g.key === groupByKey) ?? null, [groupChoices, groupByKey]);
  const groupAttr = groupChoice?.attr ?? null;
  const groupIsList = groupChoice?.isList ?? false;
  // LST-2: для PIPELINE по умолчанию открываем kanban (board); иначе таблицу.
  // M30-3: НЕ выставляем дефолт, если у списка есть сохранённый активный вид — его viewType выставит
  // восстановление (иначе этот эффект, срабатывая на догрузке detail, затирал бы restored board→table).
  useEffect(() => {
    const id = detail?.list.id;
    if (!id) return;
    let hasStored = false;
    try { hasStored = Boolean(localStorage.getItem(activeViewLsKey(id))); } catch { /* no-op */ }
    if (hasStored) return;
    setListViewType(detail?.list.type === 'PIPELINE' ? 'board' : 'table');
  }, [detail?.list.id, detail?.list.type]);
  // groupByKey ставим/сохраняем по готовности groupChoices (атрибуты грузятся async — иначе ключ пустой и board=table)
  useEffect(() => { setGroupByKey((prev) => (groupChoices.some((g) => g.key === prev) ? prev : (groupChoices[0]?.key ?? ''))); }, [groupChoices]);
  useEffect(() => { teamApi.members().then((r) => setUserOpts(r.members.map((m) => ({ value: m.id, label: m.name || m.email })))).catch(() => {}); }, []);

  // Board-записи: для list-группировки вливаем значение list-поля в values[groupKey], чтобы DataHubBoard
  // (читает rec.values[key]) сгруппировал по нему. Для object-группировки — записи как есть.
  const boardRecords: CrmRecord[] = useMemo(() => {
    if (!groupChoice?.isList) return records as unknown as CrmRecord[];
    const k = groupChoice.attr.key;
    return (records as ListRecordEntry[]).map((r) => ({ ...r, values: { ...r.values, [k]: r.listValues?.[k] } })) as unknown as CrmRecord[];
  }, [records, groupChoice]);

  // LST-2: перенос карточки между стадиями pipeline (drag-persist). Паттерн M24-2: PATCH → re-fetch (порядок/позиции
  // канонические из БД), busy-спиннер на карточке; при ошибке откат через повторную загрузку детали.
  async function pipelineMove(recordId: string, toStage: string, toPosition?: number) {
    if (!detail) return;
    setBoardBusyId(recordId);
    try {
      const r = await moveListEntry(detail.list.id, recordId, toStage, toPosition);
      if (r.moved) showToast(t('lists.toastCardMovedStage'));
      if (selectedId) await loadDetail(selectedId);
      if (detail.list.id && viewActive) { const fr = await listListRecords(detail.list.id, { filterTree, sorts, limit: 200 }); setFiltered(fr.records as ListRecordEntry[]); }
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      showToast(ax?.response?.data?.error ?? t('lists.toastMoveFailed'));
      if (selectedId) await loadDetail(selectedId); // откат к серверному состоянию
    } finally { setBoardBusyId(null); }
  }

  async function listMoveCard(recordId: string, _from: string | null, to: string | null) {
    if (!groupAttr) return;
    setBoardBusyId(recordId);
    try {
      await moveRecord(recordId, groupAttr.key, to);
      showToast(t('lists.toastCardMovedCrm'));
      if (selectedId) await loadDetail(selectedId);
      if (detail?.list.id && viewActive) { const r = await listListRecords(detail.list.id, { filterTree, sorts, limit: 200 }); setFiltered(r.records as ListRecordEntry[]); }
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      showToast(ax?.response?.data?.error ?? t('lists.toastMoveFailed'));
    } finally { setBoardBusyId(null); }
  }

  // M30-2: drag по доске, сгруппированной по list-specific SELECT/USER → пишем ИМЕННО ListEntryValue
  // (writeListEntryValues), НЕ Record.Value. to = option-value/userId, null = очистить значение list-поля.
  async function listFieldMove(recordId: string, _from: string | null, to: string | null) {
    if (!detail || !groupChoice?.isList) return;
    const k = groupChoice.attr.key;
    setBoardBusyId(recordId);
    try {
      const res = await writeListEntryValues(detail.list.id, recordId, { [k]: to });
      patchListValues(recordId, res.listValues);
      showToast(to ? t('lists.toastMovedListField') : t('lists.toastClearedListField'));
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      showToast(ax?.response?.data?.error ?? t('lists.toastMoveFailed'));
      if (selectedId) await loadDetail(selectedId);
    } finally { setBoardBusyId(null); }
  }
  // Колонки: 2 первых не-name, не-AI текстовых атрибута объекта (для краткого превью).
  const previewKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const r of records) {
      for (const k of Object.keys(r.values ?? {})) {
        if (k !== 'name' && valText(r.values[k])) keys.add(k);
      }
    }
    return [...keys].slice(0, 2);
  }, [records]);

  // Человекочитаемое значение list-поля (SELECT → label, массивы → через запятую, bool → Yes/No).
  function listValDisplay(v: unknown): string {
    if (v === null || v === undefined || v === '') return '';
    if (Array.isArray(v)) return v.map((x) => listValDisplay(x)).filter(Boolean).join(', ');
    if (typeof v === 'object') { const o = v as Record<string, unknown>; return String(o.label ?? o.name ?? o.value ?? ''); }
    if (typeof v === 'boolean') return v ? t('lists.yes') : t('lists.no');
    return String(v);
  }
  // Локально проставить значения list-полей записи (детали + filtered) после записи — оптимистичный refetch.
  function patchListValues(recordId: string, lv: Record<string, unknown>) {
    setDetail((d) => (d ? { ...d, records: d.records.map((r) => (r.id === recordId ? { ...r, listValues: lv } : r)) } : d));
    setFiltered((f) => (f ? f.map((r) => (r.id === recordId ? { ...r, listValues: lv } : r)) : f));
  }
  // Записать значение одного list-поля записи-в-списке (PATCH → значение живёт на ListEntry, не на Record).
  async function saveCell(recordId: string, attr: CrmListAttribute, raw: unknown) {
    if (!detail) return;
    setCellSaving(true);
    try {
      const res = await writeListEntryValues(detail.list.id, recordId, { [attr.key]: raw });
      patchListValues(recordId, res.listValues);
      setEditCell(null);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      showToast(ax?.response?.data?.error ?? t('lists.toastSaveListFieldFailed'));
    } finally {
      setCellSaving(false);
    }
  }
  // Быстро добавить list-поле (имя + тип; для SELECT — опции через запятую). Полный менеджер полей — M30-2.
  async function addListField() {
    if (!detail || !nfName.trim()) return;
    setNfSaving(true);
    try {
      const isSel = nfType === 'SELECT' || nfType === 'MULTI_SELECT';
      const options = isSel
        ? nfOptions.split(',').map((s) => s.trim()).filter(Boolean).map((s) => ({ value: s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || s, label: s }))
        : undefined;
      await createListAttribute(detail.list.id, { name: nfName.trim(), type: nfType, options });
      setNfName(''); setNfOptions(''); setNfType('TEXT'); setAddFieldOpen(false);
      await loadDetail(detail.list.id);
      showToast(t('lists.toastListFieldAdded'));
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      showToast(ax?.response?.data?.error ?? t('lists.toastAddListFieldFailed'));
    } finally {
      setNfSaving(false);
    }
  }

  // Ячейка list-поля: значение + inline-редактор по типу (TEXT/SELECT/NUMBER/DATE/BOOLEAN…). Пишет на ListEntry.
  function renderListCell(r: ListRecordEntry, a: CrmListAttribute): ReactNode {
    const v = r.listValues?.[a.key];
    const editing = editCell?.id === r.id && editCell.key === a.key;

    if (a.type === 'BOOLEAN') {
      const checked = v === true;
      return (
        <button type="button" disabled={cellSaving} onClick={() => void saveCell(r.id, a, !checked)} className={`inline-flex h-6 items-center rounded-md px-1.5 text-[11px] font-semibold ${checked ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-2 text-ink-subtle'} hover:ring-1 hover:ring-indigo-200`}>{checked ? t('lists.yes') : t('lists.no')}</button>
      );
    }

    if (editing) {
      if (a.type === 'SELECT') {
        return (
          <select autoFocus value={cellDraft} onChange={(e) => { setCellDraft(e.target.value); void saveCell(r.id, a, e.target.value); }} onBlur={() => setEditCell(null)} className="h-7 w-full rounded-md border border-indigo-300 bg-surface px-1.5 text-[12px] text-ink focus:outline-none focus:ring-2 focus:ring-indigo-100">
            <option value="">—</option>
            {a.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      }
      const inputType = a.type === 'NUMBER' || a.type === 'CURRENCY' ? 'number' : a.type === 'DATE' ? 'date' : a.type === 'DATETIME' ? 'datetime-local' : a.type === 'EMAIL' ? 'email' : a.type === 'URL' ? 'url' : 'text';
      return (
        <input autoFocus type={inputType} value={cellDraft} disabled={cellSaving}
          onChange={(e) => setCellDraft(e.target.value)}
          onBlur={() => void saveCell(r.id, a, cellDraft)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); else if (e.key === 'Escape') setEditCell(null); }}
          className="h-7 w-full rounded-md border border-indigo-300 bg-surface px-2 text-[12px] text-ink focus:outline-none focus:ring-2 focus:ring-indigo-100" />
      );
    }

    const disp = listValDisplay(v);
    return (
      <button type="button"
        onClick={() => { setEditCell({ id: r.id, key: a.key }); setCellDraft(typeof v === 'object' && v ? String((v as Record<string, unknown>).value ?? '') : (a.type === 'DATE' || a.type === 'DATETIME' ? String(v ?? '').slice(0, a.type === 'DATE' ? 10 : 16) : disp)); }}
        className="flex min-h-[24px] w-full items-center truncate rounded-md px-1 py-0.5 text-left text-[12px] text-ink hover:bg-indigo-50/60 focus:outline-none focus:ring-2 focus:ring-indigo-100">
        {disp ? <span className="truncate" title={disp}>{disp}</span> : <span className="text-[11px] text-indigo-400">{t('lists.cellAdd')}</span>}
      </button>
    );
  }

  async function refresh() {
    await loadLists();
    if (selectedId) await loadDetail(selectedId);
  }

  // M30-3: применить сохранённый вид (+ запомнить как активный в localStorage).
  function selectView(v: CrmView) {
    setActiveViewId(v.id);
    applyListState(readListState(v));
    if (detail) { try { localStorage.setItem(activeViewLsKey(detail.list.id), v.id); } catch { /* no-op */ } }
  }
  // снять активный вид (вернуться к «без вида»; данные не трогаем).
  function clearActiveView() {
    setActiveViewId(null);
    if (detail) { try { localStorage.removeItem(activeViewLsKey(detail.list.id)); } catch { /* no-op */ } }
  }
  // сохранить текущее состояние как НОВЫЙ вид (config.listState; listId-scope).
  async function saveAsNewView() {
    if (!detail || !saveViewName.trim()) return;
    setViewBusy(true);
    try {
      const v = await createView({ listId: detail.list.id, name: saveViewName.trim(), type: listViewType, config: { listState: buildListState() } });
      setSavedViews((vs) => [...vs, v]);
      setActiveViewId(v.id);
      try { localStorage.setItem(activeViewLsKey(detail.list.id), v.id); } catch { /* no-op */ }
      setSaveViewOpen(false); setSaveViewName('');
      showToast(t('lists.toastViewSaved', { name: v.name }));
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      showToast(ax?.response?.data?.error ?? t('lists.toastSaveViewFailed'));
    } finally { setViewBusy(false); }
  }
  // перезаписать активный вид текущим состоянием.
  async function updateActiveView() {
    if (!detail || !activeViewId) return;
    setViewBusy(true);
    try {
      const v = await updateView(activeViewId, { type: listViewType, config: { listState: buildListState() } });
      setSavedViews((vs) => vs.map((x) => (x.id === v.id ? v : x)));
      showToast(t('lists.toastViewUpdated', { name: v.name }));
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      showToast(ax?.response?.data?.error ?? t('lists.toastUpdateViewFailed'));
    } finally { setViewBusy(false); }
  }
  // удалить (soft-archive) сохранённый вид.
  async function removeView(v: CrmView) {
    try {
      await deleteView(v.id);
      setSavedViews((vs) => vs.filter((x) => x.id !== v.id));
      if (activeViewId === v.id) clearActiveView();
      showToast(t('lists.toastViewDeleted', { name: v.name }));
    } catch { showToast(t('lists.toastDeleteViewFailed')); }
  }

  async function handleRemove(recordId: string) {
    if (!detail) return;
    try {
      await removeListEntry(detail.list.id, recordId);
      showToast(t('lists.toastRemoved'));
      await refresh();
    } catch { showToast(t('lists.toastRemoveFailed')); }
  }

  async function handleDeleteList() {
    if (!detail) return;
    try {
      await archiveList(detail.list.id);
      showToast(t('lists.toastListDeleted', { name: detail.list.name }));
      setConfirmDel(false);
      setSelectedId(null);
      const ls = await listLists();
      setLists(ls);
      setSelectedId(ls[0]?.id ?? null);
    } catch { showToast(t('lists.toastDeleteFailed')); }
  }

  return (
    <>
      <Topbar title={t('lists.title')} icon={<ListChecks size={18} strokeWidth={1.85} />} />

      <div className="flex min-h-0 flex-1">
        {/* lists */}
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-line bg-surface/50 md:flex">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">{t('lists.title')}</p>
            <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100"><Plus size={12} /> {t('lists.newList')}</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {loading ? (
              <div className="space-y-1.5 px-1">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-11 rounded-lg" />)}</div>
            ) : lists.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-ink-muted">{t('lists.noLists')}</p>
            ) : lists.map((l) => {
              const active = l.id === selectedId;
              return (
                <button key={l.id} type="button" onClick={() => setSelectedId(l.id)} className={['group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors', active ? 'sidebar-active-gradient ring-1 ring-inset ring-brand-100' : 'hover:bg-surface-2'].join(' ')}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-[14px] shadow-xs">{l.icon || '📋'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{l.name}</span>
                    <span className="block truncate text-[11px] text-ink-subtle">{l.primaryObject?.pluralName ?? '—'} · {l.type === 'DYNAMIC' ? t('lists.ruleBased') : (l._count?.entries ?? 0)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* detail */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          {!detail ? (
            <div className="flex h-full items-center justify-center text-[13px] text-ink-subtle">{detailLoading ? t('lists.loading') : (loading ? '' : t('lists.selectOrCreate'))}</div>
          ) : (
            <div className={`mx-auto p-6 ${listViewType === 'board' ? 'max-w-[1600px]' : 'max-w-4xl'}`}>
              {/* header */}
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-[24px]">{detail.list.icon || '📋'}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-[19px] font-extrabold tracking-[-0.02em] text-ink">{detail.list.name}</h1>
                    {isDynamic ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10.5px] font-bold uppercase text-violet-700 ring-1 ring-inset ring-violet-200"><Sparkles size={11} /> {t('lists.typeDynamic')}</span>
                    ) : isPipeline ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-bold uppercase text-sky-700 ring-1 ring-inset ring-sky-200"><Columns3 size={11} /> {t('lists.typePipeline')}</span>
                    ) : (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold uppercase text-ink-subtle">{t('lists.createStatic')}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">{detail.list.description || (isDynamic ? t('lists.dynamicDesc') : t('lists.staticDescOf', { plural: detail.list.primaryObject?.pluralName?.toLowerCase() ?? t('lists.recordMany') }))}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11.5px] text-ink-subtle">
                    <span className="inline-flex items-center gap-1"><Users size={12} /> {detail.list.primaryObject?.pluralName}</span>
                    {isDynamic
                      ? <span className="inline-flex items-center gap-1 text-violet-700"><Sparkles size={11} /> {t('lists.matchRule', { count: restricted ? hiddenCount : (matchedCount ?? records.length) })}</span>
                      : <span>{records.length} {records.length === 1 ? t('lists.recordOne') : t('lists.recordMany')}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button type="button" onClick={() => setEditOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink"><Pencil size={13} /> {t('lists.edit')}</button>
                  {!detail.list.isSystem && (
                    <button type="button" onClick={() => setConfirmDel(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-medium text-rose-600 hover:bg-rose-50"><Trash2 size={13} /> {t('lists.delete')}</button>
                  )}
                </div>
              </div>

              {/* M30-3: view-бар — сохранённые виды списка (filter/sort/calc/view-type + board group-by, вкл. list:<key>). */}
              {!restricted && (
                <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle"><Bookmark size={11} /> {t('lists.viewsTitle')}</span>
                  <button type="button" onClick={clearActiveView} className={['inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-semibold transition-colors', !activeViewId ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-surface text-ink-muted hover:bg-surface-2'].join(' ')}>{t('lists.viewDefault')}</button>
                  {savedViews.map((v) => (
                    <span key={v.id} className={['group inline-flex h-7 items-center gap-1 rounded-full border pl-2.5 pr-1.5 text-[12px] font-semibold transition-colors', activeViewId === v.id ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-surface text-ink-muted hover:bg-surface-2'].join(' ')}>
                      <button type="button" onClick={() => selectView(v)} className="inline-flex items-center gap-1">
                        {v.type === 'board' ? <LayoutGrid size={11} /> : <Table2 size={11} />} {v.name}
                        {activeViewId === v.id && activeDirty && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" title={t('lists.viewUnsaved')} />}
                      </button>
                      <button type="button" onClick={() => void removeView(v)} title={t('lists.viewDelete')} className="flex h-5 w-5 items-center justify-center rounded-full text-ink-subtle opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"><X size={11} /></button>
                    </span>
                  ))}
                  {activeViewId && activeDirty && (
                    <button type="button" onClick={() => void updateActiveView()} disabled={viewBusy} className="inline-flex h-7 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 text-[12px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60">{viewBusy ? <Loader2 size={11} className="animate-spin" /> : <Save size={12} />} {t('lists.viewUpdate')}</button>
                  )}
                  {!saveViewOpen ? (
                    <button type="button" onClick={() => { setSaveViewOpen(true); setSaveViewName(activeView ? t('lists.viewCopy', { name: activeView.name }) : ''); }} className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line px-2.5 text-[12px] font-semibold text-brand-700 hover:bg-brand-50"><Plus size={12} /> {t('lists.viewSaveAs')}</button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50/40 px-1.5 py-0.5">
                      <input autoFocus value={saveViewName} onChange={(e) => setSaveViewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void saveAsNewView(); else if (e.key === 'Escape') setSaveViewOpen(false); }} placeholder={t('lists.viewNamePlaceholder')} className="h-6 w-32 rounded-md border border-line bg-surface px-2 text-[12px] text-ink focus:border-brand-400 focus:outline-none" />
                      <button type="button" disabled={viewBusy || !saveViewName.trim()} onClick={() => void saveAsNewView()} className="inline-flex h-6 items-center gap-1 rounded-md bg-brand-600 px-2 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{viewBusy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} {t('lists.viewSave')}</button>
                      <button type="button" onClick={() => { setSaveViewOpen(false); setSaveViewName(''); }} className="inline-flex h-6 items-center rounded-md border border-line px-2 text-[12px] font-semibold text-ink-muted hover:bg-surface-2">{t('lists.viewCancel')}</button>
                    </span>
                  )}
                </div>
              )}

              <div className="mb-2.5 flex items-center justify-between">
                <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
                  {t('lists.recordsHeader')} · {records.length}
                  {filterTree && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">{t('lists.filtered')}{filtering ? ' …' : ''}</span>}
                </p>
                <div className="flex items-center gap-1.5">
                  {/* M24-2: Table | Board переключатель. Для PIPELINE board = kanban по list-local стадиям. */}
                  {(canBoard || isPipeline) && (
                    <div className="inline-flex h-8 items-center rounded-lg border border-line bg-surface-2/60 p-0.5" role="tablist" aria-label={t('lists.viewsTitle')}>
                      <button type="button" onClick={() => setListViewType('table')} className={['inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-semibold transition-colors', listViewType === 'table' ? 'bg-surface text-brand-700 shadow-xs ring-1 ring-inset ring-brand-100' : 'text-ink-muted hover:text-ink'].join(' ')}><Table2 size={13} /> {t('lists.table')}</button>
                      <button type="button" onClick={() => setListViewType('board')} className={['inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-semibold transition-colors', listViewType === 'board' ? 'bg-surface text-brand-700 shadow-xs ring-1 ring-inset ring-brand-100' : 'text-ink-muted hover:text-ink'].join(' ')}>{isPipeline ? <><Columns3 size={13} /> {t('lists.pipeline')}</> : <><LayoutGrid size={13} /> {t('lists.board')}</>}</button>
                    </div>
                  )}
                  {!isPipeline && listViewType === 'board' && groupChoices.length > 0 && (
                    <select value={groupByKey} onChange={(e) => setGroupByKey(e.target.value)} title={t('lists.groupByTitle')} className="h-8 rounded-lg border border-line bg-[var(--surface)] px-2 text-[12px] font-medium text-ink-muted focus:border-brand-400 focus:outline-none">
                      {groupChoices.map((g) => <option key={g.key} value={g.key}>{t('lists.groupByOption', { label: g.label })}</option>)}
                    </select>
                  )}
                  {isPipeline && (
                    <button type="button" onClick={() => setStagesOpen(true)} title={t('lists.stagesTitle')} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-2.5 text-[12.5px] font-semibold text-sky-700 hover:bg-sky-100"><Columns3 size={13} /> {t('lists.stages')}</button>
                  )}
                  {/* M30-2: сортировка (object + list-поля ◇) — тот же движок recordSort через backend */}
                  {listViewType === 'table' && <SortControl attrs={engineAttrs} sorts={sorts} onChange={setSorts} />}
                  {/* M24-1: тот же AND/OR builder, что в Data Hub — list table-view применяет фильтр через backend */}
                  <button type="button" onClick={() => setShowFilter((s) => !s)} className={['inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors', countLeaves(filterTree) > 0 ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-surface text-ink-muted hover:bg-surface-2'].join(' ')}>
                    <FilterIcon size={13} /> {t('lists.advancedFilter')}{countLeaves(filterTree) > 0 ? ` · ${countLeaves(filterTree)}` : ''}
                  </button>
                  {isDynamic ? (
                    <button type="button" onClick={() => setEditOpen(true)} title={t('lists.editRuleTitle')} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 text-[12.5px] font-semibold text-violet-700 hover:bg-violet-100 transition-all"><Sparkles size={14} /> {t('lists.editRule')}</button>
                  ) : (
                    <>
                      {/* M30-4: импорт CSV в список — создаёт/обновляет записи primary-объекта и добавляет в список (DYNAMIC недоступен). */}
                      <button type="button" onClick={() => setImportOpen(true)} title={t('lists.importCsvTitle')} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-semibold text-ink-muted hover:bg-surface-2 transition-colors"><Upload size={14} /> {t('lists.importCsv')}</button>
                      <button type="button" onClick={() => setAddOpen(true)} className="brand-gradient inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-white shadow-brand hover:-translate-y-0.5 hover:shadow-md transition-all"><ListPlus size={14} /> {t('lists.addRecords')}</button>
                    </>
                  )}
                </div>
              </div>

              {showFilter && (
                <div className="mb-2.5 rounded-2xl border border-line bg-surface p-3 shadow-sm">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-subtle">{t('lists.filterBuilderTitle')}</p>
                  <FilterTreeBuilder attrs={engineAttrs} value={filterTree} onChange={setFilterTree} />
                </div>
              )}

              {restricted ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 px-6 py-12 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700"><ShieldAlert size={20} /></span>
                  <p className="text-[13.5px] font-semibold text-ink">{t('lists.restrictedTitle')}</p>
                  <p className="max-w-md text-[12px] text-ink-muted">
                    {t('lists.restrictedBody', { plural: detail.list.primaryObject?.pluralName?.toLowerCase() ?? t('lists.recordMany') })}
                    {hiddenCount > 0 ? (hiddenCount === 1 ? t('lists.restrictedHiddenOne', { count: hiddenCount }) : t('lists.restrictedHiddenMany', { count: hiddenCount })) : ''}
                    {isDynamic ? t('lists.restrictedRuleHidden') : ''}
                  </p>
                </div>
              ) : isPipeline && listViewType === 'board' ? (
                <div className="h-[calc(100vh-22rem)] min-h-[360px] overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                  <PipelineBoard stages={pipelineStages} records={records} canManage busyId={boardBusyId} onMove={pipelineMove} onOpen={() => router.push(`/data?obj=${detail.list.primaryObject?.key ?? ''}`)} />
                </div>
              ) : !isPipeline && listViewType === 'board' && groupAttr ? (
                <div className="h-[calc(100vh-22rem)] min-h-[360px] overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                  {/* M30-2: при группировке по list-полю (groupIsList) drag пишет ListEntryValue, иначе Record.Value (как раньше). */}
                  <DataHubBoard records={boardRecords} groupAttr={groupAttr} userOptions={userOpts} canManage busyId={boardBusyId} onMove={groupIsList ? listFieldMove : listMoveCard} onOpen={() => router.push(`/data?obj=${detail.list.primaryObject?.key ?? ''}`)} />
                </div>
              ) : (
              <>
              {/* M30: панель list-specific полей (живут на записи-в-списке; полный менеджер полей — M30-2). */}
              {!isDynamic && (
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-indigo-700"><Tag size={11} /> {t('lists.fieldsLabel')}</span>
                  <span className="text-[11.5px] text-ink-subtle">{listFields.length ? (listFields.length === 1 ? t('lists.fieldsCountOne', { count: listFields.length }) : t('lists.fieldsCountMany', { count: listFields.length })) : t('lists.fieldsNone')}</span>
                  {!addFieldOpen ? (
                    <button type="button" onClick={() => setAddFieldOpen(true)} className="inline-flex h-7 items-center gap-1 rounded-md border border-indigo-200 bg-surface px-2 text-[12px] font-semibold text-indigo-700 hover:bg-indigo-50"><Plus size={13} /> {t('lists.fieldAdd')}</button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/40 px-2 py-1">
                      <input autoFocus value={nfName} onChange={(e) => setNfName(e.target.value)} placeholder={t('lists.fieldNamePlaceholder')} className="h-7 w-32 rounded-md border border-line bg-surface px-2 text-[12px] text-ink focus:border-indigo-400 focus:outline-none" />
                      <select value={nfType} onChange={(e) => setNfType(e.target.value as CrmAttribute['type'])} className="h-7 rounded-md border border-line bg-surface px-1.5 text-[12px] text-ink focus:outline-none">
                        {['TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'SELECT', 'MULTI_SELECT', 'DATE', 'DATETIME', 'BOOLEAN', 'USER', 'EMAIL', 'PHONE', 'URL'].map((ft) => <option key={ft} value={ft}>{ft.replace('_', ' ')}</option>)}
                      </select>
                      {(nfType === 'SELECT' || nfType === 'MULTI_SELECT') && (
                        <input value={nfOptions} onChange={(e) => setNfOptions(e.target.value)} placeholder={t('lists.fieldOptionsPlaceholder')} className="h-7 w-44 rounded-md border border-line bg-surface px-2 text-[12px] text-ink focus:border-indigo-400 focus:outline-none" />
                      )}
                      <button type="button" disabled={nfSaving || !nfName.trim()} onClick={() => void addListField()} className="inline-flex h-7 items-center gap-1 rounded-md bg-indigo-600 px-2 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{nfSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {t('lists.fieldAddBtn')}</button>
                      <button type="button" onClick={() => { setAddFieldOpen(false); setNfName(''); setNfOptions(''); }} className="inline-flex h-7 items-center rounded-md border border-line px-2 text-[12px] font-semibold text-ink-muted hover:bg-surface-2">{t('lists.fieldCancel')}</button>
                    </div>
                  )}
                  {listFields.length > 0 && (
                    <button type="button" onClick={() => setManageFieldsOpen(true)} title={t('lists.fieldsManageTitle')} className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[12px] font-semibold text-ink-muted hover:bg-surface-2"><Settings2 size={13} /> {t('lists.fieldsManage')}</button>
                  )}
                </div>
              )}
              <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <div className="grid items-center gap-3 border-b border-line bg-surface-2/40 px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-subtle" style={{ gridTemplateColumns: `minmax(0,1.4fr) ${previewKeys.map(() => 'minmax(0,1fr)').join(' ')}${showListFields ? ' ' + listFields.map(() => 'minmax(0,1.1fr)').join(' ') : ''} auto` }}>
                  <span>{t('lists.colName')}</span>
                  {previewKeys.map((k) => <span key={k} className="truncate">{k.replace(/_/g, ' ')}</span>)}
                  {showListFields && listFields.map((a) => (
                    <span key={a.id} className="inline-flex min-w-0 items-center gap-1 truncate text-indigo-600" title={t('lists.fieldColTitle', { name: a.name })}>
                      <Tag size={10} className="shrink-0" /><span className="truncate">{a.name}</span>
                    </span>
                  ))}
                  <span className="pr-1 text-right">{t('lists.colActions')}</span>
                </div>
                {detailLoading ? (
                  <div className="space-y-1 p-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-9 rounded-lg" />)}</div>
                ) : records.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[13px] text-ink-muted">{isDynamic ? (viewActive ? t('lists.emptyDynamicFiltered') : t('lists.emptyDynamicNoRule')) : t('lists.emptyStatic')}</div>
                ) : records.map((r) => (
                  <div key={r.id} className="grid items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-brand-50/30" style={{ gridTemplateColumns: `minmax(0,1.4fr) ${previewKeys.map(() => 'minmax(0,1fr)').join(' ')}${showListFields ? ' ' + listFields.map(() => 'minmax(0,1.1fr)').join(' ') : ''} auto` }}>
                    <button type="button" onClick={() => router.push(`/data?obj=${detail.list.primaryObject?.key ?? ''}`)} className="truncate text-left text-[13px] font-semibold text-ink hover:text-brand-700">{r.displayName || t('lists.recordFallback')}</button>
                    {previewKeys.map((k) => <span key={k} className="truncate text-[12px] text-ink-muted">{valText(r.values?.[k]) || '—'}</span>)}
                    {showListFields && listFields.map((a) => <div key={a.id} className="min-w-0">{renderListCell(r, a)}</div>)}
                    <div className="flex items-center justify-end">
                      {isDynamic ? (
                        <span title={t('lists.computedTitle')} className="flex h-7 w-7 items-center justify-center rounded-md text-violet-400"><Sparkles size={13} /></span>
                      ) : (
                        <button type="button" onClick={() => handleRemove(r.id)} title={t('lists.removeFromList')} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-subtle hover:bg-rose-50 hover:text-rose-600"><X size={14} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* M24-3 + M30-2: footer-калькуляции списка (S092) — object + list-поля (◇), считает backend */}
              {engineAttrs.length > 0 && (
                <div className="mt-1.5 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                  <CalcFooter attrs={engineAttrs} calcs={listCalcs} results={listCalculations} canManage onChange={setListCalcs} />
                </div>
              )}
              </>
              )}
            </div>
          )}
        </main>
      </div>

      {createOpen && (
        <CreateListModal
          objects={objects}
          onClose={() => setCreateOpen(false)}
          onCreated={async (id) => { setCreateOpen(false); await loadLists(); setSelectedId(id); showToast(t('lists.toastListCreated')); }}
          onError={showToast}
        />
      )}

      {editOpen && detail && (
        <EditListModal
          list={detail.list}
          onClose={() => setEditOpen(false)}
          onSaved={async () => { setEditOpen(false); await refresh(); showToast(t('lists.toastListUpdated')); }}
          onError={showToast}
        />
      )}

      {stagesOpen && detail && isPipeline && (
        <ManageStagesModal
          listId={detail.list.id}
          stages={pipelineStages}
          onClose={() => setStagesOpen(false)}
          onSaved={async () => { setStagesOpen(false); await refresh(); showToast(t('lists.toastStagesUpdated')); }}
          onError={showToast}
        />
      )}

      {manageFieldsOpen && detail && (
        <ManageListFieldsModal
          listId={detail.list.id}
          fields={listFields}
          onClose={() => setManageFieldsOpen(false)}
          onSaved={async () => { setManageFieldsOpen(false); await loadDetail(detail.list.id); showToast(t('lists.toastListFieldsUpdated')); }}
          onError={showToast}
        />
      )}

      {/* M30-4: импорт CSV в список — primary-объект для object-маппинга, list-поля (◇) как цели; недоступен для DYNAMIC. */}
      {importOpen && detail && !isDynamic && (
        <ImportModal
          objectKey={detail.list.primaryObject?.key ?? ''}
          objectLabel={detail.list.primaryObject?.singularName ?? t('lists.recordFallback')}
          attrs={listAttrs}
          listTarget={{ listId: detail.list.id, listLabel: detail.list.name, listFields }}
          onClose={() => setImportOpen(false)}
          onImported={async (r) => { setImportOpen(false); await refresh(); showToast(t('lists.toastImported', { created: r.created, updated: r.updated })); }}
        />
      )}

      {addOpen && detail && (
        <AddRecordsModal
          list={detail.list}
          existingIds={new Set(records.map((r) => r.id))}
          onClose={() => setAddOpen(false)}
          onAdded={async (n) => { setAddOpen(false); await refresh(); showToast(n === 1 ? t('lists.toastAddedOne', { count: n }) : t('lists.toastAddedMany', { count: n })); }}
          onError={showToast}
        />
      )}

      <Modal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title={t('lists.deleteTitle')}
        icon={<Trash2 size={14} />}
        footer={
          <>
            <button type="button" onClick={() => setConfirmDel(false)} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">{t('lists.deleteCancel')}</button>
            <button type="button" onClick={handleDeleteList} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 text-[12.5px] font-semibold text-white hover:bg-rose-700"><Trash2 size={13} /> {t('lists.deleteConfirm')}</button>
          </>
        }
      >
        <p className="text-[13px] leading-5 text-ink-muted">{t('lists.deleteBodyPrefix')}<span className="font-semibold text-ink">{detail?.list.name}</span>{t('lists.deleteBodySuffix')}</p>
      </Modal>

      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[12.5px] font-semibold text-ink shadow-lg">
          <span className="brand-gradient flex h-6 w-6 items-center justify-center rounded-lg text-white"><ListChecks size={12} /></span>
          {toast}
        </div>
      )}
    </>
  );
}

/* ── Dynamic rule editor (LST-1) ───────────────────────────────────────────────
   Конструктор правила DYNAMIC-списка: тот же FilterTreeBuilder (бэкенд считает через ОБЩИЙ
   recordFilter.ts), плюс live-предпросмотр matchedCount через /lists/preview-rule. */
function DynamicRuleEditor({ objectKey, value, onChange }: {
  objectKey: string; value: CrmFilterNode | null; onChange: (n: CrmFilterNode | null) => void;
}) {
  const t = useT();
  const [attrs, setAttrs] = useState<CrmAttribute[]>([]);
  const [preview, setPreview] = useState<{ matchedCount: number; warnings: string[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewErr, setPreviewErr] = useState('');
  const empty = !value || countLeaves(value) === 0;
  const valueKey = JSON.stringify(value ?? null);

  useEffect(() => {
    if (!objectKey) { setAttrs([]); return; }
    let alive = true;
    getObject(objectKey).then((o) => { if (alive) setAttrs(o.attributes ?? []); }).catch(() => { if (alive) setAttrs([]); });
    return () => { alive = false; };
  }, [objectKey]);

  useEffect(() => {
    if (!objectKey) { setPreview(null); return; }
    if (empty) { setPreview({ matchedCount: 0, warnings: [] }); setPreviewErr(''); setPreviewing(false); return; }
    let alive = true;
    setPreviewing(true); setPreviewErr('');
    const timer = setTimeout(() => {
      previewListRule({ objectKey, rule: value })
        .then((r) => { if (alive) { setPreview({ matchedCount: r.matchedCount, warnings: r.warnings }); setPreviewErr(''); } })
        .catch((e) => { if (alive) { setPreview(null); setPreviewErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('lists.ruleInvalid')); } })
        .finally(() => { if (alive) setPreviewing(false); });
    }, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [objectKey, valueKey, empty]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
      <div className="flex items-center justify-between">
        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-violet-700"><Sparkles size={12} /> {t('lists.ruleLabel')}</label>
        <span className={['inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold', previewErr ? 'bg-rose-100 text-rose-700' : empty ? 'bg-surface-2 text-ink-subtle' : 'bg-violet-100 text-violet-700'].join(' ')}>
          {previewing ? <><Loader2 size={10} className="animate-spin" /> {t('lists.ruleCounting')}</> : previewErr ? t('lists.ruleFix') : empty ? t('lists.ruleEmpty') : t('lists.ruleMatch', { count: preview?.matchedCount ?? '…' })}
        </span>
      </div>
      <FilterTreeBuilder attrs={attrs} value={value} onChange={onChange} />
      <p className={['flex items-start gap-1 text-[11px]', previewErr ? 'text-rose-600' : empty ? 'text-ink-subtle' : (preview?.warnings.length ? 'text-amber-700' : 'text-ink-subtle')].join(' ')}>
        <Info size={11} className="mt-[1px] shrink-0" />
        <span>
          {previewErr
            ? previewErr
            : empty
              ? t('lists.ruleEmptyHelp')
              : preview?.warnings.length
                ? preview.warnings.join(' ')
                : t('lists.ruleValidHelp')}
        </span>
      </p>
    </div>
  );
}

/* ── Create list ────────────────────────────────────────────────────────────── */
function CreateListModal({ objects, onClose, onCreated, onError }: {
  objects: CrmObject[]; onClose: () => void; onCreated: (id: string) => void; onError: (m: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState('');
  const [objectKey, setObjectKey] = useState(objects[0]?.key ?? '');
  const [icon, setIcon] = useState('📋');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'STATIC' | 'DYNAMIC' | 'PIPELINE'>('STATIC');
  const [rule, setRule] = useState<CrmFilterNode | null>(null);
  const [busy, setBusy] = useState(false);

  // смена объекта → правило сбрасываем (атрибуты другие)
  useEffect(() => { setRule(null); }, [objectKey]);

  async function save() {
    if (!name.trim() || !objectKey) return;
    setBusy(true);
    try {
      const created = await createList({ name, objectKey, description: description || undefined, icon, type, rule: type === 'DYNAMIC' ? rule : undefined });
      onCreated(created.id);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      onError(ax?.response?.data?.error ?? t('lists.createFailed'));
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={t('lists.createTitle')} icon={<ListChecks size={14} />}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">{t('lists.createCancel')}</button>
          <button type="button" onClick={save} disabled={busy || !name.trim() || !objectKey} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60">{busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}{t('lists.createSubmit')}</button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="flex items-end gap-3">
          <div className="w-16"><label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{t('lists.createIcon')}</label><input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} className={`${inputCls} text-center text-[18px]`} /></div>
          <div className="flex-1"><label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{t('lists.createName')}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('lists.createNamePlaceholder')} className={inputCls} /></div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{t('lists.createRecordsOf')}</label>
          <select value={objectKey} onChange={(e) => setObjectKey(e.target.value)} className={inputCls}>
            {objects.map((o) => <option key={o.id} value={o.key}>{o.pluralName}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-ink-subtle">{t('lists.createSingleObjectHint')}</p>
        </div>
        {/* LST-1/LST-2: тип списка — STATIC (ручной набор) / DYNAMIC (правило) / PIPELINE (стадии+kanban) */}
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{t('lists.createMembership')}</label>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setType('STATIC')} className={['flex flex-col gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors', type === 'STATIC' ? 'border-brand-400 bg-brand-50 ring-1 ring-inset ring-brand-200' : 'border-line bg-surface hover:bg-surface-2'].join(' ')}>
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink"><ListPlus size={12} /> {t('lists.createStatic')}</span>
              <span className="text-[10px] text-ink-subtle">{t('lists.createStaticDesc')}</span>
            </button>
            <button type="button" onClick={() => setType('DYNAMIC')} className={['flex flex-col gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors', type === 'DYNAMIC' ? 'border-violet-400 bg-violet-50 ring-1 ring-inset ring-violet-200' : 'border-line bg-surface hover:bg-surface-2'].join(' ')}>
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink"><Sparkles size={12} /> {t('lists.createDynamic')}</span>
              <span className="text-[10px] text-ink-subtle">{t('lists.createDynamicDesc')}</span>
            </button>
            <button type="button" onClick={() => setType('PIPELINE')} className={['flex flex-col gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors', type === 'PIPELINE' ? 'border-sky-400 bg-sky-50 ring-1 ring-inset ring-sky-200' : 'border-line bg-surface hover:bg-surface-2'].join(' ')}>
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink"><Columns3 size={12} /> {t('lists.createPipeline')}</span>
              <span className="text-[10px] text-ink-subtle">{t('lists.createPipelineDesc')}</span>
            </button>
          </div>
        </div>
        {type === 'DYNAMIC' && <DynamicRuleEditor objectKey={objectKey} value={rule} onChange={setRule} />}
        {type === 'PIPELINE' && (
          <p className="flex items-start gap-1 rounded-xl border border-sky-200 bg-sky-50/50 px-3 py-2 text-[11px] text-sky-700"><Columns3 size={12} className="mt-[1px] shrink-0" /><span>{t('lists.createPipelineInfo')}</span></p>
        )}
        <div><label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{t('lists.createDescription')}</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={t('lists.createDescriptionPlaceholder')} className={`${inputCls} h-auto resize-y py-2`} /></div>
      </div>
    </Modal>
  );
}

/* ── Edit list ──────────────────────────────────────────────────────────────── */
function EditListModal({ list, onClose, onSaved, onError }: {
  list: CrmList; onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState(list.name);
  const [icon, setIcon] = useState(list.icon || '📋');
  const [description, setDescription] = useState(list.description ?? '');
  const isDynamic = list.type === 'DYNAMIC';
  const originalRule = useMemo(() => JSON.stringify((list.config?.rule as CrmFilterNode | null) ?? null), [list.config?.rule]);
  const [rule, setRule] = useState<CrmFilterNode | null>((list.config?.rule as CrmFilterNode | null) ?? null);
  const [busy, setBusy] = useState(false);
  const objectKey = list.primaryObject?.key ?? '';
  // rule шлём ТОЛЬКО если реально менялся — иначе pure-rename перевалидирует правило strict (упадёт на
  // since-archived атрибут) и плодит лишний audit. Сравнение по нормализованному JSON.
  const ruleChanged = isDynamic && JSON.stringify(rule ?? null) !== originalRule;

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await updateList(list.id, { name, icon, description: description || null, ...(ruleChanged ? { rule } : {}) });
      onSaved();
    }
    catch (e) { onError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('lists.editFailed')); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={isDynamic ? t('lists.editTitleDynamic') : t('lists.editTitle')} icon={isDynamic ? <Sparkles size={14} /> : <Pencil size={14} />}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">{t('lists.editCancel')}</button>
          <button type="button" onClick={save} disabled={busy || !name.trim()} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60">{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}{t('lists.editSave')}</button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="flex items-end gap-3">
          <div className="w-16"><label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{t('lists.createIcon')}</label><input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} className={`${inputCls} text-center text-[18px]`} /></div>
          <div className="flex-1"><label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{t('lists.createName')}</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></div>
        </div>
        {isDynamic && <DynamicRuleEditor objectKey={objectKey} value={rule} onChange={setRule} />}
        <div><label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{t('lists.createDescription')}</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputCls} h-auto resize-y py-2`} /></div>
      </div>
    </Modal>
  );
}

/* ── Add records ────────────────────────────────────────────────────────────── */
function AddRecordsModal({ list, existingIds, onClose, onAdded, onError }: {
  list: CrmList; existingIds: Set<string>; onClose: () => void; onAdded: (n: number) => void; onError: (m: string) => void;
}) {
  const t = useT();
  const [search, setSearch] = useState('');
  const [recs, setRecs] = useState<CrmRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const objectKey = list.primaryObject?.key ?? '';

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listRecords({ objectKey, limit: 50, search: search.trim() || undefined })
      .then((r) => { if (alive) setRecs(r.records); })
      .catch(() => { if (alive) setRecs([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [objectKey, search]);

  function toggle(id: string) {
    setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function add() {
    if (picked.size === 0) return;
    setBusy(true);
    try { const res = await addListEntries(list.id, [...picked]); onAdded(res.added); }
    catch { onError(t('lists.addFailed')); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={t('lists.addTitle', { plural: list.primaryObject?.pluralName ?? t('lists.recordMany'), name: list.name })} icon={<ListPlus size={14} />}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">{t('lists.addCancel')}</button>
          <button type="button" onClick={add} disabled={busy || picked.size === 0} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60">{busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}{t('lists.addSubmit')} {picked.size || ''}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="inline-flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
          <Search size={14} className="text-ink-subtle" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('lists.addSearchPlaceholder')} className="min-w-0 flex-1 bg-transparent outline-none" />
        </div>
        <div className="max-h-[320px] space-y-1 overflow-y-auto">
          {loading ? (
            [...Array(5)].map((_, i) => <div key={i} className="skeleton h-9 rounded-lg" />)
          ) : recs.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-ink-muted">{t('lists.addNoRecords')}</p>
          ) : recs.map((r) => {
            const inList = existingIds.has(r.id);
            const sel = picked.has(r.id);
            return (
              <button key={r.id} type="button" disabled={inList} onClick={() => toggle(r.id)} className={['flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors', inList ? 'border-line bg-surface-2/40 opacity-60' : sel ? 'border-brand-300 bg-brand-50' : 'border-line bg-surface hover:bg-surface-2'].join(' ')}>
                <span className={['flex h-4 w-4 shrink-0 items-center justify-center rounded border', sel ? 'border-brand-500 bg-brand-600 text-white' : 'border-line'].join(' ')}>{sel && <Check size={11} />}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{r.displayName || t('lists.recordFallback')}</span>
                {inList && <span className="shrink-0 text-[10.5px] font-semibold text-ink-subtle">{t('lists.addInList')}</span>}
              </button>
            );
          })}
        </div>
        <p className="flex items-center gap-1 text-[11px] text-ink-subtle"><ArrowUpRight size={11} /> {t('lists.addRecordsOfHint', { plural: list.primaryObject?.pluralName ?? t('lists.recordMany') })}</p>
      </div>
    </Modal>
  );
}

/* ── Manage pipeline stages (LST-2) ───────────────────────────────────────────
   Стадии list-local: key стабилен (идентичность), label/color/порядок правятся. Удаление стадии с записями
   требует выбора moveToStage (backend 409 STAGE_HAS_ENTRIES). Reorder НЕ двигает записи. */
const STAGE_COLORS = ['#94a3b8', '#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899'];
const slugKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'stage';
function uniqueKey(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  for (let i = 2; i < 999; i++) { const k = `${base}_${i}`.slice(0, 40); if (!used.has(k)) return k; }
  return `${base}_${used.size}`.slice(0, 40);
}

interface StageRow { key: string; label: string; color: string | null }
function ManageStagesModal({ listId, stages, onClose, onSaved, onError }: {
  listId: string; stages: PipelineStage[]; onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const t = useT();
  const [rows, setRows] = useState<StageRow[]>(stages.map((s) => ({ key: s.key, label: s.label, color: s.color ?? null })));
  const [busy, setBusy] = useState(false);
  const [needMove, setNeedMove] = useState<{ removed: string[]; affected: number } | null>(null);
  const [moveTo, setMoveTo] = useState('');

  function addRow() {
    setRows((rs) => {
      const used = new Set(rs.map((r) => r.key));
      return [...rs, { key: uniqueKey('stage', used), label: t('lists.stageNewLabel'), color: STAGE_COLORS[rs.length % STAGE_COLORS.length] }];
    });
  }
  function setLabel(i: number, v: string) { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, label: v } : r))); }
  function setColor(i: number, v: string) { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, color: v } : r))); }
  function removeRow(i: number) { setRows((rs) => rs.filter((_, j) => j !== i)); setNeedMove(null); }
  function move(i: number, dir: -1 | 1) {
    setRows((rs) => { const j = i + dir; if (j < 0 || j >= rs.length) return rs; const c = [...rs]; [c[i], c[j]] = [c[j], c[i]]; return c; });
    setNeedMove(null);
  }

  async function save(withMoveTo?: string) {
    if (rows.length === 0) { onError(t('lists.stageNeedOne')); return; }
    if (rows.some((r) => !r.label.trim())) { onError(t('lists.stageNeedLabel')); return; }
    setBusy(true);
    try {
      const payload: PipelineStage[] = rows.map((r, i) => ({ key: r.key, label: r.label.trim(), color: r.color, order: i }));
      await updateListStages(listId, payload, withMoveTo);
      onSaved();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string; code?: string; removedKeys?: string[]; affected?: number } } };
      const d = ax?.response?.data;
      if (d?.code === 'STAGE_HAS_ENTRIES') {
        setNeedMove({ removed: d.removedKeys ?? [], affected: d.affected ?? 0 });
        setMoveTo(rows[0]?.key ?? '');
      } else {
        onError(d?.error ?? t('lists.stagesSaveFailed'));
      }
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={t('lists.stagesTitleModal')} icon={<Columns3 size={14} />}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">{t('lists.stagesCancel')}</button>
          {needMove ? (
            <button type="button" onClick={() => save(moveTo)} disabled={busy || !moveTo} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60">{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}{t('lists.stagesMoveSave')}</button>
          ) : (
            <button type="button" onClick={() => save()} disabled={busy} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60">{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}{t('lists.stagesSave')}</button>
          )}
        </>
      }
    >
      <div className="space-y-2">
        <p className="text-[11.5px] text-ink-muted">{t('lists.stagesIntro')}</p>
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5">
            <div className="flex flex-col">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="flex h-4 w-5 items-center justify-center rounded text-ink-subtle hover:bg-surface-2 disabled:opacity-30"><ArrowUp size={12} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="flex h-4 w-5 items-center justify-center rounded text-ink-subtle hover:bg-surface-2 disabled:opacity-30"><ArrowDown size={12} /></button>
            </div>
            <input aria-label={t('lists.stageColor')} type="color" value={r.color ?? '#94a3b8'} onChange={(e) => setColor(i, e.target.value)} className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-line bg-surface p-0.5" />
            <input value={r.label} onChange={(e) => setLabel(i, e.target.value)} placeholder={t('lists.stageLabelPlaceholder')} className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
            <span className="hidden shrink-0 font-mono text-[10px] text-ink-subtle sm:inline" title={t('lists.stageStableKey')}>{r.key}</span>
            <button type="button" onClick={() => removeRow(i)} disabled={rows.length <= 1} title={rows.length <= 1 ? t('lists.stageNeedOne') : t('lists.stageRemove')} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-subtle hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"><X size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={addRow} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-line bg-surface px-3 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2"><Plus size={13} /> {t('lists.stageAdd')}</button>

        {needMove && (
          <div className="mt-1 space-y-2 rounded-xl border border-amber-300 bg-amber-50/60 p-3">
            <p className="flex items-start gap-1.5 text-[12px] text-amber-800"><GripVertical size={12} className="mt-[1px] shrink-0" /><span>{needMove.affected === 1 ? t('lists.stageMoveConflictOne', { affected: needMove.affected, keys: needMove.removed.join(', ') }) : t('lists.stageMoveConflictMany', { affected: needMove.affected, keys: needMove.removed.join(', ') })}</span></p>
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-[12.5px] text-ink focus:border-brand-400 focus:outline-none">
              {rows.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ── Sort control (M30-2) ─────────────────────────────────────────────────────
   Мультисорт по object + list-полям. Backend (recordSort) разрешает list:<key>. list-поля
   приходят с маркером ◇ в имени → единый list-маркер и в sort-меню. */
function SortControl({ attrs, sorts, onChange }: {
  attrs: CrmAttribute[]; sorts: CrmViewSort[]; onChange: (s: CrmViewSort[]) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const used = new Set(sorts.map((s) => s.attributeKey));
  const addable = attrs.filter((a) => !used.has(a.key));
  function add() { const a = addable[0]; if (!a) return; onChange([...sorts, { attributeKey: a.key, dir: 'asc' }]); }
  function setAt(i: number, patch: Partial<CrmViewSort>) { onChange(sorts.map((s, j) => (j === i ? { ...s, ...patch } : s))); }
  function removeAt(i: number) { onChange(sorts.filter((_, j) => j !== i)); }
  const active = sorts.length > 0;
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={['inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors', active ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-surface text-ink-muted hover:bg-surface-2'].join(' ')}>
        <ArrowDownUp size={13} /> {t('lists.sortBtn')}{active ? ` · ${sorts.length}` : ''}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-[320px] rounded-xl border border-line bg-surface p-2.5 shadow-xl">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-subtle">{t('lists.sortHeader')}</p>
          {sorts.length === 0 && <p className="px-1 py-1.5 text-[12px] text-ink-subtle">{t('lists.sortNone')}</p>}
          <div className="space-y-1.5">
            {sorts.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-4 shrink-0 text-right text-[10px] text-ink-subtle">{i + 1}</span>
                <select value={s.attributeKey} onChange={(e) => setAt(i, { attributeKey: e.target.value })} className="h-7 min-w-0 flex-1 rounded-md border border-line bg-[var(--surface)] px-1.5 text-[11.5px] text-ink focus:border-brand-400 focus:outline-none">
                  {attrs.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
                </select>
                <select value={s.dir} onChange={(e) => setAt(i, { dir: e.target.value as CrmViewSort['dir'] })} className="h-7 shrink-0 rounded-md border border-line bg-[var(--surface)] px-1.5 text-[11.5px] text-ink focus:border-brand-400 focus:outline-none">
                  <option value="asc">{t('lists.sortAsc')}</option>
                  <option value="desc">{t('lists.sortDesc')}</option>
                </select>
                <button type="button" onClick={() => removeAt(i)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-rose-50 hover:text-rose-600"><X size={12} /></button>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            {addable.length > 0 && (
              <button type="button" onClick={add} className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-line px-2 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-50"><Plus size={12} /> {t('lists.sortAdd')}</button>
            )}
            {active && <button type="button" onClick={() => onChange([])} className="text-[11px] font-medium text-ink-subtle hover:text-rose-600">{t('lists.sortClear')}</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Manage list fields (M30-2) ───────────────────────────────────────────────
   Полный менеджер list-specific полей: rename / reorder / required / archive + правка опций
   SELECT/MULTI_SELECT. Тип поля неизменяем (хранилище привязано к типу). Изменения применяются по
   Save: archive(DELETE soft) → update(PATCH name/required/order/options) → create(POST нового). */
const slugOpt = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
function optionsSig(opts: { value: string; label: string; color: string | null }[]): string {
  return JSON.stringify(opts.map((o) => [o.value, o.label, o.color ?? null]));
}
interface FieldRow {
  id: string; key: string; name: string; type: CrmAttribute['type']; isRequired: boolean;
  options: { value: string; label: string; color: string | null }[];
  _delete?: boolean; _origName: string; _origRequired: boolean; _origOptionsSig: string;
}
function ManageListFieldsModal({ listId, fields, onClose, onSaved, onError }: {
  listId: string; fields: CrmListAttribute[]; onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const t = useT();
  const isSel = (ty: CrmAttribute['type']) => ty === 'SELECT' || ty === 'MULTI_SELECT';
  const [rows, setRows] = useState<FieldRow[]>(() => fields.map((a) => {
    const options = a.options.map((o) => ({ value: o.value, label: o.label, color: o.color }));
    return { id: a.id, key: a.key, name: a.name, type: a.type, isRequired: a.isRequired, options, _origName: a.name, _origRequired: a.isRequired, _origOptionsSig: optionsSig(options) };
  }));
  const [busy, setBusy] = useState(false);
  const [naName, setNaName] = useState('');
  const [naType, setNaType] = useState<CrmAttribute['type']>('TEXT');
  const [naOptions, setNaOptions] = useState('');

  const upd = (i: number, patch: Partial<FieldRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  function move(i: number, dir: -1 | 1) { setRows((rs) => { const j = i + dir; if (j < 0 || j >= rs.length) return rs; const c = [...rs]; [c[i], c[j]] = [c[j], c[i]]; return c; }); }
  function setOptLabel(i: number, oi: number, v: string) { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, options: r.options.map((o, k) => (k === oi ? { ...o, label: v } : o)) } : r))); }
  function addOpt(i: number) { setRows((rs) => rs.map((r, j) => { if (j !== i) return r; const used = new Set(r.options.map((o) => o.value)); let v = 'option'; for (let n = 1; used.has(v); n++) v = `option_${n}`; return { ...r, options: [...r.options, { value: v, label: t('lists.mfNewOption'), color: null }] }; })); }
  function removeOpt(i: number, oi: number) { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, options: r.options.filter((_, k) => k !== oi) } : r))); }

  async function save() {
    for (const r of rows) {
      if (r._delete) continue;
      if (!r.name.trim()) { onError(t('lists.mfEveryFieldName')); return; }
      if (isSel(r.type) && r.options.some((o) => !o.label.trim())) { onError(t('lists.mfEveryOptionLabel')); return; }
    }
    setBusy(true);
    try {
      // 1) архивирование помеченных
      for (const r of rows) if (r._delete) await deleteListAttribute(listId, r.id);
      // 2) обновления выживших (rename/required/options) + порядок (idx среди выживших)
      const kept = rows.filter((r) => !r._delete);
      const origKeptIds = fields.map((f) => f.id).filter((id) => kept.some((k) => k.id === id));
      for (let idx = 0; idx < kept.length; idx++) {
        const r = kept[idx];
        const nameChanged = r.name.trim() !== r._origName;
        const reqChanged = r.isRequired !== r._origRequired;
        const optsChanged = isSel(r.type) && optionsSig(r.options) !== r._origOptionsSig;
        const orderChanged = idx !== origKeptIds.indexOf(r.id);
        if (nameChanged || reqChanged || optsChanged || orderChanged) {
          await updateListAttribute(listId, r.id, {
            ...(nameChanged ? { name: r.name.trim() } : {}),
            ...(reqChanged ? { isRequired: r.isRequired } : {}),
            ...(orderChanged ? { order: idx } : {}),
            ...(optsChanged ? { options: r.options.map((o, k) => ({ value: o.value, label: o.label.trim(), order: k })) } : {}),
          });
        }
      }
      // 3) новое поле (если введено имя)
      if (naName.trim()) {
        const options = isSel(naType)
          ? naOptions.split(',').map((s) => s.trim()).filter(Boolean).map((s) => ({ value: slugOpt(s) || s, label: s }))
          : undefined;
        await createListAttribute(listId, { name: naName.trim(), type: naType, options });
      }
      onSaved();
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      onError(ax?.response?.data?.error ?? t('lists.mfSaveFailed'));
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={t('lists.mfTitle')} icon={<Tag size={14} />}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">{t('lists.mfCancel')}</button>
          <button type="button" onClick={save} disabled={busy} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60">{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}{t('lists.mfSave')}</button>
        </>
      }
    >
      <div className="space-y-2">
        <p className="flex items-start gap-1.5 text-[11.5px] text-ink-muted"><Info size={12} className="mt-[1px] shrink-0 text-indigo-500" /><span>{t('lists.mfIntro')}</span></p>
        {rows.map((r, i) => (
          <div key={r.id} className={['rounded-xl border px-2 py-2', r._delete ? 'border-rose-200 bg-rose-50/40' : 'border-line bg-surface'].join(' ')}>
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || !!r._delete} className="flex h-4 w-5 items-center justify-center rounded text-ink-subtle hover:bg-surface-2 disabled:opacity-30"><ArrowUp size={12} /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1 || !!r._delete} className="flex h-4 w-5 items-center justify-center rounded text-ink-subtle hover:bg-surface-2 disabled:opacity-30"><ArrowDown size={12} /></button>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-indigo-500" title={t('lists.mfTag')}><Tag size={12} /></span>
              <input value={r.name} onChange={(e) => upd(i, { name: e.target.value })} disabled={!!r._delete} className={['h-8 min-w-0 flex-1 rounded-lg border bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100', r._delete ? 'border-rose-200 line-through opacity-60' : 'border-line'].join(' ')} />
              <span className="hidden shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-subtle sm:inline" title={t('lists.mfFieldTypeImmutable')}>{r.type.replace(/_/g, ' ')}</span>
              <label className={['inline-flex shrink-0 items-center gap-1 text-[11px] font-medium', r._delete ? 'text-ink-subtle' : 'text-ink-muted'].join(' ')} title={t('lists.mfRequired')}>
                <input type="checkbox" checked={r.isRequired} onChange={(e) => upd(i, { isRequired: e.target.checked })} disabled={!!r._delete} className="h-3.5 w-3.5 accent-indigo-600" /> {t('lists.mfReq')}
              </label>
              <button type="button" onClick={() => upd(i, { _delete: !r._delete })} title={r._delete ? t('lists.mfKeepField') : t('lists.mfArchiveField')} className={['flex h-7 shrink-0 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold', r._delete ? 'text-emerald-700 hover:bg-emerald-50' : 'text-ink-subtle hover:bg-rose-50 hover:text-rose-600'].join(' ')}>{r._delete ? t('lists.mfKeep') : <Trash2 size={13} />}</button>
            </div>
            {isSel(r.type) && !r._delete && (
              <div className="mt-2 space-y-1 rounded-lg border border-indigo-100 bg-indigo-50/30 p-1.5">
                <p className="px-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600">{t('lists.mfOptions')}</p>
                {r.options.length === 0 && <p className="px-0.5 py-0.5 text-[11px] text-ink-subtle">{t('lists.mfNoOptions')}</p>}
                {r.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-1.5">
                    <input value={o.label} onChange={(e) => setOptLabel(i, oi, e.target.value)} placeholder={t('lists.mfOptionLabelPlaceholder')} className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-[12px] text-ink focus:border-indigo-400 focus:outline-none" />
                    <span className="hidden shrink-0 font-mono text-[9.5px] text-ink-subtle sm:inline" title={t('lists.mfStableValue')}>{o.value}</span>
                    <button type="button" onClick={() => removeOpt(i, oi)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-rose-50 hover:text-rose-600"><X size={12} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => addOpt(i)} className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-indigo-200 px-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"><Plus size={11} /> {t('lists.mfOption')}</button>
              </div>
            )}
          </div>
        ))}

        {/* добавить новое поле */}
        <div className="mt-1 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 p-2">
          <p className="mb-1.5 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-indigo-700"><Plus size={12} /> {t('lists.mfAddField')}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <input value={naName} onChange={(e) => setNaName(e.target.value)} placeholder={t('lists.fieldNamePlaceholder')} className="h-7 w-36 rounded-md border border-line bg-surface px-2 text-[12px] text-ink focus:border-indigo-400 focus:outline-none" />
            <select value={naType} onChange={(e) => setNaType(e.target.value as CrmAttribute['type'])} className="h-7 rounded-md border border-line bg-surface px-1.5 text-[12px] text-ink focus:outline-none">
              {LIST_FIELD_TYPES.map((ft) => <option key={ft} value={ft}>{ft.replace(/_/g, ' ')}</option>)}
            </select>
            {isSel(naType) && (
              <input value={naOptions} onChange={(e) => setNaOptions(e.target.value)} placeholder={t('lists.fieldOptionsPlaceholder')} className="h-7 w-48 rounded-md border border-line bg-surface px-2 text-[12px] text-ink focus:border-indigo-400 focus:outline-none" />
            )}
          </div>
          <p className="mt-1 text-[10.5px] text-ink-subtle">{t('lists.mfNewFieldHint')}</p>
        </div>
      </div>
    </Modal>
  );
}
