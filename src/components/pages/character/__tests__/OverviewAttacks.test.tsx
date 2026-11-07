import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { OverviewAttacks } from '../OverviewAttacks';
import { createCharacter } from '../../../../storage/character-store';
import type { Character } from '../../../../types/character';
import { equippedWeapons, weaponAttackProfile } from '../../../../logic/attacks';
import { formatSigned } from '../../../../logic/breakdown';

afterEach(cleanup);

function fighter(overrides: Partial<Character> = {}): Character {
  const c = createCharacter('Tester');
  return {
    ...c,
    level: 5,
    classes: [{ id: 'fighter', level: 5 }],
    abilities: { ...c.abilities, str: 16, dex: 12 },
    inventory: [
      { id: 'w1', kind: 'weapon', catalogId: 'longsword', quantity: 1 },
      { id: 'w2', kind: 'weapon', catalogId: 'dagger', quantity: 1 },
    ],
    equipped: { weaponItemIds: ['w1', 'w2'] },
    ...overrides,
  };
}

describe('OverviewAttacks', () => {
  it('lists each equipped weapon with the logic-derived attack and damage', () => {
    const character = fighter();
    render(<OverviewAttacks character={character} />);
    const rows = screen.getAllByTestId('overview-attack');
    const equipped = equippedWeapons(character);
    expect(rows).toHaveLength(equipped.length);
    equipped.forEach((entry, i) => {
      const profile = weaponAttackProfile(character, entry.item)!;
      expect(rows[i]).toHaveTextContent(entry.weapon.name);
      expect(rows[i]).toHaveTextContent(formatSigned(profile.attack.breakdown.total));
      expect(rows[i]).toHaveTextContent(
        `${profile.damage.dice}${formatSigned(profile.damage.flat)}`,
      );
      expect(rows[i]).toHaveTextContent('Mastery:');
    });
    // Both numbers carry a breakdown tooltip trigger.
    expect(screen.getByRole('button', { name: /Longsword attack bonus/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Longsword damage/i })).toBeInTheDocument();
  });

  it('links to Combat to make attacks', () => {
    render(<OverviewAttacks character={fighter()} />);
    expect(screen.getByRole('link', { name: 'Make attacks on Combat' })).toHaveAttribute(
      'href',
      '#combat',
    );
  });

  it('shows an empty state linking to Inventory when nothing is equipped', () => {
    render(<OverviewAttacks character={fighter({ equipped: { weaponItemIds: [] } })} />);
    expect(screen.getByText(/No weapons equipped/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Equip weapons on Inventory' })).toHaveAttribute(
      'href',
      '#inventory',
    );
    expect(screen.queryAllByTestId('overview-attack')).toHaveLength(0);
  });
});
