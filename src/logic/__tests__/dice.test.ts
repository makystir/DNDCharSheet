import { describe, it, expect } from 'vitest';
import { rollD20, rollDice, rollDie, d20TestBreakdown } from '../dice';
import { createDefaultRng, type RNG } from '../random';
import { formatEquation } from '../breakdown';
import { D20_CASES, DICE_CASES } from './hp-golden';

/** A deterministic RNG that replays a fixed sequence and fails if over-drawn. */
function sequence(values: number[]): RNG {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('RNG over-drawn');
    return values[i++];
  };
}

describe('golden D20_CASES', () => {
  for (const row of D20_CASES) {
    it(row.name, () => {
      const rng = sequence(row.rng);
      const result = rollD20(rng, row.mode);
      expect(result.rolls).toEqual(row.expect.rolls);
      expect(result.used).toBe(row.expect.used);
      expect(result.natural).toBe(row.expect.natural);
      // The row's draws are exactly the draws consumed.
      expect(() => rng()).toThrow('RNG over-drawn');
    });
  }
});

describe('golden DICE_CASES', () => {
  for (const row of DICE_CASES) {
    it(row.name, () => {
      const rng = sequence(row.rng);
      const result = rollDice(row.expr, rng);
      expect(result.rolls).toEqual(row.expect.rolls);
      expect(result.total).toBe(row.expect.total);
      expect(() => rng()).toThrow('RNG over-drawn');
    });
  }
});

describe('golden harness fails closed (dice)', () => {
  it('a perturbed RNG value changes the d20 result', () => {
    const row = D20_CASES[2]; // 0.5 -> 11
    const changed = rollD20(sequence([0.9]), row.mode);
    expect(changed.used).not.toBe(row.expect.used);
  });

  it('advantage and disadvantage disagree on the same dice (the mode is honoured)', () => {
    const adv = rollD20(sequence([0.0, 0.95]), 'advantage');
    const dis = rollD20(sequence([0.0, 0.95]), 'disadvantage');
    expect(adv.used).not.toBe(dis.used);
  });
});

describe('rollDie / rollDice edge cases', () => {
  it('keeps every face on the die even if the RNG misbehaves', () => {
    expect(rollDie(() => 1, 6)).toBe(6);
    expect(rollDie(() => -0.5, 6)).toBe(1);
  });

  it('accepts surrounding whitespace and uppercase D', () => {
    expect(rollDice(' 2D4 ', sequence([0, 0.999])).total).toBe(5);
  });

  it('rejects unsupported expressions and empty dice', () => {
    expect(() => rollDice('2d6+3', sequence([]))).toThrow();
    expect(() => rollDice('banana', sequence([]))).toThrow();
    expect(() => rollDice('0d6', sequence([]))).toThrow(RangeError);
    expect(() => rollDice('2d0', sequence([]))).toThrow(RangeError);
  });

  it('createDefaultRng returns floats in [0, 1)', () => {
    const rng = createDefaultRng();
    for (let i = 0; i < 50; i += 1) {
      const r = rng();
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });
});

describe('d20TestBreakdown', () => {
  it('lists Exhaustion as an explicit component and sums to the total', () => {
    const b = d20TestBreakdown(12, 2, [{ label: 'Dex mod', value: 3 }]);
    expect(b.total).toBe(12 + 3 - 4);
    expect(b.components.map((c) => c.label)).toEqual(['d20 roll', 'Dex mod', 'Exhaustion -4']);
    expect(b.components.reduce((s, c) => s + c.value, 0)).toBe(b.total);
    expect(formatEquation(b)).toContain('Exhaustion -4');
  });

  it('still lists the Exhaustion component at level 0', () => {
    const b = d20TestBreakdown(7, 0);
    expect(b.total).toBe(7);
    expect(b.components).toHaveLength(2);
    expect(b.components[1].value).toBe(0);
  });
});
