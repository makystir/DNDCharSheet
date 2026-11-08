/**
 * ORACLE test for the Warlock Eldritch Invocation catalog (Stage 3).
 *
 * Compares EVERY record in src/data/invocations.ts to the independently
 * authored golden (./invocations-golden.ts, from PHB 2024 L6904-L7078).
 * Fails closed: messages name `<id>.<field>`; cardinality (28), the repeatable
 * set and prerequisite integrity (targets exist, no cycles) are asserted
 * separately from the per-record loop.
 */
import { describe, it, expect } from 'vitest';
import { INVOCATION_CATALOG, INVOCATION_LIST, getInvocation } from '../invocations';
import {
  GOLDEN_INVOCATION_COUNT,
  GOLDEN_REPEATABLE_INVOCATION_IDS,
  INVOCATIONS_GOLDEN,
} from './invocations-golden';

describe('Eldritch Invocation catalog oracle', () => {
  it(`has exactly ${GOLDEN_INVOCATION_COUNT} invocations (cardinality)`, () => {
    expect(INVOCATIONS_GOLDEN).toHaveLength(GOLDEN_INVOCATION_COUNT);
    expect(INVOCATION_LIST).toHaveLength(GOLDEN_INVOCATION_COUNT);
  });

  it('has no missing and no extra records (by name)', () => {
    const want = INVOCATIONS_GOLDEN.map((g) => g.id).sort();
    const have = Object.keys(INVOCATION_CATALOG).sort();
    expect(want.filter((id) => !have.includes(id)), 'missing from catalog').toEqual([]);
    expect(have.filter((id) => !want.includes(id)), 'extra in catalog').toEqual([]);
  });

  for (const g of INVOCATIONS_GOLDEN) {
    it(`${g.id} matches the PHB`, () => {
      const r = getInvocation(g.id);
      expect(r, `${g.id} exists`).toBeDefined();
      if (!r) return;
      expect(r.id, `${g.id}.id`).toBe(g.id);
      expect(r.name, `${g.id}.name`).toBe(g.name);
      expect(r.minLevel, `${g.id}.minLevel`).toBe(g.minLevel);
      expect(r.requiresInvocation, `${g.id}.requiresInvocation`).toBe(g.requiresInvocation);
      expect(r.requiresCantrip, `${g.id}.requiresCantrip`).toBe(g.requiresCantrip);
      expect(r.cantripMinRangeFeet, `${g.id}.cantripMinRangeFeet`).toBe(g.cantripMinRangeFeet);
      expect(r.repeatable, `${g.id}.repeatable`).toBe(g.repeatable);
      expect(r.param, `${g.id}.param`).toBe(g.param);
      expect(r.source, `${g.id}.source cites L${g.line}`).toContain(`L${g.line}`);
      expect(r.summary.trim().length, `${g.id}.summary is non-empty`).toBeGreaterThan(10);
    });
  }

  it('the repeatable set is exactly Agonizing Blast, Eldritch Spear, Lessons, Repelling Blast', () => {
    const have = INVOCATION_LIST.filter((i) => i.repeatable).map((i) => i.id).sort();
    expect(have).toEqual([...GOLDEN_REPEATABLE_INVOCATION_IDS].sort());
  });

  it('every requiresInvocation target exists and no prerequisite chain cycles', () => {
    for (const i of INVOCATION_LIST) {
      const seen = new Set<string>([i.id]);
      let cur = i.requiresInvocation;
      while (cur) {
        const t = getInvocation(cur);
        expect(t, `${i.id}.requiresInvocation target ${cur} exists`).toBeDefined();
        expect(seen.has(cur), `${i.id} prerequisite chain cycles at ${cur}`).toBe(false);
        seen.add(cur);
        cur = t?.requiresInvocation;
      }
    }
  });

  it('a prerequisite invocation is never a higher level than the invocation that needs it', () => {
    for (const i of INVOCATION_LIST) {
      if (!i.requiresInvocation) continue;
      const t = getInvocation(i.requiresInvocation);
      expect(t && t.minLevel <= i.minLevel, `${i.id} needs ${i.requiresInvocation} at a level it can hold`).toBe(true);
    }
  });
});
