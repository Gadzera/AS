'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export type LeadTabId = 'activity' | 'emails' | 'calls' | 'notes' | 'tasks' | 'files';

interface LeadTabsProps {
  value: LeadTabId;
  onChange: (v: LeadTabId) => void;
  counts: Partial<Record<LeadTabId, number>>;
}

export default function LeadTabs({ value, onChange, counts }: LeadTabsProps) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-[var(--border)]">
      <Tabs
        value={value}
        onChange={(v) => onChange(v as LeadTabId)}
        id="lead-detail-tabs"
      >
        <TabsList className="h-10 px-6 gap-5">
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="emails" count={counts.emails ?? 0}>Emails</TabsTrigger>
          <TabsTrigger value="calls" count={counts.calls ?? 0}>Calls</TabsTrigger>
          <TabsTrigger value="notes" count={counts.notes ?? 0}>Notes</TabsTrigger>
          <TabsTrigger value="tasks" count={counts.tasks ?? 0}>Tasks</TabsTrigger>
          <TabsTrigger value="files" count={counts.files ?? 0}>Files</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
