// Report structure on top of the task list: one task taxonomy (critical
// prerequisites, questions to clarify, preparation work), work packages
// (deliverables that group preparation work) and at most three recommended
// next steps. Everything here is derived from the result object only, so the
// page, the written summary and the Excel export cannot disagree.
//
// Language-neutral: keys, grouping and order never depend on `lang`; only the
// display strings do.

import type { Lang } from '../lib/i18n';
import { localQuestion, statusLabel } from '../i18n/localize';
import { QUESTIONS, QUESTION_BY_ID } from './catalogue';
import type { ResultSnapshot, Task } from './plan';
import type { ControlResult, ScoreResult } from './scoring';
import { REPORT_TEXT } from './text';

export type Category = 'critical' | 'clarify' | 'preparation';
export const CATEGORY_ORDER: Category[] = ['critical', 'preparation', 'clarify'];

export type Workstream = 'strategy' | 'people' | 'commercial' | 'finance' | 'operations' | 'tax' | 'legal' | 'separation' | 'process';
export const WORKSTREAMS: Workstream[] = ['strategy', 'finance', 'commercial', 'people', 'operations', 'tax', 'legal', 'separation', 'process'];

export type PackageKey =
  | 'objectives' | 'approvals' | 'leadership' | 'customers' | 'growth' | 'financials' | 'liquidity'
  | 'operations' | 'tax_structure' | 'tax_company' | 'cap_table' | 'legal' | 'separation' | 'process_team' | 'data_room';

/** Static mapping: every control belongs to exactly one work package. */
export const PACKAGES: { key: PackageKey; workstream: Workstream; controls: string[] }[] = [
  { key: 'objectives', workstream: 'strategy', controls: ['Q01', 'Q02', 'Q05'] },
  { key: 'approvals', workstream: 'strategy', controls: ['Q03', 'Q04', 'Q54'] },
  { key: 'financials', workstream: 'finance', controls: ['Q07', 'Q21', 'Q22', 'Q23', 'Q45', 'Q55'] },
  { key: 'liquidity', workstream: 'finance', controls: ['Q08', 'Q24'] },
  { key: 'customers', workstream: 'commercial', controls: ['Q09', 'Q10', 'Q11', 'Q14'] },
  { key: 'growth', workstream: 'commercial', controls: ['Q16', 'Q19', 'Q20', 'Q50'] },
  { key: 'leadership', workstream: 'people', controls: ['Q06', 'Q12', 'Q13'] },
  { key: 'operations', workstream: 'operations', controls: ['Q15', 'Q17', 'Q18'] },
  { key: 'tax_structure', workstream: 'tax', controls: ['Q26', 'Q27', 'Q31', 'Q52'] },
  { key: 'tax_company', workstream: 'tax', controls: ['Q25', 'Q28', 'Q29', 'Q30'] },
  { key: 'cap_table', workstream: 'legal', controls: ['Q32', 'Q38', 'Q39', 'Q51'] },
  { key: 'legal', workstream: 'legal', controls: ['Q33', 'Q34', 'Q35', 'Q36', 'Q37'] },
  { key: 'separation', workstream: 'separation', controls: ['Q44', 'Q46', 'Q47', 'Q48', 'Q49', 'Q53'] },
  { key: 'process_team', workstream: 'process', controls: ['Q41', 'Q42'] },
  { key: 'data_room', workstream: 'process', controls: ['Q40', 'Q43'] },
];

export const PACKAGE_OF: Record<string, PackageKey> = Object.fromEntries(PACKAGES.flatMap((p) => p.controls.map((id) => [id, p.key])));
export const WORKSTREAM_OF_PACKAGE: Record<PackageKey, Workstream> = Object.fromEntries(PACKAGES.map((p) => [p.key, p.workstream])) as Record<PackageKey, Workstream>;
export const workstreamOf = (qid: string): Workstream | null => (PACKAGE_OF[qid] ? WORKSTREAM_OF_PACKAGE[PACKAGE_OF[qid]] : null);

// Fail fast if the catalogue and the mapping drift apart.
if (QUESTIONS.some((q) => !PACKAGE_OF[q.id])) throw new Error('Every control needs a work package');

export function categoryOf(t: Pick<Task, 'kind'>): Category {
  return t.kind === 'critical' ? 'critical' : t.kind === 'gap' ? 'preparation' : 'clarify';
}

export type ControlState = 'unanswered' | 'reconfirm' | 'p0' | 'p50' | 'p100' | 'unresolved';

export interface ControlLine {
  id: string;
  name: string;
  state: ControlState;
  stateLabel: string;
  /** "Today: … Target: …" for preparation work, otherwise null. */
  reason: string | null;
  waitingFor: string[];
  taskKey: string | null;
}

export interface WorkPackage {
  key: PackageKey;
  workstream: Workstream;
  workstreamName: string;
  name: string;
  owner: string;
  output: string;
  /** Sum of e_q * (100 - a_q) / 100 over its preparation-work controls. */
  impact: number;
  tasks: Task[];
  /** Every applicable control of the package with its individual state. */
  controls: ControlLine[];
  dependsOn: { key: PackageKey; name: string }[];
  /** Open controls outside this package that its work waits for. */
  waitingFor: string[];
}

export interface ClarifyGroup { workstream: Workstream; name: string; tasks: Task[]; weight: number }

export interface NextStep {
  kind: 'critical' | 'package' | 'review' | 'clarify';
  title: string;
  detail: string;
  owner: string | null;
  questionIds: string[];
  /** Control to open from the step, if any. */
  firstQuestion: string | null;
  packageKey: PackageKey | null;
  ruleId: string | null;
}

export interface PlanView {
  critical: Task[];
  packages: WorkPackage[];
  /** Open risk reviews (liquidity, applicability, conflicts, unresolved critical facts). */
  reviews: Task[];
  clarifyGroups: ClarifyGroup[];
  clarifyCount: number;
  nextSteps: NextStep[];
  /** All tasks in report order with their category, for exports. */
  ordered: { task: Task; category: Category; packageKey: PackageKey | null }[];
}

export const MAX_NEXT_STEPS = 3;
/** From this many questions to clarify on, one next step is reserved for answering them. */
export const MANY_OPEN = 5;

export function controlState(c: ControlResult | undefined): ControlState {
  if (!c || c.status === 'unanswered') return 'unanswered';
  if (c.status === 'reconfirm') return 'reconfirm';
  if (c.known && c.points != null) return c.points === 100 ? 'p100' : c.points === 50 ? 'p50' : 'p0';
  return 'unresolved';
}

export function controlStateLabel(lang: Lang, c: ControlResult | undefined): string {
  const T = REPORT_TEXT[lang].state;
  const s = controlState(c);
  if (s === 'unresolved') return statusLabel(lang, c!.status);
  return T[s];
}

type Result = Pick<ResultSnapshot, 'tasks'> & { score: ScoreResult };

export function buildPlanView(r: Result, lang: Lang = 'en'): PlanView {
  const T = REPORT_TEXT[lang];
  const tasks = r.tasks;
  const applicable = new Set(r.score.applicable.map((q) => q.id));
  const critical = tasks.filter((t) => t.kind === 'critical');
  const gaps = tasks.filter((t) => t.kind === 'gap');
  const reviews = tasks.filter((t) => t.kind === 'open' && t.ruleId != null);
  const clarifyControls = tasks.filter((t) => t.kind === 'open' && t.ruleId == null);
  const taskOf = new Map<string, Task>();
  for (const t of tasks) for (const id of t.sourceQuestionIds) if (!taskOf.has(id)) taskOf.set(id, t);

  // ── Work packages ─────────────────────────────────────────────────────────
  const built = new Map<PackageKey, WorkPackage>();
  for (const p of PACKAGES) {
    const ptasks = gaps.filter((t) => PACKAGE_OF[t.sourceQuestionIds[0]] === p.key);
    if (!ptasks.length) continue;
    const text = T.packages[p.key];
    const controls: ControlLine[] = p.controls.filter((id) => applicable.has(id)).map((id) => {
      const c = r.score.controls[id];
      const t = taskOf.get(id);
      return {
        id, name: localQuestion(lang, QUESTION_BY_ID[id]).name, state: controlState(c), stateLabel: controlStateLabel(lang, c),
        reason: t?.kind === 'gap' ? t.reason : null, waitingFor: t?.waitingFor ?? [], taskKey: t?.key ?? null,
      };
    });
    const outside = [...new Set(ptasks.flatMap((t) => t.waitingFor.filter((d) => PACKAGE_OF[d] !== p.key)))];
    built.set(p.key, {
      key: p.key, workstream: p.workstream, workstreamName: T.workstreams[p.workstream], name: text.name, owner: text.owner, output: text.output,
      impact: ptasks.reduce((s, t) => s + t.impact, 0), tasks: ptasks, controls, dependsOn: [], waitingFor: outside,
    });
  }
  for (const pk of built.values()) {
    const deps = new Set<PackageKey>();
    for (const t of pk.tasks) for (const d of t.waitingFor) {
      const other = PACKAGE_OF[d];
      if (other && other !== pk.key && built.has(other)) deps.add(other);
    }
    pk.dependsOn = [...deps].map((k) => ({ key: k, name: built.get(k)!.name }));
  }
  // By impact; a package never comes before a package it depends on.
  const byImpact = [...built.values()].sort((a, b) => b.impact - a.impact || PACKAGES.findIndex((p) => p.key === a.key) - PACKAGES.findIndex((p) => p.key === b.key));
  const packages: WorkPackage[] = [];
  const placed = new Set<PackageKey>();
  const visiting = new Set<PackageKey>();
  const visit = (pk: WorkPackage) => {
    if (placed.has(pk.key) || visiting.has(pk.key)) return;
    visiting.add(pk.key);
    for (const d of pk.dependsOn) visit(built.get(d.key)!);
    visiting.delete(pk.key);
    placed.add(pk.key);
    packages.push(pk);
  };
  byImpact.forEach(visit);

  // ── Questions to clarify, grouped by workstream ──────────────────────────
  const groups = new Map<Workstream, ClarifyGroup>();
  for (const t of clarifyControls) {
    const ws = workstreamOf(t.sourceQuestionIds[0]) ?? 'strategy';
    const g = groups.get(ws) ?? { workstream: ws, name: T.workstreams[ws], tasks: [], weight: 0 };
    g.tasks.push(t);
    g.weight += t.impact;
    groups.set(ws, g);
  }
  const clarifyGroups = [...groups.values()].sort((a, b) => b.weight - a.weight || WORKSTREAMS.indexOf(a.workstream) - WORKSTREAMS.indexOf(b.workstream));
  const clarifyCount = reviews.length + clarifyControls.length;

  // ── At most three recommended next steps ─────────────────────────────────
  const S = T.steps;
  const steps: NextStep[] = [];
  for (const t of critical) {
    if (steps.length >= MAX_NEXT_STEPS) break;
    steps.push({ kind: 'critical', title: S.critical(t.title), detail: t.action, owner: t.accountableRole, questionIds: t.sourceQuestionIds,
      firstQuestion: t.sourceQuestionIds[0] ?? null, packageKey: null, ruleId: t.ruleId });
  }
  const reserve = clarifyCount >= MANY_OPEN ? 1 : 0;
  for (const p of packages) {
    if (steps.length >= MAX_NEXT_STEPS - reserve) break;
    const ids = p.tasks.flatMap((t) => t.sourceQuestionIds);
    steps.push({ kind: 'package', title: p.name, detail: S.packageDetail(ids.length, p.output), owner: p.owner, questionIds: ids,
      firstQuestion: ids[0] ?? null, packageKey: p.key, ruleId: null });
  }
  for (const t of reviews) {
    if (steps.length >= MAX_NEXT_STEPS) break;
    steps.push({ kind: 'review', title: t.title, detail: t.action, owner: t.accountableRole, questionIds: t.sourceQuestionIds,
      firstQuestion: t.ruleId === 'APP' ? null : t.sourceQuestionIds[0] ?? null, packageKey: null, ruleId: t.ruleId });
  }
  for (const g of clarifyGroups) {
    if (steps.length >= MAX_NEXT_STEPS) break;
    const ids = g.tasks.flatMap((t) => t.sourceQuestionIds);
    steps.push({ kind: 'clarify', title: S.clarify(g.name), detail: S.clarifyDetail(ids.length, ids), owner: null, questionIds: ids,
      firstQuestion: ids[0] ?? null, packageKey: null, ruleId: null });
  }

  const ordered: PlanView['ordered'] = [
    ...critical.map((task) => ({ task, category: 'critical' as const, packageKey: PACKAGE_OF[task.sourceQuestionIds[0]] ?? null })),
    ...packages.flatMap((p) => p.tasks.map((task) => ({ task, category: 'preparation' as const, packageKey: p.key }))),
    ...reviews.map((task) => ({ task, category: 'clarify' as const, packageKey: null })),
    ...clarifyGroups.flatMap((g) => g.tasks.map((task) => ({ task, category: 'clarify' as const, packageKey: PACKAGE_OF[task.sourceQuestionIds[0]] ?? null }))),
  ];

  return { critical, packages, reviews, clarifyGroups, clarifyCount, nextSteps: steps, ordered };
}
