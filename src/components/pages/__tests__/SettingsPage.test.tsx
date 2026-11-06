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
