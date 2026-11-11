import { describe, expect, it } from 'vitest';
import { templateNarrative } from './narrative-template';
import { buildResult } from './plan';
import { applicableQuestions, resolveRoutes } from './routing';
import type { Answer, AnswerMap, AssessmentContext, Points } from './types';

const T = '2026-11-10T10:00:00.000Z';
const ctx: AssessmentContext = {
  role: 'owner', ownershipTags: ['private_family'], managementModel: 'owner_led', profile: 'OWNER',
  objectives: ['full_sale'], perimeter: 'whole_business', horizon: 'under_6', liquidity: 'no_pressure',
  triggers: { debt: 'yes', acquisitions: 'no', employee_equity: 'unknown', preferences: 'no', convertibles: 'no', regulated: 'no', contingent: 'no', group_dependency: 'no' },
  sellerType: 'individuals', sellerTaxStatus: 'same',
  company: { businessModel: null, sector: null, revenueBand: null, employeeBand: null, jurisdiction: null },
};
const sub = (points: Points): Answer => ({ status: 'substantive', points, answeredAt: T });
const pattern: (Points | 'unknown')[] = [100, 50, 100, 50, 0, 100, 50, 'unknown'];
const answers: AnswerMap = Object.fromEntries(applicableQuestions(resolveRoutes(ctx)).map((q, i) => {
  const p = pattern[i % pattern.length];
  return [q.id, p === 'unknown' ? { status: 'unknown', answeredAt: T } : sub(p)];
}));
answers.Q04 = sub(0);

const FORBIDDEN = /valuation|multiple of|probabilit|tax saving|verified|unternehmensbewertung|wahrscheinlichkeit|steuerersparnis|verifiziert|gesamtscore|overall score|€|\$/i;

describe('rules-based written summary', () => {
  for (const lang of ['en', 'de'] as const) {
    const r = buildResult(ctx, answers, T, lang);
    const n = templateNarrative(r, lang);
    const all = [...n.summary, ...n.strengths, ...n.priorities, ...n.tax];

    it(`${lang}: every section has complete, non-empty paragraphs`, () => {
      for (const sec of [n.summary, n.strengths, n.priorities, n.tax]) expect(sec.length).toBeGreaterThan(0);
      for (const p of all) {
        expect(p.text.trim().length).toBeGreaterThan(10);
        expect(p.text.trim()).toMatch(/[.!?]$/);
        expect(p.text).not.toMatch(/undefined|null|NaN/);
      }
    });

    it(`${lang}: quotes exactly the indices and coverage on the page`, () => {
      r.dimensions.forEach((d, i) => {
        const text = n.summary[i].text;
        expect(text).toContain(`${Math.round(d.coverage * 100)}%`);
        if (d.displayIndex != null) expect(text).toContain(String(d.displayIndex));
      });
    });

    it(`${lang}: cites only applicable questions and uses no forbidden wording`, () => {
      const ids = new Set(r.score.applicable.map((q) => q.id));
      for (const p of all) {
        p.question_ids.forEach((id) => expect(ids.has(id)).toBe(true));
        expect(p.text).not.toMatch(FORBIDDEN);
      }
    });

    it(`${lang}: names the critical prerequisite and the first priority actions`, () => {
      expect(r.risks.some((k) => k.severity === 'critical')).toBe(true);
      expect(n.summary.some((p) => p.kind === 'implication' && p.question_ids.includes('Q04'))).toBe(true);
      expect(n.priorities[0].text).toContain(r.tasks[0].title);
    });
  }

  it('is deterministic', () => {
    const r = buildResult(ctx, answers, T, 'en');
    expect(templateNarrative(r, 'en')).toEqual(templateNarrative(r, 'en'));
  });
});
