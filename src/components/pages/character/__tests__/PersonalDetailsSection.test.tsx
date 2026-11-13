import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { PersonalDetailsSection } from '../PersonalDetailsSection';
import { createCharacter } from '../../../../storage/character-store';

function renderSection(overrides = {}) {
  const character = { ...createCharacter('Tester'), ...overrides };
  const onChange = vi.fn();
  const onSpeciesChange = vi.fn();
  const onSpeciesChoiceChange = vi.fn();
  render(
    <PersonalDetailsSection
      character={character}
      onChange={onChange}
      portraitURL=""
      onPortraitUpload={vi.fn()}
      onPortraitRemove={vi.fn()}
      onSpeciesChange={onSpeciesChange}
      onSpeciesChoiceChange={onSpeciesChoiceChange}
    />,
  );
  return { character, onChange, onSpeciesChange, onSpeciesChoiceChange };
}

describe('PersonalDetailsSection', () => {
  it('renders the Personal Details header and identity fields', () => {
    renderSection();
    expect(screen.getByRole('heading', { name: 'Personal Details' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Alignment' })).toBeInTheDocument();
    expect(screen.getByLabelText('Character description')).toBeInTheDocument();
    // Faith / Deity is now a combo (text input with a <datalist>, so its
    // implicit ARIA role is combobox).
    expect(screen.getByRole('combobox', { name: 'Faith / Deity' })).toBeInTheDocument();
    for (const label of ['Age', 'Height', 'Weight', 'Eyes', 'Hair', 'Skin', 'Background']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('the "Generate portrait prompt" trigger opens and closes the dialog', () => {
    const { onChange } = renderSection();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /generate portrait prompt/i }));
    expect(screen.getByRole('dialog', { name: 'Generate portrait prompt' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders the portrait beside the card (placeholder when none)', () => {
    renderSection();
    expect(screen.getByText('No portrait set')).toBeInTheDocument();
  });

  it('editing Alignment emits an updated character with the selected alignment', () => {
    const { onChange } = renderSection();
    fireEvent.change(screen.getByRole('combobox', { name: 'Alignment' }), {
      target: { value: 'Chaotic Good' },
    });
    expect(onChange.mock.calls.at(-1)?.[0].alignment).toBe('Chaotic Good');
  });

  it('clearing Alignment to "— None —" unsets the field', () => {
    const { onChange } = renderSection({ alignment: 'Lawful Good' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Alignment' }), {
      target: { value: '' },
    });
    expect(onChange.mock.calls.at(-1)?.[0].alignment).toBeUndefined();
  });

  it('the Faith / Deity combo accepts free text (homebrew deities allowed)', () => {
    const { onChange } = renderSection();
    const input = screen.getByRole('combobox', { name: 'Faith / Deity' });
    fireEvent.change(input, { target: { value: 'Sigmar' } });
    expect(onChange.mock.calls.at(-1)?.[0].faith).toBe('Sigmar');
  });

  it('rolling a deity fills faith with a canonical catalog name', () => {
    const { onChange } = renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Roll deity' }));
    expect(onChange.mock.calls.at(-1)?.[0].faith).toBeTruthy();
  });

  it('editing the Character description textarea emits the updated value', () => {
    const { onChange } = renderSection();
    fireEvent.change(screen.getByLabelText('Character description'), {
      target: { value: 'Brave and reckless' },
    });
    expect(onChange.mock.calls.at(-1)?.[0].personality).toBe('Brave and reckless');
  });

  it('editing the name field updates character.name', () => {
    const { onChange } = renderSection({ name: 'Old' });
    fireEvent.click(screen.getByRole('button', { name: 'Character name' }));
    const input = screen.getByRole('textbox', { name: 'Character name' });
    fireEvent.change(input, { target: { value: 'New' } });
    fireEvent.blur(input);
    expect(onChange.mock.calls.at(-1)?.[0].name).toBe('New');
  });

  // ── Stage A7: gender selector + per-field roll buttons ─────────────────────

  it('renders a gender selector that emits the chosen gender', () => {
    const { onChange } = renderSection();
    const select = screen.getByRole('combobox', { name: 'Gender' });
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'female' } });
    expect(onChange.mock.calls.at(-1)?.[0].gender).toBe('female');
  });

  it('name/appearance roll buttons are disabled until a species is chosen', () => {
    renderSection({ name: '' });
    expect(screen.getByRole('button', { name: 'Roll name' })).toBeDisabled();
    for (const field of ['height', 'weight', 'eyes', 'hair', 'skin']) {
      expect(screen.getByRole('button', { name: `Roll ${field}` })).toBeDisabled();
    }
  });

  it('rolling a name fills character.name from the species+gender pools', () => {
    const { onChange } = renderSection({ species: { id: 'dwarf' }, gender: 'male', name: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Roll name' }));
    const rolled = onChange.mock.calls.at(-1)?.[0].name;
    expect(typeof rolled).toBe('string');
    expect(rolled.length).toBeGreaterThan(0);
  });

  it('per-field appearance roll buttons fill their own field honoring species', () => {
    for (const field of ['eyes', 'hair', 'skin', 'height', 'weight'] as const) {
      const { onChange } = renderSection({ species: { id: 'elf' }, gender: 'neutral' });
      fireEvent.click(screen.getByRole('button', { name: `Roll ${field}` }));
      expect(onChange.mock.calls.at(-1)?.[0][field]).toBeTruthy();
      cleanup();
    }
  });

  it('rolling the character description fills the description field', () => {
    const { onChange } = renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Roll character description' }));
    expect(onChange.mock.calls.at(-1)?.[0].personality).toBeTruthy();
  });

  it('has Ideal, Flaw and both goals, each rolled on its own and editable', () => {
    const { onChange } = renderSection({ classes: [{ id: 'paladin', level: 1 }], alignment: 'Lawful Good' });
    expect(screen.queryByLabelText('Bond')).toBeNull();
    const fields = [
      ['Ideal', 'ideal'],
      ['Flaw', 'flaw'],
      ['Short-term goal', 'shortTermGoal'],
      ['Long-term goal', 'longTermGoal'],
    ] as const;
    for (const [label, key] of fields) {
      fireEvent.click(screen.getByRole('button', { name: `Roll ${label.toLowerCase()}` }));
      const next = onChange.mock.calls.at(-1)?.[0];
      expect(next?.[key], label).toBeTruthy();
      // Only that one field changes.
      for (const [, other] of fields) if (other !== key) expect(next?.[other]).toBeUndefined();
      fireEvent.change(screen.getByLabelText(label), { target: { value: `My ${label}` } });
      expect(onChange.mock.calls.at(-1)?.[0][key]).toBe(`My ${label}`);
    }
  });

  // ── Even grid layout ──────────────────────────────────────────────────────
  it('lays every field out in one grid, in the pinned row order', () => {
    renderSection();
    const grid = screen.getByTestId('personal-details-grid');
    const cells = [...grid.children].map((c) => c.getAttribute('data-testid'));
    expect(cells).toEqual([
      'pd-field-name',
      'pd-field-gender',
      'pd-field-alignment',
      'pd-field-faith',
      'pd-field-age',
      'pd-field-height',
      'pd-field-weight',
      'pd-field-eyes',
      'pd-field-hair',
      'pd-field-skin',
      'pd-field-species',
      'pd-field-size',
      'pd-field-background',
    ]);
  });

  it('every cell ends with exactly one roll slot; Gender reserves an empty one', () => {
    renderSection({ name: '' });
    const grid = screen.getByTestId('personal-details-grid');
    for (const cell of [...grid.children]) {
      const slots = cell.querySelectorAll('[data-roll-slot]');
      expect(slots, `${cell.getAttribute('data-testid')} roll slot`).toHaveLength(1);
      // The slot is the last element in the cell's control row.
      expect(cell.lastElementChild).toBe(slots[0]);
    }
    const genderSlot = screen.getByTestId('pd-field-gender').querySelector('[data-roll-slot]')!;
    expect(genderSlot).toHaveAttribute('data-roll-slot', 'placeholder');
    expect(genderSlot).toHaveAttribute('aria-hidden', 'true');
    // The placeholder shares the roll button's size class.
    const nameBtn = screen.getByRole('button', { name: 'Roll name' });
    const shared = [...genderSlot.classList].filter((c) => nameBtn.classList.contains(c));
    expect(shared.length).toBeGreaterThan(0);
  });

  it('puts the Faith / Deity info icon inside the label row', () => {
    renderSection({ faith: 'Pelor' });
    const labelRow = screen.getByTestId('pd-faith-label-row');
    expect(within(labelRow).getByText('Faith / Deity')).toBeInTheDocument();
    expect(within(labelRow).getByLabelText('About Pelor')).toBeInTheDocument();
  });

  it('keeps long values on one line with the full value in a title', () => {
    renderSection({ skin: 'Fair with a faint glow', faith: 'A very long homebrew deity name' });
    expect(screen.getByRole('button', { name: 'Skin' })).toHaveAttribute(
      'title',
      'Fair with a faint glow',
    );
    expect(screen.getByRole('combobox', { name: 'Faith / Deity' })).toHaveAttribute(
      'title',
      'A very long homebrew deity name',
    );
  });

  it('shows the selected background by name only (no SRD status text)', () => {
    renderSection({ backgroundSelection: { id: 'hermit' } });
    expect(screen.getByTestId('pd-selected-background')).toHaveTextContent('Hermit');
    expect(document.body.textContent).not.toMatch(/srd/i);
  });

  it('rolling alignment sets a valid alignment', () => {
    const { onChange } = renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Roll alignment' }));
    expect(onChange.mock.calls.at(-1)?.[0].alignment).toBeTruthy();
  });
  it('lists Species and a fixed Size in Personal Details', () => {
    const { onSpeciesChange } = renderSection({ species: { id: 'dwarf' } });
    expect(screen.getByRole('combobox', { name: 'Species' })).toHaveValue('dwarf');
    expect(screen.getByTestId('pd-size-value')).toHaveTextContent('Medium');
    fireEvent.change(screen.getByRole('combobox', { name: 'Species' }), {
      target: { value: 'halfling' },
    });
    expect(onSpeciesChange).toHaveBeenCalledWith('halfling');
  });
  it('shows Size as a choice select (not a read-only value) when the species offers one', () => {
    renderSection({ species: { id: 'human' } });
    expect(screen.getByRole('combobox', { name: 'Size' })).toBeInTheDocument();
    expect(screen.queryByTestId('pd-size-value')).toBeNull();
  });
});

describe('PersonalDetailsSection dice on filled fields', () => {
  it('hides the 🎲 once a field has a value, keeping an empty slot so inputs stay aligned', () => {
    renderSection({
      name: 'Tess',
      species: { id: 'dwarf' },
      alignment: 'Lawful Good',
      faith: 'Moradin',
      age: '40',
      eyes: 'Grey',
      personality: 'Gruff but kind.',
    });
    for (const label of ['Roll name', 'Roll alignment', 'Roll deity', 'Roll age', 'Roll eyes', 'Roll character description']) {
      expect(screen.queryByRole('button', { name: label }), label).toBeNull();
    }
    // Empty fields still offer the dice.
    for (const label of ['Roll height', 'Roll weight', 'Roll hair', 'Roll skin']) {
      expect(screen.getByRole('button', { name: label }), label).toBeInTheDocument();
    }
    // Every grid cell still ends in exactly one roll slot (button or placeholder).
    const grid = screen.getByTestId('personal-details-grid');
    for (const cell of [...grid.children]) {
      expect(cell.querySelectorAll('[data-roll-slot]')).toHaveLength(1);
    }
  });

  it('brings the 🎲 back when a field is cleared (whitespace counts as empty)', () => {
    renderSection({ name: '   ', species: { id: 'dwarf' } });
    expect(screen.getByRole('button', { name: 'Roll name' })).toBeInTheDocument();
  });
});
