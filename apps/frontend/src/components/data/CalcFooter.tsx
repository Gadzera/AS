'use client';

// M24-3: footer калькуляций (S092) — count/sum/avg/min/max/empty по filtered-set.
// Конфиг calcs = { attributeKey: type } (persist в View.config.calcs). Значения считает backend
// (по полной выборке до пагинации). Здесь — только выбор и форматирование, никаких клиентских агрегатов.
import { useState, useMemo, useRef, useEffect } from 'react';
import { Sigma, Plus, X } from 'lucide-react';
import type { CrmAttribute, CrmCalcType, CrmCalcResult } from '@/lib/crmApi';

const CALC_LABEL: Record<CrmCalcType, string> = { count: 'Count', sum: 'Sum', avg: 'Avg', min: 'Min', max: 'Max', empty: 'Empty' };

// зеркало backend calcSupportsType
function calcsForType(type?: string): CrmCalcType[] {
  if (type === 'NUMBER' || type === 'CURRENCY') return ['sum', 'avg', 'min', 'max', 'count', 'empty'];
  if (type === 'DATE' || type === 'DATETIME') return ['min', 'max', 'count', 'empty'];
  return ['count', 'empty'];
}

function fmt(r: CrmCalcResult, attrType?: string): string {
  if (r.skippedReason && r.skippedReason !== 'MIXED_CURRENCY') return '—';
  if (r.mixedCurrency) return 'mixed currency';
  if (r.value == null) return r.type === 'count' || r.type === 'empty' ? '0' : '—';
  if ((r.type === 'min' || r.type === 'max') && (attrType === 'DATE' || attrType === 'DATETIME') && typeof r.value === 'string') {
    const d = new Date(r.value); return Number.isNaN(d.getTime()) ? String(r.value) : d.toLocaleDateString();
  }
  if (typeof r.value === 'number') {
    if (r.currencyCode) {
      try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: r.currencyCode, maximumFractionDigits: r.type === 'avg' ? 2 : 0 }).format(r.value); } catch { /* */ }
    }
    return r.type === 'avg' ? r.value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : r.value.toLocaleString('en-US');
  }
  return String(r.value);
}

export default function CalcFooter({
  attrs,
  calcs,
  results,
  canManage,
  onChange,
}: {
  attrs: CrmAttribute[];
  calcs: Record<string, CrmCalcType>;
  results: CrmCalcResult[];
  canManage: boolean;
  onChange: (next: Record<string, CrmCalcType>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [attrKey, setAttrKey] = useState('');
  const [calcType, setCalcType] = useState<CrmCalcType>('count');
  const ref = useRef<HTMLDivElement>(null);
  const attrByKey = useMemo(() => new Map(attrs.map((a) => [a.key, a])), [attrs]);
  const entries = Object.entries(calcs);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const eligible = attrKey ? calcsForType(attrByKey.get(attrKey)?.type) : [];

  function add() {
    if (!attrKey) return;
    const ok = calcsForType(attrByKey.get(attrKey)?.type);
    const t = ok.includes(calcType) ? calcType : ok[0];
    onChange({ ...calcs, [attrKey]: t });
    setOpen(false); setAttrKey('');
  }
  function remove(key: string) { const next = { ...calcs }; delete next[key]; onChange(next); }

  const resultFor = (key: string, type: CrmCalcType) => results.find((r) => r.attributeKey === key && r.type === type);

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-line bg-surface-2/40 px-3 py-1.5">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-subtle"><Sigma size={11} /> Calculations</span>
      {entries.length === 0 && <span className="text-[11px] text-ink-subtle">— none yet</span>}
      {entries.map(([key, type]) => {
        const attr = attrByKey.get(key);
        const r = resultFor(key, type);
        return (
          <span key={key} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px]">
            <span className="font-semibold text-ink-muted">{CALC_LABEL[type]} · {attr?.name ?? key}</span>
            <span className="font-bold text-ink">{r ? fmt(r, attr?.type) : '…'}</span>
            {r?.type !== 'count' && r?.type !== 'empty' && typeof r?.count === 'number' && <span className="text-[9.5px] text-ink-subtle">({r.count})</span>}
            {canManage && <button type="button" onClick={() => remove(key)} className="text-ink-subtle hover:text-rose-500"><X size={11} /></button>}
          </span>
        );
      })}
      {canManage && (
        <div className="relative" ref={ref}>
          <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-line px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"><Plus size={11} /> Add calculation</button>
          {open && (
            <div className="absolute bottom-[calc(100%+6px)] left-0 z-40 w-[280px] rounded-xl border border-line bg-surface p-2.5 shadow-xl">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-subtle">Footer calculation</p>
              <div className="space-y-1.5">
                <select value={attrKey} onChange={(e) => { setAttrKey(e.target.value); const ok = calcsForType(attrByKey.get(e.target.value)?.type); if (!ok.includes(calcType)) setCalcType(ok[0]); }} className="h-7 w-full rounded-md border border-line bg-[var(--surface)] px-1.5 text-[11.5px] text-ink focus:border-brand-400 focus:outline-none">
                  <option value="">Choose column…</option>
                  {attrs.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
                </select>
                {attrKey && (
                  <select value={calcType} onChange={(e) => setCalcType(e.target.value as CrmCalcType)} className="h-7 w-full rounded-md border border-line bg-[var(--surface)] px-1.5 text-[11.5px] text-ink focus:border-brand-400 focus:outline-none">
                    {eligible.map((t) => <option key={t} value={t}>{CALC_LABEL[t]}</option>)}
                  </select>
                )}
                <button type="button" disabled={!attrKey} onClick={add} className="h-7 w-full rounded-md bg-brand-600 text-[11.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">Add</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
