/**
 * Weapon Mastery data (Stage A5d): how many weapon kinds each class can master at
 * each level, and which weapons each class may choose.
 *
 * PHB 2024 (Docs/PlayersHandbook.md). The "Weapon Mastery" feature and its column
 * in the Features table:
 *  - Barbarian (L2475-2479, table L2452-2474): two kinds of Simple or Martial MELEE
 *    weapons; 2 at levels 1-3, 3 at levels 4-9, 4 from level 10.
 *  - Fighter (L4122-4140, table L4159-4180): three kinds of Simple or Martial weapons
 *    of any kind; 3 at levels 1-3, 4 at levels 4-9, 5 at levels 10-15, 6 from level 16.
 *  - Paladin (L4902), Ranger (L5404), Rogue (L5900): two kinds of weapons with which
 *    the character has proficiency; no increase in the Features table.
 * Every other class has no Weapon Mastery feature, so every mastery is locked.
 *
 * A mastery property is "usable only by a character who has a feature, such as
 * Weapon Mastery, that unlocks the property" (L9352). Species, feats and subclass
 * features that also unlock masteries are not modelled (flagged in the A5d summary).
 */
import type { ClassId } from './classes';

/** Which weapons a class may pick for Weapon Mastery. */
export type MasteryEligibility =
  /** Simple or Martial MELEE weapons (Barbarian). */
  | 'simple-or-martial-melee'
  /** Any Simple or Martial weapon (Fighter). */
  | 'simple-or-martial'
  /** Any weapon the class is proficient with (Paladin, Ranger, Rogue). */
  | 'proficient'
  /** The class has no Weapon Mastery feature. */
  | 'none';

export interface ClassMasteryRule {
  /** [classLevel, count] steps in ascending level order; the last step reached applies. */
  counts: ReadonlyArray<readonly [number, number]>;
  eligibility: MasteryEligibility;
  /** Where the feature is printed, for the tooltip and the code reader. */
  source: string;
}

export const CLASS_MASTERY_RULES: Record<ClassId, ClassMasteryRule> = {
  barbarian: {
    counts: [[1, 2], [4, 3], [10, 4]],
    eligibility: 'simple-or-martial-melee',
    source: 'PHB 2024 Barbarian "Weapon Mastery" (L2475-2479) and Barbarian Features table (L2452-2474)',
  },
  bard: { counts: [], eligibility: 'none', source: 'PHB 2024 Bard: no Weapon Mastery feature' },
  cleric: { counts: [], eligibility: 'none', source: 'PHB 2024 Cleric: no Weapon Mastery feature' },
  druid: { counts: [], eligibility: 'none', source: 'PHB 2024 Druid: no Weapon Mastery feature' },
  fighter: {
    counts: [[1, 3], [4, 4], [10, 5], [16, 6]],
    eligibility: 'simple-or-martial',
    source: 'PHB 2024 Fighter "Weapon Mastery" (L4122-4140) and Fighter Features table (L4159-4180)',
  },
  monk: { counts: [], eligibility: 'none', source: 'PHB 2024 Monk: no Weapon Mastery feature' },
  paladin: {
    counts: [[1, 2]],
    eligibility: 'proficient',
    source: 'PHB 2024 Paladin "Weapon Mastery" (L4902)',
  },
  ranger: {
    counts: [[1, 2]],
    eligibility: 'proficient',
    source: 'PHB 2024 Ranger "Weapon Mastery" (L5404)',
  },
  rogue: {
    counts: [[1, 2]],
    eligibility: 'proficient',
    source: 'PHB 2024 Rogue "Weapon Mastery" (L5900)',
  },
  sorcerer: { counts: [], eligibility: 'none', source: 'PHB 2024 Sorcerer: no Weapon Mastery feature' },
  warlock: { counts: [], eligibility: 'none', source: 'PHB 2024 Warlock: no Weapon Mastery feature' },
  wizard: { counts: [], eligibility: 'none', source: 'PHB 2024 Wizard: no Weapon Mastery feature' },
};
