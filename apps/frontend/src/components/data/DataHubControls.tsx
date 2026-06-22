'use client';

/**
 * DataHubControls — реальные Filter / Sort / Columns для Data Hub.
 * Filter и Sort пишут нормализованный запрос (CrmViewFilter/Sort) в listRecords
 * (backend фильтрует по typed value). Columns — локальная видимость колонок.
 */

import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, ArrowDownUp, Columns3, Plus, X, Check, Filter as FilterIcon } from 'lucide-react';
import clsx from 'clsx';
import type { CrmAttribute, CrmViewFilter, CrmViewSort, CrmFilterOp, CrmFilterNode, CrmCalcType } from '@/lib/crmApi';
import { isFilterGroup } from '@/lib/crmApi';
import FilterTreeBuilder from './FilterTreeBuilder';

export interface QueryState {
  filters: CrmViewFilter[];
  filterTree?: CrmFilterNode | null;
  sorts: CrmViewSort[];
  calcs?: Record<string, CrmCalcType>; // M24-3: per-column footer calculations (persist в View.config.calcs)
}

// число листьев в дереве — для бейджа Advanced
function countLeaves(node: CrmFilterNode | null | undefined): number {
  if (!node) return 0;
  if (isFilterGroup(node)) return node.children.reduce((s, c) => s + countLeaves(c), 0);
  return 1;
}

const OPS: { op: CrmFilterOp; label: string; noValue?: boolean }[] = [
  { op: 'eq', label: '=' },
  { op: 'neq', label: '≠' },
  { op: 'contains', label: 'contains' },
  { op: 'gt', label: '>' },
  { op: 'lt', label: '<' },
  { op: 'is_empty', label: 'is empty', noValue: true },
  { op: 'is_not_empty', label: 'is not empty', noValue: true },
];

interface ColumnDef { key: string; label: string }

interface Props {
  attrs: CrmAttribute[];
  query: QueryState;
  onChange: (q: QueryState) => void;
  columns: ColumnDef[];
  hiddenCols: Set<string>;
  onToggleCol: (key: string) => void;
}

function Popover({ open, onClose, children, width = 'w-[320px]' }: { open: boolean; onClose: () => void; children: React.ReactNode; width?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} className={clsx('absolute right-0 top-[calc(100%+6px)] z-40 rounded-xl border border-line bg-surface p-3 shadow-xl', width)}>
      {children}
    </div>
  );
}

export default function DataHubControls({ attrs, query, onChange, columns, hiddenCols, onToggleCol }: Props) {
  const [panel, setPanel] = useState<'filter' | 'advanced' | 'sort' | 'columns' | null>(null);
  const firstAttr = attrs[0]?.key ?? '';
  const advancedCount = countLeaves(query.filterTree);

  const btn = (active: boolean) =>
    clsx('inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-[12px] font-medium transition-colors',
      active ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-surface text-ink-muted hover:bg-surface-2');

  // ── filter ops ──
  function addFilter() {
    onChange({ ...query, filters: [...query.filters, { attributeKey: firstAttr, op: 'contains', value: '' }] });
  }
  function updFilter(i: number, patch: Partial<CrmViewFilter>) {
    onChange({ ...query, filters: query.filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
  }
  function rmFilter(i: number) {
    onChange({ ...query, filters: query.filters.filter((_, idx) => idx !== i) });
  }
  // ── sort ops ──
  function addSort() {
    onChange({ ...query, sorts: [...query.sorts, { attributeKey: firstAttr, dir: 'asc' }] });
  }
  function updSort(i: number, patch: Partial<CrmViewSort>) {
    onChange({ ...query, sorts: query.sorts.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  }
  function rmSort(i: number) {
    onChange({ ...query, sorts: query.sorts.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* FILTER */}
      <div className="relative">
        <button type="button" onClick={() => setPanel(panel === 'filter' ? null : 'filter')} className={btn(query.filters.length > 0)}>
          <SlidersHorizontal size={12} /> Filter{query.filters.length > 0 ? ` · ${query.filters.length}` : ''}
        </button>
        <Popover open={panel === 'filter'} onClose={() => setPanel(null)}>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-subtle">Filters</p>
          <div className="space-y-1.5">
            {query.filters.length === 0 && <p className="py-1 text-[12px] text-ink-subtle">No filters.</p>}
            {query.filters.map((f, i) => {
              const opMeta = OPS.find((o) => o.op === f.op);
              return (
                <div key={i} className="flex items-center gap-1">
                  <select value={f.attributeKey} onChange={(e) => updFilter(i, { attributeKey: e.target.value })} className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface px-1.5 text-[11.5px] text-ink focus:border-brand-500 focus:outline-none">
                    {attrs.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
                  </select>
                  <select value={f.op} onChange={(e) => updFilter(i, { op: e.target.value as CrmFilterOp })} className="h-7 rounded-md border border-line bg-surface px-1 text-[11.5px] text-ink focus:border-brand-500 focus:outline-none">
                    {OPS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
                  </select>
                  {!opMeta?.noValue && (
                    <input value={String(f.value ?? '')} onChange={(e) => updFilter(i, { value: e.target.value })} placeholder="value" className="h-7 w-16 rounded-md border border-line bg-surface px-1.5 text-[11.5px] text-ink focus:border-brand-500 focus:outline-none" />
                  )}
                  <button type="button" onClick={() => rmFilter(i)} className="text-ink-subtle hover:text-rose-500"><X size={13} /></button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={addFilter} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline"><Plus size={12} /> Add filter</button>
          {query.filters.length > 0 && <button type="button" onClick={() => onChange({ ...query, filters: [] })} className="ml-3 text-[12px] text-ink-muted hover:text-ink">Clear</button>}
          {advancedCount > 0 && <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">Advanced AND/OR filter is active — simple filters above are ignored.</p>}
        </Popover>
      </div>

      {/* ADVANCED (AND/OR tree) */}
      <div className="relative">
        <button type="button" onClick={() => setPanel(panel === 'advanced' ? null : 'advanced')} className={btn(advancedCount > 0)}>
          <FilterIcon size={12} /> Advanced{advancedCount > 0 ? ` · ${advancedCount}` : ''}
        </button>
        <Popover open={panel === 'advanced'} onClose={() => setPanel(null)} width="w-[440px]">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-subtle">Advanced filter · AND / OR groups</p>
          <FilterTreeBuilder attrs={attrs} value={query.filterTree ?? null} onChange={(next) => onChange({ ...query, filterTree: next })} />
        </Popover>
      </div>

      {/* SORT */}
      <div className="relative">
        <button type="button" onClick={() => setPanel(panel === 'sort' ? null : 'sort')} className={btn(query.sorts.length > 0)}>
          <ArrowDownUp size={12} /> Sort{query.sorts.length > 0 ? ` · ${query.sorts.length}` : ''}
        </button>
        <Popover open={panel === 'sort'} onClose={() => setPanel(null)}>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-subtle">Sort</p>
          <div className="space-y-1.5">
            {query.sorts.length === 0 && <p className="py-1 text-[12px] text-ink-subtle">No sorting.</p>}
            {query.sorts.map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <select value={s.attributeKey} onChange={(e) => updSort(i, { attributeKey: e.target.value })} className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface px-1.5 text-[11.5px] text-ink focus:border-brand-500 focus:outline-none">
                  {attrs.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
                </select>
                <select value={s.dir} onChange={(e) => updSort(i, { dir: e.target.value as 'asc' | 'desc' })} className="h-7 rounded-md border border-line bg-surface px-1 text-[11.5px] text-ink focus:border-brand-500 focus:outline-none">
                  <option value="asc">↑ asc</option>
                  <option value="desc">↓ desc</option>
                </select>
                <button type="button" onClick={() => rmSort(i)} className="text-ink-subtle hover:text-rose-500"><X size={13} /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addSort} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline"><Plus size={12} /> Add sort</button>
        </Popover>
      </div>

      {/* COLUMNS */}
      <div className="relative">
        <button type="button" onClick={() => setPanel(panel === 'columns' ? null : 'columns')} className={btn(hiddenCols.size > 0)}>
          <Columns3 size={12} /> Columns
        </button>
        <Popover open={panel === 'columns'} onClose={() => setPanel(null)}>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-subtle">Visible columns</p>
          <div className="max-h-[260px] space-y-0.5 overflow-y-auto">
            {columns.map((c) => {
              const visible = !hiddenCols.has(c.key);
              return (
                <button key={c.key} type="button" onClick={() => onToggleCol(c.key)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-ink hover:bg-surface-2">
                  <span className={clsx('flex h-4 w-4 items-center justify-center rounded border', visible ? 'border-brand-500 bg-brand-500 text-white' : 'border-line-strong bg-surface')}>
                    {visible && <Check size={11} strokeWidth={3} />}
                  </span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </Popover>
      </div>
    </div>
  );
}
