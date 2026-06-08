'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, FileText, Plus, Search } from 'lucide-react';
import clsx from 'clsx';
import { emailTemplates, type EmailTemplate } from '@/lib/templates';

interface TemplatePickerProps {
  open: boolean;
  onPick: (template: EmailTemplate) => void;
  onClose: () => void;
  /** className applied to the outer popover; positioning is decided by parent */
  className?: string;
}

export default function TemplatePicker({
  open,
  onPick,
  onClose,
  className,
}: TemplatePickerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return emailTemplates;
    return emailTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q),
    );
  }, [query]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      role="dialog"
      aria-label="Email templates"
      className={clsx(
        'w-full max-w-[480px] bg-white rounded-lg border border-[var(--border)] overflow-hidden',
        className,
      )}
      style={{ boxShadow: 'var(--shadow-popover)' }}
    >
      <div className="h-9 px-3 border-b border-[var(--border)] flex items-center gap-2">
        <Search size={12} strokeWidth={1.75} className="text-[var(--text-subtle)] shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="Search templates..."
          className="flex-1 bg-transparent text-[13px] text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none border-0"
        />
      </div>

      <ul className="max-h-[260px] overflow-y-auto py-1" role="listbox">
        {filtered.length === 0 ? (
          <li className="h-8 px-3 flex items-center text-[13px] text-[var(--text-subtle)]">
            No templates match
          </li>
        ) : (
          filtered.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPick(t)}
                className="w-full h-8 px-3 flex items-center gap-2 text-[13px] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100 text-left"
              >
                <FileText size={12} strokeWidth={1.75} className="text-[var(--text-subtle)] shrink-0" />
                <span className="truncate">{t.name}</span>
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="border-t border-[var(--border)] py-1">
        <button
          type="button"
          onClick={onClose}
          className="w-full h-8 px-3 flex items-center justify-between text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors duration-100"
        >
          <span className="inline-flex items-center gap-2">
            <FileText size={12} strokeWidth={1.75} className="text-[var(--text-subtle)]" />
            View all templates
          </span>
          <ChevronRight size={12} strokeWidth={1.75} className="text-[var(--text-subtle)]" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-8 px-3 flex items-center gap-2 text-[13px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors duration-100"
        >
          <Plus size={12} strokeWidth={1.75} className="text-[var(--text-subtle)]" />
          Create new template
        </button>
      </div>
    </motion.div>
  );
}
