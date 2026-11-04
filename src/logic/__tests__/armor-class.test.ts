import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { AbilityScores } from '../../types/character';
import { abilityModifier } from '../abilities';
import { baseArmorClass, armorClassBreakdown } from '../armor-class';
import { getArmor, type ArmorData } from '../../data/armor';

function scoresWithDex(dex: number): AbilityScores {
  return { str: 10, dex, con: 10, int: 10, wis: 10, cha: 10 };
}

/** The sum-to-total invariant every Breakdown must honour. */
function sumsToTotal(bd: { total: number; components: { value: number }[] }): boolean {
  return bd.components.reduce((s, c) => s + c.value, 0) === bd.total;
}

// Resolve the real catalog armor the gate exercises (A1 ArmorData).
const LEATHER = getArmor('leather-armor') as ArmorData; // light, base 11, full Dex
const CHAIN_SHIRT = getArmor('chain-shirt') as ArmorData; // medium, base 13, Dex max 2
const PLATE = getArmor('plate-armor') as ArmorData; // heavy, base 18, no Dex
const SHIELD = getArmor('shield') as ArmorData; // +2 bonus

describe('baseArmorClass', () => {
  it('is 10 + Dex modifier', () => {
    expect(baseArmorClass(0)).toBe(10);
    expect(baseArmorClass(3)).toBe(13);
    expect(baseArmorClass(-1)).toBe(9);
  });
});

describe('armorClassBreakdown — unarmored', () => {
  it('no override, no armor: Base 10 + Dex mod + Shield 0 + Other 0, no note', () => {
    const bd = armorClassBreakdown(scoresWithDex(14)); // +2
    expect(bd.total).toBe(12);
    expect(bd.components).toEqual([
      { label: 'Base', value: 10 },
      { label: 'Dex mod', value: 2 },
      { label: 'Shield', value: 0 },
      { label: 'Other', value: 0 },
    ]);
    expect(bd.note).toBeUndefined();
    expect(sumsToTotal(bd)).toBe(true);
  });

  it('unarmored + shield: 10 + Dex + 2', () => {
    const bd = armorClassBreakdown(scoresWithDex(14), undefined, { shield: SHIELD });
    expect(bd.total).toBe(14); // 10 + 2 + 2
    expect(bd.components.find((c) => c.label === 'Shield')?.value).toBe(2);
    expect(sumsToTotal(bd)).toBe(true);
  });
});

describe('armorClassBreakdown — light armor (full Dex)', () => {
  it('leather base 11 + full Dex (+3)', () => {
    const bd = armorClassBreakdown(scoresWithDex(16), undefined, { armor: LEATHER }); // Dex +3
    expect(bd.total).toBe(14); // 11 + 3 + 0 + 0
    expect(bd.components).toEqual([
      { label: `Armor base (${LEATHER.name})`, value: 11 },
      { label: 'Dex mod', value: 3 },
      { label: 'Shield', value: 0 },
      { label: 'Other', value: 0 },
    ]);
    expect(bd.note).toBeUndefined();
    expect(sumsToTotal(bd)).toBe(true);
  });
});

describe('armorClassBreakdown — medium armor (Dex capped at +2)', () => {
  it('chain shirt base 13 + Dex +3 → applied +2, cap note present', () => {
    const bd = armorClassBreakdown(scoresWithDex(16), undefined, { armor: CHAIN_SHIRT }); // Dex +3
    expect(bd.total).toBe(15); // 13 + 2(capped) + 0 + 0
    const dex = bd.components.find((c) => c.label.startsWith('Dex'));
    expect(dex?.value).toBe(2); // APPLIED value, not +3
    expect(dex?.label).toBe('Dex mod (max +2)');
    expect(bd.note).toContain('capped');
    expect(bd.note).toContain('+2');
    expect(sumsToTotal(bd)).toBe(true);
  });

  it('chain shirt + Dex +1 → applied +1, no cap note (under the cap)', () => {
    const bd = armorClassBreakdown(scoresWithDex(12), undefined, { armor: CHAIN_SHIRT }); // Dex +1
    expect(bd.total).toBe(14); // 13 + 1
    expect(bd.components.find((c) => c.label.startsWith('Dex'))?.value).toBe(1);
    expect(bd.note).toBeUndefined();
    expect(sumsToTotal(bd)).toBe(true);
  });
});

describe('armorClassBreakdown — heavy armor (no Dex)', () => {
  it('plate base 18, Dex contributes 0 with a heavy-armor note', () => {
    const bd = armorClassBreakdown(scoresWithDex(16), undefined, { armor: PLATE }); // Dex +3
    expect(bd.total).toBe(18); // 18 + 0 + 0 + 0
    expect(bd.components.find((c) => c.label === 'Dex mod')?.value).toBe(0);
    expect(bd.note).toContain('heavy armor');
    expect(sumsToTotal(bd)).toBe(true);
  });
});

describe('armorClassBreakdown — shield stacks (+2)', () => {
  it('chain shirt + shield + capped Dex', () => {
    const bd = armorClassBreakdown(scoresWithDex(16), undefined, {
      armor: CHAIN_SHIRT,
      shield: SHIELD,
    });
    expect(bd.total).toBe(17); // 13 + 2(capped) + 2(shield) + 0
    expect(bd.components.find((c) => c.label === 'Shield')?.value).toBe(2);
    expect(sumsToTotal(bd)).toBe(true);
  });
});

describe('armorClassBreakdown — manual override supersedes', () => {
  it('override beats unarmored: total === override, base only in note', () => {
    const bd = armorClassBreakdown(scoresWithDex(14), 18);
    expect(bd.total).toBe(18);
    expect(bd.components).toEqual([{ label: 'Manual override', value: 18 }]);
    expect(bd.components.length).toBe(1);
    expect(sumsToTotal(bd)).toBe(true);
    expect(bd.note).toContain('12'); // computed unarmored base (10 + 2)
    expect(bd.note).toContain('superseded');
  });

  it('override beats armored+shield: note names the superseded computed AC', () => {
    const bd = armorClassBreakdown(scoresWithDex(16), 20, {
      armor: CHAIN_SHIRT,
      shield: SHIELD,
    });
    expect(bd.total).toBe(20);
    expect(bd.components).toEqual([{ label: 'Manual override', value: 20 }]);
    // Computed would be 13 + 2 + 2 = 17.
    expect(bd.note).toContain('17');
    expect(bd.note).toContain('superseded');
    expect(sumsToTotal(bd)).toBe(true);
  });
});

describe('armorClassBreakdown — worn catalog-less armour (finding #3)', () => {
  it('names the ignored worn armour in a note without changing total/components', () => {
    const plain = armorClassBreakdown(scoresWithDex(14)); // unarmored 12, no note
    const withWorn = armorClassBreakdown(scoresWithDex(14), undefined, {
      wornArmorIgnoredName: 'Dragon Scale (custom)',
    });
    // Total and components are unchanged (unarmored) — only the note differs.
    expect(withWorn.total).toBe(plain.total);
    expect(withWorn.components).toEqual(plain.components);
    expect(withWorn.note).toContain('Dragon Scale (custom)');
    expect(withWorn.note).toContain('unarmored');
    expect(sumsToTotal(withWorn)).toBe(true);
  });
});

describe('armorClassBreakdown — deferred unarmored-defense hook', () => {
  it('accepts unarmoredDefenseAbility but does not yet change the result (deferred)', () => {
    const withHook = armorClassBreakdown(scoresWithDex(14), undefined, {
      unarmoredDefenseAbility: 'con',
    });
    const without = armorClassBreakdown(scoresWithDex(14));
    expect(withHook.total).toBe(without.total);
    expect(withHook.components).toEqual(without.components);
  });
});

describe('armorClassBreakdown — invariants (property)', () => {
  it('every breakdown component sums to total across the whole armor catalog', () => {
    const armors = [undefined, LEATHER, CHAIN_SHIRT, PLATE];
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.option(fc.integer({ min: 0, max: 40 }), { nil: undefined }),
        fc.integer({ min: 0, max: 3 }),
        fc.boolean(),
        (dex, override, armorIdx, withShield) => {
          const bd = armorClassBreakdown(scoresWithDex(dex), override, {
            armor: armors[armorIdx],
            shield: withShield ? SHIELD : undefined,
          });
          expect(sumsToTotal(bd)).toBe(true);
          if (override !== undefined) expect(bd.total).toBe(override);
        },
      ),
    );
  });

  it('property: no override, unarmored → total is 10 + Dex + shield', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), fc.boolean(), (dex, withShield) => {
        const bd = armorClassBreakdown(scoresWithDex(dex), undefined, {
          shield: withShield ? SHIELD : undefined,
        });
        expect(bd.total).toBe(10 + abilityModifier(dex) + (withShield ? 2 : 0));
      }),
    );
  });
});
