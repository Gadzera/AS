'use client';

/**
 * Global Emails + Outbox (/emails) — M28-3 + M28-5. Все письма workspace (record-linked), zero-mock, живой backend.
 *  • RBAC: письма без OBJECT READ на их record НЕ раскрываются → баннер «Hidden by permissions: N».
 *  • Список: только snippet/metadata. Detail: bodyText только при READ (DRAFT — только при READ_WRITE).
 *  • Outbox-табы: All / Drafts / Sent / Failed. DRAFT можно править + demo-send; SENT/FAILED demo → demo-resend.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Loader2, Lock, ChevronLeft, ChevronRight, X, Sparkles, ArrowUpRight, ArrowDownLeft, Send, FileText, RefreshCw, Save } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import {
  listGlobalEmails, getGlobalEmail, editDraftEmail, sendDraftEmail, resendEmail,
  type GlobalEmail, type GlobalEmailDetail, type GlobalEmailsPage,
} from '@/lib/crmApi';

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-surface-2 text-ink-muted', QUEUED: 'bg-sky-100 text-sky-700', SENDING: 'bg-sky-100 text-sky-700',
  SENT: 'bg-emerald-100 text-emerald-700', DELIVERED: 'bg-emerald-100 text-emerald-700', OPENED: 'bg-violet-100 text-violet-700',
  CLICKED: 'bg-violet-100 text-violet-700', REPLIED: 'bg-brand-100 text-brand-700', BOUNCED: 'bg-rose-100 text-rose-600',
  FAILED: 'bg-rose-100 text-rose-600', CANCELED: 'bg-surface-2 text-ink-subtle',
};
const TABS: { key: string; label: string; status?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'drafts', label: 'Drafts', status: 'DRAFT' },
  { key: 'sent', label: 'Sent', status: 'SENT' },
  { key: 'failed', label: 'Failed', status: 'FAILED' },
];
const PAGE_SIZE = 25;

function fmt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}
function toLabel(to: unknown): string {
  if (Array.isArray(to)) return to.map((x) => (typeof x === 'string' ? x : (x as { email?: string })?.email ?? '')).filter(Boolean).join(', ');
  if (typeof to === 'string') return to;
  return '';
}
function errMsg(e: unknown): string {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Request failed';
}

export default function GlobalEmailsPage() {
  const [data, setData] = useState<GlobalEmailsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [direction, setDirection] = useState('');
  const [page, setPage] = useState(1);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GlobalEmailDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'send' | 'resend'>('');
  const [drawerErr, setDrawerErr] = useState('');

  const status = TABS.find((t) => t.key === tab)?.status;

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await listGlobalEmails({ page, pageSize: PAGE_SIZE, status, direction: direction || undefined })); }
    catch { setData(null); } finally { setLoading(false); }
  }, [page, status, direction]);
  useEffect(() => { void load(); }, [load]);

  const openDetail = useCallback(async (id: string) => {
    setOpenId(id); setDetail(null); setDetailLoading(true); setDrawerErr('');
    try {
      const d = await getGlobalEmail(id);
      setDetail(d); setEditSubject(d.subject ?? ''); setEditBody(d.bodyText ?? '');
    } catch (e) { setDetail(null); setDrawerErr(errMsg(e)); } finally { setDetailLoading(false); }
  }, []);

  const closeDrawer = () => { setOpenId(null); setDetail(null); setDrawerErr(''); };

  async function saveDraft() {
    if (!detail) return; setBusy('save'); setDrawerErr('');
    try { const d = await editDraftEmail(detail.id, { subject: editSubject, body: editBody }); setDetail(d); void load(); }
    catch (e) { setDrawerErr(errMsg(e)); } finally { setBusy(''); }
  }
  async function doSend() {
    if (!detail) return; setBusy('send'); setDrawerErr('');
    try { const { email } = await sendDraftEmail(detail.id); setDetail(email); void load(); }
    catch (e) { setDrawerErr(errMsg(e)); } finally { setBusy(''); }
  }
  async function doResend() {
    if (!detail) return; setBusy('resend'); setDrawerErr('');
    // ключ на КЛИК — защищает один attempt от сетевого ретрая/двойного submit (backend дедупит по нему)
    const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `rs-${detail.id}-${Date.now()}`;
    try { const { email } = await resendEmail(detail.id, key); setDetail(email); void load(); }
    catch (e) { setDrawerErr(errMsg(e)); } finally { setBusy(''); }
  }

  const emails = data?.emails ?? [];
  const total = data?.total ?? 0;
  const hidden = data?.hiddenCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isDraft = detail?.status === 'DRAFT';
  const canResend = !!detail && detail.demo && (detail.status === 'SENT' || detail.status === 'FAILED');

  return (
    <>
      <Topbar title="Emails" subtitle="All workspace emails · Outbox · record-linked" icon={<Mail size={18} strokeWidth={1.85} />} />

      <div className="space-y-3 px-5 py-4">
        {/* Outbox-табы */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => { setTab(t.key); setPage(1); }} className={`h-7 rounded-md px-3 text-[12.5px] font-semibold transition ${tab === t.key ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:text-ink'}`}>{t.label}</button>
            ))}
          </div>
          <select value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }} className="h-9 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-ink outline-none focus:border-brand-400">
            <option value="">All directions</option>
            <option value="OUTBOUND">Outbound</option>
            <option value="INBOUND">Inbound</option>
          </select>
          <span className="ml-auto text-[12px] font-medium text-ink-subtle">{total} email{total === 1 ? '' : 's'}</span>
        </div>

        {hidden > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-700">
            <Lock size={14} /> Hidden by permissions: {hidden} — you don’t have access to the records these emails are linked to.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[13px] text-ink-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
        ) : emails.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-12 text-center">
            <Mail className="mx-auto mb-2 h-6 w-6 text-ink-subtle" />
            <p className="text-[13px] font-medium text-ink-muted">No emails match this view</p>
            {hidden > 0 && <p className="mt-1 text-[12px] text-ink-subtle">{hidden} email(s) are hidden by permissions.</p>}
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {emails.map((e: GlobalEmail) => (
              <li key={e.id}>
                <button type="button" onClick={() => void openDetail(e.id)} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-surface-2/60">
                  {e.direction === 'INBOUND' ? <ArrowDownLeft size={15} className="shrink-0 text-sky-500" /> : <ArrowUpRight size={15} className="shrink-0 text-emerald-500" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-semibold text-ink">{e.subject || '(no subject)'}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[e.status] ?? 'bg-surface-2 text-ink-muted'}`}>{e.status}</span>
                      {e.aiGenerated && <span className="inline-flex items-center gap-0.5 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"><Sparkles className="h-2.5 w-2.5" /> AI</span>}
                      {e.demo && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">demo</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-subtle">
                      <span className="truncate">{e.direction === 'INBOUND' ? `From ${e.fromEmail ?? '—'}` : `To ${toLabel(e.toEmails) || '—'}`}</span>
                      {e.linkedRecord && (
                        <Link href={`/crm/${e.linkedRecord.objectKey}/${e.linkedRecord.id}`} onClick={(ev) => ev.stopPropagation()} className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-muted hover:text-brand-600">
                          {e.linkedRecord.objectName ? `${e.linkedRecord.objectName}: ` : ''}{e.linkedRecord.displayName || 'record'}
                        </Link>
                      )}
                    </div>
                    {e.snippet && <p className="mt-1 line-clamp-1 text-[12px] text-ink-muted">{e.snippet}</p>}
                  </div>
                  <span className="shrink-0 text-[11px] text-ink-subtle">{fmt(e.sentAt || e.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[12px] text-ink-subtle">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink disabled:opacity-40"><ChevronLeft size={14} /> Prev</button>
              <button type="button" disabled={!data?.hasMore} onClick={() => setPage((p) => p + 1)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink disabled:opacity-40">Next <ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* detail / draft editor drawer */}
      <AnimatePresence>
        {openId && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeDrawer} />
            <motion.div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-line bg-surface shadow-2xl" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.22 }}>
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <h2 className="inline-flex items-center gap-2 text-[14px] font-bold text-ink">{isDraft ? <FileText size={15} className="text-brand-500" /> : <Mail size={15} className="text-brand-500" />} {isDraft ? 'Draft' : 'Email'}</h2>
                <button type="button" onClick={closeDrawer} className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink"><X size={17} /></button>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center py-16 text-[13px] text-ink-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
              ) : !detail ? (
                <div className="px-5 py-12 text-center text-[13px] text-ink-muted">{drawerErr || 'Email not available.'}</div>
              ) : (
                <>
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold ${STATUS_TONE[detail.status] ?? 'bg-surface-2 text-ink-muted'}`}>{detail.status}</span>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-muted">{detail.direction}</span>
                      {detail.demo && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700">demo</span>}
                      {detail.aiGenerated && <span className="inline-flex items-center gap-0.5 rounded bg-violet-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-violet-700"><Sparkles className="h-2.5 w-2.5" /> AI</span>}
                    </div>

                    <div className="space-y-1 rounded-lg border border-line bg-surface-2/40 p-3 text-[12px]">
                      <div className="flex gap-2"><span className="w-12 shrink-0 text-ink-subtle">From</span><span className="text-ink">{detail.fromName ? `${detail.fromName} · ` : ''}{detail.fromEmail || '—'}</span></div>
                      <div className="flex gap-2"><span className="w-12 shrink-0 text-ink-subtle">To</span><span className="text-ink">{toLabel(detail.toEmails) || '—'}</span></div>
                      <div className="flex gap-2"><span className="w-12 shrink-0 text-ink-subtle">Date</span><span className="text-ink">{detail.sentAt ? fmt(detail.sentAt) : 'not sent'}</span></div>
                      {detail.linkedRecord && (
                        <div className="flex gap-2"><span className="w-12 shrink-0 text-ink-subtle">Record</span>
                          <Link href={`/crm/${detail.linkedRecord.objectKey}/${detail.linkedRecord.id}`} className="text-brand-600 hover:underline">{detail.linkedRecord.objectName ? `${detail.linkedRecord.objectName}: ` : ''}{detail.linkedRecord.displayName || 'record'}</Link>
                        </div>
                      )}
                    </div>

                    {isDraft ? (
                      // DRAFT — редактируемый (только при READ_WRITE; backend это гарантирует)
                      <>
                        <div>
                          <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Subject</label>
                          <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Body</label>
                          <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={9} className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
                        </div>
                      </>
                    ) : (
                      <>
                        <h3 className="text-[15px] font-bold text-ink">{detail.subject || '(no subject)'}</h3>
                        <div className="whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 text-[12.5px] text-ink-muted">{detail.bodyText || <span className="text-ink-subtle">(no body)</span>}</div>
                      </>
                    )}

                    {detail.demo && <p className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">Demo-safe · no external delivery</p>}
                    {drawerErr && <p className="text-[12px] font-medium text-rose-600">{drawerErr}</p>}
                  </div>

                  {/* действия Outbox */}
                  <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
                    {isDraft ? (
                      <>
                        <button type="button" disabled={busy !== ''} onClick={saveDraft} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-surface-2 disabled:opacity-50">
                          {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save draft
                        </button>
                        <button type="button" disabled={busy !== ''} onClick={doSend} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white shadow-brand disabled:opacity-50">
                          {busy === 'send' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Demo send
                        </button>
                      </>
                    ) : canResend ? (
                      <button type="button" disabled={busy !== ''} onClick={doResend} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-surface-2 disabled:opacity-50">
                        {busy === 'resend' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Demo resend
                      </button>
                    ) : (
                      <span className="text-[11px] text-ink-subtle">Read-only</span>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
