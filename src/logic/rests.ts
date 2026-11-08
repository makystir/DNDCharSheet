/**
 * Short Rest and Long Rest (Stage A5b).
 *
 * All functions are pure and never mutate their input. Dice faces and the clock
 * are INJECTED: shortRest takes the die faces the user rolled (auto or typed
 * in, see dice.ts) and longRest takes `now` (epoch ms). Nothing here calls
 * Math.random or Date.now.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md):
 *  - Short Rest ("Short Rest", L21475-21490): a 1-hour period of downtime. You
 *    must have at least 1 Hit Point to start. On finishing you may spend one or
 *    more Hit Point Dice; for each, roll the die, add your Constitution modifier
 *    and regain that many Hit Points (minimum of 1 Hit Point), and you may
 *    decide on another die after each roll. Features that a Short Rest
 *    recharges recharge. Interruptions: rolling Initiative, casting a spell
 *    other than a cantrip, taking any damage. (An interrupted Short Rest
 *    confers no benefits: golden table reading of "stopped".)
 *  - Long Rest ("Long Rest", L21240-21262, interruptions L21296-21303): at
 *    least 8 hours, with at least 6 of sleep. During sleep you have the
 *    Unconscious condition. You must wait at least 16 hours before starting
 *    another. You must have at least 1 Hit Point to start. On finishing you
 *    regain all lost Hit Points and ALL spent Hit Point Dice (2024), your
 *    Exhaustion level decreases by 1, and features that a Long Rest recharges
 *    recharge. Interruptions: rolling Initiative, casting a non-cantrip spell,
 *    taking any damage, 1 hour of walking or other physical exertion. If you
 *    rested at least 1 hour before the interruption you gain the benefits of a
 *    Short Rest. You can resume immediately; the rest then takes 1 additional
 *    hour per interruption.
 *  - Temporary Hit Points last until depleted or a Long Rest is finished
 *    ("Temporary Hit Points", L1179-1193).
 *  - Warlock "Pact Magic" (L6854): you regain all expended Pact Magic spell
 *    slots when you finish a Short or Long Rest. Standard spell slots return on
 *    a Long Rest only (class Spellcasting). "Mystic Arcanum" (L6892): all uses
 *    return when you finish a Long Rest.
 *
 * DECISIONS AND INTERPRETATIONS:
 *  - D5: the 16-hour wait is ADVISORY only (longRestGapAdvisory). Nothing here
 *    ever blocks a Long Rest because of it.
 *  - D11 / D1: per-use feature recharge (Rage, Channel Divinity, Arcane Recovery,
 *    Magical Cunning, ...) lives in resources.ts `rechargeResources`, called
 *    at the end of a COMPLETED short or long rest; the result lists what came
 *    back in `resourcesRecovered`. Rejected and interrupted rests recover nothing.
 *  - Interpretation (orchestrator-approved): a Long Rest ends Concentration.
 *    The sleeper is Unconscious, which implies Incapacitated, which ends
 *    Concentration ("Concentration: Incapacitated or Dead", L20777).
 *  - Hit Dice: the number available is the character level less those spent
 *    (hitDiceTotal). The PHB gives no way to roll Hit Dice of a class with no
 *    class chosen, so spending one without a class is rejected.
 */
import type { Breakdown, BreakdownComponent } from './breakdown';
import type { Character } from '../types/character';
import { abilityModifier } from './abilities';
import { rechargeResources, type ResourceRecovery } from './resources';
import { hitDiceTotal, resolveClass } from './classes';
import { effectiveAbilityScores } from './feats';
import { exhaustionAfterLongRest, exhaustionLevelOf, setExhaustion } from './conditions';
import { endConcentration } from './concentration';
import {
  applyHealing,
  effectiveHp,
  effectiveTempHp,
  hpStateOf,
  lifeStatus,
  writeHpState,
} from './hit-points-state';

export type RestKind = 'short' | 'long';
export type RestOutcome = 'completed' | 'rejected' | 'interrupted';
export type RestError =
  | 'dead'
  | 'needs-hp'
  | 'not-enough-hit-dice'
  | 'invalid-roll'
  | 'no-hit-die';

export interface RestResult {
  outcome: RestOutcome;
  /** Present when `outcome` is 'rejected'. */
  error?: RestError;
  /** The resulting character. The input itself when rejected or interrupted. */
  character: Character;
  /** Short Rest: per-die result (face + Con modifier, minimum 1), before the HP cap. */
  rolled?: number[];
  /** Short Rest: Hit Points actually regained (after the cap at the maximum). */
  hpGained?: number;
  /** Short Rest: the arithmetic of `rolled` (components sum to the total rolled). */
  breakdown?: Breakdown;
  /** Short Rest: Hit Points regained after the cap (rolled, less what the maximum cut off). */
  regainedBreakdown?: Breakdown;
  /** Short Rest: Hit Points after the rest (current + regained). */
  afterBreakdown?: Breakdown;
  /** Long Rest: named before -> after Breakdowns for each figure it changes. */
  longRestBreakdowns?: LongRestBreakdowns;
  /** Completed rests: limited-use features that regained uses (empty when none). Absent when rejected or interrupted. */
  resourcesRecovered?: ResourceRecovery[];
}

export interface LongRestBreakdowns {
  /** Absent when no Hit Point maximum is set. */
  hitPoints?: Breakdown;
  hitDiceSpent: Breakdown;
  tempHp: Breakdown;
  exhaustion: Breakdown;
}

export interface ShortRestOptions {
  /** The die FACE rolled for each Hit Die spent, in order. */
  rolls: number[];
  /** The rest was interrupted: it confers no benefits at all. */
  interrupted?: boolean;
}

export interface LongRestOptions {
  /** Epoch ms from an injected clock. When omitted, lastLongRestAt is left alone. */
  now?: number;
}

// ─── Interruption, duration, advisory ────────────────────────────────────────

/** Events that interrupt a rest (PHB L21487-21490 and L21296-21303). */
export type RestInterruptionTrigger =
  | 'rolling-initiative'
  | 'non-cantrip-spell'
  | 'damage'
  | 'one-hour-exertion';

export const INTERRUPTION_TRIGGERS: Record<RestKind, RestInterruptionTrigger[]> = {
  short: ['rolling-initiative', 'non-cantrip-spell', 'damage'],
  long: ['rolling-initiative', 'non-cantrip-spell', 'damage', 'one-hour-exertion'],
};

const MIN_HOURS_FOR_SHORT_REST_BENEFITS = 1; // PHB L21305: "rested at least 1 hour".
const LONG_REST_BASE_HOURS = 8; // PHB L21243: "at least 8 hours".
const LONG_REST_WAIT_HOURS = 16; // PHB L21245: "wait at least 16 hours".
const HOUR_MS = 3_600_000;

/**
 * What an interrupted rest still grants. A Short Rest that is interrupted gives
 * nothing. A Long Rest interrupted after at least 1 hour of rest gives the
 * benefits of a Short Rest; before that, nothing.
 */
export function restInterruptOutcome(kind: RestKind, hoursCompleted: number): 'none' | 'short-rest' {
  if (kind === 'short') return 'none';
  return hoursCompleted >= MIN_HOURS_FOR_SHORT_REST_BENEFITS ? 'short-rest' : 'none';
}

/** Hours a Long Rest needs: 8, plus 1 additional hour per interruption (L21306). */
export function longRestHoursRequired(interruptions: number): number {
  const count = Number.isFinite(interruptions) ? Math.max(0, Math.trunc(interruptions)) : 0;
  return LONG_REST_BASE_HOURS + count;
}

/**
 * Decision D5, ADVISORY only: true when fewer than 16 hours have passed since
 * the last Long Rest, or the clock reads earlier than the recorded rest (skew).
 * False when there is no recorded rest. Never blocks anything.
 */
export function longRestGapAdvisory(last: number | undefined, now: number): boolean {
  if (last === undefined || !Number.isFinite(last) || !Number.isFinite(now)) return false;
  if (now < last) return true;
  return now - last < LONG_REST_WAIT_HOURS * HOUR_MS;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wholeNonNegative(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function reject(character: Character, error: RestError): RestResult {
  return { outcome: 'rejected', error, character, rolled: [], hpGained: 0 };
}

/** Shared start checks: dead is refused, then fewer than 1 Hit Point. */
function startError(character: Character): RestError | undefined {
  if (lifeStatus(character) === 'dead') return 'dead';
  const state = hpStateOf(character);
  if (state && state.hp < 1) return 'needs-hp';
  return undefined;
}

/** Remove the named spellcasting slot fields, keeping the rest of the state. */
function withoutSlotFields(
  character: Character,
  fields: Array<'slotsExpended' | 'pactSlotsExpended' | 'mysticArcanaExpended'>,
): Character {
  const state = character.spellcasting;
  if (!state) return character;
  const next = { ...state };
  for (const field of fields) delete next[field];
  return { ...character, spellcasting: next };
}

/** Hit Dice still available to spend. */
export function hitDiceAvailable(character: Character): number {
  const total = wholeNonNegative(hitDiceTotal(character));
  return Math.max(0, total - Math.min(total, wholeNonNegative(character.hitDiceSpent)));
}

// ─── Short Rest ──────────────────────────────────────────────────────────────

/**
 * Take a Short Rest. Each spent Hit Die regains face + Constitution modifier,
 * minimum 1 PER DIE (L21481). Healing is capped at the Hit Point maximum (the
 * excess is lost, the die is still spent). A completed Short Rest restores
 * Pact Magic slots only (L6854), never standard slots, then calls
 * rechargeResources. Rejected (unchanged) when dead, below 1 Hit Point, more
 * dice than remain, or a face outside 1..die size. Interrupted: no benefits.
 */
export function shortRest(character: Character, options: ShortRestOptions): RestResult {
  const startFailure = startError(character);
  if (startFailure) return reject(character, startFailure);

  if (options.interrupted === true) {
    return { outcome: 'interrupted', character, rolled: [], hpGained: 0 };
  }

  const faces = options.rolls;
  const hitDie = resolveClass(character)?.hitDie;
  const state = hpStateOf(character);
  if (faces.length > 0) {
    // A class supplies both the Hit Die and the Hit Point maximum.
    if (hitDie === undefined || !state) return reject(character, 'no-hit-die');
    if (faces.length > hitDiceAvailable(character)) return reject(character, 'not-enough-hit-dice');
    if (faces.some((f) => !Number.isInteger(f) || f < 1 || f > hitDie)) {
      return reject(character, 'invalid-roll');
    }
  }

  const conMod = abilityModifier(effectiveAbilityScores(character).con);
  const components: BreakdownComponent[] = [];
  const rolled: number[] = [];
  faces.forEach((face, i) => {
    const raw = face + conMod;
    const perDie = Math.max(1, raw);
    const n = i + 1;
    components.push(
      { label: `d${hitDie} roll (die ${n})`, value: face },
      { label: `Con mod (die ${n})`, value: conMod },
    );
    if (perDie !== raw) components.push({ label: `Minimum 1 (die ${n})`, value: perDie - raw });
    rolled.push(perDie);
  });
  const total = rolled.reduce((sum, v) => sum + v, 0);
  if (components.length === 0) components.push({ label: 'No Hit Dice spent', value: 0 });

  let next: Character = character;
  let hpGained = 0;
  if (state && faces.length > 0) {
    const healed = applyHealing(state, total);
    hpGained = healed.regained;
    next = writeHpState(next, healed.next);
    next = { ...next, hitDiceSpent: wholeNonNegative(character.hitDiceSpent) + faces.length };
  }
  next = withoutSlotFields(next, ['pactSlotsExpended']);
  const shortRecharge = rechargeResources(next, 'short');
  next = shortRecharge.character;

  const note =
    state && hpGained < total
      ? `Capped at the Hit Point maximum (${state.max}): ${hpGained} regained, ${total - hpGained} lost. Each die is at least 1.`
      : 'Each die regains its roll plus the Constitution modifier, at least 1.';
  const regainedBreakdown: Breakdown | undefined = state
    ? {
        total: hpGained,
        components: [
          { label: 'Hit Points rolled', value: total },
          { label: 'Lost to the Hit Point maximum', value: hpGained - total },
        ],
        note: 'Healing cannot raise you above your Hit Point maximum; a Hit Die is still spent.',
      }
    : undefined;
  const afterBreakdown: Breakdown | undefined = state
    ? {
        total: state.hp + hpGained,
        components: [
          { label: 'Current Hit Points', value: state.hp },
          { label: 'Hit Points regained', value: hpGained },
        ],
      }
    : undefined;
  return {
    outcome: 'completed',
    character: next,
    rolled,
    hpGained,
    breakdown: { total, components, note },
    regainedBreakdown,
    afterBreakdown,
    resourcesRecovered: shortRecharge.recovered,
  };
}

// ─── Long Rest ───────────────────────────────────────────────────────────────

/**
 * Finish a Long Rest. Rejected (unchanged) when dead or below 1 Hit Point.
 * Completed: Hit Points to maximum, ALL spent Hit Dice back (2024), Temporary
 * Hit Points and Death Saving Throw counters cleared, Exhaustion down 1,
 * standard slots, Pact Magic slots and Mystic Arcanum restored, Concentration
 * ended (interpretation, see header), lastLongRestAt set when `now` is given,
 * then rechargeResources. The 16-hour wait is advisory only (D5).
 */
export function longRest(character: Character, options: LongRestOptions = {}): RestResult {
  const startFailure = startError(character);
  if (startFailure) return reject(character, startFailure);

  let next: Character = { ...character };
  // Hit Points to maximum; Temp HP and Death Saving Throws cleared (Stable too).
  const state = hpStateOf(character);
  if (state) {
    next = writeHpState(next, {
      ...state,
      hp: state.max,
      temp: 0,
      deathSaves: { successes: 0, failures: 0 },
      stable: false,
    });
  } else {
    delete next.tempHp;
    delete next.deathSaves;
  }
  delete next.hitDiceSpent;
  next = setExhaustion(next, exhaustionAfterLongRest(exhaustionLevelOf(character)));
  next = withoutSlotFields(next, ['slotsExpended', 'pactSlotsExpended', 'mysticArcanaExpended']);
  next = endConcentration(next);
  if (options.now !== undefined && Number.isFinite(options.now)) next.lastLongRestAt = options.now;
  const longRecharge = rechargeResources(next, 'long');
  next = longRecharge.character;
  const hpBefore = effectiveHp(character);
  const hpAfter = effectiveHp(next);
  const spentBefore = wholeNonNegative(character.hitDiceSpent);
  const tempBefore = effectiveTempHp(character);
  const exhaustionBefore = exhaustionLevelOf(character);
  const exhaustionAfter = exhaustionLevelOf(next);
  const longRestBreakdowns: LongRestBreakdowns = {
    hitPoints:
      hpBefore !== undefined && hpAfter !== undefined
        ? {
            total: hpAfter,
            components: [
              { label: 'Current Hit Points', value: hpBefore },
              { label: 'Restored to Hit Point maximum', value: hpAfter - hpBefore },
            ],
          }
        : undefined,
    hitDiceSpent: {
      total: wholeNonNegative(next.hitDiceSpent),
      components: [
        { label: 'Hit Dice spent now', value: spentBefore },
        { label: 'All Hit Dice regained', value: wholeNonNegative(next.hitDiceSpent) - spentBefore },
      ],
    },
    tempHp: {
      total: effectiveTempHp(next),
      components: [
        { label: 'Current Temporary Hit Points', value: tempBefore },
        { label: 'Cleared by Long Rest', value: effectiveTempHp(next) - tempBefore },
      ],
    },
    exhaustion: {
      total: exhaustionAfter,
      components: [
        { label: 'Current Exhaustion level', value: exhaustionBefore },
        { label: 'Reduced by 1 (minimum 0)', value: exhaustionAfter - exhaustionBefore },
      ],
    },
  };
  return { outcome: 'completed', character: next, longRestBreakdowns, resourcesRecovered: longRecharge.recovered };
}
