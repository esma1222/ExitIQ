// Section 7: deterministic scoring, coverage and evidence.
//
// For a dimension: p_d = domain percentage, A_d = applicable controls (including
// unresolved answers and pending applicability), u_q = local weight.
//   e_q = p_d * u_q / sum(u_j, j in A_d)
// K = controls with substantive, non-conflicted answers.
//   C = sum(e_q, K) / 100
//   R = sum(e_q * a_q, K) / sum(e_q, K)       (null when K is empty)
//   L = sum(e_q * a_q, K) / 100,  U = L + sum(e_q, applicable outside K)
//   Evidence support = sum(e_q * v_q) / 100 over applicable controls.
// The language model never changes any of this.

import { DIMENSIONS, DOMAIN_NAMES, PROFILE_WEIGHTS } from './catalogue';
import { applicableQuestions, confirmedProfile, resolveRoutes, specialistReasons, suggestProfile } from './routing';
import type {
  Answer, AnswerMap, AnswerStatus, AssessmentContext, DimensionKey, DomainKey, Points, Profile, QuestionDef, RouteMap,
} from './types';

export const DISPLAY_COVERAGE_MIN = 0.8;
export const DOMAIN_LOCAL_COVERAGE_MIN = 0.5;
const EPS = 1e-9;

export type DimensionStatus =
  | 'complete'
  | 'indicative'               // 80-99% coverage: "Indicative, incomplete"
  | 'insufficient_coverage'
  | 'pending_profile'          // profile not confirmed: scoring withheld
  | 'specialist_route'         // IPO, distress or acute liquidity: no standard conclusion
  | 'model_exception';         // a whole domain has no applicable controls

export interface ControlResult {
  id: string;
  domain: DomainKey;
  effectiveWeight: number;
  status: AnswerStatus | 'unanswered' | 'reconfirm';
  points: Points | null;
  known: boolean;
  evidenceFactor: number;
  pendingApplicability: boolean;
}

export interface DomainResult {
  key: DomainKey;
  name: string;
  weight: number;               // p_d
  index: number | null;         // answered-only, 0-100
  localCoverage: number;        // share of local weight answered
  applicableCount: number;
  answeredCount: number;
  noApplicableControls: boolean;
}

export interface DimensionResult {
  key: DimensionKey;
  name: string;
  status: DimensionStatus;
  /** Answered-only index R, unrounded. Null when no substantive answer exists. */
  rawIndex: number | null;
  /** Rounded index, only when the display rules allow it. */
  displayIndex: number | null;
  coverage: number;             // C, 0-1
  lower: number;                // L, 0-100
  upper: number;                // U, 0-100
  evidenceSupport: number;      // 0-1
  openCount: number;
  pendingApplicability: boolean;
  domains: DomainResult[];
}

export interface ScoreResult {
  profile: Profile | null;      // confirmed profile, or null
  weightingProfile: Profile;    // profile used for weights (suggestion when unconfirmed, for previews only)
  routes: RouteMap;
  applicable: QuestionDef[];
  controls: Record<string, ControlResult>;
  dimensions: DimensionResult[];
  specialist: string[];
  dataComplete: boolean;
}

/** Answer usable for scoring: substantive, not conflicted, not awaiting reconfirmation. */
export function isKnown(a: Answer | undefined): a is Answer & { points: Points } {
  return !!a && a.status === 'substantive' && a.points != null && !a.requiresReconfirmation && !hasConflict(a);
}

/** Contributor submissions that disagree make a control CONFLICTED until an authorised resolution (R07). */
export function hasConflict(a: Answer | undefined): boolean {
  if (!a) return false;
  if (a.status === 'conflicted') return true;
  const subs = a.submissions ?? [];
  const byRespondent = new Map<string, string>();
  for (const s of subs) byRespondent.set(s.respondent, s.status === 'substantive' ? `p${s.points}` : s.status);
  return new Set(byRespondent.values()).size > 1;
}

export type ContradictionKey = 'objectives' | 'liquidity_forecast' | 'group_services';

export interface Contradiction {
  key: ContradictionKey;
  /** Controls whose answers need reconfirmation. */
  questionIds: string[];
  /** True when the affected answers leave known coverage until one of them changes (R07, treated like CONFLICTED). */
  excludeFromCoverage: boolean;
}

const pointsOf = (answers: AnswerMap, id: string): Points | null => {
  const a = answers[id];
  return isKnown(a) && !a.inactiveSince ? a.points : null;
};

/**
 * Section 8, R07: answers that contradict each other, detected
 * deterministically. Pure. Never picks the more optimistic answer.
 *  - objectives: Q01 = 0 (objectives not defined) while Q03 = 100 (agreed) or
 *    Q05 = 100 (options compared against them). Excluded from coverage until
 *    the user changes one of the answers.
 *  - liquidity_forecast: context "no known pressure" while Q08 = 0 (no usable
 *    forecast). Clarification only; coverage unchanged.
 *  - group_services: "no material dependence on a group that stays behind"
 *    while Q46 = 0 (essential group-provided services lack a continuity
 *    response). Clarification only; coverage unchanged.
 * "No convertibles" versus an answered Q51 cannot occur: Q51 is out of scope
 * when convertibles are answered "no", and its answer is then kept inactive.
 */
export function contradictions(ctx: AssessmentContext, answers: AnswerMap): Contradiction[] {
  const out: Contradiction[] = [];
  const p = (id: string) => pointsOf(answers, id);
  if (p('Q01') === 0) {
    const agreed = ['Q03', 'Q05'].filter((id) => p(id) === 100);
    if (agreed.length) out.push({ key: 'objectives', questionIds: ['Q01', ...agreed], excludeFromCoverage: true });
  }
  if (ctx.liquidity === 'no_pressure' && p('Q08') === 0) {
    out.push({ key: 'liquidity_forecast', questionIds: ['Q08'], excludeFromCoverage: false });
  }
  if (ctx.triggers.group_dependency === 'no' && p('Q46') === 0) {
    out.push({ key: 'group_services', questionIds: ['Q46'], excludeFromCoverage: false });
  }
  return out;
}

/** Controls excluded from known coverage by a contradiction (see `contradictions`). */
export function contradictedIds(ctx: AssessmentContext, answers: AnswerMap): Set<string> {
  return new Set(contradictions(ctx, answers).filter((c) => c.excludeFromCoverage).flatMap((c) => c.questionIds));
}

export function evidenceFactor(a: Answer | undefined): number {
  if (!isKnown(a) || !a.evidence) return 0;
  const ev = a.evidence;
  if (ev.reviewStatus === 'reviewed' && ev.reviewerId && ev.reviewedAt) return 1;
  // A dated reference with a named responsible role. A filename alone never counts.
  if ((ev.reviewStatus === 'dated_reference' || ev.reviewStatus === 'reviewed') && ev.ownerRole.trim() && ev.asOfDate && ev.reference.trim()) return 0.5;
  return 0;
}

function controlStatus(a: Answer | undefined): ControlResult['status'] {
  if (!a) return 'unanswered';
  if (hasConflict(a)) return 'conflicted';
  if (a.requiresReconfirmation) return 'reconfirm';
  return a.status;
}

export function computeScores(ctx: AssessmentContext, answers: AnswerMap): ScoreResult {
  const routes = resolveRoutes(ctx);
  const profile = confirmedProfile(ctx);
  const weightingProfile = profile ?? suggestProfile(ctx);
  const weights = PROFILE_WEIGHTS[weightingProfile];
  const specialist = specialistReasons(ctx);

  // Confirmed N/A removes local weight; requested N/A does not.
  const applicable = applicableQuestions(routes).filter((q) => answers[q.id]?.status !== 'not_applicable_confirmed');
  const controls: Record<string, ControlResult> = {};
  // R07: answers that contradict each other count like CONFLICTED answers.
  const contradicted = contradictedIds(ctx, answers);

  const dimensions: DimensionResult[] = DIMENSIONS.map((D) => {
    let knownWeight = 0;
    let weightedPoints = 0;
    let unknownWeight = 0;
    let evidence = 0;
    let openCount = 0;
    let domainsOk = true;
    let exception = false;
    let pending = false;

    const domains: DomainResult[] = D.domains.map((d) => {
      const A = applicable.filter((q) => q.domain === d);
      const sumU = A.reduce((t, q) => t + q.localWeight, 0);
      const p = weights[d];
      let kU = 0;
      let kPts = 0;
      let answered = 0;
      if (A.length === 0) exception = true;
      for (const q of A) {
        const a = answers[q.id];
        const e = (p * q.localWeight) / sumU;
        const known = isKnown(a) && !contradicted.has(q.id);
        const isPending = routes[q.route] === 'pending';
        if (isPending) pending = true;
        const v = known ? evidenceFactor(a) : 0;
        controls[q.id] = {
          id: q.id, domain: d, effectiveWeight: e, status: contradicted.has(q.id) && isKnown(a) ? 'conflicted' : controlStatus(a),
          points: known ? a.points : null, known, evidenceFactor: v, pendingApplicability: isPending,
        };
        evidence += e * v;
        if (known) {
          knownWeight += e;
          weightedPoints += e * a.points;
          kU += q.localWeight;
          kPts += q.localWeight * a.points;
          answered++;
        } else {
          unknownWeight += e;
          openCount++;
        }
      }
      const localCoverage = sumU ? kU / sumU : 0;
      if (localCoverage + EPS < DOMAIN_LOCAL_COVERAGE_MIN) domainsOk = false;
      return {
        key: d, name: DOMAIN_NAMES[d], weight: p, index: kU ? kPts / kU : null, localCoverage,
        applicableCount: A.length, answeredCount: answered, noApplicableControls: A.length === 0,
      };
    });

    const coverage = knownWeight / 100;
    const rawIndex = knownWeight > EPS ? weightedPoints / knownWeight : null;
    const lower = weightedPoints / 100;
    const upper = lower + unknownWeight;

    let status: DimensionStatus;
    if (specialist.length) status = 'specialist_route';
    else if (exception) status = 'model_exception';
    else if (!profile) status = 'pending_profile';
    else if (coverage + EPS >= DISPLAY_COVERAGE_MIN && domainsOk && rawIndex != null) {
      status = coverage >= 1 - EPS && !pending ? 'complete' : 'indicative';
    } else status = 'insufficient_coverage';

    const showIndex = status === 'complete' || status === 'indicative';
    return {
      key: D.key, name: D.name, status, rawIndex,
      displayIndex: showIndex && rawIndex != null ? Math.round(rawIndex) : null,
      coverage, lower, upper, evidenceSupport: evidence / 100, openCount, pendingApplicability: pending, domains,
    };
  });

  const dataComplete =
    !!profile &&
    specialist.length === 0 &&
    applicable.every((q) => controls[q.id]?.known && routes[q.route] !== 'pending');

  return { profile, weightingProfile, routes, applicable, controls, dimensions, specialist, dataComplete };
}

/** Effective weight of a control under the current configuration (0 when not applicable). */
export function effectiveWeight(score: ScoreResult, id: string): number {
  return score.controls[id]?.effectiveWeight ?? 0;
}
