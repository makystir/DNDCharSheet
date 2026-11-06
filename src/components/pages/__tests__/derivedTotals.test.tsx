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
    // P3 Identity: Proficiency Bonus.
    render(<CharacterPage character={character} onChange={vi.fn()} subTab="identity" />);
    expect(
      screen.getByRole('button', { name: /Proficiency Bonus/ }),
    ).toBeInTheDocument();
    cleanup();

    // P3 Abilities & Skills: ability modifiers + every saving throw + every skill
    // check (scores now sit WITH the saves/skills derived from them).
    render(<CharacterPage character={character} onChange={vi.fn()} subTab="abilities" />);
    for (const ability of ABILITIES) {
      expect(
        screen.getByRole('button', { name: new RegExp(`${ABILITY_NAMES[ability]} Modifier`) }),
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

    // P3 Build: Speed + Darkvision (species) on the merged Build tab.
    render(<CharacterPage character={character} onChange={vi.fn()} subTab="build" />);
    expect(screen.getByRole('button', { name: /Speed/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Darkvision/ })).toBeInTheDocument();
  });

  it('CombatPage exposes every expected CalculatedValue trigger', () => {
    render(<CombatPage character={character} onChange={vi.fn()} />);

    // P2: AC, Initiative, Passive Perception and HP max now live together in the
    // ONE consolidated Defenses & Combat Stats panel (DefenseReadout).
    expect(screen.getAllByRole('button', { name: /Armor Class/ }).length).toBeGreaterThan(0);
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
