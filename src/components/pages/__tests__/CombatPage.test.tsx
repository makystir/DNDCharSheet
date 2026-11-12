import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CombatPage } from '../CombatPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

function renderPage(overrides = {}) {
  const character = { ...createCharacter('Tester'), ...overrides };
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
 * The sticky summary strip is the one place the Combat page shows AC, Speed,
 * HP and Passive Perception (the old "Defenses & Combat Stats" panel only
 * repeated them and is gone; its Adjust editors moved to the Overview Vitals).
 */
function defensePanel() {
  return screen.getByRole('group', { name: 'Combat summary' });
}

describe('CombatPage — out of combat (flat stack)', () => {
  it('renders the derived combat stats through CalculatedValue triggers', () => {
    renderPage({ hpMax: 20 });
    const panel = within(defensePanel());
    expect(panel.getByRole('button', { name: /Armor Class/ })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /^Speed:/ })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /Passive Perception/ })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /^Max HP/ })).toBeInTheDocument();
    // The Initiative modifier sits on the Fight card, beside the roll.
    expect(within(screen.getByTestId('initiative-modifier')).getByRole('button', { name: /^Initiative/ })).toBeInTheDocument();
  });

  it('shows Armor Class once, in the strip (no repeated Defenses panel)', () => {
    renderPage();
    expect(screen.queryByRole('heading', { name: 'Combat Stats' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Defenses & Combat Stats' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Armor Class/ })).toHaveLength(1);
  });

  it('shows base AC 12 for Dex 14 and no override', () => {
    renderPage({ abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } });
    const ac = within(defensePanel()).getByRole('button', { name: /Armor Class/ });
    expect(ac).toHaveTextContent('12');
  });

  it('has no setup editors (AC override and Initiative bonus live on the Overview)', () => {
    renderPage();
    expect(screen.queryByLabelText('Armor Class override')).toBeNull();
    expect(screen.queryByLabelText('Initiative bonus')).toBeNull();
  });

  it('shows the Hit Point Maximum read-only (no editable HP input on Combat)', () => {
    // P1: HP max is authoritative on the Advancement tab; Combat shows only the
    // read-only CalculatedValue, so the editable #hp-max input is gone.
    renderPage({ hpMax: 20 });
    const panel = within(defensePanel());
    expect(panel.getByRole('button', { name: /^Max HP/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Hit Point maximum')).toBeNull();
  });

  it('does not render the rolled-HP house-rule toggle on Combat (P1)', () => {
    // The rolled-HP house rule moved off Combat; its toggle and total input are
    // no longer part of the in-combat glance.
    renderPage();
    expect(screen.queryByLabelText('Use rolled HP (house rule)')).toBeNull();
    expect(screen.queryByLabelText('Rolled HP total')).toBeNull();
  });

  it('surfaces the HP max for a selected class, and no Hit Dice or rests', () => {
    // Wizard d6, level 3, Con 14 (+2).
    renderPage({
      level: 3,
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      classes: [{ id: 'wizard', level: 3 }],
    });
    // HP max: L1 6+2=8, then 2 levels of (4+2)=6 => 8+12 = 20.
    const hp = within(defensePanel()).getByRole('button', { name: /^Max HP/ });
    expect(hp.getAttribute('aria-label')).toContain('= 20');
    // Rolling Initiative interrupts a rest (PHB 2024 L21256 / L21485): Hit Dice
    // and the rest buttons live on the Character Overview, not here.
    expect(screen.queryByRole('button', { name: /Hit Dice total/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Short Rest' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Long Rest' })).toBeNull();
  });

  it('surfaces Dwarven Toughness in the HP breakdown when hpMax is set', () => {
    renderPage({ species: { id: 'dwarf' }, level: 3, hpMax: 30 });
    const hp = within(defensePanel()).getByRole('button', { name: /^Max HP/ });
    expect(hp.getAttribute('aria-label')).toMatch(/Dwarven Toughness/);
  });

  it('has no Attack/Defend/Status tablist, initiative tracker or turn panel', () => {
    renderPage();
    expect(screen.queryByRole('tablist', { name: 'Combat mode' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start Combat' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next Turn' })).toBeNull();
    expect(screen.queryByText('Movement used')).toBeNull();
  });

  it('groups the page into Status, Attacks and Resources', () => {
    renderPage({
      level: 1,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      classes: [{ id: 'fighter', level: 1 }],
    });
    for (const name of ['Status', 'Attacks', 'Resources']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    // The cards that used to live behind the three modes are all on the page.
    expect(screen.getByRole('heading', { name: 'Hit Points' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Saving Throws' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Effects' })).toBeInTheDocument();
    // Out-of-fight cards are elsewhere.
    expect(screen.queryByRole('heading', { name: 'Hit Dice' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Rest' })).toBeNull();
    expect(screen.queryByLabelText('Add a weapon')).toBeNull();
  });

  it('hides the Resources group (heading too) when there is nothing to track', () => {
    renderPage();
    expect(screen.queryByRole('heading', { level: 2, name: 'Resources' })).toBeNull();
  });

  it('hides Death Saves above 0 HP and Concentration when not concentrating', () => {
    renderPage({ hpMax: 20, currentHp: 20 });
    expect(screen.queryByRole('heading', { name: /Death Saves/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'End Concentration' })).toBeNull();
  });

  it('shows a summary strip with HP, AC, Speed and Passive Perception', () => {
    renderPage();
    const strip = screen.getByRole('group', { name: 'Combat summary' });
    expect(within(strip).getByTestId('strip-ac')).toBeInTheDocument();
    expect(within(strip).getByTestId('strip-passive-perception')).toHaveTextContent('10');
    expect(within(strip).getByTestId('strip-speed')).toHaveTextContent('ft');
    expect(within(strip).getByTestId('strip-hp')).toBeInTheDocument();
    expect(within(strip).queryByTestId('strip-round')).toBeNull();
  });
});

describe('CombatPage - fight tracker', () => {
  it('starts a fight at round 1 and counts rounds with Next round', () => {
    renderStatefulPage();
    expect(screen.getByTestId('round-number')).toHaveTextContent('-');
    fireEvent.click(screen.getByRole('button', { name: 'Start fight' }));
    expect(screen.getByTestId('round-number')).toHaveTextContent('1');
    expect(within(screen.getByRole('group', { name: 'Combat summary' })).getByTestId('strip-round')).toHaveTextContent('Round 1');
    fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
    expect(screen.getByTestId('round-number')).toHaveTextContent('3');
  });

  it('Next round counts down timed conditions and effects and says what ended', () => {
    const { onChange } = renderStatefulPage({
      conditions: [
        { id: 'poisoned', duration: { kind: 'rounds', rounds: 1 } },
        { id: 'blinded', duration: { kind: 'rounds', rounds: 3 } },
      ],
      effects: [
        { id: 'e1', name: 'Bless', rounds: 1 },
        { id: 'e2', name: 'Rage', rounds: 4 },
        { id: 'e3', name: 'Mage Armor' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start fight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
    const next = onChange.mock.calls.at(-1)![0] as Character;
    expect(next.combat?.round).toBe(2);
    expect(next.conditions).toEqual([{ id: 'blinded', duration: { kind: 'rounds', rounds: 2 } }]);
    expect(next.effects).toEqual([
      { id: 'e2', name: 'Rage', rounds: 3 },
      { id: 'e3', name: 'Mage Armor' },
    ]);
    const status = screen.getByTestId('round-status');
    expect(status).toHaveTextContent('Round 2. Ended: Poisoned, Bless.');
  });

  it('records an initiative roll, starting the fight, and clears it when the fight ends', () => {
    const { onChange } = renderStatefulPage();
    fireEvent.click(screen.getByRole('button', { name: 'Roll initiative' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep result' }));
    const rolled = onChange.mock.calls.at(-1)![0] as Character;
    expect(rolled.combat?.inCombat).toBe(true);
    expect(typeof rolled.combat?.initiative).toBe('number');
    expect(screen.getByTestId('initiative-result')).toHaveTextContent(String(rolled.combat?.initiative));

    fireEvent.click(screen.getByRole('button', { name: 'End fight' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End fight' }));
    const ended = onChange.mock.calls.at(-1)![0] as Character;
    expect(ended.combat).toBeUndefined();
  });
});

describe('CombatPage - saving throws', () => {
  it('shows all six saves with their bonus', () => {
    renderPage({ abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } });
    for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
      expect(screen.getByTestId(`save-${ability}`)).toBeInTheDocument();
    }
    expect(within(screen.getByTestId('save-dex')).getByRole('button', { name: /Dexterity Save/ })).toHaveTextContent('+2');
  });

  it('flags what conditions do to a save', () => {
    renderPage({ conditions: [{ id: 'restrained' }, { id: 'paralyzed' }] });
    expect(screen.getByTestId('save-str')).toHaveTextContent('Auto-fail (Paralyzed)');
    expect(screen.getByTestId('save-dex')).toHaveTextContent('Auto-fail');
    expect(screen.getByTestId('save-wis')).not.toHaveTextContent('Auto-fail');
  });

  it('shows Disadvantage on Dexterity saves while Restrained', () => {
    renderPage({ conditions: [{ id: 'restrained' }] });
    expect(screen.getByTestId('save-dex')).toHaveTextContent('Disadvantage (Restrained)');
    expect(screen.getByTestId('save-con')).not.toHaveTextContent('Disadvantage');
  });

  it('rolls a save and shows the result', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Roll Wisdom saving throw' }));
    expect(screen.getByRole('dialog', { name: 'Wisdom saving throw' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByTestId('save-result')).toHaveTextContent(/Wisdom save: -?\d+ \(rolled \d+/);
  });

  it('starts a Dexterity save with Disadvantage while Restrained', () => {
    renderPage({ conditions: [{ id: 'restrained' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Roll Dexterity saving throw' }));
    expect(screen.getByRole('radio', { name: 'Disadvantage' })).toBeChecked();
  });
});

describe('CombatPage - tracked effects', () => {
  it('adds an effect with rounds, takes rounds off and ends it', () => {
    renderStatefulPage();
    fireEvent.change(screen.getByLabelText('Effect name'), { target: { value: 'Haste' } });
    fireEvent.change(screen.getByLabelText('Effect rounds'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add effect' }));
    const list = screen.getByRole('list', { name: 'Tracked effects' });
    expect(within(list).getByText('Haste')).toBeInTheDocument();
    expect(within(list).getByText('2 rounds left')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Take a round off Haste' }));
    expect(within(list).getByText('1 round left')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Take a round off Haste' }));
    expect(screen.queryByRole('list', { name: 'Tracked effects' })).toBeNull();
  });

  it('rejects a bad round count', () => {
    renderStatefulPage();
    fireEvent.change(screen.getByLabelText('Effect name'), { target: { value: 'Haste' } });
    fireEvent.change(screen.getByLabelText('Effect rounds'), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: 'Add effect' })).toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent(/whole number of 1 or more/);
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
    // The strip's Speed trigger carries the penalty in its breakdown.
    // Human base speed 30 − 10 (Str requirement) = 20 ft.
    const speed = within(defensePanel()).getByRole('button', { name: /^Speed:/ });
    expect(speed).toHaveTextContent('20 ft');
    expect(speed.getAttribute('aria-label')).toMatch(/Armor Strength requirement/);
  });
});
