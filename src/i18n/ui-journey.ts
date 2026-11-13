// Interface strings for the reordered questionnaire journey, the saving notice
// and the detailed-assessment navigation (English and German, formal "Sie").
// Existing strings stay in ui.ts; this file only adds new ones.

import { useLang, type Lang } from '../lib/i18n';
import type { TriggerKey } from '../model/types';

const en = {
  // Saving and online backup
  savedBrowserAt: (time: string) => `Saved on this browser · ${time}`,
  backupOffNotice: 'Online backup is not working right now. Your answers are saved on this browser only.',
  tryAgain: 'Try again',
  trying: 'Trying again…',
  stillOff: 'Still not working. Nothing is lost: your answers stay saved on this browser.',
  backupBack: 'Online backup is working again. Everything you entered is backed up.',
  techDetails: 'Technical details',
  dismissNote: 'Close',

  // Context
  ctxKicker: 'Context',
  ctxTitle: 'First, a little about the business.',
  ctxSub: 'Four short questions. They are not scored; they decide which questions follow and how they are worded.',
  toDiscovery: 'Continue to discovery',
  toSummary: 'Back to the setup summary',
  privacyTitle: 'How your answers are stored',
  privacyShort: 'Your answers are saved in this browser and, when online backup works, in the ExitIQ database run by atares, linked to an anonymous session. Nothing goes to an AI service unless you ask for a written summary, and you can delete everything at any time.',
  privacyMore: 'Full details',
  privacyNotice: 'Privacy notice',

  // Acute liquidity
  acuteTitle: 'A specialist route comes first',
  acuteNext: 'You can continue here to prepare. The action plan then shows preparation steps without a standard readiness conclusion.',
  acuteContact: 'Discuss the specialist route with atares',

  // Discovery
  discoveryKicker: 'Discovery',
  scoredMeta: 'Scored question · reused in the detailed assessment, so you will not be asked again.',

  // Initial picture
  toSetup: 'Set up the detailed assessment',
  workload: (setup: number, questions: number) =>
    setup > 0
      ? `Next: ${setup} short setup question${setup === 1 ? '' : 's'} on two pages, then up to ${questions} detailed question${questions === 1 ? '' : 's'}. The setup often removes topics that do not apply to you. You can pause at any time; each question names who is best placed to answer it.`
      : `Your setup is complete. Up to ${questions} detailed question${questions === 1 ? '' : 's'} remain. You can pause at any time; each question names who is best placed to answer it.`,

  // Setup
  setupKicker: (i: number) => `Assessment setup · ${i} of 2`,
  setupTitle: 'Set up the detailed assessment.',
  setupSub: 'A few questions about you and the transaction. They decide which detailed questions apply and how the areas are weighted. Not scored.',
  specialistSub: 'Each topic adds a short set of questions only if it applies, and each line says why it matters. “Not sure” keeps those questions open until clarified, so nothing is hidden by accident.',
  trigWhy: {
    debt: 'Lenders’ consent, change-of-control clauses and the release of security often set the timetable.',
    acquisitions: 'Every buyer checks open integration work and earn-outs from past deals.',
    employee_equity: 'Options and participation plans must be settled or rolled over at closing; unclear terms delay signing.',
    preferences: 'Liquidation preferences and veto rights change who receives what and who must agree.',
    convertibles: 'Converting instruments change the ownership table and how proceeds are split at exit.',
    regulated: 'Licences do not always transfer automatically, and approvals can take months.',
    contingent: 'Deferred payments and earn-outs need clear definitions and a tax review before signing.',
    group_dependency: 'Shared services, contracts and IT that stay with the group must be replaced or covered by transitional agreements.',
  } as Record<TriggerKey, string>,
  sellerWhy: 'Individuals, holding companies and funds are taxed differently on a sale, so the tax questions depend on it.',
  taxResWhy: 'Sellers taxed in another country need coordinated cross-border advice. We never infer this from the company’s address.',
  toSummaryBtn: 'See setup summary',

  // Summary
  summaryKicker: 'Assessment setup · summary',
  rowContext: 'Context',
  summaryCount: (apply: number, done: number, left: number) =>
    `${apply} questions apply to you. ${done} already have a confirmed answer, including those from discovery; you will be taken through the ${left} that still need one.`,
  startDeep: 'Start the detailed questions',
  continueDeep: 'Continue the detailed questions',

  // Detailed assessment
  progressMain: (answered: number, total: number, open: number) =>
    `${answered} of ${total} answered${open ? ` · ${open} open response${open === 1 ? '' : 's'}` : ''}`,
  progressHelp: 'Answered means a chosen statement or a confirmed “not applicable”. Unknown, needs confirmation and “Not applicable?” requests stay open.',
  reviewSetup: 'Review setup',
  reviewAnswered: 'Review answered questions',
  reviewOffHint: '“Next” skips questions you have already answered.',
  reviewOnHint: '“Next” steps through every question, including answered ones.',
  toldEarlier: 'You told us earlier',
  factLargestCustomer: (v: string) => `Share of revenue with your largest customer: ${v}`,
  factObjectives: (v: string) => `Transaction objectives: ${v}`,
  factLiquidity: (v: string) => `Payment pressure in the next six months: ${v}`,
  factGrowth: (v: string) => `Greatest pressure if demand rose by 30%: ${v}`,
  factCommitted: (v: string) => `Revenue for the next 12 months already contracted: ${v}`,
  openEarlier: (n: number) => `${n} question${n === 1 ? '' : 's'} earlier in the list still ${n === 1 ? 'needs' : 'need'} an answer.`,
  goFirstOpen: 'Go to the first one',
  allHaveResponse: 'Every question now has a response.',

  // Saved
  savedTitle: 'Your progress is saved on this browser.',
  savedLead: (answered: number, open: number, when: string | null) =>
    `${answered} question${answered === 1 ? '' : 's'} answered${open ? `, ${open} open response${open === 1 ? '' : 's'}` : ''}${when ? `, last saved ${when}` : ''}. Come back in the same browser to continue where you left off.`,
  onBrowser: 'On this browser',
  savedYes: 'Saved',
  onlineBackup: 'Online backup',
  backupOn: 'On',
  backupOff: 'Off',
  backupChecking: 'Checking…',
  backupOnBody: 'Your answers are also stored in the ExitIQ database, so you can continue on another device after confirming your email address.',
  backupOffBody: 'Your answers are kept on this browser only. Use the same browser to continue. Continuing on another device needs the online backup.',
  linkFailed: 'The link could not be sent right now. Please try again later; your answers stay saved.',
};

export type JourneyText = typeof en;

const de: JourneyText = {
  savedBrowserAt: (time) => `In diesem Browser gespeichert · ${time}`,
  backupOffNotice: 'Die Online-Sicherung funktioniert gerade nicht. Ihre Antworten sind nur in diesem Browser gespeichert.',
  tryAgain: 'Erneut versuchen',
  trying: 'Neuer Versuch…',
  stillOff: 'Funktioniert weiterhin nicht. Es geht nichts verloren: Ihre Antworten bleiben in diesem Browser gespeichert.',
  backupBack: 'Die Online-Sicherung funktioniert wieder. Alle Ihre Angaben sind gesichert.',
  techDetails: 'Technische Details',
  dismissNote: 'Schließen',

  ctxKicker: 'Kontext',
  ctxTitle: 'Zunächst ein wenig zum Unternehmen.',
  ctxSub: 'Vier kurze Fragen. Sie werden nicht bewertet; sie bestimmen, welche Fragen folgen und wie sie formuliert sind.',
  toDiscovery: 'Weiter zum Einstieg',
  toSummary: 'Zurück zur Übersicht der Einstellungen',
  privacyTitle: 'Wie Ihre Antworten gespeichert werden',
  privacyShort: 'Ihre Antworten werden in diesem Browser und, sofern die Online-Sicherung funktioniert, in der von atares betriebenen ExitIQ-Datenbank gespeichert, verknüpft mit einer anonymen Sitzung. An einen KI-Dienst geht nur etwas, wenn Sie eine schriftliche Zusammenfassung anfordern, und Sie können jederzeit alles löschen.',
  privacyMore: 'Alle Details',
  privacyNotice: 'Datenschutzerklärung',

  acuteTitle: 'Zuerst eine spezialisierte Prüfung',
  acuteNext: 'Sie können hier zur Vorbereitung weitermachen. Der Maßnahmenplan zeigt dann Vorbereitungsschritte ohne eine standardmäßige Aussage zur Transaktionsreife.',
  acuteContact: 'Spezialisierte Prüfung mit atares besprechen',

  discoveryKicker: 'Einstieg',
  scoredMeta: 'Bewertete Frage · wird in der Detailbewertung wiederverwendet, Sie werden also nicht erneut gefragt.',

  toSetup: 'Detailbewertung einrichten',
  workload: (setup, questions) =>
    setup > 0
      ? `Als Nächstes: ${setup} kurze ${setup === 1 ? 'Einstellungsfrage' : 'Einstellungsfragen'} auf zwei Seiten, danach bis zu ${questions} ${questions === 1 ? 'Detailfrage' : 'Detailfragen'}. Die Einstellungen schließen oft Themen aus, die für Sie nicht gelten. Sie können jederzeit pausieren; jede Frage nennt, wer sie am besten beantworten kann.`
      : `Ihre Einstellungen sind vollständig. Es sind noch bis zu ${questions} ${questions === 1 ? 'Detailfrage' : 'Detailfragen'} offen. Sie können jederzeit pausieren; jede Frage nennt, wer sie am besten beantworten kann.`,

  setupKicker: (i) => `Einrichtung der Detailbewertung · ${i} von 2`,
  setupTitle: 'Richten Sie die Detailbewertung ein.',
  setupSub: 'Einige Fragen zu Ihnen und zur Transaktion. Sie bestimmen, welche Detailfragen gelten und wie die Bereiche gewichtet werden. Sie werden nicht bewertet.',
  specialistSub: 'Jedes Thema ergänzt nur dann einige Fragen, wenn es zutrifft, und jede Zeile sagt, warum es wichtig ist. „Nicht sicher“ hält diese Fragen offen, bis sie geklärt sind, damit nichts versehentlich ausgeblendet wird.',
  trigWhy: {
    debt: 'Zustimmungen von Kreditgebern, Change-of-Control-Klauseln und die Freigabe von Sicherheiten bestimmen oft den Zeitplan.',
    acquisitions: 'Offene Integrationsarbeit und Earn-outs aus früheren Zukäufen prüft jeder Käufer.',
    employee_equity: 'Optionen und Beteiligungsprogramme müssen beim Closing abgelöst oder übertragen werden; unklare Bedingungen verzögern die Unterzeichnung.',
    preferences: 'Liquidationspräferenzen und Vetorechte verändern, wer was erhält und wer zustimmen muss.',
    convertibles: 'Wandelinstrumente verändern die Beteiligungsverhältnisse und die Verteilung der Erlöse beim Exit.',
    regulated: 'Genehmigungen gehen nicht immer automatisch über, und Freigaben können Monate dauern.',
    contingent: 'Aufgeschobene Zahlungen und Earn-outs brauchen vor der Unterzeichnung klare Definitionen und eine steuerliche Prüfung.',
    group_dependency: 'Gemeinsame Leistungen, Verträge und IT, die beim Konzern bleiben, müssen ersetzt oder durch Übergangsvereinbarungen abgedeckt werden.',
  },
  sellerWhy: 'Privatpersonen, Holdinggesellschaften und Fonds werden bei einem Verkauf unterschiedlich besteuert; davon hängen die Steuerfragen ab.',
  taxResWhy: 'Verkäufer, die in einem anderen Land steuerpflichtig sind, brauchen eine abgestimmte grenzüberschreitende Beratung. Wir leiten das nie aus der Adresse des Unternehmens ab.',
  toSummaryBtn: 'Zur Übersicht der Einstellungen',

  summaryKicker: 'Einrichtung der Detailbewertung · Übersicht',
  rowContext: 'Kontext',
  summaryCount: (apply, done, left) =>
    `${apply} Fragen gelten für Sie. ${done} haben bereits eine bestätigte Antwort, einschließlich der Fragen aus dem Einstieg; wir führen Sie durch die ${left}, die noch eine Antwort brauchen.`,
  startDeep: 'Detailfragen beginnen',
  continueDeep: 'Detailfragen fortsetzen',

  progressMain: (answered, total, open) =>
    `${answered} von ${total} beantwortet${open ? ` · ${open} offene ${open === 1 ? 'Rückmeldung' : 'Rückmeldungen'}` : ''}`,
  progressHelp: 'Beantwortet heißt: eine gewählte Aussage oder ein bestätigtes „nicht anwendbar“. Unbekannt, zu bestätigende Angaben und Anfragen „Nicht anwendbar?“ bleiben offen.',
  reviewSetup: 'Einstellungen prüfen',
  reviewAnswered: 'Beantwortete Fragen durchgehen',
  reviewOffHint: '„Weiter“ überspringt Fragen, die Sie bereits beantwortet haben.',
  reviewOnHint: '„Weiter“ führt durch alle Fragen, auch die bereits beantworteten.',
  toldEarlier: 'Ihre frühere Angabe',
  factLargestCustomer: (v) => `Umsatzanteil Ihres größten Kunden: ${v}`,
  factObjectives: (v) => `Ziele der Transaktion: ${v}`,
  factLiquidity: (v) => `Zahlungsdruck in den nächsten sechs Monaten: ${v}`,
  factGrowth: (v) => `Größter Engpass bei 30% mehr Nachfrage: ${v}`,
  factCommitted: (v) => `Vertraglich gesicherter Umsatz der nächsten 12 Monate: ${v}`,
  openEarlier: (n) => `${n} ${n === 1 ? 'Frage' : 'Fragen'} weiter vorne in der Liste ${n === 1 ? 'braucht' : 'brauchen'} noch eine Antwort.`,
  goFirstOpen: 'Zur ersten davon',
  allHaveResponse: 'Jede Frage hat jetzt eine Rückmeldung.',

  savedTitle: 'Ihr Fortschritt ist in diesem Browser gespeichert.',
  savedLead: (answered, open, when) =>
    `${answered} ${answered === 1 ? 'Frage' : 'Fragen'} beantwortet${open ? `, ${open} offene ${open === 1 ? 'Rückmeldung' : 'Rückmeldungen'}` : ''}${when ? `, zuletzt gespeichert am ${when}` : ''}. Kehren Sie im selben Browser zurück, um dort weiterzumachen, wo Sie aufgehört haben.`,
  onBrowser: 'In diesem Browser',
  savedYes: 'Gespeichert',
  onlineBackup: 'Online-Sicherung',
  backupOn: 'An',
  backupOff: 'Aus',
  backupChecking: 'Wird geprüft…',
  backupOnBody: 'Ihre Antworten sind zusätzlich in der ExitIQ-Datenbank gespeichert. So können Sie nach Bestätigung Ihrer E-Mail-Adresse auf einem anderen Gerät fortfahren.',
  backupOffBody: 'Ihre Antworten sind nur in diesem Browser gespeichert. Nutzen Sie denselben Browser, um fortzufahren. Für das Fortsetzen auf einem anderen Gerät ist die Online-Sicherung nötig.',
  linkFailed: 'Der Link konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut; Ihre Antworten bleiben gespeichert.',
};

export const JOURNEY_UI: Record<Lang, JourneyText> = { en, de };

/** Journey strings for the current site language. */
export function useJT(): JourneyText {
  return JOURNEY_UI[useLang()];
}
