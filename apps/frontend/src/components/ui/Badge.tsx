import clsx from 'clsx';
import type { LeadStatus, CampaignStatus } from '@/types';

type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple' | 'indigo';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variants: Record<BadgeVariant, string> = {
  green:  'bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]',
  yellow: 'bg-[#fffbeb] text-[#b45309] border border-[#fde68a]',
  red:    'bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]',
  blue:   'bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]',
  gray:   'bg-surface-2  text-ink-muted  border border-line',
  purple: 'bg-[#faf5ff] text-[#7e22ce] border border-[#e9d5ff]',
  indigo: 'bg-brand-50   text-brand-700  border border-brand-200',
};

const dotColors: Record<BadgeVariant, string> = {
  green:  'bg-[#10b981]',
  yellow: 'bg-[#d97706]',
  red:    'bg-[#dc2626]',
  blue:   'bg-[#2563eb]',
  gray:   'bg-ink-subtle',
  purple: 'bg-[#9333ea]',
  indigo: 'bg-brand-600',
};

export default function Badge({ variant = 'gray', children, className, dot }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />}
      {children}
    </span>
  );
}

export function LeadStatusBadge({ status }: { status: LeadStatus | string }) {
  const map: Record<string, { variant: BadgeVariant; label: string; dot?: boolean }> = {
    NEW:         { variant: 'blue',   label: 'New',         dot: true },
    CONTACTED:   { variant: 'yellow', label: 'Contacted',   dot: true },
    REPLIED:     { variant: 'purple', label: 'Replied',     dot: true },
    HOT:         { variant: 'red',    label: 'Hot',         dot: true },
    CONVERTED:   { variant: 'green',  label: 'Converted',   dot: true },
    LOST:        { variant: 'gray',   label: 'Lost' },
    UNSUBSCRIBED:{ variant: 'gray',   label: 'Unsubscribed' },
  };
  const cfg = map[status] ?? { variant: 'gray' as BadgeVariant, label: status };
  return <Badge variant={cfg.variant} dot={cfg.dot}>{cfg.label}</Badge>;
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus | string }) {
  const map: Record<string, { variant: BadgeVariant; label: string; dot?: boolean }> = {
    DRAFT:     { variant: 'gray',   label: 'Draft' },
    ACTIVE:    { variant: 'green',  label: 'Active',    dot: true },
    PAUSED:    { variant: 'yellow', label: 'Paused',    dot: true },
    COMPLETED: { variant: 'blue',   label: 'Completed', dot: true },
  };
  const cfg = map[status] ?? { variant: 'gray' as BadgeVariant, label: status };
  return <Badge variant={cfg.variant} dot={cfg.dot}>{cfg.label}</Badge>;
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={clsx(
      'inline-flex items-center justify-center min-w-[36px] h-6 px-1.5 rounded-md text-xs font-semibold tabular-nums',
      score >= 70 ? 'bg-[#ecfdf5] text-[#047857]' :
      score >= 40 ? 'bg-[#fffbeb] text-[#b45309]' :
      score > 0  ? 'bg-[#fef2f2] text-[#b91c1c]' :
                   'bg-surface-2 text-ink-subtle'
    )}>
      {score}
    </span>
  );
}
