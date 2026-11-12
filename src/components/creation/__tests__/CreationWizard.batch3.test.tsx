import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CreationWizard } from '../CreationWizard';
import { WelcomeScreen } from '../WelcomeScreen';
import { ABILITIES } from '../../../types/character';

const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|Finish)$/ }));
const NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};
function goTo(heading: RegExp) {
  for (let i = 0; i < 10 && !screen.queryByRole('heading', { name: heading }); i++) next();
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
}
function throughSpecies(classId = 'fighter') {
  fireEvent.change(screen.getByLabelText('Class'), { target: { value: classId } });
  fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Tess' } });
  next();
  fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
  fireEvent.change(screen.getByLabelText('Intelligence background increase'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Wisdom background increase'), { target: { value: '1' } });
  next();
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'human' } });
  next();
}

beforeEach(() => localStorage.clear());

describe('Welcome screen', () => {
  it('says who each way of making a character is for', () => {
    render(<WelcomeScreen onCharacterReady={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Guided Wizard' })).toHaveAccessibleDescription(/new to D&D/);
    expect(screen.getByRole('button', { name: 'Roll a Random Character' })).toHaveAccessibleDescription(/Ready to play/);
    expect(screen.getByRole('button', { name: 'Skip the Wizard' })).toHaveAccessibleDescription(/experienced players/);
  });
});

describe('Skills step training tooltips', () => {
  it('explains armor training and weapon proficiency', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    throughSpecies('fighter');
    fireEvent.click(screen.getByRole('button', { name: 'About Heavy armor' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent("can't cast spells");
  });
});

describe('Rolled scores', () => {
  it('places the rolls the way the class ranks its abilities', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    throughSpecies('wizard');
    goTo(/Ability Scores/);
    fireEvent.click(screen.getByRole('tab', { name: 'Roll 4d6' }));
    fireEvent.click(screen.getByRole('button', { name: /Roll 4d6 \(drop lowest\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Place my rolls for my class' }));
    const score = (a: string) =>
      Number(
        (screen.getByLabelText(`${NAMES[a]} score assignment`) as HTMLSelectElement).selectedOptions[0].textContent,
      );
    // Wizard ranks Intelligence highest and Strength lowest (PHB "Standard Array by Class").
    for (const a of ABILITIES) expect(score('int')).toBeGreaterThanOrEqual(score(a));
    for (const a of ABILITIES) expect(score('str')).toBeLessThanOrEqual(score(a));
  });
});

describe('Equipment packages', () => {
  it('compares the class packages side by side, with what each item is', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    throughSpecies('fighter');
    goTo(/Ability Scores/);
    ABILITIES.forEach((a, i) => {
      fireEvent.change(screen.getByLabelText(`${NAMES[a]} score assignment`), { target: { value: String(i) } });
    });
    goTo(/Step \d: Equipment/);
    fireEvent.click(screen.getByText(/Compare the Fighter choices side by side/));
    const compare = within(screen.getByTestId('class-package-compare'));
    expect(compare.getByText('Package A')).toBeInTheDocument();
    expect(compare.getByText('Package B')).toBeInTheDocument();
    fireEvent.click(compare.getByRole('button', { name: 'Take Package B' }));
    expect(screen.getByRole('tab', { name: 'Package B' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(compare.getAllByRole('button', { name: "About Dungeoneer's Pack" })[0]);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Crowbar|Backpack/);
  });
});

describe('Personality on the Details step', () => {
  it('rolls a sketch that fits the chosen alignment', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    throughSpecies();
    goTo(/Ability Scores/);
    ABILITIES.forEach((a, i) => {
      fireEvent.change(screen.getByLabelText(`${NAMES[a]} score assignment`), { target: { value: String(i) } });
    });
    goTo(/Alignment & Details/);
    fireEvent.change(screen.getByLabelText('Alignment'), { target: { value: 'Lawful Good' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate personality' }));
    const text = (screen.getByLabelText('Personality') as HTMLTextAreaElement).value;
    expect(text).toMatch(/^(Cooperative|Loyal|Judgmental|Methodical) and (compassionate|helpful|honest|kind)\./);
    expect(text).toMatch(/Ideal: .+ Bond: .+ Flaw: .+/);
  });
});
