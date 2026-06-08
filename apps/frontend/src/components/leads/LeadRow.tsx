'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Flame, MoreHorizontal } from 'lucide-react';
import clsx from 'clsx';

import type { Lead, LeadStatus } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Dot from '@/components/ui/Dot';
import Tag from '@/components/ui/Tag';
import { useSelection } from '@/lib/selection';
import { industryColor, statusDotVariant, statusLabel } from './leadMappings';

interface LeadRowProps {
  lead: Lead;
  onMenu?: (lead: Lead, anchor: HTMLElement) => void;
}

function scoreChipClass(score: number): string {
  if (score >= 80) {
    return 'bg-[var(--success-soft)] text-[var(--success)]';
  }
  if (score >= 50) {
    return 'bg-[var(--warning-soft)] text-[var(--warning)]';
  }
  return 'bg-[var(--surface-2)] text-[var(--text-muted)]';
}

function formatCreated(value: string): string {
  try {
    return format(parseISO(value), 'MMM d');
  } catch {
    return '—';
  }
}

export default function LeadRow({ lead, onMenu }: LeadRowProps) {
  const router = useRouter();
  const { isSelected, toggle } = useSelection();
  const selected = isSelected(lead.id);

  const fullName = `${lead.firstName} ${lead.lastName}`.trim();
  const hot = (lead.status as LeadStatus) === 'HOT';
  const location = [lead.city, lead.country].filter(Boolean).join(', ');

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    // Ignore clicks originating from interactive elements (checkbox, links, buttons).
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [data-stop-row]')) return;
    toggle(lead.id);
  };

  const cellBase = 'px-2.5 align-middle';
  const rowClass = clsx(
    'group h-9 cursor-pointer transition-colors duration-100',
    selected
      ? 'bg-[var(--brand-soft)]'
      : 'hover:bg-[var(--surface-2)]',
  );

  return (
    <tr className={rowClass} onClick={handleRowClick}>
      <td
        className={clsx(
          cellBase,
          'w-9 border-b border-[var(--border)] relative',
          selected && 'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-[var(--brand)]',
        )}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggle(lead.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${fullName}`}
          className="w-[14px] h-[14px] cursor-pointer accent-[var(--brand)] align-middle"
          data-stop-row
        />
      </td>

      <td className={clsx(cellBase, 'border-b border-[var(--border)] w-[220px]')}>
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={fullName} size={20} />
          <Link
            href={`/leads/${lead.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[13.5px] font-medium text-[var(--text)] truncate hover:underline underline-offset-2"
          >
            {fullName || '—'}
          </Link>
          {hot && (
            <Flame
              size={12}
              strokeWidth={1.75}
              className="shrink-0"
              style={{ color: 'var(--warning)' }}
              aria-label="Hot lead"
            />
          )}
        </div>
      </td>

      <td className={clsx(cellBase, 'border-b border-[var(--border)] w-[180px]')}>
        <span className="block text-[13.5px] text-[var(--text-muted)] truncate">
          {lead.title ?? '—'}
        </span>
      </td>

      <td className={clsx(cellBase, 'border-b border-[var(--border)] w-[160px]')}>
        <span className="block text-[13.5px] text-[var(--text)] truncate">
          {lead.company ?? '—'}
        </span>
      </td>

      <td className={clsx(cellBase, 'border-b border-[var(--border)] w-[140px]')}>
        {lead.industry ? (
          <Tag color={industryColor(lead.industry)}>{lead.industry}</Tag>
        ) : (
          <span className="text-[13.5px] text-[var(--text-subtle)]">—</span>
        )}
      </td>

      <td className={clsx(cellBase, 'border-b border-[var(--border)] w-[120px]')}>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text)]">
          <Dot variant={statusDotVariant(lead.status)} />
          {statusLabel(lead.status)}
        </span>
      </td>

      <td className={clsx(cellBase, 'border-b border-[var(--border)] w-[80px]')}>
        <span
          className={clsx(
            'inline-flex items-center justify-center h-5 px-1.5 rounded-sm text-[11px] font-semibold tabular-nums',
            scoreChipClass(lead.score),
          )}
        >
          {lead.score}
        </span>
      </td>

      <td className={clsx(cellBase, 'border-b border-[var(--border)] w-[220px]')}>
        <span className="block text-[12.5px] text-[var(--text-muted)] truncate">
          {lead.email ?? '—'}
        </span>
      </td>

      <td className={clsx(cellBase, 'border-b border-[var(--border)] w-[140px]')}>
        <span className="block text-[12.5px] text-[var(--text-muted)] truncate">
          {location || '—'}
        </span>
      </td>

      <td className={clsx(cellBase, 'border-b border-[var(--border)] w-[100px]')}>
        <span className="block text-[12.5px] text-[var(--text-subtle)] tabular-nums">
          {formatCreated(lead.createdAt)}
        </span>
      </td>

      <td className={clsx(cellBase, 'border-b border-[var(--border)] w-9')}>
        <button
          type="button"
          aria-label={`Open actions for ${fullName}`}
          onClick={(e) => {
            e.stopPropagation();
            onMenu?.(lead, e.currentTarget);
          }}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors duration-100 opacity-0 group-hover:opacity-100"
          data-stop-row
        >
          <MoreHorizontal size={14} strokeWidth={1.75} />
        </button>
      </td>
    </tr>
  );
}
