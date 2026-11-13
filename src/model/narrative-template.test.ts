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

    it(`${lang}: leads with the decision and keeps figures in the cards`, () => {
      // Changed with the decision-first synthesis: the summary no longer restates every index and coverage figure.
      expect(n.summary[0].kind).toBe('implication');
      for (const d of r.dimensions) if (d.displayIndex != null) expect(n.summary.map((p) => p.text).join(' ')).not.toContain(`index of ${d.displayIndex}`);
      expect(n.summary.some((p) => p.kind === 'next_step')).toBe(true);
    });

    it(`${lang}: cites only applicable questions and uses no forbidden wording`, () => {
      const ids = new Set(r.score.applicable.map((q) => q.id));
      for (const p of all) {
        p.question_ids.forEach((id) => expect(ids.has(id) || /^E0\d$/.test(id)).toBe(true));
        expect(p.text).not.toMatch(FORBIDDEN);
      }
    });

    it(`${lang}: names the critical prerequisite and the first priority actions`, () => {
      expect(r.risks.some((k) => k.severity === 'critical')).toBe(true);
      expect(n.summary.some((p) => p.kind === 'implication' && p.question_ids.includes('Q04'))).toBe(true);
      // The first priority is the first recommended next step: the critical prerequisite.
      expect(n.priorities[0].text).toContain(r.tasks[0].title);
      expect(n.priorities.filter((p) => p.kind === 'next_step').length).toBeLessThanOrEqual(3);
    });
  }

  it('is deterministic', () => {
    const r = buildResult(ctx, answers, T, 'en');
    expect(templateNarrative(r, 'en')).toEqual(templateNarrative(r, 'en'));
  });

  it('fully positive case: no invented weakness', () => {
    const c = { ...ctx, triggers: { ...ctx.triggers, employee_equity: 'no' as const } };
    const a = Object.fromEntries(applicableQuestions(resolveRoutes(c)).map((q) => [q.id, sub(100)]));
    const r = buildResult(c, a, T, 'en');
    expect(r.risks).toHaveLength(0);
    const n = templateNarrative(r, 'en', { E04: 'Over 30%', E07: 'Working capital' });
    expect(n.summary[0].text).toBe('No preparation gaps identified from your answers. Next, validate the highest-impact claims and refresh the evidence before launch.');
    expect(n.priorities[0].text).toBe(n.summary[0].text);
    expect(n.summary.map((p) => p.text).join(' ')).not.toMatch(/gap(s)? (in|on)|weakness/i);
    // The concentration is still connected to the customer exposure answer.
    expect(n.summary.some((p) => p.question_ids.includes('E04') && p.question_ids.includes('Q09'))).toBe(true);
    const de = templateNarrative(buildResult(c, a, T, 'de'), 'de', {});
    expect(de.summary[0].text).toBe('Aus Ihren Antworten ergeben sich keine Vorbereitungslücken. Prüfen Sie als Nächstes die wichtigsten Aussagen und aktualisieren Sie die Nachweise vor dem Start.');
  });

  it('connects concentration with the customer exposure answer when Q09 is open', () => {
    const r = buildResult(ctx, { ...answers, Q09: sub(50) }, T, 'en');
    const n = templateNarrative(r, 'en', { E04: 'Over 30%' });
    const p = n.summary.find((x) => x.question_ids.includes('E04'));
    expect(p?.text).toContain('Q09');
    expect(p?.text).toContain('partly in place');
  });

  it('says "reported", not "supported", when no evidence is recorded', () => {
    const r = buildResult(ctx, answers, T, 'en');
    const n = templateNarrative(r, 'en', { E01: ['Recurring revenue'] });
    expect(n.strengths[0].question_ids).toEqual(['E01']);
    const prep = n.strengths.find((p) => p.question_ids.some((id) => id.startsWith('Q')))!;
    expect(prep.text).toContain('reported by you');
    expect(prep.text).not.toMatch(/\bsupported\b/);
  });
});
