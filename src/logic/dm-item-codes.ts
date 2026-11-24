/**
 * DM item codes: a one-way hand-off of a rolled magic item from the DM's
 * Treasure page to a player's Inventory page.
 *
 * Same envelope as the award codes (dm-awards.ts): a small JSON payload inside
 * the share-codec envelope (gzip + base64url, versioned), prefixed `ITEM-`.
 * The code holds a catalog reference, not item text: `{ t:'item', c, i, n? }`
 * where `c` is the catalog ('s' = SRD 5.2.1 data/magic-items.ts, 'd' = DMG 2024
 * data/dmg-magic-items.ts), `i` the catalog item id and `n` the printed name
 * (keeps a rolled variant such as "Belt of Giant Strength (cloud)"). The
 * receiving app reads the description from its own bundled catalogs, so the
 * SRD text (verbatim, CC-BY-4.0) and the DMG paraphrases are reused unchanged.
 *
 * RULES: SRD 5.2.1 "Magic Items" and DMG 2024 "Magic Items A-Z" (Docs/). Nothing
 * is invented: a flagged roll (no catalog entry) cannot be shared. Attunement
 * mechanics are not implemented (see InventoryItem in types/character.ts); the
 * attunement requirement is shown in the item's notes only.
 */
import type { InventoryItem } from '../types/character';
import { MAGIC_ITEMS, type MagicItem } from '../data/magic-items';
import { DMG_MAGIC_ITEMS, type DmgMagicItem } from '../data/dmg-magic-items';
import type { ResolvedMagicItem } from './magic-item-resolve';
import { isGzipSupported } from './gzip';
import { decodeSharePayload, encodeSharePayload } from './share-codec';

export const ITEM_PREFIX = 'ITEM-';
/** Input guard: longer pasted text is rejected before any decoding. */
export const MAX_ITEM_CODE_CHARS = 400;
const MAX_JSON_LENGTH = 600;
const MAX_NAME = 120;

export type ItemCatalog = 's' | 'd';

export interface ItemCodePayload {
  catalog: ItemCatalog;
  /** Catalog item id. */
  id: string;
  /** Printed name of the rolled item (may carry a variant); empty = use the catalog name. */
  name: string;
}

export type ItemCodeErrorCode =
  | 'empty'
  | 'not-item'
  | 'looks-like-other'
  | 'too-large'
  | 'bad-code'
  | 'bad-version'
  | 'bad-json'
  | 'invalid'
  | 'unknown-item';

type CatalogItem = MagicItem | DmgMagicItem;

/** The catalog entry a payload refers to, or undefined. */
export function lookupItem(p: ItemCodePayload): CatalogItem | undefined {
  const list: readonly CatalogItem[] = p.catalog === 's' ? MAGIC_ITEMS : DMG_MAGIC_ITEMS;
  return list.find((i) => i.id === p.id);
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const cleanName = (s: string) => s.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();

function toWire(p: ItemCodePayload): Record<string, unknown> {
  const wire: Record<string, unknown> = { t: 'item', c: p.catalog, i: p.id };
  if (p.name !== '') wire.n = p.name;
  return wire;
}

export function validateItemPayload(
  raw: unknown,
): { ok: true; payload: ItemCodePayload } | { ok: false; error: string; code: 'invalid' | 'unknown-item' } {
  const fail = (error: string, code: 'invalid' | 'unknown-item' = 'invalid') => ({ ok: false as const, error, code });
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fail('This item code is not valid.');
  const r = raw as Record<string, unknown>;
  if (r.t !== 'item') return fail('This item code is not valid.');
  if (r.c !== 's' && r.c !== 'd') return fail('This item code is for a newer version of the app.');
  if (typeof r.i !== 'string' || r.i.length === 0 || r.i.length > 100) return fail('This item code is not valid.');
  let name = '';
  if (r.n !== undefined) {
    if (typeof r.n !== 'string') return fail('This item code is not valid.');
    name = cleanName(r.n);
    if (name.length > MAX_NAME) return fail('This item code is not valid.');
  }
  const payload: ItemCodePayload = { catalog: r.c, id: r.i, name };
  if (!lookupItem(payload)) return fail('This item is not in this version of the app.', 'unknown-item');
  return { ok: true, payload };
}

/** The payload for a rolled item, or null when the roll was flagged (no catalog entry). */
export function itemPayloadFor(item: ResolvedMagicItem): ItemCodePayload | null {
  if (item.status === 'flagged' || item.catalogName === null) return null;
  const catalog: ItemCatalog = item.status === 'srd' ? 's' : 'd';
  const list: readonly CatalogItem[] = catalog === 's' ? MAGIC_ITEMS : DMG_MAGIC_ITEMS;
  const found = list.find((i) => i.name === item.catalogName);
  if (!found) return null;
  return { catalog, id: found.id, name: item.name === found.name ? '' : cleanName(item.name).slice(0, MAX_NAME) };
}

export async function encodeItemCode(
  item: ResolvedMagicItem,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  try {
    if (!isGzipSupported()) {
      return { ok: false, error: 'This browser cannot create item codes (compression is unavailable).' };
    }
    const payload = itemPayloadFor(item);
    if (!payload) return { ok: false, error: 'This item has no catalog entry, so it cannot be shared as a code.' };
    const encoded = await encodeSharePayload(JSON.stringify(toWire(payload)));
    return { ok: true, code: ITEM_PREFIX + encoded };
  } catch {
    return { ok: false, error: 'Could not create the item code.' };
  }
}

function hasPrefix(s: string): boolean {
  return s.slice(0, ITEM_PREFIX.length).toUpperCase() === ITEM_PREFIX;
}

export async function decodeItemCode(
  text: string,
): Promise<{ ok: true; payload: ItemCodePayload } | { ok: false; error: string; code: ItemCodeErrorCode }> {
  const fail = (error: string, code: ItemCodeErrorCode) => ({ ok: false as const, error, code });
  try {
    const trimmed = text.trim();
    if (trimmed === '') return fail('Paste an item code.', 'empty');
    if (!hasPrefix(trimmed)) {
      if (trimmed.includes('#view/') || trimmed.startsWith('{') || trimmed.toUpperCase().startsWith('AWARD-')) {
        return fail('That is not an item code. Item codes start with ITEM-.', 'looks-like-other');
      }
      return fail('This is not an item code. Item codes start with ITEM-.', 'not-item');
    }
    if (!isGzipSupported()) {
      return fail('This browser cannot read item codes (compression is unavailable).', 'bad-code');
    }
    const compact = trimmed.replace(/\s+/g, '');
    if (compact.length > MAX_ITEM_CODE_CHARS) return fail('This item code is too long.', 'too-large');
    const decoded = await decodeSharePayload(compact.slice(ITEM_PREFIX.length));
    if (!decoded.ok) {
      if (decoded.code === 'bad-version') return fail('This item code is for a different version of the app.', 'bad-version');
      if (decoded.code === 'too-large') return fail('This item code is too long.', 'too-large');
      return fail('This item code is damaged. Ask the DM to send it again.', 'bad-code');
    }
    if (decoded.json.length > MAX_JSON_LENGTH) return fail('This item code is too long.', 'too-large');
    let raw: unknown;
    try {
      raw = JSON.parse(decoded.json);
    } catch {
      return fail('This item code is not valid.', 'bad-json');
    }
    const checked = validateItemPayload(raw);
    if (!checked.ok) return fail(checked.error, checked.code);
    return { ok: true, payload: checked.payload };
  } catch {
    return fail('This item code is not valid.', 'bad-code');
  }
}

/** What the player sees before adding the item. */
export interface ItemPreview {
  name: string;
  category: string;
  typeDetail: string | null;
  rarity: string;
  attunement: string;
  description: string;
  source: string;
}

function attunementText(item: CatalogItem): string {
  if (!item.requiresAttunement) return 'No attunement';
  return item.attunementCondition ? `Requires attunement by ${item.attunementCondition}` : 'Requires attunement';
}

export function previewItem(p: ItemCodePayload): ItemPreview {
  const item = lookupItem(p);
  if (!item) throw new Error(`Unknown item ${p.id}`);
  return {
    name: p.name || item.name,
    category: item.category,
    typeDetail: item.typeDetail,
    rarity: item.rarity,
    attunement: attunementText(item),
    description: item.description,
    source:
      p.catalog === 's'
        ? 'SRD 5.2.1, Magic Items A-Z (CC-BY-4.0)'
        : `DMG 2024 p.${(item as DmgMagicItem).page} (paraphrased)`,
  };
}

/**
 * Build the inventory entry. Armor and weapons become custom (catalog-less)
 * armor and weapon items, exactly what "Add Custom Armor/Weapon" creates, so
 * they equip and behave the same way (custom armor does not set AC by itself).
 * Everything else is custom gear, a no-mechanics item. The details go in notes.
 */
export function inventoryItemFromCode(p: ItemCodePayload, id: string): InventoryItem {
  const pv = previewItem(p);
  const kind: InventoryItem['kind'] = pv.category === 'Armor' ? 'armor' : pv.category === 'Weapon' ? 'weapon' : 'equipment';
  const kindText = pv.typeDetail ? `${pv.category} (${pv.typeDetail})` : pv.category;
  const notes = `${kindText}, ${pv.rarity}. ${pv.attunement}.\n${pv.description}\nSource: ${pv.source}`;
  return { id, kind, name: pv.name, quantity: 1, notes };
}

/** Add the item to the character's inventory; the rest of the sheet is untouched. */
export function addItemFromCode<C extends { inventory?: InventoryItem[] }>(character: C, p: ItemCodePayload, id: string): C {
  return { ...character, inventory: [...(character.inventory ?? []), inventoryItemFromCode(p, id)] };
}
