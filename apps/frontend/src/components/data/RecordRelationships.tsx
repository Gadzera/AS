'use client';

/**
 * RecordRelationships (M27-3) — связи записи через УЖЕ принятый REL-2 engine.
 *  • Forward: RELATIONSHIP-атрибуты записи (на кого ссылается ЭТА запись) из record.values.
 *  • Reverse: getReverseGroups (кто ссылается НА эту запись) — с hiddenCount по RBAC. Второго движка нет.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, ArrowRightLeft, ArrowUpRight, Lock } from 'lucide-react';
import { getReverseGroups, type ReverseGroup, type CrmObjectDetail, type CrmRecord } from '@/lib/crmApi';

function names(value: unknown): string[] {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map((v) => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') { const o = v as Record<string, unknown>; return String(o.displayName ?? o.name ?? o.label ?? o.id ?? ''); }
    return String(v);
  }).filter(Boolean);
}

export default function RecordRelationships({ recordId, object, record }: { recordId: string; object: CrmObjectDetail; record: CrmRecord }) {
  const [groups, setGroups] = useState<ReverseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setGroups(await getReverseGroups(recordId)); } catch { /* */ } finally { setLoading(false); }
  }, [recordId]);
  useEffect(() => { void load(); }, [load]);

  const forward = (object.attributes ?? [])
    .filter((a) => a.type === 'RELATIONSHIP' && !a.config?.reverse)
    .map((a) => ({ name: a.name, values: names(record.values?.[a.key]) }))
    .filter((f) => f.values.length > 0);

  if (loading) return <div className="flex min-h-[360px] items-center justify-center text-[13px] text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>;

  const empty = forward.length === 0 && groups.length === 0;
  if (empty) return (
    <div className="min-h-[360px] px-4 py-4">
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
        <ArrowRightLeft className="mx-auto mb-2 h-5 w-5 text-gray-300" />
        <p className="text-[13px] font-medium text-gray-600">No relationships yet</p>
        <p className="mt-1 text-[12px] text-gray-400">Links to and from other records show up here.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-[360px] space-y-4 px-4 py-4">
      {forward.length > 0 ? (
        <section>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">Links from this {object.singularName.toLowerCase()}</h3>
          <div className="space-y-1.5">
            {forward.map((f) => (
              <div key={f.name} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-gray-400">{f.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  {f.values.map((v, i) => <span key={i} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[12px] text-blue-700">{v}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {groups.map((g) => (
        <section key={g.attributeId}>
          <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">
            {g.name}
            <span className="rounded bg-gray-100 px-1 text-[10px] font-bold text-gray-500">{g.total}</span>
          </h3>
          <div className="space-y-1">
            {g.records.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-gray-400" />
                <span className="truncate text-[13px] text-gray-800">{r.displayName || 'Record'}</span>
                <span className="ml-auto text-[11px] text-gray-400">{g.sourceObjectKey}</span>
              </div>
            ))}
            {g.hiddenCount > 0 ? (
              <p className="flex items-center gap-1 px-1 text-[11.5px] text-amber-700"><Lock className="h-3 w-3" /> {g.hiddenCount} more hidden by permissions</p>
            ) : null}
            {g.hasMore ? <p className="px-1 text-[11.5px] text-gray-400">Showing first {g.records.length} of {g.total}.</p> : null}
          </div>
        </section>
      ))}
    </div>
  );
}
