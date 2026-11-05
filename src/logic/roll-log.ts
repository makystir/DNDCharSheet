/**
 * Roll-log layer (Stage B7).
 *
 * Turns an ALREADY-RESOLVED d20 roll into a concise human-readable summary and
 * a structured event payload. The d20 RESOLUTION math (Advantage keeps higher,
 * Disadvantage keeps lower, the natural kept die, modifiers, Exhaustion) lives
 * in dice.ts (Stage A5) and is NOT re-derived here — this module only shapes the
 * resolved result into the log surface.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md):
 *  - "D20 Tests" step 3 (L364): a D20 Test succeeds when the total of the d20
 *    and its modifiers EQUALS OR EXCEEDS the target number (the DC for a check/
 *    save, the AC for an attack). So `passed = total >= dc`.
 *  - "Rolling 20 or 1" (L457-461) / "D20 Tests": a natural 20 is a Critical Hit
 *    and a natural 1 on an attack always misses — both judged on the RAW KEPT
 *    DIE (`natural`), never on the total.
 */
import type { D20Mode } from './dice';
import type { RollEventPayload } from '../types/character';

/** A resolved d20 roll handed to the roll-log layer. */
export interface ResolvedRoll {
  /** What was rolled, e.g. 'Stealth' or 'Longsword attack'. */
  label: string;
  /** The raw kept d20 face; nat-20/nat-1 are judged on this. */
  natural: number;
  /** The total (die + modifiers + exhaustion). */
  total: number;
  /** How the d20 was rolled. */
  mode: D20Mode;
  /** Optional DC (ability/save) or target AC (attack). */
  dc?: number;
}

/** The computed roll-summary shape (pinned by the B7 golden ROLL_SUMMARY_CASES). */
export interface RollSummary {
  total: number;
  natural: number;
  /** natural === 20. */
  isCrit: boolean;
  /** natural === 1. */
  isFumble: boolean;
  /** total >= dc when a dc is given; undefined for a flat roll. */
  passed: boolean | undefined;
  /** The exact one-line summary string. */
  summary: string;
}

/** Suffix for the roll mode: ' (adv)' / ' (dis)' / '' for normal. */
function modeSuffix(mode: D20Mode): string {
  if (mode === 'advantage') return ' (adv)';
  if (mode === 'disadvantage') return ' (dis)';
  return '';
}

/**
 * Compute the roll summary + flags for a resolved d20 roll.
 *
 * `passed` is `total >= dc` when a DC is given and `undefined` otherwise — a
 * flat roll has nothing to beat (PHB 2024 "D20 Tests": equals-or-exceeds). Crit/
 * fumble are flagged on the kept die. The summary string is:
 *   `<label>: <total>[ (adv)|(dis)][ vs DC N — hit|miss][ — crit!|— fumble!]`
 * (the em dash is U+2014; crit/fumble comes AFTER the DC clause).
 */
export function rollSummary(input: ResolvedRoll): RollSummary {
  const { label, natural, total, mode, dc } = input;
  const isCrit = natural === 20;
  const isFumble = natural === 1;
  const passed = dc === undefined ? undefined : total >= dc;

  let summary = `${label}: ${total}${modeSuffix(mode)}`;
  if (dc !== undefined) {
    summary += ` vs DC ${dc} — ${passed ? 'hit' : 'miss'}`;
  }
  if (isCrit) {
    summary += ' — crit!';
  } else if (isFumble) {
    summary += ' — fumble!';
  }

  return { total, natural, isCrit, isFumble, passed, summary };
}

/**
 * Build the structured `RollEventPayload` from the same resolved roll. Shares
 * the crit/fumble/passed derivation with {@link rollSummary} so the log entry
 * and the summary can never disagree.
 */
export function toRollPayload(input: ResolvedRoll): RollEventPayload {
  const { label, natural, total, mode, dc } = input;
  const payload: RollEventPayload = {
    name: label,
    total,
    natural,
    mode,
    isCrit: natural === 20,
    isFumble: natural === 1,
  };
  if (dc !== undefined) {
    payload.dc = dc;
    payload.passed = total >= dc;
  }
  return payload;
}
