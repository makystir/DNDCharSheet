import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Character } from '../../../types/character';
import { BLANK_CHARACTER, CURRENT_VERSION } from '../../../types/character';
import { PrintLayout } from '../PrintLayout';

function makeFighter(overrides: Partial<Character> = {}): Character {
  return {
    ...structuredClone(BLANK_CHARACTER),
    _v: CURRENT_VERSION,
    id: 'fighter-1',
    name: 'Aric the Bold',
    level: 5,
    abilities: { str: 16, dex: 14, con: 15, int: 10, wis: 12, cha: 8 },
    classes: [{ id: 'fighter', level: 5 }],
    skills: { perception: { proficient: true } },
    saveProficiencies: { str: true, con: true },
    inventory: [{ id: 'w1', kind: 'weapon', catalogId: 'longsword', quantity: 1 }],
    equipped: { weaponItemIds: ['w1'] },
    ...overrides,
  };
}

function makeWizard(): Character {
  return {
    ...structuredClone(BLANK_CHARACTER),
    _v: CURRENT_VERSION,
    id: 'wizard-1',
    name: 'Mira the Wise',
    level: 5,
    abilities: { str: 8, dex: 14, con: 13, int: 17, wis: 12, cha: 10 },
    classes: [{ id: 'wizard', level: 5 }],
  };
}

describe('PrintLayout — complete character', () => {
  it('renders the identity and every non-conditional section', () => {
    render(<PrintLayout character={makeFighter()} />);
    expect(screen.getByText('Aric the Bold')).toBeInTheDocument();
    expect(screen.getByText('Core Statistics')).toBeInTheDocument();
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();
    expect(screen.getByText('Saving Throws')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('Attacks & Weapons')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Features & Traits')).toBeInTheDocument();
  });

  it('is strictly read-only — no inputs, textareas, selects, or buttons', () => {
    const { container } = render(<PrintLayout character={makeFighter()} />);
    expect(container.querySelectorAll('input, textarea, select, button')).toHaveLength(0);
  });
});

describe('PrintLayout — conditional Spells section', () => {
  it('omits the Spells section for a non-caster', () => {
    render(<PrintLayout character={makeFighter()} />);
    expect(screen.queryByText('Spells')).not.toBeInTheDocument();
  });

  it('renders the Spells section for a caster', () => {
    render(<PrintLayout character={makeWizard()} />);
    expect(screen.getByText('Spells')).toBeInTheDocument();
    expect(screen.getByText('Spell Save DC')).toBeInTheDocument();
  });
});

describe('PrintLayout — blank character', () => {
  it('renders without throwing for the blank character', () => {
    expect(() => render(<PrintLayout character={structuredClone(BLANK_CHARACTER)} />)).not.toThrow();
    expect(screen.getByText('Unnamed Character')).toBeInTheDocument();
  });
});
