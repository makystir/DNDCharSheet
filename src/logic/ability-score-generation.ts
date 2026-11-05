/**
 * Ability-score generation (D&D 5.5e / 2024), Stage A7 PART 1.
 *
 * The three PHB methods for generating the six ability scores plus the
 * point-buy cost/validity helpers (PHB 2024 "Step 3: Determine Ability Scores",
 * Docs/PlayersHandbook.md L1666-1726). Every function is PURE and the random
 * method takes an injected RNG (src/logic/random.ts) so a scripted sequence is
 * fully deterministic — no function here calls Math.random.
 *
 * RULES-COMPLIANCE: values transcribed from the PHB; no mechanic is invented.
 * The one OCR gap (the 9-cost cell is blank in Docs/PlayersHandbook.md) is
 * resolved from RAW — see pointBuyCost.
 */

import type { Ability } from '../types/character';
import { ABILITIES } from '../types/character';
import type { RNG } from './random';

/**
 * The Standard Array: six fixed scores, highest-first as printed.
 * PHB 2024 L1674: "Standard Array. Use the following six scores for your
 * abilities: 15, 14, 13, 12, 10, 8."
 */
export function standardArray(): number[] {
  return [15, 14, 13, 12, 10, 8];
}

/** The 27-point point-buy budget. PHB 2024 L1678: "You have 27 points…". */
export const POINT_BUY_BUDGET = 27;

/** The lowest / highest score purchasable with Point Cost. PHB 2024 L1680-1690. */
export const POINT_BUY_MIN_SCORE = 8;
export const POINT_BUY_MAX_SCORE = 15;

/**
 * The point-buy cost of a single score, or `null` when the score is NOT
 * purchasable with Point Cost (outside 8..15).
 *
 * PHB 2024 "Ability Score Point Costs" table (L1680-1690): 8->0, 10->2, 11->3,
 * 12->4, 13->5, 14->7, 15->9.
 */
// PHB 2024 L1683: the 9-cost cell is left BLANK by the OCR in
// Docs/PlayersHandbook.md; RAW = 1 (each 8->9->10->11 step costs 1, matching
// the printed 8->0 / 10->2 / 11->3). Resolved from RAW per rules-compliance.
const POINT_BUY_COST_TABLE: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

/**
 * Cost of a single score under Point Cost, or `null` if it is not purchasable
 * (below 8 or above 15). PHB 2024 "Ability Score Point Costs" (L1680-1690).
 */
export function pointBuyCost(score: number): number | null {
  if (!Object.hasOwn(POINT_BUY_COST_TABLE, score)) return null;
  return POINT_BUY_COST_TABLE[score];
}

/**
 * Total point-buy cost of a full allocation: the sum of each in-range score's
 * cost. Out-of-range scores (cost `null`) contribute 0 to the finite sum;
 * their presence makes the allocation invalid, which `isPointBuyValid` decides.
 * PHB 2024 L1678.
 */
export function pointBuyTotalCost(scores: Record<Ability, number>): number {
  let total = 0;
  for (const ability of ABILITIES) {
    const cost = pointBuyCost(scores[ability]);
    if (cost !== null) total += cost;
  }
  return total;
}

/**
 * Whether an allocation is a legal point-buy: EVERY score is in 8..15 AND the
 * total cost is within the 27-point budget. PHB 2024 L1678-1690.
 */
export function isPointBuyValid(scores: Record<Ability, number>): boolean {
  for (const ability of ABILITIES) {
    if (pointBuyCost(scores[ability]) === null) return false;
  }
  return pointBuyTotalCost(scores) <= POINT_BUY_BUDGET;
}

/** One d6 face (1..6) from the injected RNG. PHB 2024 "Random Generation" L1677. */
function d6(rng: RNG): number {
  return Math.floor(rng() * 6) + 1;
}

/**
 * Roll one ability score: roll four d6 and total the highest three (drop the
 * lowest). The RNG is consumed four times, in roll order, so a scripted
 * sequence is deterministic. PHB 2024 L1677: "Roll four d6 and record the total
 * of the highest three dice."
 */
export function rollAbilityScore(rng: RNG): number {
  const faces = [d6(rng), d6(rng), d6(rng), d6(rng)];
  faces.sort((a, b) => a - b); // ascending: index 0 is the dropped lowest
  return faces[1] + faces[2] + faces[3];
}

/**
 * Roll a full set of six ability scores (PHB 2024 L1677: "Do this five more
 * times, so you have six numbers."). Each call consumes 24 RNG draws in order.
 */
export function rollAbilityScoreSet(rng: RNG): number[] {
  return [0, 1, 2, 3, 4, 5].map(() => rollAbilityScore(rng));
}
