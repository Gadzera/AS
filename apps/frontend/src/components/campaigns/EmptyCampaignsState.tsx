'use client';

import { Megaphone } from 'lucide-react';
import Button from '@/components/ui/Button';

interface EmptyCampaignsStateProps {
  onCreate?: () => void;
  onImport?: () => void;
}

export default function EmptyCampaignsState({
  onCreate,
  onImport,
}: EmptyCampaignsStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 gap-3">
      <span
        className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]"
      >
        <Megaphone size={24} strokeWidth={1.75} />
      </span>
      <h2 className="text-[16px] font-semibold text-[var(--text)] leading-6">
        No campaigns yet
      </h2>
      <p className="text-[13.5px] text-[var(--text-muted)] max-w-[320px] leading-5">
        Create your first outreach campaign to start reaching out to leads.
      </p>
      <div className="flex items-center gap-2 mt-1">
        {onCreate && (
          <Button size="sm" onClick={onCreate}>
            New campaign
          </Button>
        )}
        {onImport && (
          <Button size="sm" variant="secondary" onClick={onImport}>
            Import
          </Button>
        )}
      </div>
    </div>
  );
}
