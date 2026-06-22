'use client';

/**
 * BulkProductivityModal (M28-4) — массовые действия над выделенными записями (People/Deals/list-entries).
 * Реальная логика, zero-mock, demo-safe:
 *  • Send email — bulk-рассылка через ОБЯЗАТЕЛЬНЫЙ preview (per-record получатель/resolved/skipped/disclaimer) → demo-send;
 *  • Add to list — добавление в STATIC/PIPELINE список (дедуп через принятый движок ListEntry);
 *  • Enroll in sequence — enroll связанных People в кампанию (Lead-мост + дедуп существующих enrollments).
 * Результат честный: succeeded/skipped/failed с причинами; no-op не пишет Activity (backend).
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Mail, ListPlus, Workflow, Send, Loader2, CheckCircle2, MinusCircle, AlertTriangle, Info } from 'lucide-react';
import {
  listEmailTemplates, listLists, bulkSendEmailPreview, bulkSendEmail, bulkEnrollSequence, addListEntries,
  type EmailTemplate, type CrmList, type BulkSendPreview, type BulkResult,
} from '@/lib/crmApi';
import { campaignsApi } from '@/lib/api';

type Action = 'email' | 'list' | 'enroll';
const REASON_LABEL: Record<string, string> = {
  no_recipient: 'No resolvable recipient', no_access: 'No access', archived: 'Archived',
  unresolved_variables: 'Unresolved variables', already_enrolled: 'Already enrolled',
  not_found: 'Not found', empty: 'Empty', send_error: 'Error', enroll_error: 'Error',
};
function errMsg(e: unknown): string { return (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Request failed'; }

export default function BulkProductivityModal({ recordIds, objectKey, objectName, onClose, onDone }: { recordIds: string[]; objectKey: string; objectName: string; onClose: () => void; onDone: () => void }) {
  const [action, setAction] = useState<Action>('email');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [lists, setLists] = useState<CrmList[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);

  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [listId, setListId] = useState('');
  const [campaignId, setCampaignId] = useState('');

  const [preview, setPreview] = useState<BulkSendPreview | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [listResult, setListResult] = useState<{ added: number; skipped: number; requested: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [idemKey] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `bk-${Date.now()}`));

  useEffect(() => {
    (async () => {
      try {
        const [tpls, ls, cs] = await Promise.all([
          listEmailTemplates().catch(() => ({ templates: [] as EmailTemplate[], canManage: false })),
          listLists(objectKey).catch(() => [] as CrmList[]),
          campaignsApi.list().then((x) => x.map((c) => ({ id: c.id, name: c.name }))).catch(() => [] as { id: string; name: string }[]),
        ]);
        setTemplates(tpls.templates);
        setLists(ls.filter((l) => l.type !== 'DYNAMIC')); // DYNAMIC = computed, ручное добавление запрещено
        setCampaigns(cs);
      } catch { /* */ }
    })();
  }, [objectKey]);

  const applyTemplate = (id: string) => {
    setTemplateId(id); setPreview(null); setResult(null);
    const t = templates.find((x) => x.id === id);
    if (t) { setSubject(t.subject); setBody(t.body); }
  };

  async function doPreview() {
    setBusy(true); setErr(''); setResult(null);
    try { setPreview(await bulkSendEmailPreview(recordIds, { templateId: templateId || null, subject, body })); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  async function doSend() {
    setBusy(true); setErr('');
    try { setResult(await bulkSendEmail(recordIds, { templateId: templateId || null, subject, body, idempotencyKey: idemKey })); onDone(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  async function doAddToList() {
    if (!listId) { setErr('Pick a list'); return; }
    setBusy(true); setErr('');
    try { const r = await addListEntries(listId, recordIds); setListResult(r); onDone(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  async function doEnroll() {
    if (!campaignId) { setErr('Pick a sequence'); return; }
    setBusy(true); setErr('');
    try { setResult(await bulkEnrollSequence(recordIds, campaignId)); onDone(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  const skipBreakdown = useMemo(() => {
    const src = result?.results.filter((r) => r.status !== 'succeeded') ?? preview?.items.filter((i) => i.status === 'skipped') ?? [];
    const m = new Map<string, number>();
    for (const r of src) { const k = (r as { reason?: string }).reason ?? 'skipped'; m.set(k, (m.get(k) ?? 0) + 1); }
    return Array.from(m.entries());
  }, [result, preview]);

  const TABS: { key: Action; label: string; icon: React.ReactNode }[] = [
    { key: 'email', label: 'Send email', icon: <Mail size={14} /> },
    { key: 'list', label: 'Add to list', icon: <ListPlus size={14} /> },
    { key: 'enroll', label: 'Enroll in sequence', icon: <Workflow size={14} /> },
  ];

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div className="flex max-h-[88vh] w-full max-w-xl flex-col rounded-2xl border border-line bg-surface shadow-2xl" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[15px] font-bold text-ink">Bulk actions · {recordIds.length} {objectName.toLowerCase()}{recordIds.length === 1 ? '' : 's'}</h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink"><X size={17} /></button>
          </div>

          {/* выбор действия */}
          <div className="flex gap-1.5 border-b border-line px-5 py-2.5">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => { setAction(t.key); setPreview(null); setResult(null); setListResult(null); setErr(''); }} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${action === t.key ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-surface-2'}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {/* результат (общий summary) */}
            {(result || listResult) && (
              <div className="space-y-2 rounded-lg border border-line bg-surface-2/40 p-3">
                <p className="text-[12px] font-bold uppercase tracking-wide text-ink-subtle">Result</p>
                {result && (
                  <div className="flex flex-wrap gap-3 text-[13px]">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600"><CheckCircle2 size={14} /> {result.summary.succeeded} succeeded</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-600"><MinusCircle size={14} /> {result.summary.skipped} skipped</span>
                    {result.summary.failed > 0 && <span className="inline-flex items-center gap-1 font-semibold text-rose-600"><AlertTriangle size={14} /> {result.summary.failed} failed</span>}
                  </div>
                )}
                {listResult && (
                  <div className="flex flex-wrap gap-3 text-[13px]">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600"><CheckCircle2 size={14} /> {listResult.added} added</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-600"><MinusCircle size={14} /> {listResult.requested - listResult.added} not added (duplicates/skipped)</span>
                  </div>
                )}
                {skipBreakdown.length > 0 && (
                  <ul className="space-y-0.5 text-[11.5px] text-ink-muted">
                    {skipBreakdown.map(([reason, n]) => <li key={reason}>· {REASON_LABEL[reason] ?? reason}: {n}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* ── Send email ── */}
            {action === 'email' && !result && (
              <>
                <div>
                  <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Template</label>
                  <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-brand-400">
                    <option value="">No template</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Subject</label>
                  <input value={subject} onChange={(e) => { setSubject(e.target.value); setPreview(null); }} placeholder="Subject — use {{record.name}}…" className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-400" />
                </div>
                <div>
                  <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Body</label>
                  <textarea value={body} onChange={(e) => { setBody(e.target.value); setPreview(null); }} rows={5} placeholder="Message… {{recipient.email}}" className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-400" />
                </div>

                {preview && (
                  <div className="space-y-2 rounded-lg border border-line bg-surface-2/40 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-bold uppercase tracking-wide text-ink-subtle">Preview</p>
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><Info size={11} /> {preview.disclaimer}</span>
                    </div>
                    <div className="flex gap-3 text-[12.5px]">
                      <span className="font-semibold text-emerald-600">{preview.summary.ready} ready</span>
                      <span className="font-semibold text-amber-600">{preview.summary.skipped} skipped</span>
                    </div>
                    <ul className="max-h-40 space-y-1 overflow-y-auto text-[11.5px]">
                      {preview.items.map((it) => (
                        <li key={it.recordId} className="flex items-center gap-2">
                          {it.status === 'ready' ? <CheckCircle2 size={12} className="shrink-0 text-emerald-500" /> : <MinusCircle size={12} className="shrink-0 text-amber-500" />}
                          <span className="truncate text-ink-muted">{it.recordName || it.recordId}</span>
                          {it.status === 'ready' ? <span className="ml-auto shrink-0 text-ink-subtle">→ {it.to}</span> : <span className="ml-auto shrink-0 text-amber-600">{REASON_LABEL[it.reason ?? ''] ?? 'skipped'}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* ── Add to list ── */}
            {action === 'list' && !listResult && (
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">List ({objectName})</label>
                <select value={listId} onChange={(e) => setListId(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-brand-400">
                  <option value="">Select a list…</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.type.toLowerCase()})</option>)}
                </select>
                {lists.length === 0 && <p className="mt-1 text-[11.5px] text-ink-subtle">No static/pipeline lists for {objectName.toLowerCase()}s. Dynamic lists can’t be edited manually.</p>}
                <p className="mt-2 text-[11.5px] text-ink-subtle">Records already in the list are skipped (deduped).</p>
              </div>
            )}

            {/* ── Enroll in sequence ── */}
            {action === 'enroll' && !result && (
              <div>
                <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Sequence (campaign)</label>
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-brand-400">
                  <option value="">Select a sequence…</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {campaigns.length === 0 && <p className="mt-1 text-[11.5px] text-ink-subtle">No sequences available.</p>}
                <p className="mt-2 text-[11.5px] text-ink-subtle">Recipients are resolved to linked People (with email); records without a resolvable contact are skipped. Already-enrolled are deduped.</p>
              </div>
            )}

            {err && <p className="text-[12px] font-medium text-rose-600">{err}</p>}
          </div>

          {/* footer actions */}
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] font-medium text-ink-muted hover:text-ink">{result || listResult ? 'Done' : 'Cancel'}</button>
            {action === 'email' && !result && (
              !preview ? (
                <button type="button" disabled={busy || (!subject.trim() && !body.trim())} onClick={doPreview} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-surface-2 disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Info size={14} />} Preview</button>
              ) : (
                <button type="button" disabled={busy || preview.summary.ready === 0} onClick={doSend} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white shadow-brand disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Demo send {preview.summary.ready}</button>
              )
            )}
            {action === 'list' && !listResult && (
              <button type="button" disabled={busy || !listId} onClick={doAddToList} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white shadow-brand disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <ListPlus size={14} />} Add to list</button>
            )}
            {action === 'enroll' && !result && (
              <button type="button" disabled={busy || !campaignId} onClick={doEnroll} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white shadow-brand disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Workflow size={14} />} Enroll</button>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}
