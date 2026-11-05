import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PersonalDetailsSection } from '../PersonalDetailsSection';
import { createCharacter } from '../../../../storage/character-store';

function renderSection(overrides = {}) {
  const character = { ...createCharacter('Tester'), ...overrides };
  const onChange = vi.fn();
  render(
    <PersonalDetailsSection
      character={character}
      onChange={onChange}
      portraitURL=""
      onPortraitUpload={vi.fn()}
      onPortraitRemove={vi.fn()}
    />,
  );
  return { character, onChange };
}

describe('PersonalDetailsSection', () => {
  it('renders the Personal Details header and identity fields', () => {
    renderSection();
    expect(screen.getByRole('heading', { name: 'Personal Details' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Alignment' })).toBeInTheDocument();
    expect(screen.getByLabelText('Personality')).toBeInTheDocument();
    for (const label of ['Faith / Deity', 'Sex', 'Age', 'Height', 'Weight', 'Eyes', 'Hair', 'Skin', 'Background']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
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

  it('editing a text field (Faith) emits the updated value', () => {
    const { onChange } = renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Faith / Deity' }));
    const input = screen.getByRole('textbox', { name: 'Faith / Deity' });
    fireEvent.change(input, { target: { value: 'Sigmar' } });
    fireEvent.blur(input);
    expect(onChange.mock.calls.at(-1)?.[0].faith).toBe('Sigmar');
  });

  it('editing the Personality textarea emits the updated value', () => {
    const { onChange } = renderSection();
    fireEvent.change(screen.getByLabelText('Personality'), {
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
    renderSection();
    expect(screen.getByRole('button', { name: 'Roll name' })).toBeDisabled();
    for (const field of ['height', 'weight', 'eyes', 'hair', 'skin']) {
      expect(screen.getByRole('button', { name: `Roll ${field}` })).toBeDisabled();
    }
  });

  it('rolling a name fills character.name from the species+gender pools', () => {
    const { onChange } = renderSection({ species: { id: 'dwarf' }, gender: 'male' });
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

  it('rolling personality fills the personality field', () => {
    const { onChange } = renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Roll personality' }));
    expect(onChange.mock.calls.at(-1)?.[0].personality).toBeTruthy();
  });

  it('rolling alignment sets a valid alignment', () => {
    const { onChange } = renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Roll alignment' }));
    expect(onChange.mock.calls.at(-1)?.[0].alignment).toBeTruthy();
  });

  it('rolling sex fills from the selected gender', () => {
    const { onChange } = renderSection({ gender: 'female' });
    fireEvent.click(screen.getByRole('button', { name: 'Roll sex' }));
    expect(onChange.mock.calls.at(-1)?.[0].sex).toBe('female');
  });
});
