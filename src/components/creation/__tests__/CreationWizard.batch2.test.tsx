import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { CreationWizard } from '../CreationWizard';
import { ABILITIES } from '../../../types/character';
import { WIZARD_DRAFT_KEY } from '../../../logic/wizard-draft';

function next() {
  fireEvent.click(screen.getByRole('button', { name: /^(Next|Finish)$/ }));
  // The Class Features step (classes with level 1 feature picks) never blocks: step over it.
  if (screen.queryByRole('heading', { name: /Class Features/ })) {
    fireEvent.click(screen.getByRole('button', { name: /^(Next|Finish)$/ }));
  }
}
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
/** Class, Background and Species done; lands on Skills. */
function throughSpecies(classId = 'fighter') {
  fireEvent.change(screen.getByLabelText('Class'), { target: { value: classId } });
  fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Tess' } });
  next();
  fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
  fireEvent.change(screen.getByLabelText('Intelligence background increase'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Wisdom background increase'), { target: { value: '1' } });
  next();
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dwarf' } });
  next();
}
function assignScores() {
  ABILITIES.forEach((a, i) => {
    fireEvent.change(screen.getByLabelText(`${NAMES[a]} score assignment`), { target: { value: String(i) } });
  });
}

beforeEach(() => localStorage.clear());

describe('Background and Species are separate steps', () => {
  it('shows Background and Species in the step bar and as their own steps', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Step progress' }).textContent).toMatch(/Class.*Background.*Species.*Skills/);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
    next();
    expect(screen.getByRole('heading', { name: /Step 2: Background/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Species')).toBeNull();
  });
});

describe('Jumping between steps', () => {
  it('jumps back and forward to visited steps from the step bar', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    throughSpecies();
    next(); // Abilities
    const bar = within(screen.getByRole('group', { name: 'Step progress' }));
    // Not yet visited: Details is not a button.
    expect(bar.queryByRole('button', { name: /Go to Details/ })).toBeNull();
    fireEvent.click(bar.getByRole('button', { name: /Go to Background/ }));
    expect(screen.getByRole('heading', { name: /Step 2: Background/ })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Step progress' })).getByRole('button', { name: /Go to Ability Scores/ }));
    expect(screen.getByRole('heading', { name: /Ability Scores/ })).toBeInTheDocument();
  });

  it('does not jump past a step that is not finished', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    throughSpecies();
    // Back to Background and break it: later steps are no longer reachable.
    fireEvent.click(within(screen.getByRole('group', { name: 'Step progress' })).getByRole('button', { name: /Go to Background/ }));
    fireEvent.change(screen.getByLabelText('Wisdom background increase'), { target: { value: '0' } });
    expect(within(screen.getByRole('group', { name: 'Step progress' })).queryByRole('button', { name: /Go to Skills/ })).toBeNull();
  });
});

describe('Review', () => {
  it('shows the numbers used first in play, origin, equipment and details, with Edit links', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    throughSpecies();
    next(); // Abilities
    assignScores();
    goTo(/Alignment & Details/);
    fireEvent.change(screen.getByLabelText('Alignment'), { target: { value: 'Lawful Good' } });
    goTo(/Review/);
    const glance = within(screen.getByTestId('review-glance'));
    for (const label of [/^Hit Point Maximum/, /^Armor Class/, /^Speed/, /^Initiative/, /^Passive Perception/, /^Proficiency Bonus/]) {
      expect(glance.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'About Dwarven Toughness' })).toBeInTheDocument();
    expect(screen.getByTestId('review-languages')).toHaveTextContent('Common');
    expect(screen.getByTestId('review-gold')).toHaveTextContent(/GP/);
    expect(screen.getByTestId('review-details')).toHaveTextContent('Alignment: Lawful Good');
    fireEvent.click(screen.getByRole('button', { name: 'Edit origin' }));
    expect(screen.getByRole('heading', { name: /Step 2: Background/ })).toBeInTheDocument();
  });
});

describe('Draft save and resume', () => {
  it('offers to resume an unfinished character and restores it', () => {
    const first = render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    throughSpecies('rogue');
    expect(localStorage.getItem(WIZARD_DRAFT_KEY)).not.toBeNull();
    first.unmount();
    cleanup();

    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    const offer = screen.getByRole('region', { name: 'Unfinished character' });
    expect(offer).toHaveTextContent('Tess (Rogue)');
    fireEvent.click(within(offer).getByRole('button', { name: 'Resume' }));
    expect(screen.getByRole('heading', { name: /Skills/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Unfinished character' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Species')).toHaveValue('dwarf');
  });

  it('Start over discards the draft', () => {
    const first = render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    throughSpecies();
    first.unmount();
    cleanup();
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(localStorage.getItem(WIZARD_DRAFT_KEY)).toBeNull();
    expect(screen.getByLabelText('Class')).toHaveValue('');
  });

  it('clears the draft when the character is finished', () => {
    const onComplete = vi.fn();
    render(<CreationWizard onComplete={onComplete} onCancel={vi.fn()} />);
    throughSpecies();
    next();
    assignScores();
    goTo(/Review/);
    next(); // Finish
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(WIZARD_DRAFT_KEY)).toBeNull();
  });
});
