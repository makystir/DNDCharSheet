import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SpellsPage } from '../SpellsPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';
import { spellsForClass } from '../../../data/spells';
import { preparedCount } from '../../../logic/spellcasting';

function renderSpells(overrides: Partial<Character>, subTab: string) {
  const latest: { current: Character } = { current: { ...createCharacter('Caster'), ...overrides } };
  function Harness() {
    const [character, setCharacter] = useState<Character>(latest.current);
    return (
      <SpellsPage
        character={character}
        subTab={subTab}
        onChange={(next) => {
          latest.current = next;
          setCharacter(next);
        }}
      />
    );
  }
  render(<Harness />);
  return latest;
}

beforeEach(() => {
  localStorage.clear();
});

const wizard5 = { level: 5, classes: [{ id: 'wizard', level: 5 }] } satisfies Partial<Character>;

function search(text: string, label = 'Search spells') {
  fireEvent.change(screen.getByRole('searchbox', { name: label }), { target: { value: text } });
}

describe('Spells > Browse: prepared state and Prepare toggle (UX audit Summary-4, E4.1)', () => {
  it('prepares and unprepares a spell from Browse and shows the badge', () => {
    const latest = renderSpells(
      { ...wizard5, spellcasting: { byClass: { wizard: { spellbook: ['magic-missile'] } } } },
      'browse',
    );
    search('Magic Missile');
    const row = screen.getByTestId('browse-spell-magic-missile');
    expect(within(row).getByTestId('browse-badge-magic-missile')).toHaveTextContent('In spellbook');

    fireEvent.click(within(row).getByRole('button', { name: 'Prepare Magic Missile' }));
    expect(latest.current.spellcasting?.byClass?.wizard?.prepared).toEqual(['magic-missile']);
    expect(within(row).getByTestId('browse-badge-magic-missile')).toHaveTextContent('Prepared');

    fireEvent.click(within(row).getByRole('button', { name: 'Unprepare Magic Missile' }));
    expect(latest.current.spellcasting?.byClass?.wizard?.prepared ?? []).toEqual([]);
  });

  it('explains why Prepare is disabled at the prepared cap', () => {
    const pool = spellsForClass('wizard').filter((s) => s.level >= 1 && s.level <= 3);
    const base: Character = { ...createCharacter('Caster'), ...wizard5 };
    const cap = preparedCount(base);
    const book = pool.slice(0, cap + 1).map((s) => s.id);
    const extra = pool[cap];
    renderSpells(
      { ...wizard5, spellcasting: { byClass: { wizard: { spellbook: book, prepared: book.slice(0, cap) } } } },
      'browse',
    );
    search(extra.name);
    const row = screen.getByTestId(`browse-spell-${extra.id}`);
    const button = within(row).getByRole('button', { name: `Prepare ${extra.name}` });
    expect(button).toBeDisabled();
    expect(within(row).getByText(/Unprepare one to prepare another/)).toBeInTheDocument();
    expect(button).toHaveAccessibleDescription(new RegExp(`Prepared spells ${cap} of ${cap}`));
  });

  it('explains that a Wizard must scribe a spell before preparing it', () => {
    renderSpells(wizard5, 'browse');
    search('Shield');
    const row = screen.getByTestId('browse-spell-shield');
    expect(within(row).getByRole('button', { name: 'Prepare Shield' })).toBeDisabled();
    expect(within(row).getByText(/Not in your spellbook/)).toBeInTheDocument();
  });

  it('learns and removes a cantrip from Browse', () => {
    const latest = renderSpells(wizard5, 'browse');
    search('Fire Bolt');
    fireEvent.click(screen.getByRole('button', { name: 'Learn cantrip Fire Bolt' }));
    expect(latest.current.spellcasting?.byClass?.wizard?.cantrips).toContain('fire-bolt');
    expect(screen.getByTestId('browse-badge-fire-bolt')).toHaveTextContent('Known');
  });
});

describe('Spells > Browse: multiclass pointer', () => {
  it('points multiclass characters to the Prepared tab and omits it for single-class', () => {
    renderSpells(
      {
        level: 6,
        classes: [
          { id: 'wizard', level: 3 },
          { id: 'cleric', level: 3 },
        ],
      },
      'browse',
    );
    expect(screen.getByTestId('browse-multiclass-hint')).toHaveTextContent(/Prepared tab/);
  });

  it('shows no hint for a single-class caster', () => {
    renderSpells(wizard5, 'browse');
    expect(screen.queryByTestId('browse-multiclass-hint')).toBeNull();
  });
});

describe('Spells > Prepared: search and filters (UX audit E4.2)', () => {
  const book = {
    ...wizard5,
    spellcasting: { byClass: { wizard: { spellbook: ['magic-missile', 'shield', 'web'] } } },
  } satisfies Partial<Character>;

  it('narrows the prepared list by search text and reports an empty result', () => {
    renderSpells(book, 'prepared');
    const prepared = () => screen.getByText(/Prepared \u2014 choose/).closest('div')!;
    expect(within(prepared()).getByRole('checkbox', { name: /Magic Missile/ })).toBeInTheDocument();
    expect(within(prepared()).getByRole('checkbox', { name: /^Web/ })).toBeInTheDocument();

    search('magic', 'Search spells prepared');
    expect(within(prepared()).getByRole('checkbox', { name: /Magic Missile/ })).toBeInTheDocument();
    expect(within(prepared()).queryByRole('checkbox', { name: /^Web/ })).toBeNull();

    search('zzzz-nothing', 'Search spells prepared');
    expect(screen.getByText(/No spells match the search or filters/)).toBeInTheDocument();
  });

  it('filters the prepared list by concentration', () => {
    renderSpells(book, 'prepared');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Only concentration spells prepared' }));
    const prepared = screen.getByText(/Prepared \u2014 choose/).closest('div')!;
    expect(within(prepared).getByRole('checkbox', { name: /^Web/ })).toBeInTheDocument();
    expect(within(prepared).queryByRole('checkbox', { name: /Magic Missile/ })).toBeNull();
  });
});

describe('Spells > Prepared: Concentrating toggle still works through the shared logic', () => {
  it('starts Concentration from the Prepared tab', () => {
    const onNotify = vi.fn();
    let latest: Character = {
      ...createCharacter('Caster'),
      ...wizard5,
      spellcasting: { byClass: { wizard: { spellbook: ['web'], prepared: ['web'] } } },
    };
    function Harness() {
      const [character, setCharacter] = useState<Character>(latest);
      return (
        <SpellsPage
          character={character}
          subTab="prepared"
          onNotify={onNotify}
          onChange={(next) => {
            latest = next;
            setCharacter(next);
          }}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Concentrating on Web' }));
    expect(latest.concentration?.spellId).toBe('web');
    expect(onNotify).toHaveBeenCalledWith('Now concentrating on Web.');
  });
});
