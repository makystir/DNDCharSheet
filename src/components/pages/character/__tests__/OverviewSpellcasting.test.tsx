import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { OverviewSpellcasting } from '../OverviewSpellcasting';
import { createCharacter } from '../../../../storage/character-store';
import type { Character } from '../../../../types/character';
import { spellAttackBreakdown, spellSaveDcBreakdown } from '../../../../logic/spellcasting';
import { formatSigned } from '../../../../logic/breakdown';

afterEach(cleanup);

function make(overrides: Partial<Character>): Character {
  return { ...createCharacter('Tester'), ...overrides };
}

const wizard = make({
  level: 5,
  classes: [{ id: 'wizard', level: 5 }],
  abilities: { str: 8, dex: 14, con: 13, int: 16, wis: 10, cha: 10 },
});

const wizardWarlock = make({
  level: 5,
  classes: [
    { id: 'wizard', level: 3 },
    { id: 'warlock', level: 2 },
  ],
  abilities: { str: 8, dex: 14, con: 13, int: 16, wis: 10, cha: 15 },
});

describe('OverviewSpellcasting', () => {
  it('shows the Spell Save DC, Spell Attack and a Spells link for a caster (slots are on Right now)', () => {
    const { container } = render(<OverviewSpellcasting character={wizard} />);
    const dc = spellSaveDcBreakdown(wizard)!;
    const atk = spellAttackBreakdown(wizard)!;
    expect(screen.getByRole('button', { name: /Spell Save DC/ })).toHaveTextContent(`${dc.total}`);
    expect(screen.getByRole('button', { name: /Spell Attack/ })).toHaveTextContent(
      formatSigned(atk.total),
    );
    expect(container.textContent).not.toMatch(/slot/i);
    expect(screen.getByRole('link', { name: 'Manage spells' })).toHaveAttribute('href', '#spells');
    expect(screen.getAllByTestId('overview-spell-row')).toHaveLength(1);
  });

  it('renders nothing at all for a non-caster', () => {
    const fighter = make({ level: 5, classes: [{ id: 'fighter', level: 5 }] });
    const { container } = render(<OverviewSpellcasting character={fighter} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows one row per casting class for a multiclass caster', () => {
    render(<OverviewSpellcasting character={wizardWarlock} />);
    const rows = screen.getAllByTestId('overview-spell-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Wizard')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Warlock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wizard Spell Save DC/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Warlock Spell Attack/ })).toBeInTheDocument();
  });
});
