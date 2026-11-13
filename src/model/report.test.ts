// Report structure: task taxonomy, work packages, next steps, dependency
// order, buyer investigation, tax scope and labels.
import { describe, expect, it } from 'vitest';
import { UI } from '../i18n/ui';
import { QUESTIONS } from './catalogue';
import { MAX_NEXT_STEPS, PACKAGES, PACKAGE_OF, buildPlanView, categoryOf } from './packages';
import { buildResult, buyerInvestigation } from './plan';
import { applicableQuestions, resolveRoutes } from './routing';
import type { Answer, AnswerMap, AssessmentContext, Points } from './types';

const T = '2026-11-10T10:00:00.000Z';
function ctx(over: Partial<AssessmentContext> = {}): AssessmentContext {
  return {
    role: 'owner', ownershipTags: ['private_family'], managementModel: 'owner_led', profile: 'OWNER',
    objectives: ['full_sale'], perimeter: 'whole_business', horizon: 'm6_18', liquidity: 'no_pressure',
    triggers: { debt: 'no', acquisitions: 'no', employee_equity: 'no', preferences: 'no', convertibles: 'no', regulated: 'no', contingent: 'no', group_dependency: 'no' },
    sellerType: 'individuals', sellerTaxStatus: 'same',
    company: { businessModel: null, sector: null, revenueBand: null, employeeBand: null, jurisdiction: 'DE' },
    ...over,
  };
}
const sub = (points: Points): Answer => ({ status: 'substantive', points, answeredAt: T });
const st = (status: Answer['status']): Answer => ({ status, answeredAt: T });
const fill = (c: AssessmentContext, f: (id: string) => Answer): AnswerMap =>
  Object.fromEntries(applicableQuestions(resolveRoutes(c)).map((q) => [q.id, f(q.id)]));

describe('task taxonomy', () => {
  it('unanswered and unresolved controls are questions to clarify, never preparation work', () => {
    const c = ctx({ liquidity: 'potential' });
    const unresolved: Answer['status'][] = ['unknown', 'needs_internal_confirmation', 'needs_adviser_review', 'withheld', 'not_applicable_requested'];
    const a = fill(c, () => sub(50));
    delete a.Q01;
    unresolved.forEach((s, i) => { a[`Q1${i}`] = st(s); });
    const r = buildResult(c, a, T);
    for (const id of ['Q01', 'Q10', 'Q11', 'Q12', 'Q13', 'Q14']) {
      const t = r.tasks.find((x) => x.sourceQuestionIds.includes(id) && x.ruleId == null)!;
      expect(categoryOf(t), id).toBe('clarify');
      expect(t.label).not.toMatch(/gap/i);
    }
    expect(r.tasks.find((x) => x.sourceQuestionIds.includes('Q01'))!.label).toBe('Not assessed');
    // Liquidity review is a question to clarify.
    expect(categoryOf(r.tasks.find((x) => x.ruleId === 'LIQ')!)).toBe('clarify');
    // Preparation work only comes from substantive answers below 100.
    for (const t of r.tasks.filter((x) => categoryOf(x) === 'preparation')) {
      const ans = a[t.sourceQuestionIds[0]];
      expect(ans.status).toBe('substantive');
      expect(ans.points).toBeLessThan(100);
    }
  });

  it('zero coverage yields no work packages and at most three next steps, all about open questions', () => {
    const r = buildResult(ctx(), {}, T);
    const v = buildPlanView(r, 'en');
    expect(v.packages).toHaveLength(0);
    expect(v.critical).toHaveLength(0);
    expect(v.nextSteps.length).toBeGreaterThan(0);
    expect(v.nextSteps.length).toBeLessThanOrEqual(MAX_NEXT_STEPS);
    expect(v.nextSteps.every((s) => s.kind === 'clarify')).toBe(true);
    expect(v.nextSteps[0].title).toMatch(/^Answer the open questions on /);
    expect(v.clarifyCount).toBe(37);
    expect(v.ordered.every((o) => o.category === 'clarify')).toBe(true);
  });

  it('next steps: critical prerequisites first, then work packages, then open questions when many are open', () => {
    const c = ctx({ horizon: 'under_6' });
    const a = fill(c, () => sub(50));
    a.Q04 = sub(0);
    for (const id of ['Q09', 'Q10', 'Q11', 'Q12', 'Q13', 'Q14']) delete a[id];
    const v = buildPlanView(buildResult(c, a, T), 'en');
    expect(v.nextSteps.map((s) => s.kind)).toEqual(['critical', 'package', 'clarify']);
    expect(v.nextSteps[0].questionIds).toEqual(['Q04']);
  });

  it('every view of the plan uses the same three categories in the same order', () => {
    const c = ctx({ horizon: 'under_6' });
    const a = fill(c, (id) => (id < 'Q20' ? sub(0) : id < 'Q40' ? st('unknown') : sub(50)));
    const r = buildResult(c, a, T);
    const v = buildPlanView(r, 'en');
    expect(v.ordered).toHaveLength(r.tasks.length);
    const cats = v.ordered.map((o) => o.category);
    const rank = { critical: 0, preparation: 1, clarify: 2 };
    for (let i = 1; i < cats.length; i++) expect(rank[cats[i - 1]]).toBeLessThanOrEqual(rank[cats[i]]);
  });
});

describe('work packages', () => {
  it('every control belongs to exactly one package', () => {
    const all = PACKAGES.flatMap((p) => p.controls);
    expect(all).toHaveLength(QUESTIONS.length);
    expect(new Set(all).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) expect(PACKAGE_OF[q.id]).toBeDefined();
  });

  it('groups preparation work by deliverable and orders packages by impact', () => {
    const c = ctx({ ownershipTags: ['vc'], profile: 'VC', triggers: { ...ctx().triggers, convertibles: 'yes', employee_equity: 'yes' } });
    const a = fill(c, () => sub(50));
    const r = buildResult(c, a, T);
    const v = buildPlanView(r, 'en');
    const prepIds = r.tasks.filter((t) => t.kind === 'gap').flatMap((t) => t.sourceQuestionIds);
    const inPackages = v.packages.flatMap((p) => p.tasks.flatMap((t) => t.sourceQuestionIds));
    expect([...inPackages].sort()).toEqual([...prepIds].sort());
    const cap = v.packages.find((p) => p.key === 'cap_table')!;
    expect(cap.name).toBe('Build one cap-table and exit-waterfall package');
    expect(cap.tasks.map((t) => t.sourceQuestionIds[0]).sort()).toEqual(['Q32', 'Q38', 'Q39', 'Q51']);
    expect(cap.impact).toBeCloseTo(cap.tasks.reduce((s, t) => s + t.impact, 0));
    for (const p of v.packages) for (const l of p.controls.filter((x) => x.reason)) expect(l.reason).toMatch(/^Today: .* Target: /);
    // Ordered by impact unless a dependency comes first.
    for (let i = 1; i < v.packages.length; i++) {
      const prev = v.packages[i - 1];
      const cur = v.packages[i];
      if (!cur.dependsOn.some((d) => d.key === prev.key) && !v.packages.slice(i).some((p) => prev.dependsOn.some((d) => d.key === p.key))) {
        expect(prev.impact).toBeGreaterThanOrEqual(cur.impact - 1e-9);
      }
    }
    const de = buildPlanView(buildResult(c, a, T, 'de'), 'de');
    expect(de.packages.map((p) => p.key)).toEqual(v.packages.map((p) => p.key));
    expect(de.packages.find((p) => p.key === 'cap_table')!.name).not.toBe(cap.name);
  });
});

describe('dependency order', () => {
  it('Q05 never comes before Q01 within a priority class, and waits while Q01 is open', () => {
    const c = ctx();
    const a = fill(c, () => sub(100));
    a.Q05 = sub(0);   // higher impact than Q01 at 50
    a.Q01 = sub(50);
    const t = buildResult(c, a, T).tasks;
    const i1 = t.findIndex((x) => x.sourceQuestionIds.includes('Q01'));
    const i5 = t.findIndex((x) => x.sourceQuestionIds.includes('Q05'));
    expect(t[i5].impact).toBeGreaterThan(t[i1].impact);
    expect(i1).toBeLessThan(i5);
    expect(t[i5].waitingFor).toEqual(['Q01']);

    a.Q01 = sub(100);
    expect(buildResult(c, a, T).tasks.find((x) => x.sourceQuestionIds.includes('Q05'))!.waitingFor).toEqual([]);

    delete a.Q01; // unanswered dependency: still waiting, Q01 is a question to clarify
    const t2 = buildResult(c, a, T).tasks;
    expect(t2.find((x) => x.sourceQuestionIds.includes('Q05'))!.waitingFor).toEqual(['Q01']);
    expect(t2.findIndex((x) => x.sourceQuestionIds.includes('Q01'))).toBeLessThan(t2.findIndex((x) => x.sourceQuestionIds.includes('Q05')));
  });

  it('a work package never comes before one it depends on', () => {
    const c = ctx({ perimeter: 'business_unit_assets', ownershipTags: ['corporate_group'], profile: 'CORPORATE' });
    const a = fill(c, () => sub(100));
    a.Q44 = sub(50);
    a.Q45 = sub(0);
    a.Q21 = sub(0);
    const v = buildPlanView(buildResult(c, a, T), 'en');
    const fin = v.packages.findIndex((p) => p.key === 'financials');
    const sep = v.packages.findIndex((p) => p.key === 'separation');
    expect(v.packages[fin].dependsOn.map((d) => d.key)).toContain('separation');
    expect(sep).toBeLessThan(fin);
  });
});

describe('what a buyer will investigate', () => {
  it('builds items from discovery and combines them with the related control', () => {
    const c = ctx();
    const a = fill(c, () => sub(100));
    a.Q09 = sub(50);
    const r = buildResult(c, a, T);
    const items = buyerInvestigation({ E04: 'Over 30%', E03: 'Under 25%', E07: 'Working capital', E01: ['Recurring revenue', 'Personal customer relationships'] }, r.score);
    expect(items.map((i) => i.id)).toEqual(['E04', 'E03', 'E07', 'E01']);
    const e04 = items[0];
    expect(e04.source).toBe('You reported in discovery');
    expect(e04.text).toMatch(/^You reported more than 30% revenue exposure to one customer\./);
    expect(e04.text).toContain('(Q09)');
    expect(e04.text).toContain('Keep the contract, the renewal outlook and a downside scenario');
    expect(e04.relatedIds).toEqual(['Q09']);
    expect(items[1].relatedIds).toEqual(['Q10']);
    expect(items[2].text).toContain('working capital');
    expect(items[2].relatedIds).toEqual(['Q16']);
    expect(items[3].relatedIds).toEqual(['Q10', 'Q14']); // earlier E01 label still maps
    for (const i of items) expect(i.text).not.toMatch(/valuation|discount|multiple|risk verdict|€/i);
  });

  it('handles missing and not-calculated answers, and shows items even when every score is 100', () => {
    const c = ctx();
    const r = buildResult(c, fill(c, () => sub(100)), T);
    expect(r.dimensions.every((d) => d.displayIndex === 100)).toBe(true);
    const items = buyerInvestigation({ E04: 'Not yet calculated', E07: 'Not assessed' }, r.score);
    expect(items).toHaveLength(4);
    expect(items[0].value).toBeNull();
    expect(items[0].text).toContain('not yet calculated');
    expect(items[1].text).toContain('did not answer');
    expect(items[2].text).toContain('not yet assessed');
    const de = buyerInvestigation({ E04: 'Over 30%' }, r.score, 'de');
    expect(de[0].source).toBe('Ihre Angabe im Einstieg');
    expect(de[0].text).toContain('Q09');
  });
});

describe('tax workstream', () => {
  it('Q27 and Q28 sit at company and seller level', () => {
    const r = buildResult(ctx(), {}, T);
    expect(r.tax.find((x) => x.id === 'Q27')!.scope).toBe('company_seller');
    expect(r.tax.find((x) => x.id === 'Q28')!.scope).toBe('company_seller');
    expect(r.tax.find((x) => x.id === 'Q26')!.scope).toBe('seller');
    expect(r.tax.find((x) => x.id === 'Q25')!.scope).toBe('company');
    expect(UI.en.taxScope.company_seller).toBe('Company and seller level');
    expect(UI.de.taxScope.company_seller).toBe('Unternehmens- und Verkäuferebene');
  });
});

describe('labels', () => {
  it('a complete dimension reads "Complete self-assessment"', () => {
    expect(UI.en.dimStatus.complete).toBe('Complete self-assessment');
    expect(UI.de.dimStatus.complete).toBe('Vollständige Selbsteinschätzung');
  });
});
