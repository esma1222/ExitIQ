// Sections 8 and 19: risk rules, priority engine, tasks and the deterministic
// result object that the report renders (and that any narrative must be
// generated from).

import type { Lang } from '../lib/i18n';
import {
  dimensionName, discoveryOptionLabel, domainAction, domainName, localQuestion, routeLabel, statusLabel,
} from '../i18n/localize';
import { CATALOGUE_VERSION, QUESTION_BY_ID, REPORT_VERSION, SCORING_VERSION, dimensionOf } from './catalogue';
import { activeModules, pendingModules } from './routing';
import { computeScores, hasConflict, isKnown, type ScoreResult } from './scoring';
import { PACKAGE_OF, controlState, workstreamOf } from './packages';
import type { ControlResult } from './scoring';
import { MODEL_TEXT, REPORT_TEXT, type GrowthConstraint } from './text';
import type { AnswerMap, AssessmentContext, Diagnostics, QuestionDef, RouteCode } from './types';

export type RiskSeverity = 'critical' | 'review';
export interface Risk {
  rule: 'R01' | 'R02' | 'R03' | 'R04' | 'R05' | 'R06' | 'R07' | 'LIQ' | 'APP';
  severity: RiskSeverity;
  /** confirmed = the stated factual predicate is met; unresolved = a critical fact still needs review. */
  basis: 'confirmed' | 'unresolved';
  title: string;
  text: string;
  questionIds: string[];
}

export type PriorityClass = 1 | 2 | 3;
export type TaskKind = 'critical' | 'open' | 'gap';

export interface Task {
  key: string;
  priorityClass: PriorityClass;
  kind: TaskKind;
  label: string;                 // badge text
  title: string;
  reason: string;
  action: string;
  accountableRole: string;
  suggestedTiming: string;
  timingRank: number;            // for "planned deadline" ordering
  dependencies: string[];
  evidenceRequired: string | null;
  sourceQuestionIds: string[];
  ruleId: string | null;
  dimension: string | null;
  domain: string | null;
  impact: number;                // e_q * (100 - a_q) / 100, or e_q for open facts
  /** Work package of the source control (see packages.ts). Not stored in the tasks table. */
  packageKey: string | null;
  workstream: string | null;
  /** Dependencies whose controls are still open (not answered at the full anchor). */
  waitingFor: string[];
}

const v = (answers: AnswerMap, id: string) => (isKnown(answers[id]) ? answers[id].points : null);
const status = (answers: AnswerMap, id: string) => answers[id]?.status;
const unresolved = (answers: AnswerMap, id: string) => !!answers[id] && !isKnown(answers[id]);

export function evaluateRisks(ctx: AssessmentContext, answers: AnswerMap, score: ScoreResult, lang: Lang = 'en'): Risk[] {
  const T = MODEL_TEXT[lang].risk;
  const r: Risk[] = [];
  const applicable = new Set(score.applicable.map((q) => q.id));
  const nearLaunch = ctx.horizon === 'under_6';

  // R01 Liquidity
  if (ctx.liquidity === 'acute') {
    r.push({ rule: 'R01', severity: 'critical', basis: 'confirmed', title: T.acuteTitle,
      text: T.acuteText, questionIds: [] });
  } else if (ctx.liquidity === 'potential' || ctx.liquidity === 'unknown') {
    r.push({ rule: 'LIQ', severity: 'review', basis: 'unresolved', title: T.liqTitle,
      text: ctx.liquidity === 'unknown'
        ? T.liqUnknown
        : T.liqPotential, questionIds: ['Q08'] });
  }

  // R02 Authority: Q04 = 0 AND a launch is planned before authority can be obtained.
  if (v(answers, 'Q04') === 0 && nearLaunch) {
    r.push({ rule: 'R02', severity: 'critical', basis: 'confirmed', title: T.r02Title,
      text: T.r02Text, questionIds: ['Q04'] });
  } else if (unresolved(answers, 'Q04') && nearLaunch) {
    r.push({ rule: 'R02', severity: 'review', basis: 'unresolved', title: T.r02OpenTitle,
      text: T.r02OpenText, questionIds: ['Q04'] });
  }

  // R03 Essential rights: confirmed 0 anchors only; UNKNOWN alone never asserts a defect.
  const rightsZero = ['Q32', 'Q33'].filter((id) => v(answers, id) === 0);
  if (rightsZero.length) {
    r.push({ rule: 'R03', severity: 'critical', basis: 'confirmed', title: T.r03Title,
      text: T.r03Text, questionIds: rightsZero });
  }
  const rightsOpen = ['Q32', 'Q33'].filter((id) => unresolved(answers, id));
  if (rightsOpen.length) {
    r.push({ rule: 'R03', severity: 'review', basis: 'unresolved', title: T.r03OpenTitle,
      text: T.r03OpenText, questionIds: rightsOpen });
  }

  // R04 Tax timing: only a specialist can confirm. Restructuring history creates a review task.
  if (status(answers, 'Q28') === 'needs_adviser_review' || v(answers, 'Q28') === 0) {
    r.push({ rule: 'R04', severity: 'review', basis: 'unresolved', title: T.r04Title,
      text: T.r04Text, questionIds: ['Q28'] });
  }

  // R05 Separation: SEPARATION active and an essential service lacks a continuity plan.
  if (score.routes.SEPARATION === 'on' && v(answers, 'Q46') === 0) {
    r.push({ rule: 'R05', severity: 'critical', basis: 'confirmed', title: T.r05Title,
      text: T.r05Text, questionIds: ['Q46'] });
  }

  // R06 Funding: no forecast while liquidity pressure is possible. A confirmed gap needs specialist judgement.
  if (v(answers, 'Q08') === 0 && (ctx.liquidity === 'potential' || ctx.liquidity === 'unknown' || ctx.objectives.includes('growth_capital'))) {
    r.push({ rule: 'R06', severity: 'review', basis: 'unresolved', title: T.r06Title,
      text: T.r06Text, questionIds: ['Q08'] });
  }

  // R07 Contradiction
  const conflicted = score.applicable.filter((q) => hasConflict(answers[q.id])).map((q) => q.id);
  if (conflicted.length) {
    r.push({ rule: 'R07', severity: 'review', basis: 'unresolved', title: T.r07Title,
      text: T.r07Text, questionIds: conflicted });
  }

  // Applicability unresolved
  for (const m of pendingModules(score.routes)) {
    const ids = score.applicable.filter((q) => q.route === m).map((q) => q.id).filter((id) => applicable.has(id));
    r.push({ rule: 'APP', severity: 'review', basis: 'unresolved', title: T.appTitle(routeLabel(lang, m)),
      text: T.appText(routeLabel(lang, m)), questionIds: ids });
  }

  return r;
}

/**
 * `risks` must come from evaluateRisks with the same inputs (any language).
 * Task keys are language-neutral: they persist task status, so a key that
 * falls back to a risk title always uses the English title.
 */
export function buildTasks(ctx: AssessmentContext, answers: AnswerMap, score: ScoreResult, risks: Risk[], lang: Lang = 'en'): Task[] {
  const L = MODEL_TEXT[lang].task;
  const timing = MODEL_TEXT[lang].timing[ctx.horizon ?? 'undecided'];
  const tasks: Task[] = [];
  let enRisks: Risk[] | undefined;
  const keyTitle = (i: number) => (lang === 'en' ? risks[i].title : (enRisks ??= evaluateRisks(ctx, answers, score))[i].title);
  const q$ = (q: QuestionDef) => localQuestion(lang, q);

  for (const [i, risk] of risks.entries()) {
    if (risk.rule === 'APP' || risk.rule === 'R07') {
      tasks.push({
        key: `${risk.rule}:${risk.questionIds.join(',') || keyTitle(i)}`, priorityClass: 2, kind: 'open', label: risk.rule === 'R07' ? L.reconfirm : L.clarify,
        title: risk.title, reason: risk.text, action: risk.rule === 'R07' ? L.reconfirmAction : L.clarifyAction,
        accountableRole: L.transactionLead, suggestedTiming: timing[1], timingRank: 1, dependencies: [], evidenceRequired: null,
        sourceQuestionIds: risk.questionIds, ruleId: risk.rule, dimension: null, domain: null, impact: 0,
        packageKey: null, workstream: risk.rule === 'R07' && risk.questionIds[0] ? workstreamOf(risk.questionIds[0]) : null, waitingFor: [],
      });
      continue;
    }
    const q = risk.questionIds[0] ? q$(QUESTION_BY_ID[risk.questionIds[0]]) : undefined;
    tasks.push({
      key: `${risk.rule}:${risk.basis}`, priorityClass: risk.basis === 'confirmed' ? 1 : 2, kind: risk.basis === 'confirmed' ? 'critical' : 'open',
      label: risk.basis === 'confirmed' ? L.critical : L.needsReview, title: risk.title, reason: risk.text,
      action: q ? domainAction(lang, q.domain).action : L.specialistAction,
      accountableRole: q ? q.contributor : L.specialistRole,
      suggestedTiming: risk.basis === 'confirmed' ? timing[0] : timing[1], timingRank: risk.basis === 'confirmed' ? 0 : 1,
      dependencies: [], evidenceRequired: q?.evidenceRequest ?? null, sourceQuestionIds: risk.questionIds, ruleId: risk.rule,
      dimension: q ? dimensionName(lang, dimensionOf(q.domain)) : null, domain: q ? domainName(lang, q.domain) : null,
      impact: q ? score.controls[q.id]?.effectiveWeight ?? 0 : 0,
      packageKey: q ? PACKAGE_OF[q.id] ?? null : null, workstream: q ? workstreamOf(q.id) : null, waitingFor: [],
    });
  }

  const applicableIds = new Set(score.applicable.map((q) => q.id));
  const coveredByRisk = new Set(tasks.flatMap((t) => (t.priorityClass === 1 ? t.sourceQuestionIds : [])));

  for (const q0 of score.applicable) {
    if (coveredByRisk.has(q0.id)) continue;
    const q = q$(q0);
    const a = answers[q.id];
    const c = score.controls[q.id];
    const e = c?.effectiveWeight ?? 0;
    const deps = q.dependsOn ?? [];
    const base = {
      packageKey: PACKAGE_OF[q.id] ?? null, workstream: workstreamOf(q.id),
      waitingFor: deps.filter((d) => applicableIds.has(d) && !(isKnown(answers[d]) && answers[d].points === 100)),
      dependencies: deps, evidenceRequired: q.evidenceRequest ?? null, sourceQuestionIds: [q.id], ruleId: null,
      dimension: dimensionName(lang, dimensionOf(q.domain)), domain: domainName(lang, q.domain), accountableRole: q.contributor, action: domainAction(lang, q.domain).action,
    };
    if (isKnown(a)) {
      if (a.points === 100) continue;
      tasks.push({ ...base, key: `Q:${q.id}`, priorityClass: 3, kind: 'gap', label: a.points === 0 ? L.gap : L.partial, title: q.name,
        reason: L.gapReason(q.anchors[a.points / 50], q.anchors[2]), suggestedTiming: timing[2], timingRank: 2,
        impact: (e * (100 - a.points)) / 100 });
    } else {
      const st = !a ? 'unanswered' : a.requiresReconfirmation ? 'reconfirm' : hasConflict(a) ? 'conflicted' : a.status;
      const label = st === 'unanswered' ? L.unanswered : st === 'needs_adviser_review' ? L.adviserReview : st === 'reconfirm' ? L.reconfirm : L.confirm;
      const reason = st === 'unanswered' ? L.unansweredReason
        : st === 'reconfirm' ? L.reconfirmReason
        : L.markedReason(statusLabel(lang, st));
      tasks.push({ ...base, key: `Q:${q.id}`, priorityClass: 3, kind: 'open', label, title: q.name, reason,
        suggestedTiming: timing[2], timingRank: 2, impact: e });
    }
  }

  // Confirmed critical first, unresolved critical facts second, ordinary gaps third;
  // within a class by planned timing, then impact.
  tasks.sort((x, y) => x.priorityClass - y.priorityClass || x.timingRank - y.timingRank || y.impact - x.impact);
  return dependencyOrder(tasks);
}

/**
 * Within a priority class a task never comes before a task it depends on: the
 * dependency is moved directly in front of the first task that needs it.
 * Stable otherwise; deterministic.
 */
export function dependencyOrder(sorted: Task[]): Task[] {
  const out: Task[] = [];
  const placed = new Set<Task>();
  const visiting = new Set<Task>();
  const visit = (t: Task) => {
    if (placed.has(t) || visiting.has(t)) return;
    visiting.add(t);
    for (const d of t.dependencies) {
      const dep = sorted.find((x) => x !== t && x.priorityClass === t.priorityClass && x.sourceQuestionIds.includes(d));
      if (dep) visit(dep);
    }
    visiting.delete(t);
    placed.add(t);
    out.push(t);
  };
  sorted.forEach(visit);
  return out;
}

export interface Observation { tag: string; tone: 'positive' | 'attention' | 'neutral'; text: string; answerIds: string[] }

/** Section 9: at most three observations, each linked to actual answers. No valuation, no verdicts. */
export function initialObservations(ctx: AssessmentContext, answers: AnswerMap, diag: Diagnostics, lang: Lang = 'en'): Observation[] {
  const O = MODEL_TEXT[lang].obs;
  const out: Observation[] = [];
  const pts = (id: string) => v(answers, id);
  const strengths = (Array.isArray(diag.E01) ? diag.E01 : []) as string[];
  const rel = strengths.includes('Customer loyalty');
  const employed = ctx.managementModel === 'employed';

  if (rel && pts('Q12') != null && pts('Q12')! < 100) {
    out.push({ tag: O.continuity, tone: 'attention', answerIds: ['E01', 'Q12'],
      text: O.continuityText });
  } else if (strengths.length) {
    out.push({ tag: O.strengths, tone: 'neutral', answerIds: ['E01'],
      text: O.strengthsText(strengths.slice(0, 2).map((x) => discoveryOptionLabel(lang, 'E01', x))) });
  }
  if (pts('Q12') === 100 && pts('Q13') === 100) {
    out.push({ tag: O.leadership, tone: 'positive', answerIds: ['Q12', 'Q13'],
      text: O.leadershipText });
  } else if (pts('Q12') === 0) {
    out.push({ tag: O.decisions, tone: 'attention', answerIds: ['Q12'],
      text: O.decisionsText(employed) });
  } else if (pts('Q13') === 0) {
    out.push({ tag: O.expertise, tone: 'attention', answerIds: ['Q13'],
      text: O.expertiseText });
  }
  if (diag.E04 === 'Over 30%' && out.length < 3) {
    out.push({ tag: O.customers, tone: 'attention', answerIds: ['E04'],
      text: O.customersText });
  }
  if (pts('Q25') === 0 && out.length < 3) {
    out.push({ tag: O.tax, tone: 'attention', answerIds: ['Q25'],
      text: O.taxText });
  }
  if (pts('Q19') === 100 && out.length < 3) {
    out.push({ tag: O.proposition, tone: 'positive', answerIds: ['Q19'],
      text: O.propositionText });
  }
  if (!out.length) {
    out.push({ tag: O.more, tone: 'neutral', answerIds: [],
      text: O.moreText });
  }
  return out.slice(0, 3);
}

export interface TaxRow { id: string; name: string; scope: 'company' | 'company_seller' | 'seller' | 'cross_border'; status: 'Not yet assessed' | 'Needs review' | 'Not started' | 'In progress' | 'Prepared' }

const TAX_SCOPE: Record<string, TaxRow['scope']> = {
  // Q27 (structure alternatives) and Q28 (historical restrictions) affect the company and the sellers.
  Q25: 'company', Q27: 'company_seller', Q28: 'company_seller', Q29: 'company', Q30: 'company', Q49: 'company',
  Q26: 'seller', Q31: 'seller', Q52: 'cross_border',
};

/** `status` is a canonical English value (render it through a label lookup); `name` follows `lang`. */
export function taxSection(answers: AnswerMap, score: ScoreResult, lang: Lang = 'en'): TaxRow[] {
  return score.applicable.filter((q) => q.domain === 'T2').map((q) => {
    const a = answers[q.id];
    const st: TaxRow['status'] = !a ? 'Not yet assessed' : !isKnown(a) ? 'Needs review'
      : a.points === 100 ? 'Prepared' : a.points === 50 ? 'In progress' : 'Not started';
    return { id: q.id, name: localQuestion(lang, q).name, scope: TAX_SCOPE[q.id] ?? 'company', status: st };
  });
}

export interface ResultSnapshot {
  versions: { catalogue: string; scoring: string; report: string };
  generatedAt: string;
  context: AssessmentContext;
  profile: string | null;
  activeModules: RouteCode[];
  pendingModules: RouteCode[];
  effectiveWeights: Record<string, number>;
  dimensions: ScoreResult['dimensions'];
  dataStatus: 'data_complete' | 'data_incomplete';
  riskStatus: 'critical' | 'review' | 'none';
  specialist: string[];
  risks: Risk[];
  strengths: { id: string; name: string; text: string }[];
  tasks: Task[];
  tax: TaxRow[];
  unresolved: string[];
}

/** Section 18 recalculation order, end to end. Pure and deterministic. */
/**
 * `lang` only changes display text (risks, tasks, strengths, tax row names).
 * Scores, ids, rules, task keys, ordering and classes are identical in every
 * language. Stored snapshots use the default English output.
 */
export function buildResult(ctx: AssessmentContext, answers: AnswerMap, now = new Date().toISOString(), lang: Lang = 'en'): ResultSnapshot & { score: ScoreResult } {
  const score = computeScores(ctx, answers);
  const risks = evaluateRisks(ctx, answers, score, lang);
  const tasks = buildTasks(ctx, answers, score, risks, lang);
  const strengths = score.applicable
    .filter((q) => isKnown(answers[q.id]) && answers[q.id].points === 100)
    .sort((a, b) => (score.controls[b.id]?.effectiveWeight ?? 0) - (score.controls[a.id]?.effectiveWeight ?? 0))
    .slice(0, 3)
    .map((q) => localQuestion(lang, q))
    .map((q) => ({ id: q.id, name: q.name, text: q.anchors[2] }));
  return {
    score,
    versions: { catalogue: CATALOGUE_VERSION, scoring: SCORING_VERSION, report: REPORT_VERSION },
    generatedAt: now,
    context: ctx,
    profile: score.profile,
    activeModules: activeModules(score.routes),
    pendingModules: pendingModules(score.routes),
    effectiveWeights: Object.fromEntries(Object.values(score.controls).map((c) => [c.id, c.effectiveWeight])),
    dimensions: score.dimensions,
    dataStatus: score.dataComplete ? 'data_complete' : 'data_incomplete',
    riskStatus: risks.some((r) => r.severity === 'critical') ? 'critical' : risks.length ? 'review' : 'none',
    specialist: score.specialist,
    risks,
    strengths,
    tasks,
    tax: taxSection(answers, score, lang),
    unresolved: score.applicable.filter((q) => !isKnown(answers[q.id])).map((q) => q.id),
  };
}

// ── What a buyer will investigate (self-reported discovery answers) ─────────

export interface BuyerItem {
  id: 'E04' | 'E03' | 'E07' | 'E01';
  topic: string;
  /** The reported value(s) in the display language, or null when not stated. */
  value: string | null;
  /** "You reported in discovery". Every item is self-reported. */
  source: string;
  text: string;
  /** Related scored controls whose state is quoted in the text. */
  relatedIds: string[];
}

const NOT_STATED = new Set(['Not yet calculated', 'Unknown', 'Not assessed', 'Prefer not to answer', '']);

/** E07 values, including option labels used before catalogue v1.1. */
const GROWTH: Record<string, GrowthConstraint> = {
  'People and skills': 'people', 'Qualified people': 'people',
  'Production or service capacity': 'capacity', 'Production or delivery capacity': 'capacity',
  Suppliers: 'suppliers',
  'Technology and systems': 'technology', 'Systems and IT': 'technology',
  'Working capital': 'working_capital', Financing: 'working_capital',
  'Management attention': 'management',
  'Nothing material': 'none',
};

/** E01 values (current and earlier labels) mapped to the scored control that tests the claim. */
const STRENGTH_CONTROL: Record<string, string> = {
  'Customer loyalty': 'Q14', 'Personal customer relationships': 'Q14',
  'Distinctive products or technology': 'Q19', 'Proprietary technology': 'Q19',
  'Experienced team': 'Q13', 'Experienced management team': 'Q12', 'Specialist know-how': 'Q13',
  'Recurring revenue': 'Q10',
  'Market position': 'Q19', 'Strong brand or reputation': 'Q19',
  'Operational capabilities': 'Q15', 'Efficient operations': 'Q15',
  'Growth opportunities': 'Q20',
};

const joinList = (lang: Lang, xs: string[]) => {
  if (xs.length <= 1) return xs.join('');
  const and = lang === 'de' ? ' und ' : ' and ';
  return `${xs.slice(0, -1).join(', ')}${and}${xs[xs.length - 1]}`;
};

function controlSentence(lang: Lang, score: ScoreResult, id: string): string | null {
  const c: ControlResult | undefined = score.controls[id];
  if (!c) return null; // not applicable in this assessment
  const B = REPORT_TEXT[lang].buyer;
  const q = localQuestion(lang, QUESTION_BY_ID[id]);
  const s = controlState(c);
  if (s === 'p0' || s === 'p50' || s === 'p100') return B.answerOn(q.name, id, q.anchors[c.points! / 50]);
  if (s === 'unanswered') return B.notAssessed(q.name, id);
  return B.marked(q.name, id, statusLabel(lang, s === 'reconfirm' ? 'reconfirm' : c.status));
}

/**
 * Commercial facts a buyer will look at, from the discovery answers (E01, E03,
 * E04, E07), each combined with the related scored control. Observations
 * only: no valuation, no discount, no risk verdict. Shown whatever the scores.
 */
export function buyerInvestigation(diag: Diagnostics, score: ScoreResult, lang: Lang = 'en'): BuyerItem[] {
  const B = REPORT_TEXT[lang].buyer;
  const str = (x: unknown) => (typeof x === 'string' ? x : '');
  const label = (id: 'E03' | 'E04' | 'E07' | 'E01', v: string) => discoveryOptionLabel(lang, id, v);
  const compose = (...parts: (string | null)[]) => parts.filter(Boolean).join(' ');
  const items: BuyerItem[] = [];

  // E04 largest customer + Q09 customer exposure response
  const e04 = str(diag.E04);
  {
    const lead = e04 === 'Over 30%' ? B.e04.over30 : e04 === '20 to 30%' ? B.e04.mid
      : e04 === 'Under 10%' || e04 === '10 to 20%' ? B.e04.low(label('E04', e04))
      : e04 === 'Prefer not to answer' ? B.e04.withheld : e04 === '' ? B.e04.missing : B.e04.notCalculated;
    const next = e04 === 'Over 30%' ? B.e04.nextHigh : e04 === '20 to 30%' ? B.e04.nextMid
      : e04 === 'Under 10%' || e04 === '10 to 20%' ? B.e04.nextLow : B.e04.nextOpen;
    items.push({ id: 'E04', topic: B.topics.E04, value: NOT_STATED.has(e04) ? null : label('E04', e04), source: B.source,
      text: compose(lead, controlSentence(lang, score, 'Q09'), next), relatedIds: score.controls.Q09 ? ['Q09'] : [] });
  }

  // E03 committed revenue + Q10 revenue durability
  const e03 = str(diag.E03);
  {
    const known = ['Under 25%', '25 to 50%', '50 to 75%', 'Over 75%'].includes(e03);
    const lead = known ? B.e03.band(label('E03', e03)) : e03 === 'Prefer not to answer' ? B.e03.withheld : e03 === '' ? B.e03.missing : B.e03.notCalculated;
    const next = !known ? B.e03.nextOpen : e03 === 'Under 25%' || e03 === '25 to 50%' ? B.e03.nextLow : B.e03.nextHigh;
    items.push({ id: 'E03', topic: B.topics.E03, value: known ? label('E03', e03) : null, source: B.source,
      text: compose(lead, controlSentence(lang, score, 'Q10'), next), relatedIds: score.controls.Q10 ? ['Q10'] : [] });
  }

  // E07 growth constraint + Q16 capacity for growth
  const e07 = str(diag.E07);
  {
    const kind = GROWTH[e07] ?? (NOT_STATED.has(e07) || e07 === 'Prefer not to answer' ? null : 'other');
    const lead = kind === 'none' ? B.e07.none : kind ? B.e07.named(label('E07', e07))
      : e07 === 'Prefer not to answer' ? B.e07.withheld : e07 === '' ? B.e07.missing : B.e07.notAssessed;
    items.push({ id: 'E07', topic: B.topics.E07, value: kind ? label('E07', e07) : null, source: B.source,
      text: compose(lead, controlSentence(lang, score, 'Q16'), kind ? B.e07.next[kind] : B.e07.nextOpen), relatedIds: score.controls.Q16 ? ['Q16'] : [] });
  }

  // E01 stated strengths + the controls that test each claim
  const e01 = (Array.isArray(diag.E01) ? diag.E01 : []).filter((x) => x && !NOT_STATED.has(x));
  {
    const shown = e01.map((x) => label('E01', x));
    const related = [...new Set(e01.map((x) => STRENGTH_CONTROL[x]).filter((id): id is string => !!id && !!score.controls[id]))];
    const relatedText = related.length
      ? B.e01.related(related.map((id) => `${localQuestion(lang, QUESTION_BY_ID[id]).name} (${id}): ${stateWord(lang, score.controls[id])}`).join('; '))
      : null;
    items.push({ id: 'E01', topic: B.topics.E01, value: shown.length ? shown.join(', ') : null, source: B.source,
      text: shown.length ? compose(B.e01.named(joinList(lang, shown.map((x) => (lang === 'de' ? `„${x}“` : x.toLowerCase()))), shown.length), relatedText, B.e01.next) : compose(B.e01.missing, B.e01.nextMissing),
      relatedIds: related });
  }
  return items;
}

function stateWord(lang: Lang, c: ControlResult | undefined): string {
  const s = controlState(c);
  if (s === 'unresolved') return statusLabel(lang, c!.status).toLowerCase();
  const w = REPORT_TEXT[lang].state[s];
  return lang === 'de' ? w : w.toLowerCase();
}

/** E01 strengths as stated, in the display language (current and earlier option labels). */
export function statedStrengths(diag: Diagnostics, lang: Lang = 'en'): { value: string; label: string; relatedId: string | null }[] {
  const e01 = (Array.isArray(diag.E01) ? diag.E01 : []).filter((x) => x && !NOT_STATED.has(x));
  return e01.map((x) => ({ value: x, label: discoveryOptionLabel(lang, 'E01', x), relatedId: STRENGTH_CONTROL[x] ?? null }));
}
