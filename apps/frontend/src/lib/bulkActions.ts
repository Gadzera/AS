/**
 * Bulk action descriptors consumed by BulkActionFooter on the Leads page.
 *
 * Each action receives the current selection set and the original record list,
 * so the handler can resolve full records (e.g. to pre-fill the compose modal).
 */

import type { ReactNode } from 'react';
import { ListPlus, Mail, Trash2, Workflow } from 'lucide-react';
import { createElement } from 'react';
import type { Lead } from '@/types';
import { composeStore } from './composeStore';

export interface BulkAction {
  id: string;
  label: string;
  icon: ReactNode;
  /**
   * Called when the action is invoked from the bulk footer.
   * `selectedIds` are the ids that are currently selected.
   * `records` is the full list of leads the page currently has loaded; the handler
   * picks the relevant ones by id.
   */
  onClick: (selectedIds: string[], records: Lead[]) => void;
  destructive?: boolean;
}

function pickLeads(ids: string[], records: Lead[]): Lead[] {
  const idSet = new Set(ids);
  return records.filter((r) => idSet.has(r.id));
}

export const leadsBulkActions: BulkAction[] = [
  {
    id: 'send-email',
    label: 'Send email',
    icon: createElement(Mail, { size: 14, strokeWidth: 1.75 }),
    onClick: (ids, records) => {
      const recipients = pickLeads(ids, records);
      composeStore.open({ recipients });
    },
  },
  {
    id: 'add-to-list',
    label: 'Add to list',
    icon: createElement(ListPlus, { size: 14, strokeWidth: 1.75 }),
    onClick: () => {
      // hook for future "Add to list" modal
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.info('[bulk] Add to list — modal not implemented yet');
      }
    },
  },
  {
    id: 'run-workflow',
    label: 'Run workflow',
    icon: createElement(Workflow, { size: 14, strokeWidth: 1.75 }),
    onClick: () => {
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.info('[bulk] Run workflow — modal not implemented yet');
      }
    },
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: createElement(Trash2, { size: 14, strokeWidth: 1.75 }),
    destructive: true,
    onClick: () => {
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.info('[bulk] Delete — confirmation modal not implemented yet');
      }
    },
  },
];
