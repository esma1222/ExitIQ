import type { Lang } from './i18n';

// Legal pages live on the atares website. Their addresses are set per
// deployment (Vercel → Settings → Environment Variables), so a change on the
// atares site needs no code change. Until they are set, the links go to the
// atares homepage.

const env = import.meta.env as Record<string, string | undefined>;
const HOME = 'https://atares.team';

function pick(lang: Lang, de: string | undefined, en: string | undefined): string {
  return (lang === 'de' ? de || en : en || de) || HOME;
}

export function imprintUrl(lang: Lang): string {
  return pick(lang, env.VITE_IMPRINT_URL_DE, env.VITE_IMPRINT_URL);
}

export function privacyUrl(lang: Lang): string {
  return pick(lang, env.VITE_PRIVACY_URL_DE, env.VITE_PRIVACY_URL);
}

export const ATARES_HOME = HOME;
