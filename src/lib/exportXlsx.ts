// Branded Excel export of the action plan (replaces the plain CSV, which
// cannot carry a logo or formatting). exceljs is loaded only when the user
// exports, so it does not weigh on the page itself.

import type { Lang } from './i18n';
import type { ResultSnapshot, Task, TaxRow } from '../model/plan';
import type { ScoreResult } from '../model/scoring';
import { dimensionName } from '../i18n/localize';

type Result = ResultSnapshot & { score: ScoreResult };
export type TaskStatusKey = 'open' | 'in_progress' | 'done';

const NAVY = 'FF002336';
const NAVY_2 = 'FF003E5F';
const TEAL_DARK = 'FF007775';
const GREY_1 = 'FFF2F3F4';
const GREY_2 = 'FFCBD2D6';
const GREY_4 = 'FF324E5E';
const RED_PALE = 'FFFDE4E0';
const LIME_PALE = 'FFF6FFD6';
const WHITE = 'FFFFFFFF';

const TEXT = {
  en: {
    title: 'ExitIQ action plan',
    overview: 'Overview',
    tasks: 'Action plan',
    created: (d: string) => `Created ${d}`,
    context: 'Transaction context',
    dims: 'Readiness dimensions',
    dimHead: ['Dimension', 'Status', 'Index', 'Answer coverage', 'Evidence support', 'Open questions'],
    notShown: 'Not shown',
    risks: 'Risk status',
    riskHead: ['Severity', 'Topic', 'Details', 'Questions'],
    critical: 'Critical',
    review: 'Needs review',
    noRisks: 'No critical prerequisites or open review items based on the answers.',
    tax: 'Tax preparation',
    taxHead: ['Area', 'Item', 'Status'],
    taxScope: { company: 'Company level', seller: 'Seller level', cross_border: 'Cross-border' } as Record<TaxRow['scope'], string>,
    priority: { 1: 'Critical prerequisite', 2: 'Open fact', 3: 'Preparation gap' } as Record<1 | 2 | 3, string>,
    statusList: ['Open', 'In progress', 'Done'],
    note: 'ExitIQ is a structured self-assessment by atares. It does not replace legal, tax or financial advice, and its results are not a valuation. Timings are planning suggestions, not legal deadlines.',
    file: 'exitiq-action-plan',
  },
  de: {
    title: 'ExitIQ Maßnahmenplan',
    overview: 'Überblick',
    tasks: 'Maßnahmenplan',
    created: (d: string) => `Erstellt am ${d}`,
    context: 'Transaktionskontext',
    dims: 'Readiness-Dimensionen',
    dimHead: ['Dimension', 'Status', 'Index', 'Antwortabdeckung', 'Nachweisstützung', 'Offene Fragen'],
    notShown: 'Nicht angezeigt',
    risks: 'Risikostatus',
    riskHead: ['Einstufung', 'Thema', 'Details', 'Fragen'],
    critical: 'Kritisch',
    review: 'Prüfung nötig',
    noRisks: 'Aus den Antworten ergeben sich keine kritischen Voraussetzungen oder offenen Prüfpunkte.',
    tax: 'Steuerliche Vorbereitung',
    taxHead: ['Ebene', 'Punkt', 'Status'],
    taxScope: { company: 'Unternehmensebene', seller: 'Verkäuferebene', cross_border: 'Grenzüberschreitend' } as Record<TaxRow['scope'], string>,
    priority: { 1: 'Kritische Voraussetzung', 2: 'Offener Fakt', 3: 'Vorbereitungslücke' } as Record<1 | 2 | 3, string>,
    statusList: ['Offen', 'In Arbeit', 'Erledigt'],
    note: 'ExitIQ ist eine strukturierte Selbsteinschätzung von atares. Sie ersetzt keine rechtliche, steuerliche oder finanzielle Beratung, und die Ergebnisse sind keine Unternehmensbewertung. Zeitangaben sind Planungsvorschläge, keine rechtlichen Fristen.',
    file: 'exitiq-massnahmenplan',
  },
};

async function logoDataUrl(): Promise<string | null> {
  try {
    const blob = await (await fetch('/media/atares-logo-navy.png')).blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface ExportInput {
  result: Result;
  lang: Lang;
  context: string[];
  taxStatusLabel: Record<TaxRow['status'], string>;
  dimStatusLabel: Record<string, string>;
  taskStatus: Record<string, TaskStatusKey>;
}

export async function exportActionPlanXlsx({ result: r, lang, context, taxStatusLabel, dimStatusLabel, taskStatus }: ExportInput) {
  const t = TEXT[lang];
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ExitIQ by atares';
  wb.created = new Date();
  const logo = await logoDataUrl();
  const logoId = logo ? wb.addImage({ base64: logo, extension: 'png' }) : null;
  const date = new Date().toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  type Ws = ReturnType<typeof wb.addWorksheet>;
  const thin = { style: 'thin' as const, color: { argb: GREY_2 } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };

  /** Logo, title and date in rows 1-4. Returns the next free row. */
  const masthead = (ws: Ws, cols: number): number => {
    ws.getRow(1).height = 30;
    ws.getRow(2).height = 30;
    if (logoId != null) ws.addImage(logoId, { tl: { col: 0.15, row: 0.3 }, ext: { width: 179, height: 50 } });
    const title = ws.getCell(1, 3);
    title.value = t.title;
    title.font = { name: 'Calibri', size: 18, bold: true, color: { argb: NAVY } };
    title.alignment = { vertical: 'bottom' };
    const sub = ws.getCell(2, 3);
    sub.value = t.created(date);
    sub.font = { name: 'Calibri', size: 11, color: { argb: GREY_4 } };
    sub.alignment = { vertical: 'top' };
    // Accent line under the masthead.
    for (let c = 1; c <= cols; c++) ws.getCell(3, c).border = { bottom: { style: 'medium', color: { argb: TEAL_DARK } } };
    ws.getRow(3).height = 6;
    return 5;
  };

  const sectionTitle = (ws: Ws, row: number, text: string) => {
    const c = ws.getCell(row, 1);
    c.value = text;
    c.font = { name: 'Calibri', size: 13, bold: true, color: { argb: NAVY } };
    ws.getRow(row).height = 22;
  };

  const headerRow = (ws: Ws, row: number, labels: string[]) => {
    labels.forEach((l, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = l;
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_2 } };
      c.alignment = { vertical: 'middle', wrapText: true };
      c.border = border;
    });
    ws.getRow(row).height = 22;
  };

  const bodyCell = (ws: Ws, row: number, col: number, value: string | number | null, opts: { fill?: string; bold?: boolean; pct?: boolean } = {}) => {
    const c = ws.getCell(row, col);
    c.value = value;
    c.font = { name: 'Calibri', size: 11, bold: !!opts.bold, color: { argb: NAVY } };
    c.alignment = { vertical: 'top', wrapText: true };
    c.border = border;
    if (opts.pct) c.numFmt = '0%';
    if (opts.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
  };

  // ── Sheet 1: overview ──────────────────────────────────────────────────────
  const ov = wb.addWorksheet(t.overview, { views: [{ showGridLines: false }], pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } } });
  ov.columns = [{ width: 30 }, { width: 22 }, { width: 46 }, { width: 18 }, { width: 18 }, { width: 14 }];
  let row = masthead(ov, 6);

  sectionTitle(ov, row++, t.context);
  ov.mergeCells(row, 1, row, 6);
  bodyCell(ov, row, 1, context.join('  |  '));
  ov.getCell(row, 1).border = {};
  row += 2;

  sectionTitle(ov, row++, t.dims);
  headerRow(ov, row, t.dimHead);
  for (let c = 3; c <= 6; c++) ov.getCell(row, c).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row++;
  r.dimensions.forEach((d, i) => {
    const fill = i % 2 ? GREY_1 : undefined;
    bodyCell(ov, row, 1, dimensionName(lang, d.key), { bold: true, fill });
    bodyCell(ov, row, 2, dimStatusLabel[d.status] ?? d.status, { fill });
    bodyCell(ov, row, 3, d.displayIndex ?? t.notShown, { fill });
    bodyCell(ov, row, 4, d.coverage, { pct: true, fill });
    bodyCell(ov, row, 5, d.evidenceSupport, { pct: true, fill });
    bodyCell(ov, row, 6, d.openCount, { fill });
    for (let c = 3; c <= 6; c++) ov.getCell(row, c).alignment = { vertical: 'top', horizontal: 'center' };
    row++;
  });
  row++;

  sectionTitle(ov, row++, t.risks);
  if (!r.risks.length) {
    ov.mergeCells(row, 1, row, 6);
    bodyCell(ov, row++, 1, t.noRisks);
  } else {
    headerRow(ov, row, t.riskHead);
    ov.mergeCells(row, 3, row, 5);
    row++;
    for (const k of r.risks) {
      const fill = k.severity === 'critical' ? RED_PALE : undefined;
      bodyCell(ov, row, 1, k.severity === 'critical' ? t.critical : t.review, { bold: true, fill });
      bodyCell(ov, row, 2, k.title, { fill });
      ov.mergeCells(row, 3, row, 5);
      bodyCell(ov, row, 3, k.text, { fill });
      bodyCell(ov, row, 6, k.questionIds.join(', '), { fill });
      ov.getRow(row).height = Math.max(30, Math.ceil(k.text.length / 70) * 15);
      row++;
    }
  }
  row++;

  sectionTitle(ov, row++, t.tax);
  headerRow(ov, row++, t.taxHead);
  for (const x of r.tax) {
    const fill = x.status === 'Prepared' ? LIME_PALE : undefined;
    bodyCell(ov, row, 1, t.taxScope[x.scope], { fill });
    bodyCell(ov, row, 2, x.name, { fill });
    bodyCell(ov, row, 3, taxStatusLabel[x.status], { bold: true, fill });
    row++;
  }
  row++;
  ov.mergeCells(row, 1, row, 6);
  const n1 = ov.getCell(row, 1);
  n1.value = t.note;
  n1.font = { name: 'Calibri', size: 9, italic: true, color: { argb: GREY_4 } };
  n1.alignment = { wrapText: true, vertical: 'top' };
  ov.getRow(row).height = 42;

  // ── Sheet 2: tasks ─────────────────────────────────────────────────────────
  const ws = wb.addWorksheet(t.tasks, { views: [{ state: 'frozen', ySplit: 5, showGridLines: false }], pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '5:5', margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } } });
  const head = [lang === 'de' ? 'Nr.' : 'No.', ...(lang === 'de'
    ? ['Priorität', 'Titel', 'Begründung', 'Maßnahme', 'Vorgeschlagene Verantwortung', 'Zeitpunkt', 'Hängt ab von', 'Erforderlicher Nachweis', 'Dimension', 'Bereich', 'Fragen', 'Status']
    : ['Priority', 'Title', 'Reason', 'Action', 'Suggested owner', 'Timing', 'Depends on', 'Evidence required', 'Dimension', 'Area', 'Questions', 'Status'])];
  ws.columns = [6, 22, 30, 44, 44, 24, 18, 14, 36, 22, 26, 12, 14].map((width) => ({ width }));
  masthead(ws, head.length);
  headerRow(ws, 5, head);
  const statusLabels = t.statusList;
  const statusIndex: Record<TaskStatusKey, number> = { open: 0, in_progress: 1, done: 2 };
  r.tasks.forEach((x: Task, i) => {
    const rr = 6 + i;
    const fill = x.priorityClass === 1 ? RED_PALE : i % 2 ? GREY_1 : undefined;
    const vals: (string | number)[] = [
      i + 1, t.priority[x.priorityClass as 1 | 2 | 3], x.title, x.reason, x.action, x.accountableRole, x.suggestedTiming,
      x.dependencies.join(', '), x.evidenceRequired ?? '', x.dimension ?? '', x.domain ?? '', x.sourceQuestionIds.join(', '),
      statusLabels[statusIndex[taskStatus[x.key] ?? 'open']],
    ];
    vals.forEach((v, c) => bodyCell(ws, rr, c + 1, v, { fill, bold: c === 2 }));
    ws.getCell(rr, 13).dataValidation = { type: 'list', allowBlank: false, formulae: [`"${statusLabels.join(',')}"`] };
    const longest = Math.max(x.reason.length / 40, x.action.length / 40, (x.evidenceRequired ?? '').length / 33);
    ws.getRow(rr).height = Math.max(30, Math.ceil(longest) * 15);
  });
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + r.tasks.length, column: head.length } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${t.file}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
