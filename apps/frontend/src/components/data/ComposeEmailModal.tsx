'use client';

/**
 * ComposeEmailModal (M28-1 + M28-2) — compose письма с карточки записи.
 * Реальная логика, zero-mock: получатели/переменные/шаблоны/preview/draft/demo-send — живой backend.
 *  • получатель — из резолвимых кандидатов (self + связанные People) ИЛИ ручной email (single compose);
 *  • шаблон — подставляет subject/body; merge-переменные вставляются ТОЛЬКО из контракта (без «магии»);
 *  • live-preview: итоговые subject/body, unresolved (блок send) и empty (предупреждение), demo-disclaimer;
 *  • Save draft (DRAFT) и Demo send (SENT, demo) — с idempotency-ключом против двойного клика.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Mail, Send, FileText, Loader2, AlertTriangle, Info, Plus } from 'lucide-react';
import {
  listEmailRecipients, listEmailVariables, listEmailTemplates, previewComposeEmail, composeEmail,
  type EmailRecipientCandidate, type EmailMergeVariable, type EmailTemplate, type EmailComposePreview, type ComposedEmail, type ComposeRecipientInput,
} from '@/lib/crmApi';

function errOf(e: unknown): { message: string; code?: string; unresolved?: string[] } {
  const d = (e as { response?: { data?: { error?: string; code?: string; unresolved?: string[] } } })?.response?.data;
  return { message: d?.error ?? 'Request failed', code: d?.code, unresolved: d?.unresolved };
}

const MANUAL = '__manual__';

export default function ComposeEmailModal({ recordId, onClose, onComposed }: { recordId: string; onClose: () => void; onComposed: (e: ComposedEmail) => void }) {
  const [recipients, setRecipients] = useState<EmailRecipientCandidate[]>([]);
  const [variables, setVariables] = useState<EmailMergeVariable[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [recipientKey, setRecipientKey] = useState<string>(MANUAL); // candidate.email | MANUAL
  const [manualEmail, setManualEmail] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [preview, setPreview] = useState<EmailComposePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState<'' | 'draft' | 'send'>('');
  const [err, setErr] = useState('');

  // idempotency-ключ на сессию модалки (двойной клик той же кнопки не плодит дубль)
  const composeKeyRef = useRef<string>(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `ck-${Date.now()}`);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [recs, vars, tpls] = await Promise.all([listEmailRecipients(recordId), listEmailVariables(recordId), listEmailTemplates()]);
        if (!alive) return;
        setRecipients(recs); setVariables(vars); setTemplates(tpls.templates);
        if (recs.length > 0) setRecipientKey(recs[0].email); // self/related по умолчанию
      } catch (e) { if (alive) setErr(errOf(e).message); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [recordId]);

  const recipientInput = useMemo<ComposeRecipientInput>(() => {
    if (recipientKey === MANUAL) return { email: manualEmail.trim() };
    const c = recipients.find((r) => r.email === recipientKey);
    return c ? { recordId: c.recordId, email: c.email } : { email: '' };
  }, [recipientKey, manualEmail, recipients]);

  const hasRecipient = recipientKey === MANUAL ? manualEmail.trim().length > 0 : true;

  // выбор шаблона → подставить subject/body (можно править после)
  const applyTemplate = useCallback((id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) { setSubject(t.subject); setBody(t.body); }
  }, [templates]);

  // live-preview (debounce) при изменении получателя/шаблона/темы/тела
  useEffect(() => {
    if (loading) return;
    if (!hasRecipient && !subject && !body) { setPreview(null); return; }
    let alive = true;
    const t = setTimeout(async () => {
      setPreviewing(true);
      try {
        const p = await previewComposeEmail(recordId, { subject, body, templateId: templateId || null, recipient: recipientInput });
        if (alive) setPreview(p);
      } catch (e) { if (alive) { setPreview(null); setErr(errOf(e).message); } }
      finally { if (alive) setPreviewing(false); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [recordId, subject, body, templateId, recipientInput, hasRecipient, loading]);

  function insertVar(token: string) {
    const ins = `{{${token}}}`;
    const el = bodyRef.current;
    if (el && document.activeElement === el) {
      const s = el.selectionStart ?? body.length, e = el.selectionEnd ?? body.length;
      setBody(body.slice(0, s) + ins + body.slice(e));
      requestAnimationFrame(() => { el.focus(); const pos = s + ins.length; el.setSelectionRange(pos, pos); });
    } else {
      setBody((b) => b + (b && !b.endsWith(' ') ? ' ' : '') + ins);
    }
  }

  async function submit(action: 'draft' | 'send') {
    setErr(''); setBusy(action);
    try {
      const { email } = await composeEmail(recordId, {
        action, subject, body, templateId: templateId || null,
        recipient: recipientInput, idempotencyKey: `${composeKeyRef.current}:${action}`,
      });
      onComposed(email);
      onClose();
    } catch (e) {
      const x = errOf(e);
      setErr(x.code === 'UNRESOLVED_VARIABLES' ? `Cannot send — unresolved variables: ${(x.unresolved ?? []).join(', ')}` : x.message);
      setBusy('');
    }
  }

  const sendDisabled = busy !== '' || previewing || !preview || !preview.canSend;
  const draftDisabled = busy !== '' || !hasRecipient || (!subject.trim() && !body.trim());

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl border border-line bg-surface shadow-2xl"
          initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="inline-flex items-center gap-2 text-[15px] font-bold text-ink"><Mail size={16} className="text-brand-500" /> Compose email</h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink"><X size={17} /></button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-[13px] text-ink-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
              {/* левая колонка — форма */}
              <div className="min-h-0 space-y-3 overflow-y-auto border-line px-5 py-4 md:border-r">
                {/* recipient */}
                <div>
                  <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Recipient</label>
                  <select value={recipientKey} onChange={(e) => setRecipientKey(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100">
                    {recipients.map((r) => (
                      <option key={r.recordId + r.email} value={r.email}>
                        {(r.displayName || r.email)} · {r.email}{r.source === 'related' && r.relationLabel ? ` (via ${r.relationLabel})` : ''}
                      </option>
                    ))}
                    <option value={MANUAL}>Manual email…</option>
                  </select>
                  {recipientKey === MANUAL && (
                    <input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} placeholder="name@company.com" className="mt-2 h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
                  )}
                  {recipients.length === 0 && recipientKey === MANUAL && (
                    <p className="mt-1 text-[11px] text-ink-subtle">No linked contacts with an email — enter a recipient manually.</p>
                  )}
                </div>

                {/* template */}
                <div>
                  <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Template</label>
                  <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100">
                    <option value="">No template</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                {/* subject */}
                <div>
                  <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Subject</label>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject — use {{record.name}}…" className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
                </div>

                {/* body */}
                <div>
                  <label className="mb-1 block text-[11.5px] font-semibold text-ink-muted">Body</label>
                  <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder="Write your message… insert {{variables}} below." className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
                </div>

                {/* variable chips — только допустимые токены (контракт) */}
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Merge variables</p>
                  <div className="flex flex-wrap gap-1.5">
                    {variables.map((v) => (
                      <button key={v.token} type="button" onClick={() => insertVar(v.token)} title={v.sample ? `e.g. ${v.sample}` : 'no value on this record'}
                        className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] font-medium text-ink-muted hover:border-brand-300 hover:text-ink">
                        <Plus size={10} /> {v.token}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* правая колонка — preview */}
              <div className="min-h-0 space-y-3 overflow-y-auto bg-surface-2/40 px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Preview</p>
                  {previewing && <Loader2 size={13} className="animate-spin text-ink-subtle" />}
                </div>

                {/* demo-disclaimer (Q1) — всегда видно: внешней доставки нет */}
                <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                  <Info size={12} /> {preview?.disclaimer ?? 'Demo-safe · no external delivery'}
                </div>

                {!preview ? (
                  <p className="py-6 text-center text-[12.5px] text-ink-subtle">Choose a recipient and write a message to preview.</p>
                ) : (
                  <div className="space-y-2.5">
                    <div className="rounded-lg border border-line bg-surface p-3">
                      <div className="text-[11px] text-ink-subtle">To</div>
                      <div className="text-[13px] font-medium text-ink">{preview.recipientResolved ? `${preview.recipientName ? preview.recipientName + ' · ' : ''}${preview.to}` : <span className="text-rose-600">Recipient not resolved</span>}</div>
                      <div className="mt-2 text-[11px] text-ink-subtle">Subject</div>
                      <div className="text-[13px] font-semibold text-ink">{preview.subject || <span className="text-ink-subtle">(empty)</span>}</div>
                      <div className="mt-2 text-[11px] text-ink-subtle">Body</div>
                      <div className="whitespace-pre-wrap text-[12.5px] text-ink-muted">{preview.body || <span className="text-ink-subtle">(empty)</span>}</div>
                    </div>

                    {preview.unresolved.length > 0 && (
                      <div className="flex items-start gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-[11.5px] text-rose-700">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        <span><b>Unknown variables</b> (blocks send): {preview.unresolved.join(', ')}</span>
                      </div>
                    )}
                    {preview.empty.length > 0 && (
                      <div className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-700">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        <span><b>Empty on this record</b>: {preview.empty.join(', ')} — will send blank.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {err && <p className="px-5 pb-1 text-[12px] font-medium text-rose-600">{err}</p>}
          <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
            <span className="text-[11px] text-ink-subtle">Demo-safe — emails are stored & logged, not delivered externally.</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] font-medium text-ink-muted hover:text-ink">Cancel</button>
              <button type="button" disabled={draftDisabled} onClick={() => submit('draft')} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-surface-2 disabled:opacity-50">
                {busy === 'draft' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Save draft
              </button>
              <button type="button" disabled={sendDisabled} onClick={() => submit('send')} title={preview && !preview.canSend ? 'Resolve recipient and unknown variables to send' : ''} className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white shadow-brand disabled:opacity-50">
                {busy === 'send' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Demo send
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
