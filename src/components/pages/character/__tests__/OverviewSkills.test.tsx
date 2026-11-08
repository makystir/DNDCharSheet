import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { OverviewSkills } from '../OverviewSkills';
import { createCharacter } from '../../../../storage/character-store';
import type { Character } from '../../../../types/character';
import { ABILITIES, SKILLS } from '../../../../types/character';
import { allSkillBreakdowns, getSkillTraining } from '../../../../logic/skills';
import { allSavingThrowBreakdowns } from '../../../../logic/saving-throws';
import { formatSigned } from '../../../../logic/breakdown';

afterEach(cleanup);

const character: Character = {
  ...createCharacter('Tester'),
  level: 5,
  classes: [{ id: 'fighter', level: 5 }],
  abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
  saveProficiencies: { str: true, con: true },
  skills: {
    athletics: { proficient: true, expertise: true },
    perception: { proficient: true },
  },
};

describe('OverviewSkills', () => {
  it('renders all 18 skills and 6 saves, each with a CalculatedValue equal to the logic', () => {
    render(<OverviewSkills character={character} />);
    const skills = allSkillBreakdowns(character);
    const saves = allSavingThrowBreakdowns(character);
    expect(SKILLS).toHaveLength(18);
    for (const skill of SKILLS) {
      const row = screen.getByTestId(`overview-skill-${skill.id}`);
      const button = within(row).getByRole('button', { name: new RegExp(`^${skill.name} Check`) });
      expect(button.textContent).toBe(formatSigned(skills[skill.id].total));
    }
    for (const ability of ABILITIES) {
      const chip = screen.getByTestId(`overview-save-${ability}`);
      const button = within(chip).getByRole('button', { name: /Save:/ });
      expect(button.textContent).toBe(formatSigned(saves[ability].total));
    }
  });

  it('lists skills alphabetically', () => {
    render(<OverviewSkills character={character} />);
    const names = within(screen.getByRole('list', { name: 'Skills' }))
      .getAllByRole('listitem')
      .map((li) => li.getAttribute('data-testid'));
    const expected = [...SKILLS]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => `overview-skill-${s.id}`);
    expect(names).toEqual(expected);
  });

  it('marks proficient and expert rows and proficient saves with text markers', () => {
    render(<OverviewSkills character={character} />);
    expect(
      within(screen.getByTestId('overview-skill-athletics')).getByLabelText('expertise'),
    ).toHaveTextContent('E');
    expect(
      within(screen.getByTestId('overview-skill-perception')).getByLabelText('proficient'),
    ).toHaveTextContent('P');
    expect(
      within(screen.getByTestId('overview-skill-stealth')).queryByRole('img'),
    ).toBeNull();
    expect(within(screen.getByTestId('overview-save-str')).getByLabelText('proficient')).toBeInTheDocument();
    expect(within(screen.getByTestId('overview-save-dex')).queryByRole('img')).toBeNull();
  });

  it('marks a class-granted save as proficient without any manual tick', () => {
    const wizard: Character = {
      ...createCharacter('Wiz'),
      classes: [{ id: 'wizard', level: 1 }],
    };
    render(<OverviewSkills character={wizard} />);
    expect(within(screen.getByTestId('overview-save-int')).getByLabelText('proficient')).toBeInTheDocument();
    expect(within(screen.getByTestId('overview-save-wis')).getByLabelText('proficient')).toBeInTheDocument();
    expect(within(screen.getByTestId('overview-save-str')).queryByRole('img')).toBeNull();
  });
  it('has a single header that is also the collapse toggle (persisted)', () => {
    localStorage.removeItem('dnd-collapse-overview-skills');
    render(<OverviewSkills character={character} />);
    const headings = screen.getAllByRole('heading');
    expect(headings.map((h) => h.textContent)).toEqual(['Skills & Saves']);
    expect(screen.queryByText(/Saves and skills/i)).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Skills & Saves' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Skills & Saves' })).toBeVisible();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(localStorage.getItem('dnd-collapse-overview-skills')).toBe('false');
    localStorage.removeItem('dnd-collapse-overview-skills');
  });

  it('renders the six saves in one grid container', () => {
    render(<OverviewSkills character={character} />);
    const grid = screen.getByTestId('overview-saves-grid');
    expect(grid).toHaveAccessibleName('Saving throws');
    expect(grid.children).toHaveLength(6);
    for (const ability of ABILITIES) {
      expect(grid).toContainElement(screen.getByTestId(`overview-save-${ability}`));
    }
  });

  it('links to Abilities & Skills to edit proficiencies', () => {
    render(<OverviewSkills character={character} />);
    expect(
      screen.getByRole('link', { name: 'Edit proficiencies on Abilities & Skills' }),
    ).toHaveAttribute('href', '#character/abilities');
  });

  it('matches the Abilities & Skills tab skill modifiers (parity)', () => {
    // Both views read allSkillBreakdowns; proficiency state comes from getSkillTraining.
    render(<OverviewSkills character={character} />);
    const tab = allSkillBreakdowns(character);
    for (const skill of SKILLS) {
      const row = screen.getByTestId(`overview-skill-${skill.id}`);
      const shown = within(row).getByRole('button', { name: /Check:/ }).textContent;
      expect(shown).toBe(formatSigned(tab[skill.id].total));
      const training = getSkillTraining(character, skill.id);
      expect(Boolean(within(row).queryByRole('img'))).toBe(Boolean(training.proficient));
    }
  });
});

describe('OverviewSkills content tooltips', () => {
  it('opens a skill tooltip with its ability, example uses and the character\u2019s training', () => {
    render(<OverviewSkills character={character} />);
    fireEvent.click(screen.getByRole('button', { name: 'About Acrobatics' }));
    expect(screen.getByText('Acrobatics (Dexterity)')).toBeInTheDocument();
    expect(screen.getByText(/Stay on your feet in a tricky situation/)).toBeInTheDocument();
    expect(screen.getByText('Your training')).toBeInTheDocument();
  });

  it('opens a saving throw tooltip describing what the save is for', () => {
    render(<OverviewSkills character={character} />);
    fireEvent.click(screen.getByRole('button', { name: 'About Dexterity saving throw' }));
    expect(screen.getByText(/dodge out of harm.s way/i)).toBeInTheDocument();
  });
});
