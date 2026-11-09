import { describe, it, expect } from 'vitest';
import { TRINKETS, rollTrinket, trinketForRoll } from '../trinkets';

describe('TRINKETS', () => {
  it('has one distinct entry for each d100 result', () => {
    expect(TRINKETS).toHaveLength(100);
    expect(new Set(TRINKETS).size).toBe(100);
    for (const t of TRINKETS) expect(t.trim()).toBe(t);
  });

  it('matches the printed table at the ends and at rows that were misread in the text copy', () => {
    expect(trinketForRoll(1)).toBe('A mummified goblin hand');
    expect(trinketForRoll(10)).toBe('The deed for a parcel of land in a realm unknown to you');
    expect(trinketForRoll(53)).toBe('A small box filled with different-sized buttons');
    expect(trinketForRoll(83)).toBe('A bit of folded cloth that, when unfolded, turns into a stylish cap');
    expect(trinketForRoll(90)).toBe('An ancient arrow of elven design');
    expect(trinketForRoll(99)).toMatch(/^A wooden box with a ceramic bottom/);
    expect(trinketForRoll(100)).toBe('A metal urn containing the ashes of a hero');
  });

  it('rejects a roll outside 1-100', () => {
    expect(trinketForRoll(0)).toBeUndefined();
    expect(trinketForRoll(101)).toBeUndefined();
  });

  it('rolls 1 to 100 inclusive', () => {
    expect(rollTrinket(() => 0).roll).toBe(1);
    expect(rollTrinket(() => 0.999999).roll).toBe(100);
    expect(rollTrinket(() => 0.5).roll).toBe(51);
  });
});
