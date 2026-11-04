import { describe, it, expect } from 'vitest';
import {
  resolveEquipment,
  resolveEquipmentRandom,
  NAME_NORMALISATION,
  type ResolvedItem,
} from '../equipment-resolver';
import type { RNG } from '../random';
import { WEAPON_LIST } from '../../data/weapons';

/** A deterministic RNG that always returns the same float (for " or " picks). */
function constRng(value: number): RNG {
  return () => value;
}

describe('resolveEquipment (default path — preserves player choice)', () => {
  it('exact weapon match → a weapon item referencing the catalog', () => {
    const result = resolveEquipment('Greataxe');
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('weapon');
    if (result[0].kind === 'weapon') {
      expect(result[0].item.catalogId).toBe('greataxe');
      expect(result[0].item.quantity).toBe(1);
    }
  });

  it('exact armor match → an armor item referencing the catalog', () => {
    const result = resolveEquipment('Chain Mail');
    expect(result[0].kind).toBe('armor');
    if (result[0].kind === 'armor') expect(result[0].item.catalogId).toBe('chain-mail');
  });

  it('exact equipment match → an equipment item referencing the catalog', () => {
    const result = resolveEquipment('Rope');
    expect(result[0].kind).toBe('equipment');
    if (result[0].kind === 'equipment') expect(result[0].item.catalogId).toBe('rope');
  });

  it('compound entry → multiple items (weapon + ammunition), quantity preserved', () => {
    const result = resolveEquipment('Longbow and 20 Arrows');
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('weapon');
    if (result[0].kind === 'weapon') expect(result[0].item.catalogId).toBe('longbow');
    expect(result[1].kind).toBe('equipment');
    if (result[1].kind === 'equipment') {
      expect(result[1].item.catalogId).toBe('arrows');
      expect(result[1].item.quantity).toBe(20);
    }
  });

  it('" and " split → resolves every part', () => {
    const result = resolveEquipment('Mace and Rope');
    expect(result).toHaveLength(2);
    if (result[0].kind === 'weapon') expect(result[0].item.catalogId).toBe('mace');
    if (result[1].kind === 'equipment') expect(result[1].item.catalogId).toBe('rope');
  });

  it('" or " split → an UNRESOLVED choice (not a silent pick)', () => {
    const result = resolveEquipment('Greataxe or Longsword');
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('choice');
    if (result[0].kind === 'choice') {
      expect(result[0].options).toEqual(['Greataxe', 'Longsword']);
    }
  });

  it('a genuine player-choice grant is preserved, not randomized', () => {
    // Finding #2: "Artisan's Tools or Musical Instrument" must NOT become a
    // single random item — the player decides.
    const result = resolveEquipment("Artisan's Tools or Musical Instrument");
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('choice');
    if (result[0].kind === 'choice') {
      expect(result[0].options).toEqual(["Artisan's Tools", 'Musical Instrument']);
    }
  });

  it('generic weapon category → an unresolved choice over the eligible catalog weapons', () => {
    const result = resolveEquipment('Any Martial Weapon');
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('choice');
    if (result[0].kind === 'choice') {
      const expected = WEAPON_LIST.filter((w) => w.category === 'martial').map((w) => w.name);
      expect(result[0].options).toEqual(expected);
      expect(result[0].options).toContain('Longsword');
      // It must NOT be silently defaulted to one fixed weapon.
      expect(result[0].options.length).toBeGreaterThan(1);
    }
  });

  it('generic simple-weapon category lists only simple weapons', () => {
    const result = resolveEquipment('Any Simple Weapon');
    if (result[0].kind === 'choice') {
      const simple = WEAPON_LIST.filter((w) => w.category === 'simple').map((w) => w.name);
      expect(result[0].options).toEqual(simple);
      expect(result[0].options).not.toContain('Greatsword'); // martial
    }
  });

  it('plural normalisation maps to the singular catalog name', () => {
    expect(NAME_NORMALISATION['Handaxes']).toBe('Handaxe');
  });

  it('leading quantity phrase → sets quantity on a concrete catalog item', () => {
    const result = resolveEquipment('4 Handaxes');
    expect(result[0].kind).toBe('weapon');
    if (result[0].kind === 'weapon') {
      expect(result[0].item.catalogId).toBe('handaxe');
      expect(result[0].item.quantity).toBe(4);
    }
  });

  it('fallback → a custom-named equipment item with parsed quantity', () => {
    const result = resolveEquipment('3 Unknown Trinkets');
    expect(result[0].kind).toBe('equipment');
    if (result[0].kind === 'equipment') {
      expect(result[0].item.catalogId).toBeUndefined();
      expect(result[0].item.name).toBe('Unknown Trinkets');
      expect(result[0].item.quantity).toBe(3);
    }
  });

  it('prototype-pollution guard: "__proto__" never matches a map and falls through to fallback', () => {
    const result = resolveEquipment('__proto__');
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('equipment');
    if (result[0].kind === 'equipment') {
      expect(result[0].item.name).toBe('__proto__');
      expect(result[0].item.catalogId).toBeUndefined();
    }
  });

  it('assigns a unique instance id to each resolved item', () => {
    const result = resolveEquipment('Mace and Rope');
    const ids = result
      .filter((r): r is Extract<ResolvedItem, { item: unknown }> => r.kind !== 'choice')
      .map((r) => r.item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('resolveEquipmentRandom (explicit random workflow — the only RNG path)', () => {
  it('picks exactly one option for a " or " choice via the seeded RNG', () => {
    // rng 0 → first (Greataxe), rng 0.99 → last (Longsword).
    const first = resolveEquipmentRandom('Greataxe or Longsword', constRng(0));
    expect(first).toHaveLength(1);
    if (first[0].kind === 'weapon') expect(first[0].item.catalogId).toBe('greataxe');

    const second = resolveEquipmentRandom('Greataxe or Longsword', constRng(0.99));
    if (second[0].kind === 'weapon') expect(second[0].item.catalogId).toBe('longsword');
  });

  it('resolves a generic category by picking one eligible weapon', () => {
    const result = resolveEquipmentRandom('Any Simple Weapon', constRng(0));
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('weapon');
  });

  it('leaves no unresolved choice entries behind', () => {
    const result = resolveEquipmentRandom('Greataxe or Longsword', constRng(0.5));
    expect(result.every((r) => r.kind !== 'choice')).toBe(true);
  });
});
