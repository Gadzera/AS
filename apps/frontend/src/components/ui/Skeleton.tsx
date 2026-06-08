import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const radius = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export default function Skeleton({ className, rounded = 'md' }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'bg-[var(--surface-2)] animate-pulse',
        radius[rounded],
        className,
      )}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'bg-[var(--surface-2)] animate-pulse h-3 rounded-md',
            i === lines - 1 && lines > 1 && 'w-3/5',
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'bg-white border border-[var(--border)] rounded-lg p-4 space-y-3',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="bg-[var(--surface-2)] animate-pulse w-8 h-8 rounded-md shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="bg-[var(--surface-2)] animate-pulse h-3 w-24 rounded-md" />
          <div className="bg-[var(--surface-2)] animate-pulse h-2 w-16 rounded-md" />
        </div>
      </div>
      <div className="bg-[var(--surface-2)] animate-pulse h-2 w-full rounded-md" />
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-[var(--border)]">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 h-9">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className={clsx(
                'bg-[var(--surface-2)] animate-pulse h-2.5 rounded-md',
                c === 0 ? 'w-32' : c === cols - 1 ? 'w-16 ml-auto' : 'w-24',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
