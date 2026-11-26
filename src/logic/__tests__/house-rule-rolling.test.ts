import { describe, it, expect } from 'vitest';
import type { RNG } from '../random';
import {
  GRID_SIZE,
  gridLineScores,
  gridLines,
  roll3d6,
  rollFiveDropTwoScore,
  rollGrid,
  rollHeroicScore,
  rollMinTotalSet,
  rollRerollOnesScore,
  rollTwelveKeepSix,
} from '../house-rule-rolling';
import { createDefaultRng } from '../random';

/** An RNG that yields the given d6 faces in order (then throws if over-consumed). */
function faces(...f: number[]): RNG & { used: () => number } {
  let i = 0;
  const fn = (() => {
    if (i >= f.length) throw new Error('RNG over-consumed');
    return (f[i++] - 1) / 6 + 0.01;
  }) as RNG & { used: () => number };
  fn.used = () => i;
  return fn;
}

describe('2d6 + 6 (Heroic)', () => {
  it('adds 6 to two d6', () => {
    expect(rollHeroicScore(faces(1, 1))).toBe(8);
    expect(rollHeroicScore(faces(6, 6))).toBe(18);
    expect(rollHeroicScore(faces(3, 4))).toBe(13);
  });
  it('always lands in 8..18 over many real rolls', () => {
    const rng = createDefaultRng();
    for (let i = 0; i < 500; i++) {
      const s = rollHeroicScore(rng);
      expect(s).toBeGreaterThanOrEqual(8);
      expect(s).toBeLessThanOrEqual(18);
    }
  });
});

describe('4d6, drop lowest, reroll 1s', () => {
  it('rerolls 1s indefinitely, then drops the lowest die', () => {
    // First die: 1,1,1,4 (three rerolls) -> 4. Then 2, 5, 6. Drop the 2 -> 4+5+6.
    const rng = faces(1, 1, 1, 4, 2, 5, 6);
    expect(rollRerollOnesScore(rng)).toBe(15);
    expect(rng.used()).toBe(7);
  });
  it('has a floor of 6 (2,2,2,2 -> keep three 2s)', () => {
    expect(rollRerollOnesScore(faces(2, 2, 2, 2))).toBe(6);
  });
  it('never uses a 1 and stays in 6..18 over many real rolls', () => {
    const rng = createDefaultRng();
    for (let i = 0; i < 500; i++) {
      const s = rollRerollOnesScore(rng);
      expect(s).toBeGreaterThanOrEqual(6);
      expect(s).toBeLessThanOrEqual(18);
    }
  });
});

describe('5d6, drop lowest two', () => {
  it('keeps the highest three of five', () => {
    expect(rollFiveDropTwoScore(faces(1, 6, 2, 5, 4))).toBe(15);
  });
  it('spans 3..18', () => {
    expect(rollFiveDropTwoScore(faces(1, 1, 1, 1, 1))).toBe(3);
    expect(rollFiveDropTwoScore(faces(6, 6, 6, 6, 6))).toBe(18);
  });
  it('uses exactly five draws', () => {
    const rng = faces(3, 3, 3, 3, 3);
    rollFiveDropTwoScore(rng);
    expect(rng.used()).toBe(5);
  });
});

describe('The 6x6 Grid', () => {
  it('rolls 36 cells in range for both dice choices', () => {
    const rng = createDefaultRng();
    const g3 = rollGrid(rng, '3d6');
    const g4 = rollGrid(rng, '4d6-drop-lowest');
    for (const g of [g3, g4]) {
      expect(g).toHaveLength(36);
      for (const n of g) {
        expect(n).toBeGreaterThanOrEqual(3);
        expect(n).toBeLessThanOrEqual(18);
      }
    }
  });
  it('uses 3 draws per cell for 3d6 and 4 for 4d6 drop lowest', () => {
    const a = faces(...Array<number>(108).fill(2));
    rollGrid(a, '3d6');
    expect(a.used()).toBe(108);
    const b = faces(...Array<number>(144).fill(2));
    rollGrid(b, '4d6-drop-lowest');
    expect(b.used()).toBe(144);
  });
  it('offers 6 rows, 6 columns and 2 diagonals of 6 distinct cells each', () => {
    const lines = gridLines();
    expect(lines).toHaveLength(14);
    expect(lines.filter((l) => l.id.startsWith('row-'))).toHaveLength(6);
    expect(lines.filter((l) => l.id.startsWith('col-'))).toHaveLength(6);
    expect(lines.filter((l) => l.id.startsWith('diag-'))).toHaveLength(2);
    for (const l of lines) {
      expect(l.cells).toHaveLength(GRID_SIZE);
      expect(new Set(l.cells).size).toBe(GRID_SIZE);
    }
  });
  it('selects the right scores for a row, column and each diagonal', () => {
    const grid = Array.from({ length: 36 }, (_, i) => i); // cell value = its index
    expect(gridLineScores(grid, 'row-2')).toEqual([6, 7, 8, 9, 10, 11]);
    expect(gridLineScores(grid, 'col-3')).toEqual([2, 8, 14, 20, 26, 32]);
    expect(gridLineScores(grid, 'diag-down')).toEqual([0, 7, 14, 21, 28, 35]);
    expect(gridLineScores(grid, 'diag-up')).toEqual([5, 10, 15, 20, 25, 30]);
    expect(gridLineScores(grid, 'nope')).toBeNull();
  });
});

describe('70+ Minimum Total', () => {
  it('rerolls the entire array while the total is under 70', () => {
    // Set 1: every 4d6 = 1,1,1,1 -> 3 each = 18 (reject). Set 2: 6,6,6,1 -> 18 each = 108.
    const low = Array<number>(24).fill(1);
    const high = Array.from({ length: 6 }, () => [6, 6, 6, 1]).flat();
    const rng = faces(...low, ...high);
    const result = rollMinTotalSet(rng);
    expect(result.attempts).toBe(2);
    expect(result.scores).toEqual([18, 18, 18, 18, 18, 18]);
  });
  it('accepts a total of exactly 70 on the first set', () => {
    // Scores 12,12,12,12,12,10 = 70. 4d6 for 12: 4,4,4,1. For 10: 4,3,3,1.
    const rng = faces(...[4, 4, 4, 1].flatMap((x) => [x]), 4, 4, 4, 1, 4, 4, 4, 1, 4, 4, 4, 1, 4, 4, 4, 1, 4, 3, 3, 1);
    const result = rollMinTotalSet(rng);
    expect(result.attempts).toBe(1);
    expect(result.scores.reduce((s, n) => s + n, 0)).toBe(70);
  });
  it('rejects a total of 69', () => {
    // 12,12,12,12,12,9 = 69 (rejected), then all 6,6,6,1.
    const rejected = [4, 4, 4, 1, 4, 4, 4, 1, 4, 4, 4, 1, 4, 4, 4, 1, 4, 4, 4, 1, 3, 3, 3, 1];
    const ok = Array.from({ length: 6 }, () => [6, 6, 6, 1]).flat();
    const result = rollMinTotalSet(faces(...rejected, ...ok));
    expect(result.attempts).toBe(2);
  });
  it('always returns six scores totalling at least 70 over many real rolls', () => {
    const rng = createDefaultRng();
    for (let i = 0; i < 100; i++) {
      const { scores } = rollMinTotalSet(rng);
      expect(scores).toHaveLength(6);
      expect(scores.reduce((s, n) => s + n, 0)).toBeGreaterThanOrEqual(70);
    }
  });
});

describe('3d6 Twelve Times, Keep Six', () => {
  it('rolls 3d6 twelve times and keeps the six highest, highest first', () => {
    // Totals: 3,4,5,6,7,8,9,10,11,12,13,14 via three dice each.
    const dice = [
      [1, 1, 1], [1, 1, 2], [1, 2, 2], [2, 2, 2], [2, 2, 3], [2, 3, 3],
      [3, 3, 3], [3, 3, 4], [3, 4, 4], [4, 4, 4], [4, 4, 5], [4, 5, 5],
    ];
    const result = rollTwelveKeepSix(faces(...dice.flat()));
    expect(result.rolls).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(result.kept).toEqual([14, 13, 12, 11, 10, 9]);
  });
  it('uses 36 draws and keeps six values in range', () => {
    const rng = createDefaultRng();
    for (let i = 0; i < 100; i++) {
      const { rolls, kept } = rollTwelveKeepSix(rng);
      expect(rolls).toHaveLength(12);
      expect(kept).toHaveLength(6);
      for (const n of kept) expect(n).toBeGreaterThanOrEqual(3);
      expect(Math.min(...kept)).toBeGreaterThanOrEqual([...rolls].sort((a, b) => a - b)[6]);
    }
    expect(roll3d6(faces(1, 1, 1))).toBe(3);
  });
});
