// Deterministic written summary (brief section 20: "fall back to a
// deterministic template"). Built in the browser from the result object only,
// so it is always available, needs no server and no AI, and can never
// disagree with the figures on the page. Every paragraph carries its kind
// ("You reported" / "This may imply" / "Suggested next step") and the
// question ids it rests on (discovery answers as E01–E07).
//
// It leads with the decision: what can proceed, what needs clarification
// first and which owner should act first. Figures stay in the cards; the text
// quotes only counts.

import type { Lang } from '../lib/i18n';
import { discoveryOptionLabel, localQuestion, statusLabel } from '../i18n/localize';
import { QUESTION_BY_ID } from './catalogue';
import { buildPlanView, controlState, type PlanView } from './packages';
import { statedStrengths, type ResultSnapshot, type TaxRow } from './plan';
import type { ControlResult, ScoreResult } from './scoring';
import { REPORT_TEXT } from './text';
import type { Diagnostics } from './types';

export type ParagraphKind = 'reported' | 'implication' | 'next_step';
export interface Paragraph { kind: ParagraphKind; text: string; question_ids: string[] }
export interface Narrative { summary: Paragraph[]; strengths: Paragraph[]; priorities: Paragraph[]; tax: Paragraph[] }

const stop = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const quote = (lang: Lang, s: string) => (lang === 'de' ? `„${s}“` : `“${s}”`);
const list = (lang: Lang, xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')}${lang === 'de' ? ' und ' : ' and '}${xs[xs.length - 1]}`);

export const POSITIVE_EN = 'No preparation gaps identified from your answers. Next, validate the highest-impact claims and refresh the evidence before launch.';
export const POSITIVE_DE = 'Aus Ihren Antworten ergeben sich keine Vorbereitungslücken. Prüfen Sie als Nächstes die wichtigsten Aussagen und aktualisieren Sie die Nachweise vor dem Start.';

const T = {
  en: {
    positive: POSITIVE_EN,
    specialist: 'A specialist route comes first. A standard readiness conclusion is withheld until it is resolved; your answers are kept.',
    criticalFirst: (titles: string[]) => `Resolve ${titles.length === 1 ? 'one critical prerequisite' : `${titles.length} critical prerequisites`} before other preparation work: ${titles.join('; ')}.`,
    proceed: (pkgs: string[]) => `Preparation can proceed on the known work, starting with ${pkgs.join(' and ')}.`,
    proceedAfter: (pkgs: string[]) => `After that, preparation can proceed with ${pkgs.join(' and ')}.`,
    onlyOpen: 'No preparation gaps are known from your answers so far. The next step is to answer the open questions, which completes the picture.',
    clarify: (n: number, ws: string[]) => `${n} ${n === 1 ? 'question still needs' : 'questions still need'} clarification first${ws.length ? `, mostly on ${ws.map((w) => w.toLowerCase()).join(' and ')}` : ''}. Open questions are not gaps; they keep the assessment from being final.`,
    reviews: (titles: string[]) => `Before relying on the result, clarify: ${titles.join('; ')}.`,
    ownerFirst: (owner: string, step: string) => `The first owner to act: ${owner}, on ${quote('en', step)}.`,
    startOpen: (step: string) => `Start with ${lower(step)}.`,
    concentrationDone: 'You reported a concentrated customer base, and your answer on customer exposure (Q09) says the exposure and a response plan are documented. Keep that file current; a buyer will test it early.',
    concentrationOpen: (state: string) => `You reported a concentrated customer base, while customer exposure (Q09) is ${state}. The two belong together: a buyer will read the concentration through the response plan, so settle Q09 first.`,
    relationships: (state: string) => `You named customer relationships as a strength, while customer relationship continuity (Q14) is ${state}. A buyer will ask how those relationships transfer to a new owner.`,
    growth: (value: string, state: string) => `You named ${value.toLowerCase()} as the main constraint on growth, and capacity for growth (Q16) is ${state}. A buyer will ask how growth would be resourced.`,
    waiting: (title: string, id: string, deps: string[]) => `${title} (${id}) depends on ${deps.join(', ')}, which ${deps.length === 1 ? 'is' : 'are'} still open; settle ${deps.length === 1 ? 'it' : 'them'} first.`,
    evidenceLow: 'Most answers are self-reported so far. Adding dated documents with a named owner raises evidence support without changing the scores.',
    stated: (xs: string[]) => `You named ${list('en', xs.map((x) => x.toLowerCase()))} as the strongest ${xs.length === 1 ? 'reason' : 'reasons'} for a buyer’s interest. These are claims a buyer will test against evidence.`,
    prepStrengths: (names: string[]) => `Your answers put ${list('en', names.map((x) => x.toLowerCase()))} at the fully prepared level.`,
    reported: ' This is reported by you; no dated evidence is recorded yet.',
    supported: (n: number, total: number) => ` ${n} of ${total} ${total === 1 ? 'rests' : 'rest'} on a dated reference with a named owner.`,
    noStrength: 'Strengths appear here once you name them in discovery or answer a question at the fully prepared level.',
    step: (title: string, detail: string, owner: string | null) => `${stop(title)} ${stop(detail)}${owner ? ` Suggested owner: ${owner}.` : ''}`,
    more: (pk: number, cl: number) => `The action plan lists ${[pk ? `${pk} further work ${pk === 1 ? 'package' : 'packages'}` : '', cl ? `${cl} ${cl === 1 ? 'question' : 'questions'} to clarify` : ''].filter(Boolean).join(' and ')}.`,
    scope: { company: 'At company level', company_seller: 'At company and seller level', seller: 'At seller level', cross_border: 'Across borders' } as Record<TaxRow['scope'], string>,
    taxCounts: (scope: string, parts: string[]) => `${scope}, ${parts.join(', ')}.`,
    taxPart: { Prepared: 'prepared', 'In progress': 'in progress', 'Not started': 'not started', 'Needs review': 'needing review', 'Not yet assessed': 'not yet assessed' } as Record<TaxRow['status'], string>,
    count: (n: number, label: string) => `${n} ${n === 1 ? 'item' : 'items'} ${label}`,
    taxIntro: 'Tax runs as one workstream with company, seller and cross-border responsibilities; structure alternatives and historical restrictions affect both the company and the sellers.',
    specialistReview: (state: string) => `Specialist review by a transaction tax adviser (Q25) is ${state}.`,
    taxNext: 'Agree a transaction-specific scope with a tax adviser and close the open points, starting with the seller and structure questions.',
    taxNone: 'Tax preparation is not yet assessed.',
  },
  de: {
    positive: POSITIVE_DE,
    specialist: 'Zuerst ist ein Spezialistenpfad nötig. Eine Standardaussage zur Readiness entfällt, bis er geklärt ist; Ihre Antworten bleiben erhalten.',
    criticalFirst: (titles: string[]) => `Klären Sie ${titles.length === 1 ? 'eine kritische Voraussetzung' : `${titles.length} kritische Voraussetzungen`} vor jeder anderen Vorbereitung: ${titles.join('; ')}.`,
    proceed: (pkgs: string[]) => `Die Vorbereitung kann bei der bekannten Arbeit weitergehen, beginnend mit ${pkgs.join(' und ')}.`,
    proceedAfter: (pkgs: string[]) => `Danach kann die Vorbereitung mit ${pkgs.join(' und ')} weitergehen.`,
    onlyOpen: 'Aus Ihren bisherigen Antworten sind keine Vorbereitungslücken bekannt. Der nächste Schritt ist, die offenen Fragen zu beantworten; das vervollständigt das Bild.',
    clarify: (n: number, ws: string[]) => `${n} ${n === 1 ? 'Frage muss' : 'Fragen müssen'} zuerst geklärt werden${ws.length ? `, vor allem zu ${ws.join(' und ')}` : ''}. Offene Fragen sind keine Lücken; sie verhindern nur ein abschließendes Ergebnis.`,
    reviews: (titles: string[]) => `Bevor Sie sich auf das Ergebnis stützen, klären Sie: ${titles.join('; ')}.`,
    ownerFirst: (owner: string, step: string) => `Zuerst handeln sollte: ${owner}, bei ${quote('de', step)}.`,
    startOpen: (step: string) => `Beginnen Sie mit: ${step}.`,
    concentrationDone: 'Sie haben eine Konzentration auf wenige Kunden angegeben, und laut Ihrer Antwort zur Kundenabhängigkeit (Q09) sind die Abhängigkeit und ein Plan dafür dokumentiert. Halten Sie diese Unterlagen aktuell; Käufer prüfen sie früh.',
    concentrationOpen: (state: string) => `Sie haben eine Konzentration auf wenige Kunden angegeben, während die Kundenabhängigkeit (Q09) ${state} ist. Beides gehört zusammen: Käufer lesen die Konzentration im Licht des Plans für den Ernstfall, daher sollte Q09 zuerst geklärt werden.`,
    relationships: (state: string) => `Sie nennen Kundenbeziehungen als Stärke, während die Kontinuität der Kundenbeziehungen (Q14) ${state} ist. Käufer werden fragen, wie diese Beziehungen auf einen neuen Eigentümer übergehen.`,
    growth: (value: string, state: string) => `Sie nennen „${value}“ als wichtigsten Engpass für Wachstum, und die Kapazität für Wachstum (Q16) ist ${state}. Käufer werden fragen, wie Wachstum ausgestattet würde.`,
    waiting: (title: string, id: string, deps: string[]) => `„${title}“ (${id}) hängt von ${deps.join(', ')} ab, ${deps.length === 1 ? 'das noch offen ist' : 'die noch offen sind'}; klären Sie ${deps.length === 1 ? 'diese Frage' : 'diese Fragen'} zuerst.`,
    evidenceLow: 'Die meisten Antworten beruhen bisher auf Ihrer Selbsteinschätzung. Datierte Dokumente mit benannter verantwortlicher Person erhöhen die Nachweisstützung, ohne die Werte zu verändern.',
    stated: (xs: string[]) => `Sie haben ${list('de', xs.map((x) => `„${x}“`))} als ${xs.length === 1 ? 'stärksten Grund' : 'stärkste Gründe'} für das Interesse eines Käufers genannt. Käufer werden diese Aussagen anhand von Nachweisen prüfen.`,
    prepStrengths: (names: string[]) => `Laut Ihren Antworten sind ${list('de', names.map((x) => `„${x}“`))} vollständig vorbereitet.`,
    reported: ' Das ist Ihre Angabe; datierte Nachweise sind noch nicht erfasst.',
    supported: (n: number, total: number) => ` ${n} von ${total} ${n === 1 ? 'stützt sich' : 'stützen sich'} auf einen datierten Nachweis mit benannter Verantwortung.`,
    noStrength: 'Stärken erscheinen hier, sobald Sie sie im Einstieg nennen oder eine Frage auf der Stufe „vollständig vorbereitet“ beantworten.',
    step: (title: string, detail: string, owner: string | null) => `${stop(title)} ${stop(detail)}${owner ? ` Vorgeschlagene Verantwortung: ${owner}.` : ''}`,
    more: (pk: number, cl: number) => `Der Maßnahmenplan enthält ${[pk ? `${pk} ${pk === 1 ? 'weiteres Arbeitspaket' : 'weitere Arbeitspakete'}` : '', cl ? `${cl} ${cl === 1 ? 'offene Frage' : 'offene Fragen'} zur Klärung` : ''].filter(Boolean).join(' und ')}.`,
    scope: { company: 'Auf Unternehmensebene', company_seller: 'Auf Unternehmens- und Verkäuferebene', seller: 'Auf Verkäuferebene', cross_border: 'Grenzüberschreitend' } as Record<TaxRow['scope'], string>,
    taxCounts: (scope: string, parts: string[]) => `${scope}: ${parts.join(', ')}.`,
    taxPart: { Prepared: 'vorbereitet', 'In progress': 'in Arbeit', 'Not started': 'nicht begonnen', 'Needs review': 'zu prüfen', 'Not yet assessed': 'noch nicht bewertet' } as Record<TaxRow['status'], string>,
    count: (n: number, label: string) => `${n} ${n === 1 ? 'Punkt' : 'Punkte'} ${label}`,
    taxIntro: 'Steuern laufen als ein Arbeitsstrang mit Zuständigkeiten auf Ebene der Gesellschaft, der Verkäufer und grenzüberschreitend; Strukturalternativen und frühere Beschränkungen betreffen sowohl die Gesellschaft als auch die Verkäufer.',
    specialistReview: (state: string) => `Die Prüfung durch einen transaktionserfahrenen Steuerberater (Q25) ist ${state}.`,
    taxNext: 'Vereinbaren Sie mit einem Steuerberater einen transaktionsbezogenen Umfang und schließen Sie die offenen Punkte, beginnend mit den Fragen zu Verkäufern und Struktur.',
    taxNone: 'Die steuerliche Vorbereitung ist noch nicht bewertet.',
  },
};

const TAX_ORDER: TaxRow['status'][] = ['Prepared', 'In progress', 'Not started', 'Needs review', 'Not yet assessed'];
const TAX_SCOPES: TaxRow['scope'][] = ['company', 'company_seller', 'seller', 'cross_border'];

/** State of a control as a short phrase for running text ("partly in place", "not yet assessed"). */
function statePhrase(lang: Lang, c: ControlResult | undefined): string {
  const s = controlState(c);
  const S = REPORT_TEXT[lang].state;
  const de = lang === 'de';
  switch (s) {
    case 'p100': return de ? 'vorhanden' : 'in place';
    case 'p50': return de ? 'teilweise vorhanden' : 'partly in place';
    case 'p0': return de ? 'nicht vorhanden' : 'not in place';
    case 'unanswered': return de ? 'noch nicht bewertet' : 'not yet assessed';
    case 'reconfirm': return de ? `als „${S.reconfirm}“ markiert` : `marked “${S.reconfirm.toLowerCase()}”`;
    default: return de ? `als „${statusLabel(lang, c!.status)}“ markiert` : `marked “${statusLabel(lang, c!.status).toLowerCase()}”`;
  }
}

const RELATIONSHIP_STRENGTHS = new Set(['Customer loyalty', 'Personal customer relationships']);

/** Pure: the same result, language and discovery answers always give the same text. */
export function templateNarrative(r: ResultSnapshot & { score: ScoreResult }, lang: Lang, diag: Diagnostics = {}, view?: PlanView): Narrative {
  const t = T[lang];
  const plan = view ?? buildPlanView(r, lang);
  const ctl = (id: string) => r.score.controls[id];
  const qName = (id: string) => localQuestion(lang, QUESTION_BY_ID[id]).name;
  const pkgNames = plan.packages.slice(0, 2).map((p) => quote(lang, p.name));
  const pkgIds = plan.packages.slice(0, 2).flatMap((p) => p.tasks.flatMap((x) => x.sourceQuestionIds));
  const allClear = !plan.critical.length && !plan.packages.length && !plan.clarifyCount && !r.risks.length && !r.specialist.length;

  // ── Summary: the decision first ───────────────────────────────────────────
  const summary: Paragraph[] = [];
  if (r.specialist.length) summary.push({ kind: 'implication', text: t.specialist, question_ids: [] });
  if (plan.critical.length) {
    summary.push({ kind: 'implication', text: t.criticalFirst(plan.critical.map((x) => x.title)), question_ids: [...new Set(plan.critical.flatMap((x) => x.sourceQuestionIds))] });
    if (plan.packages.length) summary.push({ kind: 'implication', text: t.proceedAfter(pkgNames), question_ids: pkgIds });
  } else if (plan.packages.length) {
    summary.push({ kind: 'implication', text: t.proceed(pkgNames), question_ids: pkgIds });
  } else if (plan.clarifyCount) {
    summary.push({ kind: 'implication', text: t.onlyOpen, question_ids: [] });
  } else if (allClear) {
    summary.push({ kind: 'next_step', text: t.positive, question_ids: [] });
  }
  if (plan.clarifyCount) {
    const ws = plan.clarifyGroups.slice(0, 2).map((g) => g.name);
    summary.push({ kind: 'reported', text: t.clarify(plan.clarifyCount, ws), question_ids: plan.clarifyGroups.slice(0, 2).flatMap((g) => g.tasks.flatMap((x) => x.sourceQuestionIds)) });
  }
  if (plan.reviews.length) {
    summary.push({ kind: 'implication', text: t.reviews(plan.reviews.map((x) => x.title)), question_ids: [...new Set(plan.reviews.flatMap((x) => x.sourceQuestionIds))] });
  }
  const first = plan.nextSteps[0];
  if (first) {
    summary.push({ kind: 'next_step', text: first.owner ? t.ownerFirst(first.owner, first.title) : t.startOpen(first.title), question_ids: first.questionIds.slice(0, 6) });
  }

  // Connections between answers (at most two).
  const links: Paragraph[] = [];
  const e04 = typeof diag.E04 === 'string' ? diag.E04 : '';
  if ((e04 === 'Over 30%' || e04 === '20 to 30%') && ctl('Q09')) {
    const done = controlState(ctl('Q09')) === 'p100';
    links.push({ kind: 'implication', text: done ? t.concentrationDone : t.concentrationOpen(statePhrase(lang, ctl('Q09'))), question_ids: ['E04', 'Q09'] });
  }
  const e01 = Array.isArray(diag.E01) ? diag.E01 : [];
  if (e01.some((x) => RELATIONSHIP_STRENGTHS.has(x)) && ctl('Q14') && controlState(ctl('Q14')) !== 'p100') {
    links.push({ kind: 'implication', text: t.relationships(statePhrase(lang, ctl('Q14'))), question_ids: ['E01', 'Q14'] });
  }
  const e07 = typeof diag.E07 === 'string' ? diag.E07 : '';
  const growthNamed = !!e07 && !['Not assessed', 'Not yet calculated', 'Other', 'Unknown', 'Prefer not to answer', 'Nothing material'].includes(e07);
  if (growthNamed && ctl('Q16') && controlState(ctl('Q16')) !== 'p100') {
    links.push({ kind: 'implication', text: t.growth(discoveryOptionLabel(lang, 'E07', e07), statePhrase(lang, ctl('Q16'))), question_ids: ['E07', 'Q16'] });
  }
  const waiting = r.tasks.find((x) => x.kind === 'gap' && x.waitingFor.length);
  if (waiting) {
    const id = waiting.sourceQuestionIds[0];
    links.push({ kind: 'implication', text: t.waiting(qName(id), id, waiting.waitingFor), question_ids: [id, ...waiting.waitingFor] });
  }
  summary.push(...links.slice(0, 2));

  if (r.dimensions.every((d) => d.evidenceSupport < 0.5) && r.dimensions.some((d) => d.coverage > 0) && !allClear) {
    summary.push({ kind: 'next_step', text: t.evidenceLow, question_ids: [] });
  }
  if (!summary.length) summary.push({ kind: 'next_step', text: t.positive, question_ids: [] });

  // ── Strengths: stated (discovery) separate from preparation (answers) ────
  const strengths: Paragraph[] = [];
  const stated = statedStrengths(diag, lang);
  if (stated.length) strengths.push({ kind: 'reported', text: t.stated(stated.map((x) => x.label)), question_ids: ['E01'] });
  if (r.strengths.length) {
    const withRef = r.strengths.filter((x) => (ctl(x.id)?.evidenceFactor ?? 0) > 0).length;
    strengths.push({
      kind: 'reported',
      text: t.prepStrengths(r.strengths.map((x) => x.name)) + (withRef ? t.supported(withRef, r.strengths.length) : t.reported),
      question_ids: r.strengths.map((x) => x.id),
    });
  }
  if (!strengths.length) strengths.push({ kind: 'implication', text: t.noStrength, question_ids: [] });

  // ── Priorities: the recommended next steps ───────────────────────────────
  const priorities: Paragraph[] = plan.nextSteps.map((s) => ({ kind: 'next_step' as const, text: t.step(s.title, s.detail, s.owner), question_ids: s.questionIds }));
  if (!priorities.length) priorities.push({ kind: 'next_step', text: t.positive, question_ids: [] });
  const shownPkgs = plan.nextSteps.filter((s) => s.kind === 'package').length;
  const morePk = plan.packages.length - shownPkgs;
  const moreCl = plan.clarifyCount;
  if (morePk > 0 || (moreCl > 0 && plan.nextSteps.length)) priorities.push({ kind: 'implication', text: t.more(Math.max(0, morePk), moreCl), question_ids: [] });

  // ── Tax: one workstream ──────────────────────────────────────────────────
  const tax: Paragraph[] = [];
  if (r.tax.length) tax.push({ kind: 'implication', text: t.taxIntro, question_ids: [] });
  for (const scope of TAX_SCOPES) {
    const rows = r.tax.filter((x) => x.scope === scope);
    if (!rows.length) continue;
    const parts = TAX_ORDER.map((st) => [st, rows.filter((x) => x.status === st).length] as const)
      .filter(([, n]) => n > 0)
      .map(([st, n]) => t.count(n, t.taxPart[st]));
    tax.push({ kind: 'reported', text: t.taxCounts(t.scope[scope], parts), question_ids: rows.map((x) => x.id) });
  }
  if (ctl('Q25')) tax.push({ kind: 'reported', text: t.specialistReview(statePhrase(lang, ctl('Q25'))), question_ids: ['Q25'] });
  if (!r.tax.length) tax.push({ kind: 'reported', text: t.taxNone, question_ids: [] });
  else if (r.tax.some((x) => x.status !== 'Prepared')) {
    tax.push({ kind: 'next_step', text: t.taxNext, question_ids: r.tax.filter((x) => x.status !== 'Prepared').map((x) => x.id) });
  }

  return { summary, strengths, priorities, tax };
}

