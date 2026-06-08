'use client';

import { type ReactNode } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import clsx from 'clsx';
import Topbar, { type TopbarProps } from './Topbar';
import Button from '@/components/ui/Button';

/**
 * PageHeader — composes the sticky Topbar with an optional ViewTabsRow row underneath.
 *
 *   <PageHeader icon={<Users size={16}/>} title="Leads">
 *     <ViewTabsRow>...</ViewTabsRow>
 *   </PageHeader>
 *
 * Children render below the Topbar — most commonly a `<ViewTabsRow />` block.
 */
interface PageHeaderProps extends TopbarProps {
  /** Content rendered below the topbar (typically <ViewTabsRow />). */
  children?: ReactNode;
}

export default function PageHeader({ children, ...topbarProps }: PageHeaderProps) {
  return (
    <>
      <Topbar {...topbarProps} />
      {children}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* ViewTabsRow — h-11 row directly under Topbar.                       */
/*                                                                     */
/* Two API shapes supported for ergonomics:                            */
/*   1. children mode: <ViewTabsRow>...</ViewTabsRow>                  */
/*      Renders children inside `left` slot.                           */
/*   2. left/right slots: <ViewTabsRow left={[...]} right={[...]} />   */
/* ------------------------------------------------------------------ */

interface ViewTabsRowProps {
  left?: ReactNode | ReactNode[];
  right?: ReactNode | ReactNode[];
  children?: ReactNode;
  className?: string;
}

function toNodes(slot?: ReactNode | ReactNode[]): ReactNode[] {
  if (!slot) return [];
  return Array.isArray(slot) ? slot : [slot];
}

export function ViewTabsRow({ left, right, children, className }: ViewTabsRowProps) {
  const leftItems = children ? [children] : toNodes(left);
  const rightItems = toNodes(right);

  return (
    <div
      className={clsx(
        'sticky top-11 z-10 h-11 bg-white border-b border-[var(--border)] flex items-center justify-between px-4 gap-2',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto">
        {leftItems.map((item, i) => (
          <span key={i} className="shrink-0 inline-flex items-center">
            {item}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {rightItems.map((item, i) => (
          <span key={i} className="inline-flex items-center">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Convenience preset for the right-side actions of a list/table page:
 * `Import / Export ▾` (secondary) + `+ New ...` (primary).
 */
interface ListActionsProps {
  newLabel?: string;
  onNew?: () => void;
  onImportExport?: () => void;
}

export function ListActions({
  newLabel = 'New',
  onNew,
  onImportExport,
}: ListActionsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="secondary" size="sm" onClick={onImportExport}>
        <span>Import / Export</span>
        <ChevronDown size={12} strokeWidth={1.75} />
      </Button>
      <Button variant="primary" size="sm" onClick={onNew}>
        <Plus size={14} strokeWidth={1.75} />
        <span>{newLabel}</span>
      </Button>
    </div>
  );
}
