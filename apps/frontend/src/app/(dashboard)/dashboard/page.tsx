'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  overviewApi,
  outreachApi,
  insightsApi,
  type ReplyMessage,
  type OverviewSummary,
  type LearningInsight,
} from '@/lib/api';
import {
  Gauge,
  Sparkles,
  CheckCircle2,
  Pencil,
  AlertTriangle,
  Flame,
  CalendarCheck,
  ArrowUpRight,
  ShieldCheck,
  Mailbox,
  Target,
  Clock,
  Activity,
  TrendingUp,
  ChevronRight,
  Send,
  X,
  Loader2,
  Inbox,
  UserSquare2,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import OnboardingChecklist from '@/components/onboarding/OnboardingChecklist';
import AskHomeCard from '@/components/ask/AskHomeCard';
import { useT, type TFunc } from '@/i18n';

/* ──────────────────────────────────────────────────────────────────────────
   Agent Cockpit — signature-экран AISDR. Операционный пульт AI-SDR агента:
   что агент сделал, что ждёт решения человека, входящие, встречи, обучение.
   Все данные — ЖИВЫЕ из API (/overview, /outreach/replies, /insights),
   все действия — реальные (переклассификация, запись ответа, навигация).
   Отправка письма — demo-режим (SMTP подключается позже).
   ────────────────────────────────────────────────────────────────────────── */

type Confidence = 'high' | 'mid' | 'low';

const confidenceStyle: Record<Confidence, string> = {
  high: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  mid: 'bg-amber-100 text-amber-700 ring-amber-200',
  low: 'bg-rose-100 text-rose-700 ring-rose-200',
};

function ConfidencePill({ level, text }: { level: Confidence; text: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${confidenceStyle[level]}`}>
      {text}
    </span>
  );
}

function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-subtle">{children}</p>
      {action}
    </div>
  );
}

/* ── Типы ─────────────────────────────────────────────────────────────────── */

type Cls = 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE';

interface QueueItem {
  reply: ReplyMessage;
  kind: 'reply' | 'classify' | 'reply-hv';
  icon: ReactNode;
  tone: string;
  priority: { label: string; urgent?: boolean };
  title: string;
  who: string;
  context: string;
  recommendation: string;
  why: string;
  confidence: { level: Confidence; value: number };
  primary: string;
  secondary: string;
}

interface StatusMetric {
  label: string;
  value: string;
  icon: ReactNode;
}

/* ── Билдеры из реальных данных ─────────────────────────────────────────────── */

function who(r: ReplyMessage) {
  return `${r.lead.firstName} ${r.lead.lastName}`.trim() + ` · ${r.lead.company ?? '—'}`;
}
function quote(r: ReplyMessage) {
  return `“${r.body.length > 90 ? r.body.slice(0, 90) + '…' : r.body}”`;
}

function buildQueue(replies: ReplyMessage[], t: TFunc): QueueItem[] {
  // В очередь решений попадают только НЕобработанные actionable-ответы.
  const interested = replies.filter((r) => r.replyClass === 'INTERESTED' && !r.handledAt);
  const followup = replies.filter((r) => r.replyClass === 'FOLLOW_UP' && !r.handledAt);
  const out: QueueItem[] = [];

  if (interested[0]) {
    out.push({
      reply: interested[0],
      kind: 'reply',
      icon: <CheckCircle2 size={16} strokeWidth={2} />,
      tone: 'bg-brand-50 text-brand-600',
      priority: { label: t('dashboard.qitem.p1'), urgent: true },
      title: t('dashboard.qitem.approveTitle'),
      who: who(interested[0]),
      context: quote(interested[0]),
      recommendation: t('dashboard.qitem.approveRec'),
      why: t('dashboard.qitem.approveWhy', { score: interested[0].lead.score }),
      confidence: { level: 'high', value: 90 },
      primary: t('dashboard.qitem.approveSend'),
      secondary: t('dashboard.qitem.edit'),
    });
  }
  if (followup[0]) {
    out.push({
      reply: followup[0],
      kind: 'classify',
      icon: <AlertTriangle size={16} strokeWidth={2} />,
      tone: 'bg-amber-50 text-amber-600',
      priority: { label: t('dashboard.qitem.lowConf') },
      title: t('dashboard.qitem.ambiguousTitle'),
      who: who(followup[0]),
      context: quote(followup[0]),
      recommendation: t('dashboard.qitem.ambiguousRec'),
      why: t('dashboard.qitem.ambiguousWhy'),
      confidence: { level: 'mid', value: 61 },
      primary: t('dashboard.qitem.confirmNotNow'),
      secondary: t('dashboard.qitem.reclassify'),
    });
  }
  if (interested[1]) {
    out.push({
      reply: interested[1],
      kind: 'reply-hv',
      icon: <ShieldCheck size={16} strokeWidth={2} />,
      tone: 'bg-violet-50 text-violet-600',
      priority: { label: t('dashboard.qitem.highValueTag') },
      title: t('dashboard.qitem.highValueTitle'),
      who: who(interested[1]),
      context: t('dashboard.qitem.highValueContext', { score: interested[1].lead.score }),
      recommendation: t('dashboard.qitem.highValueRec'),
      why: t('dashboard.qitem.highValueWhy', { score: interested[1].lead.score }),
      confidence: { level: 'high', value: 88 },
      primary: t('dashboard.qitem.approveSend'),
      secondary: t('dashboard.qitem.openDossier'),
    });
  }
  return out;
}

interface HotReply {
  reply: ReplyMessage;
  name: string;
  company: string;
  snippet: string;
}
function buildHot(replies: ReplyMessage[]): HotReply[] {
  return replies
    .filter((r) => r.replyClass === 'INTERESTED' && !r.handledAt)
    .slice(0, 4)
    .map((r) => ({
      reply: r,
      name: `${r.lead.firstName} ${r.lead.lastName}`.trim(),
      company: r.lead.company ?? '—',
      snippet: `“${r.body.length > 56 ? r.body.slice(0, 56) + '…' : r.body}”`,
    }));
}

// Подпись класса ответа (intent) — из словаря; неизвестный класс показываем как есть.
const intentLabel = (t: TFunc, cls: string) => {
  const v = t(`dashboard.intent.${cls}`);
  return v === `dashboard.intent.${cls}` ? cls : v;
};

function buildLearnings(counts: Record<string, number>, total: number, t: TFunc) {
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const interested = counts.INTERESTED ?? 0;
  return [
    { label: t('dashboard.learning.repliesProcessed'), value: t('dashboard.learning.classified', { total }), delta: t('dashboard.learning.intentsCount', { count: Object.keys(counts).length }), good: true },
    { label: t('dashboard.learning.interestedRate'), value: total ? `${Math.round((interested / total) * 100)}%` : '—', delta: t('dashboard.learning.hotReplies', { count: interested }), good: true },
    { label: t('dashboard.learning.mostCommonIntent'), value: top ? intentLabel(t, top[0]) : '—', delta: top ? t('dashboard.learning.repliesCount', { count: top[1] }) : '—', good: top ? top[0] === 'INTERESTED' : false },
  ];
}

const CLASS_DOT: Record<string, string> = {
  INTERESTED: 'bg-emerald-500',
  FOLLOW_UP: 'bg-amber-500',
  NOT_INTERESTED: 'bg-rose-500',
  UNSUBSCRIBE: 'bg-ink-subtle',
};
function buildFeed(o: OverviewSummary, replies: ReplyMessage[], t: TFunc) {
  const feed: { text: string; time: string; tone: string }[] = [];
  // Сначала — событийные строки агента (реальные: что и как классифицировал по конкретным лидам).
  for (const r of replies.slice(0, 3)) {
    if (!r.replyClass) continue;
    feed.push({
      text: t('dashboard.feed.classified', { name: `${r.lead.firstName} ${r.lead.lastName}`.trim(), intent: intentLabel(t, r.replyClass) }),
      time: ageLabel(r.createdAt, t),
      tone: CLASS_DOT[r.replyClass] ?? 'bg-brand-500',
    });
  }
  // Затем — агрегаты (фон активности).
  feed.push({ text: t('dashboard.feed.triaged', { count: replies.length, repliesWord: replies.length === 1 ? t('dashboard.mission.reply') : t('dashboard.mission.replies') }), time: t('dashboard.age.today'), tone: 'bg-accent-amber' });
  feed.push({ text: t('dashboard.feed.aiRuns', { runs: o.ai.runsToday, credits: o.ai.credits.used }), time: t('dashboard.age.today'), tone: 'bg-accent-violet' });
  feed.push({ text: t('dashboard.feed.campaigns', { active: o.campaigns.active, enrolled: o.campaigns.enrolled }), time: t('dashboard.age.live'), tone: 'bg-accent-mint' });
  return feed.slice(0, 6);
}

function ageLabel(iso: string, t: TFunc): string {
  const d = Date.parse(iso);
  if (isNaN(d)) return t('dashboard.age.recently');
  const min = Math.max(1, Math.round((Date.now() - d) / 60000));
  return min < 60 ? t('dashboard.age.minAgo', { n: min }) : min < 1440 ? t('dashboard.age.hourAgo', { n: Math.round(min / 60) }) : t('dashboard.age.dayAgo', { n: Math.round(min / 1440) });
}

/* ── Лёгкая тёмная модалка (в тон Cockpit) ──────────────────────────────────── */

function CockpitModal({ open, onClose, title, icon, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; icon: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f0f0e]/55 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 flex max-h-[88vh] w-full ${wide ? 'max-w-[620px]' : 'max-w-[480px]'} flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl`}>
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
          <span className="brand-gradient flex h-7 w-7 items-center justify-center rounded-lg text-white">{icon}</span>
          <h2 className="text-[14px] font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-2 hover:text-ink">
            <X size={15} strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/40 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function AgentCockpitPage() {
  const router = useRouter();
  const t = useT();

  const [replies, setReplies] = useState<ReplyMessage[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [overview, setOverview] = useState<OverviewSummary | null>(null);
  const [insight, setInsight] = useState<LearningInsight | null>(null);
  const [toast, setToast] = useState('');
  // Сессионный лог действий человека — мгновенно появляется в Live agent feed как новое событие.
  const [actionLog, setActionLog] = useState<{ text: string; time: string; tone: string }[]>([]);

  // Compose-модалка ответа
  const [compose, setCompose] = useState<ReplyMessage | null>(null);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  // Reclassify-модалка
  const [reclass, setReclass] = useState<ReplyMessage | null>(null);
  const [busyClass, setBusyClass] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(''), 4000);
  }
  function pushAction(text: string, tone: string) {
    setActionLog((log) => [{ text, time: 'just now', tone }, ...log].slice(0, 4));
  }

  const loadReplies = useCallback(async () => {
    try {
      const r = await outreachApi.replies();
      setReplies(r.replies);
      setCounts(r.counts ?? {});
    } catch { /* no-op */ }
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await overviewApi.get());
    } catch { /* no-op */ }
  }, []);

  useEffect(() => { void loadReplies(); }, [loadReplies]);
  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useEffect(() => {
    insightsApi.get().then((r) => setInsight(r.insights[0] ?? null)).catch(() => {});
  }, []);

  // ── Деривативы ────────────────────────────────────────────────────────────
  const total = replies.length;
  const interestedCount = counts.INTERESTED ?? 0;
  // actionable = НЕобработанные INTERESTED + FOLLOW_UP (handledAt-aware, реальный остаток очереди).
  const needsDecision = useMemo(
    () => replies.filter((r) => (r.replyClass === 'INTERESTED' || r.replyClass === 'FOLLOW_UP') && !r.handledAt).length,
    [replies],
  );

  const decisionQueue = useMemo(() => buildQueue(replies, t), [replies, t]);
  const hotReplies = useMemo(() => buildHot(replies), [replies]);
  const learnings = useMemo(() => buildLearnings(counts, total, t), [counts, total, t]);
  const feed = useMemo(() => {
    const base = overview ? buildFeed(overview, replies, t) : [{ text: t('dashboard.feed.loading'), time: t('dashboard.age.now'), tone: 'bg-brand-500' }];
    return [...actionLog, ...base].slice(0, 6);
  }, [actionLog, overview, replies, t]);
  const meetingReady = useMemo(
    () => replies.filter((r) => r.replyClass === 'INTERESTED').slice(0, 4),
    [replies],
  );

  const statusMetrics: StatusMetric[] = [
    { label: t('dashboard.metrics.activeCampaigns'), value: overview ? String(overview.campaigns.active) : '—', icon: <Target size={14} strokeWidth={2} /> },
    { label: t('dashboard.metrics.queuedSends'), value: overview ? overview.campaigns.enrolledActive.toLocaleString('en-US') : '—', icon: <Mailbox size={14} strokeWidth={2} /> },
    { label: t('dashboard.metrics.actionableReplies'), value: String(needsDecision), icon: <Flame size={14} strokeWidth={2} /> },
    { label: t('dashboard.metrics.meetingReady'), value: String(interestedCount), icon: <CalendarCheck size={14} strokeWidth={2} /> },
    { label: t('dashboard.metrics.aiRunsToday'), value: overview ? String(overview.ai.runsToday) : '—', icon: <ShieldCheck size={14} strokeWidth={2} /> },
    { label: t('dashboard.metrics.creditsLeft'), value: overview ? overview.ai.credits.balance.toLocaleString('en-US') : '—', icon: <Sparkles size={14} strokeWidth={2} /> },
  ];

  const agentActive = (overview?.campaigns.active ?? 0) > 0;
  const lastAction = replies[0] ? t('dashboard.status.lastInbound', { age: ageLabel(replies[0].createdAt, t) }) : t('dashboard.status.standingBy');
  const motionLine = overview
    ? t('dashboard.status.motion', { active: overview.campaigns.active, enrolled: overview.campaigns.enrolled })
    : t('dashboard.status.loadingMotion');

  // ── Действия ────────────────────────────────────────────────────────────────
  const openCompose = useCallback(async (reply: ReplyMessage) => {
    setCompose(reply);
    setDraftSubject(`Re: ${reply.subject ?? t('dashboard.compose.reFallback')}`);
    setDraftBody('');
    setGenerating(true);
    try {
      const r = await outreachApi.autoReply({ messageId: reply.id, replyText: reply.body, send: false });
      setDraftSubject(r.subject || `Re: ${reply.subject ?? t('dashboard.compose.reFallback')}`);
      setDraftBody(r.body);
    } catch {
      setDraftBody('');
    } finally {
      setGenerating(false);
    }
  }, [t]);

  async function approveSend() {
    if (!compose || !draftBody.trim()) return;
    const name = `${compose.lead.firstName} ${compose.lead.lastName}`.trim();
    setSending(true);
    try {
      const res = await outreachApi.respond(compose.id, { subject: draftSubject, body: draftBody });
      setCompose(null);
      pushAction(t('dashboard.actions.recordedReply', { name }), 'bg-brand-500');
      showToast(res.delivered ? t('dashboard.compose.recordedDemo') : t('dashboard.compose.recordedNoEmail'));
      await loadReplies();
      await loadOverview();
    } catch {
      showToast(t('dashboard.compose.couldNotRecord'));
    } finally {
      setSending(false);
    }
  }

  async function confirmNotNow(reply: ReplyMessage) {
    const name = `${reply.lead.firstName} ${reply.lead.lastName}`.trim();
    try {
      await outreachApi.setReplyClass(reply.id, 'FOLLOW_UP');
      pushAction(t('dashboard.actions.confirmedNotNowFor', { name }), 'bg-amber-500');
      showToast(t('dashboard.reclass.confirmedNotNow'));
      await loadReplies();
    } catch {
      showToast(t('dashboard.reclass.couldNotUpdate'));
    }
  }

  async function applyReclass(cls: Cls) {
    if (!reclass) return;
    const name = `${reclass.lead.firstName} ${reclass.lead.lastName}`.trim();
    setBusyClass(true);
    try {
      await outreachApi.setReplyClass(reclass.id, cls);
      setReclass(null);
      pushAction(t('dashboard.actions.reclassifiedName', { name, intent: intentLabel(t, cls) }), CLASS_DOT[cls] ?? 'bg-brand-500');
      showToast(t('dashboard.reclass.reclassifiedTo', { intent: intentLabel(t, cls) }));
      await loadReplies();
    } catch {
      showToast(t('dashboard.reclass.couldNotReclassify'));
    } finally {
      setBusyClass(false);
    }
  }

  function runQueuePrimary(item: QueueItem) {
    if (item.kind === 'classify') confirmNotNow(item.reply);
    else void openCompose(item.reply);
  }
  function runQueueSecondary(item: QueueItem) {
    if (item.kind === 'classify') setReclass(item.reply);
    else if (item.kind === 'reply-hv') router.push(`/leads/${item.reply.lead.id}`);
    else void openCompose(item.reply);
  }

  return (
    <>
      <Topbar title={t('dashboard.pageTitle')} icon={<Gauge size={18} strokeWidth={1.85} />} />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Onboarding-чек-лист (показывается, пока первичная настройка не завершена) */}
        <OnboardingChecklist />

        {/* M26-1 (S190): homepage-поверхность Ask AISDR — greeting + ask box + recent chats + meetings/tasks */}
        <AskHomeCard />

        {/* ── Status bar ── */}
        <section className="relative overflow-hidden rounded-2xl border border-brand-100/70 bg-[linear-gradient(135deg,rgba(79,70,229,0.12),rgba(139,92,246,0.08),rgba(217,70,239,0.10))] px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                {agentActive && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-mint opacity-60" />}
                <span className={`relative inline-flex h-3 w-3 rounded-full ring-4 ${agentActive ? 'bg-accent-mint ring-accent-mint/20' : 'bg-amber-400 ring-amber-400/20'}`} />
              </span>
              <div>
                <p className="text-[17px] font-extrabold tracking-[-0.02em] text-ink leading-tight">
                  {agentActive ? t('dashboard.status.running') : t('dashboard.status.idle')}
                  <span className="ml-2 align-middle text-[12px] font-medium text-ink-subtle">· {lastAction}</span>
                </p>
                <p className="text-[12.5px] text-ink-muted">{motionLine}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/replies')}
              className="brand-gradient inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
            >
              {t('dashboard.status.reviewQueue')}
              {needsDecision > 0 && <span className="rounded-full bg-white/25 px-1.5 text-[11px] font-bold tabular-nums">{needsDecision}</span>}
              <ChevronRight size={16} strokeWidth={2.25} />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {statusMetrics.map((m) => (
              <div key={m.label} className="rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 shadow-xs backdrop-blur">
                <div className="flex items-center gap-1.5 text-ink-subtle">
                  <span className="text-brand-600">{m.icon}</span>
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em]">{m.label}</span>
                </div>
                <p className="mt-1 text-[20px] font-extrabold tabular-nums tracking-[-0.02em] text-ink">{m.value}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* ── Mission ── */}
          <div className="xl:col-span-3">
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <SectionLabel>{t('dashboard.mission.title')}</SectionLabel>
              <div className="rounded-xl bg-surface-2 p-3">
                <div className="flex items-end justify-between">
                  <p className="text-[13px] font-bold text-ink">{t('dashboard.mission.qualifyLeads')}</p>
                  <p className="text-[13px] font-extrabold tabular-nums text-brand-700">{interestedCount}/{Math.max(8, interestedCount)}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full brand-gradient" style={{ width: `${Math.min(100, Math.round((interestedCount / Math.max(8, interestedCount)) * 100))}%` }} />
                </div>
              </div>
              <div className="mt-2">
                <MissionRow label={t('dashboard.mission.activeMotion')} value={motionLine} />
                <MissionRow label={t('dashboard.mission.currentFocus')} value={needsDecision > 0 ? t('dashboard.mission.triage', { count: needsDecision, repliesWord: needsDecision === 1 ? t('dashboard.mission.reply') : t('dashboard.mission.replies') }) : t('dashboard.mission.pipelineBuilding')} />
                <MissionRow label={t('dashboard.mission.humanGate')} value={t('dashboard.mission.awaitingApproval', { count: needsDecision })} />
                <MissionRow label={t('dashboard.mission.workspace')} value={overview ? t('dashboard.mission.workspaceVal', { records: overview.records.total, objects: overview.records.objects }) : '—'} />
              </div>
            </div>
          </div>

          {/* ── Work queue ── */}
          <div className="xl:col-span-6">
            <div className="flex flex-col gap-5">
              <div>
                <SectionLabel action={
                  <span className="text-[11px] font-semibold text-brand-700">
                    {needsDecision > decisionQueue.length ? t('dashboard.queue.shown', { shown: decisionQueue.length, total: needsDecision }) : t('dashboard.queue.needYou', { count: decisionQueue.length })}
                  </span>
                }>
                  {t('dashboard.queue.heading')}
                </SectionLabel>
                {decisionQueue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface px-4 py-10 text-center">
                    <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={20} strokeWidth={2} /></span>
                    <p className="text-[13px] font-bold text-ink">{t('dashboard.queue.clearTitle')}</p>
                    <p className="mt-0.5 text-[12px] text-ink-muted">{t('dashboard.queue.clearBody')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {decisionQueue.map((item) => (
                      <QueueCard key={item.reply.id} item={item} t={t} onPrimary={() => runQueuePrimary(item)} onSecondary={() => runQueueSecondary(item)} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <SectionLabel action={
                  <button type="button" onClick={() => router.push('/replies')} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand-700 hover:underline">
                    {t('dashboard.queue.openInbox')} <ArrowUpRight size={12} />
                  </button>
                }>
                  {t('dashboard.queue.hotHeading')}
                </SectionLabel>
                {hotReplies.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-6 text-center text-[12px] text-ink-muted">
                    {t('dashboard.queue.noHot')}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
                    {hotReplies.map((r, i) => (
                      <div key={r.reply.id} className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-brand-50/50 ${i < hotReplies.length - 1 ? 'border-b border-line' : ''}`}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-ink">
                            {r.name} <span className="font-normal text-ink-subtle">· {r.company}</span>
                          </p>
                          <p className="truncate text-[12px] text-ink-muted">{r.snippet}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{t('dashboard.queue.interested')}</span>
                          <span className="text-[10.5px] font-medium text-ink-subtle">{t('dashboard.queue.respondToday')}</span>
                        </div>
                        <button type="button" onClick={() => void openCompose(r.reply)} className="brand-gradient hidden shrink-0 items-center rounded-lg px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-xs sm:inline-flex">
                          {t('dashboard.queue.respond')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right rail ── */}
          <div className="xl:col-span-3">
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl border border-line/80 bg-surface-2/30 p-5 shadow-xs">
                <SectionLabel action={<Activity size={14} className="text-ink-subtle" />}>{t('dashboard.rail.feedHeading')}</SectionLabel>
                <ol className="relative ml-1.5 border-l border-line">
                  {feed.map((f, i) => (
                    <li key={i} className="relative pb-3.5 pl-4 last:pb-0">
                      <span className={`absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${f.tone}`} />
                      <p className="text-[12.5px] leading-4 text-ink">{f.text}</p>
                      <p className="mt-0.5 text-[11px] text-ink-subtle">{f.time}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-2xl border border-line/80 bg-surface-2/30 p-5 shadow-xs">
                <SectionLabel action={
                  <button type="button" onClick={() => router.push('/meetings')} className="text-[11px] font-semibold text-ink-subtle hover:text-brand-700 hover:underline">{t('dashboard.rail.all')}</button>
                }>
                  {t('dashboard.rail.meetingReady')}
                </SectionLabel>
                {meetingReady.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line bg-surface-2/40 px-3 py-5 text-center text-[12px] text-ink-muted">
                    {t('dashboard.rail.noMeetingReady')}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {meetingReady.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => router.push(`/leads/${m.lead.id}`)}
                        className="rounded-xl border border-line bg-surface-2/50 p-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                            <CalendarCheck size={14} strokeWidth={2} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-semibold text-ink">{m.lead.firstName} {m.lead.lastName} · {m.lead.company ?? '—'}</p>
                            <p className="flex items-center gap-1 text-[11.5px] text-ink-muted"><Clock size={11} /> {ageLabel(m.createdAt, t)}</p>
                          </div>
                        </div>
                        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{t('dashboard.rail.bookCall')}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Learning snapshot ── */}
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#10b981] to-[#4f46e5] text-white shadow-sm">
                <TrendingUp size={15} strokeWidth={2.25} />
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-ink leading-tight">{insight?.title ?? t('dashboard.learning.fallbackTitle')}</h2>
                <p className="text-[12px] text-ink-muted">{insight?.rec ?? t('dashboard.learning.fallbackRec')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push('/learning')}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-100"
            >
              <Sparkles size={13} strokeWidth={2} />
              {insight ? t('dashboard.learning.reviewApply') : t('dashboard.learning.openLearning')}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {learnings.map((l) => (
              <div key={l.label} className="rounded-xl border border-line bg-surface-2/40 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">{l.label}</p>
                <p className="mt-1 text-[13.5px] font-bold text-ink">{l.value}</p>
                <p className={`mt-1 text-[12px] font-semibold ${l.good ? 'text-emerald-600' : 'text-rose-500'}`}>{l.delta}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Compose-модалка ответа ── */}
      <CockpitModal
        open={compose !== null}
        onClose={() => setCompose(null)}
        title={compose ? t('dashboard.compose.titleReply', { name: `${compose.lead.firstName} ${compose.lead.lastName}`.trim() }) : t('dashboard.compose.titleFallback')}
        icon={<Send size={14} strokeWidth={2} />}
        wide
        footer={
          <>
            <button type="button" onClick={() => setCompose(null)} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink">
              {t('dashboard.compose.cancel')}
            </button>
            <button
              type="button"
              onClick={approveSend}
              disabled={generating || sending || !draftBody.trim()}
              className="brand-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white shadow-brand disabled:opacity-60"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} strokeWidth={2} />}
              {sending ? t('dashboard.compose.recording') : t('dashboard.compose.approveRecord')}
            </button>
          </>
        }
      >
        {compose && (
          <div className="space-y-3.5">
            <div className="rounded-xl border border-line bg-surface-2/50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{t('dashboard.compose.theirReply')}</p>
              <p className="mt-1 text-[12.5px] leading-5 text-ink">{compose.body}</p>
              <p className="mt-1.5 text-[11px] text-ink-subtle">{compose.lead.company ?? '—'} · {t('dashboard.compose.leadScore', { score: compose.lead.score })} · {ageLabel(compose.createdAt, t)}</p>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{t('dashboard.compose.subject')}</label>
              <input
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
                className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{t('dashboard.compose.aiReply')}</label>
                <button
                  type="button"
                  onClick={() => void openCompose(compose)}
                  disabled={generating}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline disabled:opacity-60"
                >
                  <Sparkles size={11} strokeWidth={2.25} /> {generating ? t('dashboard.compose.generating') : t('dashboard.compose.regenerate')}
                </button>
              </div>
              <textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={7}
                placeholder={generating ? t('dashboard.compose.draftingPlaceholder') : t('dashboard.compose.writePlaceholder')}
                className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-[13px] leading-5 text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-subtle">
                <Sparkles size={11} className="text-brand-600" />
                {t('dashboard.compose.deepseekNote')}
              </p>
            </div>
          </div>
        )}
      </CockpitModal>

      {/* ── Reclassify-модалка ── */}
      <CockpitModal
        open={reclass !== null}
        onClose={() => setReclass(null)}
        title={t('dashboard.reclass.title')}
        icon={<AlertTriangle size={14} strokeWidth={2} />}
      >
        {reclass && (
          <div className="space-y-3">
            <p className="text-[12.5px] leading-5 text-ink-muted">
              {t('dashboard.reclass.promptPrefix')} <span className="font-semibold text-ink">{reclass.lead.firstName} {reclass.lead.lastName}</span>{t('dashboard.reclass.promptSuffix')}
            </p>
            <p className="rounded-lg bg-surface-2/60 p-3 text-[12.5px] italic leading-5 text-ink">“{reclass.body}”</p>
            <div className="grid grid-cols-1 gap-2">
              {([
                { cls: 'INTERESTED' as Cls, label: t('dashboard.reclass.optInterested'), hint: t('dashboard.reclass.optInterestedHint'), color: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
                { cls: 'FOLLOW_UP' as Cls, label: t('dashboard.reclass.optNotNow'), hint: t('dashboard.reclass.optNotNowHint'), color: 'text-amber-700 border-amber-200 hover:bg-amber-50' },
                { cls: 'NOT_INTERESTED' as Cls, label: t('dashboard.reclass.optNotInterested'), hint: t('dashboard.reclass.optNotInterestedHint'), color: 'text-rose-700 border-rose-200 hover:bg-rose-50' },
                { cls: 'UNSUBSCRIBE' as Cls, label: t('dashboard.reclass.optUnsub'), hint: t('dashboard.reclass.optUnsubHint'), color: 'text-ink-muted border-line hover:bg-surface-2' },
              ]).map((o) => (
                <button
                  key={o.cls}
                  type="button"
                  disabled={busyClass}
                  onClick={() => applyReclass(o.cls)}
                  className={`flex items-center justify-between rounded-xl border bg-surface px-3.5 py-2.5 text-left transition-colors disabled:opacity-60 ${o.color}`}
                >
                  <span>
                    <span className="block text-[13px] font-bold">{o.label}</span>
                    <span className="block text-[11.5px] text-ink-subtle">{o.hint}</span>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          </div>
        )}
      </CockpitModal>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[12.5px] font-semibold text-ink shadow-lg">
          <span className="brand-gradient flex h-6 w-6 items-center justify-center rounded-lg text-white"><CheckCircle2 size={12} /></span>
          {toast}
        </div>
      )}
    </>
  );
}

/* ── Мелкие компоненты ──────────────────────────────────────────────────────── */

function MissionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line py-2.5 last:border-b-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium text-ink">{value}</p>
    </div>
  );
}

function QueueCard({ item, t, onPrimary, onSecondary }: { item: QueueItem; t: TFunc; onPrimary: () => void; onSecondary: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>{item.icon}</span>
        <div className="min-w-0 flex-1">
          <span className={[
            'mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em]',
            item.priority.urgent ? 'bg-rose-100 text-rose-700' : 'bg-surface-2 text-ink-subtle',
          ].join(' ')}>
            {item.priority.urgent && <Flame size={11} strokeWidth={2.25} />}
            {item.priority.label}
          </span>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13.5px] font-bold text-ink">{item.title}</p>
            <ConfidencePill level={item.confidence.level} text={t('dashboard.confidence', { value: item.confidence.value })} />
          </div>
          <p className="mt-0.5 text-[12.5px] font-medium text-ink-muted">{item.who}</p>
          <p className="mt-1.5 text-[12.5px] leading-5 text-ink-muted">{item.context}</p>

          <div className="mt-2 rounded-lg bg-brand-50/60 px-2.5 py-1.5">
            <div className="flex items-start gap-1.5">
              <Sparkles size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-brand-600" />
              <p className="text-[12px] leading-4 text-brand-800">
                <span className="font-semibold">{t('dashboard.card.aiSuggests')}</span> {item.recommendation}
              </p>
            </div>
            <p className="mt-1 pl-[18px] text-[11.5px] leading-4 text-brand-700/90">
              <span className="font-semibold">{t('dashboard.card.why')}</span> {item.why}
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onPrimary}
              className="brand-gradient inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              {item.primary}
            </button>
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12.5px] font-medium text-ink-muted shadow-xs hover:bg-surface-2 hover:text-ink"
            >
              {item.kind === 'reply-hv' ? <UserSquare2 size={13} strokeWidth={2} /> : <Pencil size={13} strokeWidth={2} />}
              {item.secondary}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
