import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { AbilityScores } from '../../types/character';
import { abilityModifier } from '../abilities';
import { hitPointMaxBreakdown } from '../hit-points';

function scoresWithCon(con: number): AbilityScores {
  return { str: 10, dex: 10, con, int: 10, wis: 10, cha: 10 };
}

describe('hitPointMaxBreakdown', () => {
  it('finite hpMax: total is the entered value; Con component is conMod × level', () => {
    const scores = scoresWithCon(14); // +2
    const bd = hitPointMaxBreakdown(scores, 3, 30);
    expect(bd.total).toBe(30);
    const conComp = bd.components.find((c) => c.label === 'Con mod × level');
    expect(conComp?.value).toBe(2 * 3); // +6
    const residual = bd.components.find(
      (c) => c.label === 'HP from Hit Dice (derived)',
    );
    expect(residual?.value).toBe(30 - 6);
    // Two components sum to the entered hpMax.
    expect(bd.components.reduce((s, c) => s + c.value, 0)).toBe(30);
  });

  it('negative Con mod: residual is labelled derived, not "entered"', () => {
    const scores = scoresWithCon(6); // -2
    const bd = hitPointMaxBreakdown(scores, 4, 10);
    const conContribution = -2 * 4; // -8
    const residual = bd.components.find(
      (c) => c.label === 'HP from Hit Dice (derived)',
    );
    expect(residual?.value).toBe(10 - conContribution); // 18, larger than entered 10
    expect(bd.components.reduce((s, c) => s + c.value, 0)).toBe(10);
  });

  it('undefined hpMax: total 0 with a single "not set" component', () => {
    const bd = hitPointMaxBreakdown(scoresWithCon(14), 5, undefined);
    expect(bd.total).toBe(0);
    expect(bd.components).toEqual([{ label: 'HP max — not set', value: 0 }]);
  });

  it('property: finite hpMax → total === hpMax and Con component === conMod × level', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 400 }),
        (con, level, hpMax) => {
          const bd = hitPointMaxBreakdown(scoresWithCon(con), level, hpMax);
          expect(bd.total).toBe(hpMax);
          const conComp = bd.components.find((c) => c.label === 'Con mod × level');
          expect(conComp?.value).toBe(abilityModifier(con) * level);
          expect(bd.components.reduce((s, c) => s + c.value, 0)).toBe(hpMax);
        },
      ),
    );
  });
});
