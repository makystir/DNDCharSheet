/**
 * Starting equipment at character creation (D&D 5.5e / 2024).
 *
 * PHB 2024 "Choose Starting Equipment" (Docs/PlayersHandbook.md L1602-1606): the
 * background AND the class both provide starting equipment, any coins gained at
 * this step can be spent right away on equipment from chapter 6, and the player
 * may pick that gear themselves. Each class offers lettered options in its Core
 * Traits "Starting Equipment" entry: usually A = a gear package plus a little
 * gold and B = gold only. The Fighter has two packages (A and B) and gold as C.
 *
 * This module is pure logic:
 *   - parse a class's options,
 *   - resolve a chosen option into inventory items (player picks for any
 *     "choose a type" entry, never an RNG pick on the default path),
 *   - list the purchasable catalog with book prices (PHB chapter 6),
 *   - do the money math in copper so no float drift (PHB "Coins", L9247-9272:
 *     1 GP = 10 SP = 100 CP),
 *   - flag purchases the class is probably not trained to use. Warnings never
 *     block a purchase; the rule text is quoted from the catalog constants.
 */

import type { Ability, Character, InventoryItem } from '../types/character';
import { getClass } from '../data/classes';
import { WEAPON_LIST, type WeaponData } from '../data/weapons';
import {
  ARMOR_LIST,
  ARMOR_TRAINING_TEXT,
  SHIELD_TRAINING_TEXT,
  type ArmorData,
} from '../data/armor';
import { EQUIPMENT_LIST, type EquipmentData } from '../data/equipment';
import { trinketForRoll } from '../data/trinkets';
import { classProficientWithWeapon } from './attacks';
import { resolveEquipment, resolveEquipmentRandom } from './equipment-resolver';
import type { RNG } from './random';
import { ZERO_CURRENCY, type CurrencyAmount } from './currency';

// ─── Class options ───────────────────────────────────────────────────────────

export type ClassOptionId = 'A' | 'B' | 'C';

/** One lettered option from a class's "Starting Equipment" entry. */
export interface ClassEquipmentOption {
  id: ClassOptionId;
  /** Item entries as printed, excluding the trailing GP amount. */
  entries: string[];
  /** The GP that comes with the option (the whole option for a gold-only one). */
  goldGp: number;
}

/**
 * Parses a class's `startingEquipment` string, e.g.
 * "(A) Greataxe, 4 Handaxes, Explorer's Pack, 15 GP; or (B) 75 GP".
 * Returns [] for an unknown class or a string it cannot read.
 */
export function classEquipmentOptions(classId: string): ClassEquipmentOption[] {
  const text = getClass(classId)?.startingEquipment;
  if (!text) return [];
  const options: ClassEquipmentOption[] = [];
  for (const chunk of text.split(/;\s*(?:or\s+)?/)) {
    const match = /^\(([ABC])\)\s*(.+)$/.exec(chunk.trim());
    if (!match) continue;
    const tokens = match[2].split(/,\s*/).map((t) => t.trim()).filter(Boolean);
    let goldGp = 0;
    const entries: string[] = [];
    for (const token of tokens) {
      const gold = /^(\d+)\s*GP$/i.exec(token);
      if (gold) goldGp += parseInt(gold[1], 10);
      else entries.push(token);
    }
    options.push({ id: match[1] as ClassOptionId, entries, goldGp });
  }
  return options;
}

/**
 * The concrete names a player can pick for an entry that offers a choice (for
 * example "Musical Instrument", "Arcane Focus", or "Artisan's Tools or Musical
 * Instrument"), flattened to catalog names. null when the entry needs no choice.
 */
export function entryChoiceOptions(entry: string): string[] | null {
  const resolved = resolveEquipment(entry);
  const choice = resolved.find((r) => r.kind === 'choice');
  if (!choice || choice.kind !== 'choice') return null;
  const flat = choice.options.flatMap((name) => {
    const inner = resolveEquipment(name).find((r) => r.kind === 'choice');
    return inner && inner.kind === 'choice' ? inner.options : [name];
  });
  return [...new Set(flat)];
}

/** The entries of an option that still need a player pick. */
export function optionChoiceEntries(option: ClassEquipmentOption): string[] {
  return option.entries.filter((e) => entryChoiceOptions(e) !== null);
}

/**
 * Resolves an option's entries into inventory items.
 * `picks` maps a choice entry (as printed) to the catalog name the player picked.
 * An entry that needs a pick and has none is skipped, and listed in `missing`.
 * Pass `rng` only for the explicit random-character path.
 */
export function resolveOptionItems(
  option: ClassEquipmentOption,
  picks: Record<string, string>,
  rng?: RNG,
): { items: InventoryItem[]; missing: string[] } {
  const items: InventoryItem[] = [];
  const missing: string[] = [];
  for (const entry of option.entries) {
    const needsPick = entryChoiceOptions(entry) !== null;
    const source = needsPick ? picks[entry] : entry;
    if (needsPick && !source) {
      if (rng) {
        for (const r of resolveEquipmentRandom(entry, rng)) {
          if (r.kind !== 'choice') items.push(r.item);
        }
      } else {
        missing.push(entry);
      }
      continue;
    }
    for (const r of resolveEquipment(source)) {
      if (r.kind !== 'choice') items.push(r.item);
    }
  }
  return { items, missing };
}

// ─── Money (copper integers) ─────────────────────────────────────────────────

/** GP (possibly fractional, e.g. 0.2 for 2 SP) to whole copper pieces. */
export function gpToCopper(gp: number): number {
  return Math.round(gp * 100);
}

/** Total copper value of a coin purse. PHB "Coins": PP 1000, GP 100, EP 50, SP 10, CP 1. */
export function purseToCopper(coins: CurrencyAmount): number {
  return coins.pp * 1000 + coins.gp * 100 + coins.ep * 50 + coins.sp * 10 + coins.cp;
}

/** Copper to gold, silver and copper pieces (no PP/EP, so nothing is hidden). */
export function copperToPurse(copper: number): CurrencyAmount {
  const cp = Math.max(0, Math.round(copper));
  return { ...ZERO_CURRENCY, gp: Math.floor(cp / 100), sp: Math.floor((cp % 100) / 10), cp: cp % 10 };
}

/** "12 GP 5 SP 3 CP" style text for an amount of copper. */
export function formatCopper(copper: number): string {
  const p = copperToPurse(copper);
  const parts = [p.gp ? `${p.gp} GP` : '', p.sp ? `${p.sp} SP` : '', p.cp ? `${p.cp} CP` : ''].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(' ') : '0 GP';
}

// ─── The shop ────────────────────────────────────────────────────────────────

export type ShopSection = 'weapon' | 'armor' | 'gear';

/** One purchasable line. `unit` is one purchase (a bundle for ammunition). */
export interface ShopEntry {
  /** Stable key: "<kind>:<catalogId>". */
  key: string;
  kind: 'weapon' | 'armor' | 'equipment';
  section: ShopSection;
  catalogId: string;
  name: string;
  costGp: number;
  weightLb: number;
  /** Pieces added to the inventory per purchase (bundle size for ammunition, else 1). */
  piecesPerUnit: number;
  /** Short descriptor for the row, e.g. "Martial Melee", "Medium armor". */
  detail: string;
}

const CATEGORY_LABEL = { simple: 'Simple', martial: 'Martial' } as const;

function weaponEntry(w: WeaponData): ShopEntry {
  return {
    key: `weapon:${w.id}`,
    kind: 'weapon',
    section: 'weapon',
    catalogId: w.id,
    name: w.name,
    costGp: w.costGp,
    weightLb: w.weightLb,
    piecesPerUnit: 1,
    detail: `${CATEGORY_LABEL[w.category]} ${w.range === 'melee' ? 'Melee' : 'Ranged'}, ${w.damageDice} ${w.damageType}`,
  };
}

function armorEntry(a: ArmorData): ShopEntry {
  return {
    key: `armor:${a.id}`,
    kind: 'armor',
    section: 'armor',
    catalogId: a.id,
    name: a.name,
    costGp: a.costGp,
    weightLb: a.weightLb,
    piecesPerUnit: 1,
    detail: a.category === 'shield' ? 'Shield (+2 AC)' : `${a.category[0].toUpperCase()}${a.category.slice(1)} armor (AC ${a.baseAc})`,
  };
}

function gearEntry(e: EquipmentData): ShopEntry {
  const bundle = e.packageSize && e.packageSize > 0 ? e.packageSize : 1;
  return {
    key: `equipment:${e.id}`,
    kind: 'equipment',
    section: 'gear',
    catalogId: e.id,
    name: bundle > 1 ? `${e.name} (${bundle})` : e.name,
    costGp: e.costGp ?? 0,
    weightLb: e.weightLb,
    piecesPerUnit: bundle,
    detail: e.kind === 'pack' ? 'Pack' : e.kind[0].toUpperCase() + e.kind.slice(1),
  };
}

let shopCache: ShopEntry[] | undefined;

/**
 * Everything with a printed price in the PHB (chapter 6 Weapons, Armor, and
 * equipment tables). Items the book lists without a price are left out, so no
 * price is ever invented (rules-compliance rule 1).
 */
export function shopCatalog(): ShopEntry[] {
  if (!shopCache) {
    shopCache = [
      ...WEAPON_LIST.map(weaponEntry),
      ...ARMOR_LIST.map(armorEntry),
      ...EQUIPMENT_LIST.filter((e) => !e.unpriced && typeof e.costGp === 'number').map(gearEntry),
    ];
  }
  return shopCache;
}

/** Cart = purchases per shop key. */
export type Cart = Record<string, number>;

export function cartCopper(cart: Cart): number {
  const byKey = new Map(shopCatalog().map((e) => [e.key, e]));
  let total = 0;
  for (const [key, count] of Object.entries(cart)) {
    const entry = byKey.get(key);
    if (entry && count > 0) total += gpToCopper(entry.costGp) * count;
  }
  return total;
}

/** Inventory items for a cart. Ammunition quantity counts pieces, not bundles. */
export function cartItems(cart: Cart, newId: () => string): InventoryItem[] {
  const byKey = new Map(shopCatalog().map((e) => [e.key, e]));
  const items: InventoryItem[] = [];
  for (const [key, count] of Object.entries(cart)) {
    const entry = byKey.get(key);
    if (!entry || count <= 0) continue;
    items.push({
      id: newId(),
      kind: entry.kind,
      catalogId: entry.catalogId,
      quantity: count * entry.piecesPerUnit,
    });
  }
  return items;
}

// ─── "Probably can't use this" warnings ──────────────────────────────────────

const ARMOR_TRAINING_LABEL: Record<ArmorData['category'], string> = {
  light: 'Light armor',
  medium: 'Medium armor',
  heavy: 'Heavy armor',
  shield: 'Shields',
};

/**
 * Plain-language warnings for a purchase the class is probably not trained for.
 * Advice only: buying is never blocked (a feat, species trait or house game can
 * still make it work). `scores` are the character's current ability scores and
 * enable the Strength / Heavy checks when given.
 *
 * Rules: PHB 2024 Armor Training (armor.ts ARMOR_TRAINING_TEXT), Shield training,
 * the Armor table "Strength" column, the Weapon "Heavy" property, and class
 * Weapon Proficiencies (attacks.ts classProficientWithWeapon).
 */
export function purchaseWarnings(
  classId: string,
  entry: ShopEntry,
  scores?: Partial<Record<Ability, number>>,
): string[] {
  const cls = getClass(classId);
  if (!cls) return [];
  const warnings: string[] = [];

  if (entry.kind === 'weapon') {
    const weapon = WEAPON_LIST.find((w) => w.id === entry.catalogId);
    if (!weapon) return [];
    if (!classProficientWithWeapon(cls.weaponProficiency, weapon)) {
      warnings.push(
        `A ${cls.name} isn't trained with this weapon, so you wouldn't add your Proficiency Bonus to its attack rolls.`,
      );
    }
    if (weapon.properties.includes('heavy') && scores) {
      const ability: Ability = weapon.range === 'melee' ? 'str' : 'dex';
      if ((scores[ability] ?? 10) < 13) {
        warnings.push(
          `It has the Heavy property: you have Disadvantage on attack rolls with it while your ${ability === 'str' ? 'Strength' : 'Dexterity'} is under 13.`,
        );
      }
    }
  }

  if (entry.kind === 'armor') {
    const armor = ARMOR_LIST.find((a) => a.id === entry.catalogId);
    if (!armor) return [];
    const trained = cls.armorTraining.includes(ARMOR_TRAINING_LABEL[armor.category]);
    if (!trained) {
      warnings.push(
        armor.category === 'shield'
          ? `A ${cls.name} isn't trained with Shields. ${SHIELD_TRAINING_TEXT}`
          : `A ${cls.name} isn't trained with ${armor.category} armor. ${ARMOR_TRAINING_TEXT}`,
      );
    }
    if (armor.strengthRequirement && scores && (scores.str ?? 10) < armor.strengthRequirement) {
      warnings.push(
        `It needs Strength ${armor.strengthRequirement}. Below that, your Speed drops by 10 feet.`,
      );
    }
  }

  return warnings;
}

/**
 * Which armor and shield from a set of starting items the class is trained to
 * wear, picked for automatic equipping: the highest base-AC trained armor and the
 * first trained shield. Returns inventory-item ids.
 */
export function autoEquipChoices(
  classId: string,
  items: InventoryItem[],
): { armorItemId?: string; shieldItemId?: string } {
  const cls = getClass(classId);
  if (!cls) return {};
  let armorItemId: string | undefined;
  let armorAc = -1;
  let shieldItemId: string | undefined;
  for (const item of items) {
    if (item.kind !== 'armor' || !item.catalogId) continue;
    const armor = ARMOR_LIST.find((a) => a.id === item.catalogId);
    if (!armor || !cls.armorTraining.includes(ARMOR_TRAINING_LABEL[armor.category])) continue;
    if (armor.category === 'shield') {
      shieldItemId ??= item.id;
    } else if (armor.baseAc > armorAc) {
      armorAc = armor.baseAc;
      armorItemId = item.id;
    }
  }
  return { armorItemId, shieldItemId };
}

/** Applies starting items, gold and auto-equipped armor to a character. */
export function grantStartingEquipment(
  character: Character,
  grant: { items: InventoryItem[]; goldGp: number; spentCopper: number },
): Character {
  const existing = character.coins ?? { ...ZERO_CURRENCY };
  const copper = Math.max(
    0,
    purseToCopper(existing) + gpToCopper(grant.goldGp) - grant.spentCopper,
  );
  const inventory = [...(character.inventory ?? []), ...grant.items];
  const classId = character.classes?.[0]?.id ?? '';
  const equip = autoEquipChoices(classId, inventory);
  const equipped = {
    ...(character.equipped ?? {}),
    ...(equip.armorItemId && !character.equipped?.armorItemId ? { armorItemId: equip.armorItemId } : {}),
    ...(equip.shieldItemId && !character.equipped?.shieldItemId ? { shieldItemId: equip.shieldItemId } : {}),
  };
  return {
    ...character,
    inventory,
    coins: copperToPurse(copper),
    ...(Object.keys(equipped).length > 0 ? { equipped } : {}),
  };
}

// --- Budget ------------------------------------------------------------------

/** Copper the player can spend: the class option's gold plus the background's gold. */
export function startingBudgetCopper(classGoldGp: number, backgroundGoldGp: number): number {
  return gpToCopper(classGoldGp) + gpToCopper(backgroundGoldGp);
}

/**
 * Removes purchases (most recently added first) until the cart fits the budget.
 * Used when a changed choice (gold option, background, class) shrinks the budget,
 * so the player never ends up with a negative purse.
 */
export function trimCartToBudget(cart: Cart, budgetCopper: number): Cart {
  const next: Cart = { ...cart };
  const keys = Object.keys(next);
  while (cartCopper(next) > budgetCopper) {
    const key = [...keys].reverse().find((k) => (next[k] ?? 0) > 0);
    if (!key) break;
    next[key] -= 1;
    if (next[key] === 0) delete next[key];
  }
  return next;
}

let idCounter = 0;
/** A unique id for an inventory item created at character creation. */
export function newItemId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  idCounter += 1;
  return `start-${Date.now()}-${idCounter}`;
}

/** The free trinket as an inventory item (PHB 2024 "Trinkets"), or undefined for a bad roll. */
export function trinketItem(roll: number | null): InventoryItem | undefined {
  const name = roll === null ? undefined : trinketForRoll(roll);
  return name ? { id: newItemId(), kind: 'equipment', name, quantity: 1, notes: 'Trinket' } : undefined;
}
