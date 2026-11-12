/**
 * How the character's conditions change a saving throw, for the Combat page's
 * save buttons. Read straight from the condition catalog's machine-checkable
 * flags (data/conditions.ts `mechanics`), so no rule is restated here:
 *  - autoFailStrDexSaves: the creature automatically fails Strength and Dexterity
 *    saving throws (Paralyzed, Petrified, Stunned, Unconscious).
 *  - dexSaves 'disadvantage': Disadvantage on Dexterity saving throws (Restrained).
 * Conditions come from `effectiveConditionIds`, which includes the conditions
 * implied by others and by 0 HP.
 */

import type { Ability, Character } from '../types/character';
import { getCondition } from '../data/conditions';
import { effectiveConditionIds } from './hit-points-state';

export interface SaveConditionEffects {
  /** Names of the conditions that make this save an automatic failure. */
  autoFailFrom: string[];
  /** Names of the conditions that give Disadvantage on this save. */
  disadvantageFrom: string[];
}

export function saveConditionEffects(character: Character, ability: Ability): SaveConditionEffects {
  const autoFailFrom: string[] = [];
  const disadvantageFrom: string[] = [];
  for (const id of effectiveConditionIds(character)) {
    const cond = getCondition(id);
    if (!cond) continue;
    const m = cond.mechanics;
    if ((ability === 'str' || ability === 'dex') && m.autoFailStrDexSaves) autoFailFrom.push(cond.name);
    if (ability === 'dex' && m.dexSaves === 'disadvantage') disadvantageFrom.push(cond.name);
  }
  return { autoFailFrom, disadvantageFrom };
}
