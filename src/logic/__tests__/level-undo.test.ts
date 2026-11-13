import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character } from '../../types/character';
import { applyLevelUp, applyMulticlassLevel } from '../advancement';
import { applyFeat, applyFightingStyle, characterFeats } from '../feats';
import { canUndoLevel, lastLevelClassId, undoableClassIds, undoLastLevel } from '../level-undo';
import { hitPointMaxOf } from '../hit-points-state';

const base = (overrides: Partial<Character>): Character => ({
  ...createCharacter('Tester'),
  abilities: { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 },
  ...overrides,
});

/** Level a character up `times` times with the fixed HP choice. */
function levelUp(c: Character, times: number): Character {
  let next = c;
  for (let i = 0; i < times; i++) next = applyLevelUp(next, { mode: 'fixed' }, 100 + i) ?? next;
  return next;
}

function undo(c: Character, classId?: string) {
  const r = undoLastLevel(c, 999, classId);
  if (!r.ok) throw new Error(r.reason);
  return r;
}

describe('undoLastLevel', () => {
  it('refuses at level 1', () => {
    const c = base({ level: 1, classes: [{ id: 'fighter', level: 1 }] });
    expect(canUndoLevel(c)).toBe(false);
    expect(undoLastLevel(c, 1).ok).toBe(false);
  });

  it('steps one level back: HP record and that level\u2019s log entries go, an undo entry is added', () => {
    const c = levelUp(base({ level: 1, classes: [{ id: 'fighter', level: 1 }] }), 2);
    expect(c.level).toBe(3);
    const r = undo(c);
    expect(r.character.level).toBe(2);
    expect(r.character.classes?.[0].level).toBe(2);
    expect(r.character.advancement?.levels?.map((l) => l.level)).toEqual([2]);
    const log = r.character.advancement?.log ?? [];
    expect(log.some((e) => e.level === 3 && (e.kind === 'level-up' || e.kind === 'hp'))).toBe(false);
    expect(log.some((e) => e.level === 2 && e.kind === 'level-up')).toBe(true);
    expect(log.at(-1)).toMatchObject({ kind: 'level-undo', level: 3, detail: 'Undid level 3: Fighter 3 to 2; now level 2' });
    expect(r.preview.removals).toContain('Hit points gained at level 3 (fixed value)');
  });

  it('removes a subclass the class is no longer high enough for, and lists it', () => {
    const c = base({ level: 3, classes: [{ id: 'fighter', level: 3, subclassId: 'champion' }] });
    const r = undo(c);
    expect(r.character.classes?.[0].subclassId).toBeUndefined();
    expect(r.preview.removals).toContain('Subclass: Champion (Fighter chooses its subclass at level 3)');
  });

  it('removes the feat from a slot that no longer exists, but keeps an origin feat', () => {
    let c = base({ level: 4, classes: [{ id: 'fighter', level: 4 }] });
    c = applyFeat(c, { featId: 'alert', level: 0 }, 1); // origin (background) feat
    c = applyFeat(c, { featId: 'ability-score-improvement', level: 4, abilityIncreases: { str: 2 } }, 2);
    const r = undo(c);
    expect(characterFeats(r.character).map((f) => f.featId)).toEqual(['alert']);
    expect(r.preview.removals).toContain('Feat: Ability Score Improvement (+2 STR), from the level 4 slot');
  });

  it('removes a Fighting Style whose class feature is gone (Paladin 2 to 1)', () => {
    let c = base({ level: 2, classes: [{ id: 'paladin', level: 2 }] });
    c = applyFightingStyle(c, 'paladin', 'defense', 1);
    expect(characterFeats(c).some((f) => f.grantedBy === 'paladin')).toBe(true);
    const r = undo(c);
    expect(characterFeats(r.character)).toEqual([]);
    expect(r.preview.removals).toContain('Fighting Style: Defense');
  });

  it('removes class-feature picks for a feature no longer held (Metamagic at Sorcerer 2 to 1)', () => {
    const c = base({
      level: 2,
      classes: [{ id: 'sorcerer', level: 2 }],
      classChoices: { 'sorcerer.metamagic': ['careful-spell', 'quickened-spell'] },
    });
    const r = undo(c);
    expect(r.character.classChoices).toBeUndefined();
    expect(r.preview.removals).toContain('Metamagic options: 2 picks');
  });

  it('keeps picks that still apply but are now over, and lists them as notes (Sorcerer 10 to 9)', () => {
    const c = base({
      level: 10,
      classes: [{ id: 'sorcerer', level: 10 }],
      classChoices: { 'sorcerer.metamagic': ['careful-spell', 'quickened-spell', 'twinned-spell', 'subtle-spell'] },
    });
    const r = undo(c);
    expect(r.character.classChoices?.['sorcerer.metamagic']).toHaveLength(4);
    expect(r.preview.notes).toContain('Metamagic options: 4 chosen, now 2 owed');
  });

  it('lowers the class recorded for the level and removes a class taken at level 1 with its picks', () => {
    let c = base({ level: 1, classes: [{ id: 'fighter', level: 1 }] });
    c = applyMulticlassLevel(c, 'warlock', { mode: 'fixed' }, 5) ?? c;
    c = { ...c, classChoices: { 'warlock.invocations': ['armor-of-shadows'] } };
    expect(lastLevelClassId(c)).toBe('warlock');
    const r = undo(c);
    expect(r.character.classes).toEqual([{ id: 'fighter', level: 1 }]);
    expect(r.character.classChoices).toBeUndefined();
    expect(r.preview.classTo).toBe(0);
    expect(r.preview.removals[0]).toBe('The Warlock class (your level 1 in it), with the skill picks it gave you');
  });

  it('asks which class when a multiclass level was never recorded, and protects the starting class', () => {
    const c = base({ level: 2, classes: [{ id: 'fighter', level: 1 }, { id: 'rogue', level: 1 }] });
    expect(lastLevelClassId(c)).toBeUndefined();
    expect(undoLastLevel(c, 1).ok).toBe(false);
    // Fighter is the starting class at level 1, so only Rogue can be lowered.
    expect(undoableClassIds(c)).toEqual(['rogue']);
    expect(undoLastLevel(c, 1, 'fighter')).toMatchObject({ ok: false });
    expect(undo(c, 'rogue').character.classes).toEqual([{ id: 'fighter', level: 1 }]);
  });

  it('clamps current HP and spent Hit Dice to the new maximum', () => {
    const c0 = levelUp(base({ level: 1, classes: [{ id: 'fighter', level: 1 }] }), 2);
    const max = hitPointMaxOf(c0) ?? 0;
    const c = { ...c0, currentHp: max, hitDiceSpent: 3 };
    const r = undo(c);
    const newMax = hitPointMaxOf(r.character) ?? 0;
    expect(newMax).toBeLessThan(max);
    expect(r.character.currentHp).toBe(newMax);
    expect(r.character.hitDiceSpent).toBe(2);
    expect(r.preview.removals).toContain(`Current hit points lowered from ${max} to your new maximum, ${newMax}`);
  });

  it('never mutates the input character', () => {
    const c = levelUp(base({ level: 1, classes: [{ id: 'fighter', level: 1 }] }), 3);
    const snapshot = JSON.stringify(c);
    undo(c);
    expect(JSON.stringify(c)).toBe(snapshot);
  });
});
