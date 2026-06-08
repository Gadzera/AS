'use client';

import { useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Building2,
  CalendarDays,
  CircleDot,
  Hash,
  Mail,
  MapPin,
  Plus,
  Tag as TagIcon,
  User as UserIcon,
} from 'lucide-react';
import clsx from 'clsx';

import type { Lead } from '@/types';
import { useSelection } from '@/lib/selection';
import LeadRow from './LeadRow';
import type { LeadsQuery, SortField } from './LeadFilters';

interface LeadsTableProps {
  leads: Lead[];
  total: number;
  loading?: boolean;
  query: LeadsQuery;
  onQueryChange: (next: LeadsQuery) => void;
  onMenu?: (lead: Lead, anchor: HTMLElement) => void;
}

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  icon?: React.ReactNode;
  sortField?: SortField;
}

const COLUMNS: ColumnDef[] = [
  { key: 'name',     label: 'Name',     width: 220, icon: <UserIcon   size={12} strokeWidth={1.75} />, sortField: 'name' },
  { key: 'title',    label: 'Title',    width: 180, icon: <Briefcase  size={12} strokeWidth={1.75} /> },
  { key: 'company',  label: 'Company',  width: 160, icon: <Building2  size={12} strokeWidth={1.75} /> },
  { key: 'industry', label: 'Industry', width: 140, icon: <TagIcon    size={12} strokeWidth={1.75} /> },
  { key: 'status',   label: 'Status',   width: 120, icon: <CircleDot  size={12} strokeWidth={1.75} /> },
  { key: 'score',    label: 'Score',    width:  80, icon: <Hash       size={12} strokeWidth={1.75} />, sortField: 'score' },
  { key: 'email',    label: 'Email',    width: 220, icon: <Mail       size={12} strokeWidth={1.75} /> },
  { key: 'location', label: 'Location', width: 140, icon: <MapPin     size={12} strokeWidth={1.75} /> },
  { key: 'created',  label: 'Created',  width: 100, icon: <CalendarDays size={12} strokeWidth={1.75} />, sortField: 'createdAt' },
];

const TOTAL_MIN_WIDTH = 36 + COLUMNS.reduce((a, c) => a + c.width, 0) + 36;

export default function LeadsTable({
  leads,
  total,
  loading,
  query,
  onQueryChange,
  onMenu,
}: LeadsTableProps) {
  const { selected, selectMany, toggleMany, clear } = useSelection();

  const allIds = useMemo(() => leads.map((l) => l.id), [leads]);
  const allChecked = leads.length > 0 && allIds.every((id) => selected.has(id));
  const someChecked = !allChecked && allIds.some((id) => selected.has(id));

  const headerHeight = 32;

  const handleHeaderSort = (field?: SortField) => {
    if (!field) return;
    if (query.sortField === field) {
      onQueryChange({ ...query, sortDir: query.sortDir === 'desc' ? 'asc' : 'desc' });
    } else {
      onQueryChange({ ...query, sortField: field, sortDir: 'desc' });
    }
  };

  const handleToggleAll = () => {
    if (allChecked) {
      // Deselect only this page's leads (selection may include items from other pages).
      const remaining = new Set(selected);
      allIds.forEach((id) => remaining.delete(id));
      if (remaining.size === 0) clear();
      else toggleMany(allIds);
    } else {
      selectMany(allIds);
    }
  };

  return (
    <div className="overflow-auto bg-[var(--surface)]">
      <table
        className="w-full text-[13.5px] border-separate border-spacing-0"
        style={{ minWidth: TOTAL_MIN_WIDTH }}
      >
        <colgroup>
          <col style={{ width: 36 }} />
          {COLUMNS.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
          <col style={{ width: 36 }} />
        </colgroup>

        <thead>
          <tr className="bg-[var(--surface-2)]" style={{ height: headerHeight }}>
            <th
              scope="col"
              className="sticky top-0 z-10 bg-[var(--surface-2)] border-b border-[var(--border)] px-2.5 text-left"
            >
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                onChange={handleToggleAll}
                aria-label={allChecked ? 'Deselect all leads' : 'Select all leads'}
                className="w-[14px] h-[14px] cursor-pointer accent-[var(--brand)] align-middle"
              />
            </th>
            {COLUMNS.map((col) => {
              const isSorted = col.sortField && query.sortField === col.sortField;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={clsx(
                    'sticky top-0 z-10 bg-[var(--surface-2)] border-b border-[var(--border)] px-2.5 text-left font-medium text-[12px] text-[var(--text-muted)]',
                    col.sortField && 'cursor-pointer hover:text-[var(--text)]',
                  )}
                  onClick={() => handleHeaderSort(col.sortField)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.icon && (
                      <span className="text-[var(--text-subtle)] inline-flex">{col.icon}</span>
                    )}
                    <span>{col.label}</span>
                    {isSorted && (
                      query.sortDir === 'desc' ? (
                        <ArrowDown size={12} strokeWidth={1.75} className="text-[var(--text-subtle)]" />
                      ) : (
                        <ArrowUp size={12} strokeWidth={1.75} className="text-[var(--text-subtle)]" />
                      )
                    )}
                  </span>
                </th>
              );
            })}
            <th
              scope="col"
              aria-label="Actions"
              className="sticky top-0 z-10 bg-[var(--surface-2)] border-b border-[var(--border)] px-2.5"
            />
          </tr>
        </thead>

        <tbody>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
          ) : (
            leads.map((lead) => <LeadRow key={lead.id} lead={lead} onMenu={onMenu} />)
          )}
        </tbody>

        <tfoot>
          <tr
            className="sticky bottom-0 bg-[var(--surface)]"
            style={{ height: 36 }}
          >
            <td className="border-t border-[var(--border)] px-2.5" />
            <td colSpan={COLUMNS.length + 1} className="border-t border-[var(--border)] px-2.5">
              <div className="flex items-center gap-3">
                <span className="text-[12.5px] text-[var(--text-muted)] tabular-nums">
                  {total} count
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-[12px] text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
                >
                  <Plus size={12} strokeWidth={1.75} />
                  Add calculation
                </button>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr style={{ height: 36 }}>
      <td className="border-b border-[var(--border)] px-2.5">
        <span className="skeleton inline-block h-3.5 w-3.5 rounded-sm align-middle" />
      </td>
      {COLUMNS.map((c) => (
        <td key={c.key} className="border-b border-[var(--border)] px-2.5">
          <span className="skeleton inline-block h-3 rounded-sm w-[60%] align-middle" />
        </td>
      ))}
      <td className="border-b border-[var(--border)] px-2.5" />
    </tr>
  );
}
