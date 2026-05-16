'use client';

import { getStoredUser } from '@/lib/auth';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { api } from '@/lib/api';
import type { User } from '@/types';

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

function sanitizeNotifLink(link: string | undefined): string | undefined {
  if (!link) return undefined;
  // Allow only relative paths and http/https URLs
  if (link.startsWith('/')) return link;
  try {
    const parsed = new URL(link);
    return ['http:', 'https:'].includes(parsed.protocol) ? link : undefined;
  } catch {
    return undefined;
  }
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const PLAN_COLORS: Record<string, string> = {
  FREE:       'bg-gray-500/10 text-gray-500 border-gray-500/20',
  STARTER:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PRO:        'bg-brand-500/10 text-brand-400 border-brand-500/20',
  ENTERPRISE: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const NOTIF_DOT: Record<string, string> = {
  HOT_LEAD:           'bg-red-500',
  REPLY_RECEIVED:     'bg-blue-500',
  CAMPAIGN_COMPLETED: 'bg-green-500',
  ONBOARDING:         'bg-brand-500',
  REFERRAL_JOINED:    'bg-purple-500',
  UPGRADE_NUDGE:      'bg-yellow-500',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} д назад`;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifTotal, setNotifTotal] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    // Initial fetch to populate notifications immediately
    fetchNotifications();

    // SSE for real-time updates — EventSource cannot send custom headers,
    // so we pass the JWT as a query param.
    const token = localStorage.getItem('ai_sdr_token') ?? '';
    if (!token) {
      // Not logged in — fall back to polling
      const interval = setInterval(fetchNotifications, 30_000);
      return () => clearInterval(interval);
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
    const es = new EventSource(
      `${apiBase}/api/notifications/stream?token=${encodeURIComponent(token)}`
    );

    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    es.addEventListener('notification', (e: MessageEvent) => {
      try {
        const notif = JSON.parse(e.data) as Notification;
        setNotifications(prev => [notif, ...prev.slice(0, 49)]);
        setUnreadCount(prev => prev + 1);
      } catch { /* ignore malformed event */ }
    });

    es.addEventListener('ping', () => { /* keepalive — no action needed */ });

    es.onerror = () => {
      es.close();
      // SSE unavailable — fall back to 30-second polling
      if (!fallbackInterval) {
        fallbackInterval = setInterval(fetchNotifications, 30_000);
      }
    };

    return () => {
      es.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function fetchNotifications() {
    try {
      const r = await api.get('/notifications');
      setNotifications(r.data.notifications ?? []);
      setUnreadCount(r.data.unreadCount ?? 0);
      setNotifTotal(r.data.total ?? 0);
    } catch { /* not logged in yet */ }
  }

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }

  async function deleteNotif(id: string) {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => {
        const wasUnread = notifications.find(n => n.id === id && !n.read);
        return wasUnread ? Math.max(0, prev - 1) : prev;
      });
    } catch { /* ignore */ }
  }

  const plan = user?.org?.plan ?? 'FREE';
  const planColor = PLAN_COLORS[plan] ?? PLAN_COLORS.FREE;

  return (
    <header className="h-14 bg-[#080b10]/80 backdrop-blur-md border-b border-gray-800/60 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Title */}
      <div>
        {title && (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="text-[15px] font-semibold text-white leading-tight">{title}</h1>
            {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
          </motion.div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <div className="relative" ref={dropdownRef}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onClick={() => { setNotifOpen(v => !v); if (!notifOpen && unreadCount > 0) markAllRead(); }}
            className="relative p-2 text-gray-600 hover:text-gray-300 rounded-lg hover:bg-gray-800/60 transition-colors"
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-brand-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-0.5 ring-1 ring-[#080b10]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 bg-[#0d1117] border border-gray-800 rounded-xl shadow-xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                  <span className="text-sm font-semibold text-white">Уведомления</span>
                  {notifications.some(n => !n.read) && (
                    <button onClick={markAllRead} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                      Прочитать все
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 text-sm">Нет уведомлений</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={clsx(
                          'flex gap-3 px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors group',
                          !n.read && 'bg-brand-500/5'
                        )}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${NOTIF_DOT[n.type] ?? 'bg-gray-500'}`} />
                        <div className="flex-1 min-w-0">
                          {n.link ? (
                            <a href={sanitizeNotifLink(n.link)} onClick={() => setNotifOpen(false)} className="block">
                              <p className="text-[13px] font-medium text-white truncate">{n.title}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                            </a>
                          ) : (
                            <>
                              <p className="text-[13px] font-medium text-white truncate">{n.title}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                            </>
                          )}
                          <p className="text-[10px] text-gray-600 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        <button
                          onClick={() => deleteNotif(n.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-300 transition-all flex-shrink-0 mt-0.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {notifTotal > notifications.length && (
                  <div className="px-4 py-2.5 border-t border-gray-800 text-center">
                    <span className="text-xs text-gray-500">
                      Showing {notifications.length} of {notifTotal} —{' '}
                      <a href="/settings" className="text-brand-400 hover:text-brand-300 transition-colors">
                        View all
                      </a>
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-800 mx-1" />

        {/* User info */}
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex flex-col items-end">
              <p className="text-[13px] font-medium text-gray-200 leading-tight">{user.name}</p>
              <span className={clsx(
                'text-[10px] font-semibold px-1.5 py-0 rounded-full border leading-5',
                planColor
              )}>
                {plan}
              </span>
            </div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="relative w-8 h-8 rounded-full cursor-pointer"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 opacity-20 blur-sm" />
              <div className="relative w-8 h-8 bg-gradient-to-br from-brand-500 to-purple-600 rounded-full flex items-center justify-center shadow-glow-sm">
                <span className="text-white text-[11px] font-bold tracking-wide">
                  {getInitials(user.name)}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </header>
  );
}
