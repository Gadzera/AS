'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { callsApi, leadsApi, notificationsApi, callInsightsApi, callArtifactsApi, type Call, type CallStatus, type CallOutcome, type CallDirection, type InsightTemplate, type CallInsightRun, type RunResultSection, type InsightOutputFormat, type InsightTemplateScope, type CallArtifactsResponse } from '@/lib/api';
import type { Lead } from '@/types';
import Topbar from '@/components/layout/Topbar';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneOff,
  Plus,
  Sparkles,
  Trash2,
  CalendarPlus,
  Clock,
  Target,
  Loader2,
  Lightbulb,
  ShieldAlert,
  MessageSquareWarning,
  ListChecks,
  FileText,
  Brain,
  ChevronDown,
  Coins,
  X,
  Pencil,
  Lock,
  Star,
  Users,
  Layers,
  Mic,
  Link2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   Calls (/calls) — очередь звонков. Запись о звонке реальная (CRUD/статусы/исходы),
   AI-сводка разговора (DeepSeek). Исход наблюдаемо меняет состояние: статус лида, а
   MEETING_BOOKED создаёт встречу и триггерит Workflow. Сам набор номера — демо.
   GET/POST/PATCH/DELETE /api/calls + POST /:id/summarize. Светлая Bold-тема.
   ────────────────────────────────────────────────────────────────────────── */

const STATUS_TONE: Record<CallStatus, string> = {
  SCHEDULED: 'bg-sky-100 text-sky-700', COMPLETED: 'bg-emerald-100 text-emerald-700',
  NO_ANSWER: 'bg-amber-100 text-amber-700', VOICEMAIL: 'bg-violet-100 text-violet-700', CANCELED: 'bg-surface-2 text-ink-subtle',
};
const STATUS_LABEL: Record<CallStatus, string> = { SCHEDULED: 'Scheduled', COMPLETED: 'Completed', NO_ANSWER: 'No answer', VOICEMAIL: 'Voicemail', CANCELED: 'Canceled' };
const OUTCOME_LABEL: Record<CallOutcome, string> = { CONNECTED: 'Connected', NO_ANSWER: 'No answer', VOICEMAIL: 'Voicemail', NOT_INTERESTED: 'Not interested', CALLBACK: 'Callback', MEETING_BOOKED: 'Meeting booked', WRONG_NUMBER: 'Wrong number' };
const OUTCOME_TONE: Record<CallOutcome, string> = {
  CONNECTED: 'bg-emerald-100 text-emerald-700', MEETING_BOOKED: 'bg-brand-100 text-brand-700', CALLBACK: 'bg-amber-100 text-amber-700',
  NOT_INTERESTED: 'bg-rose-100 text-rose-600', NO_ANSWER: 'bg-surface-2 text-ink-muted', VOICEMAIL: 'bg-violet-100 text-violet-700', WRONG_NUMBER: 'bg-surface-2 text-ink-subtle',
};
const OUTCOMES: CallOutcome[] = ['CONNECTED', 'MEETING_BOOKED', 'CALLBACK', 'NOT_INTERESTED', 'VOICEMAIL', 'NO_ANSWER', 'WRONG_NUMBER'];
const FILTERS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' }, { key: 'SCHEDULED', label: 'Scheduled' }, { key: 'COMPLETED', label: 'Completed' },
  { key: 'NO_ANSWER', label: 'No answer' }, { key: 'VOICEMAIL', label: 'Voicemail' },
];

function fmtDuration(sec: number): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m && s) return `${m}m ${s}s`;
  return m ? `${m}m` : `${s}s`;
}
function fmtWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CallsPage() {
  const toast = useToast();
  const [calls, setCalls] = useState<Call[]>([]);
  const [summary, setSummary] = useState<{ total: number; scheduled: number; completed: number; connectRate: number; meetingsBooked: number } | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<InsightTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  function reload() {
    setLoading(true);
    callsApi.list({ status: filter === 'ALL' ? undefined : filter, favorite: favOnly, mine: mineOnly }).then((r) => { setCalls(r.calls); setSummary(r.summary); }).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [filter, favOnly, mineOnly]);

  async function toggleFavorite(c: Call) {
    const next = !c.favorite;
    setCalls((p) => p.map((x) => x.id === c.id ? { ...x, favorite: next } : x));
    try { await callArtifactsApi.setFavorite(c.id, next); }
    catch { setCalls((p) => p.map((x) => x.id === c.id ? { ...x, favorite: !next } : x)); toast.error('Could not update favorite'); }
  }
  const loadTemplates = () => { callInsightsApi.templates().then(setTemplates).catch(() => {}); };
  useEffect(() => { loadTemplates(); }, []);

  function effectsToast(e: { leadStatus?: string; meetingCreated?: boolean; workflowsTriggered?: number }) {
    const parts: string[] = [];
    if (e.leadStatus) parts.push(`lead → ${e.leadStatus}`);
    if (e.meetingCreated) parts.push('meeting created');
    if (e.workflowsTriggered) parts.push(`${e.workflowsTriggered} workflow(s) ran`);
    return parts.join(' · ');
  }

  async function setOutcome(call: Call, outcome: CallOutcome) {
    setBusyId(call.id);
    try {
      const r = await callsApi.update(call.id, { outcome, status: 'COMPLETED' });
      reload();
      toast.success(`Outcome: ${OUTCOME_LABEL[outcome]}`, effectsToast(r) || undefined);
    } catch { toast.error('Could not set outcome'); } finally { setBusyId(null); }
  }
  async function summarize(call: Call) {
    setBusyId(call.id);
    try {
      const r = await callsApi.summarize(call.id);
      setCalls((p) => p.map((c) => c.id === call.id ? r.call : c));
      toast.success('Call summarized', r.generatedBy === 'demo' ? 'grounded demo' : r.generatedBy);
    } catch (e) { const err = e as { response?: { data?: { error?: string } } }; toast.error('Could not summarize', err.response?.data?.error || 'Add notes first.'); } finally { setBusyId(null); }
  }
  async function remove(call: Call) {
    if (!window.confirm('Delete this call log?')) return;
    setBusyId(call.id);
    try { await callsApi.remove(call.id); reload(); toast.success('Call deleted'); }
    catch { toast.error('Could not delete'); } finally { setBusyId(null); }
  }
  // пост-звонковое действие: создать follow-up задачу (реальное уведомление, привязка к лиду)
  async function createTask(call: Call) {
    if (!call.lead) { toast.error('No contact on this call'); return; }
    setBusyId(call.id);
    try {
      await notificationsApi.create({ title: `Follow up: ${call.lead.name}`, body: call.nextStep ?? `Follow up after the call${call.lead.company ? ` with ${call.lead.company}` : ''}.`, leadId: call.lead.id });
      window.dispatchEvent(new Event('notifications:refresh'));
      toast.success('Follow-up task created', 'Added to Notifications');
    } catch { toast.error('Could not create task'); } finally { setBusyId(null); }
  }

  return (
    <>
      <Topbar title="Calls" subtitle="Outbound motion · the call queue" icon={<Phone size={18} strokeWidth={1.85} />} />

      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface/70 px-4">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted"><PhoneCall size={13} className="text-brand-600" /> {summary?.total ?? 0} call(s) · {summary?.connectRate ?? 0}% connect · {summary?.meetingsBooked ?? 0} meetings</span>
        <button type="button" onClick={() => setTemplatesOpen(true)} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12px] font-semibold text-ink-muted shadow-xs hover:bg-surface-2 hover:text-brand-600">
          <Brain size={14} /> Insight templates
        </button>
        <Button size="sm" variant="primary" onClick={() => setLogOpen(true)}><Plus size={14} strokeWidth={2.2} /> Log call</Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl space-y-4">
          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total', value: summary?.total ?? 0, icon: <PhoneCall size={12} /> },
              { label: 'Scheduled', value: summary?.scheduled ?? 0, icon: <Clock size={12} /> },
              { label: 'Connect rate', value: `${summary?.connectRate ?? 0}%`, icon: <Target size={12} /> },
              { label: 'Meetings', value: summary?.meetingsBooked ?? 0, icon: <CalendarPlus size={12} /> },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-line bg-surface px-4 py-3 shadow-xs">
                <span className="mb-1 inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">{k.icon} {k.label}</span>
                <p className="text-[22px] font-extrabold leading-none tracking-[-0.02em] text-ink">{k.value}</p>
              </div>
            ))}
          </div>

          {/* filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                className={['rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors', filter === f.key ? 'bg-brand-600 text-white shadow-brand' : 'bg-surface-2 text-ink-muted hover:bg-surface-2/70'].join(' ')}>
                {f.label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-line" />
            <button type="button" onClick={() => setFavOnly((v) => !v)}
              className={['inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors', favOnly ? 'bg-amber-500 text-white' : 'bg-surface-2 text-ink-muted hover:bg-surface-2/70'].join(' ')}>
              <Star size={12} className={favOnly ? 'fill-white' : ''} /> Favorites
            </button>
            <button type="button" onClick={() => setMineOnly((v) => !v)}
              className={['inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors', mineOnly ? 'bg-brand-600 text-white' : 'bg-surface-2 text-ink-muted hover:bg-surface-2/70'].join(' ')}>
              <Users size={12} /> Mine
            </button>
          </div>

          {/* list */}
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
          ) : calls.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-12 text-center">
              <Phone size={22} className="mx-auto mb-2 text-ink-subtle" />
              <p className="text-[13px] font-semibold text-ink">No calls {filter !== 'ALL' ? 'in this view' : 'yet'}</p>
              <p className="mt-0.5 text-[12px] text-ink-muted">Log a call to track outcomes, AI summaries and next steps.</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => setLogOpen(true)}><Plus size={14} /> Log call</Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {calls.map((c) => (
                <div key={c.id} className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
                  <div className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.direction === 'INBOUND' ? 'bg-violet-50 text-violet-600' : 'bg-brand-50 text-brand-600'}`}>
                      {c.direction === 'INBOUND' ? <PhoneIncoming size={16} /> : <PhoneOutgoing size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.lead ? (
                          <Link href={`/leads/${c.lead.id}`} className="text-[13.5px] font-bold text-ink hover:text-brand-600 hover:underline">{c.lead.name}</Link>
                        ) : (
                          <span className="text-[13.5px] font-bold text-ink">Unknown contact</span>
                        )}
                        {c.lead?.company && <span className="text-[12px] text-ink-muted">· {c.lead.company}</span>}
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                        {c.outcome && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${OUTCOME_TONE[c.outcome]}`}>{OUTCOME_LABEL[c.outcome]}</span>}
                        <button type="button" onClick={() => toggleFavorite(c)} title={c.favorite ? 'Remove from favorites' : 'Add to favorites'} className={['ml-auto shrink-0 transition-colors', c.favorite ? 'text-amber-500' : 'text-ink-subtle hover:text-amber-500'].join(' ')}>
                          <Star size={15} className={c.favorite ? 'fill-amber-500' : ''} />
                        </button>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-subtle">
                        <span className="inline-flex items-center gap-1"><Clock size={10} /> {c.scheduledAt ? fmtWhen(c.scheduledAt) : fmtWhen(c.createdAt)}</span>
                        {c.durationSec > 0 && <span>· {fmtDuration(c.durationSec)}</span>}
                      </div>
                      {c.notes && <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap rounded-lg bg-surface-2/40 px-2.5 py-1.5 text-[12px] leading-4 text-ink-muted">{c.notes}</p>}

                      {c.summary && (
                        <div className="mt-2 rounded-lg border border-brand-100 bg-brand-50/40 p-2.5">
                          <p className="mb-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.05em] text-brand-700"><Sparkles size={10} /> AI call intelligence</p>
                          <p className="text-[12px] leading-4 text-ink">{c.summary}</p>

                          {/* структурированные AI-инсайты: intent / objections / risk */}
                          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                            {c.aiIntent && (
                              <div className="flex items-start gap-1.5 rounded-md bg-white/70 px-2 py-1.5 ring-1 ring-inset ring-brand-100">
                                <Target size={12} className="mt-0.5 shrink-0 text-emerald-600" />
                                <span className="text-[11px] leading-4 text-ink"><span className="font-bold">Intent:</span> {c.aiIntent}</span>
                              </div>
                            )}
                            {c.aiRisk && (
                              <div className="flex items-start gap-1.5 rounded-md bg-white/70 px-2 py-1.5 ring-1 ring-inset ring-amber-100">
                                <ShieldAlert size={12} className="mt-0.5 shrink-0 text-amber-600" />
                                <span className="text-[11px] leading-4 text-ink"><span className="font-bold">Risk:</span> {c.aiRisk}</span>
                              </div>
                            )}
                          </div>
                          {c.aiObjections && c.aiObjections.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.05em] text-rose-600"><MessageSquareWarning size={11} /> Objections</span>
                              {c.aiObjections.map((o, i) => (
                                <span key={i} className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-medium text-rose-700 ring-1 ring-inset ring-rose-100">{o}</span>
                              ))}
                            </div>
                          )}
                          {c.nextStep && <p className="mt-2 inline-flex items-start gap-1 text-[11.5px] font-semibold text-brand-900"><Lightbulb size={12} className="mt-0.5 shrink-0 text-brand-600" /> {c.nextStep}</p>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* actions */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
                    <span className="text-[11px] font-semibold text-ink-subtle">Outcome:</span>
                    <select value={c.outcome ?? ''} disabled={busyId === c.id} onChange={(e) => { if (e.target.value) setOutcome(c, e.target.value as CallOutcome); }}
                      className="h-7 rounded-lg border border-line bg-white px-2 text-[11.5px] font-semibold text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50">
                      <option value="">Set outcome…</option>
                      {OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
                    </select>
                    <button type="button" disabled={busyId === c.id || !c.notes} title={c.notes ? 'AI summarize from notes' : 'Add notes to summarize'} onClick={() => summarize(c)}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2.5 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-2 hover:text-brand-600 disabled:opacity-40">
                      {busyId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Summarize
                    </button>
                    <button type="button" disabled={busyId === c.id || !c.lead} title={c.lead ? 'Create a follow-up task' : 'No contact to task'} onClick={() => createTask(c)}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2.5 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-2 hover:text-brand-600 disabled:opacity-40">
                      <ListChecks size={12} /> Create task
                    </button>
                    <button type="button" onClick={() => setExpandedId((id) => id === c.id ? null : c.id)}
                      className={['inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[11.5px] font-semibold transition-colors', expandedId === c.id ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line text-ink-muted hover:bg-surface-2 hover:text-brand-600'].join(' ')}>
                      <Brain size={12} /> Intelligence <ChevronDown size={11} className={expandedId === c.id ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    </button>
                    <button type="button" disabled={busyId === c.id} title="Delete" onClick={() => remove(c)} className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"><Trash2 size={13} /></button>
                  </div>

                  {expandedId === c.id && (
                    <CallIntelligencePanel call={c} templates={templates} onManageTemplates={() => setTemplatesOpen(true)} />
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[12px] text-amber-800">
            <PhoneOff size={14} className="shrink-0 text-amber-600" /> Dialing runs in demo mode until a telephony provider is connected. Call records, outcomes, AI summaries and the state changes they trigger (lead status, meetings, workflows) are live.
          </p>
        </div>
      </div>

      {logOpen && <LogCallModal onClose={() => setLogOpen(false)} onDone={(msg) => { setLogOpen(false); reload(); if (msg) toast.success('Call logged', msg); else toast.success('Call logged'); }} />}
      {templatesOpen && <TemplatesModal templates={templates} onClose={() => setTemplatesOpen(false)} onChanged={loadTemplates} />}
    </>
  );
}

/* ══════════════════ Call Intelligence: transcript + run шаблона по секциям + история ══════════════════ */
function SectionContent({ content }: { content: string | string[] }) {
  if (Array.isArray(content)) {
    return <ul className="ml-3 list-disc space-y-0.5 text-[12px] leading-4 text-ink">{content.map((b, i) => <li key={i}>{b}</li>)}</ul>;
  }
  return <p className="whitespace-pre-wrap text-[12px] leading-4 text-ink">{content}</p>;
}

function RunView({ run }: { run: CallInsightRun }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-ink-subtle">
        <span className="rounded bg-brand-50 px-1.5 py-0.5 font-bold uppercase text-brand-700">{run.templateName} · v{run.templateVersion}</span>
        <span className="inline-flex items-center gap-1"><Coins size={10} /> {run.creditsCharged} cr</span>
        <span>· {run.generatedBy === 'demo' ? 'grounded demo' : run.generatedBy}</span>
        <span>· {new Date(run.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      {[...run.results].sort((a, b) => a.order - b.order).map((s: RunResultSection) => (
        <div key={s.sectionId} className="rounded-lg border border-line bg-white px-2.5 py-2">
          <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-subtle">{s.sectionTitle}</p>
          <SectionContent content={s.content} />
        </div>
      ))}
    </div>
  );
}

function CallIntelligencePanel({ call, templates, onManageTemplates }: { call: Call; templates: InsightTemplate[]; onManageTemplates: () => void }) {
  const toast = useToast();
  const [transcript, setTranscript] = useState(call.transcript ?? '');
  const [savedTranscript, setSavedTranscript] = useState(call.transcript ?? '');
  const [savingT, setSavingT] = useState(false);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<CallInsightRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [art, setArt] = useState<CallArtifactsResponse | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  const loadArt = () => callArtifactsApi.artifacts(call.id).then(setArt).catch(() => {});
  useEffect(() => { callInsightsApi.runs(call.id).then((r) => { setRuns(r); if (r[0]) setActiveRunId(r[0].id); }).catch(() => {}); loadArt(); /* eslint-disable-next-line */ }, [call.id]);

  async function finalize() {
    setFinalizing(true);
    try { await callArtifactsApi.finalize(call.id); await loadArt(); toast.success('Call finalized', 'Summary · chapters · speaker stats'); }
    catch (e) { const err = e as { response?: { status?: number; data?: { error?: string } } }; toast.error(err.response?.status === 402 ? 'Not enough AI credits' : 'Could not finalize', err.response?.data?.error); }
    finally { setFinalizing(false); }
  }
  async function autoLink() {
    try { const r = await callArtifactsApi.autoLink(call.id); await loadArt(); toast.success(`Linked ${r.linked} record(s)`, r.pending ? `${r.pending} participant(s) had no match` : undefined); }
    catch { toast.error('Could not auto-link'); }
  }
  async function unlink(recordId: string, objectKey: string) {
    try { await callArtifactsApi.unlinkRecord(call.id, recordId, objectKey); await loadArt(); }
    catch { toast.error('Could not unlink'); }
  }
  useEffect(() => { if (!templateId && templates[0]) setTemplateId(templates[0].id); }, [templates, templateId]);

  const selected = templates.find((t) => t.id === templateId);
  const estimate = selected?.sections.length ?? 0;
  const hasTranscript = savedTranscript.trim().length > 0;
  const dirty = transcript !== savedTranscript;

  async function saveTranscript() {
    setSavingT(true);
    try { const c = await callInsightsApi.setTranscript(call.id, transcript, 'paste'); setSavedTranscript(c.transcript ?? ''); toast.success('Transcript saved'); }
    catch { toast.error('Could not save transcript'); } finally { setSavingT(false); }
  }
  async function run(force = false) {
    if (!templateId) { toast.error('Pick a template'); return; }
    setRunning(true);
    try {
      const out = await callInsightsApi.run(call.id, templateId, force ? { force: true, clientRequestId: `rerun-${Date.now()}` } : undefined);
      const list = await callInsightsApi.runs(call.id);
      setRuns(list); setActiveRunId(out.run.id);
      toast.success(out.deduped ? 'Insights (cached)' : `Insights ready · ${out.run.creditsCharged} cr`, out.deduped ? 'Same transcript + template — no extra charge' : undefined);
    } catch (e) {
      const err = e as { response?: { status?: number; data?: { error?: string; code?: string } } };
      if (err.response?.status === 402) toast.error('Not enough AI credits');
      else toast.error('Could not run insights', err.response?.data?.error);
    } finally { setRunning(false); }
  }

  const activeRun = runs.find((r) => r.id === activeRunId) ?? runs[0] ?? null;

  return (
    <div className="mt-2.5 space-y-3 rounded-xl border border-brand-100 bg-brand-50/20 p-3">
      {/* transcript */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-subtle"><FileText size={11} /> Transcript {call.transcriptSource ? `· ${call.transcriptSource}` : ''}</span>
          <span className="text-[10px] text-ink-subtle">Paste or upload — live recorder integration is a connected-recorder feature.</span>
        </div>
        <textarea rows={transcript ? 4 : 2} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Paste the call transcript here (Speaker: text per line works best)…"
          className="w-full rounded-lg border border-line bg-white p-2.5 text-[12px] leading-4 text-ink focus:border-brand-400 focus:outline-none" />
        <div className="mt-1 flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-[11px] font-semibold text-ink-muted hover:bg-surface-2">
            Upload .txt
            <input type="file" accept=".txt,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 200_000) { toast.error('File too large', 'Keep transcripts under 200 KB'); return; } const t = await f.text(); setTranscript(t); }} />
          </label>
          <button type="button" disabled={savingT || !dirty} onClick={saveTranscript} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{savingT ? <Loader2 size={11} className="animate-spin" /> : null} Save transcript</button>
          {dirty && <span className="text-[10.5px] text-amber-600">unsaved</span>}
        </div>
      </div>

      {/* run */}
      <div className="flex flex-wrap items-center gap-2 border-t border-brand-100 pt-2.5">
        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-subtle"><Brain size={11} /> Apply template</span>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="h-7 rounded-lg border border-line bg-white px-2 text-[11.5px] font-semibold text-ink outline-none">
          {templates.length === 0 && <option value="">No templates</option>}
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isSystem ? ' · system' : t.scope === 'PERSONAL' ? ' · personal' : ' · workspace'} ({t.sections.length})</option>)}
        </select>
        <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-muted ring-1 ring-inset ring-line"><Coins size={11} /> ~{estimate} cr</span>
        <button type="button" disabled={running || !hasTranscript || !templateId} title={hasTranscript ? '' : 'Add a transcript first'} onClick={() => run(false)}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-brand hover:bg-brand-700 disabled:opacity-50">
          {running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Run insights
        </button>
        {activeRun && <button type="button" disabled={running} onClick={() => run(true)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-2" title="Re-run and charge again">Re-run</button>}
        <button type="button" onClick={onManageTemplates} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:underline"><Pencil size={11} /> Manage</button>
      </div>
      {!hasTranscript && <p className="text-[11px] text-amber-600">Add and save a transcript to run insight templates.</p>}

      {/* perspectives (history) */}
      {runs.length > 0 && (
        <div className="border-t border-brand-100 pt-2.5">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-subtle">Perspectives</span>
            {runs.map((r) => (
              <button key={r.id} type="button" onClick={() => setActiveRunId(r.id)} className={['rounded-md px-2 py-0.5 text-[10.5px] font-semibold transition-colors', (activeRun?.id === r.id) ? 'bg-brand-600 text-white' : 'bg-white text-ink-muted ring-1 ring-inset ring-line hover:bg-surface-2'].join(' ')}>
                {r.templateName} v{r.templateVersion}
              </button>
            ))}
          </div>
          {activeRun && <RunView run={activeRun} />}
        </div>
      )}

      {/* after-call артефакты */}
      <div className="border-t border-brand-100 pt-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.05em] text-ink-subtle"><Layers size={11} /> After-call</span>
          <button type="button" disabled={finalizing || !hasTranscript} onClick={finalize} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {finalizing ? <Loader2 size={11} className="animate-spin" /> : <Layers size={11} />} {art?.artifacts.finalizedAt ? 'Re-finalize' : 'Finalize'}
          </button>
          <button type="button" onClick={autoLink} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-2"><Link2 size={11} /> Auto-link records</button>
          {art?.artifacts.outdated && <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700"><AlertTriangle size={10} /> Artifacts outdated — transcript changed, re-finalize</span>}
        </div>

        {art?.artifacts.finalizedAt ? (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {/* summary + info */}
            <div className="rounded-lg border border-line bg-white p-2.5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Summary</p>
              <p className="text-[12px] leading-4 text-ink">{art.artifacts.summary || '—'}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px] text-ink-subtle">
                <span className="rounded bg-surface-2 px-1.5 py-0.5">{fmtDuration(art.artifacts.info.durationSec)}</span>
                <span className="rounded bg-surface-2 px-1.5 py-0.5">{art.artifacts.info.provider}</span>
                <span className="rounded bg-surface-2 px-1.5 py-0.5">{art.artifacts.info.participants} participant(s)</span>
              </div>
            </div>
            {/* chapters */}
            <div className="rounded-lg border border-line bg-white p-2.5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Chapters</p>
              <ol className="space-y-0.5">
                {art.artifacts.chapters.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-[12px] text-ink">
                    <span className="w-10 shrink-0 text-[10.5px] tabular-nums text-ink-subtle">{c.startSec != null ? `${Math.floor(c.startSec / 60)}:${String(c.startSec % 60).padStart(2, '0')}` : '—'}</span>
                    <span className="truncate">{c.title}</span>
                  </li>
                ))}
                {art.artifacts.chapters.length === 0 && <li className="text-[11px] text-ink-subtle">No chapters.</li>}
              </ol>
            </div>
            {/* speaker stats */}
            <div className="rounded-lg border border-line bg-white p-2.5">
              <p className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-subtle"><Mic size={10} /> Speaker stats</p>
              {art.artifacts.speakerLabeled && art.artifacts.speakerStats.length > 0 ? (
                <div className="space-y-1">
                  {art.artifacts.speakerStats.map((s) => (
                    <div key={s.speaker} className="text-[11.5px]">
                      <div className="flex items-center justify-between"><span className="font-semibold text-ink">{s.speaker}</span><span className="tabular-nums text-ink-subtle">{s.sharePct}% · {s.turns} turns · ~{fmtDuration(s.talkSec)}</span></div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand-500" style={{ width: `${s.sharePct}%` }} /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-ink-subtle">Speaker stats unavailable — transcript has no “Speaker: …” labels.</p>
              )}
            </div>
            {/* associated records */}
            <div className="rounded-lg border border-line bg-white p-2.5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Associated records</p>
              {art.associatedRecords.length === 0 ? (
                <p className="text-[11px] text-ink-subtle">No linked records. Use Auto-link to match participants to CRM records.</p>
              ) : (
                <div className="space-y-1">
                  {art.associatedRecords.map((r) => (
                    <div key={r.id} className="flex items-center gap-1.5 text-[12px]">
                      <Link href={`/crm/${r.objectKey}/${r.recordId}`} className="min-w-0 flex-1 truncate font-semibold text-brand-600 hover:underline">{r.displayName || r.recordId}</Link>
                      <span className="shrink-0 rounded bg-surface-2 px-1 text-[9px] font-bold uppercase text-ink-subtle">{r.objectKey} · {r.associationType}</span>
                      <button type="button" onClick={() => unlink(r.recordId, r.objectKey)} className="shrink-0 text-ink-subtle hover:text-rose-600"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-ink-subtle">Finalize to generate summary, chapters and speaker stats from the transcript.</p>
        )}

        {/* honest recorder/playback — capability-gated, без рабочих-на-вид кнопок */}
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-line bg-surface-2/40 px-2.5 py-1.5">
          <Mic size={12} className="shrink-0 text-ink-subtle" />
          <span className="text-[10.5px] text-ink-subtle">Connect a recorder (Zoom / Meet / Teams) to enable live transcript, playback and pinned mode. For now, paste or upload the transcript above.</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════ Insight templates manager ══════════════════ */
function TemplatesModal({ templates, onClose, onChanged }: { templates: InsightTemplate[]; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState<InsightTemplate | 'new' | null>(null);
  return (
    <Modal open onClose={onClose} title="Insight templates" size="lg" footer={<Button variant="secondary" size="sm" onClick={onClose}>Close</Button>}>
      {editing ? (
        <TemplateEditor template={editing === 'new' ? null : editing} onBack={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />
      ) : (
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-ink-muted">Templates run their sections over a call transcript. 1 credit per section.</p>
            <Button size="sm" variant="primary" onClick={() => setEditing('new')}><Plus size={13} /> New template</Button>
          </div>
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-bold text-ink">{t.name}</span>
                  <span className="rounded bg-surface-2 px-1 py-0.5 text-[9px] font-bold uppercase text-ink-subtle">{t.isSystem ? 'system' : t.scope.toLowerCase()}</span>
                  <span className="text-[10.5px] text-ink-subtle">v{t.version} · {t.sections.length} sections</span>
                </div>
                <p className="truncate text-[11px] text-ink-subtle">{t.sections.map((s) => s.title).join(' · ')}</p>
              </div>
              {t.editable ? (
                <button type="button" onClick={() => setEditing(t)} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-ink-muted hover:bg-surface-2"><Pencil size={11} /> Edit</button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[10.5px] font-semibold text-ink-subtle" title="System / not editable by you"><Lock size={11} /> Locked</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function TemplateEditor({ template, onBack, onSaved }: { template: InsightTemplate | null; onBack: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(template?.name ?? '');
  const [scope, setScope] = useState<InsightTemplateScope>(template?.scope ?? 'PERSONAL');
  const [sections, setSections] = useState<{ title: string; prompt: string; outputFormat: InsightOutputFormat }[]>(
    template?.sections.map((s) => ({ title: s.title, prompt: s.prompt, outputFormat: s.outputFormat })) ?? [{ title: '', prompt: '', outputFormat: 'TEXT' }],
  );
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  const upd = (i: number, p: Partial<{ title: string; prompt: string; outputFormat: InsightOutputFormat }>) => setSections((arr) => arr.map((s, idx) => idx === i ? { ...s, ...p } : s));
  const del = (i: number) => setSections((arr) => arr.filter((_, idx) => idx !== i));
  const add = () => setSections((arr) => [...arr, { title: '', prompt: '', outputFormat: 'TEXT' }]);

  async function save() {
    setErr('');
    setBusy(true);
    try {
      const payload = { name, scope, sections: sections.map((s, i) => ({ ...s, order: i })) };
      if (template) await callInsightsApi.updateTemplate(template.id, payload);
      else await callInsightsApi.createTemplate(payload);
      toast.success(template ? 'Template updated' : 'Template created');
      onSaved();
    } catch (e) {
      const error = e as { response?: { data?: { error?: string } } };
      setErr(error.response?.data?.error || 'Could not save template');
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 p-4">
      <button type="button" onClick={onBack} className="text-[12px] font-semibold text-ink-muted hover:text-brand-600">← Templates</button>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" className="h-9 flex-1 rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-ink outline-none focus:border-brand-400" />
        <select value={scope} onChange={(e) => setScope(e.target.value as InsightTemplateScope)} className="h-9 rounded-lg border border-line bg-white px-2 text-[12px] font-semibold text-ink outline-none">
          <option value="PERSONAL">Personal</option>
          <option value="WORKSPACE">Workspace</option>
        </select>
      </div>
      <p className="text-[10.5px] text-ink-subtle">Team templates will arrive with Teams permissions — for now choose Personal or Workspace.</p>

      <div className="space-y-2">
        {sections.map((s, i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-2.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[10px] font-bold text-ink-subtle">#{i + 1}</span>
              <input value={s.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="Section title (e.g. Budget)" className="h-8 flex-1 rounded-md border border-line bg-white px-2 text-[12px] font-semibold text-ink outline-none" />
              <select value={s.outputFormat} onChange={(e) => upd(i, { outputFormat: e.target.value as InsightOutputFormat })} className="h-8 rounded-md border border-line bg-white px-1.5 text-[11px] text-ink outline-none">
                <option value="TEXT">Text</option><option value="BULLETS">Bullets</option>
              </select>
              {sections.length > 1 && <button type="button" onClick={() => del(i)} className="text-ink-subtle hover:text-rose-600"><X size={14} /></button>}
            </div>
            <textarea rows={2} value={s.prompt} onChange={(e) => upd(i, { prompt: e.target.value })} placeholder="Prompt: what to extract / analyze / summarize from the transcript" className="w-full rounded-md border border-line bg-white p-2 text-[12px] leading-4 text-ink outline-none" />
          </div>
        ))}
        <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded-md border border-dashed border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-2"><Plus size={12} /> Add section</button>
      </div>

      {err && <p className="text-[12px] text-rose-600">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onBack}>Cancel</Button>
        <Button variant="primary" size="sm" loading={busy} onClick={save}>{template ? 'Save changes' : 'Create template'}</Button>
      </div>
    </div>
  );
}

/* ══════════════════ Log call ══════════════════ */
function LogCallModal({ onClose, onDone }: { onClose: () => void; onDone: (effectsMsg?: string) => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadId, setLeadId] = useState('');
  const [direction, setDirection] = useState<CallDirection>('OUTBOUND');
  const [mode, setMode] = useState<'schedule' | 'log'>('log');
  const [scheduledAt, setScheduledAt] = useState('');
  const [outcome, setOutcome] = useState<CallOutcome | ''>('');
  const [durationMin, setDurationMin] = useState(5);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  useEffect(() => { leadsApi.list({ limit: 100 }).then((r) => setLeads(r.leads)).catch(() => {}); }, []);

  async function submit() {
    setErr('');
    setBusy(true);
    try {
      const r = await callsApi.create({
        leadId: leadId || undefined,
        direction,
        status: mode === 'schedule' ? 'SCHEDULED' : 'COMPLETED',
        outcome: mode === 'log' ? (outcome || undefined) : undefined,
        scheduledAt: mode === 'schedule' && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        durationSec: mode === 'log' ? durationMin * 60 : undefined,
        notes: notes.trim() || undefined,
      });
      const parts: string[] = [];
      if (r.leadStatus) parts.push(`lead → ${r.leadStatus}`);
      if (r.meetingCreated) parts.push('meeting created');
      if (r.workflowsTriggered) parts.push(`${r.workflowsTriggered} workflow(s)`);
      onDone(parts.join(' · ') || undefined);
    } catch (e) { const error = e as { response?: { data?: { error?: string } } }; setErr(error.response?.data?.error || 'Could not log call.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Log a call" size="md"
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button variant="primary" size="sm" loading={busy} onClick={submit}>{mode === 'schedule' ? 'Schedule' : 'Log call'}</Button></>}>
      <div className="space-y-3 p-4">
        <div className="flex gap-1.5">
          {(['log', 'schedule'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={['flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition-colors', mode === m ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line text-ink-muted hover:bg-surface-2'].join(' ')}>{m === 'log' ? 'Log a completed call' : 'Schedule a call'}</button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-ink-muted">Contact</label>
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="h-10 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100">
            <option value="">No contact</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.firstName} {l.lastName}{l.company ? ` — ${l.company}` : ''}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-ink-muted">Direction</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value as CallDirection)} className="h-10 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100">
              <option value="OUTBOUND">Outbound</option><option value="INBOUND">Inbound</option>
            </select>
          </div>
          {mode === 'schedule' ? (
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-ink-muted">When</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-10 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-ink-muted">Duration (min)</label>
              <input type="number" min={0} max={600} value={durationMin} onChange={(e) => setDurationMin(Math.max(0, Number(e.target.value) || 0))} className="h-10 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
            </div>
          )}
        </div>

        {mode === 'log' && (
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-ink-muted">Outcome</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as CallOutcome)} className="h-10 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100">
              <option value="">No outcome yet</option>
              {OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
            </select>
            <p className="text-[11px] text-ink-subtle">Outcome updates the lead status; “Meeting booked” also creates a meeting and runs workflows.</p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-ink-muted">Notes</label>
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed, objections, next steps…" className="w-full rounded-lg border border-[var(--border-strong)] bg-white p-3 text-[13px] leading-5 text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
        </div>
        {err && <p className="text-[12px] text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}
