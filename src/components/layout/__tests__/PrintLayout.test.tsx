import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

describe('PrintLayout — multiclass (Stage M5)', () => {
  // A Fighter 3 / Wizard 2 lists BOTH classes in the identity line, and a
  // multiclass caster shows a per-class Save DC / Attack table (PHB 2024
  // "Multiclassing").
  function makeFighterWizard(): Character {
    return {
      ...structuredClone(BLANK_CHARACTER),
      _v: CURRENT_VERSION,
      id: 'fw-1',
      name: 'Dax the Versatile',
      level: 5,
      abilities: { str: 14, dex: 14, con: 14, int: 16, wis: 10, cha: 10 },
      classes: [
        { id: 'fighter', level: 3 },
        { id: 'wizard', level: 2 },
      ],
    };
  }

  it('lists every class as "<Class> <level>" in the identity line', () => {
    render(<PrintLayout character={makeFighterWizard()} />);
    // "Fighter 3 / Wizard 2" appears in both the subtitle and the Class & Level
    // cell, so there are at least two matching nodes.
    expect(screen.getAllByText(/Fighter 3 \/ Wizard 2/).length).toBeGreaterThan(0);
  });

  it('renders a per-class Save DC / Attack row for each caster class', () => {
    render(<PrintLayout character={makeFighterWizard()} />);
    // The Spells section renders for the non-caster-primary multiclass caster
    // (gated on anySpellcaster, not the primary class).
    const spells = screen.getByRole('region', { name: 'Spells' });
    expect(spells).toBeInTheDocument();
    // The per-class table lists the Wizard (the only active caster here) with
    // its own Save DC column, distinct from the combined top line.
    expect(within(spells).getByRole('columnheader', { name: 'Save DC' })).toBeInTheDocument();
    expect(within(spells).getByText('Wizard')).toBeInTheDocument();
  });
});

describe('PrintLayout — blank character', () => {
  it('renders without throwing for the blank character', () => {
    expect(() => render(<PrintLayout character={structuredClone(BLANK_CHARACTER)} />)).not.toThrow();
    expect(screen.getByText('Unnamed Character')).toBeInTheDocument();
  });
});

describe('PrintLayout — essential character information', () => {
  it('prints proficiencies, hit dice, and equipped markers', () => {
    render(<PrintLayout character={makeFighter()} />);
    expect(screen.getByLabelText('Proficiencies')).toHaveTextContent('Armor:');
    expect(screen.getByLabelText('Proficiencies')).toHaveTextContent('Martial');
    expect(screen.getByLabelText('Core statistics')).toHaveTextContent('Hit Dice: 5d10 (5 unspent)');
    expect(screen.getByLabelText('Inventory')).toHaveTextContent('(equipped)');
  });
  it('prints temp HP and spent hit dice', () => {
    render(<PrintLayout character={makeFighter({ tempHp: 4, hitDiceSpent: 2 })} />);
    const core = screen.getByLabelText('Core statistics');
    expect(core).toHaveTextContent('Temp HP: 4');
    expect(core).toHaveTextContent('Hit Dice: 5d10 (3 unspent)');
  });
  it('prints only the filled-in personal details', () => {
    const { container } = render(
      <PrintLayout character={makeFighter({ faith: 'Tyr', age: '34', ideal: 'Justice' })} />,
    );
    const section = container.querySelector('[data-section="personal-details"]');
    expect(section).toHaveTextContent('Faith: Tyr');
    expect(section).toHaveTextContent('Age: 34');
    expect(section).toHaveTextContent('Ideal: Justice');
    expect(section).not.toHaveTextContent('Height');
  });
  it('omits Personal Details when nothing is filled in', () => {
    const { container } = render(<PrintLayout character={makeFighter()} />);
    expect(container.querySelector('[data-section="personal-details"]')).toBeNull();
  });
  it('shows XP only when leveling by XP', () => {
    const { rerender } = render(<PrintLayout character={makeFighter()} />);
    expect(screen.queryByText('XP')).not.toBeInTheDocument();
    rerender(
      <PrintLayout
        character={makeFighter({ advancement: { leveling: { mode: 'xp', xp: 6500 } } })}
      />,
    );
    expect(screen.getByText('XP')).toBeInTheDocument();
    expect(screen.getByText('6500')).toBeInTheDocument();
  });
});
describe('PrintLayout - empty placeholders', () => {
  it('prints an em dash (not a replacement character) for empty proficiency and Subclass/XP cells', () => {
    const { container } = render(<PrintLayout character={makeWizard()} />);
    // A Wizard has no armor proficiency; no subclass is set and XP mode is off.
    expect(screen.getByLabelText('Proficiencies')).toHaveTextContent('Armor: \u2014');
    expect(container.textContent).not.toContain('\uFFFD');
  });
});
