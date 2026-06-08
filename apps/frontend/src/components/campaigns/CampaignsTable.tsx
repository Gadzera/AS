'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Mail, Linkedin, MoreHorizontal } from 'lucide-react';
import clsx from 'clsx';
import type { Campaign } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Dot from '@/components/ui/Dot';
import Tag, { type TagColor } from '@/components/ui/Tag';
import { useSelection } from '@/lib/selection';
import { STATUS_META } from './KanbanColumn';

interface CampaignsTableProps {
  campaigns: Campaign[];
}

function industryColor(industry?: string | null): TagColor {
  if (!industry) return 'gray';
  const k = industry.toLowerCase();
  if (k.includes('saas')) return 'violet';
  if (k.includes('marketing')) return 'pink';
  if (k.includes('finance') || k.includes('fintech')) return 'blue';
  if (k.includes('devtools') || k.includes('developer')) return 'orange';
  return 'gray';
}

export default function CampaignsTable({ campaigns }: CampaignsTableProps) {
  const router = useRouter();
  const { isSelected, toggle, toggleMany } = useSelection();

  const ids = useMemo(() => campaigns.map((c) => c.id), [campaigns]);
  const allSelected = ids.length > 0 && ids.every((id) => isSelected(id));
  const someSelected = ids.some((id) => isSelected(id));

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full text-[13.5px] text-left border-collapse"
        style={{ tableLayout: 'fixed' }}
      >
        <colgroup>
          <col style={{ width: 36 }} />
          <col style={{ width: 200 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 36 }} />
        </colgroup>
        <thead>
          <tr className="h-8 bg-[var(--bg)] border-b border-[var(--border)] sticky top-[88px] z-10">
            <th className="px-2">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !allSelected && someSelected;
                }}
                onChange={() => toggleMany(ids)}
                className="w-3.5 h-3.5 accent-[var(--brand)] cursor-pointer"
              />
            </th>
            <Th>Name</Th>
            <Th>Status</Th>
            <Th>Channel</Th>
            <Th>Industry</Th>
            <Th>Country</Th>
            <Th align="right">Leads</Th>
            <Th align="right">Daily limit</Th>
            <Th align="right">Sequences</Th>
            <Th>Owner</Th>
            <Th>Created</Th>
            <Th>{''}</Th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => {
            const selected = isSelected(c.id);
            const meta = STATUS_META[c.status];
            const ChannelIcon = c.channel === 'EMAIL' ? Mail : Linkedin;
            const channelLabel = c.channel === 'EMAIL' ? 'Email' : 'LinkedIn';
            const owner = c.user?.name ?? '—';
            const leads = c._count?.campaignLeads ?? 0;
            const sequences = c._count?.sequences ?? 0;

            return (
              <tr
                key={c.id}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('[data-stop-row-nav]')) return;
                  router.push(`/campaigns/${c.id}`);
                }}
                className={clsx(
                  'h-9 border-b border-[var(--border)] cursor-pointer',
                  selected
                    ? 'bg-[var(--brand-soft)]'
                    : 'hover:bg-[var(--surface-2)]',
                )}
              >
                <td className="px-2" data-stop-row-nav>
                  <input
                    type="checkbox"
                    aria-label={`Select ${c.name}`}
                    checked={selected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggle(c.id)}
                    className="w-3.5 h-3.5 accent-[var(--brand)] cursor-pointer"
                  />
                </td>
                <Td>
                  <span className="text-[13.5px] font-medium text-[var(--text)] truncate block">
                    {c.name}
                  </span>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5">
                    <Dot variant={meta.dot} size={6} />
                    <span className="text-[12px] text-[var(--text)]">{meta.label}</span>
                  </span>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                    <ChannelIcon size={12} strokeWidth={1.75} />
                    {channelLabel}
                  </span>
                </Td>
                <Td>
                  {c.targetIndustry ? (
                    <Tag color={industryColor(c.targetIndustry)}>{c.targetIndustry}</Tag>
                  ) : (
                    <span className="text-[var(--text-subtle)]">—</span>
                  )}
                </Td>
                <Td>
                  <span className="text-[12px] text-[var(--text-muted)] truncate block">
                    {c.targetCountry ?? '—'}
                  </span>
                </Td>
                <Td align="right">
                  <span className="tabular-nums text-[var(--text)]">{leads}</span>
                </Td>
                <Td align="right">
                  <span className="tabular-nums text-[var(--text-muted)]">{c.dailyLimit}</span>
                </Td>
                <Td align="right">
                  <span className="tabular-nums text-[var(--text-muted)]">{sequences}</span>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <Avatar name={owner} size={20} title={owner} />
                    <span className="text-[12px] text-[var(--text-muted)] truncate">
                      {owner}
                    </span>
                  </span>
                </Td>
                <Td>
                  <span className="text-[12px] text-[var(--text-subtle)] tabular-nums">
                    {format(new Date(c.createdAt), 'MMM d')}
                  </span>
                </Td>
                <Td>
                  <button
                    type="button"
                    data-stop-row-nav
                    onClick={(e) => e.stopPropagation()}
                    aria-label="More"
                    className="w-6 h-6 rounded inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-3)]"
                  >
                    <MoreHorizontal size={14} strokeWidth={1.75} />
                  </button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer count row */}
      <div className="h-8 px-2 flex items-center text-[12px] text-[var(--text-subtle)] tabular-nums border-b border-[var(--border)]">
        {campaigns.length} count
      </div>
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={clsx(
        'px-2 text-[11px] font-medium text-[var(--text-muted)] tracking-wide whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <td
      className={clsx(
        'px-2 overflow-hidden',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </td>
  );
}
