/**
 * Passive check rules (D&D 5.5e / 2024).
 *
 * PHB 2024 (Docs/PlayersHandbook.md line ~1916): "Passive Perception = 10 +
 * Wisdom (Perception) check modifier", including all modifiers that apply to
 * that check (e.g. proficiency, expertise). Generalised here as
 * `passiveCheck(m) = 10 + m` for any passive check.
 *
 * Pure functions returning a Breakdown (calculated-totals steering).
 */

import type { Character } from '../types/character';
import { skillModifierBreakdown, getSkillTraining } from './skills';
import type { Breakdown } from './breakdown';

/** A passive check score: 10 + the relevant check modifier. */
export function passiveCheck(checkModifier: number): number {
  return 10 + checkModifier;
}

/**
 * Passive Perception with a breakdown: 10 + the Wisdom (Perception) check
 * modifier. Reuses the skill breakdown so Perception proficiency/expertise
 * flow through automatically and the tooltip shows the same component labels
 * plus the base 10.
 */
export function passivePerceptionBreakdown(character: Character): Breakdown {
  const perception = skillModifierBreakdown(
    character.abilities,
    character.level,
    'perception',
    getSkillTraining(character, 'perception'),
  );
  return {
    total: passiveCheck(perception.total),
    components: [
      { label: 'Base', value: 10 },
      ...perception.components,
    ],
  };
}
