import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
    classes: [{ id: 'wizard' as const, level: 3 }],
    species: { id: 'elf' as const, elvenLineage: 'woodElf' as const },
  };

  it('CharacterPage exposes every expected CalculatedValue trigger across sub-tabs', () => {
    // Overview vitals strip: AC, HP, Initiative, Speed, Passive Perception,
    // Proficiency Bonus, Darkvision and Hit Dice.
    render(<CharacterPage character={character} onChange={vi.fn()} subTab="identity" />);
    for (const name of [
      /^Armor Class:/,
      /Hit Point Maximum/,
      /^Initiative:/,
      /Speed/,
      /^Passive Perception:/,
      /Proficiency Bonus/,
      /^Darkvision:/,
      /Hit Dice remaining/,
      // The Rest card under the vitals.
      /^Hit Dice total/,
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }

    // Same Overview, its Abilities, Saves & Skills card: ability modifiers and
    // scores + every saving throw + every skill check.
    for (const ability of ABILITIES) {
      expect(
        screen.getByRole('button', { name: new RegExp(`${ABILITY_NAMES[ability]} Modifier`) }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: new RegExp(`${ABILITY_NAMES[ability]} Score`) }),
      ).toBeInTheDocument();
    }
    for (const ability of ABILITIES) {
      expect(
        screen.getByRole('button', { name: new RegExp(`${ABILITY_NAMES[ability]} Save`) }),
      ).toBeInTheDocument();
    }
    for (const skill of SKILLS) {
      expect(
        screen.getByRole('button', { name: new RegExp(`${skill.name} Check`) }),
      ).toBeInTheDocument();
    }
    cleanup();

    // Class & Features no longer carries Speed/Darkvision (vitals strip only).
    render(<CharacterPage character={character} onChange={vi.fn()} subTab="build" />);
    expect(screen.queryByRole('button', { name: /Speed/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Darkvision/ })).toBeNull();
  });

  it('CombatPage exposes every expected CalculatedValue trigger', () => {
    render(<CombatPage character={character} onChange={vi.fn()} />);

    // AC, HP max and Passive Perception sit in the summary strip; the
    // Initiative modifier on the Fight card. Hit Dice moved to the Overview.
    expect(screen.getAllByRole('button', { name: /^Armor Class:/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^Initiative:/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Passive Perception:/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Max HP/ }).length).toBeGreaterThan(0);
  });
});
