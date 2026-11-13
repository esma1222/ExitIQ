// Assessment state: one source of truth for the UI, saved to this browser on
// every change and appended to Supabase as an audit trail when available.

import { useSyncExternalStore } from 'react';
import { buildResult } from '../model/plan';
import { activeModules, pendingModules, reconcileApplicability, resolveRoutes, specialistReasons } from '../model/routing';
import type { Answer, AnswerMap, AssessmentContext, Diagnostics, EvidenceRef, RouteCode } from '../model/types';
import { deepList, firstUnresolved, migrateScreen, normalizeScreen, type AnyScreen, type Screen } from './journey';
import { answerMatches, diagnosticMatches, evidenceMatches } from './reconcile';
import * as remote from './remote';

export type { Screen } from './journey';
export type TaskStatus = 'open' | 'in_progress' | 'done';

export interface RouteChange { at: string; added: RouteCode[]; removed: RouteCode[]; deactivated: string[]; reactivated: string[] }
export interface SnapshotSummary { at: string; profile: string | null; indices: (number | null)[] }

export interface State {
  v: 1;
  /** 2 = screen order context → discovery → picture → setup → specialist → summary → deep. Missing in older saves. */
  journey?: 2;
  remoteId: string | null;
  answerIds: Record<string, string>;
  screen: Screen;
  resumeTo: Screen | null;
  ctx: AssessmentContext;
  answers: AnswerMap;
  diag: Diagnostics;
  dIdx: number;
  qIdx: number;
  /** Detailed assessment: step through answered questions too, instead of only unresolved ones. */
  reviewAll: boolean;
  routeChange: RouteChange | null;
  taskStatus: Record<string, TaskStatus>;
  lastSnapshot: SnapshotSummary | null;
  previousSnapshot: SnapshotSummary | null;
  startedAt: string | null;
  savedAt: string | null;
}

const KEY = 'exitiq-assessment-v1';

export function blankContext(): AssessmentContext {
  return {
    role: null, ownershipTags: [], managementModel: null, profile: null, objectives: [], perimeter: null, horizon: null,
    liquidity: null, triggers: {}, sellerType: null, sellerTaxStatus: null,
    company: { businessModel: null, sector: null, revenueBand: null, employeeBand: null, jurisdiction: null },
  };
}

function blank(): State {
  return {
    v: 1, journey: 2, remoteId: null, answerIds: {}, screen: 'context', resumeTo: null, ctx: blankContext(), answers: {}, diag: {},
    dIdx: 0, qIdx: 0, reviewAll: false, routeChange: null, taskStatus: {}, lastSnapshot: null, previousSnapshot: null, startedAt: null, savedAt: null,
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const s = JSON.parse(raw) as State;
    if (s.v !== 1) return blank();
    const merged: State = { ...blank(), ...s, ctx: { ...blankContext(), ...s.ctx, company: { ...blankContext().company, ...s.ctx?.company } } };
    return upgradeScreens(merged, s.journey === 2);
  } catch {
    return blank();
  }
}

/** Old saves name screens of the previous order; map them onto the current journey. */
function upgradeScreens(s: State, current: boolean): State {
  const fix = (x: string | null | undefined): Screen => (current ? normalizeScreen(x) : migrateScreen(x, s.ctx, s.diag, s.answers));
  const resumeTo = s.resumeTo ? fix(s.resumeTo) : null;
  return { ...s, journey: 2, screen: s.screen === 'saved' ? 'saved' : fix(s.screen), resumeTo: resumeTo === 'saved' ? null : resumeTo };
}

let state: State = typeof localStorage !== 'undefined' ? load() : blank();
const subs = new Set<() => void>();

function write(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode or quota: the in-memory state still works */
  }
  subs.forEach((f) => f());
}

export function useAssessment(): State {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
    () => state,
  );
}

export function getState(): State {
  return state;
}

export function hasProgress(s: State = state): boolean {
  return !!s.startedAt;
}

// ── remote mirroring ─────────────────────────────────────────────────────────

/**
 * Funnel stages for analytics (test report: landing CTA → context → discovery →
 * first observation → setup → detailed assessment → report → export → return).
 * Finer than the assessment row's stage, which the database constrains.
 */
const TRACK_STAGE: Record<Screen, string> = {
  context: 'CONTEXT', discovery: 'DISCOVERY', picture: 'INITIAL_PICTURE', setup: 'SETUP', specialist: 'SPECIALIST',
  summary: 'SETUP_SUMMARY', deep: 'DEEP_ASSESSMENT', result: 'RESULT', saved: 'SAVED',
};

/** Records which question is on screen, so exits can be located. Only the question id is sent, never an answer. */
export function trackQuestionView(questionId: string) {
  remote.track('stage_view', state.remoteId, { stage: `QUESTION:${questionId}`, profile: state.ctx.profile });
}

const STAGE: Record<Screen, remote.Stage> = {
  context: 'CONTEXT', discovery: 'DISCOVERY', picture: 'INITIAL_PICTURE', setup: 'DEEP_ASSESSMENT', specialist: 'DEEP_ASSESSMENT',
  summary: 'DEEP_ASSESSMENT', deep: 'DEEP_ASSESSMENT', result: 'RESULT', saved: 'SAVED',
};

function rowInput(s: State): remote.AssessmentRowInput {
  const routes = resolveRoutes(s.ctx);
  const resume = s.screen === 'saved' ? s.resumeTo ?? 'context' : s.screen;
  const resumeStage = STAGE[resume] as remote.AssessmentRowInput['resumeStage'];
  let stage = STAGE[s.screen];
  if (s.screen === 'result' && specialistReasons(s.ctx).length) stage = 'SPECIALIST_PATH';
  return {
    stage, resumeStage, ctx: s.ctx, diag: s.diag, uiState: { journey: 2, screen: s.screen, resumeTo: s.resumeTo, dIdx: s.dIdx, qIdx: s.qIdx, taskStatus: s.taskStatus },
    activeModules: activeModules(routes), pendingModules: pendingModules(routes),
  };
}

async function remoteId(): Promise<string | null> {
  if (state.remoteId) return state.remoteId;
  const id = await remote.createAssessment(rowInput(state));
  if (id && !state.remoteId) {
    write({ ...state, remoteId: id });
    remote.track('assessment_start', id, { stage: 'CONTEXT' });
    // Work done while online saving was off goes up in full, not only the next change.
    if (Object.keys(state.answers).length || Object.keys(state.diag).length) void syncAll();
  }
  return id;
}

// ── full reconciliation ──────────────────────────────────────────────────────

let syncing: Promise<boolean> | null = null;

/**
 * The single path that makes the online copy match this browser: sign in
 * (again), find or create the assessment row, write context, diagnostics,
 * stage and position, then append every answer, diagnostic and evidence
 * reference that differs from what the database holds, and the latest result.
 * Local data is never touched except for remote ids. Resolves true when the
 * online copy is complete.
 */
export function syncAll(): Promise<boolean> {
  if (!syncing) syncing = reconcileAll().catch(() => false).finally(() => { syncing = null; });
  return syncing;
}

async function reconcileAll(): Promise<boolean> {
  remote.resetSignIn();
  if (!(await remote.ensureUser())) return false;

  let id = state.remoteId;
  if (id) {
    const exists = await remote.saveAssessment(id, rowInput(state));
    if (exists === null) return false;
    if (!exists) {
      // The row is gone (deleted elsewhere): start a fresh online copy from this browser.
      id = null;
      remote.resetCreation();
      write({ ...state, remoteId: null, answerIds: {} });
    }
  }
  if (!id) {
    id = await remote.createAssessment(rowInput(state));
    if (!id) return false;
    if (state.remoteId !== id) {
      write({ ...state, remoteId: id });
      remote.track('assessment_start', id, { stage: STAGE[state.screen] });
    }
  }

  const snap = await remote.fetchRemoteState(id);
  if (!snap) return false;
  const ids: Record<string, string> = { ...state.answerIds };

  const qids = new Set([...Object.keys(state.answers), ...Object.keys(snap.answers).filter((k) => k.startsWith('Q'))]);
  for (const q of qids) {
    const local = state.answers[q] ?? null;
    const row = snap.answers[q];
    if (answerMatches(local, row)) {
      if (row) ids[q] = row.id;
      continue;
    }
    const newId = await remote.appendAnswer(id, q, local, row?.id ?? null, state.ctx.role);
    if (!newId) return false;
    ids[q] = newId;
  }

  const eids = new Set([...Object.keys(state.diag), ...Object.keys(snap.answers).filter((k) => k.startsWith('E'))]);
  for (const e of eids) {
    const local = state.diag[e as keyof Diagnostics] ?? null;
    const row = snap.answers[e];
    if (diagnosticMatches(local, row)) {
      if (row) ids[e] = row.id;
      continue;
    }
    const newId = await remote.appendDiagnostic(id, e, local, row?.id ?? null);
    if (!newId) return false;
    ids[e] = newId;
  }

  for (const [q, a] of Object.entries(state.answers)) {
    if (a.evidence && !evidenceMatches(a.evidence, snap.evidence[q])) {
      if (!(await remote.addEvidence(id, q, a.evidence))) return false;
    }
  }
  write({ ...state, answerIds: ids });

  if (state.lastSnapshot && !snap.hasResult) {
    const { score, ...snapshot } = buildResult(state.ctx, state.answers);
    if (!(await remote.saveResult(id, { ...snapshot, dimensions: score.dimensions }))) return false;
  }
  for (const [key, st] of Object.entries(state.taskStatus)) {
    if (!(await remote.setTaskStatus(id, key, st))) return false;
  }
  return true;
}

// A write that succeeds after a failure period triggers a full reconciliation,
// so answers given while offline are not left out of the online copy.
let lastOnline: boolean | null = null;
remote.onBackupHealth((h) => {
  if (lastOnline === false && h.online === true && hasProgress()) void syncAll();
  lastOnline = h.online;
});

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAssessmentSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const id = await remoteId();
    if (id) void remote.saveAssessment(id, rowInput(state));
  }, 600);
}

async function mirrorAnswer(questionId: string) {
  const id = await remoteId();
  if (!id) return;
  const a = state.answers[questionId] ?? null;
  const newId = await remote.appendAnswer(id, questionId, a, state.answerIds[questionId] ?? null, state.ctx.role);
  if (newId) write({ ...state, answerIds: { ...state.answerIds, [questionId]: newId } });
}

async function mirrorDiagnostic(questionId: string) {
  const id = await remoteId();
  if (!id) return;
  const newId = await remote.appendDiagnostic(id, questionId, state.diag[questionId as keyof Diagnostics] ?? null, state.answerIds[questionId] ?? null);
  if (newId) write({ ...state, answerIds: { ...state.answerIds, [questionId]: newId } });
}

// ── actions ──────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();

function touch(next: Partial<State>): State {
  return { ...state, ...next, startedAt: state.startedAt ?? now(), savedAt: now() };
}

/** Context edits re-run routing. Answers are never deleted: they go inactive and need reconfirmation on return. */
export function setContext(patch: Partial<AssessmentContext>) {
  const before = resolveRoutes(state.ctx);
  const ctx = { ...state.ctx, ...patch };
  const after = resolveRoutes(ctx);
  const t = now();
  const rec = reconcileApplicability(state.answers, before, after, t);
  const added = activeModules(after).filter((m) => !activeModules(before).includes(m));
  const removed = activeModules(before).filter((m) => !activeModules(after).includes(m));
  const changed = added.length || removed.length || rec.deactivated.length || rec.reactivated.length;
  write(touch({ ctx, answers: rec.answers, routeChange: changed ? { at: t, added, removed, deactivated: rec.deactivated, reactivated: rec.reactivated } : state.routeChange }));
  scheduleAssessmentSave();
  [...rec.deactivated, ...rec.reactivated].forEach((q) => void mirrorAnswer(q));
  // Only a change to an assessment already under way is a route change worth counting.
  if (changed && state.remoteId && Object.keys(state.answers).length) remote.track('route_change', state.remoteId, { stage: 'CONTEXT' });
}

export function setAnswer(questionId: string, answer: Omit<Answer, 'answeredAt'> | null) {
  const answers = { ...state.answers };
  if (answer) {
    const prev = answers[questionId];
    answers[questionId] = { ...answer, answeredAt: now(), evidence: answer.status === 'substantive' ? answer.evidence ?? prev?.evidence ?? null : null, requiresReconfirmation: false, inactiveSince: null };
  } else delete answers[questionId];
  write(touch({ answers }));
  void mirrorAnswer(questionId);
}

/** Reconfirm an earlier answer unchanged after its route came back. */
export function reconfirm(questionId: string) {
  const a = state.answers[questionId];
  if (!a) return;
  write(touch({ answers: { ...state.answers, [questionId]: { ...a, requiresReconfirmation: false, answeredAt: now() } } }));
  void mirrorAnswer(questionId);
}

export function setEvidence(questionId: string, ev: EvidenceRef | null) {
  const a = state.answers[questionId];
  if (!a) return;
  write(touch({ answers: { ...state.answers, [questionId]: { ...a, evidence: ev } } }));
  if (ev) {
    void remoteId().then((id) => {
      if (id) void remote.addEvidence(id, questionId, ev);
    });
  }
  void mirrorAnswer(questionId);
}

export function setDiagnostic(id: keyof Diagnostics, value: string | string[] | null) {
  const diag = { ...state.diag };
  if (value == null) delete diag[id];
  else diag[id] = value;
  write(touch({ diag }));
  void mirrorDiagnostic(id);
  scheduleAssessmentSave();
}

/** Opens a screen. Legacy names are accepted (c1 → context, c2 → setup, c3 → specialist topics). */
export function go(target: AnyScreen, extra: Partial<State> = {}) {
  const screen = normalizeScreen(target);
  const resumeTo = screen === 'saved' ? (state.screen === 'saved' ? state.resumeTo : state.screen) : state.resumeTo;
  // The detailed assessment opens at the first question that still needs an answer.
  if (screen === 'deep' && extra.qIdx === undefined) {
    const list = deepList(state.ctx);
    const first = firstUnresolved(list, state.answers);
    extra = { ...extra, qIdx: first >= 0 ? first : Math.min(state.qIdx, Math.max(0, list.length - 1)) };
  }
  write(touch({ screen, resumeTo, ...extra }));
  scheduleAssessmentSave();
  remote.track(screen === 'saved' ? 'save' : 'stage_view', state.remoteId, { stage: TRACK_STAGE[screen], profile: state.ctx.profile });
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    /* jsdom / old browsers */
  }
}

export function setPosition(extra: Partial<Pick<State, 'dIdx' | 'qIdx' | 'reviewAll'>>) {
  write(touch(extra));
  scheduleAssessmentSave();
}

export function setTaskStatus(key: string, s: TaskStatus) {
  write(touch({ taskStatus: { ...state.taskStatus, [key]: s } }));
  if (state.remoteId) void remote.setTaskStatus(state.remoteId, key, s);
}

export function dismissRouteChange() {
  write({ ...state, routeChange: null });
}

/** Called when the action plan is shown: stores a versioned snapshot when the result changed. */
export function recordResult() {
  const { score, ...snapshot } = buildResult(state.ctx, state.answers);
  const r = { ...snapshot, dimensions: score.dimensions };
  const indices = r.dimensions.map((d) => d.displayIndex);
  const summary: SnapshotSummary = { at: r.generatedAt, profile: r.profile, indices };
  const last = state.lastSnapshot;
  const changed = !last || last.profile !== summary.profile || JSON.stringify(last.indices) !== JSON.stringify(indices);
  if (changed) {
    const previousSnapshot = last && last.profile !== summary.profile ? last : state.previousSnapshot;
    write({ ...state, lastSnapshot: summary, previousSnapshot });
  }
  void remoteId().then((id) => {
    if (!id) return;
    if (changed) void remote.saveResult(id, r);
    remote.track('result_view', id, { stage: 'RESULT', profile: state.ctx.profile });
  });
}

export function resume() {
  const target = state.resumeTo && state.resumeTo !== 'saved' ? state.resumeTo : 'context';
  remote.track('resume', state.remoteId, { stage: STAGE[target] });
  go(target);
}

export async function hydrateFromRemote(): Promise<boolean> {
  if (hasProgress()) return false;
  try {
    const r = await remote.loadLatest();
    if (!r) return false;
    const ui = r.uiState as Partial<State>;
    const loaded: State = {
      ...blank(), remoteId: r.id, answerIds: r.answerIds, ctx: { ...blankContext(), ...r.ctx }, answers: r.answers, diag: r.diag,
      screen: 'saved', resumeTo: ((ui.resumeTo ?? ui.screen ?? 'context') as Screen), dIdx: ui.dIdx ?? 0, qIdx: ui.qIdx ?? 0,
      taskStatus: (ui.taskStatus as State['taskStatus']) ?? {}, startedAt: r.updatedAt, savedAt: r.updatedAt,
    };
    write(upgradeScreens(loaded, ui.journey === 2));
    return true;
  } catch {
    return false;
  }
}

/** Deletes the assessment everywhere this app stored it. */
export async function deleteEverything() {
  if (state.remoteId) await remote.deleteAssessment(state.remoteId);
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  remote.resetCreation();
  write(blank());
}

export function startNew() {
  remote.resetCreation();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  write(blank());
}
