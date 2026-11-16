// Catalogue v1.2: gaps from the brief audit (specialist triggers, confirmed
// predicates for R04/R06, R07 cross-answer contradictions, Q07 wording,
// exploration help, split tax tasks, route change preview, strength order).
import { describe, expect, it } from 'vitest';
import { CATALOGUE_VERSION, QUESTIONS, QUESTION_BY_ID } from './catalogue';
import { buildPlanView } from './packages';
import { buildResult, supportedStrengths } from './plan';
import { applicabilityChanges, applicableQuestions, questionHelp, questionText, resolveRoutes } from './routing';
import { computeScores, contradictions } from './scoring';
import type { Answer, AnswerMap, AssessmentContext, Points } from './types';

const T = '2026-11-16T10:00:00.000Z';

function ctx(over: Partial<AssessmentContext> = {}): AssessmentContext {
  return {
    role: 'owner', ownershipTags: ['private_family'], managementModel: 'owner_led', profile: 'OWNER',
    objectives: ['full_sale'], perimeter: 'whole_business', horizon: 'm6_18', liquidity: 'no_pressure',
    triggers: { debt: 'no', acquisitions: 'no', employee_equity: 'no', preferences: 'no', convertibles: 'no', regulated: 'no', contingent: 'no', group_dependency: 'no', restructuring: 'no', cross_border_ops: 'no' },
    sellerType: 'individuals', sellerTaxStatus: 'same',
    company: { businessModel: null, sector: null, revenueBand: null, employeeBand: null, jurisdiction: 'DE' },
    ...over,
  };
}
const trig = (over: Partial<AssessmentContext['triggers']>) => ({ triggers: { ...ctx().triggers, ...over } });
const sub = (points: Points): Answer => ({ status: 'substantive', points, answeredAt: T });
const st = (status: Answer['status']): Answer => ({ status, answeredAt: T });
function fill(c: AssessmentContext, f: (id: string) => Answer = () => sub(100)): AnswerMap {
  return Object.fromEntries(applicableQuestions(resolveRoutes(c)).map((q) => [q.id, f(q.id)]));
}

describe('catalogue v1.2', () => {
  it('carries the new version and documents linked rules', () => {
    expect(CATALOGUE_VERSION).toBe('catalogue-2026.11-v1.2');
    const rules = new Set(['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07']);
    for (const q of QUESTIONS) for (const r of q.linkedRules ?? []) expect(rules.has(r), `${q.id} ${r}`).toBe(true);
    expect(QUESTION_BY_ID.Q04.linkedRules).toEqual(['R02']);
    expect(QUESTION_BY_ID.Q32.linkedRules).toEqual(['R03']);
    expect(QUESTION_BY_ID.Q33.linkedRules).toEqual(['R03']);
    expect(QUESTION_BY_ID.Q28.linkedRules).toEqual(['R04']);
    expect(QUESTION_BY_ID.Q46.linkedRules).toContain('R05');
    expect(QUESTION_BY_ID.Q08.linkedRules).toContain('R06');
    for (const id of ['Q01', 'Q03', 'Q05', 'Q08']) expect(QUESTION_BY_ID[id].linkedRules).toContain('R07');
  });
});

describe('CROSS_BORDER: seller tax status or company operations', () => {
  const route = (over: Partial<AssessmentContext>) => resolveRoutes(ctx(over)).CROSS_BORDER;
  it('is on when either side is cross-border', () => {
    expect(route(trig({ cross_border_ops: 'yes' }))).toBe('on');
    expect(route({ sellerTaxStatus: 'different' })).toBe('on');
    expect(route({ sellerTaxStatus: 'multiple', ...trig({ cross_border_ops: 'unknown' }) })).toBe('on');
    expect(route({ sellerTaxStatus: 'unknown', ...trig({ cross_border_ops: 'yes' }) })).toBe('on');
  });
  it('is pending when either side is unknown and neither is yes', () => {
    expect(route(trig({ cross_border_ops: 'unknown' }))).toBe('pending');
    expect(route({ sellerTaxStatus: 'unknown' })).toBe('pending');
    expect(route({ sellerTaxStatus: null })).toBe('pending');
    // Not yet asked (context saved before v1.2): pending, never silently off.
    const c = ctx();
    delete c.triggers.cross_border_ops;
    expect(resolveRoutes(c).CROSS_BORDER).toBe('pending');
  });
  it('is off only when both sides are known to be domestic', () => {
    expect(route({})).toBe('off');
  });
});

describe('R04 tax timing', () => {
  const r04 = (c: AssessmentContext, a: AnswerMap = {}) => buildResult(c, a, T).risks.filter((x) => x.rule === 'R04');
  it('restructuring history alone is a review pointing at Q28, never critical', () => {
    const c = ctx(trig({ restructuring: 'yes' }));
    expect(r04(c)).toEqual([expect.objectContaining({ severity: 'review', basis: 'unresolved', questionIds: ['Q28'] })]);
    expect(r04(c, fill(c, (id) => (id === 'Q28' ? sub(50) : sub(100))))[0].severity).toBe('review');
    // Once the history has been reviewed (Q28 at the full anchor) no review is left.
    expect(r04(c, { Q28: sub(100) })).toHaveLength(0);
  });
  it('an unknown restructuring history asks for clarification', () => {
    const [r] = r04(ctx(trig({ restructuring: 'unknown' })));
    expect(r).toMatchObject({ severity: 'review', questionIds: ['Q28'] });
    expect(r.title).toMatch(/clarification/);
    expect(r04(ctx())).toHaveLength(0);
  });
  it('is critical only when a tax adviser confirmed a restriction affecting the timetable', () => {
    const c = ctx({ taxRestrictionConfirmed: 'yes' });
    const res = buildResult(c, fill(c), T);
    expect(res.risks.filter((x) => x.rule === 'R04')).toEqual([expect.objectContaining({ severity: 'critical', basis: 'confirmed', questionIds: ['Q28'] })]);
    expect(res.riskStatus).toBe('critical');
    expect(res.tasks[0]).toMatchObject({ key: 'R04:confirmed', priorityClass: 1, kind: 'critical' });
    // No and unknown keep the existing review behaviour.
    for (const v of ['no', 'unknown'] as const) {
      expect(r04(ctx({ taxRestrictionConfirmed: v }), { Q28: st('needs_adviser_review') })[0].severity).toBe('review');
      expect(r04(ctx({ taxRestrictionConfirmed: v }), { Q28: sub(100) })).toHaveLength(0);
    }
  });
});

describe('R06 funding', () => {
  const r06 = (c: AssessmentContext, a: AnswerMap = {}) => buildResult(c, a, T).risks.filter((x) => x.rule === 'R06');
  it('is critical for a confirmed funding gap without an agreed bridge', () => {
    const c = ctx({ fundingGapConfirmed: 'yes' });
    expect(r06(c, { Q08: sub(100) })).toEqual([expect.objectContaining({ severity: 'critical', basis: 'confirmed', questionIds: ['Q08'] })]);
    expect(buildResult(c, fill(c), T).tasks[0]).toMatchObject({ key: 'R06:confirmed', priorityClass: 1 });
  });
  it('an unknown funding gap is a review', () => {
    expect(r06(ctx({ fundingGapConfirmed: 'unknown' }))).toEqual([expect.objectContaining({ severity: 'review', basis: 'unresolved' })]);
  });
  it('keeps the existing review for no forecast under possible pressure', () => {
    expect(r06(ctx({ liquidity: 'potential', fundingGapConfirmed: 'no' }), { Q08: sub(0) })[0].severity).toBe('review');
    expect(r06(ctx({ liquidity: 'potential' }), { Q08: sub(0) })[0].severity).toBe('review');
    expect(r06(ctx({ fundingGapConfirmed: 'no' }), { Q08: sub(100) })).toHaveLength(0);
  });
});

describe('R07 cross-answer contradictions', () => {
  it('objectives not defined while agreed or compared: excluded from coverage until one answer changes', () => {
    const c = ctx();
    const a = fill(c);
    a.Q01 = sub(0);
    a.Q03 = sub(100);
    a.Q05 = sub(100);
    expect(contradictions(c, a)).toEqual([{ key: 'objectives', questionIds: ['Q01', 'Q03', 'Q05'], excludeFromCoverage: true }]);

    const s = computeScores(c, a);
    for (const id of ['Q01', 'Q03', 'Q05']) expect(s.controls[id]).toMatchObject({ known: false, status: 'conflicted', points: null });
    const strategic = s.dimensions.find((d) => d.key === 'S')!;
    const excluded = ['Q01', 'Q03', 'Q05'].reduce((t, id) => t + s.controls[id].effectiveWeight, 0);
    expect(strategic.coverage).toBeCloseTo(1 - excluded / 100, 9);
    expect(s.dataComplete).toBe(false);

    const r = buildResult(c, a, T);
    expect(r.risks.filter((x) => x.rule === 'R07')).toEqual([expect.objectContaining({ severity: 'review', questionIds: ['Q01', 'Q03', 'Q05'] })]);
    const task = r.tasks.find((t) => t.ruleId === 'R07')!;
    expect(task).toMatchObject({ key: 'R07:Q01,Q03,Q05', label: 'Reconfirm', kind: 'open' });
    expect(r.unresolved).toEqual(expect.arrayContaining(['Q01', 'Q03', 'Q05']));
    expect(r.strengths.map((x) => x.id)).not.toContain('Q03');
    expect(r.tasks.some((t) => t.key === 'Q:Q01' && t.kind === 'open')).toBe(true);

    // Changing one answer resolves it.
    const fixed = { ...a, Q01: sub(50) };
    expect(contradictions(c, fixed)).toEqual([]);
    expect(computeScores(c, fixed).controls.Q03.known).toBe(true);
  });
  it('only Q03 or only Q05 at 100 is enough; 50 is not a contradiction', () => {
    expect(contradictions(ctx(), { Q01: sub(0), Q05: sub(100) })[0].questionIds).toEqual(['Q01', 'Q05']);
    expect(contradictions(ctx(), { Q01: sub(0), Q03: sub(50), Q05: sub(50) })).toEqual([]);
    expect(contradictions(ctx(), { Q01: st('unknown'), Q03: sub(100) })).toEqual([]);
  });
  it('no known pressure with no usable forecast is flagged for clarification only', () => {
    const c = ctx();
    const a = { ...fill(c), Q08: sub(0) };
    expect(contradictions(c, a)).toEqual([{ key: 'liquidity_forecast', questionIds: ['Q08'], excludeFromCoverage: false }]);
    expect(computeScores(c, a).controls.Q08).toMatchObject({ known: true, points: 0 });
    expect(computeScores(c, a).dimensions.map((d) => d.coverage)).toEqual(computeScores(c, { ...a, Q08: sub(50) }).dimensions.map((d) => d.coverage));
    const r = buildResult(c, a, T);
    expect(r.risks.find((x) => x.rule === 'R07')).toMatchObject({ severity: 'review', questionIds: ['Q08'] });
    expect(r.tasks.find((t) => t.key === 'R07:Q08')).toBeDefined();
    expect(contradictions(ctx({ liquidity: 'potential' }), a)).toEqual([]);
  });
  it('no group dependency while essential group services lack a plan is flagged', () => {
    const c = ctx({ ownershipTags: ['corporate_group'], profile: 'CORPORATE', perimeter: 'business_unit_assets' });
    const a = { ...fill(c), Q46: sub(0) };
    expect(contradictions(c, a).map((x) => x.key)).toEqual(['group_services']);
    expect(computeScores(c, a).controls.Q46.known).toBe(true);
  });
  it('German output keeps the same contradiction rules and keys', () => {
    const c = ctx();
    const a = { ...fill(c), Q01: sub(0), Q03: sub(100) };
    const en = buildResult(c, a, T);
    const de = buildResult(c, a, T, 'de');
    expect(de.tasks.map((t) => t.key)).toEqual(en.tasks.map((t) => t.key));
    expect(de.risks.find((x) => x.rule === 'R07')!.title).not.toBe(en.risks.find((x) => x.rule === 'R07')!.title);
  });
});

describe('Q07 wording and exploration help', () => {
  const Q07 = QUESTION_BY_ID.Q07;
  it('uses the growth wording for a business investing in growth at a loss, or venture-backed', () => {
    const growth = Q07.variants!.growth!;
    expect(questionText(Q07, ctx({ economicsModel: 'growth' }))).toBe(growth);
    expect(questionText(Q07, ctx({ ownershipTags: ['vc'], profile: 'VC' }))).toBe(growth);
    expect(questionText(Q07, ctx({ economicsModel: 'profitable' }))).toBe(Q07.question);
    expect(questionText(Q07, ctx({ economicsModel: 'unknown' }))).toBe(Q07.question);
    expect(questionText(Q07, ctx())).toBe(Q07.question);
    expect(questionText(Q07, ctx({ economicsModel: 'growth' }), 'de')).toMatch(/Kohorten/);
  });
  it('explains on Q01 and Q05 that an explicit exploration can score 100', () => {
    const exploring = ctx({ objectives: ['exploration'] });
    for (const id of ['Q01', 'Q05']) {
      expect(questionHelp(QUESTION_BY_ID[id], exploring)).toMatch(/can score 100/);
      expect(questionHelp(QUESTION_BY_ID[id], exploring, 'de')).toMatch(/100 Punkte/);
      expect(questionHelp(QUESTION_BY_ID[id], ctx())).toBeUndefined();
    }
    // Controls with general help keep it.
    expect(questionHelp(QUESTION_BY_ID.Q28, exploring)).toBe(QUESTION_BY_ID.Q28.help);
  });
  it('distinguishes Q12, Q13 and Q15, and Q09 is about managing the exposure', () => {
    expect(QUESTION_BY_ID.Q12.help).toMatch(/decisions/);
    expect(QUESTION_BY_ID.Q13.help).toMatch(/specialist work/);
    expect(QUESTION_BY_ID.Q15.help).toMatch(/repeatable operating procedures/);
    expect(QUESTION_BY_ID.Q09.help).toMatch(/not about the size of its share/);
    for (const id of ['Q09', 'Q12', 'Q13', 'Q15']) {
      const de = questionHelp(QUESTION_BY_ID[id], ctx(), 'de')!;
      expect(de.length).toBeGreaterThan(0);
      expect(de).not.toBe(QUESTION_BY_ID[id].help);
    }
  });
  it('new help text follows the house style (no long dashes)', () => {
    for (const q of QUESTIONS) for (const t of [q.help, q.helpVariants?.exploration]) if (t) expect(t).not.toMatch(/[–—]/);
  });
});

describe('Q27 and Q28: separate company and seller tasks', () => {
  const c = ctx();
  const a = { ...fill(c), Q27: sub(0), Q28: sub(50), Q26: sub(50) };
  it('produce two tasks each with stable keys, same source control and work package', () => {
    const r = buildResult(c, a, T);
    const split = r.tasks.filter((t) => ['Q27', 'Q28'].includes(t.sourceQuestionIds[0]) && t.kind === 'gap');
    expect(split.map((t) => t.key).sort()).toEqual(['Q:Q27:company', 'Q:Q27:seller', 'Q:Q28:company', 'Q:Q28:seller']);
    const byKey = Object.fromEntries(split.map((t) => [t.key, t]));
    expect(byKey['Q:Q27:company']).toMatchObject({ accountableRole: 'Company tax adviser / CFO', sourceQuestionIds: ['Q27'], packageKey: 'tax_structure', workstream: 'tax' });
    expect(byKey['Q:Q27:seller']).toMatchObject({ accountableRole: 'Sellers’ tax advisers', sourceQuestionIds: ['Q27'], packageKey: 'tax_structure' });
    expect(byKey['Q:Q28:seller']).toMatchObject({ packageKey: 'tax_company', workstream: 'tax' });
    expect(byKey['Q:Q27:company'].impact).toBe(byKey['Q:Q27:seller'].impact);
    // Dependencies still order Q26 before Q27.
    const keys = r.tasks.map((t) => t.key);
    expect(keys.indexOf('Q:Q26')).toBeLessThan(keys.indexOf('Q:Q27:company'));
    expect(keys.filter((k) => k.startsWith('Q:Q27') || k.startsWith('Q:Q28'))).toHaveLength(4);
    // German keys are identical.
    expect(buildResult(c, a, T, 'de').tasks.map((t) => t.key)).toEqual(keys);
  });
  it('work packages count the control once', () => {
    const r = buildResult(c, a, T);
    const v = buildPlanView(r);
    const pkg = v.packages.find((p) => p.key === 'tax_structure')!;
    expect(pkg.tasks.map((t) => t.key)).toEqual(expect.arrayContaining(['Q:Q27:company', 'Q:Q27:seller']));
    const q27 = r.score.controls.Q27.effectiveWeight;
    const q26 = r.score.controls.Q26.effectiveWeight * 0.5;
    expect(pkg.impact).toBeCloseTo(q27 + q26, 9);
    for (const s of v.nextSteps) expect(new Set(s.questionIds).size).toBe(s.questionIds.length);
    expect(v.ordered.filter((x) => x.task.sourceQuestionIds[0] === 'Q27')).toHaveLength(2);
  });
  it('an open Q27 stays a single clarification', () => {
    const r = buildResult(c, { ...fill(c), Q27: st('needs_adviser_review') }, T);
    expect(r.tasks.filter((t) => t.sourceQuestionIds.includes('Q27')).map((t) => t.key)).toEqual(['Q:Q27']);
  });
});

describe('applicabilityChanges', () => {
  const routes = (over: Partial<AssessmentContext>) => resolveRoutes(ctx(over));
  it('lists answered questions that would leave scope and questions that would join', () => {
    const before = routes({ perimeter: 'business_unit_assets' });
    const after = routes({ perimeter: 'whole_business' });
    const answers: AnswerMap = { Q44: sub(50), Q46: st('unknown'), Q01: sub(100) };
    const ch = applicabilityChanges(before, after, answers);
    expect(ch.removedAnswered).toEqual(['Q44', 'Q46']);
    expect(ch.added).toEqual([]);
    const back = applicabilityChanges(after, before, answers);
    expect(back.removedAnswered).toEqual([]);
    expect(back.added).toEqual(expect.arrayContaining(['Q44', 'Q45', 'Q46', 'Q47', 'Q48', 'Q49', 'Q53']));
  });
  it('ignores answers that are already set aside, and pending routes stay in scope', () => {
    const before = routes(trig({ debt: 'yes' }));
    expect(applicabilityChanges(before, routes(trig({ debt: 'no' })), { Q24: { ...sub(50), inactiveSince: T } }).removedAnswered).toEqual([]);
    expect(applicabilityChanges(before, routes(trig({ debt: 'unknown' })), { Q24: sub(50) }).removedAnswered).toEqual([]);
    expect(applicabilityChanges(before, routes(trig({ debt: 'no' })), { Q24: sub(50) }).removedAnswered).toEqual(['Q24']);
  });
});

describe('supported strengths prefer stated strengths', () => {
  it('controls testing a stated E01 strength come first among the full anchors', () => {
    const c = ctx();
    const a = fill(c);
    const plain = buildResult(c, a, T).strengths.map((s) => s.id);
    const withDiag = buildResult(c, a, T, 'en', { E01: ['Customer loyalty', 'Experienced team'] }).strengths.map((s) => s.id);
    expect(withDiag.slice(0, 2).sort()).toEqual(['Q13', 'Q14']);
    expect(plain).not.toContain('Q14');
    // Without diagnostics the order is unchanged (by effective weight).
    const s = computeScores(c, a);
    expect(supportedStrengths(s).slice(0, 3).map((q) => q.id)).toEqual(plain);
    expect(buildResult(c, a, T, 'en', {}).strengths.map((x) => x.id)).toEqual(plain);
  });
  it('a stated strength that is not at the full anchor is not promoted', () => {
    const c = ctx();
    const a = { ...fill(c), Q14: sub(50) };
    expect(buildResult(c, a, T, 'en', { E01: ['Customer loyalty'] }).strengths.map((s) => s.id)).not.toContain('Q14');
  });
});
