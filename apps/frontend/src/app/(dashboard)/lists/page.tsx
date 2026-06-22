'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/layout/Topbar';
import FilterTreeBuilder from '@/components/data/FilterTreeBuilder';
import DataHubBoard from '@/components/data/DataHubBoard';
import PipelineBoard from '@/components/data/PipelineBoard';
import CalcFooter from '@/components/data/CalcFooter';
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
} from '@/lib/crmApi';
import { teamApi } from '@/lib/api';

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

export default function ListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<CrmList[]>([]);
  const [objects, setObjects] = useState<CrmObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ListDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false); // LST-2: manage pipeline stages

  // M24-1: list table-view — AND/OR фильтр через ОБЩИЙ движок (listListRecords → recordFilter.ts).
  const [listAttrs, setListAttrs] = useState<CrmAttribute[]>([]);
  const [filterTree, setFilterTree] = useState<CrmFilterNode | null>(null);
  const [showFilter, setShowFilter] = useState(false);
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

  // при смене списка — сбрасываем фильтр/калькуляции и грузим атрибуты объекта списка (для builder)
  useEffect(() => {
    setFilterTree(null); setFiltered(null); setFilteredMeta(null); setShowFilter(false); setListCalcs({}); setListCalculations([]);
    const key = detail?.list.primaryObject?.key;
    if (key) getObject(key).then((o) => setListAttrs(o.attributes ?? [])).catch(() => setListAttrs([]));
    else setListAttrs([]);
  }, [detail?.list.id, detail?.list.primaryObject?.key]);

  // применяем filterTree + calcs к записям списка ЧЕРЕЗ backend (тот же recordFilter/recordAggregate, что Data Hub)
  const hasCalcs = Object.keys(listCalcs).length > 0;
  useEffect(() => {
    const id = detail?.list.id;
    if (!id || (!filterTree && !hasCalcs)) { setFiltered(null); setListCalculations([]); return; }
    let alive = true;
    setFiltering(true);
    listListRecords(id, { filterTree, limit: 200, calcs: Object.entries(listCalcs).map(([attributeKey, type]) => ({ attributeKey, type })) })
      .then((r) => { if (alive) { setFiltered(r.records as ListRecordEntry[]); setListCalculations(r.calculations ?? []); setFilteredMeta({ restrictedSource: r.restrictedSource, hiddenCount: r.hiddenCount }); } })
      .catch(() => { if (alive) { setFiltered([]); setListCalculations([]); setFilteredMeta(null); } })
      .finally(() => { if (alive) setFiltering(false); });
    return () => { alive = false; };
  }, [detail?.list.id, filterTree, listCalcs]); // eslint-disable-line react-hooks/exhaustive-deps

  const records = ((filterTree || hasCalcs) ? filtered : detail?.records) ?? [];

  // LST-1: DYNAMIC = вычисляемое членство (rule). restrictedSource — нет OBJECT READ (записи и правило скрыты).
  const isDynamic = detail?.list.type === 'DYNAMIC';
  const isPipeline = detail?.list.type === 'PIPELINE'; // LST-2
  const pipelineStages: PipelineStage[] = useMemo(() => (detail?.list.config?.stages ?? []) as PipelineStage[], [detail?.list.config?.stages]);
  const viewActive = Boolean(filterTree || hasCalcs);
  const restricted = (viewActive ? filteredMeta?.restrictedSource : detail?.restrictedSource) ?? false;
  const hiddenCount = (viewActive ? filteredMeta?.hiddenCount : detail?.hiddenCount) ?? 0;
  const matchedCount = detail?.matchedCount;

  // M24-2: board группировка по SELECT/USER атрибуту списка
  const groupableAttrs = useMemo(() => listAttrs.filter((a) => (a.type === 'SELECT' && (a.options?.length ?? 0) > 0) || a.type === 'USER'), [listAttrs]);
  const canBoard = groupableAttrs.length > 0;
  const groupAttr = useMemo(() => listAttrs.find((a) => a.key === groupByKey && (a.type === 'SELECT' || a.type === 'USER')) ?? null, [listAttrs, groupByKey]);
  // LST-2: для PIPELINE по умолчанию открываем kanban (board); иначе таблицу.
  useEffect(() => { setListViewType(detail?.list.type === 'PIPELINE' ? 'board' : 'table'); }, [detail?.list.id, detail?.list.type]);
  // groupByKey ставим/сохраняем по готовности groupableAttrs (listAttrs грузятся async — иначе ключ пустой и board=table)
  useEffect(() => { setGroupByKey((prev) => (groupableAttrs.some((a) => a.key === prev) ? prev : (groupableAttrs[0]?.key ?? ''))); }, [groupableAttrs]);
  useEffect(() => { teamApi.members().then((r) => setUserOpts(r.members.map((m) => ({ value: m.id, label: m.name || m.email })))).catch(() => {}); }, []);

  // LST-2: перенос карточки между стадиями pipeline (drag-persist). Паттерн M24-2: PATCH → re-fetch (порядок/позиции
  // канонические из БД), busy-спиннер на карточке; при ошибке откат через повторную загрузку детали.
  async function pipelineMove(recordId: string, toStage: string, toPosition?: number) {
    if (!detail) return;
    setBoardBusyId(recordId);
    try {
      const r = await moveListEntry(detail.list.id, recordId, toStage, toPosition);
      if (r.moved) showToast('Card moved · stage saved to list');
      if (selectedId) await loadDetail(selectedId);
      if (detail.list.id && (filterTree || hasCalcs)) { const fr = await listListRecords(detail.list.id, { filterTree, limit: 200 }); setFiltered(fr.records as ListRecordEntry[]); }
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      showToast(ax?.response?.data?.error ?? 'Move failed');
      if (selectedId) await loadDetail(selectedId); // откат к серверному состоянию
    } finally { setBoardBusyId(null); }
  }

  async function listMoveCard(recordId: string, _from: string | null, to: string | null) {
    if (!groupAttr) return;
    setBoardBusyId(recordId);
    try {
      await moveRecord(recordId, groupAttr.key, to);
      showToast('Card moved · saved to CRM');
      if (selectedId) await loadDetail(selectedId);
      if (detail?.list.id && filterTree) { const r = await listListRecords(detail.list.id, { filterTree, limit: 200 }); setFiltered(r.records as ListRecordEntry[]); }
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } };
      showToast(ax?.response?.data?.error ?? 'Move failed');
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

  async function refresh() {
    await loadLists();
    if (selectedId) await loadDetail(selectedId);
  }

  async function handleRemove(recordId: string) {
    if (!detail) return;
    try {
      await removeListEntry(detail.list.id, recordId);
      showToast('Removed from list');
      await refresh();
    } catch { showToast('Could not remove'); }
  }

  async function handleDeleteList() {
    if (!detail) return;
    try {
      await archiveList(detail.list.id);
      showToast(`List “${detail.list.name}” deleted`);
      setConfirmDel(false);
      setSelectedId(null);
      const ls = await listLists();
      setLists(ls);
      setSelectedId(ls[0]?.id ?? null);
    } catch { showToast('Could not delete'); }
  }

  return (
    <>
      <Topbar title="Lists" icon={<ListChecks size={18} strokeWidth={1.85} />} />

      <div className="flex min-h-0 flex-1">
        {/* lists */}
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-line bg-surface/50 md:flex">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Lists</p>
            <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100"><Plus size={12} /> New</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {loading ? (
              <div className="space-y-1.5 px-1">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-11 rounded-lg" />)}</div>
            ) : lists.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-ink-muted">No lists yet. Create one to curate records.</p>
            ) : lists.map((l) => {
              const active = l.id === selectedId;
              return (
                <button key={l.id} type="button" onClick={() => setSelectedId(l.id)} className={['group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors', active ? 'sidebar-active-gradient ring-1 ring-inset ring-brand-100' : 'hover:bg-surface-2'].join(' ')}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-[14px] shadow-xs">{l.icon || '📋'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{l.name}</span>
                    <span className="block truncate text-[11px] text-ink-subtle">{l.primaryObject?.pluralName ?? '—'} · {l.type === 'DYNAMIC' ? 'rule-based' : (l._count?.entries ?? 0)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* detail */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          {!detail ? (
            <div className="flex h-full items-center justify-center text-[13px] text-ink-subtle">{detailLoading ? 'Loading…' : (loading ? '' : 'Select or create a list')}</div>
          ) : (
            <div className={`mx-auto p-6 ${isPipeline && listViewType === 'board' ? 'max-w-[1600px]' : 'max-w-4xl'}`}>
              {/* header */}
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-[24px]">{detail.list.icon || '📋'}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-[19px] font-extrabold tracking-[-0.02em] text-ink">{detail.list.name}</h1>
                    {isDynamic ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10.5px] font-bold uppercase text-violet-700 ring-1 ring-inset ring-violet-200"><Sparkles size={11} /> Dynamic</span>
                    ) : isPipeline ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-bold uppercase text-sky-700 ring-1 ring-inset ring-sky-200"><Columns3 size={11} /> Pipeline</span>
                    ) : (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold uppercase text-ink-subtle">{detail.list.type}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">{detail.list.description || (isDynamic ? 'Membership is computed automatically from a rule — records that match are always in the list.' : `A curated list of ${detail.list.primaryObject?.pluralName?.toLowerCase() ?? 'records'}.`)}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11.5px] text-ink-subtle">
                    <span className="inline-flex items-center gap-1"><Users size={12} /> {detail.list.primaryObject?.pluralName}</span>
                    {isDynamic
                      ? <span className="inline-flex items-center gap-1 text-violet-700"><Sparkles size={11} /> {restricted ? `${hiddenCount} match the rule` : `${matchedCount ?? records.length} match the rule`}</span>
                      : <span>{records.length} {records.length === 1 ? 'record' : 'records'}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button type="button" onClick={() => setEditOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink"><Pencil size={13} /> Edit</button>
                  {!detail.list.isSystem && (
                    <button type="button" onClick={() => setConfirmDel(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-medium text-rose-600 hover:bg-rose-50"><Trash2 size={13} /> Delete</button>
                  )}
                </div>
              </div>

              <div className="mb-2.5 flex items-center justify-between">
                <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
                  Records · {records.length}
                  {filterTree && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">filtered{filtering ? ' …' : ''}</span>}
                </p>
                <div className="flex items-center gap-1.5">
                  {/* M24-2: Table | Board переключатель. Для PIPELINE board = kanban по list-local стадиям. */}
                  {(canBoard || isPipeline) && (
                    <div className="inline-flex h-8 items-center rounded-lg border border-line bg-surface-2/60 p-0.5" role="tablist" aria-label="List view layout">
                      <button type="button" onClick={() => setListViewType('table')} className={['inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-semibold transition-colors', listViewType === 'table' ? 'bg-surface text-brand-700 shadow-xs ring-1 ring-inset ring-brand-100' : 'text-ink-muted hover:text-ink'].join(' ')}><Table2 size={13} /> Table</button>
                      <button type="button" onClick={() => setListViewType('board')} className={['inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-semibold transition-colors', listViewType === 'board' ? 'bg-surface text-brand-700 shadow-xs ring-1 ring-inset ring-brand-100' : 'text-ink-muted hover:text-ink'].join(' ')}>{isPipeline ? <><Columns3 size={13} /> Pipeline</> : <><LayoutGrid size={13} /> Board</>}</button>
                    </div>
                  )}
                  {!isPipeline && listViewType === 'board' && groupableAttrs.length > 1 && (
                    <select value={groupByKey} onChange={(e) => setGroupByKey(e.target.value)} title="Group board by" className="h-8 rounded-lg border border-line bg-[var(--surface)] px-2 text-[12px] font-medium text-ink-muted focus:border-brand-400 focus:outline-none">
                      {groupableAttrs.map((a) => <option key={a.key} value={a.key}>by {a.name}</option>)}
                    </select>
                  )}
                  {isPipeline && (
                    <button type="button" onClick={() => setStagesOpen(true)} title="Manage pipeline stages (list-local)" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-2.5 text-[12.5px] font-semibold text-sky-700 hover:bg-sky-100"><Columns3 size={13} /> Stages</button>
                  )}
                  {/* M24-1: тот же AND/OR builder, что в Data Hub — list table-view применяет фильтр через backend */}
                  <button type="button" onClick={() => setShowFilter((s) => !s)} className={['inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors', countLeaves(filterTree) > 0 ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-surface text-ink-muted hover:bg-surface-2'].join(' ')}>
                    <FilterIcon size={13} /> Advanced filter{countLeaves(filterTree) > 0 ? ` · ${countLeaves(filterTree)}` : ''}
                  </button>
                  {isDynamic ? (
                    <button type="button" onClick={() => setEditOpen(true)} title="Membership is computed from a rule — edit the rule to change which records are included" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 text-[12.5px] font-semibold text-violet-700 hover:bg-violet-100 transition-all"><Sparkles size={14} /> Edit rule</button>
                  ) : (
                    <button type="button" onClick={() => setAddOpen(true)} className="brand-gradient inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-white shadow-brand hover:-translate-y-0.5 hover:shadow-md transition-all"><ListPlus size={14} /> Add records</button>
                  )}
                </div>
              </div>

              {showFilter && (
                <div className="mb-2.5 rounded-2xl border border-line bg-surface p-3 shadow-sm">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-subtle">Advanced filter · AND / OR groups</p>
                  <FilterTreeBuilder attrs={listAttrs} value={filterTree} onChange={setFilterTree} />
                </div>
              )}

              {restricted ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 px-6 py-12 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700"><ShieldAlert size={20} /></span>
                  <p className="text-[13.5px] font-semibold text-ink">Records hidden by object permissions</p>
                  <p className="max-w-md text-[12px] text-ink-muted">
                    You can see this list, but not the {detail.list.primaryObject?.pluralName?.toLowerCase() ?? 'records'} it points to.
                    {hiddenCount > 0 ? ` ${hiddenCount} record${hiddenCount === 1 ? '' : 's'} ${hiddenCount === 1 ? 'is' : 'are'} hidden.` : ''}
                    {isDynamic ? ' The membership rule is hidden too.' : ''}
                  </p>
                </div>
              ) : isPipeline && listViewType === 'board' ? (
                <div className="h-[calc(100vh-22rem)] min-h-[360px] overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                  <PipelineBoard stages={pipelineStages} records={records} canManage busyId={boardBusyId} onMove={pipelineMove} onOpen={() => router.push(`/data?obj=${detail.list.primaryObject?.key ?? ''}`)} />
                </div>
              ) : !isPipeline && listViewType === 'board' && groupAttr ? (
                <div className="h-[calc(100vh-22rem)] min-h-[360px] overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                  <DataHubBoard records={records as unknown as CrmRecord[]} groupAttr={groupAttr} userOptions={userOpts} canManage busyId={boardBusyId} onMove={listMoveCard} onOpen={() => router.push(`/data?obj=${detail.list.primaryObject?.key ?? ''}`)} />
                </div>
              ) : (
              <>
              <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <div className="grid items-center gap-3 border-b border-line bg-surface-2/40 px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-subtle" style={{ gridTemplateColumns: `minmax(0,1.4fr) ${previewKeys.map(() => 'minmax(0,1fr)').join(' ')} auto` }}>
                  <span>Name</span>
                  {previewKeys.map((k) => <span key={k} className="truncate">{k.replace(/_/g, ' ')}</span>)}
                  <span className="pr-1 text-right">Actions</span>
                </div>
                {detailLoading ? (
                  <div className="space-y-1 p-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-9 rounded-lg" />)}</div>
                ) : records.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[13px] text-ink-muted">{isDynamic ? (viewActive ? 'No records match the rule and this filter.' : 'No records match this rule yet — click “Edit rule” to adjust it.') : 'No records in this list yet — click “Add records”.'}</div>
                ) : records.map((r) => (
                  <div key={r.id} className="grid items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-brand-50/30" style={{ gridTemplateColumns: `minmax(0,1.4fr) ${previewKeys.map(() => 'minmax(0,1fr)').join(' ')} auto` }}>
                    <button type="button" onClick={() => router.push(`/data?obj=${detail.list.primaryObject?.key ?? ''}`)} className="truncate text-left text-[13px] font-semibold text-ink hover:text-brand-700">{r.displayName || 'Record'}</button>
                    {previewKeys.map((k) => <span key={k} className="truncate text-[12px] text-ink-muted">{valText(r.values?.[k]) || '—'}</span>)}
                    <div className="flex items-center justify-end">
                      {isDynamic ? (
                        <span title="Computed from the list rule — membership can't be edited by hand" className="flex h-7 w-7 items-center justify-center rounded-md text-violet-400"><Sparkles size={13} /></span>
                      ) : (
                        <button type="button" onClick={() => handleRemove(r.id)} title="Remove from list" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-subtle hover:bg-rose-50 hover:text-rose-600"><X size={14} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* M24-3: footer-калькуляции списка (S092) — паритет с object table */}
              {listAttrs.length > 0 && (
                <div className="mt-1.5 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                  <CalcFooter attrs={listAttrs} calcs={listCalcs} results={listCalculations} canManage onChange={setListCalcs} />
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
          onCreated={async (id) => { setCreateOpen(false); await loadLists(); setSelectedId(id); showToast('List created'); }}
          onError={showToast}
        />
      )}

      {editOpen && detail && (
        <EditListModal
          list={detail.list}
          onClose={() => setEditOpen(false)}
          onSaved={async () => { setEditOpen(false); await refresh(); showToast('List updated'); }}
          onError={showToast}
        />
      )}

      {stagesOpen && detail && isPipeline && (
        <ManageStagesModal
          listId={detail.list.id}
          stages={pipelineStages}
          onClose={() => setStagesOpen(false)}
          onSaved={async () => { setStagesOpen(false); await refresh(); showToast('Stages updated'); }}
          onError={showToast}
        />
      )}

      {addOpen && detail && (
        <AddRecordsModal
          list={detail.list}
          existingIds={new Set(records.map((r) => r.id))}
          onClose={() => setAddOpen(false)}
          onAdded={async (n) => { setAddOpen(false); await refresh(); showToast(`Added ${n} record${n === 1 ? '' : 's'}`); }}
          onError={showToast}
        />
      )}

      <Modal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="Delete list"
        icon={<Trash2 size={14} />}
        footer={
          <>
            <button type="button" onClick={() => setConfirmDel(false)} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">Cancel</button>
            <button type="button" onClick={handleDeleteList} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 text-[12.5px] font-semibold text-white hover:bg-rose-700"><Trash2 size={13} /> Delete</button>
          </>
        }
      >
        <p className="text-[13px] leading-5 text-ink-muted">Delete the list <span className="font-semibold text-ink">{detail?.list.name}</span>? Records themselves stay in the CRM — only the list (and its membership) is removed (soft-archive).</p>
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
    const t = setTimeout(() => {
      previewListRule({ objectKey, rule: value })
        .then((r) => { if (alive) { setPreview({ matchedCount: r.matchedCount, warnings: r.warnings }); setPreviewErr(''); } })
        .catch((e) => { if (alive) { setPreview(null); setPreviewErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'This rule is invalid'); } })
        .finally(() => { if (alive) setPreviewing(false); });
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [objectKey, valueKey, empty]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
      <div className="flex items-center justify-between">
        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-violet-700"><Sparkles size={12} /> Membership rule</label>
        <span className={['inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold', previewErr ? 'bg-rose-100 text-rose-700' : empty ? 'bg-surface-2 text-ink-subtle' : 'bg-violet-100 text-violet-700'].join(' ')}>
          {previewing ? <><Loader2 size={10} className="animate-spin" /> counting…</> : previewErr ? 'fix rule' : empty ? '0 — empty rule' : `${preview?.matchedCount ?? '…'} match`}
        </span>
      </div>
      <FilterTreeBuilder attrs={attrs} value={value} onChange={onChange} />
      <p className={['flex items-start gap-1 text-[11px]', previewErr ? 'text-rose-600' : empty ? 'text-ink-subtle' : (preview?.warnings.length ? 'text-amber-700' : 'text-ink-subtle')].join(' ')}>
        <Info size={11} className="mt-[1px] shrink-0" />
        <span>
          {previewErr
            ? previewErr
            : empty
              ? 'An empty rule matches no records — the list stays empty until you add a condition.'
              : preview?.warnings.length
                ? preview.warnings.join(' ')
                : 'Records that match are always in this list — membership updates automatically as data changes.'}
        </span>
      </p>
    </div>
  );
}

/* ── Create list ────────────────────────────────────────────────────────────── */
function CreateListModal({ objects, onClose, onCreated, onError }: {
  objects: CrmObject[]; onClose: () => void; onCreated: (id: string) => void; onError: (m: string) => void;
}) {
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
      onError(ax?.response?.data?.error ?? 'Could not create list');
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="New list" icon={<ListChecks size={14} />}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">Cancel</button>
          <button type="button" onClick={save} disabled={busy || !name.trim() || !objectKey} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60">{busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Create list</button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="flex items-end gap-3">
          <div className="w-16"><label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">Icon</label><input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} className={`${inputCls} text-center text-[18px]`} /></div>
          <div className="flex-1"><label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">List name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q3 target accounts" className={inputCls} /></div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">Records of</label>
          <select value={objectKey} onChange={(e) => setObjectKey(e.target.value)} className={inputCls}>
            {objects.map((o) => <option key={o.id} value={o.key}>{o.pluralName}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-ink-subtle">A list holds records of a single object.</p>
        </div>
        {/* LST-1/LST-2: тип списка — STATIC (ручной набор) / DYNAMIC (правило) / PIPELINE (стадии+kanban) */}
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">Membership</label>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setType('STATIC')} className={['flex flex-col gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors', type === 'STATIC' ? 'border-brand-400 bg-brand-50 ring-1 ring-inset ring-brand-200' : 'border-line bg-surface hover:bg-surface-2'].join(' ')}>
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink"><ListPlus size={12} /> Static</span>
              <span className="text-[10px] text-ink-subtle">Pick records by hand.</span>
            </button>
            <button type="button" onClick={() => setType('DYNAMIC')} className={['flex flex-col gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors', type === 'DYNAMIC' ? 'border-violet-400 bg-violet-50 ring-1 ring-inset ring-violet-200' : 'border-line bg-surface hover:bg-surface-2'].join(' ')}>
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink"><Sparkles size={12} /> Dynamic</span>
              <span className="text-[10px] text-ink-subtle">A rule decides.</span>
            </button>
            <button type="button" onClick={() => setType('PIPELINE')} className={['flex flex-col gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors', type === 'PIPELINE' ? 'border-sky-400 bg-sky-50 ring-1 ring-inset ring-sky-200' : 'border-line bg-surface hover:bg-surface-2'].join(' ')}>
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink"><Columns3 size={12} /> Pipeline</span>
              <span className="text-[10px] text-ink-subtle">Stages + kanban.</span>
            </button>
          </div>
        </div>
        {type === 'DYNAMIC' && <DynamicRuleEditor objectKey={objectKey} value={rule} onChange={setRule} />}
        {type === 'PIPELINE' && (
          <p className="flex items-start gap-1 rounded-xl border border-sky-200 bg-sky-50/50 px-3 py-2 text-[11px] text-sky-700"><Columns3 size={12} className="mt-[1px] shrink-0" /><span>You add records by hand, and move them across stages on a kanban board. Default stages (Lead → In progress → Won → Lost) are created — edit them anytime under “Stages”.</span></p>
        )}
        <div><label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What is this list for?" className={`${inputCls} h-auto resize-y py-2`} /></div>
      </div>
    </Modal>
  );
}

/* ── Edit list ──────────────────────────────────────────────────────────────── */
function EditListModal({ list, onClose, onSaved, onError }: {
  list: CrmList; onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
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
    catch (e) { onError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not update list'); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={isDynamic ? 'Edit dynamic list' : 'Edit list'} icon={isDynamic ? <Sparkles size={14} /> : <Pencil size={14} />}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">Cancel</button>
          <button type="button" onClick={save} disabled={busy || !name.trim()} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60">{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Save</button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="flex items-end gap-3">
          <div className="w-16"><label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">Icon</label><input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} className={`${inputCls} text-center text-[18px]`} /></div>
          <div className="flex-1"><label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">List name</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></div>
        </div>
        {isDynamic && <DynamicRuleEditor objectKey={objectKey} value={rule} onChange={setRule} />}
        <div><label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputCls} h-auto resize-y py-2`} /></div>
      </div>
    </Modal>
  );
}

/* ── Add records ────────────────────────────────────────────────────────────── */
function AddRecordsModal({ list, existingIds, onClose, onAdded, onError }: {
  list: CrmList; existingIds: Set<string>; onClose: () => void; onAdded: (n: number) => void; onError: (m: string) => void;
}) {
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
    catch { onError('Could not add records'); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Add ${list.primaryObject?.pluralName ?? 'records'} to “${list.name}”`} icon={<ListPlus size={14} />}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">Cancel</button>
          <button type="button" onClick={add} disabled={busy || picked.size === 0} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60">{busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Add {picked.size || ''}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="inline-flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
          <Search size={14} className="text-ink-subtle" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search records…" className="min-w-0 flex-1 bg-transparent outline-none" />
        </div>
        <div className="max-h-[320px] space-y-1 overflow-y-auto">
          {loading ? (
            [...Array(5)].map((_, i) => <div key={i} className="skeleton h-9 rounded-lg" />)
          ) : recs.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-ink-muted">No records found.</p>
          ) : recs.map((r) => {
            const inList = existingIds.has(r.id);
            const sel = picked.has(r.id);
            return (
              <button key={r.id} type="button" disabled={inList} onClick={() => toggle(r.id)} className={['flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors', inList ? 'border-line bg-surface-2/40 opacity-60' : sel ? 'border-brand-300 bg-brand-50' : 'border-line bg-surface hover:bg-surface-2'].join(' ')}>
                <span className={['flex h-4 w-4 shrink-0 items-center justify-center rounded border', sel ? 'border-brand-500 bg-brand-600 text-white' : 'border-line'].join(' ')}>{sel && <Check size={11} />}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{r.displayName || 'Record'}</span>
                {inList && <span className="shrink-0 text-[10.5px] font-semibold text-ink-subtle">in list</span>}
              </button>
            );
          })}
        </div>
        <p className="flex items-center gap-1 text-[11px] text-ink-subtle"><ArrowUpRight size={11} /> Records of {list.primaryObject?.pluralName}. Search to narrow down.</p>
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
  const [rows, setRows] = useState<StageRow[]>(stages.map((s) => ({ key: s.key, label: s.label, color: s.color ?? null })));
  const [busy, setBusy] = useState(false);
  const [needMove, setNeedMove] = useState<{ removed: string[]; affected: number } | null>(null);
  const [moveTo, setMoveTo] = useState('');

  function addRow() {
    setRows((rs) => {
      const used = new Set(rs.map((r) => r.key));
      return [...rs, { key: uniqueKey('stage', used), label: 'New stage', color: STAGE_COLORS[rs.length % STAGE_COLORS.length] }];
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
    if (rows.length === 0) { onError('A pipeline needs at least one stage'); return; }
    if (rows.some((r) => !r.label.trim())) { onError('Every stage needs a label'); return; }
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
        onError(d?.error ?? 'Could not save stages');
      }
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Pipeline stages" icon={<Columns3 size={14} />}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2">Cancel</button>
          {needMove ? (
            <button type="button" onClick={() => save(moveTo)} disabled={busy || !moveTo} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60">{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Move & save</button>
          ) : (
            <button type="button" onClick={() => save()} disabled={busy} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60">{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Save stages</button>
          )}
        </>
      }
    >
      <div className="space-y-2">
        <p className="text-[11.5px] text-ink-muted">Stages are local to this list. Reordering or renaming never moves the records inside them — only changing a record’s stage does.</p>
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5">
            <div className="flex flex-col">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="flex h-4 w-5 items-center justify-center rounded text-ink-subtle hover:bg-surface-2 disabled:opacity-30"><ArrowUp size={12} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="flex h-4 w-5 items-center justify-center rounded text-ink-subtle hover:bg-surface-2 disabled:opacity-30"><ArrowDown size={12} /></button>
            </div>
            <input aria-label="Stage color" type="color" value={r.color ?? '#94a3b8'} onChange={(e) => setColor(i, e.target.value)} className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-line bg-surface p-0.5" />
            <input value={r.label} onChange={(e) => setLabel(i, e.target.value)} placeholder="Stage label" className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
            <span className="hidden shrink-0 font-mono text-[10px] text-ink-subtle sm:inline" title="Stable key">{r.key}</span>
            <button type="button" onClick={() => removeRow(i)} disabled={rows.length <= 1} title={rows.length <= 1 ? 'A pipeline needs at least one stage' : 'Remove stage'} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-subtle hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"><X size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={addRow} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-line bg-surface px-3 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2"><Plus size={13} /> Add stage</button>

        {needMove && (
          <div className="mt-1 space-y-2 rounded-xl border border-amber-300 bg-amber-50/60 p-3">
            <p className="flex items-start gap-1.5 text-[12px] text-amber-800"><GripVertical size={12} className="mt-[1px] shrink-0" /><span>{needMove.affected} record{needMove.affected === 1 ? '' : 's'} {needMove.affected === 1 ? 'is' : 'are'} in stage{needMove.removed.length === 1 ? '' : 's'} you removed ({needMove.removed.join(', ')}). Move {needMove.affected === 1 ? 'it' : 'them'} to:</span></p>
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-[12.5px] text-ink focus:border-brand-400 focus:outline-none">
              {rows.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}
