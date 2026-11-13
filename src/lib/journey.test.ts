import { describe, expect, it } from 'vitest';
import { CHAPTERS, DISCOVERY_REUSED, QUESTION_BY_ID } from '../model/catalogue';
import { DISCOVERY } from '../model/options';
import type { Answer, AnswerMap, AssessmentContext, Points } from '../model/types';
import {
  assessmentComplete, deepList, earlierFact, firstUnresolved, isAnswered, migrateScreen, nextIndex, nextUnresolved, normalizeScreen,
  openSetupQuestions, progressCounts, stepStates,
} from './journey';
import { answerMatches, diagnosticMatches, evidenceMatches } from './reconcile';

const T = '2026-11-12T10:00:00.000Z';

function ctx(over: Partial<AssessmentContext> = {}): AssessmentContext {
  return {
    role: 'owner', ownershipTags: ['private_family'], managementModel: 'owner_led', profile: 'OWNER',
    objectives: ['full_sale'], perimeter: 'whole_business', horizon: 'm6_18', liquidity: 'no_pressure',
    triggers: { debt: 'no', acquisitions: 'no', employee_equity: 'no', preferences: 'no', convertibles: 'no', regulated: 'no', contingent: 'no', group_dependency: 'no' },
    sellerType: 'individuals', sellerTaxStatus: 'same',
    company: { businessModel: null, sector: null, revenueBand: null, employeeBand: null, jurisdiction: null },
    ...over,
  };
}
const blankCtx = (): AssessmentContext => ({
  ...ctx(), role: null, ownershipTags: [], managementModel: null, profile: null, objectives: [], perimeter: null, horizon: null,
  liquidity: null, triggers: {}, sellerType: null, sellerTaxStatus: null,
});
const sub = (points: Points): Answer => ({ status: 'substantive', points, answeredAt: T });

describe('detailed assessment navigation', () => {
  const c = ctx();
  const list = deepList(c);

  it('follows the chapters and keeps every applicable control once', () => {
    expect(new Set(list.map((x) => x.q.id)).size).toBe(list.length);
    expect(list.map((x) => x.chapter)).toEqual([...list.map((x) => x.chapter)].sort((a, b) => a - b));
    expect(CHAPTERS).toHaveLength(8);
  });

  it('default path visits only unresolved controls and skips those answered in discovery', () => {
    const answers: AnswerMap = Object.fromEntries(DISCOVERY_REUSED.map((id) => [id, sub(50)]));
    const visited: string[] = [];
    let i = firstUnresolved(list, answers);
    while (i >= 0) {
      visited.push(list[i].q.id);
      i = nextIndex(list, answers, i, false);
    }
    expect(visited).toHaveLength(list.length - DISCOVERY_REUSED.length);
    for (const id of DISCOVERY_REUSED) expect(visited).not.toContain(id);
  });

  it('an unknown response is visited once but not again; reconfirmation is visited', () => {
    const [a, b, c2] = list.map((x) => x.q.id);
    const answers: AnswerMap = { [a]: { status: 'unknown', answeredAt: T }, [b]: { ...sub(100), requiresReconfirmation: true } };
    expect(firstUnresolved(list, answers)).toBe(1);
    expect(list[nextUnresolved(list, answers, 1)].q.id).toBe(c2);
  });

  it('goes to the action plan (-1) when nothing after the current question is unresolved', () => {
    const all: AnswerMap = Object.fromEntries(list.map((x) => [x.q.id, sub(0)]));
    expect(firstUnresolved(list, all)).toBe(-1);
    expect(nextIndex(list, all, 3, false)).toBe(-1);
  });

  it('review mode steps through every question, answered or not', () => {
    const all: AnswerMap = Object.fromEntries(list.map((x) => [x.q.id, sub(0)]));
    expect(nextIndex(list, all, 3, true)).toBe(4);
    expect(nextIndex(list, all, list.length - 1, true)).toBe(-1);
  });
});

describe('answered count', () => {
  const list = deepList(ctx());
  it('counts only confirmed answers; N/A requests, unknown and reconfirmation are open responses', () => {
    const ids = list.map((x) => x.q.id);
    const answers: AnswerMap = {
      [ids[0]]: sub(100),
      [ids[1]]: sub(0),
      [ids[2]]: { status: 'not_applicable_confirmed', naReason: 'x', answeredAt: T },
      [ids[3]]: { status: 'not_applicable_requested', answeredAt: T },
      [ids[4]]: { status: 'unknown', answeredAt: T },
      [ids[5]]: { ...sub(50), requiresReconfirmation: true },
    };
    expect(progressCounts(list, answers)).toEqual({ answered: 3, open: 3, untouched: list.length - 6, total: list.length });
    expect(isAnswered({ status: 'needs_adviser_review', answeredAt: T })).toBe(false);
  });
});

describe('journey stepper', () => {
  const c = ctx();
  const list = deepList(c);
  const all: AnswerMap = Object.fromEntries(list.map((x) => [x.q.id, sub(50)]));

  it('does not tick the Assessment step when the action plan is opened early', () => {
    expect(assessmentComplete(c, {})).toBe(false);
    expect(stepStates('result', false)).toEqual(['done', 'done', 'done', 'todo', 'current']);
  });

  it('ticks the Assessment step only when every applicable control has a confirmed answer', () => {
    expect(assessmentComplete(c, all)).toBe(true);
    expect(stepStates('result', true)).toEqual(['done', 'done', 'done', 'done', 'current']);
    const oneUnknown = { ...all, [list[0].q.id]: { status: 'unknown', answeredAt: T } as Answer };
    expect(assessmentComplete(c, oneUnknown)).toBe(false);
  });

  it('setup, summary and the detailed questions all belong to the Assessment step', () => {
    for (const s of ['setup', 'specialist', 'summary', 'deep'] as const) expect(stepStates(s, false)).toEqual(['done', 'done', 'done', 'current', 'todo']);
    expect(stepStates('context', false)).toEqual(['current', 'todo', 'todo', 'todo', 'todo']);
    expect(stepStates('saved', false, 'discovery')).toEqual(['done', 'todo', 'todo', 'todo', 'todo']);
  });
});

describe('old saved screens', () => {
  it('maps go() aliases used by older code', () => {
    expect(normalizeScreen('c1')).toBe('context');
    expect(normalizeScreen('c2')).toBe('setup');
    expect(normalizeScreen('c3')).toBe('specialist');
    expect(normalizeScreen('deep')).toBe('deep');
    expect(normalizeScreen('nonsense')).toBe('context');
  });

  it('resumes old context screens sensibly', () => {
    const partial = { ...blankCtx(), role: 'owner' as const, ownershipTags: ['pe' as const], managementModel: 'employed' as const };
    expect(migrateScreen('c1', partial, {}, {})).toBe('context');
    expect(migrateScreen('c2', partial, {}, {})).toBe('context');
    expect(migrateScreen('c3', partial, {}, {})).toBe('context');
    expect(migrateScreen('c3', ctx(), {}, {})).toBe('discovery');
  });

  it('sends an old summary to discovery when discovery has not started, otherwise to the summary', () => {
    expect(migrateScreen('summary', ctx(), {}, {})).toBe('discovery');
    expect(migrateScreen('summary', ctx(), { E01: ['Customer loyalty'] }, {})).toBe('summary');
    expect(migrateScreen('summary', ctx(), {}, { Q12: sub(50) })).toBe('summary');
  });

  it('keeps later screens unchanged', () => {
    for (const s of ['discovery', 'picture', 'deep', 'result'] as const) expect(migrateScreen(s, ctx(), {}, {})).toBe(s);
  });
});

describe('setup workload and earlier facts', () => {
  it('counts open setup questions', () => {
    expect(openSetupQuestions(ctx())).toBe(0);
    expect(openSetupQuestions(blankCtx())).toBe(14);
  });

  it('links related facts without touching scoring', () => {
    const c = ctx({ objectives: ['succession'], liquidity: 'no_pressure' });
    const diag = { E03: '50 to 75%', E04: 'Over 30%', E07: 'Suppliers' };
    expect(earlierFact('Q09', c, diag)).toEqual({ kind: 'largestCustomer', value: 'Over 30%' });
    expect(earlierFact('Q10', c, diag)).toEqual({ kind: 'committedRevenue', value: '50 to 75%' });
    expect(earlierFact('Q16', c, diag)).toEqual({ kind: 'growthConstraint', value: 'Suppliers' });
    expect(earlierFact('Q01', c, diag)).toEqual({ kind: 'objectives', value: ['succession'] });
    expect(earlierFact('Q08', c, diag)).toEqual({ kind: 'liquidity', value: 'no_pressure' });
    expect(earlierFact('Q09', c, {})).toBeNull();
    expect(earlierFact('Q20', c, diag)).toBeNull();
  });
});

describe('discovery order', () => {
  it('starts with strengths, largest customer and decisions, and keeps the same eight screens and controls', () => {
    expect(DISCOVERY.slice(0, 3).map((d) => d.id)).toEqual(['E01', 'E04', 'E05']);
    expect(DISCOVERY.map((d) => d.id).sort()).toEqual(['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08']);
    expect(DISCOVERY.flatMap((d) => (d.kind === 'control' ? [d.control] : [])).sort()).toEqual([...DISCOVERY_REUSED].sort());
    for (const id of DISCOVERY_REUSED) expect(QUESTION_BY_ID[id]).toBeDefined();
  });
});

describe('reconciliation compares local and online state', () => {
  const row = (over: Partial<Parameters<typeof answerMatches>[1] & object> = {}) => ({
    id: 'r1', question_id: 'Q01', status: 'substantive', points: 50, value: null, requires_reconfirmation: false, inactive_since: null, na_reason: null, ...over,
  });

  it('matches identical answers and detects differences', () => {
    expect(answerMatches(sub(50), row())).toBe(true);
    expect(answerMatches(sub(100), row())).toBe(false);
    expect(answerMatches({ ...sub(50), requiresReconfirmation: true }, row())).toBe(false);
    expect(answerMatches(sub(50), undefined)).toBe(false);
    expect(answerMatches(null, undefined)).toBe(true);
    expect(answerMatches(null, row({ status: 'cleared', points: null }))).toBe(true);
    expect(answerMatches(null, row())).toBe(false);
  });

  it('compares diagnostics by stored status and value', () => {
    expect(diagnosticMatches('Over 30%', row({ status: 'diagnostic', points: null, value: 'Over 30%' }))).toBe(true);
    expect(diagnosticMatches(['A', 'B'], row({ status: 'diagnostic', points: null, value: ['A'] }))).toBe(false);
    expect(diagnosticMatches('Unknown', row({ status: 'unknown', points: null }))).toBe(true);
    expect(diagnosticMatches('Prefer not to answer', undefined)).toBe(false);
  });

  it('compares evidence references', () => {
    const ev = { reference: 'Board minutes', ownerRole: 'CFO', asOfDate: '2026-03-01', reviewStatus: 'dated_reference' as const };
    expect(evidenceMatches(ev, { question_id: 'Q01', reference: 'Board minutes', owner_role: 'CFO', as_of_date: '2026-03-01' })).toBe(true);
    expect(evidenceMatches(ev, undefined)).toBe(false);
    expect(evidenceMatches(null, undefined)).toBe(true);
  });
});
