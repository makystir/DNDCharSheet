/**
 * GOLDEN TABLE for Stage A5b: Concentration and Rests.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md) BEFORE the logic is implemented. The implementer
 * must make the real functions reproduce every row and MUST NOT edit this file.
 * If a row looks wrong, flag it in the summary instead of changing it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. A harness in
 * the implementer's tests maps each row to the real API.
 *
 * Sources (PHB 2024 section headings / approximate lines):
 *  - Concentration (rules glossary ~L20766): the DC is the higher of 10 or half
 *    the damage taken (round down), to a maximum DC of 30; Concentration ends if
 *    you have the Incapacitated condition or die; starting another Concentration
 *    effect ends the previous one.
 *  - D20 Tests (~L364): "If the total of the d20 and its modifiers equals or
 *    exceeds the target number, the D20 Test succeeds."
 *  - Rolling 20 or 1 (~L466): the natural 20 / natural 1 rules are for ATTACK ROLLS
 *    only, so a Constitution save has no automatic success or failure.
 *  - Exhaustion [Condition]: the roll is reduced by 2 x Exhaustion level (decision D1).
 *  - Short Rest (glossary ~L21475): 1 hour; must have at least 1 HP to start; spend
 *    Hit Dice (each: roll the die + Con modifier, minimum 1 HP); interrupted by
 *    rolling Initiative, casting a non-cantrip spell, or taking any damage; an
 *    interrupted Short Rest confers no benefits.
 *  - Long Rest (glossary ~L21240): at least 8 hours; wait at least 16 hours before
 *    another; must have at least 1 HP to start; regain ALL HP and ALL spent Hit
 *    Dice; Exhaustion decreases by 1; interrupted by rolling Initiative, casting a
 *    non-cantrip spell, any damage, or 1 hour of walking/exertion; if you rested at
 *    least 1 hour before the interruption you gain Short Rest benefits; resuming
 *    costs 1 extra hour per interruption.
 *  - Temporary Hit Points last until depleted or a Long Rest is finished.
 *  - Spell slots: casters regain all expended slots on a Long Rest (Bard, Cleric,
 *    Druid, Paladin, Ranger, Sorcerer, Wizard, Eldritch Knight, Arcane Trickster).
 *  - Pact Magic: "You regain all expended Pact Magic spell slots when you finish a
 *    Short or Long Rest" (Warlock Spell Slots, ~L6854).
 *  - Mystic Arcanum: regained on a Long Rest (~L6892).
 *  OUT OF SCOPE (class features, stage A8): Magical Cunning, Arcane Recovery, Rage,
 *  Channel Divinity, Bardic Inspiration, and every other per-class recharge.
 *
 * Rows tagged `interpretation` are the orchestrator-approved reading where the
 * PHB does not state the point verbatim.
 */

// ─── Concentration: save DC ──────────────────────────────────────────────────
export interface ConcentrationDcCase {
  /** Damage taken (after Resistance etc.; see decision D4 for temp-HP-absorbed damage). */
  damage: number;
  /** A save is required only if damage was taken (> 0). */
  required: boolean;
  /** DC = max(10, floor(damage / 2)), capped at 30. Undefined when not required. */
  dc?: number;
}

export const CONCENTRATION_DC_CASES: ConcentrationDcCase[] = [
  { damage: 0, required: false },
  { damage: 1, required: true, dc: 10 },
  { damage: 2, required: true, dc: 10 },
  { damage: 19, required: true, dc: 10 },
  { damage: 20, required: true, dc: 10 },
  { damage: 21, required: true, dc: 10 }, // half of 21 rounds DOWN to 10
  { damage: 22, required: true, dc: 11 },
  { damage: 23, required: true, dc: 11 }, // 11.5 rounds down
  { damage: 40, required: true, dc: 20 },
  { damage: 59, required: true, dc: 29 }, // 29.5 rounds down
  { damage: 60, required: true, dc: 30 },
  { damage: 61, required: true, dc: 30 },
  { damage: 62, required: true, dc: 30 }, // 31 capped at the maximum DC of 30
  { damage: 100, required: true, dc: 30 },
];

// ─── Concentration: the save roll ────────────────────────────────────────────
export interface ConcentrationSaveCase {
  name: string;
  cite: string;
  /** Raw d20 face. */
  d20: number;
  /** Constitution saving throw modifier (ability mod + proficiency if proficient). */
  saveMod: number;
  /** Exhaustion level; the roll is reduced by 2 x level (decision D1). */
  exhaustion: number;
  dc: number;
  expect: { total: number; success: boolean };
}

export const CONCENTRATION_SAVE_CASES: ConcentrationSaveCase[] = [
  { name: 'Total above the DC succeeds', cite: 'D20 Tests step 3', d20: 10, saveMod: 3, exhaustion: 0, dc: 10, expect: { total: 13, success: true } },
  { name: 'Total EQUAL to the DC succeeds', cite: 'D20 Tests step 3 (equals or exceeds)', d20: 7, saveMod: 3, exhaustion: 0, dc: 10, expect: { total: 10, success: true } },
  { name: 'One below the DC fails', cite: 'D20 Tests step 3', d20: 6, saveMod: 3, exhaustion: 0, dc: 10, expect: { total: 9, success: false } },
  { name: 'Exhaustion 2 (-4) can turn a success into a failure', cite: 'Exhaustion: D20 Tests Affected', d20: 12, saveMod: 3, exhaustion: 2, dc: 12, expect: { total: 11, success: false } },
  { name: 'Exhaustion 2 (-4): total equal to DC still succeeds', cite: 'Exhaustion + D20 Tests step 3', d20: 12, saveMod: 3, exhaustion: 2, dc: 11, expect: { total: 11, success: true } },
  { name: 'A natural 20 is NOT an automatic success on a save (that rule is for attack rolls)', cite: 'Rolling 20 or 1 (attack rolls only)', d20: 20, saveMod: -5, exhaustion: 0, dc: 20, expect: { total: 15, success: false } },
  { name: 'A natural 1 is NOT an automatic failure on a save', cite: 'Rolling 20 or 1 (attack rolls only)', d20: 1, saveMod: 10, exhaustion: 0, dc: 5, expect: { total: 11, success: true } },
  { name: 'Natural 20 with Exhaustion 5 (-10): total 10 vs DC 10 succeeds', cite: 'Exhaustion + D20 Tests step 3', d20: 20, saveMod: 0, exhaustion: 5, dc: 10, expect: { total: 10, success: true } },
];

// ─── Concentration: does it end? ─────────────────────────────────────────────
export type ConcentrationEndReason = 'incapacitated' | 'dead';

export interface ConcentrationEndCase {
  name: string;
  cite: string;
  interpretation?: string;
  input: {
    concentrating: boolean;
    /** Stored condition ids (character.conditions). Implied conditions are NOT pre-expanded. */
    storedConditions: string[];
    max: number;
    hp: number;
    dead?: boolean;
    exhaustion?: number;
  };
  /** null = Concentration is not ended by the character's state. */
  expect: ConcentrationEndReason | null;
}

export const CONCENTRATION_END_CASES: ConcentrationEndCase[] = [
  { name: 'Healthy and conscious: continues', cite: 'Concentration', input: { concentrating: true, storedConditions: [], max: 20, hp: 20 }, expect: null },
  { name: 'Not concentrating: nothing to end', cite: 'Concentration', input: { concentrating: false, storedConditions: ['incapacitated'], max: 20, hp: 20 }, expect: null },
  { name: 'Stored Incapacitated ends it', cite: 'Concentration: Incapacitated or Dead', input: { concentrating: true, storedConditions: ['incapacitated'], max: 20, hp: 20 }, expect: 'incapacitated' },
  { name: 'Stored Paralyzed implies Incapacitated and ends it', cite: 'Paralyzed [Condition] + Concentration', input: { concentrating: true, storedConditions: ['paralyzed'], max: 20, hp: 20 }, expect: 'incapacitated' },
  { name: 'Stored Stunned implies Incapacitated and ends it', cite: 'Stunned [Condition] + Concentration', input: { concentrating: true, storedConditions: ['stunned'], max: 20, hp: 20 }, expect: 'incapacitated' },
  { name: 'Stored Petrified implies Incapacitated and ends it', cite: 'Petrified [Condition] + Concentration', input: { concentrating: true, storedConditions: ['petrified'], max: 20, hp: 20 }, expect: 'incapacitated' },
  { name: 'Knocked out (stored Unconscious at 1 HP) implies Incapacitated and ends it', cite: 'Unconscious [Condition] + Knocking Out a Creature', input: { concentrating: true, storedConditions: ['unconscious'], max: 20, hp: 1 }, expect: 'incapacitated' },
  { name: 'At 0 HP the derived Unconscious condition (decision D2) ends it', cite: 'Falling Unconscious + Concentration', input: { concentrating: true, storedConditions: [], max: 20, hp: 0 }, expect: 'incapacitated' },
  { name: 'Prone does not end it', cite: 'Prone [Condition] (no Incapacitated)', input: { concentrating: true, storedConditions: ['prone'], max: 20, hp: 20 }, expect: null },
  { name: 'Poisoned does not end it', cite: 'Poisoned [Condition]', input: { concentrating: true, storedConditions: ['poisoned'], max: 20, hp: 20 }, expect: null },
  { name: 'Frightened does not end it', cite: 'Frightened [Condition]', input: { concentrating: true, storedConditions: ['frightened'], max: 20, hp: 20 }, expect: null },
  { name: 'Restrained does not end it', cite: 'Restrained [Condition]', input: { concentrating: true, storedConditions: ['restrained'], max: 20, hp: 20 }, expect: null },
  { name: 'Grappled does not end it', cite: 'Grappled [Condition]', input: { concentrating: true, storedConditions: ['grappled'], max: 20, hp: 20 }, expect: null },
  { name: 'The dead flag ends it', cite: 'Concentration: Incapacitated or Dead', input: { concentrating: true, storedConditions: [], max: 20, hp: 0, dead: true }, expect: 'dead' },
  { name: 'Dead takes precedence over Incapacitated as the reason', cite: 'Concentration: Incapacitated or Dead', input: { concentrating: true, storedConditions: ['incapacitated'], max: 20, hp: 0, dead: true }, expect: 'dead' },
  { name: 'Exhaustion level 6 is death and ends it', cite: 'Exhaustion: You die if your Exhaustion level is 6', input: { concentrating: true, storedConditions: [], max: 20, hp: 20, exhaustion: 6 }, expect: 'dead' },
];

// ─── Concentration: starting a new effect ────────────────────────────────────
export interface ConcentrationStartCase {
  name: string;
  cite: string;
  current?: string;
  starting: string;
  /** Does the spell being started require Concentration? */
  startingRequiresConcentration: boolean;
  expect: { concentration?: string; endedPrevious?: string };
}

export const CONCENTRATION_START_CASES: ConcentrationStartCase[] = [
  { name: 'Start while not concentrating', cite: 'Concentration: Another Concentration Effect', starting: 'bless', startingRequiresConcentration: true, expect: { concentration: 'bless' } },
  { name: 'Starting a second Concentration spell ends the first', cite: 'Concentration: Another Concentration Effect', current: 'bless', starting: 'haste', startingRequiresConcentration: true, expect: { concentration: 'haste', endedPrevious: 'bless' } },
  { name: 'A spell that does not need Concentration leaves the current one alone', cite: 'Concentration: Another Concentration Effect', current: 'bless', starting: 'fireball', startingRequiresConcentration: false, expect: { concentration: 'bless' } },
  { name: 'A non-Concentration spell while idle starts nothing', cite: 'Concentration', starting: 'fireball', startingRequiresConcentration: false, expect: {} },
];

// ─── Short Rest ──────────────────────────────────────────────────────────────
export type RestOutcome = 'completed' | 'rejected' | 'interrupted';
export type RestError = 'needs-hp' | 'not-enough-hit-dice' | 'invalid-roll' | 'dead';

export interface ShortRestCase {
  name: string;
  cite: string;
  input: {
    max: number;
    hp: number;
    /** Hit Die size (6, 8, 10 or 12). */
    hitDie: number;
    hitDiceTotal: number;
    hitDiceSpent: number;
    conMod: number;
    /** The die FACE rolled for each Hit Die the user chooses to spend, in order. */
    rolls: number[];
    interrupted?: boolean;
    /** Pact Magic slots expended before the rest. */
    pactSlotsExpended?: number;
    /** Standard slots expended before the rest, by slot level. */
    slotsExpended?: Record<number, number>;
  };
  expect: {
    outcome: RestOutcome;
    error?: RestError;
    hp: number;
    hitDiceSpent: number;
    /** Per-die result: face + Con modifier, minimum 1, BEFORE the HP maximum cap. */
    rolled: number[];
    /** Hit Points actually gained after the cap at the maximum. */
    hpGained: number;
    /** Pact Magic slots expended after the rest (0 = all regained). */
    pactSlotsExpended: number;
    /** Standard slots expended after the rest (Short Rest never restores them). */
    slotsExpended: Record<number, number>;
  };
}

export const SHORT_REST_CASES: ShortRestCase[] = [
  {
    name: 'One Hit Die: d8 face 5 + Con 2 = 7',
    cite: 'Short Rest: Spend Hit Point Dice',
    input: { max: 20, hp: 10, hitDie: 8, hitDiceTotal: 5, hitDiceSpent: 0, conMod: 2, rolls: [5] },
    expect: { outcome: 'completed', hp: 17, hitDiceSpent: 1, rolled: [7], hpGained: 7, pactSlotsExpended: 0, slotsExpended: {} },
  },
  {
    name: 'Two Hit Dice, each with the Con modifier added',
    cite: 'Short Rest: for each Hit Die you spend, roll the die and add Con',
    input: { max: 30, hp: 5, hitDie: 10, hitDiceTotal: 6, hitDiceSpent: 1, conMod: 1, rolls: [3, 4] },
    expect: { outcome: 'completed', hp: 14, hitDiceSpent: 3, rolled: [4, 5], hpGained: 9, pactSlotsExpended: 0, slotsExpended: {} },
  },
  {
    name: 'Each die is at least 1 HP even when the Con modifier is negative',
    cite: 'Short Rest: minimum of 1 Hit Point',
    input: { max: 20, hp: 10, hitDie: 6, hitDiceTotal: 3, hitDiceSpent: 0, conMod: -1, rolls: [1] },
    expect: { outcome: 'completed', hp: 11, hitDiceSpent: 1, rolled: [1], hpGained: 1, pactSlotsExpended: 0, slotsExpended: {} },
  },
  {
    name: 'Minimum 1 applies per die, not to the sum (face 2, Con -3 gives 1; face 6, Con -3 gives 3)',
    cite: 'Short Rest: minimum of 1 Hit Point',
    input: { max: 40, hp: 10, hitDie: 6, hitDiceTotal: 4, hitDiceSpent: 0, conMod: -3, rolls: [2, 6] },
    expect: { outcome: 'completed', hp: 14, hitDiceSpent: 2, rolled: [1, 3], hpGained: 4, pactSlotsExpended: 0, slotsExpended: {} },
  },
  {
    name: 'Healing is capped at the HP maximum (excess lost); the die is still spent',
    cite: 'Healing: Hit Points can\'t exceed your Hit Point maximum',
    input: { max: 20, hp: 18, hitDie: 8, hitDiceTotal: 5, hitDiceSpent: 0, conMod: 2, rolls: [8] },
    expect: { outcome: 'completed', hp: 20, hitDiceSpent: 1, rolled: [10], hpGained: 2, pactSlotsExpended: 0, slotsExpended: {} },
  },
  {
    name: 'Spending zero dice is a valid Short Rest (features recharge, HP unchanged)',
    cite: 'Short Rest: Spend Hit Point Dice (one or more is optional)',
    input: { max: 20, hp: 10, hitDie: 8, hitDiceTotal: 5, hitDiceSpent: 2, conMod: 2, rolls: [] },
    expect: { outcome: 'completed', hp: 10, hitDiceSpent: 2, rolled: [], hpGained: 0, pactSlotsExpended: 0, slotsExpended: {} },
  },
  {
    name: 'Cannot spend more Hit Dice than remain (3 total, 2 spent, asks for 2)',
    cite: 'Short Rest: Spend Hit Point Dice',
    input: { max: 20, hp: 10, hitDie: 8, hitDiceTotal: 3, hitDiceSpent: 2, conMod: 2, rolls: [4, 4] },
    expect: { outcome: 'rejected', error: 'not-enough-hit-dice', hp: 10, hitDiceSpent: 2, rolled: [], hpGained: 0, pactSlotsExpended: 0, slotsExpended: {} },
  },
  {
    name: 'Must have at least 1 HP to start a Short Rest',
    cite: 'Short Rest: To start a Short Rest, you must have at least 1 Hit Point',
    input: { max: 20, hp: 0, hitDie: 8, hitDiceTotal: 5, hitDiceSpent: 0, conMod: 2, rolls: [5] },
    expect: { outcome: 'rejected', error: 'needs-hp', hp: 0, hitDiceSpent: 0, rolled: [], hpGained: 0, pactSlotsExpended: 0, slotsExpended: {} },
  },
  {
    name: 'A die face outside 1..hitDie is rejected (d8 cannot roll 9)',
    cite: 'Short Rest: roll the die',
    input: { max: 20, hp: 10, hitDie: 8, hitDiceTotal: 5, hitDiceSpent: 0, conMod: 2, rolls: [9] },
    expect: { outcome: 'rejected', error: 'invalid-roll', hp: 10, hitDiceSpent: 0, rolled: [], hpGained: 0, pactSlotsExpended: 0, slotsExpended: {} },
  },
  {
    name: 'A die face of 0 is rejected',
    cite: 'Short Rest: roll the die',
    input: { max: 20, hp: 10, hitDie: 8, hitDiceTotal: 5, hitDiceSpent: 0, conMod: 2, rolls: [0] },
    expect: { outcome: 'rejected', error: 'invalid-roll', hp: 10, hitDiceSpent: 0, rolled: [], hpGained: 0, pactSlotsExpended: 0, slotsExpended: {} },
  },
  {
    name: 'An interrupted Short Rest confers no benefits (no HP, no Hit Dice spent, no slots)',
    cite: 'Short Rest: An interrupted Short Rest confers no benefits',
    input: { max: 20, hp: 10, hitDie: 8, hitDiceTotal: 5, hitDiceSpent: 0, conMod: 2, rolls: [5], interrupted: true, pactSlotsExpended: 2 },
    expect: { outcome: 'interrupted', hp: 10, hitDiceSpent: 0, rolled: [], hpGained: 0, pactSlotsExpended: 2, slotsExpended: {} },
  },
  {
    name: 'Short Rest restores Pact Magic slots but NOT standard slots',
    cite: 'Pact Magic Spell Slots: regain all expended Pact Magic spell slots on a Short or Long Rest; standard slots only on a Long Rest',
    input: { max: 20, hp: 10, hitDie: 8, hitDiceTotal: 5, hitDiceSpent: 0, conMod: 0, rolls: [], pactSlotsExpended: 2, slotsExpended: { 1: 2, 3: 1 } },
    expect: { outcome: 'completed', hp: 10, hitDiceSpent: 0, rolled: [], hpGained: 0, pactSlotsExpended: 0, slotsExpended: { 1: 2, 3: 1 } },
  },
];

// ─── Long Rest ───────────────────────────────────────────────────────────────
export interface LongRestCase {
  name: string;
  cite: string;
  interpretation?: string;
  input: {
    max: number;
    hp: number;
    hitDiceTotal: number;
    hitDiceSpent: number;
    tempHp: number;
    /** Exhaustion level before the rest (0 = none). */
    exhaustion: number;
    slotsExpended?: Record<number, number>;
    pactSlotsExpended?: number;
    /** Mystic Arcanum has at least one use expended (the harness builds the real state). */
    arcanumUsed?: boolean;
    concentrating?: boolean;
    dead?: boolean;
  };
  expect: {
    outcome: RestOutcome;
    error?: RestError;
    hp: number;
    hitDiceSpent: number;
    tempHp: number;
    exhaustion: number;
    slotsExpended: Record<number, number>;
    pactSlotsExpended: number;
    arcanumUsed: boolean;
    concentrating: boolean;
  };
}

export const LONG_REST_CASES: LongRestCase[] = [
  {
    name: 'Full recovery: all HP, ALL spent Hit Dice, temp HP gone, exhaustion -1, all slots, Pact slots, Arcanum',
    cite: 'Long Rest: Regain All HP (2024: ALL spent Hit Dice); Exhaustion Reduced; Temporary Hit Points Duration; class Spell Slots',
    input: { max: 30, hp: 4, hitDiceTotal: 5, hitDiceSpent: 4, tempHp: 6, exhaustion: 3, slotsExpended: { 1: 2, 2: 1 }, pactSlotsExpended: 1, arcanumUsed: true },
    expect: { outcome: 'completed', hp: 30, hitDiceSpent: 0, tempHp: 0, exhaustion: 2, slotsExpended: {}, pactSlotsExpended: 0, arcanumUsed: false, concentrating: false },
  },
  {
    name: 'Exhaustion 1 drops to 0 (the condition ends)',
    cite: 'Exhaustion: Removing Exhaustion Levels',
    input: { max: 30, hp: 30, hitDiceTotal: 5, hitDiceSpent: 0, tempHp: 0, exhaustion: 1 },
    expect: { outcome: 'completed', hp: 30, hitDiceSpent: 0, tempHp: 0, exhaustion: 0, slotsExpended: {}, pactSlotsExpended: 0, arcanumUsed: false, concentrating: false },
  },
  {
    name: 'No exhaustion stays at 0',
    cite: 'Long Rest: Exhaustion Reduced (if you have the Exhaustion condition)',
    input: { max: 30, hp: 10, hitDiceTotal: 5, hitDiceSpent: 0, tempHp: 0, exhaustion: 0 },
    expect: { outcome: 'completed', hp: 30, hitDiceSpent: 0, tempHp: 0, exhaustion: 0, slotsExpended: {}, pactSlotsExpended: 0, arcanumUsed: false, concentrating: false },
  },
  {
    name: 'Temp HP are lost at the end of a Long Rest even at full HP',
    cite: 'Temporary Hit Points: Duration',
    input: { max: 30, hp: 30, hitDiceTotal: 5, hitDiceSpent: 0, tempHp: 5, exhaustion: 0 },
    expect: { outcome: 'completed', hp: 30, hitDiceSpent: 0, tempHp: 0, exhaustion: 0, slotsExpended: {}, pactSlotsExpended: 0, arcanumUsed: false, concentrating: false },
  },
  {
    name: 'All Hit Dice return (2024), not half',
    cite: 'Long Rest: you regain all lost Hit Points and all spent Hit Point Dice',
    input: { max: 60, hp: 60, hitDiceTotal: 10, hitDiceSpent: 9, tempHp: 0, exhaustion: 0 },
    expect: { outcome: 'completed', hp: 60, hitDiceSpent: 0, tempHp: 0, exhaustion: 0, slotsExpended: {}, pactSlotsExpended: 0, arcanumUsed: false, concentrating: false },
  },
  {
    name: 'Must have at least 1 HP to start a Long Rest',
    cite: 'Long Rest: To start a Long Rest, you must have at least 1 Hit Point',
    input: { max: 30, hp: 0, hitDiceTotal: 5, hitDiceSpent: 4, tempHp: 3, exhaustion: 2, slotsExpended: { 1: 1 } },
    expect: { outcome: 'rejected', error: 'needs-hp', hp: 0, hitDiceSpent: 4, tempHp: 3, exhaustion: 2, slotsExpended: { 1: 1 }, pactSlotsExpended: 0, arcanumUsed: false, concentrating: false },
  },
  {
    name: 'A dead character cannot rest',
    cite: 'Dead (rules glossary): cannot regain Hit Points without revival',
    input: { max: 30, hp: 0, hitDiceTotal: 5, hitDiceSpent: 4, tempHp: 0, exhaustion: 0, dead: true },
    expect: { outcome: 'rejected', error: 'dead', hp: 0, hitDiceSpent: 4, tempHp: 0, exhaustion: 0, slotsExpended: {}, pactSlotsExpended: 0, arcanumUsed: false, concentrating: false },
  },
  {
    name: 'A Long Rest ends Concentration (the sleeper is Unconscious, which implies Incapacitated)',
    cite: 'Long Rest: During sleep, you have the Unconscious condition + Concentration: Incapacitated',
    interpretation: 'Derived reading; the PHB does not state "a Long Rest ends Concentration" in one sentence.',
    input: { max: 30, hp: 30, hitDiceTotal: 5, hitDiceSpent: 0, tempHp: 0, exhaustion: 0, concentrating: true },
    expect: { outcome: 'completed', hp: 30, hitDiceSpent: 0, tempHp: 0, exhaustion: 0, slotsExpended: {}, pactSlotsExpended: 0, arcanumUsed: false, concentrating: false },
  },
];

// ─── Rest interruption, duration, and the 16-hour gap ────────────────────────
export interface InterruptionCase {
  name: string;
  cite: string;
  kind: 'short' | 'long';
  /** Whole or fractional hours of the rest completed before the interruption. */
  hoursCompleted: number;
  /** none = no benefits; short-rest = Short Rest benefits only. */
  expect: 'none' | 'short-rest';
}

export const INTERRUPTION_CASES: InterruptionCase[] = [
  { name: 'Interrupted Short Rest: nothing, even after 59 minutes', cite: 'Short Rest: An interrupted Short Rest confers no benefits', kind: 'short', hoursCompleted: 0.98, expect: 'none' },
  { name: 'Long Rest interrupted before 1 hour: nothing', cite: 'Long Rest: Interrupting the Rest', kind: 'long', hoursCompleted: 0.5, expect: 'none' },
  { name: 'Long Rest interrupted after exactly 1 hour: Short Rest benefits', cite: 'Long Rest: If you rested at least 1 hour before the interruption, you gain the benefits of a Short Rest', kind: 'long', hoursCompleted: 1, expect: 'short-rest' },
  { name: 'Long Rest interrupted after 7 hours: Short Rest benefits only', cite: 'Long Rest: Interrupting the Rest', kind: 'long', hoursCompleted: 7, expect: 'short-rest' },
];

export interface LongRestHoursCase {
  interruptions: number;
  /** Minimum hours the Long Rest needs: 8, plus 1 additional hour per interruption. */
  expectHours: number;
}

export const LONG_REST_HOURS_CASES: LongRestHoursCase[] = [
  { interruptions: 0, expectHours: 8 },
  { interruptions: 1, expectHours: 9 },
  { interruptions: 3, expectHours: 11 },
];

/** Events that interrupt a rest, by rest kind (compare as SETS; order is irrelevant). */
export const INTERRUPTION_TRIGGERS = {
  short: ['rolling-initiative', 'non-cantrip-spell', 'damage'],
  long: ['rolling-initiative', 'non-cantrip-spell', 'damage', 'one-hour-exertion'],
};

/**
 * Decision D5: the 16-hour wait between Long Rests is ADVISORY, never a block.
 * `now` and `last` are epoch milliseconds.
 */
export const HOUR_MS = 3_600_000;

export interface LongRestGapCase {
  name: string;
  last?: number;
  now: number;
  /** true = show the "less than 16 hours since your last Long Rest" advisory. */
  expectAdvisory: boolean;
}

export const LONG_REST_GAP_CASES: LongRestGapCase[] = [
  { name: 'No previous Long Rest recorded: no advisory', now: 1_000 * HOUR_MS, expectAdvisory: false },
  { name: '15h59m since the last Long Rest: advisory', last: 0, now: 15 * HOUR_MS + 59 * 60_000, expectAdvisory: true },
  { name: 'Exactly 16h since the last Long Rest: no advisory', last: 0, now: 16 * HOUR_MS, expectAdvisory: false },
  { name: '30h since the last Long Rest: no advisory', last: 0, now: 30 * HOUR_MS, expectAdvisory: false },
  { name: 'Clock skew (now before last): advisory, never a crash', last: 10 * HOUR_MS, now: 5 * HOUR_MS, expectAdvisory: true },
];
