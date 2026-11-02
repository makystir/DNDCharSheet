/**
 * Saving-throw rules (D&D 5.5e / 2024).
 *
 * PHB 2024 "Saving Throws" / "Saving Throw Proficiencies": a saving throw uses
 * the named ability's modifier; if proficient in that save, add the
 * Proficiency Bonus.
 *
 * Every function is pure and returns a Breakdown with meaningfully-labelled
 * components, including zero contributors (calculated-totals steering).
 */

import type { AbilityScores, Ability, Character } from '../types/character';
import { ABILITIES, ABILITY_NAMES } from '../types/character';
import { abilityModifier, proficiencyBonus } from './abilities';
import type { Breakdown } from './breakdown';

/** The saving-throw modifier: abilityMod + (proficient ? PB : 0). */
export function savingThrowModifier(
  scores: AbilityScores,
  level: number,
  ability: Ability,
  proficient: boolean,
): number {
  return savingThrowBreakdown(scores, level, ability, proficient).total;
}

/** The saving-throw modifier with a breakdown for a tooltip. */
export function savingThrowBreakdown(
  scores: AbilityScores,
  level: number,
  ability: Ability,
  proficient: boolean,
): Breakdown {
  const abilityMod = abilityModifier(scores[ability]);
  const profValue = proficient ? proficiencyBonus(level) : 0;
  return {
    total: abilityMod + profValue,
    components: [
      { label: `${ABILITY_NAMES[ability]} mod`, value: abilityMod },
      { label: 'Proficiency', value: profValue },
    ],
  };
}

/**
 * Breakdowns for every ability's saving throw, keyed by Ability. Absent
 * save-proficiency flags default to false, so Stage-1 records load unchanged.
 */
export function allSavingThrowBreakdowns(
  character: Character,
): Record<Ability, Breakdown> {
  const result = {} as Record<Ability, Breakdown>;
  for (const ability of ABILITIES) {
    const proficient = character.saveProficiencies?.[ability] ?? false;
    result[ability] = savingThrowBreakdown(
      character.abilities,
      character.level,
      ability,
      proficient,
    );
  }
  return result;
}
