// Content-owner review workbook, generated from the live catalogue.
// Usage: npm run gen:review   (writes docs/review/YYMMDD_ExitIQ_Content review catalogue ..._DRAFT.xlsx)
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { readFileSync, writeFileSync } from 'node:fs';
import { CATALOGUE_VERSION, CHAPTERS, DIMENSIONS, DOMAIN_NAMES, PROFILE_WEIGHTS, QUESTIONS, ROUTE_LABELS } from '../src/model/catalogue';
import { DISCOVERY } from '../src/model/options';
import { DE } from '../src/i18n/catalogue-de';
import { discoveryOptionLabel } from '../src/i18n/localize';
import { PACKAGES } from '../src/model/packages';
import { REPORT_TEXT } from '../src/model/text';
import { DISPLAY_COVERAGE_MIN, DOMAIN_LOCAL_COVERAGE_MIN } from '../src/model/scoring';

const out = process.argv[2] ?? 'docs/review';
const NAVY = 'FF002336', NAVY_2 = 'FF003E5F', GREY_1 = 'FFF2F3F4', GREY_2 = 'FFCBD2D6', GREY_4 = 'FF324E5E', WHITE = 'FFFFFFFF';
const F = (o: Partial<ExcelJS.Font> = {}) => ({ name: 'Aptos', size: 11, color: { argb: NAVY }, ...o });
const wb = new ExcelJS.Workbook();
wb.creator = 'ExitIQ by atares';
const logo = wb.addImage({ base64: readFileSync(new URL('../public/media/atares-logo-full-navy.png', import.meta.url)).toString('base64'), extension: 'png' });
const d = new Date();
const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const yymmdd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

function sheet(name: string, title: string, widths: number[], header: string[] | null, landscape = true) {
  const ws = wb.addWorksheet(name, { views: [{ showGridLines: false, activeCell: 'A1', ...(header ? { state: 'frozen' as const, ySplit: 5, topLeftCell: 'A6' } : {}) }],
    pageSetup: { paperSize: 9, orientation: landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, ...(header ? { printTitlesRow: '5:5' } : {}) } });
  ws.columns = widths.map((width) => ({ width }));
  ws.getRow(1).height = 30; ws.getRow(2).height = 30;
  ws.addImage(logo, { tl: { col: 0.1, row: 0.15 }, ext: { width: 152, height: 56 } });
  const t = ws.getCell(1, 3); t.value = title; t.font = F({ size: 18, bold: true }); t.alignment = { vertical: 'bottom' };
  const s = ws.getCell(2, 3); s.value = `ExitIQ ${CATALOGUE_VERSION}, created ${date}. Draft for review.`; s.font = F({ color: { argb: GREY_4 } }); s.alignment = { vertical: 'top' };
  for (let c = 1; c <= widths.length; c++) ws.getCell(3, c).border = { bottom: { style: 'thin', color: { argb: NAVY } } };
  ws.getRow(3).height = 6;
  if (header) {
    header.forEach((h, i) => { const c = ws.getCell(5, i + 1); c.value = h; c.font = F({ bold: true, color: { argb: WHITE } }); c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_2 } }; c.alignment = { vertical: 'middle', wrapText: true }; });
    ws.getRow(5).height = 30;
  }
  return ws;
}
function row(ws: ExcelJS.Worksheet, r: number, vals: (string | number | null)[], opts: { zebra?: boolean; numCols?: number[]; reviewCols?: number[] } = {}) {
  vals.forEach((v, i) => {
    const c = ws.getCell(r, i + 1); c.value = v; c.font = F(); c.alignment = { vertical: 'top', wrapText: true, horizontal: opts.numCols?.includes(i + 1) ? 'right' : undefined };
    c.border = { bottom: { style: 'thin', color: { argb: GREY_2 } } };
    if (opts.zebra) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY_1 } };
  });
  for (const col of opts.reviewCols ?? []) {
    const c = ws.getCell(r, col);
    if (col === opts.reviewCols![0]) c.dataValidation = { type: 'list', allowBlank: true, formulae: ['"Approved,Change needed,Discuss"'] };
  }
}
const longest = (xs: string[], w: number) => Math.max(1, ...xs.map((x) => Math.ceil((x ?? '').length / w)));

// 1. Read me
const rm = sheet('Read me', 'ExitIQ content review', [28, 90, 2], null, false);
const lines: [string, string][] = [
  ['Purpose', 'Sign-off of the ExitIQ question catalogue before launch, as the Product and Implementation Brief (section 22) and the MVP test report require. The workbook is generated from the code, so it shows exactly what users see.'],
  ['What to review', 'Questions: English and German wording of all 55 scored questions and their three answer options (0, 50, 100 points). Discovery: the eight opening screens. Weights, Rules and Work packages: the scoring parameters and the action-plan structure.'],
  ['How to review', 'For each line choose Approved, Change needed or Discuss in the "Review" column and write the change in "Comment". Do not change the IDs.'],
  ['German terms to check first', 'See the sheet "Terms to check": wording choices made during translation that need an M&A professional\'s decision.'],
  ['Status of the parameters', 'Weights, answer anchors, coverage thresholds and priority rules are proposed v1 parameters (expert assumptions), not validated buyer benchmarks.'],
  ['Reviewer', ''], ['Date', ''], ['Overall decision', ''],
];
let r = 5;
for (const [k, v] of lines) { row(rm, r, [k, v]); rm.getCell(r, 1).font = F({ bold: true }); rm.getRow(r).height = Math.max(20, longest([v], 95) * 15); r++; }
rm.getCell(10, 2).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Approved,Approved with changes,Not approved"'] };
r++;
rm.getCell(r, 1).value = 'Sources: ExitIQ catalogue in the application code (src/model/catalogue.ts, src/i18n/catalogue-de.ts), ' + CATALOGUE_VERSION + '.';
rm.getCell(r, 1).font = F({ size: 9, color: { argb: GREY_4 } });

// 2. Questions
const chapterOf = (dom: string) => CHAPTERS.find((c) => c.domains.includes(dom as never))?.title ?? '';
const qh = ['ID', 'Chapter', 'Dimension', 'Domain', 'Local weight', 'Route', 'Name (EN)', 'Question (EN)', '0 points (EN)', '50 points (EN)', '100 points (EN)', 'Name (DE)', 'Question (DE)', '0 Punkte (DE)', '50 Punkte (DE)', '100 Punkte (DE)', 'Review', 'Comment'];
const qs = sheet('Questions', 'Questions and answer options (EN and DE)', [6, 20, 16, 20, 8, 14, 20, 34, 26, 26, 26, 20, 34, 26, 26, 26, 14, 30], qh);
r = 6;
QUESTIONS.forEach((q, i) => {
  const de = DE.questions[q.id];
  const dim = DIMENSIONS.find((x) => x.key === q.domain[0])!.name;
  const vals = [q.id, chapterOf(q.domain), dim, DOMAIN_NAMES[q.domain], q.localWeight, ROUTE_LABELS[q.route], q.name, q.question, ...q.anchors, de.name, de.question, ...de.anchors, '', ''];
  row(qs, r, vals, { zebra: i % 2 === 1, numCols: [5], reviewCols: [17] });
  qs.getRow(r).height = Math.max(30, longest([q.question, ...q.anchors, de.question, ...de.anchors], 30) * 15);
  r++;
});
qs.autoFilter = { from: { row: 5, column: 1 }, to: { row: r - 1, column: qh.length } };

// 2b. Context-specific wording
const vh = ['ID', 'Variant', 'Wording (EN)', 'Wording (DE)', 'Review', 'Comment'];
const vs = sheet('Variants', 'Context-specific wording', [6, 14, 60, 60, 14, 30], vh);
r = 6;
for (const q of QUESTIONS) for (const [k, v] of Object.entries(q.variants ?? {})) {
  const dv = (DE.questions[q.id].variants as Record<string, string> | undefined)?.[k] ?? '';
  row(vs, r, [q.id, k, v ?? '', dv, '', ''], { reviewCols: [5] }); vs.getRow(r).height = 45; r++;
}

// 3. Discovery
const dh = ['ID', 'Type', 'Scored control', 'Title (EN)', 'Options (EN)', 'Title (DE)', 'Options (DE)', 'Review', 'Comment'];
const ds = sheet('Discovery', 'Discovery screens (EN and DE)', [6, 10, 10, 40, 40, 40, 40, 14, 30], dh);
r = 6;
DISCOVERY.forEach((s, i) => {
  const de = DE.discovery[s.id];
  const opts = 'options' in s ? s.options.map((o) => discoveryOptionLabel('en', s.id, o)).join('\n') : '';
  const dopts = de.options?.join('\n') ?? '';
  row(ds, r, [s.id, s.kind, s.kind === 'control' ? s.control : '', s.title ?? '(uses the scored question)', opts, de.title ?? '(uses the scored question)', dopts, '', ''], { zebra: i % 2 === 1, reviewCols: [8] });
  ds.getRow(r).height = Math.max(45, ('options' in s ? s.options.length : 2) * 15 + 6);
  r++;
});

// 4. Weights
const profiles = Object.keys(PROFILE_WEIGHTS) as (keyof typeof PROFILE_WEIGHTS)[];
const PNAME: Record<string, string> = { OWNER: 'Owner', CORPORATE: 'Corporate', PE: 'PE', VC: 'VC' };
const wh = ['Dimension', 'Domain', ...profiles.map((p) => `${PNAME[p]} (in %)`), 'Review', 'Comment'];
const wsh = sheet('Weights', 'Domain weights per weighting profile', [26, 34, 14, 14, 14, 14, 14, 30], wh, false);
r = 6;
for (const dim of DIMENSIONS) {
  for (const dom of dim.domains) { row(wsh, r, [dim.name, `${dom} ${DOMAIN_NAMES[dom]}`, ...profiles.map((p) => PROFILE_WEIGHTS[p][dom]), '', ''], { numCols: [3, 4, 5, 6], reviewCols: [7] }); r++; }
  row(wsh, r, [dim.name, 'Total', ...profiles.map((p) => dim.domains.reduce((t, x) => t + PROFILE_WEIGHTS[p][x], 0)), '', ''], { numCols: [3, 4, 5, 6] });
  for (let c = 1; c <= 6; c++) wsh.getCell(r, c).font = F({ bold: true });
  r += 2;
}

// 5. Rules
const rh = ['Rule', 'Value or definition', 'Review', 'Comment'];
const rs = sheet('Rules', 'Thresholds, evidence and risk rules', [30, 90, 14, 30], rh, false);
const rules: [string, string][] = [
  ['Index shown from', `${Math.round(DISPLAY_COVERAGE_MIN * 100)}% weighted answer coverage per dimension, and every domain at least ${Math.round(DOMAIN_LOCAL_COVERAGE_MIN * 100)}% answered (by local weight).`],
  ['Answer points', '0, 50 or 100 per question. Unknown, internal confirmation, adviser review, prefer not to answer and requested N/A are open, never zero.'],
  ['Evidence support', 'Self-report 0; dated reference with named owner and date 0.5; reviewed by an authorised reviewer 1. Evidence never changes the readiness answer.'],
  ['R01 Liquidity', 'Confirmed acute payment pressure: specialist route, no standard readiness conclusion.'],
  ['R02 Authority', 'Approvals not mapped (Q04 = 0) and a launch planned within six months: critical prerequisite.'],
  ['R03 Essential rights', 'Ownership or essential IP undocumented (Q32 or Q33 = 0): critical legal review. Unknown alone only creates a review item.'],
  ['R04 Tax timing', 'Historical restrictions not reviewed (Q28 = 0 or adviser review): specialist tax review, no assertion of a tax charge.'],
  ['R05 Separation', 'Separation active and essential group services without continuity plan (Q46 = 0): critical prerequisite.'],
  ['R06 Funding', 'No usable cash forecast (Q08 = 0) with possible liquidity pressure or growth capital: funding review.'],
  ['R07 Contradiction', 'Conflicting answers or contributors: excluded from coverage until reconfirmed.'],
  ['Next steps', 'At most three: critical prerequisites first, then work packages by impact (sum of effective weight x missing points), then open questions.'],
];
r = 6;
rules.forEach(([k, v], i) => { row(rs, r, [k, v, '', ''], { zebra: i % 2 === 1, reviewCols: [3] }); rs.getRow(r).height = Math.max(20, longest([v], 95) * 15); r++; });

// 6. Work packages
const ph = ['Work package', 'Workstream', 'Questions', 'Suggested owner', 'Output required', 'Review', 'Comment'];
const ps = sheet('Work packages', 'Work packages in the action plan', [40, 22, 26, 28, 60, 14, 30], ph);
const P = REPORT_TEXT.en;
r = 6;
PACKAGES.forEach((p, i) => {
  const t = P.packages[p.key];
  row(ps, r, [t.name, P.workstreams[p.workstream], p.controls.join(', '), t.owner, t.output, '', ''], { zebra: i % 2 === 1, reviewCols: [6] });
  ps.getRow(r).height = Math.max(30, longest([t.output], 60) * 15); r++;
});

// 7. Terms to check
const th = ['Where', 'English', 'German used', 'Why it needs a decision', 'Decision'];
const ts = sheet('Terms to check', 'German wording choices to decide', [22, 34, 40, 50, 30], th);
const terms: string[][] = [
  ['Module rollover or earn-out', 'Rollover or earn-out', 'Earn-out oder Rückbeteiligung', 'Order reversed to match the landing page; "Rückbeteiligung" for rollover.'],
  ['Module asset transfer', 'Asset transfer', 'Asset Deal', 'Anglicism common in German M&A; alternative "Übertragung von Vermögenswerten".'],
  ['Module separation', 'Separation', 'Separierung', 'Alternative "Herauslösung" or "Carve-out".'],
  ['Module primary capital', 'Primary capital', 'Kapitalerhöhung', 'Narrower legal meaning in German.'],
  ['Leads and contributors', 'Board', 'Gremien', '"Board" has no single German equivalent (Beirat, Aufsichtsrat, Geschäftsführung).'],
  ['Leads and contributors', 'CEO', 'Geschäftsführung', 'Role vs. body.'],
  ['Q07', 'repeatable earnings', 'nachhaltige Ergebnisse', '"nachhaltig" is also used for sustainability.'],
  ['Q23', 'Enterprise to equity bridge', 'Überleitung vom Unternehmenswert zum Eigenkapitalwert', 'Long; alternative "Equity Bridge".'],
  ['Q38', 'investor preferences / distribution rights', 'Liquidationspräferenzen / Erlösverteilungsrechte', 'Check against usual term sheet wording.'],
  ['Q49 help', 'group tax arrangements', 'steuerliche Konzernregelungen (etwa Organschaften)', 'The example "(etwa Organschaften)" is not in the English text: confirm or remove.'],
  ['E01', 'Distinctive products or technology', 'Differenzierende Produkte oder Technologie', 'Alternative "Unverwechselbare Produkte oder Technologie".'],
  ['E07', 'Working capital', 'Working Capital', 'Anglicism; alternative "Betriebskapital" / "Umlaufvermögen".'],
  ['Specialist route', 'Specialist route', 'Spezialistenpfad', 'Wording of the route for acute liquidity, IPO and distress.'],
  ['Action plan', 'Priority actions', 'Vorrangige Maßnahmen', 'Alternative "Prioritäre Maßnahmen".'],
];
r = 6;
terms.forEach((x, i) => { row(ts, r, [...x, ''], { zebra: i % 2 === 1 }); ts.getRow(r).height = Math.max(30, longest([x[2], x[3]], 40) * 15); r++; });

wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
const buf = await wb.xlsx.writeBuffer();
const zip = await JSZip.loadAsync(buf);
const st = await zip.file('xl/styles.xml')!.async('string');
zip.file('xl/styles.xml', st.replace(/(<fonts[^>]*>\s*<font>[\s\S]*?<name val=")[^"]+(")/, '$1Aptos$2'));
const th1 = zip.file('xl/theme/theme1.xml');
if (th1) zip.file('xl/theme/theme1.xml', (await th1.async('string')).replace(/(<a:(?:major|minor)Font>\s*<a:latin typeface=")[^"]+(")/g, '$1Aptos$2'));
const version = CATALOGUE_VERSION.replace(/^.*-(v[\d.]+)$/, '$1');
const name = `${out}/${yymmdd}_ExitIQ_Content review catalogue ${version}_DRAFT.xlsx`;
writeFileSync(name, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(name);
