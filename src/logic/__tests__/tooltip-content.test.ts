import { describe, it, expect } from 'vitest';
import type { InventoryItem } from '../../types/character';
import {
  resolveWeaponTooltip,
  resolveArmorTooltip,
  resolveItemTooltip,
  resolveWeaponPropertyTooltip,
  resolveWeaponMasteryTooltip,
} from '../tooltip-content';

describe('resolveWeaponTooltip', () => {
  it('builds damage/properties/mastery sections for a catalog weapon', () => {
    const item: InventoryItem = { id: 'i', kind: 'weapon', catalogId: 'longsword', quantity: 1 };
    const t = resolveWeaponTooltip(item);
    expect(t?.title).toBe('Longsword');
    const labels = t!.sections.map((s) => s.label);
    expect(labels).toEqual(['Category', 'Damage', 'Properties', 'Mastery']);
    const damage = t!.sections.find((s) => s.label === 'Damage')!.text;
    expect(damage).toMatch(/1d8 slashing/);
    expect(damage).toMatch(/1d10 two-handed/); // versatile two-handed dice shown
    expect(t!.sections.find((s) => s.label === 'Mastery')!.text).toMatch(/Sap/);
  });

  it('includes a Range section for an ammunition weapon', () => {
    const item: InventoryItem = { id: 'i', kind: 'weapon', catalogId: 'shortbow', quantity: 1 };
    const t = resolveWeaponTooltip(item);
    expect(t!.sections.find((s) => s.label === 'Range')!.text).toBe('80/320 ft');
  });

  it('uses a per-instance name override in the title', () => {
    const item: InventoryItem = { id: 'i', kind: 'weapon', catalogId: 'longsword', name: 'Family Blade', quantity: 1 };
    expect(resolveWeaponTooltip(item)?.title).toBe('Family Blade');
  });

  it('returns null for a non-weapon or unknown/custom weapon', () => {
    expect(resolveWeaponTooltip({ id: 'i', kind: 'armor', catalogId: 'shield', quantity: 1 })).toBeNull();
    expect(resolveWeaponTooltip({ id: 'i', kind: 'weapon', quantity: 1 })).toBeNull();
    expect(resolveWeaponTooltip({ id: 'i', kind: 'weapon', catalogId: 'nope', quantity: 1 })).toBeNull();
  });
});

describe('resolveArmorTooltip', () => {
  it('describes base AC, Dex cap, Strength requirement, and stealth for heavy armor', () => {
    const item: InventoryItem = { id: 'i', kind: 'armor', catalogId: 'plate-armor', quantity: 1 };
    const t = resolveArmorTooltip(item);
    expect(t?.title).toBe('Plate Armor');
    expect(t!.sections.find((s) => s.label === 'Base AC')!.text).toBe('18');
    expect(t!.sections.find((s) => s.label === 'Dexterity')!.text).toMatch(/No Dexterity/);
    expect(t!.sections.find((s) => s.label === 'Strength')!.text).toMatch(/Strength 15/);
    expect(t!.sections.find((s) => s.label === 'Stealth')!.text).toMatch(/Disadvantage/);
  });

  it('caps Dex for medium armor and reports the shield bonus', () => {
    const medium = resolveArmorTooltip({ id: 'i', kind: 'armor', catalogId: 'chain-shirt', quantity: 1 });
    expect(medium!.sections.find((s) => s.label === 'Dexterity')!.text).toMatch(/maximum \+2/);
    const shield = resolveArmorTooltip({ id: 'i', kind: 'armor', catalogId: 'shield', quantity: 1 });
    expect(shield!.sections.find((s) => s.label === 'AC Bonus')!.text).toBe('+2');
  });

  it('returns null for a non-armor or unknown armor', () => {
    expect(resolveArmorTooltip({ id: 'i', kind: 'weapon', catalogId: 'mace', quantity: 1 })).toBeNull();
    expect(resolveArmorTooltip({ id: 'i', kind: 'armor', catalogId: 'nope', quantity: 1 })).toBeNull();
  });
});

describe('resolveItemTooltip', () => {
  it('returns the paraphrased description for a catalog equipment item', () => {
    const item: InventoryItem = { id: 'i', kind: 'equipment', catalogId: 'acid', quantity: 1 };
    const t = resolveItemTooltip(item);
    expect(t?.title).toBe('Acid');
    expect(t!.sections[0].text).toMatch(/2d6 Acid/);
  });

  it('returns null for a non-equipment item or a custom item with no catalogId', () => {
    expect(resolveItemTooltip({ id: 'i', kind: 'weapon', catalogId: 'mace', quantity: 1 })).toBeNull();
    expect(resolveItemTooltip({ id: 'i', kind: 'equipment', name: 'Trinket', quantity: 1 })).toBeNull();
    expect(resolveItemTooltip({ id: 'i', kind: 'equipment', catalogId: 'nope', quantity: 1 })).toBeNull();
  });
});

describe('resolveWeaponPropertyTooltip / resolveWeaponMasteryTooltip', () => {
  it('returns the PHB-cited property definition', () => {
    const t = resolveWeaponPropertyTooltip('versatile');
    expect(t?.title).toBe('Versatile');
    expect(t!.sections[0].text).toMatch(/one or two hands/i);
  });

  it('returns the PHB-cited mastery definition with operative detail', () => {
    const t = resolveWeaponMasteryTooltip('topple');
    expect(t?.title).toMatch(/Topple/);
    expect(t!.sections[0].text).toMatch(/Constitution saving throw/);
  });
});
