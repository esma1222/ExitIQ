// Pure journey rules for the assessment: screen order, legacy screen names,
// navigation through unresolved controls, progress counts and the stepper.
// No React and no storage here, so every rule is unit-tested.

import { CHAPTERS } from '../model/catalogue';
import { applicableQuestions, resolveRoutes } from '../model/routing';
import { hasConflict, isKnown } from '../model/scoring';
import { TRIGGER_OPTIONS } from '../model/options';
import type { Answer, AnswerMap, AssessmentContext, Diagnostics, QuestionDef } from '../model/types';

/**
 * Screen order: context → discovery → picture → setup → specialist → summary → deep → result.
 * `saved` is the pause screen.
 */
export type Screen = 'context' | 'discovery' | 'picture' | 'setup' | 'specialist' | 'summary' | 'deep' | 'result' | 'saved';
/** Screen names used before the journey was reordered (Nov 2026). Still accepted by go() and on load. */
export type LegacyScreen = 'c1' | 'c2' | 'c3';
export type AnyScreen = Screen | LegacyScreen;

export const SCREENS: Screen[] = ['context', 'discovery', 'picture', 'setup', 'specialist', 'summary', 'deep', 'result', 'saved'];

/** Stepper: Context, Discovery, Initial picture, Assessment (setup + summary + deep), Action plan. */
export const STEP_OF: Record<Screen, number> = {
  context: 0, discovery: 1, picture: 2, setup: 3, specialist: 3, summary: 3, deep: 3, result: 4, saved: -1,
};

/** go('c3') from older code (e.g. "clarify in the setup") means the specialist topics; c1 the context; c2 the setup. */
export function normalizeScreen(s: AnyScreen | string | null | undefined): Screen {
  if (s === 'c1') return 'context';
  if (s === 'c2') return 'setup';
  if (s === 'c3') return 'specialist';
  return SCREENS.includes(s as Screen) ? (s as Screen) : 'context';
}

// ── completeness of the context and setup screens ────────────────────────────

export function contextComplete(ctx: AssessmentContext): boolean {
  return ctx.ownershipTags.length > 0 && !!ctx.managementModel && ctx.objectives.length > 0 && !!ctx.liquidity;
}

export function setupComplete(ctx: AssessmentContext): boolean {
  return !!ctx.role && !!ctx.perimeter && !!ctx.horizon && !!ctx.profile;
}

export function specialistComplete(ctx: AssessmentContext): boolean {
  return TRIGGER_OPTIONS.every((t) => !!ctx.triggers[t.value]) && !!ctx.sellerType && !!ctx.sellerTaxStatus;
}

/** Setup questions still to answer (role, perimeter, horizon, perspective, eight topics, seller type, seller tax). */
export function openSetupQuestions(ctx: AssessmentContext): number {
  const single = [ctx.role, ctx.perimeter, ctx.horizon, ctx.profile, ctx.sellerType, ctx.sellerTaxStatus].filter((x) => !x).length;
  return single + TRIGGER_OPTIONS.filter((t) => !ctx.triggers[t.value]).length;
}

function discoveryStarted(diag: Diagnostics, answers: AnswerMap): boolean {
  return Object.keys(diag).length > 0 || ['Q19', 'Q12', 'Q13', 'Q25'].some((id) => !!answers[id]);
}

/**
 * Where a state saved under the old screen order resumes. The old order was
 * c1 (role, ownership, management, company) → c2 (objectives, perimeter,
 * horizon, perspective) → c3 (liquidity, topics, seller) → summary → discovery.
 */
export function migrateScreen(screen: string | null | undefined, ctx: AssessmentContext, diag: Diagnostics, answers: AnswerMap): Screen {
  switch (screen) {
    case 'c1':
    case 'c2':
      return 'context';
    case 'c3':
      return contextComplete(ctx) ? 'discovery' : 'context';
    case 'summary':
      // The old summary came before discovery; send people who had not started discovery there first.
      if (!contextComplete(ctx)) return 'context';
      return discoveryStarted(diag, answers) ? 'summary' : 'discovery';
    default:
      return normalizeScreen(screen);
  }
}

/** Applicable controls in chapter order: the detailed assessment's question list. */
export function deepList(ctx: AssessmentContext): { q: QuestionDef; chapter: number }[] {
  const app = applicableQuestions(resolveRoutes(ctx));
  return CHAPTERS.flatMap((ch, ci) => ch.domains.flatMap((d) => app.filter((q) => q.domain === d).map((q) => ({ q, chapter: ci }))));
}

// ── answer states ────────────────────────────────────────────────────────────

/** A confirmed answer: substantive and usable, or a confirmed "not applicable". Unknown, N/A requests and the like are not answers. */
export function isAnswered(a: Answer | undefined): boolean {
  if (!a) return false;
  if (a.status === 'not_applicable_confirmed') return !a.requiresReconfirmation && !hasConflict(a);
  return isKnown(a);
}

/** A response that is recorded but not a confirmed answer (unknown, needs confirmation, N/A requested, conflict, reconfirm). */
export function isOpenResponse(a: Answer | undefined): boolean {
  return !!a && !isAnswered(a);
}

/** The default "Next question" path visits controls with no response yet, or whose earlier answer needs reconfirmation. */
export function needsVisit(a: Answer | undefined): boolean {
  return !a || !!a.requiresReconfirmation;
}

export interface Progress { answered: number; open: number; untouched: number; total: number }

export function progressCounts(list: { q: QuestionDef }[], answers: AnswerMap): Progress {
  let answered = 0;
  let open = 0;
  for (const { q } of list) {
    const a = answers[q.id];
    if (isAnswered(a)) answered++;
    else if (a) open++;
  }
  return { answered, open, untouched: list.length - answered - open, total: list.length };
}

/** Index of the first control after `from` that needs a visit, or -1. */
export function nextUnresolved(list: { q: QuestionDef }[], answers: AnswerMap, from: number): number {
  for (let i = from + 1; i < list.length; i++) if (needsVisit(answers[list[i].q.id])) return i;
  return -1;
}

export function firstUnresolved(list: { q: QuestionDef }[], answers: AnswerMap): number {
  return nextUnresolved(list, answers, -1);
}

/** Next index for the "Next" button. -1 means: go to the action plan. */
export function nextIndex(list: { q: QuestionDef }[], answers: AnswerMap, from: number, reviewAll: boolean): number {
  if (reviewAll) return from + 1 < list.length ? from + 1 : -1;
  return nextUnresolved(list, answers, from);
}

/** Every applicable control has a confirmed answer. */
export function assessmentComplete(ctx: AssessmentContext, answers: AnswerMap): boolean {
  const app = applicableQuestions(resolveRoutes(ctx));
  return app.length > 0 && app.every((q) => isAnswered(answers[q.id]));
}

export type StepState = 'done' | 'current' | 'todo';

/**
 * The five journey steps. A step before the current one is done, except the
 * Assessment step: it is only done when every applicable control has a
 * confirmed answer (opening the action plan early does not tick it).
 */
export function stepStates(screen: Screen, complete: boolean, resumeTo: Screen | null = null): StepState[] {
  const at = screen === 'saved' ? (resumeTo ? STEP_OF[resumeTo] : -1) : STEP_OF[screen];
  const cur = screen === 'saved' ? -1 : at;
  return [0, 1, 2, 3, 4].map((i): StepState => {
    if (i === cur) return 'current';
    if (i === 3) return complete ? 'done' : 'todo';
    if (i === 4) return 'todo';
    return i < at ? 'done' : 'todo';
  });
}

// ── facts from earlier answers shown on related deep questions ───────────────

export type EarlierFact =
  | { kind: 'largestCustomer'; value: string }
  | { kind: 'objectives'; value: AssessmentContext['objectives'] }
  | { kind: 'liquidity'; value: NonNullable<AssessmentContext['liquidity']> }
  | { kind: 'growthConstraint'; value: string }
  | { kind: 'committedRevenue'; value: string };

/** Display only. Never feeds scoring. */
export function earlierFact(qid: string, ctx: AssessmentContext, diag: Diagnostics): EarlierFact | null {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  switch (qid) {
    case 'Q09': { const v = str(diag.E04); return v ? { kind: 'largestCustomer', value: v } : null; }
    case 'Q10': { const v = str(diag.E03); return v ? { kind: 'committedRevenue', value: v } : null; }
    case 'Q16': { const v = str(diag.E07); return v ? { kind: 'growthConstraint', value: v } : null; }
    case 'Q01': return ctx.objectives.length ? { kind: 'objectives', value: ctx.objectives } : null;
    case 'Q08': return ctx.liquidity ? { kind: 'liquidity', value: ctx.liquidity } : null;
    default: return null;
  }
}
