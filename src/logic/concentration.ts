/**
 * Concentration (Stage A5b).
 *
 * All functions are pure and never mutate their input. Rolling is separate: the
 * save takes the d20 result as a parameter (see dice.ts), so no RNG or clock is
 * used here.
 *
 * RULES (PHB 2024 "Concentration", Docs/PlayersHandbook.md L20767-20777):
 *  - The creator can end Concentration at any time (no action required).
 *  - Another Concentration Effect: you lose Concentration the moment you start
 *    casting a spell that requires Concentration or activate another effect
 *    that requires it.
 *  - Damage: a Constitution saving throw; the DC is 10 or half the damage taken
 *    (round down), whichever is higher, up to a maximum DC of 30.
 *  - Incapacitated or Dead: Concentration ends if you have the Incapacitated
 *    condition or you die.
 *  - A saving throw is a D20 Test: it succeeds when the total equals or exceeds
 *    the target number ("D20 Tests", L364). Natural 20 / 1 are attack-roll rules
 *    only ("Rolling 20 or 1", L466), so a save has no automatic result.
 *
 * DECISIONS (final):
 *  - D1: Exhaustion reduces the roll by 2 x level; it is a visible Breakdown
 *    component of the save. Natural 1 / 20 have no special effect on a save.
 *  - D4: the damage that triggers the check is the damage dealt after modifiers,
 *    including the part absorbed by Temporary Hit Points, unless the A5a
 *    "absorbed damage is no damage" toggle is on (DamageResult.tookDamage
 *    already encodes that; pass `result.damageDealt` only when `tookDamage`).
 *  - D7: Advantage / Disadvantage on the save is chosen manually by the user
 *    (rollD20 / d20FromFaces); the Constitution modifier comes from
 *    savingThrowBreakdown via allSavingThrowBreakdowns.
 *
 * AMBIGUITY (flagged): the PHB does not say a Long Rest ends Concentration in
 * one sentence; rests.ts reads it from "During sleep, you have the Unconscious
 * condition" plus "Incapacitated or Dead".
 */
import type { Breakdown, BreakdownComponent } from './breakdown';
import type { SpellId } from '../data/spells';
import type { Character } from '../types/character';
import { effectiveConditionIds, lifeStatus } from './hit-points-state';
import { exhaustionLevelOf, impliedConditions } from './conditions';
import { expireOnConcentrationEnd } from './condition-duration';
import { d20TestBreakdown } from './dice';
import { allSavingThrowBreakdowns } from './saving-throws';

/** Base DC (PHB L20775: "10 or half the damage taken, whichever is higher"). */
export const CONCENTRATION_BASE_DC = 10;
/** Maximum DC (PHB L20775: "up to a maximum DC of 30"). */
export const CONCENTRATION_MAX_DC = 30;

export interface ConcentrationCheck {
  /** A save is required only when damage was taken (> 0). */
  required: boolean;
  /** The save DC; undefined when no save is required. */
  dc?: number;
  /**
   * The DC arithmetic; components sum to `dc`. Undefined when no save is
   * required.
   */
  breakdown?: Breakdown;
}

/**
 * The Concentration save a hit forces. `damage` is the damage taken (see D4 in
 * the file header). DC = max(10, floor(damage / 2)), capped at 30. Breakdown:
 * base 10, plus the half-damage-above-10 step (never negative), plus the cap
 * step (zero or negative), so the components always sum to the DC.
 */
export function concentrationCheck(damage: number): ConcentrationCheck {
  const taken = Number.isFinite(damage) ? Math.max(0, Math.trunc(damage)) : 0;
  if (taken <= 0) return { required: false };
  const half = Math.floor(taken / 2);
  const aboveBase = Math.max(0, half - CONCENTRATION_BASE_DC);
  const uncapped = CONCENTRATION_BASE_DC + aboveBase;
  const dc = Math.min(CONCENTRATION_MAX_DC, uncapped);
  const components: BreakdownComponent[] = [
    { label: 'Base DC', value: CONCENTRATION_BASE_DC },
    { label: 'Half the damage above 10 (round down)', value: aboveBase },
    { label: 'Cap at maximum DC 30', value: dc - uncapped },
  ];
  return {
    required: true,
    dc,
    breakdown: {
      total: dc,
      components,
      note: `Damage taken ${taken}; half of it is ${half}. The DC is the higher of 10 or half the damage, up to 30.`,
    },
  };
}

export interface ConcentrationSaveResult {
  /** d20 + save modifier - 2 x Exhaustion level. */
  total: number;
  /** True when total equals or exceeds the DC. */
  success: boolean;
  /** The roll's arithmetic; Exhaustion is its own component. */
  breakdown: Breakdown;
}

function assertD20(d20: number): void {
  if (!Number.isInteger(d20) || d20 < 1 || d20 > 20) {
    throw new RangeError(`concentration save: d20 must be an integer 1..20, got ${d20}`);
  }
}

/**
 * Judge a Concentration save from the raw d20 and the total Constitution save
 * modifier. Succeeds iff total >= DC. Exhaustion reduces the roll by 2 x level
 * (D1). There is NO natural 1 / 20 special case (attack rolls only).
 */
export function concentrationSave(
  d20: number,
  saveMod: number,
  exhaustionLevel: number,
  dc: number,
): ConcentrationSaveResult {
  return judge(d20, [{ label: 'Constitution save modifier', value: Math.trunc(saveMod) }], exhaustionLevel, dc);
}

function judge(
  d20: number,
  modifiers: BreakdownComponent[],
  exhaustionLevel: number,
  dc: number,
): ConcentrationSaveResult {
  assertD20(d20);
  const breakdown = d20TestBreakdown(d20, exhaustionLevel, modifiers);
  return { total: breakdown.total, success: breakdown.total >= dc, breakdown };
}

/**
 * The Constitution saving throw modifier for a character (ability modifier plus
 * proficiency when proficient), straight from savingThrowBreakdown (D7).
 */
export function constitutionSaveBreakdown(character: Character): Breakdown {
  // Un-penalised: the roll adds Exhaustion itself (counted exactly once).
  return allSavingThrowBreakdowns(character, { exhaustion: false }).con;
}

/**
 * Resolve a Concentration save for a character: the Constitution save
 * components (Con mod, Proficiency) and the Exhaustion component are each
 * visible in the breakdown.
 */
export function resolveConcentrationSave(
  character: Character,
  d20: number,
  dc: number,
): ConcentrationSaveResult {
  return judge(d20, constitutionSaveBreakdown(character).components, exhaustionLevelOf(character), dc);
}

export type ConcentrationEndReason = 'incapacitated' | 'dead';

/**
 * Why the character's state ends Concentration, or null if it does not (also
 * null when not concentrating). 'dead' takes precedence. Dead covers the dead
 * flag, Exhaustion level 6 and a Hit Point maximum of 0 (lifeStatus).
 * Incapacitated considers STORED conditions, conditions they IMPLY
 * (Paralyzed, Petrified, Stunned, Unconscious), and the Unconscious derived
 * from 0 HP (effectiveConditionIds, decision D2).
 */
export function shouldEndConcentration(character: Character): ConcentrationEndReason | null {
  if (!character.concentration) return null;
  if (lifeStatus(character) === 'dead') return 'dead';
  const incapacitated =
    effectiveConditionIds(character).includes('incapacitated') ||
    impliedConditions(character).some((c) => c.id === 'incapacitated');
  return incapacitated ? 'incapacitated' : null;
}

/** Drop the Concentration field (the creator ends it, or it is broken). */
export function endConcentration(character: Character): Character {
  if (!character.concentration) return character;
  const { concentration: _removed, ...rest } = character;
  void _removed;
  // Stage E: conditions whose structured duration is "while concentrating" end
  // with the Concentration (PHB "Concentration", L20767-20777).
  return expireOnConcentrationEnd(rest);
}

/**
 * Break Concentration when the character's state requires it. Returns the
 * (possibly unchanged) character and the reason, if any.
 */
export function endConcentrationIfBroken(character: Character): {
  character: Character;
  reason: ConcentrationEndReason | null;
} {
  const reason = shouldEndConcentration(character);
  return reason === null ? { character, reason } : { character: endConcentration(character), reason };
}

/**
 * Start a spell. A spell that requires Concentration ends any previous
 * Concentration effect and becomes the current one (L20773); re-starting the
 * spell already being concentrated on ends nothing. A spell that does not
 * require Concentration leaves the current effect alone.
 */
export function startConcentration(
  character: Character,
  spellId: SpellId,
  requiresConcentration: boolean,
): { character: Character; endedPrevious?: SpellId } {
  if (!requiresConcentration) return { character };
  const previous = character.concentration?.spellId;
  const next: Character = { ...character, concentration: { spellId } };
  // Stage E: the previous effect ended, so its Concentration-linked conditions end.
  return previous !== undefined && previous !== spellId
    ? { character: expireOnConcentrationEnd(next), endedPrevious: previous }
    : { character: next };
}
