/**
 * Skill-check rules (D&D 5.5e / 2024).
 *
 * PHB 2024 "Skills" / "Skill List" / "Skill Proficiencies": a skill check uses
 * the skill's governing ability modifier; if proficient, add the Proficiency
 * Bonus. PHB 2024 "Expertise" (rules glossary): expertise doubles the
 * Proficiency Bonus for the relevant checks, and the Proficiency Bonus "can be
 * multiplied only once" — so expertise adds exactly one extra PB on top of the
 * proficient PB, and expertise without proficiency adds nothing (there is no PB
 * to double). Each skill's governing ability is fixed by the SKILLS table in
 * src/types/character.ts (PHB 2024 "Skills" table).
 *
 * Every function is pure and returns a Breakdown with meaningfully-labelled
 * components, including zero contributors (calculated-totals steering).
 */

import type {
  AbilityScores,
  Ability,
  Character,
  SkillId,
  SkillTraining,
} from '../types/character';
import { ABILITY_NAMES, SKILLS } from '../types/character';
import { abilityModifier, proficiencyBonus } from './abilities';
import type { Breakdown } from './breakdown';

/** The governing ability of a skill, from the canonical SKILLS table. */
function skillAbility(skillId: SkillId): Ability {
  // SKILLS is the single source of truth (PHB 2024 "Skills" table).
  const entry = SKILLS.find((s) => s.id === skillId);
  // SkillId is derived from SKILLS, so this is always found; the throw is a
  // type-narrowing guard that cannot trigger at runtime.
  if (!entry) throw new Error(`Unknown skill id: ${skillId}`);
  return entry.ability;
}

/**
 * Reads a character's training for a skill, defaulting absent entries to
 * untrained. Treats absent/undefined identically to { false, false } so
 * Stage-1 records (which lack the skills field) load without migration.
 */
export function getSkillTraining(
  character: Character,
  skillId: SkillId,
): SkillTraining {
  const stored = character.skills?.[skillId];
  return {
    proficient: stored?.proficient ?? false,
    expertise: stored?.expertise ?? false,
  };
}

/**
 * The skill-check modifier:
 *   abilityMod + (proficient ? PB : 0) + (proficient && expertise ? PB : 0).
 */
export function skillModifier(
  scores: AbilityScores,
  level: number,
  skillId: SkillId,
  training: SkillTraining,
): number {
  return skillModifierBreakdown(scores, level, skillId, training).total;
}

/** The skill-check modifier with a breakdown for a tooltip. */
export function skillModifierBreakdown(
  scores: AbilityScores,
  level: number,
  skillId: SkillId,
  training: SkillTraining,
): Breakdown {
  const ability = skillAbility(skillId);
  const abilityMod = abilityModifier(scores[ability]);
  const pb = proficiencyBonus(level);
  const proficient = training.proficient ?? false;
  const expertise = training.expertise ?? false;

  const profValue = proficient ? pb : 0;
  // Expertise adds a second PB only when proficient (PB multiplied only once).
  const expertiseValue = proficient && expertise ? pb : 0;

  return {
    total: abilityMod + profValue + expertiseValue,
    components: [
      { label: `${ABILITY_NAMES[ability]} mod`, value: abilityMod },
      { label: 'Proficiency', value: profValue },
      { label: 'Expertise', value: expertiseValue },
    ],
  };
}

/**
 * Breakdowns for every canonical skill, keyed by SkillId. Iterates the SKILLS
 * list (not the stored keys) so a stray/stale stored key cannot throw.
 */
export function allSkillBreakdowns(
  character: Character,
): Record<SkillId, Breakdown> {
  const result = {} as Record<SkillId, Breakdown>;
  for (const skill of SKILLS) {
    result[skill.id] = skillModifierBreakdown(
      character.abilities,
      character.level,
      skill.id,
      getSkillTraining(character, skill.id),
    );
  }
  return result;
}
