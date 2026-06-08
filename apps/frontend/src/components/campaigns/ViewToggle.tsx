'use client';

import { Columns3, Rows3 } from 'lucide-react';
import clsx from 'clsx';

export type CampaignsView = 'kanban' | 'table';

interface ViewToggleProps {
  view: CampaignsView;
  onChange: (view: CampaignsView) => void;
}

const items: { key: CampaignsView; label: string; Icon: typeof Columns3 }[] = [
  { key: 'kanban', label: 'Kanban', Icon: Columns3 },
  { key: 'table', label: 'Table', Icon: Rows3 },
];

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="View toggle"
      className="inline-flex items-center h-7 p-[1px] rounded-md bg-[var(--surface-2)] border border-[var(--border)]"
    >
      {items.map(({ key, label, Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={clsx(
              'inline-flex items-center gap-1.5 h-[26px] px-2 rounded-[5px] text-[12px] font-medium transition-colors duration-100',
              active
                ? 'bg-white text-[var(--text)] shadow-xs'
                : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text)]',
            )}
          >
            <Icon size={12} strokeWidth={1.75} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
