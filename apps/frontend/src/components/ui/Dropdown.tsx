'use client';

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';

type Align = 'start' | 'end';

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: Align;
  className?: string;
  /** Width of the popover; defaults to auto */
  menuClassName?: string;
}

export default function Dropdown({
  trigger,
  children,
  align = 'start',
  className,
  menuClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className={clsx('relative inline-block', className)}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className={clsx(
              'absolute z-30 mt-1 min-w-[180px] bg-white rounded-lg border border-[var(--border)] py-1',
              align === 'end' ? 'right-0' : 'left-0',
              menuClassName,
            )}
            style={{ boxShadow: 'var(--shadow-popover)' }}
            role="menu"
          >
            {typeof children === 'function' ? children(close) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DropdownItemProps {
  onClick?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DropdownItem({
  onClick,
  icon,
  children,
  danger,
  disabled,
  className,
}: DropdownItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      role="menuitem"
      className={clsx(
        'w-full h-8 px-2.5 text-[13px] inline-flex items-center gap-2 text-left',
        'transition-colors duration-100',
        danger
          ? 'text-[var(--danger)] hover:bg-[var(--danger-soft)]'
          : 'text-[var(--text)] hover:bg-[var(--surface-2)]',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {icon && (
        <span className="shrink-0 text-[var(--text-subtle)]">{icon}</span>
      )}
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="h-px bg-[var(--border)] my-1" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
      {children}
    </div>
  );
}
