import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CreationWizard } from '../CreationWizard';
import { ABILITIES } from '../../../types/character';
import type { Character } from '../../../types/character';

const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|Finish)$/ }));
const nextBtn = () => screen.getByRole('button', { name: /^(Next|Finish)$/ });
const NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

/** Press Next until the heading appears; fail (never hang) if it doesn't. */
function goTo(heading: RegExp) {
  for (let i = 0; i < 10 && !screen.queryByRole('heading', { name: heading }); i++) next();
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
}

function origin() {
  fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
  fireEvent.change(screen.getByLabelText('Intelligence background increase'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Wisdom background increase'), { target: { value: '1' } });
  next(); // Background -> Species
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'human' } });
}

describe('Wizard flow: names, blockers and focus', () => {
  it('lets you continue without a name, and says what is missing on each step', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(nextBtn()).toBeDisabled();
    expect(screen.getByTestId('wizard-missing')).toHaveTextContent('To continue: choose a class.');
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
    expect(nextBtn()).toBeEnabled();
    next();
    expect(screen.getByTestId('wizard-missing')).toHaveTextContent('To continue: choose a background.');
    fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
    expect(screen.getByTestId('wizard-missing')).toHaveTextContent('set your background ability increases');
  });

  it('needs a name only to Finish, and the Details step can roll one', () => {
    const onComplete = vi.fn();
    render(<CreationWizard onComplete={onComplete} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
    next();
    origin();
    next(); // Skills
    next(); // Abilities
    ABILITIES.forEach((a, i) => {
      fireEvent.change(screen.getByLabelText(`${NAMES[a]} score assignment`), { target: { value: String(i) } });
    });
    goTo(/Review/);
    expect(nextBtn()).toBeDisabled();
    expect(screen.getByTestId('wizard-missing')).toHaveTextContent('To finish: give your character a name');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    // Back on Details (Equipment is between Details and Review).
    expect(screen.getByRole('heading', { name: /Alignment & Details/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generate name' }));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value.length).toBeGreaterThan(0);
    goTo(/Review/);
    next();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the new step heading', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
    next();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: /Step 2: Background/ }));
  });
});

describe('Wizard flow: warnings before clearing picks', () => {
  it('asks before a class change clears skill picks, and Keep leaves everything', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
    next();
    origin();
    next(); // Skills
    fireEvent.click(screen.getByRole('checkbox', { name: 'Athletics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'wizard' } });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Change class to Wizard? This clears your class skill picks.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep' }));
    expect(screen.getByLabelText('Class')).toHaveValue('fighter');
    // Change for real: the skill pick is gone.
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'wizard' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Change' }));
    expect(screen.getByLabelText('Class')).toHaveValue('wizard');
    next(); // Background (still set)
    next(); // Species (still set)
    next(); // Skills
    expect(screen.getByTestId('skills-counter')).toHaveTextContent('0 of');
  });

  it('changes class without asking when nothing would be lost', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'wizard' } });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Class')).toHaveValue('wizard');
  });

  it('asks before a background change clears the ability increases', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
    next();
    origin();
    fireEvent.click(screen.getByRole('button', { name: 'Back' })); // Species -> Background
    fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'sage' } });
    expect(screen.getByRole('dialog')).toHaveTextContent('This clears your background ability increases.');
  });
});

describe('Wizard flow: final ability scores and details', () => {
  it('shows the score with the background increase included', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
    next();
    origin(); // +2 Intelligence, +1 Wisdom
    next();
    next(); // Abilities
    expect(screen.getByTestId('ability-background-note')).toHaveTextContent('+2 Intelligence and +1 Wisdom');
    // Intelligence gets 15 (index 0): 15 + 2 = 17.
    fireEvent.change(screen.getByLabelText('Intelligence score assignment'), { target: { value: '0' } });
    expect(screen.getByTestId('bonus-int')).toHaveTextContent('+2 background');
    const total = screen.getByRole('button', { name: /^Intelligence Score/ });
    expect(total).toHaveTextContent('17');
    expect(total.getAttribute('aria-label')).toMatch(/Acolyte increase/);
    // Point buy shows the final score too: 8 + 2 = 10.
    fireEvent.click(screen.getByRole('tab', { name: 'Point Buy' }));
    expect(screen.getByRole('button', { name: /^Intelligence Score/ })).toHaveTextContent('10');
  });

  it('has an Age field with a generator and editable appearance', () => {
    const onComplete = vi.fn();
    render(<CreationWizard onComplete={onComplete} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
    fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Tess' } });
    next();
    origin();
    next();
    next();
    ABILITIES.forEach((a, i) => {
      fireEvent.change(screen.getByLabelText(`${NAMES[a]} score assignment`), { target: { value: String(i) } });
    });
    goTo(/Alignment & Details/);
    fireEvent.click(screen.getByRole('button', { name: 'Generate age' }));
    expect(Number((screen.getByLabelText('Age') as HTMLInputElement).value)).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '31' } });
    fireEvent.change(screen.getByLabelText('Eyes'), { target: { value: 'Green' } });
    goTo(/Review/);
    next();
    const made = onComplete.mock.calls[0][0] as Character;
    expect(made.age).toBe('31');
    expect(made.eyes).toBe('Green');
  });
});
