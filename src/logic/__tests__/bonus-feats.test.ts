import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character } from '../../types/character';
import { CLASS_LIST } from '../../data/classes';
import type { ClassId } from '../../data/classes';
import { featSlotLevels, xpForLevel } from '../advancement';
import { BONUS_FEAT_XP_BASE, bonusFeatSlotCount } from '../bonus-feats';

function level20(xp: number | undefined, rule: boolean | undefined, mode: 'xp' | 'milestone' = 'xp'): Character {
  return {
    ...createCharacter('Tester'),
    level: 20,
    classes: [{ id: 'fighter' as ClassId, level: 20 }],
    advancement: { leveling: { mode, xp } },
    ...(rule === undefined ? {} : { houseRules: { bonusFeatsAfter20: rule } }),
  };
}

describe('bonus feats at level 20 (opt-in house rule, PHB 2024 sidebar)', () => {
  it('the base equals the level 20 XP threshold in the XP table', () => {
    expect(BONUS_FEAT_XP_BASE).toBe(xpForLevel(20));
  });

  it('rule off (default): zero slots even at 500,000 XP', () => {
    expect(bonusFeatSlotCount(level20(500_000, undefined))).toBe(0);
    expect(bonusFeatSlotCount(level20(500_000, false))).toBe(0);
  });

  // Cardinality rows: 355,000 + 30,000 per feat, floor.
  const rows: Array<[number, number]> = [
    [354_999, 0],
    [355_000, 0],
    [384_999, 0],
    [385_000, 1],
    [414_999, 1],
    [415_000, 2],
    [505_000, 5],
  ];
  for (const [xp, slots] of rows) {
    it(`rule on: ${xp.toLocaleString()} XP gives ${slots}`, () => {
      expect(bonusFeatSlotCount(level20(xp, true))).toBe(slots);
    });
  }

  it('milestone mode and missing XP give none', () => {
    expect(bonusFeatSlotCount(level20(900_000, true, 'milestone'))).toBe(0);
    expect(bonusFeatSlotCount(level20(undefined, true))).toBe(0);
  });

  it('below level 20 gives none', () => {
    expect(bonusFeatSlotCount({ ...level20(900_000, true), level: 19 })).toBe(0);
  });

  it('featSlotLevels appends synthetic levels 21+ only when the rule yields slots', () => {
    const base = featSlotLevels(level20(415_000, false));
    expect(featSlotLevels(level20(415_000, true))).toEqual([...base, 21, 22]);
  });

  it('rule off: featSlotLevels is identical to today for every class at level 20', () => {
    for (const cls of CLASS_LIST) {
      const plain: Character = {
        ...createCharacter('Tester'),
        level: 20,
        classes: [{ id: cls.id as ClassId, level: 20 }],
      };
      const withXp: Character = { ...plain, advancement: { leveling: { mode: 'xp', xp: 900_000 } } };
      expect(featSlotLevels(withXp)).toEqual(featSlotLevels(plain));
      expect(featSlotLevels(plain).every((l) => l <= 20)).toBe(true);
    }
  });
});
