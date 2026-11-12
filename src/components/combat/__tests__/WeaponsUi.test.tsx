import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CombatPage } from '../../pages/CombatPage';
import { CharacterPage } from '../../pages/CharacterPage';
import { WeaponMasteryChooser } from '../WeaponMasteryChooser';
import type { Character, InventoryItem } from '../../../types/character';
import type { ClassId } from '../../../data/classes';
import { createCharacter } from '../../../storage/character-store';

let latest: Character;
function Harness({ initial }: { initial: Character }) {
  const [character, setCharacter] = useState<Character>(initial);
  return (
    <CombatPage
      character={character}
      onChange={(next) => {
        latest = next;
        setCharacter(next);
      }}
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

function renderPage(initial: Character) {
  latest = initial;
  return render(<Harness initial={initial} />);
}

/** The chooser on its own (it now lives on Character > Class & Features). */
function ChooserHarness({ initial }: { initial: Character }) {
  const [character, setCharacter] = useState<Character>(initial);
  return (
    <WeaponMasteryChooser
      character={character}
      onChange={(next) => {
        latest = next;
        setCharacter(next);
      }}
    />
  );
}

function renderChooser(initial: Character) {
  latest = initial;
  return render(<ChooserHarness initial={initial} />);
}

/** Open a CalculatedValue / ContentTooltip trigger and return the tooltip. */
function openTooltip(name: RegExp | string) {
  fireEvent.mouseEnter(screen.getByRole('button', { name }));
  return screen.getByRole('tooltip');
}

beforeEach(() => {
  localStorage.clear();
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
    expect(within(card).getByRole('button', { name: 'Roll attack with Longsword' })).toBeTruthy();
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
    expect(within(screen.getByTestId('weapon-card-w1')).queryByRole('checkbox', { name: /two-handed/ })).toBeNull();
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

  it('rolls an attack (total for the DM) and damage, with a Critical Hit toggle', () => {
    renderPage(withSword());
    const card = screen.getByTestId('weapon-card-w1');
    fireEvent.click(within(card).getByRole('button', { name: 'Roll attack with Longsword' }));
    expect(screen.getByRole('dialog', { name: 'Longsword attack' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByTestId('attack-result-Longsword').textContent).toMatch(/^Attack: \d+ \(rolled \d+\)/);
    fireEvent.click(within(card).getByRole('button', { name: 'Roll damage for Longsword' }));
    expect(screen.getByTestId('attack-result-Longsword').textContent).toMatch(/Damage: \d+ slashing \(1d8: \d+ \+ 3\)/);
    fireEvent.click(within(card).getByRole('checkbox', { name: /Longsword Critical Hit/ }));
    fireEvent.click(within(card).getByRole('button', { name: 'Roll damage for Longsword' }));
    expect(screen.getByTestId('attack-result-Longsword').textContent).toMatch(/Damage: \d+ slashing \(2d8: \d+ \+ \d+ \+ 3\), Critical Hit/);
  });

  it('with manual dice, damage says what to roll', () => {
    localStorage.setItem('dnd-dice-entry-mode', 'manual');
    renderPage(withSword());
    fireEvent.click(screen.getByRole('button', { name: 'Roll damage for Longsword' }));
    expect(screen.getByTestId('attack-result-Longsword').textContent).toBe('Roll 1d8+3 slashing.');
  });

  it('starts the attack roll with Disadvantage while Poisoned', () => {
    renderPage(withSword({ conditions: [{ id: 'poisoned' }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll attack with Longsword' }));
    expect(screen.getByRole('radio', { name: 'Disadvantage' })).toBeChecked();
    expect(screen.getByText(/Poisoned: Disadvantage/)).toBeTruthy();
  });

  it('switches between card and list view and keeps the full name and Attack button', () => {
    renderPage(withSword());
    fireEvent.click(screen.getByRole('radio', { name: 'List view' }));
    const row = screen.getByTestId('weapon-list-row-w1');
    expect(within(row).getByText('Longsword')).toBeTruthy();
    expect(within(row).getByRole('button', { name: /Longsword attack bonus/ })).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Roll attack with Longsword' })).toBeTruthy();
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

  it('rolls an Unarmed Strike attack and its fixed damage', () => {
    renderPage(fighter());
    fireEvent.click(screen.getByRole('button', { name: 'Roll damage for Unarmed Strike' }));
    expect(screen.getByTestId('attack-result-Unarmed Strike').textContent).toBe('Damage: 4 bludgeoning (4)');
    expect(screen.queryByRole('checkbox', { name: /Unarmed Strike Critical Hit/ })).toBeNull();
  });
});

describe('Ammunition tracker', () => {
  const archer = (quantity = 20, equip = true) =>
    fighter({
      inventory: [weapon('w1', 'longbow'), ammo('a1', 'arrows', quantity)],
      equipped: equip ? { weaponItemIds: ['w1'] } : { weaponItemIds: [] },
    });

  it('shows an empty state with an Ammunition weapon but no matching ammunition', () => {
    renderPage(fighter({ inventory: [weapon('w1', 'longbow')], equipped: { weaponItemIds: ['w1'] } }));
    expect(screen.getByText('No ammunition tracked')).toBeTruthy();
  });

  it('shows the matching inventory ammunition with its inventory quantity', () => {
    renderPage(archer(20));
    const tile = screen.getByTestId('ammo-a1');
    expect(within(tile).getByText('Arrows')).toBeTruthy();
    expect(within(tile).getByText('20')).toBeTruthy();
  });

  it('hides the card when no equipped weapon uses ammunition', () => {
    renderPage(archer(20, false));
    expect(screen.queryByText('No ammunition tracked')).toBeNull();
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

  it('an attack roll with a bow uses one arrow, shown on the weapon card and counted as fired', () => {
    renderPage(archer(20));
    expect(screen.getByTestId('weapon-ammo-w1').textContent).toContain('20 Arrows');
    fireEvent.click(screen.getByRole('button', { name: 'Roll attack with Longbow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(latest.inventory?.find((i) => i.id === 'a1')?.quantity).toBe(19);
    expect(screen.getByTestId('weapon-ammo-w1').textContent).toContain('19 Arrows');
    expect(screen.getByTestId('ammo-used-a1').textContent).toBe('1');
  });

  it('cannot roll an attack with a bow when out of arrows', () => {
    renderPage(archer(0));
    expect((screen.getByRole('button', { name: 'Roll attack with Longbow' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/No Arrow left/)).toBeTruthy();
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
    renderChooser(fighter({ classes: [{ id: 'wizard' as ClassId, level: 5 }] }));
    expect(screen.getByTestId('mastery-locked-note').textContent).toContain('Every weapon mastery is locked');
    expect(screen.queryByLabelText('Add a weapon')).toBeNull();
  });

  it('shows no chooser when no class is selected', () => {
    const c = fighter();
    renderChooser({ ...c, classes: undefined });
    expect(screen.getByTestId('mastery-locked-note')).toBeTruthy();
    expect(screen.queryByLabelText('Add a weapon')).toBeNull();
  });

  it('shows the limit as a Breakdown', () => {
    renderChooser(fighter());
    const tip = openTooltip(/Weapon Mastery limit/);
    expect(tip.textContent).toContain('Weapon Mastery');
    expect(screen.getByRole('button', { name: /Weapon Mastery limit/ }).textContent).toBe('4');
  });

  it('adds an eligible weapon and lists it', () => {
    renderChooser(fighter());
    fireEvent.change(screen.getByLabelText('Add a weapon'), { target: { value: 'greatsword' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(latest.weaponMasteries).toEqual(['greatsword']);
    expect(screen.getByTestId('mastery-row-greatsword')).toBeTruthy();
  });

  it('only offers weapons the class can pick', () => {
    renderChooser(fighter({ classes: [{ id: 'barbarian' as ClassId, level: 5 }] }));
    const options = Array.from(
      (screen.getByLabelText('Add a weapon') as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(options).toContain('greatsword');
    expect(options).not.toContain('longbow');
  });

  it('removes a chosen weapon only when the Remove button is pressed', () => {
    renderChooser(fighter({ weaponMasteries: ['greatsword', 'longsword'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Greatsword from Weapon Mastery' }));
    expect(latest.weaponMasteries).toEqual(['longsword']);
  });

  it('keeps an over-limit list, warns, and locks the extras (never deletes silently)', () => {
    const onChange = vi.fn();
    const masteries = ['greatsword', 'longsword', 'battleaxe', 'dagger', 'quarterstaff'];
    render(<WeaponMasteryChooser character={fighter({ weaponMasteries: masteries })} onChange={onChange} />);
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
    renderChooser(fighter({ weaponMasteries: ['greatsword', 'longsword', 'battleaxe', 'dagger'] }));
    expect((screen.getByLabelText('Add a weapon') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Weapon Mastery chooser placement', () => {
  // Masteries change only on a Long Rest, so the chooser lives on Character >
  // Class & Features, shown only to a class with Weapon Mastery.
  it('is not on the Combat page (weapon cards keep their mastery chip)', () => {
    renderPage(fighter());
    expect(screen.queryByLabelText('Add a weapon')).toBeNull();
  });

  it('is on Class & Features for a class with Weapon Mastery', () => {
    render(<CharacterPage character={fighter()} onChange={() => {}} subTab="build" />);
    expect(screen.getByLabelText('Add a weapon')).toBeTruthy();
  });

  it('is hidden on Class & Features for a class without it', () => {
    render(<CharacterPage character={fighter({ classes: [{ id: 'wizard' as ClassId, level: 5 }] })} onChange={() => {}} subTab="build" />);
    expect(screen.queryByTestId('mastery-locked-note')).toBeNull();
    expect(screen.queryByLabelText('Add a weapon')).toBeNull();
  });
});
