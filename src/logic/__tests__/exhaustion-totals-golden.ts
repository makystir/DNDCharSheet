/**
 * GOLDEN TABLE for the Exhaustion D20-Test penalty in STATIC totals (skills,
 * saving throws, Initiative, attack bonuses, spell attack bonus).
 *
 * AUTHORED FROM THE PHB 2024 TEXT FIRST (Docs/PlayersHandbook.md), BEFORE the
 * logic. Do not edit to fit the implementation.
 *
 * Source: "Exhaustion [Condition]" (PHB L21018-21028):
 *  - L21022: cumulative levels; you die at level 6.
 *  - L21024: "When you make a D20 Test, the roll is reduced by 2 times your
 *    Exhaustion level."  -> level 0..6 gives 0, -2, -4, -6, -8, -10, -12.
 *  - L21026: Speed reduced by 5 ft x level (handled elsewhere; not in this table).
 *
 * Scope decisions (flagged ambiguities, resolved by the PHB wording):
 *  - The penalty reduces "the roll" of a D20 Test, so it applies to totals that
 *    describe a d20 roll: skill checks, saving throws, Initiative (a Dexterity
 *    check, L1904-region "Initiative"), weapon / unarmed / spell attack rolls.
 *  - Passive Perception (L1916: 10 + the Wisdom (Perception) check modifier) is
 *    a score, not a roll, and the Exhaustion text says nothing about it: NOT
 *    reduced.
 *  - Save DCs (spell save DC, Grapple / Shove DC) are static difficulty
 *    numbers, not rolls: NOT reduced.
 *  - The penalty must be counted exactly once: roll flows add it themselves, so
 *    the roll-modifier components they consume never carry it.
 *
 * Fixture: Sorcerer 5 (PB +3), STR 10, DEX 14, CON 12, INT 10, WIS 16, CHA 18;
 * Perception proficient, Stealth proficient + expertise, Athletics untrained;
 * Initiative bonus +1; a Dagger with a +1 attack bonus.
 *
 * Every array is indexed by Exhaustion level 0..6.
 *
 * DATA ONLY (no imports).
 */
export const LEVELS = [0, 1, 2, 3, 4, 5, 6] as const;

/** The d20-test penalty at each level: -2 x level. */
export const PENALTY = [0, -2, -4, -6, -8, -10, -12];

export interface TotalRow {
  name: string;
  /** Total at each Exhaustion level 0..6. */
  totals: number[];
}

/** Static displayed totals that ARE D20 Tests. */
export const D20_ROWS: Record<string, TotalRow> = {
  // Wis +3, proficient +3.
  perceptionSkill: { name: 'Perception skill', totals: [6, 4, 2, 0, -2, -4, -6] },
  // Dex +2, proficient +3, expertise +3.
  stealthSkill: { name: 'Stealth skill (expertise)', totals: [8, 6, 4, 2, 0, -2, -4] },
  // Str +0, untrained.
  athleticsSkill: { name: 'Athletics skill (untrained)', totals: [0, -2, -4, -6, -8, -10, -12] },
  // Cha +4, Sorcerer save proficiency +3.
  chaSave: { name: 'Charisma save (class proficient)', totals: [7, 5, 3, 1, -1, -3, -5] },
  // Dex +2, not proficient.
  dexSave: { name: 'Dexterity save (not proficient)', totals: [2, 0, -2, -4, -6, -8, -10] },
  // Dex +2 + Initiative bonus +1.
  initiative: { name: 'Initiative', totals: [3, 1, -1, -3, -5, -7, -9] },
  // Dagger (Finesse): Dex +2, proficient +3, item +1.
  daggerAttack: { name: 'Dagger attack bonus', totals: [6, 4, 2, 0, -2, -4, -6] },
  // Str +0, Proficiency +3.
  unarmedAttack: { name: 'Unarmed Strike attack bonus', totals: [3, 1, -1, -3, -5, -7, -9] },
  // Proficiency +3, Cha +4.
  spellAttack: { name: 'Spell attack bonus', totals: [7, 5, 3, 1, -1, -3, -5] },
};

/** Static totals that are NOT D20 Tests: constant at every level. */
export const UNAFFECTED_ROWS: Record<string, { name: string; total: number }> = {
  // L1916: 10 + Perception modifier (+6).
  passivePerception: { name: 'Passive Perception', total: 16 },
  // 8 + PB 3 + Cha 4.
  spellSaveDc: { name: 'Spell save DC', total: 15 },
  // 8 + Str 0 + PB 3.
  grappleDc: { name: 'Grapple DC', total: 11 },
  shoveDc: { name: 'Shove DC', total: 11 },
};

/**
 * Adversarial "counted exactly once" rows: a ROLL (die face fixed) built from
 * the same character through the in-app roll path. Total = face + base total
 * + penalty, where the penalty is applied ONCE.
 */
export interface RollOnceRow {
  name: string;
  /** Natural d20 face. */
  face: number;
  /** Totals at each level 0..6. */
  totals: number[];
}
export const ROLL_ONCE_ROWS: Record<string, RollOnceRow> = {
  // Initiative d20 12 + Dex 2 + bonus 1 = 15, minus 2 x level.
  initiativeRoll: { name: 'Initiative roll (d20 = 12)', face: 12, totals: [15, 13, 11, 9, 7, 5, 3] },
  // Dagger attack d20 10 + 6 = 16, minus 2 x level.
  daggerAttackRoll: { name: 'Dagger attack roll (d20 = 10)', face: 10, totals: [16, 14, 12, 10, 8, 6, 4] },
  // Concentration: d20 9 + Con +1 + Sorcerer proficiency +3 = 13, minus 2 x level.
  concentrationSave: { name: 'Concentration save (d20 = 9)', face: 9, totals: [13, 11, 9, 7, 5, 3, 1] },
};
