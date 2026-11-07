import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { CharacterPage } from '../CharacterPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

// P3 (Option B): the Character page now has THREE sub-tabs. `SubTab` accepts a
// legacy id too, so the migration/alias tests can deep-link an OLD id.
type SubTab = 'identity' | 'abilities' | 'build' | 'overview' | 'skills' | 'species' | 'class';

function renderPage(overrides = {}, subTab: SubTab = 'identity') {
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
function renderStatefulPage(overrides = {}, subTab: SubTab = 'identity') {
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
    renderPage({}, 'abilities');
    const strInput = screen.getByLabelText('Strength score') as HTMLInputElement;
    expect(strInput.value).toBe('10');
    const strMod = screen.getByRole('button', { name: /Strength Modifier/ });
    expect(strMod).toHaveTextContent('+0');
  });

  it('reflects a score change by emitting an updated character', () => {
    const { onChange } = renderPage({}, 'abilities');
    const strInput = screen.getByLabelText('Strength score');
    fireEvent.change(strInput, { target: { value: '16' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: expect.objectContaining({ str: 16 }),
      }),
    );
  });

  it('shows Proficiency Bonus +2 at level 1 with a breakdown (Overview vitals)', () => {
    renderPage({ level: 1 });
    const prof = screen.getByRole('button', { name: /Proficiency Bonus/ });
    expect(prof).toHaveTextContent('+2');
  });

  it('exposes the modifier breakdown formula in the accessible label', () => {
    renderPage({ abilities: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }, 'abilities');
    const strMod = screen.getByRole('button', { name: /Strength Modifier/ });
    expect(strMod.getAttribute('aria-label')).toContain('Strength score 16');
  });

  it('clamps an out-of-range score to the legal maximum of 30', () => {
    const { onChange } = renderPage({}, 'abilities');
    const dexInput = screen.getByLabelText('Dexterity score');
    fireEvent.change(dexInput, { target: { value: '99' } });
    const call = onChange.mock.calls.at(-1)?.[0];
    expect(call.abilities.dex).toBe(30);
  });

  it('renders all six ability cards', () => {
    renderPage({}, 'abilities');
    for (const abbr of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
      expect(screen.getByText(abbr)).toBeInTheDocument();
    }
  });

  it('shows the EFFECTIVE score (base + feat) and a Base + feat-source breakdown (A6b)', () => {
    // A character with a feat granting +2 Strength. The base stays 10; the
    // EFFECTIVE Strength is 12 and drives the +1 modifier.
    renderPage({
      level: 4,
      classes: [{ id: 'fighter', level: 4 }],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      advancement: {
        feats: [{ featId: 'ability-score-improvement', level: 4, abilityIncreases: { str: 2 } }],
      },
    }, 'abilities');
    // The base-score EDITOR still shows the creation value (10). Its accessible
    // name folds in the visible "Base" label when a feat has raised the score
    // (WCAG 2.5.3 Label in Name), so it reads "Strength base score" here.
    expect((screen.getByLabelText('Strength base score') as HTMLInputElement).value).toBe('10');
    // The modifier reflects the EFFECTIVE score (12 → +1).
    const strMod = screen.getByRole('button', { name: /Strength Modifier/ });
    expect(strMod).toHaveTextContent('+1');
    // The effective-score value shows a Base + feat breakdown in its label.
    const strScore = screen.getByRole('button', { name: /Strength Score/ });
    expect(strScore).toHaveTextContent('12');
    const label = strScore.getAttribute('aria-label') ?? '';
    expect(label).toContain('Base');
    expect(label).toContain('Ability Score Improvement');
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

  describe('personal details (identity)', () => {
    it('renders the Personal Details section with the portrait on identity', () => {
      renderPage();
      expect(
        screen.getByRole('heading', { name: 'Personal Details' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Alignment' })).toBeInTheDocument();
      expect(screen.getByLabelText('Personality')).toBeInTheDocument();
      expect(screen.getByText('No portrait set')).toBeInTheDocument();
    });

    it('shows the read-only Level and Proficiency Bonus in the Overview vitals strip', () => {
      renderPage({ level: 3 });
      expect(screen.getByTestId('vital-level')).toHaveTextContent('3');
      expect(screen.getByRole('button', { name: /Proficiency Bonus/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Level up on Advancement' })).toBeInTheDocument();
    });

    it('puts Personal Details (with portrait) above Species and the vitals strip', () => {
      renderPage({ level: 3 });
      const details = screen.getByRole('heading', { name: 'Personal Details' });
      const species = screen.getByRole('combobox', { name: 'Species' });
      const vitals = screen.getByRole('group', { name: 'Vitals' });
      expect(details.compareDocumentPosition(species) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(species.compareDocumentPosition(vitals) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // Species is no longer behind a collapse and no longer on Class & Features.
      expect(species).toBeVisible();
    });

    it('Ability Scores is NOT on identity (it moved to Abilities & Skills)', () => {
      renderPage();
      expect(screen.queryByText('Ability Scores')).toBeNull();
    });

    it('has exactly one Character name control on identity (consolidated)', () => {
      renderPage();
      expect(screen.getAllByRole('button', { name: 'Character name' })).toHaveLength(1);
    });

    it('editing the consolidated name field updates character.name', () => {
      const { onChange } = renderStatefulPage({ name: 'Old Name' });
      fireEvent.click(screen.getByRole('button', { name: 'Character name' }));
      const input = screen.getByRole('textbox', { name: 'Character name' });
      fireEvent.change(input, { target: { value: 'Renamed' } });
      fireEvent.blur(input);
      expect(onChange.mock.calls.at(-1)?.[0].name).toBe('Renamed');
    });
  });

  describe('species', () => {
    it('shows sensible placeholders with no species selected', () => {
      renderPage({}, 'identity');
      expect(
        (screen.getByRole('combobox', { name: 'Species' }) as HTMLSelectElement).value,
      ).toBe('');
      // Speed/Darkvision are derived tiles in the Overview vitals strip (not the species card).
      expect(screen.getByRole('button', { name: /Speed/ })).toHaveTextContent('30 ft');
      expect(screen.getByRole('button', { name: /Darkvision/ })).toHaveTextContent(
        'None',
      );
    });

    it('selecting a species emits a fresh species selection', () => {
      const { onChange } = renderPage({}, 'identity');
      fireEvent.change(screen.getByRole('combobox', { name: 'Species' }), {
        target: { value: 'dwarf' },
      });
      expect(onChange.mock.calls.at(-1)?.[0].species).toEqual({ id: 'dwarf' });
    });

    it('Wood Elf updates Speed to 35 and Drow updates Darkvision to 120', () => {
      renderPage({ species: { id: 'elf', elvenLineage: 'woodElf' } }, 'identity');
      expect(screen.getByRole('button', { name: /Speed/ })).toHaveTextContent('35 ft');
      renderPage({ species: { id: 'elf', elvenLineage: 'drow' } }, 'identity');
      expect(
        screen.getAllByRole('button', { name: /Darkvision/ }).at(-1),
      ).toHaveTextContent('120 ft');
    });

    it('shows the resolved size for a selected species', () => {
      renderPage({ species: { id: 'dwarf' } }, 'identity');
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('renders sub-choice selects only for the selected species', () => {
      renderPage({ species: { id: 'dwarf' } }, 'identity');
      expect(screen.queryByLabelText('Draconic Ancestry')).toBeNull();

      renderPage({ species: { id: 'dragonborn' } }, 'identity');
      expect(screen.getAllByLabelText('Draconic Ancestry').at(-1)).toBeInTheDocument();
    });

    it('renders species traits with names and effects, untruncated', () => {
      renderPage({ species: { id: 'dwarf' } }, 'identity');
      // Shown in the Species section and mirrored in the Overview Traits card.
      expect(screen.getAllByText('Dwarven Toughness').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Hit Point maximum increases/).length).toBeGreaterThan(0);
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
      expect(onChange.mock.calls.at(-1)?.[0].classes).toEqual([{
        id: 'wizard',
        level: 1,
      }]);
    });

    it('surfaces the class Hit Die', () => {
      renderPage(
        {
          level: 3,
          abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
          classes: [{ id: 'wizard', level: 3 }],
        },
        'class',
      );
      expect(screen.getByText('d6')).toBeInTheDocument();
    });

    it('gates the subclass control on the class subclassLevel', () => {
      renderPage({ level: 2, classes: [{ id: 'wizard', level: 2 }] }, 'class');
      expect(screen.queryByRole('combobox', { name: 'Subclass' })).toBeNull();

      renderPage({ level: 3, classes: [{ id: 'wizard', level: 3 }] }, 'class');
      expect(
        screen.getAllByRole('combobox', { name: 'Subclass' }).at(-1),
      ).toBeInTheDocument();
    });

    it('renders features grouped by level without truncation', () => {
      renderPage({ level: 20, classes: [{ id: 'wizard', level: 20 }] }, 'class');
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
          classes: [{ id: 'wizard', level: 1, skillChoices: ['arcana'] }],
        },
        'skills',
      );
      const intSave = screen.getByRole('button', { name: /Intelligence Save/ });
      expect(intSave.getAttribute('aria-label')).toContain('Wizard (class)');
      const arcana = screen.getByRole('button', { name: /Arcana Check/ });
      expect(arcana.getAttribute('aria-label')).toContain('Wizard (class)');
    });

    it('shows class-granted saves ticked, locked and labelled; manual extras stay editable', () => {
      const { onChange } = renderPage(
        { classes: [{ id: 'wizard', level: 1 }], saveProficiencies: { str: true } },
        'skills',
      );
      const intTick = screen.getByLabelText('Intelligence save proficiency');
      expect(intTick).toBeChecked();
      expect(intTick).toBeDisabled();
      expect(screen.getAllByText('from Wizard (class)')).toHaveLength(2);
      // Dex is neither class-granted nor ticked: editable and unchecked.
      const dexTick = screen.getByLabelText('Dexterity save proficiency');
      expect(dexTick).not.toBeChecked();
      expect(dexTick).toBeEnabled();
      // A manual tick (feat) stays editable and is not labelled as class-granted.
      const strTick = screen.getByLabelText('Strength save proficiency');
      expect(strTick).toBeChecked();
      expect(strTick).toBeEnabled();
      fireEvent.click(strTick);
      expect(onChange.mock.calls.at(-1)?.[0].saveProficiencies.str).toBe(false);
    });
    it('toggling a class skill choice emits the skillChoices list', () => {
      const { onChange } = renderPage({ classes: [{ id: 'wizard', level: 1 }] }, 'class');
      fireEvent.click(screen.getByLabelText('Arcana class proficiency'));
      expect(onChange.mock.calls.at(-1)?.[0].classes[0].skillChoices).toEqual(['arcana']);
    });

    // Stage M5: multiclass display — one feature section per class.
    it('renders ONE class feature section for a single-class character', () => {
      renderPage({ level: 5, classes: [{ id: 'fighter', level: 5 }] }, 'class');
      // Single-class uses the untagged "Class Features" region; no per-class
      // "<Class> Features" sections are rendered.
      expect(screen.getByLabelText('Class Features')).toBeInTheDocument();
      expect(screen.queryByLabelText('Fighter Features')).toBeNull();
      expect(screen.queryByLabelText('Wizard Features')).toBeNull();
    });

    it('renders a feature section per class for a Fighter/Wizard multiclass', () => {
      renderPage(
        {
          level: 5,
          classes: [
            { id: 'fighter', level: 3 },
            { id: 'wizard', level: 2 },
          ],
        },
        'class',
      );
      // Two per-class sections, each headed "<Class> <level>".
      const fighter = screen.getByLabelText('Fighter Features');
      const wizard = screen.getByLabelText('Wizard Features');
      expect(within(fighter).getByText('Fighter 3')).toBeInTheDocument();
      expect(within(wizard).getByText('Wizard 2')).toBeInTheDocument();
      // The single-class untagged region is NOT rendered for a multiclass.
      expect(screen.queryByLabelText('Class Features')).toBeNull();
    });
  });

  describe('sub-tabs', () => {
    it('renders the SubTabBar with the three default tabs', () => {
      renderPage();
      const tablist = screen.getByRole('tablist');
      const tabs = within(tablist).getAllByRole('tab');
      expect(tabs.map((t) => t.textContent)).toEqual([
        'Overview',
        'Abilities & Skills',
        'Class & Features',
      ]);
    });

    it('defaults to the Overview (Personal Details + Species + vitals, no other sections)', () => {
      renderPage();
      expect(screen.getByRole('heading', { name: 'Personal Details' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Proficiency Bonus/ })).toBeInTheDocument();
      // Ability Scores / Species / Class / Saving Throws are gated to other tabs.
      expect(screen.queryByText('Ability Scores')).toBeNull();
      expect(screen.getByRole('combobox', { name: 'Species' })).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: 'Class' })).toBeNull();
      expect(screen.queryByLabelText('Dexterity save proficiency')).toBeNull();
    });

    it('Abilities & Skills shows scores WITH the saves and skills derived from them', () => {
      renderPage({}, 'abilities');
      // Ability Scores sit together with Saving Throws and Skills (the P3 win).
      expect(screen.getByText('Ability Scores')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Strength Modifier/ })).toBeInTheDocument();
      expect(screen.getByLabelText('Dexterity save proficiency')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Stealth Check/ })).toBeInTheDocument();
    });

    it('Class & Features holds the class editor and NOT the species editor', () => {
      renderPage({}, 'build');
      expect(screen.queryByRole('combobox', { name: 'Species' })).toBeNull();
      expect(screen.getByRole('combobox', { name: 'Class' })).toBeInTheDocument();
    });

    it('deep-links to #character/abilities land on the Abilities & Skills sub-tab', () => {
      renderPage({}, 'abilities');
      expect(screen.getByLabelText('Dexterity save proficiency')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Stealth Check/ })).toBeInTheDocument();
    });

    it('deep-links to #character/build land on the Class & Features sub-tab', () => {
      renderPage({}, 'build');
      expect(screen.getByRole('combobox', { name: 'Class' })).toBeInTheDocument();
    });

    // ── P3 migration: legacy (old four-tab) ids must not break. ──
    it('legacy deep link #character/overview aliases to Identity', () => {
      renderPage({}, 'overview');
      expect(screen.getByRole('heading', { name: 'Personal Details' })).toBeInTheDocument();
      expect(screen.queryByText('Ability Scores')).toBeNull();
    });

    it('legacy deep link #character/skills aliases to Abilities & Skills', () => {
      renderPage({}, 'skills');
      expect(screen.getByLabelText('Dexterity save proficiency')).toBeInTheDocument();
      expect(screen.getByText('Ability Scores')).toBeInTheDocument();
    });

    it('legacy deep link #character/species aliases to Class & Features (id build); #character/class too', () => {
      renderPage({}, 'species');
      expect(screen.getByRole('combobox', { name: 'Class' })).toBeInTheDocument();
      cleanup();
      renderPage({}, 'class');
      expect(screen.getByRole('combobox', { name: 'Class' })).toBeInTheDocument();
    });

    it('a stored legacy lastSubTab (overview) resolves to Identity, not a blank page', () => {
      localStorage.setItem('lastSubTab:character', 'overview');
      render(
        <CharacterPage character={createCharacter('Tester')} onChange={vi.fn()} subTab={null} />,
      );
      expect(screen.getByRole('heading', { name: 'Personal Details' })).toBeInTheDocument();
    });

    it('a stored legacy lastSubTab (class) resolves to Build', () => {
      localStorage.setItem('lastSubTab:character', 'class');
      render(
        <CharacterPage character={createCharacter('Tester')} onChange={vi.fn()} subTab={null} />,
      );
      expect(screen.getByRole('combobox', { name: 'Class' })).toBeInTheDocument();
    });

    it('an unknown sub-tab falls back to the default Identity tab (no stored last-used)', () => {
      localStorage.removeItem('lastSubTab:character');
      renderPage({}, 'bogus' as unknown as SubTab);
      expect(screen.getByRole('heading', { name: 'Personal Details' })).toBeInTheDocument();
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
      fireEvent.click(screen.getByRole('tab', { name: 'Class & Features' }));
      expect(onSubTabChange).toHaveBeenCalledWith('build');
      expect(localStorage.getItem('lastSubTab:character')).toBe('build');
      expect(screen.getByRole('combobox', { name: 'Class' })).toBeInTheDocument();
    });

    it('a bare #character (null sub-tab) resolves to stored last-used when present', () => {
      localStorage.setItem('lastSubTab:character', 'build');
      render(
        <CharacterPage
          character={createCharacter('Tester')}
          onChange={vi.fn()}
          subTab={null}
        />,
      );
      // resolveInitialTab: no valid hash sub-tab → last-used 'build'.
      expect(screen.getByRole('combobox', { name: 'Class' })).toBeInTheDocument();
    });

    it('every CalculatedValue trigger renders in its sub-tab home', () => {
      // Overview: the vitals strip (AC, HP max, Initiative, Speed, Passive
      // Perception, Proficiency Bonus, Darkvision, Hit Dice).
      renderPage({ level: 3, classes: [{ id: 'fighter', level: 3 }] }, 'identity');
      for (const name of [
        /Armor Class/,
        /Hit Point Maximum/,
        /Initiative/,
        /Speed/,
        /Passive Perception/,
        /Proficiency Bonus/,
        /Darkvision/,
        /Hit Dice remaining/,
      ]) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument();
      }

      cleanup();
      // Abilities & Skills: ability modifiers + saves + skill checks.
      renderPage({ level: 3 }, 'abilities');
      expect(screen.getByRole('button', { name: /Strength Modifier/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dexterity Save/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Stealth Check/ })).toBeInTheDocument();

      cleanup();
      // Class & Features: Speed/Darkvision no longer live here (vitals strip).
      renderPage({ level: 3 }, 'build');
      expect(screen.queryByRole('button', { name: /Speed/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Darkvision/ })).toBeNull();
    });
  });
});
