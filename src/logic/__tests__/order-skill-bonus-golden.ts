/**
 * GOLDEN (data only): the Intelligence-check bonus of Cleric Thaumaturge and Druid
 * Magician, authored from the PHB 2024 (Docs/PlayersHandbook.md) and NOT derived
 * from the code. Do NOT edit to match the code.
 *
 * - Thaumaturge (Cleric Divine Order, L3234): "a bonus to your Intelligence
 *   (Arcana or Religion) checks. The bonus equals your Wisdom modifier (minimum of +1)."
 * - Magician (Druid Primal Order, L3670): same for Intelligence (Arcana or Nature)
 *   checks, "minimum bonus of +1".
 * - Passive Perception (L1914-1918) is 10 + the Wisdom (Perception) check modifier,
 *   so an Intelligence-check bonus never enters it.
 *
 * Fixture: character level 5 (Proficiency Bonus +3), Intelligence 14 (+2), Dex/Con 10.
 * Arcana/Religion/Nature are Intelligence skills (PHB Skills table), so
 * total = Int mod (+2) + (proficient ? 3 : 0) + (expertise ? 3 : 0) + order bonus.
 */

export const GOLDEN_LEVEL = 5;
export const GOLDEN_INT = 14;

export interface OrderBonusRow {
  /** Wisdom score and the bonus it must yield (max(1, Wis mod)). */
  wis: number;
  wisMod: number;
  bonus: number;
  /** Totals for an Intelligence skill the order covers: untrained / proficient / expertise. */
  untrained: number;
  proficient: number;
  expertise: number;
}

export const ORDER_BONUS_ROWS: readonly OrderBonusRow[] = [
  // Wis 8 => mod -1 => bonus is the minimum +1.
  { wis: 8, wisMod: -1, bonus: 1, untrained: 3, proficient: 6, expertise: 9 },
  // Wis 10 => mod 0 => minimum +1.
  { wis: 10, wisMod: 0, bonus: 1, untrained: 3, proficient: 6, expertise: 9 },
  // Wis 12 => mod +1 => +1 (equal to the minimum).
  { wis: 12, wisMod: 1, bonus: 1, untrained: 3, proficient: 6, expertise: 9 },
  // Wis 16 => mod +3 => +3.
  { wis: 16, wisMod: 3, bonus: 3, untrained: 5, proficient: 8, expertise: 11 },
  // Wis 20 => mod +5 => +5.
  { wis: 20, wisMod: 5, bonus: 5, untrained: 7, proficient: 10, expertise: 13 },
];

/** Skills the bonus applies to, per order (the PHB parenthesised lists). */
export const COVERED: Readonly<Record<'thaumaturge' | 'magician', readonly string[]>> = {
  thaumaturge: ['arcana', 'religion'],
  magician: ['arcana', 'nature'],
};

/** Skills that must NOT get the bonus from either order (other Int skills and other abilities). */
export const NEVER_COVERED: readonly string[] = ['history', 'investigation', 'perception', 'insight', 'medicine', 'survival', 'animalHandling', 'athletics'];

/** Untrained totals with Wis 16 (+3) for the NEVER_COVERED skills: ability mod only (Int +2 / Wis +3 / Str 10 = 0). */
export const NEVER_COVERED_TOTALS: Readonly<Record<string, number>> = {
  history: 2,
  investigation: 2,
  perception: 3,
  insight: 3,
  medicine: 3,
  survival: 3,
  'animalHandling': 3,
  athletics: 0,
};

/** Passive Perception, Wis 16 (+3), proficient in Perception (+3): 10 + 3 + 3. */
export const PASSIVE_PERCEPTION_WIS16_PROF = 16;
