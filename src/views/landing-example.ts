// The illustrative report on the landing page, calculated with the live model.
//
// Test report R07: the example figures must reconcile with the formula used in
// real reports. Instead of hard-coded numbers, the landing page runs this
// synthetic owner-led assessment through computeScores and evaluateRisks, so
// index, coverage, missing-answer range, evidence support and the risk shown
// next to each dimension always come from the same calculation path.

import { evaluateRisks, type Risk } from '../model/plan';
import { computeScores, type DimensionResult } from '../model/scoring';
import type { Answer, AnswerMap, AssessmentContext, Points } from '../model/types';

const T = '2026-11-01T09:00:00.000Z';

export const EXAMPLE_CONTEXT: AssessmentContext = {
  role: 'owner', ownershipTags: ['private_family'], managementModel: 'owner_led', profile: 'OWNER',
  objectives: ['full_sale'], perimeter: 'whole_business', horizon: 'under_6', liquidity: 'potential',
  triggers: { debt: 'no', acquisitions: 'no', employee_equity: 'no', preferences: 'no', convertibles: 'no', regulated: 'no', contingent: 'no', group_dependency: 'no' },
  sellerType: 'individuals', sellerTaxStatus: 'same',
  company: { businessModel: null, sector: null, revenueBand: null, employeeBand: null, jurisdiction: null },
};

const sub = (points: Points, evidence = false): Answer => ({
  status: 'substantive', points, answeredAt: T,
  ...(evidence ? { evidence: { reference: 'Example document, data room 1.2', ownerRole: 'CFO', asOfDate: '2026-10-01', reviewStatus: 'dated_reference' as const } } : {}),
});
const open = (status: Answer['status']): Answer => ({ status, answeredAt: T });

export const EXAMPLE_ANSWERS: AnswerMap = {
  // Strategic clarity: one open answer in S1, approvals not mapped (R02 with a launch within six months).
  Q01: sub(100, true), Q02: open('unknown'), Q03: sub(50), Q04: sub(0), Q05: sub(50), Q06: sub(100, true),
  // Operational transferability: every applicable question answered.
  Q07: sub(100, true), Q08: sub(100), Q09: sub(50), Q10: sub(100, true), Q11: sub(100), Q12: sub(50, true), Q13: sub(100),
  Q14: sub(50), Q15: sub(100), Q16: sub(50), Q17: sub(100, true), Q19: sub(100), Q20: sub(50),
  // Transaction preparation: too few answers for an index; past reorganisations need adviser review (R04).
  Q21: sub(100, true), Q22: sub(50), Q25: sub(50), Q28: open('needs_adviser_review'), Q32: sub(100), Q33: sub(50),
};

export interface ExampleDimension {
  result: DimensionResult;
  risk: Risk | null;
}

/** One entry per dimension (S, O, T): the computed result and the risk shown beside it. */
export function exampleReport(): ExampleDimension[] {
  const score = computeScores(EXAMPLE_CONTEXT, EXAMPLE_ANSWERS);
  const risks = evaluateRisks(EXAMPLE_CONTEXT, EXAMPLE_ANSWERS, score);
  const pick: Record<string, Risk['rule']> = { S: 'R02', O: 'LIQ', T: 'R04' };
  return score.dimensions.map((d) => ({ result: d, risk: risks.find((r) => r.rule === pick[d.key]) ?? null }));
}
