import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
