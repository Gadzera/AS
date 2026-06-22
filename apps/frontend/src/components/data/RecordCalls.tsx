'use client';

/**
 * RecordCalls (M27-3) — звонки, РЕАЛЬНО привязанные к записи через CallAssociatedRecord (M19).
 * Никакой эвристики по lead/email. Показываем summary/outcome/intent. Unlink отвязывает (звонок не удаляется).
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Phone, Link2Off, Sparkles } from 'lucide-react';
import { listRecordCalls, unlinkRecordCall, type CrmRecordCall } from '@/lib/crmApi';

function fmtDur(sec: number): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}
function when(iso: string): string {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export default function RecordCalls({ recordId }: { recordId: string }) {
  const [calls, setCalls] = useState<CrmRecordCall[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setCalls(await listRecordCalls(recordId)); } catch { /* */ } finally { setLoading(false); }
  }, [recordId]);
  useEffect(() => { void load(); }, [load]);

  async function unlink(id: string) {
    try { await unlinkRecordCall(recordId, id); await load(); } catch { /* */ }
  }

  if (loading) return <div className="flex min-h-[360px] items-center justify-center text-[13px] text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>;
  if (calls.length === 0) return (
    <div className="min-h-[360px] px-4 py-4">
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
        <Phone className="mx-auto mb-2 h-5 w-5 text-gray-300" />
        <p className="text-[13px] font-medium text-gray-600">No calls linked to this record</p>
        <p className="mt-1 text-[12px] text-gray-400">Calls logged in Call Intelligence and linked to this record show up here.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-[360px] space-y-2 px-4 py-4">
      {calls.map((c) => (
        <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-[13px] font-medium text-gray-900">{c.direction === 'INBOUND' ? 'Inbound call' : 'Outbound call'}</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-gray-600">{c.status}</span>
            {c.outcome ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">{c.outcome}</span> : null}
            <span className="ml-auto text-[11.5px] text-gray-400">{when(c.createdAt)}{c.durationSec ? ` · ${fmtDur(c.durationSec)}` : ''}</span>
            <button type="button" onClick={() => unlink(c.id)} title="Unlink from this record" className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600"><Link2Off className="h-3.5 w-3.5" /></button>
          </div>
          {c.summary ? <p className="mt-1.5 text-[12.5px] text-gray-700">{c.summary}</p> : null}
          {(c.aiIntent || c.nextStep) ? (
            <div className="mt-1.5 flex flex-wrap gap-2 text-[11.5px]">
              {c.aiIntent ? <span className="inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-violet-700"><Sparkles className="h-3 w-3" /> {c.aiIntent}</span> : null}
              {c.nextStep ? <span className="text-gray-500">Next: {c.nextStep}</span> : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
