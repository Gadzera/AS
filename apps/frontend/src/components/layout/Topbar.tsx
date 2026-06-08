'use client';

import { type ReactNode } from 'react';
import { Mail, MoreHorizontal, Plus } from 'lucide-react';
import clsx from 'clsx';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { composeStore } from '@/lib/composeStore';

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

const DEFAULT_TEAM: Array<{ name: string }> = [
  { name: 'Marisa McGill' },
  { name: 'Alex Lee' },
  { name: 'Priya Nayar' },
];

function DefaultActions() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center -space-x-1.5 mr-1">
        {DEFAULT_TEAM.map((m) => (
          <Avatar
            key={m.name}
            name={m.name}
            size={20}
            className="ring-2 ring-white"
            title={m.name}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label="Add"
        className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors duration-100"
      >
        <Plus size={16} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label="More"
        className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors duration-100"
      >
        <MoreHorizontal size={16} strokeWidth={1.75} />
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
  const crumbs =
    breadcrumb && breadcrumb.length > 0
      ? breadcrumb
      : subtitle && title
        ? [title, subtitle]
        : title
          ? [title]
          : [];

  return (
    <header
      className={clsx(
        'sticky top-0 z-20 h-11 bg-white border-b border-[var(--border)] flex items-center justify-between px-4',
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
                      'text-[16px] leading-6 truncate',
                      isLast
                        ? 'font-semibold text-[var(--text)]'
                        : 'font-medium text-[var(--text-muted)]',
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
        {actions ?? <DefaultActions />}
      </div>
    </header>
  );
}
