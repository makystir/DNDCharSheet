import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Character, InventoryItem } from '../../types/character';
import { BLANK_CHARACTER } from '../../types/character';
import type { CurrencyAmount } from '../currency';
import { ZERO_CURRENCY } from '../currency';
import {
  CARRY_MULTIPLIER,
  carryingCapacityBreakdown,
  coinWeightLb,
  coinWeightBreakdown,
  totalCoins,
  carriedWeightBreakdown,
  getEncumbranceLevel,
  formatEncumbrance,
} from '../encumbrance';

function charWithStr(str: number, inventory?: InventoryItem[]): Character {
  return {
    ...BLANK_CHARACTER,
    abilities: { ...BLANK_CHARACTER.abilities, str },
    inventory,
  };
}

function coins(partial: Partial<CurrencyAmount>): CurrencyAmount {
  return { ...ZERO_CURRENCY, ...partial };
}

/** Assert the Breakdown invariant: components always sum to total. */
function assertComponentsSumToTotal(bd: { total: number; components: { value: number }[] }) {
  const sum = bd.components.reduce((s, c) => s + c.value, 0);
  expect(sum).toBe(bd.total);
}

describe('carryingCapacityBreakdown', () => {
  it('Str 10 → 150, Str 14 → 210, Str 20 → 300 (Small/Medium ×15)', () => {
    expect(carryingCapacityBreakdown(charWithStr(10)).total).toBe(150);
    expect(carryingCapacityBreakdown(charWithStr(14)).total).toBe(210);
    expect(carryingCapacityBreakdown(charWithStr(20)).total).toBe(300);
  });

  it('is modelled as a single additive component (product → one component + note)', () => {
    const bd = carryingCapacityBreakdown(charWithStr(14));
    expect(bd.components).toEqual([{ label: 'Str 14 × 15', value: 210 }]);
    assertComponentsSumToTotal(bd);
    expect(bd.note).toBe('Strength 14 × 15 (Small/Medium) = 210 lb');
  });

  it('size multiplier table matches the PHB 2024 Carrying Capacity rows', () => {
    // Confirms the multiplier constants even though species data only yields ×15 today.
    expect(CARRY_MULTIPLIER.tiny).toBe(7.5);
    expect(CARRY_MULTIPLIER.small).toBe(15);
    expect(CARRY_MULTIPLIER.medium).toBe(15);
    expect(CARRY_MULTIPLIER.large).toBe(30);
    expect(CARRY_MULTIPLIER.huge).toBe(60);
    expect(CARRY_MULTIPLIER.gargantuan).toBe(120);
  });

  it('property: total is always Str × 15 for the current (Small/Medium) data', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), (str) => {
        const bd = carryingCapacityBreakdown(charWithStr(str));
        expect(bd.total).toBe(str * 15);
        assertComponentsSumToTotal(bd);
      }),
    );
  });
});

describe('coin weight', () => {
  it('50 coins → 1 lb', () => {
    expect(coinWeightLb(coins({ gp: 50 }))).toBe(1);
  });

  it('149 coins → 2 lb (floor: 149 / 50 = 2.98 → 2)', () => {
    expect(coinWeightLb(coins({ gp: 149 }))).toBe(2);
  });

  it('under 50 coins → 0 lb', () => {
    expect(coinWeightLb(coins({ gp: 49 }))).toBe(0);
    expect(coinWeightLb(ZERO_CURRENCY)).toBe(0);
  });

  it('mixed denominations are summed as a coin COUNT (no value conversion)', () => {
    // 10 + 20 + 10 + 10 + 10 = 60 coins → 1 lb (NOT weighted by GP value).
    const purse = coins({ pp: 10, gp: 20, ep: 10, sp: 10, cp: 10 });
    expect(totalCoins(purse)).toBe(60);
    expect(coinWeightLb(purse)).toBe(1);
  });

  it('coinWeightBreakdown: per-denomination counts sum to the coin total, weight in note', () => {
    const purse = coins({ pp: 10, gp: 20, ep: 10, sp: 10, cp: 10 });
    const bd = coinWeightBreakdown(purse);
    expect(bd.total).toBe(60);
    assertComponentsSumToTotal(bd);
    expect(bd.components.map((c) => c.label)).toEqual(['PP', 'GP', 'EP', 'SP', 'CP']);
    expect(bd.note).toBe('60 coins ÷ 50 (PHB: 50 coins = 1 lb) = 1 lb');
  });
});

describe('carriedWeightBreakdown', () => {
  it('a 20-arrow stack contributes 1 lb via effectiveStack (not 20×)', () => {
    const arrows: InventoryItem = { id: 'a1', kind: 'equipment', catalogId: 'arrows', quantity: 20 };
    const bd = carriedWeightBreakdown(charWithStr(10, [arrows]));
    const gear = bd.components.find((c) => c.label === 'Other gear');
    expect(gear?.value).toBe(1);
  });

  it('10 arrows contribute 0.5 lb (proportional half-bundle)', () => {
    const arrows: InventoryItem = { id: 'a1', kind: 'equipment', catalogId: 'arrows', quantity: 10 };
    const bd = carriedWeightBreakdown(charWithStr(10, [arrows]));
    expect(bd.components.find((c) => c.label === 'Other gear')?.value).toBe(0.5);
  });

  it('groups weapons, armor, and other gear and sums to the total', () => {
    const inventory: InventoryItem[] = [
      { id: 'w1', kind: 'weapon', catalogId: 'longsword', quantity: 1 }, // 3 lb
      { id: 'ar1', kind: 'armor', catalogId: 'chain-mail', quantity: 1 }, // 55 lb
      { id: 'g1', kind: 'equipment', catalogId: 'backpack', quantity: 1 }, // 5 lb
    ];
    const bd = carriedWeightBreakdown(charWithStr(15, inventory));
    const byLabel = Object.fromEntries(bd.components.map((c) => [c.label, c.value]));
    expect(byLabel['Weapons']).toBe(3);
    expect(byLabel['Armor']).toBe(55);
    expect(byLabel['Other gear']).toBe(5);
    expect(byLabel['Coins']).toBe(0);
    assertComponentsSumToTotal(bd);
    expect(bd.total).toBe(63);
  });

  it('respects a per-instance weight override on a custom item', () => {
    const custom: InventoryItem = { id: 'c1', kind: 'equipment', name: 'Odd trinket', quantity: 3, weightLb: 2 };
    const bd = carriedWeightBreakdown(charWithStr(10, [custom]));
    expect(bd.components.find((c) => c.label === 'Other gear')?.value).toBe(6);
  });

  it('empty inventory yields a zero total with all component groups present (incl. zeros)', () => {
    const bd = carriedWeightBreakdown(charWithStr(10));
    expect(bd.total).toBe(0);
    expect(bd.components.map((c) => c.label)).toEqual(['Weapons', 'Armor', 'Other gear', 'Coins']);
    assertComponentsSumToTotal(bd);
  });
});

describe('getEncumbranceLevel (RAW 2024 default is binary)', () => {
  it('is neutral at or under capacity', () => {
    expect(getEncumbranceLevel(100, 150)).toBe('neutral');
    expect(getEncumbranceLevel(150, 150)).toBe('neutral');
  });

  it('is over above capacity', () => {
    expect(getEncumbranceLevel(151, 150)).toBe('over');
  });

  it('never returns a variant band without the house-rule flag', () => {
    // Even far over Str×10 (a variant threshold), RAW stays binary.
    expect(getEncumbranceLevel(999, 150, 10)).toBe('over');
    expect(getEncumbranceLevel(999, 150, 10, false)).toBe('over');
  });
});

describe('getEncumbranceLevel (variant bands — opt-in house rule ONLY)', () => {
  it('encumbered above Str×5, heavily encumbered above Str×10', () => {
    const str = 10; // Str×5 = 50, Str×10 = 100
    expect(getEncumbranceLevel(40, 150, str, true)).toBe('neutral');
    expect(getEncumbranceLevel(51, 150, str, true)).toBe('encumbered');
    expect(getEncumbranceLevel(101, 150, str, true)).toBe('heavilyEncumbered');
  });

  it('still flags plain over-capacity between Str×5 and the capacity', () => {
    // Str 20: Str×5 = 100, capacity = 300. 120 is over Str×5 → encumbered.
    expect(getEncumbranceLevel(120, 300, 20, true)).toBe('encumbered');
    // At/under Str×5 but over capacity cannot happen when capacity = Str×15 > Str×10,
    // so the explicit over branch is exercised with a small manual capacity.
    expect(getEncumbranceLevel(60, 50, 10, true)).toBe('encumbered'); // 60 > Str×5 (50)
  });

  it('the variant bands are unreachable when strengthScore is omitted', () => {
    expect(getEncumbranceLevel(999, 150, undefined, true)).toBe('over');
  });
});

describe('formatEncumbrance', () => {
  it('formats as "current / max lb"', () => {
    expect(formatEncumbrance(12, 210)).toBe('12 / 210 lb');
  });
});
