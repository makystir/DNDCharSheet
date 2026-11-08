/**
 * Feat-granted picks and the class Fighting Style pick (Stage 1 of the level-up
 * gap work). Covers the derived skill / Expertise / save proficiencies, their
 * integration with the Expertise pool, and applyFightingStyle / removeFeat.
 */
import { describe, it, expect } from 'vitest';
import {
  applyFeat,
  applyFightingStyle,
  featGrantedExpertise,
  featGrantedSaves,
  featGrantedSkills,
  fightingStyleSlots,
  removeFeat,
} from '../feats';
import { effectiveSkillTraining, allSkillBreakdowns } from '../skills';
import { savingThrowProficiency } from '../saving-throws';
import { expertiseStatus } from '../expertise';
import { createCharacter } from '../../storage/character-store';
import type { Character, ClassEntry } from '../../types/character';

function make(classId: string, level: number): Character {
  const c = createCharacter('Picks');
  return {
    ...c,
    level,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    classes: [{ id: classId, level }] as unknown as ClassEntry[],
  };
}

describe('feat-granted skills, Expertise and saves are derived', () => {
  it('Skill Expert grants proficiency and Expertise, and removing it reverts both', () => {
    const base = make('fighter', 4);
    const taken = applyFeat(
      base,
      {
        featId: 'skill-expert',
        level: 4,
        abilityIncreases: { str: 1 },
        choices: { skills: ['stealth'], expertise: ['stealth'] },
      },
      1,
    );
    expect(featGrantedSkills(taken).stealth).toBe('Skill Expert (feat)');
    expect(featGrantedExpertise(taken)).toEqual(['stealth']);
    const t = effectiveSkillTraining(taken, 'stealth');
    expect(t).toMatchObject({ proficient: true, expertise: true, source: 'feat' });
    // PB 2 at level 4: proficiency + expertise = +4 over a Dex 10 (+0) modifier.
    expect(allSkillBreakdowns(taken).stealth.total).toBe(0 + 2 + 2);

    const removed = removeFeat(taken, 4, 2, 'skill-expert');
    expect(effectiveSkillTraining(removed, 'stealth').proficient).toBe(false);
    expect(effectiveSkillTraining(removed, 'stealth').expertise).toBe(false);
  });

  it('feat Expertise satisfies itself and is never a pending class pick', () => {
    const taken = applyFeat(
      make('fighter', 4),
      {
        featId: 'skill-expert',
        level: 4,
        abilityIncreases: { str: 1 },
        choices: { skills: ['stealth'], expertise: ['stealth'] },
      },
      1,
    );
    const status = expertiseStatus(taken);
    expect(status.owed).toBe(1);
    expect(status.chosen).toBe(1);
    expect(status.remaining).toBe(0);
    expect(status.over).toBe(0);
  });

  it('Boon of Skill grants proficiency in every skill', () => {
    const taken = applyFeat(
      make('fighter', 19),
      {
        featId: 'boon-of-skill',
        level: 19,
        abilityIncreases: { str: 1 },
        choices: { expertise: ['arcana'] },
      },
      1,
    );
    for (const id of ['acrobatics', 'arcana', 'survival'] as const) {
      expect(effectiveSkillTraining(taken, id).proficient, id).toBe(true);
    }
    expect(effectiveSkillTraining(taken, 'arcana').expertise).toBe(true);
    expect(effectiveSkillTraining(taken, 'survival').expertise).toBe(false);
  });

  it('Resilient grants proficiency in the saving throw it increased', () => {
    const taken = applyFeat(
      make('wizard', 4),
      { featId: 'resilient', level: 4, abilityIncreases: { con: 1 } },
      1,
    );
    expect(featGrantedSaves(taken).con).toBe('Resilient (feat)');
    expect(savingThrowProficiency(taken, 'con')).toEqual({ proficient: true, source: 'feat' });
    // Wizard saves stay class-granted.
    expect(savingThrowProficiency(taken, 'int').source).toBe('class');
    expect(savingThrowProficiency(taken, 'str').proficient).toBe(false);
  });

  it('ignores the level-0 background feat selection for skills', () => {
    const c = applyFeat(
      make('fighter', 1),
      { featId: 'skilled', level: 0, choices: { skills: ['arcana'] } },
      1,
    );
    expect(featGrantedSkills(c)).toEqual({});
  });
});

describe('applyFightingStyle', () => {
  it('records the pick against the class at level 0, without binding an ASI slot', () => {
    const c = applyFightingStyle(make('fighter', 1), 'fighter', 'archery', 5);
    expect(c.advancement?.feats).toEqual([{ featId: 'archery', level: 0, grantedBy: 'fighter' }]);
    expect(fightingStyleSlots(c)[0].filled?.featId).toBe('archery');
    expect(c.advancement?.log?.at(-1)?.detail).toBe('Level 1: Fighter Fighting Style: took Archery');
  });

  it('swaps an earlier pick for the same class and can remove it', () => {
    const first = applyFightingStyle(make('paladin', 2), 'paladin', 'defense', 1);
    const second = applyFightingStyle(first, 'paladin', 'dueling', 2);
    expect(second.advancement?.feats?.map((f) => f.featId)).toEqual(['dueling']);
    const gone = removeFeat(second, 0, 3, 'dueling');
    expect(fightingStyleSlots(gone)[0].filled).toBeUndefined();
  });

  it('is a no-op for a class without the feature or a non-Fighting-Style feat', () => {
    const wizard = make('wizard', 5);
    expect(applyFightingStyle(wizard, 'wizard', 'archery', 1)).toBe(wizard);
    const fighter = make('fighter', 1);
    expect(applyFightingStyle(fighter, 'fighter', 'alert', 1)).toBe(fighter);
  });
});
