/**
 * The simple fight tracker behind the Combat page. The player resolves the fight
 * at the table, so the app tracks only what is useful to count: whether a fight is
 * on, the round number, the player's own Initiative result, and the timers on
 * conditions and effects. It does not run turns or an initiative order.
 *
 * "Next round" is the one thing that moves time: it adds 1 to the round and takes
 * one round off every timed condition (logic/condition-duration.ts) and every
 * timed effect (logic/combat-effects.ts). It never restores time, so the tick
 * cannot be undone by going back. Starting a fight sets round 1.
 */

import type { Character, CombatState } from '../types/character';
import { advanceRounds } from './condition-duration';
import { advanceEffects } from './combat-effects';
import { endCombat, startCombat } from './initiative-order';
import { getCondition } from '../data/conditions';

export function isInFight(character: Character): boolean {
  return character.combat?.inCombat === true;
}

/** The current round number (0 when no fight is on). */
export function currentRound(character: Character): number {
  return isInFight(character) ? Math.max(1, character.combat?.round ?? 1) : 0;
}

/** Start a fight at round 1. Does nothing when one is already on. */
export function beginFight(character: Character): Character {
  return isInFight(character) ? character : startCombat(character, []);
}

/** The character's own Initiative result for this fight, if rolled. */
export function initiativeResult(character: Character): number | undefined {
  const v = character.combat?.initiative;
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Record the Initiative result, starting the fight if one is not on yet. */
export function recordInitiative(character: Character, total: number): Character {
  if (!Number.isFinite(total)) return character;
  const started = beginFight(character);
  const combat = started.combat as CombatState;
  return { ...started, combat: { ...combat, initiative: Math.trunc(total) } };
}

export interface NextRoundResult {
  character: Character;
  round: number;
  /** Names of the conditions and effects that ran out this round. */
  expired: string[];
}

/** Move to the next round and take a round off every timed condition and effect. */
export function nextRound(character: Character): NextRoundResult {
  // No fight yet: starting one is the whole step (round 1, nothing to count down).
  if (!isInFight(character)) return { character: beginFight(character), round: 1, expired: [] };
  const started = character;
  const combat = started.combat as CombatState;
  const round = combat.round + 1;
  const before = (started.conditions ?? []).map((c) => c.id);
  let next: Character = {
    ...started,
    combat: { ...combat, round, tickedThroughRound: Math.max(round, combat.tickedThroughRound ?? 0) },
  };
  next = advanceRounds(next, 1);
  const goneConditions = before
    .filter((id) => !(next.conditions ?? []).some((c) => c.id === id))
    .map((id) => getCondition(id)?.name ?? id);
  const effects = advanceEffects(next, 1);
  return {
    character: effects.character,
    round,
    expired: [...goneConditions, ...effects.expired],
  };
}

/** End the fight: clears the round and the Initiative result. Timers keep their values. */
export function endFight(character: Character): Character {
  return endCombat(character);
}
