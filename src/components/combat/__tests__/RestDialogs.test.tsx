import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
// Rests live on the Character Overview Rest card (not the Combat page).
import { OverviewRest } from '../../pages/character/OverviewRest';
import { ShortRestDialog } from '../ShortRestDialog';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';
import { DICE_ENTRY_MODE_KEY } from '../../../hooks/useDiceEntryMode';

const NOW = Date.UTC(2025, 0, 10, 12, 0, 0);
const HOUR = 3_600_000;

let latest: Character;
let changes = 0;
const notify = vi.fn();

function Harness({ initial }: { initial: Character }) {
  const [character, setCharacter] = useState<Character>(initial);
  return (
    <OverviewRest
      character={character}
      onNotify={notify}
      onChange={(next) => {
        latest = next;
        changes += 1;
        setCharacter(next);
      }}
    />
  );
}

/** A level 3 Fighter (d10 Hit Die, Con 14 = +2) with 40 max HP, at 10 HP. */
function fighter(overrides: Partial<Character> = {}): Character {
  const base = createCharacter('Tester');
  return {
    ...base,
    level: 3,
    classes: [{ id: 'fighter', level: 3 }],
    abilities: { ...base.abilities, con: 14 },
    hpMax: 40,
    currentHp: 10,
    ...overrides,
  };
}

function renderPage(overrides: Partial<Character> = {}) {
  const initial = fighter(overrides);
  latest = initial;
  changes = 0;
  render(<Harness initial={initial} />);
}

function openShortRest() {
  const trigger = screen.getByRole('button', { name: 'Short Rest' });
  trigger.focus();
  fireEvent.click(trigger);
  return screen.getByRole('dialog', { name: 'Short Rest' });
}

function openLongRest() {
  const trigger = screen.getByRole('button', { name: 'Long Rest' });
  trigger.focus();
  fireEvent.click(trigger);
  return screen.getByRole('dialog', { name: 'Long Rest' });
}

/** Type a Hit Die result into the (manual mode) Short Rest dialog and add it. */
function addDie(dialog: HTMLElement, face: string) {
  fireEvent.change(within(dialog).getByLabelText(/Hit Die result, 1 to/), { target: { value: face } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add Hit Die' }));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(DICE_ENTRY_MODE_KEY, 'manual');
  notify.mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  document.body.style.overflow = '';
});

describe('Recovered limited-use features', () => {
  const spentFeatures = {
    'fighter.second-wind': 2,
    'fighter.action-surge': 1,
  };

  it('Short Rest lists regain-one and regain-all results and counts them in the message', () => {
    renderPage({ resourcesSpent: spentFeatures });
    const dialog = openShortRest();
    const list = within(dialog).getByTestId('short-rest-recovered');
    expect(list).toHaveTextContent('Second Wind: 0 -> 1 of 2 (regain one)');
    expect(list).toHaveTextContent('Action Surge: 0 -> 1 of 1');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finish Short Rest' }));
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Recovered 2 limited-use features.'));
    expect(latest.resourcesSpent).toEqual({ 'fighter.second-wind': 1 });
  });

  it('Long Rest lists every recovered feature and mentions the count', () => {
    renderPage({ resourcesSpent: spentFeatures });
    const dialog = openLongRest();
    const list = within(dialog).getByTestId('long-rest-recovered');
    expect(list).toHaveTextContent('Second Wind: 0 -> 2 of 2');
    expect(list).toHaveTextContent('Action Surge: 0 -> 1 of 1');
    fireEvent.click(within(dialog).getByRole('button', { name: /Finish Long Rest|Rest anyway/ }));
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('2 limited-use features recovered.'));
    expect(latest.resourcesSpent).toBeUndefined();
  });

  it('shows no list when nothing is spent', () => {
    renderPage();
    expect(within(openShortRest()).queryByTestId('short-rest-recovered')).toBeNull();
  });
});

describe('Rest buttons', () => {
  it('sit in the Rest card with rule tooltips', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Short Rest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Long Rest' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Short Rest rules' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Short Rest/);
  });

  it('keeps the editable Hit Dice Spent field working', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Hit Dice spent'), { target: { value: '2' } });
    expect(latest.hitDiceSpent).toBe(2);
    const dialog = openShortRest();
    expect(within(dialog).getByTestId('short-rest-remaining')).toHaveTextContent('1 / 3');
  });
});

describe('Short Rest dialog', () => {
  it('shows Hit Dice remaining and the running total with capped HP preview breakdowns', () => {
    renderPage({ currentHp: 35 });
    const dialog = openShortRest();
    expect(within(dialog).getByTestId('short-rest-remaining')).toHaveTextContent('3 / 3');

    addDie(dialog, '10'); // 10 + 2 = 12
    addDie(dialog, '10'); // 12 more = 24, but only 5 HP fit
    expect(within(dialog).getByTestId('short-rest-rolled')).toHaveTextContent('24');
    const regained = within(dialog).getByTestId('short-rest-regained').querySelector('button');
    expect(regained).toHaveTextContent('5');
    const label = regained?.getAttribute('aria-label') ?? '';
    expect(label).toContain('24 (Hit Points rolled)');
    expect(label).toContain('- 19 (Lost to the Hit Point maximum)');
    expect(within(dialog).getByTestId('short-rest-after')).toHaveTextContent('40 / 40');
    expect(within(dialog).getByTestId('short-rest-remaining')).toHaveTextContent('1 / 3');
    expect(within(dialog).getByTestId('short-rest-dice').children).toHaveLength(2);
  });

  it('spends dice one at a time, heals and records the spent dice on Finish', () => {
    renderPage();
    const dialog = openShortRest();
    addDie(dialog, '6'); // 6 + Con 2 = 8
    expect(within(dialog).getByTestId('short-rest-announce')).toHaveTextContent('Die 1: rolled 6, regains 8.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finish Short Rest' }));

    expect(latest.currentHp).toBe(18);
    expect(latest.hitDiceSpent).toBe(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('rest-status')).toHaveTextContent(/spent 1 Hit Die, regained 8 Hit Points/);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Short Rest finished'));
    // The editable Spent field reflects the rest.
    expect(screen.getByLabelText('Hit Dice spent')).toHaveValue(1);
  });

  it('regains at least 1 Hit Point per die (minimum applied per die)', () => {
    const base = createCharacter('x');
    renderPage({ abilities: { ...base.abilities, con: 8 } }); // Con modifier -1
    const dialog = openShortRest();
    addDie(dialog, '1'); // 1 - 1 = 0, floored to 1
    expect(within(dialog).getByTestId('short-rest-rolled')).toHaveTextContent('1');
    const rolled = within(dialog).getByTestId('short-rest-rolled').querySelector('button');
    expect(rolled?.getAttribute('aria-label')).toContain('1 (Minimum 1 (die 1))');
  });

  it('stops at the Hit Dice remaining', () => {
    renderPage({ hitDiceSpent: 2 });
    const dialog = openShortRest();
    addDie(dialog, '4');
    expect(within(dialog).getByRole('button', { name: 'Add Hit Die' })).toBeDisabled();
    expect(within(dialog).getByText('No Hit Dice remain to spend.')).toBeInTheDocument();
  });

  it('rejects a result outside the Hit Die and removes the last die on request', () => {
    renderPage();
    const dialog = openShortRest();
    addDie(dialog, '11');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a result between 1 and 10.');
    expect(within(dialog).queryByTestId('short-rest-dice')).toBeNull();

    addDie(dialog, '5');
    expect(within(dialog).getByRole('button', { name: 'Remove last die' })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove last die' }));
    expect(within(dialog).queryByTestId('short-rest-dice')).toBeNull();
    expect(within(dialog).getByTestId('short-rest-remaining')).toHaveTextContent('3 / 3');
  });

  it('Interrupted gives no benefits and leaves the character as it was', () => {
    renderPage();
    const before = latest;
    const dialog = openShortRest();
    addDie(dialog, '9');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Interrupted' }));
    expect(latest).toEqual(before);
    expect(latest.hitDiceSpent).toBeUndefined();
    expect(screen.getByTestId('rest-status')).toHaveTextContent('Short Rest interrupted: no benefits gained.');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is blocked at 0 HP with an explanation and no dice controls', () => {
    renderPage({ currentHp: 0 });
    const dialog = openShortRest();
    expect(within(dialog).getByTestId('short-rest-blocked')).toHaveTextContent(/at least 1 Hit Point/);
    expect(within(dialog).queryByRole('button', { name: 'Add Hit Die' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Finish Short Rest' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(changes).toBe(0);
  });

  it('is blocked for a dead character', () => {
    renderPage({ exhaustionLevel: 6 });
    expect(within(openShortRest()).getByTestId('short-rest-blocked')).toHaveTextContent(/dead/);
  });

  it('with no class it explains and still lets the rest finish', () => {
    renderPage({ classes: undefined });
    const dialog = openShortRest();
    expect(within(dialog).getByTestId('short-rest-no-class')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Add Hit Die' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finish Short Rest' }));
    expect(screen.getByTestId('rest-status')).toHaveTextContent(/no Hit Dice spent/);
  });

  it('closes on Escape and Cancel and returns focus to the Short Rest button', () => {
    renderPage();
    const trigger = screen.getByRole('button', { name: 'Short Rest' });
    openShortRest();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    const dialog = openShortRest();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(trigger);
    expect(changes).toBe(0);
  });

  it('in auto mode rolls the Hit Die with the app RNG', () => {
    const onComplete = vi.fn();
    render(
      <ShortRestDialog
        character={fighter()}
        diceEntryMode="auto"
        rng={() => 0.5} // d10 -> 6
        onComplete={onComplete}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll d10' }));
    expect(screen.getByTestId('short-rest-announce')).toHaveTextContent('Die 1: rolled 6, regains 8.');
    fireEvent.click(screen.getByRole('button', { name: 'Finish Short Rest' }));
    const [next] = onComplete.mock.calls[0] as [Character, string];
    expect(next.currentHp).toBe(18);
  });
});

describe('Long Rest dialog', () => {
  const tired: Partial<Character> = {
    currentHp: 12,
    tempHp: 5,
    hitDiceSpent: 2,
    exhaustionLevel: 2,
    concentration: { spellId: 'fog-cloud' },
  };

  it('lists exactly what will reset, with breakdowns for the changed numbers', () => {
    renderPage(tired);
    const dialog = openLongRest();
    const list = within(dialog).getByTestId('long-rest-resets');
    expect(list).toHaveTextContent('Hit Points to maximum');
    expect(list).toHaveTextContent('All spent Hit Dice come back');
    expect(list).toHaveTextContent('Temporary Hit Points');
    expect(list).toHaveTextContent('Exhaustion level goes down by 1');
    expect(list).toHaveTextContent('Spell slots, including Pact Magic slots and Mystic Arcanum uses');
    expect(list).toHaveTextContent('Concentration ends (you are concentrating on Fog Cloud)');

    const hp = within(list).getByRole('button', { name: /^Hit Points after Long Rest/ });
    expect(hp).toHaveTextContent('40');
    expect(hp.getAttribute('aria-label')).toContain('12 (Current Hit Points)');
    expect(hp.getAttribute('aria-label')).toContain('28 (Restored to Hit Point maximum)');
    const exhaustion = within(list).getByRole('button', { name: /Exhaustion level after Long Rest/ });
    expect(exhaustion).toHaveTextContent('1');
    expect(exhaustion.getAttribute('aria-label')).toContain('- 1 (Reduced by 1 (minimum 0))');
  });

  it('confirming resets the character and records the time', () => {
    renderPage(tired);
    const dialog = openLongRest();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Finish Long Rest' }));
    expect('currentHp' in latest).toBe(false);
    expect('hitDiceSpent' in latest).toBe(false);
    expect('tempHp' in latest).toBe(false);
    expect('concentration' in latest).toBe(false);
    expect(latest.exhaustionLevel).toBe(1);
    expect(latest.lastLongRestAt).toBe(NOW);
    expect(screen.getByTestId('rest-status')).toHaveTextContent('Long Rest finished.');
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Long Rest finished'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Hit Dice spent')).toHaveValue(null);
  });

  it('shows the 16-hour advisory with Rest anyway, and never blocks', () => {
    renderPage({ ...tired, lastLongRestAt: NOW - 5 * HOUR });
    const dialog = openLongRest();
    expect(within(dialog).getByTestId('long-rest-advisory')).toHaveTextContent(
      'Less than 16 hours since your last Long Rest',
    );
    expect(within(dialog).queryByRole('button', { name: 'Finish Long Rest' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rest anyway' }));
    expect(latest.lastLongRestAt).toBe(NOW);
    expect('currentHp' in latest).toBe(false);
  });

  it('shows no advisory with no record or 16+ hours since', () => {
    renderPage({ ...tired, lastLongRestAt: NOW - 16 * HOUR });
    expect(within(openLongRest()).queryByTestId('long-rest-advisory')).toBeNull();
    expect(screen.getByRole('button', { name: 'Finish Long Rest' })).toBeInTheDocument();
  });

  it('Cancel changes nothing and returns focus to the Long Rest button', () => {
    renderPage(tired);
    const trigger = screen.getByRole('button', { name: 'Long Rest' });
    const dialog = openLongRest();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(changes).toBe(0);
    expect(document.activeElement).toBe(trigger);
  });

  it('is blocked at 0 HP with an explanation', () => {
    renderPage({ currentHp: 0 });
    const dialog = openLongRest();
    expect(within(dialog).getByTestId('long-rest-blocked')).toHaveTextContent(/at least 1 Hit Point/);
    expect(within(dialog).queryByRole('button', { name: 'Finish Long Rest' })).toBeNull();
  });

  it('Interrupted helper: 1+ hours earns Short Rest benefits and reports the hours needed', () => {
    renderPage(tired);
    const dialog = openLongRest();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Interrupted' }));
    fireEvent.change(within(dialog).getByLabelText('Hours rested before the interruption'), { target: { value: '3' } });
    fireEvent.change(within(dialog).getByLabelText('Interruptions so far'), { target: { value: '2' } });
    const result = within(dialog).getByTestId('long-rest-interrupt-result');
    expect(result).toHaveTextContent('you gain the benefits of a Short Rest');
    expect(result).toHaveTextContent('10 hours in total');

    // Hands over to the Short Rest dialog with the user's own dice.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Take Short Rest benefits' }));
    expect(screen.queryByRole('dialog', { name: 'Long Rest' })).toBeNull();
    const shortDialog = screen.getByRole('dialog', { name: 'Short Rest' });
    addDie(shortDialog, '5');
    fireEvent.click(within(shortDialog).getByRole('button', { name: 'Finish Short Rest' }));
    expect(latest.currentHp).toBe(19); // 12 + 5 + Con 2
    expect(latest.hitDiceSpent).toBe(3);
    expect(latest.exhaustionLevel).toBe(2); // a Long Rest did not finish
    expect(latest.tempHp).toBe(5);
  });

  it('Interrupted helper: under 1 hour gives no benefits and abandons the rest', () => {
    renderPage(tired);
    const dialog = openLongRest();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Interrupted' }));
    expect(within(dialog).getByTestId('long-rest-interrupt-result')).toHaveTextContent('gain no benefits');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abandon Long Rest' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(changes).toBe(0);
  });
});
