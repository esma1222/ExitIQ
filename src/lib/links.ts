import type { Lang } from './i18n';

// The imprint and privacy notice are pages of the tool itself (/imprint,
// /privacy, text supplied by atares). A deployment can still point them
// elsewhere with VITE_IMPRINT_URL / VITE_PRIVACY_URL (and _DE variants).

const env = import.meta.env as Record<string, string | undefined>;
const HOME = 'https://atares.team';

function pick(lang: Lang, de: string | undefined, en: string | undefined, fallback: string): string {
  return (lang === 'de' ? de || en : en || de) || fallback;
}

export function imprintUrl(lang: Lang): string {
  return pick(lang, env.VITE_IMPRINT_URL_DE, env.VITE_IMPRINT_URL, '/imprint');
}

export function privacyUrl(lang: Lang): string {
  return pick(lang, env.VITE_PRIVACY_URL_DE, env.VITE_PRIVACY_URL, '/privacy');
}

export const ATARES_HOME = HOME;

/** Contact address for "Discuss with atares". */
export const CONTACT_EMAIL = 'exitiq@atares.io';

/**
 * mailto link with a short, neutral pre-filled message. It deliberately
 * contains no answers or results: what to share stays the user's choice.
 */
export function contactMailto(lang: Lang): string {
  const subject = lang === 'de' ? 'ExitIQ: Gespräch zu meinem Maßnahmenplan' : 'ExitIQ: discussing my action plan';
  const body = lang === 'de'
    ? 'Guten Tag,\n\nich habe die ExitIQ-Selbsteinschätzung abgeschlossen und würde die Ergebnisse und offenen Punkte gerne mit Ihnen besprechen.\n\nMit freundlichen Grüßen\n'
    : 'Hello,\n\nI have completed the ExitIQ self-assessment and would like to discuss the results and open points with you.\n\nKind regards\n';
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
