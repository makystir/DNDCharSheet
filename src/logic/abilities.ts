/**
 * Core ability-score and proficiency rules (D&D 5.5e / 2024).
 *
 * Every formula here is verified against the 2024 Player's Handbook and cited
 * inline, per the rules-compliance steering rule. Functions return a Breakdown
 * so the UI can show how each number was derived (calculated-totals steering).
 */

import type { Ability, AbilityScores } from '../types/character';
import { ABILITY_NAMES } from '../types/character';
import type { Breakdown } from './breakdown';

/** Minimum/maximum ability score in the 2024 rules. */
// PHB 2024, "Ability Modifiers" table: scores run from 1 to 30.
export const MIN_ABILITY_SCORE = 1;
export const MAX_ABILITY_SCORE = 30;

/** Minimum/maximum total character level. */
// PHB 2024, "Character Advancement" table: levels 1–20.
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 20;

/**
 * Computes an ability modifier from a score.
 *
 * PHB 2024, "Ability Modifiers": the modifier is derived from the score; the
 * table (score 10–11 → +0, 12–13 → +1, 8–9 → −1, …, 1 → −5, 30 → +10)
 * is exactly floor((score − 10) / 2).
 */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Returns the ability modifier with a breakdown suitable for a tooltip.
 * The modifier derives directly from the score, so the breakdown names the
 * score as its single source.
 */
export function abilityModifierBreakdown(
  ability: Ability,
  score: number,
): Breakdown {
  const total = abilityModifier(score);
  return {
    total,
    components: [
      { label: `${ABILITY_NAMES[ability]} score ${score}`, value: total },
    ],
  };
}

/**
 * Computes the Proficiency Bonus for a total character level.
 *
 * PHB 2024, "Character Advancement" table:
 *   levels 1–4 → +2, 5–8 → +3, 9–12 → +4, 13–16 → +5, 17–20 → +6.
 * This is exactly 2 + floor((level − 1) / 4).
 */
export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

/**
 * Returns the Proficiency Bonus with a breakdown for a tooltip.
 */
export function proficiencyBonusBreakdown(level: number): Breakdown {
  const total = proficiencyBonus(level);
  return {
    total,
    components: [{ label: `Level ${level}`, value: total }],
  };
}

/**
 * Clamps an ability score to the legal 1–30 range (PHB 2024 bounds).
 */
export function clampAbilityScore(score: number): number {
  if (Number.isNaN(score)) return MIN_ABILITY_SCORE;
  return Math.max(MIN_ABILITY_SCORE, Math.min(MAX_ABILITY_SCORE, Math.trunc(score)));
}

/**
 * Clamps a character level to the legal 1–20 range (PHB 2024 bounds).
 */
export function clampLevel(level: number): number {
  if (Number.isNaN(level)) return MIN_LEVEL;
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.trunc(level)));
}

/** Computes all six ability modifiers at once. */
export function allAbilityModifiers(scores: AbilityScores): Record<Ability, number> {
  return {
    str: abilityModifier(scores.str),
    dex: abilityModifier(scores.dex),
    con: abilityModifier(scores.con),
    int: abilityModifier(scores.int),
    wis: abilityModifier(scores.wis),
    cha: abilityModifier(scores.cha),
  };
}
