import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CombatPage } from '../../pages/CombatPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';
import { DICE_ENTRY_MODE_KEY } from '../../../hooks/useDiceEntryMode';

let latest: Character;
let changes = 0;

function Harness({ initial }: { initial: Character }) {
  const [character, setCharacter] = useState<Character>(initial);
  return (
    <CombatPage
      character={character}
      onChange={(next) => {
        latest = next;
        changes += 1;
        setCharacter(next);
      }}
    />
  );
}

/** A character with a manual HP maximum of 20 (no class needed). */
function renderPage(overrides: Partial<Character> = {}) {
  const initial = { ...createCharacter('Tester'), hpMax: 20, ...overrides };
  latest = initial;
  changes = 0;
  render(<Harness initial={initial} />);
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  document.body.style.overflow = '';
});

describe('HP card', () => {
  it('shows current / max as CalculatedValues whose breakdown explains the number', () => {
    renderPage({ currentHp: 8 });
    const readout = screen.getByTestId('hp-readout');
    const current = within(readout).getByRole('button', { name: /Current HP/ });
    expect(current).toHaveTextContent('8');
    expect(current.getAttribute('aria-label')).toContain('20 (Hit Point maximum)');
    expect(current.getAttribute('aria-label')).toContain('12 (Damage taken)');
    expect(within(readout).getByRole('button', { name: /Max HP/ })).toHaveTextContent('20');
    expect(screen.getByRole('progressbar', { name: 'Hit Points' })).toHaveAttribute('aria-valuenow', '8');
  });

  it('treats an absent currentHp as at maximum', () => {
    renderPage();
    expect(within(screen.getByTestId('hp-readout')).getByRole('button', { name: /Current HP/ })).toHaveTextContent('20');
    expect(screen.queryByTestId('chip-bloodied')).toBeNull();
  });

  it('shows a Bloodied chip at half HP or fewer, with a rule tooltip', () => {
    renderPage({ currentHp: 10 });
    const chip = screen.getByTestId('chip-bloodied');
    fireEvent.click(within(chip).getByRole('button', { name: 'Bloodied' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/half your Hit Points or fewer/);
  });

  it('shows the Temp HP readout with a rule tooltip', () => {
    renderPage({ tempHp: 7 });
    expect(screen.getByTestId('temp-hp-value')).toHaveTextContent('7');
    fireEvent.click(screen.getByRole('button', { name: 'Temp HP' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/cannot be added together/);
  });

  it('with no HP maximum, says to set a class or HP max and disables damage, heal and Temp HP', () => {
    const initial = createCharacter('Tester');
    latest = initial;
    render(<Harness initial={initial} />);
    expect(screen.getByTestId('hp-no-max')).toHaveTextContent(/Set a class or an HP max/);
    expect(screen.getByLabelText('Healing amount')).toBeDisabled();
    expect(screen.getByLabelText('Temporary Hit Points amount')).toBeDisabled();
    expect(screen.getByLabelText('Damage amount')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Apply damage' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Knock out' })).toBeDisabled();
    expect(screen.queryByTestId('hp-readout')).toBeNull();
  });

  it('a dead character shows Dead and cannot take damage or healing', () => {
    renderPage({ exhaustionLevel: 6 });
    expect(screen.getByTestId('chip-dead')).toBeInTheDocument();
    expect(screen.getByTestId('death-saves-dead')).toBeInTheDocument();
    expect(screen.getByLabelText('Damage amount')).toBeDisabled();
    expect(screen.getByLabelText('Healing amount')).toBeDisabled();
  });

  it('heals, capping at the maximum and returning currentHp to absent at full', () => {
    renderPage({ currentHp: 8 });
    type('Healing amount', '5');
    click('Heal');
    expect(latest.currentHp).toBe(13);
    expect(screen.getByTestId('hp-status')).toHaveTextContent(/Healed 5 Hit Points/);
    type('Healing amount', '50');
    click('Heal');
    expect('currentHp' in latest).toBe(false);
    expect(within(screen.getByTestId('hp-readout')).getByRole('button', { name: /Current HP/ })).toHaveTextContent('20');
  });

  it('does not apply an empty or zero heal', () => {
    renderPage({ currentHp: 8 });
    expect(screen.getByRole('button', { name: 'Heal' })).toBeDisabled();
    type('Healing amount', '0');
    expect(screen.getByRole('button', { name: 'Heal' })).toBeDisabled();
    expect(changes).toBe(0);
  });

  it('grants Temp HP straight away when there are none', () => {
    renderPage();
    type('Temporary Hit Points amount', '5');
    click('Grant Temp HP');
    expect(latest.tempHp).toBe(5);
    expect(screen.queryByRole('group', { name: 'Keep or replace Temporary Hit Points' })).toBeNull();
  });

  it('asks keep-or-replace when new Temp HP differ, and never stacks', () => {
    renderPage({ tempHp: 5 });
    type('Temporary Hit Points amount', '3');
    click('Grant Temp HP');
    expect(latest.tempHp).toBe(5); // nothing applied yet
    const prompt = screen.getByRole('group', { name: 'Keep or replace Temporary Hit Points' });
    fireEvent.click(within(prompt).getByRole('button', { name: 'Replace with 3' }));
    expect(latest.tempHp).toBe(3);

    type('Temporary Hit Points amount', '8');
    click('Grant Temp HP');
    fireEvent.click(screen.getByRole('button', { name: 'Keep 3' }));
    expect(latest.tempHp).toBe(3); // kept, not 11
    expect(screen.queryByRole('group', { name: 'Keep or replace Temporary Hit Points' })).toBeNull();
  });

  it('Temp HP do not wake a character at 0 HP', () => {
    renderPage({ currentHp: 0 });
    type('Temporary Hit Points amount', '6');
    click('Grant Temp HP');
    expect(latest.tempHp).toBe(6);
    expect(latest.currentHp).toBe(0);
    expect(screen.getByTestId('derived-unconscious')).toBeInTheDocument();
  });
});

describe('Take Damage preview', () => {
  it('shows Temp HP absorbed, HP lost, remainder vs HP maximum, and a drop-to-0 warning', () => {
    renderPage({ currentHp: 6, tempHp: 4 });
    type('Damage amount', '12');
    expect(screen.getByTestId('preview-damage')).toHaveTextContent('12');
    expect(screen.getByTestId('preview-temp')).toHaveTextContent('4');
    expect(screen.getByTestId('preview-hp-lost')).toHaveTextContent('6');
    expect(screen.getByTestId('preview-remainder')).toHaveTextContent('2 vs 20');
    expect(screen.getByTestId('preview-warning')).toHaveTextContent('Would drop to 0 HP.');
    // The preview alone changes nothing.
    expect(changes).toBe(0);
  });

  it('applies the previewed damage: Temp HP first, then HP', () => {
    renderPage({ currentHp: 6, tempHp: 4 });
    type('Damage amount', '12');
    click('Apply 12 damage');
    expect(latest.currentHp).toBe(0);
    expect('tempHp' in latest).toBe(false);
    expect(screen.getByTestId('damage-status')).toHaveTextContent(/Took 12 damage\. 4 absorbed by Temp HP\. Dropped to 0 Hit Points\./);
    // Inputs reset after applying.
    expect(screen.getByLabelText('Damage amount')).toHaveValue(null);
  });

  it('warns of Massive Damage when the remainder equals the maximum (PHB example: 12 max, at 6, takes 18)', () => {
    renderPage({ hpMax: 12, currentHp: 6 });
    type('Damage amount', '18');
    expect(screen.getByTestId('preview-remainder')).toHaveTextContent('12 vs 12');
    expect(screen.getByTestId('preview-warning')).toHaveTextContent(/kill the character outright/);
    fireEvent.click(screen.getByRole('button', { name: 'Remainder vs HP maximum' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Massive Damage|remainder/i);
    click('Apply 18 damage');
    expect(latest.dead).toBe(true);
    expect(screen.getByTestId('chip-dead')).toBeInTheDocument();
  });

  it('does not kill when the remainder is below the maximum', () => {
    renderPage({ hpMax: 12, currentHp: 6 });
    type('Damage amount', '17');
    expect(screen.getByTestId('preview-remainder')).toHaveTextContent('11 vs 12');
    expect(screen.getByTestId('preview-warning')).toHaveTextContent('Would drop to 0 HP.');
  });

  it('applies the flat adjustment, then Resistance, then Vulnerability (PHB worked example: 28, -5, 22)', () => {
    renderPage({ hpMax: 100 });
    type('Damage amount', '28');
    type('Flat damage adjustment', '-5');
    fireEvent.click(screen.getByLabelText('Resistance'));
    fireEvent.click(screen.getByLabelText('Vulnerability'));
    const dmg = within(screen.getByTestId('preview-damage')).getByRole('button');
    expect(dmg).toHaveTextContent('22');
    expect(dmg.getAttribute('aria-label')).toContain('28 (Damage rolled)');
    expect(dmg.getAttribute('aria-label')).toContain('(Resistance (halved, round down))');
    click('Apply 22 damage');
    expect(latest.currentHp).toBe(78);
  });

  it('Immunity takes no damage, and the per-instance toggles reset after applying', () => {
    renderPage({ hpMax: 100 });
    type('Damage amount', '30');
    fireEvent.click(screen.getByLabelText('Immunity'));
    expect(screen.getByTestId('preview-damage')).toHaveTextContent('0');
    click('Apply 0 damage');
    expect('currentHp' in latest).toBe(false);
    expect(screen.getByLabelText('Immunity')).not.toBeChecked();
    expect(screen.getByLabelText('Resistance')).not.toBeChecked();
  });

  it('records the damage type label in the announcement', () => {
    renderPage();
    type('Damage amount', '5');
    fireEvent.change(screen.getByLabelText('Damage type'), { target: { value: 'Fire' } });
    click('Apply 5 damage');
    expect(screen.getByTestId('damage-status')).toHaveTextContent('Took 5 Fire damage.');
  });

  it('D4 toggle (default off): damage fully absorbed by Temp HP at 0 HP still adds a failure; on, it does not', () => {
    renderPage({ currentHp: 0, tempHp: 5 });
    type('Damage amount', '3');
    expect(screen.getByTestId('preview-failures')).toHaveTextContent('1');
    fireEvent.click(screen.getByLabelText(/Treat damage absorbed by Temp HP as no damage/));
    expect(screen.getByTestId('preview-failures')).toHaveTextContent('0');
    click('Apply 3 damage');
    expect(latest.tempHp).toBe(2);
    expect(latest.deathSaves).toBeUndefined();
  });

  it('a Critical Hit at 0 HP adds two death-save failures', () => {
    renderPage({ currentHp: 0 });
    type('Damage amount', '4');
    fireEvent.click(screen.getByLabelText('Critical Hit'));
    expect(screen.getByTestId('preview-failures')).toHaveTextContent('2');
    click('Apply 4 damage');
    expect(latest.deathSaves).toEqual({ successes: 0, failures: 2 });
  });

  it('warns that a third failure would kill', () => {
    renderPage({ currentHp: 0, deathSaves: { successes: 0, failures: 2 } });
    type('Damage amount', '2');
    expect(screen.getByTestId('preview-warning')).toHaveTextContent(/third death-save failure/);
  });

  it('is part of the Hit Points card, with the per-hit options folded away', () => {
    renderPage();
    expect(screen.queryByRole('heading', { name: 'Take Damage', level: 3 })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Take damage' })).toBeInTheDocument();
    expect(screen.getByLabelText('Damage amount')).toBeInTheDocument();
    const options = screen.getByText(/^Damage options/).closest('details')!;
    expect(options.open).toBe(false);
  });

  it('names the options that are on, so a folded panel still shows them', () => {
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Resistance' }));
    expect(screen.getByText(/^Damage options/)).toHaveTextContent('Damage options: Resistance');
  });
});

describe('Derived Unconscious badges and Knock out', () => {
  it('shows read-only "from 0 HP" badges for Unconscious, Incapacitated and Prone, never stored', () => {
    renderPage({ currentHp: 0 });
    for (const id of ['unconscious', 'incapacitated', 'prone']) {
      const badge = screen.getByTestId(`derived-${id}`);
      expect(within(badge).getByText('from 0 HP')).toBeInTheDocument();
      expect(within(badge).queryByRole('button', { name: /^Remove/ })).toBeNull();
    }
    expect(latest.conditions).toBeUndefined();
    expect(screen.queryByTestId('affecting-you-empty')).toBeNull();
  });

  it('does not show derived badges above 0 HP', () => {
    renderPage({ currentHp: 1 });
    expect(screen.queryByTestId('derived-unconscious')).toBeNull();
    expect(screen.getByTestId('affecting-you-empty')).toBeInTheDocument();
  });

  it('does not duplicate Unconscious when it is also stored', () => {
    renderPage({ currentHp: 0, conditions: [{ id: 'unconscious' }] });
    expect(screen.getByTestId('active-unconscious')).toBeInTheDocument();
    expect(screen.queryByTestId('derived-unconscious')).toBeNull();
    expect(screen.getByTestId('derived-prone')).toBeInTheDocument();
  });

  it('healing from 0 HP removes the derived badges because they were never stored', () => {
    renderPage({ currentHp: 0 });
    type('Healing amount', '3');
    click('Heal');
    expect(latest.currentHp).toBe(3);
    expect(screen.queryByTestId('derived-unconscious')).toBeNull();
    expect(latest.conditions).toBeUndefined();
  });

  it('Knock out asks first, then sets 1 HP and WRITES Unconscious with a Short Rest note', () => {
    renderPage();
    click('Knock out');
    expect(changes).toBe(0);
    expect(screen.getByRole('dialog', { name: 'Confirmation' })).toHaveTextContent(/Hit Points become 1/);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Knock out' }));
    expect(latest.currentHp).toBe(1);
    expect(latest.conditions).toEqual([{ id: 'unconscious', note: 'Knocked out', ends: 'Short Rest' }]);
    // It is a stored, removable condition, not a derived badge.
    expect(screen.getByTestId('active-unconscious')).toBeInTheDocument();
    expect(screen.queryByTestId('derived-unconscious')).toBeNull();
    expect(screen.getByLabelText('Unconscious ends note')).toHaveValue('Short Rest');
  });

  it('cancelling the Knock out confirmation changes nothing', () => {
    renderPage();
    click('Knock out');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(changes).toBe(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Death Saves widget', () => {
  it('is hidden while the character is above 0 HP', () => {
    renderPage({ currentHp: 5 });
    expect(screen.queryByRole('heading', { name: /Death Saves/ })).toBeNull();
    expect(screen.queryByTestId('pips-success')).toBeNull();
  });

  it('shows three success pips and three failure pips at 0 HP', () => {
    renderPage({ currentHp: 0, deathSaves: { successes: 2, failures: 1 } });
    expect(screen.getByRole('img', { name: 'Successes: 2 of 3' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Failures: 1 of 3' })).toBeInTheDocument();
    expect(
      Array.from(screen.getByTestId('pips-success').children).map((p) => p.getAttribute('data-filled')),
    ).toEqual(['true', 'true', 'false']);
    expect(
      Array.from(screen.getByTestId('pips-failure').children).map((p) => p.getAttribute('data-filled')),
    ).toEqual(['true', 'false', 'false']);
    expect(screen.getByTestId('pips-success').children).toHaveLength(3);
    expect(screen.getByTestId('pips-failure').children).toHaveLength(3);
  });

  it('manual flow: type the die, see the Exhaustion line in the roll, a total under 10 fails, and the pips and live region update', () => {
    localStorage.setItem(DICE_ENTRY_MODE_KEY, 'manual');
    renderPage({ currentHp: 0, exhaustionLevel: 2 });
    expect(screen.getByRole('button', { name: /Exhaustion death save modifier/ })).toHaveTextContent('-4');
    click('Enter death save result');
    const dialog = screen.getByRole('dialog', { name: 'Death Saving Throw' });
    fireEvent.change(within(dialog).getByLabelText('Your d20 roll'), { target: { value: '12' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
    const total = within(dialog).getByRole('button', { name: /Death Saving Throw total/ });
    expect(total).toHaveTextContent('8');
    expect(total.getAttribute('aria-label')).toContain('(Exhaustion -4)');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply result' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(latest.deathSaves).toEqual({ successes: 0, failures: 1 });
    expect(screen.getByRole('img', { name: 'Failures: 1 of 3' })).toBeInTheDocument();
    expect(screen.getByTestId('death-save-status')).toHaveTextContent('Death save failed with a 8.');
    expect(screen.getByTestId('death-save-status')).toHaveAttribute('aria-live', 'polite');
  });

  it('judges a natural 20 on the raw die even with Exhaustion: regain 1 HP, counters reset, badges vanish', () => {
    localStorage.setItem(DICE_ENTRY_MODE_KEY, 'manual');
    renderPage({ currentHp: 0, exhaustionLevel: 4, deathSaves: { successes: 1, failures: 2 } });
    click('Enter death save result');
    fireEvent.change(screen.getByLabelText('Your d20 roll'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply result' }));
    expect(latest.currentHp).toBe(1);
    expect(latest.deathSaves).toBeUndefined();
    expect(screen.queryByTestId('derived-unconscious')).toBeNull();
    // The card unmounts, but the always-mounted live region still announces it.
    expect(screen.getByTestId('death-save-status')).toHaveTextContent(/natural 20, regained 1 Hit Point/);
  });

  it('judges a natural 1 on the raw die: two failures, and a third failure is death', () => {
    localStorage.setItem(DICE_ENTRY_MODE_KEY, 'manual');
    renderPage({ currentHp: 0, deathSaves: { successes: 0, failures: 1 } });
    click('Enter death save result');
    fireEvent.change(screen.getByLabelText('Your d20 roll'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply result' }));
    expect(latest.dead).toBe(true);
    expect(screen.getByTestId('chip-dead')).toBeInTheDocument();
    expect(screen.getByTestId('death-saves-dead')).toBeInTheDocument();
    expect(screen.getByTestId('death-save-status')).toHaveTextContent(/Third failure: the character dies/);
    expect(screen.queryByRole('button', { name: /^(Roll|Enter) death save/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stabilize' })).toBeNull();
  });

  it('three successes make the character Stable, which has its own state and tooltip', () => {
    localStorage.setItem(DICE_ENTRY_MODE_KEY, 'manual');
    renderPage({ currentHp: 0, deathSaves: { successes: 2, failures: 0 } });
    click('Enter death save result');
    fireEvent.change(screen.getByLabelText('Your d20 roll'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply result' }));
    expect(latest.deathSaves).toEqual({ successes: 0, failures: 0, stable: true });
    expect(latest.currentHp).toBe(0);
    expect(screen.getByTestId('chip-stable')).toBeInTheDocument();
    expect(screen.getByTestId('death-saves-stable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enter death save result' })).toBeNull();
    // A Stable creature is still Unconscious.
    expect(screen.getByTestId('derived-unconscious')).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('chip-stable')).getByRole('button', { name: 'Stable' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/makes no Death Saving Throws/);
  });

  it('automatic flow rolls the die for you', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // d20 face 11
    renderPage({ currentHp: 0 });
    click('Roll death save');
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    expect(screen.getByTestId('roll-dice')).toHaveTextContent('11');
    fireEvent.click(screen.getByRole('button', { name: 'Apply result' }));
    expect(latest.deathSaves).toEqual({ successes: 1, failures: 0 });
    expect(screen.getByRole('img', { name: 'Successes: 1 of 3' })).toBeInTheDocument();
  });

  it('cancelling the roll leaves the character unchanged', () => {
    renderPage({ currentHp: 0 });
    click('Roll death save');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(changes).toBe(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Stabilize asks first, then marks the character Stable at 0 HP', () => {
    renderPage({ currentHp: 0, deathSaves: { successes: 1, failures: 2 } });
    click('Stabilize');
    expect(changes).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Stable' }));
    expect(latest.deathSaves).toEqual({ successes: 0, failures: 0, stable: true });
    expect(latest.currentHp).toBe(0);
    expect(screen.getByTestId('chip-stable')).toBeInTheDocument();
  });

  it('damage at 0 HP ends Stable and adds a failure', () => {
    renderPage({ currentHp: 0, deathSaves: { successes: 0, failures: 0, stable: true } });
    type('Damage amount', '2');
    click('Apply 2 damage');
    expect(latest.deathSaves).toEqual({ successes: 0, failures: 1 });
    expect(screen.queryByTestId('chip-stable')).toBeNull();
    expect(screen.getByRole('button', { name: 'Roll death save' })).toBeInTheDocument();
  });

  it('shows the Death Saving Throws rule tooltip, including the Exhaustion note', () => {
    renderPage({ currentHp: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Death Saves' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/does not say outright/);
  });
});

describe('Preview breakdown tooltips', () => {
  it('Temp HP absorbed, HP lost and remainder each open a breakdown that explains the number', () => {
    renderPage({ currentHp: 6, tempHp: 4 });
    type('Damage amount', '12');
    const tipText = () => screen.getAllByRole('tooltip').map((n) => n.textContent ?? '').join(' | ');
    fireEvent.click(within(screen.getByTestId('preview-temp')).getByRole('button'));
    expect(tipText()).toMatch(/Damage after modifiers.*Passes through to Hit Points/);
    fireEvent.click(within(screen.getByTestId('preview-hp-lost')).getByRole('button'));
    expect(tipText()).toMatch(/Damage left after Temp HP/);
    fireEvent.click(within(screen.getByTestId('preview-remainder')).getByRole('button'));
    expect(tipText()).toMatch(/Hit Point maximum \(20\)/);
  });

  it('death-save failures added opens a breakdown that includes the zero Critical Hit component', () => {
    renderPage({ currentHp: 0 });
    type('Damage amount', '4');
    fireEvent.click(within(screen.getByTestId('preview-failures')).getByRole('button'));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Failure from taking damage at 0 HP/);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Extra failure from a Critical Hit/);
  });
});

describe('Focus after Apply, Heal and Grant', () => {
  it('returns focus to the damage amount input after Apply, and keeps the announcement', () => {
    renderPage();
    type('Damage amount', '5');
    click('Apply 5 damage');
    expect(screen.getByLabelText('Damage amount')).toHaveFocus();
    expect(screen.getByTestId('damage-status')).toHaveTextContent(/Took 5 damage/);
  });

  it('returns focus to the healing input after Heal, and keeps the announcement', () => {
    renderPage({ currentHp: 8 });
    type('Healing amount', '3');
    click('Heal');
    expect(screen.getByLabelText('Healing amount')).toHaveFocus();
    expect(screen.getByTestId('hp-status')).toHaveTextContent(/Healed 3/);
  });

  it('returns focus to the Temp HP input after Grant, and after the keep-or-replace choice', () => {
    renderPage();
    type('Temporary Hit Points amount', '5');
    click('Grant Temp HP');
    expect(screen.getByLabelText('Temporary Hit Points amount')).toHaveFocus();
    expect(screen.getByTestId('hp-status')).toHaveTextContent(/Temporary Hit Points are now 5/);

    type('Temporary Hit Points amount', '3');
    click('Grant Temp HP');
    click('Replace with 3');
    expect(screen.getByLabelText('Temporary Hit Points amount')).toHaveFocus();
  });

  it('falls back to the status line when the hit kills the character and the input is disabled', () => {
    renderPage({ hpMax: 12, currentHp: 6 });
    type('Damage amount', '18');
    click('Apply 18 damage');
    expect(screen.getByLabelText('Damage amount')).toBeDisabled();
    expect(screen.getByTestId('damage-status')).toHaveFocus();
  });
});
