/**
 * Resolves a name printed in a DMG 2024 Random Magic Items table to a full
 * item description (rarity, category, attunement, text).
 *
 * Lookup order (nothing is invented):
 *  1. The SRD 5.2.1 catalog (data/magic-items.ts), by exact name, by name
 *     without its printed variant ("Belt of Giant Strength (cloud)"), by the
 *     "+N" family ("Armor, +1" is in "Armor, +1, +2, or +3"), or by a renamed
 *     entry (the SRD drops possessive names, for example "Heward's Handy
 *     Haversack" is the SRD's "Handy Haversack").
 *  2. The DMG 2024 "Magic Items A-Z" entries kept in data/dmg-magic-items.ts,
 *     with the same variant rules.
 *  3. Otherwise the result is flagged: `status: 'flagged'`, no description.
 */
import { MAGIC_ITEMS, type MagicItem } from '../data/magic-items';
import { DMG_MAGIC_ITEMS, type DmgMagicItem } from '../data/dmg-magic-items';

export type ResolutionStatus = 'srd' | 'dmg' | 'flagged';

export interface ResolvedMagicItem {
  /** The name as printed in the random table. */
  name: string;
  status: ResolutionStatus;
  /** The printed qualifier ("cloud", "level 4 or 5 spell", "+2"), or null. */
  variant: string | null;
  /** The catalog name the entry resolved to, or null when flagged. */
  catalogName: string | null;
  category: string | null;
  typeDetail: string | null;
  rarity: string | null;
  requiresAttunement: boolean | null;
  attunementCondition: string | null;
  description: string | null;
  /** Where the description comes from, or why there is none. */
  source: string;
}

export const FLAGGED_NOTE = 'Description not available in sources.';

/** SRD 5.2.1 entries whose printed DMG name carries a possessive or other prefix the SRD dropped. */
export const SRD_NAME_ALIASES: Readonly<Record<string, string>> = {
  "Daern's Instant Fortress": 'Instant Fortress',
  "Heward's Handy Haversack": 'Handy Haversack',
  'Iron Bands of Bilarro': 'Iron Bands',
  "Nolzur's Marvelous Pigments": 'Marvelous Pigments',
  "Quaal's Feather Token": 'Feather Token',
  'Potion of Healing': 'Potions of Healing',
  'Stone of Good Luck': 'Stone of Good Luck (Luckstone)',
};

const lc = (s: string) => s.toLowerCase();

/** Split "Name (variant)" into the name and the variant. A trailing ", +N" is the variant of a "+N" family. */
export function splitName(printed: string): { base: string; variant: string | null; stem: string } {
  const clean = printed.replace(/\s+/g, ' ').trim();
  const paren = /^(.*?)\s*\((.*)\)$/.exec(clean);
  const base = paren ? paren[1].trim() : clean;
  const plus = /^(.*),\s*(\+\d)$/.exec(base);
  return {
    base,
    variant: paren ? paren[2].trim() : plus ? plus[2] : null,
    stem: plus ? plus[1].trim() : base,
  };
}

interface Named {
  readonly name: string;
}

function find<T extends Named>(list: readonly T[], printed: string): T | undefined {
  const { base, stem } = splitName(printed);
  const names = [printed.replace(/\s+/g, ' ').trim(), base, SRD_NAME_ALIASES[base] ?? ''].filter(Boolean).map(lc);
  const exact = list.find((i) => names.includes(lc(i.name)));
  if (exact) return exact;
  // "+N" family: "Armor, +1" is "Armor, +1, +2, or +3".
  if (stem !== base) {
    const family = list.find((i) => lc(i.name) === lc(stem) || lc(i.name).startsWith(`${lc(stem)}, +1`));
    if (family) return family;
  }
  return undefined;
}

const SRD_SOURCE = 'SRD 5.2.1, Magic Items A-Z (CC-BY-4.0)';

function fromSrd(printed: string, item: MagicItem): ResolvedMagicItem {
  return {
    name: printed,
    status: 'srd',
    variant: splitName(printed).variant,
    catalogName: item.name,
    category: item.category,
    typeDetail: item.typeDetail,
    rarity: item.rarity,
    requiresAttunement: item.requiresAttunement,
    attunementCondition: item.attunementCondition,
    description: item.description,
    source: SRD_SOURCE,
  };
}

function fromDmg(printed: string, item: DmgMagicItem): ResolvedMagicItem {
  return {
    name: printed,
    status: 'dmg',
    variant: splitName(printed).variant,
    catalogName: item.name,
    category: item.category,
    typeDetail: item.typeDetail,
    rarity: item.rarity,
    requiresAttunement: item.requiresAttunement,
    attunementCondition: item.attunementCondition,
    description: item.description,
    source: `DMG 2024 p.${item.page} (paraphrased)`,
  };
}

/** Resolve one table entry. Never throws and never invents text: an unknown item is flagged. */
export function resolveMagicItem(printed: string): ResolvedMagicItem {
  const srd = find(MAGIC_ITEMS, printed);
  if (srd) return fromSrd(printed, srd);
  const dmg = find(DMG_MAGIC_ITEMS, printed);
  if (dmg) return fromDmg(printed, dmg);
  return {
    name: printed,
    status: 'flagged',
    variant: splitName(printed).variant,
    catalogName: null,
    category: null,
    typeDetail: null,
    rarity: null,
    requiresAttunement: null,
    attunementCondition: null,
    description: null,
    source: FLAGGED_NOTE,
  };
}
