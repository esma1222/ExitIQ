import { useSyncExternalStore } from 'react';

// One language setting for the whole site (landing page and assessment).
// Language is presentation only: stored answers, ids, scores and result
// snapshots stay language-neutral (English canonical text in the database).

export type Lang = 'en' | 'de';

const KEY = 'exitiq-lang';
const LEGACY_KEY = 'exitiq-landing-lang';

function read(): Lang {
  try {
    const v = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (v === 'de' || v === 'en') return v;
    return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
  } catch {
    return 'en';
  }
}

let current: Lang = read();
const listeners = new Set<() => void>();

if (typeof document !== 'undefined') document.documentElement.lang = current;

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* storage may be blocked; the choice still applies to this tab */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  listeners.forEach((fn) => fn());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getLang,
    getLang,
  );
}

/** Pick the string for the current language from an { en, de } pair. */
export function pick<T>(lang: Lang, v: { en: T; de: T }): T {
  return v[lang];
}

/** Locale for Intl formatting (dates, numbers). */
export function locale(lang: Lang): string {
  return lang === 'de' ? 'de-DE' : 'en-GB';
}
