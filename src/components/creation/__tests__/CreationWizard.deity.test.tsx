import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CreationWizard } from '../CreationWizard';
import { ABILITIES } from '../../../types/character';

function next() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}

const NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

/** Walk the wizard to the Alignment & Details step. */
function toDetails(classId: string, species: string) {
  fireEvent.change(screen.getByLabelText('Class'), { target: { value: classId } });
  fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Tester' } });
  next();
  fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
  fireEvent.change(screen.getByLabelText('Intelligence background increase'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Wisdom background increase'), { target: { value: '1' } });
  next(); // Background -> Species
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: species } });
  next(); // Skills
  next(); // Ability Scores
  ABILITIES.forEach((a, i) => {
    fireEvent.change(screen.getByLabelText(`${NAMES[a]} score assignment`), { target: { value: String(i) } });
  });
  while (!screen.queryByRole('heading', { name: /Alignment & Details/ })) next();
}

describe('CreationWizard deity suggestions', () => {
  it('suggests gods from class, species and alignment and fills the Faith field on Choose', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toDetails('cleric', 'dwarf');
    fireEvent.change(screen.getByLabelText('Alignment'), { target: { value: 'Lawful Good' } });
    const panel = screen.getByRole('region', { name: 'Deity suggestions' });
    expect(within(panel).getByRole('button', { name: 'About Moradin' })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Choose Moradin as deity' }));
    expect(screen.getByLabelText('Faith / Deity')).toHaveValue('Moradin');
    expect(within(panel).getByRole('button', { name: 'Choose Moradin as deity' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('filters suggestions by setting and hides evil gods for a good character', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toDetails('rogue', 'human');
    fireEvent.change(screen.getByLabelText('Alignment'), { target: { value: 'Chaotic Good' } });
    fireEvent.change(screen.getByLabelText('Deity setting'), { target: { value: 'forgotten-realms' } });
    const list = screen.getByRole('list', { name: 'Suggested deities' });
    expect(within(list).getByRole('button', { name: 'About Tymora' })).toBeInTheDocument();
    expect(within(list).queryByRole('button', { name: 'About Cyric' })).toBeNull();
    expect(within(list).queryByRole('button', { name: 'About Lolth' })).toBeNull();
  });

  it('lists gods from every pantheon in the Faith suggestions', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toDetails('fighter', 'human');
    const options = Array.from(document.querySelectorAll('#wiz-faith-list option')).map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(options).toEqual(expect.arrayContaining(['Pelor', 'Mystra', 'Moradin', 'Paladine']));
  });
});
