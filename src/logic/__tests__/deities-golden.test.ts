/**
 * Golden-table harness for the Gods of Greyhawk deity catalog (D&D 2024).
 *
 * Maps EVERY row of deities-golden.ts (authored by the orchestrator from the
 * DMG 2024 "GODS OF GREYHAWK" table, NEVER edited here) onto the real catalog
 * in ../../data/deities, and asserts the DEITY_CATALOG_ORACLE invariants (exact
 * count, exact id set/order, non-empty required fields). The golden file is
 * pure data with no imports; this harness is the only place those rows are
 * wired to the code. No source file is mutated anywhere.
 */
import { describe, it, expect } from 'vitest';
import { DEITIES, DEITY_LIST, getDeity } from '../../data/deities';
import {
  DEITY_CASES,
  DEITY_CATALOG_ORACLE,
  type DeityGoldenCase,
} from './deities-golden';

// ─── DEITY_CASES harness (every row reproduced by the real catalog) ──────────

describe('DEITY_CASES golden harness (DEITIES catalog)', () => {
  it.each(DEITY_CASES.map((c) => [c.id, c] as const))(
    '%s',
    (_id, tc: DeityGoldenCase) => {
      const deity = getDeity(tc.id);
      expect(deity).toBeDefined();
      expect(deity).toEqual({
        id: tc.id,
        name: tc.name,
        epithet: tc.epithet,
        rank: tc.rank,
        homePlane: tc.homePlane,
        worshipers: tc.worshipers,
        symbol: tc.symbol,
      });
    },
  );

  it('exercises every DEITY_CASES row', () => {
    expect(DEITY_CASES.length).toBeGreaterThan(0);
  });
});

// ─── DEITY_CATALOG_ORACLE invariants ─────────────────────────────────────────

describe('DEITY_CATALOG_ORACLE invariants', () => {
  it('has exactly the oracle count of deities', () => {
    expect(DEITY_LIST).toHaveLength(DEITY_CATALOG_ORACLE.count);
    expect(Object.keys(DEITIES)).toHaveLength(DEITY_CATALOG_ORACLE.count);
  });

  it('has exactly the required ids, in the required order', () => {
    expect(DEITY_LIST.map((d) => d.id)).toEqual(DEITY_CATALOG_ORACLE.requiredIds);
    expect(Object.keys(DEITIES)).toEqual(DEITY_CATALOG_ORACLE.requiredIds);
  });

  it('every deity has non-empty required fields', () => {
    for (const deity of DEITY_LIST) {
      for (const field of DEITY_CATALOG_ORACLE.requiredNonEmptyFields) {
        expect(deity[field]).toBeTruthy();
        expect(deity[field].length).toBeGreaterThan(0);
      }
    }
  });

  it('DEITY_CASES and the oracle agree on the id set/order', () => {
    expect(DEITY_CASES.map((c) => c.id)).toEqual(DEITY_CATALOG_ORACLE.requiredIds);
  });
});
