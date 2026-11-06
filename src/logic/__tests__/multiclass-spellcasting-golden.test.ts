/**
 * Stage M3 (multiclassing: spellcasting) golden-table tests.
 *
 * Consumes ALL FIVE groups from multiclass-spellcasting-golden.ts (orchestrator-
 * authored, NOT edited here) and iterates each with it.each, building multiclass
 * casters directly via classes[] + byClass. Verifies the combined Multiclass
 * Spellcaster slot table (== FULL_CASTER_SLOTS), the combined caster-level
 * weighting, the combined slot vector, the single-vs-combined special case, and
 * per-class spell save DC / attack.
 *
 * PHB 2024 "Multiclassing: Spellcasting" (Docs/PlayersHandbook.md L2119-2165).
 */

import { describe, it, expect } from 'vitest';
import type { Ability as GAbility, ClassId as GClassId } from './multiclass-spellcasting-golden';
import {
  COMBINED_CASTER_LEVEL_CASES,
  COMBINED_SLOTS_CASES,
  MULTICLASS_SLOT_TABLE_CASES,
  PER_CLASS_DC_CASES,
  SINGLE_CASTER_CASES,
} from './multiclass-spellcasting-golden';
import type { AbilityScores, Character, ClassEntry } from '../../types/character';
import { CURRENT_VERSION } from '../../types/character';
import type { ClassId, SubclassId } from '../../data/classes';
import { FULL_CASTER_SLOTS } from '../../data/spell-progression';
import {
  combinedCasterLevel,
  effectiveSpellSlots,
  isCombinedSpellcaster,
  multiclassSpellSlots,
  perClassSpellcasting,
} from '../spellcasting';

const DEFAULT_SCORES: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

/** Builds a multiclass character directly from the golden's class spec. */
function buildCharacter(
  classes: { id: GClassId; level: number; subclassId?: string }[],
  scores: AbilityScores = DEFAULT_SCORES,
  totalLevel?: number,
): Character {
  const entries: ClassEntry[] = classes.map((c) => ({
    id: c.id as ClassId,
    level: c.level,
    ...(c.subclassId ? { subclassId: c.subclassId as SubclassId } : {}),
  }));
  const level = totalLevel ?? entries.reduce((sum, e) => sum + e.level, 0);
  return {
    _v: CURRENT_VERSION,
    id: 'test',
    name: 'Test',
    level,
    abilities: { ...scores },
    classes: entries,
    createdAt: 0,
    updatedAt: 0,
  } as Character;
}

/** The slots-per-spell-level 1..9 tail of a 1-indexed slot vector. */
function tail(slots: readonly number[] | undefined): number[] {
  if (!slots) return [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const out: number[] = [];
  for (let i = 1; i <= 9; i++) out.push(slots[i] ?? 0);
  return out;
}

describe('MULTICLASS_SLOT_TABLE_CASES — combined table == FULL_CASTER_SLOTS', () => {
  // Structural equivalence across the full range: the implementation's combined
  // slot lookup for caster level N must equal FULL_CASTER_SLOTS[N] for 1..20.
  it('multiclassSpellSlots at combined level N equals FULL_CASTER_SLOTS[N] for 1..20', () => {
    for (let n = 1; n <= 20; n++) {
      // A single full-caster class of level N yields combined caster level N for
      // n in 1..20, but a lone Spellcasting class routes through effectiveSpell-
      // Slots; to exercise the COMBINED lookup directly we assert the combined
      // table function against two full casters summing to N where possible, and
      // fall back to the direct multiclassSpellSlots probe via a wizard+cleric.
      const a = Math.floor(n / 2);
      const b = n - a;
      const parts: { id: GClassId; level: number }[] = [];
      if (a > 0) parts.push({ id: 'cleric', level: a });
      if (b > 0) parts.push({ id: 'wizard', level: b });
      const c = buildCharacter(parts);
      expect(combinedCasterLevel(c)).toBe(n);
      expect(multiclassSpellSlots(c)).toEqual(FULL_CASTER_SLOTS[n]);
    }
  });

  it.each(MULTICLASS_SLOT_TABLE_CASES)('row CL %# pins FULL_CASTER_SLOTS', (row) => {
    // Spot-check: the pinned row equals FULL_CASTER_SLOTS[casterLevel] tail 1..9.
    expect(tail(FULL_CASTER_SLOTS[row.casterLevel])).toEqual(row.slots);
  });
});

describe('COMBINED_CASTER_LEVEL_CASES — combinedCasterLevel weighting', () => {
  it.each(COMBINED_CASTER_LEVEL_CASES)('$name', (testCase) => {
    const c = buildCharacter(testCase.classes);
    expect(combinedCasterLevel(c)).toBe(testCase.expect);
  });
});

describe('COMBINED_SLOTS_CASES — combined slot vector = FULL_CASTER_SLOTS[CL]', () => {
  it.each(COMBINED_SLOTS_CASES)('$name', (testCase) => {
    const c = buildCharacter(testCase.classes);
    // All COMBINED_SLOTS_CASES have 2+ Spellcasting classes → the combined table.
    expect(tail(multiclassSpellSlots(c))).toEqual(testCase.slots);
    // effectiveSpellSlots routes multi-caster characters through the same table.
    expect(tail(effectiveSpellSlots(c))).toEqual(testCase.slots);
  });
});

describe('SINGLE_CASTER_CASES — single-vs-combined special case', () => {
  it.each(SINGLE_CASTER_CASES)('$name', (testCase) => {
    const c = buildCharacter(testCase.classes);
    expect(isCombinedSpellcaster(c)).toBe(testCase.isCombined);
    expect(tail(effectiveSpellSlots(c))).toEqual(testCase.slots);
  });
});

describe('PER_CLASS_DC_CASES — per-class spell save DC / attack', () => {
  it.each(PER_CLASS_DC_CASES)('$name', (testCase) => {
    const scores = testCase.scores as Record<GAbility, number> as AbilityScores;
    const c = buildCharacter(testCase.classes, scores, testCase.totalLevel);
    const summaries = perClassSpellcasting(c);
    // One summary per casting class, in stored order; match the golden pairs.
    const byClass = new Map(summaries.map((s) => [s.classId as GClassId, s]));
    expect(summaries.length).toBe(testCase.expect.length);
    for (const want of testCase.expect) {
      const got = byClass.get(want.classId);
      expect(got, `summary for ${want.classId}`).toBeDefined();
      expect(got!.saveDc.total).toBe(want.dc);
      expect(got!.attack.total).toBe(want.attack);
      // Breakdown invariant (calculated-totals steering): components sum to total.
      expect(got!.saveDc.components.reduce((s, x) => s + x.value, 0)).toBe(want.dc);
      expect(got!.attack.components.reduce((s, x) => s + x.value, 0)).toBe(want.attack);
    }
  });
});
