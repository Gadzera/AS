'use client';

// Stub fallback for FilterChip — owned by Agent 1.
// Replace import path with `@/components/ui/FilterChip` once that lands.
import clsx from 'clsx';
import { type ReactNode } from 'react';

interface FilterChipProps {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export default function FilterChip({
  children,
  onClick,
  active = false,
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] font-medium border transition-colors duration-100 whitespace-nowrap',
        active
          ? 'bg-[var(--surface-2)] border-[var(--border-strong)] text-[var(--text)]'
          : 'bg-white border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
        className,
      )}
    >
      {children}
    </button>
  );
}
