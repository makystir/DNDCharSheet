/**
 * GOLDEN TABLE for Stage A5a: HP, damage, healing, temp HP, death saves, dice.
 *
 * AUTHORSHIP RULE: this file was written by the ORCHESTRATOR directly from the
 * PHB 2024 text (Docs/PlayersHandbook.md), BEFORE the logic was implemented.
 * The implementer's job is to make the real functions reproduce every row. The
 * implementer MUST NOT edit this file. If a row looks wrong, flag it in the
 * summary instead of changing it. (Lesson from A4: when one agent writes both
 * the logic and the expected answers, the oracle shares the agent's mistakes.)
 *
 * This file is DATA ONLY (no imports) so it compiles before the logic exists.
 * A test harness in the implementer's test file maps each row to the real API.
 *
 * Sources (section headings in the PHB 2024 rules text):
 *  - "Hit Points", "Damage Rolls", "Healing"
 *  - "Resistance and Vulnerability", "No Stacking", "Order of Application", "Immunity"
 *  - "Dropping to 0 Hit Points": "Instant Death" (Massive Damage), "Falling Unconscious",
 *    "Death Saving Throws", "Stabilizing a Character", "Knocking Out a Creature"
 *  - "Temporary Hit Points": "Lose Temporary Hit Points First", "Duration", "They Don't Stack",
 *    "They're Not Hit Points or Healing"
 *  - Exhaustion [Condition]: "D20 Tests Affected" (roll reduced by 2 x level),
 *    "You die if your Exhaustion level is 6"
 * Rows tagged `interpretation` are NOT stated verbatim by the PHB; they are the
 * orchestrator-approved reading (see the `interpretation` text) and the D3/D4
 * ones must stay switchable in code.
 *
 * CONVENTION: instant death (Massive Damage, or damage >= HP maximum at 0 HP)
 * records NO death-save failure; the creature simply dies, so the counters are
 * left as they were. Death by a third failure records that failure.
 */

export interface DeathSaves {
  successes: number;
  failures: number;
}

// ─── Damage pipeline ─────────────────────────────────────────────────────────
export interface DamageInput {
  /** Hit Point maximum. */
  max: number;
  /** Current Hit Points before the damage. */
  hp: number;
  /** Temporary Hit Points before the damage. */
  temp: number;
  /** Death-save counters before the damage (default 0/0). */
  deathSaves?: DeathSaves;
  /** Stable (0 HP, no death saves) before the damage (default false). */
  stable?: boolean;
  /** Damage rolled, BEFORE any modifier. */
  amount: number;
  /** Adjustment applied FIRST (negative = reduction, e.g. -5). Default 0. */
  flat?: number;
  /** Resistance to this damage type (halve, round down). */
  resistance?: boolean;
  /** Vulnerability to this damage type (double). */
  vulnerability?: boolean;
  /** Immunity to this damage type (take none). */
  immune?: boolean;
  /** Damage came from a Critical Hit (matters only at 0 HP). */
  crit?: boolean;
  /**
   * Orchestrator decision D4: damage fully absorbed by Temporary HP still counts
   * as "damage taken" (death-save failure at 0 HP, Concentration). Default TRUE.
   * Setting FALSE is the user-override toggle.
   */
  absorbedCountsAsDamage?: boolean;
}

export interface DamageExpect {
  /** Damage after flat adjustment, Resistance, Vulnerability, Immunity (never negative). */
  damageDealt: number;
  tempAbsorbed: number;
  hpLost: number;
  /** Resulting current HP. */
  hp: number;
  /** Resulting Temporary HP. */
  temp: number;
  /** Damage left over after HP reached 0 (0 if HP stayed above 0 or was already 0). */
  remainder: number;
  /** Died outright this hit (massive damage, or damage >= max while at 0 HP). */
  instantDeath: boolean;
  /** Resulting death-save counters. */
  deathSaves: DeathSaves;
  /** Resulting Stable flag. */
  stable: boolean;
  /** Resulting dead (instant death OR third failure). */
  dead: boolean;
  /** At 0 HP and not dead (so the derived Unconscious condition applies). */
  atZero: boolean;
  /** The creature "took damage" for Concentration purposes (see absorbedCountsAsDamage). */
  tookDamage: boolean;
}

export interface DamageCase {
  name: string;
  cite: string;
  interpretation?: string;
  input: DamageInput;
  expect: DamageExpect;
}

const NO_SAVES: DeathSaves = { successes: 0, failures: 0 };

export const DAMAGE_CASES: DamageCase[] = [
  // ── Order of application (adjust -> Resistance -> Vulnerability) ───────────
  {
    name: 'PHB worked example: 28 Fire, -5 aura, Resistance (all), Vulnerability (Fire) = 22',
    cite: 'Order of Application: 28 -> 23 -> halved to 11 -> doubled to 22',
    input: { max: 40, hp: 40, temp: 0, amount: 28, flat: -5, resistance: true, vulnerability: true },
    expect: { damageDealt: 22, tempAbsorbed: 0, hpLost: 22, hp: 18, temp: 0, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: false, tookDamage: true },
  },
  {
    name: 'Order matters: flat reduction BEFORE Resistance (5, -2, halved = 1, not 0)',
    cite: 'Order of Application (adjustments first, Resistance second)',
    input: { max: 30, hp: 30, temp: 0, amount: 5, flat: -2, resistance: true },
    expect: { damageDealt: 1, tempAbsorbed: 0, hpLost: 1, hp: 29, temp: 0, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: false, tookDamage: true },
  },
  {
    name: 'Flat bonus applies before Resistance (10 + 2 = 12, halved = 6)',
    cite: 'Order of Application',
    input: { max: 30, hp: 30, temp: 0, amount: 10, flat: 2, resistance: true },
    expect: { damageDealt: 6, tempAbsorbed: 0, hpLost: 6, hp: 24, temp: 0, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: false, tookDamage: true },
  },
  {
    name: 'Resistance rounds DOWN (7 -> 3)',
    cite: 'Resistance and Vulnerability: halved (round down)',
    input: { max: 30, hp: 30, temp: 0, amount: 7, resistance: true },
    expect: { damageDealt: 3, tempAbsorbed: 0, hpLost: 3, hp: 27, temp: 0, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: false, tookDamage: true },
  },
  {
    name: 'Vulnerability doubles (7 -> 14)',
    cite: 'Resistance and Vulnerability: doubled',
    input: { max: 30, hp: 30, temp: 0, amount: 7, vulnerability: true },
    expect: { damageDealt: 14, tempAbsorbed: 0, hpLost: 14, hp: 16, temp: 0, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: false, tookDamage: true },
  },
  {
    name: 'Immunity: no damage taken',
    cite: 'Immunity: you don\'t take damage of that type',
    input: { max: 30, hp: 30, temp: 5, amount: 30, immune: true },
    expect: { damageDealt: 0, tempAbsorbed: 0, hpLost: 0, hp: 30, temp: 5, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: false, tookDamage: false },
  },
  {
    name: 'A penalty can reduce damage to 0 but never below 0',
    cite: 'Damage Rolls: possible to deal 0 damage but not negative damage',
    input: { max: 30, hp: 30, temp: 0, amount: 3, flat: -5 },
    expect: { damageDealt: 0, tempAbsorbed: 0, hpLost: 0, hp: 30, temp: 0, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: false, tookDamage: false },
  },

  // ── Temporary Hit Points absorb first ──────────────────────────────────────
  {
    name: 'PHB example: 5 Temp HP, 7 damage -> lose the 5, then 2 HP',
    cite: 'Lose Temporary Hit Points First',
    input: { max: 20, hp: 20, temp: 5, amount: 7 },
    expect: { damageDealt: 7, tempAbsorbed: 5, hpLost: 2, hp: 18, temp: 0, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: false, tookDamage: true },
  },
  {
    name: 'Damage smaller than Temp HP leaves HP untouched',
    cite: 'Lose Temporary Hit Points First',
    input: { max: 20, hp: 20, temp: 10, amount: 4 },
    expect: { damageDealt: 4, tempAbsorbed: 4, hpLost: 0, hp: 20, temp: 6, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: false, tookDamage: true },
  },
  {
    name: 'Damage equal to Temp HP empties it and leaves HP untouched',
    cite: 'Lose Temporary Hit Points First',
    input: { max: 20, hp: 20, temp: 5, amount: 5 },
    expect: { damageDealt: 5, tempAbsorbed: 5, hpLost: 0, hp: 20, temp: 0, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: false, tookDamage: true },
  },
  {
    name: 'D4 default: damage fully absorbed by Temp HP still counts as damage taken',
    cite: 'Temporary Hit Points are a buffer against losing actual Hit Points',
    interpretation: 'D4',
    input: { max: 20, hp: 20, temp: 5, amount: 3 },
    expect: { damageDealt: 3, tempAbsorbed: 3, hpLost: 0, hp: 20, temp: 2, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: false, tookDamage: true },
  },
  {
    name: 'D4 override toggle OFF: fully absorbed damage does not count as damage taken',
    cite: 'Temporary Hit Points are a buffer against losing actual Hit Points',
    interpretation: 'D4',
    input: { max: 20, hp: 20, temp: 5, amount: 3, absorbedCountsAsDamage: false },
    expect: { damageDealt: 3, tempAbsorbed: 3, hpLost: 0, hp: 20, temp: 2, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: false, tookDamage: false },
  },

  // ── Dropping to 0 HP and Massive Damage ────────────────────────────────────
  {
    name: 'PHB Massive Damage example: max 12, 6 HP, 18 damage -> remainder 12 -> dies',
    cite: 'Instant Death: Massive Damage',
    input: { max: 12, hp: 6, temp: 0, amount: 18 },
    expect: { damageDealt: 18, tempAbsorbed: 0, hpLost: 6, hp: 0, temp: 0, remainder: 12, instantDeath: true, deathSaves: NO_SAVES, stable: false, dead: true, atZero: false, tookDamage: true },
  },
  {
    name: 'One short of Massive Damage: remainder 11 < max 12 -> survives at 0 HP',
    cite: 'Instant Death: Massive Damage (equals or exceeds)',
    input: { max: 12, hp: 6, temp: 0, amount: 17 },
    expect: { damageDealt: 17, tempAbsorbed: 0, hpLost: 6, hp: 0, temp: 0, remainder: 11, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: true, tookDamage: true },
  },
  {
    name: 'Exactly to 0 (no remainder) -> unconscious, making death saves, no failure yet',
    cite: 'Falling Unconscious',
    input: { max: 12, hp: 6, temp: 0, amount: 6 },
    expect: { damageDealt: 6, tempAbsorbed: 0, hpLost: 6, hp: 0, temp: 0, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: true, tookDamage: true },
  },
  {
    name: 'D3: Temp HP absorb first, THEN the leftover is the Massive Damage remainder (6 HP, 4 temp, 22 dmg -> remainder 12 -> dies)',
    cite: 'Lose Temporary Hit Points First + Massive Damage',
    interpretation: 'D3',
    input: { max: 12, hp: 6, temp: 4, amount: 22 },
    expect: { damageDealt: 22, tempAbsorbed: 4, hpLost: 6, hp: 0, temp: 0, remainder: 12, instantDeath: true, deathSaves: NO_SAVES, stable: false, dead: true, atZero: false, tookDamage: true },
  },
  {
    name: 'D3: same setup, 2 less damage -> remainder 10 < max 12 -> survives',
    cite: 'Lose Temporary Hit Points First + Massive Damage',
    interpretation: 'D3',
    input: { max: 12, hp: 6, temp: 4, amount: 20 },
    expect: { damageDealt: 20, tempAbsorbed: 4, hpLost: 6, hp: 0, temp: 0, remainder: 10, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: true, tookDamage: true },
  },

  // ── Damage while at 0 HP ───────────────────────────────────────────────────
  {
    name: 'Damage at 0 HP = one death-save failure',
    cite: 'Death Saving Throws: Damage at 0 Hit Points',
    input: { max: 12, hp: 0, temp: 0, amount: 3 },
    expect: { damageDealt: 3, tempAbsorbed: 0, hpLost: 0, hp: 0, temp: 0, remainder: 0, instantDeath: false, deathSaves: { successes: 0, failures: 1 }, stable: false, dead: false, atZero: true, tookDamage: true },
  },
  {
    name: 'Critical Hit damage at 0 HP = two failures',
    cite: 'Death Saving Throws: Damage at 0 Hit Points',
    input: { max: 12, hp: 0, temp: 0, amount: 3, crit: true },
    expect: { damageDealt: 3, tempAbsorbed: 0, hpLost: 0, hp: 0, temp: 0, remainder: 0, instantDeath: false, deathSaves: { successes: 0, failures: 2 }, stable: false, dead: false, atZero: true, tookDamage: true },
  },
  {
    name: 'Damage at 0 HP that equals the HP maximum kills',
    cite: 'Death Saving Throws: Damage at 0 Hit Points',
    input: { max: 12, hp: 0, temp: 0, amount: 12 },
    expect: { damageDealt: 12, tempAbsorbed: 0, hpLost: 0, hp: 0, temp: 0, remainder: 0, instantDeath: true, deathSaves: NO_SAVES, stable: false, dead: true, atZero: false, tookDamage: true },
  },
  {
    name: 'Crit at 0 HP one point under the maximum is two failures, not death',
    cite: 'Death Saving Throws: Damage at 0 Hit Points',
    input: { max: 12, hp: 0, temp: 0, amount: 11, crit: true },
    expect: { damageDealt: 11, tempAbsorbed: 0, hpLost: 0, hp: 0, temp: 0, remainder: 0, instantDeath: false, deathSaves: { successes: 0, failures: 2 }, stable: false, dead: false, atZero: true, tookDamage: true },
  },
  {
    name: 'Third failure from damage at 0 HP means death',
    cite: 'Death Saving Throws: Three Successes/Failures',
    input: { max: 12, hp: 0, temp: 0, amount: 3, deathSaves: { successes: 1, failures: 2 } },
    expect: { damageDealt: 3, tempAbsorbed: 0, hpLost: 0, hp: 0, temp: 0, remainder: 0, instantDeath: false, deathSaves: { successes: 1, failures: 3 }, stable: false, dead: true, atZero: false, tookDamage: true },
  },
  {
    name: 'Immunity at 0 HP: no failure',
    cite: 'Immunity + Damage at 0 Hit Points',
    input: { max: 12, hp: 0, temp: 0, amount: 9, immune: true },
    expect: { damageDealt: 0, tempAbsorbed: 0, hpLost: 0, hp: 0, temp: 0, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: true, tookDamage: false },
  },
  {
    name: 'D4 default at 0 HP with Temp HP: damage absorbed by Temp HP is still a failure',
    cite: 'Damage at 0 Hit Points + Temporary Hit Points are a buffer',
    interpretation: 'D4',
    input: { max: 12, hp: 0, temp: 5, amount: 3 },
    expect: { damageDealt: 3, tempAbsorbed: 3, hpLost: 0, hp: 0, temp: 2, remainder: 0, instantDeath: false, deathSaves: { successes: 0, failures: 1 }, stable: false, dead: false, atZero: true, tookDamage: true },
  },
  {
    name: 'D4 override toggle OFF at 0 HP with Temp HP: fully absorbed damage is no failure',
    cite: 'Damage at 0 Hit Points + Temporary Hit Points are a buffer',
    interpretation: 'D4',
    input: { max: 12, hp: 0, temp: 5, amount: 3, absorbedCountsAsDamage: false },
    expect: { damageDealt: 3, tempAbsorbed: 3, hpLost: 0, hp: 0, temp: 2, remainder: 0, instantDeath: false, deathSaves: NO_SAVES, stable: false, dead: false, atZero: true, tookDamage: false },
  },
  {
    name: 'Damage to a Stable creature ends Stable and starts death saves',
    cite: 'Stabilizing a Character: if the creature takes damage, it stops being Stable',
    interpretation: 'Stable+damage: the PHB also counts damage at 0 HP as a failure, so both apply',
    input: { max: 12, hp: 0, temp: 0, amount: 3, stable: true },
    expect: { damageDealt: 3, tempAbsorbed: 0, hpLost: 0, hp: 0, temp: 0, remainder: 0, instantDeath: false, deathSaves: { successes: 0, failures: 1 }, stable: false, dead: false, atZero: true, tookDamage: true },
  },
];

// ─── Healing ─────────────────────────────────────────────────────────────────
export interface HealInput {
  max: number;
  hp: number;
  temp: number;
  deathSaves?: DeathSaves;
  stable?: boolean;
  amount: number;
}
export interface HealExpect {
  hp: number;
  temp: number;
  deathSaves: DeathSaves;
  stable: boolean;
  /** Still at 0 HP and not dead. */
  atZero: boolean;
  /** Hit Points actually regained (excess over the maximum is lost). */
  regained: number;
}
export interface HealCase {
  name: string;
  cite: string;
  input: HealInput;
  expect: HealExpect;
}

export const HEAL_CASES: HealCase[] = [
  {
    name: 'PHB example: 8 healing at 14/20 regains 6, not 8',
    cite: 'Healing',
    input: { max: 20, hp: 14, temp: 0, amount: 8 },
    expect: { hp: 20, temp: 0, deathSaves: NO_SAVES, stable: false, atZero: false, regained: 6 },
  },
  {
    name: 'Healing from 0 HP wakes the creature and resets both death-save counters',
    cite: 'Falling Unconscious + Death Saving Throws (reset when you regain any Hit Points)',
    input: { max: 12, hp: 0, temp: 0, amount: 3, deathSaves: { successes: 1, failures: 2 } },
    expect: { hp: 3, temp: 0, deathSaves: NO_SAVES, stable: false, atZero: false, regained: 3 },
  },
  {
    name: 'Healing leaves Temporary Hit Points alone (healing cannot restore them)',
    cite: 'Temporary Hit Points: They\'re Not Hit Points or Healing',
    input: { max: 20, hp: 5, temp: 4, amount: 3 },
    expect: { hp: 8, temp: 4, deathSaves: NO_SAVES, stable: false, atZero: false, regained: 3 },
  },
  {
    name: 'Healing a Stable creature at 0 HP ends Stable (it is conscious again)',
    cite: 'Stabilizing a Character + Falling Unconscious',
    input: { max: 12, hp: 0, temp: 0, amount: 1, stable: true },
    expect: { hp: 1, temp: 0, deathSaves: NO_SAVES, stable: false, atZero: false, regained: 1 },
  },
  {
    name: 'Healing 0 changes nothing, and does not wake a 0-HP creature',
    cite: 'Healing',
    input: { max: 12, hp: 0, temp: 0, amount: 0, deathSaves: { successes: 1, failures: 1 } },
    expect: { hp: 0, temp: 0, deathSaves: { successes: 1, failures: 1 }, stable: false, atZero: true, regained: 0 },
  },
];

// ─── Granting Temporary Hit Points ───────────────────────────────────────────
export interface TempGrantCase {
  name: string;
  cite: string;
  hp: number;
  current: number;
  offered: number;
  /** The user's keep-or-replace choice; omitted = default (keep the larger). */
  choice?: 'keep' | 'replace';
  expectTemp: number;
  expectHp: number;
}

export const TEMP_GRANT_CASES: TempGrantCase[] = [
  { name: 'PHB: have 10, offered 12, user takes the new -> 12 (never 22)', cite: 'They Don\'t Stack', hp: 20, current: 10, offered: 12, choice: 'replace', expectTemp: 12, expectHp: 20 },
  { name: 'PHB: have 10, offered 12, user keeps the old -> 10', cite: 'They Don\'t Stack', hp: 20, current: 10, offered: 12, choice: 'keep', expectTemp: 10, expectHp: 20 },
  { name: 'Default (no choice) keeps the larger: 10 vs 12 -> 12', cite: 'They Don\'t Stack', hp: 20, current: 10, offered: 12, expectTemp: 12, expectHp: 20 },
  { name: 'Default keeps the larger: 12 vs 10 -> 12', cite: 'They Don\'t Stack', hp: 20, current: 12, offered: 10, expectTemp: 12, expectHp: 20 },
  { name: 'No existing Temp HP: just take the offer', cite: 'Temporary Hit Points', hp: 20, current: 0, offered: 8, expectTemp: 8, expectHp: 20 },
  { name: 'Temp HP at 0 HP do not restore consciousness (HP stays 0)', cite: 'They\'re Not Hit Points or Healing', hp: 0, current: 0, offered: 5, expectTemp: 5, expectHp: 0 },
];

// ─── Death Saving Throws ─────────────────────────────────────────────────────
export type DeathSaveOutcome = 'success' | 'failure' | 'critical-failure' | 'regain-hp';

export interface DeathSaveCase {
  name: string;
  cite: string;
  /** The raw d20 face. Natural 1 / natural 20 are judged on THIS, never on the total. */
  d20: number;
  /** Roll modifier (0, or -2 x Exhaustion level per decision D1). */
  modifier: number;
  before: DeathSaves;
  expect: {
    outcome: DeathSaveOutcome;
    after: DeathSaves;
    stable: boolean;
    dead: boolean;
    /** Hit Points after the throw (1 only on a natural 20; otherwise 0). */
    hp: number;
  };
}

export const DEATH_SAVE_CASES: DeathSaveCase[] = [
  { name: '10 succeeds (10 or higher)', cite: 'Death Saving Throws: Three Successes/Failures', d20: 10, modifier: 0, before: NO_SAVES, expect: { outcome: 'success', after: { successes: 1, failures: 0 }, stable: false, dead: false, hp: 0 } },
  { name: '9 fails', cite: 'Death Saving Throws: Three Successes/Failures', d20: 9, modifier: 0, before: NO_SAVES, expect: { outcome: 'failure', after: { successes: 0, failures: 1 }, stable: false, dead: false, hp: 0 } },
  { name: 'A 2 is one failure, not two (only a natural 1 is two)', cite: 'Rolling a 1 or 20', d20: 2, modifier: 0, before: NO_SAVES, expect: { outcome: 'failure', after: { successes: 0, failures: 1 }, stable: false, dead: false, hp: 0 } },
  { name: 'Natural 1 = two failures', cite: 'Rolling a 1 or 20', d20: 1, modifier: 0, before: NO_SAVES, expect: { outcome: 'critical-failure', after: { successes: 0, failures: 2 }, stable: false, dead: false, hp: 0 } },
  { name: 'Natural 1 with one failure already = three = death', cite: 'Rolling a 1 or 20 + Three Failures', d20: 1, modifier: 0, before: { successes: 0, failures: 1 }, expect: { outcome: 'critical-failure', after: { successes: 0, failures: 3 }, stable: false, dead: true, hp: 0 } },
  { name: 'Natural 20 regains 1 HP and resets both counters', cite: 'Rolling a 1 or 20', d20: 20, modifier: 0, before: { successes: 2, failures: 2 }, expect: { outcome: 'regain-hp', after: NO_SAVES, stable: false, dead: false, hp: 1 } },
  { name: 'Third success makes the creature Stable and resets counters', cite: 'Three Successes/Failures: counters reset when you become Stable', d20: 15, modifier: 0, before: { successes: 2, failures: 1 }, expect: { outcome: 'success', after: NO_SAVES, stable: true, dead: false, hp: 0 } },
  { name: 'Third failure means death', cite: 'Three Successes/Failures', d20: 5, modifier: 0, before: { successes: 1, failures: 2 }, expect: { outcome: 'failure', after: { successes: 1, failures: 3 }, stable: false, dead: true, hp: 0 } },
  // Exhaustion (decision D1): the ROLL is reduced by 2 x level; nat 1 / nat 20 are judged on the raw die.
  { name: 'Exhaustion 1 (-2): 12 becomes 10 and still succeeds', cite: 'Exhaustion: D20 Tests Affected', d20: 12, modifier: -2, before: NO_SAVES, expect: { outcome: 'success', after: { successes: 1, failures: 0 }, stable: false, dead: false, hp: 0 } },
  { name: 'Exhaustion 1 (-2): 11 becomes 9 and fails', cite: 'Exhaustion: D20 Tests Affected', d20: 11, modifier: -2, before: NO_SAVES, expect: { outcome: 'failure', after: { successes: 0, failures: 1 }, stable: false, dead: false, hp: 0 } },
  { name: 'Exhaustion 2 (-4): a 13 becomes 9 and fails', cite: 'Exhaustion: D20 Tests Affected', d20: 13, modifier: -4, before: NO_SAVES, expect: { outcome: 'failure', after: { successes: 0, failures: 1 }, stable: false, dead: false, hp: 0 } },
  { name: 'Exhaustion 5 (-10): a natural 20 still regains 1 HP (judged on the raw die)', cite: 'Rolling a 1 or 20 (roll a 20 on the d20) + Exhaustion', d20: 20, modifier: -10, before: { successes: 0, failures: 2 }, expect: { outcome: 'regain-hp', after: NO_SAVES, stable: false, dead: false, hp: 1 } },
  { name: 'Exhaustion 5 (-10): a natural 1 is still two failures (not "worse")', cite: 'Rolling a 1 or 20 + Exhaustion', d20: 1, modifier: -10, before: NO_SAVES, expect: { outcome: 'critical-failure', after: { successes: 0, failures: 2 }, stable: false, dead: false, hp: 0 } },
  { name: 'Exhaustion 3 (-6): a 16 becomes exactly 10 and succeeds', cite: 'Exhaustion: D20 Tests Affected', d20: 16, modifier: -6, before: NO_SAVES, expect: { outcome: 'success', after: { successes: 1, failures: 0 }, stable: false, dead: false, hp: 0 } },
];

// ─── Life status / Bloodied ──────────────────────────────────────────────────
export type LifeStatus = 'healthy' | 'bloodied' | 'making-death-saves' | 'stable' | 'dead';

export interface LifeStatusCase {
  name: string;
  cite: string;
  input: { max: number; hp: number; stable?: boolean; deadFlag?: boolean; exhaustion?: number };
  expect: LifeStatus;
}

export const LIFE_STATUS_CASES: LifeStatusCase[] = [
  { name: 'Full HP is healthy', cite: 'Hit Points', input: { max: 10, hp: 10 }, expect: 'healthy' },
  { name: 'Exactly half is Bloodied ("half your Hit Points or fewer")', cite: 'Hit Points: Bloodied', input: { max: 10, hp: 5 }, expect: 'bloodied' },
  { name: 'One above half is not Bloodied', cite: 'Hit Points: Bloodied', input: { max: 10, hp: 6 }, expect: 'healthy' },
  { name: 'Odd maximum: 5 of 11 is Bloodied (5 <= 5.5)', cite: 'Hit Points: Bloodied', input: { max: 11, hp: 5 }, expect: 'bloodied' },
  { name: 'Odd maximum: 6 of 11 is not Bloodied', cite: 'Hit Points: Bloodied', input: { max: 11, hp: 6 }, expect: 'healthy' },
  { name: '0 HP and not Stable is making death saves', cite: 'Death Saving Throws', input: { max: 10, hp: 0 }, expect: 'making-death-saves' },
  { name: '0 HP and Stable', cite: 'Stabilizing a Character', input: { max: 10, hp: 0, stable: true }, expect: 'stable' },
  { name: 'Explicit dead flag wins', cite: 'Character Demise', input: { max: 10, hp: 0, deadFlag: true }, expect: 'dead' },
  { name: 'Exhaustion level 6 is death even at full HP', cite: 'Exhaustion: You die if your Exhaustion level is 6', input: { max: 10, hp: 10, exhaustion: 6 }, expect: 'dead' },
  { name: 'Exhaustion level 5 is not death', cite: 'Exhaustion: You die if your Exhaustion level is 6', input: { max: 10, hp: 10, exhaustion: 5 }, expect: 'healthy' },
  { name: 'Hit Point maximum of 0 is death', cite: 'Instant Death: Hit Point Maximum of 0', input: { max: 0, hp: 0 }, expect: 'dead' },
];

// ─── Dice seam ───────────────────────────────────────────────────────────────
/**
 * The injected RNG returns a float in [0, 1). A d(n) face is floor(r * n) + 1.
 * `rolls` are the faces in the order drawn.
 */
export interface D20Case {
  name: string;
  mode: 'normal' | 'advantage' | 'disadvantage';
  rng: number[];
  expect: { rolls: number[]; used: number; natural: number };
}

export const D20_CASES: D20Case[] = [
  { name: 'Normal draws one die (0.0 -> 1)', mode: 'normal', rng: [0.0], expect: { rolls: [1], used: 1, natural: 1 } },
  { name: 'Normal draws one die (0.999 -> 20)', mode: 'normal', rng: [0.999], expect: { rolls: [20], used: 20, natural: 20 } },
  { name: 'Normal middle value (0.5 -> 11)', mode: 'normal', rng: [0.5], expect: { rolls: [11], used: 11, natural: 11 } },
  { name: 'Advantage keeps the higher of two', mode: 'advantage', rng: [0.0, 0.95], expect: { rolls: [1, 20], used: 20, natural: 20 } },
  { name: 'Disadvantage keeps the lower of two', mode: 'disadvantage', rng: [0.0, 0.95], expect: { rolls: [1, 20], used: 1, natural: 1 } },
  { name: 'Advantage with equal dice', mode: 'advantage', rng: [0.5, 0.5], expect: { rolls: [11, 11], used: 11, natural: 11 } },
  { name: 'Advantage keeps the higher regardless of order', mode: 'advantage', rng: [0.95, 0.0], expect: { rolls: [20, 1], used: 20, natural: 20 } },
];

export interface DiceCase {
  name: string;
  expr: string;
  rng: number[];
  expect: { rolls: number[]; total: number };
}

export const DICE_CASES: DiceCase[] = [
  { name: '2d6 low and high faces', expr: '2d6', rng: [0.0, 0.999], expect: { rolls: [1, 6], total: 7 } },
  { name: '1d8 middle', expr: '1d8', rng: [0.5], expect: { rolls: [5], total: 5 } },
  { name: 'A flat "1" (Blowgun-style fixed damage) rolls no dice', expr: '1', rng: [], expect: { rolls: [], total: 1 } },
  { name: '3d4 consumes exactly three draws', expr: '3d4', rng: [0.0, 0.25, 0.999], expect: { rolls: [1, 2, 4], total: 7 } },
  { name: '1d10 top face', expr: '1d10', rng: [0.999], expect: { rolls: [10], total: 10 } },
];
