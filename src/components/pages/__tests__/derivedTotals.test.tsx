import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CharacterPage } from '../CharacterPage';
import { CombatPage } from '../CombatPage';
import { ABILITY_NAMES, ABILITIES, SKILLS } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

/**
 * AC-12: proves every derived total still renders through CalculatedValue after
 * the page split — asserts the full set of breakdown-trigger buttons is present
 * across the Character and Combat tabs (by accessible name).
 */
describe('derived totals survive the page split', () => {
  const character = {
    ...createCharacter('Tester'),
    level: 3,
    class: { id: 'wizard' as const, level: 3 },
    species: { id: 'elf' as const, elvenLineage: 'woodElf' as const },
  };

  it('CharacterPage exposes every expected CalculatedValue trigger', () => {
    render(<CharacterPage character={character} onChange={vi.fn()} />);

    // Proficiency Bonus
    expect(
      screen.getByRole('button', { name: /Proficiency Bonus/ }),
    ).toBeInTheDocument();

    // Each ability modifier
    for (const ability of ABILITIES) {
      expect(
        screen.getByRole('button', { name: new RegExp(`${ABILITY_NAMES[ability]} Modifier`) }),
      ).toBeInTheDocument();
    }

    // Each saving throw
    for (const ability of ABILITIES) {
      expect(
        screen.getByRole('button', { name: new RegExp(`${ABILITY_NAMES[ability]} Save`) }),
      ).toBeInTheDocument();
    }

    // Each skill
    for (const skill of SKILLS) {
      expect(
        screen.getByRole('button', { name: new RegExp(`${skill.name} Check`) }),
      ).toBeInTheDocument();
    }

    // Species-derived values
    expect(screen.getByRole('button', { name: /Speed/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Darkvision/ })).toBeInTheDocument();
  });

  it('CombatPage exposes every expected CalculatedValue trigger', () => {
    render(<CombatPage character={character} onChange={vi.fn()} />);

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
});
