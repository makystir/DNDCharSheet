/**
 * Class rules (D&D 5.5e / 2024).
 *
 * Pure resolvers over a character's class selection and the data catalog
 * (src/data/classes.ts), following the species.ts pattern: each function
 * tolerates an unset or unknown `class` and returns a sensible default, never
 * throwing. These resolvers surface class-granted proficiencies, skills, and
 * features for display; they never read or write `character.abilities` (ASI
 * and Epic Boon rows are feat choices, not automatic stat bumps — PHB 2024
 * "Ability Score Improvement" / "Epic Boon"). The no-ASI guard in the logic
 * tests locks this in.
 */

import type { Ability, Character, SkillId } from '../types/character';
import type { ClassData, ClassFeature, SubclassData } from '../data/classes';
import { getClass } from '../data/classes';

/** Resolves the selected class data, or undefined when unset/unknown. */
export function resolveClass(character: Character): ClassData | undefined {
  return getClass(character.class?.id);
}

/**
 * Resolves the chosen subclass, or undefined when no class/subclass is chosen,
 * the id is unknown, or the character's level is below the class's
 * subclassLevel (PHB 2024: a subclass is gained at the class's subclass level).
 */
export function resolveSubclass(character: Character): SubclassData | undefined {
  const cls = resolveClass(character);
  if (!cls) return undefined;
  const subclassId = character.class?.subclassId;
  if (subclassId === undefined) return undefined;
  if (character.level < cls.subclassLevel) return undefined;
  return cls.subclasses.find((s) => s.id === subclassId);
}

/**
 * The class's two save-proficiency abilities, keyed by Ability with a source
 * label (e.g. 'Barbarian (class)'). Empty when no class is selected. PHB 2024
 * Core <Class> Traits "Saving Throw Proficiencies".
 */
export function classSaveProficiencies(
  character: Character,
): Partial<Record<Ability, string>> {
  const cls = resolveClass(character);
  const result: Partial<Record<Ability, string>> = {};
  if (!cls) return result;
  const label = `${cls.name} (class)`;
  for (const ability of cls.savingThrows) {
    result[ability] = label;
  }
  return result;
}

/**
 * The skill proficiencies granted by the class's starting skill choice, keyed
 * by SkillId with a source label (e.g. 'Wizard (class)'). Built from the stored
 * `class.skillChoices`, ignoring any stale/duplicate ids. Empty when no class
 * is selected (PHB 2024 Core <Class> Traits "Skill Proficiencies").
 */
export function classGrantedSkills(
  character: Character,
): Partial<Record<SkillId, string>> {
  const cls = resolveClass(character);
  const result: Partial<Record<SkillId, string>> = {};
  if (!cls) return result;
  const label = `${cls.name} (class)`;
  for (const skillId of character.class?.skillChoices ?? []) {
    result[skillId] = label;
  }
  return result;
}

/**
 * The class's armor/weapon/tool proficiencies as display strings. Empty arrays
 * when no class is selected (PHB 2024 Core <Class> Traits). Display only — not
 * a computed total, so no Breakdown.
 */
export function classProficiencies(character: Character): {
  armor: string[];
  weapons: string[];
  tools: string[];
} {
  const cls = resolveClass(character);
  if (!cls) return { armor: [], weapons: [], tools: [] };
  return {
    armor: [...cls.armorTraining],
    weapons: [...cls.weaponProficiencies],
    tools: [...cls.toolProficiencies],
  };
}

/**
 * The class's features grouped by the level at which they are gained, as a Map
 * whose keys are inserted in ascending numeric order. A copy of the features is
 * sorted by level with a stable comparator BEFORE grouping so features within a
 * level keep their authored order. Empty Map when no class is selected (PHB
 * 2024 <Class> Features table).
 */
export function classFeaturesByLevel(
  character: Character,
): Map<number, ClassFeature[]> {
  const cls = resolveClass(character);
  const result = new Map<number, ClassFeature[]>();
  if (!cls) return result;
  // Stable sort a copy by level; Array.prototype.sort is stable in modern JS,
  // so equal-level features retain their authored order.
  const sorted = [...cls.features].sort((a, b) => a.level - b.level);
  for (const feature of sorted) {
    const bucket = result.get(feature.level);
    if (bucket) {
      bucket.push(feature);
    } else {
      result.set(feature.level, [feature]);
    }
  }
  return result;
}

/**
 * The character's total number of Hit Dice, which equals the character level
 * (PHB 2024 "Hit Points": you have Hit Dice equal to your level). Tolerant of
 * an unset class (Hit Dice still track character level).
 */
export function hitDiceTotal(character: Character): number {
  return character.level;
}
