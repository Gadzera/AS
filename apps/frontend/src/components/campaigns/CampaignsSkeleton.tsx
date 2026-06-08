'use client';

import Dot from '@/components/ui/Dot';
import { STATUS_META } from './KanbanColumn';
import type { CampaignStatus } from '@/types';

const COLUMNS: CampaignStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'];

export function KanbanSkeleton() {
  return (
    <div
      className="flex gap-4 px-5 pt-4 pb-4 overflow-x-auto"
      style={{ height: 'calc(100vh - 44px - 44px)' }}
    >
      {COLUMNS.map((status) => {
        const meta = STATUS_META[status];
        return (
          <div key={status} className="flex flex-col flex-shrink-0 w-[300px]">
            <div className="h-9 flex items-center gap-2 px-1">
              <Dot variant={meta.dot} size={6} />
              <span className="text-[13.5px] font-semibold text-[var(--text)] leading-none">
                {meta.label}
              </span>
            </div>
            <div className="flex flex-col gap-2 pt-1 px-0.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-lg bg-[var(--surface-2)] animate-pulse"
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="px-5 pt-4">
      <div className="flex flex-col gap-1.5">
        <div className="h-8 rounded bg-[var(--surface-2)] animate-pulse" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-9 rounded bg-[var(--surface-2)] animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
