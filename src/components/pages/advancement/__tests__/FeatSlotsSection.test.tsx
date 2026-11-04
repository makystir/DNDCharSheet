import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FeatSlotsSection } from '../FeatSlotsSection';
import type { Character } from '../../../../types/character';
import { createCharacter } from '../../../../storage/character-store';
import { effectiveAbilityScores } from '../../../../logic/feats';

/**
 * Component tests for the A6b feat / ASI slots on the Advancement page. They
 * assert the UI wires the pure feat logic (featSlotLevels, canTakeFeat,
 * applyFeat/removeFeat, effectiveAbilityScores) correctly; the rules themselves
 * are covered by the feat-golden suite. No rule is recomputed in a test.
 */

/** Stateful harness so applyFeat/removeFeat updates persist across renders. */
function renderStateful(overrides: Partial<Character> = {}, now: () => number = () => 1000) {
  const onChange = vi.fn();
  let latest: Character = { ...createCharacter('Tester'), ...overrides };
  function Harness() {
    const [character, setCharacter] = useState<Character>(latest);
    return (
      <FeatSlotsSection
        character={character}
        now={now}
        onChange={(next) => {
          onChange(next);
          latest = next;
          setCharacter(next);
        }}
      />
    );
  }
  render(<Harness />);
  return { onChange, get: () => latest };
}

/** A level-4 Fighter: one asi-marker slot at level 4. */
function fighter4(cha = 10): Partial<Character> {
  return {
    level: 4,
    class: { id: 'fighter', level: 4 },
    abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha },
  };
}

describe('FeatSlotsSection — slots & picker', () => {
  it('renders one empty slot at each asi-marker level (Fighter 4 → level 4)', () => {
    renderStateful(fighter4());
    expect(screen.getByText('Level 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a feat…' })).toBeInTheDocument();
  });

  it('shows no slots below the first asi-marker level', () => {
    renderStateful({ level: 3, class: { id: 'fighter', level: 3 } });
    expect(screen.queryByRole('button', { name: 'Choose a feat…' })).not.toBeInTheDocument();
    expect(screen.getByText(/No feat slots yet/)).toBeInTheDocument();
  });

  it('opens the feat picker and lists eligible feats', () => {
    renderStateful(fighter4());
    fireEvent.click(screen.getByRole('button', { name: 'Choose a feat…' }));
    const dialog = screen.getByRole('dialog', { name: /Choose a feat for level 4/ });
    expect(within(dialog).getByText('Ability Score Improvement')).toBeInTheDocument();
  });
});

describe('FeatSlotsSection — ASI feat with +2', () => {
  it('taking the ASI feat with +2 Str updates the effective Strength', () => {
    const { get } = renderStateful(fighter4());
    fireEvent.click(screen.getByRole('button', { name: 'Choose a feat…' }));
    // Expand then select the ASI feat (two clicks mirror the SpellPicker UX).
    const asiBtn = screen.getByRole('button', { name: /Ability Score Improvement/ });
    fireEvent.click(asiBtn);
    fireEvent.click(screen.getByRole('button', { name: /Select Ability Score Improvement/ }));
    // Allocation dialog: +2 to Strength.
    const alloc = screen.getByRole('dialog', { name: /Allocate Ability Score Improvement/ });
    const strRow = within(alloc).getByRole('group', { name: 'Strength increase' });
    fireEvent.click(within(strRow).getByRole('button', { name: '+2' }));
    fireEvent.click(within(alloc).getByRole('button', { name: /Take Ability Score Improvement/ }));

    const char = get();
    // The feat is recorded against the slot, base Str is untouched (10), and the
    // EFFECTIVE Str is 12 (base 10 + 2).
    expect(char.advancement?.feats?.[0]).toMatchObject({
      featId: 'ability-score-improvement',
      level: 4,
      abilityIncreases: { str: 2 },
    });
    expect(char.abilities.str).toBe(10);
    expect(effectiveAbilityScores(char).str).toBe(12);
  });
});

describe('FeatSlotsSection — Actor requires Charisma 13', () => {
  it('disables Actor with a reason when Charisma is below 13', () => {
    renderStateful(fighter4(10));
    fireEvent.click(screen.getByRole('button', { name: 'Choose a feat…' }));
    const actor = screen.getByRole('button', { name: /^Actor/ });
    expect(actor).toHaveAttribute('aria-disabled', 'true');
    expect(within(actor).getByText(/prerequisite not met/i)).toBeInTheDocument();
  });

  it('enables Actor when Charisma is 13+ and applies its fixed +1 Cha', () => {
    const { get } = renderStateful(fighter4(13));
    fireEvent.click(screen.getByRole('button', { name: 'Choose a feat…' }));
    const actor = screen.getByRole('button', { name: /^Actor/ });
    expect(actor).not.toHaveAttribute('aria-disabled');
    fireEvent.click(actor); // expand
    fireEvent.click(screen.getByRole('button', { name: /Select Actor/ }));
    // Actor is a FIXED increase, so it applies immediately (no allocation dialog).
    const char = get();
    expect(char.advancement?.feats?.[0]).toMatchObject({
      featId: 'actor',
      level: 4,
      abilityIncreases: { cha: 1 },
    });
    expect(effectiveAbilityScores(char).cha).toBe(14);
  });
});

describe('FeatSlotsSection — removing a feat reverts it', () => {
  it('removing a filled slot clears the feat and reverts the increase', () => {
    const { get } = renderStateful({
      ...fighter4(),
      advancement: {
        feats: [{ featId: 'ability-score-improvement', level: 4, abilityIncreases: { str: 2 } }],
      },
    });
    // The filled slot shows the feat and its increase.
    expect(screen.getByText('Ability Score Improvement')).toBeInTheDocument();
    expect(screen.getByText('+2 STR')).toBeInTheDocument();
    expect(effectiveAbilityScores(get()).str).toBe(12);
    // Remove it.
    fireEvent.click(screen.getByRole('button', { name: /Remove Ability Score Improvement from level 4/ }));
    const char = get();
    expect(char.advancement?.feats ?? []).toHaveLength(0);
    expect(effectiveAbilityScores(char).str).toBe(10); // reverted
    // The slot is empty again.
    expect(screen.getByRole('button', { name: 'Choose a feat…' })).toBeInTheDocument();
  });
});

describe('FeatSlotsSection — Epic Boon slot only at 19', () => {
  it('does not offer an Epic Boon feat below level 19', () => {
    renderStateful(fighter4());
    fireEvent.click(screen.getByRole('button', { name: 'Choose a feat…' }));
    const boon = screen.getByRole('button', { name: /Boon of Combat Prowess/ });
    expect(boon).toHaveAttribute('aria-disabled', 'true');
    expect(within(boon).getByText(/Requires level 19/)).toBeInTheDocument();
  });

  it('offers the Epic Boon slot and feat at level 19', () => {
    renderStateful({
      level: 19,
      class: { id: 'fighter', level: 19 },
      abilities: { str: 18, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    });
    // A level-19 slot exists (the Epic Boon slot).
    expect(screen.getByText('Level 19')).toBeInTheDocument();
    // Open the picker at that slot and confirm the Epic Boon feat is eligible.
    const chooseButtons = screen.getAllByRole('button', { name: 'Choose a feat…' });
    fireEvent.click(chooseButtons[chooseButtons.length - 1]);
    const boon = screen.getByRole('button', { name: /Boon of Combat Prowess/ });
    expect(boon).not.toHaveAttribute('aria-disabled');
  });
});
