import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { CreaturesTab } from '../CreaturesTab';
import { CombatPage } from '../../pages/CombatPage';
import { CompanionsPage } from '../../pages/CompanionsPage';
import type { Character } from '../../../types/character';
import { plainCharacter, rangerCharacter, track, undoStub } from './helpers';
import { Stateful } from './Stateful';
import { RecordFocusContext } from '../RecordFocus';
import { useState } from 'react';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  window.location.hash = '';
});

function renderTab(initial: Character, latest?: { current: Character }) {
  render(
    <Stateful initial={initial} onState={latest ? track(latest) : undefined}>
      {(character, onChange) => <CreaturesTab character={character} onChange={onChange} undo={undoStub()} />}
    </Stateful>,
  );
}

describe('Add Creature defaults and wording', () => {
  it('defaults to Pet for a character with no companion features (no Primal Companion warning)', () => {
    renderTab(plainCharacter());
    fireEvent.click(screen.getByRole('button', { name: 'Add Creature' }));
    const dialog = screen.getByRole('dialog', { name: 'Add creature' });
    expect(within(dialog).getByLabelText('Source')).toHaveValue('pet');
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('defaults to the first suggestion for a Beast Master', () => {
    renderTab(rangerCharacter(3));
    fireEvent.click(screen.getByRole('button', { name: 'Add Creature' }));
    expect(within(screen.getByRole('dialog', { name: 'Add creature' })).getByLabelText('Source')).toHaveValue('primal-companion');
  });

  it('labels the sources in plain language and keeps the stored values', () => {
    renderTab(plainCharacter());
    fireEvent.click(screen.getByRole('button', { name: 'Add Creature' }));
    const source = screen.getByLabelText('Source');
    expect(within(source).getByRole('option', { name: 'Pet / other companion (mount, pack animal)' })).toHaveValue('pet');
    expect(within(source).getByRole('option', { name: 'Pact of the Chain (Warlock familiar)' })).toHaveValue('pact-of-the-chain');
    expect(within(source).getByRole('option', { name: 'Wild Companion (Druid familiar)' })).toHaveValue('wild-companion');
  });

  it('words the formula note for players', () => {
    // A Primal Companion on a character with no Ranger levels cannot compute its numbers.
    const c = plainCharacter({ companions: [{ id: 'p1', creatureId: 'beast-of-the-land', origin: 'primal-companion' }] });
    renderTab(c);
    fireEvent.click(within(screen.getByTestId('companion-p1')).getAllByRole('button')[0]);
    expect(screen.queryByText(/not computed yet/)).toBeNull();
    expect(screen.getByText(/exact numbers can't be worked out yet/)).toBeInTheDocument();
  });
});

describe('Adding a creature', () => {
  it('opens and highlights the new card', () => {
    const latest = { current: plainCharacter() };
    renderTab(latest.current, latest);
    fireEvent.click(screen.getByRole('button', { name: 'Add Creature' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Add creature' })).getByRole('button', { name: 'Add creature' }));
    const id = latest.current.companions![0].id;
    const card = screen.getByTestId(`companion-${id}`);
    expect(card).toHaveAttribute('data-focused', 'true');
    expect(within(card).getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'true');
  });

  it('scrolls the new card into view', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const latest = { current: plainCharacter() };
    renderTab(latest.current, latest);
    fireEvent.click(screen.getByRole('button', { name: 'Add Creature' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Add creature' })).getByRole('button', { name: 'Add creature' }));
    expect(scroll).toHaveBeenCalled();
  });
});

const ranger = (): Character => ({
  ...rangerCharacter(5, 16),
  companions: [{ id: 'p1', creatureId: 'beast-of-the-land', origin: 'primal-companion', nickname: 'Ash', hp: 20 }],
});

describe('Combat Allies card', () => {
  it('shows attack damage dice and a link to the specific card', () => {
    render(<CombatPage character={ranger()} onChange={vi.fn()} />);
    const ash = screen.getByTestId('ally-p1');
    expect(within(ash).getByRole('link', { name: 'Open Ash on Companions' })).toHaveAttribute('href', '#companions/creatures/p1');
    expect(ash).toHaveTextContent(/Beast's Strike.*\d+d\d+/);
  });

  it('steps HP down and up through the shared record patch', () => {
    const latest = { current: ranger() };
    render(
      <Stateful initial={latest.current} onState={track(latest)}>
        {(character, onChange) => <CombatPage character={character} onChange={onChange} />}
      </Stateful>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lose 1 HP: Ash' }));
    expect(latest.current.companions?.[0].hp).toBe(19);
    fireEvent.click(screen.getByRole('button', { name: 'Gain 1 HP: Ash' }));
    expect(latest.current.companions?.[0].hp === undefined || latest.current.companions?.[0].hp === 20).toBe(true);
  });

  it('applies a typed amount as damage', () => {
    const latest = { current: ranger() };
    render(
      <Stateful initial={latest.current} onState={track(latest)}>
        {(character, onChange) => <CombatPage character={character} onChange={onChange} />}
      </Stateful>,
    );
    const ash = screen.getByTestId('ally-p1');
    fireEvent.change(within(ash).getByLabelText('Ash hit point amount'), { target: { value: '7' } });
    fireEvent.click(within(ash).getByRole('button', { name: 'Damage' }));
    expect(latest.current.companions?.[0].hp).toBe(13);
  });

  it('adjusts a hireling too (people list)', () => {
    const c: Character = {
      ...plainCharacter(),
      hirelings: [{ id: 'h1', name: 'Gerta', kind: 'skilled', days: 1, stats: { hpMax: 10 } } as never],
    };
    const latest = { current: c };
    render(
      <Stateful initial={c} onState={track(latest)}>
        {(character, onChange) => <CombatPage character={character} onChange={onChange} />}
      </Stateful>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lose 1 HP: Gerta' }));
    expect(latest.current.hirelings?.[0].hp).toBe(9);
    expect(within(screen.getByTestId('ally-h1')).getByRole('link', { name: 'Open Gerta on Companions' })).toHaveAttribute(
      'href',
      '#companions/people/h1',
    );
  });
});

describe('Companions page deep link', () => {
  it('opens the card named in #companions/creatures/<id>', () => {
    window.location.hash = '#companions/creatures/p1';
    render(<CompanionsPage character={ranger()} onChange={vi.fn()} subTab="creatures" />);
    const card = screen.getByTestId('companion-p1');
    expect(card).toHaveAttribute('data-focused', 'true');
    expect(within(card).getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Adding a creature then following a deep link on the same tab', () => {
  it('lets a later deep link win over the just-added creature', () => {
    const initial = plainCharacter({ companions: [{ id: 'p1', creatureId: 'cat', origin: 'pet', nickname: 'Old' }] });
    const latest = { current: initial };
    function Harness() {
      const [focus, setFocus] = useState<string | null>(null);
      return (
        <RecordFocusContext.Provider value={focus}>
          <button type="button" onClick={() => setFocus('p1')}>
            follow link
          </button>
          <Stateful initial={initial} onState={track(latest)}>
            {(character, onChange) => <CreaturesTab character={character} onChange={onChange} undo={undoStub()} />}
          </Stateful>
        </RecordFocusContext.Provider>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Creature' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Add creature' })).getByRole('button', { name: 'Add creature' }));
    const added = latest.current.companions!.find((c) => c.id !== 'p1')!;
    expect(screen.getByTestId(`companion-${added.id}`)).toHaveAttribute('data-focused', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'follow link' }));
    expect(screen.getByTestId('companion-p1')).toHaveAttribute('data-focused', 'true');
    expect(screen.getByTestId(`companion-${added.id}`)).not.toHaveAttribute('data-focused', 'true');
  });
});

describe('Allies card without an HP maximum', () => {
  it('shows no HP readout or stepper for an ally whose maximum is not set', () => {
    const c: Character = {
      ...plainCharacter(),
      hirelings: [{ id: 'h1', name: 'Gerta', kind: 'skilled', units: 1 } as never],
    };
    render(<CombatPage character={c} onChange={vi.fn()} />);
    const row = screen.getByTestId('ally-h1');
    expect(row).not.toHaveTextContent(/HP \d/);
    expect(within(row).queryByRole('group', { name: 'Gerta hit point controls' })).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Lose 1 HP: Gerta' })).toBeNull();
  });
});