import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { InventoryPage } from '../InventoryPage';
import { CombatPage } from '../CombatPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

/**
 * The CombatPage renders the Armor Class exactly once, in the sticky summary
 * strip. These helpers scope the AC trigger to the strip so the integration
 * assertions stay unambiguous.
 */
function coreStatsCard(): HTMLElement {
  return screen.getByRole('group', { name: 'Combat summary' });
}
function coreStatsAc(): HTMLElement {
  return within(coreStatsCard()).getByRole('button', { name: /Armor Class/ });
}

/** Stateful harness so equip/add toggles persist across renders. */
function renderStateful(overrides: Partial<Character> = {}) {
  const onChange = vi.fn();
  let latest: Character = { ...createCharacter('Tester'), ...overrides };
  function Harness() {
    const [character, setCharacter] = useState<Character>(latest);
    return (
      <InventoryPage
        character={character}
        onChange={(next) => {
          onChange(next);
          latest = next;
          setCharacter(next);
        }}
      />
    );
  }
  render(<Harness />);
  return { onChange, get: () => latest };
}

describe('InventoryPage', () => {
  it('renders the GearTab-parity sections in order', () => {
    renderStateful();
    expect(screen.getByRole('heading', { name: 'Weapons' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Armor & Shields' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Other Gear' })).toBeInTheDocument();
    // ConsumablesPanel owns its own Card and carries no SectionHeader (parity
    // with GearTab's direct <ConsumablesPanel/>, finding #5); assert the panel
    // via its add affordance rather than a heading.
    expect(screen.getByRole('button', { name: '+ Add Consumable' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Coin Purse' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Encumbrance progress' })).toBeInTheDocument();
  });

  it('adds a weapon from the catalog via the picker', () => {
    const { get } = renderStateful();
    // Open the Weapons catalog picker.
    fireEvent.click(screen.getByRole('button', { name: 'Add Weapon' }));
    // Pick the Longsword.
    fireEvent.click(screen.getByRole('button', { name: 'Longsword' }));
    const inv = get().inventory ?? [];
    expect(inv.some((i) => i.kind === 'weapon' && i.catalogId === 'longsword')).toBe(true);
  });

  it('editing a coin denomination persists onto character.coins', () => {
    const { get } = renderStateful();
    const gold = screen.getByLabelText('Gold (GP)');
    fireEvent.change(gold, { target: { value: '15' } });
    fireEvent.blur(gold);
    expect(get().coins?.gp).toBe(15);
  });

  it('shows a single Coins row in the encumbrance breakdown (no duplicate — finding #1)', () => {
    renderStateful({ coins: { pp: 0, gp: 120, ep: 0, sp: 0, cp: 0 } });
    // Exactly one "Coins" label in the encumbrance breakdown, not two.
    const coinLabels = screen.getAllByText('Coins');
    expect(coinLabels).toHaveLength(1);
    // The old duplicate "Coin weight" row must be gone.
    expect(screen.queryByText('Coin weight')).not.toBeInTheDocument();
  });

  it('coin-weight value opens a tooltip with every denomination + the ÷50 formula (finding #1)', () => {
    renderStateful({ coins: { pp: 0, gp: 120, ep: 0, sp: 0, cp: 0 } });
    // 120 coins ÷ 50 = 2 lb; the Coins row value is the clickable trigger.
    const trigger = screen.getByRole('button', { name: /2 lb/ });
    fireEvent.click(trigger);
    const tip = screen.getByRole('tooltip');
    // All five denominations appear (including zeros), the sum, and the ÷50 rule.
    for (const denom of ['PP:', 'GP:', 'EP:', 'SP:', 'CP:', 'Sum:']) {
      expect(tip).toHaveTextContent(denom);
    }
    expect(tip).toHaveTextContent('÷ 50');
    expect(tip).toHaveTextContent('2 lb');
  });

  it('does not nest ConsumablesPanel inside a second Card (finding #5)', () => {
    const { container } = render(
      <InventoryPage character={createCharacter('Tester')} onChange={vi.fn()} />,
    );
    // ConsumablesPanel owns its Card; its empty-state text must not sit inside a
    // Card that is itself inside another Card (no card-in-card nesting).
    const empty = screen.getByText('No consumables tracked. Tap + to add.');
    // Walk up to the owning Card, then assert its parent is not also a Card.
    const ownCard = empty.closest('[class*="card"]');
    expect(ownCard).not.toBeNull();
    const parentCard = ownCard!.parentElement?.closest('[class*="card"]');
    expect(parentCard).toBeNull();
    expect(container).toBeTruthy();
  });

  it('renders the Lance Two-Handed chip with its conditional (finding #4)', () => {
    renderStateful({
      inventory: [{ id: 'l1', kind: 'weapon', catalogId: 'lance', quantity: 1 }],
    });
    expect(screen.getByText('Two-Handed (unless mounted)')).toBeInTheDocument();
  });

  it('Add Custom Gear opens an editable form that persists name/weight/notes (finding #2)', () => {
    const { get } = renderStateful();
    fireEvent.click(screen.getByRole('button', { name: 'Add Custom Gear' }));
    // The edit form is open: set name, weight, notes.
    fireEvent.change(screen.getByLabelText('Custom item name'), {
      target: { value: 'Grappling Hook' },
    });
    fireEvent.change(screen.getByLabelText('Custom item weight in pounds'), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByLabelText('Custom item notes'), {
      target: { value: 'Iron, 4 prongs' },
    });
    const custom = (get().inventory ?? []).find((i) => i.name === 'Grappling Hook');
    expect(custom).toBeTruthy();
    expect(custom?.weightLb).toBe(4);
    expect(custom?.notes).toBe('Iron, 4 prongs');
  });

  it('exposes the ConsumablesPanel dose steppers inside the Inventory tab', () => {
    renderStateful({
      inventory: [
        {
          id: 'p1',
          kind: 'equipment',
          name: 'Potion of Healing',
          quantity: 1,
          currentDoses: 2,
          maxDoses: 2,
        },
      ],
    });
    // The dose +/- steppers (ConsumablesPanel) render within Inventory.
    expect(
      screen.getByRole('button', { name: 'Use one dose of Potion of Healing' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Restore one dose of Potion of Healing' }),
    ).toBeInTheDocument();
  });
});

describe('Inventory → Combat armour→AC integration', () => {
  /** A character wearing chain-shirt (medium, base 13, Dex max +2) + a shield. */
  function armoredCharacter(): Character {
    return {
      ...createCharacter('Armored'),
      abilities: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 }, // Dex +3
      inventory: [
        { id: 'a1', kind: 'armor', catalogId: 'chain-shirt', quantity: 1 },
        { id: 's1', kind: 'armor', catalogId: 'shield', quantity: 1 },
      ],
      equipped: { armorItemId: 'a1', shieldItemId: 's1' },
    };
  }

  it('CombatPage AC reflects equipped chain shirt (Dex capped) + shield = 17', () => {
    render(<CombatPage character={armoredCharacter()} onChange={vi.fn()} />);
    const ac = coreStatsAc();
    // 13 base + 2 (Dex +3 capped at +2) + 2 shield = 17.
    expect(ac).toHaveTextContent('17');
  });

  it('unequipping armour in the Inventory tab returns AC to unarmored 10 + Dex', () => {
    // Render both pages against one shared character state.
    const onChange = vi.fn();
    let latest = armoredCharacter();
    function Harness() {
      const [character, setCharacter] = useState<Character>(latest);
      const update = (next: Character) => {
        onChange(next);
        latest = next;
        setCharacter(next);
      };
      return (
        <>
          <InventoryPage character={character} onChange={update} />
          <CombatPage character={character} onChange={update} />
        </>
      );
    }
    render(<Harness />);
    // AC starts at 17 (armored).
    expect(coreStatsAc()).toHaveTextContent('17');
    // Unequip the chain shirt via its Worn toggle.
    fireEvent.click(screen.getByLabelText('Wear Chain Shirt'));
    // Now only the shield is worn: 10 + 3 (full Dex, unarmored) + 2 = 15.
    expect(coreStatsAc()).toHaveTextContent('15');
  });

  it('worn custom (catalog-less) armour leaves AC unarmored and explains why (finding #3)', () => {
    const character: Character = {
      ...createCharacter('Custom'),
      abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 }, // Dex +2
      inventory: [{ id: 'c1', kind: 'armor', name: 'Dragon Scale', quantity: 1 }],
      equipped: { armorItemId: 'c1' },
    };
    render(<CombatPage character={character} onChange={vi.fn()} />);
    const ac = coreStatsAc();
    // Catalog-less armour sets no base AC: unarmored 10 + Dex +2 = 12.
    expect(ac).toHaveTextContent('12');
    // Open the AC breakdown and confirm the worn-but-ignored note reconciles it.
    fireEvent.click(ac);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Dragon Scale');
    expect(tip).toHaveTextContent(/unarmored/i);
  });
});
