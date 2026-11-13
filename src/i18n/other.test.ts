import { describe, expect, it } from 'vitest';
import { buildResult, buyerInvestigation } from '../model/plan';
import { discoveryOptionLabel, isOther, splitOther } from './localize';
import type { AssessmentContext } from '../model/types';

describe('"Other (specify)" discovery answers', () => {
  it('stores the typed text in the answer value and shows it in both languages', () => {
    expect(isOther('Other')).toBe(true);
    expect(isOther('Other: patents')).toBe(true);
    expect(isOther('Suppliers')).toBe(false);
    expect(splitOther('Other: patents')).toBe('patents');
    expect(discoveryOptionLabel('en', 'E07', 'Other: Export licences')).toBe('Other: Export licences');
    expect(discoveryOptionLabel('de', 'E07', 'Other: Export licences')).toBe('Sonstiges: Export licences');
  });
  it('a typed growth constraint reaches the buyer view as a named constraint', () => {
    const ctx: AssessmentContext = {
      role: 'owner', ownershipTags: ['private_family'], managementModel: 'owner_led', profile: 'OWNER', objectives: ['full_sale'],
      perimeter: 'whole_business', horizon: 'm6_18', liquidity: 'no_pressure', triggers: {}, sellerType: 'individuals', sellerTaxStatus: 'same',
      company: { businessModel: null, sector: null, revenueBand: null, employeeBand: null, jurisdiction: null },
    };
    const r = buildResult(ctx, {}, '2026-11-13T10:00:00.000Z');
    const item = buyerInvestigation({ E07: 'Other: Export licences' }, r.score, 'en').find((x) => x.id === 'E07');
    expect(item?.value).toBe('Other: Export licences');
  });
});
