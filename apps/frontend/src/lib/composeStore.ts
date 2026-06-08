'use client';

/**
 * Compose Email global store.
 *
 * Zero-dependency external store with React subscription via `useSyncExternalStore`.
 * Lets any client component open the ComposeEmailModal:
 *
 *   const { open, close } = useCompose();
 *   open({ recipients: [lead], leadId: lead.id });
 */

import { useSyncExternalStore } from 'react';
import type { Lead } from '@/types';

export interface ComposeRecipient {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
}

export interface ComposeOpenPayload {
  recipients?: Array<Lead | ComposeRecipient>;
  leadId?: string;
  campaignId?: string;
  subject?: string;
  body?: string;
}

interface ComposeState {
  isOpen: boolean;
  recipients: ComposeRecipient[];
  leadId?: string;
  campaignId?: string;
  initialSubject?: string;
  initialBody?: string;
}

const initialState: ComposeState = {
  isOpen: false,
  recipients: [],
};

let state: ComposeState = initialState;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(updater: (s: ComposeState) => ComposeState) {
  state = updater(state);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ComposeState {
  return state;
}

function getServerSnapshot(): ComposeState {
  return initialState;
}

function normalizeRecipient(r: Lead | ComposeRecipient): ComposeRecipient {
  if ('firstName' in r) {
    const lead = r as Lead;
    return {
      id: lead.id,
      name: `${lead.firstName} ${lead.lastName}`.trim(),
      email: lead.email ?? null,
      company: lead.company ?? null,
    };
  }
  return r as ComposeRecipient;
}

export const composeStore = {
  open(payload: ComposeOpenPayload = {}) {
    setState(() => ({
      isOpen: true,
      recipients: (payload.recipients ?? []).map(normalizeRecipient),
      leadId: payload.leadId,
      campaignId: payload.campaignId,
      initialSubject: payload.subject,
      initialBody: payload.body,
    }));
  },
  close() {
    setState((s) => ({ ...s, isOpen: false }));
  },
  reset() {
    setState(() => initialState);
  },
  setRecipients(recipients: ComposeRecipient[]) {
    setState((s) => ({ ...s, recipients }));
  },
  addRecipient(recipient: ComposeRecipient) {
    setState((s) => {
      if (s.recipients.some((r) => r.id === recipient.id)) return s;
      return { ...s, recipients: [...s.recipients, recipient] };
    });
  },
  removeRecipient(id: string) {
    setState((s) => ({ ...s, recipients: s.recipients.filter((r) => r.id !== id) }));
  },
  getState() {
    return state;
  },
};

export function useCompose() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    ...snapshot,
    open: composeStore.open,
    close: composeStore.close,
    reset: composeStore.reset,
    setRecipients: composeStore.setRecipients,
    addRecipient: composeStore.addRecipient,
    removeRecipient: composeStore.removeRecipient,
  };
}
