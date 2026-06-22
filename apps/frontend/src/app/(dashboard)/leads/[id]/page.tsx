'use client';

/* ──────────────────────────────────────────────────────────────────────────
   Lead 360 (/leads/:id) — единая карточка контакта. Всё из РЕАЛЬНЫХ источников:
   GET /api/leads/:id/timeline собирает state (статус/score/owner/активная
   последовательность+прогресс/следующее действие/последний контакт), counts и
   единую ленту событий (письма, ответы, звонки, встречи, авто-правила).
   Быстрые действия — живые эндпоинты, без заглушек:
     • Log call        → POST /api/calls          (исход меняет статус лида и т.д.)
     • Schedule meeting → POST /api/meetings
     • Add to sequence  → POST /api/leads/:id/enroll
     • Create task      → POST /api/notifications  (попадает в Notification Center)
   Светлая Bold-тема. Deep-link сюда ведут Notifications / Meetings / Calls.
   ────────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, Mail, Reply, Phone, PhoneOutgoing, Calendar, Zap, Building2, Globe,
  Linkedin, MapPin, Briefcase, Target, Clock, ArrowRight, Plus, CalendarPlus,
  ListChecks, CheckSquare, Activity, Loader2, User, Sparkles, Pause, Play, PauseCircle,
  UserPlus, UserMinus, ArrowUpRight,
} from 'lucide-react';
import HandoffPanel from '@/components/outreach/HandoffPanel';
import {
  leadsApi, callsApi, campaignsApi, notificationsApi,
  type LeadTimeline, type TimelineKind, type CallOutcome, type CallDirection,
} from '@/lib/api';
import { createMeeting } from '@/lib/crmApi';
import type { Campaign } from '@/types';
import Topbar from '@/components/layout/Topbar';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

// ── Тоны статуса лида (LeadStatus enum) ──────────────────────────────────────
const STATUS_TONE: Record<string, string> = {
  NEW: 'bg-surface-2 text-ink-muted', CONTACTED: 'bg-sky-100 text-sky-700',
  REPLIED: 'bg-violet-100 text-violet-700', HOT: 'bg-amber-100 text-amber-700',
  CONVERTED: 'bg-emerald-100 text-emerald-700', LOST: 'bg-rose-100 text-rose-600',
  UNSUBSCRIBED: 'bg-surface-2 text-ink-subtle',
};
const STATUS_LABEL: Record<string, string> = {
  NEW: 'New', CONTACTED: 'Contacted', REPLIED: 'Replied', HOT: 'Hot',
  CONVERTED: 'Converted', LOST: 'Lost', UNSUBSCRIBED: 'Unsubscribed',
};

const KIND_META: Record<TimelineKind, { icon: typeof Mail; tone: string; ring: string }> = {
  email:    { icon: Mail,     tone: 'bg-brand-50 text-brand-600',     ring: 'border-brand-100' },
  reply:    { icon: Reply,    tone: 'bg-emerald-50 text-emerald-600', ring: 'border-emerald-100' },
  call:     { icon: Phone,    tone: 'bg-violet-50 text-violet-600',   ring: 'border-violet-100' },
  meeting:  { icon: Calendar, tone: 'bg-sky-50 text-sky-600',         ring: 'border-sky-100' },
  workflow: { icon: Zap,      tone: 'bg-amber-50 text-amber-600',     ring: 'border-amber-100' },
  enrollment: { icon: PauseCircle, tone: 'bg-slate-100 text-slate-600', ring: 'border-slate-200' },
};

// M11-8: enrollment-события (lifecycle последовательности) визуально отделены от касаний (touch).
// Своя иконка/тон на подтип; в ленте помечаются бейджем «Sequence».
function enrollmentMeta(title: string): { icon: typeof Mail; tone: string; ring: string } {
  if (/enrolled/i.test(title)) return { icon: UserPlus, tone: 'bg-indigo-50 text-indigo-600', ring: 'border-indigo-100' };
  if (/exited/i.test(title)) return { icon: UserMinus, tone: 'bg-rose-50 text-rose-600', ring: 'border-rose-100' };
  if (/resumed/i.test(title)) return { icon: Play, tone: 'bg-emerald-50 text-emerald-600', ring: 'border-emerald-100' };
  if (/paused/i.test(title)) return { icon: Pause, tone: 'bg-amber-50 text-amber-600', ring: 'border-amber-100' };
  return { icon: PauseCircle, tone: 'bg-slate-100 text-slate-600', ring: 'border-slate-200' };
}

// Тоны статуса enrollment'а (M11-2 EnrollmentStatus) для карточки активной последовательности.
const ENROLL_TONE: Record<string, string> = {
  PENDING: 'bg-surface-2 text-ink-muted', ACTIVE: 'bg-sky-100 text-sky-700', PAUSED: 'bg-amber-100 text-amber-700',
  REPLIED: 'bg-violet-100 text-violet-700', COMPLETED: 'bg-brand-100 text-brand-700', STOPPED: 'bg-rose-100 text-rose-600',
};
function humanizeReason(r: string): string {
  return ({ UNSUBSCRIBED: 'unsubscribed', CONVERTED: 'converted', NO_EMAIL: 'no email', NO_LINKEDIN: 'no LinkedIn', LOST: 'lost', MANUAL: 'manual' } as Record<string, string>)[r] ?? r.toLowerCase().replace(/_/g, ' ');
}

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  CONNECTED: 'Connected', NO_ANSWER: 'No answer', VOICEMAIL: 'Voicemail',
  NOT_INTERESTED: 'Not interested', CALLBACK: 'Callback', MEETING_BOOKED: 'Meeting booked', WRONG_NUMBER: 'Wrong number',
};
const OUTCOMES: CallOutcome[] = ['CONNECTED', 'MEETING_BOOKED', 'CALLBACK', 'NOT_INTERESTED', 'VOICEMAIL', 'NO_ANSWER', 'WRONG_NUMBER'];

function fmtWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtRel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtDate(iso);
}

type ModalKind = 'call' | 'meeting' | 'sequence' | 'task' | null;

export default function Lead360Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const [data, setData] = useState<LeadTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [handoffOpen, setHandoffOpen] = useState(false); // M15-3

  const load = useCallback(async () => {
    try {
      const d = await leadsApi.timeline(id);
      setData(d);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } };
      if (e?.response?.status === 404) setNotFound(true);
      else toast.error('Failed to load lead');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { void load(); }, [load]);

  const [seqBusy, setSeqBusy] = useState(false);
  // M11-3: пауза/возобновление активной последовательности лида (per-lead).
  const toggleEnrollment = useCallback(async (campaignId: string, paused: boolean) => {
    setSeqBusy(true);
    try {
      const r = paused ? await leadsApi.resumeEnrollment(id, campaignId) : await leadsApi.pauseEnrollment(id, campaignId);
      toast.success(paused ? `Resumed — next send ${fmtWhen(r.nextSendAt)}` : 'Sequence paused');
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; reason?: string } } };
      toast.error(e?.response?.data?.error ?? 'Action failed');
    } finally {
      setSeqBusy(false);
    }
  }, [id, toast, load]);

  // M11-8: снять лида с кампании (unenroll) с подтверждением.
  const unenroll = useCallback(async (campaignId: string) => {
    if (!window.confirm('Remove this lead from the campaign? Their enrollment will be deleted (re-enroll possible later).')) return;
    setSeqBusy(true);
    try {
      await leadsApi.unenroll(id, campaignId);
      toast.success('Removed from campaign');
      await load();
    } catch {
      toast.error('Failed to remove');
    } finally {
      setSeqBusy(false);
    }
  }, [id, toast, load]);

  const fullName = data ? `${data.lead.firstName ?? ''} ${data.lead.lastName ?? ''}`.trim() || 'Lead' : 'Lead';

  if (loading) {
    return (
      <>
        <Topbar title="Leads" subtitle="Loading…" icon={<User size={18} strokeWidth={1.85} />} />
        <div className="p-4"><div className="mx-auto max-w-5xl space-y-3">
          <div className="skeleton h-28 rounded-xl" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="skeleton h-64 rounded-xl lg:col-span-2" />
            <div className="skeleton h-64 rounded-xl" />
          </div>
        </div></div>
      </>
    );
  }

  if (notFound || !data) {
    return (
      <>
        <Topbar title="Leads" subtitle="Not found" icon={<User size={18} strokeWidth={1.85} />} />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h2 className="text-[16px] font-semibold text-ink">Lead not found</h2>
            <p className="mt-1 text-[13px] text-ink-muted">It may have been deleted or you don&apos;t have access.</p>
            <button onClick={() => router.push('/leads')} className="mt-4 text-[13px] font-medium text-brand-600 hover:underline">← Back to leads</button>
          </div>
        </div>
      </>
    );
  }

  const { lead, state, counts, timeline } = data;
  const seq = state.activeSequence;
  const stepPct = seq && seq.totalSteps > 0 ? Math.round((Math.min(seq.currentStep, seq.totalSteps) / seq.totalSteps) * 100) : 0;

  return (
    <>
      <Topbar
        icon={
          <button type="button" onClick={() => router.push('/leads')} aria-label="Back to leads"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink">
            <ChevronLeft size={16} strokeWidth={1.85} />
          </button>
        }
        title="Leads"
        subtitle={fullName}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-5xl space-y-3">
          {/* ── Header card ── */}
          <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
            <div className="flex flex-wrap items-start gap-3">
              <Avatar name={fullName} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[18px] font-extrabold tracking-[-0.02em] text-ink">{fullName}</h1>
                  <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${STATUS_TONE[lead.status] ?? STATUS_TONE.NEW}`}>{STATUS_LABEL[lead.status] ?? lead.status}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold text-ink-muted"><Target size={10} /> Score {lead.score}</span>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12.5px] text-ink-muted">
                  {lead.title && <span className="inline-flex items-center gap-1"><Briefcase size={11} className="text-ink-subtle" /> {lead.title}</span>}
                  {lead.company && <span className="inline-flex items-center gap-1"><Building2 size={11} className="text-ink-subtle" /> {lead.company}</span>}
                  {(lead.city || lead.country) && <span className="inline-flex items-center gap-1"><MapPin size={11} className="text-ink-subtle" /> {[lead.city, lead.country].filter(Boolean).join(', ')}</span>}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px]">
                  {lead.email && <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline"><Mail size={12} /> {lead.email}</a>}
                  {lead.linkedinUrl && <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline"><Linkedin size={12} /> LinkedIn</a>}
                  {lead.website && <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline"><Globe size={12} /> Website</a>}
                  <span className="inline-flex items-center gap-1 text-ink-subtle"><User size={12} /> Owner: <span className="font-medium text-ink-muted">{state.owner ?? 'Unassigned'}</span></span>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
              <Button size="sm" variant="primary" onClick={() => setModal('call')}><PhoneOutgoing size={14} strokeWidth={2.2} /> Log call</Button>
              <Button size="sm" variant="secondary" onClick={() => setModal('meeting')}><CalendarPlus size={14} /> Schedule meeting</Button>
              <Button size="sm" variant="secondary" onClick={() => setModal('sequence')}><ListChecks size={14} /> Add to sequence</Button>
              <Button size="sm" variant="secondary" onClick={() => setModal('task')}><CheckSquare size={14} /> Create task</Button>
              {counts.replies > 0 && <Button size="sm" variant="secondary" onClick={() => setHandoffOpen(true)}><ArrowUpRight size={14} /> Handoff package</Button>}
            </div>
          </div>

          {/* ── Counts strip ── */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {([
              { label: 'Emails', value: counts.emails, icon: <Mail size={12} /> },
              { label: 'Replies', value: counts.replies, icon: <Reply size={12} /> },
              { label: 'Calls', value: counts.calls, icon: <Phone size={12} /> },
              { label: 'Meetings', value: counts.meetings, icon: <Calendar size={12} /> },
              { label: 'Automations', value: counts.automations, icon: <Zap size={12} /> },
            ]).map((k) => (
              <div key={k.label} className="rounded-xl border border-line bg-surface px-3 py-2.5 shadow-xs">
                <span className="mb-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-ink-subtle">{k.icon} {k.label}</span>
                <p className="text-[20px] font-extrabold leading-none tracking-[-0.02em] text-ink">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {/* ── Timeline ── */}
            <div className="rounded-xl border border-line bg-surface p-4 shadow-xs lg:col-span-2">
              <h2 className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.04em] text-ink-subtle"><Activity size={13} className="text-brand-600" /> Activity timeline</h2>
              {timeline.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line py-10 text-center">
                  <Activity size={20} className="mx-auto mb-2 text-ink-subtle" />
                  <p className="text-[13px] font-semibold text-ink">No activity yet</p>
                  <p className="mt-0.5 text-[12px] text-ink-muted">Log a call, schedule a meeting or add this lead to a sequence to start the story.</p>
                </div>
              ) : (
                <ol className="relative space-y-3.5 before:absolute before:left-[15px] before:top-1 before:bottom-1 before:w-px before:bg-line">
                  {timeline.map((ev) => {
                    const isEnroll = ev.kind === 'enrollment';
                    const M = isEnroll ? enrollmentMeta(ev.title) : (KIND_META[ev.kind] ?? KIND_META.workflow);
                    const Icon = M.icon;
                    return (
                      <li key={`${ev.kind}-${ev.id}`} className="relative flex gap-3 pl-0">
                        {/* M11-8: enrollment-события — квадратная иконка (lifecycle), касания — круглая. Визуальное разделение. */}
                        <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center border bg-surface ${isEnroll ? 'rounded-md' : 'rounded-full'} ${M.ring} ${M.tone}`}><Icon size={14} /></span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-[13px] font-semibold text-ink">
                              {isEnroll && <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 align-middle text-[9.5px] font-bold uppercase tracking-wide text-slate-500">Sequence</span>}
                              {ev.title}
                            </p>
                            <span className="shrink-0 text-[11px] text-ink-subtle" title={fmtWhen(ev.at)}>{fmtRel(ev.at)}</span>
                          </div>
                          {ev.detail && <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[12px] leading-4 text-ink-muted">{ev.detail}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* ── State rail ── */}
            <div className="space-y-3">
              <StateCard label="Lead status" icon={<Activity size={12} />}>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[state.status] ?? STATUS_TONE.NEW}`}>{STATUS_LABEL[state.status] ?? state.status}</span>
                <span className="ml-2 text-[12px] text-ink-muted">Score {state.score}</span>
              </StateCard>

              <StateCard label="Active sequence" icon={<ListChecks size={12} />}>
                {seq ? (
                  <div>
                    <button onClick={() => router.push(`/sequences?campaign=${seq.campaignId}`)} className="block max-w-full truncate text-left text-[13px] font-semibold text-ink hover:text-brand-600">{seq.name}</button>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${stepPct}%` }} />
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-ink-muted">Step {seq.currentStep}/{seq.totalSteps}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold ${ENROLL_TONE[seq.status] ?? 'bg-surface-2 text-ink-muted'}`}>
                        {seq.status.toLowerCase()}{seq.status === 'STOPPED' && seq.stopReason ? ` · ${humanizeReason(seq.stopReason)}` : ''}
                      </span>
                      {seq.nextSendAt && <span className="text-[11px] text-ink-subtle">next {fmtWhen(seq.nextSendAt)}</span>}
                      {seq.status === 'COMPLETED' && seq.completedAt && <span className="text-[11px] text-ink-subtle">done {fmtRel(seq.completedAt)}</span>}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      {seq.status === 'PAUSED' ? (
                        <button onClick={() => toggleEnrollment(seq.campaignId, true)} disabled={seqBusy}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                          {seqBusy ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Resume
                        </button>
                      ) : (seq.status === 'ACTIVE' || seq.status === 'PENDING') ? (
                        <button onClick={() => toggleEnrollment(seq.campaignId, false)} disabled={seqBusy}
                          className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink-muted hover:bg-surface-3 disabled:opacity-50">
                          {seqBusy ? <Loader2 size={11} className="animate-spin" /> : <Pause size={11} />} Pause
                        </button>
                      ) : null}
                      <button onClick={() => unenroll(seq.campaignId)} disabled={seqBusy}
                        className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                        <UserMinus size={11} /> Unenroll
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] text-ink-muted">Not enrolled</span>
                    <button onClick={() => setModal('sequence')} className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-600 hover:underline">Add <ArrowRight size={12} /></button>
                  </div>
                )}
              </StateCard>

              <StateCard label="Next action" icon={<Clock size={12} />}>
                <p className="text-[13px] font-semibold text-ink">{state.nextActionAt ? fmtWhen(state.nextActionAt) : 'None scheduled'}</p>
              </StateCard>

              <StateCard label="Last touch" icon={<Sparkles size={12} />}>
                <p className="text-[13px] font-semibold text-ink">{state.lastTouchAt ? fmtRel(state.lastTouchAt) : 'No contact yet'}</p>
                {state.lastTouchAt && <p className="text-[11px] text-ink-subtle">{fmtWhen(state.lastTouchAt)}</p>}
              </StateCard>
            </div>
          </div>
        </div>
      </div>

      {modal === 'call' && <LogCallModal leadId={lead.id} onClose={() => setModal(null)} onDone={(msg) => { setModal(null); void load(); toast.success('Call logged', msg); }} />}
      {modal === 'meeting' && <ScheduleMeetingModal leadId={lead.id} company={lead.company} name={fullName} onClose={() => setModal(null)} onDone={() => { setModal(null); void load(); toast.success('Meeting scheduled'); }} />}
      {modal === 'sequence' && <AddToSequenceModal leadId={lead.id} onClose={() => setModal(null)} onDone={(name) => { setModal(null); void load(); toast.success('Added to sequence', name); }} />}
      {modal === 'task' && <CreateTaskModal leadId={lead.id} name={fullName} onClose={() => setModal(null)} onDone={() => { setModal(null); toast.success('Task created', 'Find it in Notifications'); }} />}
      {/* M15-3: handoff package drawer (доступ из Lead 360) */}
      {handoffOpen && <HandoffPanel params={{ leadId: lead.id }} onClose={() => setHandoffOpen(false)} onChange={() => void load()} />}
    </>
  );
}

function StateCard({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
      <span className="mb-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-ink-subtle">{icon} {label}</span>
      {children}
    </div>
  );
}

/* ══════════════════ Log call ══════════════════ */
function LogCallModal({ leadId, onClose, onDone }: { leadId: string; onClose: () => void; onDone: (msg?: string) => void }) {
  const [direction, setDirection] = useState<CallDirection>('OUTBOUND');
  const [mode, setMode] = useState<'log' | 'schedule'>('log');
  const [scheduledAt, setScheduledAt] = useState('');
  const [outcome, setOutcome] = useState<CallOutcome | ''>('');
  const [durationMin, setDurationMin] = useState(5);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  async function submit() {
    setErr(''); setBusy(true);
    try {
      const r = await callsApi.create({
        leadId, direction,
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Direction">
            <select value={direction} onChange={(e) => setDirection(e.target.value as CallDirection)} className={selectCls}>
              <option value="OUTBOUND">Outbound</option><option value="INBOUND">Inbound</option>
            </select>
          </Field>
          {mode === 'schedule' ? (
            <Field label="When"><input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={selectCls} /></Field>
          ) : (
            <Field label="Duration (min)"><input type="number" min={0} max={600} value={durationMin} onChange={(e) => setDurationMin(Math.max(0, Number(e.target.value) || 0))} className={selectCls} /></Field>
          )}
        </div>
        {mode === 'log' && (
          <Field label="Outcome">
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as CallOutcome)} className={selectCls}>
              <option value="">No outcome yet</option>
              {OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-ink-subtle">Outcome updates the lead status; “Meeting booked” also creates a meeting and runs workflows.</p>
          </Field>
        )}
        <Field label="Notes">
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed, objections, next steps…" className="w-full rounded-lg border border-[var(--border-strong)] bg-white p-3 text-[13px] leading-5 text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
        </Field>
        {err && <p className="text-[12px] text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}

/* ══════════════════ Schedule meeting ══════════════════ */
function ScheduleMeetingModal({ leadId, company, name, onClose, onDone }: { leadId: string; company: string | null; name: string; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(`Intro call — ${name}`);
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (!scheduledAt) { setErr('Pick a date and time.'); return; }
    setBusy(true);
    try {
      await createMeeting({ title: title.trim() || 'Meeting', leadId, company: company || undefined, scheduledAt: new Date(scheduledAt).toISOString(), durationMin, status: 'SCHEDULED', source: 'manual', notes: notes.trim() || undefined });
      onDone();
    } catch (e) { const error = e as { response?: { data?: { error?: string } } }; setErr(error.response?.data?.error || 'Could not schedule meeting.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Schedule a meeting" size="md"
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button variant="primary" size="sm" loading={busy} onClick={submit}>Schedule</Button></>}>
      <div className="space-y-3 p-4">
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={selectCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="When"><input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={selectCls} /></Field>
          <Field label="Duration (min)"><input type="number" min={5} max={480} value={durationMin} onChange={(e) => setDurationMin(Math.max(5, Number(e.target.value) || 30))} className={selectCls} /></Field>
        </div>
        <Field label="Notes"><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agenda, attendees…" className="w-full rounded-lg border border-[var(--border-strong)] bg-white p-3 text-[13px] leading-5 text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></Field>
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11.5px] text-amber-800"><Calendar size={13} className="mt-0.5 shrink-0 text-amber-600" /> The meeting is tracked live. Calendar invites send once a calendar is connected in Settings.</p>
        {err && <p className="text-[12px] text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}

/* ══════════════════ Add to sequence ══════════════════ */
function AddToSequenceModal({ leadId, onClose, onDone }: { leadId: string; onClose: () => void; onDone: (campaignName: string) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  useEffect(() => { campaignsApi.list().then((c) => { setCampaigns(c); if (c[0]) setCampaignId(c[0].id); }).catch(() => {}).finally(() => setLoading(false)); }, []);

  async function submit() {
    setErr('');
    if (!campaignId) { setErr('Pick a sequence.'); return; }
    setBusy(true);
    try {
      const r = await leadsApi.enroll(leadId, campaignId);
      onDone(r.campaignName);
    } catch (e) { const error = e as { response?: { data?: { error?: string } } }; setErr(error.response?.data?.error || 'Could not add to sequence.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Add to sequence" size="md"
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button variant="primary" size="sm" loading={busy} disabled={!campaignId} onClick={submit}>Add to sequence</Button></>}>
      <div className="space-y-3 p-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-[13px] text-ink-muted"><Loader2 size={14} className="animate-spin" /> Loading sequences…</div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line py-8 text-center">
            <ListChecks size={20} className="mx-auto mb-2 text-ink-subtle" />
            <p className="text-[13px] font-semibold text-ink">No sequences yet</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">Create a campaign with steps first.</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => { onClose(); }}><Plus size={14} /> Go to Campaigns</Button>
          </div>
        ) : (
          <>
            <Field label="Sequence">
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={selectCls}>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.status}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-ink-subtle">The lead is enrolled at step 0. If the campaign is active, the first email queues immediately.</p>
            </Field>
            {err && <p className="text-[12px] text-rose-600">{err}</p>}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ══════════════════ Create task ══════════════════ */
function CreateTaskModal({ leadId, name, onClose, onDone }: { leadId: string; name: string; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(`Follow up with ${name}`);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (!title.trim()) { setErr('Title is required.'); return; }
    setBusy(true);
    try {
      await notificationsApi.create({ title: title.trim(), body: body.trim() || undefined, leadId });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('notifications:refresh'));
      onDone();
    } catch (e) { const error = e as { response?: { data?: { error?: string } } }; setErr(error.response?.data?.error || 'Could not create task.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title="Create a task" size="md"
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button variant="primary" size="sm" loading={busy} onClick={submit}>Create task</Button></>}>
      <div className="space-y-3 p-4">
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={selectCls} /></Field>
        <Field label="Details"><textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What needs to happen, context…" className="w-full rounded-lg border border-[var(--border-strong)] bg-white p-3 text-[13px] leading-5 text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></Field>
        <p className="flex items-start gap-1.5 rounded-lg border border-line bg-surface-2/40 px-3 py-2 text-[11.5px] text-ink-muted"><CheckSquare size={13} className="mt-0.5 shrink-0 text-brand-600" /> The task lands in the Notification Center, linked to this lead for one-click deep-link back here.</p>
        {err && <p className="text-[12px] text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}

const selectCls = 'h-10 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[14px] text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-[12px] font-medium text-ink-muted">{label}</label>{children}</div>;
}
