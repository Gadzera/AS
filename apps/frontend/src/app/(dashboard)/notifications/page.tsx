'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notificationsApi, type Notification, type NotificationType } from '@/lib/api';
import Topbar from '@/components/layout/Topbar';
import Button from '@/components/ui/Button';
import DigestPanel from '@/components/notifications/DigestPanel';
import { useToast } from '@/components/ui/Toast';
import { Bell, AtSign, MessageSquareReply, Info, CheckSquare, UserPlus, CheckCheck, Inbox, ArrowUpRight, Sparkles, Lock } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   Notification Center (/notifications) — PER-USER (M22-1). Уведомления mentions/
   replies/system; read-state у каждого пользователя свой. Tasks/Assignments — в
   модели, но без fire-site → таб disabled (честно, не harness). GET/PATCH/read-all
   /api/notifications.
   ────────────────────────────────────────────────────────────────────────── */

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  MENTION: <AtSign size={14} />, REPLY: <MessageSquareReply size={14} />, SYSTEM: <Info size={14} />, TASK_ASSIGNED: <CheckSquare size={14} />, RECORD_ASSIGNED: <UserPlus size={14} />,
};
const TYPE_TONE: Record<NotificationType, string> = {
  MENTION: 'bg-brand-50 text-brand-600', REPLY: 'bg-violet-50 text-violet-600', SYSTEM: 'bg-surface-2 text-ink-muted', TASK_ASSIGNED: 'bg-emerald-50 text-emerald-600', RECORD_ASSIGNED: 'bg-sky-50 text-sky-600',
};
const TABS: { key: string; label: string; type?: NotificationType }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'MENTION', label: 'Mentions', type: 'MENTION' },
  { key: 'REPLY', label: 'Replies', type: 'REPLY' },
  { key: 'SYSTEM', label: 'System', type: 'SYSTEM' },
  { key: 'TASK_ASSIGNED', label: 'Tasks', type: 'TASK_ASSIGNED' },
  { key: 'RECORD_ASSIGNED', label: 'Assignments', type: 'RECORD_ASSIGNED' },
];

function timeAgo(iso: string): string {
  const d = (new Date().getTime() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [liveTypes, setLiveTypes] = useState<NotificationType[]>(['MENTION', 'REPLY', 'SYSTEM']);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    notificationsApi.list(filter === 'ALL' ? undefined : filter).then((r) => { setItems(r.notifications); setCounts(r.counts); setLiveTypes(r.liveTypes); }).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); window.dispatchEvent(new Event('notifications:refresh')); /* eslint-disable-next-line */ }, [filter]);

  async function markRead(n: Notification) {
    setBusyId(n.id);
    try { await notificationsApi.markRead(n.id, true); reload(); window.dispatchEvent(new Event('notifications:refresh')); }
    catch { toast.error('Could not update'); } finally { setBusyId(null); }
  }
  async function readAll() {
    try { const r = await notificationsApi.readAll(); reload(); window.dispatchEvent(new Event('notifications:refresh')); toast.success('Marked read', `${r.updated} notification(s)`); }
    catch { toast.error('Could not mark read'); }
  }
  function open(n: Notification) {
    if (!n.readAt) notificationsApi.markRead(n.id, true).then(() => window.dispatchEvent(new Event('notifications:refresh'))).catch(() => {});
    // deep-link: record-уведомления (mention/reply) → Data Hub с открытой записью; лиды → Lead 360
    if (n.entityType === 'record' && n.entityId) router.push(`/data?record=${encodeURIComponent(n.entityId)}`);
    else if (n.entityType === 'lead' && n.entityId) router.push(`/leads/${n.entityId}`);
    else if (n.leadId) router.push(`/leads/${n.leadId}`);
  }

  const unreadTotal = counts.ALL ?? 0;

  return (
    <>
      <Topbar title="Notifications" subtitle="Command · mentions, replies & handoffs" icon={<Bell size={18} strokeWidth={1.85} />} />

      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface/70 px-4">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted"><Bell size={13} className="text-brand-600" /> {unreadTotal} unread</span>
        {unreadTotal > 0 && <Button size="sm" variant="secondary" className="ml-auto" onClick={readAll}><CheckCheck size={14} /> Mark all read</Button>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-3">
          {/* M22-2: email-дайджест (per-user, access-filtered, honest no-SMTP) + demo-capabilities */}
          <DigestPanel />

          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const disabled = !!t.type && !liveTypes.includes(t.type);
              return (
                <button key={t.key} type="button" disabled={disabled} onClick={() => !disabled && setFilter(t.key)}
                  title={disabled ? 'Coming when Tasks/Assignments are wired' : undefined}
                  className={['inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors', disabled ? 'cursor-not-allowed bg-surface-2/50 text-ink-subtle/60' : filter === t.key ? 'bg-brand-600 text-white shadow-brand' : 'bg-surface-2 text-ink-muted hover:bg-surface-2/70'].join(' ')}>
                  {disabled && <Lock size={10} />}{t.label}{t.key !== 'ALL' && counts[t.key] ? ` · ${counts[t.key]}` : ''}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
              <span className="brand-gradient mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-brand"><Inbox size={22} /></span>
              <p className="text-[15px] font-extrabold text-ink">You’re all caught up</p>
              <p className="mx-auto mt-1 max-w-md text-[12.5px] text-ink-muted">Mentions (@you on a record), replies to your comments, and system handoffs show up here. Read-state is yours alone — marking read doesn’t affect teammates.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((n) => {
                const unread = !n.readAt;
                return (
                  <div key={n.id} className={['rounded-xl border bg-surface p-3.5 shadow-xs transition-colors', unread ? 'border-brand-200' : 'border-line'].join(' ')}>
                    <div className="flex items-start gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TYPE_TONE[n.type]}`}>{TYPE_ICON[n.type]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13.5px] font-bold text-ink">{n.title}</p>
                          {unread && <span className="h-2 w-2 rounded-full bg-brand-500" title="Unread" />}
                        </div>
                        {n.body && <p className="mt-0.5 line-clamp-2 text-[12px] leading-4 text-ink-muted">{n.body}</p>}
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-subtle">
                          <span className="font-semibold uppercase tracking-[0.04em]">{n.type.replace('_', ' ').toLowerCase()}</span>
                          {n.leadName && <span>· {n.leadName}</span>}
                          <span>· {timeAgo(n.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
                      {(n.entityId || n.leadId) && (
                        <button type="button" onClick={() => open(n)} className="inline-flex h-7 items-center gap-1 rounded-lg bg-brand-600 px-2.5 text-[11.5px] font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5"><ArrowUpRight size={12} /> Open</button>
                      )}
                      {unread && <button type="button" disabled={busyId === n.id} onClick={() => markRead(n)} className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2.5 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-2 disabled:opacity-50"><CheckCheck size={12} /> Mark read</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
            <Sparkles size={13} className="text-brand-500" /> @mention a teammate on a record to notify them (only if they can access it). Repeat events are de-duplicated — one event never creates two notifications.
          </p>
        </div>
      </div>
    </>
  );
}
