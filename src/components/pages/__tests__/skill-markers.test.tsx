import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import { CharacterPage } from '../CharacterPage';
import { OverviewAbilities } from '../character/OverviewAbilities';
import { buildSkills } from '../../layout/printLayoutGenerators';
import { createCharacter } from '../../../storage/character-store';
import type { Character } from '../../../types/character';

afterEach(cleanup);

/** Wizard who picked Arcana in the wizard (class-granted), Human Skillful Insight, manual History. */
const character: Character = {
  ...createCharacter('Markers'),
  level: 1,
  classes: [{ id: 'wizard', level: 1, skillChoices: ['arcana'] }],
  species: { id: 'human', skillfulSkill: 'insight' },
  skills: { history: { proficient: true } },
};

describe('skill proficiency markers show class- and species-granted skills', () => {
  it('Overview: P marker on class, species and manual skills, none on others', () => {
    render(<OverviewAbilities character={character} onChange={vi.fn()} />);
    for (const id of ['arcana', 'insight', 'history']) {
      const row = screen.getByTestId(`overview-skill-${id}`);
      expect(within(row).getByRole('img', { name: 'proficient' })).toHaveTextContent('P');
    }
    expect(within(screen.getByTestId('overview-skill-stealth')).queryByRole('img')).toBeNull();
  });

  it('print sheet: proficient flag follows the effective proficiency', () => {
    const rows = Object.fromEntries(buildSkills(character).map((r) => [r.id, r]));
    expect(rows.arcana.proficient).toBe(true);
    expect(rows.insight.proficient).toBe(true);
    expect(rows.history.proficient).toBe(true);
    expect(rows.stealth.proficient).toBe(false);
    expect(rows.stealth.expertise).toBe(false);
  });

  it('Overview Edit mode: granted skills are checked, locked and labelled; others stay manual', () => {
    render(<CharacterPage character={character} onChange={vi.fn()} subTab="identity" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const arcana = screen.getByLabelText('Arcana proficiency') as HTMLInputElement;
    expect(arcana.checked).toBe(true);
    expect(arcana.disabled).toBe(true);
    expect(within(arcana.closest('li')!).getByText('from Wizard (class)')).toBeInTheDocument();
    const insight = screen.getByLabelText('Insight proficiency') as HTMLInputElement;
    expect(insight.checked).toBe(true);
    expect(insight.disabled).toBe(true);
    expect(within(insight.closest('li')!).getByText('from Human (species)')).toBeInTheDocument();
    // Manual skill: checked but still editable, no source label.
    const history = screen.getByLabelText('History proficiency') as HTMLInputElement;
    expect(history.checked).toBe(true);
    expect(history.disabled).toBe(false);
    const stealth = screen.getByLabelText('Stealth proficiency') as HTMLInputElement;
    expect(stealth.checked).toBe(false);
    expect(stealth.disabled).toBe(false);
  });

  it('Expertise becomes available whenever the skill is effectively proficient', () => {
    render(<CharacterPage character={character} onChange={vi.fn()} subTab="identity" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect((screen.getByLabelText('Arcana expertise') as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByLabelText('Insight expertise') as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByLabelText('Stealth expertise') as HTMLInputElement).disabled).toBe(true);
  });
});
