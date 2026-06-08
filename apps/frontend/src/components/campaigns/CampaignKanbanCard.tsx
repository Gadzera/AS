'use client';

import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Mail, Linkedin, MoreHorizontal } from 'lucide-react';
import clsx from 'clsx';
import type { Campaign } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Tag, { type TagColor } from '@/components/ui/Tag';

interface CampaignKanbanCardProps {
  campaign: Campaign;
  isDragOverlay?: boolean;
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

export default function CampaignKanbanCard({
  campaign,
  isDragOverlay = false,
}: CampaignKanbanCardProps) {
  const router = useRouter();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: campaign.id,
    data: { type: 'card', campaign },
    disabled: isDragOverlay,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isDragOverlay ? 0 : 1,
  };

  const leadsCount = campaign._count?.campaignLeads ?? 0;
  const sequencesCount = campaign._count?.sequences ?? 0;
  const channelLabel = campaign.channel === 'EMAIL' ? 'Email' : 'LinkedIn';
  const ChannelIcon = campaign.channel === 'EMAIL' ? Mail : Linkedin;
  const ownerName = campaign.user?.name ?? 'Unknown';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Only navigate when not dragging (listeners attach to drag)
        if (isDragOverlay) return;
        const target = e.target as HTMLElement;
        if (target.closest('[data-stop-nav]')) return;
        router.push(`/campaigns/${campaign.id}`);
      }}
      className={clsx(
        'group bg-white border border-[var(--border)] rounded-lg p-3',
        'cursor-pointer hover:border-[var(--border-strong)] hover:shadow-sm',
        'transition-shadow duration-100',
        isDragOverlay && 'shadow-md rotate-[1.5deg]',
      )}
    >
      {/* Top row: name */}
      <div className="text-[13.5px] font-medium text-[var(--text)] truncate leading-5">
        {campaign.name}
      </div>

      {/* Description row */}
      <div className="mt-1 text-[12px] text-[var(--text-muted)] truncate tabular-nums">
        {leadsCount} leads
        <span className="text-[var(--text-subtle)]"> · </span>
        {sequencesCount} steps
        <span className="text-[var(--text-subtle)]"> · </span>
        {channelLabel}
      </div>

      {/* Tags row */}
      {(campaign.targetIndustry || campaign.targetCountry || campaign.targetSize) && (
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {campaign.targetIndustry && (
            <Tag color={industryColor(campaign.targetIndustry)}>{campaign.targetIndustry}</Tag>
          )}
          {campaign.targetCountry && <Tag color="gray">{campaign.targetCountry}</Tag>}
          {campaign.targetSize && <Tag color="gray">{campaign.targetSize}</Tag>}
        </div>
      )}

      {/* Bottom row */}
      <div className="mt-3 h-6 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Avatar name={ownerName} size={20} title={ownerName} />
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]"
            title={channelLabel}
          >
            <ChannelIcon size={12} strokeWidth={1.75} />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-[var(--text-subtle)] tabular-nums">
            {campaign.dailyLimit}/day
          </span>
          <button
            type="button"
            data-stop-nav
            onClick={(e) => e.stopPropagation()}
            aria-label="More"
            className="w-5 h-5 rounded inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}
