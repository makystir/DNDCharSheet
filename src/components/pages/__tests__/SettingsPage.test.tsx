import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPage } from '../SettingsPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

/** Stateful harness so the toggle reflects the persisted house-rule flag. */
function renderStateful(overrides: Partial<Character> = {}) {
  const onChange = vi.fn();
  let latest: Character = { ...createCharacter('Tester'), ...overrides };
  function Harness() {
    const [character, setCharacter] = useState<Character>(latest);
    return (
      <SettingsPage
        theme="dark"
        onThemeToggle={vi.fn()}
        character={character}
        onChange={(next) => {
          onChange(next);
          latest = next;
          setCharacter(next);
        }}
        onAdopt={vi.fn(async (c: Character) => c)}
        onRestored={vi.fn()}
      />
    );
  }
  render(<Harness />);
  return { onChange, get: () => latest };
}

describe('SettingsPage — variant encumbrance house-rule toggle', () => {
  it('renders the toggle off by default (RAW 2024 is binary over/under)', () => {
    renderStateful();
    const toggle = screen.getByLabelText('Enable variant encumbrance (house rule)');
    expect(toggle).not.toBeChecked();
    // The toggle's own on/off label (scoped to its <label>, since several
    // house-rule toggles now each render an "Off" span).
    expect(toggle.closest('label')).toHaveTextContent('Off');
  });

  it('enabling the toggle persists houseRules.variantEncumbrance = true', () => {
    const { get } = renderStateful();
    fireEvent.click(screen.getByLabelText('Enable variant encumbrance (house rule)'));
    expect(get().houseRules?.variantEncumbrance).toBe(true);
    expect(screen.getByLabelText('Enable variant encumbrance (house rule)')).toBeChecked();
  });
});

describe('SettingsPage: Companions house-rule toggles', () => {
  it('Sidekicks and Loyalty are off by default and cite their books', () => {
    renderStateful();
    expect(screen.getByLabelText('Sidekicks (house rule)')).not.toBeChecked();
    expect(screen.getByLabelText('Loyalty (house rule)')).not.toBeChecked();
    expect(screen.getByText(/Docs\/TashasCauldronOfEverything\.md L6917-7275/)).toBeInTheDocument();
    expect(screen.getByText(/Docs\/DungeonMastersGuide\.md L3572-3586/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sidekicks \(Tasha's 2020, 5e \/ 2014 rules\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Loyalty \(DMG 2024\)/ })).toBeInTheDocument();
  });

  it('each toggle persists its own houseRules flag without touching the other', () => {
    const { get } = renderStateful();
    fireEvent.click(screen.getByLabelText('Sidekicks (house rule)'));
    expect(get().houseRules?.sidekicks).toBe(true);
    expect(get().houseRules?.loyalty).toBeUndefined();
    fireEvent.click(screen.getByLabelText('Loyalty (house rule)'));
    expect(get().houseRules).toMatchObject({ sidekicks: true, loyalty: true });
    fireEvent.click(screen.getByLabelText('Sidekicks (house rule)'));
    expect(get().houseRules).toMatchObject({ sidekicks: false, loyalty: true });
  });
});
