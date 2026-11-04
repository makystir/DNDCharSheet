import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import {
  addCondition,
  applyCondition,
  removeCondition,
  dropCondition,
  hasCondition,
  setExhaustion,
  setConditionDetails,
  clampExhaustionLevel,
  exhaustionEffects,
  exhaustionAfterLongRest,
  exhaustionLevelOf,
  activeConditionIds,
  impliedConditions,
  isTrackedConditionId,
} from '../conditions';
import { formatEquation } from '../breakdown';
import { CONDITIONS, CONDITION_COLORS, getConditionIntensity } from '../../data/conditions';

const base = () => createCharacter('Tester');

describe('applyCondition / removeCondition', () => {
  it('is idempotent: re-applying does not stack or duplicate', () => {
    const once = applyCondition([], 'poisoned');
    const twice = applyCondition(once, 'poisoned');
    expect(twice).toEqual([{ id: 'poisoned' }]);
    expect(twice).toBe(once);
  });

  it('re-applying with details updates the single entry', () => {
    const list = applyCondition(applyCondition([], 'poisoned'), 'poisoned', { ends: 'save ends' });
    expect(list).toEqual([{ id: 'poisoned', ends: 'save ends' }]);
  });

  it('removing is idempotent and does not mutate the input', () => {
    const input = [{ id: 'prone' as const }];
    const out = removeCondition(input, 'prone');
    expect(out).toEqual([]);
    expect(input).toEqual([{ id: 'prone' }]);
    expect(removeCondition(out, 'prone')).toEqual([]);
    expect(removeCondition(undefined, 'prone')).toEqual([]);
  });

  it('setConditionDetails sets and clears the free-text ends note', () => {
    const a = setConditionDetails([{ id: 'stunned' }], 'stunned', { ends: 'end of next turn' });
    expect(a[0].ends).toBe('end of next turn');
    expect(setConditionDetails(a, 'stunned', { ends: '' })[0]).toEqual({ id: 'stunned' });
  });
});

describe('character-level helpers', () => {
  it('addCondition / hasCondition / dropCondition round trip', () => {
    const c = addCondition(base(), 'blinded');
    expect(hasCondition(c, 'blinded')).toBe(true);
    expect(hasCondition(c, 'deafened')).toBe(false);
    expect(hasCondition(dropCondition(c, 'blinded'), 'blinded')).toBe(false);
  });

  it('dropping the last condition deletes the field (not conditions: [])', () => {
    const c = dropCondition(addCondition(base(), 'blinded'), 'blinded');
    expect('conditions' in c).toBe(false);
    const two = addCondition(addCondition(base(), 'blinded'), 'prone');
    expect(dropCondition(two, 'blinded').conditions).toEqual([{ id: 'prone' }]);
  });

  it('has NO auto-applied side effects: adding Unconscious adds only Unconscious', () => {
    const c = addCondition(base(), 'unconscious');
    expect(c.conditions).toEqual([{ id: 'unconscious' }]);
    expect(hasCondition(c, 'incapacitated')).toBe(false);
    expect(hasCondition(c, 'prone')).toBe(false);
    expect(c.exhaustionLevel).toBeUndefined();
  });

  it('removing a condition does not remove the conditions it implies', () => {
    let c = addCondition(base(), 'paralyzed');
    c = addCondition(c, 'incapacitated');
    c = dropCondition(c, 'paralyzed');
    expect(hasCondition(c, 'incapacitated')).toBe(true);
  });

  it('is pure: the input character is not mutated', () => {
    const c = base();
    const before = JSON.stringify(c);
    addCondition(c, 'poisoned');
    addCondition(c, 'exhaustion');
    expect(JSON.stringify(c)).toBe(before);
  });

  it('does not touch the stored schema version or derived fields', () => {
    const c = addCondition(base(), 'restrained');
    expect(c.abilities).toEqual(base().abilities);
  });

  it('activeConditionIds lists in PHB order including Exhaustion', () => {
    let c = addCondition(base(), 'stunned');
    c = addCondition(c, 'blinded');
    c = setExhaustion(c, 2);
    expect(activeConditionIds(c)).toEqual(['blinded', 'exhaustion', 'stunned']);
  });
});

describe('implied conditions (derived, read-only)', () => {
  it('reports Paralyzed -> Incapacitated without adding it', () => {
    const c = addCondition(base(), 'paralyzed');
    expect(impliedConditions(c)).toEqual([{ id: 'incapacitated', impliedBy: ['paralyzed'] }]);
    expect(c.conditions).toEqual([{ id: 'paralyzed' }]);
  });

  it('reports Unconscious -> Incapacitated and Prone', () => {
    const c = addCondition(base(), 'unconscious');
    expect(impliedConditions(c).map((i) => i.id).sort()).toEqual(['incapacitated', 'prone']);
  });

  it('merges several sources of the same implied condition', () => {
    let c = addCondition(base(), 'stunned');
    c = addCondition(c, 'paralyzed');
    expect(impliedConditions(c)).toEqual([
      { id: 'incapacitated', impliedBy: ['paralyzed', 'stunned'] },
    ]);
  });

  it('reports nothing for conditions that imply none', () => {
    expect(impliedConditions(addCondition(base(), 'poisoned'))).toEqual([]);
  });
});

describe('Exhaustion', () => {
  it('clamps to 0..6 and tolerates junk', () => {
    expect(clampExhaustionLevel(-3)).toBe(0);
    expect(clampExhaustionLevel(9)).toBe(6);
    expect(clampExhaustionLevel(2.9)).toBe(2);
    expect(clampExhaustionLevel(Number.NaN)).toBe(0);
  });

  it('is cumulative via addCondition and caps at 6', () => {
    let c = base();
    for (let i = 0; i < 9; i++) c = addCondition(c, 'exhaustion');
    expect(c.exhaustionLevel).toBe(6);
    expect(hasCondition(c, 'exhaustion')).toBe(true);
  });

  it('level 0 removes the field and the condition', () => {
    const c = setExhaustion(setExhaustion(base(), 3), 0);
    expect('exhaustionLevel' in c).toBe(false);
    expect(hasCondition(c, 'exhaustion')).toBe(false);
    expect(exhaustionLevelOf(c)).toBe(0);
  });

  it('dropCondition clears all levels', () => {
    expect(hasCondition(dropCondition(setExhaustion(base(), 4), 'exhaustion'), 'exhaustion')).toBe(false);
  });

  it('exhaustionEffects returns the PHB penalties as Breakdowns whose components sum', () => {
    for (let level = 0; level <= 6; level++) {
      const e = exhaustionEffects(level);
      expect(e.d20Test.total).toBe(0 - 2 * level);
      expect(e.speed.total).toBe(0 - 5 * level);
      expect(e.d20Test.components.reduce((s, c) => s + c.value, 0)).toBe(e.d20Test.total);
      expect(e.speed.components.reduce((s, c) => s + c.value, 0)).toBe(e.speed.total);
      expect(e.fatal).toBe(level === 6);
    }
    expect(formatEquation(exhaustionEffects(3).d20Test)).toContain('-6');
  });

  it('exhaustionEffects clamps out-of-range levels', () => {
    expect(exhaustionEffects(99).level).toBe(6);
    expect(exhaustionEffects(-1).d20Test.total).toBe(0);
  });

  it('a Long Rest removes 1 level, floor 0', () => {
    expect(exhaustionAfterLongRest(3)).toBe(2);
    expect(exhaustionAfterLongRest(1)).toBe(0);
    expect(exhaustionAfterLongRest(0)).toBe(0);
  });

  it('does NOT feed any derived total (informational only)', () => {
    const plain = base();
    const tired = setExhaustion(plain, 4);
    expect(tired.abilities).toEqual(plain.abilities);
    expect(tired.level).toBe(plain.level);
  });
});

describe('misc', () => {
  it('isTrackedConditionId excludes exhaustion and unknown ids', () => {
    expect(isTrackedConditionId('poisoned')).toBe(true);
    expect(isTrackedConditionId('exhaustion')).toBe(false);
    expect(isTrackedConditionId('bleeding')).toBe(false);
  });
});

describe('condition colours', () => {
  const lum = (hex: string) => {
    const digits = hex.replace('#', '');
    const full = digits.length === 3 ? digits.split('').map((x) => x + x).join('') : digits;
    const v = parseInt(full, 16);
    const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  it('every badge keeps >= 4.5:1 contrast', () => {
    for (const c of CONDITIONS) {
      const col = CONDITION_COLORS[c.id];
      const hi = Math.max(lum(col.bg), lum(col.text));
      const lo = Math.min(lum(col.bg), lum(col.text));
      expect((hi + 0.05) / (lo + 0.05), `${c.id} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('intensity scales only for stackable conditions above level 1', () => {
    expect(getConditionIntensity(1, 6, true)).toBe(1);
    expect(getConditionIntensity(3, 6, false)).toBe(1);
    expect(getConditionIntensity(6, 6, true)).toBe(1);
    expect(getConditionIntensity(3, 6, true)).toBeCloseTo(0.75);
  });
});
