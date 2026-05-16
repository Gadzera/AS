'use client';

import { getStoredUser } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { User } from '@/types';

interface TopbarProps {
  title?: string;
  subtitle?: string;
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

export default function Topbar({ title, subtitle }: TopbarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

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
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onClick={() => setNotifOpen(v => !v)}
            className="relative p-2 text-gray-600 hover:text-gray-300 rounded-lg hover:bg-gray-800/60 transition-colors"
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {/* Dot indicator */}
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-500 rounded-full ring-1 ring-[#080b10]" />
          </motion.button>
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
