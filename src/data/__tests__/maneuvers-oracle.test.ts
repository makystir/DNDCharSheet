/**
 * ORACLE test for the Battle Master maneuver catalog (Stage 3).
 *
 * Compares EVERY record in src/data/maneuvers.ts to the independently authored
 * golden (./maneuvers-golden.ts, from PHB 2024 L4265-L4309) and cross-checks
 * the 20 names already listed on the Battle Master "Combat Superiority" feature
 * in src/data/classes.ts. Fails closed: messages name `<id>.<field>`;
 * cardinality (20) is asserted separately.
 */
import { describe, it, expect } from 'vitest';
import { MANEUVER_CATALOG, MANEUVER_LIST, getManeuver } from '../maneuvers';
import { CLASS_CATALOG } from '../classes';
import { GOLDEN_MANEUVER_COUNT, MANEUVERS_GOLDEN } from './maneuvers-golden';

describe('Battle Master maneuver catalog oracle', () => {
  it(`has exactly ${GOLDEN_MANEUVER_COUNT} maneuvers (cardinality)`, () => {
    expect(MANEUVERS_GOLDEN).toHaveLength(GOLDEN_MANEUVER_COUNT);
    expect(MANEUVER_LIST).toHaveLength(GOLDEN_MANEUVER_COUNT);
  });

  it('has no missing and no extra records (by name)', () => {
    const want = MANEUVERS_GOLDEN.map((g) => g.id).sort();
    const have = Object.keys(MANEUVER_CATALOG).sort();
    expect(want.filter((id) => !have.includes(id)), 'missing from catalog').toEqual([]);
    expect(have.filter((id) => !want.includes(id)), 'extra in catalog').toEqual([]);
  });

  for (const g of MANEUVERS_GOLDEN) {
    it(`${g.id} matches the PHB`, () => {
      const r = getManeuver(g.id);
      expect(r, `${g.id} exists`).toBeDefined();
      if (!r) return;
      expect(r.id, `${g.id}.id`).toBe(g.id);
      expect(r.name, `${g.id}.name`).toBe(g.name);
      expect(r.trigger, `${g.id}.trigger`).toBe(g.trigger);
      expect(r.save, `${g.id}.save`).toBe(g.save);
      expect(r.source, `${g.id}.source cites L${g.line}`).toContain(`L${g.line}`);
      expect(r.summary.trim().length, `${g.id}.summary is non-empty`).toBeGreaterThan(10);
    });
  }

  it('matches the maneuver names on the Battle Master Combat Superiority feature in classes.ts', () => {
    const bm = CLASS_CATALOG.fighter.subclasses.find((s) => s.id === 'battleMaster');
    const feat = bm?.features.find((f) => f.choices?.some((c) => c.key === 'maneuvers'));
    const names = feat?.choices?.find((c) => c.key === 'maneuvers')?.options ?? [];
    expect([...names].sort()).toEqual(MANEUVERS_GOLDEN.map((g) => g.name).sort());
  });
});
