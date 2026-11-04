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
import { classSaveProficiencies } from './classes';
import { effectiveAbilityScores } from './feats';

/** The saving-throw modifier: abilityMod + (proficient ? PB : 0). */
export function savingThrowModifier(
  scores: AbilityScores,
  level: number,
  ability: Ability,
  proficient: boolean,
): number {
  return savingThrowBreakdown(scores, level, ability, proficient).total;
}

/**
 * The saving-throw modifier with a breakdown for a tooltip.
 *
 * `classSource` is the optional label of the class that grants proficiency in
 * this save (e.g. 'Barbarian (class)' — PHB 2024 Core <Class> Traits "Saving
 * Throw Proficiencies"). When set, the character is effectively proficient
 * regardless of the stored `proficient` flag, so:
 *   effectiveProficient = proficient || classSource !== undefined.
 * The Proficiency Bonus is added ONCE (RAW: the PB can be multiplied only
 * once — no stacking even if the user also toggled the save), and the
 * Proficiency component is labelled with the class source only when
 * class-granted.
 */
export function savingThrowBreakdown(
  scores: AbilityScores,
  level: number,
  ability: Ability,
  proficient: boolean,
  classSource?: string,
): Breakdown {
  const abilityMod = abilityModifier(scores[ability]);
  const classProficient = classSource !== undefined;
  const effectiveProficient = proficient || classProficient;
  const profValue = effectiveProficient ? proficiencyBonus(level) : 0;
  const profLabel = classProficient
    ? `Proficiency (${classSource})`
    : 'Proficiency';
  return {
    total: abilityMod + profValue,
    components: [
      { label: `${ABILITY_NAMES[ability]} mod`, value: abilityMod },
      { label: profLabel, value: profValue },
    ],
  };
}

/**
 * Breakdowns for every ability's saving throw, keyed by Ability. Absent
 * save-proficiency flags default to false, so Stage-1 records load unchanged.
 * Class save proficiencies (PHB 2024 Core <Class> Traits) are merged in via
 * classSaveProficiencies: a class-granted save is labelled with its class
 * source and the PB is added once even when the user also toggled it.
 */
export function allSavingThrowBreakdowns(
  character: Character,
): Record<Ability, Breakdown> {
  const classGranted = classSaveProficiencies(character);
  const result = {} as Record<Ability, Breakdown>;
  for (const ability of ABILITIES) {
    const proficient = character.saveProficiencies?.[ability] ?? false;
    result[ability] = savingThrowBreakdown(
      effectiveAbilityScores(character),
      character.level,
      ability,
      proficient,
      classGranted[ability],
    );
  }
  return result;
}
