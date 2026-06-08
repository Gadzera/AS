import clsx from 'clsx';

type DotVariant = 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'brand' | 'yellow';

interface DotProps {
  variant?: DotVariant;
  className?: string;
  size?: 6 | 8;
}

const colorMap: Record<DotVariant, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger:  'var(--danger)',
  info:    'var(--info)',
  brand:   'var(--brand)',
  yellow:  '#d97706',
  gray:    'var(--text-subtle)',
};

export default function Dot({ variant = 'gray', className, size = 6 }: DotProps) {
  return (
    <span
      aria-hidden
      className={clsx('inline-block rounded-full shrink-0', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: colorMap[variant],
      }}
    />
  );
}
