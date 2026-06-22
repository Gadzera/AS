'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { outreachApi, type ReplyMessage, type ReplyDraft } from '@/lib/api';
import {
  Inbox,
  Sparkles,
  ShieldAlert,
  Send,
  Flame,
  ThumbsDown,
  Clock3,
  BellOff,
  Layers,
  Loader2,
  X,
  Tag,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  History,
  RefreshCw,
  CalendarPlus,
  CalendarCheck,
  ArrowUpRight,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import HandoffPanel from '@/components/outreach/HandoffPanel';

/* ──────────────────────────────────────────────────────────────────────────
   Replies Inbox (/replies) — рабочее место по входящим ответам (AI-SDR).
   Всё на ЖИВОМ backend (/outreach/replies + set-class + respond + auto-reply),
   handledAt-aware: оттриажированные ответы уходят из actionable-папок. Реальные
   действия: record reply / reclassify / suppress. Светлая Bold-тема.
   ────────────────────────────────────────────────────────────────────────── */

type Cls = 'INTERESTED' | 'NOT_INTERESTED' | 'FOLLOW_UP' | 'UNSUBSCRIBE';
const CLASS_META: Record<string, { intent: string; tone: string; folder: string; conf: number }> = {
  INTERESTED: { intent: 'Interested', tone: 'bg-emerald-100 text-emerald-700', folder: 'interested', conf: 90 },
  FOLLOW_UP: { intent: 'Not now', tone: 'bg-amber-100 text-amber-700', folder: 'not-now', conf: 62 },
  NOT_INTERESTED: { intent: 'Objection', tone: 'bg-rose-100 text-rose-700', folder: 'objection', conf: 84 },
  UNSUBSCRIBE: { intent: 'Unsubscribe', tone: 'bg-surface-2 text-ink-muted', folder: 'unsubscribe', conf: 96 },
};
// M14-3: человекочитаемые подписи backend-derived risk flags (UI не вычисляет их — только отображает).
const RISK_FLAG_LABEL: Record<string, string> = {
  low_confidence: 'Low confidence',
  fallback_attribution: 'Fallback attribution',
  unsubscribe_intent: 'Unsubscribe intent',
  negative_sentiment: 'Negative sentiment',
  asks_for_pricing: 'Asks pricing',
  asks_for_legal: 'Asks legal / contract',
  asks_for_security: 'Asks security',
  missing_thread_context: 'No thread context',
};
const RISK_TONE: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-rose-100 text-rose-700',
};
// M14-4: дружелюбные подписи причин неудачной отправки (reply НЕ помечен отправленным — можно повторить).
// M14-5: тон бейджа origin авто-ответа (лейбл считает backend).
const ORIGIN_TONE: Record<string, string> = {
  'Auto-sent': 'bg-emerald-100 text-emerald-700',
  'Replied': 'bg-sky-100 text-sky-700',
  'Needs approval': 'bg-amber-100 text-amber-700',
  'Handoff': 'bg-violet-100 text-violet-700',
  'Auto-send failed': 'bg-rose-100 text-rose-700',
  'Suppressed': 'bg-surface-2 text-ink-muted',
};
const REPLY_SEND_ERROR: Record<string, string> = {
  no_mailbox: 'No connected mailbox — reply held, not sent',
  all_at_capacity: 'All mailboxes at daily capacity — try later',
  send_failed: 'Temporary delivery issue — reply not sent, try again',
  send_failed_permanent: 'Delivery failed (address rejected) — handed off',
  in_progress: 'Send already in progress',
  no_email: 'Lead has no email address',
};
const FOLDER_CLASS: Record<string, string> = { interested: 'INTERESTED', 'not-now': 'FOLLOW_UP', objection: 'NOT_INTERESTED', unsubscribe: 'UNSUBSCRIBE' };
const INTENT_LABEL: Record<string, string> = { INTERESTED: 'Interested', FOLLOW_UP: 'Not now', NOT_INTERESTED: 'Not interested', UNSUBSCRIBE: 'Unsubscribe' };
const R_TONES = ['from-[#6366f1] to-[#8b5cf6]', 'from-[#06b6d4] to-[#4f46e5]', 'from-[#8b5cf6] to-[#d946ef]', 'from-[#10b981] to-[#06b6d4]', 'from-[#f59e0b] to-[#f43f5e]'];

function initials(n: string) { return (n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); }
function ageLabel(iso: string): string {
  const d = Date.parse(iso); if (isNaN(d)) return '';
  const m = Math.max(1, Math.round((Date.now() - d) / 60000));
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
}
function name(r: ReplyMessage) { return `${r.lead.firstName} ${r.lead.lastName}`.trim() || 'Lead'; }
// M15-2: дефолт — завтра 10:00 в формате datetime-local (YYYY-MM-DDTHH:mm).
function defaultMeetWhen(): string {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function RepliesInboxPage() {
  const router = useRouter();
  const [replies, setReplies] = useState<ReplyMessage[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [folder, setFolder] = useState('needs-human');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // M14-3: персистентный AI-черновик (отдельная сущность). body — редактируемый текст; draft — backend-снимок.
  const [draft, setDraft] = useState<ReplyDraft | null>(null);
  const [body, setBody] = useState('');
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [sending, setSending] = useState(false);
  const [reclassOpen, setReclassOpen] = useState(false);
  const [busyClass, setBusyClass] = useState(false);
  const [toast, setToast] = useState('');
  // M15-2: модалка назначения встречи.
  const [meetOpen, setMeetOpen] = useState(false);
  const [meetWhen, setMeetWhen] = useState('');
  const [meetDur, setMeetDur] = useState(30);
  const [meetBusy, setMeetBusy] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false); // M15-3
  const [creditBlock, setCreditBlock] = useState<{ required: number; available: number } | null>(null); // M16-4

  function showToast(m: string) { setToast(m); window.setTimeout(() => setToast(''), 4000); }

  const load = useCallback(async () => {
    try {
      const r = await outreachApi.replies();
      setReplies(r.replies);
      setCounts(r.counts ?? {});
    } catch { /* no-op */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // actionable = необработанные (handledAt=null). Auto-sent уходят из actionable (агент их обработал).
  const actionable = useMemo(() => replies.filter((r) => !r.handledAt), [replies]);
  const cnt = (cls: string) => actionable.filter((r) => r.replyClass === cls).length;
  // M14-5: счётчики по origin авто-ответа (backend label).
  const autoSentCount = useMemo(() => replies.filter((r) => r.autoResponse?.label === 'Auto-sent').length, [replies]);
  const handoffCount = useMemo(() => actionable.filter((r) => r.autoResponse?.label === 'Handoff').length, [actionable]);
  const folders = [
    { key: 'needs-human', label: 'Needs human', icon: <ShieldAlert size={15} strokeWidth={1.9} />, count: cnt('INTERESTED') + cnt('FOLLOW_UP') + cnt('NOT_INTERESTED'), accent: true },
    { key: 'auto-sent', label: 'Auto-sent', icon: <Sparkles size={15} strokeWidth={1.9} />, count: autoSentCount },
    { key: 'handoff', label: 'Handoff', icon: <ShieldAlert size={15} strokeWidth={1.9} />, count: handoffCount },
    { key: 'interested', label: 'Interested', icon: <Flame size={15} strokeWidth={1.9} />, count: cnt('INTERESTED') },
    { key: 'objection', label: 'Objection', icon: <ThumbsDown size={15} strokeWidth={1.9} />, count: cnt('NOT_INTERESTED') },
    { key: 'not-now', label: 'Not now', icon: <Clock3 size={15} strokeWidth={1.9} />, count: cnt('FOLLOW_UP') },
    { key: 'unsubscribe', label: 'Unsubscribe', icon: <BellOff size={15} strokeWidth={1.9} />, count: cnt('UNSUBSCRIBE') },
    { key: 'all', label: 'All conversations', icon: <Layers size={15} strokeWidth={1.9} />, count: replies.length },
  ];

  const list = useMemo(() => {
    let items: ReplyMessage[];
    if (folder === 'all') items = replies; // включая обработанные/авто-отправленные
    else if (folder === 'auto-sent') items = replies.filter((r) => r.autoResponse?.label === 'Auto-sent');
    else if (folder === 'handoff') items = actionable.filter((r) => r.autoResponse?.label === 'Handoff');
    else {
      items = actionable;
      if (folder === 'needs-human') items = items.filter((r) => r.replyClass === 'INTERESTED' || r.replyClass === 'FOLLOW_UP' || r.replyClass === 'NOT_INTERESTED');
      else if (FOLDER_CLASS[folder]) items = items.filter((r) => r.replyClass === FOLDER_CLASS[folder]);
    }
    return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [actionable, replies, folder]);

  const selected = useMemo(() => list.find((r) => r.id === selectedId) ?? list[0] ?? null, [list, selectedId]);
  const dirty = !!draft && body.trim() !== (draft.body ?? '').trim();
  const sendable = !!draft && draft.status !== 'SENT' && draft.status !== 'SUPPRESSED';

  // При смене выбранного ответа — подтягиваем его персистентный черновик (если есть).
  const loadDraft = useCallback(async (replyId: string) => {
    setLoadingDraft(true);
    try { const d = await outreachApi.getDraft(replyId); setDraft(d); setBody(d?.body ?? ''); }
    catch { setDraft(null); setBody(''); }
    finally { setLoadingDraft(false); }
  }, []);
  useEffect(() => { if (selected?.id) void loadDraft(selected.id); else { setDraft(null); setBody(''); } }, [selected?.id, loadDraft]);

  // Сгенерировать/перегенерировать — backend держит ОДИН активный DRAFT на reply (без orphan).
  async function generate() {
    if (!selected) return;
    setGenerating(true); setCreditBlock(null);
    try { const d = await outreachApi.generateDraft(selected.id); setDraft(d); setBody(d?.body ?? ''); }
    catch (e) {
      // M16-4: честная причина блокировки по кредитам (required/available из backend, без recompute).
      const err = e as { response?: { status?: number; data?: { required?: number; available?: number } } };
      if (err.response?.status === 402) { const cb = { required: err.response.data?.required ?? 1, available: err.response.data?.available ?? 0 }; setCreditBlock(cb); showToast(`Out of AI credits — need ${cb.required}, have ${cb.available}`); }
      else showToast('Could not generate draft');
    } finally { setGenerating(false); }
  }

  // Сохранить ручную правку (backend пишет снимок before/after в originalBody).
  async function saveEdit() {
    if (!draft || !dirty) return;
    setSavingEdit(true);
    try { await outreachApi.editDraft(draft.id, body.trim()); const d = await outreachApi.getDraft(selected!.id); setDraft(d); setBody(d?.body ?? body); showToast('Draft edited · before/after saved'); }
    catch { showToast('Could not save edit'); } finally { setSavingEdit(false); }
  }

  // Approve + send как ОДНО controlled action. Если черновика нет — сначала генерируем; правку сохраняем перед отправкой.
  async function approveSend() {
    if (!selected) return;
    let d = draft;
    if (!d) {
      setGenerating(true);
      try { d = await outreachApi.generateDraft(selected.id); setDraft(d); setBody(d?.body ?? ''); }
      catch { /* no-op */ } finally { setGenerating(false); }
      if (!d) { showToast('Could not generate draft'); return; }
    }
    setSending(true);
    try {
      if (body.trim() && body.trim() !== (d.body ?? '').trim()) await outreachApi.editDraft(d.id, body.trim());
      const res = await outreachApi.approveSendDraft(d.id);
      showToast(res.alreadySent ? 'Reply already sent' : `Reply sent in-thread to ${name(selected)}`);
      setSelectedId(null);
      await load();
    } catch (e) {
      // M14-4: сбой/нет-ящика НЕ помечают ответ отправленным — оставляем выбор, даём ретрай.
      const reason = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast(REPLY_SEND_ERROR[reason ?? ''] ?? 'Could not approve & send');
      await loadDraft(selected.id); // показать FAILED-состояние/обновить
    }
    finally { setSending(false); }
  }

  // Снять черновик / передать человеку (без отправки).
  async function suppressDraft() {
    if (!draft) return;
    setBusyClass(true);
    try { await outreachApi.suppressDraft(draft.id); showToast('Draft suppressed · handed off'); await loadDraft(selected!.id); }
    catch { showToast('Could not suppress'); } finally { setBusyClass(false); }
  }

  // M15-2: назначить встречу из этого ответа (backend атрибутирует к reply/campaign + идемпотентность).
  async function scheduleMeeting() {
    if (!selected) return;
    setMeetBusy(true);
    try {
      const res = await outreachApi.scheduleMeeting(selected.id, { scheduledAt: meetWhen ? new Date(meetWhen).toISOString() : undefined, durationMin: meetDur, title: `Intro call — ${name(selected)}` });
      showToast(res.duplicate ? 'Meeting already scheduled for this reply' : `Meeting scheduled with ${name(selected)}`);
      setMeetOpen(false); setSelectedId(null); await load();
    } catch { showToast('Could not schedule meeting'); }
    finally { setMeetBusy(false); }
  }

  async function setClass(cls: Cls) {
    if (!selected) return;
    setBusyClass(true);
    try {
      await outreachApi.setReplyClass(selected.id, cls);
      setReclassOpen(false);
      showToast(cls === 'UNSUBSCRIBE' ? `${name(selected)} suppressed` : `Reclassified → ${INTENT_LABEL[cls]}`);
      setSelectedId(null);
      await load();
    } catch { showToast('Could not update'); }
    finally { setBusyClass(false); }
  }

  if (replies.length === 0) {
    return (
      <>
        <Topbar title="Replies" icon={<Inbox size={18} strokeWidth={1.85} />} />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={22} /></span>
          <p className="text-[14px] font-bold text-ink">Inbox zero</p>
          <p className="text-[12.5px] text-ink-muted">No replies need triage. The agent keeps the pipeline moving.</p>
        </div>
      </>
    );
  }

  const meta = selected ? CLASS_META[selected.replyClass ?? 'FOLLOW_UP'] : null;
  const idx = selected ? list.findIndex((r) => r.id === selected.id) : 0;

  return (
    <>
      <Topbar title="Replies" icon={<Inbox size={18} strokeWidth={1.85} />} />

      <div className="flex min-h-0 flex-1">
        {/* intent folders */}
        <aside className="hidden w-[208px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface/60 p-2.5 md:flex">
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">Intent</p>
          {folders.map((f) => {
            const active = f.key === folder;
            return (
              <button key={f.key} type="button" onClick={() => { setFolder(f.key); setSelectedId(null); }} className={['group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors', active ? 'sidebar-active-gradient text-ink ring-1 ring-inset ring-brand-100' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'].join(' ')}>
                <span className={active ? 'text-brand-600' : f.accent ? 'text-rose-500' : 'text-ink-subtle group-hover:text-brand-600'}>{f.icon}</span>
                <span className="flex-1 truncate text-left">{f.label}</span>
                <span className={['rounded-full px-1.5 py-0.5 text-[10.5px] font-bold leading-none', f.accent && f.count > 0 ? 'bg-rose-500 text-white' : active ? 'bg-brand-600 text-white' : 'bg-surface-2 text-ink-subtle'].join(' ')}>{f.count}</span>
              </button>
            );
          })}
        </aside>

        {/* conversation list */}
        <section className="flex min-w-0 flex-1 flex-col border-r border-line">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-bold text-ink">{folders.find((f) => f.key === folder)?.label}</h2>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-ink-muted">{list.length}</span>
            </div>
            <p className="text-[12px] text-ink-subtle">Newest first</p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12.5px] text-ink-subtle">Nothing here — folder is clear.</p>
            ) : list.map((c, i) => {
              const active = c.id === (selected?.id ?? '');
              const m = CLASS_META[c.replyClass ?? 'FOLLOW_UP'];
              return (
                <button key={c.id} type="button" onClick={() => setSelectedId(c.id)} className={['flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition-colors', active ? 'bg-brand-50' : 'hover:bg-brand-50/40'].join(' ')}>
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[12px] font-bold text-white shadow-sm ${R_TONES[i % R_TONES.length]}`}>{initials(name(c))}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-bold text-ink">{name(c)} <span className="font-normal text-ink-subtle">· {c.lead.company ?? '—'}</span></p>
                      <span className="shrink-0 text-[11px] font-medium text-ink-subtle">{ageLabel(c.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">{c.body}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.tone}`}>{m.intent}</span>
                      {/* M14-5: origin авто-ответа (backend label) */}
                      {c.autoResponse?.label && <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${ORIGIN_TONE[c.autoResponse.label] ?? 'bg-surface-2 text-ink-muted'}`}>{c.autoResponse.label}</span>}
                      <span className="text-[10.5px] font-medium text-ink-subtle">score {c.lead.score}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* AI decision panel */}
        <aside className="hidden w-[380px] shrink-0 flex-col overflow-y-auto bg-surface/60 lg:flex">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-[13px] text-ink-subtle">Select a conversation</div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-line px-5 py-4">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-[13px] font-bold text-white shadow-sm ${R_TONES[Math.max(0, idx) % R_TONES.length]}`}>{initials(name(selected))}</span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-ink">{name(selected)}</p>
                  <p className="truncate text-[12px] text-ink-muted">{selected.lead.company ?? '—'}{selected.lead.title ? ` · ${selected.lead.title}` : ''}</p>
                </div>
                <button type="button" onClick={() => router.push(`/leads/${selected.lead.id}`)} className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700 ring-1 ring-inset ring-brand-100">score {selected.lead.score}</button>
              </header>

              <div className="flex-1 space-y-4 p-5">
                {/* M14-5: origin авто-ответа (backend label) */}
                {selected.autoResponse?.label && (
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold ${ORIGIN_TONE[selected.autoResponse.label] ?? 'bg-surface-2 text-ink-muted'}`}>
                    <Sparkles size={13} />
                    {selected.autoResponse.label === 'Auto-sent' ? 'Auto-sent by the agent (low-risk · autopilot)'
                      : selected.autoResponse.label === 'Handoff' ? 'Handed off to you — autopilot held this reply for approval'
                      : selected.autoResponse.label === 'Auto-send failed' ? 'Autopilot could not send — review and send manually'
                      : selected.autoResponse.label === 'Suppressed' ? 'Suppressed — handed off, not sent'
                      : selected.autoResponse.label === 'Replied' ? 'Replied (human-approved)'
                      : 'Needs your approval'}
                  </div>
                )}
                {/* thread */}
                <div>
                  <div className="rounded-2xl bg-surface-2 px-3 py-2 text-[12.5px] leading-5 text-ink">{selected.body}</div>
                  <span className="mt-0.5 block px-1 text-[10.5px] text-ink-subtle">{ageLabel(selected.createdAt)}</span>
                </div>

                {/* AI classification — M14-1/M14-2: реальный intent/confidence/source + attribution из backend. */}
                <div className="rounded-xl border border-brand-200/70 bg-brand-50/60 p-3.5">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700"><Sparkles size={13} /> Agent read</p>
                  <p className="text-[12.5px] leading-5 text-brand-900">
                    Classified as <span className="font-bold">{meta?.intent}</span> ({selected.intentConfidence != null ? `${Math.round(selected.intentConfidence * 100)}% conf` : '—'}{selected.intentSource === 'HUMAN' ? ' · human override' : ''}). {selected.replyClass === 'INTERESTED' ? 'Positive — draft a reply and propose a call.' : selected.replyClass === 'FOLLOW_UP' ? 'Soft timing — confirm Not now or nurture.' : selected.replyClass === 'NOT_INTERESTED' ? 'Objection — handle or disqualify.' : 'Suppress contact (compliance).'}
                  </p>
                  {selected.attribution.attributionMode && (
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="font-semibold uppercase tracking-wide text-brand-700/70">Attributed to</span>
                      <span className="rounded-md bg-white/70 px-1.5 py-0.5 font-semibold text-brand-800">{selected.attribution.campaignName ?? 'a campaign'}</span>
                      <span className={`rounded-md px-1.5 py-0.5 font-semibold ${selected.attribution.attributionMode === 'fallback_last_outbound' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{selected.attribution.attributionMode === 'fallback_last_outbound' ? 'fallback (last-outbound)' : `exact (${selected.attribution.attributionMode.replace('header_', '').replace(/_/g, ' ')})`}</span>
                      {selected.repliedToOutbound?.subject && <span className="text-ink-subtle">re: “{selected.repliedToOutbound.subject}”</span>}
                    </p>
                  )}
                </div>

                {/* M16-4: честная блокировка по кредитам (required/available из backend) */}
                {creditBlock && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">
                    <p className="flex items-center gap-1.5 font-bold"><AlertTriangle size={13} /> Out of AI credits</p>
                    <p className="mt-0.5">Generating a draft needs <b>{creditBlock.required}</b> credit{creditBlock.required === 1 ? '' : 's'} — you have <b>{creditBlock.available}</b>. Top up in <button type="button" onClick={() => router.push('/settings')} className="font-semibold underline">Billing &amp; Credits</button>.</p>
                  </div>
                )}
                {/* M14-3: AI reply draft + approval gate — персистентный draft, backend risk flags/level/autopilot. */}
                <div className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-subtle"><Sparkles size={13} className="text-brand-600" /> AI reply draft</p>
                    {draft && (
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${draft.status === 'SENT' ? 'bg-emerald-100 text-emerald-700' : draft.status === 'SUPPRESSED' ? 'bg-surface-2 text-ink-muted' : 'bg-brand-100 text-brand-700'}`}>{draft.status}</span>
                    )}
                  </div>

                  {/* risk gate — считает backend; влияет на autopilot */}
                  {draft && (
                    <div className="mb-2 rounded-lg border border-line bg-surface-2/40 p-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${RISK_TONE[draft.riskLevel]}`}>
                          {draft.riskLevel === 'LOW' ? <ShieldCheck size={11} /> : <AlertTriangle size={11} />} {draft.riskLevel} risk
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${draft.canAutopilot ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'}`}>
                          {draft.canAutopilot ? 'autopilot-eligible' : 'human approval required'}
                        </span>
                        <span className="ml-auto text-[10px] text-ink-subtle">by {draft.generatedBy}</span>
                      </div>
                      {draft.riskFlags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {draft.riskFlags.map((f) => (
                            <span key={f} className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-medium text-rose-700 ring-1 ring-inset ring-rose-100">{RISK_FLAG_LABEL[f] ?? f}</span>
                          ))}
                        </div>
                      )}
                      {!draft.canAutopilot && <p className="mt-1.5 text-[10.5px] text-amber-700">Flagged — cannot be sent on autopilot. A human must approve before sending.</p>}
                    </div>
                  )}

                  <div className="mb-1.5 flex items-center justify-end gap-3">
                    {draft && dirty && draft.status === 'DRAFT' && (
                      <button type="button" onClick={saveEdit} disabled={savingEdit} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline disabled:opacity-60">
                        {savingEdit ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Save edit
                      </button>
                    )}
                    <button type="button" onClick={generate} disabled={generating || draft?.status === 'SENT'} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline disabled:opacity-60">
                      {generating ? <Loader2 size={11} className="animate-spin" /> : draft ? <RefreshCw size={11} strokeWidth={2.25} /> : <Sparkles size={11} strokeWidth={2.25} />} {generating ? 'Generating…' : draft ? 'Regenerate' : 'Generate'}
                    </button>
                  </div>

                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} disabled={loadingDraft || draft?.status === 'SENT' || draft?.status === 'SUPPRESSED'} placeholder={loadingDraft ? 'Loading draft…' : generating ? 'Agent is drafting…' : 'Generate an AI draft or write a reply…'} className="w-full resize-y rounded-lg border border-line bg-surface-2/40 px-3 py-2 text-[12.5px] leading-5 text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:opacity-70" />

                  {/* before/after — снимок до ручной правки */}
                  {draft?.originalBody && draft.originalBody.trim() !== (draft.body ?? '').trim() && (
                    <details className="mt-2 rounded-lg border border-line bg-surface-2/30 px-2.5 py-1.5">
                      <summary className="flex cursor-pointer items-center gap-1.5 text-[10.5px] font-semibold text-ink-subtle"><History size={11} /> Human-edited — view original (before)</summary>
                      <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] italic leading-5 text-ink-muted">{draft.originalBody}</p>
                    </details>
                  )}

                  <p className="mt-1.5 flex items-center justify-between text-[11px] text-ink-subtle">
                    <span>Drafted by DeepSeek. Persisted as a draft entity — you stay in control.</span>
                    {draft && draft.status === 'DRAFT' && (
                      <button type="button" onClick={suppressDraft} disabled={busyClass} className="inline-flex items-center gap-1 font-semibold text-ink-muted hover:text-rose-600 disabled:opacity-60"><BellOff size={11} /> Suppress / handoff</button>
                    )}
                  </p>
                </div>
              </div>

              {/* action bar — approve+send как одно controlled action (human gate) */}
              <div className="sticky bottom-0 space-y-2 border-t border-line bg-surface/90 p-4 backdrop-blur">
                <button type="button" onClick={approveSend} disabled={sending || generating || (!!draft && !sendable)} className="brand-gradient flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-70">
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} strokeWidth={2.1} />} {sending ? 'Sending…' : draft?.status === 'SENT' ? 'Sent' : draft ? (dirty ? 'Save, approve & send' : 'Approve & send') : 'Generate, approve & send'}
                </button>
                {/* M15-2/M15-3: назначить встречу / собрать пакет передачи человеку */}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setMeetWhen(defaultMeetWhen()); setMeetOpen(true); }} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-[12.5px] font-semibold text-emerald-700 shadow-xs hover:bg-emerald-100"><CalendarPlus size={14} /> Schedule meeting</button>
                  <button type="button" onClick={() => setHandoffOpen(true)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 text-[12.5px] font-semibold text-brand-700 shadow-xs hover:bg-brand-100"><ArrowUpRight size={14} /> Handoff package</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setReclassOpen(true)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-[12.5px] font-medium text-ink-muted shadow-xs hover:bg-surface-2 hover:text-ink"><Tag size={13} /> Reclassify</button>
                  <button type="button" onClick={() => setClass('UNSUBSCRIBE')} disabled={busyClass} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-[12.5px] font-medium text-rose-600 shadow-xs hover:bg-rose-50 disabled:opacity-60"><BellOff size={13} /> Suppress</button>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* M15-2: schedule meeting modal */}
      {meetOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0f0f0e]/55 backdrop-blur-sm" onClick={() => !meetBusy && setMeetOpen(false)} />
          <div className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><CalendarCheck size={14} /></span>
              <h2 className="text-[14px] font-bold text-ink">Schedule meeting</h2>
              <button type="button" onClick={() => setMeetOpen(false)} className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-2"><X size={15} /></button>
            </div>
            <div className="space-y-3 p-5">
              <p className="text-[12.5px] text-ink-muted">With <b className="text-ink">{name(selected)}</b>{selected.lead.company ? ` · ${selected.lead.company}` : ''}. The meeting is attributed to this reply{selected.attribution.campaignName ? ` and ${selected.attribution.campaignName}` : ''}.</p>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-subtle">When</label>
                <input type="datetime-local" value={meetWhen} onChange={(e) => setMeetWhen(e.target.value)} className="w-full rounded-lg border border-line bg-surface-2/40 px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-subtle">Duration</label>
                <select value={meetDur} onChange={(e) => setMeetDur(Number(e.target.value))} className="w-full rounded-lg border border-line bg-surface-2/40 px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100">
                  {[15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
              <button type="button" onClick={scheduleMeeting} disabled={meetBusy || !meetWhen} className="brand-gradient flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 disabled:opacity-70">
                {meetBusy ? <Loader2 size={15} className="animate-spin" /> : <CalendarCheck size={15} />} {meetBusy ? 'Scheduling…' : 'Confirm meeting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* reclassify modal */}
      {reclassOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0f0f0e]/55 backdrop-blur-sm" onClick={() => setReclassOpen(false)} />
          <div className="relative z-10 w-full max-w-[440px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
              <span className="brand-gradient flex h-7 w-7 items-center justify-center rounded-lg text-white"><Tag size={14} /></span>
              <h2 className="text-[14px] font-bold text-ink">Reclassify reply</h2>
              <button type="button" onClick={() => setReclassOpen(false)} className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-2"><X size={15} /></button>
            </div>
            <div className="space-y-2 p-5">
              <p className="rounded-lg bg-surface-2/60 p-3 text-[12.5px] italic text-ink">“{selected.body}”</p>
              {([
                { cls: 'INTERESTED' as Cls, label: 'Interested', hint: 'Hot — reply + book a call', color: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
                { cls: 'FOLLOW_UP' as Cls, label: 'Not now', hint: 'Nurture later', color: 'text-amber-700 border-amber-200 hover:bg-amber-50' },
                { cls: 'NOT_INTERESTED' as Cls, label: 'Not interested', hint: 'Disqualify', color: 'text-rose-700 border-rose-200 hover:bg-rose-50' },
                { cls: 'UNSUBSCRIBE' as Cls, label: 'Unsubscribe', hint: 'Suppress (compliance)', color: 'text-ink-muted border-line hover:bg-surface-2' },
              ]).map((o) => (
                <button key={o.cls} type="button" disabled={busyClass} onClick={() => setClass(o.cls)} className={`flex w-full items-center justify-between rounded-xl border bg-surface px-3.5 py-2.5 text-left transition-colors disabled:opacity-60 ${o.color}`}>
                  <span><span className="block text-[13px] font-bold">{o.label}</span><span className="block text-[11.5px] text-ink-subtle">{o.hint}</span></span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* M15-3: handoff package drawer */}
      {handoffOpen && selected && <HandoffPanel params={{ replyMessageId: selected.id }} onClose={() => setHandoffOpen(false)} onChange={() => void load()} />}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[12.5px] font-semibold text-ink shadow-lg">
          <span className="brand-gradient flex h-6 w-6 items-center justify-center rounded-lg text-white"><CheckCircle2 size={12} /></span>
          {toast}
        </div>
      )}
    </>
  );
}
