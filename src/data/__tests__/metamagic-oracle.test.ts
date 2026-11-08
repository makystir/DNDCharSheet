/**
 * ORACLE test for the Sorcerer Metamagic catalog (Stage 3).
 *
 * Compares EVERY record in src/data/metamagic.ts to the independently authored
 * golden (./metamagic-golden.ts, from PHB 2024 L6373-L6428). Fails closed:
 * messages name `<id>.<field>`, missing and extra records fail by name, and the
 * cardinality (10) is asserted separately from the per-record loop.
 */
import { describe, it, expect } from 'vitest';
import { METAMAGIC_CATALOG, METAMAGIC_LIST, getMetamagic } from '../metamagic';
import { GOLDEN_METAMAGIC_COUNT, METAMAGIC_GOLDEN } from './metamagic-golden';

describe('Metamagic catalog oracle', () => {
  it(`has exactly ${GOLDEN_METAMAGIC_COUNT} options (cardinality)`, () => {
    expect(METAMAGIC_GOLDEN).toHaveLength(GOLDEN_METAMAGIC_COUNT);
    expect(METAMAGIC_LIST).toHaveLength(GOLDEN_METAMAGIC_COUNT);
  });

  it('has no missing and no extra records (by name)', () => {
    const want = METAMAGIC_GOLDEN.map((g) => g.id).sort();
    const have = Object.keys(METAMAGIC_CATALOG).sort();
    expect(want.filter((id) => !have.includes(id)), 'missing from catalog').toEqual([]);
    expect(have.filter((id) => !want.includes(id)), 'extra in catalog').toEqual([]);
  });

  for (const g of METAMAGIC_GOLDEN) {
    it(`${g.id} matches the PHB`, () => {
      const r = getMetamagic(g.id);
      expect(r, `${g.id} exists`).toBeDefined();
      if (!r) return;
      expect(r.id, `${g.id}.id`).toBe(g.id);
      expect(r.name, `${g.id}.name`).toBe(g.name);
      expect(r.cost, `${g.id}.cost`).toBe(g.cost);
      expect(r.stacksWithOtherOption, `${g.id}.stacksWithOtherOption`).toBe(g.stacksWithOtherOption);
      expect(r.source, `${g.id}.source cites L${g.line}`).toContain(`L${g.line}`);
      expect(r.summary.trim().length, `${g.id}.summary is non-empty`).toBeGreaterThan(10);
    });
  }

  it('only Heightened and Quickened cost 2 Sorcery Points', () => {
    const two = METAMAGIC_LIST.filter((m) => m.cost === 2).map((m) => m.id).sort();
    expect(two).toEqual(['heightened-spell', 'quickened-spell']);
  });
});
