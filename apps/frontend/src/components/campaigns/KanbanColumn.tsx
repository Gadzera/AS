'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import type { Campaign, CampaignStatus } from '@/types';
import Dot from '@/components/ui/Dot';
import CampaignKanbanCard from './CampaignKanbanCard';

export const STATUS_META: Record<
  CampaignStatus,
  { label: string; dot: 'gray' | 'success' | 'warning' | 'info' }
> = {
  DRAFT:     { label: 'Draft',     dot: 'gray'    },
  ACTIVE:    { label: 'Active',    dot: 'success' },
  PAUSED:    { label: 'Paused',    dot: 'warning' },
  COMPLETED: { label: 'Completed', dot: 'info'    },
};

interface KanbanColumnProps {
  status: CampaignStatus;
  campaigns: Campaign[];
  onAdd?: (status: CampaignStatus) => void;
  isDragActive?: boolean;
}

export default function KanbanColumn({
  status,
  campaigns,
  onAdd,
  isDragActive = false,
}: KanbanColumnProps) {
  const meta = STATUS_META[status];

  const { setNodeRef, isOver } = useDroppable({
    id: `column:${status}`,
    data: { type: 'column', status },
  });

  const ids = campaigns.map((c) => c.id);

  return (
    <div
      className="flex flex-col flex-shrink-0 w-[300px] h-full"
      data-column={status}
    >
      {/* Header */}
      <div className="h-9 flex items-center gap-2 px-1">
        <Dot variant={meta.dot} size={6} />
        <span className="text-[13.5px] font-semibold text-[var(--text)] leading-none">
          {meta.label}
        </span>
        <span className="text-[12px] text-[var(--text-subtle)] tabular-nums leading-none">
          {campaigns.length}
        </span>
        <div className="flex-1" />
        {onAdd && (
          <button
            type="button"
            onClick={() => onAdd(status)}
            aria-label={`Add to ${meta.label}`}
            className="w-6 h-6 rounded inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
          >
            <Plus size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Body */}
      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 flex flex-col gap-2 pb-4 pt-1 px-0.5 overflow-y-auto rounded-md transition-colors duration-100',
          isOver && 'bg-[var(--surface-2)]',
        )}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {campaigns.map((c) => (
            <CampaignKanbanCard key={c.id} campaign={c} />
          ))}
        </SortableContext>

        {campaigns.length === 0 && (
          <div
            className={clsx(
              'h-24 rounded-lg border border-dashed flex items-center justify-center',
              'text-[12px] text-[var(--text-subtle)]',
              isDragActive
                ? 'border-[var(--border-strong)]'
                : 'border-[var(--border)]',
            )}
          >
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}
