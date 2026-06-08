'use client';

import { Flame, Mail, MoreHorizontal, Plus, Star } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Dot from '@/components/ui/Dot';
import type { Lead, LeadStatus } from '@/types';

interface LeadHeaderProps {
  lead: Lead;
  onCompose?: () => void;
  onAddToCampaign?: () => void;
}

const STATUS_VARIANT: Record<LeadStatus, 'info' | 'warning' | 'brand' | 'danger' | 'success' | 'gray'> = {
  NEW:          'info',
  CONTACTED:    'warning',
  REPLIED:      'brand',
  HOT:          'danger',
  CONVERTED:    'success',
  LOST:         'gray',
  UNSUBSCRIBED: 'gray',
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  REPLIED: 'Replied',
  HOT: 'Hot',
  CONVERTED: 'Converted',
  LOST: 'Lost',
  UNSUBSCRIBED: 'Unsubscribed',
};

function scoreColor(score: number): { bg: string; ink: string } {
  if (score >= 80) return { bg: 'var(--tag-green)',  ink: 'var(--tag-green-ink)' };
  if (score >= 50) return { bg: 'var(--tag-yellow)', ink: 'var(--tag-yellow-ink)' };
  if (score > 0)   return { bg: 'var(--tag-orange)', ink: 'var(--tag-orange-ink)' };
  return { bg: 'var(--tag-gray)', ink: 'var(--tag-gray-ink)' };
}

function sourceLabel(source?: string | null): string {
  if (!source) return 'Manual';
  const s = source.toUpperCase();
  if (s === 'APOLLO') return 'Apollo';
  if (s === 'CSV' || s === 'CSV_IMPORT') return 'CSV';
  if (s === 'LINKEDIN') return 'LinkedIn';
  return source;
}

export default function LeadHeader({ lead, onCompose, onAddToCampaign }: LeadHeaderProps) {
  const fullName = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'Unnamed';
  const score = scoreColor(lead.score);
  const statusVariant = STATUS_VARIANT[lead.status as LeadStatus] ?? 'gray';
  const statusLabel = STATUS_LABEL[lead.status as LeadStatus] ?? lead.status;
  const isHot = lead.status === 'HOT';

  return (
    <div className="h-16 px-6 flex items-center gap-4 border-b border-[var(--border)] bg-white shrink-0">
      <Avatar name={fullName} size={40} />

      <div className="min-w-0 flex-1">
        <h1
          className="font-bold text-[var(--text)] truncate"
          style={{ fontSize: 20, lineHeight: '28px', letterSpacing: '-0.018em' }}
        >
          {fullName}
        </h1>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {/* status chip */}
          <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-sm bg-[var(--surface-2)] text-[12px] font-medium text-[var(--text)] leading-none">
            <Dot variant={statusVariant} size={6} />
            {statusLabel}
          </span>
          {/* score chip */}
          <span
            className="inline-flex items-center h-5 px-1.5 rounded-sm text-[12px] font-medium leading-none tabular-nums"
            style={{ backgroundColor: score.bg, color: score.ink }}
          >
            {lead.score}
          </span>
          {/* source tag */}
          <span className="inline-flex items-center h-5 px-1.5 rounded-sm bg-[var(--surface-2)] text-[12px] font-medium text-[var(--text-muted)] leading-none">
            {sourceLabel(lead.source)}
          </span>
          {/* HOT chip */}
          {isHot && (
            <span
              className="inline-flex items-center gap-1 h-5 px-1.5 rounded-sm text-[12px] font-medium leading-none"
              style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}
            >
              <Flame size={12} strokeWidth={1.75} />
              HOT
            </span>
          )}
          {lead.title && (
            <span className="text-[12px] text-[var(--text-muted)] ml-1 truncate">
              {lead.title}
              {lead.company ? ` · ${lead.company}` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        <Button size="sm" variant="primary" onClick={onCompose}>
          <Mail size={14} strokeWidth={1.75} />
          Compose email
        </Button>
        <Button size="sm" variant="secondary" onClick={onAddToCampaign}>
          <Plus size={14} strokeWidth={1.75} />
          Add to campaign
        </Button>
        <button
          type="button"
          aria-label="Star"
          className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
        >
          <Star size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="More"
          className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
        >
          <MoreHorizontal size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
