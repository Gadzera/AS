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
  green:  'bg-green-500/10  text-green-400  border border-green-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  red:    'bg-red-500/10    text-red-400    border border-red-500/20',
  blue:   'bg-blue-500/10   text-blue-400   border border-blue-500/20',
  gray:   'bg-gray-500/10   text-gray-400   border border-gray-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  indigo: 'bg-brand-500/10  text-brand-400  border border-brand-500/20',
};

const dotColors: Record<BadgeVariant, string> = {
  green:  'bg-green-400',
  yellow: 'bg-yellow-400',
  red:    'bg-red-400',
  blue:   'bg-blue-400',
  gray:   'bg-gray-400',
  purple: 'bg-purple-400',
  indigo: 'bg-brand-400',
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
    HOT:         { variant: 'red',    label: 'Hot', dot: true },
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
  const variant: BadgeVariant = score >= 70 ? 'green' : score >= 40 ? 'yellow' : score > 0 ? 'red' : 'gray';
  return (
    <span className={clsx(
      'inline-flex items-center justify-center w-9 h-6 rounded-md text-xs font-bold tabular-nums',
      score >= 70 ? 'bg-green-500/15 text-green-400' :
      score >= 40 ? 'bg-yellow-500/15 text-yellow-400' :
      score > 0  ? 'bg-red-500/15 text-red-400' :
                   'bg-gray-500/15 text-gray-500'
    )}>
      {score}
    </span>
  );
}
