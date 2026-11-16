// The Excel export, built in node without a browser download: sheet structure,
// masthead, scope and version rows, one row per task, task follow-up columns
// and EN/DE equivalence of every number in the workbook.
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { UI } from '../i18n/ui';
import { CATALOGUE_VERSION, SCORING_VERSION } from '../model/catalogue';
import { PERIMETER_OPTIONS, labelOf } from '../model/options';
import { buildPlanView } from '../model/packages';
import { buildResult, buyerInvestigation } from '../model/plan';
import { applicableQuestions, resolveRoutes } from '../model/routing';
import type { Answer, AnswerMap, AssessmentContext, Points } from '../model/types';
import { buildActionPlanWorkbook, type TaskFollowUp } from './exportXlsx';
import type { Lang } from './i18n';

const T = '2026-11-10T10:00:00.000Z';
const NOW = new Date('2026-11-16T09:30:00');

const ctx: AssessmentContext = {
  role: 'owner', ownershipTags: ['private_family'], managementModel: 'owner_led', profile: 'OWNER',
  objectives: ['full_sale'], perimeter: 'whole_business', horizon: 'm6_18', liquidity: 'potential',
  triggers: { debt: 'yes', acquisitions: 'no', employee_equity: 'no', preferences: 'no', convertibles: 'no', regulated: 'no', contingent: 'no', group_dependency: 'no' },
  sellerType: 'individuals', sellerTaxStatus: 'different',
  company: { businessModel: null, sector: null, revenueBand: null, employeeBand: null, jurisdiction: 'DE' },
};

const sub = (points: Points): Answer => ({ status: 'substantive', points, answeredAt: T });
const answers: AnswerMap = Object.fromEntries(
  applicableQuestions(resolveRoutes(ctx)).map((q, i) => [q.id, i % 5 === 4 ? { status: 'unknown', answeredAt: T } as Answer : sub(([0, 50, 100] as Points[])[i % 3])]),
);
delete answers.Q01;

async function build(lang: Lang, tasks: Record<string, TaskFollowUp> = {}) {
  const r = buildResult(ctx, answers, T, lang);
  const plan = buildPlanView(r, lang);
  const t = UI[lang];
  const buf = await buildActionPlanWorkbook({
    result: r, lang, context: ['Owner', 'Full sale'], taxStatusLabel: t.taxStatus, taxScopeLabel: t.taxScope, dimStatusLabel: t.dimStatus,
    tasks, plan, buyer: buyerInvestigation({}, r.score, lang), ctx, answers, logo: null, now: NOW,
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return { wb, r, plan };
}

/** Every cell of a sheet as [address, value] pairs. */
function cells(ws: ExcelJS.Worksheet): [string, unknown][] {
  const out: [string, unknown][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (c) => out.push([c.address, c.value])));
  return out;
}

/** Value in column B of the row whose column A equals `label` (overview key/value rows). */
function valueFor(ws: ExcelJS.Worksheet, label: string): unknown {
  let v: unknown;
  ws.eachRow((row) => { if (row.getCell(1).value === label) v = row.getCell(2).value; });
  return v;
}

describe('Excel export', () => {
  it('has three sheets with the masthead title and date', async () => {
    for (const [lang, title, sheets] of [
      ['en', 'ExitIQ action plan', ['Overview', 'Action plan', 'Answers']],
      ['de', 'ExitIQ Maßnahmenplan', ['Überblick', 'Maßnahmenplan', 'Antworten']],
    ] as const) {
      const { wb } = await build(lang);
      expect(wb.worksheets.map((w) => w.name)).toEqual(sheets);
      for (const ws of wb.worksheets) expect(ws.getCell('C1').value).toBe(title);
    }
    const { wb } = await build('en');
    expect(wb.worksheets[0].getCell('C2').value).toBe('Created November 16, 2026');
  });

  it('records scope, versions and the tax jurisdiction notice', async () => {
    const { wb } = await build('en');
    const ov = wb.worksheets[0];
    expect(valueFor(ov, 'Perspective')).toBeTruthy();
    expect(valueFor(ov, 'Perimeter')).toBe(labelOf(PERIMETER_OPTIONS, 'whole_business'));
    expect(valueFor(ov, 'Catalogue version')).toBe(CATALOGUE_VERSION);
    expect(valueFor(ov, 'Scoring version')).toBe(SCORING_VERSION);
    expect(valueFor(ov, 'Data status')).toBe('Incomplete self-assessment');
    expect(valueFor(ov, 'Company country')).toBe('Germany');
    expect(valueFor(ov, 'Seller tax residence')).toBe('In another country');
    expect(cells(ov).some(([, v]) => typeof v === 'string' && v.includes('local tax advice is required'))).toBe(true);
  });

  it('has one action plan row per task, with the follow-up columns', async () => {
    const { wb, r, plan } = await build('en');
    const first = plan.ordered[0].task.key;
    const done = plan.ordered[1].task.key;
    const { wb: wb2 } = await build('en', {
      [first]: { status: 'in_progress', dueDate: '2026-12-15', resolution: null },
      [done]: { status: 'done', dueDate: null, resolution: { by: 'CFO', note: 'Board minutes filed.', at: '2026-11-14' } },
    });
    const ws = wb.worksheets[1];
    const head = ws.getRow(5).values as unknown[];
    expect(head).toContain('Suggested timing');
    expect(head).toContain('Agreed due date');
    expect(head).toContain('Resolution');
    let rows = 0;
    ws.eachRow((row, n) => { if (n > 5 && typeof row.getCell(1).value === 'number') rows++; });
    expect(rows).toBe(r.tasks.length);
    expect(plan.ordered.length).toBe(r.tasks.length);
    // Split tax tasks (Q27:company / Q27:seller) list their shared question once.
    const qcol = head.indexOf('Questions');
    ws.eachRow((row, n) => {
      if (n <= 5) return;
      const ids = String(row.getCell(qcol).value ?? '').split(', ').filter(Boolean);
      expect(new Set(ids).size, String(row.getCell(qcol).value)).toBe(ids.length);
    });
    expect(r.tasks.some((x) => x.key.endsWith(':seller'))).toBe(true);

    const ws2 = wb2.worksheets[1];
    const col = (label: string) => head.indexOf(label);
    expect(ws2.getCell(6, col('Status')).value).toBe('In progress');
    expect(ws2.getCell(6, col('Agreed due date')).value).toBe('December 15, 2026');
    expect(ws2.getCell(7, col('Status')).value).toBe('Done');
    expect(String(ws2.getCell(7, col('Resolution')).value)).toBe('Resolved by CFO. Board minutes filed. November 14, 2026');
  });

  it('EN and DE produce the same numbers and row counts on every sheet', async () => {
    const en = await build('en');
    const de = await build('de');
    expect(de.wb.worksheets.length).toBe(en.wb.worksheets.length);
    en.wb.worksheets.forEach((ws, i) => {
      const other = de.wb.worksheets[i];
      expect(other.rowCount, ws.name).toBe(ws.rowCount);
      const nums = (w: ExcelJS.Worksheet) => cells(w).filter(([, v]) => typeof v === 'number');
      expect(nums(other), ws.name).toEqual(nums(ws));
      expect(nums(ws).length).toBeGreaterThan(0);
    });
  });
});
