/**
 * Equipment Resolver — maps a granted starting-equipment string to concrete
 * inventory items (and to UNRESOLVED CHOICES where the grant offers the player
 * a decision).
 *
 * Ported IN STRUCTURE from PWACharSheet's src/logic/trapping-resolver.ts: the
 * pipeline (compound → ambiguous → and/or-split → exact-lookup → fallback), the
 * own-property prototype-pollution guards, the injectable RNG seam, the
 * leading-quantity-phrase parse, and the discriminated result are retained; the
 * data (maps, catalogs, payload) is retargeted to D&D 5.5e (2024).
 *
 * KEY BEHAVIOURAL DIFFERENCE FROM THE WFRP SOURCE (review A1 finding #2)
 * ---------------------------------------------------------------------
 * The WFRP resolver silently (a) mapped a generic weapon category to one fixed
 * weapon and (b) RNG-picked a single option for a " or " grant. For D&D that
 * LOSES PLAYER CHOICE (e.g. "Artisan's Tools or Musical Instrument", "any
 * Simple Weapon"). So by default this resolver PRESERVES the choice: an
 * ambiguous category and a " or " grant both yield an unresolved
 * `{ kind: 'choice' }` entry listing the options for the UI (A7) to present.
 * The RNG seam is retained but used ONLY by `resolveEquipmentRandom`, the
 * explicitly-random workflow (e.g. a "roll me a character" button). This keeps
 * RNG out of the default path and never invents a mechanic (rules-compliance
 * rule 1 — the PHB grants the player the choice; we do not decide it for them).
 *
 * Starting equipment comes from a class's "Starting Equipment" entry — a
 * free-text choice string (PHB 2024 Core <Class> Traits, see
 * ClassData.startingEquipment). A single already-chosen option string (e.g.
 * "Greataxe" or "Longbow and 20 Arrows") resolves into concrete items; a string
 * that still offers a choice resolves into a `choice` entry. Parsing the full
 * "(A) … ; or (B) …" option syntax and auto-granting onto a character is the
 * later creation-wizard stage (A7); this module ships the resolver + tests only.
 *
 * Resolution order (mirrors the source's steps 1-8):
 *   1. Whole-string COMPOUND_MAP lookup for known multi-item entries (handles
 *      compounds such as "Longbow and 20 Arrows" before the generic " and "
 *      split can break them apart).
 *   2. Whole-string CATEGORY_CHOICE_MAP lookup — a generic category ("Any
 *      Simple Weapon") becomes an unresolved choice over its eligible items.
 *   3. Whole-string NAME_NORMALISATION lookup (plural → singular catalog name),
 *      before the or/and split.
 *   4. " and " → resolve every part and return all of them.
 *   5. " or "  → return a single unresolved `choice` over the options (default),
 *      NOT an RNG pick.
 *   6. Exact WEAPON_CATALOG match → a weapon inventory item.
 *   7. Exact ARMOR_CATALOG match → an armor inventory item.
 *   8. Fallback → an equipment inventory item (exact EQUIPMENT_CATALOG match
 *      when present, else a custom-named item); a leading quantity phrase
 *      ("20 Arrows") sets a sensible quantity, else 1.
 *
 * Cite: PHB 2024 "Starting Equipment" (class Equipment entries), equipment
 * tables L9388-9430 (weapons), L9589-9646 (armor), Chapter 6 (gear).
 */

import type { InventoryItem } from '../types/character';
import { WEAPON_LIST, type WeaponData } from '../data/weapons';
import { ARMOR_LIST, type ArmorData } from '../data/armor';
import { EQUIPMENT_LIST, type EquipmentData } from '../data/equipment';
import { pick, type RNG } from './random';

/**
 * A resolved grant, discriminated so the caller routes it to the right list.
 * A `choice` is an UNRESOLVED player decision the UI (A7) must present; it is
 * never auto-picked on the default path.
 */
export type ResolvedItem =
  | { kind: 'weapon'; item: InventoryItem }
  | { kind: 'armor'; item: InventoryItem }
  | { kind: 'equipment'; item: InventoryItem }
  | { kind: 'choice'; prompt: string; options: string[] };

/** Monotonic counter so resolved items get stable, unique instance ids in tests. */
let resolveCounter = 0;
function nextInstanceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  resolveCounter += 1;
  return `resolved-${Date.now()}-${resolveCounter}`;
}

/**
 * Generic weapon-category grants → an unresolved choice over the eligible
 * catalog weapons (PHB 2024: a class granting "any Simple weapon" lets the
 * PLAYER choose). The options are computed from WEAPON_LIST so the choice can
 * never drift from the catalog. Keyed on the phrasings the class strings use.
 */
const CATEGORY_CHOICE_MAP: Record<string, () => string[]> = {
  'Any Simple Weapon': () => simpleWeaponNames(),
  'Simple Weapon': () => simpleWeaponNames(),
  'Any Martial Weapon': () => martialWeaponNames(),
  'Martial Weapon': () => martialWeaponNames(),
};

function simpleWeaponNames(): string[] {
  return WEAPON_LIST.filter((w) => w.category === 'simple').map((w) => w.name);
}

function martialWeaponNames(): string[] {
  return WEAPON_LIST.filter((w) => w.category === 'martial').map((w) => w.name);
}

/**
 * Generic equipment-category grants → an unresolved choice over the COMPLETE
 * set of eligible catalog variants (review finding #3). A class granting a
 * generic "Holy Symbol", "Druidic Focus", "Musical Instrument", or "Artisan's
 * Tools" lets the PLAYER pick a specific variant; this surfaces every legal
 * option (never silently picking or RNG-defaulting on the default path —
 * finding #2). Options are derived from the catalog so they cannot drift.
 * Keyed on the exact phrasings the class/background strings use.
 */
const GENERIC_CHOICE_MAP: Record<string, () => string[]> = {
  'Holy Symbol': () => namesByIdPrefix('holy-symbol-'),
  'Druidic Focus': () => namesByIdPrefix('druidic-focus-'),
  'Arcane Focus': () => namesByIdPrefix('arcane-focus-'),
  'Musical Instrument': () => namesByIdPrefix('instrument-'),
  "Artisan's Tools": () => artisansToolsNames(),
};

/** Catalog names of every equipment entry whose id starts with the prefix. */
function namesByIdPrefix(prefix: string): string[] {
  return EQUIPMENT_LIST.filter((e) => e.id.startsWith(prefix)).map((e) => e.name);
}

/**
 * The complete Artisan's Tools category (PHB 2024 "Artisan's Tools",
 * L9662-L9862). Derived from the catalog: a tool whose description marks it as
 * "Artisan's Tools". Keeps the choice from drifting as tools are added.
 */
function artisansToolsNames(): string[] {
  return EQUIPMENT_LIST.filter(
    (e) => e.kind === 'tool' && !!e.description && e.description.startsWith("Artisan's Tools"),
  ).map((e) => e.name);
}

/**
 * Plural → singular catalog-name normalisation. PHB 2024 class starting
 * equipment lists quantities with the PLURAL item name ("4 Handaxes",
 * "2 Daggers", "8 Javelins"), but the weapon catalog is keyed by the SINGULAR
 * name. This maps the plural (after the leading quantity phrase is stripped) to
 * the singular catalog name — a name normalisation, not an invented mechanic
 * (rules-compliance rule 1). Ammunition ("Arrows") is already catalog-keyed in
 * the plural, so it needs no entry here.
 */
export const NAME_NORMALISATION: Record<string, string> = {
  Handaxes: 'Handaxe',
  Daggers: 'Dagger',
  Javelins: 'Javelin',
  // Concrete parenthesised/qualified class phrasings → real catalog names
  // (review finding #3). These are NOT player choices — the class already names
  // a specific variant, so they normalise to a single catalog entry rather than
  // a `choice`. Each is a name normalisation, not an invented mechanic (rule 1).
  'Arcane Focus (crystal)': 'Arcane Focus (Crystal)',
  'Arcane Focus (orb)': 'Arcane Focus (Orb)',
  // Wizard grants "Arcane Focus (Quarterstaff)" — the catalog's Staff variant IS
  // a Quarterstaff (PHB "Arcane Focuses": Staff). Druid's "Druidic Focus
  // (Quarterstaff)" maps to the catalog's "Wooden Staff" (also a Quarterstaff).
  'Arcane Focus (Quarterstaff)': 'Arcane Focus (Staff)',
  'Druidic Focus (Quarterstaff)': 'Druidic Focus (Wooden Staff)',
  // Warlock grants "Book (occult lore)" — a flavored Book; normalise to Book.
  'Book (occult lore)': 'Book',
};

/**
 * Compound entries that resolve to MULTIPLE concrete items. Checked as a whole
 * string before the generic " and " split, because splitting on " and " would
 * otherwise mangle a quantity phrase ("Longbow and 20 Arrows").
 */
const COMPOUND_MAP: Record<string, ResolvedItem[]> = {
  // "Longbow and 20 Arrows": the Longbow weapon + an ammunition item (1 bundle of 20).
  'Longbow and 20 Arrows': [
    { kind: 'weapon', item: toWeaponItem(findWeapon('Longbow')) },
    { kind: 'equipment', item: toEquipmentItem(findEquipment('Arrows'), 20) },
  ],
  // "Shortbow and 20 Arrows": the Shortbow weapon + an ammunition item (1 bundle of 20).
  'Shortbow and 20 Arrows': [
    { kind: 'weapon', item: toWeaponItem(findWeapon('Shortbow')) },
    { kind: 'equipment', item: toEquipmentItem(findEquipment('Arrows'), 20) },
  ],
};

/** Find an exact weapon entry by name (undefined if none). */
function findWeapon(name: string): WeaponData | undefined {
  return WEAPON_LIST.find((w) => w.name === name);
}

/** Find an exact armor entry by name (undefined if none). */
function findArmor(name: string): ArmorData | undefined {
  return ARMOR_LIST.find((a) => a.name === name);
}

/** Find an exact equipment entry by name (undefined if none). */
function findEquipment(name: string): EquipmentData | undefined {
  return EQUIPMENT_LIST.find((e) => e.name === name);
}

/** Build a weapon InventoryItem that references the catalog entry (quantity 1). */
function toWeaponItem(data: WeaponData | undefined): InventoryItem {
  if (!data) {
    throw new Error('toWeaponItem(): missing WEAPON_CATALOG entry for a mapped compound');
  }
  return { id: nextInstanceId(), kind: 'weapon', catalogId: data.id, quantity: 1 };
}

/** Build an armor InventoryItem that references the catalog entry (quantity 1). */
function toArmorItem(data: ArmorData): InventoryItem {
  return { id: nextInstanceId(), kind: 'armor', catalogId: data.id, quantity: 1 };
}

/** Build an equipment InventoryItem referencing the catalog entry, given quantity. */
function toEquipmentItem(data: EquipmentData | undefined, quantity: number): InventoryItem {
  if (!data) {
    throw new Error('toEquipmentItem(): missing EQUIPMENT_CATALOG entry for a mapped compound');
  }
  return { id: nextInstanceId(), kind: 'equipment', catalogId: data.id, quantity };
}

/**
 * Parse a leading quantity phrase from a name, e.g. "20 Arrows" → { quantity: 20,
 * name: 'Arrows' } and "4 Handaxes" → { quantity: 4, name: 'Handaxes' }. Entries
 * without a leading count keep quantity 1.
 */
function parseQuantity(entry: string): { name: string; quantity: number } {
  const match = /^(\d+)\s+(.+)$/.exec(entry.trim());
  if (match) {
    const quantity = parseInt(match[1], 10);
    return { name: match[2].trim(), quantity: quantity > 0 ? quantity : 1 };
  }
  return { name: entry.trim(), quantity: 1 };
}

/** Resolve a single already-split part (no " and " / " or " left) to one ResolvedItem. */
function resolvePart(part: string): ResolvedItem {
  const trimmed = part.trim();

  // A generic weapon category offers the player a choice; surface it unresolved
  // rather than silently picking one (finding #2). Own-property guard so
  // inherited keys can never match a non-function prototype value.
  if (Object.prototype.hasOwnProperty.call(CATEGORY_CHOICE_MAP, trimmed)) {
    return { kind: 'choice', prompt: trimmed, options: CATEGORY_CHOICE_MAP[trimmed]() };
  }

  // A generic equipment category (Holy Symbol, Druidic/Arcane Focus, Musical
  // Instrument, Artisan's Tools) → an unresolved choice over all variants
  // (finding #3). Checked before name normalisation so the generic word is not
  // mistaken for a single catalog item.
  if (Object.prototype.hasOwnProperty.call(GENERIC_CHOICE_MAP, trimmed)) {
    return { kind: 'choice', prompt: trimmed, options: GENERIC_CHOICE_MAP[trimmed]() };
  }

  // A quantity phrase may prefix a name ("4 Handaxes"); parse it first so both
  // the whole string AND the post-quantity base name can be normalised.
  const parsedWhole = parseQuantity(trimmed);
  const quantity = parsedWhole.quantity;

  // The base name after quantity might itself be a generic category ("2 Simple
  // Weapon" is not a real grant, but keep the guard symmetric and safe).
  if (Object.prototype.hasOwnProperty.call(CATEGORY_CHOICE_MAP, parsedWhole.name)) {
    return { kind: 'choice', prompt: parsedWhole.name, options: CATEGORY_CHOICE_MAP[parsedWhole.name]() };
  }

  // Normalise a known plural to its singular catalog name. Try the whole trimmed
  // string first, then the post-quantity base name. Own-property guard so
  // inherited Object.prototype keys (e.g. "__proto__") can never resolve to a
  // non-string prototype value.
  const name = Object.prototype.hasOwnProperty.call(NAME_NORMALISATION, trimmed)
    ? NAME_NORMALISATION[trimmed]
    : Object.prototype.hasOwnProperty.call(NAME_NORMALISATION, parsedWhole.name)
      ? NAME_NORMALISATION[parsedWhole.name]
      : parsedWhole.name;

  // Exact weapon match → weapon inventory item (quantity from the phrase).
  const weapon = findWeapon(name);
  if (weapon) {
    return { kind: 'weapon', item: { ...toWeaponItem(weapon), quantity } };
  }

  // Exact armor match → armor inventory item.
  const armor = findArmor(name);
  if (armor) {
    return { kind: 'armor', item: { ...toArmorItem(armor), quantity } };
  }

  // Exact equipment match → equipment inventory item referencing the catalog.
  const equipment = findEquipment(name);
  if (equipment) {
    return { kind: 'equipment', item: { ...toEquipmentItem(equipment, quantity) } };
  }

  // Fallback → a custom-named equipment item (no catalog entry).
  return {
    kind: 'equipment',
    item: { id: nextInstanceId(), kind: 'equipment', name, quantity },
  };
}

/**
 * Resolve a single granted equipment string into zero or more concrete items
 * and/or unresolved `choice` entries. This is the DEFAULT path: it never picks
 * a choice for the player (finding #2). A " or " grant and a generic category
 * both yield a `choice` the UI (A7) must present.
 *
 * @param entry A granted equipment option string.
 */
export function resolveEquipment(entry: string): ResolvedItem[] {
  const trimmed = entry.trim();

  // 1. Whole-string compound lookup (special multi-item entries), checked before
  //    the generic " and " split so quantity phrases survive. Own-property guard
  //    so inherited keys (e.g. "__proto__") can never match a non-array value.
  const compound = Object.prototype.hasOwnProperty.call(COMPOUND_MAP, trimmed)
    ? COMPOUND_MAP[trimmed]
    : undefined;
  if (compound) {
    // Return fresh copies (with fresh ids) so callers can mutate results freely.
    return compound.map((r) =>
      r.kind === 'choice'
        ? { kind: 'choice', prompt: r.prompt, options: [...r.options] }
        : { kind: r.kind, item: { ...r.item, id: nextInstanceId() } },
    );
  }

  // 2. Whole-string generic weapon category → an unresolved choice (not a pick).
  if (Object.prototype.hasOwnProperty.call(CATEGORY_CHOICE_MAP, trimmed)) {
    return [{ kind: 'choice', prompt: trimmed, options: CATEGORY_CHOICE_MAP[trimmed]() }];
  }

  // 2b. Whole-string generic equipment category (Holy Symbol, Druidic/Arcane
  //     Focus, Musical Instrument, Artisan's Tools) → an unresolved choice over
  //     all variants (finding #3). Before name normalisation and the or/and
  //     split so the generic phrase is not mistaken for a concrete item or
  //     broken apart.
  if (Object.prototype.hasOwnProperty.call(GENERIC_CHOICE_MAP, trimmed)) {
    return [{ kind: 'choice', prompt: trimmed, options: GENERIC_CHOICE_MAP[trimmed]() }];
  }

  // 3. Whole-string name normalisation (plural → singular, or a concrete
  //    parenthesised class phrasing → its catalog variant), BEFORE the or/and
  //    split (so "Druidic Focus (Quarterstaff)" is not split on parentheses).
  if (Object.prototype.hasOwnProperty.call(NAME_NORMALISATION, trimmed)) {
    return [resolvePart(trimmed)];
  }

  // 4. " and " → resolve every part and return all.
  if (trimmed.includes(' and ')) {
    return trimmed.split(' and ').flatMap((part) => resolveEquipment(part));
  }

  // 5. " or " → return an unresolved choice over the options (default). The
  //    player decides; we do NOT RNG-pick here (finding #2).
  if (trimmed.includes(' or ')) {
    const options = trimmed.split(' or ').map((o) => o.trim());
    return [{ kind: 'choice', prompt: trimmed, options }];
  }

  // 6-8. Single part: category → plural-normalise → WEAPON → ARMOR → EQUIPMENT → fallback.
  return [resolvePart(trimmed)];
}

/**
 * Explicitly-random resolution: the ONLY path that consumes the RNG seam. Used
 * by a deliberate "roll me a character" workflow — it picks one option for every
 * `choice` the default resolver would surface, recursively, so the result holds
 * only concrete items. Seeded in tests for determinism; production passes
 * Math.random. (Reserving RNG for this explicit path is finding #2's fix.)
 *
 * @param entry A granted equipment option string.
 * @param rng   The injectable RNG seam — picks one option per choice.
 */
export function resolveEquipmentRandom(entry: string, rng: RNG): ResolvedItem[] {
  return resolveEquipment(entry).flatMap((r) => {
    if (r.kind !== 'choice') return [r];
    const chosen = pick(rng, r.options);
    return resolveEquipmentRandom(chosen, rng);
  });
}
