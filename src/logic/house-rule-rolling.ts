/**
 * Optional house-rule ability-score rolling methods.
 *
 * RULES-COMPLIANCE (rule 4: variants are opt-in): none of these methods is in
 * the 2024 PHB, whose only random method is "roll 4d6, keep the highest three,
 * six times" (PHB 2024 "Generate Your Scores", Docs/PlayersHandbook.md
 * L1670-1678; see ability-score-generation.ts). They are house rules supplied
 * by the user (a table of alternative methods) plus "3d6 Twelve Times, Keep
 * Six", which the user cites as originating in the AD&D Dungeon Master's
 * Guide. They are OFF by default and are only offered in the creation wizard
 * when enabled in Settings (see src/hooks/useRollingHouseRules.ts).
 *
 * Every function is pure; randomness comes from the injected RNG
 * (src/logic/random.ts), so a scripted sequence is fully deterministic.
 */
import type { RNG } from './random';
import { rollAbilityScore, rollAbilityScoreSet } from './ability-score-generation';

/** The house-rule methods, in display order. */
export const ROLLING_HOUSE_RULE_IDS = [
  '2d6-plus-6',
  '4d6-reroll-ones',
  '5d6-drop-two',
  'grid-6x6',
  'min-total-70',
  '3d6-twelve-keep-six',
] as const;
export type RollingHouseRuleId = (typeof ROLLING_HOUSE_RULE_IDS)[number];

/** Display name, one-line description and source note for each method. */
export const ROLLING_HOUSE_RULES: Record<
  RollingHouseRuleId,
  { name: string; description: string; range: string }
> = {
  '2d6-plus-6': {
    name: '2d6 + 6 (Heroic)',
    description: 'Roll two d6 and add 6, six times.',
    range: 'Min 8, max 18, average 13.0.',
  },
  '4d6-reroll-ones': {
    name: '4d6, Drop Lowest, Reroll 1s',
    description: 'Roll four d6 and reroll any 1s until none remain, then drop the lowest die. Six times.',
    range: 'Min 6, max 18, average about 13.4.',
  },
  '5d6-drop-two': {
    name: '5d6, Drop Lowest Two',
    description: 'Roll five d6 and keep the highest three. Six times.',
    range: 'Min 3, max 18, average about 13.4.',
  },
  'grid-6x6': {
    name: 'The 6x6 Grid',
    description:
      'Roll a score 36 times (3d6, or 4d6 drop lowest) into a 6x6 grid, then pick any one row, column or diagonal as your six scores.',
    range: 'Min 3, max 18, average varies (high).',
  },
  'min-total-70': {
    name: '70+ Minimum Total',
    description: 'Roll standard 4d6 drop lowest for six scores. Reroll the whole set if the six total less than 70.',
    range: 'Average about 13.0 or more (a rough figure).',
  },
  '3d6-twelve-keep-six': {
    name: '3d6 Twelve Times, Keep Six',
    description: 'Roll 3d6 twelve separate times and keep the six highest totals. From the AD&D Dungeon Master\'s Guide.',
    range: 'Min 3, max 18.',
  },
};

/** The six-score minimum total required by the "70+ Minimum Total" method. */
export const MIN_TOTAL_70 = 70;
/** Size of the 6x6 grid. */
export const GRID_SIZE = 6;
/** How many 3d6 totals the twelve-times method rolls, and how many it keeps. */
export const TWELVE_ROLLS = 12;
export const TWELVE_KEEP = 6;

function d6(rng: RNG): number {
  return Math.floor(rng() * 6) + 1;
}

/** Sum of the highest `keep` values of `dice` (does not mutate the input). */
function sumHighest(dice: number[], keep: number): number {
  return [...dice]
    .sort((a, b) => b - a)
    .slice(0, keep)
    .reduce((s, n) => s + n, 0);
}

/** 2d6 + 6 (Heroic): two d6 plus 6. Range 8..18. */
export function rollHeroicScore(rng: RNG): number {
  return d6(rng) + d6(rng) + 6;
}

/**
 * Roll one d6 for the reroll-1s method: a 1 is rerolled, indefinitely, until a
 * 2..6 shows. Consumes one RNG draw per attempt.
 */
function d6RerollOnes(rng: RNG): number {
  let face = d6(rng);
  while (face === 1) face = d6(rng);
  return face;
}

/**
 * 4d6, Drop Lowest, Reroll 1s: four dice, each 1 rerolled until it is not a 1,
 * then drop the lowest. Every die ends at 2..6, so the range is 6..18.
 */
export function rollRerollOnesScore(rng: RNG): number {
  const dice = [d6RerollOnes(rng), d6RerollOnes(rng), d6RerollOnes(rng), d6RerollOnes(rng)];
  return sumHighest(dice, 3);
}

/** 5d6, Drop Lowest Two: five d6, keep the highest three. Range 3..18. */
export function rollFiveDropTwoScore(rng: RNG): number {
  const dice = [d6(rng), d6(rng), d6(rng), d6(rng), d6(rng)];
  return sumHighest(dice, 3);
}

/** One plain 3d6 total (range 3..18). */
export function roll3d6(rng: RNG): number {
  return d6(rng) + d6(rng) + d6(rng);
}

/** Six scores, each rolled with `rollOne`. */
export function rollSix(rng: RNG, rollOne: (rng: RNG) => number): number[] {
  return [0, 1, 2, 3, 4, 5].map(() => rollOne(rng));
}

/** The dice used for each cell of the 6x6 grid (the table allows either). */
export type GridDice = '3d6' | '4d6-drop-lowest';

/** The 36 grid cells, row-major (index = row * 6 + column). */
export function rollGrid(rng: RNG, dice: GridDice): number[] {
  const rollOne = dice === '3d6' ? roll3d6 : rollAbilityScore;
  return Array.from({ length: GRID_SIZE * GRID_SIZE }, () => rollOne(rng));
}

/** A selectable line of the grid: a row, column or one of the two diagonals. */
export interface GridLine {
  id: string;
  label: string;
  /** Row-major cell indices (0..35), six of them, in line order. */
  cells: number[];
}

/**
 * All selectable lines of a 6x6 grid: 6 rows, 6 columns and the 2 diagonals
 * (14 lines, each of 6 cells).
 */
export function gridLines(): GridLine[] {
  const n = GRID_SIZE;
  const range = [...Array(n).keys()];
  const lines: GridLine[] = [];
  for (const r of range) lines.push({ id: `row-${r + 1}`, label: `Row ${r + 1}`, cells: range.map((c) => r * n + c) });
  for (const c of range) lines.push({ id: `col-${c + 1}`, label: `Column ${c + 1}`, cells: range.map((r) => r * n + c) });
  lines.push({ id: 'diag-down', label: 'Diagonal (top-left to bottom-right)', cells: range.map((i) => i * n + i) });
  lines.push({ id: 'diag-up', label: 'Diagonal (top-right to bottom-left)', cells: range.map((i) => i * n + (n - 1 - i)) });
  return lines;
}

/** The six scores on one line of the grid, or null for an unknown line id. */
export function gridLineScores(grid: number[], lineId: string): number[] | null {
  const line = gridLines().find((l) => l.id === lineId);
  return line ? line.cells.map((i) => grid[i]) : null;
}

/** Result of the 70+ method: the accepted set and how many sets were rolled. */
export interface MinTotalResult {
  scores: number[];
  attempts: number;
}

/**
 * 70+ Minimum Total: roll standard 4d6-drop-lowest for six scores and reroll
 * the entire array while the sum of all six is under 70.
 */
export function rollMinTotalSet(rng: RNG, minTotal: number = MIN_TOTAL_70): MinTotalResult {
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const scores = rollAbilityScoreSet(rng);
    if (scores.reduce((s, n) => s + n, 0) >= minTotal) return { scores, attempts };
  }
}

/** Result of the twelve-times method: every roll made and the six kept. */
export interface TwelveKeepSixResult {
  /** All twelve 3d6 totals in roll order. */
  rolls: number[];
  /** The six highest, highest first. */
  kept: number[];
}

/** 3d6 Twelve Times, Keep Six: roll 3d6 twelve times and keep the six highest. */
export function rollTwelveKeepSix(rng: RNG): TwelveKeepSixResult {
  const rolls = Array.from({ length: TWELVE_ROLLS }, () => roll3d6(rng));
  const kept = [...rolls].sort((a, b) => b - a).slice(0, TWELVE_KEEP);
  return { rolls, kept };
}
