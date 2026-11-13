import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CreationWizard } from '../CreationWizard';
import { ABILITIES } from '../../../types/character';

function next() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  // The Class Features step (classes with level 1 feature picks) never blocks: step over it.
  if (screen.queryByRole('heading', { name: /Class Features/ })) {
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  }
}
const NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

function start() {
  render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
}
function toOrigin(classId = 'fighter') {
  fireEvent.change(screen.getByLabelText('Class'), { target: { value: classId } });
  fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Tester' } });
  next();
}
function completeOrigin(species = 'human') {
  fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
  fireEvent.change(screen.getByLabelText('Intelligence background increase'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Wisdom background increase'), { target: { value: '1' } });
  next(); // Background -> Species
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: species } });
}

/** Finish the Background step (Acolyte, +2 Int / +1 Wis) and move on to Species. */
function toSpecies(classId = 'fighter') {
  toOrigin(classId);
  fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
  fireEvent.change(screen.getByLabelText('Intelligence background increase'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Wisdom background increase'), { target: { value: '1' } });
  next();
}

describe('Class step: compare before choosing', () => {
  it('names the Low-complexity classes for new players', () => {
    start();
    expect(screen.getByRole('note', { name: 'Tip for new players' })).toHaveTextContent(
      'rates Fighter and Rogue as Low complexity',
    );
  });

  it('compares every class and chooses one from the list', () => {
    start();
    fireEvent.click(screen.getByText('Compare all classes'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose Wizard' }));
    expect(screen.getByLabelText('Class')).toHaveValue('wizard');
    const about = screen.getByRole('note', { name: 'Class overview' });
    expect(about).toHaveTextContent('Likes: Spell books');
    expect(about).toHaveTextContent('Complexity: Average');
  });
});

describe('Background and Species steps: species, tools, increases and languages', () => {
  it('describes a species before and after it is chosen, with trait tooltips', () => {
    start();
    toSpecies();
    fireEvent.click(screen.getByText('Compare all species'));
    expect(screen.getAllByText(/Raised from the earth by a god of the forge/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Choose Dwarf' }));
    expect(screen.getByLabelText('Species')).toHaveValue('dwarf');
    const panel = screen.getByRole('region', { name: 'Dwarf species details' });
    expect(panel).toHaveTextContent('Darkvision120 ft');
    expect(within(panel).getByRole('button', { name: 'About Dwarven Toughness' })).toBeInTheDocument();
  });

  it('offers a real list of tools for a "choose a kind" tool, with what the tool does', () => {
    start();
    toOrigin();
    fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'artisan' } });
    const select = screen.getByLabelText('Tool proficiency choice') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toContain("Smith's Tools");
    fireEvent.change(select, { target: { value: "Smith's Tools" } });
    expect(screen.getByTestId('wiz-tool-description')).toHaveTextContent('Forges metal weapons and armor');
  });

  it('suggests the +2/+1 for the class and fills it only when asked', () => {
    start();
    toOrigin('fighter');
    // Soldier: Strength, Dexterity, Constitution.
    fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'soldier' } });
    expect(screen.getByLabelText('Strength background increase')).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: 'Suggest for my class' }));
    expect(screen.getByLabelText('Strength background increase')).toHaveValue('2');
    expect(screen.getByLabelText('Dexterity background increase')).toHaveValue('1');
    expect(screen.getByLabelText('Constitution background increase')).toHaveValue('0');
  });

  it("suggests the species' own language and explains each language", () => {
    start();
    toSpecies();
    fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dwarf' } });
    expect(screen.getByTestId('wiz-language-suggestion')).toHaveTextContent('Spoken by Dwarf folk: Dwarvish');
    fireEvent.click(screen.getByRole('button', { name: 'About Elvish' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Elves');
    expect(screen.getByRole('checkbox', { name: 'Elvish' })).not.toBeChecked();
  });

  it("suggests the class's spellcasting ability for a species spell trait", () => {
    start();
    toSpecies('wizard');
    fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'elf' } });
    expect(screen.getByTestId('wiz-species-ability-hint')).toHaveTextContent('Suggested: Intelligence');
  });
});

describe('Ability Scores, Skills and Details steps', () => {
  it('explains the chosen method and each ability', () => {
    start();
    toOrigin();
    completeOrigin();
    next(); // Skills
    next(); // Ability Scores
    expect(screen.getByTestId('ability-method-info')).toHaveTextContent('15, 14, 13, 12, 10, 8');
    fireEvent.click(screen.getByRole('tab', { name: 'Point Buy' }));
    expect(screen.getByTestId('ability-method-info')).toHaveTextContent('27 points');
    fireEvent.click(screen.getAllByRole('button', { name: 'About Strength' })[0]);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('tags the class skills that use the class primary ability', () => {
    start();
    toOrigin('rogue');
    completeOrigin();
    next(); // Skills
    expect(screen.getByTestId('skills-suggestion')).toHaveTextContent('skills that use Dexterity');
    expect(screen.getByTestId('skill-suggested-stealth')).toBeInTheDocument();
    expect(screen.queryByTestId('skill-suggested-athletics')).toBeNull();
  });

  it('describes the chosen alignment, warns about evil ones, and offers past prompts', () => {
    start();
    toOrigin();
    completeOrigin();
    next(); // Skills
    next(); // Ability Scores
    ABILITIES.forEach((a, i) => {
      fireEvent.change(screen.getByLabelText(`${NAMES[a]} score assignment`), { target: { value: String(i) } });
    });
    while (!screen.queryByRole('heading', { name: /Alignment & Details/ })) next();
    fireEvent.change(screen.getByLabelText('Alignment'), { target: { value: 'Chaotic Good' } });
    expect(screen.getByTestId('wiz-alignment-info')).toHaveTextContent('Follows their conscience');
    fireEvent.change(screen.getByLabelText('Alignment'), { target: { value: 'Lawful Evil' } });
    expect(screen.getByTestId('wiz-alignment-info')).toHaveTextContent('Check with your DM');
    expect(screen.getByText('Who raised you?')).toBeInTheDocument();
  });
});
