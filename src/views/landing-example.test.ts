// R07: the landing-page example must come from the live formula and show the
// three states it describes (indicative, complete, insufficient coverage).
import { describe, expect, it } from 'vitest';
import { exampleReport } from './landing-example';
import { COPY } from './landing-copy';

describe('landing example report', () => {
  const ex = exampleReport();

  it('has one entry per dimension in the order of the copy', () => {
    expect(ex.map((e) => e.result.key)).toEqual(['S', 'O', 'T']);
    for (const lang of ['en', 'de'] as const) {
      COPY[lang].dims.forEach((d, i) => expect(d.domains).toHaveLength(ex[i].result.domains.length));
    }
  });

  it('shows the three statuses the copy explains', () => {
    expect(ex.map((e) => e.result.status)).toEqual(['indicative', 'complete', 'insufficient_coverage']);
  });

  it('reconciles index, coverage and missing-answer range with each other', () => {
    for (const { result: d } of ex) {
      expect(d.lower).toBeLessThanOrEqual(d.upper);
      if (d.displayIndex != null) {
        // L = R × C and U = L + (1 − C) × 100 (brief section 7)
        expect(d.lower).toBeCloseTo((d.rawIndex ?? 0) * d.coverage, 6);
        expect(d.upper).toBeCloseTo(d.lower + (1 - d.coverage) * 100, 6);
      }
    }
    const s = ex[0].result;
    expect(s.displayIndex).toBe(64);
    expect([Math.round(s.lower), Math.round(s.upper)]).toEqual([56, 68]);
  });

  it('takes each risk from the real risk rules', () => {
    expect(ex[0].risk?.rule).toBe('R02');
    expect(ex[0].risk?.severity).toBe('critical');
    expect(ex[1].risk?.rule).toBe('LIQ');
    expect(ex[2].risk?.rule).toBe('R04');
  });
});
