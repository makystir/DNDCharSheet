import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character } from '../../types/character';
import { applyDamage, currentHpBreakdown, damagePreviewBreakdowns, isBloodied } from '../hit-points-state';

function pc(overrides: Partial<Character> = {}): Character {
  return { ...createCharacter('Tester'), hpMax: 20, ...overrides };
}

describe('isBloodied (PHB L1079: half your Hit Points or fewer)', () => {
  it('is false above half, true at exactly half, true below', () => {
    expect(isBloodied(pc({ currentHp: 11 }))).toBe(false);
    expect(isBloodied(pc({ currentHp: 10 }))).toBe(true);
    expect(isBloodied(pc({ currentHp: 1 }))).toBe(true);
  });

  it('uses half of an odd maximum without rounding: 7 of 15 is Bloodied, 8 is not', () => {
    expect(isBloodied(pc({ hpMax: 15, currentHp: 7 }))).toBe(true);
    expect(isBloodied(pc({ hpMax: 15, currentHp: 8 }))).toBe(false);
  });

  it('holds at 0 HP', () => {
    expect(isBloodied(pc({ currentHp: 0 }))).toBe(true);
  });

  it('is false at full HP, when dead, and when no maximum is set', () => {
    expect(isBloodied(pc())).toBe(false);
    expect(isBloodied(pc({ currentHp: 3, dead: true }))).toBe(false);
    expect(isBloodied(pc({ currentHp: 3, exhaustionLevel: 6 }))).toBe(false);
    expect(isBloodied({ ...createCharacter('Tester') })).toBe(false);
  });
});

describe('currentHpBreakdown', () => {
  it('lists the maximum and the damage taken, summing to the current HP', () => {
    const b = currentHpBreakdown(pc({ currentHp: 8 }));
    expect(b).toEqual({
      total: 8,
      components: [
        { label: 'Hit Point maximum', value: 20 },
        { label: 'Damage taken', value: -12 },
      ],
    });
  });

  it('shows a zero damage component at full HP (absent currentHp follows the maximum)', () => {
    const b = currentHpBreakdown(pc());
    expect(b?.total).toBe(20);
    expect(b?.components[1]).toEqual({ label: 'Damage taken', value: 0 });
  });

  it('clamps a stale stored value to the maximum', () => {
    expect(currentHpBreakdown(pc({ currentHp: 99 }))?.total).toBe(20);
  });

  it('is undefined when no maximum is set', () => {
    expect(currentHpBreakdown({ ...createCharacter('Tester') })).toBeUndefined();
  });

  it('components always sum to the total', () => {
    for (const hp of [0, 1, 7, 20]) {
      const b = currentHpBreakdown(pc({ currentHp: hp }));
      expect(b?.components.reduce((s, c) => s + c.value, 0)).toBe(b?.total);
    }
  });
});

describe('damagePreviewBreakdowns', () => {
  const before = { max: 20, hp: 6, temp: 4, deathSaves: { successes: 0, failures: 0 }, stable: false, dead: false };

  it('every breakdown sums to its total', () => {
    const request = { amount: 12 };
    const result = applyDamage(before, request);
    const b = damagePreviewBreakdowns(before, request, result);
    for (const bd of [b.tempAbsorbed, b.hpLost, b.remainder, b.failuresAdded]) {
      expect(bd.components.reduce((s, c) => s + c.value, 0)).toBe(bd.total);
    }
    expect([b.tempAbsorbed.total, b.hpLost.total, b.remainder.total]).toEqual([4, 6, 2]);
  });

  it('a Critical Hit at 0 HP shows the extra failure as its own component', () => {
    const atZero = { ...before, hp: 0, temp: 0 };
    const request = { amount: 3, crit: true };
    const b = damagePreviewBreakdowns(atZero, request, applyDamage(atZero, request));
    expect(b.failuresAdded.total).toBe(2);
    expect(b.failuresAdded.components.map((c) => c.value)).toEqual([1, 1]);
  });
});