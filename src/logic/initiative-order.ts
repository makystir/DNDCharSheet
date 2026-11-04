/**
 * The Initiative order and combat tracker (Stage A5c): sorting, tie reordering,
 * turn and round advance, and roster edits.
 *
 * RULES (PHB 2024 "Initiative", Docs/PlayersHandbook.md L870-879):
 *  - The combatants are ranked from highest to lowest Initiative, and the order
 *    stays the same from round to round.
 *  - Ties: the players decide among tied characters, the DM among tied monsters
 *    and in a monster-versus-character tie. So a tie is NEVER broken
 *    automatically (not by Dexterity, not by anything else): the sort is stable
 *    (insertion order within a tie) and the user reorders a tie group by hand.
 *  - "Take Turns" (L880 and the Combat Step by Step list): each participant
 *    takes a turn in Initiative order; when everyone has had a turn the round
 *    ends. There is NO surprise round in 2024 (Surprise only gives Disadvantage
 *    on the Initiative roll).
 *
 * APP CONVENTIONS (not PHB rules):
 *  - Roster edits keep the active turn on the SAME combatant. Removing the active
 *    combatant makes the next one active (same index; wraps to 0 past the end
 *    WITHOUT starting a new round).
 *  - "Previous" undoes a mis-click; it never goes back before round 1.
 *  - The character's own turn state resets when its turn begins (including its
 *    Reaction) and is left alone on other combatants' turns.
 *
 * `sortByInitiative` and `nextTurn` are ported from the PWA (stable sort, wrap).
 * Everything here is pure and never mutates its inputs.
 */
import type { Character, CombatState, Combatant, TurnState } from '../types/character';
import { freshTurn } from './turn-economy';

/** Anything with an id and an Initiative count. */
export interface Ranked {
  id: string;
  initiative: number;
}

/**
 * Sort by Initiative, highest first. Ties keep their given (insertion) order:
 * Array.prototype.sort is stable, and no tiebreaker is applied (PHB L878).
 */
export function sortByInitiative<T extends Ranked>(combatants: T[]): T[] {
  return [...combatants].sort((a, b) => b.initiative - a.initiative);
}

/**
 * Advance the active index to the next combatant, wrapping at the end. Returns 0
 * when there are no combatants.
 */
export function nextTurn(activeIndex: number, totalCombatants: number): number {
  if (totalCombatants <= 0) return 0;
  return (activeIndex + 1) % totalCombatants;
}

/** Step the active index back one combatant, wrapping to the last. 0 when empty. */
export function previousTurn(activeIndex: number, totalCombatants: number): number {
  if (totalCombatants <= 0) return 0;
  return (activeIndex - 1 + totalCombatants) % totalCombatants;
}

/**
 * Swap a combatant with its neighbour, but only inside its tie group (the
 * neighbour must have the same Initiative). Anything else, including an unknown
 * id, returns the roster unchanged. PHB L878: the group decides ties.
 */
export function moveWithinTie<T extends Ranked>(
  combatants: T[],
  id: string,
  direction: 'up' | 'down',
): T[] {
  const index = combatants.findIndex((c) => c.id === id);
  if (index < 0) return combatants;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= combatants.length) return combatants;
  if (combatants[target].initiative !== combatants[index].initiative) return combatants;
  const next = [...combatants];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Whether a combatant could move in a direction (it has a tied neighbour there). */
export function canMoveWithinTie<T extends Ranked>(
  combatants: T[],
  id: string,
  direction: 'up' | 'down',
): boolean {
  return moveWithinTie(combatants, id, direction) !== combatants;
}

// ─── Combat state ────────────────────────────────────────────────────────────

function withoutDuplicateIds(combatants: Combatant[]): Combatant[] {
  const seen = new Set<string>();
  const out: Combatant[] = [];
  for (const c of combatants) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

/** The combatant whose turn it is, or undefined when the roster is empty. */
export function activeCombatant(combat: CombatState): Combatant | undefined {
  return combat.combatants[combat.activeIndex];
}

/** Whether the active turn is the character's own entry. */
export function isCharacterTurn(combat: CombatState): boolean {
  return activeCombatant(combat)?.isCharacter === true;
}

/**
 * Begin combat at round 1 with the first combatant active. The roster is sorted
 * by Initiative (stable). Duplicate ids are dropped (the first wins) and only
 * one entry may be the character's own. A new combat replaces any earlier one.
 */
export function startCombat(character: Character, combatants: Combatant[]): Character {
  let hasCharacter = false;
  const roster = withoutDuplicateIds(combatants).map((c) => {
    if (c.isCharacter !== true) return c;
    if (hasCharacter) {
      return { id: c.id, name: c.name, initiative: c.initiative };
    }
    hasCharacter = true;
    return c;
  });
  const combat: CombatState = {
    inCombat: true,
    round: 1,
    combatants: sortByInitiative(roster),
    activeIndex: 0,
    turn: freshTurn(),
  };
  return { ...character, combat };
}

/** End combat: the `combat` field is removed (absent = not in combat). */
export function endCombat(character: Character): Character {
  if (character.combat === undefined) return character;
  const next = { ...character };
  delete next.combat;
  return next;
}

/** The turn state after a new combatant becomes active (reset only on the character's turn). */
function turnAfterChange(combat: CombatState, activeIndex: number): TurnState {
  const entering = combat.combatants[activeIndex];
  return entering?.isCharacter === true ? freshTurn() : combat.turn;
}

/**
 * Move to the next or previous turn. Next from the last combatant starts the
 * next round; previous from the first goes back a round but never before round
 * 1; an empty roster changes nothing. When the character's own entry becomes
 * active its turn state resets (start of its turn, so the Reaction refreshes).
 */
export function advanceTurn(combat: CombatState, direction: 'next' | 'previous'): CombatState {
  const count = combat.combatants.length;
  if (count === 0) return combat;
  if (direction === 'next') {
    const activeIndex = nextTurn(combat.activeIndex, count);
    const round = activeIndex === 0 ? combat.round + 1 : combat.round;
    return { ...combat, activeIndex, round, turn: turnAfterChange(combat, activeIndex) };
  }
  if (combat.activeIndex === 0 && combat.round <= 1) return combat;
  const activeIndex = previousTurn(combat.activeIndex, count);
  const round = combat.activeIndex === 0 ? combat.round - 1 : combat.round;
  return { ...combat, activeIndex, round, turn: turnAfterChange(combat, activeIndex) };
}

/**
 * Add a combatant at its sorted place (after existing combatants with the same
 * Initiative, so insertion order wins a tie). The active turn stays on the same
 * combatant. A duplicate id, or a second character entry, is ignored so ids stay
 * unique and there is only one character entry.
 */
export function addCombatant(combat: CombatState, combatant: Combatant): CombatState {
  if (combat.combatants.some((c) => c.id === combatant.id)) return combat;
  if (combatant.isCharacter === true && combat.combatants.some((c) => c.isCharacter === true)) {
    return combat;
  }
  const at = combat.combatants.findIndex((c) => c.initiative < combatant.initiative);
  const index = at < 0 ? combat.combatants.length : at;
  const combatants = [...combat.combatants.slice(0, index), combatant, ...combat.combatants.slice(index)];
  const activeIndex =
    combat.combatants.length > 0 && index <= combat.activeIndex
      ? combat.activeIndex + 1
      : combat.activeIndex;
  return { ...combat, combatants, activeIndex };
}

/**
 * Remove a combatant. The active turn stays on the same combatant; removing the
 * active one makes the next one active (same index), wrapping to 0 past the end
 * WITHOUT advancing the round. An unknown id changes nothing.
 */
export function removeCombatant(combat: CombatState, id: string): CombatState {
  const index = combat.combatants.findIndex((c) => c.id === id);
  if (index < 0) return combat;
  const combatants = combat.combatants.filter((c) => c.id !== id);
  let activeIndex = combat.activeIndex;
  if (index < activeIndex) activeIndex -= 1;
  if (activeIndex >= combatants.length) activeIndex = 0;
  const next: CombatState = { ...combat, combatants, activeIndex };
  // Removing the active combatant hands the turn to the next one.
  if (index === combat.activeIndex && combatants.length > 0) {
    return { ...next, turn: turnAfterChange(next, activeIndex) };
  }
  return next;
}

/**
 * Reorder a combatant within its tie group (see `moveWithinTie`). The active
 * turn stays on the same combatant.
 */
export function moveCombatant(
  combat: CombatState,
  id: string,
  direction: 'up' | 'down',
): CombatState {
  const combatants = moveWithinTie(combat.combatants, id, direction);
  if (combatants === combat.combatants) return combat;
  const activeId = combat.combatants[combat.activeIndex]?.id;
  const activeIndex = activeId === undefined ? 0 : combatants.findIndex((c) => c.id === activeId);
  return { ...combat, combatants, activeIndex: Math.max(0, activeIndex) };
}
