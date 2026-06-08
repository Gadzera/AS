'use client';

import { ArrowUpDown, Filter, Plus } from 'lucide-react';
import FilterChip from '@/components/ui/FilterChip';
import type { LeadStatus } from '@/types';

export type SortField = 'score' | 'createdAt' | 'name';
export type SortDir = 'asc' | 'desc';

export interface LeadsQuery {
  sortField: SortField;
  sortDir: SortDir;
  status: LeadStatus | '';
  industry: string;
}

interface LeadFiltersProps {
  query: LeadsQuery;
  onChange: (next: LeadsQuery) => void;
}

const SORT_LABELS: Record<SortField, string> = {
  score: 'Score',
  createdAt: 'Created',
  name: 'Name',
};

const SORT_FIELDS: SortField[] = ['score', 'createdAt', 'name'];

const STATUS_VALUES: (LeadStatus | '')[] = [
  '', 'NEW', 'CONTACTED', 'REPLIED', 'HOT', 'CONVERTED', 'LOST', 'UNSUBSCRIBED',
];

function formatStatus(s: LeadStatus | ''): string {
  if (!s) return 'Any';
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export default function LeadFilters({ query, onChange }: LeadFiltersProps) {
  const cycleSort = () => {
    const idx = SORT_FIELDS.indexOf(query.sortField);
    if (query.sortDir === 'desc') {
      onChange({ ...query, sortDir: 'asc' });
      return;
    }
    const nextField = SORT_FIELDS[(idx + 1) % SORT_FIELDS.length];
    onChange({ ...query, sortField: nextField, sortDir: 'desc' });
  };

  const cycleStatus = () => {
    const idx = STATUS_VALUES.indexOf(query.status);
    const next = STATUS_VALUES[(idx + 1) % STATUS_VALUES.length];
    onChange({ ...query, status: next });
  };

  const sortSuffix = `${SORT_LABELS[query.sortField]} ${query.sortDir === 'desc' ? '↓' : '↑'}`;

  return (
    <div className="h-11 bg-[var(--surface)] border-b border-[var(--border)] flex items-center gap-1.5 px-4">
      <FilterChip
        icon={<ArrowUpDown size={12} strokeWidth={1.75} />}
        label="Sorted by"
        suffix={sortSuffix}
        chevron={false}
        onClick={cycleSort}
      />
      <FilterChip
        icon={<Filter size={12} strokeWidth={1.75} />}
        label="Status is"
        suffix={formatStatus(query.status)}
        chevron={false}
        onClick={cycleStatus}
      />
      <FilterChip
        icon={<Plus size={12} strokeWidth={1.75} />}
        label="Add filter"
        chevron={false}
        onClick={() => onChange({ ...query, status: '', industry: '' })}
      />
    </div>
  );
}
