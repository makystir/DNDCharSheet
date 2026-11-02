import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ABILITIES } from '../../types/character';
import type { AbilityScores } from '../../types/character';
import { abilityModifier, proficiencyBonus } from '../abilities';
import {
  savingThrowModifier,
  savingThrowBreakdown,
  allSavingThrowBreakdowns,
} from '../saving-throws';
import { createCharacter } from '../../storage/character-store';

const SCORES: AbilityScores = { str: 10, dex: 14, con: 12, int: 16, wis: 13, cha: 8 };

describe('savingThrowBreakdown', () => {
  it('not proficient: ability mod only', () => {
    const bd = savingThrowBreakdown(SCORES, 1, 'con', false);
    expect(bd.total).toBe(1); // Con 12 → +1
    expect(bd.components.map((c) => c.value)).toEqual([1, 0]);
  });

  it('proficient: ability mod + PB', () => {
    const bd = savingThrowBreakdown(SCORES, 1, 'con', true);
    expect(bd.total).toBe(3); // +1 Con + 2 PB
    expect(bd.components.map((c) => c.value)).toEqual([1, 2]);
  });

  it('property: total === abilityMod + (prof?PB:0) for every ability', () => {
    fc.assert(
      fc.property(
        fc.record({
          str: fc.integer({ min: 1, max: 30 }),
          dex: fc.integer({ min: 1, max: 30 }),
          con: fc.integer({ min: 1, max: 30 }),
          int: fc.integer({ min: 1, max: 30 }),
          wis: fc.integer({ min: 1, max: 30 }),
          cha: fc.integer({ min: 1, max: 30 }),
        }),
        fc.integer({ min: 1, max: 20 }),
        fc.constantFrom(...ABILITIES),
        fc.boolean(),
        (scores, level, ability, proficient) => {
          const expected =
            abilityModifier(scores[ability]) +
            (proficient ? proficiencyBonus(level) : 0);
          const bd = savingThrowBreakdown(scores, level, ability, proficient);
          expect(bd.total).toBe(expected);
          expect(savingThrowModifier(scores, level, ability, proficient)).toBe(expected);
          expect(bd.components.reduce((s, c) => s + c.value, 0)).toBe(bd.total);
        },
      ),
    );
  });
});

describe('allSavingThrowBreakdowns', () => {
  it('returns a breakdown for all six abilities, defaulting to non-proficient', () => {
    const c = createCharacter('T');
    const all = allSavingThrowBreakdowns(c);
    expect(Object.keys(all).length).toBe(6);
    // Default scores are 10 (+0) and no proficiencies → all totals 0.
    for (const ability of ABILITIES) {
      expect(all[ability].total).toBe(0);
    }
  });
});
