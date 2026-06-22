'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Mail, Plus, Sparkles, X } from 'lucide-react';
import clsx from 'clsx';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { composeStore } from '@/lib/composeStore';
import { paletteStore } from '@/lib/paletteStore';
import { teamApi } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import AskAssistant from '@/components/ask/AskAssistant';

export interface TopbarProps {
  /** Optional page-level icon (lucide). Rendered at 16px. Pass a node, e.g. `<Users size={16} />` */
  icon?: ReactNode;
  /** Main page title (h2 16/24/600). Optional when only breadcrumbs are used. */
  title?: string;
  /** Optional breadcrumb chain — full path including current. e.g. `['Companies', 'Cosme']` */
  breadcrumb?: string[];
  /** Legacy subtitle slot — renders as the second breadcrumb segment if `breadcrumb` is not set. */
  subtitle?: string;
  /** Custom actions area on the right; if omitted, default Attio-style cluster is shown. */
  actions?: ReactNode;
  /** Optional color hint for the page icon, e.g. `var(--brand)` */
  iconColor?: string;
  className?: string;
}

function DefaultActions() {
  // Реальные участники организации (а не хардкод-имена).
  const [team, setTeam] = useState<Array<{ name: string }>>([]);

  useEffect(() => {
    let mounted = true;
    teamApi
      .members()
      .then((r) => {
        if (!mounted) return;
        const names = (r.members ?? [])
          .map((m) => m.name || m.email)
          .filter(Boolean)
          .slice(0, 4)
          .map((name) => ({ name: name as string }));
        setTeam(names);
      })
      .catch(() => {
        // Фоллбэк — текущий пользователь из кеша.
        const u = getStoredUser();
        const name = u?.name || u?.email;
        if (mounted && name) setTeam([{ name }]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      {team.length > 0 && (
        <div className="flex items-center -space-x-1.5 mr-1">
          {team.map((m) => (
            <Avatar key={m.name} name={m.name} size={20} className="ring-2 ring-white" title={m.name} />
          ))}
        </div>
      )}
      <button
        type="button"
        aria-label="Quick actions"
        title="Quick actions (⌘K)"
        onClick={() => paletteStore.open()}
        className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors duration-100"
      >
        <Plus size={16} strokeWidth={1.75} />
      </button>
      <Button
        variant="primary"
        size="sm"
        onClick={() => composeStore.open()}
      >
        <Mail size={14} strokeWidth={1.75} />
        <span>Compose email</span>
      </Button>
    </div>
  );
}

export default function Topbar({
  icon,
  title,
  breadcrumb,
  subtitle,
  actions,
  iconColor,
  className,
}: TopbarProps) {
  const [askOpen, setAskOpen] = useState(false);
  const crumbs =
    breadcrumb && breadcrumb.length > 0
      ? breadcrumb
      : subtitle && title
        ? [title, subtitle]
        : title
          ? [title]
          : [];

  return (
    <>
    <header
      className={clsx(
        'sticky top-0 z-20 h-14 bg-surface/80 backdrop-blur border-b border-line flex items-center justify-between px-6',
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon && (
          <span
            className="inline-flex items-center shrink-0"
            style={iconColor ? { color: iconColor } : { color: 'var(--text-subtle)' }}
          >
            {icon}
          </span>
        )}
        {crumbs.length > 0 && (
          <h2 className="flex items-center gap-1.5 min-w-0">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <span key={`${c}-${i}`} className="flex items-center gap-1.5 min-w-0">
                  {i > 0 && (
                    <span className="text-[14px] text-[var(--text-subtle)] leading-none">/</span>
                  )}
                  <span
                    className={clsx(
                      'text-[18px] leading-6 truncate tracking-[-0.01em]',
                      isLast
                        ? 'font-bold text-ink'
                        : 'font-medium text-ink-muted',
                    )}
                  >
                    {c}
                  </span>
                </span>
              );
            })}
          </h2>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* M26-1: Ask AISDR — slide-over поверх текущего экрана (точка входа topbar) */}
        <button
          type="button"
          aria-label="Ask AISDR"
          title="Ask AISDR"
          onClick={() => setAskOpen(true)}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[12px] font-semibold text-brand-700 transition-colors hover:border-brand-200 hover:bg-brand-50"
        >
          <Sparkles size={14} strokeWidth={1.9} /> <span className="hidden sm:inline">Ask</span>
        </button>
        {actions ?? <DefaultActions />}
      </div>
    </header>

      {/* Slide-over Ask AISDR (поверх любого route, без навигации) */}
      {askOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-ink/20 backdrop-blur-[1px]" onClick={() => setAskOpen(false)} />
          <div className="relative flex h-full w-full max-w-[440px] flex-col bg-surface shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
              <span className="inline-flex items-center gap-2 text-[14px] font-bold text-ink"><span className="brand-gradient inline-flex h-7 w-7 items-center justify-center rounded-lg text-white"><Sparkles size={15} /></span> Ask AISDR</span>
              <button type="button" onClick={() => setAskOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"><X size={16} /></button>
            </div>
            <AskAssistant compact />
          </div>
        </div>
      )}
    </>
  );
}
