'use client';

import { Phone } from 'lucide-react';

export default function CallsTab() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <span className="w-14 h-14 rounded-full bg-[var(--surface-2)] inline-flex items-center justify-center text-[var(--text-subtle)] mb-3">
        <Phone size={24} strokeWidth={1.75} />
      </span>
      <h2 className="text-[16px] font-semibold text-[var(--text)]">No calls logged</h2>
      <p className="text-[13.5px] text-[var(--text-muted)] mt-1 max-w-[320px]">
        Calls placed from connected dialers will appear here automatically.
      </p>
    </div>
  );
}
