/**
 * Hit Point maximum (D&D 5.5e / 2024).
 *
 * RAW HP COMPUTATION (now that a class — and therefore a Hit Die — exists):
 *
 * - Level 1 HP = the class Hit Die's maximum value + Con modifier. PHB 2024
 *   "Level 1 Hit Points by Class" (Docs/PlayersHandbook.md line ~1922) lists
 *   12 / 10 / 8 / 6, which are exactly the maxima of d12 / d10 / d8 / d6.
 * - Each level after 1 adds the "fixed value" for the class + Con modifier.
 *   PHB 2024 "Fixed Hit Points by Class" (line ~2016) lists 7 / 6 / 5 / 4,
 *   which equal (Hit Die / 2) + 1 for d12 / d10 / d8 / d6.
 * - Minimum-of-1 floor. PHB 2024 "Gaining a Level → Adjust Hit Points"
 *   (line ~2014): roll (or take the fixed value), add your Con modifier, and
 *   add the total (minimum of 1) to your HP maximum. The floor applies to the
 *   WHOLE per-level gain, so a large negative Con modifier can never drop a
 *   level's contribution below 1.
 * - Con-mod rider. PHB 2024 "Adjust Ability Modifiers" (line ~2026): a Con
 *   modifier increase raises HP max by 1 per level attained, i.e. the
 *   Constitution contribution to HP max is exactly `Con mod × level`.
 * - Dwarven Toughness. PHB 2024 "Dwarf Traits: Dwarven Toughness": +1 HP max
 *   and +1 again whenever you gain a level = `hpPerLevel × level`, added on
 *   top of the floored per-level gains.
 *
 * ROLLED-HP VARIANT (opt-in house rule): PHB 2024 "Gaining a Level" allows
 * rolling the Hit Die instead of taking the fixed value. When the rolledHp
 * house rule is on and a rolled total for levels 2–L is supplied, that total
 * replaces the fixed levels-2–L contribution. Level 1 stays at the Hit Die's
 * maximum (RAW: you always start with the full Hit Die at level 1).
 *
 * MANUAL OVERRIDE (non-RAW sheet convenience): a finite `hpMax` supersedes the
 * computed total unconditionally, mirroring armor-class.ts — a single "Manual
 * override" component with the active-mode computed value carried in `note`.
 *
 * NO-CLASS FALLBACK: without a class there is no RAW HP formula (there is no
 * Hit Die), so the Stage-3 behaviour is preserved byte-for-byte: decompose an
 * entered `hpMax` into the Con rider + a derived Hit-Dice residual (+ Dwarven
 * Toughness), or show "HP max — not set" when unset.
 *
 * Pure function returning a Breakdown (calculated-totals steering).
 */

import type { AbilityScores } from '../types/character';
import type { HitDie } from '../data/classes';
import { abilityModifier } from './abilities';
import type { Breakdown, BreakdownComponent } from './breakdown';

/** Options for {@link hitPointMaxBreakdown}. */
export interface HitPointOptions {
  /** The six ability scores (only Con is read). */
  scores: AbilityScores;
  /** Character level (1–20). */
  level: number;
  /**
   * The class Hit Die size, or undefined when no class is selected. Present =
   * RAW computation; absent = Stage-3 no-class fallback.
   */
  hitDie?: HitDie;
  /** Manual HP-max override (finite = supersedes the computed total). */
  hpMax?: number;
  /** Species HP-per-level rider (Dwarven Toughness); 0/undefined = none. */
  hpPerLevel?: number;
  /** When true, use the rolled-HP variant for levels 2–L (opt-in house rule). */
  rolledHp?: boolean;
  /** The rolled HP total for levels 2–L (used only when rolledHp is true). */
  rolledHpTotal?: number;
}

/**
 * Builds the no-class fallback breakdown — byte-identical to the Stage-3
 * behaviour: an entered `hpMax` is decomposed into the Con rider and a derived
 * Hit-Dice residual (+ Dwarven Toughness when present); an unset `hpMax` yields
 * a single "HP max — not set" component.
 */
function noClassBreakdown(
  scores: AbilityScores,
  level: number,
  hpMax: number | undefined,
  hpPerLevel: number | undefined,
): Breakdown {
  if (hpMax === undefined || !Number.isFinite(hpMax)) {
    return {
      total: 0,
      components: [{ label: 'HP max — not set', value: 0 }],
    };
  }

  const conContribution = abilityModifier(scores.con) * level;
  // PHB 2024 "Dwarf Traits: Dwarven Toughness": +1 HP max per level.
  const toughness =
    hpPerLevel !== undefined && Number.isFinite(hpPerLevel)
      ? hpPerLevel * level
      : 0;

  const components: BreakdownComponent[] = [
    {
      label: 'HP from Hit Dice (derived)',
      value: hpMax - conContribution - toughness,
    },
    { label: 'Con mod × level', value: conContribution },
  ];
  if (toughness !== 0) {
    components.push({ label: 'Dwarven Toughness', value: toughness });
  }

  return { total: hpMax, components };
}

/**
 * The Hit Point maximum with a breakdown for a tooltip.
 *
 * Component order is pinned so the tooltip reads top-to-bottom like the RAW
 * calculation:
 *   1. 'Level 1 (max d<N>)'                    — the Hit Die maximum.
 *   2. 'Levels 2-L (fixed <f>×<L-1>)'          — fixed per-level value, omitted
 *      at level 1. Replaced by 'Rolled HP (levels 2-L)' in rolled mode.
 *   3. 'Con mod × level'                        — the Con rider.
 *   4. 'Minimum-HP floor (PHB)'                 — the non-negative difference
 *      between the floored and naive sums, omitted when 0.
 *   5. 'Dwarven Toughness'                      — hpPerLevel × level, omitted
 *      when 0.
 * Components always sum to the total (calculated-totals steering).
 */
export function hitPointMaxBreakdown(options: HitPointOptions): Breakdown {
  const { scores, level, hitDie, hpMax, hpPerLevel, rolledHp, rolledHpTotal } =
    options;

  // No class → no Hit Die → no RAW formula: preserve the Stage-3 behaviour.
  if (hitDie === undefined) {
    return noClassBreakdown(scores, level, hpMax, hpPerLevel);
  }

  const conMod = abilityModifier(scores.con);
  // PHB 2024 "Level 1 Hit Points by Class" (line ~1922): L1 HP = max Hit Die
  // value + Con mod; 12/10/8/6 are exactly max(d12/d10/d8/d6).
  const maxHitDie = hitDie;
  // PHB 2024 "Fixed Hit Points by Class" (line ~2016): 7/6/5/4 = (die/2)+1.
  const fixedPerLevel = hitDie / 2 + 1;
  const laterLevels = Math.max(0, level - 1);

  // PHB 2024 "Gaining a Level → Adjust Hit Points" (line ~2014): add the total
  // (minimum of 1) to HP max — the floor applies to the whole per-level gain.
  // Level 1 is the full Hit Die gain; later levels are the fixed (or rolled)
  // gain, each floored to a minimum of 1.
  const flooredLevel1 = Math.max(1, maxHitDie + conMod);

  const useRolled =
    rolledHp === true &&
    rolledHpTotal !== undefined &&
    Number.isFinite(rolledHpTotal);

  // The naive (un-floored) levels-2–L contribution, Con rider included, is what
  // the pinned components below add up to BEFORE the floor correction.
  const naiveLaterLevels = fixedPerLevel * laterLevels + conMod * laterLevels;
  // The floored levels-2–L contribution: each later level's (fixed + Con) gain
  // taken at a minimum of 1.
  const flooredLaterLevelsFixed =
    Math.max(1, fixedPerLevel + conMod) * laterLevels;

  // PHB 2024 "Dwarf Traits: Dwarven Toughness": +1 HP max per level.
  const toughness =
    hpPerLevel !== undefined && Number.isFinite(hpPerLevel)
      ? hpPerLevel * level
      : 0;

  const components: BreakdownComponent[] = [
    { label: `Level 1 (max d${hitDie})`, value: maxHitDie },
  ];
  if (laterLevels > 0) {
    if (useRolled) {
      components.push({
        label: 'Rolled HP (levels 2-L)',
        value: rolledHpTotal as number,
      });
    } else {
      components.push({
        label: `Levels 2-L (fixed ${fixedPerLevel}×${laterLevels})`,
        value: fixedPerLevel * laterLevels,
      });
    }
  }
  // Con rider across all levels (PHB 2024 "Adjust Ability Modifiers" line ~2026).
  components.push({ label: 'Con mod × level', value: conMod * level });

  // The minimum-HP floor component is the non-negative difference between the
  // floored sum and the naive sum. In rolled mode the later-levels value is the
  // player's rolled total (no fixed floor applies to it), so only the level-1
  // floor can fire; the Con rider is already counted in the naive sum above.
  // Only the level-1 gain is floored in rolled mode (the rolled total is taken
  // as the player entered it); the fixed mode floors every later level too.
  const floorCorrection = useRolled
    ? flooredLevel1 - (maxHitDie + conMod)
    : flooredLevel1 +
      flooredLaterLevelsFixed -
      (maxHitDie + conMod + naiveLaterLevels);
  // The correction is always ≥ 0 (flooring can only raise a gain).
  if (floorCorrection !== 0) {
    components.push({ label: 'Minimum-HP floor (PHB)', value: floorCorrection });
  }

  if (toughness !== 0) {
    components.push({ label: 'Dwarven Toughness', value: toughness });
  }

  const computedTotal = components.reduce((s, c) => s + c.value, 0);

  // Manual override wins unconditionally (mirror armor-class.ts): replace the
  // components with a single "Manual override" and carry the active-mode
  // computed value in `note`.
  if (hpMax !== undefined && Number.isFinite(hpMax)) {
    return {
      total: hpMax,
      components: [{ label: 'Manual override', value: hpMax }],
      note: `Computed ${describeComputation(
        hitDie,
        level,
        useRolled,
      )} = ${computedTotal} (superseded by manual override)`,
    };
  }

  return { total: computedTotal, components };
}

/** A short description of the active computation mode for the override note. */
function describeComputation(
  hitDie: HitDie,
  level: number,
  useRolled: boolean,
): string {
  const mode = useRolled ? 'rolled levels 2-L' : 'fixed levels 2-L';
  return `L${level} HP (d${hitDie}, ${mode})`;
}
