/**
 * Armor Class rules (D&D 5.5e / 2024).
 *
 * PHB 2024 "Armor Class": the unarmored base AC is 10 + the Dexterity
 * modifier. PHB 2024 "Only One Base AC" (Docs/PlayersHandbook.md L2106-2110):
 * a creature uses exactly one base AC calculation at a time — so the engine
 * never sums two base calculations.
 *
 * PHB 2024 "Armor" (Docs/PlayersHandbook.md L9589-9646): worn armor sets a base
 * AC; Light armor adds the full Dexterity modifier, Medium armor adds Dex
 * capped at +2, Heavy armor adds no Dex. A Shield adds a flat +2 on top. These
 * are resolved from the character's equipped armor/shield against the A1
 * ArmorData catalog.
 *
 * The manual numeric override is NOT a PHB mechanic — the book's "different
 * way to calculate AC" refers to armor and class features. The override is a
 * non-RAW app affordance (a sheet convenience) and is labelled as such; it
 * supersedes everything (computed base, armor, shield) so "Only One Base AC"
 * still holds.
 *
 * Unarmored Defense class variants (Barbarian Con, Monk Wis, Draconic Sorcerer
 * Cha — PHB 2024 L2446/L4534/L2993) are a SEPARATE class-features concern. This
 * function exposes an optional `unarmoredDefenseAbility` HOOK param (blueprint
 * decision 7.2) so the class-features stage can wire it later; it is accepted
 * but DEFERRED (unused) here — passing it does not yet change the result.
 *
 * Functions are pure and return a Breakdown (calculated-totals steering): every
 * component — including zeros — is listed, and non-additive facts (a Dex cap, a
 * heavy-armor Dex of 0, a superseded override) go in the `note` so the number
 * is always explainable (calculated-totals rules 4 and 7).
 */

import type { AbilityScores, Ability } from '../types/character';
import type { ArmorData } from '../data/armor';
import { abilityModifier } from './abilities';
import type { Breakdown } from './breakdown';

/** Unarmored base AC: 10 + Dexterity modifier (PHB 2024 "Armor Class"). */
export function baseArmorClass(dexMod: number): number {
  return 10 + dexMod;
}

/**
 * The applied Dexterity contribution to AC for a piece of worn armor.
 * PHB 2024 "Armor" (L9611-9646): Light adds full Dex, Medium adds Dex capped at
 * the armor's dexCap (+2), Heavy adds none. Returns the APPLIED value (after any
 * cap); the caller surfaces the cap in the breakdown note.
 */
function appliedDexForArmor(armor: ArmorData, dexMod: number): number {
  if (!armor.addsDex) return 0; // Heavy armor: no Dex (PHB 2024 "Armor").
  if (armor.dexCap !== undefined) return Math.min(dexMod, armor.dexCap); // Medium: cap.
  return dexMod; // Light: full Dex.
}

/** Options for the AC computation (equipped armor/shield + the deferred hook). */
export interface ArmorClassOptions {
  /** The resolved worn armor (ArmorData), or undefined when unarmored. */
  armor?: ArmorData;
  /** The resolved wielded shield (ArmorData, category 'shield'), or undefined. */
  shield?: ArmorData;
  /**
   * DEFERRED hook (blueprint decision 7.2): the governing ability for an
   * Unarmored Defense class feature (Barbarian Con / Monk Wis / Draconic Cha).
   * Accepted so the class-features stage can wire it without changing this
   * signature; it is NOT acted on yet (documented, unused).
   */
  unarmoredDefenseAbility?: Ability;
  /**
   * The display name of a worn armour item that has NO catalog stats (a custom,
   * catalog-less suit). Such an item cannot set a base AC — the app does not
   * invent armour values (rules-compliance rule 1) — so the character is treated
   * as unarmored. This name is surfaced in the breakdown `note` to reconcile the
   * ticked "Worn" box with the unchanged AC (finding #3). It does NOT change the
   * total or components, only the explanatory note.
   */
  wornArmorIgnoredName?: string;
}

/**
 * The Armor Class with a breakdown for a tooltip.
 *
 * Resolution order (PHB 2024):
 *  1. A finite `acOverride` supersedes everything (single additive component;
 *     the superseded computed value in `note`) — honours "Only One Base AC".
 *  2. Worn armor sets the base AC; Dex is added per the armor category
 *     (Light full / Medium capped at +2 / Heavy none), plus +2 for a Shield.
 *  3. Unarmored (no armor) = 10 + Dex mod, plus +2 for a Shield if wielded.
 *
 * The breakdown always lists every component, including zeros (calculated-totals
 * rule 4: Shield 0 when none, Other 0 always). A Dex cap, a heavy-armor Dex of
 * 0, or a superseded override are stated in `note` (rule 7: make
 * stacking/superseding legible).
 */
// PHB 2024 "Armor" (L9589-9646) + "Armor Class" / "Only One Base AC" (L2106-2110).
export function armorClassBreakdown(
  scores: AbilityScores,
  acOverride?: number,
  options: ArmorClassOptions = {},
): Breakdown {
  const dexMod = abilityModifier(scores.dex);
  const { armor, shield } = options;
  // The shield bonus is only added when a Shield is actually equipped (PHB
  // "One at a Time"); its stored baseAc is the +2 bonus.
  const shieldBonus = shield !== undefined ? shield.baseAc : 0;

  // 1. Manual override supersedes everything (non-RAW sheet affordance).
  if (acOverride !== undefined && Number.isFinite(acOverride)) {
    const computed = armor
      ? armor.baseAc + appliedDexForArmor(armor, dexMod) + shieldBonus
      : baseArmorClass(dexMod) + shieldBonus;
    return {
      total: acOverride,
      components: [{ label: 'Manual override', value: acOverride }],
      note: `Computed AC = ${computed} (superseded by manual override)`,
    };
  }

  // 2. Armored.
  if (armor) {
    const appliedDex = appliedDexForArmor(armor, dexMod);
    const total = armor.baseAc + appliedDex + shieldBonus;

    // Dex component label + note make any cap / heavy-armor-zeroing legible
    // (calculated-totals rule 7): show the APPLIED value, explain it in note.
    let dexLabel: string;
    const notes: string[] = [];
    if (!armor.addsDex) {
      dexLabel = 'Dex mod';
      notes.push(`${armor.name} is heavy armor — the Dexterity modifier does not apply to AC`);
    } else if (armor.dexCap !== undefined) {
      dexLabel = `Dex mod (max +${armor.dexCap})`;
      if (dexMod > armor.dexCap) {
        notes.push(`Dex +${dexMod} capped at +${armor.dexCap} by ${armor.name} (medium armor)`);
      }
    } else {
      dexLabel = 'Dex mod';
    }

    return {
      total,
      components: [
        { label: `Armor base (${armor.name})`, value: armor.baseAc },
        { label: dexLabel, value: appliedDex },
        { label: 'Shield', value: shieldBonus },
        { label: 'Other', value: 0 },
      ],
      note: notes.length > 0 ? notes.join('; ') : undefined,
    };
  }

  // 3. Unarmored: 10 + Dex (+ shield if any).
  const total = baseArmorClass(dexMod) + shieldBonus;
  // A worn catalog-less (custom) armour cannot set a base AC without inventing
  // values, so it is ignored and the character is unarmored; reconcile the
  // ticked "Worn" box with the unchanged AC via a note (finding #3). The total
  // and components are unchanged.
  const note =
    options.wornArmorIgnoredName !== undefined
      ? `${options.wornArmorIgnoredName} is worn but has no catalog stats, so it does not change AC (no armour value is invented); the character is treated as unarmored.`
      : undefined;
  return {
    total,
    components: [
      { label: 'Base', value: 10 },
      { label: 'Dex mod', value: dexMod },
      { label: 'Shield', value: shieldBonus },
      { label: 'Other', value: 0 },
    ],
    note,
  };
}
