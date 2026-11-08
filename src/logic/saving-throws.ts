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
import { classSaveProficiencies, resolveClass } from './classes';
import { effectiveAbilityScores, featGrantedSaves } from './feats';

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

/** Where a save proficiency comes from, for display. */
export interface SaveProficiencyInfo {
  proficient: boolean;
  /** 'class' = granted by the initial class; 'manual' = the player's own tick. */
  source: 'class' | 'feat' | 'manual' | null;
  /** Class name when source is 'class', e.g. 'Wizard'. */
  classLabel?: string;
}

/**
 * Whether (and why) the character is proficient in an ability's saving throw.
 * PHB 2024 Core <Class> Traits "Saving Throw Proficiencies": granted by the
 * INITIAL class only (Multiclassing: Proficiencies, L2106). A manual tick on a
 * class-granted save adds nothing (the Proficiency Bonus is never added twice,
 * L525), so the source stays 'class'.
 */
export function savingThrowProficiency(
  character: Character,
  ability: Ability,
): SaveProficiencyInfo {
  if (classSaveProficiencies(character)[ability] !== undefined) {
    return {
      proficient: true,
      source: 'class',
      classLabel: resolveClass(character)?.name,
    };
  }
  // Resilient grants proficiency in the ability it increased (PHB 2024 L8874).
  if (featGrantedSaves(character)[ability] !== undefined) {
    return { proficient: true, source: 'feat' };
  }
  if (character.saveProficiencies?.[ability]) {
    return { proficient: true, source: 'manual' };
  }
  return { proficient: false, source: null };
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
  const featGranted = featGrantedSaves(character);
  const result = {} as Record<Ability, Breakdown>;
  for (const ability of ABILITIES) {
    const proficient = character.saveProficiencies?.[ability] ?? false;
    result[ability] = savingThrowBreakdown(
      effectiveAbilityScores(character),
      character.level,
      ability,
      proficient,
      classGranted[ability] ?? featGranted[ability],
    );
  }
  return result;
}
