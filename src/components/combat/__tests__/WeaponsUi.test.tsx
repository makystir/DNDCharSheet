import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CombatPage } from '../../pages/CombatPage';
import type { Character, InventoryItem } from '../../../types/character';
import type { ClassId } from '../../../data/classes';
import { createCharacter } from '../../../storage/character-store';

let latest: Character;
const onAttack = vi.fn();

function Harness({ initial, attack = true }: { initial: Character; attack?: boolean }) {
  const [character, setCharacter] = useState<Character>(initial);
  return (
    <CombatPage
      character={character}
      onChange={(next) => {
        latest = next;
        setCharacter(next);
      }}
      onAttack={attack ? onAttack : undefined}
    />
  );
}

const weapon = (id: string, catalogId: string): InventoryItem => ({ id, kind: 'weapon', catalogId, quantity: 1 });
const ammo = (id: string, catalogId: string, quantity: number): InventoryItem => ({
  id,
  kind: 'equipment',
  catalogId,
  quantity,
});

/** Level 5 Fighter, Str 16 (+3), Proficiency +3. Weapon Mastery limit 4. */
function fighter(overrides: Partial<Character> = {}): Character {
  const c = createCharacter('Tester');
  return {
    ...c,
    level: 5,
    classes: [{ id: 'fighter' as ClassId, level: 5 }],
    abilities: { ...c.abilities, str: 16, dex: 12 },
    hpMax: 40,
    ...overrides,
  };
}

function renderPage(initial: Character, attack = true) {
  latest = initial;
  return render(<Harness initial={initial} attack={attack} />);
}

/** Open a CalculatedValue / ContentTooltip trigger and return the tooltip. */
function openTooltip(name: RegExp | string) {
  fireEvent.mouseEnter(screen.getByRole('button', { name }));
  return screen.getByRole('tooltip');
}

beforeEach(() => {
  localStorage.clear();
  onAttack.mockReset();
});
afterEach(() => localStorage.clear());

describe('Weapons panel', () => {
  const withSword = (extra: Partial<Character> = {}) =>
    fighter({
      inventory: [weapon('w1', 'longsword')],
      equipped: { weaponItemIds: ['w1'] },
      ...extra,
    });

  it('shows an empty state when nothing is equipped', () => {
    renderPage(fighter({ inventory: [weapon('w1', 'longsword')] }));
    expect(screen.getByText('No weapons equipped')).toBeTruthy();
    expect(screen.queryByTestId('weapon-card-w1')).toBeNull();
  });

  it('puts the full weapon name on line 1 and the stats and Attack button on line 2', () => {
    renderPage(withSword());
    const card = screen.getByTestId('weapon-card-w1');
    expect(within(card).getByText('Longsword')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Attack with Longsword' })).toBeTruthy();
  });

  it('shows the attack bonus as a CalculatedValue with its zero-inclusive breakdown', () => {
    renderPage(withSword());
    const card = screen.getByTestId('weapon-card-w1');
    expect(within(card).getByRole('button', { name: /Longsword attack bonus/ }).textContent).toBe('+6');
    const tip = openTooltip(/Longsword attack bonus/);
    expect(tip.textContent).toContain('Strength mod');
    expect(tip.textContent).toContain('Proficiency');
    expect(tip.textContent).toContain('Magic / other');
  });

  it('shows damage with a versatile toggle that switches to the two-handed dice', () => {
    renderPage(withSword());
    const dmg = () => screen.getByRole('button', { name: /Longsword damage/ }).textContent;
    expect(dmg()).toBe('1d8+3 slashing');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Longsword wielded two-handed' }));
    expect(dmg()).toBe('1d10+3 slashing');
    expect(openTooltip(/Longsword damage/).textContent).toContain('Strength mod');
  });

  it('has no versatile toggle on a weapon without Versatile', () => {
    renderPage(fighter({ inventory: [weapon('w1', 'greatsword')], equipped: { weaponItemIds: ['w1'] } }));
    expect(within(screen.getByTestId('weapon-card-w1')).queryByRole('checkbox')).toBeNull();
  });

  it('shows property chips with tooltips', () => {
    renderPage(fighter({ inventory: [weapon('w1', 'greatsword')], equipped: { weaponItemIds: ['w1'] } }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Heavy' }));
    expect(screen.getByRole('tooltip').textContent).toContain('Heavy');
  });

  it('locks the mastery chip with a reason until the weapon is chosen', () => {
    renderPage(withSword());
    const chip = screen.getByRole('button', { name: /Sap \(locked\)/ });
    fireEvent.mouseEnter(chip);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Weapon Mastery locked');
    expect(tip.textContent).toContain('You have not chosen this weapon');
  });

  it('unlocks the mastery chip once the weapon is chosen', () => {
    renderPage(withSword({ weaponMasteries: ['longsword'] }));
    expect(screen.queryByRole('button', { name: /Sap \(locked\)/ })).toBeNull();
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Sap \(mastery\)/ }));
    expect(screen.getByRole('tooltip').textContent).toContain('Sap');
  });

  it('locks every mastery for a class with no Weapon Mastery', () => {
    renderPage(withSword({ classes: [{ id: 'wizard' as ClassId, level: 5 }], weaponMasteries: ['longsword'] }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Sap \(locked\)/ }));
    expect(screen.getByRole('tooltip').textContent).toContain('Your class has no Weapon Mastery feature');
  });

  it('shows Topple DC and Graze damage as Breakdowns when those masteries are usable', () => {
    renderPage(
      fighter({
        inventory: [weapon('w1', 'battleaxe'), weapon('w2', 'greatsword')],
        equipped: { weaponItemIds: ['w1', 'w2'] },
        weaponMasteries: ['battleaxe', 'greatsword'],
      }),
    );
    expect(screen.getByRole('button', { name: /Battleaxe Topple DC/ }).textContent).toBe('14');
    expect(openTooltip(/Battleaxe Topple DC/).textContent).toContain('Proficiency');
    expect(screen.getByRole('button', { name: /Greatsword Graze damage/ }).textContent).toBe('3');
  });

  it('calls the onAttack observer with the weapon item id, and opens the Attack Flow with or without it', () => {
    const { unmount } = renderPage(withSword());
    fireEvent.click(screen.getByRole('button', { name: 'Attack with Longsword' }));
    expect(onAttack).toHaveBeenCalledWith('w1');
    expect(screen.getByTestId('attack-flow')).toBeTruthy();
    unmount();
    renderPage(withSword(), false);
    const button = screen.getByRole('button', { name: 'Attack with Longsword' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(screen.getByTestId('attack-flow')).toBeTruthy();
  });

  it('switches between card and list view and keeps the full name and Attack button', () => {
    renderPage(withSword());
    fireEvent.click(screen.getByRole('radio', { name: 'List view' }));
    const row = screen.getByTestId('weapon-list-row-w1');
    expect(within(row).getByText('Longsword')).toBeTruthy();
    expect(within(row).getByRole('button', { name: /Longsword attack bonus/ })).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Attack with Longsword' }));
    expect(onAttack).toHaveBeenCalledWith('w1');
    fireEvent.click(screen.getByRole('radio', { name: 'Card view' }));
    expect(screen.getByTestId('weapon-card-w1')).toBeTruthy();
  });

  it('notes an equipped item that is not a catalog weapon instead of hiding it silently', () => {
    renderPage(
      fighter({
        inventory: [weapon('w1', 'longsword'), { id: 'c1', kind: 'weapon', name: 'Family Blade', quantity: 1 }],
        equipped: { weaponItemIds: ['w1', 'c1'] },
      }),
    );
    expect(screen.getByText(/1 equipped item could not be shown/)).toBeTruthy();
  });

  it('says when the wielder is not proficient', () => {
    renderPage(
      withSword({ classes: [{ id: 'wizard' as ClassId, level: 5 }] }),
    );
    expect(screen.getByText(/Not proficient/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Longsword attack bonus/ }).textContent).toBe('+3');
  });
});

describe('Unarmed Strike card', () => {
  it('shows attack, damage, grapple DC and shove DC as Breakdowns', () => {
    renderPage(fighter());
    const card = screen.getByTestId('unarmed-strike-card');
    expect(within(card).getByRole('button', { name: /Unarmed Strike attack bonus/ }).textContent).toBe('+6');
    expect(within(card).getByRole('button', { name: /Unarmed Strike damage/ }).textContent).toBe('4 bludgeoning');
    expect(within(card).getByRole('button', { name: /Grapple DC/ }).textContent).toBe('14');
    expect(within(card).getByRole('button', { name: /Shove DC/ }).textContent).toBe('14');
    expect(openTooltip(/Grapple DC/).textContent).toContain('Base');
  });

  it('floors damage at 0 and explains it in the Breakdown', () => {
    const c = fighter();
    renderPage({ ...c, abilities: { ...c.abilities, str: 6 } });
    expect(screen.getByRole('button', { name: /Unarmed Strike damage/ }).textContent).toBe('0 bludgeoning');
    expect(openTooltip(/Unarmed Strike damage/).textContent).toContain('Cannot go below 0');
  });

  it('calls onAttack with the unarmed id', () => {
    renderPage(fighter());
    fireEvent.click(screen.getByRole('button', { name: 'Attack with Unarmed Strike' }));
    expect(onAttack).toHaveBeenCalledWith('unarmed');
  });
});

describe('Ammunition tracker', () => {
  const archer = (quantity = 20, equip = true) =>
    fighter({
      inventory: [weapon('w1', 'longbow'), ammo('a1', 'arrows', quantity)],
      equipped: equip ? { weaponItemIds: ['w1'] } : { weaponItemIds: [] },
    });

  it('shows the matching inventory ammunition with its inventory quantity', () => {
    renderPage(archer(20));
    const tile = screen.getByTestId('ammo-a1');
    expect(within(tile).getByText('Arrows')).toBeTruthy();
    expect(within(tile).getByText('20')).toBeTruthy();
  });

  it('shows an empty state when no equipped weapon uses ammunition', () => {
    renderPage(archer(20, false));
    expect(screen.getByText('No ammunition tracked')).toBeTruthy();
    expect(screen.queryByTestId('ammo-a1')).toBeNull();
  });

  it('Fire spends one piece from the inventory and counts it as fired this fight', () => {
    renderPage(archer(20));
    fireEvent.click(screen.getByRole('button', { name: 'Fire one Arrows' }));
    expect(latest.inventory?.find((i) => i.id === 'a1')?.quantity).toBe(19);
    expect(screen.getByTestId('ammo-used-a1').textContent).toBe('1');
  });

  it('cannot fire from an empty stack', () => {
    renderPage(archer(0));
    expect((screen.getByRole('button', { name: 'Fire one Arrows' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Recover half after the fight returns half of the fired pieces, rounded down', () => {
    renderPage(archer(20));
    const recover = screen.getByRole('button', { name: /Recover half of the Arrows fired/ }) as HTMLButtonElement;
    expect(recover.disabled).toBe(true);
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Fire one Arrows' }));
    expect(latest.inventory?.find((i) => i.id === 'a1')?.quantity).toBe(17);
    const tip = openTooltip(/Arrows recovered/);
    expect(tip.textContent).toContain('Fired this fight');
    expect(screen.getByRole('button', { name: /Arrows recovered/ }).textContent).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: /Recover half of the Arrows fired/ }));
    expect(latest.inventory?.find((i) => i.id === 'a1')?.quantity).toBe(18);
    expect(screen.getByTestId('ammo-used-a1').textContent).toBe('0');
  });

  it('recovers nothing from a single fired piece (half of 1, rounded down)', () => {
    renderPage(archer(20));
    fireEvent.click(screen.getByRole('button', { name: 'Fire one Arrows' }));
    fireEvent.click(screen.getByRole('button', { name: /Recover half of the Arrows fired/ }));
    expect(latest.inventory?.find((i) => i.id === 'a1')?.quantity).toBe(19);
  });
});

describe('Weapon Mastery chooser', () => {
  it('shows no chooser, only a locked note, for a class with no Weapon Mastery', () => {
    renderPage(fighter({ classes: [{ id: 'wizard' as ClassId, level: 5 }] }));
    expect(screen.getByTestId('mastery-locked-note').textContent).toContain('Every weapon mastery is locked');
    expect(screen.queryByLabelText('Add a weapon')).toBeNull();
  });

  it('shows no chooser when no class is selected', () => {
    const c = fighter();
    renderPage({ ...c, classes: undefined });
    expect(screen.getByTestId('mastery-locked-note')).toBeTruthy();
    expect(screen.queryByLabelText('Add a weapon')).toBeNull();
  });

  it('shows the limit as a Breakdown', () => {
    renderPage(fighter());
    const tip = openTooltip(/Weapon Mastery limit/);
    expect(tip.textContent).toContain('Weapon Mastery');
    expect(screen.getByRole('button', { name: /Weapon Mastery limit/ }).textContent).toBe('4');
  });

  it('adds an eligible weapon and lists it', () => {
    renderPage(fighter());
    fireEvent.change(screen.getByLabelText('Add a weapon'), { target: { value: 'greatsword' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(latest.weaponMasteries).toEqual(['greatsword']);
    expect(screen.getByTestId('mastery-row-greatsword')).toBeTruthy();
  });

  it('only offers weapons the class can pick', () => {
    renderPage(fighter({ classes: [{ id: 'barbarian' as ClassId, level: 5 }] }));
    const options = Array.from(
      (screen.getByLabelText('Add a weapon') as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(options).toContain('greatsword');
    expect(options).not.toContain('longbow');
  });

  it('removes a chosen weapon only when the Remove button is pressed', () => {
    renderPage(fighter({ weaponMasteries: ['greatsword', 'longsword'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Greatsword from Weapon Mastery' }));
    expect(latest.weaponMasteries).toEqual(['longsword']);
  });

  it('keeps an over-limit list, warns, and locks the extras (never deletes silently)', () => {
    const onChange = vi.fn();
    const masteries = ['greatsword', 'longsword', 'battleaxe', 'dagger', 'quarterstaff'];
    render(<CombatPage character={fighter({ weaponMasteries: masteries })} onChange={onChange} />);
    const alert = screen.getByTestId('mastery-over-cap');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('Quarterstaff');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole('listitem').filter((li) => li.dataset.testid?.startsWith('mastery-row-'))).toHaveLength(5);
    const row = screen.getByTestId('mastery-row-quarterstaff');
    fireEvent.mouseEnter(within(row).getByRole('button', { name: /locked/ }));
    expect(screen.getByRole('tooltip').textContent).toContain('more weapons than your level allows');
  });

  it('disables adding when the list is full', () => {
    renderPage(fighter({ weaponMasteries: ['greatsword', 'longsword', 'battleaxe', 'dagger'] }));
    expect((screen.getByLabelText('Add a weapon') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
