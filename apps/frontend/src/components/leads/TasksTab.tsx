'use client';

import { CheckSquare } from 'lucide-react';

export default function TasksTab() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <span className="w-14 h-14 rounded-full bg-[var(--surface-2)] inline-flex items-center justify-center text-[var(--text-subtle)] mb-3">
        <CheckSquare size={24} strokeWidth={1.75} />
      </span>
      <h2 className="text-[16px] font-semibold text-[var(--text)]">No tasks</h2>
      <p className="text-[13.5px] text-[var(--text-muted)] mt-1 max-w-[320px]">
        Create tasks to remind yourself to follow up at the right time.
      </p>
    </div>
  );
}
