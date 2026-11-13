import { useSyncExternalStore } from 'react';

// Which legal notice is open in the dialog, if any. Shared so any link on any
// page (landing footer, privacy note in the assessment, direct /imprint or
// /privacy URLs) opens the same dialog.

export type LegalTab = 'imprint' | 'privacy';

let open: LegalTab | null = null;
const listeners = new Set<() => void>();

function set(v: LegalTab | null) {
  open = v;
  listeners.forEach((fn) => fn());
}

export function openLegal(tab: LegalTab) {
  set(tab);
}

export function closeLegal() {
  set(null);
}

export function useLegal(): LegalTab | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => open,
    () => open,
  );
}

/** Maps an in-app link to a legal tab: /imprint and /privacy (with or without a trailing slash). */
export function legalTabForPath(pathname: string): LegalTab | null {
  const p = pathname.replace(/\/+$/, '');
  if (p === '/imprint') return 'imprint';
  if (p === '/privacy') return 'privacy';
  return null;
}
