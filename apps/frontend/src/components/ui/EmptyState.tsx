import clsx from 'clsx';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

/**
 * EmptyState — Attio-style centred placeholder.
 *
 * Icon sits in a 56px round surface chip, title and short description below,
 * primary + secondary action row at the bottom. Max width 400px, centred.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center mx-auto py-24 px-6 max-w-[400px]',
        className,
      )}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-subtle)' }}
        aria-hidden
      >
        {icon}
      </div>
      <h2 className="text-[16px] leading-6 font-semibold text-[var(--text)] mb-1.5">
        {title}
      </h2>
      {description && (
        <p className="text-[13px] leading-5 text-[var(--text-muted)] mb-5">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
