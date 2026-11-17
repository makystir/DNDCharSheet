/**
 * ORACLE test for the SRD 5.2.1 magic item catalog (src/data/magic-items.ts).
 *
 * The expected count (257) was taken from the source document itself, two
 * independent ways: 257 item headings in "Magic Items A-Z" and 257 category/rarity
 * lines directly under them.
 */
import { describe, it, expect } from 'vitest';
import { MAGIC_ITEMS, getMagicItem } from '../magic-items';

const SRD_MAGIC_ITEM_COUNT = 257;
const CATEGORIES = ['Armor', 'Weapon', 'Wondrous Item', 'Potion', 'Ring', 'Rod', 'Scroll', 'Staff', 'Wand'];
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

describe('magic item catalog oracle', () => {
  it('has every item in the SRD 5.2.1 Magic Items A-Z section', () => {
    expect(MAGIC_ITEMS.length).toBe(SRD_MAGIC_ITEM_COUNT);
  });

  it('has no duplicate names or ids', () => {
    expect(new Set(MAGIC_ITEMS.map((i) => i.name)).size).toBe(MAGIC_ITEMS.length);
    expect(new Set(MAGIC_ITEMS.map((i) => i.id)).size).toBe(MAGIC_ITEMS.length);
  });

  it.each(MAGIC_ITEMS.map((i) => [i.name, i] as const))('%s is structurally complete', (_name, item) => {
    expect(item.name.trim()).not.toBe('');
    expect(item.rarity.trim()).not.toBe('');
    expect(item.description.trim()).not.toBe('');
    expect(CATEGORIES).toContain(item.category);
    for (const r of item.rarities) expect(RARITIES).toContain(r);
    if (item.rarities.length === 0) expect(item.rarity).toBe('Rarity Varies');
    if (item.attunementCondition !== null) expect(item.requiresAttunement).toBe(true);
  });

  it('transcribes spot-checked items exactly', () => {
    const holy = getMagicItem('holy-avenger');
    expect(holy?.category).toBe('Weapon');
    expect(holy?.rarity).toBe('Legendary');
    expect(holy?.requiresAttunement).toBe(true);
    expect(holy?.attunementCondition).toBe('a Paladin');
    const bag = getMagicItem('bag-of-holding');
    expect(bag?.rarity).toBe('Uncommon');
    expect(bag?.requiresAttunement).toBe(false);
    expect(getMagicItem('dragon-orb')?.rarity).toBe('Artifact');
    expect(getMagicItem('potions-of-healing')?.description).toContain('2d4 + 2');
    expect(getMagicItem('ring-of-protection')?.requiresAttunement).toBe(true);
  });
});
