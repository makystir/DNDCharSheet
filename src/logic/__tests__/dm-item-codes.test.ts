import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import { MAGIC_ITEMS } from '../../data/magic-items';
import { DMG_MAGIC_ITEMS } from '../../data/dmg-magic-items';
import { resolveMagicItem } from '../magic-item-resolve';
import { characterArmorClassBreakdown } from '../armor-class';
import { encodeSharePayload } from '../share-codec';
import { encodeAward } from '../dm-awards';
import type { InventoryItem } from '../../types/character';
import {
  addItemFromCode,
  decodeItemCode,
  encodeItemCode,
  inventoryItemFromCode,
  ITEM_PREFIX,
  MAX_ITEM_CODE_CHARS,
} from '../dm-item-codes';

const srdArmor = MAGIC_ITEMS.find((i) => i.category === 'Armor' && !i.name.includes('+'))!;
const srdWeapon = MAGIC_ITEMS.find((i) => i.category === 'Weapon' && !i.name.includes('+'))!;
const srdWondrous = MAGIC_ITEMS.find((i) => i.category === 'Wondrous Item')!;
const dmgItem = DMG_MAGIC_ITEMS.find((i) => resolveMagicItem(i.name).status === 'dmg' && i.category === 'Wondrous Item')!;

async function payloadOf(printed: string) {
  const enc = await encodeItemCode(resolveMagicItem(printed));
  if (!enc.ok) throw new Error(enc.error);
  expect(enc.code.startsWith(ITEM_PREFIX)).toBe(true);
  const dec = await decodeItemCode(enc.code);
  if (!dec.ok) throw new Error(dec.error);
  return dec.payload;
}

describe('dm item codes', () => {
  it('round-trips an SRD item by catalog id', async () => {
    const p = await payloadOf(srdWondrous.name);
    expect(p).toEqual({ catalog: 's', id: srdWondrous.id, name: '' });
  });

  it('round-trips a DMG item by catalog id', async () => {
    const p = await payloadOf(dmgItem.name);
    expect(p).toEqual({ catalog: 'd', id: dmgItem.id, name: '' });
  });

  it('keeps a rolled variant name', async () => {
    const p = await payloadOf('Belt of Giant Strength (cloud)');
    expect(p.name).toBe('Belt of Giant Strength (cloud)');
    expect(inventoryItemFromCode(p, 'x').name).toBe('Belt of Giant Strength (cloud)');
  });

  it('refuses to share a flagged item', async () => {
    const enc = await encodeItemCode(resolveMagicItem('Totally Made Up Item'));
    expect(enc.ok).toBe(false);
  });

  it('redeeming adds a gear entry and leaves existing inventory untouched', async () => {
    const base = createCharacter('T');
    const existing: InventoryItem = { id: 'keep', kind: 'equipment', catalogId: 'rope-hempen-50-feet', quantity: 2 };
    const c = { ...base, inventory: [existing] };
    const p = await payloadOf(dmgItem.name);
    const next = addItemFromCode(c, p, 'new1');
    expect(next.inventory).toHaveLength(2);
    expect(next.inventory![0]).toBe(existing);
    const added = next.inventory![1];
    expect(added).toMatchObject({ id: 'new1', kind: 'equipment', name: dmgItem.name, quantity: 1 });
    expect(added.catalogId).toBeUndefined();
    expect(added.notes).toContain(dmgItem.description);
    expect(added.notes).toContain(`DMG 2024 p.${dmgItem.page} (paraphrased)`);
    expect(c.inventory).toHaveLength(1);
  });

  it('SRD items carry the verbatim description', async () => {
    const added = inventoryItemFromCode(await payloadOf(srdWondrous.name), 'a');
    expect(added.notes).toContain(srdWondrous.description);
  });

  it('armor and weapons become custom armor and weapon items', async () => {
    const armor = inventoryItemFromCode(await payloadOf(srdArmor.name), 'a');
    const weapon = inventoryItemFromCode(await payloadOf(srdWeapon.name), 'w');
    expect(armor.kind).toBe('armor');
    expect(weapon.kind).toBe('weapon');
    expect(armor.catalogId).toBeUndefined();
  });

  it('redeemed armor affects AC exactly like a manually added custom armor', async () => {
    const base = createCharacter('T');
    const manual: InventoryItem = { id: 'm', kind: 'armor', name: 'Custom', quantity: 1 };
    const viaCode = inventoryItemFromCode(await payloadOf(srdArmor.name), 'c');
    const acOf = (item: InventoryItem) =>
      characterArmorClassBreakdown({ ...base, inventory: [item], equipped: { armorItemId: item.id } }).total;
    expect(acOf(viaCode)).toBe(acOf(manual));
  });

  it('rejects bad input with a clear error', async () => {
    const cases: [string, string][] = [
      ['', 'empty'],
      ['hello', 'not-item'],
      ['https://x/#view/abc', 'looks-like-other'],
      [ITEM_PREFIX + 'A'.repeat(MAX_ITEM_CODE_CHARS), 'too-large'],
      [ITEM_PREFIX + '!!!', 'bad-code'],
      [ITEM_PREFIX + 'abcdef', 'bad-version'],
    ];
    for (const [text, code] of cases) {
      const r = await decodeItemCode(text);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe(code);
        expect(r.error.length).toBeGreaterThan(0);
      }
    }
    const award = await encodeAward({ kind: 'xp', amount: 100, id: 'abcdefgh1234', label: '' });
    if (!award.ok) throw new Error('award');
    const r = await decodeItemCode(award.code);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('looks-like-other');
  });

  it('rejects well-formed envelopes with a bad or unknown payload', async () => {
    const wrap = async (obj: unknown) => decodeItemCode(ITEM_PREFIX + (await encodeSharePayload(JSON.stringify(obj))));
    expect((await wrap({ t: 'item', c: 's', i: 'no-such-item' })).ok).toBe(false);
    expect((await wrap({ t: 'item', c: 'x', i: 'a' })).ok).toBe(false);
    expect((await wrap({ t: 'award', c: 's', i: srdWondrous.id })).ok).toBe(false);
    expect((await wrap([1, 2])).ok).toBe(false);
    const notJson = await decodeItemCode(ITEM_PREFIX + (await encodeSharePayload('not json')));
    expect(notJson.ok).toBe(false);
    // An SRD id under the DMG catalog does not resolve.
    expect((await wrap({ t: 'item', c: 'd', i: srdWondrous.id })).ok).toBe(false);
  });
});
