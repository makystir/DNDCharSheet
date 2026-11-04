/**
 * GOLDEN TABLE for Stage A5e: the Speed breakdown (armour Strength penalty +
 * Exhaustion) and Unarmored Defense (Barbarian / Monk).
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md) BEFORE the logic is implemented. The implementer must
 * make the real functions reproduce every row and MUST NOT edit this file. If a row
 * looks wrong, flag it in the summary instead of changing it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. A harness in the
 * implementer's tests maps each row to the real API. Ability modifier =
 * floor((score - 10) / 2).
 *
 * Sources (PHB 2024):
 *  - Armor table "Strength" column (~L9600-9646) and its note: if the armor lists a
 *    Strength score and the wearer's Strength is lower, the armor reduces Speed by
 *    10 feet. Chain Mail Str 13; Splint and Plate Str 15; lighter armor has no
 *    requirement. The penalty is a FLAT -10 (it does not scale with the shortfall)
 *    and applies ONCE regardless of how far below the requirement you are.
 *  - Exhaustion [Condition] (~L21024): Speed is reduced by 5 feet times the
 *    Exhaustion level. Speed never goes below 0.
 *  - Unarmored Defense: Barbarian (~L2446) base AC = 10 + Dex + Con, and a Shield is
 *    allowed; Monk (~L4534) base AC = 10 + Dex + Wis, only while NOT wielding a
 *    Shield. Both are a "base AC" calculation, so "Only One Base AC" (~L2106-2110)
 *    applies: the character benefits from only one base calculation. Unarmored
 *    Defense requires NOT wearing armour, so it and a worn-armour base are never
 *    both available at once — when a suit is worn, Unarmored Defense simply does
 *    not apply and the armour base is used (even if it is lower). The only genuine
 *    "pick one" is a future case of two unarmored bases (e.g. a multiclass of two
 *    Unarmored Defense features), which is out of A5e scope; a single class grants
 *    at most one, so A5e never has to choose between two bases.
 *  - A Shield's +2 is NOT a base AC; it adds on top of whichever base applies
 *    (except Monk Unarmored Defense, which is unavailable while a Shield is wielded).
 *
 * Rows tagged `interpretation` are orchestrator-approved readings where the PHB does
 * not state the point verbatim.
 */

// ─── Speed breakdown ─────────────────────────────────────────────────────────
export interface SpeedComponent {
  label: string;
  value: number;
}

export interface SpeedCase {
  name: string;
  cite: string;
  interpretation?: string;
  input: {
    /** Base walking speed from the species (30 default, Goliath 35, Wood Elf 35). */
    baseSpeed: number;
    /** The wearer's Strength SCORE (not modifier). */
    str: number;
    /**
     * The worn armour's Strength requirement, or undefined when the armour lists
     * none (or the character is unarmored). A catalog-less custom armour that is
     * "worn" sets no requirement (no value is invented), so pass undefined.
     */
    armorStrengthRequirement?: number;
    /** Exhaustion level (0 = none). */
    exhaustion: number;
  };
  expect: {
    total: number;
    /** Components, in order; MUST sum to total (include zeros per the steering). */
    components: SpeedComponent[];
  };
}

export const SPEED_CASES: SpeedCase[] = [
  {
    name: 'No armour requirement, no exhaustion: just the base',
    cite: 'Parts of a Species (Speed)',
    input: { baseSpeed: 30, str: 10, exhaustion: 0 },
    expect: { total: 30, components: [{ label: 'Base speed', value: 30 }] },
  },
  {
    name: 'Goliath base 35 unchanged',
    cite: 'Species Speed',
    input: { baseSpeed: 35, str: 10, exhaustion: 0 },
    expect: { total: 35, components: [{ label: 'Base speed', value: 35 }] },
  },
  {
    name: 'Chain Mail (Str 13) with Str 12: -10 ft',
    cite: 'Armor table Strength column',
    input: { baseSpeed: 30, str: 12, armorStrengthRequirement: 13, exhaustion: 0 },
    expect: { total: 20, components: [{ label: 'Base speed', value: 30 }, { label: 'Armor Strength requirement (Str 13)', value: -10 }] },
  },
  {
    name: 'Chain Mail (Str 13) with exactly Str 13: no penalty',
    cite: 'Armor table: a Strength score equal to or higher than the requirement',
    input: { baseSpeed: 30, str: 13, armorStrengthRequirement: 13, exhaustion: 0 },
    expect: { total: 30, components: [{ label: 'Base speed', value: 30 }] },
  },
  {
    name: 'Chain Mail (Str 13) with Str 14: no penalty',
    cite: 'Armor table Strength column',
    input: { baseSpeed: 30, str: 14, armorStrengthRequirement: 13, exhaustion: 0 },
    expect: { total: 30, components: [{ label: 'Base speed', value: 30 }] },
  },
  {
    name: 'Plate (Str 15) with Str 8: still a flat -10 (does not scale with the shortfall)',
    cite: 'Armor table: reduces Speed by 10 feet',
    input: { baseSpeed: 30, str: 8, armorStrengthRequirement: 15, exhaustion: 0 },
    expect: { total: 20, components: [{ label: 'Base speed', value: 30 }, { label: 'Armor Strength requirement (Str 15)', value: -10 }] },
  },
  {
    name: 'Exhaustion 1: -5 ft',
    cite: 'Exhaustion: Speed Reduced',
    input: { baseSpeed: 30, str: 10, exhaustion: 1 },
    expect: { total: 25, components: [{ label: 'Base speed', value: 30 }, { label: 'Exhaustion (level 1)', value: -5 }] },
  },
  {
    name: 'Exhaustion 3: -15 ft',
    cite: 'Exhaustion: Speed Reduced (5 x level)',
    input: { baseSpeed: 30, str: 10, exhaustion: 3 },
    expect: { total: 15, components: [{ label: 'Base speed', value: 30 }, { label: 'Exhaustion (level 3)', value: -15 }] },
  },
  {
    name: 'Both armour penalty and exhaustion stack (Plate Str 15, Str 10, Exhaustion 2)',
    cite: 'Armor Strength + Exhaustion',
    input: { baseSpeed: 30, str: 10, armorStrengthRequirement: 15, exhaustion: 2 },
    expect: { total: 10, components: [{ label: 'Base speed', value: 30 }, { label: 'Armor Strength requirement (Str 15)', value: -10 }, { label: 'Exhaustion (level 2)', value: -10 }] },
  },
  {
    name: 'Speed never goes below 0 (base 30, armour -10, Exhaustion 6 = -30)',
    cite: 'Exhaustion + a Speed floor of 0',
    interpretation: 'Speed cannot be negative; the floor is 0.',
    input: { baseSpeed: 30, str: 8, armorStrengthRequirement: 15, exhaustion: 6 },
    expect: { total: 0, components: [{ label: 'Base speed', value: 30 }, { label: 'Armor Strength requirement (Str 15)', value: -10 }, { label: 'Exhaustion (level 6)', value: -30 }] },
  },
  {
    name: 'Exhaustion exactly to 0 Speed (base 30, Exhaustion 6)',
    cite: 'Exhaustion: Speed Reduced',
    input: { baseSpeed: 30, str: 10, exhaustion: 6 },
    expect: { total: 0, components: [{ label: 'Base speed', value: 30 }, { label: 'Exhaustion (level 6)', value: -30 }] },
  },
  {
    name: 'Wood Elf 35 with Plate (Str 15) and Str 12: 35 - 10 = 25',
    cite: 'Species Speed + Armor Strength',
    input: { baseSpeed: 35, str: 12, armorStrengthRequirement: 15, exhaustion: 0 },
    expect: { total: 25, components: [{ label: 'Base speed', value: 35 }, { label: 'Armor Strength requirement (Str 15)', value: -10 }] },
  },
];

// ─── Unarmored Defense base AC ───────────────────────────────────────────────
export type UnarmoredDefenseKind = 'barbarian' | 'monk' | 'none';

export interface BaseAcOption {
  /** 'armor' when a suit is worn; 'unarmored' = 10 + Dex; 'barbarian'/'monk' = Unarmored Defense. */
  source: 'armor' | 'unarmored' | 'barbarian' | 'monk';
  /** The base value BEFORE the Shield bonus. */
  base: number;
}

export interface UnarmoredDefenseCase {
  name: string;
  cite: string;
  interpretation?: string;
  input: {
    dex: number;
    con: number;
    wis: number;
    /** The Unarmored Defense the character's class grants (A5e wires Barbarian/Monk). */
    kind: UnarmoredDefenseKind;
    /** A suit of armour is worn (so Unarmored Defense does not apply). */
    armorWorn?: boolean;
    /** The worn armour's base AC (used only when armorWorn). */
    armorBase?: number;
    /** The worn armour's applied Dex contribution (used only when armorWorn). */
    armorAppliedDex?: number;
    /** A Shield is wielded (+2, except it disables Monk Unarmored Defense). */
    shield?: boolean;
  };
  expect: {
    /** The chosen base source and its pre-shield base value. */
    chosen: BaseAcOption;
    /** +2 when a Shield applies to the chosen base, else 0. */
    shieldBonus: number;
    /** Final AC = chosen.base + shieldBonus. */
    total: number;
  };
}

export const UNARMORED_DEFENSE_CASES: UnarmoredDefenseCase[] = [
  {
    name: 'Barbarian Unarmored Defense: 10 + Dex 2 + Con 3 = 15',
    cite: 'Barbarian Unarmored Defense',
    input: { dex: 14, con: 16, wis: 10, kind: 'barbarian' },
    expect: { chosen: { source: 'barbarian', base: 15 }, shieldBonus: 0, total: 15 },
  },
  {
    name: 'Barbarian Unarmored Defense allows a Shield: 15 + 2 = 17',
    cite: 'Barbarian Unarmored Defense: You can use a Shield and still gain this benefit',
    input: { dex: 14, con: 16, wis: 10, kind: 'barbarian', shield: true },
    expect: { chosen: { source: 'barbarian', base: 15 }, shieldBonus: 2, total: 17 },
  },
  {
    name: 'Monk Unarmored Defense: 10 + Dex 3 + Wis 2 = 15',
    cite: 'Monk Unarmored Defense',
    input: { dex: 16, con: 10, wis: 14, kind: 'monk' },
    expect: { chosen: { source: 'monk', base: 15 }, shieldBonus: 0, total: 15 },
  },
  {
    name: 'Monk Unarmored Defense is LOST while wielding a Shield: falls back to 10 + Dex, then +2 shield',
    cite: 'Monk Unarmored Defense: while not wielding a Shield',
    input: { dex: 16, con: 10, wis: 14, kind: 'monk', shield: true },
    expect: { chosen: { source: 'unarmored', base: 13 }, shieldBonus: 2, total: 15 },
  },
  {
    name: 'No Unarmored Defense: plain 10 + Dex',
    cite: 'Armor Class (base 10 + Dex)',
    input: { dex: 14, con: 16, wis: 16, kind: 'none' },
    expect: { chosen: { source: 'unarmored', base: 12 }, shieldBonus: 0, total: 12 },
  },
  {
    name: 'Worn armour disables Unarmored Defense entirely (Barbarian in Chain Shirt base 13 + Dex 2)',
    cite: 'Unarmored Defense: while you aren\'t wearing armor',
    input: { dex: 14, con: 18, wis: 10, kind: 'barbarian', armorWorn: true, armorBase: 13, armorAppliedDex: 2 },
    expect: { chosen: { source: 'armor', base: 15 }, shieldBonus: 0, total: 15 },
  },
  {
    name: 'Only One Base AC: worn armour disables Unarmored Defense even when UD would be higher (Barbarian in light armour base 11 + Dex 2 = 13, not UD 16)',
    cite: 'Only One Base AC + Unarmored Defense requires not wearing armour',
    interpretation: 'Unarmored Defense is unavailable while armour is worn, so the armour base is used even though UD would be higher. The player chooses by NOT wearing armour.',
    input: { dex: 14, con: 18, wis: 10, kind: 'barbarian', armorWorn: true, armorBase: 11, armorAppliedDex: 2 },
    expect: { chosen: { source: 'armor', base: 13 }, shieldBonus: 0, total: 13 },
  },
  {
    name: 'Barbarian with low Con: Unarmored Defense can be worse than plain unarmored but UD is still a single base (Dex 16, Con 8 -> 10+3-1=12)',
    cite: 'Barbarian Unarmored Defense',
    interpretation: 'Negative Con is included as RAW states "plus your Constitution modifier"; no floor beyond the modifier itself.',
    input: { dex: 16, con: 8, wis: 10, kind: 'barbarian' },
    expect: { chosen: { source: 'barbarian', base: 12 }, shieldBonus: 0, total: 12 },
  },
  {
    name: 'Monk Unarmored Defense with a negative modifier (Dex 16, Wis 8 -> 10+3-1=12)',
    cite: 'Monk Unarmored Defense',
    input: { dex: 16, con: 10, wis: 8, kind: 'monk' },
    expect: { chosen: { source: 'monk', base: 12 }, shieldBonus: 0, total: 12 },
  },
];

/**
 * Which 2024 classes grant an Unarmored Defense that A5e wires, and its governing
 * ability. Draconic Sorcerer (Cha) is a SUBCLASS feature and is out of A5e scope
 * (no subclass AC wiring yet); it is listed as a known exclusion, not implemented.
 */
export const UNARMORED_DEFENSE_BY_CLASS: Record<string, { kind: UnarmoredDefenseKind; ability?: 'con' | 'wis'; shieldAllowed: boolean }> = {
  barbarian: { kind: 'barbarian', ability: 'con', shieldAllowed: true },
  monk: { kind: 'monk', ability: 'wis', shieldAllowed: false },
  bard: { kind: 'none', shieldAllowed: true },
  cleric: { kind: 'none', shieldAllowed: true },
  druid: { kind: 'none', shieldAllowed: true },
  fighter: { kind: 'none', shieldAllowed: true },
  paladin: { kind: 'none', shieldAllowed: true },
  ranger: { kind: 'none', shieldAllowed: true },
  rogue: { kind: 'none', shieldAllowed: true },
  sorcerer: { kind: 'none', shieldAllowed: true },
  warlock: { kind: 'none', shieldAllowed: true },
  wizard: { kind: 'none', shieldAllowed: true },
};
