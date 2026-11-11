// Language is presentation only: German output must carry exactly the same
// scores, rules, task keys, order and classes as English, with no empty text.
import { describe, expect, it } from 'vitest';
import { QUESTIONS } from './catalogue';
import { buildResult, initialObservations } from './plan';
import { applicableQuestions, questionText, resolveRoutes } from './routing';
import type { Answer, AnswerMap, AssessmentContext, Diagnostics, Points } from './types';

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

const UNRESOLVED: Answer['status'][] = ['unknown', 'needs_internal_confirmation', 'needs_adviser_review', 'withheld', 'not_applicable_requested'];

/** Deterministic mix of 0/50/100, unresolved statuses and gaps. */
function mixed(c: AssessmentContext, seed: number): AnswerMap {
  const out: AnswerMap = {};
  applicableQuestions(resolveRoutes(c)).forEach((q, i) => {
    const k = (i * 7 + seed * 3) % 9;
    if (k < 3) out[q.id] = { status: 'substantive', points: (k * 50) as Points, answeredAt: T };
    else if (k < 8) out[q.id] = { status: UNRESOLVED[k - 3], answeredAt: T };
  });
  return out;
}

const CASES: { name: string; c: AssessmentContext; answers: (c: AssessmentContext) => AnswerMap }[] = [
  { name: 'owner, all unanswered', c: ctx(), answers: () => ({}) },
  { name: 'owner, mixed answers', c: ctx(), answers: (c) => mixed(c, 1) },
  { name: 'acute liquidity, launch under six months', c: ctx({ liquidity: 'acute', horizon: 'under_6' }),
    answers: (c) => ({ ...mixed(c, 2), Q04: { status: 'substantive', points: 0, answeredAt: T }, Q32: { status: 'substantive', points: 0, answeredAt: T }, Q28: { status: 'needs_adviser_review', answeredAt: T } }) },
  { name: 'VC growth round with open routes', c: ctx({ ownershipTags: ['vc'], profile: 'VC', managementModel: 'employed', objectives: ['growth_capital'], perimeter: 'undecided', sellerTaxStatus: 'unknown', liquidity: 'unknown', triggers: { ...ctx().triggers, debt: 'unknown', convertibles: 'yes' } }),
    answers: (c) => ({ ...mixed(c, 3), Q08: { status: 'substantive', points: 0, answeredAt: T } }) },
  { name: 'corporate carve-out, all answered', c: ctx({ ownershipTags: ['corporate_group'], profile: 'CORPORATE', perimeter: 'business_unit_assets', horizon: 'over_36' }),
    answers: (c) => ({ ...Object.fromEntries(applicableQuestions(resolveRoutes(c)).map((q, i) => [q.id, { status: 'substantive', points: ((i % 3) * 50) as Points, answeredAt: T } as Answer])), Q46: { status: 'substantive', points: 0, answeredAt: T } }) },
  { name: 'perspective undecided', c: ctx({ profile: 'UNDECIDED', horizon: 'undecided' }), answers: (c) => mixed(c, 4) },
];

const DIAGS: Diagnostics[] = [
  {},
  { E01: ['Recurring revenue', 'Specialist know-how'], E04: 'Over 30%' },
  { E01: ['Customer loyalty'] },
];

describe('German output is language-only', () => {
  for (const { name, c, answers } of CASES) {
    it(`${name}: same scores, rules, tasks and questions as English`, () => {
      const a = answers(c);
      const en = buildResult(c, a, T);
      const de = buildResult(c, a, T, 'de');

      expect(de.score.dimensions.map((d) => [d.key, d.status, d.rawIndex, d.displayIndex, d.lower, d.upper, d.coverage, d.evidenceSupport]))
        .toEqual(en.score.dimensions.map((d) => [d.key, d.status, d.rawIndex, d.displayIndex, d.lower, d.upper, d.coverage, d.evidenceSupport]));
      expect(de.effectiveWeights).toEqual(en.effectiveWeights);
      expect([de.profile, de.dataStatus, de.riskStatus, de.specialist, de.activeModules, de.pendingModules, de.unresolved])
        .toEqual([en.profile, en.dataStatus, en.riskStatus, en.specialist, en.activeModules, en.pendingModules, en.unresolved]);

      expect(de.risks.map((r) => [r.rule, r.severity, r.basis, r.questionIds])).toEqual(en.risks.map((r) => [r.rule, r.severity, r.basis, r.questionIds]));
      expect(de.tasks.map((t) => [t.key, t.priorityClass, t.kind, t.timingRank, t.impact, t.ruleId, t.sourceQuestionIds, t.dependencies]))
        .toEqual(en.tasks.map((t) => [t.key, t.priorityClass, t.kind, t.timingRank, t.impact, t.ruleId, t.sourceQuestionIds, t.dependencies]));
      expect(de.strengths.map((s) => s.id)).toEqual(en.strengths.map((s) => s.id));
      expect(de.tax.map((r) => [r.id, r.scope, r.status])).toEqual(en.tax.map((r) => [r.id, r.scope, r.status]));
      for (const d of DIAGS) {
        expect(initialObservations(c, a, d, 'de').map((o) => [o.tone, o.answerIds])).toEqual(initialObservations(c, a, d).map((o) => [o.tone, o.answerIds]));
      }
    });
  }

  it('German text differs from English (the overlay is applied)', () => {
    const c = ctx({ liquidity: 'unknown' });
    const a = mixed(c, 1);
    const en = buildResult(c, a, T);
    const de = buildResult(c, a, T, 'de');
    expect(de.risks[0].title).not.toBe(en.risks[0].title);
    expect(de.tasks.map((t) => t.suggestedTiming)).not.toEqual(en.tasks.map((t) => t.suggestedTiming));
  });

  it('questionText returns German wording for every question and context variant', () => {
    for (const c of [ctx(), ctx({ managementModel: 'employed' }), ctx({ ownershipTags: ['vc'], profile: 'VC' })]) {
      for (const q of QUESTIONS) {
        const de = questionText(q, c, 'de');
        expect(de.trim().length).toBeGreaterThan(0);
        expect(de).not.toBe(questionText(q, c));
      }
    }
  });
});

describe('German text is never empty', () => {
  for (const { name, c, answers } of CASES) {
    it(name, () => {
      const a = answers(c);
      const de = buildResult(c, a, T, 'de');
      const filled = (s: string | null | undefined) => typeof s === 'string' && s.trim().length > 0;
      for (const r of de.risks) expect(filled(r.title) && filled(r.text), `${r.rule}`).toBe(true);
      for (const t of de.tasks) {
        for (const f of [t.label, t.title, t.reason, t.action, t.accountableRole, t.suggestedTiming] as const) expect(filled(f), `${t.key}`).toBe(true);
        if (t.dimension !== null) expect(filled(t.dimension)).toBe(true);
        if (t.domain !== null) expect(filled(t.domain)).toBe(true);
        if (t.evidenceRequired !== null) expect(filled(t.evidenceRequired)).toBe(true);
      }
      for (const s of de.strengths) expect(filled(s.name) && filled(s.text)).toBe(true);
      for (const x of de.tax) expect(filled(x.name)).toBe(true);
      for (const d of DIAGS) for (const o of initialObservations(c, a, d, 'de')) expect(filled(o.tag) && filled(o.text)).toBe(true);
    });
  }
});
