// Branded Excel export of the action plan (replaces the plain CSV, which
// cannot carry a logo or formatting). exceljs is loaded only when the user
// exports, so it does not weigh on the page itself.

import type { Lang } from './i18n';
import type { BuyerItem, ResultSnapshot, TaxRow } from '../model/plan';
import type { PlanView } from '../model/packages';
import { WORKSTREAM_OF_PACKAGE, controlStateLabel, workstreamOf, type PackageKey } from '../model/packages';
import { hasConflict, type ScoreResult } from '../model/scoring';
import { CHAPTERS, QUESTIONS } from '../model/catalogue';
import { HORIZON_OPTIONS, OBJECTIVE_OPTIONS, PERIMETER_OPTIONS } from '../model/options';
import { questionText } from '../model/routing';
import { REPORT_TEXT } from '../model/text';
import type { AnswerMap, AssessmentContext } from '../model/types';
import { chapterTitle, dimensionName, domainName, localOptions, localQuestion, profileText, routeLabel, statusLabel } from '../i18n/localize';
import { dimensionOf } from '../model/catalogue';

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
    taxHead: ['Level', 'Item', 'Status'],
    tax: 'Tax workstream',
    statusList: ['Open', 'In progress', 'Done'],
    scope: 'Assessment scope',
    scopeRows: ['Perspective', 'Objectives', 'Perimeter', 'Horizon', 'Active modules', 'Pending modules'],
    none: 'None',
    notConfirmed: 'Not confirmed',
    record: 'Record',
    recordRows: ['Data status', 'Catalogue version', 'Scoring version', 'Report version', 'Generated'],
    dataComplete: 'Complete self-assessment',
    dataIncomplete: 'Incomplete self-assessment',
    steps: 'Recommended next steps',
    stepHead: ['No.', 'Step', 'Details', 'Suggested owner', 'Questions'],
    stepsNone: 'No preparation gaps identified from your answers. Next, validate the highest-impact claims and refresh the evidence before launch.',
    buyer: 'What a buyer will investigate (self-reported in discovery, not scored)',
    buyerHead: ['Topic', 'You reported', 'Observation and next step', 'Related'],
    notStated: 'Not stated',
    packages: 'Preparation work: work packages',
    pkgHead: ['No.', 'Work package', 'Workstream', 'Suggested owner', 'Output required', 'Questions', 'Depends on'],
    clarify: 'Questions to clarify',
    clarifyHead: ['Workstream', 'Count', 'Questions'],
    reviews: 'Reviews and open facts',
    specialist: (s: string) => `Specialist review (Q25, transaction tax adviser): ${s}`,
    planHead: ['No.', 'Category', 'Work package', 'Workstream', 'Title', 'Reason', 'Action', 'Suggested owner', 'Timing', 'Depends on', 'Waiting for', 'Evidence required', 'Dimension', 'Area', 'Questions', 'Status'],
    answers: 'Answers',
    answersTitle: 'Answer audit: every applicable question, plus answers kept outside the current scope',
    answerHead: ['ID', 'Workstream', 'Chapter', 'Dimension', 'Area', 'Question', 'Applicability', 'Answer status', 'Chosen answer', 'Points', 'Evidence level', 'Evidence reference', 'Evidence owner', 'Evidence date', 'Effective weight'],
    applicable: 'Applicable',
    pendingApp: 'Applicability pending',
    outOfScope: 'Not in scope (answer kept)',
    naConfirmed: 'Not applicable (confirmed)',
    answered: 'Answered',
    reconfirm: 'Reconfirm',
    evidence: { self_reported: 'Self-reported', dated_reference: 'Dated reference', reviewed: 'Reviewed' } as Record<string, string>,
    noEvidence: 'Self-reported',
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
    taxHead: ['Ebene', 'Punkt', 'Status'],
    tax: 'Steuerlicher Arbeitsstrang',
    statusList: ['Offen', 'In Arbeit', 'Erledigt'],
    scope: 'Umfang der Selbsteinschätzung',
    scopeRows: ['Perspektive', 'Ziele', 'Transaktionsumfang', 'Zeithorizont', 'Aktive Module', 'Offene Module'],
    none: 'Keine',
    notConfirmed: 'Nicht bestätigt',
    record: 'Dokumentation',
    recordRows: ['Datenstand', 'Katalogversion', 'Bewertungsversion', 'Berichtsversion', 'Erstellt'],
    dataComplete: 'Vollständige Selbsteinschätzung',
    dataIncomplete: 'Unvollständige Selbsteinschätzung',
    steps: 'Empfohlene nächste Schritte',
    stepHead: ['Nr.', 'Schritt', 'Details', 'Vorgeschlagene Verantwortung', 'Fragen'],
    stepsNone: 'Aus Ihren Antworten ergeben sich keine Vorbereitungslücken. Prüfen Sie als Nächstes die wichtigsten Aussagen und aktualisieren Sie die Nachweise vor dem Start.',
    buyer: 'Was ein Käufer prüfen wird (Ihre Angaben aus dem Einstieg, nicht bewertet)',
    buyerHead: ['Thema', 'Ihre Angabe', 'Beobachtung und nächster Schritt', 'Zugehörig'],
    notStated: 'Keine Angabe',
    packages: 'Vorbereitungsarbeit: Arbeitspakete',
    pkgHead: ['Nr.', 'Arbeitspaket', 'Arbeitsstrang', 'Vorgeschlagene Verantwortung', 'Erforderliches Ergebnis', 'Fragen', 'Hängt ab von'],
    clarify: 'Offene Fragen zur Klärung',
    clarifyHead: ['Arbeitsstrang', 'Anzahl', 'Fragen'],
    reviews: 'Prüfungen und offene Fakten',
    specialist: (s: string) => `Prüfung durch Spezialisten (Q25, transaktionserfahrener Steuerberater): ${s}`,
    planHead: ['Nr.', 'Kategorie', 'Arbeitspaket', 'Arbeitsstrang', 'Titel', 'Begründung', 'Maßnahme', 'Vorgeschlagene Verantwortung', 'Zeitpunkt', 'Hängt ab von', 'Wartet auf', 'Erforderlicher Nachweis', 'Dimension', 'Bereich', 'Fragen', 'Status'],
    answers: 'Antworten',
    answersTitle: 'Antwortprotokoll: alle zutreffenden Fragen sowie Antworten, die außerhalb des aktuellen Umfangs aufbewahrt sind',
    answerHead: ['ID', 'Arbeitsstrang', 'Kapitel', 'Dimension', 'Bereich', 'Frage', 'Anwendbarkeit', 'Antwortstatus', 'Gewählte Antwort', 'Punkte', 'Nachweisstufe', 'Nachweis', 'Verantwortlich für Nachweis', 'Stand des Nachweises', 'Effektives Gewicht'],
    applicable: 'Zutreffend',
    pendingApp: 'Anwendbarkeit offen',
    outOfScope: 'Nicht im Umfang (Antwort aufbewahrt)',
    naConfirmed: 'Nicht zutreffend (bestätigt)',
    answered: 'Beantwortet',
    reconfirm: 'Erneut bestätigen',
    evidence: { self_reported: 'Selbstauskunft', dated_reference: 'Datierter Nachweis', reviewed: 'Geprüft' } as Record<string, string>,
    noEvidence: 'Selbstauskunft',
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
  taxScopeLabel: Record<TaxRow['scope'], string>;
  dimStatusLabel: Record<string, string>;
  taskStatus: Record<string, TaskStatusKey>;
  plan: PlanView;
  buyer: BuyerItem[];
  ctx: AssessmentContext;
  answers: AnswerMap;
}

export async function exportActionPlanXlsx({ result: r, lang, context, taxStatusLabel, taxScopeLabel, dimStatusLabel, taskStatus, plan, buyer, ctx, answers }: ExportInput) {
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

  const RT = REPORT_TEXT[lang];
  /** Label/value rows (two columns, value merged across the rest). */
  const kvRows = (labels: string[], values: string[]) => {
    labels.forEach((l, i) => {
      bodyCell(ov, row, 1, l, { bold: true, fill: GREY_1 });
      ov.mergeCells(row, 2, row, 6);
      bodyCell(ov, row, 2, values[i]);
      ov.getRow(row).height = Math.max(18, Math.ceil(values[i].length / 95) * 15);
      row++;
    });
  };
  const fitHeight = (r0: number, texts: [string, number][]) => {
    ov.getRow(r0).height = Math.max(20, ...texts.map(([x, w]) => Math.ceil(x.length / w) * 15));
  };

  sectionTitle(ov, row++, t.context);
  ov.mergeCells(row, 1, row, 6);
  bodyCell(ov, row, 1, context.join('  |  '));
  ov.getCell(row, 1).border = {};
  row += 2;

  // Scope and record of this export.
  sectionTitle(ov, row++, t.scope);
  const opt = <T extends string>(group: string, opts: { value: T; label: string }[], v: T | null | undefined) => localOptions(lang, group, opts).find((o) => o.value === v)?.label ?? t.notConfirmed;
  kvRows(t.scopeRows, [
    r.profile ? profileText(lang, r.profile as Parameters<typeof profileText>[1]).name : t.notConfirmed,
    ctx.objectives.map((o) => opt('objective', OBJECTIVE_OPTIONS, o)).join(', ') || t.notConfirmed,
    opt('perimeter', PERIMETER_OPTIONS, ctx.perimeter),
    opt('horizon', HORIZON_OPTIONS, ctx.horizon),
    r.activeModules.map((m) => routeLabel(lang, m)).join(', ') || t.none,
    r.pendingModules.map((m) => routeLabel(lang, m)).join(', ') || t.none,
  ]);
  row++;
  sectionTitle(ov, row++, t.record);
  const gen = new Date(r.generatedAt);
  kvRows(t.recordRows, [
    r.dataStatus === 'data_complete' ? t.dataComplete : t.dataIncomplete,
    r.versions.catalogue, r.versions.scoring, r.versions.report,
    `${Number.isNaN(gen.getTime()) ? r.generatedAt : gen.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'long', timeStyle: 'short' })} (${r.generatedAt})`,
  ]);
  row++;

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

  sectionTitle(ov, row++, t.steps);
  if (!plan.nextSteps.length) {
    ov.mergeCells(row, 1, row, 6);
    bodyCell(ov, row++, 1, t.stepsNone, { fill: LIME_PALE });
  } else {
    headerRow(ov, row, t.stepHead);
    ov.mergeCells(row, 3, row, 4);
    row++;
    plan.nextSteps.forEach((st, i) => {
      const fill = st.kind === 'critical' ? RED_PALE : undefined;
      bodyCell(ov, row, 1, i + 1, { fill, bold: true });
      ov.getCell(row, 1).alignment = { vertical: 'top', horizontal: 'center' };
      bodyCell(ov, row, 2, st.title, { fill, bold: true });
      ov.mergeCells(row, 3, row, 4);
      bodyCell(ov, row, 3, st.detail, { fill });
      bodyCell(ov, row, 5, st.owner ?? '', { fill });
      bodyCell(ov, row, 6, st.questionIds.join(', '), { fill });
      fitHeight(row, [[st.title, 24], [st.detail, 55], [st.questionIds.join(', '), 12]]);
      row++;
    });
  }
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
      fitHeight(row, [[k.text, 70], [k.title, 20], [k.questionIds.join(', '), 12]]);
      row++;
    }
  }
  row++;

  sectionTitle(ov, row++, t.buyer);
  headerRow(ov, row, t.buyerHead);
  ov.mergeCells(row, 3, row, 5);
  row++;
  for (const b of buyer) {
    bodyCell(ov, row, 1, b.topic, { bold: true });
    bodyCell(ov, row, 2, b.value ?? t.notStated);
    ov.mergeCells(row, 3, row, 5);
    bodyCell(ov, row, 3, b.text);
    bodyCell(ov, row, 6, [b.id, ...b.relatedIds].join(', '));
    fitHeight(row, [[b.text, 82], [b.value ?? '', 20]]);
    row++;
  }
  row++;

  sectionTitle(ov, row++, `${RT.category.critical} · ${plan.critical.length}`);
  if (plan.critical.length) {
    for (const x of plan.critical) {
      bodyCell(ov, row, 1, x.title, { bold: true, fill: RED_PALE });
      ov.mergeCells(row, 2, row, 5);
      bodyCell(ov, row, 2, x.action, { fill: RED_PALE });
      bodyCell(ov, row, 6, x.sourceQuestionIds.join(', '), { fill: RED_PALE });
      fitHeight(row, [[x.title, 28], [x.action, 90]]);
      row++;
    }
  }
  row++;

  sectionTitle(ov, row++, `${t.packages} · ${plan.packages.length}`);
  if (!plan.packages.length) {
    ov.mergeCells(row, 1, row, 6);
    bodyCell(ov, row++, 1, t.stepsNone);
  } else {
    // Six columns on this sheet: package (with workstream), owner, output (merged 3-5), questions.
    headerRow(ov, row, [t.pkgHead[1], t.pkgHead[3], t.pkgHead[4], '', '', t.pkgHead[5]]);
    ov.mergeCells(row, 3, row, 5);
    row++;
    plan.packages.forEach((p, i) => {
      const fill = i % 2 ? GREY_1 : undefined;
      const deps = [...p.dependsOn.map((d) => d.name), ...(p.waitingFor.length ? [RT.waitingFor(p.waitingFor.join(', '))] : [])];
      const name = `${i + 1}. ${p.name}\n${p.workstreamName}`;
      bodyCell(ov, row, 1, name, { bold: true, fill });
      bodyCell(ov, row, 2, p.owner, { fill });
      ov.mergeCells(row, 3, row, 5);
      const out = deps.length ? `${p.output}\n${t.pkgHead[6]}: ${deps.join('; ')}` : p.output;
      bodyCell(ov, row, 3, out, { fill });
      bodyCell(ov, row, 6, p.tasks.map((x) => x.sourceQuestionIds[0]).join(', '), { fill });
      fitHeight(row, [[p.name, 26], [out, 70], [p.owner, 19]]);
      if (deps.length || p.name.length > 26) ov.getRow(row).height = (ov.getRow(row).height ?? 20) + 15;
      row++;
    });
  }
  row++;

  sectionTitle(ov, row++, `${t.clarify} · ${plan.clarifyCount}`);
  if (plan.clarifyCount) {
    headerRow(ov, row, [t.clarifyHead[0], t.clarifyHead[1], t.clarifyHead[2], '', '', '']);
    ov.mergeCells(row, 3, row, 6);
    row++;
    if (plan.reviews.length) {
      bodyCell(ov, row, 1, t.reviews, { bold: true });
      bodyCell(ov, row, 2, plan.reviews.length);
      ov.mergeCells(row, 3, row, 6);
      const txt = plan.reviews.map((x) => x.title).join('; ');
      bodyCell(ov, row, 3, txt);
      fitHeight(row, [[txt, 95]]);
      row++;
    }
    for (const g of plan.clarifyGroups) {
      bodyCell(ov, row, 1, g.name, { bold: true });
      bodyCell(ov, row, 2, g.tasks.length);
      ov.mergeCells(row, 3, row, 6);
      const txt = g.tasks.map((x) => `${x.sourceQuestionIds[0]} ${x.title}`).join('; ');
      bodyCell(ov, row, 3, txt);
      fitHeight(row, [[txt, 95]]);
      row++;
    }
  }
  row++;

  sectionTitle(ov, row++, t.tax);
  const q25 = r.score.controls.Q25;
  ov.mergeCells(row, 1, row, 6);
  bodyCell(ov, row++, 1, t.specialist(q25 ? controlStateLabel(lang, q25) : t.none));
  headerRow(ov, row++, t.taxHead);
  for (const scope of ['company', 'company_seller', 'seller', 'cross_border'] as const) {
    for (const x of r.tax.filter((y) => y.scope === scope)) {
      const fill = x.status === 'Prepared' ? LIME_PALE : undefined;
      bodyCell(ov, row, 1, taxScopeLabel[x.scope], { fill });
      bodyCell(ov, row, 2, `${x.id} ${x.name}`, { fill });
      bodyCell(ov, row, 3, taxStatusLabel[x.status], { bold: true, fill });
      row++;
    }
  }
  row++;
  ov.mergeCells(row, 1, row, 6);
  const n1 = ov.getCell(row, 1);
  n1.value = t.note;
  n1.font = { name: 'Calibri', size: 9, italic: true, color: { argb: GREY_4 } };
  n1.alignment = { wrapText: true, vertical: 'top' };
  ov.getRow(row).height = 42;

  // ── Sheet 2: action plan, one row per task in report order ──────────────
  const ws = wb.addWorksheet(t.tasks, { views: [{ state: 'frozen', ySplit: 5, showGridLines: false }], pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '5:5', margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } } });
  const head = t.planHead;
  ws.columns = [6, 18, 26, 18, 30, 40, 40, 22, 16, 12, 14, 34, 18, 22, 12, 12].map((width) => ({ width }));
  masthead(ws, head.length);
  headerRow(ws, 5, head);
  const statusLabels = t.statusList;
  const statusIndex: Record<TaskStatusKey, number> = { open: 0, in_progress: 1, done: 2 };
  const pkgName = (k: PackageKey | null) => (k ? RT.packages[k].name : '');
  const wsName = (k: PackageKey | null, x: { sourceQuestionIds: string[] }) => {
    const w = k ? WORKSTREAM_OF_PACKAGE[k] : x.sourceQuestionIds[0] ? workstreamOf(x.sourceQuestionIds[0]) : null;
    return w ? RT.workstreams[w] : '';
  };
  plan.ordered.forEach(({ task: x, category, packageKey }, i) => {
    const rr = 6 + i;
    const fill = category === 'critical' ? RED_PALE : i % 2 ? GREY_1 : undefined;
    const vals: (string | number)[] = [
      i + 1, RT.category[category], category === 'preparation' ? pkgName(packageKey) : '', wsName(packageKey, x), x.title, x.reason, x.action,
      x.accountableRole, x.suggestedTiming, x.dependencies.join(', '), x.waitingFor.length ? RT.waitingFor(x.waitingFor.join(', ')) : '',
      x.evidenceRequired ?? '', x.dimension ?? '', x.domain ?? '', x.sourceQuestionIds.join(', '),
      statusLabels[statusIndex[taskStatus[x.key] ?? 'open']],
    ];
    vals.forEach((v, c) => bodyCell(ws, rr, c + 1, v, { fill, bold: c === 4 }));
    ws.getCell(rr, head.length).dataValidation = { type: 'list', allowBlank: false, formulae: [`"${statusLabels.join(',')}"`] };
    const longest = Math.max(x.reason.length / 38, x.action.length / 38, (x.evidenceRequired ?? '').length / 31, x.title.length / 28, x.sourceQuestionIds.join(', ').length / 10);
    ws.getRow(rr).height = Math.max(30, Math.ceil(longest) * 15);
  });
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + plan.ordered.length, column: head.length } };

  // ── Sheet 3: answer audit ──────────────────────────────────────────────────
  const as = wb.addWorksheet(t.answers, { views: [{ state: 'frozen', ySplit: 6, showGridLines: false }], pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '6:6', margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } } });
  as.columns = [6, 18, 20, 18, 22, 46, 18, 20, 42, 8, 16, 26, 18, 12, 10].map((width) => ({ width }));
  masthead(as, t.answerHead.length);
  const at = as.getCell(5, 1);
  at.value = t.answersTitle;
  at.font = { name: 'Calibri', size: 11, italic: true, color: { argb: GREY_4 } };
  headerRow(as, 6, t.answerHead);
  const applicableIds = new Set(r.score.applicable.map((q) => q.id));
  let ar = 7;
  for (const q0 of QUESTIONS) {
    const a = answers[q0.id];
    const isApplicable = applicableIds.has(q0.id);
    const naConfirmed = a?.status === 'not_applicable_confirmed';
    if (!isApplicable && !a) continue;
    const q = localQuestion(lang, q0);
    const c = r.score.controls[q0.id];
    const applicability = isApplicable ? (c?.pendingApplicability ? t.pendingApp : t.applicable) : naConfirmed ? t.naConfirmed : t.outOfScope;
    const st = !a ? RT.state.unanswered
      : hasConflict(a) ? statusLabel(lang, 'conflicted')
      : a.requiresReconfirmation ? t.reconfirm
      : a.status === 'substantive' ? t.answered : statusLabel(lang, a.status);
    const chosen = a?.status === 'substantive' && a.points != null ? q.anchors[a.points / 50] : '';
    const ev = a?.evidence;
    const factor = c?.evidenceFactor ?? 0;
    const evLevel = ev ? `${t.evidence[ev.reviewStatus] ?? ev.reviewStatus} (${factor})` : t.noEvidence;
    const chIdx = CHAPTERS.findIndex((ch) => (ch as { domains?: string[] }).domains?.includes(q0.domain));
    const ws0 = workstreamOf(q0.id);
    const vals: (string | number)[] = [
      q0.id, ws0 ? RT.workstreams[ws0] : '', chIdx >= 0 ? chapterTitle(lang, chIdx) : '', dimensionName(lang, dimensionOf(q0.domain)), domainName(lang, q0.domain),
      questionText(q0, ctx, lang), applicability, st, chosen, a?.status === 'substantive' && a.points != null ? a.points : '',
      evLevel, ev?.reference ?? '', ev?.ownerRole ?? '', ev?.asOfDate ?? '', c ? Math.round(c.effectiveWeight * 100) / 100 : '',
    ];
    const fill = !isApplicable ? GREY_1 : undefined;
    vals.forEach((v, k) => bodyCell(as, ar, k + 1, v, { fill, bold: k === 0 }));
    if (!isApplicable) for (let k = 1; k <= vals.length; k++) as.getCell(ar, k).font = { name: 'Calibri', size: 11, italic: true, color: { argb: GREY_4 } };
    as.getRow(ar).height = Math.max(30, Math.ceil(Math.max(String(vals[5]).length / 44, chosen.length / 40, String(vals[11]).length / 24)) * 15);
    ar++;
  }
  as.autoFilter = { from: { row: 6, column: 1 }, to: { row: ar - 1, column: t.answerHead.length } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${t.file}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
