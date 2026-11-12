/**
 * Attack and damage rolls for the Combat page's weapon cards. The player resolves
 * the fight at the table, so an attack roll is a d20 + bonus total for the DM; the
 * app never compares it to an Armor Class.
 *
 * - The attack roll's default Advantage / Disadvantage comes from the character's
 *   OWN conditions that always apply (logic/attacks.ts `attackerConditionSuggestions`,
 *   read from the condition catalog). Situational ones are listed for the player to
 *   decide. Any Advantage with any Disadvantage cancels (PHB 2024 "Advantage and
 *   Disadvantage").
 * - A natural 20 on an attack roll is a Critical Hit and a natural 1 always misses,
 *   judged on the die (PHB 2024 "Rolling 20 or 1", L466-471).
 * - A Critical Hit doubles the damage dice, not the flat bonus (PHB 2024 "Critical
 *   Hits"); the roll itself is logic/attacks.ts `rollWeaponDamage`.
 */

import type { Character } from '../types/character';
import type { D20Mode } from './dice';
import { combineD20Mode } from './dice';
import { attackerConditionSuggestions } from './attacks';
import { getCondition } from '../data/conditions';

export interface AttackModeAdvice {
  /** The roll mode to start with (from conditions that always apply). */
  mode: D20Mode;
  /** One line per source, for the roll dialog. */
  notes: string[];
}

export function attackModeAdvice(character: Character): AttackModeAdvice {
  const suggestions = attackerConditionSuggestions(character);
  const fixed = suggestions.filter((s) => !s.situational);
  const mode = combineD20Mode(
    fixed.some((s) => s.side === 'advantage'),
    fixed.some((s) => s.side === 'disadvantage'),
  );
  const notes = suggestions.map((s) => {
    const name = getCondition(s.conditionId as never)?.name ?? s.conditionId;
    const side = s.side === 'advantage' ? 'Advantage' : 'Disadvantage';
    return s.situational ? `${name}: ${side}. ${s.situational}` : `${name}: ${side}.`;
  });
  return { mode, notes };
}

/** What a natural die means on an attack roll. */
export function attackNaturalNote(natural: number): string | null {
  if (natural === 20) return 'Natural 20: a Critical Hit (double the damage dice).';
  if (natural === 1) return 'Natural 1: the attack misses.';
  return null;
}
