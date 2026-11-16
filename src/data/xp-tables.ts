/**
 * Experience Point tables used to plan and reward combat.
 *
 * XP_BY_CR: Monster Manual 2024, "Experience Points by Challenge Rating"
 * (printed page 8). Read from the page image, because the Markdown OCR of that
 * table is garbled. CR 0 is printed "0 or 10"; the table holds 0 and the DM can
 * enter 10 for a CR 0 creature that can attack.
 *
 * XP_BUDGET_PER_CHARACTER: Dungeon Master's Guide 2024, chapter 4, "XP Budget
 * per Character" (Docs/DungeonMastersGuide.md L4654-4677). The Markdown OCR
 * mangles some level labels (levels 11, 14, 17, 18 print as "n", "4", "7",
 * "a3"), so those rows are placed by their position between their neighbours.
 * Every figure is clear, rises with level in each column, and three printed
 * worked examples (level 1 Low 50, level 3 Moderate 225, level 15 High 7,800)
 * agree with the table.
 */

/** Challenge Rating (as printed) to Experience Points. */
export const XP_BY_CR: Readonly<Record<string, number>> = {
  '0': 0,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

export type EncounterDifficulty = 'low' | 'moderate' | 'high';

export const DIFFICULTIES: readonly EncounterDifficulty[] = ['low', 'moderate', 'high'];

export const DIFFICULTY_LABELS: Record<EncounterDifficulty, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
};

/** XP budget for one character, by character level 1..20. */
export const XP_BUDGET_PER_CHARACTER: readonly Readonly<Record<EncounterDifficulty, number>>[] = [
  { low: 50, moderate: 75, high: 100 }, // 1
  { low: 100, moderate: 150, high: 200 }, // 2
  { low: 150, moderate: 225, high: 400 }, // 3
  { low: 250, moderate: 375, high: 500 }, // 4
  { low: 500, moderate: 750, high: 1100 }, // 5
  { low: 600, moderate: 1000, high: 1400 }, // 6
  { low: 750, moderate: 1300, high: 1700 }, // 7
  { low: 1000, moderate: 1700, high: 2100 }, // 8
  { low: 1300, moderate: 2000, high: 2600 }, // 9
  { low: 1600, moderate: 2300, high: 3100 }, // 10
  { low: 1900, moderate: 2900, high: 4100 }, // 11
  { low: 2200, moderate: 3700, high: 4700 }, // 12
  { low: 2600, moderate: 4200, high: 5400 }, // 13
  { low: 2900, moderate: 4900, high: 6200 }, // 14
  { low: 3300, moderate: 5400, high: 7800 }, // 15
  { low: 3800, moderate: 6100, high: 9800 }, // 16
  { low: 4500, moderate: 7200, high: 11700 }, // 17
  { low: 5000, moderate: 8700, high: 14200 }, // 18
  { low: 5500, moderate: 10700, high: 17200 }, // 19
  { low: 6400, moderate: 13200, high: 22000 }, // 20
];
