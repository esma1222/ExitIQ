// Interface strings for the setup and specialist steps added with catalogue
// v1.2 (English and German, formal "Sie"): business economics, sector, the two
// new specialist topics, the optional confirmed facts and the scope preview
// shown before answered questions leave the assessment.

import { useLang, type Lang } from '../lib/i18n';
import type { TaxTriggerKey } from '../model/types';

export interface SetupText {
  econLabel: string;
  econWhy: string;
  econAria: string;
  sector: string;
  sectorPlaceholder: string;
  /** Explanation under each v1.2 specialist topic (the original eight live in ui-journey trigWhy). */
  trigWhy: Record<TaxTriggerKey, string>;
  confirmedLabel: string;
  confirmedWhy: string;
  taxConfirmed: string;
  taxConfirmedWhy: string;
  fundingGap: string;
  fundingGapWhy: string;
  scopeTitle: string;
  scopeText: (n: number, list: string) => string;
  scopeKept: string;
  scopeAdded: (n: number) => string;
  apply: string;
  cancel: string;
}

const en: SetupText = {
  econLabel: 'Is the business currently run for profit, or deliberately investing in growth at a loss?',
  econWhy: 'Not scored. It only chooses the wording of the question on business economics, so that deliberate growth investment is not treated as a weakness.',
  econAria: 'Business economics',
  sector: 'Sector',
  sectorPlaceholder: 'For example specialty chemicals',
  trigWhy: {
    restructuring: 'A tax adviser checks whether earlier steps restrict the timing or structure of a sale. This is a review, not a finding that tax is due.',
    cross_border_ops: 'Adds coordination of the tax work across the countries involved.',
  },
  confirmedLabel: 'Confirmed facts (optional)',
  confirmedWhy: 'Answer only what has been confirmed. "Yes" makes the point a critical prerequisite in your plan; "Not sure" adds it for review.',
  taxConfirmed: 'Has a tax adviser confirmed a restriction or deadline that affects the planned timetable?',
  taxConfirmedWhy: 'Only a confirmation from a tax adviser counts. Past reorganizations alone are a review topic.',
  fundingGap: 'Is there a confirmed funding gap before the planned transaction without an agreed bridge?',
  fundingGapWhy: 'A gap that has been confirmed, not a possible one. Possible pressure belongs in the liquidity question.',
  scopeTitle: 'Check the change first',
  scopeText: (n, list) => `This change takes ${n} answered ${n === 1 ? 'question' : 'questions'} out of scope: ${list}.`,
  scopeKept: 'They are kept and return if you change it back.',
  scopeAdded: (n) => `${n} ${n === 1 ? 'question is' : 'questions are'} added.`,
  apply: 'Apply',
  cancel: 'Cancel',
};

const de: SetupText = {
  econLabel: 'Wird das Unternehmen derzeit gewinnorientiert geführt, oder investiert es bewusst in Wachstum und nimmt dabei Verluste in Kauf?',
  econWhy: 'Wird nicht bewertet. Die Angabe bestimmt nur die Formulierung der Frage zur Wirtschaftlichkeit, damit bewusste Wachstumsinvestitionen nicht als Schwäche gelten.',
  econAria: 'Wirtschaftlichkeit',
  sector: 'Branche',
  sectorPlaceholder: 'Zum Beispiel Spezialchemie',
  trigWhy: {
    restructuring: 'Ein Steuerberater prüft, ob frühere Schritte Zeitpunkt oder Struktur eines Verkaufs beschränken. Das ist eine Prüfung, keine Feststellung, dass Steuern anfallen.',
    cross_border_ops: 'Ergänzt die Koordination der steuerlichen Arbeit über die beteiligten Länder hinweg.',
  },
  confirmedLabel: 'Bestätigte Fakten (optional)',
  confirmedWhy: 'Beantworten Sie nur, was bestätigt ist. „Ja“ macht den Punkt zu einer kritischen Voraussetzung in Ihrem Plan, „Nicht sicher“ nimmt ihn zur Prüfung auf.',
  taxConfirmed: 'Hat ein Steuerberater eine Beschränkung oder Frist bestätigt, die den geplanten Zeitplan betrifft?',
  taxConfirmedWhy: 'Es zählt nur die Bestätigung durch einen Steuerberater. Frühere Umstrukturierungen allein sind ein Prüfthema.',
  fundingGap: 'Gibt es eine bestätigte Finanzierungslücke vor der geplanten Transaktion ohne vereinbarte Überbrückung?',
  fundingGapWhy: 'Gemeint ist eine bestätigte, nicht eine mögliche Lücke. Möglicher Druck gehört zur Frage nach der Liquidität.',
  scopeTitle: 'Bitte prüfen Sie die Änderung',
  scopeText: (n, list) => `Durch diese Änderung ${n === 1 ? 'entfällt 1 beantwortete Frage' : `entfallen ${n} beantwortete Fragen`} aus dem Umfang: ${list}.`,
  scopeKept: 'Die Antworten bleiben gespeichert und gelten wieder, wenn Sie die Änderung zurücknehmen.',
  scopeAdded: (n) => `${n === 1 ? '1 Frage kommt' : `${n} Fragen kommen`} hinzu.`,
  apply: 'Übernehmen',
  cancel: 'Abbrechen',
};

export const SETUP_UI: Record<Lang, SetupText> = { en, de };

export function useST(): SetupText {
  return SETUP_UI[useLang()];
}
