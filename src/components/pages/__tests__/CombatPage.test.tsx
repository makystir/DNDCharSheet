import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CombatPage } from '../CombatPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

function renderPage(overrides = {}) {
  const character = { ...createCharacter('Tester'), ...overrides };
  const onChange = vi.fn();
  render(<CombatPage character={character} onChange={onChange} />);
  return { character, onChange };
}

function renderStatefulPage(overrides = {}) {
  const onChange = vi.fn();
  function Harness() {
    const [character, setCharacter] = useState<Character>({
      ...createCharacter('Tester'),
      ...overrides,
    });
    return (
      <CombatPage
        character={character}
        onChange={(next) => {
          onChange(next);
          setCharacter(next);
        }}
      />
    );
  }
  render(<Harness />);
  return { onChange };
}

describe('CombatPage', () => {
  it('renders the derived combat stats through CalculatedValue triggers', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Armor Class/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Initiative/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Passive Perception/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Hit Point Maximum/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hit Dice total/ })).toBeInTheDocument();
  });

  it('shows base AC 12 for Dex 14 and no override', () => {
    renderPage({ abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } });
    const ac = screen.getByRole('button', { name: /Armor Class/ });
    expect(ac).toHaveTextContent('12');
  });

  it('entering an AC override emits acOverride and clearing it unsets', () => {
    const { onChange } = renderStatefulPage();
    const input = screen.getByLabelText('Armor Class override');
    fireEvent.change(input, { target: { value: '17' } });
    expect(onChange.mock.calls.at(-1)?.[0].acOverride).toBe(17);
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange.mock.calls.at(-1)?.[0].acOverride).toBeUndefined();
  });

  it('entering an HP max emits hpMax', () => {
    const { onChange } = renderPage();
    const input = screen.getByLabelText('Hit Point maximum');
    fireEvent.change(input, { target: { value: '24' } });
    expect(onChange.mock.calls.at(-1)?.[0].hpMax).toBe(24);
  });

  it('surfaces the Hit Dice total and HP max for a selected class', () => {
    // Wizard d6, level 3, Con 14 (+2).
    renderPage({
      level: 3,
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      class: { id: 'wizard', level: 3 },
    });
    expect(screen.getByText('d6')).toBeInTheDocument();
    const hitDice = screen.getByRole('button', { name: /Hit Dice total/ });
    expect(hitDice).toHaveTextContent('3');
    // HP max: L1 6+2=8, then 2 levels of (4+2)=6 => 8+12 = 20.
    const hp = screen.getByRole('button', { name: /Hit Point Maximum/ });
    expect(hp.getAttribute('aria-label')).toContain('= 20');
  });

  it('surfaces Dwarven Toughness in the HP breakdown when hpMax is set', () => {
    renderPage({ species: { id: 'dwarf' }, level: 3, hpMax: 30 });
    const hp = screen.getByRole('button', { name: /Hit Point Maximum/ });
    expect(hp.getAttribute('aria-label')).toMatch(/Dwarven Toughness/);
  });

  it('reveals a rolled-HP total input when the house rule is on', () => {
    renderPage();
    expect(screen.queryByLabelText('Rolled HP total')).toBeNull();
    renderPage({ houseRules: { rolledHp: true } });
    expect(screen.getAllByLabelText('Rolled HP total').at(-1)).toBeInTheDocument();
  });

  it('toggling the rolled-HP house rule emits houseRules.rolledHp', () => {
    const { onChange } = renderPage();
    fireEvent.click(screen.getByLabelText('Use rolled HP (house rule)'));
    expect(onChange.mock.calls.at(-1)?.[0].houseRules.rolledHp).toBe(true);
  });
});
