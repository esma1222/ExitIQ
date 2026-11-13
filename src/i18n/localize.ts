// Display-time localisation of the catalogue and option lists.
//
// The English catalogue in src/model is the single scored source of truth (and
// is what the SQL seed is generated from). German is an overlay keyed by the
// same stable ids. Translating must never change ids, weights, routes or the
// number of anchors, so the overlay only carries text.

import type { Lang } from '../lib/i18n';
import {
  CHAPTERS, DIMENSIONS, DOMAIN_ACTIONS, DOMAIN_NAMES, PROFILES, QUESTION_BY_ID, ROUTE_LABELS,
} from '../model/catalogue';
import { DISCOVERY, STATUS_LABELS, type DiscoveryScreen, type Opt } from '../model/options';
import type { DimensionKey, DomainKey, Profile, QuestionDef, RouteCode } from '../model/types';
import { DE } from './catalogue-de';

export interface QuestionText {
  name: string;
  question: string;
  anchors: [string, string, string];
  contributor: string;
  help?: string;
  evidenceRequest?: string;
  variants?: Partial<Record<'owner_led' | 'employed' | 'growth' | 'venture', string>>;
}

export interface DiscoveryText {
  theme: string;
  title: string | null;
  /** Sub-line under a conversational heading (control screens). */
  sub?: string | null;
  /** Heading for owner-led management (E05). */
  titleOwnerLed?: string;
  help: string;
  /** Same length and order as the English options (the English value is what gets stored). */
  options?: string[];
}

/** Everything the German overlay must provide. Keys mirror the English catalogue. */
export interface CatalogueTranslation {
  dimensions: Record<DimensionKey, string>;
  domains: Record<DomainKey, string>;
  profiles: Record<Profile, { name: string; description: string }>;
  routes: Record<RouteCode, string>;
  actions: Record<DomainKey, { action: string; lead: string }>;
  /** Same order as CHAPTERS. */
  chapters: string[];
  questions: Record<string, QuestionText>;
  discovery: Record<DiscoveryScreen['id'], DiscoveryText>;
  statusLabels: Record<string, string>;
  /** Option labels keyed by the stored option value, e.g. options.role.owner. */
  options: Record<string, Record<string, string>>;
  /** Labels for the free-list bands (revenue, employees, business models), keyed by the English label. */
  bands: Record<string, string>;
}

export function dimensionName(lang: Lang, k: DimensionKey): string {
  return lang === 'de' ? DE.dimensions[k] : DIMENSIONS.find((d) => d.key === k)!.name;
}

export function domainName(lang: Lang, k: DomainKey): string {
  return lang === 'de' ? DE.domains[k] : DOMAIN_NAMES[k];
}

export function profileText(lang: Lang, k: Profile): { name: string; description: string } {
  const en = PROFILES.find((p) => p.key === k)!;
  return lang === 'de' ? DE.profiles[k] : { name: en.name, description: en.description };
}

export function routeLabel(lang: Lang, k: RouteCode): string {
  return lang === 'de' ? DE.routes[k] : ROUTE_LABELS[k];
}

export function domainAction(lang: Lang, k: DomainKey): { action: string; lead: string } {
  return lang === 'de' ? DE.actions[k] : DOMAIN_ACTIONS[k];
}

export function chapterTitle(lang: Lang, index: number): string {
  return lang === 'de' ? DE.chapters[index] : CHAPTERS[index].title;
}

/** The question definition with its text in the requested language. Ids, weights and routes are untouched. */
export function localQuestion(lang: Lang, q: QuestionDef): QuestionDef {
  if (lang === 'en') return q;
  const t = DE.questions[q.id];
  if (!t) return q;
  return { ...q, ...t, variants: t.variants ?? q.variants, help: t.help ?? q.help, evidenceRequest: t.evidenceRequest ?? q.evidenceRequest };
}

export function localQuestionById(lang: Lang, id: string): QuestionDef {
  return localQuestion(lang, QUESTION_BY_ID[id]);
}

export function discoveryScreens(lang: Lang): DiscoveryScreen[] {
  if (lang === 'en') return DISCOVERY;
  return DISCOVERY.map((s) => {
    const t = DE.discovery[s.id];
    const extra = s.kind === 'control' ? { sub: t.sub ?? s.sub, titleOwnerLed: t.titleOwnerLed ?? s.titleOwnerLed } : {};
    return { ...s, ...extra, theme: t.theme, title: t.title ?? s.title, help: t.help } as DiscoveryScreen;
  });
}

/**
 * Display label for a stored discovery band value. The stored value is always
 * the English option (it is what observations and analytics key on).
 */
export function discoveryOptionLabel(lang: Lang, id: DiscoveryScreen['id'], englishValue: string): string {
  if (lang === 'en') return englishValue;
  const screen = DISCOVERY.find((s) => s.id === id);
  const opts = screen && 'options' in screen ? screen.options : undefined;
  const i = opts ? opts.indexOf(englishValue) : -1;
  return (i >= 0 && DE.discovery[id].options?.[i]) || DE.bands[englishValue] || englishValue;
}

export function statusLabel(lang: Lang, status: string): string {
  return lang === 'de' ? (DE.statusLabels[status] ?? STATUS_LABELS[status] ?? status) : (STATUS_LABELS[status] ?? status);
}

/** Localise an option list for a context field. `group` is the key in DE.options (role, ownership, management, ...). */
export function localOptions<T extends string>(lang: Lang, group: string, opts: Opt<T>[]): Opt<T>[] {
  if (lang === 'en') return opts;
  const g = DE.options[group] ?? {};
  return opts.map((o) => ({ ...o, label: g[o.value] ?? o.label }));
}

/** Localise a free-list band label (stored value stays English). */
export function bandLabel(lang: Lang, englishLabel: string): string {
  return lang === 'de' ? (DE.bands[englishLabel] ?? englishLabel) : englishLabel;
}
