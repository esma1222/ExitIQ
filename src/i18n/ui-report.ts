// Interface strings for the report structure (next steps, work packages,
// questions to clarify, buyer view, strengths, tax workstream). English and
// German; German uses formal "Sie". Category, package and workstream names
// come from model/text.ts (REPORT_TEXT) so the page, the written summary and
// the Excel export use the same words.

import { useLang, type Lang } from '../lib/i18n';
import type { NextStep } from '../model/packages';

const en = {
  navNext: 'Next steps',
  navReadiness: 'Readiness',
  navActions: 'Action plan',
  navBuyer: 'Buyer view',
  navRisks: 'Risks and strengths',
  navTax: 'Tax',
  navSummary: 'Summary',

  reviewSetup: 'Review setup',

  glanceCritical: 'Critical prerequisites',
  glancePackages: 'Work packages',
  glanceClarify: 'Questions to clarify',
  glanceReview: 'Items to review',

  nextTitle: 'Recommended next steps',
  nextSub: 'At most three, in this order: critical prerequisites, the work packages with the highest impact, then open questions.',
  nextNone: 'No preparation gaps identified from your answers. Next, validate the highest-impact claims and refresh the evidence before launch.',
  stepKind: { critical: 'Critical prerequisite', package: 'Work package', review: 'Review', clarify: 'Open questions' } satisfies Record<NextStep['kind'], string>,
  owner: (r: string) => `Suggested owner: ${r}`,
  seePackage: 'See work package',
  answerNow: 'Answer now',
  openQuestion: 'Open question',
  clarifySetup: 'Clarify setup',

  planTitle: 'Action plan',
  planSub: 'One structure throughout: critical prerequisites, preparation work grouped into work packages, and questions to clarify. Set a status as you work; it is saved with your assessment.',
  filterAria: 'Filter the action plan',
  filterAll: 'All',
  criticalSub: 'Confirmed from your answers. These come before other preparation work, whatever the scores show.',
  criticalNone: 'No critical prerequisites follow from your answers. This does not replace specialist review.',
  prepSub: 'Known gaps from your answers, grouped into deliverables and ordered by impact. A work package never comes before one it depends on.',
  prepNone: 'No preparation gaps identified from your answers. Next, validate the highest-impact claims and refresh the evidence before launch.',
  clarifySub: 'Questions not yet assessed or answered with an unresolved status. They are open, not gaps: answering them completes the picture.',
  clarifyNone: 'No open questions. Every applicable question has an answer.',
  reviewsTitle: 'Reviews and open facts',
  whyItMatters: 'Why it matters',
  outputRequired: 'Output required',
  ownerLabel: 'Suggested owner',
  timingLabel: 'Timing',
  dependsOn: 'Depends on',
  linkedControls: 'Linked questions',
  impact: (rank: number) => `Impact rank ${rank}`,
  statusOf: (name: string) => `Status of ${name}`,
  showAllPackages: (n: number) => `Show all ${n} work packages`,
  showFewer: 'Show fewer',
  timingNote: 'Timings are planning suggestions, not legal deadlines. Within each group a task never comes before a task it depends on; “Waiting for” marks a dependency that is still open.',
  questionsN: (n: number) => `${n} ${n === 1 ? 'question' : 'questions'}`,

  buyerTitle: 'What a buyer will investigate',
  buyerSub: 'Self-reported in discovery and not scored. These are commercial facts a buyer will look at, each next to your related answer. No valuation, discount or risk verdict is derived from them.',
  buyerSelf: 'Self-reported',
  buyerNotStated: 'Not stated',

  statedTitle: 'Your stated business strengths',
  statedSub: 'What you would lead with, from discovery. Not scored; a buyer will test each claim.',
  statedNone: 'You did not name strengths in discovery.',
  prepStrTitle: 'Preparation strengths from your answers',
  prepStrSubReported: 'Questions you answered at the fully prepared level. Reported by you; no dated evidence is recorded yet.',
  prepStrSubSupported: 'Questions you answered at the fully prepared level. Where a dated reference with a named owner exists, it is marked.',
  prepStrNone: 'None yet: no question is answered at the fully prepared level.',
  reportedTag: 'Reported',
  supportedTag: 'Dated reference',
  youReported: 'You reported:',

  taxTitle: 'Tax workstream',
  taxSub: 'One workstream with company, seller and cross-border responsibilities. Structure alternatives (Q27) and historical restrictions (Q28) affect both the company and the sellers. This measures preparation and specialist review; it is not tax advice and gives no tax efficiency score.',
  taxSpecialist: (status: string) => `Specialist review (Q25, transaction tax adviser): ${status}`,
  taxNotApplicable: 'not part of this assessment',
};

export type ReportUIText = typeof en;

const de: ReportUIText = {
  navNext: 'Nächste Schritte',
  navReadiness: 'Readiness',
  navActions: 'Maßnahmenplan',
  navBuyer: 'Käufersicht',
  navRisks: 'Risiken und Stärken',
  navTax: 'Steuern',
  navSummary: 'Zusammenfassung',

  reviewSetup: 'Einstellungen prüfen',

  glanceCritical: 'Kritische Voraussetzungen',
  glancePackages: 'Arbeitspakete',
  glanceClarify: 'Offene Fragen zur Klärung',
  glanceReview: 'Zu prüfende Punkte',

  nextTitle: 'Empfohlene nächste Schritte',
  nextSub: 'Höchstens drei, in dieser Reihenfolge: kritische Voraussetzungen, die Arbeitspakete mit der größten Wirkung, dann offene Fragen.',
  nextNone: 'Aus Ihren Antworten ergeben sich keine Vorbereitungslücken. Prüfen Sie als Nächstes die wichtigsten Aussagen und aktualisieren Sie die Nachweise vor dem Start.',
  stepKind: { critical: 'Kritische Voraussetzung', package: 'Arbeitspaket', review: 'Prüfung', clarify: 'Offene Fragen' },
  owner: (r) => `Vorgeschlagene Verantwortung: ${r}`,
  seePackage: 'Zum Arbeitspaket',
  answerNow: 'Jetzt beantworten',
  openQuestion: 'Frage öffnen',
  clarifySetup: 'Einstellungen klären',

  planTitle: 'Maßnahmenplan',
  planSub: 'Durchgängig dieselbe Gliederung: kritische Voraussetzungen, Vorbereitungsarbeit in Arbeitspaketen und offene Fragen zur Klärung. Setzen Sie einen Status, während Sie die Punkte abarbeiten; er wird mit Ihrer Selbsteinschätzung gespeichert.',
  filterAria: 'Maßnahmenplan filtern',
  filterAll: 'Alle',
  criticalSub: 'Aus Ihren Antworten bestätigt. Sie gehen jeder anderen Vorbereitung vor, unabhängig von den Werten.',
  criticalNone: 'Aus Ihren Antworten ergeben sich keine kritischen Voraussetzungen. Das ersetzt keine Prüfung durch Spezialisten.',
  prepSub: 'Bekannte Lücken aus Ihren Antworten, zu Ergebnissen gebündelt und nach Wirkung geordnet. Ein Arbeitspaket steht nie vor einem Paket, von dem es abhängt.',
  prepNone: 'Aus Ihren Antworten ergeben sich keine Vorbereitungslücken. Prüfen Sie als Nächstes die wichtigsten Aussagen und aktualisieren Sie die Nachweise vor dem Start.',
  clarifySub: 'Fragen, die noch nicht bewertet oder mit einem ungeklärten Status beantwortet sind. Sie sind offen, keine Lücken: Ihre Beantwortung vervollständigt das Bild.',
  clarifyNone: 'Keine offenen Fragen. Jede zutreffende Frage ist beantwortet.',
  reviewsTitle: 'Prüfungen und offene Fakten',
  whyItMatters: 'Warum es wichtig ist',
  outputRequired: 'Erforderliches Ergebnis',
  ownerLabel: 'Vorgeschlagene Verantwortung',
  timingLabel: 'Zeitpunkt',
  dependsOn: 'Hängt ab von',
  linkedControls: 'Zugehörige Fragen',
  impact: (rank) => `Wirkung Rang ${rank}`,
  statusOf: (name) => `Status von ${name}`,
  showAllPackages: (n) => `Alle ${n} Arbeitspakete anzeigen`,
  showFewer: 'Weniger anzeigen',
  timingNote: 'Zeitangaben sind Planungsvorschläge, keine rechtlichen Fristen. Innerhalb jeder Gruppe steht eine Aufgabe nie vor einer Aufgabe, von der sie abhängt; „Wartet auf“ kennzeichnet eine noch offene Abhängigkeit.',
  questionsN: (n) => `${n} ${n === 1 ? 'Frage' : 'Fragen'}`,

  buyerTitle: 'Was ein Käufer prüfen wird',
  buyerSub: 'Ihre Angaben aus dem Einstieg, nicht bewertet. Es sind kommerzielle Fakten, die ein Käufer prüfen wird, jeweils neben Ihrer zugehörigen Antwort. Daraus wird keine Bewertung, kein Abschlag und kein Risikourteil abgeleitet.',
  buyerSelf: 'Selbstauskunft',
  buyerNotStated: 'Keine Angabe',

  statedTitle: 'Ihre genannten Stärken des Unternehmens',
  statedSub: 'Womit Sie beginnen würden, aus dem Einstieg. Nicht bewertet; ein Käufer wird jede Aussage prüfen.',
  statedNone: 'Sie haben im Einstieg keine Stärken genannt.',
  prepStrTitle: 'Stärken in der Vorbereitung laut Ihren Antworten',
  prepStrSubReported: 'Fragen, die Sie auf der Stufe „vollständig vorbereitet“ beantwortet haben. Von Ihnen angegeben; datierte Nachweise sind noch nicht erfasst.',
  prepStrSubSupported: 'Fragen, die Sie auf der Stufe „vollständig vorbereitet“ beantwortet haben. Wo ein datierter Nachweis mit benannter Verantwortung vorliegt, ist das markiert.',
  prepStrNone: 'Noch keine: Keine Frage ist auf der Stufe „vollständig vorbereitet“ beantwortet.',
  reportedTag: 'Angegeben',
  supportedTag: 'Datierter Nachweis',
  youReported: 'Sie haben angegeben:',

  taxTitle: 'Steuerlicher Arbeitsstrang',
  taxSub: 'Ein Arbeitsstrang mit Zuständigkeiten auf Ebene der Gesellschaft, der Verkäufer und grenzüberschreitend. Strukturalternativen (Q27) und frühere Beschränkungen (Q28) betreffen sowohl die Gesellschaft als auch die Verkäufer. Gemessen werden Vorbereitung und Prüfung durch Spezialisten; das ist keine Steuerberatung und keine Bewertung der steuerlichen Effizienz.',
  taxSpecialist: (status) => `Prüfung durch Spezialisten (Q25, transaktionserfahrener Steuerberater): ${status}`,
  taxNotApplicable: 'nicht Teil dieser Selbsteinschätzung',
};

export const UI_REPORT: Record<Lang, ReportUIText> = { en, de };

export function useReportT(): ReportUIText {
  return UI_REPORT[useLang()];
}
