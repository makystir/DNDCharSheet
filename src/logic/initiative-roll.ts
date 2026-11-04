/**
 * Rolling Initiative (Stage A5c): which of Advantage / Disadvantage applies, and
 * the roll total with a visible Breakdown.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md):
 *  - "Initiative" (L870-879): every participant makes a Dexterity check; the
 *    check total is the Initiative count. If a combatant is surprised by combat
 *    starting it has Disadvantage on the roll. There is NO surprise round.
 *  - Incapacitated [Condition] (~L21185): "If you're Incapacitated when you roll
 *    Initiative, you have Disadvantage on the roll." Paralyzed, Petrified,
 *    Stunned and Unconscious each include Incapacitated.
 *  - Invisible [Condition] (~L21265): "If you're Invisible when you roll
 *    Initiative, you have Advantage on the roll."
 *  - "Advantage/Disadvantage" and "They Don't Stack" (L472-487): they never stack, and any mix of
 *    the two cancels out to a normal roll, whatever the number of sources.
 *  - Exhaustion (decision D1): Initiative is a Dexterity check, so it is a D20
 *    Test and its roll is reduced by 2 x Exhaustion level (L21024).
 *  - Decision D2: the Unconscious condition a character HAS at 0 Hit Points is
 *    derived (effectiveConditionIds), and counts as Incapacitated here.
 *  - A natural 20 or 1 has no special effect on a Dexterity check ("Rolling
 *    20 or 1", L466-471, is for attack rolls).
 *
 * Feats and features that add to Initiative (Alert, Jack of All Trades, Wisdom
 * for Gloom Stalker...) are not modelled: the user types a generic bonus.
 *
 * Everything is pure. Rolling takes an injected RNG; typed faces are accepted by
 * `resolveInitiativeRoll`.
 */
import type { Character } from '../types/character';
import { exhaustionLevelOf, impliedConditions } from './conditions';
import { combineD20Mode, d20FromFaces, d20TestBreakdown, rollD20, type D20Mode } from './dice';
import { initiativeBreakdown } from './initiative';
import { effectiveConditionIds } from './hit-points-state';
import type { Breakdown, BreakdownComponent } from './breakdown';
import type { RNG } from './random';

/** Where a source of Advantage / Disadvantage comes from (names the tooltip uses). */
export type InitiativeSource = 'surprised' | 'incapacitated' | 'invisible' | 'manual';

export interface InitiativeModeInput {
  /** The user marks the combatant as surprised by the start of combat. */
  surprised?: boolean;
  /** Manual sources (feats and features are not modelled). */
  manualAdvantage?: boolean;
  manualDisadvantage?: boolean;
}

export interface InitiativeModeResult {
  mode: D20Mode;
  advantageFrom: InitiativeSource[];
  disadvantageFrom: InitiativeSource[];
}

/**
 * True when the character has the Incapacitated condition for Initiative and
 * the turn tracker: stored, implied by a stored condition (Paralyzed, Petrified,
 * Stunned, stored Unconscious), or implied by the derived 0-HP Unconscious (D2).
 */
export function hasIncapacitated(character: Character): boolean {
  if (effectiveConditionIds(character).includes('incapacitated')) return true;
  return impliedConditions(character).some((c) => c.id === 'incapacitated');
}

/**
 * Resolve the Initiative roll mode from the character's conditions and the
 * manual toggles. Any Advantage together with any Disadvantage cancels to a
 * normal roll; several sources of one kind do not stack. The source lists name
 * every source found, for the tooltip, even when they cancel.
 */
export function initiativeRollMode(
  character: Character,
  input: InitiativeModeInput = {},
): InitiativeModeResult {
  const effective = new Set(effectiveConditionIds(character));
  const advantageFrom: InitiativeSource[] = [];
  const disadvantageFrom: InitiativeSource[] = [];

  if (effective.has('invisible')) advantageFrom.push('invisible');
  if (input.manualAdvantage === true) advantageFrom.push('manual');

  if (input.surprised === true) disadvantageFrom.push('surprised');
  if (hasIncapacitated(character)) disadvantageFrom.push('incapacitated');
  if (input.manualDisadvantage === true) disadvantageFrom.push('manual');

  const mode = combineD20Mode(advantageFrom.length > 0, disadvantageFrom.length > 0);
  return { mode, advantageFrom, disadvantageFrom };
}

export interface InitiativeRoll {
  mode: D20Mode;
  /** The d20 faces in the order drawn. */
  rolls: number[];
  /** The face kept (the higher with Advantage, the lower with Disadvantage). */
  used: number;
  /** Initiative count: the kept face plus the modifier plus the Exhaustion penalty. */
  total: number;
  /** d20 + Dexterity modifier + bonus + Exhaustion; components sum to the total. */
  breakdown: Breakdown;
}

function describeFaces(mode: D20Mode, rolls: number[], used: number): string | undefined {
  if (mode === 'normal') return undefined;
  const kept = mode === 'advantage' ? 'higher' : 'lower';
  return `${mode === 'advantage' ? 'Advantage' : 'Disadvantage'}: rolled ${rolls.join(' and ')}, kept the ${kept} (${used}).`;
}

/**
 * The Initiative count from d20 face(s). `modifier` is either a plain number (the
 * Dexterity modifier plus any bonus) or a Breakdown such as `initiativeBreakdown`,
 * whose components are shown individually. Exhaustion reduces the roll by 2 per
 * level (D1) and is always listed, even at zero. Throws a RangeError when the
 * faces do not match the mode or are not integers 1..20.
 */
export function initiativeRoll(
  faces: number[],
  mode: D20Mode,
  modifier: number | Breakdown,
  exhaustion = 0,
): InitiativeRoll {
  const d20 = d20FromFaces(faces, mode);
  const modifiers: BreakdownComponent[] =
    typeof modifier === 'number'
      ? [{ label: 'Initiative modifier', value: modifier }]
      : modifier.components.map((c) => ({ ...c }));
  const breakdown = d20TestBreakdown(d20.used, exhaustion, modifiers);
  const note = describeFaces(mode, d20.rolls, d20.used);
  return {
    mode,
    rolls: d20.rolls,
    used: d20.used,
    total: breakdown.total,
    breakdown: note ? { ...breakdown, note } : breakdown,
  };
}

/** The character's Initiative modifier: Dexterity modifier plus the manual bonus. */
export function characterInitiativeModifier(character: Character): Breakdown {
  return initiativeBreakdown(character.abilities, character.initiativeBonus);
}

/** Roll Initiative for a character with an injected RNG, using its resolved mode. */
export function rollInitiative(
  character: Character,
  rng: RNG,
  input: InitiativeModeInput = {},
): InitiativeRoll {
  const { mode } = initiativeRollMode(character, input);
  const d20 = rollD20(rng, mode);
  return initiativeRoll(d20.rolls, mode, characterInitiativeModifier(character), exhaustionLevelOf(character));
}

/**
 * Resolve an Initiative roll from d20 face(s) typed in from physical dice, using
 * the character's resolved mode, modifier and Exhaustion.
 */
export function resolveInitiativeRoll(
  character: Character,
  faces: number[],
  input: InitiativeModeInput = {},
): InitiativeRoll {
  const { mode } = initiativeRollMode(character, input);
  return initiativeRoll(faces, mode, characterInitiativeModifier(character), exhaustionLevelOf(character));
}
