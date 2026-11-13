// Regression tests requested by the MVP test report (12 November 2026),
// section "Regression tests the development team should automate".
import { describe, expect, it } from 'vitest';
import { QUESTIONS } from './catalogue';
import { buildResult } from './plan';
import { applicableQuestions, reconcileApplicability, resolveRoutes } from './routing';
import { DISPLAY_COVERAGE_MIN, DOMAIN_LOCAL_COVERAGE_MIN, computeScores, evidenceFactor } from './scoring';
import type { Answer, AnswerMap, AnswerStatus, AssessmentContext, Points, Profile } from './types';

const T = '2026-11-13T10:00:00.000Z';
const PROFILES: Profile[] = ['OWNER', 'CORPORATE', 'PE', 'VC'];

function ctx(profile: Profile, over: Partial<AssessmentContext> = {}): AssessmentContext {
  return {
    role: 'owner', ownershipTags: ['private_family'], managementModel: 'owner_led', profile,
    objectives: ['full_sale'], perimeter: 'whole_business', horizon: 'm6_18', liquidity: 'no_pressure',
    triggers: { debt: 'no', acquisitions: 'no', employee_equity: 'no', preferences: 'no', convertibles: 'no', regulated: 'no', contingent: 'no', group_dependency: 'no' },
    sellerType: 'individuals', sellerTaxStatus: 'same',
    company: { businessModel: null, sector: null, revenueBand: null, employeeBand: null, jurisdiction: null },
    ...over,
  };
}
const sub = (points: Points): Answer => ({ status: 'substantive', points, answeredAt: T });
const st = (status: AnswerStatus): Answer => ({ status, answeredAt: T });
const fill = (c: AssessmentContext, f: (id: string, i: number) => Answer): AnswerMap =>
  Object.fromEntries(applicableQuestions(resolveRoutes(c)).map((q, i) => [q.id, f(q.id, i)]));

/** Small deterministic PRNG so the property test is reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('fixtures per confirmed weighting profile', () => {
  for (const p of PROFILES) {
    const c = ctx(p);
    it(`${p}: all positive gives 100 with full coverage and no evidence credit`, () => {
      const s = computeScores(c, fill(c, () => sub(100)));
      for (const d of s.dimensions) {
        expect(d.displayIndex).toBe(100);
        expect(d.coverage).toBeCloseTo(1, 9);
        expect(d.evidenceSupport).toBe(0);
        expect(d.status).toBe('complete');
      }
    });
    it(`${p}: all negative gives 0 with full coverage`, () => {
      const s = computeScores(c, fill(c, () => sub(0)));
      for (const d of s.dimensions) {
        expect(d.displayIndex).toBe(0);
        expect(d.coverage).toBeCloseTo(1, 9);
      }
    });
    it(`${p}: all unknown gives no index, 0 coverage and the full 0-100 range`, () => {
      const s = computeScores(c, fill(c, () => st('unknown')));
      for (const d of s.dimensions) {
        expect(d.displayIndex).toBeNull();
        expect(d.rawIndex).toBeNull();
        expect(d.coverage).toBe(0);
        expect(d.lower).toBe(0);
        expect(d.upper).toBeCloseTo(100, 9);
      }
    });
  }
});

describe('display thresholds on both sides of 80% overall and 50% per domain', () => {
  const statuses: (Points | AnswerStatus)[] = [100, 50, 0, 'unknown', 'needs_internal_confirmation', 'needs_adviser_review', 'withheld', 'not_applicable_requested'];
  for (const p of PROFILES) {
    it(`${p}: an index is shown exactly when coverage >= 80% and every domain is at least half answered`, () => {
      const c = ctx(p);
      const r = rng(p.length * 7919);
      let below = 0;
      let above = 0;
      for (let run = 0; run < 400; run++) {
        const openShare = r() * 0.5; // 0-50% of controls left open
        const answers = fill(c, () => {
          if (r() < openShare) return st(statuses[3 + Math.floor(r() * 5)] as AnswerStatus);
          return sub(statuses[Math.floor(r() * 3)] as Points);
        });
        for (const d of computeScores(c, answers).dimensions) {
          const domainsOk = d.domains.every((m) => m.localCoverage + 1e-9 >= DOMAIN_LOCAL_COVERAGE_MIN);
          const shouldShow = d.coverage + 1e-9 >= DISPLAY_COVERAGE_MIN && domainsOk;
          expect(d.displayIndex != null).toBe(shouldShow);
          if (d.coverage < DISPLAY_COVERAGE_MIN) below++;
          else above++;
        }
      }
      // The random runs really exercise both sides of the threshold.
      expect(below).toBeGreaterThan(20);
      expect(above).toBeGreaterThan(20);
    });
  }
});

describe('unresolved statuses stay distinct and never improve the result', () => {
  const c = ctx('OWNER');
  const base = fill(c, () => sub(100));
  for (const status of ['unknown', 'withheld', 'needs_internal_confirmation', 'needs_adviser_review', 'not_applicable_requested'] as AnswerStatus[]) {
    it(`${status} on Q07 removes coverage but no weight`, () => {
      const s = computeScores(c, { ...base, Q07: st(status) });
      expect(s.controls.Q07.status).toBe(status);
      expect(s.controls.Q07.known).toBe(false);
      const o = s.dimensions.find((d) => d.key === 'O')!;
      expect(o.coverage).toBeLessThan(1);
      expect(s.applicable.some((q) => q.id === 'Q07')).toBe(true); // a pending exclusion keeps its weight
    });
  }
  it('a requested exclusion never scores better than answering it with 0', () => {
    const asZero = computeScores(c, { ...base, Q07: sub(0) }).dimensions.find((d) => d.key === 'O')!;
    const requested = computeScores(c, { ...base, Q07: st('not_applicable_requested') }).dimensions.find((d) => d.key === 'O')!;
    expect(requested.coverage).toBeLessThan(asZero.coverage);
    expect(requested.displayIndex === null || requested.status !== 'complete').toBe(true);
  });
});

describe('mixed ownership and module history', () => {
  it('PE and founder tags: one confirmed profile drives weights, modules activate once', () => {
    const c = ctx('PE', { ownershipTags: ['private_family', 'pe'], managementModel: 'owner_led', triggers: { ...ctx('PE').triggers, debt: 'yes', employee_equity: 'yes' } });
    const s = computeScores(c, {});
    expect(s.weightingProfile).toBe('PE');
    const ids = s.applicable.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['Q12', 'Q24', 'Q38', 'Q39', 'Q50']) expect(ids).toContain(id);
  });
  it('removing and restoring a module keeps the answer and asks for reconfirmation', () => {
    const on = ctx('OWNER', { triggers: { ...ctx('OWNER').triggers, debt: 'yes' } });
    const off = ctx('OWNER');
    const answers: AnswerMap = { Q24: sub(50) };
    const removed = reconcileApplicability(answers, resolveRoutes(on), resolveRoutes(off), T);
    expect(removed.deactivated).toEqual(['Q24']);
    expect(removed.answers.Q24.inactiveSince).toBeTruthy();
    expect(removed.answers.Q24.points).toBe(50); // kept, not deleted
    const restored = reconcileApplicability(removed.answers, resolveRoutes(off), resolveRoutes(on), T);
    expect(restored.reactivated).toEqual(['Q24']);
    expect(restored.answers.Q24.points).toBe(50);
    expect(restored.answers.Q24.requiresReconfirmation).toBe(true);
    expect(computeScores(on, restored.answers).controls.Q24.known).toBe(false); // must be reconfirmed first
  });
});

describe('critical prerequisites and task status', () => {
  it('a critical risk stays visible however strong the scores are, and task status cannot clear it', () => {
    const c = ctx('OWNER', { horizon: 'under_6' });
    const answers = { ...fill(c, () => sub(100)), Q32: sub(0) };
    const r = buildResult(c, answers, T);
    expect(r.risks.some((k) => k.rule === 'R03' && k.severity === 'critical')).toBe(true);
    // Task status lives outside the model: the same answers always give the same risk.
    expect(buildResult(c, answers, T).risks).toEqual(r.risks);
  });
});

describe('evidence rules', () => {
  const ref = { reference: 'Board minutes March 2026, data room 4.2', ownerRole: 'CFO', asOfDate: '2026-03-31', reviewStatus: 'dated_reference' as const };
  it('needs reference, owner and date for half credit', () => {
    expect(evidenceFactor({ ...sub(100), evidence: ref })).toBe(0.5);
    expect(evidenceFactor({ ...sub(100), evidence: { ...ref, reference: ' ' } })).toBe(0);
    expect(evidenceFactor({ ...sub(100), evidence: { ...ref, ownerRole: '' } })).toBe(0);
    expect(evidenceFactor({ ...sub(100), evidence: { ...ref, asOfDate: null } })).toBe(0);
  });
  it('full credit only through the authorised review path', () => {
    expect(evidenceFactor({ ...sub(100), evidence: { ...ref, reviewStatus: 'reviewed' } })).toBe(0.5);
    expect(evidenceFactor({ ...sub(100), evidence: { ...ref, reviewStatus: 'reviewed', reviewerId: 'r1', reviewedAt: T } })).toBe(1);
  });
  it('documentary support never changes the readiness answer', () => {
    const c = ctx('OWNER');
    const plain = fill(c, () => sub(50));
    const withEv = Object.fromEntries(Object.entries(plain).map(([k, a]) => [k, { ...a, evidence: ref }]));
    const a = computeScores(c, plain).dimensions;
    const b = computeScores(c, withEv).dimensions;
    a.forEach((d, i) => {
      expect(b[i].rawIndex).toBe(d.rawIndex);
      expect(b[i].coverage).toBe(d.coverage);
      expect(b[i].evidenceSupport).toBeGreaterThan(d.evidenceSupport);
    });
  });
});

describe('EN and DE equivalence', () => {
  it('both languages give the same scores, tasks and order for incomplete and complete cases', () => {
    const c = ctx('CORPORATE', { ownershipTags: ['corporate_group'], perimeter: 'business_unit_assets', triggers: { ...ctx('OWNER').triggers, group_dependency: 'yes' } });
    for (const answers of [{}, fill(c, (_, i) => (i % 4 === 3 ? st('unknown') : sub(([0, 50, 100] as Points[])[i % 3])))]) {
      const en = buildResult(c, answers, T, 'en');
      const de = buildResult(c, answers, T, 'de');
      expect(de.dimensions).toEqual(en.dimensions);
      expect(de.tasks.map((t) => [t.key, t.priorityClass, t.kind])).toEqual(en.tasks.map((t) => [t.key, t.priorityClass, t.kind]));
      expect(de.risks.map((r) => r.rule)).toEqual(en.risks.map((r) => r.rule));
    }
  });
  it('every registered control is reachable in some route combination', () => {
    const all = ctx('VC', {
      ownershipTags: ['vc', 'pe', 'corporate_group'], perimeter: 'business_unit_assets', objectives: ['partial_sale', 'growth_capital'],
      sellerTaxStatus: 'different',
      triggers: { debt: 'yes', acquisitions: 'yes', employee_equity: 'yes', preferences: 'yes', convertibles: 'yes', regulated: 'yes', contingent: 'yes', group_dependency: 'yes' },
    });
    expect(applicableQuestions(resolveRoutes(all)).map((q) => q.id).sort()).toEqual(QUESTIONS.map((q) => q.id).sort());
  });
});
