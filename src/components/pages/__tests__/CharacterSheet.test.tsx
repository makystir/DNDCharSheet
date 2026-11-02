import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CharacterSheet } from '../CharacterSheet';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

function renderSheet(overrides = {}) {
  const character = { ...createCharacter('Tester'), ...overrides };
  const onChange = vi.fn();
  render(<CharacterSheet character={character} onChange={onChange} />);
  return { character, onChange };
}

/**
 * Renders the sheet with real controlled-input state (props flow back in on
 * change), so a controlled field that is cleared to its unset value behaves as
 * it does in the app. A spy records every emitted character.
 */
function renderStatefulSheet(overrides = {}) {
  const onChange = vi.fn();
  function Harness() {
    const [character, setCharacter] = useState<Character>({
      ...createCharacter('Tester'),
      ...overrides,
    });
    return (
      <CharacterSheet
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

describe('CharacterSheet', () => {
  it('shows the derived modifier for a score of 10 as +0', () => {
    renderSheet();
    const strInput = screen.getByLabelText('Strength score') as HTMLInputElement;
    expect(strInput.value).toBe('10');
    // The modifier trigger for Strength exposes the breakdown via aria-label.
    const strMod = screen.getByRole('button', { name: /Strength Modifier/ });
    expect(strMod).toHaveTextContent('+0');
  });

  it('reflects a score change by emitting an updated character', () => {
    const { onChange } = renderSheet();
    const strInput = screen.getByLabelText('Strength score');
    fireEvent.change(strInput, { target: { value: '16' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: expect.objectContaining({ str: 16 }),
      }),
    );
  });

  it('shows Proficiency Bonus +2 at level 1 with a breakdown', () => {
    renderSheet({ level: 1 });
    const prof = screen.getByRole('button', { name: /Proficiency Bonus/ });
    expect(prof).toHaveTextContent('+2');
  });

  it('exposes the modifier breakdown formula in the accessible label', () => {
    renderSheet({ abilities: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
    const strMod = screen.getByRole('button', { name: /Strength Modifier/ });
    // Breakdown: "3 (Strength score 16) = 3"
    expect(strMod.getAttribute('aria-label')).toContain('Strength score 16');
  });

  it('clamps an out-of-range score to the legal maximum of 30', () => {
    const { onChange } = renderSheet();
    const dexInput = screen.getByLabelText('Dexterity score');
    fireEvent.change(dexInput, { target: { value: '99' } });
    const call = onChange.mock.calls.at(-1)?.[0];
    expect(call.abilities.dex).toBe(30);
  });

  it('renders all six ability cards', () => {
    renderSheet();
    for (const abbr of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
      expect(screen.getByText(abbr)).toBeInTheDocument();
    }
    // sanity: within the abilities section
    const section = screen.getByLabelText('Ability Scores', { selector: 'section' }) ?? document.body;
    expect(within(section).queryByText('STR')).not.toBeNull();
  });

  it('renders all six derived areas through CalculatedValue triggers', () => {
    renderSheet();
    // Each derived total is a CalculatedValue trigger (a button with its label).
    expect(screen.getByRole('button', { name: /Armor Class/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Initiative/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Passive Perception/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Hit Point Maximum/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Strength Save/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Acrobatics Check/ }),
    ).toBeInTheDocument();
  });

  it('shows base AC 12 for Dex 14 and no override', () => {
    renderSheet({ abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } });
    const ac = screen.getByRole('button', { name: /Armor Class/ });
    expect(ac).toHaveTextContent('12');
  });

  it('toggling a skill proficiency emits the updated skills map and changes the modifier', () => {
    const { onChange } = renderSheet({
      abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
    });
    // Stealth (Dex 14 → +2) starts at +2 untrained.
    const stealth = screen.getByRole('button', { name: /Stealth Check/ });
    expect(stealth).toHaveTextContent('+2');
    const checkbox = screen.getByLabelText('Stealth proficiency');
    fireEvent.click(checkbox);
    const call = onChange.mock.calls.at(-1)?.[0];
    expect(call.skills.stealth).toEqual(
      expect.objectContaining({ proficient: true }),
    );
  });

  it('reflects stored proficiency in the displayed skill modifier', () => {
    renderSheet({
      abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
      skills: { stealth: { proficient: true } },
    });
    // +2 Dex + 2 PB = +4 at level 1.
    const stealth = screen.getByRole('button', { name: /Stealth Check/ });
    expect(stealth).toHaveTextContent('+4');
  });

  it('toggling a save proficiency emits saveProficiencies', () => {
    const { onChange } = renderSheet();
    const checkbox = screen.getByLabelText('Dexterity save proficiency');
    fireEvent.click(checkbox);
    const call = onChange.mock.calls.at(-1)?.[0];
    expect(call.saveProficiencies.dex).toBe(true);
  });

  it('entering an AC override emits acOverride and clearing it unsets', () => {
    const { onChange } = renderStatefulSheet();
    const input = screen.getByLabelText('Armor Class override');
    fireEvent.change(input, { target: { value: '17' } });
    expect(onChange.mock.calls.at(-1)?.[0].acOverride).toBe(17);
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange.mock.calls.at(-1)?.[0].acOverride).toBeUndefined();
  });

  it('entering an HP max emits hpMax', () => {
    const { onChange } = renderSheet();
    const input = screen.getByLabelText('Hit Point maximum');
    fireEvent.change(input, { target: { value: '24' } });
    expect(onChange.mock.calls.at(-1)?.[0].hpMax).toBe(24);
  });

  it('disables the expertise checkbox until the skill is proficient', () => {
    renderSheet();
    const expertise = screen.getByLabelText('Stealth expertise') as HTMLInputElement;
    expect(expertise.disabled).toBe(true);
  });

  // Test 16: species selection and derived displays.
  describe('species', () => {
    it('shows sensible placeholders with no species selected', () => {
      renderSheet();
      expect(
        (screen.getByRole('combobox', { name: 'Species' }) as HTMLSelectElement)
          .value,
      ).toBe('');
      // Speed defaults to 30 ft; Darkvision renders "none".
      expect(screen.getByRole('button', { name: /Speed/ })).toHaveTextContent(
        '30 ft',
      );
      expect(
        screen.getByRole('button', { name: /Darkvision/ }),
      ).toHaveTextContent('none');
    });

    it('selecting a species emits a fresh species selection', () => {
      const { onChange } = renderSheet();
      fireEvent.change(screen.getByRole('combobox', { name: 'Species' }), {
        target: { value: 'dwarf' },
      });
      expect(onChange.mock.calls.at(-1)?.[0].species).toEqual({ id: 'dwarf' });
    });

    it('Wood Elf updates Speed to 35 and Drow updates Darkvision to 120', () => {
      renderSheet({ species: { id: 'elf', elvenLineage: 'woodElf' } });
      expect(screen.getByRole('button', { name: /Speed/ })).toHaveTextContent(
        '35 ft',
      );
      renderSheet({ species: { id: 'elf', elvenLineage: 'drow' } });
      expect(
        screen.getAllByRole('button', { name: /Darkvision/ }).at(-1),
      ).toHaveTextContent('120 ft');
    });

    it('shows the resolved size for a selected species', () => {
      renderSheet({ species: { id: 'dwarf' } });
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('renders sub-choice selects only for the selected species', () => {
      renderSheet({ species: { id: 'dwarf' } });
      // Dwarf has no sub-choices.
      expect(screen.queryByLabelText('Draconic Ancestry')).toBeNull();

      renderSheet({ species: { id: 'dragonborn' } });
      expect(
        screen.getAllByLabelText('Draconic Ancestry').at(-1),
      ).toBeInTheDocument();
    });

    it('renders species traits with names and effects, untruncated', () => {
      renderSheet({ species: { id: 'dwarf' } });
      expect(screen.getByText('Dwarven Toughness')).toBeInTheDocument();
      expect(screen.getByText(/Hit Point maximum increases/)).toBeInTheDocument();
    });

    it("surfaces Dwarven Toughness in the HP breakdown when hpMax is set", () => {
      renderSheet({ species: { id: 'dwarf' }, level: 3, hpMax: 30 });
      const hp = screen.getByRole('button', { name: /Hit Point Maximum/ });
      // The aria-label carries the full breakdown equation including Toughness.
      expect(hp.getAttribute('aria-label')).toMatch(/Dwarven Toughness/);
    });
  });
});
