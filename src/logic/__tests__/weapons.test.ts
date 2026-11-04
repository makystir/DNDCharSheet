import { describe, it, expect } from 'vitest';
import type { InventoryItem } from '../../types/character';
import { hasWeaponProperty, resolveWeapon } from '../weapons';
import { getWeapon } from '../../data/weapons';

describe('hasWeaponProperty', () => {
  it('returns true for a property the weapon has', () => {
    expect(hasWeaponProperty(getWeapon('longsword')!, 'versatile')).toBe(true);
    expect(hasWeaponProperty(getWeapon('shortbow')!, 'ammunition')).toBe(true);
  });

  it('returns false for a property the weapon lacks', () => {
    expect(hasWeaponProperty(getWeapon('longsword')!, 'heavy')).toBe(false);
    expect(hasWeaponProperty(getWeapon('mace')!, 'finesse')).toBe(false);
  });
});

describe('resolveWeapon', () => {
  it('resolves a weapon inventory item to its catalog entry', () => {
    const item: InventoryItem = { id: 'i', kind: 'weapon', catalogId: 'longsword', quantity: 1 };
    const resolved = resolveWeapon(item);
    expect(resolved?.name).toBe('Longsword');
  });

  it('returns undefined for a non-weapon item', () => {
    const item: InventoryItem = { id: 'i', kind: 'equipment', catalogId: 'rope', quantity: 1 };
    expect(resolveWeapon(item)).toBeUndefined();
  });

  it('returns undefined for a weapon item with no catalogId (custom)', () => {
    const item: InventoryItem = { id: 'i', kind: 'weapon', name: 'Homebrew Blade', quantity: 1 };
    expect(resolveWeapon(item)).toBeUndefined();
  });

  it('returns undefined for an unknown catalogId', () => {
    const item: InventoryItem = { id: 'i', kind: 'weapon', catalogId: 'not-a-weapon', quantity: 1 };
    expect(resolveWeapon(item)).toBeUndefined();
  });

  it('accepts an injected catalog lookup (data seam)', () => {
    const item: InventoryItem = { id: 'i', kind: 'weapon', catalogId: 'x', quantity: 1 };
    const fake = resolveWeapon(item, () => getWeapon('rapier'));
    expect(fake?.name).toBe('Rapier');
  });

  it('applies a per-instance name override (merged result)', () => {
    const item: InventoryItem = { id: 'i', kind: 'weapon', catalogId: 'longsword', name: 'Family Blade', quantity: 1 };
    const resolved = resolveWeapon(item);
    expect(resolved?.name).toBe('Family Blade'); // override applied
    expect(resolved?.damageDice).toBe('1d8'); // catalog stats preserved
    expect(resolved?.mastery).toBe('sap');
  });

  it('applies a per-instance weight override (merged result)', () => {
    const item: InventoryItem = { id: 'i', kind: 'weapon', catalogId: 'longsword', weightLb: 2.5, quantity: 1 };
    const resolved = resolveWeapon(item);
    expect(resolved?.weightLb).toBe(2.5); // override applied
    expect(resolved?.name).toBe('Longsword'); // untouched
  });

  it('does not mutate the catalog entry when applying overrides', () => {
    const before = getWeapon('longsword')!;
    const item: InventoryItem = { id: 'i', kind: 'weapon', catalogId: 'longsword', name: 'X', weightLb: 99, quantity: 1 };
    resolveWeapon(item);
    expect(getWeapon('longsword')!.name).toBe('Longsword');
    expect(getWeapon('longsword')!.weightLb).toBe(before.weightLb);
  });
});
