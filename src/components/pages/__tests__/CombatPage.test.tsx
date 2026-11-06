import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CombatPage } from '../CombatPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';
import { startCombat } from '../../../logic/initiative-order';

function renderPage(overrides = {}) {
  const character = { ...createCharacter('Tester'), ...overrides };
  const onChange = vi.fn();
  render(<CombatPage character={character} onChange={onChange} />);
  return { character, onChange };
}

/** An in-combat character (combat.inCombat true) for the segmented-control tests. */
function renderInCombat(overrides = {}) {
  const base = { ...createCharacter('Tester'), ...overrides };
  const character = startCombat(base, []);
  const onChange = vi.fn();
  render(<CombatPage character={character} onChange={onChange} />);
  return { character, onChange };
}

function renderStatefulPage(overrides = {}) {
  const onChange = vi.fn();
  function Harness() {
    const [character, setCharacter] = useState<Character>({
      ...createCharacter('Tester'),
      ...overrides,
    });
    return (
      <CombatPage
        character={character}
        onChange={(next) => {
          onChange(next);
          setCharacter(next);
        }}
      />
    );
  }
  render(<Harness />);
  return { onChange };
}

/**
 * P2: the consolidated "Defenses & Combat Stats" panel (DefenseReadout) hosts
 * the labelled AC / Speed / HP / Initiative / Passive Perception triggers and
 * the Adjust editors — the former separate "Combat Stats" card and
 * "Defenses & Movement" readout are merged into this one panel.
 */
function defensePanel() {
  return screen.getByRole('heading', { name: 'Defenses & Combat Stats' }).closest('div')!
    .parentElement as HTMLElement;
}

describe('CombatPage — out of combat (flat stack)', () => {
  it('renders the derived combat stats through CalculatedValue triggers', () => {
    renderPage();
    const panel = within(defensePanel());
    expect(panel.getByRole('button', { name: /Armor Class/ })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /^Speed:/ })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /Initiative/ })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /Passive Perception/ })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /Hit Point Maximum/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hit Dice total/ })).toBeInTheDocument();
  });

  it('merges AC, Speed and HP into a SINGLE panel (no duplicate AC card)', () => {
    // The old split showed AC twice (Combat Stats + Defenses & Movement). After
    // P2 there is exactly one "Defenses & Combat Stats" panel, one Armor Class
    // trigger, and no standalone "Combat Stats" heading.
    renderPage();
    expect(screen.queryByRole('heading', { name: 'Combat Stats' })).toBeNull();
    expect(
      screen.getAllByRole('heading', { name: 'Defenses & Combat Stats' }),
    ).toHaveLength(1);
    const panel = within(defensePanel());
    expect(panel.getAllByRole('button', { name: /Armor Class/ })).toHaveLength(1);
    expect(panel.getByRole('button', { name: /^Speed:/ })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /Hit Point Maximum/ })).toBeInTheDocument();
  });

  it('shows base AC 12 for Dex 14 and no override', () => {
    renderPage({ abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } });
    const ac = within(defensePanel()).getByRole('button', { name: /Armor Class/ });
    expect(ac).toHaveTextContent('12');
  });

  it('entering an AC override emits acOverride and clearing it unsets', () => {
    const { onChange } = renderStatefulPage();
    const input = screen.getByLabelText('Armor Class override');
    fireEvent.change(input, { target: { value: '17' } });
    expect(onChange.mock.calls.at(-1)?.[0].acOverride).toBe(17);
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange.mock.calls.at(-1)?.[0].acOverride).toBeUndefined();
  });

  it('shows the Hit Point Maximum read-only (no editable HP input on Combat)', () => {
    // P1: HP max is authoritative on the Advancement tab; Combat shows only the
    // read-only CalculatedValue, so the editable #hp-max input is gone.
    renderPage();
    const panel = within(defensePanel());
    expect(panel.getByRole('button', { name: /Hit Point Maximum/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Hit Point maximum')).toBeNull();
  });

  it('does not render the rolled-HP house-rule toggle on Combat (P1)', () => {
    // The rolled-HP house rule moved off Combat; its toggle and total input are
    // no longer part of the in-combat glance.
    renderPage();
    expect(screen.queryByLabelText('Use rolled HP (house rule)')).toBeNull();
    expect(screen.queryByLabelText('Rolled HP total')).toBeNull();
  });

  it('surfaces the Hit Dice total and HP max for a selected class', () => {
    // Wizard d6, level 3, Con 14 (+2).
    renderPage({
      level: 3,
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      classes: [{ id: 'wizard', level: 3 }],
    });
    expect(screen.getByText('d6')).toBeInTheDocument();
    const hitDice = screen.getByRole('button', { name: /Hit Dice total/ });
    expect(hitDice).toHaveTextContent('3');
    // HP max: L1 6+2=8, then 2 levels of (4+2)=6 => 8+12 = 20.
    const hp = within(defensePanel()).getByRole('button', { name: /Hit Point Maximum/ });
    expect(hp.getAttribute('aria-label')).toContain('= 20');
  });

  it('surfaces Dwarven Toughness in the HP breakdown when hpMax is set', () => {
    renderPage({ species: { id: 'dwarf' }, level: 3, hpMax: 30 });
    const hp = within(defensePanel()).getByRole('button', { name: /Hit Point Maximum/ });
    expect(hp.getAttribute('aria-label')).toMatch(/Dwarven Toughness/);
  });

  it('shows no Attack/Defend/Status segmented control out of combat', () => {
    renderPage();
    expect(screen.queryByRole('tablist', { name: 'Combat mode' })).toBeNull();
  });

  it('renders every A5a–A5d panel in the flat stack', () => {
    renderPage({
      level: 1,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      classes: [{ id: 'fighter', level: 1 }],
    });
    // HP card, Take Damage, the consolidated Defenses & Combat Stats panel (P2),
    // Death Saves, Concentration, Active Conditions, Hit Dice, Weapons,
    // Unarmed Strike.
    expect(screen.getByRole('heading', { name: 'Hit Points' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Defenses & Combat Stats' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hit Dice' })).toBeInTheDocument();
    // The Initiative tracker (starts combat) is reachable with a Start Combat button.
    expect(screen.getByRole('button', { name: 'Start Combat' })).toBeInTheDocument();
  });
});

describe('CombatPage — in combat (segmented control)', () => {
  it('shows the Attack / Defend / Status tablist only while in combat', () => {
    renderInCombat();
    const tablist = screen.getByRole('tablist', { name: 'Combat mode' });
    expect(tablist).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: 'Attack' })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: 'Defend' })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: 'Status' })).toBeInTheDocument();
  });

  it('defaults to Attack mode with its tabpanel shown and the others hidden', () => {
    renderInCombat();
    expect(screen.getByRole('tab', { name: 'Attack' })).toHaveAttribute('aria-selected', 'true');
    const attackPanel = document.getElementById('combat-mode-panel-attack')!;
    const defendPanel = document.getElementById('combat-mode-panel-defend')!;
    expect(attackPanel).not.toHaveAttribute('hidden');
    expect(defendPanel).toHaveAttribute('hidden');
  });

  it('switching to Defend reveals the Defend panel and hides Attack', () => {
    renderInCombat();
    fireEvent.click(screen.getByRole('tab', { name: 'Defend' }));
    expect(screen.getByRole('tab', { name: 'Defend' })).toHaveAttribute('aria-selected', 'true');
    const attackPanel = document.getElementById('combat-mode-panel-attack')!;
    const defendPanel = document.getElementById('combat-mode-panel-defend')!;
    expect(defendPanel).not.toHaveAttribute('hidden');
    expect(attackPanel).toHaveAttribute('hidden');
    // The Defend panel hosts the HP card and the consolidated Defenses & Combat
    // Stats panel (AC + Speed + HP together, P2).
    expect(within(defendPanel).getByRole('heading', { name: 'Hit Points' })).toBeInTheDocument();
    const consolidated = within(defendPanel).getByRole('heading', {
      name: 'Defenses & Combat Stats',
    });
    expect(consolidated).toBeInTheDocument();
    const panel = within(consolidated.closest('div')!.parentElement as HTMLElement);
    expect(panel.getByRole('button', { name: /Armor Class/ })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /^Speed:/ })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /Hit Point Maximum/ })).toBeInTheDocument();
  });

  it('ArrowRight on the tablist moves selection to the next tab (roving tabindex)', () => {
    renderInCombat();
    const attackTab = screen.getByRole('tab', { name: 'Attack' });
    expect(attackTab).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(attackTab, { key: 'ArrowRight' });
    const defendTab = screen.getByRole('tab', { name: 'Defend' });
    expect(defendTab).toHaveAttribute('aria-selected', 'true');
    expect(defendTab).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Attack' })).toHaveAttribute('tabindex', '-1');
  });

  it('Status mode hosts Active Conditions, Death Saves and Hit Dice', () => {
    renderInCombat();
    fireEvent.click(screen.getByRole('tab', { name: 'Status' }));
    const statusPanel = document.getElementById('combat-mode-panel-status')!;
    expect(within(statusPanel).getByRole('heading', { name: 'Hit Dice' })).toBeInTheDocument();
    // P2: the consolidated defense panel (with AC) lives in Defend mode, so it is
    // NOT duplicated in Status — no AC here.
    expect(
      within(statusPanel).queryByRole('heading', { name: 'Defenses & Combat Stats' }),
    ).toBeNull();
  });
});

describe('CombatPage — Unarmored Defense and Speed reflect the new logic', () => {
  it('a Barbarian with no armour shows the Con-based Unarmored Defense AC', () => {
    // Barbarian, Dex 14 (+2), Con 16 (+3), no armour → 10 + 2 + 3 = 15.
    renderPage({
      level: 1,
      abilities: { str: 10, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
      classes: [{ id: 'barbarian', level: 1 }],
    });
    const ac = within(defensePanel()).getByRole('button', { name: /Armor Class/ });
    expect(ac).toHaveTextContent('15');
    expect(ac.getAttribute('aria-label')).toMatch(/Unarmored Defense/);
  });

  it('a Monk loses Unarmored Defense when wielding a Shield', () => {
    // Monk, Dex 14 (+2), Wis 16 (+3). With a Shield, UD is unavailable → plain
    // 10 + Dex (+2) + Shield (+2) = 14 (NOT 10 + 2 + 3 + 2 = 17).
    const shieldItem = {
      id: 'shield-1',
      kind: 'armor' as const,
      catalogId: 'shield',
      quantity: 1,
    };
    renderPage({
      level: 1,
      abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 16, cha: 10 },
      classes: [{ id: 'monk', level: 1 }],
      inventory: [shieldItem],
      equipped: { shieldItemId: 'shield-1' },
    });
    const ac = within(defensePanel()).getByRole('button', { name: /Armor Class/ });
    expect(ac).toHaveTextContent('14');
  });

  it('Plate armor with low Strength shows the -10 Speed penalty in the readout', () => {
    // Plate Armor requires Str 15; a Str-10 wearer loses 10 ft of Speed.
    const plateItem = {
      id: 'plate-1',
      kind: 'armor' as const,
      catalogId: 'plate-armor',
      quantity: 1,
    };
    renderPage({
      level: 1,
      species: { id: 'human' },
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      inventory: [plateItem],
      equipped: { armorItemId: 'plate-1' },
    });
    // The consolidated panel's Speed trigger carries the penalty in its
    // breakdown. Human base speed 30 − 10 (Str requirement) = 20 ft.
    const movement = screen.getByRole('heading', { name: 'Defenses & Combat Stats' })
      .closest('div')!.parentElement as HTMLElement;
    const speed = within(movement).getByRole('button', { name: /^Speed:/ });
    expect(speed).toHaveTextContent('20 ft');
    expect(speed.getAttribute('aria-label')).toMatch(/Armor Strength requirement/);
  });
});
