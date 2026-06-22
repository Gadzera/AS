'use client';

/**
 * Command palette (⌘K) global store.
 *
 * Тот же zero-dependency паттерн, что и composeStore: внешний стор +
 * useSyncExternalStore. Любой клиентский компонент (Sidebar, Topbar) может
 * открыть палитру: paletteStore.open().
 */

import { useSyncExternalStore } from 'react';

interface PaletteState {
  isOpen: boolean;
}

const initialState: PaletteState = { isOpen: false };

let state: PaletteState = initialState;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function setState(next: PaletteState) {
  state = next;
  emit();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const paletteStore = {
  open() {
    setState({ isOpen: true });
  },
  close() {
    setState({ isOpen: false });
  },
  toggle() {
    setState({ isOpen: !state.isOpen });
  },
  getState() {
    return state;
  },
};

export function usePalette() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => initialState,
  );
  return { ...snapshot, open: paletteStore.open, close: paletteStore.close, toggle: paletteStore.toggle };
}
