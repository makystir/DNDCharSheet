import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character } from '../../types/character';
import {
  earnedExpertiseGrants,
  expertiseOwed,
  expertiseSkills,
  expertiseStatus,
  setSkillExpertise,
} from '../expertise';

function make(overrides: Partial<Character>): Character {
  return { ...createCharacter('Tester'), ...overrides };
}

// Owed counts per PHB 2024: Bard L2 two + L9 two (L2794-2798); Ranger Deft
// Explorer L2 one + Expertise L9 two (L5412-5440); Rogue L1 two + L6 two
// (L5882-5886); Wizard Scholar L2 one (L7465-7467).
describe('expertiseOwed (PHB 2024 class features)', () => {
  const cases: Array<[string, string, number, number]> = [
    ['rogue', 'Rogue', 1, 2],
    ['rogue', 'Rogue', 5, 2],
    ['rogue', 'Rogue', 6, 4],
    ['bard', 'Bard', 1, 0],
    ['bard', 'Bard', 2, 2],
    ['bard', 'Bard', 9, 4],
    ['ranger', 'Ranger', 1, 0],
    ['ranger', 'Ranger', 2, 1],
    ['ranger', 'Ranger', 9, 3],
    ['wizard', 'Wizard', 1, 0],
    ['wizard', 'Wizard', 2, 1],
    ['fighter', 'Fighter', 20, 0],
  ];
  for (const [id, , level, owed] of cases) {
    it(`${id} ${level} owes ${owed}`, () => {
      const c = make({ level, classes: [{ id: id as 'rogue', level }] });
      expect(expertiseOwed(c)).toBe(owed);
    });
  }

  it('sums grants across classes by each class level (multiclass)', () => {
    const c = make({
      level: 8,
      classes: [
        { id: 'rogue', level: 6 },
        { id: 'bard', level: 2 },
      ],
    });
    expect(expertiseOwed(c)).toBe(6);
    expect(earnedExpertiseGrants(c).map((e) => e.label)).toEqual(['Rogue 1', 'Rogue 6', 'Bard 2']);
  });
});

describe('expertise status and picks', () => {
  const rogue = (skills: Character['skills']): Character =>
    make({ level: 1, classes: [{ id: 'rogue', level: 1 }], skills });

  it('counts only skills with expertise AND proficiency', () => {
    const c = rogue({
      stealth: { proficient: true, expertise: true },
      acrobatics: { proficient: false, expertise: true }, // no PB to double
    });
    expect(expertiseSkills(c)).toEqual(['stealth']);
  });

  it('reports remaining picks and eligible (proficient, not yet expert) skills', () => {
    const c = rogue({
      stealth: { proficient: true, expertise: true },
      perception: { proficient: true },
      insight: { proficient: true },
    });
    const s = expertiseStatus(c);
    expect(s).toMatchObject({ owed: 2, chosen: 1, remaining: 1, over: 0 });
    expect(s.eligible.sort()).toEqual(['insight', 'perception']);
  });

  it('warns (over) instead of blocking when more is chosen than granted', () => {
    const c = rogue({
      stealth: { proficient: true, expertise: true },
      perception: { proficient: true, expertise: true },
      insight: { proficient: true, expertise: true },
    });
    expect(expertiseStatus(c)).toMatchObject({ owed: 2, chosen: 3, remaining: 0, over: 1 });
  });

  it('restricts a Wizard Scholar pick to the six Scholar skills', () => {
    const c = make({ level: 2, classes: [{ id: 'wizard', level: 2 }] });
    expect(expertiseStatus(c).restrictedTo).toEqual([
      'arcana', 'history', 'investigation', 'medicine', 'nature', 'religion',
    ]);
    const rogueWizard = make({
      level: 3,
      classes: [
        { id: 'rogue', level: 1 },
        { id: 'wizard', level: 2 },
      ],
    });
    expect(expertiseStatus(rogueWizard).restrictedTo).toBeUndefined();
  });

  it('setSkillExpertise needs proficiency to set, always allows clearing', () => {
    const c = rogue({ stealth: { proficient: true } });
    expect(setSkillExpertise(c, 'stealth', true).skills?.stealth?.expertise).toBe(true);
    expect(setSkillExpertise(c, 'arcana', true)).toBe(c);
    const cleared = setSkillExpertise(
      rogue({ stealth: { proficient: true, expertise: true } }),
      'stealth',
      false,
    );
    expect(cleared.skills?.stealth).toEqual({ proficient: true, expertise: false });
  });
});
