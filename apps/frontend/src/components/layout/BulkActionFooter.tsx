'use client';

import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import clsx from 'clsx';

export interface BulkAction {
  icon?: ReactNode;
  label: string;
  onClick?: () => void;
  /** styled as a separator before this action */
  separator?: boolean;
  /** danger styling */
  danger?: boolean;
}

interface BulkActionFooterProps {
  count: number;
  actions: BulkAction[];
  onClose: () => void;
  /** label suffix; default 'selected' */
  noun?: string;
  className?: string;
}

export default function BulkActionFooter({
  count,
  actions,
  onClose,
  noun = 'selected',
  className,
}: BulkActionFooterProps) {
  const visible = count > 0;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={clsx(
            'fixed left-1/2 -translate-x-1/2 bottom-6 z-30',
            className,
          )}
        >
          <div
            className="flex items-center gap-1 h-10 px-2 bg-white border border-[var(--border)] rounded-lg"
            style={{ boxShadow: 'var(--shadow-popover)' }}
          >
            <span className="inline-flex items-center h-7 px-2 rounded-md bg-[var(--surface-2)] text-[12px] font-medium text-[var(--text)] tabular-nums">
              {count} {noun}
            </span>
            {actions.map((a, i) => (
              <span key={`${a.label}-${i}`} className="inline-flex items-center">
                {a.separator && (
                  <span className="w-px h-5 bg-[var(--border)] mx-0.5" aria-hidden />
                )}
                <button
                  type="button"
                  onClick={a.onClick}
                  className={clsx(
                    'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[13px] font-medium transition-colors duration-100',
                    a.danger
                      ? 'text-[var(--danger)] hover:bg-[var(--danger-soft)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
                  )}
                >
                  {a.icon && <span className="shrink-0 inline-flex">{a.icon}</span>}
                  <span>{a.label}</span>
                </button>
              </span>
            ))}
            <span className="w-px h-5 bg-[var(--border)] mx-0.5" aria-hidden />
            <button
              type="button"
              onClick={onClose}
              aria-label="Clear selection"
              className="w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors duration-100"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
