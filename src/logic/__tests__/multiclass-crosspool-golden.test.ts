/**
 * Stage M5 — the Warlock Pact Magic / Spellcasting CROSS-POOL casting rule
 * (PHB 2024 L2168). Drives the deterministic cross-pool helpers in
 * spellcasting.ts from the orchestrator-authored golden table, reproducing
 * EVERY row. The golden file is DATA-ONLY and MUST NOT be edited; this test
 * adapts each row's abstract pools into the pure-core helper inputs.
 *
 * The golden's `spellcastingSlots` is a 0-indexed per-spell-level vector
 * (index 0 = spell level 1 .. index 8 = spell level 9); the engine's SlotVector
 * is 1-indexed with an unused index 0, so we prefix a 0. A false `hasSpellcasting`
 * / `hasPact` (or a 0 pactLevel) means that pool is absent → undefined.
 */

import { describe, it, expect } from 'vitest';
import {
  HIGHEST_CASTABLE_CASES,
  CAN_CAST_CASES,
} from './multiclass-crosspool-golden';
import type { SlotVector } from '../../data/spell-progression';
import type { Character } from '../../types/character';
import { CURRENT_VERSION } from '../../types/character';
import {
  canCastFromPools,
  canCastPreparedSpell,
  highestCastableLevelFromPools,
  highestCastableSpellLevel,
} from '../spellcasting';

/** The golden's 0-indexed level vector → the engine's 1-indexed SlotVector. */
function toSlotVector(
  hasSpellcasting: boolean,
  spellcastingSlots: number[],
): SlotVector | undefined {
  if (!hasSpellcasting) return undefined;
  return [0, ...spellcastingSlots];
}

/** The golden's pact level → the pure-core pact pool (available = 1 when present). */
function toPactPool(
  hasPact: boolean,
  pactLevel: number,
): { slotLevel: number; available: number } | undefined {
  // pactLevel 0 means no pact pool OR all pact slots expended → no available pool.
  if (!hasPact || pactLevel <= 0) return undefined;
  return { slotLevel: pactLevel, available: 1 };
}

describe('cross-pool casting — highestCastableSpellLevel (PHB 2024 L2168)', () => {
  it.each(HIGHEST_CASTABLE_CASES)('$name', (c) => {
    const slots = toSlotVector(c.hasSpellcasting, c.spellcastingSlots);
    const pact = toPactPool(c.hasPact, c.pactLevel);
    expect(highestCastableLevelFromPools(slots, pact)).toBe(c.expect);
  });
});

describe('cross-pool casting — canCastPreparedSpell (PHB 2024 L2168)', () => {
  it.each(CAN_CAST_CASES)('$name', (c) => {
    // CAN_CAST_CASES always carries a Spellcasting vector; a non-zero pactLevel
    // means a pact pool is present (hasPact is implied by pactLevel > 0).
    const slots = toSlotVector(true, c.spellcastingSlots);
    const pact = toPactPool(c.pactLevel > 0, c.pactLevel);
    expect(canCastFromPools(c.spellLevel, slots, pact)).toBe(c.expect);
  });
});

/**
 * Character-level adapters (NIT 4): the exported
 * {@link highestCastableSpellLevel} / {@link canCastPreparedSpell} wrap the pure
 * cores with the private availableSpellcastingSlots / availablePactPool
 * subtraction (effectiveSpellSlots − slotsExpended; pactMagicSlotsForClass −
 * pactSlotsExpended). These tests pin the expenditure subtraction end-to-end.
 */
function makeCharacter(partial: Partial<Character>): Character {
  return {
    _v: CURRENT_VERSION,
    id: 'test',
    name: 'Test',
    level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 16 },
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe('cross-pool casting — character-level expenditure subtraction', () => {
  // Wizard 5 / Warlock 3: ONLY the Wizard counts toward the combined caster
  // level (Warlock Pact Magic is excluded from the sum — PHB L2156-2163), so
  // the combined pool is a level-5 full caster (top = 3rd-level slots). The
  // separate Pact Magic pool is a Warlock-3 pool (2nd-level slots). Both pools
  // exist, so cross-pool casting applies (PHB 2024 L2168).
  const wizWarlock = (
    slotsExpended?: Partial<Record<number, number>>,
    pactSlotsExpended?: number,
  ): Character =>
    makeCharacter({
      level: 8,
      classes: [
        { id: 'wizard', level: 5 },
        { id: 'warlock', level: 3 },
      ],
      spellcasting: { slotsExpended, pactSlotsExpended },
    });

  it('subtracts expended Spellcasting slots from the available top level', () => {
    // Fresh: the combined (Wizard-5) pool reaches 3rd level → highest castable 3.
    expect(highestCastableSpellLevel(wizWarlock())).toBe(3);
    // Expend every 3rd-level Spellcasting slot; the pact pool (level 2) remains,
    // so the cross-pool highest drops to 2 (the pact slot level).
    const spent = wizWarlock({ 3: 99 });
    expect(highestCastableSpellLevel(spent)).toBe(2);
    expect(canCastPreparedSpell(spent, 2)).toBe(true); // pact slot casts it (cross-pool)
    expect(canCastPreparedSpell(spent, 3)).toBe(false); // no slot >= 3 in either pool
  });

  it('a cantrip is always castable even with every slot expended', () => {
    const spent = wizWarlock({ 1: 99, 2: 99, 3: 99 }, 99);
    expect(highestCastableSpellLevel(spent)).toBe(0);
    expect(canCastPreparedSpell(spent, 0)).toBe(true);
    expect(canCastPreparedSpell(spent, 1)).toBe(false);
  });

  it('a single-pool caster (no pact) uses its own pool only', () => {
    const wizard = makeCharacter({ level: 5, classes: [{ id: 'wizard', level: 5 }] });
    expect(highestCastableSpellLevel(wizard)).toBe(3); // Wizard 5 → 3rd-level slots
    const spentTop = makeCharacter({
      level: 5,
      classes: [{ id: 'wizard', level: 5 }],
      spellcasting: { slotsExpended: { 3: 99 } },
    });
    expect(highestCastableSpellLevel(spentTop)).toBe(2);
  });
});
