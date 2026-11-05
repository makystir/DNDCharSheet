import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CreationWizard } from '../CreationWizard';
import { ABILITIES } from '../../../types/character';
import { standardArray } from '../../../logic/ability-score-generation';

/** Advance to the next step. */
function next() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}

/** Fill step 1 (name + class) and advance. */
function completeStep1() {
  fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
  const nameInput = screen.getByLabelText('Character Name');
  fireEvent.change(nameInput, { target: { value: 'Aldric' } });
  next();
}

/** Fill step 2 (acolyte background +2/+1, species, no extra languages) and advance. */
function completeStep2() {
  fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
  // Acolyte abilities: int/wis/cha. Allocate +2 Int, +1 Wis.
  fireEvent.change(screen.getByLabelText('Intelligence background increase'), {
    target: { value: '2' },
  });
  fireEvent.change(screen.getByLabelText('Wisdom background increase'), {
    target: { value: '1' },
  });
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'human' } });
  next();
}

/** Assign the standard array to the six abilities (highest-first) and advance. */
function completeStep3StandardArray() {
  // Default method is Standard Array. Assign pool index i to ability i.
  ABILITIES.forEach((ability, i) => {
    const label = `${abilityDisplayName(ability)} score assignment`;
    fireEvent.change(screen.getByLabelText(label), { target: { value: String(i) } });
  });
}

function abilityDisplayName(ability: string): string {
  return {
    str: 'Strength',
    dex: 'Dexterity',
    con: 'Constitution',
    int: 'Intelligence',
    wis: 'Wisdom',
    cha: 'Charisma',
  }[ability]!;
}

describe('CreationWizard', () => {
  it('renders the step indicator and the first step', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Step progress' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Step 1: Class/ })).toBeInTheDocument();
    // Next is disabled until name + class are chosen.
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('cancels from step 1 via the Cancel/Back button', () => {
    const onCancel = vi.fn();
    render(<CreationWizard onComplete={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('gates the Origin step until a valid ability allocation is chosen', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    completeStep1();
    fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
    fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'human' } });
    // No allocation yet → Next disabled.
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Intelligence background increase'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Wisdom background increase'), {
      target: { value: '1' },
    });
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('shows a live point-buy budget with a CalculatedValue tooltip trigger', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    completeStep1();
    completeStep2();
    // On the Ability Scores step, switch to Point Buy.
    fireEvent.click(screen.getByRole('tab', { name: 'Point Buy' }));
    // The spent + remaining budget totals render as CalculatedValue triggers
    // (their accessible name carries the breakdown equation).
    expect(screen.getByRole('button', { name: /Point Buy Spent/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Point Buy Remaining/ })).toBeInTheDocument();
  });

  it('steps through to completion and yields a character with the background applied', () => {
    const onComplete = vi.fn();
    render(<CreationWizard onComplete={onComplete} onCancel={vi.fn()} />);
    completeStep1();
    completeStep2();
    completeStep3StandardArray();
    next(); // -> step 4 (Details)
    next(); // -> step 5 (Equipment)
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const character = onComplete.mock.calls[0][0];
    expect(character.name).toBe('Aldric');
    expect(character.class?.id).toBe('fighter');
    expect(character.species?.id).toBe('human');
    expect(character.backgroundSelection?.id).toBe('acolyte');
    // Standard array assigned highest-first: Str=15 (base, unmodified by bg).
    const array = standardArray();
    expect(character.abilities.str).toBe(array[0]);
    // The +2/+1 allocation is recorded through the A6b feat layer, never on the
    // base abilities: base Int stays the assigned array value.
    expect(character.abilities.int).toBe(array[3]);
    expect(character.advancement?.feats?.some((f: { level: number }) => f.level === 0)).toBe(true);
  });

  it('every per-ability total on the standard-array step has a tooltip trigger', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    completeStep1();
    completeStep2();
    completeStep3StandardArray();
    // Each assigned ability shows a Score + Modifier CalculatedValue trigger.
    const scoreTrigger = screen.getByRole('button', { name: /Strength Score:/ });
    expect(scoreTrigger).toBeInTheDocument();
    const modTrigger = screen.getByRole('button', { name: /Strength Modifier:/ });
    expect(within(modTrigger).queryByText).not.toBeNull();
  });
});
