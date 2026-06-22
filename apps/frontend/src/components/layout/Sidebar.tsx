'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import {
  Gauge,
  Bell,
  Radar,
  Send,
  Workflow,
  Phone,
  Inbox,
  CalendarCheck,
  FlaskConical,
  BookOpenCheck,
  GraduationCap,
  BarChart3,
  LayoutDashboard,
  Database,
  ListChecks,
  Settings,
  Search,
  ChevronDown,
  LogOut,
  Sparkles,
  Zap,
  ArrowUpRight,
  Mail,
} from 'lucide-react';
import { logout, getStoredUser } from '@/lib/auth';
import { authApi, outreachApi, notificationsApi } from '@/lib/api';
import { getAiCreditBalance } from '@/lib/crmApi';
import { paletteStore } from '@/lib/paletteStore';
import { useEffect, useState, type ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** короткий бейдж справа (число входящих/очередь) */
  badge?: string;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

// Навигация построена ВОКРУГ AI-SDR-воркфлоу (не вокруг CRM-таблиц как у Attio).
// Часть разделов пока ведёт на существующие роуты / заглушки — экраны строятся по очереди.
const navGroups: NavGroup[] = [
  {
    heading: 'Command',
    items: [
      { href: '/dashboard', label: 'Agent Cockpit', icon: <Gauge size={16} strokeWidth={1.85} /> },
      { href: '/ask', label: 'Ask AISDR', icon: <Sparkles size={16} strokeWidth={1.85} /> },
      { href: '/notifications', label: 'Notifications', icon: <Bell size={16} strokeWidth={1.85} /> },
    ],
  },
  {
    heading: 'Outbound motion',
    items: [
      { href: '/pipeline', label: 'Pipeline Radar', icon: <Radar size={16} strokeWidth={1.85} /> },
      { href: '/campaigns', label: 'Outreach Studio', icon: <Send size={16} strokeWidth={1.85} /> },
      { href: '/sequences', label: 'Sequences', icon: <Workflow size={16} strokeWidth={1.85} /> },
      { href: '/workflows', label: 'Workflows', icon: <Zap size={16} strokeWidth={1.85} /> },
      { href: '/calls', label: 'Calls', icon: <Phone size={16} strokeWidth={1.85} /> },
      { href: '/emails', label: 'Emails', icon: <Mail size={16} strokeWidth={1.85} /> },
      { href: '/replies', label: 'Replies', icon: <Inbox size={16} strokeWidth={1.85} />, badge: '5' },
      { href: '/meetings', label: 'Meetings', icon: <CalendarCheck size={16} strokeWidth={1.85} /> },
    ],
  },
  {
    heading: 'Intelligence',
    items: [
      { href: '/research', label: 'Research Lab', icon: <FlaskConical size={16} strokeWidth={1.85} /> },
      { href: '/playbooks', label: 'Playbooks', icon: <BookOpenCheck size={16} strokeWidth={1.85} /> },
      { href: '/learning', label: 'Learning', icon: <GraduationCap size={16} strokeWidth={1.85} /> },
      { href: '/reports', label: 'Reports', icon: <BarChart3 size={16} strokeWidth={1.85} /> },
    ],
  },
  {
    heading: 'Foundation',
    items: [
      { href: '/data', label: 'Data Hub', icon: <Database size={16} strokeWidth={1.85} /> },
      { href: '/dashboards', label: 'Dashboards', icon: <LayoutDashboard size={16} strokeWidth={1.85} /> },
      { href: '/lists', label: 'Lists', icon: <ListChecks size={16} strokeWidth={1.85} /> },
      { href: '/settings', label: 'Settings', icon: <Settings size={16} strokeWidth={1.85} /> },
    ],
  },
];

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle px-3 mb-1.5 mt-5 first:mt-2">
      {children}
    </p>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [planLabel, setPlanLabel] = useState('STARTER PLAN');
  const [credits, setCredits] = useState<number | null>(null);
  const [replyCount, setReplyCount] = useState<number | null>(null);
  const [notifCount, setNotifCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    // Живой счётчик входящих ответов для бейджа Replies.
    outreachApi
      .replies()
      .then((r) => { if (mounted) setReplyCount(r.total ?? 0); })
      .catch(() => {});
    // Живой счётчик непрочитанных уведомлений (handoff-очередь). Обновляется по событию.
    const loadNotif = () => notificationsApi.count().then((r) => { if (mounted) setNotifCount(r.unread); }).catch(() => {});
    loadNotif();
    const onNotif = () => loadNotif();
    window.addEventListener('notifications:refresh', onNotif);
    // Мгновенно из кеша, затем актуализируем из API — единый источник правды с Settings.
    const cached = getStoredUser()?.org?.plan;
    if (cached) setPlanLabel(`${cached} PLAN`);
    authApi
      .me()
      .then((u) => {
        if (mounted && u?.org?.plan) setPlanLabel(`${u.org.plan} PLAN`);
      })
      .catch(() => {});
    // Реальный баланс AI-кредитов (M2) — тот же источник, что Settings/биллинг.
    const loadCredits = () =>
      getAiCreditBalance()
        .then((b) => { if (mounted) setCredits(b.balance); })
        .catch(() => {});
    loadCredits();
    // Любой AI-прогон (Data Hub, record drawer…) шлёт это событие → обновляем баланс.
    const onRefresh = () => loadCredits();
    window.addEventListener('credits:refresh', onRefresh);
    return () => {
      mounted = false;
      window.removeEventListener('credits:refresh', onRefresh);
      window.removeEventListener('notifications:refresh', onNotif);
    };
  }, []);

  return (
    <aside className="sticky top-0 h-screen w-[244px] shrink-0 flex flex-col bg-[var(--sidebar)] border-r border-line/80">
      <div className="px-2.5 pt-3">
        <button
          type="button"
          className="w-full h-12 flex items-center gap-2.5 px-2 rounded-xl hover:bg-surface-2 transition-colors duration-150"
        >
          <span className="brand-gradient w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-brand ring-1 ring-white/40">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </span>
          <span className="text-[14px] font-bold tracking-[-0.01em] text-ink leading-tight truncate flex-1 text-left">
            AISDR Agent
          </span>
          <ChevronDown size={14} strokeWidth={2} className="text-ink-subtle shrink-0" />
        </button>
      </div>

      <div className="px-2.5 mt-2">
        <div className="h-9 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => router.push('/ask')}
            className="flex-1 h-9 flex items-center gap-2 px-2.5 rounded-lg border border-line bg-surface shadow-xs hover:bg-surface-2 hover:border-line-strong transition-all duration-150 text-[13px] text-ink-muted font-medium"
          >
            <Sparkles size={14} strokeWidth={1.85} className="text-brand-500" />
            <span className="flex-1 text-left truncate">Ask the agent</span>
            <ArrowUpRight size={13} strokeWidth={2} className="text-ink-subtle shrink-0" />
          </button>
          <button
            type="button"
            aria-label="Search"
            onClick={() => paletteStore.open()}
            className="w-9 h-9 rounded-lg border border-line bg-surface flex items-center justify-center text-ink-subtle shadow-xs hover:bg-surface-2 hover:text-ink hover:border-line-strong transition-all duration-150"
          >
            <Search size={14} strokeWidth={1.85} />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-3">
        {navGroups.map((group) => (
          <div key={group.heading}>
            <SectionHeading>{group.heading}</SectionHeading>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
                // Бейджи Replies и Notifications — живые счётчики; остальные — статические.
                const badge =
                  item.href === '/replies'
                    ? replyCount != null
                      ? replyCount > 0
                        ? String(replyCount)
                        : undefined
                      : item.badge
                    : item.href === '/notifications'
                      ? notifCount != null && notifCount > 0
                        ? String(notifCount)
                        : undefined
                      : item.badge;
                return (
                  <li key={item.href} className="relative">
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-lg sidebar-active-gradient ring-1 ring-inset ring-brand-100 shadow-xs"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <Link
                      href={item.href}
                      className={clsx(
                        'group relative flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13.5px] font-medium transition-colors duration-150',
                        isActive
                          ? 'text-ink before:absolute before:left-0 before:top-2.5 before:h-4 before:w-0.5 before:rounded-full before:bg-brand-600'
                          : 'text-ink-muted hover:text-ink hover:bg-surface-2',
                      )}
                    >
                      <span className={clsx('shrink-0 transition-colors', isActive ? 'text-brand-600' : 'text-ink-subtle group-hover:text-brand-600')}>
                        {item.icon}
                      </span>
                      <span className="truncate flex-1">{item.label}</span>
                      {badge && (
                        <span className="shrink-0 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-2.5 pb-3 pt-2">
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface/80 px-3 py-2.5 shadow-xs">
          <span className="brand-gradient w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold text-white shadow-sm ring-1 ring-white/50">
            AI
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.04em] text-brand-700 leading-none">
              {planLabel}
            </p>
            <p className="text-[12px] text-ink-muted mt-1 leading-none truncate">
              {credits === null ? '— credits' : `${credits.toLocaleString('en-US')} credits left`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="group mt-1.5 w-full h-10 flex items-center gap-2.5 px-3 rounded-lg text-[13.5px] font-medium text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors duration-150"
        >
          <LogOut size={16} strokeWidth={1.85} className="text-ink-subtle group-hover:text-rose-500 transition-colors" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
