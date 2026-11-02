import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  abilityModifier,
  proficiencyBonus,
  clampAbilityScore,
  clampLevel,
  MIN_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  MIN_LEVEL,
  MAX_LEVEL,
} from '../abilities';

/**
 * The 2024 PHB "Ability Modifiers" table, transcribed as score→modifier.
 * The abilityModifier() formula must reproduce this exactly.
 */
const PHB_MODIFIER_TABLE: Array<[number, number]> = [
  [1, -5],
  [2, -4], [3, -4],
  [4, -3], [5, -3],
  [6, -2], [7, -2],
  [8, -1], [9, -1],
  [10, 0], [11, 0],
  [12, 1], [13, 1],
  [14, 2], [15, 2],
  [16, 3], [17, 3],
  [18, 4], [19, 4],
  [20, 5], [21, 5],
  [22, 6], [23, 6],
  [24, 7], [25, 7],
  [26, 8], [27, 8],
  [28, 9], [29, 9],
  [30, 10],
];

/** PHB "Character Advancement" table: level→proficiency bonus. */
const PHB_PROFICIENCY_TABLE: Array<[number, number]> = [
  [1, 2], [2, 2], [3, 2], [4, 2],
  [5, 3], [6, 3], [7, 3], [8, 3],
  [9, 4], [10, 4], [11, 4], [12, 4],
  [13, 5], [14, 5], [15, 5], [16, 5],
  [17, 6], [18, 6], [19, 6], [20, 6],
];

describe('abilityModifier', () => {
  it('matches the PHB 2024 Ability Modifiers table exactly', () => {
    for (const [score, expected] of PHB_MODIFIER_TABLE) {
      expect(abilityModifier(score)).toBe(expected);
    }
  });

  it('formula equals floor((score - 10) / 2) for all legal scores', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_ABILITY_SCORE, max: MAX_ABILITY_SCORE }),
        (score) => {
          expect(abilityModifier(score)).toBe(Math.floor((score - 10) / 2));
        },
      ),
    );
  });
});

describe('proficiencyBonus', () => {
  it('matches the PHB 2024 Character Advancement table exactly', () => {
    for (const [level, expected] of PHB_PROFICIENCY_TABLE) {
      expect(proficiencyBonus(level)).toBe(expected);
    }
  });
});

describe('clampAbilityScore', () => {
  it('keeps scores within 1–30 and truncates to integers', () => {
    expect(clampAbilityScore(0)).toBe(MIN_ABILITY_SCORE);
    expect(clampAbilityScore(99)).toBe(MAX_ABILITY_SCORE);
    expect(clampAbilityScore(14.9)).toBe(14);
    expect(clampAbilityScore(Number.NaN)).toBe(MIN_ABILITY_SCORE);
  });
});

describe('clampLevel', () => {
  it('keeps levels within 1–20', () => {
    expect(clampLevel(0)).toBe(MIN_LEVEL);
    expect(clampLevel(50)).toBe(MAX_LEVEL);
    expect(clampLevel(Number.NaN)).toBe(MIN_LEVEL);
  });
});
