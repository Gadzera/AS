'use client';

/* ──────────────────────────────────────────────────────────────────────────
   M15-3: Handoff package — slide-over для передачи ответа человеку/AE. Всё из
   backend (персистентная сущность HandoffPackage): summary, thread, recommended
   next step, attribution quality, source campaign, risk flags, meeting, assignee.
   Доступен из Replies / Meetings / Lead 360. Назначение — реальный AE или Unassigned.
   ────────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { outreachApi, type HandoffPackage } from '@/lib/api';
import { X, Loader2, UserPlus, ShieldAlert, Sparkles, CalendarCheck, ArrowRight, Send, Clock } from 'lucide-react';

const RISK_TONE: Record<string, string> = { LOW: 'bg-emerald-100 text-emerald-700', MEDIUM: 'bg-amber-100 text-amber-700', HIGH: 'bg-rose-100 text-rose-700' };
const QUALITY = (mode: string | null) => (!mode ? 'unknown' : ['header_in_reply_to', 'header_references', 'thread_id'].includes(mode) ? 'exact' : mode === 'fallback_last_outbound' ? 'fallback' : mode);
const FLAG_LABEL: Record<string, string> = { low_confidence: 'Low confidence', fallback_attribution: 'Fallback attribution', unsubscribe_intent: 'Unsubscribe', negative_sentiment: 'Negative', asks_for_pricing: 'Asks pricing', asks_for_legal: 'Asks legal', asks_for_security: 'Asks security', missing_thread_context: 'No thread' };

export default function HandoffPanel({ params, onClose, onChange }: { params: { replyMessageId?: string; meetingId?: string; leadId?: string }; onClose: () => void; onChange?: () => void }) {
  const [hp, setHp] = useState<HandoffPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await outreachApi.getHandoff(params); setHp(r.handoff); }
    catch { setHp(null); } finally { setLoading(false); }
  }, [params.replyMessageId, params.meetingId, params.leadId]);
  useEffect(() => { void load(); }, [load]);

  async function assign(assigneeId: string | null) {
    if (!hp) return;
    setBusy(true);
    try { const r = await outreachApi.assignHandoff(hp.id, assigneeId); setHp(r.handoff); onChange?.(); }
    catch { /* no-op */ } finally { setBusy(false); }
  }
  async function handOff() {
    if (!hp) return;
    setBusy(true);
    try { const r = await outreachApi.handOff(hp.id); setHp(r.handoff); onChange?.(); }
    catch { /* no-op */ } finally { setBusy(false); }
  }

  const leadName = hp?.lead ? `${hp.lead.firstName} ${hp.lead.lastName}`.trim() : 'Lead';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex justify-end">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#0f0f0e]/55 backdrop-blur-sm" onClick={() => !busy && onClose()} />
        <motion.aside initial={{ x: 480 }} animate={{ x: 0 }} exit={{ x: 480 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className="relative z-10 flex h-full w-full max-w-[460px] flex-col overflow-y-auto border-l border-line bg-surface shadow-2xl">
          <header className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-line bg-surface/95 px-5 py-3.5 backdrop-blur">
            <span className="brand-gradient flex h-7 w-7 items-center justify-center rounded-lg text-white"><ArrowRight size={14} /></span>
            <div className="min-w-0">
              <h2 className="text-[14px] font-bold text-ink">Handoff package</h2>
              <p className="truncate text-[11.5px] text-ink-subtle">{leadName}{hp?.lead?.company ? ` · ${hp.lead.company}` : ''}</p>
            </div>
            {hp && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${hp.status === 'HANDED_OFF' ? 'bg-violet-100 text-violet-700' : hp.status === 'ASSIGNED' ? 'bg-sky-100 text-sky-700' : 'bg-surface-2 text-ink-muted'}`}>{hp.status.replace('_', ' ')}</span>}
            <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-2"><X size={15} /></button>
          </header>

          {loading ? (
            <div className="flex flex-1 items-center justify-center text-ink-subtle"><Loader2 size={18} className="animate-spin" /></div>
          ) : !hp ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-[12.5px] text-ink-subtle">No handoff available for this item.</div>
          ) : (
            <div className="flex-1 space-y-4 p-5">
              {/* summary */}
              <div className="rounded-xl border border-brand-200/70 bg-brand-50/60 p-3.5">
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700"><Sparkles size={13} /> Summary</p>
                <p className="text-[12.5px] leading-5 text-brand-900">{hp.summary}</p>
              </div>

              {/* attribution + intent + risk */}
              <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                <div className="rounded-lg border border-line bg-surface-2/40 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-ink-subtle">Intent</p>
                  <p className="mt-0.5 font-semibold text-ink">{hp.intent ? hp.intent.replace('_', ' ').toLowerCase() : '—'} {hp.intentConfidence != null && <span className="text-ink-subtle">· {Math.round(hp.intentConfidence * 100)}%</span>}</p>
                </div>
                <div className="rounded-lg border border-line bg-surface-2/40 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-ink-subtle">Attribution</p>
                  <p className="mt-0.5 font-semibold text-ink">{hp.campaignName ?? '—'} <span className="text-ink-subtle">· {QUALITY(hp.attributionMode)}</span></p>
                </div>
              </div>
              {(hp.riskFlags.length > 0 || hp.riskLevel) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {hp.riskLevel && <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase ${RISK_TONE[hp.riskLevel]}`}><ShieldAlert size={11} /> {hp.riskLevel} risk</span>}
                  {hp.riskFlags.map((f) => <span key={f} className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-medium text-rose-700 ring-1 ring-inset ring-rose-100">{FLAG_LABEL[f] ?? f}</span>)}
                </div>
              )}

              {/* recommended next step */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700"><ArrowRight size={13} /> Recommended next step</p>
                <p className="text-[12.5px] leading-5 text-emerald-900">{hp.recommendedNextStep}</p>
              </div>

              {/* meeting */}
              {hp.meeting && (
                <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-[12px] text-sky-800">
                  <CalendarCheck size={14} /> Meeting {hp.meeting.status.toLowerCase()}{hp.meeting.scheduledAt ? ` · ${new Date(hp.meeting.scheduledAt).toLocaleString()}` : ''}
                </div>
              )}

              {/* thread snapshot */}
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle"><Clock size={12} /> Thread context</p>
                <div className="space-y-1.5">
                  {hp.threadSnapshot.slice(-5).map((m, i) => (
                    <div key={i} className={`rounded-lg px-2.5 py-1.5 text-[11.5px] leading-5 ${m.direction === 'INBOUND' ? 'bg-brand-50 text-brand-900' : 'bg-surface-2 text-ink'}`}>
                      <span className="text-[9.5px] font-bold uppercase tracking-wide text-ink-subtle">{m.direction === 'INBOUND' ? 'Lead' : 'Agent'}{m.subject ? ` · ${m.subject}` : ''}</span>
                      <p className="mt-0.5 line-clamp-2">{m.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* assignee */}
              <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle"><UserPlus size={13} /> Owner</p>
                {hp.assignee ? (
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">{(hp.assignee.name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
                    <div className="min-w-0"><p className="truncate text-[12.5px] font-semibold text-ink">{hp.assignee.name}</p><p className="truncate text-[11px] text-ink-subtle">{hp.assignee.email}</p></div>
                    <button type="button" onClick={() => assign(null)} disabled={busy} className="ml-auto text-[11px] font-semibold text-ink-subtle hover:text-rose-600 disabled:opacity-60">Unassign</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11.5px] font-semibold text-amber-700">Unassigned</span>
                    <select disabled={busy} defaultValue="" onChange={(e) => e.target.value && assign(e.target.value)} className="ml-auto rounded-lg border border-line bg-surface-2/40 px-2 py-1.5 text-[12px] text-ink outline-none focus:border-brand-400">
                      <option value="" disabled>Assign to AE…</option>
                      {hp.assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {hp && (
            <div className="sticky bottom-0 border-t border-line bg-surface/95 p-4 backdrop-blur">
              <button type="button" onClick={handOff} disabled={busy || hp.status === 'HANDED_OFF'} className="brand-gradient flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 disabled:opacity-70">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {hp.status === 'HANDED_OFF' ? 'Handed off' : 'Hand off to human'}
              </button>
            </div>
          )}
        </motion.aside>
      </div>
    </AnimatePresence>
  );
}
