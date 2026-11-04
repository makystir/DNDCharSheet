/**
 * Current Hit Points, damage, healing, Temporary Hit Points and Death Saving
 * Throws (Stage A5a). Kept apart from hit-points.ts, which only computes the
 * Hit Point MAXIMUM.
 *
 * All functions are pure and never mutate their input. Rolling is separate:
 * every rules function takes the d20 result as a parameter (see dice.ts).
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md):
 *  - Hit Points run from the maximum down to 0 and cannot go lower; Bloodied is
 *    half your Hit Points or fewer ("Hit Points", L1073-1079).
 *  - Damage order of application: bonuses/penalties/multipliers first, then
 *    Resistance (halve, round down), then Vulnerability (double); Immunity
 *    means the damage is not taken ("Damage Rolls", "Resistance and
 *    Vulnerability", "Order of Application", "Immunity", ~L1082-1128).
 *  - Healing is capped at the maximum, excess lost ("Healing", ~L1129).
 *  - Temporary Hit Points are lost first, never stack, are not Hit Points or
 *    healing, and last until depleted or a Long Rest ("Temporary Hit Points",
 *    L1179-1193).
 *  - Dropping to 0: Massive Damage kills when the remainder equals or exceeds
 *    the maximum (L1145); otherwise the creature has the Unconscious condition
 *    and makes Death Saving Throws ("Falling Unconscious", L1152-1153).
 *  - Death Saving Throws: d20, 10 or higher succeeds; three of a kind decides;
 *    natural 1 = two failures; natural 20 = regain 1 HP; damage at 0 HP = one
 *    failure (two on a Critical Hit; death if it equals or exceeds the maximum);
 *    counters reset on regaining any HP or on becoming Stable (L1155-1171).
 *  - Stabilizing: a Stable creature stays at 0 HP, still Unconscious, makes no
 *    Death Saving Throws, and stops being Stable on taking damage (L1174-1177).
 *  - Knocking Out: a melee attack that would reduce a creature to 0 may instead
 *    leave it at 1 HP and Unconscious, starting a Short Rest (L1159-1161).
 *  - Exhaustion level 6 is death (Exhaustion condition, L21021); a Hit Point
 *    maximum of 0 is death (L1144).
 *
 * AMBIGUITIES (rules-compliance rule 8; each is a user decision, final):
 *  - D3 Massive Damage vs Temporary Hit Points. The PHB says "when damage
 *    reduces a character to 0 Hit Points and damage remains". It does not say
 *    whether Temporary Hit Points are spent first. We read it as: Temp HP
 *    absorb first (L1183), then HP, and what is left over is the remainder
 *    compared with the Hit Point maximum. The same post-Temp-HP figure is used
 *    for "damage equals or exceeds your Hit Point maximum" at 0 HP.
 *  - D4 Damage fully absorbed by Temp HP. The PHB says Temp HP are "a buffer
 *    against losing actual Hit Points" and says "any damage" at 0 HP, but does
 *    not address absorbed damage. Default: absorbed damage still counts as
 *    damage taken (a death-save failure at 0 HP, and Concentration). The
 *    `absorbedCountsAsDamage` option set to false takes the stricter reading.
 *  - Instant death records no death-save failure; the counters are left as
 *    they were. Death by a third failure records that failure.
 *  - Exhaustion on Death Saving Throws: the PHB does not say outright that a
 *    Death Saving Throw is a D20 Test. Decision D1 applies the -2 x level
 *    penalty to the ROLL; natural 1 / 20 are judged on the raw die.
 *  - D2 At 0 HP the character HAS the Unconscious condition. That is DERIVED
 *    (effectiveConditionIds) and never written to `character.conditions`.
 *    Only knockOut() writes it.
 */
import type { Character, DeathSaveState } from '../types/character';
import { CONDITIONS, getCondition, type ConditionId } from '../data/conditions';
import type { Breakdown, BreakdownComponent } from './breakdown';
import { resolveClass } from './classes';
import {
  activeConditionIds,
  applyCondition,
  clampExhaustionLevel,
  exhaustionEffects,
  exhaustionLevelOf,
} from './conditions';
import { d20TestBreakdown } from './dice';
import { effectiveAbilityScores } from './feats';
import { hitPointMaxBreakdown } from './hit-points';
import { resolveSpecies } from './species';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Death Saving Throw counters, each 0..3. */
export interface DeathSaveCounters {
  successes: number;
  failures: number;
}

/** Derived life state of a character. "Dying" is not a 2024 term. */
export type LifeStatus = 'healthy' | 'bloodied' | 'making-death-saves' | 'stable' | 'dead';

/** Pure Hit Point state the damage / healing functions operate on. */
export interface HpState {
  /** Hit Point maximum. */
  max: number;
  /** Current Hit Points, 0..max. */
  hp: number;
  /** Temporary Hit Points, >= 0. */
  temp: number;
  deathSaves: DeathSaveCounters;
  /** Stable: 0 HP, no Death Saving Throws. */
  stable: boolean;
  dead: boolean;
}

/** One instance of damage, as typed by the user. Modifiers are per instance. */
export interface DamageRequest {
  /** Damage rolled, before any modifier. */
  amount: number;
  /** Adjustment applied FIRST (negative = reduction). Default 0. */
  flat?: number;
  /** Resistance to this damage type: halve, round down. */
  resistance?: boolean;
  /** Vulnerability to this damage type: double. */
  vulnerability?: boolean;
  /** Immunity to this damage type: take none. */
  immune?: boolean;
  /** The damage came from a Critical Hit (matters only at 0 HP). */
  crit?: boolean;
}

export interface DamageOptions {
  /**
   * D4: damage fully absorbed by Temp HP still counts as damage taken. Default
   * true; false takes the stricter reading.
   */
  absorbedCountsAsDamage?: boolean;
}

export interface DamageResult {
  /** Damage after flat adjustment, Resistance, Vulnerability, Immunity (>= 0). */
  damageDealt: number;
  tempAbsorbed: number;
  hpLost: number;
  /** Damage left over once HP reached 0 (0 if HP stayed above 0 or was already 0). */
  remainder: number;
  /** Died outright (Massive Damage, or damage >= maximum at 0 HP). */
  instantDeath: boolean;
  /** Death-save failures this hit added (0 for instant death). */
  failuresAdded: number;
  /** Counts as damage taken (death-save failure at 0 HP, Concentration). */
  tookDamage: boolean;
  /** Now at 0 HP and not dead. */
  atZero: boolean;
  next: HpState;
  /** The damage arithmetic (components sum to `damageDealt`); `note` narrates the rest. */
  breakdown: Breakdown;
}

export interface HealResult {
  next: HpState;
  /** Hit Points actually regained (excess over the maximum is lost). */
  regained: number;
}

export type TempHpChoice = 'keep' | 'replace';

export type DeathSaveOutcomeKind = 'success' | 'failure' | 'critical-failure' | 'regain-hp';

export interface DeathSaveRoll {
  outcome: DeathSaveOutcomeKind;
  successesAdded: number;
  failuresAdded: number;
  regainHp: boolean;
  /** The raw d20 face; natural 1 / 20 are judged on this. */
  natural: number;
  /** d20 + modifier (compared with 10 for success). */
  total: number;
  breakdown: Breakdown;
}

export interface DeathSaveAdvance {
  saves: DeathSaveCounters;
  stable: boolean;
  dead: boolean;
  /** Hit Points after the throw: 1 on a natural 20, otherwise 0. */
  hp: number;
}

const NO_SAVES: DeathSaveCounters = { successes: 0, failures: 0 };
const DEATH_SAVE_TARGET = 10; // PHB L1165: "If the roll is 10 or higher, you succeed."
const SAVES_TO_RESOLVE = 3; // PHB L1165: third success = Stable, third failure = death.

function wholeNonNegative(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function wholeSigned(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.trunc(value);
}

// â”€â”€â”€ Hit Point maximum for a character â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Hit Point maximum breakdown for a character (same inputs as the Combat page). */
export function characterHitPointMaxBreakdown(character: Character): Breakdown {
  const species = resolveSpecies(character);
  const hpPerLevel = species?.traits.find((t) => t.mechanics?.hpPerLevel)?.mechanics?.hpPerLevel;
  return hitPointMaxBreakdown({
    scores: effectiveAbilityScores(character),
    level: character.level,
    hitDie: resolveClass(character)?.hitDie,
    hpMax: character.hpMax,
    hpPerLevel,
    rolledHp: character.houseRules?.rolledHp,
    rolledHpTotal: character.rolledHpTotal,
  });
}

/**
 * The Hit Point maximum, or undefined when none is set (no class and no
 * `hpMax`). We never invent a maximum.
 */
export function hitPointMaxOf(character: Character): number | undefined {
  const hasClass = resolveClass(character) !== undefined;
  const hasManual = character.hpMax !== undefined && Number.isFinite(character.hpMax);
  if (!hasClass && !hasManual) return undefined;
  return characterHitPointMaxBreakdown(character).total;
}

/**
 * Current Hit Points: stored value clamped to 0..max, or the maximum when the
 * field is absent (D6: absent follows max; clamp down when max drops). Undefined
 * when no maximum is set.
 */
export function effectiveHp(character: Character): number | undefined {
  const max = hitPointMaxOf(character);
  if (max === undefined) return undefined;
  const stored = character.currentHp;
  if (stored === undefined || !Number.isFinite(stored)) return Math.max(0, max);
  return Math.min(Math.max(0, Math.trunc(stored)), Math.max(0, max));
}

/** Temporary Hit Points (absent = 0). */
export function effectiveTempHp(character: Character): number {
  return wholeNonNegative(character.tempHp);
}

/** Death Saving Throw counters (absent = 0 / 0), clamped to 0..3. */
export function effectiveDeathSaves(character: Character): DeathSaveCounters {
  const saves = character.deathSaves;
  return {
    successes: Math.min(SAVES_TO_RESOLVE, wholeNonNegative(saves?.successes)),
    failures: Math.min(SAVES_TO_RESOLVE, wholeNonNegative(saves?.failures)),
  };
}

/** The pure HP state for a character, or undefined when no maximum is set. */
export function hpStateOf(character: Character): HpState | undefined {
  const max = hitPointMaxOf(character);
  const hp = effectiveHp(character);
  if (max === undefined || hp === undefined) return undefined;
  return {
    max,
    hp,
    temp: effectiveTempHp(character),
    deathSaves: effectiveDeathSaves(character),
    stable: character.deathSaves?.stable === true,
    dead: character.dead === true,
  };
}

/**
 * Write a pure HP state back onto a character. Fields return to absent when
 * they hold their default: currentHp at maximum, tempHp 0, deathSaves 0/0 and
 * not Stable, dead false.
 */
export function writeHpState(character: Character, state: HpState): Character {
  const next: Character = { ...character };
  if (state.hp >= state.max) delete next.currentHp;
  else next.currentHp = state.hp;
  if (state.temp > 0) next.tempHp = state.temp;
  else delete next.tempHp;
  if (state.deathSaves.successes > 0 || state.deathSaves.failures > 0 || state.stable) {
    const saves: DeathSaveState = { ...state.deathSaves };
    if (state.stable) saves.stable = true;
    next.deathSaves = saves;
  } else {
    delete next.deathSaves;
  }
  if (state.dead) next.dead = true;
  else delete next.dead;
  return next;
}

// â”€â”€â”€ Life status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface LifeStatusInput {
  /** Hit Point maximum, or undefined when none is set. */
  max: number | undefined;
  hp: number;
  stable?: boolean;
  deadFlag?: boolean;
  exhaustion?: number;
}

/**
 * Pure life-status derivation. Dead when the explicit flag is set, Exhaustion is
 * level 6 (L21021), or the Hit Point maximum is 0 (L1144). At 0 HP: Stable or
 * making Death Saving Throws. Bloodied at half the maximum or fewer (L1079).
 */
export function deriveLifeStatus(input: LifeStatusInput): LifeStatus {
  if (input.deadFlag === true) return 'dead';
  if (clampExhaustionLevel(input.exhaustion ?? 0) >= 6) return 'dead';
  if (input.max === undefined) return 'healthy'; // no maximum set: nothing to judge
  if (input.max <= 0) return 'dead';
  if (input.hp <= 0) return input.stable === true ? 'stable' : 'making-death-saves';
  // hp <= max / 2, kept in integers so odd maxima need no rounding.
  if (input.hp * 2 <= input.max) return 'bloodied';
  return 'healthy';
}

/** The character's life status. Exhaustion 6 is derived, never written to `dead`. */
export function lifeStatus(character: Character): LifeStatus {
  const state = hpStateOf(character);
  return deriveLifeStatus({
    max: state?.max,
    hp: state?.hp ?? 0,
    stable: state?.stable,
    deadFlag: character.dead,
    exhaustion: exhaustionLevelOf(character),
  });
}

/**
 * Bloodied: half your Hit Points or fewer (PHB L1079). It has no effect on its
 * own and also holds at 0 HP. Never true for a dead character or when no Hit
 * Point maximum is set.
 */
export function isBloodied(character: Character): boolean {
  const state = hpStateOf(character);
  if (!state || state.max <= 0 || lifeStatus(character) === 'dead') return false;
  return state.hp * 2 <= state.max;
}

/**
 * Breakdown of the CURRENT Hit Points for display: the Hit Point maximum plus
 * the damage taken (a negative component) sum to the current value. Undefined
 * when no maximum is set.
 */
export function currentHpBreakdown(character: Character): Breakdown | undefined {
  const max = hitPointMaxOf(character);
  const hp = effectiveHp(character);
  if (max === undefined || hp === undefined) return undefined;
  return {
    total: hp,
    components: [
      { label: 'Hit Point maximum', value: Math.max(0, max) },
      { label: 'Damage taken', value: hp - Math.max(0, max) },
    ],
  };
}

// â”€â”€â”€ Derived conditions (D2) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * DERIVED / READ-ONLY: conditions the character has because it is at 0 HP and
 * not dead (Unconscious, plus the Incapacitated and Prone it implies), not
 * already stored. PHB L1153, Unconscious condition L21697-21709. Never written.
 */
export function derivedConditionIds(character: Character): ConditionId[] {
  const status = lifeStatus(character);
  if (status !== 'making-death-saves' && status !== 'stable') return [];
  const unconscious = getCondition('unconscious');
  if (!unconscious) return [];
  const derived: ConditionId[] = ['unconscious', ...unconscious.implies];
  const stored = new Set(activeConditionIds(character));
  return CONDITIONS.map((c) => c.id).filter((id) => derived.includes(id) && !stored.has(id));
}

/**
 * Stored conditions plus the ones derived from 0 HP, in PHB list order. The
 * Combat page and Concentration logic use this effective set (D2). It never
 * touches `character.conditions`.
 */
export function effectiveConditionIds(character: Character): ConditionId[] {
  const all = new Set<ConditionId>([...activeConditionIds(character), ...derivedConditionIds(character)]);
  return CONDITIONS.map((c) => c.id).filter((id) => all.has(id));
}

// â”€â”€â”€ Damage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Apply one instance of damage. Order: flat adjustment, Resistance (halve, round
 * down), Vulnerability (double), Immunity, then Temp HP, then HP, then the
 * Massive Damage / damage-at-0-HP rules. See the AMBIGUITIES in the file header
 * (D3, D4). A dead creature is unchanged.
 */
export function applyDamage(
  state: HpState,
  request: DamageRequest,
  options: DamageOptions = {},
): DamageResult {
  const absorbedCounts = options.absorbedCountsAsDamage ?? true;
  const rolled = wholeNonNegative(request.amount);
  const flat = wholeSigned(request.flat);

  // PHB "Order of Application": adjust, then Resistance, then Vulnerability.
  const adjusted = rolled + flat;
  const floored = Math.max(0, adjusted); // damage is never negative (Damage Rolls)
  const afterResistance = request.resistance === true ? Math.floor(floored / 2) : floored;
  const afterVulnerability = request.vulnerability === true ? afterResistance * 2 : afterResistance;
  const damageDealt = request.immune === true ? 0 : afterVulnerability;

  const components: BreakdownComponent[] = [
    { label: 'Damage rolled', value: rolled },
    { label: 'Flat adjustment', value: flat },
    { label: 'Cannot go below 0', value: floored - adjusted },
    { label: 'Resistance (halved, round down)', value: afterResistance - floored },
    { label: 'Vulnerability (doubled)', value: afterVulnerability - afterResistance },
    { label: 'Immunity (none taken)', value: damageDealt - afterVulnerability },
  ];

  if (state.dead) {
    return {
      damageDealt,
      tempAbsorbed: 0,
      hpLost: 0,
      remainder: 0,
      instantDeath: false,
      failuresAdded: 0,
      tookDamage: false,
      atZero: false,
      next: state,
      breakdown: {
        total: damageDealt,
        components,
        note: 'Already dead: the damage changes nothing.',
      },
    };
  }

  // Temporary Hit Points are lost first (L1183).
  const tempAbsorbed = Math.min(state.temp, damageDealt);
  const leftover = damageDealt - tempAbsorbed;
  const temp = state.temp - tempAbsorbed;

  let hp = state.hp;
  let hpLost = 0;
  let remainder = 0;
  let instantDeath = false;
  let failuresAdded = 0;
  let deathSaves = state.deathSaves;
  let stable = state.stable;
  let dead = false;

  const tookDamage = damageDealt > 0 && (absorbedCounts || leftover > 0);

  if (state.hp > 0) {
    hpLost = Math.min(state.hp, leftover);
    hp = state.hp - hpLost;
    if (hp === 0) {
      // Massive Damage (L1145): damage remains and equals or exceeds the maximum.
      remainder = leftover - hpLost;
      instantDeath = remainder > 0 && remainder >= state.max;
    }
  } else if (tookDamage) {
    // Damage at 0 Hit Points (L1171): a failure, two on a Critical Hit; death if
    // the damage equals or exceeds the Hit Point maximum. Taking damage ends Stable.
    stable = false;
    if (leftover > 0 && leftover >= state.max) {
      instantDeath = true;
    } else {
      failuresAdded = request.crit === true ? 2 : 1;
      deathSaves = {
        successes: state.deathSaves.successes,
        failures: Math.min(SAVES_TO_RESOLVE, state.deathSaves.failures + failuresAdded),
      };
      if (deathSaves.failures >= SAVES_TO_RESOLVE) dead = true;
    }
  }

  if (instantDeath) {
    // Convention: instant death records no death-save failure.
    dead = true;
    failuresAdded = 0;
    deathSaves = state.deathSaves;
    stable = false;
  }

  const atZero = hp === 0 && !dead;
  const parts = [`Temp HP absorbed ${tempAbsorbed}`, `HP lost ${hpLost}`];
  if (hp === 0 && state.hp > 0) parts.push(`remainder ${remainder} vs HP max ${state.max}`);
  if (state.hp === 0 && tookDamage) {
    parts.push(
      instantDeath
        ? `damage ${leftover} equals or exceeds HP max ${state.max}: dies`
        : `${failuresAdded} death-save failure${failuresAdded === 1 ? '' : 's'}`,
    );
  }
  if (instantDeath && state.hp > 0) parts.push('Massive Damage: dies');

  return {
    damageDealt,
    tempAbsorbed,
    hpLost,
    remainder,
    instantDeath,
    failuresAdded,
    tookDamage,
    atZero,
    next: { max: state.max, hp, temp, deathSaves, stable, dead },
    breakdown: { total: damageDealt, components, note: parts.join('; ') },
  };
}

/** Breakdowns for the derived numbers the Take Damage preview shows. */
export interface DamagePreviewBreakdowns {
  tempAbsorbed: Breakdown;
  hpLost: Breakdown;
  remainder: Breakdown;
  failuresAdded: Breakdown;
}

/**
 * Breakdowns narrating a DamageResult's derived numbers (each one's components
 * sum to its total; non-additive facts go in `note`). `before` is the state the
 * damage was applied to. Display only: no rule is decided here.
 */
export function damagePreviewBreakdowns(
  before: HpState,
  request: DamageRequest,
  result: DamageResult,
): DamagePreviewBreakdowns {
  const leftover = result.damageDealt - result.tempAbsorbed;
  const critExtra = request.crit === true && result.failuresAdded > 1 ? result.failuresAdded - 1 : 0;
  return {
    tempAbsorbed: {
      total: result.tempAbsorbed,
      components: [
        { label: 'Damage after modifiers', value: result.damageDealt },
        { label: 'Passes through to Hit Points', value: -leftover },
      ],
      note: `Temp HP before the hit: ${before.temp}. Temp HP are lost first and absorb at most what you have.`,
    },
    hpLost: {
      total: result.hpLost,
      components: [
        { label: 'Damage left after Temp HP', value: leftover },
        { label: 'Damage beyond 0 HP (not lost)', value: -(leftover - result.hpLost) },
      ],
      note: `Current HP before the hit: ${before.hp}. HP cannot drop below 0.`,
    },
    remainder: {
      total: result.remainder,
      components: [
        { label: 'Damage left after Temp HP', value: leftover },
        { label: 'HP lost', value: -result.hpLost },
      ],
      note: `Compared with the Hit Point maximum (${before.max}): a remainder that equals or exceeds it is Massive Damage and kills outright. Measured after Temp HP (decision D3).`,
    },
    failuresAdded: {
      total: result.failuresAdded,
      components: [
        { label: 'Failure from taking damage at 0 HP', value: result.failuresAdded - critExtra },
        { label: 'Extra failure from a Critical Hit', value: critExtra },
      ],
      note: result.instantDeath
        ? 'The damage kills outright, so no failure is recorded.'
        : 'Taking damage at 0 HP is one failure, or two on a Critical Hit.',
    },
  };
}

// â”€â”€â”€ Healing and Temporary Hit Points â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Apply healing: add to HP, capped at the maximum (excess lost). Regaining any
 * Hit Points resets the death-save counters and ends Stable. Temp HP are left
 * alone (healing cannot restore them, L1193). Healing 0 changes nothing. A
 * dead creature is unchanged (needs revival).
 */
export function applyHealing(state: HpState, amount: number): HealResult {
  if (state.dead) return { next: state, regained: 0 };
  const room = Math.max(0, state.max - state.hp);
  const regained = Math.min(wholeNonNegative(amount), room);
  if (regained === 0) return { next: state, regained: 0 };
  return {
    next: { ...state, hp: state.hp + regained, deathSaves: NO_SAVES, stable: false },
    regained,
  };
}

/**
 * Receive Temporary Hit Points. They never stack (L1191): the result is the
 * current or the offered amount, not the sum. `choice` is the user's pick;
 * omitted keeps the larger.
 */
export function grantTempHp(current: number, offered: number, choice?: TempHpChoice): number {
  const have = wholeNonNegative(current);
  const offer = wholeNonNegative(offered);
  if (choice === 'keep') return have;
  if (choice === 'replace') return offer;
  return Math.max(have, offer);
}

// â”€â”€â”€ Death Saving Throws â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Judge a Death Saving Throw from the raw d20 (1..20) and a roll modifier (0, or
 * -2 x Exhaustion level per decision D1). A natural 1 (two failures) and a
 * natural 20 (regain 1 HP) are judged on the RAW die, never on the total;
 * otherwise a total of 10 or higher succeeds (L1165, L1169).
 */
export function deathSaveOutcome(d20: number, modifier = 0): DeathSaveRoll {
  if (!Number.isInteger(d20) || d20 < 1 || d20 > 20) {
    throw new RangeError(`deathSaveOutcome(): d20 must be an integer 1..20, got ${d20}`);
  }
  const mod = wholeSigned(modifier);
  const total = d20 + mod;
  const breakdown: Breakdown = {
    total,
    components: [
      { label: 'd20 roll', value: d20 },
      { label: 'Modifier', value: mod },
    ],
  };
  if (d20 === 1) {
    return { outcome: 'critical-failure', successesAdded: 0, failuresAdded: 2, regainHp: false, natural: d20, total, breakdown };
  }
  if (d20 === 20) {
    return { outcome: 'regain-hp', successesAdded: 0, failuresAdded: 0, regainHp: true, natural: d20, total, breakdown };
  }
  if (total >= DEATH_SAVE_TARGET) {
    return { outcome: 'success', successesAdded: 1, failuresAdded: 0, regainHp: false, natural: d20, total, breakdown };
  }
  return { outcome: 'failure', successesAdded: 0, failuresAdded: 1, regainHp: false, natural: d20, total, breakdown };
}

/**
 * Fold a Death Saving Throw outcome into the counters. A third success makes the
 * creature Stable and resets both counters; a third failure is death (the third
 * failure is recorded); a natural 20 regains 1 HP and resets both (L1165-1169).
 */
export function deathSaveAdvance(
  saves: DeathSaveCounters,
  outcome: DeathSaveOutcomeKind,
): DeathSaveAdvance {
  if (outcome === 'regain-hp') return { saves: NO_SAVES, stable: false, dead: false, hp: 1 };
  const successes = Math.min(SAVES_TO_RESOLVE, saves.successes + (outcome === 'success' ? 1 : 0));
  const failures = Math.min(
    SAVES_TO_RESOLVE,
    saves.failures + (outcome === 'failure' ? 1 : outcome === 'critical-failure' ? 2 : 0),
  );
  if (failures >= SAVES_TO_RESOLVE) return { saves: { successes, failures }, stable: false, dead: true, hp: 0 };
  if (successes >= SAVES_TO_RESOLVE) return { saves: NO_SAVES, stable: true, dead: false, hp: 0 };
  return { saves: { successes, failures }, stable: false, dead: false, hp: 0 };
}

/** The roll modifier Exhaustion gives a Death Saving Throw (-2 x level, D1). */
export function deathSaveModifier(character: Character): number {
  return exhaustionEffects(exhaustionLevelOf(character)).d20Test.total;
}

// â”€â”€â”€ Character-level operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Apply damage to a character. Returns null when there is nothing to apply it
 * to: no Hit Point maximum is set, or the character is dead.
 */
export function applyDamageToCharacter(
  character: Character,
  request: DamageRequest,
  options?: DamageOptions,
): { character: Character; result: DamageResult } | null {
  const state = hpStateOf(character);
  if (!state || lifeStatus(character) === 'dead') return null;
  const result = applyDamage(state, request, options);
  return { character: writeHpState(character, result.next), result };
}

/** Apply healing to a character; null when no maximum is set or the character is dead. */
export function applyHealingToCharacter(
  character: Character,
  amount: number,
): { character: Character; result: HealResult } | null {
  const state = hpStateOf(character);
  if (!state || lifeStatus(character) === 'dead') return null;
  const result = applyHealing(state, amount);
  return { character: writeHpState(character, result.next), result };
}

/**
 * Receive Temporary Hit Points on a character (never stacks). Leaves current HP
 * alone: Temp HP do not restore consciousness (L1193). Null when no maximum is
 * set or the character is dead.
 */
export function grantTempHpToCharacter(
  character: Character,
  offered: number,
  choice?: TempHpChoice,
): Character | null {
  const state = hpStateOf(character);
  if (!state || lifeStatus(character) === 'dead') return null;
  return writeHpState(character, { ...state, temp: grantTempHp(state.temp, offered, choice) });
}

/**
 * Set current HP directly (a sheet correction). Clamped to 0..max. Raising a 0-HP
 * character above 0 counts as regaining HP (counters reset, Stable ends).
 * Null when no maximum is set or the character is dead.
 */
export function setCurrentHp(character: Character, value: number): Character | null {
  const state = hpStateOf(character);
  if (!state || lifeStatus(character) === 'dead') return null;
  const hp = Math.min(state.max, wholeNonNegative(value));
  const regained = hp > state.hp;
  return writeHpState(character, {
    ...state,
    hp,
    deathSaves: regained ? NO_SAVES : state.deathSaves,
    stable: regained ? false : state.stable,
  });
}

/**
 * Resolve a Death Saving Throw for a character from a raw d20. The modifier is
 * the Exhaustion penalty (D1), shown as its own Breakdown component. Returns
 * null unless the character is at 0 HP and making Death Saving Throws.
 */
export function resolveDeathSave(
  character: Character,
  d20: number,
): { character: Character; roll: DeathSaveRoll; advance: DeathSaveAdvance } | null {
  const state = hpStateOf(character);
  if (!state || lifeStatus(character) !== 'making-death-saves') return null;
  const exhaustion = exhaustionLevelOf(character);
  const roll = deathSaveOutcome(d20, deathSaveModifier(character));
  const advance = deathSaveAdvance(state.deathSaves, roll.outcome);
  const next: HpState = {
    ...state,
    hp: advance.hp,
    deathSaves: advance.saves,
    stable: advance.stable,
    dead: state.dead || advance.dead,
  };
  return {
    character: writeHpState(character, next),
    roll: { ...roll, breakdown: d20TestBreakdown(d20, exhaustion) },
    advance,
  };
}

/**
 * Stabilize a creature at 0 HP (the Help action with a successful DC 10 Wisdom
 * (Medicine) check, L1176). It stays at 0 HP, Unconscious, and stops making
 * Death Saving Throws; the counters reset. Null unless it is making Death Saves.
 */
export function stabilize(character: Character): Character | null {
  const state = hpStateOf(character);
  if (!state || lifeStatus(character) !== 'making-death-saves') return null;
  return writeHpState(character, { ...state, deathSaves: NO_SAVES, stable: true });
}

/**
 * Knock a creature out (L1159): instead of dropping to 0 from a melee attack it
 * is left at 1 HP with the Unconscious condition, which ends at the end of a
 * Short Rest. This is the one place the Unconscious condition is WRITTEN. Null
 * when no maximum is set or the character is dead.
 */
export function knockOut(character: Character): Character | null {
  const state = hpStateOf(character);
  if (!state || lifeStatus(character) === 'dead') return null;
  const hp = Math.min(1, state.max);
  const written = writeHpState(character, { ...state, hp, deathSaves: NO_SAVES, stable: false });
  return {
    ...written,
    conditions: applyCondition(written.conditions, 'unconscious', {
      note: 'Knocked out',
      ends: 'Short Rest',
    }),
  };
}
