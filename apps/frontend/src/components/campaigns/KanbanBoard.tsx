'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import type { Campaign, CampaignStatus } from '@/types';
import { campaignsApi } from '@/lib/api';
import KanbanColumn from './KanbanColumn';
import CampaignKanbanCard from './CampaignKanbanCard';

const COLUMN_ORDER: CampaignStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'];

interface KanbanBoardProps {
  campaigns: Campaign[];
  onChange: (next: Campaign[]) => void;
  onError?: (message: string) => void;
  onAdd?: (status: CampaignStatus) => void;
}

function columnIdFor(over: string | number | undefined | null): CampaignStatus | null {
  if (typeof over !== 'string') return null;
  if (over.startsWith('column:')) {
    return over.slice('column:'.length) as CampaignStatus;
  }
  return null;
}

export default function KanbanBoard({
  campaigns,
  onChange,
  onError,
  onAdd,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byStatus = useMemo(() => {
    const map: Record<CampaignStatus, Campaign[]> = {
      DRAFT: [], ACTIVE: [], PAUSED: [], COMPLETED: [],
    };
    for (const c of campaigns) map[c.status].push(c);
    return map;
  }, [campaigns]);

  const findCampaign = (id: string | null) =>
    id ? campaigns.find((c) => c.id === id) ?? null : null;

  const activeCampaign = findCampaign(activeId);

  const findContainer = (id: string): CampaignStatus | null => {
    const col = columnIdFor(id);
    if (col) return col;
    const c = campaigns.find((x) => x.id === id);
    return c ? c.status : null;
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const activeContainer = findContainer(activeIdStr);
    const overContainer = findContainer(overIdStr);
    if (!activeContainer || !overContainer) return;
    if (activeContainer === overContainer) return;

    // Move card to new column optimistically while dragging
    const next = campaigns.map((c) =>
      c.id === activeIdStr ? { ...c, status: overContainer } : c,
    );
    onChange(next);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const sourceCampaign = campaigns.find((c) => c.id === activeIdStr);
    if (!sourceCampaign) return;

    const overContainer = findContainer(overIdStr);
    if (!overContainer) return;

    // Reorder inside same column
    if (overIdStr !== `column:${overContainer}` && overIdStr !== activeIdStr) {
      const colItems = campaigns.filter((c) => c.status === overContainer);
      const oldIndex = colItems.findIndex((c) => c.id === activeIdStr);
      const newIndex = colItems.findIndex((c) => c.id === overIdStr);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(colItems, oldIndex, newIndex);
        const other = campaigns.filter((c) => c.status !== overContainer);
        onChange([...other, ...reordered]);
      }
    }

    // Persist status change if column changed
    const original = sourceCampaign.status;
    const updated = campaigns.find((c) => c.id === activeIdStr);
    const newStatus = updated?.status ?? overContainer;

    if (newStatus !== original) {
      try {
        if (newStatus === 'ACTIVE') {
          // M11-4: из PAUSED — возобновление (без повторного enroll), из DRAFT — старт.
          if (original === 'PAUSED') await campaignsApi.resume(activeIdStr);
          else await campaignsApi.start(activeIdStr);
        } else if (newStatus === 'PAUSED') {
          await campaignsApi.pause(activeIdStr);
        } else {
          // DRAFT / COMPLETED: best-effort generic update
          await campaignsApi.update(activeIdStr, {} as never).catch(() => null);
        }
      } catch (err) {
        // Rollback
        const reverted = campaigns.map((c) =>
          c.id === activeIdStr ? { ...c, status: original } : c,
        );
        onChange(reverted);
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Failed to update campaign status';
        onError?.(msg);
      }
    }
  };

  const handleDragCancel = () => setActiveId(null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className="flex gap-4 px-5 pt-4 pb-4 overflow-x-auto"
        style={{ height: 'calc(100vh - 44px - 44px)' }}
      >
        {COLUMN_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            campaigns={byStatus[status]}
            onAdd={onAdd}
            isDragActive={activeId !== null}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeCampaign ? (
          <div className="w-[300px]">
            <CampaignKanbanCard campaign={activeCampaign} isDragOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
