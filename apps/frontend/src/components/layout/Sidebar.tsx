'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Sparkles,
  Settings,
  Search,
  Slash,
  ChevronDown,
  LogOut,
  Flame,
  MessageSquareReply,
  Snowflake,
  List,
} from 'lucide-react';
import { logout } from '@/lib/auth';
import type { ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const recordsNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} strokeWidth={1.75} /> },
  { href: '/leads',     label: 'Leads',     icon: <Users          size={16} strokeWidth={1.75} /> },
  { href: '/campaigns', label: 'Campaigns', icon: <Megaphone      size={16} strokeWidth={1.75} /> },
  { href: '/outreach',  label: 'AI Outreach', icon: <Sparkles     size={16} strokeWidth={1.75} /> },
  { href: '/settings',  label: 'Settings',  icon: <Settings       size={16} strokeWidth={1.75} /> },
];

const listsNav: { key: string; label: string; icon: ReactNode }[] = [
  { key: 'hot',     label: 'Hot Leads',     icon: <Flame              size={16} strokeWidth={1.75} /> },
  { key: 'replied', label: 'Replied',       icon: <MessageSquareReply size={16} strokeWidth={1.75} /> },
  { key: 'cold',    label: 'Cold Outreach', icon: <Snowflake          size={16} strokeWidth={1.75} /> },
  { key: 'all',     label: 'All lists',     icon: <List               size={16} strokeWidth={1.75} /> },
];

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8a80] px-3 mb-1 mt-4">
      {children}
    </p>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 h-screen w-[240px] shrink-0 flex flex-col bg-[#f8f7f5] border-r border-[#e3e3dd]">
      <div className="px-2 pt-3">
        <button
          type="button"
          className="w-full h-11 flex items-center gap-2.5 px-2 rounded-lg hover:bg-[#ebebe6] transition-colors duration-100"
        >
          <span className="w-7 h-7 rounded-md bg-[#0f0f0e] flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          <span className="text-[14px] font-semibold text-[#1a1a1a] leading-tight truncate flex-1 text-left">
            AI SDR Agent
          </span>
          <ChevronDown size={14} strokeWidth={2} className="text-[#8a8a80] shrink-0" />
        </button>
      </div>

      <div className="px-2 mt-2">
        <div className="h-9 flex items-center gap-1">
          <button
            type="button"
            className="flex-1 h-9 flex items-center gap-2 px-2 rounded-md hover:bg-[#ebebe6] transition-colors duration-100 text-[13.5px] text-[#5e5e58] font-medium"
          >
            <Search size={14} strokeWidth={1.75} className="text-[#8a8a80]" />
            <span className="flex-1 text-left">Quick actions</span>
            <span className="text-[11px] bg-[#ebebe6] rounded-md px-1.5 py-0.5 font-medium text-[#5e5e58] tracking-tight">
              {String.fromCharCode(8984)}K
            </span>
          </button>
          <button
            type="button"
            aria-label="Search"
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#8a8a80] hover:bg-[#ebebe6] hover:text-[#1a1a1a] transition-colors duration-100"
          >
            <Search size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Slash commands"
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#8a8a80] hover:bg-[#ebebe6] hover:text-[#1a1a1a] transition-colors duration-100"
          >
            <Slash size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        <SectionHeading>Records</SectionHeading>
        <ul className="space-y-0.5">
          {recordsNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href} className="relative">
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-md bg-white shadow-[0_1px_2px_rgba(15,15,14,0.05)]"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <Link
                  href={item.href}
                  className={clsx(
                    'relative flex items-center gap-2.5 px-3 h-8 rounded-md text-[13.5px] font-medium transition-colors duration-100',
                    isActive
                      ? 'text-[#1a1a1a]'
                      : 'text-[#5e5e58] hover:text-[#1a1a1a] hover:bg-[#ebebe6]'
                  )}
                >
                  <span className={clsx('shrink-0', isActive ? 'text-[#4f46e5]' : 'text-[#8a8a80]')}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <SectionHeading>Lists</SectionHeading>
        <ul className="space-y-0.5">
          {listsNav.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-[13.5px] font-medium text-[#5e5e58] hover:text-[#1a1a1a] hover:bg-[#ebebe6] transition-colors duration-100"
              >
                <span className="shrink-0 text-[#8a8a80]">{item.icon}</span>
                <span className="truncate text-left">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-2 pb-3 pt-2">
        <div className="h-14 px-3 flex flex-col justify-center rounded-md border border-[#e3e3dd] bg-white">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-[#4f46e5] leading-none">
            STARTER PLAN
          </p>
          <p className="text-[12px] text-[#5e5e58] mt-1.5 leading-none">
            500 leads &middot; 3 campaigns
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="mt-1.5 w-full h-10 flex items-center gap-2.5 px-3 rounded-md text-[13.5px] font-medium text-[#5e5e58] hover:text-[#1a1a1a] hover:bg-[#ebebe6] transition-colors duration-100"
        >
          <LogOut size={16} strokeWidth={1.75} className="text-[#8a8a80]" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
