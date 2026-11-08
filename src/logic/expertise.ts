/**
 * Class-granted Expertise: how many Expertise picks a character is owed, how
 * many are spent, and which skills are eligible (D&D 5.5e / 2024).
 *
 * PHB 2024 rules glossary "Expertise" (L21038-21040): Expertise doubles the
 * Proficiency Bonus for checks with a skill you are proficient in; it is gained
 * in a skill you are proficient in, and you can't have Expertise in the same
 * skill proficiency more than once. (skills.ts already scores it: one extra PB,
 * only when effectively proficient.)
 *
 * The picks owed come from base-class features only (PHB 2024):
 *  - Bard: Expertise, level 2 (two) + level 9 (two more)  (L2794-2798)
 *  - Ranger: Deft Explorer, level 2 (one); Expertise, level 9 (two) (L5412-5440)
 *  - Rogue: Expertise, level 1 (two) + level 6 (two more) (L5882-5886)
 *  - Wizard: Scholar, level 2 (one of Arcana, History, Investigation, Medicine,
 *    Nature or Religion that you are proficient in) (L7465-7467)
 *
 * Feat Expertise (Skill Expert, Keen Mind, Observant, Boon of Skill) is chosen
 * in the feat dialog and DERIVED from advancement.feats[] (featGrantedExpertise);
 * each such pick counts as both owed and chosen here, so it never shows as a
 * pending class pick.
 *
 * Subclass Expertise: none exists in the PHB 2024 (no subclass feature grants
 * Expertise; Assassin's "Infiltration Expertise" grants none), so no subclass
 * entries belong in EXPERTISE_GRANTS.
 *
 * The count is a POOL: the app does not record which feature a given Expertise
 * came from, only which skills have it. Over-allocation is a warning, never a
 * block (homebrew, house rules and unmodelled sources can add picks).
 *
 * Pure; never mutates its input.
 */

import type { Character, SkillId, SkillTraining } from '../types/character';
import { SKILLS } from '../types/character';
import { getClass } from '../data/classes';
import { allClasses } from './classes';
import { featGrantedExpertise } from './feats';
import { effectiveSkillTraining, getSkillTraining } from './skills';

/** One class feature that grants Expertise picks. */
export interface ExpertiseGrant {
  classId: string;
  /** The CLASS level at which the picks are gained. */
  level: number;
  /** Number of Expertise picks the feature grants. */
  count: number;
  /** The printed feature name. */
  feature: string;
  /** When set, the pick must come from these skills (still must be proficient). */
  from?: readonly SkillId[];
  source: string;
}

export const EXPERTISE_GRANTS: readonly ExpertiseGrant[] = [
  { classId: 'bard', level: 2, count: 2, feature: 'Expertise', source: 'PHB 2024 "Bard: Expertise" (L2794-2796)' },
  { classId: 'bard', level: 9, count: 2, feature: 'Expertise', source: 'PHB 2024 "Bard: Expertise" (L2798)' },
  { classId: 'ranger', level: 2, count: 1, feature: 'Deft Explorer', source: 'PHB 2024 "Ranger: Deft Explorer" (L5412-5414)' },
  { classId: 'ranger', level: 9, count: 2, feature: 'Expertise', source: 'PHB 2024 "Ranger: Expertise" (L5438-5440)' },
  { classId: 'rogue', level: 1, count: 2, feature: 'Expertise', source: 'PHB 2024 "Rogue: Expertise" (L5882-5884)' },
  { classId: 'rogue', level: 6, count: 2, feature: 'Expertise', source: 'PHB 2024 "Rogue: Expertise" (L5886)' },
  {
    classId: 'wizard',
    level: 2,
    count: 1,
    feature: 'Scholar',
    from: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion'],
    source: 'PHB 2024 "Wizard: Scholar" (L7465-7467)',
  },
];

/** A grant the character has reached, labelled for display. */
export interface EarnedExpertise {
  grant: ExpertiseGrant;
  /** e.g. "Rogue 1", "Bard 9" — class name + the level it was gained at. */
  label: string;
}

/** The Expertise grants a character has reached, per class level (multiclass-aware). */
export function earnedExpertiseGrants(character: Character): EarnedExpertise[] {
  const earned: EarnedExpertise[] = [];
  for (const entry of allClasses(character)) {
    const name = getClass(entry.id)?.name ?? entry.id;
    for (const grant of EXPERTISE_GRANTS) {
      if (grant.classId === entry.id && grant.level <= entry.level) {
        earned.push({ grant, label: `${name} ${grant.level}` });
      }
    }
  }
  return earned;
}

/** Expertise picks already made through feats (they satisfy themselves). */
function featExpertiseCount(character: Character): number {
  return featGrantedExpertise(character).filter(
    (id) => effectiveSkillTraining(character, id).expertise,
  ).length;
}

/** Total Expertise picks owed: class features plus feat-granted picks. */
export function expertiseOwed(character: Character): number {
  return (
    earnedExpertiseGrants(character).reduce((sum, e) => sum + e.grant.count, 0) +
    featExpertiseCount(character)
  );
}

/**
 * Skills that count as having Expertise: the stored flag AND effective
 * proficiency (Expertise without proficiency adds nothing — PHB glossary).
 */
export function expertiseSkills(character: Character): SkillId[] {
  return SKILLS.map((s) => s.id).filter((id) => effectiveSkillTraining(character, id).expertise);
}

export interface ExpertiseStatus {
  owed: number;
  chosen: number;
  /** Picks still to make (never negative). */
  remaining: number;
  /** Picks chosen beyond what the classes grant (never negative). */
  over: number;
  earned: EarnedExpertise[];
  /** Effectively proficient skills that do not have Expertise yet. */
  eligible: SkillId[];
  /**
   * When every outstanding grant restricts the choice (only Wizard Scholar
   * today), the allowed skills; otherwise undefined (any proficient skill).
   * Informational — the pool is not enforced per feature.
   */
  restrictedTo?: readonly SkillId[];
}

export function expertiseStatus(character: Character): ExpertiseStatus {
  const earned = earnedExpertiseGrants(character);
  const owed = earned.reduce((sum, e) => sum + e.grant.count, 0) + featExpertiseCount(character);
  const chosen = expertiseSkills(character).length;
  const eligible = SKILLS.map((s) => s.id).filter((id) => {
    const t = effectiveSkillTraining(character, id);
    return t.proficient && !t.expertise;
  });
  const status: ExpertiseStatus = {
    owed,
    chosen,
    remaining: Math.max(0, owed - chosen),
    over: Math.max(0, chosen - owed),
    earned,
    eligible,
  };
  // Restriction applies only if every earned grant is restricted to a list.
  if (earned.length > 0 && earned.every((e) => e.grant.from !== undefined)) {
    status.restrictedTo = earned[0].grant.from;
  }
  return status;
}

/**
 * Set or clear Expertise on a skill. Setting requires effective proficiency
 * (class, species or stored) and returns the character unchanged otherwise;
 * clearing is always allowed. Writes only `skills[skillId].expertise`.
 */
export function setSkillExpertise(
  character: Character,
  skillId: SkillId,
  value: boolean,
): Character {
  if (value && !effectiveSkillTraining(character, skillId).proficient) return character;
  const current: SkillTraining = getSkillTraining(character, skillId);
  return {
    ...character,
    skills: { ...character.skills, [skillId]: { ...current, expertise: value } },
  };
}
