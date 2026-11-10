// Contract tests for the generated narrative: facts stay limited to the stored
// result, and the validator rejects anything the brief rules out.
import { describe, expect, it } from 'vitest';
import { buildResult } from '../../../src/model/plan';
import { applicableQuestions, resolveRoutes } from '../../../src/model/routing';
import type { Answer, AnswerMap, AssessmentContext, Points } from '../../../src/model/types';
import {
  buildFacts, knownQuestionIds, OUTPUT_SCHEMA, SECTIONS, systemPrompt, validateNarrative,
  type Narrative, type SnapshotLike,
} from './narrative';

const T = '2026-11-10T10:00:00.000Z';
const ctx: AssessmentContext = {
  role: 'owner', ownershipTags: ['private_family'], managementModel: 'owner_led', profile: 'OWNER',
  objectives: ['full_sale'], perimeter: 'whole_business', horizon: 'under_6', liquidity: 'no_pressure',
  triggers: { debt: 'yes', acquisitions: 'no', employee_equity: 'no', preferences: 'no', convertibles: 'no', regulated: 'no', contingent: 'no', group_dependency: 'no' },
  sellerType: 'individuals', sellerTaxStatus: 'same',
  company: { businessModel: null, sector: null, revenueBand: null, employeeBand: null, jurisdiction: 'Germany' },
};
const sub = (points: Points): Answer => ({ status: 'substantive', points, answeredAt: T });
const pattern: Points[] = [100, 50, 0, 100, 50];
const answers: AnswerMap = Object.fromEntries(
  applicableQuestions(resolveRoutes(ctx)).map((q, i) => [q.id, i % 7 === 6 ? { status: 'unknown', answeredAt: T } as Answer : sub(pattern[i % pattern.length])]),
);
answers.Q04 = sub(0);
answers.Q21 = { ...sub(100), evidence: { reference: 'Secret board minutes, data room 4.2', ownerRole: 'CFO', asOfDate: '2026-10-01', reviewStatus: 'dated_reference' } };

const { score, ...rest } = buildResult(ctx, answers, T);
const snapshot = { ...rest, dimensions: score.dimensions } as unknown as SnapshotLike;
const facts = buildFacts(snapshot);
const ids = knownQuestionIds(snapshot);

function good(): Narrative {
  const d = facts.dimensions[1];
  return {
    summary: [
      { kind: 'reported', text: `You reported answers covering ${d.answer_coverage_percent}% of operational transferability.`, question_ids: ['Q07'] },
      { kind: 'implication', text: 'This may mean that the remaining open questions still change the picture.', question_ids: [] },
    ],
    strengths: [{ kind: 'reported', text: 'You reported that prioritised objectives are documented.', question_ids: ['Q01'] }],
    priorities: [{ kind: 'next_step', text: 'Suggested next step: map the required approvals and name their owner before launch.', question_ids: ['Q04'] }],
    tax: [{ kind: 'next_step', text: 'Suggested next step: agree the scope of the transaction tax workstream with your adviser.', question_ids: ['Q25'] }],
  };
}
const withText = (text: string, kind: Narrative['summary'][number]['kind'] = 'implication', qids: string[] = ['Q07']) =>
  ({ ...good(), summary: [{ kind, text, question_ids: qids }] });

describe('facts', () => {
  it('carry ids and metrics but no evidence references or seller tax details', () => {
    const s = JSON.stringify(facts);
    expect(s).not.toContain('Secret board minutes');
    expect(s).not.toContain('sellerTaxStatus');
    expect(s).not.toContain('Germany');
    expect(facts.dimensions).toHaveLength(3);
    expect(facts.risks.some((r) => r.rule === 'R02')).toBe(true);
  });
  it('limit the task list', () => {
    expect(facts.priority_tasks.length).toBeLessThanOrEqual(12);
    expect(facts.total_tasks).toBe(snapshot.tasks.length);
  });
});

describe('output schema and prompt', () => {
  it('requires the four sections with closed objects', () => {
    expect(OUTPUT_SCHEMA.required).toEqual([...SECTIONS]);
    expect(OUTPUT_SCHEMA.additionalProperties).toBe(false);
  });
  it('asks for German in German', () => {
    expect(systemPrompt('de')).toContain('German');
    expect(systemPrompt('en')).toContain('British English');
  });
});

describe('validateNarrative', () => {
  it('accepts a grounded narrative', () => {
    const v = validateNarrative(good(), facts, ids);
    expect(v.ok).toBe(true);
  });
  it('rejects unknown question ids', () => {
    expect(validateNarrative(withText('This may mean more work is needed.', 'implication', ['Q99']), facts, ids).ok).toBe(false);
  });
  it('rejects a reported paragraph without ids', () => {
    expect(validateNarrative(withText('You reported that most answers are complete.', 'reported', []), facts, ids).ok).toBe(false);
  });
  it('rejects truncated text', () => {
    expect(validateNarrative(withText('This may mean that the remaining open questions still'), facts, ids).ok).toBe(false);
  });
  it('rejects numbers that are not in the facts', () => {
    expect(validateNarrative(withText('This may mean an overall readiness of 987 points.'), facts, ids).ok).toBe(false);
  });
  it('allows question ids next to numbers that are in the facts', () => {
    const d = facts.dimensions[0];
    expect(validateNarrative(withText(`Q04 is open and coverage is ${d.answer_coverage_percent}%.`), facts, ids).ok).toBe(true);
  });
  it.each([
    'This may support a valuation at the upper end.',
    'Buyers may pay a higher EBITDA multiple for this.',
    'The probability of a sale is high.',
    'This structure may create tax savings for the sellers.',
    'Your financial package is verified.',
    'The deal could reach EUR 20 million.',
    'Das kann die Unternehmensbewertung erhöhen.',
    'Das kann zu einer Steuerersparnis führen.',
    'Die Verkaufswahrscheinlichkeit steigt dadurch.',
  ])('rejects forbidden wording: %s', (text) => {
    expect(validateNarrative(withText(text), facts, ids).ok).toBe(false);
  });
  it('accepts ordinary uses of "multiple"', () => {
    expect(validateNarrative(withText('This may mean that multiple jurisdictions need coordinated advice.'), facts, ids).ok).toBe(true);
  });
  it('rejects missing or oversized sections and markup', () => {
    const n = good() as Partial<Narrative>;
    delete n.tax;
    expect(validateNarrative(n, facts, ids).ok).toBe(false);
    expect(validateNarrative({ ...good(), strengths: Array(4).fill(good().strengths[0]) }, facts, ids).ok).toBe(false);
    expect(validateNarrative(withText('**This may mean** more preparation.'), facts, ids).ok).toBe(false);
  });
});
