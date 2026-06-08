'use client';

import clsx from 'clsx';
import { useMemo } from 'react';

type AvatarColor = 'violet' | 'pink' | 'yellow' | 'green' | 'blue' | 'orange' | 'gray';

interface AvatarProps {
  name?: string;
  src?: string | null;
  size?: 16 | 20 | 24 | 32 | 40;
  color?: AvatarColor;
  className?: string;
  title?: string;
}

const COLORS: AvatarColor[] = ['violet', 'pink', 'yellow', 'green', 'blue', 'orange'];

const palette: Record<AvatarColor, { bg: string; ink: string }> = {
  violet: { bg: 'var(--tag-violet)', ink: 'var(--tag-violet-ink)' },
  pink:   { bg: 'var(--tag-pink)',   ink: 'var(--tag-pink-ink)' },
  yellow: { bg: 'var(--tag-yellow)', ink: 'var(--tag-yellow-ink)' },
  green:  { bg: 'var(--tag-green)',  ink: 'var(--tag-green-ink)' },
  blue:   { bg: 'var(--tag-blue)',   ink: 'var(--tag-blue-ink)' },
  orange: { bg: 'var(--tag-orange)', ink: 'var(--tag-orange-ink)' },
  gray:   { bg: 'var(--tag-gray)',   ink: 'var(--tag-gray-ink)' },
};

const sizeMap: Record<number, { px: number; font: number }> = {
  16: { px: 16, font: 9 },
  20: { px: 20, font: 10 },
  24: { px: 24, font: 11 },
  32: { px: 32, font: 12 },
  40: { px: 40, font: 14 },
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  name = '',
  src,
  size = 24,
  color,
  className,
  title,
}: AvatarProps) {
  const initials = useMemo(() => getInitials(name || '?'), [name]);
  const resolvedColor: AvatarColor = color ?? COLORS[hashString(name || 'a') % COLORS.length];
  const p = palette[resolvedColor];
  const s = sizeMap[size] ?? sizeMap[24];

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name || ''}
        title={title || name}
        className={clsx('rounded-full object-cover shrink-0', className)}
        style={{ width: s.px, height: s.px }}
      />
    );
  }

  return (
    <span
      title={title || name}
      className={clsx(
        'inline-flex items-center justify-center rounded-full font-medium shrink-0 select-none leading-none',
        className,
      )}
      style={{
        width: s.px,
        height: s.px,
        fontSize: s.font,
        backgroundColor: p.bg,
        color: p.ink,
      }}
    >
      {initials || '?'}
    </span>
  );
}
