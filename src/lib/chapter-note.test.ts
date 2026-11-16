// Chapter completion note (brief s.2) and the Saved screen sentence ending.
import { describe, expect, it } from 'vitest';
import { JOURNEY_UI, sentence } from '../i18n/ui-journey';
import type { Answer, AnswerMap, AssessmentContext } from '../model/types';
import { chapterSummary, completeChapters, deepList } from './journey';

const T = '2026-11-10T10:00:00.000Z';
const ctx: AssessmentContext = {
  role: 'owner', ownershipTags: ['private_family'], managementModel: 'owner_led', profile: 'OWNER',
  objectives: ['full_sale'], perimeter: 'whole_business', horizon: 'm6_18', liquidity: 'no_pressure',
  triggers: {}, sellerType: 'individuals', sellerTaxStatus: 'same',
  company: { businessModel: null, sector: null, revenueBand: null, employeeBand: null, jurisdiction: null },
};

describe('chapter note', () => {
  const list = deepList(ctx);
  const finance = list.find((x) => x.q.domain === 'T1')!.chapter;
  const ids = list.filter((x) => x.chapter === finance).map((x) => x.q.id);

  it('a chapter is complete only when every question has a response', () => {
    const answers: AnswerMap = {};
    ids.slice(0, -1).forEach((id) => { answers[id] = { status: 'substantive', points: 50, answeredAt: T }; });
    expect(completeChapters(list, answers)).not.toContain(finance);
    answers[ids[ids.length - 1]] = { status: 'unknown', answeredAt: T };
    expect(completeChapters(list, answers)).toContain(finance);
    answers[ids[0]] = { ...answers[ids[0]], requiresReconfirmation: true };
    expect(completeChapters(list, answers)).not.toContain(finance);
  });

  it('counts recorded answers only and states them without judgement', () => {
    const points = [100, 50, 0];
    const answers: AnswerMap = Object.fromEntries(ids.map((id, i): [string, Answer] => [id, i === ids.length - 1
      ? { status: 'unknown', answeredAt: T }
      : { status: 'substantive', points: points[i % 3] as 0 | 50 | 100, answeredAt: T }]));
    const c = chapterSummary(list, answers, finance);
    expect(c.total).toBe(ids.length);
    expect(c.full + c.work + c.notApplicable + c.open).toBe(c.total);
    expect(c.open).toBe(1);
    const en = JOURNEY_UI.en.chapterNote('Finance', c);
    expect(en).toMatch(/^Finance: \d+ questions with a response; /);
    expect(en).toMatch(/at full preparation/);
    expect(en).toMatch(/1 still open\.$/);
    expect(en).not.toMatch(/great|well done|excellent|warning|risk/i);
    expect(JOURNEY_UI.de.chapterNote('Finanzen', c)).toMatch(/^Finanzen: \d+ Fragen mit Rückmeldung; /);
  });
});

describe('Saved screen sentence', () => {
  it('never ends in a double period after a.m. or p.m.', () => {
    expect(sentence('last saved 2:30 p.m.')).toBe('last saved 2:30 p.m.');
    expect(JOURNEY_UI.en.savedLead(3, 0, 'November 16, 2026, 9:05 a.m.')).not.toMatch(/\.\./);
    expect(JOURNEY_UI.de.savedLead(3, 1, '16.11.2026, 09:05 Uhr')).toMatch(/09:05 Uhr\. Kehren/);
  });
});
