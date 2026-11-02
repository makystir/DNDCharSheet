import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { AbilityScores } from '../../types/character';
import { abilityModifier } from '../abilities';
import { initiativeBreakdown } from '../initiative';

function scoresWithDex(dex: number): AbilityScores {
  return { str: 10, dex, con: 10, int: 10, wis: 10, cha: 10 };
}

describe('initiativeBreakdown', () => {
  it('is the Dex mod with a default bonus of 0', () => {
    const bd = initiativeBreakdown(scoresWithDex(16)); // +3
    expect(bd.total).toBe(3);
    expect(bd.components).toEqual([
      { label: 'Dex mod', value: 3 },
      { label: 'Bonus', value: 0 },
    ]);
  });

  it('adds a manual bonus (including a negative penalty)', () => {
    expect(initiativeBreakdown(scoresWithDex(16), 2).total).toBe(5);
    expect(initiativeBreakdown(scoresWithDex(16), -1).total).toBe(2);
  });

  it('property: total === Dex mod + (bonus ?? 0)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.option(fc.integer({ min: -10, max: 10 }), { nil: undefined }),
        (dex, bonus) => {
          const bd = initiativeBreakdown(scoresWithDex(dex), bonus);
          expect(bd.total).toBe(abilityModifier(dex) + (bonus ?? 0));
          expect(bd.components.reduce((s, c) => s + c.value, 0)).toBe(bd.total);
        },
      ),
    );
  });
});
