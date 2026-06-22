'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { outreachApi, type ReplyMessage } from '@/lib/api';
import HandoffPanel from '@/components/outreach/HandoffPanel';
import { listMeetings, createMeeting, updateMeeting, setMeetingOutcome, syncMeeting, getCalendarStatus, connectCalendar, disconnectCalendar, type CrmMeeting, type MeetingStatus, type MeetingOutcome, type CalendarSyncStatus, type CalendarStatus } from '@/lib/crmApi';
import {
  CalendarCheck,
  CalendarPlus,
  Bot,
  CheckCircle2,
  XCircle,
  CalendarX,
  Flame,
  Clock,
  ArrowUpRight,
  Loader2,
  ThumbsUp,
  Repeat,
  CalendarClock,
  Reply,
  RefreshCw,
  Link2,
  Unlink,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';

/* ──────────────────────────────────────────────────────────────────────────
   Meetings (/meetings) — booking/handoff/outcome горячих ответов. Живой трекинг
   на модели Meeting (create/update/status/outcome). Источник meeting-ready —
   реальные INTERESTED-ответы. Календарь-СИНХРОНИЗАЦИЯ — внешняя интеграция,
   подключается позже; ручной booking/outcome реальны. Светлая Bold-тема.
   ────────────────────────────────────────────────────────────────────────── */

const STATUS_META: Record<MeetingStatus, { label: string; tone: string }> = {
  REQUESTED: { label: 'Requested', tone: 'bg-surface-2 text-ink-muted' },
  SCHEDULED: { label: 'Scheduled', tone: 'bg-brand-100 text-brand-700' },
  COMPLETED: { label: 'Completed', tone: 'bg-emerald-100 text-emerald-700' },
  NO_SHOW: { label: 'No-show', tone: 'bg-amber-100 text-amber-700' },
  CANCELED: { label: 'Canceled', tone: 'bg-rose-100 text-rose-600' },
};
const TONES = ['from-[#6366f1] to-[#8b5cf6]', 'from-[#06b6d4] to-[#4f46e5]', 'from-[#8b5cf6] to-[#d946ef]', 'from-[#10b981] to-[#06b6d4]', 'from-[#f59e0b] to-[#f43f5e]'];
const SYNC_META: Record<CalendarSyncStatus, { label: string; tone: string }> = {
  SYNCED: { label: 'On calendar', tone: 'bg-emerald-50 text-emerald-700' },
  PENDING: { label: 'Syncing…', tone: 'bg-amber-50 text-amber-700' },
  FAILED: { label: 'Sync failed', tone: 'bg-rose-50 text-rose-600' },
  NOT_CONNECTED: { label: 'Not on calendar', tone: 'bg-surface-2 text-ink-subtle' },
  CANCELED: { label: 'Removed from calendar', tone: 'bg-surface-2 text-ink-subtle' },
};
function initials(n: string) { return (n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }
function fmtWhen(iso?: string | null): string {
  if (!iso) return 'unscheduled';
  const d = new Date(iso); if (isNaN(d.getTime())) return 'unscheduled';
  return d.toLocaleString('en', { weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<CrmMeeting[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ready, setReady] = useState<ReplyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [outcomeFor, setOutcomeFor] = useState<CrmMeeting | null>(null);
  const [toast, setToast] = useState('');
  const [cal, setCal] = useState<CalendarStatus | null>(null);
  const [handoffFor, setHandoffFor] = useState<{ meetingId?: string; leadId?: string } | null>(null); // M15-3
  const [calBusy, setCalBusy] = useState(false);

  function showToast(m: string) { setToast(m); window.setTimeout(() => setToast(''), 4000); }
  const mark = (id: string, on: boolean) => setBusy((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });

  const load = useCallback(async () => {
    try {
      const [m, r, c] = await Promise.all([listMeetings(), outreachApi.replies('INTERESTED').catch(() => ({ replies: [] as ReplyMessage[] })), getCalendarStatus().catch(() => null)]);
      setMeetings(m.meetings); setCounts(m.counts ?? {});
      setReady(r.replies);
      if (c) setCal(c);
    } catch { /* no-op */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function connectCal(provider: 'GOOGLE' | 'OUTLOOK') {
    setCalBusy(true);
    try { const r = await connectCalendar(provider); showToast(`Calendar connected · ${r.synced} meeting(s) synced`); await load(); }
    catch { showToast('Could not connect calendar'); } finally { setCalBusy(false); }
  }
  async function disconnectCal() {
    if (!window.confirm('Disconnect calendar? Meetings will no longer sync to your external calendar.')) return;
    setCalBusy(true);
    try { await disconnectCalendar(); showToast('Calendar disconnected'); await load(); }
    catch { showToast('Could not disconnect'); } finally { setCalBusy(false); }
  }
  async function retrySync(m: CrmMeeting) {
    mark(m.id, true);
    try { await syncMeeting(m.id); showToast('Re-synced to calendar'); await load(); }
    catch { showToast('Sync failed'); } finally { mark(m.id, false); }
  }

  // meeting-ready = interested-ответы, по лидам которых ещё НЕТ встречи.
  const bookedLeadIds = useMemo(() => new Set(meetings.map((m) => m.leadId).filter(Boolean) as string[]), [meetings]);
  const meetingReady = useMemo(() => ready.filter((r) => !bookedLeadIds.has(r.lead.id)), [ready, bookedLeadIds]);

  const scheduled = meetings.filter((m) => m.status === 'SCHEDULED' || m.status === 'REQUESTED');
  const closed = meetings.filter((m) => m.status === 'COMPLETED' || m.status === 'NO_SHOW' || m.status === 'CANCELED');

  const kpi = [
    { label: 'Meeting-ready', value: String(meetingReady.length), icon: <Flame size={13} />, tone: 'text-orange-500' },
    { label: 'Scheduled', value: String(scheduled.length), icon: <CalendarCheck size={13} />, tone: 'text-brand-600' },
    { label: 'Completed', value: String(counts.COMPLETED ?? 0), icon: <CheckCircle2 size={13} />, tone: 'text-emerald-600' },
    { label: 'No-show', value: String(counts.NO_SHOW ?? 0), icon: <CalendarX size={13} />, tone: 'text-amber-600' },
  ];

  async function book(r: ReplyMessage) {
    mark(r.id, true);
    try {
      const when = new Date(Date.now() + 2 * 24 * 3600 * 1000); when.setHours(15, 0, 0, 0);
      // M15-2: передаём replyMessageId → backend атрибутирует встречу к reply/кампании + идемпотентность.
      const m = await createMeeting({ replyMessageId: r.id, leadId: r.lead.id, company: r.lead.company ?? undefined, scheduledAt: when.toISOString(), durationMin: 30 });
      showToast(m.duplicate ? `Meeting already booked with ${r.lead.firstName} ${r.lead.lastName}` : `Meeting booked with ${r.lead.firstName} ${r.lead.lastName}`);
      await load();
    } catch { showToast('Could not book meeting'); }
    finally { mark(r.id, false); }
  }

  // M15-4: типизированный исход — backend синкает лида/аудит/HandoffPackage (идемпотентно).
  const OUTCOME_LABEL: Record<MeetingOutcome, string> = { SHOWED: 'Showed', NO_SHOW: 'No-show', QUALIFIED: 'Qualified', NOT_QUALIFIED: 'Not qualified', CANCELED: 'Canceled' };
  async function applyOutcome(m: CrmMeeting, outcome: MeetingOutcome) {
    mark(m.id, true);
    try {
      const r = await setMeetingOutcome(m.id, outcome);
      setOutcomeFor(null);
      showToast(r.changed ? `${m.title.replace(/^Intro call · /, '')} → ${OUTCOME_LABEL[outcome]}${r.leadStatus ? ` · lead ${r.leadStatus.toLowerCase()}` : ''}` : 'Already set');
      await load();
    } catch { showToast('Could not set outcome'); }
    finally { mark(m.id, false); }
  }

  async function setStatus(m: CrmMeeting, status: MeetingStatus, outcome?: string) {
    mark(m.id, true);
    try {
      await updateMeeting(m.id, { status, ...(outcome !== undefined ? { outcome } : {}) });
      setOutcomeFor(null);
      showToast(`${m.title.replace(/^Intro call · /, '')} → ${STATUS_META[status].label}`);
      await load();
    } catch { showToast('Could not update meeting'); }
    finally { mark(m.id, false); }
  }

  return (
    <>
      <Topbar title="Meetings" subtitle="Outbound motion · AI-booked, human-closed" icon={<CalendarCheck size={18} strokeWidth={1.85} />} />

      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface/70 px-4">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700"><Bot size={13} /> {meetingReady.length} hot lead{meetingReady.length === 1 ? '' : 's'} ready to book</span>
        {cal?.connected
          ? <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700"><CalendarClock size={12} /> {cal.provider === 'OUTLOOK' ? 'Microsoft 365' : 'Google'} calendar connected{cal.canManage && <button type="button" onClick={disconnectCal} disabled={calBusy} className="ml-1 text-ink-subtle hover:text-rose-600" title="Disconnect"><Unlink size={11} /></button>}</span>
          : <span className="ml-auto text-[11.5px] text-ink-subtle">Calendar not connected · sync is demo</span>}
      </div>

      {/* Calendar connect banner */}
      {cal && !cal.connected && cal.canManage && (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-amber-200 bg-amber-50/60 px-4 py-2.5">
          <CalendarClock size={15} className="shrink-0 text-amber-600" />
          <p className="flex-1 text-[12px] text-amber-800">Connect a calendar so booked meetings sync to it automatically. Provider auth is in demo mode until OAuth is configured.</p>
          <button type="button" onClick={() => connectCal('GOOGLE')} disabled={calBusy} className="inline-flex h-7 items-center gap-1 rounded-lg bg-white px-2.5 text-[11.5px] font-semibold text-ink ring-1 ring-inset ring-line hover:bg-surface-2 disabled:opacity-60"><Link2 size={12} /> Connect Google</button>
          <button type="button" onClick={() => connectCal('OUTLOOK')} disabled={calBusy} className="inline-flex h-7 items-center gap-1 rounded-lg bg-white px-2.5 text-[11.5px] font-semibold text-ink ring-1 ring-inset ring-line hover:bg-surface-2 disabled:opacity-60"><Link2 size={12} /> Connect Microsoft 365</button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* KPI */}
        <div className="mb-4 flex items-stretch divide-x divide-line overflow-x-auto rounded-xl border border-line bg-surface shadow-xs">
          {kpi.map((k) => (
            <div key={k.label} className="flex min-w-[130px] flex-1 flex-col px-3 py-2.5">
              <span className={`mb-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${k.tone}`}>{k.icon} {k.label}</span>
              <span className="text-[20px] font-extrabold leading-none tracking-[-0.02em] text-ink">{loading ? '—' : k.value}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {/* Meeting-ready */}
          <section>
            <p className="mb-2 flex items-center gap-2 text-[12.5px] font-bold text-ink"><Flame size={14} className="text-orange-500" /> Meeting-ready <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">{meetingReady.length}</span></p>
            <div className="space-y-2">
              {loading ? (
                [...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)
              ) : meetingReady.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line py-8 text-center text-[12.5px] text-ink-subtle">No hot leads waiting — booked ones move to the schedule.</div>
              ) : meetingReady.map((r, i) => (
                <div key={r.id} className="rounded-xl border border-line bg-surface p-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm ${TONES[i % TONES.length]}`}>{initials(`${r.lead.firstName} ${r.lead.lastName}`)}</span>
                    <button type="button" onClick={() => router.push(`/leads/${r.lead.id}`)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[13px] font-bold text-ink hover:text-brand-700">{r.lead.firstName} {r.lead.lastName} <span className="font-normal text-ink-subtle">· {r.lead.company ?? '—'}</span></p>
                      <p className="truncate text-[11.5px] text-ink-muted">“{r.body.length > 64 ? r.body.slice(0, 64) + '…' : r.body}”</p>
                    </button>
                    <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">score {r.lead.score}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10.5px] text-ink-subtle">Positive reply · ready for an intro call</span>
                    <button type="button" onClick={() => book(r)} disabled={busy.has(r.id)} className="brand-gradient inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-semibold text-white shadow-brand hover:-translate-y-0.5 transition-all disabled:opacity-60">
                      {busy.has(r.id) ? <Loader2 size={12} className="animate-spin" /> : <CalendarPlus size={12} />} Book meeting
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Schedule + outcomes */}
          <section>
            <p className="mb-2 flex items-center gap-2 text-[12.5px] font-bold text-ink"><CalendarCheck size={14} className="text-brand-600" /> Schedule & outcomes <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">{meetings.length}</span></p>
            <div className="space-y-2">
              {loading ? (
                [...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)
              ) : meetings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line py-8 text-center text-[12.5px] text-ink-subtle">No meetings yet. Book one from a hot lead on the left.</div>
              ) : [...scheduled, ...closed].map((m, i) => {
                const sm = STATUS_META[m.status];
                return (
                  <div key={m.id} className="rounded-xl border border-line bg-surface p-3 shadow-xs">
                    <div className="flex items-start gap-2.5">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm ${TONES[i % TONES.length]}`}>{initials(m.title.replace(/^Intro call · /, ''))}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-ink">{m.title.replace(/^Intro call · /, '')} <span className="font-normal text-ink-subtle">· {m.company ?? '—'}</span></p>
                        <p className="inline-flex items-center gap-1 text-[11px] text-ink-muted"><Clock size={11} /> {fmtWhen(m.scheduledAt)} · {m.durationMin}m</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${sm.tone}`}>{sm.label}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {/* M15-1: атрибуция встречи к источнику (backend) */}
                      {m.source === 'reply'
                        ? <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-sky-700"><Reply size={10} /> From reply{m.attributionMode && m.attributionMode !== 'manual' ? (m.attributionMode === 'fallback_last_outbound' ? ' · fallback' : ' · exact') : ''}</span>
                        : <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-muted">Manual</span>}
                      {m.campaignId && <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-violet-700">Campaign-attributed</span>}
                      {m.outcomeType && <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${m.outcomeType === 'QUALIFIED' ? 'bg-emerald-50 text-emerald-700' : m.outcomeType === 'NOT_QUALIFIED' ? 'bg-rose-50 text-rose-700' : m.outcomeType === 'NO_SHOW' ? 'bg-amber-50 text-amber-700' : 'bg-surface-2 text-ink-muted'}`}><ThumbsUp size={10} /> {OUTCOME_LABEL[m.outcomeType]}</span>}
                      {m.syncStatus && m.status !== 'CANCELED' && (
                        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${SYNC_META[m.syncStatus].tone}`}>
                          <CalendarClock size={10} /> {SYNC_META[m.syncStatus].label}
                          {(m.syncStatus === 'FAILED' || (m.syncStatus === 'NOT_CONNECTED' && cal?.connected)) && (
                            <button type="button" onClick={() => retrySync(m)} disabled={busy.has(m.id)} title="Retry sync" className="ml-0.5 hover:text-brand-600"><RefreshCw size={10} /></button>
                          )}
                        </span>
                      )}
                    </div>
                    {(m.status === 'SCHEDULED' || m.status === 'REQUESTED') && (
                      <div className="mt-2 flex items-center gap-1.5 border-t border-line pt-2">
                        <button type="button" onClick={() => setOutcomeFor(m)} disabled={busy.has(m.id)} className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-600 px-2 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"><CheckCircle2 size={12} /> Mark done</button>
                        <button type="button" onClick={() => applyOutcome(m, 'NO_SHOW')} disabled={busy.has(m.id)} className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[11px] font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"><CalendarX size={12} /> No-show</button>
                        <button type="button" onClick={() => applyOutcome(m, 'CANCELED')} disabled={busy.has(m.id)} className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[11px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"><XCircle size={12} /> Cancel</button>
                        {m.leadId && <button type="button" onClick={() => setHandoffFor(m.replyMessageId ? { meetingId: m.id } : { leadId: m.leadId! })} className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[11px] font-medium text-ink-muted hover:bg-surface-2">Handoff <ArrowUpRight size={11} /></button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* outcome picker */}
      {outcomeFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0f0f0e]/55 backdrop-blur-sm" onClick={() => setOutcomeFor(null)} />
          <div className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
              <span className="brand-gradient flex h-7 w-7 items-center justify-center rounded-lg text-white"><CheckCircle2 size={14} /></span>
              <h2 className="text-[14px] font-bold text-ink">Meeting outcome</h2>
            </div>
            <div className="space-y-2 p-5">
              <p className="text-[12.5px] text-ink-muted">How did the call with <span className="font-semibold text-ink">{outcomeFor.title.replace(/^Intro call · /, '')}</span> go?</p>
              {([
                { o: 'QUALIFIED' as MeetingOutcome, label: 'Qualified', hint: 'Good fit → lead converted', icon: <ThumbsUp size={13} className="text-emerald-600" /> },
                { o: 'SHOWED' as MeetingOutcome, label: 'Showed (no decision yet)', hint: 'Met — qualify later', icon: <CheckCircle2 size={13} className="text-sky-600" /> },
                { o: 'NOT_QUALIFIED' as MeetingOutcome, label: 'Not qualified', hint: 'Not a fit → lead lost', icon: <XCircle size={13} className="text-rose-600" /> },
              ]).map((x) => (
                <button key={x.o} type="button" disabled={busy.has(outcomeFor.id)} onClick={() => applyOutcome(outcomeFor, x.o)} className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-60">
                  {x.icon} <span><span className="block text-[13px] font-semibold text-ink">{x.label}</span><span className="block text-[11.5px] text-ink-subtle">{x.hint}</span></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* M15-3: handoff package drawer (доступ из Meetings) */}
      {handoffFor && <HandoffPanel params={handoffFor} onClose={() => setHandoffFor(null)} onChange={() => void load()} />}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[12.5px] font-semibold text-ink shadow-lg">
          <span className="brand-gradient flex h-6 w-6 items-center justify-center rounded-lg text-white"><CalendarCheck size={12} /></span>
          {toast}
        </div>
      )}
    </>
  );
}
