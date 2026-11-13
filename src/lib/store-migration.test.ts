// Loading a state saved under the old screen order (c1/c2/c3/summary first).
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./remote', () => ({
  onBackupHealth: () => () => undefined,
  track: () => undefined,
  createAssessment: async () => null,
  resetCreation: () => undefined,
}));

const KEY = 'exitiq-assessment-v1';

function withStorage(saved: unknown) {
  const mem = new Map<string, string>([[KEY, JSON.stringify(saved)]]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  });
}

const fullCtx = {
  role: 'owner', ownershipTags: ['private_family'], managementModel: 'owner_led', profile: 'OWNER', objectives: ['full_sale'],
  perimeter: 'whole_business', horizon: 'm6_18', liquidity: 'no_pressure', triggers: {}, sellerType: 'individuals', sellerTaxStatus: 'same',
  company: { businessModel: null, sector: null, revenueBand: null, employeeBand: null, jurisdiction: null },
};

async function load(saved: unknown) {
  vi.resetModules();
  withStorage(saved);
  const store = await import('./store');
  return store.getState();
}

afterEach(() => vi.unstubAllGlobals());

describe('store loads old saves', () => {
  it('old c2 resumes at the new context step', async () => {
    const s = await load({ v: 1, screen: 'c2', ctx: { ...fullCtx, objectives: [], liquidity: null }, answers: {}, diag: {} });
    expect(s.screen).toBe('context');
    expect(s.journey).toBe(2);
  });

  it('old summary before discovery resumes at discovery; a saved pause keeps its target', async () => {
    expect((await load({ v: 1, screen: 'summary', ctx: fullCtx, answers: {}, diag: {} })).screen).toBe('discovery');
    const paused = await load({ v: 1, screen: 'saved', resumeTo: 'c3', ctx: fullCtx, answers: {}, diag: {} });
    expect(paused.screen).toBe('saved');
    expect(paused.resumeTo).toBe('discovery');
  });

  it('a current save with the new summary stays on the summary', async () => {
    const s = await load({ v: 1, journey: 2, screen: 'summary', ctx: fullCtx, answers: {}, diag: {} });
    expect(s.screen).toBe('summary');
    expect(s.reviewAll).toBe(false);
  });
});
