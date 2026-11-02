import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { AbilityScores } from '../../types/character';
import { abilityModifier } from '../abilities';
import { baseArmorClass, armorClassBreakdown } from '../armor-class';

function scoresWithDex(dex: number): AbilityScores {
  return { str: 10, dex, con: 10, int: 10, wis: 10, cha: 10 };
}

describe('baseArmorClass', () => {
  it('is 10 + Dex modifier', () => {
    expect(baseArmorClass(0)).toBe(10);
    expect(baseArmorClass(3)).toBe(13);
    expect(baseArmorClass(-1)).toBe(9);
  });
});

describe('armorClassBreakdown', () => {
  it('no override: Base 10 + Dex mod, no note', () => {
    const bd = armorClassBreakdown(scoresWithDex(14)); // +2
    expect(bd.total).toBe(12);
    expect(bd.components).toEqual([
      { label: 'Base', value: 10 },
      { label: 'Dex mod', value: 2 },
    ]);
    expect(bd.note).toBeUndefined();
  });

  it('override: total === override, single additive component, base only in note', () => {
    const bd = armorClassBreakdown(scoresWithDex(14), 18);
    expect(bd.total).toBe(18);
    expect(bd.components).toEqual([{ label: 'Manual override', value: 18 }]);
    // Exactly one additive component, summing to the total (never "18 + 12 = 18").
    expect(bd.components.length).toBe(1);
    expect(bd.components.reduce((s, c) => s + c.value, 0)).toBe(bd.total);
    // The superseded computed base (12) appears in the note, not the components.
    expect(bd.note).toContain('12');
    expect(bd.note).toContain('superseded');
  });

  it('property: no override → total is 10 + Dex mod; override → total is the override', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.option(fc.integer({ min: 0, max: 40 }), { nil: undefined }),
        (dex, override) => {
          const scores = scoresWithDex(dex);
          const bd = armorClassBreakdown(scores, override);
          if (override === undefined) {
            expect(bd.total).toBe(10 + abilityModifier(dex));
          } else {
            expect(bd.total).toBe(override);
          }
          expect(bd.components.reduce((s, c) => s + c.value, 0)).toBe(bd.total);
        },
      ),
    );
  });
});
