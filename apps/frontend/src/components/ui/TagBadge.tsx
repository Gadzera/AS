'use client';

interface TagBadgeProps {
  name: string;
  color: string;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export default function TagBadge({ name, color, onRemove, size = 'sm' }: TagBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
      style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      {name}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70 transition-opacity ml-0.5" aria-label={`Remove tag ${name}`}>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </span>
  );
}
