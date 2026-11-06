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
    expect(character.classes?.[0]?.id).toBe('fighter');
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

  it('shows a Rogue a 1-language feature picker and Thieves\u2019 Cant as a read-only known language', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'rogue' } });
    fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Shadow' } });
    next();
    // The feature fieldset announces "choose 1" and the auto-granted Thieves' Cant.
    expect(screen.getByText(/Rogue feature languages/)).toBeInTheDocument();
    expect(screen.getByText(/choose 1/)).toBeInTheDocument();
    expect(screen.getByText(/Known automatically: .*Thieves/)).toBeInTheDocument();
    // Thieves' Cant is NOT a pickable feature checkbox (it is a fixed auto-grant).
    expect(screen.queryByLabelText(/Thieves.*\(feature\)/)).toBeNull();
    // Picking one feature language disables the rest (cap of 1).
    fireEvent.click(screen.getByLabelText('Goblin (feature)'));
    expect(screen.getByLabelText('Giant (feature)')).toBeDisabled();
  });

  it('shows a Ranger no feature-language picker at creation (Deft Explorer is a level-2 feature)', () => {
    // The wizard always creates a LEVEL-1 character. Ranger's Deft Explorer
    // grant is gained at level 2 (PHB 2024), so it is not yet reached at
    // creation and no feature picker is shown — matching the golden's gating
    // (Ranger level 1 → chooseCount 0). The 2-language picker surfaces on the
    // sheet once the Ranger reaches level 2.
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'ranger' } });
    fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Scout' } });
    next();
    expect(screen.queryByText(/feature languages/)).toBeNull();
  });

  it('shows a Fighter no feature-language picker', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
    fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Aldric' } });
    next();
    expect(screen.queryByText(/feature languages/)).toBeNull();
  });

  it('shows a class overview panel once a class is selected (and not before)', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    // Nothing before a class is chosen.
    expect(screen.queryByRole('note', { name: 'Class overview' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
    const panel = screen.getByRole('note', { name: 'Class overview' });
    expect(panel).toBeInTheDocument();
    // Fighter facts, read from class data (Str or Dex; Str & Con saves; d10).
    expect(within(panel).getByText(/Strength or Dexterity/)).toBeInTheDocument();
    expect(within(panel).getByText(/Strength & Constitution/)).toBeInTheDocument();
    expect(within(panel).getByText(/d10/)).toBeInTheDocument();
    // Fighter is a non-caster base class → no spellcasting line.
    expect(within(panel).queryByText(/Spellcasting:/)).toBeNull();
  });

  it('nothing auto-fills the ability scores on class selection', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    completeStep1();
    completeStep2();
    // On the Ability Scores step the standard-array slots are still unassigned
    // (each select shows the placeholder "—"); only an explicit tap fills them.
    const strSelect = screen.getByLabelText('Strength score assignment') as HTMLSelectElement;
    expect(strSelect.value).toBe('-1');
  });

  it('shows per-ability hints on the Ability Scores step', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    completeStep1(); // fighter
    completeStep2();
    // Fighter: primary Str, dump Int, saves Str & Con. Recommended values shown.
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Dump')).toBeInTheDocument();
    expect(screen.getAllByText('Save').length).toBeGreaterThanOrEqual(2);
    // A "Rec: 15" CalculatedValue trigger appears for the primary ability.
    expect(screen.getByRole('button', { name: /Strength — Recommended/ })).toBeInTheDocument();
  });

  it('fills the Fighter recommended array on an explicit tap (15/14/13/8/10/12)', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    completeStep1(); // fighter
    completeStep2();
    fireEvent.click(screen.getByRole('button', { name: 'Use recommended array' }));
    // Fighter PHB placement: Str15 Dex14 Con13 Int8 Wis10 Cha12.
    const valueOf = (label: string) =>
      (screen.getByLabelText(label) as HTMLSelectElement).value;
    const pool = standardArray(); // [15,14,13,12,10,8]
    expect(pool[Number(valueOf('Strength score assignment'))]).toBe(15);
    expect(pool[Number(valueOf('Dexterity score assignment'))]).toBe(14);
    expect(pool[Number(valueOf('Constitution score assignment'))]).toBe(13);
    expect(pool[Number(valueOf('Intelligence score assignment'))]).toBe(8);
    expect(pool[Number(valueOf('Wisdom score assignment'))]).toBe(10);
    expect(pool[Number(valueOf('Charisma score assignment'))]).toBe(12);
  });

  it('shows the background-fit hint on the Origin step', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    completeStep1(); // fighter (primary Str or Dex)
    // Advance would need a valid origin; the hint shows as soon as step 2 renders.
    const hint = screen.getByRole('note', { name: 'Backgrounds that suit this class' });
    expect(hint).toBeInTheDocument();
    // Fighter's Str∪Dex backgrounds include Soldier; the pick is not restricted.
    expect(within(hint).getByText(/Soldier/)).toBeInTheDocument();
    expect(screen.getByLabelText('Background')).toBeEnabled();
  });

  it('persists the Rogue feature pick into languages.granted on completion', () => {
    const onComplete = vi.fn();
    render(<CreationWizard onComplete={onComplete} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'rogue' } });
    fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Shadow' } });
    next();
    // Background + ability allocation + species (reuse acolyte +2 Int/+1 Wis).
    fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
    fireEvent.change(screen.getByLabelText('Intelligence background increase'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Wisdom background increase'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'human' } });
    fireEvent.click(screen.getByLabelText('Goblin (feature)'));
    next(); // -> step 3
    completeStep3StandardArray();
    next(); // -> step 4
    next(); // -> step 5
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    const character = onComplete.mock.calls[0][0];
    expect(character.languages?.granted).toEqual(['goblin']);
    // Thieves' Cant is derived, not stored in granted.
    expect(character.languages?.granted).not.toContain('thieves-cant');
  });
});
