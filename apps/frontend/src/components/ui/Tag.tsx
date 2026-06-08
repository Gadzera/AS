import clsx from 'clsx';
import { type ReactNode } from 'react';

export type TagColor =
  | 'violet'
  | 'pink'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'orange'
  | 'gray';

interface TagProps {
  color?: TagColor;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

const styles: Record<TagColor, { bg: string; ink: string }> = {
  violet: { bg: 'var(--tag-violet)', ink: 'var(--tag-violet-ink)' },
  pink:   { bg: 'var(--tag-pink)',   ink: 'var(--tag-pink-ink)' },
  yellow: { bg: 'var(--tag-yellow)', ink: 'var(--tag-yellow-ink)' },
  green:  { bg: 'var(--tag-green)',  ink: 'var(--tag-green-ink)' },
  blue:   { bg: 'var(--tag-blue)',   ink: 'var(--tag-blue-ink)' },
  orange: { bg: 'var(--tag-orange)', ink: 'var(--tag-orange-ink)' },
  gray:   { bg: 'var(--tag-gray)',   ink: 'var(--tag-gray-ink)' },
};

export default function Tag({ color = 'gray', children, className, icon }: TagProps) {
  const s = styles[color];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 h-5 px-1.5 rounded-sm text-[11px] font-medium leading-none whitespace-nowrap',
        className,
      )}
      style={{ backgroundColor: s.bg, color: s.ink }}
    >
      {icon}
      {children}
    </span>
  );
}
