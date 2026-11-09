import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CompanionsPage } from '../CompanionsPage';
import { createCharacter } from '../../../storage/character-store';
import { loadLastSubTab } from '../../../logic/sub-tab-store';
import type { Character } from '../../../types/character';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

function sidekickCharacter(on: boolean): Character {
  const c = createCharacter('Tester');
  return on ? { ...c, houseRules: { ...c.houseRules, sidekicks: true } } : c;
}

function tabNames(): string[] {
  return screen.getAllByRole('tab').map((t) => t.textContent ?? '');
}

describe('CompanionsPage', () => {
  it('shows four sub-tabs with the Sidekicks house rule off, Companions first', () => {
    render(<CompanionsPage character={sidekickCharacter(false)} onChange={vi.fn()} />);
    expect(tabNames()).toEqual(['Companions', 'Mounts & Animals', 'Hirelings', 'NPC Party Members']);
    expect(screen.getByRole('tab', { name: 'Companions', selected: true })).toBeInTheDocument();
    expect(screen.getByText('No companions yet')).toBeInTheDocument();
  });

  it('adds the Sidekicks sub-tab only when the house rule is on', () => {
    render(<CompanionsPage character={sidekickCharacter(true)} onChange={vi.fn()} />);
    expect(tabNames()).toContain('Sidekicks');
  });

  it('opens the sub-tab named by the URL hash and syncs selections back', () => {
    const onSubTabChange = vi.fn();
    render(<CompanionsPage character={sidekickCharacter(false)} onChange={vi.fn()} subTab="hirelings" onSubTabChange={onSubTabChange} />);
    expect(screen.getByRole('tab', { name: 'Hirelings', selected: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Mounts & Animals' }));
    expect(onSubTabChange).toHaveBeenCalledWith('mounts');
    expect(loadLastSubTab('companions')).toBe('mounts');
    expect(screen.getByRole('tab', { name: 'Mounts & Animals', selected: true })).toBeInTheDocument();
  });

  it('restores the last used sub-tab when there is no hash', () => {
    const first = render(<CompanionsPage character={sidekickCharacter(false)} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'NPC Party Members' }));
    first.unmount();
    render(<CompanionsPage character={sidekickCharacter(false)} onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'NPC Party Members', selected: true })).toBeInTheDocument();
  });

  it('falls back to Companions when the Sidekicks tab is requested with the rule off', () => {
    render(<CompanionsPage character={sidekickCharacter(false)} onChange={vi.fn()} subTab="sidekicks" />);
    expect(screen.getByRole('tab', { name: 'Companions', selected: true })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Sidekicks' })).toBeNull();
  });

  it('offers the reorder control for the sub-tabs', () => {
    render(<CompanionsPage character={sidekickCharacter(false)} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit tab order' }));
    expect(screen.getByRole('button', { name: 'Move Companions tab right' })).toBeInTheDocument();
  });
});
