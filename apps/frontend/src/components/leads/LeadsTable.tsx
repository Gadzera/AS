'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lead } from '@/types';
import { LeadStatusBadge, ScoreBadge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface ColumnDef {
  id: string;
  label: string;
  sortable: boolean;
  defaultVisible: boolean;
  alwaysVisible?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { id: 'name',     label: 'Name',     sortable: true,  defaultVisible: true,  alwaysVisible: true },
  { id: 'email',    label: 'Email',    sortable: true,  defaultVisible: true },
  { id: 'company',  label: 'Company',  sortable: true,  defaultVisible: true },
  { id: 'title',    label: 'Title',    sortable: false, defaultVisible: true },
  { id: 'score',    label: 'Score',    sortable: true,  defaultVisible: true },
  { id: 'status',   label: 'Status',   sortable: true,  defaultVisible: true },
  { id: 'country',  label: 'Country',  sortable: false, defaultVisible: true },
  { id: 'industry', label: 'Industry', sortable: false, defaultVisible: false },
  { id: 'actions',  label: 'Actions',  sortable: false, defaultVisible: true,  alwaysVisible: true },
];

export interface LeadsTableProps {
  leads: Lead[];
  loading?: boolean;
  onAddToCampaign?: (lead: Lead) => void;
  onGenerateOutreach?: (lead: Lead) => void;
  onView?: (lead: Lead) => void;
  onSortChange?: (field: string, dir: 'asc' | 'desc') => void;
  onSelectionChange?: (ids: string[]) => void;
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <svg
      className={`w-3 h-3 inline-block ml-1 transition-colors ${active ? 'text-brand-400' : 'text-gray-600'}`}
      viewBox="0 0 10 14"
      fill="none"
    >
      <path
        d="M5 1L9 5H1L5 1Z"
        fill={active && dir === 'asc' ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M5 13L1 9H9L5 13Z"
        fill={active && dir === 'desc' ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function SkeletonRows() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="border-b border-gray-800/60">
          <td className="py-3 pr-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse shrink-0" />
              <div className="space-y-1.5">
                <div className="h-3 w-28 bg-gray-800 rounded animate-pulse" />
                <div className="h-2.5 w-20 bg-gray-800/70 rounded animate-pulse" />
              </div>
            </div>
          </td>
          <td className="py-3 pr-4"><div className="h-3 w-32 bg-gray-800 rounded animate-pulse" /></td>
          <td className="py-3 pr-4"><div className="h-3 w-24 bg-gray-800 rounded animate-pulse" /></td>
          <td className="py-3 pr-4"><div className="h-3 w-28 bg-gray-800 rounded animate-pulse" /></td>
          <td className="py-3 pr-4"><div className="h-5 w-9 bg-gray-800 rounded animate-pulse" /></td>
          <td className="py-3 pr-4"><div className="h-5 w-16 bg-gray-800 rounded-full animate-pulse" /></td>
          <td className="py-3 pr-4"><div className="h-3 w-16 bg-gray-800 rounded animate-pulse" /></td>
          <td className="py-3"><div className="h-6 w-20 bg-gray-800 rounded animate-pulse" /></td>
        </tr>
      ))}
    </>
  );
}

export default function LeadsTable({
  leads,
  loading = false,
  onAddToCampaign,
  onGenerateOutreach,
  onView,
  onSortChange,
  onSelectionChange,
}: LeadsTableProps) {
  const [sortField, setSortField] = useState<string>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    () => new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id))
  );
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  // Close column picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false);
      }
    }
    if (colPickerOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colPickerOpen]);

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(Array.from(selectedIds));
  }, [selectedIds, onSelectionChange]);

  const handleSort = (field: string) => {
    const newDir = sortField === field && sortDir === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDir(newDir);
    onSortChange?.(field, newDir);
  };

  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
  const someSelected = leads.some((l) => selectedIds.has(l.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        leads.forEach((l) => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        leads.forEach((l) => next.add(l.id));
        return next;
      });
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCol = (id: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleColumns = COLUMNS.filter((c) => c.alwaysVisible || visibleCols.has(c.id));

  const isEmpty = !loading && leads.length === 0;

  return (
    <div className="overflow-x-auto relative">
      {/* Column visibility picker */}
      <div className="flex justify-end mb-3">
        <div className="relative" ref={colPickerRef}>
          <button
            onClick={() => setColPickerOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 bg-gray-800/60 border border-gray-700/60 hover:bg-gray-800 hover:text-gray-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Columns
          </button>
          <AnimatePresence>
            {colPickerOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1.5 w-44 bg-gray-900 border border-gray-700/60 rounded-xl shadow-2xl z-20 py-1.5 overflow-hidden"
              >
                {COLUMNS.filter((c) => !c.alwaysVisible).map((col) => (
                  <button
                    key={col.id}
                    onClick={() => toggleCol(col.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        visibleCols.has(col.id)
                          ? 'bg-brand-500 border-brand-500'
                          : 'border-gray-600 bg-transparent'
                      }`}
                    >
                      {visibleCols.has(col.id) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                          <path d="M2 5l2.5 2.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {col.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <table className="w-full text-sm text-left">
        <thead className="sticky top-0 z-10 bg-gray-900">
          <tr className="border-b border-gray-800">
            {/* Select all checkbox */}
            <th className="pb-3 pr-3 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={toggleAll}
                className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-brand-500 focus:ring-brand-500/30 focus:ring-offset-0 cursor-pointer"
              />
            </th>
            {visibleColumns.map((col) => (
              <th
                key={col.id}
                className={`pb-3 pr-4 font-medium text-gray-500 whitespace-nowrap text-xs uppercase tracking-wide ${
                  col.sortable ? 'cursor-pointer hover:text-gray-300 select-none' : ''
                } ${col.id === 'actions' ? 'pr-0' : ''}`}
                onClick={col.sortable ? () => handleSort(col.id) : undefined}
              >
                {col.label}
                {col.sortable && (
                  <SortIcon active={sortField === col.id} dir={sortDir} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {loading ? (
            <SkeletonRows />
          ) : isEmpty ? (
            <tr>
              <td colSpan={visibleColumns.length + 1} className="py-16">
                <div className="text-center">
                  <svg className="w-10 h-10 mx-auto mb-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="font-medium text-gray-400">No leads found</p>
                  <p className="text-sm mt-1 text-gray-600">Import a CSV or add leads manually</p>
                </div>
              </td>
            </tr>
          ) : (
            leads.map((lead, index) => (
              <motion.tr
                key={lead.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, duration: 0.2 }}
                className={`hover:bg-gray-800/30 transition-colors ${selectedIds.has(lead.id) ? 'bg-brand-500/5' : ''}`}
              >
                {/* Row checkbox */}
                <td className="py-3 pr-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={() => toggleRow(lead.id)}
                    className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-brand-500 focus:ring-brand-500/30 focus:ring-offset-0 cursor-pointer"
                  />
                </td>

                {visibleColumns.map((col) => {
                  switch (col.id) {
                    case 'name':
                      return (
                        <td key="name" className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-gradient-to-br from-brand-500/20 to-purple-500/20 text-brand-400 border border-brand-500/20 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                              {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-100 whitespace-nowrap">
                                {lead.firstName} {lead.lastName}
                              </p>
                            </div>
                          </div>
                        </td>
                      );
                    case 'email':
                      return (
                        <td key="email" className="py-3 pr-4">
                          {lead.email ? (
                            <p className="text-xs text-gray-400 truncate max-w-[180px]">{lead.email}</p>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                      );
                    case 'company':
                      return (
                        <td key="company" className="py-3 pr-4">
                          <p className="text-gray-300 whitespace-nowrap">{lead.company ?? '—'}</p>
                          {lead.companySize && (
                            <p className="text-xs text-gray-600">{lead.companySize} emp.</p>
                          )}
                        </td>
                      );
                    case 'title':
                      return (
                        <td key="title" className="py-3 pr-4">
                          <p className="text-gray-400 whitespace-nowrap max-w-[160px] truncate">
                            {lead.title ?? '—'}
                          </p>
                        </td>
                      );
                    case 'score':
                      return (
                        <td key="score" className="py-3 pr-4">
                          <ScoreBadge score={lead.score} />
                        </td>
                      );
                    case 'status':
                      return (
                        <td key="status" className="py-3 pr-4">
                          <LeadStatusBadge status={lead.status} />
                        </td>
                      );
                    case 'country':
                      return (
                        <td key="country" className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                          {lead.country ?? '—'}
                        </td>
                      );
                    case 'industry':
                      return (
                        <td key="industry" className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                          {lead.industry ?? '—'}
                        </td>
                      );
                    case 'actions':
                      return (
                        <td key="actions" className="py-3">
                          <div className="flex items-center gap-1">
                            {onView && (
                              <Button size="sm" variant="ghost" onClick={() => onView(lead)}>
                                View
                              </Button>
                            )}
                            {onGenerateOutreach && (
                              <Button size="sm" variant="ghost" onClick={() => onGenerateOutreach(lead)}>
                                Write
                              </Button>
                            )}
                            {onAddToCampaign && (
                              <Button size="sm" variant="ghost" onClick={() => onAddToCampaign(lead)}>
                                + Campaign
                              </Button>
                            )}
                          </div>
                        </td>
                      );
                    default:
                      return null;
                  }
                })}
              </motion.tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
