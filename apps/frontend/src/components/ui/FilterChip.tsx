'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

/**
 * FilterChip — Attio-style filter pill used above tables and inside view-tabs row.
 *
 *   <FilterChip icon={<Grid size={12}/>} label="All Leads" />
 *   <FilterChip label="Owner" suffix="Marisa McGill" />
 *   <FilterChip label="Filter" chevron={false} icon={<Plus/>} />
 *
 * Children are rendered after `label` for backwards-compat with existing callers.
 */
interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  label?: ReactNode;
  /** A value to show after the label, e.g. `Marisa McGill` */
  suffix?: ReactNode;
  /** show chevron on the right (default true) */
  chevron?: boolean;
  /** active visual state */
  active?: boolean;
  children?: ReactNode;
}

const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(function FilterChip(
  { icon, label, suffix, chevron = true, active = false, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={clsx(
        'h-7 px-2.5 rounded-md text-[12.5px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap',
        'transition-colors duration-100',
        active
          ? 'bg-[var(--surface-3)] text-[var(--text)]'
          : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]',
        className,
      )}
      {...props}
    >
      {icon && (
        <span className="shrink-0 text-[var(--text-subtle)] inline-flex">
          {icon}
        </span>
      )}
      {label && <span className="truncate">{label}</span>}
      {children}
      {suffix && (
        <span className="text-[var(--text)] font-medium truncate">{suffix}</span>
      )}
      {chevron && (
        <ChevronDown size={12} strokeWidth={1.75} className="text-[var(--text-subtle)] shrink-0" />
      )}
    </button>
  );
});

export default FilterChip;
