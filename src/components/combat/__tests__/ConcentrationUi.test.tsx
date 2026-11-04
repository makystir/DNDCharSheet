import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { CombatPage } from '../../pages/CombatPage';
import { SpellsPage } from '../../pages/SpellsPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';
import { DICE_ENTRY_MODE_KEY } from '../../../hooks/useDiceEntryMode';
import { useConcentrationAutoEnd } from '../../../hooks/useConcentrationAutoEnd';
import { getSpell } from '../../../data/spells';

let latest: Character;
const notify = vi.fn();

function Harness({ initial }: { initial: Character }) {
  const [character, setCharacter] = useState<Character>(initial);
  return (
    <CombatPage
      character={character}
      onNotify={notify}
      onChange={(next) => {
        latest = next;
        setCharacter(next);
      }}
    />
  );
}

/** A level 3 Fighter (Con save proficient, Con 14) concentrating on Fog Cloud, HP max 100. */
function fighter(overrides: Partial<Character> = {}): Character {
  const base = createCharacter('Tester');
  return {
    ...base,
    level: 3,
    class: { id: 'fighter', level: 3 },
    abilities: { ...base.abilities, con: 14 },
    hpMax: 100,
    concentration: { spellId: 'fog-cloud' },
    ...overrides,
  };
}

function renderPage(overrides: Partial<Character> = {}) {
  const initial = fighter(overrides);
  latest = initial;
  render(<Harness initial={initial} />);
}

function hit(amount: string) {
  fireEvent.change(screen.getByLabelText('Damage amount'), { target: { value: amount } });
  fireEvent.click(screen.getByRole('button', { name: /^Apply \d+ damage$/ }));
}

/** Enter d20 results in the RollPrompt (manual mode) and apply. */
function rollSave(...faces: number[]) {
  const dialog = screen.getByRole('dialog', { name: 'Concentration Constitution Save' });
  if (faces.length === 2) {
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Advantage' }));
    fireEvent.change(within(dialog).getByLabelText('First d20 roll'), { target: { value: String(faces[0]) } });
    fireEvent.change(within(dialog).getByLabelText('Second d20 roll'), { target: { value: String(faces[1]) } });
  } else {
    fireEvent.change(within(dialog).getByLabelText('Your d20 roll'), { target: { value: String(faces[0]) } });
  }
  fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply result' }));
}

function openSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Enter Constitution save' }));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(DICE_ENTRY_MODE_KEY, 'manual');
  notify.mockClear();
});

afterEach(() => {
  localStorage.clear();
  document.body.style.overflow = '';
});

describe('Concentration readout', () => {
  it('names the spell, offers a rule tooltip and ends on request with a Toast and an announcement', () => {
    renderPage();
    expect(screen.getByTestId('concentration-chip')).toHaveTextContent('Fog Cloud');
    fireEvent.click(screen.getByRole('button', { name: 'Concentration' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/lose Concentration/);

    fireEvent.click(screen.getByRole('button', { name: 'End Concentration' }));
    expect('concentration' in latest).toBe(false);
    expect(screen.queryByTestId('concentration-chip')).toBeNull();
    expect(screen.getByTestId('concentration-status')).toHaveTextContent('Concentration on Fog Cloud ended.');
    expect(notify).toHaveBeenCalledWith('Concentration on Fog Cloud ended.');
  });

  it('shows nothing but the live region when not concentrating', () => {
    renderPage({ concentration: undefined });
    expect(screen.queryByTestId('concentration-chip')).toBeNull();
    expect(screen.getByTestId('concentration-status')).toBeInTheDocument();
  });
});

describe('Concentration check after damage', () => {
  it('prompts "Constitution save DC X" with the DC as a CalculatedValue', () => {
    renderPage();
    hit('30');
    const prompt = screen.getByTestId('concentration-prompt');
    expect(prompt).toHaveTextContent('Concentration check: Constitution save DC');
    const dc = within(prompt).getByRole('button', { name: /Concentration save DC/ });
    expect(dc).toHaveTextContent('15');
    const label = dc.getAttribute('aria-label') ?? '';
    expect(label).toContain('10 (Base DC)');
    expect(label).toContain('5 (Half the damage above 10');
    expect(label).toContain('0 (Cap at maximum DC 30)');
  });

  it('uses a minimum DC of 10 for small hits and caps at 30', () => {
    renderPage();
    hit('5');
    expect(within(screen.getByTestId('concentration-prompt')).getByRole('button', { name: /Concentration save DC/ })).toHaveTextContent('10');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    hit('70');
    expect(within(screen.getByTestId('concentration-prompt')).getByRole('button', { name: /Concentration save DC/ })).toHaveTextContent('30');
  });

  it('keeps Concentration on a success', () => {
    renderPage();
    hit('30');
    openSave();
    rollSave(20);
    expect(latest.concentration).toEqual({ spellId: 'fog-cloud' });
    expect(screen.queryByTestId('concentration-prompt')).toBeNull();
    expect(screen.getByTestId('damage-status')).toHaveTextContent(/Concentration on Fog Cloud kept/);
    expect(notify).not.toHaveBeenCalled();
  });

  it('ends Concentration on a failure with a Toast, and a natural 20 is not an automatic success', () => {
    renderPage();
    hit('60'); // DC 30; Con save +4 at best gives 24
    openSave();
    rollSave(20);
    expect('concentration' in latest).toBe(false);
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Concentration on Fog Cloud ended: Constitution save 24 against DC 30/));
    expect(screen.getByTestId('damage-status')).toHaveTextContent(/ended/);
  });

  it('a natural 1 is not an automatic failure either (no special effect on a save)', () => {
    renderPage({ abilities: { ...createCharacter('x').abilities, con: 30 } });
    hit('10'); // DC 10; Con 30 gives +10, plus proficiency +2: a 1 totals 13
    openSave();
    rollSave(1);
    expect(latest.concentration).toEqual({ spellId: 'fog-cloud' });
  });

  it('shows Exhaustion as its own line item in the save breakdown (D1) and it can sink the save', () => {
    renderPage({ exhaustionLevel: 2 });
    hit('30'); // DC 15
    openSave();
    const dialog = screen.getByRole('dialog', { name: 'Concentration Constitution Save' });
    fireEvent.change(within(dialog).getByLabelText('Your d20 roll'), { target: { value: '15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
    const total = within(dialog).getByTestId('roll-total').querySelector('button');
    const label = total?.getAttribute('aria-label') ?? '';
    expect(label).toContain('(Exhaustion -4)');
    expect(label).toContain('2 (Constitution mod)');
    expect(label).toContain('2 (Proficiency');
    // 15 + 4 (Con 2 + proficiency 2) - 4 = 15 meets DC 15.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply result' }));
    expect(latest.concentration).toEqual({ spellId: 'fog-cloud' });
  });

  it('lets the user choose Advantage or Disadvantage on the save (D7)', () => {
    renderPage();
    hit('30'); // DC 15
    openSave();
    rollSave(2, 20); // Advantage keeps 20
    expect(latest.concentration).toEqual({ spellId: 'fog-cloud' });
  });

  it('can be dismissed without rolling and keeps Concentration', () => {
    renderPage();
    hit('30');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('concentration-prompt')).toBeNull();
    expect(latest.concentration).toEqual({ spellId: 'fog-cloud' });
    expect(screen.getByTestId('damage-status')).toHaveTextContent(/dismissed/);
    // Focus returns to the damage input.
    expect(document.activeElement).toBe(screen.getByLabelText('Damage amount'));
  });

  it('closing the roll dialog with Cancel leaves the prompt up and returns focus to its trigger', () => {
    renderPage();
    hit('30');
    const trigger = screen.getByRole('button', { name: 'Enter Constitution save' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Concentration Constitution Save' })).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('concentration-prompt')).toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('D4: damage absorbed by Temp HP still forces a check unless the A5a toggle is on', () => {
    renderPage({ tempHp: 50 });
    hit('30');
    expect(screen.getByTestId('concentration-prompt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    fireEvent.click(screen.getByLabelText(/Treat damage absorbed by Temp HP as no damage/));
    hit('10'); // 20 Temp HP left, so this is fully absorbed
    expect(screen.queryByTestId('concentration-prompt')).toBeNull();
  });

  it('does not prompt when the hit drops the character to 0 HP (Concentration ends elsewhere)', () => {
    renderPage({ hpMax: 20 });
    hit('25');
    expect(screen.queryByTestId('concentration-prompt')).toBeNull();
  });

  it('does not prompt when not concentrating', () => {
    renderPage({ concentration: undefined });
    hit('30');
    expect(screen.queryByTestId('concentration-prompt')).toBeNull();
  });

  it('drops a pending prompt once Concentration is ended from the readout', () => {
    renderPage();
    hit('30');
    fireEvent.click(screen.getByRole('button', { name: 'End Concentration' }));
    expect(screen.queryByTestId('concentration-prompt')).toBeNull();
  });
});

describe('useConcentrationAutoEnd', () => {
  it('ends Concentration with a notification when the character is Incapacitated', () => {
    const onChange = vi.fn();
    const note = vi.fn();
    const c = fighter({ conditions: [{ id: 'incapacitated' }] });
    renderHook(() => useConcentrationAutoEnd(c, onChange, note));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect('concentration' in (onChange.mock.calls[0][0] as Character)).toBe(false);
    expect(note).toHaveBeenCalledWith('Concentration on Fog Cloud ended: the character is Incapacitated.');
  });

  it('ends Concentration at 0 Hit Points (derived Unconscious)', () => {
    const onChange = vi.fn();
    const note = vi.fn();
    renderHook(() => useConcentrationAutoEnd(fighter({ currentHp: 0 }), onChange, note));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(note).toHaveBeenCalledWith(expect.stringContaining('Incapacitated'));
  });

  it('reports a dead character', () => {
    const note = vi.fn();
    renderHook(() => useConcentrationAutoEnd(fighter({ exhaustionLevel: 6 }), vi.fn(), note));
    expect(note).toHaveBeenCalledWith('Concentration on Fog Cloud ended: the character is dead.');
  });

  it('does nothing for a healthy concentrating character or a missing one', () => {
    const onChange = vi.fn();
    const note = vi.fn();
    renderHook(() => useConcentrationAutoEnd(fighter(), onChange, note));
    renderHook(() => useConcentrationAutoEnd(undefined, onChange, note));
    expect(onChange).not.toHaveBeenCalled();
    expect(note).not.toHaveBeenCalled();
  });
});

describe('Spells tab Concentrating toggle', () => {
  const wizard: Partial<Character> = {
    level: 5,
    class: { id: 'wizard', level: 5 },
    spellcasting: {
      spellbook: ['fog-cloud', 'detect-magic', 'magic-missile'],
      prepared: ['fog-cloud', 'detect-magic', 'magic-missile'],
    },
  };

  function renderSpells(overrides: Partial<Character> = {}) {
    function SpellsHarness() {
      const [character, setCharacter] = useState<Character>({ ...createCharacter('Caster'), ...wizard, ...overrides });
      return (
        <SpellsPage
          character={character}
          onNotify={notify}
          onChange={(next) => {
            latest = next;
            setCharacter(next);
          }}
        />
      );
    }
    render(<SpellsHarness />);
    fireEvent.click(screen.getByRole('tab', { name: 'Prepared' }));
  }

  it('uses catalog spells that really require Concentration', () => {
    expect(getSpell('fog-cloud')?.concentration).toBe(true);
    expect(getSpell('detect-magic')?.concentration).toBe(true);
    expect(getSpell('magic-missile')?.concentration).toBe(false);
  });

  it('shows the toggle only on prepared spells that require Concentration', () => {
    renderSpells();
    expect(screen.getByRole('checkbox', { name: 'Concentrating on Fog Cloud' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Concentrating on Detect Magic' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Concentrating on Magic Missile' })).toBeNull();
  });

  it('starts Concentration and ends it again', () => {
    renderSpells();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Concentrating on Fog Cloud' }));
    expect(latest.concentration).toEqual({ spellId: 'fog-cloud' });
    expect(notify).toHaveBeenLastCalledWith('Now concentrating on Fog Cloud.');
    expect(screen.getByRole('checkbox', { name: 'Concentrating on Fog Cloud' })).toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Concentrating on Fog Cloud' }));
    expect('concentration' in latest).toBe(false);
    expect(notify).toHaveBeenLastCalledWith('Concentration on Fog Cloud ended.');
  });

  it('starting a second concentration spell ends the first, with a Toast', () => {
    renderSpells({ concentration: { spellId: 'fog-cloud' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Concentrating on Detect Magic' }));
    expect(latest.concentration).toEqual({ spellId: 'detect-magic' });
    expect(notify).toHaveBeenLastCalledWith(
      'Now concentrating on Detect Magic. Concentration on Fog Cloud ended.',
    );
    expect(screen.getByRole('checkbox', { name: 'Concentrating on Fog Cloud' })).not.toBeChecked();
  });
});
