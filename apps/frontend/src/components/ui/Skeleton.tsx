import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  rows?: number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export default function Skeleton({ className, rounded = 'md' }: SkeletonProps) {
  const r = { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', full: 'rounded-full' }[rounded];
  return (
    <div className={clsx('skeleton', r, className)} />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx('skeleton h-3 rounded-md', i === lines - 1 && lines > 1 && 'w-3/5')}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={clsx('bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3', className)}>
      <div className="flex items-center gap-3">
        <div className="skeleton w-9 h-9 rounded-lg shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="skeleton h-3 w-24 rounded-md" />
          <div className="skeleton h-2 w-16 rounded-md" />
        </div>
      </div>
      <div className="skeleton h-7 w-20 rounded-md" />
      <div className="skeleton h-2 w-full rounded-md" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0 divide-y divide-gray-800/60">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className={clsx('skeleton h-3 rounded-md', c === 0 ? 'w-32' : c === cols - 1 ? 'w-16 ml-auto' : 'w-24')} />
          ))}
        </div>
      ))}
    </div>
  );
}
