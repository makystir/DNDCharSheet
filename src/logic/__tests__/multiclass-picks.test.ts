import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, SkillId } from '../../types/character';
import type { ClassId } from '../../data/classes';
import { classGrantedSkills } from '../classes';
import { effectiveSkillTraining } from '../skills';
import { multiclassPickStatus, pendingMulticlassPicks } from '../multiclass-picks';

function build(classes: Array<{ id: string; level: number; skillChoices?: SkillId[] }>, extra: Partial<Character> = {}): Character {
  return {
    ...createCharacter('Tester'),
    level: classes.reduce((s, c) => s + c.level, 0),
    classes: classes.map((c) => ({ ...c, id: c.id as ClassId })),
    ...extra,
  };
}

describe('multiclass skill / instrument picks (PHB 2024 "As a Multiclass Character")', () => {
  it('Fighter 1 / Rogue 1 owes one Rogue-list skill', () => {
    const status = multiclassPickStatus(build([{ id: 'fighter', level: 1 }, { id: 'rogue', level: 1 }]));
    expect(status).toHaveLength(1);
    expect(status[0]).toMatchObject({ classId: 'rogue', kind: 'skill', owed: 1, chosen: 0, remaining: 1, over: 0 });
    expect(status[0].from).toContain('stealth');
    expect(status[0].from).not.toContain('arcana');
  });

  it('a Rogue as the INITIAL class owes nothing', () => {
    expect(multiclassPickStatus(build([{ id: 'rogue', level: 3 }, { id: 'fighter', level: 1 }]))).toEqual([]);
  });

  it('a single class owes nothing', () => {
    expect(pendingMulticlassPicks(build([{ id: 'bard', level: 5 }]))).toEqual([]);
  });

  it('a pick applies as a proficiency and clears the pending item', () => {
    const character = build([{ id: 'fighter', level: 1 }, { id: 'rogue', level: 1, skillChoices: ['stealth'] }]);
    expect(pendingMulticlassPicks(character)).toEqual([]);
    expect(classGrantedSkills(character).stealth).toBe('Rogue (class)');
    expect(effectiveSkillTraining(character, 'stealth').proficient).toBe(true);
  });

  it('an off-list skill is invalid: it is kept but does not count', () => {
    const character = build([{ id: 'fighter', level: 1 }, { id: 'rogue', level: 1, skillChoices: ['arcana'] }]);
    const [pick] = multiclassPickStatus(character);
    expect(pick).toMatchObject({ chosen: 0, remaining: 1 });
    expect(character.classes?.[1].skillChoices).toEqual(['arcana']);
  });

  it('over-picking warns (over > 0) and never blocks', () => {
    const character = build([{ id: 'fighter', level: 1 }, { id: 'ranger', level: 1, skillChoices: ['stealth', 'survival'] }]);
    const [pick] = multiclassPickStatus(character);
    expect(pick).toMatchObject({ owed: 1, chosen: 2, remaining: 0, over: 1 });
  });

  it('Ranger takes one skill from the Ranger list', () => {
    const [pick] = multiclassPickStatus(build([{ id: 'fighter', level: 1 }, { id: 'ranger', level: 1 }]));
    expect(pick).toMatchObject({ classId: 'ranger', kind: 'skill', owed: 1 });
    expect(pick.from).toContain('survival');
    expect(pick.from).not.toContain('arcana');
  });

  it('Bard owes one skill (any of the 18) and one Musical Instrument', () => {
    const picks = multiclassPickStatus(build([{ id: 'fighter', level: 1 }, { id: 'bard', level: 1 }]));
    expect(picks.map((p) => [p.classId, p.kind, p.owed])).toEqual([
      ['bard', 'skill', 1],
      ['bard', 'instrument', 1],
    ]);
    expect(picks[0].from).toHaveLength(18);
    const done = build([{ id: 'fighter', level: 1 }, { id: 'bard', level: 1, skillChoices: ['arcana'] }], {
      classChoices: { 'bard.multiclassInstrument': ['lute'] },
    });
    expect(pendingMulticlassPicks(done)).toEqual([]);
  });

  it('classes with no multiclass pick owe nothing (Cleric, Wizard as non-initial)', () => {
    expect(multiclassPickStatus(build([{ id: 'fighter', level: 1 }, { id: 'cleric', level: 1 }, { id: 'wizard', level: 1 }]))).toEqual([]);
  });

  it('cardinality: of the 12 classes exactly Bard (2), Ranger (1) and Rogue (1) owe picks as a second class', () => {
    const owing: Record<string, number> = {};
    for (const id of ['barbarian', 'bard', 'cleric', 'druid', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard']) {
      const n = multiclassPickStatus(build([{ id: 'fighter', level: 1 }, { id, level: 1 }])).length;
      if (n > 0) owing[id] = n;
    }
    expect(owing).toEqual({ bard: 2, ranger: 1, rogue: 1 });
    // Fighter itself, as a second class after another, owes none.
    expect(multiclassPickStatus(build([{ id: 'rogue', level: 1 }, { id: 'fighter', level: 1 }]))).toEqual([]);
  });
});
