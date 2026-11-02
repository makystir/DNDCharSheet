/**
 * Armor Class rules (D&D 5.5e / 2024).
 *
 * PHB 2024 "Armor Class": the unarmored base AC is 10 + the Dexterity
 * modifier. PHB 2024 "Only One Base AC": a creature uses exactly one base AC
 * calculation at a time — so the engine never sums two base calculations.
 *
 * Armor, shields, and feature-based AC are deferred to a later (equipment)
 * stage; only the unarmored base formula and a manual override exist now.
 *
 * The manual numeric override is NOT a PHB mechanic — the book's "different
 * way to calculate AC" refers to armor and class features (deferred). The
 * override is a non-RAW app affordance (a sheet convenience) and is labelled
 * as such; it supersedes the computed base so "Only One Base AC" still holds.
 *
 * Functions are pure and return a Breakdown (calculated-totals steering).
 */

import type { AbilityScores } from '../types/character';
import { abilityModifier } from './abilities';
import type { Breakdown } from './breakdown';

/** Unarmored base AC: 10 + Dexterity modifier (PHB 2024 "Armor Class"). */
export function baseArmorClass(dexMod: number): number {
  return 10 + dexMod;
}

/**
 * The Armor Class with a breakdown for a tooltip.
 *
 * When `acOverride` is a finite number it supersedes the computed base: the
 * breakdown has a single additive component (summing to the total) and the
 * superseded computed base is carried in the non-additive `note`, so
 * formatBreakdown never renders a self-contradictory "15 + 12 = 15".
 * Otherwise the base formula applies: 10 + Dex mod.
 */
export function armorClassBreakdown(
  scores: AbilityScores,
  acOverride?: number,
): Breakdown {
  const dexMod = abilityModifier(scores.dex);
  const base = baseArmorClass(dexMod);

  if (acOverride !== undefined && Number.isFinite(acOverride)) {
    return {
      total: acOverride,
      components: [{ label: 'Manual override', value: acOverride }],
      note: `Computed base 10 + Dex mod = ${base} (superseded by manual override)`,
    };
  }

  return {
    total: base,
    components: [
      { label: 'Base', value: 10 },
      { label: 'Dex mod', value: dexMod },
    ],
  };
}
