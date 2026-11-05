import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsPage } from '../SettingsPage';
import { createCharacter } from '../../../storage/character-store';
import { DICE_ENTRY_MODE_KEY, getDiceEntryMode } from '../../../hooks/useDiceEntryMode';

afterEach(() => {
  localStorage.clear();
});

function renderSettings() {
  const character = createCharacter('Tester');
  const onChange = vi.fn();
  render(
    <SettingsPage
      theme="dark"
      onThemeToggle={vi.fn()}
      character={character}
      onChange={onChange}
      onAdopt={vi.fn(async (c) => c)}
    />,
  );
  return { onChange };
}

describe('SettingsPage: dice entry mode', () => {
  it('defaults to auto-roll', () => {
    renderSettings();
    expect(screen.getByLabelText('Enter dice results manually')).not.toBeChecked();
    expect(screen.getByText('Auto-roll')).toBeInTheDocument();
  });

  it('toggling persists an app-wide preference and does not touch the character', () => {
    const { onChange } = renderSettings();
    fireEvent.click(screen.getByLabelText('Enter dice results manually'));
    expect(localStorage.getItem(DICE_ENTRY_MODE_KEY)).toBe('manual');
    expect(getDiceEntryMode()).toBe('manual');
    expect(screen.getByLabelText('Enter dice results manually')).toBeChecked();
    expect(screen.getByText('Manual entry')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Enter dice results manually'));
    expect(getDiceEntryMode()).toBe('auto');
  });

  it('reads a stored manual preference on load', () => {
    localStorage.setItem(DICE_ENTRY_MODE_KEY, 'manual');
    renderSettings();
    expect(screen.getByLabelText('Enter dice results manually')).toBeChecked();
  });
});
