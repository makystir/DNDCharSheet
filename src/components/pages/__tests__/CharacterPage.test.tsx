import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { CharacterPage } from '../CharacterPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

type SubTab = 'overview' | 'skills' | 'species' | 'class';

function renderPage(overrides = {}, subTab: SubTab = 'overview') {
  const character = { ...createCharacter('Tester'), ...overrides };
  const onChange = vi.fn();
  render(<CharacterPage character={character} onChange={onChange} subTab={subTab} />);
  return { character, onChange };
}

/**
 * Renders the page with real controlled-input state (props flow back in on
 * change), so a controlled field cleared to its unset value behaves as it does
 * in the app. A spy records every emitted character.
 */
function renderStatefulPage(overrides = {}, subTab: SubTab = 'overview') {
  const onChange = vi.fn();
  function Harness() {
    const [character, setCharacter] = useState<Character>({
      ...createCharacter('Tester'),
      ...overrides,
    });
    return (
      <CharacterPage
        character={character}
        subTab={subTab}
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

beforeEach(() => {
  // Keep the sub-tab resolve chain deterministic across tests.
  localStorage.clear();
});

describe('CharacterPage', () => {
  it('shows the derived modifier for a score of 10 as +0', () => {
    renderPage();
    const strInput = screen.getByLabelText('Strength score') as HTMLInputElement;
    expect(strInput.value).toBe('10');
    const strMod = screen.getByRole('button', { name: /Strength Modifier/ });
    expect(strMod).toHaveTextContent('+0');
  });

  it('reflects a score change by emitting an updated character', () => {
    const { onChange } = renderPage();
    const strInput = screen.getByLabelText('Strength score');
    fireEvent.change(strInput, { target: { value: '16' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: expect.objectContaining({ str: 16 }),
      }),
    );
  });

  it('shows Proficiency Bonus +2 at level 1 with a breakdown', () => {
    renderPage({ level: 1 });
    const prof = screen.getByRole('button', { name: /Proficiency Bonus/ });
    expect(prof).toHaveTextContent('+2');
  });

  it('exposes the modifier breakdown formula in the accessible label', () => {
    renderPage({ abilities: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
    const strMod = screen.getByRole('button', { name: /Strength Modifier/ });
    expect(strMod.getAttribute('aria-label')).toContain('Strength score 16');
  });

  it('clamps an out-of-range score to the legal maximum of 30', () => {
    const { onChange } = renderPage();
    const dexInput = screen.getByLabelText('Dexterity score');
    fireEvent.change(dexInput, { target: { value: '99' } });
    const call = onChange.mock.calls.at(-1)?.[0];
    expect(call.abilities.dex).toBe(30);
  });

  it('renders all six ability cards', () => {
    renderPage();
    for (const abbr of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
      expect(screen.getByText(abbr)).toBeInTheDocument();
    }
  });

  it('toggling a skill proficiency emits the updated skills map and changes the modifier', () => {
    const { onChange } = renderPage(
      {
        abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
      },
      'skills',
    );
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
    renderPage(
      {
        abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
        skills: { stealth: { proficient: true } },
      },
      'skills',
    );
    const stealth = screen.getByRole('button', { name: /Stealth Check/ });
    expect(stealth).toHaveTextContent('+4');
  });

  it('toggling a save proficiency emits saveProficiencies', () => {
    const { onChange } = renderPage({}, 'skills');
    const checkbox = screen.getByLabelText('Dexterity save proficiency');
    fireEvent.click(checkbox);
    const call = onChange.mock.calls.at(-1)?.[0];
    expect(call.saveProficiencies.dex).toBe(true);
  });

  it('disables the expertise checkbox until the skill is proficient', () => {
    renderPage({}, 'skills');
    const expertise = screen.getByLabelText('Stealth expertise') as HTMLInputElement;
    expect(expertise.disabled).toBe(true);
  });

  describe('name (EditableField)', () => {
    it('edits and commits the character name via click → type → blur', () => {
      const { onChange } = renderStatefulPage({ name: 'Old Name' });
      // Tap-to-edit: the display shows the current name and acts as a button.
      const display = screen.getByRole('button', { name: 'Character name' });
      expect(display).toHaveTextContent('Old Name');
      fireEvent.click(display);
      const input = screen.getByRole('textbox', { name: 'Character name' });
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.blur(input);
      expect(onChange.mock.calls.at(-1)?.[0].name).toBe('New Name');
    });

    it('commits an empty name to the empty string', () => {
      const { onChange } = renderStatefulPage({ name: 'Old Name' });
      fireEvent.click(screen.getByRole('button', { name: 'Character name' }));
      const input = screen.getByRole('textbox', { name: 'Character name' });
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange.mock.calls.at(-1)?.[0].name).toBe('');
    });
  });

  describe('species', () => {
    it('shows sensible placeholders with no species selected', () => {
      renderPage({}, 'species');
      expect(
        (screen.getByRole('combobox', { name: 'Species' }) as HTMLSelectElement).value,
      ).toBe('');
      expect(screen.getByRole('button', { name: /Speed/ })).toHaveTextContent('30 ft');
      expect(screen.getByRole('button', { name: /Darkvision/ })).toHaveTextContent(
        'none',
      );
    });

    it('selecting a species emits a fresh species selection', () => {
      const { onChange } = renderPage({}, 'species');
      fireEvent.change(screen.getByRole('combobox', { name: 'Species' }), {
        target: { value: 'dwarf' },
      });
      expect(onChange.mock.calls.at(-1)?.[0].species).toEqual({ id: 'dwarf' });
    });

    it('Wood Elf updates Speed to 35 and Drow updates Darkvision to 120', () => {
      renderPage({ species: { id: 'elf', elvenLineage: 'woodElf' } }, 'species');
      expect(screen.getByRole('button', { name: /Speed/ })).toHaveTextContent('35 ft');
      renderPage({ species: { id: 'elf', elvenLineage: 'drow' } }, 'species');
      expect(
        screen.getAllByRole('button', { name: /Darkvision/ }).at(-1),
      ).toHaveTextContent('120 ft');
    });

    it('shows the resolved size for a selected species', () => {
      renderPage({ species: { id: 'dwarf' } }, 'species');
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('renders sub-choice selects only for the selected species', () => {
      renderPage({ species: { id: 'dwarf' } }, 'species');
      expect(screen.queryByLabelText('Draconic Ancestry')).toBeNull();

      renderPage({ species: { id: 'dragonborn' } }, 'species');
      expect(screen.getAllByLabelText('Draconic Ancestry').at(-1)).toBeInTheDocument();
    });

    it('renders species traits with names and effects, untruncated', () => {
      renderPage({ species: { id: 'dwarf' } }, 'species');
      expect(screen.getByText('Dwarven Toughness')).toBeInTheDocument();
      expect(screen.getByText(/Hit Point maximum increases/)).toBeInTheDocument();
    });
  });

  describe('class', () => {
    it('shows a placeholder and no Hit Die with no class selected', () => {
      renderPage({}, 'class');
      expect(
        (screen.getByRole('combobox', { name: 'Class' }) as HTMLSelectElement).value,
      ).toBe('');
      expect(screen.getByText(/No class selected/)).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: 'Subclass' })).toBeNull();
    });

    it('selecting a class emits a fresh class selection', () => {
      const { onChange } = renderPage({ level: 1 }, 'class');
      fireEvent.change(screen.getByRole('combobox', { name: 'Class' }), {
        target: { value: 'wizard' },
      });
      expect(onChange.mock.calls.at(-1)?.[0].class).toEqual({
        id: 'wizard',
        level: 1,
      });
    });

    it('surfaces the class Hit Die', () => {
      renderPage(
        {
          level: 3,
          abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
          class: { id: 'wizard', level: 3 },
        },
        'class',
      );
      expect(screen.getByText('d6')).toBeInTheDocument();
    });

    it('gates the subclass control on the class subclassLevel', () => {
      renderPage({ level: 2, class: { id: 'wizard', level: 2 } }, 'class');
      expect(screen.queryByRole('combobox', { name: 'Subclass' })).toBeNull();

      renderPage({ level: 3, class: { id: 'wizard', level: 3 } }, 'class');
      expect(
        screen.getAllByRole('combobox', { name: 'Subclass' }).at(-1),
      ).toBeInTheDocument();
    });

    it('renders features grouped by level without truncation', () => {
      renderPage({ level: 20, class: { id: 'wizard', level: 20 } }, 'class');
      const features = screen.getByLabelText('Class Features');
      expect(within(features).getByText('Level 1')).toBeInTheDocument();
      expect(within(features).getByText('Spellcasting')).toBeInTheDocument();
      expect(within(features).getByText('Signature Spells')).toBeInTheDocument();
      expect(
        within(features).getAllByText(/take ASI or feat/).length,
      ).toBeGreaterThan(0);
    });

    it('names the class as the source in save and skill tooltips', () => {
      renderPage(
        {
          class: { id: 'wizard', level: 1, skillChoices: ['arcana'] },
        },
        'skills',
      );
      const intSave = screen.getByRole('button', { name: /Intelligence Save/ });
      expect(intSave.getAttribute('aria-label')).toContain('Wizard (class)');
      const arcana = screen.getByRole('button', { name: /Arcana Check/ });
      expect(arcana.getAttribute('aria-label')).toContain('Wizard (class)');
    });

    it('toggling a class skill choice emits the skillChoices list', () => {
      const { onChange } = renderPage({ class: { id: 'wizard', level: 1 } }, 'class');
      fireEvent.click(screen.getByLabelText('Arcana class proficiency'));
      expect(onChange.mock.calls.at(-1)?.[0].class.skillChoices).toEqual(['arcana']);
    });
  });

  describe('sub-tabs', () => {
    it('renders the SubTabBar with the four default tabs', () => {
      renderPage();
      const tablist = screen.getByRole('tablist');
      const tabs = within(tablist).getAllByRole('tab');
      expect(tabs.map((t) => t.textContent)).toEqual([
        'Overview',
        'Skills & Saves',
        'Species',
        'Class & Features',
      ]);
    });

    it('defaults to overview (header + Ability Scores, no other sections)', () => {
      renderPage();
      expect(screen.getByText('Ability Scores')).toBeInTheDocument();
      // Species / Class / Saving Throws / Skills section headings are gated away.
      expect(screen.queryByRole('combobox', { name: 'Species' })).toBeNull();
      expect(screen.queryByRole('combobox', { name: 'Class' })).toBeNull();
      expect(screen.queryByLabelText('Dexterity save proficiency')).toBeNull();
    });

    it('deep-links to #character/skills land on the skills sub-tab', () => {
      renderPage({}, 'skills');
      expect(screen.getByLabelText('Dexterity save proficiency')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Stealth Check/ })).toBeInTheDocument();
      // Overview-only content is gated away.
      expect(screen.queryByText('Ability Scores')).toBeNull();
    });

    it('deep-links to #character/species land on the species sub-tab', () => {
      renderPage({}, 'species');
      expect(screen.getByRole('combobox', { name: 'Species' })).toBeInTheDocument();
    });

    it('deep-links to #character/class land on the class sub-tab', () => {
      renderPage({}, 'class');
      expect(screen.getByRole('combobox', { name: 'Class' })).toBeInTheDocument();
    });

    it('an unknown sub-tab falls back to overview (no stored last-used)', () => {
      localStorage.removeItem('lastSubTab:character');
      renderPage({}, 'bogus' as unknown as SubTab);
      expect(screen.getByText('Ability Scores')).toBeInTheDocument();
    });

    it('selecting a sub-tab persists last-used and calls onSubTabChange', () => {
      const onChange = vi.fn();
      const onSubTabChange = vi.fn();
      render(
        <CharacterPage
          character={createCharacter('Tester')}
          onChange={onChange}
          subTab={null}
          onSubTabChange={onSubTabChange}
        />,
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Species' }));
      expect(onSubTabChange).toHaveBeenCalledWith('species');
      expect(localStorage.getItem('lastSubTab:character')).toBe('species');
      expect(screen.getByRole('combobox', { name: 'Species' })).toBeInTheDocument();
    });

    it('a bare #character (null sub-tab) resolves to stored last-used when present', () => {
      localStorage.setItem('lastSubTab:character', 'class');
      render(
        <CharacterPage
          character={createCharacter('Tester')}
          onChange={vi.fn()}
          subTab={null}
        />,
      );
      // resolveInitialTab: no valid hash sub-tab → last-used 'class'.
      expect(screen.getByRole('combobox', { name: 'Class' })).toBeInTheDocument();
    });

    it('every CalculatedValue trigger renders in its sub-tab home', () => {
      // Overview: Proficiency Bonus + ability modifiers.
      renderPage({ level: 3 }, 'overview');
      expect(screen.getByRole('button', { name: /Proficiency Bonus/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Strength Modifier/ })).toBeInTheDocument();

      cleanup();
      // Skills: saves + skill checks.
      renderPage({ level: 3 }, 'skills');
      expect(screen.getByRole('button', { name: /Dexterity Save/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Stealth Check/ })).toBeInTheDocument();

      cleanup();
      // Species: Speed + Darkvision.
      renderPage({ level: 3 }, 'species');
      expect(screen.getByRole('button', { name: /Speed/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Darkvision/ })).toBeInTheDocument();
    });
  });
});
