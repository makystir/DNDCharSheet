import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CombatPage } from '../../pages/CombatPage';
import type { Character, Combatant } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';
import { DICE_ENTRY_MODE_KEY } from '../../../hooks/useDiceEntryMode';
import { addCondition } from '../../../logic/conditions';
import { startCombat } from '../../../logic/initiative-order';

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

/** A character with Dex 14 (+2) and 30 ft Speed from the default species-less base. */
function base(overrides: Partial<Character> = {}): Character {
  const c = createCharacter('Tester');
  return { ...c, abilities: { ...c.abilities, dex: 14 }, hpMax: 20, ...overrides };
}

function renderPage(initial: Character) {
  latest = initial;
  return render(<Harness initial={initial} />);
}

const mate = (id: string, name: string, initiative: number, isCharacter = false): Combatant =>
  isCharacter ? { id, name, initiative, isCharacter } : { id, name, initiative };

/** A character already in combat with the given roster (sorted by startCombat). */
function inCombat(roster: Combatant[], overrides: Partial<Character> = {}): Character {
  return startCombat(base(overrides), roster);
}

function addRow(name: string, init: string) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Init'), { target: { value: init } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to roster' }));
}

function roster() {
  return within(screen.getByRole('list', { name: 'Initiative order' }));
}

function rosterNames(): string[] {
  return roster()
    .getAllByRole('listitem')
    .map((li) => li.querySelector('span:nth-of-type(2)')?.textContent ?? '');
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(DICE_ENTRY_MODE_KEY, 'manual');
});

afterEach(() => {
  localStorage.clear();
  document.body.style.overflow = '';
});

describe('Initiative tracker: start, add, end', () => {
  it('starts combat at round 1 and adds combatants in Initiative order', () => {
    renderPage(base());
    expect(screen.getByRole('button', { name: 'Start Combat' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start Combat' }));
    expect(latest.combat?.round).toBe(1);
    expect(screen.getByTestId('initiative-round')).toHaveTextContent('Round 1');

    addRow('Goblin', '12');
    addRow('Orc', '18');
    addRow('Wolf', '7');
    expect(rosterNames()).toEqual(['Orc', 'Goblin', 'Wolf']);
    expect(latest.combat?.combatants.map((c) => c.initiative)).toEqual([18, 12, 7]);
    expect(screen.getByTestId('initiative-status')).toHaveTextContent('Added Wolf at Initiative 7.');
  });

  it('only enables Add when there is a name and a whole-number Initiative', () => {
    renderPage(inCombat([]));
    const add = screen.getByRole('button', { name: 'Add to roster' });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Goblin' } });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Init'), { target: { value: '12.5' } });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Init'), { target: { value: '-1' } });
    expect(add).toBeEnabled();
  });

  it('marks the active combatant and moves the round counter with Next and Previous Turn', () => {
    renderPage(inCombat([mate('a', 'Orc', 18), mate('b', 'Goblin', 12)]));
    const items = roster().getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('aria-current', 'true');
    expect(items[0]).toHaveTextContent('Active turn');
    expect(items[1]).not.toHaveAttribute('aria-current');

    const prev = screen.getByRole('button', { name: 'Previous Turn' });
    expect(prev).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next Turn' }));
    expect(roster().getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('initiative-status')).toHaveTextContent("Round 1. Goblin's turn.");

    fireEvent.click(screen.getByRole('button', { name: 'Next Turn' }));
    expect(screen.getByTestId('initiative-round')).toHaveTextContent('Round 2');
    expect(latest.combat?.activeIndex).toBe(0);

    expect(screen.getByRole('button', { name: 'Previous Turn' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous Turn' }));
    expect(screen.getByTestId('initiative-round')).toHaveTextContent('Round 1');
    expect(latest.combat?.activeIndex).toBe(1);
  });

  it('removes a combatant, announces it and returns focus to the roster status region', async () => {
    renderPage(inCombat([mate('a', 'Orc', 18), mate('b', 'Goblin', 12)]));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Orc' }));
    expect(rosterNames()).toEqual(['Goblin']);
    expect(screen.getByTestId('initiative-status')).toHaveTextContent('Removed Orc.');
    await waitFor(() => expect(screen.getByTestId('initiative-status')).toHaveFocus());
  });

  it('asks before ending combat, then clears the roster', async () => {
    renderPage(inCombat([mate('a', 'Orc', 18)]));
    fireEvent.click(screen.getByRole('button', { name: 'End Combat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(latest.combat).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'End Combat' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End Combat' }));
    expect('combat' in latest).toBe(false);
    expect(screen.getByRole('button', { name: 'Start Combat' })).toBeInTheDocument();
    expect(screen.getByTestId('initiative-status')).toHaveTextContent('Combat ended.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Combat' })).toHaveFocus());
  });
});

describe('Initiative tracker: ties are never auto-broken', () => {
  const tied = () => inCombat([mate('a', 'Orc', 15), mate('b', 'Goblin', 15), mate('c', 'Wolf', 9)]);

  it('keeps insertion order within a tie and enables arrows only inside the tie group', () => {
    renderPage(tied());
    expect(rosterNames()).toEqual(['Orc', 'Goblin', 'Wolf']);
    expect(screen.getByRole('button', { name: 'Move Orc up within its tie' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Orc down within its tie' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move Goblin up within its tie' })).toBeEnabled();
    // Goblin is at the edge of the tie: Wolf has a different Initiative.
    expect(screen.getByRole('button', { name: 'Move Goblin down within its tie' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Wolf up within its tie' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Wolf down within its tie' })).toBeDisabled();
  });

  it('reorders within the tie, announces it and keeps the active combatant', async () => {
    renderPage(tied());
    fireEvent.click(screen.getByRole('button', { name: 'Move Orc down within its tie' }));
    expect(rosterNames()).toEqual(['Goblin', 'Orc', 'Wolf']);
    expect(screen.getByTestId('initiative-status')).toHaveTextContent('Moved Orc down within its tie.');
    // Orc was active; it stays active after the swap.
    expect(latest.combat?.combatants[latest.combat.activeIndex].name).toBe('Orc');
    // The down arrow is now disabled, so focus lands on the up arrow.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Move Orc up within its tie' })).toHaveFocus(),
    );
  });

  it('explains that the players decide ties', () => {
    renderPage(tied());
    expect(screen.getByText(/Ties are never broken for you/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Turn order' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/players decide the order/);
  });
});

describe('Roll my Initiative', () => {
  function openRoll() {
    fireEvent.click(screen.getByRole('button', { name: /Roll my Initiative/ }));
    return screen.getByRole('dialog', { name: 'Initiative' });
  }

  function enter(dialog: HTMLElement, ...faces: number[]) {
    if (faces.length === 2) {
      fireEvent.change(within(dialog).getByLabelText('First d20 roll'), { target: { value: String(faces[0]) } });
      fireEvent.change(within(dialog).getByLabelText('Second d20 roll'), { target: { value: String(faces[1]) } });
    } else {
      fireEvent.change(within(dialog).getByLabelText('Your d20 roll'), { target: { value: String(faces[0]) } });
    }
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
  }

  it('returns focus to "Roll my Initiative" when the prompt is cancelled', () => {
    renderPage(inCombat([mate('a', 'Orc', 18)]));
    const trigger = screen.getByRole('button', { name: /Roll my Initiative/ });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Initiative' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Initiative' })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('fills the form with the total but only commits after the user confirms', () => {
    renderPage(inCombat([mate('a', 'Orc', 18)]));
    const dialog = openRoll();
    enter(dialog, 14);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this Initiative' }));

    // 14 + Dex +2 = 16, in the form and not yet on the roster.
    expect(screen.getByLabelText('Init')).toHaveValue(16);
    expect(screen.getByLabelText('Name')).toHaveValue('Tester');
    expect(rosterNames()).toEqual(['Orc']);
    expect(latest.combat?.combatants).toHaveLength(1);
    const rolled = screen.getByRole('button', { name: /Initiative roll:/ });
    expect(rolled.getAttribute('aria-label')).toContain('14 (d20 roll)');

    fireEvent.click(screen.getByRole('button', { name: 'Add to roster' }));
    expect(rosterNames()).toEqual(['Orc', 'Tester']);
    const own = latest.combat?.combatants.find((c) => c.name === 'Tester');
    expect(own?.initiative).toBe(16);
    expect(own?.isCharacter).toBe(true);
    expect(screen.getByTestId('combatant-Tester')).toHaveTextContent('You');
    // Rolling again is blocked while the entry exists.
    expect(screen.getByRole('button', { name: /Roll my Initiative/ })).toBeDisabled();
  });

  it('lets the user change the rolled value before adding it', () => {
    renderPage(inCombat([]));
    const dialog = openRoll();
    enter(dialog, 10);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this Initiative' }));
    fireEvent.change(screen.getByLabelText('Init'), { target: { value: '20' } });
    expect(screen.queryByRole('button', { name: /Initiative roll:/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add to roster' }));
    expect(latest.combat?.combatants[0]).toMatchObject({ name: 'Tester', initiative: 20, isCharacter: true });
  });

  it('shows the Dex modifier, bonus and the Exhaustion line item in the prompt (D1)', () => {
    renderPage(inCombat([], { initiativeBonus: 1, exhaustionLevel: 2 }));
    const dialog = openRoll();
    enter(dialog, 10);
    const total = within(dialog).getByTestId('roll-total');
    // 10 + Dex 2 + bonus 1 - Exhaustion 4 = 9
    expect(total).toHaveTextContent('9');
    const label = within(total).getByRole('button').getAttribute('aria-label') ?? '';
    expect(label).toContain('+ 2 (Dex mod)');
    expect(label).toContain('+ 1 (Bonus)');
    expect(label).toContain('- 4 (Exhaustion -4)');
  });

  it('names the sources of Advantage and Disadvantage and starts the prompt in the resolved mode', () => {
    renderPage(inCombat([], addCondition(base(), 'invisible')));
    expect(screen.getByTestId('initiative-sources')).toHaveTextContent('Advantage from: Invisible');
    const dialog = openRoll();
    expect(within(dialog).getByTestId('initiative-sources')).toHaveTextContent('Initiative roll: Advantage');
    expect(within(dialog).getByRole('radio', { name: 'Advantage' })).toBeChecked();
    enter(dialog, 5, 17);
    // Advantage keeps 17: 17 + 2 = 19.
    expect(within(dialog).getByTestId('roll-total')).toHaveTextContent('19');
  });

  it('Surprised gives Disadvantage and cancels against a manual Advantage', () => {
    renderPage(inCombat([]));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Surprised' }));
    expect(screen.getByTestId('initiative-sources')).toHaveTextContent('Initiative roll: Disadvantage');
    expect(screen.getByTestId('initiative-sources')).toHaveTextContent('Disadvantage from: Surprised');

    fireEvent.click(screen.getByRole('radio', { name: 'Advantage' }));
    expect(screen.getByTestId('initiative-sources')).toHaveTextContent('Initiative roll: Normal');
    expect(screen.getByTestId('initiative-sources')).toHaveTextContent('cancel out');
    const dialog = openRoll();
    expect(within(dialog).getByRole('radio', { name: 'Normal' })).toBeChecked();
  });

  it('treats a character at 0 HP as Incapacitated (D2)', () => {
    renderPage(inCombat([], { currentHp: 0 }));
    expect(screen.getByTestId('initiative-sources')).toHaveTextContent('Disadvantage from: Incapacitated');
  });

  it('opens a surprise tooltip', () => {
    renderPage(inCombat([]));
    fireEvent.click(screen.getByRole('button', { name: 'About Surprise' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/no separate surprise round/);
  });
});

describe('Turn panel', () => {
  const own = () => inCombat([mate('me', 'Tester', 18, true), mate('o', 'Orc', 10)]);

  it('shows nothing until combat starts', () => {
    renderPage(base());
    expect(screen.queryByRole('button', { name: /Action: / })).toBeNull();
  });

  it('records the Action, Bonus Action, Reaction and object interaction with tooltips', () => {
    renderPage(own());
    fireEvent.click(screen.getByRole('button', { name: 'Action: available' }));
    expect(latest.combat?.turn.actionUsed).toBe(true);
    expect(screen.getByRole('button', { name: 'Action: used' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Bonus Action: available' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reaction: available' }));
    fireEvent.click(screen.getByRole('button', { name: 'Free object interaction: available' }));
    expect(latest.combat?.turn).toMatchObject({
      actionUsed: true,
      bonusUsed: true,
      reactionUsed: true,
      objectInteractionUsed: true,
    });
    expect(within(screen.getByTestId('turn-warnings')).queryAllByRole('listitem')).toHaveLength(0);

    for (const [label, text] of [
      ['Action', /one action/],
      ['Bonus Action', /only one Bonus Action/],
      ['Reaction', /start of your next turn/],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('tooltip')).toHaveTextContent(text);
      fireEvent.click(screen.getByRole('button', { name: label }));
    }
  });

  it('warns, without blocking, about reusing an action, Bonus Action, Reaction or object interaction', () => {
    renderPage(own());
    fireEvent.click(screen.getByRole('button', { name: 'Action: available' }));
    fireEvent.click(screen.getByRole('button', { name: 'Action: used' }));
    const warnings = screen.getByTestId('turn-warnings');
    expect(warnings).toHaveAttribute('aria-live', 'polite');
    expect(warnings).toHaveTextContent('already used your action');
    expect(latest.combat?.turn.actionUsed).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Free object interaction: available' }));
    fireEvent.click(screen.getByRole('button', { name: 'Free object interaction: used' }));
    expect(warnings).toHaveTextContent('Utilize action');

    fireEvent.click(screen.getByRole('button', { name: 'Reaction: available' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reaction: used' }));
    expect(warnings).toHaveTextContent('It returns at the start of your next turn');
  });

  it('warns that an Incapacitated character cannot take an action, but still records it', () => {
    renderPage(inCombat([mate('me', 'Tester', 18, true)], addCondition(base(), 'stunned')));
    fireEvent.click(screen.getByRole('button', { name: 'Action: available' }));
    expect(screen.getByTestId('turn-warnings')).toHaveTextContent('You are Incapacitated');
    expect(latest.combat?.turn.actionUsed).toBe(true);
  });

  it('tracks movement with Speed, Dash and the remaining allowance as breakdowns', () => {
    renderPage(own());
    const speed = screen.getByRole('button', { name: /^Speed:/ });
    const speedFt = speed.textContent ?? '';
    const feet = Number.parseInt(speedFt, 10);
    expect(feet).toBeGreaterThanOrEqual(0);

    expect(screen.getByRole('button', { name: /^Movement allowance:/ })).toHaveTextContent(`${feet} ft`);
    expect(screen.getByRole('button', { name: /^Movement remaining:/ }).getAttribute('aria-label')).toContain(
      '0 (Movement used)',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dash' }));
    expect(screen.getByRole('button', { name: /^Movement allowance:/ })).toHaveTextContent(`${feet * 2} ft`);
    expect(screen.getByRole('button', { name: /^Movement allowance:/ }).getAttribute('aria-label')).toContain(
      'Dash (1 time)',
    );
    expect(latest.combat?.turn.actionUsed).toBe(true);

    fireEvent.change(screen.getByLabelText('Move (ft)'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(screen.getByTestId('movement-used')).toHaveTextContent('10 ft');
    expect(screen.getByRole('button', { name: /^Movement remaining:/ })).toHaveTextContent(`${feet * 2 - 10} ft`);
    expect(screen.getByLabelText('Move (ft)')).toHaveValue(null);
    expect(screen.getByLabelText('Move (ft)')).toHaveFocus();
  });

  it('warns when a move goes past the allowance but still records it', () => {
    renderPage(own());
    fireEvent.change(screen.getByLabelText('Move (ft)'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(screen.getByTestId('turn-warnings')).toHaveTextContent('more than your movement allowance');
    expect(latest.combat?.turn.movementUsed).toBe(500);
    expect(screen.getByRole('button', { name: /^Movement remaining:/ })).toHaveTextContent('0 ft');
  });

  it('rejects a move that is not a whole number of feet', () => {
    renderPage(own());
    fireEvent.change(screen.getByLabelText('Move (ft)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(screen.getByRole('alert')).toHaveTextContent('whole number of feet');
    expect(latest.combat?.turn.movementUsed).toBe(0);
  });

  it('opens the Dash tooltip', () => {
    renderPage(own());
    fireEvent.click(screen.getByRole('button', { name: 'About Dash' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/extra movement/);
  });

  it('resets the turn when the tracker reaches the character, but not on other turns', () => {
    renderPage(own());
    fireEvent.click(screen.getByRole('button', { name: 'Action: available' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reaction: available' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next Turn' }));
    // Orc's turn: the used Reaction stays spent.
    expect(latest.combat?.turn.actionUsed).toBe(true);
    expect(latest.combat?.turn.reactionUsed).toBe(true);
    expect(screen.getByText(/It is not your turn/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start my turn' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next Turn' }));
    expect(latest.combat?.turn.actionUsed).toBe(false);
    expect(latest.combat?.turn.reactionUsed).toBe(false);
    expect(screen.getByText(/It is your turn/)).toBeInTheDocument();
  });

  it('Start my turn clears the turn on the character\'s own turn', () => {
    renderPage(own());
    fireEvent.click(screen.getByRole('button', { name: 'Bonus Action: available' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start my turn' }));
    expect(latest.combat?.turn.bonusUsed).toBe(false);
  });

  it('gently reminds a concentrating character on their own turn only', () => {
    renderPage({ ...own(), concentration: { spellId: 'fog-cloud' } });
    expect(screen.getByTestId('concentration-reminder')).toHaveTextContent('concentrating on Fog Cloud');
    fireEvent.click(screen.getByRole('button', { name: 'Next Turn' }));
    expect(screen.queryByTestId('concentration-reminder')).toBeNull();
  });
});

describe('Start-of-turn Death Saving Throw prompt', () => {
  const downed = () => inCombat([mate('me', 'Tester', 18, true), mate('o', 'Orc', 10)], { currentHp: 0 });

  it('shows a banner on the character\'s own turn at 0 HP and opens the existing Death Save roll', () => {
    renderPage(downed());
    const banner = screen.getByTestId('death-save-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    fireEvent.click(within(banner).getByRole('button', { name: 'Make Death Saving Throw' }));

    const dialog = screen.getByRole('dialog', { name: 'Death Saving Throw' });
    fireEvent.change(within(dialog).getByLabelText('Your d20 roll'), { target: { value: '15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply result' }));

    expect(latest.deathSaves?.successes).toBe(1);
    expect(screen.queryByTestId('death-save-banner')).toBeNull();
  });

  it('keeps the banner button mounted and refocuses it when the prompt is cancelled', () => {
    renderPage(downed());
    const button = screen.getByRole('button', { name: 'Make Death Saving Throw' });
    button.focus();
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog', { name: 'Death Saving Throw' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Make Death Saving Throw' })).toBe(button);
    expect(button).toHaveFocus();
  });

  it('does not show the banner on another combatant\'s turn, when conscious, Stable or dead', () => {
    const notMine = inCombat([mate('o', 'Orc', 18), mate('me', 'Tester', 10, true)], { currentHp: 0 });
    const { unmount } = renderPage(notMine);
    expect(screen.queryByTestId('death-save-banner')).toBeNull();
    unmount();

    renderPage(inCombat([mate('me', 'Tester', 18, true)]));
    expect(screen.queryByTestId('death-save-banner')).toBeNull();
  });

  it('appears when the tracker advances to the downed character', () => {
    renderPage(inCombat([mate('o', 'Orc', 18), mate('me', 'Tester', 10, true)], { currentHp: 0 }));
    expect(screen.queryByTestId('death-save-banner')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next Turn' }));
    expect(screen.getByTestId('death-save-banner')).toBeInTheDocument();
  });
});

describe('Accessibility', () => {
  it('labels the form fields and exposes live regions', () => {
    renderPage(inCombat([mate('a', 'Orc', 18)]));
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Init')).toBeInTheDocument();
    expect(screen.getByLabelText('Move (ft)')).toBeInTheDocument();
    expect(screen.getByTestId('initiative-status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('turn-warnings')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('group', { name: 'Your Initiative roll' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Manual Advantage or Disadvantage' })).toBeInTheDocument();
  });

  it('returns focus to the name field after adding a combatant', async () => {
    renderPage(inCombat([]));
    addRow('Goblin', '12');
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus());
  });

  it('adds with the Enter key from the name field', () => {
    renderPage(inCombat([]));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Goblin' } });
    fireEvent.change(screen.getByLabelText('Init'), { target: { value: '11' } });
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' });
    expect(latest.combat?.combatants).toHaveLength(1);
  });

  it('keeps long names in a wrapping container', () => {
    const long = 'A very long goblin warband chieftain name that should wrap rather than push controls away';
    renderPage(inCombat([mate('a', long, 12)]));
    const row = screen.getByTestId(`combatant-${long}`);
    expect(within(row).getByText(long)).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: `Remove ${long}` })).toBeInTheDocument();
  });
});
