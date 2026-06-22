'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { analyticsApi, type ReportsData, type TrendsData, type SkipsData, type SendSkipReason, type DrillLead, type SavedReport } from '@/lib/api';
import Topbar from '@/components/layout/Topbar';
import { useToast } from '@/components/ui/Toast';
import {
  BarChart3,
  Send,
  MailOpen,
  Reply,
  ArrowRight,
  CalendarCheck,
  Trophy,
  Zap,
  Gauge,
  Mailbox,
  Mail,
  Linkedin,
  AlertTriangle,
  TrendingUp,
  Download,
  MailX,
  PauseCircle,
  UserX,
  CheckCircle2,
  Filter,
  Save,
  Bookmark,
  X,
  ChevronRight,
  Loader2,
  Trash2,
  Clock,
} from 'lucide-react';

const REPORT_TYPES: { key: string; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'funnel', label: 'Funnel & conversion' },
  { key: 'sequences', label: 'Sequences' },
  { key: 'replies', label: 'Replies & meetings' },
  { key: 'automation', label: 'Automation & capacity' },
];
const SECTIONS_BY_TYPE: Record<string, string[]> = {
  overview: ['trends', 'kpi', 'funnel', 'repliesMeetings', 'workflowCapacity', 'skips', 'sequences'],
  funnel: ['kpi', 'funnel', 'sequences'],
  sequences: ['trends', 'sequences'],
  replies: ['repliesMeetings', 'skips'],
  automation: ['workflowCapacity', 'skips'],
};

const SKIP_META: Record<SendSkipReason, { label: string; tone: string; icon: React.ReactNode }> = {
  NO_MAILBOX: { label: 'No sending mailbox', tone: 'bg-rose-100 text-rose-700', icon: <MailX size={12} /> },
  DAILY_LIMIT: { label: 'Daily limit reached', tone: 'bg-amber-100 text-amber-700', icon: <PauseCircle size={12} /> },
  NO_EMAIL: { label: 'Lead has no email', tone: 'bg-surface-2 text-ink-muted', icon: <UserX size={12} /> },
  NO_LINKEDIN: { label: 'Lead has no LinkedIn', tone: 'bg-surface-2 text-ink-muted', icon: <UserX size={12} /> },
  CAMPAIGN_INACTIVE: { label: 'Campaign paused', tone: 'bg-surface-2 text-ink-muted', icon: <PauseCircle size={12} /> },
  OUTSIDE_WINDOW: { label: 'Outside send window', tone: 'bg-sky-100 text-sky-700', icon: <Clock size={12} /> },
  SEND_FAILED: { label: 'Delivery failed', tone: 'bg-rose-100 text-rose-700', icon: <MailX size={12} /> },
};
function fmtAgo(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Reports (/reports) — сводная эффективность outbound-движка на ЖИВЫХ данных
   (GET /api/analytics/reports): KPI, воронка конверсии, replies по классам,
   meetings, impact последовательностей и workflow, capacity. Светлая Bold-тема.
   ────────────────────────────────────────────────────────────────────────── */

const CLASS_TONE: Record<string, string> = {
  INTERESTED: 'bg-emerald-500', NOT_INTERESTED: 'bg-rose-400', FOLLOW_UP: 'bg-amber-400', UNSUBSCRIBE: 'bg-ink-subtle',
};
const CLASS_LABEL: Record<string, string> = { INTERESTED: 'Interested', NOT_INTERESTED: 'Not interested', FOLLOW_UP: 'Follow-up', UNSUBSCRIBE: 'Unsubscribe' };
const STATUS_TONE: Record<string, string> = { ACTIVE: 'bg-emerald-100 text-emerald-700', DRAFT: 'bg-surface-2 text-ink-muted', PAUSED: 'bg-amber-100 text-amber-700', COMPLETED: 'bg-brand-100 text-brand-700' };
const TRIGGER_LABEL: Record<string, string> = { REPLY_RECEIVED: 'Reply received', MEETING_BOOKED: 'Meeting booked', SEQUENCE_COMPLETED: 'Sequence completed', LEAD_UNSUBSCRIBED: 'Unsubscribed', OPENED: 'Email opened', BOUNCED: 'Email bounced' };

function Kpi({ icon, label, value, sub, tone = 'ink' }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'ink' | 'emerald' | 'brand' | 'rose' }) {
  const valTone = tone === 'emerald' ? 'text-emerald-600' : tone === 'brand' ? 'text-brand-600' : tone === 'rose' ? 'text-rose-600' : 'text-ink';
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-xs">
      <span className="mb-1 inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">{icon} {label}</span>
      <p className={`text-[24px] font-extrabold leading-none tracking-[-0.02em] ${valTone}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-ink-subtle">{sub}</p>}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-[12.5px] font-bold text-ink">{title}</h3>
        {hint && <span className="text-[11px] text-ink-subtle">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// Лёгкий мультисерийный линейный график на чистом SVG (без recharts — у него
// на оси включались OpenType-фичи шрифта и цифры превращались в глифы). Свои
// подписи рендерим с явным fontFeatureSettings:normal.
function TrendsChart({ series }: { series: TrendsData['series'] }) {
  const W = 760, H = 180, padL = 28, padB = 18, padT = 8;
  const n = series.length;
  const max = Math.max(1, ...series.flatMap((d) => [d.sent, d.replies, d.meetings]));
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - 8));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const line = (key: 'sent' | 'replies' | 'meetings') => series.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  const area = `M${x(0).toFixed(1)},${y(series[0]?.sent ?? 0).toFixed(1)} ` + series.map((d, i) => `L${x(i).toFixed(1)},${y(d.sent).toFixed(1)}`).join(' ') + ` L${x(n - 1).toFixed(1)},${(H - padB).toFixed(1)} L${x(0).toFixed(1)},${(H - padB).toFixed(1)} Z`;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const labelEvery = Math.ceil(n / 6);

  return (
    <div style={{ fontFeatureSettings: 'normal', fontVariantNumeric: 'normal' }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 200 }}>
        {ticks.map((t, i) => {
          const yy = y(t);
          return (
            <g key={i}>
              <line x1={padL} y1={yy} x2={W} y2={yy} stroke="var(--line)" strokeWidth={1} />
              <text x={0} y={yy + 3} fontSize={9} fill="var(--ink-subtle)">{t}</text>
            </g>
          );
        })}
        <path d={area} fill="var(--brand-500)" opacity={0.08} />
        <path d={line('sent')} fill="none" stroke="var(--brand-500)" strokeWidth={2} strokeLinejoin="round" />
        <path d={line('replies')} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" />
        <path d={line('meetings')} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" />
        {series.map((d, i) => (i % labelEvery === 0 || i === n - 1) ? (
          <text key={i} x={x(i)} y={H - 5} fontSize={9} fill="var(--ink-subtle)" textAnchor="middle">{d.date}</text>
        ) : null)}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-brand-500" /> Sent</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-emerald-500" /> Replies</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-amber-500" /> Meetings</span>
      </div>
    </div>
  );
}

const PERIODS: { d: 7 | 30 | 90; label: string }[] = [{ d: 7, label: '7 days' }, { d: 30, label: '30 days' }, { d: 90, label: '90 days' }];

// Собираем многосекционный CSV-отчёт и отдаём на скачивание (реальный экспорт всех живых метрик).
function exportCsv(data: ReportsData, trends: TrendsData | null) {
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows: string[][] = [];
  rows.push(['AISDR Report', new Date().toISOString()]);
  rows.push([]);
  rows.push(['Efficiency']); rows.push(['Metric', 'Value']);
  rows.push(['Total sent', String(data.efficiency.totalSent)]);
  rows.push(['Open rate %', String(data.efficiency.openRate)]);
  rows.push(['Reply rate %', String(data.efficiency.replyRate)]);
  rows.push(['Meeting rate %', String(data.efficiency.meetingRate)]);
  rows.push(['Conversion %', String(data.efficiency.conversionRate)]);
  rows.push([]);
  rows.push(['Auto-response']); rows.push(['Metric', 'Value']);
  rows.push(['Autopilot enabled', data.autoResponse.enabled ? 'on' : 'off']);
  rows.push(['Auto-sent', String(data.autoResponse.autoSent)]);
  rows.push(['Human-approved', String(data.autoResponse.humanApproved)]);
  rows.push(['Handoff', String(data.autoResponse.handoff)]);
  rows.push(['Suppressed', String(data.autoResponse.suppressed)]);
  rows.push(['Failed auto-send', String(data.autoResponse.failedAutoSend)]);
  rows.push([]);
  rows.push(['Conversion funnel']); rows.push(['Stage', 'Value']);
  data.funnel.forEach((f) => rows.push([f.stage, String(f.value)]));
  rows.push([]);
  rows.push(['Meetings by source']); rows.push(['Source', 'Count']);
  rows.push(['reply-attributed', String(data.meetings.bySource.reply)]); rows.push(['manual', String(data.meetings.bySource.manual)]); rows.push(['call', String(data.meetings.bySource.call)]);
  rows.push([]);
  rows.push(['Meeting outcomes']); rows.push(['Outcome', 'Count']);
  rows.push(['scheduled', String(data.meetings.outcomes.scheduled)]); rows.push(['showed', String(data.meetings.outcomes.showed)]); rows.push(['qualified', String(data.meetings.outcomes.qualified)]); rows.push(['not_qualified', String(data.meetings.outcomes.not_qualified)]); rows.push(['no_show', String(data.meetings.outcomes.no_show)]); rows.push(['canceled', String(data.meetings.outcomes.canceled)]);
  rows.push([]);
  rows.push(['Handoff conversion']); rows.push(['Stage', 'Count']);
  rows.push(['open', String(data.handoff.open)]); rows.push(['assigned', String(data.handoff.assigned)]); rows.push(['handed_off', String(data.handoff.handed_off)]); rows.push(['meeting_scheduled', String(data.handoff.meeting_scheduled)]); rows.push(['qualified', String(data.handoff.qualified)]); rows.push(['handoff_to_meeting_rate_%', String(data.handoff.handoffToMeetingRate)]);
  rows.push([]);
  rows.push(['Sequence impact']); rows.push(['Sequence', 'Status', 'Enrolled', 'Sent', 'Replied', 'Completed', 'Converted', 'Reply rate %', 'Meetings', 'Qualified']);
  data.sequenceImpact.forEach((s) => rows.push([s.name, s.status, String(s.enrolled), String(s.sent), String(s.replied), String(s.completed), String(s.converted), String(s.replyRate), String(s.meetings), String(s.qualifiedMeetings)]));
  if (trends) {
    rows.push([]);
    rows.push([`Trends (last ${trends.days} days)`]); rows.push(['Date', 'Sent', 'Replies', 'Meetings']);
    trends.series.forEach((p) => rows.push([p.iso, String(p.sent), String(p.replies), String(p.meetings)]));
  }
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `aisdr-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ReportsPage() {
  const toast = useToast();
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [skips, setSkips] = useState<SkipsData | null>(null);
  // report type / filters / saved
  const [reportType, setReportType] = useState('overview');
  const [campaign, setCampaign] = useState<string>(''); // '' = all campaigns
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [drillStage, setDrillStage] = useState<string | null>(null);

  // reports перезагружаются при смене фильтра кампании
  useEffect(() => { setLoading(true); analyticsApi.reports(campaign || undefined).then(setData).catch(() => {}).finally(() => setLoading(false)); }, [campaign]);
  useEffect(() => { analyticsApi.skips(7).then(setSkips).catch(() => setSkips(null)); }, []);
  useEffect(() => { analyticsApi.savedList().then((r) => setSaved(r.reports)).catch(() => {}); }, []);
  useEffect(() => {
    setTrendsLoading(true);
    analyticsApi.trends(period).then(setTrends).catch(() => setTrends(null)).finally(() => setTrendsLoading(false));
  }, [period]);

  const show = (s: string) => SECTIONS_BY_TYPE[reportType]?.includes(s);
  const funnelMax = data ? Math.max(1, ...data.funnel.map((f) => f.value)) : 1;
  const repliesTotal = data ? Object.values(data.repliesByClass).reduce((s, n) => s + n, 0) : 0;
  const campaignName = data?.availableCampaigns.find((c) => c.id === campaign)?.name ?? null;

  async function saveCurrent() {
    const name = window.prompt('Name this report view:', `${REPORT_TYPES.find((t) => t.key === reportType)?.label}${campaignName ? ` · ${campaignName}` : ''}`);
    if (!name) return;
    try {
      const r = await analyticsApi.savedCreate(name, reportType, { campaign: campaign || null, period });
      setSaved((p) => [r.report, ...p]);
      toast.success('Report saved', name);
    } catch { toast.error('Could not save report'); }
  }
  function applySaved(r: SavedReport) {
    setReportType(r.reportType);
    setCampaign(r.filters?.campaign ?? '');
    if (r.filters?.period === 7 || r.filters?.period === 30 || r.filters?.period === 90) setPeriod(r.filters.period);
    setSavedOpen(false);
  }
  async function deleteSaved(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try { await analyticsApi.savedDelete(id); setSaved((p) => p.filter((x) => x.id !== id)); }
    catch { toast.error('Could not delete'); }
  }

  return (
    <>
      <Topbar title="Reports" subtitle="Intelligence · outbound performance" icon={<BarChart3 size={18} strokeWidth={1.85} />} />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading || !data ? (
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
            <div className="skeleton h-56 rounded-xl" /><div className="skeleton h-64 rounded-xl" />
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-4">
            {/* report types */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-line pb-2">
              {REPORT_TYPES.map((t) => (
                <button key={t.key} type="button" onClick={() => setReportType(t.key)}
                  className={['rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors', reportType === t.key ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200' : 'text-ink-muted hover:bg-surface-2'].join(' ')}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* control bar: campaign filter + trend window + saved + save + export */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 shadow-xs">
                <Filter size={13} className="text-ink-subtle" />
                <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className="bg-transparent text-[12.5px] font-semibold text-ink outline-none">
                  <option value="">All campaigns</option>
                  {data.availableCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {campaign && <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">scoped · {data.filters.scopedLeads ?? 0} leads<button type="button" onClick={() => setCampaign('')} className="hover:text-brand-900"><X size={11} /></button></span>}

              <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">Trend</span>
              <div className="flex gap-1">
                {PERIODS.map((p) => (
                  <button key={p.d} type="button" onClick={() => setPeriod(p.d)}
                    className={['rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors', period === p.d ? 'bg-brand-600 text-white shadow-brand' : 'bg-surface-2 text-ink-muted hover:bg-surface-2/70'].join(' ')}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="relative ml-auto">
                <button type="button" onClick={() => setSavedOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink-muted shadow-xs transition-colors hover:bg-surface-2 hover:text-brand-600">
                  <Bookmark size={13} /> Saved {saved.length > 0 && <span className="rounded-full bg-surface-2 px-1 text-[10px]">{saved.length}</span>}
                </button>
                {savedOpen && (
                  <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                    {saved.length === 0 ? <p className="px-2 py-2 text-[11.5px] text-ink-subtle">No saved reports yet. Configure a view and click Save.</p> : saved.map((r) => (
                      <button key={r.id} type="button" onClick={() => applySaved(r)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2">
                        <Bookmark size={12} className="shrink-0 text-brand-500" />
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">{r.name}</span>
                        <span className="shrink-0 rounded bg-surface-2 px-1 text-[9.5px] font-bold uppercase text-ink-subtle">{r.reportType}</span>
                        <span role="button" tabIndex={0} onClick={(e) => deleteSaved(r.id, e)} className="shrink-0 text-ink-subtle hover:text-rose-600"><Trash2 size={12} /></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={saveCurrent} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink-muted shadow-xs transition-colors hover:bg-surface-2 hover:text-brand-600"><Save size={13} /> Save view</button>
              <button type="button" onClick={() => exportCsv(data, trends)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink-muted shadow-xs transition-colors hover:bg-surface-2 hover:text-brand-600">
                <Download size={13} /> Export CSV
              </button>
            </div>

            {/* trends over time */}
            {show('trends') && (
            <Section title="Trends over time" hint={`— last ${period} days · ${trends?.totals.sent ?? 0} sent · ${trends?.totals.replies ?? 0} replies · ${trends?.totals.meetings ?? 0} meetings`}>
              {trendsLoading ? (
                <div className="skeleton h-52 rounded-lg" />
              ) : trends && trends.series.some((s) => s.sent || s.replies || s.meetings) ? (
                <TrendsChart series={trends.series} />
              ) : (
                <div className="flex flex-col items-center gap-1.5 py-10 text-ink-subtle">
                  <TrendingUp size={20} />
                  <p className="text-[12.5px]">No outbound activity in the last {period} days yet.</p>
                </div>
              )}
            </Section>
            )}

            {/* KPI row */}
            {show('kpi') && (
            <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi icon={<Send size={12} />} label="Sent" value={data.efficiency.totalSent.toLocaleString()} sub={`${data.efficiency.sentToday} today`} />
              <Kpi icon={<MailOpen size={12} />} label="Open rate" value={`${data.efficiency.openRate}%`} sub={`${data.efficiency.totalOpened} opens`} />
              <Kpi icon={<Reply size={12} />} label="Reply rate" value={`${data.efficiency.replyRate}%`} sub={`${data.efficiency.totalReplies} replies`} tone="emerald" />
              <Kpi icon={<MailX size={12} />} label="Bounce rate" value={`${data.efficiency.bounceRate}%`} sub={`${data.efficiency.totalBounced} bounced`} tone="rose" />
              <Kpi icon={<CalendarCheck size={12} />} label="Meeting rate" value={`${data.efficiency.meetingRate}%`} sub="of replies" />
              <Kpi icon={<Trophy size={12} />} label="Conversion" value={`${data.efficiency.conversionRate}%`} sub="of contacted" tone="brand" />
            </div>
            {/* M13-5: качество атрибуции ответов — точная (по заголовкам треда) vs degraded fallback. */}
            {data.replyAttribution.total > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-semibold uppercase tracking-wide text-ink-subtle">Reply attribution</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700"><Reply size={10} /> {data.replyAttribution.exact} exact (thread headers)</span>
                {data.replyAttribution.fallbackAttributed > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-700"><Clock size={10} /> {data.replyAttribution.fallbackAttributed} fallback (last-outbound)</span>}
              </div>
            )}
            {/* M14-5: авто-ответ — auto-sent / human-approved / handoff / suppressed / failed (backend-computed). */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-semibold uppercase tracking-wide text-ink-subtle">Auto-response</span>
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold ${data.autoResponse.enabled ? 'bg-brand-50 text-brand-700' : 'bg-surface-2 text-ink-muted'}`}>{data.autoResponse.enabled ? `autopilot on · min ${Math.round(data.autoResponse.minConfidence * 100)}%` : 'autopilot off'}</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">{data.autoResponse.autoSent} auto-sent</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">{data.autoResponse.humanApproved} human-approved</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">{data.autoResponse.handoff} handoff</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 font-semibold text-ink-muted">{data.autoResponse.suppressed} suppressed</span>
              {data.autoResponse.failedAutoSend > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">{data.autoResponse.failedAutoSend} failed auto-send</span>}
            </div>
            </>
            )}

            {/* funnel — строки кликабельны → drilldown в реальные лиды */}
            {show('funnel') && (
            <Section title="Conversion funnel" hint="— click any stage to drill into the leads behind it">
              <div className="space-y-2">
                {data.funnel.map((f, i) => {
                  const pct = Math.round((f.value / funnelMax) * 100);
                  const conv = i > 0 && data.funnel[i - 1].value > 0 ? Math.round((f.value / data.funnel[i - 1].value) * 100) : null;
                  return (
                    <button key={f.stage} type="button" onClick={() => setDrillStage(f.stage)} className="flex w-full items-center gap-3 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-surface-2/60">
                      <span className="flex w-20 shrink-0 items-center gap-0.5 text-[12px] font-semibold text-ink-muted">{f.stage}<ChevronRight size={11} className="text-ink-subtle" /></span>
                      <div className="h-7 flex-1 overflow-hidden rounded-lg bg-surface-2">
                        <div className="flex h-full items-center rounded-lg bg-gradient-to-r from-brand-500 to-brand-400 px-2" style={{ width: `${Math.max(pct, 6)}%` }}>
                          <span className="text-[11px] font-bold text-white">{f.value}</span>
                        </div>
                      </div>
                      <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-ink-subtle">{conv !== null ? `${conv}%` : '—'}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
            )}

            {/* replies + meetings */}
            {show('repliesMeetings') && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Section title="Replies by class" hint={`— ${repliesTotal} classified`}>
                {repliesTotal === 0 ? <p className="py-6 text-center text-[12px] text-ink-subtle">No classified replies yet.</p> : (
                  <div className="space-y-2.5">
                    {Object.entries(data.repliesByClass).sort((a, b) => b[1] - a[1]).map(([cls, n]) => {
                      const pct = Math.round((n / repliesTotal) * 100);
                      return (
                        <div key={cls}>
                          <div className="mb-0.5 flex items-center justify-between text-[12px]"><span className="font-semibold text-ink">{CLASS_LABEL[cls] ?? cls}</span><span className="tabular-nums text-ink-subtle">{n} · {pct}%</span></div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full ${CLASS_TONE[cls] ?? 'bg-brand-500'}`} style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              <Section title="Meetings" hint={`— ${data.meetings.showRate}% completed`}>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-surface-2/50 px-3 py-2"><p className="text-[10px] font-semibold uppercase text-ink-subtle">Total</p><p className="text-[18px] font-extrabold text-ink">{data.meetings.total}</p></div>
                  <div className="rounded-lg bg-surface-2/50 px-3 py-2"><p className="text-[10px] font-semibold uppercase text-ink-subtle">Completed</p><p className="text-[18px] font-extrabold text-emerald-600">{data.meetings.completed}</p></div>
                  <div className="rounded-lg bg-surface-2/50 px-3 py-2"><p className="text-[10px] font-semibold uppercase text-ink-subtle">Show rate</p><p className="text-[18px] font-extrabold text-ink">{data.meetings.showRate}%</p></div>
                </div>
                {/* M15-5: source split (reply-attributed / manual / call) — НЕ смешиваются с AI-SDR handoff-конверсией. */}
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-subtle">By source</p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">reply-attributed · {data.meetings.bySource.reply}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">manual · {data.meetings.bySource.manual}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">call · {data.meetings.bySource.call}</span>
                </div>
                {/* M15-4/M15-5: outcome split (typed) */}
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Outcomes</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">scheduled · {data.meetings.outcomes.scheduled}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">showed · {data.meetings.outcomes.showed}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">qualified · {data.meetings.outcomes.qualified}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">not qualified · {data.meetings.outcomes.not_qualified}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">no-show · {data.meetings.outcomes.no_show}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">canceled · {data.meetings.outcomes.canceled}</span>
                </div>
              </Section>
            </div>
            )}

            {/* M15-5: Handoff conversion chain — open → assigned → handed_off → meeting_scheduled → qualified */}
            {show('repliesMeetings') && (
            <Section title="Handoff conversion" hint={`— ${data.handoff.handoffToMeetingRate}% handoff → meeting · from linked HandoffPackage/Meeting`}>
              <div className="flex flex-wrap items-stretch gap-2">
                {([
                  { k: 'Open', v: data.handoff.open, tone: 'text-ink' },
                  { k: 'Assigned', v: data.handoff.assigned, tone: 'text-sky-600' },
                  { k: 'Handed off', v: data.handoff.handed_off, tone: 'text-violet-600' },
                  { k: 'Meeting scheduled', v: data.handoff.meeting_scheduled, tone: 'text-brand-600' },
                  { k: 'Qualified', v: data.handoff.qualified, tone: 'text-emerald-600' },
                ]).map((s, i) => (
                  <div key={s.k} className="flex items-center gap-2">
                    <div className="min-w-[92px] rounded-lg bg-surface-2/50 px-3 py-2 text-center">
                      <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-subtle">{s.k}</p>
                      <p className={`text-[18px] font-extrabold ${s.tone}`}>{s.v}</p>
                    </div>
                    {i < 4 && <ArrowRight size={14} className="text-ink-subtle" />}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-subtle">Reply-attributed handoffs only — manual / call meetings are not mixed into this AI-SDR conversion chain.</p>
            </Section>
            )}

            {/* workflow impact + capacity */}
            {show('workflowCapacity') && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Section title="Workflow impact" hint="— automation that ran on its own">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-surface-2/50 px-3 py-2"><p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-ink-subtle"><Zap size={10} /> Runs</p><p className="text-[18px] font-extrabold text-ink">{data.workflowImpact.totalRuns}</p></div>
                  <div className="rounded-lg bg-surface-2/50 px-3 py-2"><p className="text-[10px] font-semibold uppercase text-ink-subtle">Active</p><p className="text-[18px] font-extrabold text-ink">{data.workflowImpact.activeRules}/{data.workflowImpact.totalRules}</p></div>
                  <div className="rounded-lg bg-surface-2/50 px-3 py-2"><p className="text-[10px] font-semibold uppercase text-ink-subtle">Triggers</p><p className="text-[18px] font-extrabold text-ink">{Object.keys(data.workflowImpact.byTrigger).length}</p></div>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {Object.entries(data.workflowImpact.byTrigger).map(([t, n]) => <span key={t} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{TRIGGER_LABEL[t] ?? t} · {n}</span>)}
                  {Object.keys(data.workflowImpact.byTrigger).length === 0 && <span className="text-[12px] text-ink-subtle">No automation runs yet.</span>}
                </div>
              </Section>

              <Section title="Sending capacity" hint="— deliverability headroom today">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-surface-2/50 px-3 py-2"><p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-ink-subtle"><Gauge size={10} /> Capacity</p><p className="text-[18px] font-extrabold text-ink">{data.capacity.dailyCapacity}</p></div>
                  <div className="rounded-lg bg-surface-2/50 px-3 py-2"><p className="text-[10px] font-semibold uppercase text-ink-subtle">Used</p><p className="text-[18px] font-extrabold text-ink">{data.capacity.usedToday}</p></div>
                  <div className="rounded-lg bg-surface-2/50 px-3 py-2"><p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-ink-subtle"><Mailbox size={10} /> Mailboxes</p><p className="text-[18px] font-extrabold text-ink">{data.capacity.mailboxes}/{data.capacity.totalMailboxes}</p></div>
                </div>
                <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand-500" style={{ width: `${data.capacity.dailyCapacity ? Math.round((data.capacity.usedToday / data.capacity.dailyCapacity) * 100) : 0}%` }} /></div>
                <p className="mt-1.5 text-[11px] text-ink-subtle">{data.capacity.remaining} sends remaining today across connected mailboxes.</p>

                {/* M12-5: разбивка по ящикам (used/limit, warmup-aware) — данные совпадают с движком отправки. */}
                {data.capacity.perMailbox.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">Per mailbox</p>
                    {data.capacity.perMailbox.map((m) => {
                      const pct = m.effectiveLimit ? Math.round((m.usedToday / m.effectiveLimit) * 100) : 0;
                      return (
                        <div key={m.id} className="flex items-center gap-2 text-[11.5px]">
                          <span className="w-40 shrink-0 truncate text-ink" title={m.address}>{m.address}</span>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase ${m.status === 'CONNECTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{m.status === 'WARMING' ? `warming d${m.warmupDay}` : 'connected'}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-rose-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                          <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-ink-muted">{m.usedToday}/{m.effectiveLimit}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* M12-4/5: разделяем «требует внимания» (terminal failed) и «ждёт ретрая» (temporary). */}
                {(data.capacity.failedTerminal > 0 || data.capacity.retriesScheduled > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {data.capacity.failedTerminal > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700"><MailX size={11} /> {data.capacity.failedTerminal} failed · needs attention</span>}
                    {data.capacity.retriesScheduled > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700"><Clock size={11} /> {data.capacity.retriesScheduled} retry scheduled</span>}
                  </div>
                )}
              </Section>
            </div>
            )}

            {/* skipped sends — почему агент не отправил */}
            {show('skips') && (
            <Section title="Skipped sends" hint={`— why the agent held back · last ${skips?.days ?? 7} days`}>
              {skips && skips.heldNow > 0 && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2.5">
                  <MailX size={15} className="mt-0.5 shrink-0 text-rose-600" />
                  <p className="text-[12.5px] text-rose-800">
                    <span className="font-bold">{skips.heldNow} lead{skips.heldNow === 1 ? '' : 's'} held right now</span> — no connected sending mailbox.{' '}
                    <a href="/settings" className="font-semibold underline hover:text-rose-900">Connect a mailbox</a> to resume sending.
                  </p>
                </div>
              )}
              {!skips ? (
                <div className="skeleton h-20 rounded-lg" />
              ) : skips.total === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-8 text-ink-subtle">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  <p className="text-[12.5px]">No skipped sends in the last {skips.days} days — the agent sent everything it tried.</p>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {Object.entries(skips.reasons).sort((a, b) => b[1] - a[1]).map(([r, n]) => {
                      const m = SKIP_META[r as SendSkipReason];
                      return <span key={r} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${m?.tone ?? 'bg-surface-2 text-ink-muted'}`}>{m?.icon} {m?.label ?? r} · {n}</span>;
                    })}
                  </div>
                  <ul className="divide-y divide-line/60">
                    {skips.recent.map((s) => {
                      const m = SKIP_META[s.reason];
                      return (
                        <li key={s.id} className="flex items-start gap-2.5 py-2">
                          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${m?.tone ?? 'bg-surface-2 text-ink-muted'}`}>{m?.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] text-ink"><span className="font-semibold">{m?.label ?? s.reason}</span>{s.detail ? <span className="text-ink-muted"> — {s.detail}</span> : null}</p>
                            <p className="text-[11px] text-ink-subtle">{[s.leadName, s.campaignName].filter(Boolean).join(' · ') || 'agent'} · {fmtAgo(s.at)}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 text-[11px] text-ink-subtle">Live from the sending worker — every hold/skip is recorded so you always know why the agent paused.</p>
                </>
              )}
            </Section>
            )}

            {/* sequence impact table */}
            {show('sequences') && (
            <Section title="Sequence impact" hint="— per campaign · Completed = finished all steps · Converted = lead converted (same as funnel)">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">
                      <th className="py-2 pr-3">Sequence</th><th className="px-2 text-right">Enrolled</th><th className="px-2 text-right">Sent</th><th className="px-2 text-right">Replied</th><th className="px-2 text-right" title="Finished all steps">Completed</th><th className="px-2 text-right" title="Lead status = Converted (same as funnel)">Converted</th><th className="px-2 text-right">Reply rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sequenceImpact.map((s) => (
                      <tr key={s.id} className="border-b border-line/60 last:border-0">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-brand-600">{s.channel === 'LINKEDIN' ? <Linkedin size={12} /> : <Mail size={12} />}</span>
                            <span className="font-semibold text-ink">{s.name}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${STATUS_TONE[s.status] ?? 'bg-surface-2 text-ink-muted'}`}>{s.status}</span>
                          </div>
                        </td>
                        <td className="px-2 text-right tabular-nums text-ink">{s.enrolled}</td>
                        <td className="px-2 text-right tabular-nums text-ink">{s.sent}</td>
                        <td className="px-2 text-right tabular-nums text-ink">{s.replied}</td>
                        <td className="px-2 text-right tabular-nums text-ink-muted">{s.completed}</td>
                        <td className="px-2 text-right tabular-nums font-semibold text-emerald-600">{s.converted}</td>
                        <td className="px-2 text-right tabular-nums text-ink">{s.replyRate}%</td>
                      </tr>
                    ))}
                    {data.sequenceImpact.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-ink-subtle">No campaigns yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Section>
            )}

            <p className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[12px] text-amber-800">
              <AlertTriangle size={14} className="shrink-0 text-amber-600" /> {data.demoNote}
              {campaignName && <span className="ml-1">· Workflow & capacity are workspace-level; funnel, KPIs, replies and meetings are scoped to <b>{campaignName}</b>.</span>}
            </p>
          </div>
        )}
      </div>

      {drillStage && <DrillModal stage={drillStage} campaign={campaign || undefined} onClose={() => setDrillStage(null)} />}
    </>
  );
}

/* ══════════════════ Drilldown: реальные лиды за метрикой воронки ══════════════════ */
function DrillModal({ stage, campaign, onClose }: { stage: string; campaign?: string; onClose: () => void }) {
  const [leads, setLeads] = useState<DrillLead[] | null>(null);
  const [total, setTotal] = useState(0);
  useEffect(() => { analyticsApi.drill(stage, campaign).then((r) => { setLeads(r.leads); setTotal(r.total); }).catch(() => setLeads([])); }, [stage, campaign]);
  const STATUS_COLOR: Record<string, string> = { NEW: 'bg-surface-2 text-ink-muted', CONTACTED: 'bg-sky-100 text-sky-700', REPLIED: 'bg-violet-100 text-violet-700', HOT: 'bg-rose-100 text-rose-700', CONVERTED: 'bg-emerald-100 text-emerald-700', LOST: 'bg-surface-2 text-ink-subtle', UNSUBSCRIBED: 'bg-surface-2 text-ink-subtle' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h3 className="text-[14px] font-extrabold text-ink">Funnel · {stage}</h3>
            <p className="text-[11.5px] text-ink-subtle">{leads === null ? 'Loading…' : `${total} lead${total === 1 ? '' : 's'} behind this stage`}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-ink-subtle hover:bg-surface-2"><X size={16} /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {leads === null ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-ink-subtle"><Loader2 size={14} className="animate-spin" /> Loading leads…</div>
          ) : leads.length === 0 ? (
            <p className="py-10 text-center text-[12.5px] text-ink-subtle">No leads in this stage.</p>
          ) : leads.map((l) => (
            <Link key={l.id} href={l.href} className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-surface-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand-700">{l.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-ink">{l.name}</p>
                <p className="truncate text-[11px] text-ink-subtle">{[l.title, l.company].filter(Boolean).join(' · ') || '—'}</p>
              </div>
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink-muted">{l.score}</span>
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${STATUS_COLOR[l.status] ?? 'bg-surface-2 text-ink-muted'}`}>{l.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
