'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Play, Pause, Copy, Trash2, X } from 'lucide-react';
import { useSelection } from '@/lib/selection';

interface CampaignsBulkFooterProps {
  onStart?: () => void;
  onPause?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export default function CampaignsBulkFooter({
  onStart,
  onPause,
  onDuplicate,
  onDelete,
}: CampaignsBulkFooterProps) {
  const { count, clear } = useSelection();
  const visible = count > 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40"
        >
          <div className="flex items-center gap-1 h-10 px-1.5 bg-white border border-[var(--border)] rounded-lg shadow-popover">
            <span className="inline-flex items-center h-7 px-2 rounded-md bg-[var(--surface-2)] text-[12px] font-medium text-[var(--text-muted)] tabular-nums">
              {count} selected
            </span>
            <Action onClick={onStart} icon={<Play size={12} strokeWidth={1.75} />}>
              Start
            </Action>
            <Action onClick={onPause} icon={<Pause size={12} strokeWidth={1.75} />}>
              Pause
            </Action>
            <Action onClick={onDuplicate} icon={<Copy size={12} strokeWidth={1.75} />}>
              Duplicate
            </Action>
            <Action
              onClick={onDelete}
              icon={<Trash2 size={12} strokeWidth={1.75} />}
              danger
            >
              Delete
            </Action>
            <button
              type="button"
              onClick={clear}
              aria-label="Clear selection"
              className="ml-1 w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Action({
  children,
  onClick,
  icon,
  danger = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] font-medium transition-colors duration-100',
        danger
          ? 'text-[var(--danger)] hover:bg-[var(--danger-soft)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
      ].join(' ')}
    >
      {icon}
      {children}
    </button>
  );
}
