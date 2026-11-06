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
 * Unarmored Defense class variants are wired here (A5e, blueprint decision 7.4
 * / D9). While NO armour is worn and the class grants Unarmored Defense, the
 * base AC is 10 + Dex mod + the governing ability modifier:
 *   - Barbarian (PHB 2024, L2446): 10 + Dex + Con; a Shield's +2 still applies.
 *   - Monk (PHB 2024, L4534): 10 + Dex + Wis, only while NOT wielding a Shield —
 *     a Shield disables it, falling back to the plain 10 + Dex (+ the Shield +2).
 * Draconic Sorcerer (Cha) is a SUBCLASS feature and is OUT of A5e scope (no
 * subclass AC wiring yet). "Only One Base AC" (L2106-2110) holds: a single
 * class grants at most one Unarmored Defense, and because Unarmored Defense
 * requires not wearing armour, it and a worn-armour base are never both
 * available — when a suit is worn, Unarmored Defense simply does not apply (even
 * if it would be higher). For a MULTICLASS character that has two base-AC
 * features (only Barbarian Con-UD + Monk Wis-UD is possible with the shipped
 * base classes), `unarmoredDefenseFor(character)` auto-picks the higher-AC one
 * (decision 9-D) and records the superseded source so the breakdown stays
 * explainable. `unarmoredDefenseFor(character)` reads all the character's
 * classes.
 *
 * Functions are pure and return a Breakdown (calculated-totals steering): every
 * component — including zeros — is listed, and non-additive facts (a Dex cap, a
 * heavy-armor Dex of 0, a superseded override) go in the `note` so the number
 * is always explainable (calculated-totals rules 4 and 7).
 */

import type { AbilityScores, Ability, Character } from '../types/character';
import { ABILITY_NAMES } from '../types/character';
import type { ArmorData } from '../data/armor';
import { getArmor } from '../data/armor';
import { abilityModifier } from './abilities';
import type { Breakdown } from './breakdown';
import { resolveClasses } from './classes';
import { effectiveAbilityScores } from './feats';

/** Unarmored base AC: 10 + Dexterity modifier (PHB 2024 "Armor Class"). */
export function baseArmorClass(dexMod: number): number {
  return 10 + dexMod;
}

/**
 * A class-granted Unarmored Defense feature (A5e / D9). The base AC it sets is
 * 10 + Dex mod + the modifier of `ability`.
 */
export interface UnarmoredDefense {
  /** The governing ability: 'con' (Barbarian) or 'wis' (Monk). */
  ability: Extract<Ability, 'con' | 'wis'>;
  /** Whether a Shield may be wielded while keeping the benefit. */
  shieldAllowed: boolean;
  /** Feature name used to label the breakdown component. */
  sourceLabel: string;
  /**
   * When a multiclass character has TWO base-AC features (only Barbarian Con +
   * Monk Wis is possible with the shipped base classes), the higher-AC one is
   * auto-picked (PHB 2024 "Only One Base AC", L2106-2110) and this names the
   * SUPERSEDED feature so the AC breakdown can state what was set aside. Absent
   * for a single Unarmored Defense (the common case). */
  supersededLabel?: string;
}

/**
 * Which 2024 classes grant an Unarmored Defense that A5e wires, and its
 * governing ability + Shield rule.
 *   - Barbarian (PHB 2024 L2446): 10 + Dex + Con; "You can use a Shield and
 *     still gain this benefit" → shieldAllowed true.
 *   - Monk (PHB 2024 L4534): 10 + Dex + Wis, only "While you aren't wearing
 *     armor or wielding a Shield" → shieldAllowed false.
 * Draconic Sorcerer (Cha) is a SUBCLASS feature and is OUT of A5e scope.
 */
const UNARMORED_DEFENSE_BY_CLASS: Record<string, UnarmoredDefense> = {
  barbarian: { ability: 'con', shieldAllowed: true, sourceLabel: 'Barbarian Unarmored Defense' },
  monk: { ability: 'wis', shieldAllowed: false, sourceLabel: 'Monk Unarmored Defense' },
};

/**
 * Resolves the character's class-granted Unarmored Defense, or undefined when
 * no class grants one (A5e / D9). Barbarian and Monk both grant it at level 1
 * (PHB 2024 Barbarian/Monk level-1 "Unarmored Defense"), so no level gate is
 * needed. Tolerates an unset/unknown class.
 *
 * PHB 2024 "Only One Base AC" (L2106-2110): a multiclass character with TWO
 * base-AC features (only Barbarian Con-UD + Monk Wis-UD is possible with the
 * shipped base classes) uses only ONE. This auto-picks the one that yields the
 * higher AC (decision 9-D) — since both compute 10 + Dex + an ability mod, the
 * winner is simply the class whose governing ability modifier is higher (ties
 * keep the first in class order) — and records the superseded feature in
 * `supersededLabel` for the breakdown. A single-class character (or a
 * multiclass with only one base-AC feature) is unaffected: exactly that one
 * Unarmored Defense, with no `supersededLabel`.
 */
export function unarmoredDefenseFor(character: Character): UnarmoredDefense | undefined {
  const options: UnarmoredDefense[] = [];
  for (const { data } of resolveClasses(character)) {
    const ud = UNARMORED_DEFENSE_BY_CLASS[data.id];
    // A class can appear only once per character, so no de-dup is needed; guard
    // against listing the same feature twice defensively all the same.
    if (ud && !options.some((o) => o.sourceLabel === ud.sourceLabel)) options.push(ud);
  }
  if (options.length === 0) return undefined;
  if (options.length === 1) return options[0];

  // Two base-AC features: pick the higher resulting AC by the governing ability
  // modifier (PHB "Only One Base AC"). Ties keep the first in class order.
  const scores = effectiveAbilityScores(character);
  let chosen = options[0];
  for (let i = 1; i < options.length; i += 1) {
    if (abilityModifier(scores[options[i].ability]) > abilityModifier(scores[chosen.ability])) {
      chosen = options[i];
    }
  }
  const superseded = options.find((o) => o.sourceLabel !== chosen.sourceLabel);
  return { ...chosen, supersededLabel: superseded?.sourceLabel };
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

/** Options for the AC computation (equipped armor/shield + Unarmored Defense). */
export interface ArmorClassOptions {
  /** The resolved worn armor (ArmorData), or undefined when unarmored. */
  armor?: ArmorData;
  /** The resolved wielded shield (ArmorData, category 'shield'), or undefined. */
  shield?: ArmorData;
  /**
   * The character's class-granted Unarmored Defense (A5e / D9), resolved by
   * `unarmoredDefenseFor(character)`. When present AND no armour is worn, it
   * sets the base AC to 10 + Dex mod + the governing ability modifier.
   * - `ability`: the governing ability ('con' Barbarian, 'wis' Monk).
   * - `shieldAllowed`: whether a Shield can be wielded while keeping the
   *   benefit (Barbarian true, Monk false). When false and a Shield is wielded,
   *   Unarmored Defense is unavailable and the plain 10 + Dex base is used.
   * - `sourceLabel`: the feature name for the breakdown component label.
   * Absent = the class grants no Unarmored Defense (plain 10 + Dex base).
   */
  unarmoredDefense?: UnarmoredDefense;
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
    // The superseded value reflects whichever base would apply: worn armour,
    // an active Unarmored Defense (A5e), else plain 10 + Dex.
    const ud = options.unarmoredDefense;
    const udActiveForNote =
      !armor && ud !== undefined && (ud.shieldAllowed || shield === undefined);
    const computed = armor
      ? armor.baseAc + appliedDexForArmor(armor, dexMod) + shieldBonus
      : udActiveForNote && ud !== undefined
        ? baseArmorClass(dexMod) + abilityModifier(scores[ud.ability]) + shieldBonus
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

  // 3. Unarmored. Unarmored Defense (Barbarian Con / Monk Wis) applies here —
  // it is a base AC available only while NOT wearing armour (PHB 2024
  // Barbarian/Monk "Unarmored Defense"), which is exactly this branch. Monk
  // loses it while wielding a Shield; Barbarian keeps it with a Shield.
  const ud = options.unarmoredDefense;
  const notes: string[] = [];
  if (options.wornArmorIgnoredName !== undefined) {
    notes.push(
      `${options.wornArmorIgnoredName} is worn but has no catalog stats, so it does not change AC (no armour value is invented); the character is treated as unarmored.`,
    );
  }

  // Monk Unarmored Defense is unavailable while a Shield is wielded; fall back
  // to the plain 10 + Dex base (the Shield's +2 still applies on top).
  const udActive = ud !== undefined && (ud.shieldAllowed || shield === undefined);
  if (ud !== undefined && !udActive) {
    notes.push(
      `${ud.sourceLabel} is unavailable while wielding a Shield; the base AC is 10 + Dex mod.`,
    );
  }

  if (udActive && ud !== undefined) {
    const udMod = abilityModifier(scores[ud.ability]);
    const abilityLabel = ABILITY_NAMES[ud.ability];
    const total = baseArmorClass(dexMod) + udMod + shieldBonus;
    // PHB 2024 "Only One Base AC": name the superseded base-AC feature when a
    // multiclass character had two and this one was auto-picked as higher.
    if (ud.supersededLabel !== undefined) {
      notes.push(
        `${ud.sourceLabel} gives the higher AC and is used; ${ud.supersededLabel} is set aside (PHB "Only One Base AC").`,
      );
    }
    return {
      total,
      components: [
        { label: `Base (${ud.sourceLabel})`, value: 10 },
        { label: 'Dex mod', value: dexMod },
        { label: `${abilityLabel} mod`, value: udMod },
        { label: 'Shield', value: shieldBonus },
        { label: 'Other', value: 0 },
      ],
      note: notes.length > 0 ? notes.join('; ') : undefined,
    };
  }

  // Plain unarmored: 10 + Dex (+ shield if any).
  const total = baseArmorClass(dexMod) + shieldBonus;
  return {
    total,
    components: [
      { label: 'Base', value: 10 },
      { label: 'Dex mod', value: dexMod },
      { label: 'Shield', value: shieldBonus },
      { label: 'Other', value: 0 },
    ],
    note: notes.length > 0 ? notes.join('; ') : undefined,
  };
}

/**
 * The character's Armor Class breakdown, assembled from the character's own
 * state: effective ability scores (base + feat increases), the manual override,
 * the equipped armour/shield resolved through the inventory and armour catalog,
 * and the class-derived Unarmored Defense. This is the single assembly shared by
 * the Combat page, the Defenses panel, the Overview and the print sheet so every
 * surface shows the same number. A worn item with no catalog stats is named in
 * the note (it never invents an armour value).
 */
export function characterArmorClassBreakdown(character: Character): Breakdown {
  const inventory = character.inventory ?? [];
  const equipped = character.equipped;
  const resolveWorn = (id: string | undefined) => {
    if (!id) return undefined;
    const item = inventory.find((i) => i.id === id);
    return item?.catalogId ? getArmor(item.catalogId) : undefined;
  };
  const armor = resolveWorn(equipped?.armorItemId);
  const shield = resolveWorn(equipped?.shieldItemId);
  const wornArmorItem = equipped?.armorItemId
    ? inventory.find((i) => i.id === equipped.armorItemId)
    : undefined;
  const wornArmorIgnoredName =
    wornArmorItem && armor === undefined ? (wornArmorItem.name ?? 'Custom armor') : undefined;
  return armorClassBreakdown(effectiveAbilityScores(character), character.acOverride, {
    armor,
    shield,
    wornArmorIgnoredName,
    unarmoredDefense: unarmoredDefenseFor(character),
  });
}