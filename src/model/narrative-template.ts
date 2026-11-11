// Deterministic written summary (brief section 20: "fall back to a
// deterministic template"). Built in the browser from the result object only,
// so it is always available, needs no server and no AI, and can never
// disagree with the figures on the page. Every paragraph carries its kind
// ("You reported" / "This may imply" / "Suggested next step") and the
// question ids it rests on.

import type { Lang } from '../lib/i18n';
import { dimensionName } from '../i18n/localize';
import type { ResultSnapshot, TaxRow } from './plan';
import type { ScoreResult } from './scoring';

export type ParagraphKind = 'reported' | 'implication' | 'next_step';
export interface Paragraph { kind: ParagraphKind; text: string; question_ids: string[] }
export interface Narrative { summary: Paragraph[]; strengths: Paragraph[]; priorities: Paragraph[]; tax: Paragraph[] }

const pct = (x: number) => Math.round(x * 100);
const stop = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const T = {
  en: {
    dimShown: (name: string, i: number, cov: number, ev: number) => `${name} has an index of ${i}, based on ${cov}% answer coverage and ${ev}% evidence support.`,
    dimRange: (lo: number, hi: number) => ` Open answers could still move it between ${lo} and ${hi}.`,
    dimComplete: ' All applicable questions are answered.',
    dimHidden: (name: string, cov: number, open: number) => `${name} has ${cov}% answer coverage, which is not yet enough for an index; ${open} ${open === 1 ? 'question is' : 'questions are'} still open.`,
    critical: (n: number) => `There ${n === 1 ? 'is 1 critical prerequisite' : `are ${n} critical prerequisites`}. These come before other preparation work, whatever the scores show.`,
    review: (n: number) => `${n} ${n === 1 ? 'item needs' : 'items need'} review before the picture is complete. Open items are not failures; they keep the assessment from being final.`,
    calm: 'No critical prerequisites follow from your answers. This does not replace specialist review.',
    evidenceLow: 'Most answers are self-reported so far. Adding dated documents with a named owner raises evidence support without changing the scores.',
    strength: (name: string, anchor: string) => `${name}: ${lower(stop(anchor))}`,
    noStrength: 'Strengths appear here once your answers support them.',
    task: (title: string, action: string, owner: string, timing: string) => `${title}: ${lower(stop(action))} Suggested owner: ${owner}; timing: ${lower(timing)}.`,
    moreTasks: (n: number) => `${n} further ${n === 1 ? 'action is' : 'actions are'} listed in the action plan above.`,
    noTasks: 'There are no open actions. Keep the evidence up to date as the transaction approaches.',
    scope: { company: 'At company level', seller: 'At seller level', cross_border: 'Across borders' } as Record<TaxRow['scope'], string>,
    taxCounts: (scope: string, parts: string[]) => `${scope}, ${parts.join(', ')}.`,
    taxPart: { Prepared: 'prepared', 'In progress': 'in progress', 'Not started': 'not started', 'Needs review': 'needing review', 'Not yet assessed': 'not yet assessed' } as Record<TaxRow['status'], string>,
    count: (n: number, label: string) => `${n} ${n === 1 ? 'item' : 'items'} ${label}`,
    taxNext: 'Agree a transaction-specific scope with a tax adviser and close the open points first, starting with the seller and structure questions.',
    taxNone: 'Tax preparation is not yet assessed.',
  },
  de: {
    dimShown: (name: string, i: number, cov: number, ev: number) => `${name} erreicht einen Index von ${i}, bei ${cov}% Antwortabdeckung und ${ev}% Nachweisstützung.`,
    dimRange: (lo: number, hi: number) => ` Offene Antworten könnten ihn noch zwischen ${lo} und ${hi} verschieben.`,
    dimComplete: ' Alle zutreffenden Fragen sind beantwortet.',
    dimHidden: (name: string, cov: number, open: number) => `${name} hat ${cov}% Antwortabdeckung; das reicht noch nicht für einen Index. ${open} ${open === 1 ? 'Frage ist' : 'Fragen sind'} noch offen.`,
    critical: (n: number) => `Es ${n === 1 ? 'gibt 1 kritische Voraussetzung' : `gibt ${n} kritische Voraussetzungen`}. Sie gehen jeder anderen Vorbereitung vor, unabhängig von den Werten.`,
    review: (n: number) => `${n} ${n === 1 ? 'Punkt muss' : 'Punkte müssen'} noch geprüft werden, bevor das Bild vollständig ist. Offene Punkte sind keine Mängel; sie verhindern nur ein abschließendes Ergebnis.`,
    calm: 'Aus Ihren Antworten ergeben sich keine kritischen Voraussetzungen. Das ersetzt keine Prüfung durch Spezialisten.',
    evidenceLow: 'Die meisten Antworten beruhen bisher auf Ihrer Selbsteinschätzung. Datierte Dokumente mit benannter verantwortlicher Person erhöhen die Nachweisstützung, ohne die Werte zu verändern.',
    strength: (name: string, anchor: string) => `${name}: ${stop(anchor)}`,
    noStrength: 'Stärken erscheinen hier, sobald Ihre Antworten sie stützen.',
    task: (title: string, action: string, owner: string, timing: string) => `${title}: ${stop(action)} Vorgeschlagene Verantwortung: ${owner}; Zeitpunkt: ${timing}.`,
    moreTasks: (n: number) => `${n} weitere ${n === 1 ? 'Maßnahme steht' : 'Maßnahmen stehen'} im Maßnahmenplan oben.`,
    noTasks: 'Es gibt keine offenen Maßnahmen. Halten Sie die Nachweise aktuell, wenn die Transaktion näher rückt.',
    scope: { company: 'Auf Unternehmensebene', seller: 'Auf Verkäuferebene', cross_border: 'Grenzüberschreitend' } as Record<TaxRow['scope'], string>,
    taxCounts: (scope: string, parts: string[]) => `${scope}: ${parts.join(', ')}.`,
    taxPart: { Prepared: 'vorbereitet', 'In progress': 'in Arbeit', 'Not started': 'nicht begonnen', 'Needs review': 'zu prüfen', 'Not yet assessed': 'noch nicht bewertet' } as Record<TaxRow['status'], string>,
    count: (n: number, label: string) => `${n} ${n === 1 ? 'Punkt' : 'Punkte'} ${label}`,
    taxNext: 'Vereinbaren Sie mit einem Steuerberater einen transaktionsbezogenen Umfang und schließen Sie zuerst die offenen Punkte, beginnend mit den Fragen zu Verkäufern und Struktur.',
    taxNone: 'Die steuerliche Vorbereitung ist noch nicht bewertet.',
  },
};

const MAX_TASKS = 4;
const TAX_ORDER: TaxRow['status'][] = ['Prepared', 'In progress', 'Not started', 'Needs review', 'Not yet assessed'];

/** Pure: the same result and language always give the same text. */
export function templateNarrative(r: ResultSnapshot & { score: ScoreResult }, lang: Lang): Narrative {
  const t = T[lang];

  const summary: Paragraph[] = r.dimensions.map((d) => {
    const name = dimensionName(lang, d.key);
    if (d.displayIndex != null) {
      const tail = d.status === 'complete' ? t.dimComplete : t.dimRange(Math.round(d.lower), Math.round(d.upper));
      return { kind: 'reported', text: t.dimShown(name, d.displayIndex, pct(d.coverage), pct(d.evidenceSupport)) + tail, question_ids: [] };
    }
    return { kind: 'reported', text: t.dimHidden(name, pct(d.coverage), d.openCount), question_ids: [] };
  });
  const critical = r.risks.filter((k) => k.severity === 'critical');
  const review = r.risks.filter((k) => k.severity === 'review');
  if (critical.length) summary.push({ kind: 'implication', text: t.critical(critical.length), question_ids: [...new Set(critical.flatMap((k) => k.questionIds))] });
  else summary.push({ kind: 'implication', text: t.calm, question_ids: [] });
  if (review.length) summary.push({ kind: 'implication', text: t.review(review.length), question_ids: [] });
  if (r.dimensions.every((d) => d.evidenceSupport < 0.5) && r.dimensions.some((d) => d.coverage > 0)) {
    summary.push({ kind: 'next_step', text: t.evidenceLow, question_ids: [] });
  }

  const strengths: Paragraph[] = r.strengths.length
    ? r.strengths.map((x) => ({ kind: 'reported' as const, text: t.strength(x.name, x.text), question_ids: [x.id] }))
    : [{ kind: 'implication', text: t.noStrength, question_ids: [] }];

  const priorities: Paragraph[] = r.tasks.slice(0, MAX_TASKS).map((x) => ({
    kind: 'next_step' as const,
    text: t.task(x.title, x.action, x.accountableRole, x.suggestedTiming),
    question_ids: x.sourceQuestionIds,
  }));
  if (!priorities.length) priorities.push({ kind: 'next_step', text: t.noTasks, question_ids: [] });
  else if (r.tasks.length > MAX_TASKS) priorities.push({ kind: 'implication', text: t.moreTasks(r.tasks.length - MAX_TASKS), question_ids: [] });

  const tax: Paragraph[] = [];
  for (const scope of ['company', 'seller', 'cross_border'] as const) {
    const rows = r.tax.filter((x) => x.scope === scope);
    if (!rows.length) continue;
    const parts = TAX_ORDER.map((st) => [st, rows.filter((x) => x.status === st).length] as const)
      .filter(([, n]) => n > 0)
      .map(([st, n]) => t.count(n, t.taxPart[st]));
    tax.push({ kind: 'reported', text: t.taxCounts(t.scope[scope], parts), question_ids: rows.map((x) => x.id) });
  }
  if (!tax.length) tax.push({ kind: 'reported', text: t.taxNone, question_ids: [] });
  else if (r.tax.some((x) => x.status !== 'Prepared')) {
    tax.push({ kind: 'next_step', text: t.taxNext, question_ids: r.tax.filter((x) => x.status !== 'Prepared').map((x) => x.id) });
  }

  return { summary, strengths, priorities, tax };
}
