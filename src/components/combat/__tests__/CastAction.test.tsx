import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SpellcastingQuickCard } from '../SpellcastingQuickCard';
import { createCharacter } from '../../../storage/character-store';
import type { Character } from '../../../types/character';
import { planCast } from '../../../logic/spell-slot-spend';

let latest: Character;
const notify = vi.fn();

function Harness({ initial }: { initial: Character }) {
  const [character, setCharacter] = useState(initial);
  return (
    <SpellcastingQuickCard
      character={character}
      onNotify={notify}
      onChange={(next) => {
        latest = next;
        setCharacter(next);
      }}
    />
  );
}

/** Level 3 Wizard: four level 1 and two level 2 slots (PHB 2024 Wizard Features). */
function wizard(overrides: Partial<Character> = {}): Character {
  const base = createCharacter('Caster');
  return {
    ...base,
    level: 3,
    classes: [{ id: 'wizard', level: 3 }],
    spellcasting: {
      byClass: {
        wizard: { cantrips: ['fire-bolt'], spellbook: ['magic-missile', 'fog-cloud'], prepared: ['magic-missile', 'fog-cloud'] },
      },
    },
    ...overrides,
  };
}

function setup(overrides: Partial<Character> = {}) {
  const initial = wizard(overrides);
  latest = initial;
  notify.mockClear();
  render(<Harness initial={initial} />);
}

describe('Cast action', () => {
  it('casting a cantrip spends no slot', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cast Fire Bolt' }));
    expect(latest.spellcasting?.slotsExpended?.[1] ?? 0).toBe(0);
    expect(latest.spellcasting?.slotsExpended?.[2] ?? 0).toBe(0);
    expect(screen.getByTestId('slots-Level 1')).toHaveTextContent('Level 1: 4/4');
  });

  it('spends a slot of the spell\'s own level first', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cast Magic Missile' }));
    expect(latest.spellcasting?.slotsExpended?.[1]).toBe(1);
    expect(latest.spellcasting?.slotsExpended?.[2] ?? 0).toBe(0);
    expect(notify).toHaveBeenCalledWith('Cast Magic Missile with a level 1 slot.');
  });

  it('escalates to the lowest higher slot only when the spell\'s own level is spent', () => {
    setup({ spellcasting: { ...wizard().spellcasting, slotsExpended: { 1: 4 } } });
    fireEvent.click(screen.getByRole('button', { name: 'Cast Magic Missile' }));
    expect(latest.spellcasting?.slotsExpended?.[1]).toBe(4);
    expect(latest.spellcasting?.slotsExpended?.[2]).toBe(1);
    expect(screen.getByTestId('slots-Level 2')).toHaveTextContent('Level 2: 1/2');
  });

  it('is disabled with a reason when no valid slot remains', () => {
    setup({ spellcasting: { ...wizard().spellcasting, slotsExpended: { 1: 4, 2: 2 } } });
    expect(screen.getByRole('button', { name: 'Cast Magic Missile' })).toBeDisabled();
    expect(screen.getAllByRole('note').some((n) => n.textContent === 'No 1st-level+ slots remaining')).toBe(true);
    // A cantrip is still castable.
    expect(screen.getByRole('button', { name: 'Cast Fire Bolt' })).toBeEnabled();
  });

  it('a concentration spell ends the previous Concentration through the shared logic', () => {
    setup({ concentration: { spellId: 'bless' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cast Fog Cloud' }));
    expect(latest.concentration?.spellId).toBe('fog-cloud');
    expect(latest.spellcasting?.slotsExpended?.[1]).toBe(1);
    expect(notify).toHaveBeenCalledWith(
      'Cast Fog Cloud with a level 1 slot. Now concentrating on Fog Cloud. Concentration on Bless ended.',
    );
  });

  it('a non-concentration spell leaves current Concentration alone', () => {
    setup({ concentration: { spellId: 'bless' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cast Magic Missile' }));
    expect(latest.concentration?.spellId).toBe('bless');
  });

  it('leaves the same state as tapping the matching pip by hand', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cast Magic Missile' }));
    const viaCast = latest;
    const castPips = screen.getByTestId('slots-Level 1').textContent;

    document.body.innerHTML = '';
    setup();
    fireEvent.click(within(screen.getByTestId('slots-Level 1')).getAllByRole('button', { name: 'Spend a Level 1 slot' })[0]!);
    expect(latest.spellcasting?.slotsExpended).toEqual(viaCast.spellcasting?.slotsExpended);
    expect(screen.getByTestId('slots-Level 1').textContent).toBe(castPips);
  });
});

describe('planCast', () => {
  it('treats level 0 as a cantrip', () => {
    expect(planCast(wizard(), 0)).toEqual({ kind: 'cantrip' });
  });
  it('picks the lowest available slot at or above the spell level', () => {
    expect(planCast(wizard(), 1)).toEqual({ kind: 'slot', source: 'spellcasting', level: 1 });
    expect(planCast(wizard(), 2)).toEqual({ kind: 'slot', source: 'spellcasting', level: 2 });
    expect(planCast(wizard(), 3)).toEqual({ kind: 'none', reason: 'No 3rd-level+ slots remaining' });
  });
});
