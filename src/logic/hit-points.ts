/**
 * Hit Point maximum (D&D 5.5e / 2024).
 *
 * IMPORTANT: full class-hit-die HP computation is DEFERRED to the class stage.
 * There is no RAW HP-maximum formula without a class (HP max at level 1 is the
 * class Hit Die value + Con modifier — PHB 2024 "Hit Points"), so Stage 2 does
 * NOT invent one: `hpMax` is an explicit, user-editable value.
 *
 * The one class-independent RAW piece is PHB 2024 "Leveling Up → Adjust
 * Ability Modifiers" (Docs/PlayersHandbook.md line ~2026): when the
 * Constitution modifier increases by 1, the Hit Point maximum increases by 1
 * for each level attained. So at any snapshot the Constitution contribution to
 * HP max is exactly `Con mod × level`, which the breakdown surfaces.
 *
 * Pure function returning a Breakdown (calculated-totals steering).
 */

import type { AbilityScores } from '../types/character';
import { abilityModifier } from './abilities';
import type { Breakdown } from './breakdown';

/**
 * The Hit Point maximum with a breakdown for a tooltip.
 *
 * When `hpMax` is a finite number it is the source of truth for the displayed
 * max. The breakdown decomposes it into the Con-driven part (`Con mod × level`,
 * RAW) and the remainder that comes from the not-yet-modelled class Hit Dice.
 * The residual is labelled "HP from Hit Dice (derived)" to make clear it is
 * computed (entered max − Con contribution), not a value the user typed, so a
 * negative Con modifier (residual larger than the entered value) is never
 * mislabelled as user input. The two components sum to `hpMax`.
 *
 * When `hpMax` is undefined the breakdown is total 0 with a single
 * "HP max — not set" component — no misleading negative residual and no Con
 * component — and the UI renders its "enter HP max" placeholder.
 *
 * `hpPerLevel` is the optional species Hit-Point-per-level rider. The only
 * 2024 PHB species trait of this kind is Dwarven Toughness (PHB 2024 "Dwarf
 * Traits": "+1, and +1 again whenever you gain a level" = +1 × level), so when
 * it is set and `hpMax` is entered, a "Dwarven Toughness" component of
 * `hpPerLevel × level` is appended and the Hit-Dice residual is recomputed so
 * all three components still sum to `hpMax` (the entered max stays the source
 * of truth; the breakdown just attributes more of it). When `hpPerLevel` is
 * absent/0 the two-component output is unchanged, and the `hpMax === undefined`
 * branch is never affected by the species.
 */
export function hitPointMaxBreakdown(
  scores: AbilityScores,
  level: number,
  hpMax?: number,
  hpPerLevel?: number,
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

  const components = [
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
