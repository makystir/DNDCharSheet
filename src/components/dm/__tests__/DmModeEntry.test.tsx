import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeScreen } from '../../creation/WelcomeScreen';
import { SettingsPage } from '../../pages/SettingsPage';
import { createCharacter } from '../../../storage/character-store';
import { DM_MODE_KEY, readDmMode, writeDmMode } from '../../../logic/dm-mode';

beforeEach(() => localStorage.clear());

describe('DM mode setting', () => {
  it('is off by default and persists on this device', () => {
    expect(readDmMode()).toBe(false);
    writeDmMode(true);
    expect(localStorage.getItem(DM_MODE_KEY)).toBe('true');
    expect(readDmMode()).toBe(true);
    writeDmMode(false);
    expect(readDmMode()).toBe(false);
  });
});

describe('entry points', () => {
  it('offers Dungeon Master on the first-run welcome screen', () => {
    const onDungeonMaster = vi.fn();
    render(<WelcomeScreen onCharacterReady={() => {}} onDungeonMaster={onDungeonMaster} />);
    fireEvent.click(screen.getByRole('button', { name: /I'm a Dungeon Master/ }));
    expect(onDungeonMaster).toHaveBeenCalled();
  });

  it('does not offer it when the welcome screen is not given a handler', () => {
    render(<WelcomeScreen onCharacterReady={() => {}} />);
    expect(screen.queryByRole('button', { name: /Dungeon Master/ })).not.toBeInTheDocument();
  });

  it('has a Dungeon Master toggle in Settings', () => {
    const onDmModeChange = vi.fn();
    render(
      <SettingsPage
        theme="dark"
        onThemeToggle={() => {}}
        character={createCharacter('Test')}
        onChange={() => {}}
        onAdopt={async (c) => c}
        onRestored={() => {}}
        dmMode={false}
        onDmModeChange={onDmModeChange}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dungeon Master mode' }));
    expect(onDmModeChange).toHaveBeenCalledWith(true);
  });
});
