/**
 * The character's own turn economy (Stage A5c): action, Bonus Action, Reaction,
 * free object interaction and movement, as a pure reducer over turn events.
 *
 * ADVISORY, NEVER A GATE (app convention, ported from the PWA's "guidance, never
 * gate" turn reducer). Using something a second time (a feature such as Action
 * Surge can legitimately grant it), or acting while Incapacitated, records a
 * WARNING but the state still updates. Warnings never block.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md):
 *  - "Your Turn" (L880-897): on your turn you move up to your Speed and take one
 *    action, in either order. "Interacting with Things" (L894-897): one object
 *    for free; a second object needs the Utilize action.
 *  - Bonus Actions (L20695): at most one per turn, and only when a rule grants
 *    one. Anything that stops you taking actions also stops Bonus Actions.
 *  - Reactions (L21417): once you take a Reaction you cannot take another until
 *    the START of your next turn. It can be taken on your own turn or on
 *    someone else's, so another combatant's turn changes nothing.
 *  - Dash [Action] (L20925): extra movement for the turn equal to your Speed.
 *  - Movement and Position (L906-912): each part of a move is deducted from your Speed.
 *  - Incapacitated [Condition] (~L21185): you can't take any action, Bonus Action
 *    or Reaction. Moving and free interaction are not in that list.
 *
 * Speed penalties from armour or Exhaustion are NOT wired in (A5e): the caller
 * passes the Speed it wants used.
 *
 * Everything here is pure and never mutates its inputs.
 */
import type { Character, TurnState } from '../types/character';
import { speedBreakdown } from './species';
import type { Breakdown } from './breakdown';
import { hasIncapacitated } from './initiative-roll';
import { lifeStatus } from './hit-points-state';

/**
 * Events applied to the character's own turn state.
 *  start-turn : the character's turn begins (resets everything INCLUDING the Reaction)
 *  other-turn : another combatant's turn begins (changes nothing)
 *  action / dash / bonus / reaction / interact : the matching thing is used
 *  move:N     : the character moves N feet
 */
export type TurnEvent =
  | 'start-turn'
  | 'other-turn'
  | 'action'
  | 'dash'
  | 'bonus'
  | 'reaction'
  | 'interact'
  | `move:${number}`;

export type TurnWarning =
  | 'action-already-used'
  | 'bonus-already-used'
  | 'reaction-already-used'
  | 'interaction-needs-utilize'
  | 'over-speed'
  | 'incapacitated';

/** What the reducer needs to know about the character. */
export interface TurnContext {
  /** Speed in feet. */
  speed: number;
  /** The character has the Incapacitated condition (stored, implied or from 0 HP). */
  incapacitated?: boolean;
}

export interface TurnStep {
  turn: TurnState;
  /** Warnings raised by this one event (never blocking). */
  warnings: TurnWarning[];
}

/** A fresh turn: nothing used, no movement, no Dash. */
export function freshTurn(): TurnState {
  return {
    actionUsed: false,
    bonusUsed: false,
    reactionUsed: false,
    objectInteractionUsed: false,
    movementUsed: 0,
    dashes: 0,
  };
}

function wholeSpeed(speed: number): number {
  return Number.isFinite(speed) ? Math.max(0, Math.trunc(speed)) : 0;
}

/** Speed x (1 + Dashes): each Dash adds one Speed's worth (PHB "Dash", L20925). */
export function movementAllowance(speed: number, dashes: number): number {
  return wholeSpeed(speed) * (1 + Math.max(0, Math.trunc(dashes)));
}

/** max(0, allowance - movement used). Never negative. */
export function remainingMovement(speed: number, turn: TurnState): number {
  return Math.max(0, movementAllowance(speed, turn.dashes) - turn.movementUsed);
}

/**
 * Breakdown of the movement allowance for this turn: Speed plus one Speed for
 * each Dash (zero shown when there is none). PHB "Your Turn" and "Dash".
 */
export function movementAllowanceBreakdown(speed: number, dashes: number): Breakdown {
  const base = wholeSpeed(speed);
  const dashed = Math.max(0, Math.trunc(dashes));
  return {
    total: base * (1 + dashed),
    components: [
      { label: 'Speed', value: base },
      { label: dashed === 1 ? 'Dash (1 time)' : `Dash (${dashed} times)`, value: base * dashed },
    ],
  };
}

/**
 * Breakdown of the movement still available: the allowance, minus movement
 * used, plus the amount that would otherwise take it below zero (shown even at
 * 0 so every factor is visible). Components sum to the total.
 */
export function remainingMovementBreakdown(speed: number, turn: TurnState): Breakdown {
  const allowance = movementAllowance(speed, turn.dashes);
  const raw = allowance - turn.movementUsed;
  return {
    total: Math.max(0, raw),
    components: [
      { label: 'Movement allowance (Speed + Dash)', value: allowance },
      // `0 -` (not unary minus) avoids showing -0 when nothing has been used.
      { label: 'Movement used', value: 0 - turn.movementUsed },
      { label: 'Cannot go below 0', value: Math.max(0, raw) - raw },
    ],
    note: 'Moving past the allowance is only a warning; the tracker never blocks.',
  };
}

function parseMove(event: string): number | undefined {
  if (!event.startsWith('move:')) return undefined;
  const feet = Number(event.slice('move:'.length));
  return Number.isFinite(feet) ? Math.max(0, feet) : undefined;
}

/**
 * Apply one event. Always updates the state; the returned warnings only advise.
 * Unknown or malformed events change nothing.
 */
export function applyTurnEvent(turn: TurnState, event: TurnEvent, context: TurnContext): TurnStep {
  switch (event) {
    case 'start-turn':
      // PHB L21417: the Reaction returns at the start of YOUR next turn.
      return { turn: freshTurn(), warnings: [] };
    case 'other-turn':
      // A Reaction spent earlier stays spent through other combatants' turns.
      return { turn, warnings: [] };
    case 'action':
    case 'dash': {
      const warnings: TurnWarning[] = [];
      if (context.incapacitated === true) warnings.push('incapacitated');
      if (turn.actionUsed) warnings.push('action-already-used');
      return {
        turn: {
          ...turn,
          actionUsed: true,
          dashes: event === 'dash' ? turn.dashes + 1 : turn.dashes,
        },
        warnings,
      };
    }
    case 'bonus': {
      const warnings: TurnWarning[] = [];
      if (context.incapacitated === true) warnings.push('incapacitated');
      if (turn.bonusUsed) warnings.push('bonus-already-used');
      return { turn: { ...turn, bonusUsed: true }, warnings };
    }
    case 'reaction': {
      const warnings: TurnWarning[] = [];
      if (context.incapacitated === true) warnings.push('incapacitated');
      if (turn.reactionUsed) warnings.push('reaction-already-used');
      return { turn: { ...turn, reactionUsed: true }, warnings };
    }
    case 'interact': {
      // PHB L894-897: one free interaction; a second needs the Utilize action.
      const warnings: TurnWarning[] = turn.objectInteractionUsed ? ['interaction-needs-utilize'] : [];
      return { turn: { ...turn, objectInteractionUsed: true }, warnings };
    }
    default: {
      const feet = parseMove(event);
      if (feet === undefined) return { turn, warnings: [] };
      const movementUsed = turn.movementUsed + feet;
      const over = movementUsed > movementAllowance(context.speed, turn.dashes);
      return { turn: { ...turn, movementUsed }, warnings: over ? ['over-speed'] : [] };
    }
  }
}

/** Apply events in order. Warnings are collected in order with duplicates removed. */
export function applyTurnEvents(
  turn: TurnState,
  events: TurnEvent[],
  context: TurnContext,
): TurnStep {
  let current = turn;
  const warnings: TurnWarning[] = [];
  for (const event of events) {
    const step = applyTurnEvent(current, event, context);
    current = step.turn;
    for (const w of step.warnings) if (!warnings.includes(w)) warnings.push(w);
  }
  return { turn: current, warnings };
}

/** The turn context for a character: its Speed and whether it is Incapacitated. */
export function turnContextOf(character: Character): TurnContext {
  return {
    speed: speedBreakdown(character).total,
    incapacitated: hasIncapacitated(character),
  };
}

/**
 * Apply a turn event to the character's own turn in its combat tracker. Returns
 * the character unchanged (no warnings) when it is not in combat.
 */
export function applyCharacterTurnEvent(
  character: Character,
  event: TurnEvent,
): { character: Character; warnings: TurnWarning[] } {
  const combat = character.combat;
  if (!combat) return { character, warnings: [] };
  const step = applyTurnEvent(combat.turn, event, turnContextOf(character));
  return { character: { ...character, combat: { ...combat, turn: step.turn } }, warnings: step.warnings };
}

/**
 * Whether to prompt a Death Saving Throw as a turn starts: it is the character's
 * own turn and it has 0 Hit Points, is not Stable and not dead. PHB 2024 "Death
 * Saving Throws" (L1155-1177): you make one whenever you start your turn with 0
 * Hit Points; a Stable creature makes none.
 */
export function shouldPromptDeathSave(input: {
  activeIsCharacter: boolean;
  hp: number;
  stable?: boolean;
  dead?: boolean;
}): boolean {
  return input.activeIsCharacter && input.dead !== true && input.stable !== true && input.hp <= 0;
}

/**
 * The same check for a character in combat: the active combatant is the
 * character's own entry and its life status is "making Death Saving Throws"
 * (0 HP, not Stable, not dead; Exhaustion 6 counts as dead).
 */
export function shouldPromptDeathSaveFor(character: Character): boolean {
  const combat = character.combat;
  if (!combat) return false;
  const active = combat.combatants[combat.activeIndex];
  return active?.isCharacter === true && lifeStatus(character) === 'making-death-saves';
}
