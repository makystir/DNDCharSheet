import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, CompanionRecord, HirelingRecord } from '../../types/character';
import {
  addConditionPatch,
  addRecord,
  damagePatch,
  fullHealPatch,
  healPatch,
  loyaltyEnabled,
  recordsOf,
  removeConditionPatch,
  removeRecord,
  restoreRecord,
  setCompanionHouseRule,
  setLoyaltyMaxOverride,
  sidekicksEnabled,
  tempHpPatch,
  trackedHpOf,
  updateRecord,
} from '../companions-actions';
import { COMPANION_CAPS } from '../companions';

const base = (): Character => createCharacter('Owner');
const wolf = (id: string, over: Partial<CompanionRecord> = {}): CompanionRecord => ({ id, creatureId: 'wolf', origin: 'pet', ...over });
const hireling = (id: string): HirelingRecord => ({ id, name: 'H', kind: 'skilled', units: 1 });

describe('record list actions', () => {
  it('adds, updates and removes a companion; the field disappears when empty', () => {
    let c = addRecord(base(), 'companions', wolf('a'));
    expect(recordsOf(c, 'companions')).toHaveLength(1);
    c = updateRecord(c, 'companions', 'a', { nickname: 'Fang' });
    expect(recordsOf(c, 'companions')[0].nickname).toBe('Fang');
    c = updateRecord(c, 'companions', 'a', { nickname: undefined });
    expect('nickname' in recordsOf(c, 'companions')[0]).toBe(false);
    c = removeRecord(c, 'companions', 'a');
    expect(c.companions).toBeUndefined();
  });

  it('does not mutate the input character', () => {
    const c0 = addRecord(base(), 'companions', wolf('a'));
    const snapshot = JSON.stringify(c0);
    updateRecord(c0, 'companions', 'a', { nickname: 'X' });
    removeRecord(c0, 'companions', 'a');
    expect(JSON.stringify(c0)).toBe(snapshot);
  });

  it('returns the same character for an unknown id or a duplicate id', () => {
    const c = addRecord(base(), 'companions', wolf('a'));
    expect(updateRecord(c, 'companions', 'zzz', { nickname: 'X' })).toBe(c);
    expect(removeRecord(c, 'companions', 'zzz')).toBe(c);
    expect(addRecord(c, 'companions', wolf('a'))).toBe(c);
  });

  it('refuses the add that would pass the cap (the 41st creature, the 31st hireling)', () => {
    let c = base();
    for (let i = 0; i < COMPANION_CAPS.companions; i++) c = addRecord(c, 'companions', wolf(`c${i}`));
    expect(recordsOf(c, 'companions')).toHaveLength(40);
    expect(addRecord(c, 'companions', wolf('extra'))).toBe(c);
    let h = base();
    for (let i = 0; i < COMPANION_CAPS.hirelings; i++) h = addRecord(h, 'hirelings', hireling(`h${i}`));
    expect(addRecord(h, 'hirelings', hireling('extra'))).toBe(h);
  });

  it('restores a removed record at its old index (undo of a delete)', () => {
    let c = base();
    for (const id of ['a', 'b', 'c']) c = addRecord(c, 'companions', wolf(id));
    const removed = recordsOf(c, 'companions')[1];
    c = removeRecord(c, 'companions', 'b');
    c = restoreRecord(c, 'companions', removed, 1);
    expect(recordsOf(c, 'companions').map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(restoreRecord(c, 'companions', removed, 0)).toBe(c);
  });
});

describe('tracked HP patches', () => {
  it('damage drains temp HP first and writes the stored HP back', () => {
    const p = damagePatch({ tempHp: 5 }, 10, 7);
    expect(p).toEqual({ hp: 8, tempHp: undefined });
    expect(damagePatch({ hp: 10, tempHp: 5 }, 10, 3)).toEqual({ hp: undefined, tempHp: 2 });
  });

  it('damage floors at 0 and 0 is stored as a real value', () => {
    expect(damagePatch({ hp: 4 }, 10, 99)).toEqual({ hp: 0, tempHp: undefined });
  });

  it('healing is capped at the maximum and an HP at max becomes "follows the maximum"', () => {
    expect(healPatch({ hp: 3 }, 10, 5)).toEqual({ hp: 8, tempHp: undefined });
    expect(healPatch({ hp: 3 }, 10, 99)).toEqual({ hp: undefined, tempHp: undefined });
    expect(healPatch({ hp: 0, tempHp: 4 }, 10, 2)).toEqual({ hp: 2, tempHp: 4 });
  });

  it('temp HP does not stack, keeps the larger, and is not capped by the maximum', () => {
    expect(tempHpPatch({ tempHp: 10 }, 12)).toEqual({ tempHp: 12 });
    expect(tempHpPatch({ tempHp: 10 }, 4)).toEqual({ tempHp: 10 });
    expect(tempHpPatch({}, 50)).toEqual({ tempHp: 50 });
    expect(tempHpPatch({ tempHp: 10 }, 12, 'keep')).toEqual({ tempHp: 10 });
  });

  it('full heal clears the stored HP; trackedHpOf follows the maximum', () => {
    expect(fullHealPatch()).toEqual({ hp: undefined });
    expect(trackedHpOf({}, 18)).toBe(18);
    expect(trackedHpOf({ hp: 8 }, 18)).toBe(8);
    expect(trackedHpOf({ hp: 30 }, 18)).toBe(18);
  });

  it('applies through updateRecord and removes cleared fields', () => {
    let c = addRecord(base(), 'companions', wolf('a'));
    c = updateRecord(c, 'companions', 'a', damagePatch(recordsOf(c, 'companions')[0], 11, 4));
    expect(recordsOf(c, 'companions')[0].hp).toBe(7);
    c = updateRecord(c, 'companions', 'a', fullHealPatch());
    expect('hp' in recordsOf(c, 'companions')[0]).toBe(false);
  });
});

describe('condition patches', () => {
  it('adds a condition once, stacks exhaustion to 6, and removes them', () => {
    let rec: CompanionRecord = wolf('a');
    rec = { ...rec, ...addConditionPatch(rec, 'poisoned') };
    rec = { ...rec, ...addConditionPatch(rec, 'poisoned') };
    expect(rec.conditions).toHaveLength(1);
    for (let i = 0; i < 8; i++) rec = { ...rec, ...addConditionPatch(rec, 'exhaustion') };
    expect(rec.exhaustionLevel).toBe(6);
    rec = { ...rec, ...removeConditionPatch(rec, 'poisoned') };
    expect(rec.conditions).toBeUndefined();
    rec = { ...rec, ...removeConditionPatch(rec, 'exhaustion') };
    expect(rec.exhaustionLevel).toBeUndefined();
  });
});

describe('house rules and Loyalty override', () => {
  it('both toggles default off and set independently without disturbing other house rules', () => {
    let c: Character = { ...base(), houseRules: { variantEncumbrance: true } };
    expect(sidekicksEnabled(c)).toBe(false);
    expect(loyaltyEnabled(c)).toBe(false);
    c = setCompanionHouseRule(c, 'sidekicks', true);
    expect(sidekicksEnabled(c)).toBe(true);
    expect(loyaltyEnabled(c)).toBe(false);
    expect(c.houseRules?.variantEncumbrance).toBe(true);
    c = setCompanionHouseRule(c, 'loyalty', true);
    c = setCompanionHouseRule(c, 'sidekicks', false);
    expect(sidekicksEnabled(c)).toBe(false);
    expect(loyaltyEnabled(c)).toBe(true);
  });

  it('only a literal true enables a rule', () => {
    const c = { ...base(), houseRules: { sidekicks: 'yes' as unknown as boolean } };
    expect(sidekicksEnabled(c)).toBe(false);
  });

  it('sets, clamps and clears the Loyalty maximum override', () => {
    let c = setLoyaltyMaxOverride(base(), 12);
    expect(c.loyaltyMaxOverride).toBe(12);
    expect(setLoyaltyMaxOverride(c, 99).loyaltyMaxOverride).toBe(20);
    expect(setLoyaltyMaxOverride(c, -5).loyaltyMaxOverride).toBe(0);
    c = setLoyaltyMaxOverride(c, undefined);
    expect('loyaltyMaxOverride' in c).toBe(false);
  });
});
