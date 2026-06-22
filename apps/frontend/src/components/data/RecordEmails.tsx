'use client';

/**
 * RecordEmails (M27-3) — ТОЛЬКО письма, реально связанные с записью (Email.recordId). Никаких псевдо-писем.
 * Внешний inbox-sync (SMTP/OAuth) — ЧЕСТНО deferred: видимая плашка без активных connect-кнопок.
 */
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Loader2, Mail, Sparkles, Inbox, PenSquare } from 'lucide-react';
import { listRecordEmails, type CrmRecordEmail } from '@/lib/crmApi';
import ComposeEmailModal from './ComposeEmailModal';

function when(iso: string): string {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}
function toLabel(to: unknown): string {
  if (Array.isArray(to)) return to.map((x) => (typeof x === 'string' ? x : (x as { email?: string })?.email ?? '')).filter(Boolean).join(', ');
  if (typeof to === 'string') return to;
  return '';
}

export default function RecordEmails({ recordId }: { recordId: string }) {
  const [emails, setEmails] = useState<CrmRecordEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setEmails(await listRecordEmails(recordId)); } catch { /* */ } finally { setLoading(false); }
  }, [recordId]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-[360px] space-y-3 px-4 py-4">
      {/* Compose — реальная отправка/черновик (demo-safe) с merge-переменными и preview */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-gray-500">{emails.length} email{emails.length === 1 ? '' : 's'}</span>
        <button type="button" onClick={() => setComposing(true)} className="brand-gradient inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-white shadow-brand">
          <PenSquare className="h-3.5 w-3.5" /> Compose
        </button>
      </div>

      {/* honest deferred-stub: внешний sync не подключён, без фейковых действий */}
      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-500">
        <Inbox className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span>External inbox sync (SMTP/OAuth) isn’t connected. This tab shows emails linked to this record and demo-safe emails composed here.</span>
      </div>

      <AnimatePresence>
        {composing && (
          <ComposeEmailModal recordId={recordId} onClose={() => setComposing(false)} onComposed={() => { void load(); }} />
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-[13px] text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
      ) : emails.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-8 text-center">
          <Mail className="mx-auto mb-2 h-5 w-5 text-gray-300" />
          <p className="text-[13px] font-medium text-gray-600">No emails linked to this record yet</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {emails.map((e) => (
            <li key={e.id} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-gray-400" />
                <span className="truncate text-[13px] font-medium text-gray-900">{e.subject || '(no subject)'}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-gray-600">{e.status}</span>
                {e.aiGenerated ? <span className="inline-flex items-center gap-0.5 rounded bg-violet-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-violet-700"><Sparkles className="h-2.5 w-2.5" /> AI</span> : null}
                {e.demo ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700">demo</span> : null}
                <span className="ml-auto text-[11.5px] text-gray-400">{when(e.sentAt || e.createdAt)}</span>
              </div>
              <div className="mt-0.5 text-[11.5px] text-gray-500">{e.direction === 'INBOUND' ? `From ${e.fromEmail ?? '—'}` : `To ${toLabel(e.toEmails) || '—'}`}</div>
              {e.snippet ? <p className="mt-1 line-clamp-2 text-[12.5px] text-gray-700">{e.snippet}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
