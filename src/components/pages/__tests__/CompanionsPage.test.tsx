import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CompanionsPage } from '../CompanionsPage';
import { createCharacter } from '../../../storage/character-store';
import { loadLastSubTab, saveLastSubTab } from '../../../logic/sub-tab-store';
import type { Character } from '../../../types/character';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

function character(patch: Partial<Character> = {}): Character {
  return { ...createCharacter('Tester'), ...patch };
}

function tabNames(): string[] {
  return screen.getAllByRole('tab').map((t) => t.textContent ?? '');
}

describe('CompanionsPage', () => {
  it('has two sub-tabs, Creatures first, with or without the Sidekicks house rule', () => {
    render(<CompanionsPage character={character()} onChange={vi.fn()} />);
    expect(tabNames()).toEqual(['Creatures', 'People']);
    expect(screen.getByRole('tab', { name: 'Creatures', selected: true })).toBeInTheDocument();
    expect(screen.getByText('No creatures yet')).toBeInTheDocument();
    cleanup();
    render(<CompanionsPage character={character({ houseRules: { sidekicks: true } })} onChange={vi.fn()} />);
    expect(tabNames()).toEqual(['Creatures', 'People']);
  });

  it('opens the sub-tab named by the URL hash and syncs selections back', () => {
    const onSubTabChange = vi.fn();
    render(<CompanionsPage character={character()} onChange={vi.fn()} subTab="people" onSubTabChange={onSubTabChange} />);
    expect(screen.getByRole('tab', { name: 'People', selected: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Creatures' }));
    expect(onSubTabChange).toHaveBeenCalledWith('creatures');
    expect(loadLastSubTab('companions')).toBe('creatures');
    expect(screen.getByRole('tab', { name: 'Creatures', selected: true })).toBeInTheDocument();
  });

  it('restores the last used sub-tab when there is no hash', () => {
    const first = render(<CompanionsPage character={character()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'People' }));
    first.unmount();
    render(<CompanionsPage character={character()} onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'People', selected: true })).toBeInTheDocument();
  });

  it.each([
    ['companions', 'Creatures', null],
    ['mounts', 'Creatures', null],
    ['hirelings', 'People', 'Hirelings (0)'],
    ['npc-party', 'People', 'NPC party members (0)'],
  ])('maps the legacy sub-tab %s to %s', (legacy, tab, filter) => {
    render(<CompanionsPage character={character()} onChange={vi.fn()} subTab={legacy} />);
    expect(screen.getByRole('tab', { name: tab, selected: true })).toBeInTheDocument();
    if (filter) expect(screen.getByRole('button', { name: filter })).toHaveAttribute('aria-pressed', 'true');
  });

  it('maps a stored legacy last-used sub-tab too', () => {
    saveLastSubTab('companions', 'mounts');
    render(<CompanionsPage character={character()} onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Creatures', selected: true })).toBeInTheDocument();
  });

  it('a legacy Sidekicks link with the rule off shows People with All', () => {
    render(<CompanionsPage character={character()} onChange={vi.fn()} subTab="sidekicks" />);
    expect(screen.getByRole('tab', { name: 'People', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All (0)' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers the reorder control for the sub-tabs', () => {
    render(<CompanionsPage character={character()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit tab order' }));
    expect(screen.getByRole('button', { name: 'Move Creatures tab right' })).toBeInTheDocument();
  });

  it('shows a roster strip with counts and who needs attention, hidden while nobody is tracked', () => {
    render(<CompanionsPage character={character()} onChange={vi.fn()} />);
    expect(screen.queryByTestId('companions-roster')).toBeNull();
    cleanup();
    render(
      <CompanionsPage
        character={character({
          companions: [
            { id: 'c1', creatureId: 'cat', origin: 'pet', nickname: 'Tom', hp: 0 },
            { id: 'c2', creatureId: 'owl', origin: 'pet', nickname: 'Hoot', conditions: [{ id: 'prone' }] },
            { id: 'c3', creatureId: 'wolf', origin: 'pet', dismissed: true },
          ],
          hirelings: [{ id: 'h1', name: 'Smith', kind: 'skilled', units: 1 }],
        })}
        onChange={vi.fn()}
      />,
    );
    const roster = screen.getByTestId('companions-roster');
    expect(roster).toHaveTextContent('2 creatures (+1 dismissed)');
    expect(roster).toHaveTextContent('1 person');
    expect(roster).toHaveTextContent('At 0 HP: Tom');
    expect(roster).toHaveTextContent('Hoot: Prone');
  });
});
