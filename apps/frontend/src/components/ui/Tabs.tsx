'use client';

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface TabsCtxValue {
  value: string;
  onChange: (v: string) => void;
  layoutId: string;
}

const TabsCtx = createContext<TabsCtxValue | null>(null);

interface TabsProps {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
  /** unique id for motion layoutId — useful if multiple Tabs on a page */
  id?: string;
}

export function Tabs({ value, onChange, children, className, id = 'tab-underline' }: TabsProps) {
  return (
    <TabsCtx.Provider value={{ value, onChange, layoutId: id }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={clsx(
        'flex items-end gap-4 border-b border-[var(--border)] h-10 px-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  count?: number;
  disabled?: boolean;
  className?: string;
}

export function TabsTrigger({ value, children, count, disabled, className }: TabsTriggerProps) {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error('TabsTrigger must be used inside Tabs');
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={() => !disabled && ctx.onChange(value)}
      className={clsx(
        'relative h-10 px-1 text-[13.5px] font-medium inline-flex items-center gap-1.5 transition-colors duration-100',
        active ? 'text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]',
        disabled && 'opacity-40 cursor-not-allowed',
        className,
      )}
    >
      <span>{children}</span>
      {typeof count === 'number' && (
        <span className="text-[12px] text-[var(--text-subtle)] tabular-nums">{count}</span>
      )}
      {active && (
        <motion.span
          layoutId={ctx.layoutId}
          className="absolute left-0 right-0 -bottom-px h-0.5 bg-[var(--text)] rounded-sm"
          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        />
      )}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error('TabsContent must be used inside Tabs');
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}

export default Tabs;
