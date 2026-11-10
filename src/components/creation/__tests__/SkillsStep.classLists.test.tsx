import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkillsStep } from '../SkillsStep';
import { CLASS_LIST } from '../../../data/classes';
import { SKILLS } from '../../../types/character';

// PHB 2024 "Core <Class> Traits" Skill Proficiencies, transcribed independently of
// data/classes.ts (Docs/PlayersHandbook.md: Barbarian L2388, Bard L2689, Cleric L3127,
// Druid L3585, Fighter L4094, Monk L4489, Paladin L4823, Ranger L5331, Rogue L5857,
// Sorcerer L6231, Warlock L6784, Wizard L7370).
const PHB: Record<string, { count: number; skills: string[] | 'any' }> = {
  barbarian: { count: 2, skills: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'] },
  bard: { count: 3, skills: 'any' },
  cleric: { count: 2, skills: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'] },
  druid: { count: 2, skills: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'] },
  fighter: { count: 2, skills: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Persuasion', 'Perception', 'Survival'] },
  monk: { count: 2, skills: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'] },
  paladin: { count: 2, skills: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'] },
  ranger: { count: 3, skills: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'] },
  rogue: { count: 4, skills: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Persuasion', 'Sleight of Hand', 'Stealth'] },
  sorcerer: { count: 2, skills: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'] },
  warlock: { count: 2, skills: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'] },
  wizard: { count: 2, skills: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Nature', 'Religion'] },
};

describe('class skill lists match the PHB', () => {
  it('covers all 12 classes', () => {
    expect(CLASS_LIST.map((c) => c.id).sort()).toEqual(Object.keys(PHB).sort());
  });

  for (const cls of CLASS_LIST) {
    it(`${cls.id}: the data and the wizard Skills step offer exactly the printed list`, () => {
      const book = PHB[cls.id];
      const all = SKILLS.map((s) => s.name);
      const expected = (book.skills === 'any' ? all : book.skills).slice().sort();
      expect(cls.skillChoices.count).toBe(book.count);

      const fromData =
        cls.skillChoices.from === 'any'
          ? all
          : cls.skillChoices.from.map((id) => SKILLS.find((s) => s.id === id)!.name);
      expect(fromData.slice().sort()).toEqual(expected);

      render(
        <SkillsStep
          classId={cls.id}
          backgroundId=""
          speciesId=""
          speciesChoices={{}}
          chosen={[]}
          onChange={() => {}}
        />,
      );
      const rendered = screen
        .getAllByRole('checkbox')
        .map((c) => c.getAttribute('aria-label')!)
        .sort();
      expect(rendered).toEqual(expected);
    });
  }
});
