import clsx from 'clsx';
import type { LeadStatus, CampaignStatus } from '@/types';

type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-600',
  purple: 'bg-purple-100 text-purple-800',
};

export default function Badge({ variant = 'gray', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const map: Record<LeadStatus, { variant: BadgeVariant; label: string }> = {
    NEW: { variant: 'blue', label: 'New' },
    CONTACTED: { variant: 'yellow', label: 'Contacted' },
    REPLIED: { variant: 'purple', label: 'Replied' },
    HOT: { variant: 'red', label: 'Hot' },
    CONVERTED: { variant: 'green', label: 'Converted' },
    LOST: { variant: 'gray', label: 'Lost' },
    UNSUBSCRIBED: { variant: 'gray', label: 'Unsubscribed' },
  };

  const { variant, label } = map[status] ?? { variant: 'gray', label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const map: Record<CampaignStatus, { variant: BadgeVariant; label: string }> = {
    DRAFT: { variant: 'gray', label: 'Draft' },
    ACTIVE: { variant: 'green', label: 'Active' },
    PAUSED: { variant: 'yellow', label: 'Paused' },
    COMPLETED: { variant: 'blue', label: 'Completed' },
  };

  const { variant, label } = map[status] ?? { variant: 'gray', label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

export function ScoreBadge({ score }: { score: number }) {
  const variant: BadgeVariant = score >= 70 ? 'green' : score >= 40 ? 'yellow' : score > 0 ? 'red' : 'gray';
  return <Badge variant={variant}>{score}</Badge>;
}
