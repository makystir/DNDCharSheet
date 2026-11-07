/**
 * D&D 5.5e (2024) armor catalog — the PHB 2024 "Armor" table.
 *
 * A flat, typed data module mirroring src/data/weapons.ts: one exported record
 * keyed by armor id, plus the id/enum unions derived from the data so a
 * persisted InventoryItem.catalogId and the catalog cannot drift.
 *
 * SOURCING / RULES COMPLIANCE
 * ---------------------------
 * Every mechanical value (category, base AC, Dex contribution + cap, Strength
 * requirement, Stealth disadvantage, weight, cost) is transcribed from the PHB
 * 2024 "Armor" table (Docs/PlayersHandbook.md L9589-9646). NO armor is invented
 * (rules-compliance rule 1). Each entry carries a `// PHB 2024 …` citation.
 *
 * DEX / CATEGORY MODEL (PHB 2024 "Armor", L9611-9646):
 *   - Light  → base AC + full Dex modifier (addsDex: true, no dexCap).
 *   - Medium → base AC + Dex modifier, capped at +2 (addsDex: true, dexCap: 2).
 *   - Heavy  → base AC only, Dex does NOT apply (addsDex: false).
 *   - Shield → NOT a base AC; a flat +2 BONUS. Stored as baseAc = 2, category
 *     'shield', addsDex false. The AC logic (A3) adds it on top of the base AC;
 *     it is never a standalone base (PHB 2024: a Shield grants a +2 AC benefit,
 *     and "One at a Time" allows one suit + one Shield).
 *
 * STRENGTH REQUIREMENT: if the wearer's Strength is below the listed score, the
 * armor reduces Speed by 10 feet (PHB 2024 "Armor": Strength column). This is a
 * Speed penalty, NOT an AC change — it is carried here for a later Speed stage.
 *
 * OCR CORRECTIONS (verified against the PHB 2024 Armor table, L9589-9646):
 *   - weights: '816.' → 8 lb (Padded), '1216.' → 12 lb (Hide),
 *     '616.' → 6 lb (Shield). Others ('10 lb.', '13 lb.', '20 lb.', '45 lb.',
 *     '40 lb.', '55 lb.', '60 lb.', '65 lb.') were already clean.
 *   - Dex cap glyph: 'max 2' / 'modifie r (max 2)' → dexCap 2 (medium only).
 *   - Strength column: 'Str 13' (Chain Mail), 'Str 15' (Splint, Plate); light
 *     and medium rows list no Strength requirement.
 * Costs are already in GP in the Armor table, so no cp/sp conversion is needed.
 */

/** Armor proficiency/weight category. PHB 2024 "Armor": Light/Medium/Heavy + Shield. */
export type ArmorCategory = 'light' | 'medium' | 'heavy' | 'shield';

/** A single armor entry transcribed from the PHB 2024 Armor table. */
export interface ArmorData {
  /** Kebab-case catalog id, e.g. 'chain-shirt'. */
  id: string;
  /** Name as printed in the PHB. */
  name: string;
  /** Light / Medium / Heavy / Shield. */
  category: ArmorCategory;
  /** Base AC (11-18); for a Shield this is the +2 bonus, not a base. */
  baseAc: number;
  /** Whether the wearer's Dex modifier is added to AC (light & medium only). */
  addsDex: boolean;
  /** Dex cap when addsDex is true: 2 for medium; undefined = uncapped (light). */
  dexCap?: number;
  /** Minimum Strength to avoid the Speed -10 penalty; undefined = none. */
  strengthRequirement?: number;
  /** Disadvantage on Dexterity (Stealth) checks while worn. */
  stealthDisadvantage: boolean;
  /** Weight in pounds; 0 would be a genuine PHB value (none here). */
  weightLb: number;
  /** Cost in gold pieces (Armor table is already GP). */
  costGp: number;
  /**
   * Per-entry PHB 2024 citation (rules-compliance rule 7 / blueprint §2.2, §7.5):
   * the exact table + markdown line the row was transcribed from.
   */
  source: string;
}

/** The PHB 2024 Armor table citation shared by every armor row (L9589-9646). */
const ARMOR_TABLE_SOURCE = 'PHB 2024 "Armor" table (Docs/PlayersHandbook.md L9589-9646)';

/**
 * Armor-training restriction text, PHB-cited, for the content tooltip (review
 * finding #4). PHB 2024 "Armor Training" (L9615-9623):
 *   - Light/Medium/Heavy armor without training → Disadvantage on any D20 Test
 *     involving Strength or Dexterity, and you can't cast spells (L9619).
 *   - A Shield grants its AC benefit only if you have training with it (L9623).
 * These are universal prerequisites the tooltip must surface so a number is
 * never shown without the rule that gates it. Paraphrased, not verbatim (rule 5).
 */
export const ARMOR_TRAINING_TEXT =
  'If you wear armor without training in it, you have Disadvantage on any D20 Test using Strength or Dexterity and you can\u2019t cast spells.';

export const SHIELD_TRAINING_TEXT =
  'You gain a Shield\u2019s +2 AC benefit only if you have training with Shields.';

// PHB 2024 "Armor" table (L9589-9646). Declaration order mirrors the printed
// table: Light, Medium, Heavy, Shield.
export const ARMOR_CATALOG: Record<string, ArmorData> = {
  // ── Light Armor (full Dex, no cap) ────────────────────────────────────────
  'padded-armor': {
    id: 'padded-armor',
    name: 'Padded Armor',
    category: 'light',
    baseAc: 11,
    addsDex: true,
    stealthDisadvantage: true,
    weightLb: 8, // OCR '816.' → 8 lb.
    costGp: 5,
    source: ARMOR_TABLE_SOURCE,
  },
  'leather-armor': {
    id: 'leather-armor',
    name: 'Leather Armor',
    category: 'light',
    baseAc: 11,
    addsDex: true,
    stealthDisadvantage: false,
    weightLb: 10,
    costGp: 10,
    source: ARMOR_TABLE_SOURCE,
  },
  'studded-leather-armor': {
    id: 'studded-leather-armor',
    name: 'Studded Leather Armor',
    category: 'light',
    baseAc: 12,
    addsDex: true,
    stealthDisadvantage: false,
    weightLb: 13,
    costGp: 45,
    source: ARMOR_TABLE_SOURCE,
  },
  // ── Medium Armor (Dex, max +2) ────────────────────────────────────────────
  'hide-armor': {
    id: 'hide-armor',
    name: 'Hide Armor',
    category: 'medium',
    baseAc: 12,
    addsDex: true,
    dexCap: 2,
    stealthDisadvantage: false,
    weightLb: 12, // OCR '1216.' → 12 lb.
    costGp: 10,
    source: ARMOR_TABLE_SOURCE,
  },
  'chain-shirt': {
    id: 'chain-shirt',
    name: 'Chain Shirt',
    category: 'medium',
    baseAc: 13,
    addsDex: true,
    dexCap: 2,
    stealthDisadvantage: false,
    weightLb: 20,
    costGp: 50,
    source: ARMOR_TABLE_SOURCE,
  },
  'scale-mail': {
    id: 'scale-mail',
    name: 'Scale Mail',
    category: 'medium',
    baseAc: 14,
    addsDex: true,
    dexCap: 2,
    stealthDisadvantage: true,
    weightLb: 45,
    costGp: 50,
    source: ARMOR_TABLE_SOURCE,
  },
  breastplate: {
    id: 'breastplate',
    name: 'Breastplate',
    category: 'medium',
    baseAc: 14,
    addsDex: true,
    dexCap: 2,
    stealthDisadvantage: false,
    weightLb: 20,
    costGp: 400,
    source: ARMOR_TABLE_SOURCE,
  },
  'half-plate-armor': {
    id: 'half-plate-armor',
    name: 'Half Plate Armor',
    category: 'medium',
    baseAc: 15,
    addsDex: true,
    dexCap: 2,
    stealthDisadvantage: true,
    weightLb: 40,
    costGp: 750,
    source: ARMOR_TABLE_SOURCE,
  },
  // ── Heavy Armor (no Dex) ──────────────────────────────────────────────────
  'ring-mail': {
    id: 'ring-mail',
    name: 'Ring Mail',
    category: 'heavy',
    baseAc: 14,
    addsDex: false,
    stealthDisadvantage: true,
    weightLb: 40,
    costGp: 30,
    source: ARMOR_TABLE_SOURCE,
  },
  'chain-mail': {
    id: 'chain-mail',
    name: 'Chain Mail',
    category: 'heavy',
    baseAc: 16,
    addsDex: false,
    strengthRequirement: 13,
    stealthDisadvantage: true,
    weightLb: 55,
    costGp: 75,
    source: ARMOR_TABLE_SOURCE,
  },
  'splint-armor': {
    id: 'splint-armor',
    name: 'Splint Armor',
    category: 'heavy',
    baseAc: 17,
    addsDex: false,
    strengthRequirement: 15,
    stealthDisadvantage: true,
    weightLb: 60,
    costGp: 200,
    source: ARMOR_TABLE_SOURCE,
  },
  'plate-armor': {
    id: 'plate-armor',
    name: 'Plate Armor',
    category: 'heavy',
    baseAc: 18,
    addsDex: false,
    strengthRequirement: 15,
    stealthDisadvantage: true,
    weightLb: 65,
    costGp: 1500,
    source: ARMOR_TABLE_SOURCE,
  },
  // ── Shield (+2 bonus, not a base AC) ──────────────────────────────────────
  shield: {
    id: 'shield',
    name: 'Shield',
    category: 'shield',
    baseAc: 2, // the +2 AC bonus, added on top of the base AC (never a base).
    addsDex: false,
    stealthDisadvantage: false,
    weightLb: 6, // OCR '616.' → 6 lb.
    costGp: 10,
    source: ARMOR_TABLE_SOURCE,
  },
};

/** All armor as a flat array, in declaration (table) order. */
export const ARMOR_LIST: ArmorData[] = Object.values(ARMOR_CATALOG);

/** A catalog key for a known armor. */
export type ArmorId = keyof typeof ARMOR_CATALOG;

/** Look up an armor by id (undefined if unknown). */
export function getArmor(id: string): ArmorData | undefined {
  return Object.prototype.hasOwnProperty.call(ARMOR_CATALOG, id)
    ? ARMOR_CATALOG[id]
    : undefined;
}
