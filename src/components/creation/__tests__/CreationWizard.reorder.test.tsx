import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { CreationWizard } from '../CreationWizard';
import { ABILITIES } from '../../../types/character';
import type { Character } from '../../../types/character';
import { masteryChoices } from '../../../logic/weapon-mastery';

// Step order: Class, Background, Species, Skills, Ability Scores, Equipment,
// Class Features (conditional), Spells (conditional), Details, Review.
// Weapon Mastery and class-feature languages live on Class Features, after Equipment.

const NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};
const nextBtn = () => screen.getByRole('button', { name: /^(Next|Finish)$/ });
const next = () => fireEvent.click(nextBtn());
/** Press Next at most 10 times until the heading appears (never hangs). */
function goTo(heading: RegExp) {
  for (let i = 0; i < 10 && !screen.queryByRole('heading', { name: heading }); i++) next();
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
}
const stepNumber = (heading: RegExp): number => {
  const text = screen.getByRole('heading', { name: heading }).textContent ?? '';
  return Number(/Step (\d+):/.exec(text)?.[1]);
};

/** Name + class, then acolyte + human, then Skills -> Ability Scores with the standard array assigned. */
function toAbilities(classId: string) {
  fireEvent.change(screen.getByLabelText('Class'), { target: { value: classId } });
  fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Tess' } });
  next();
  fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
  fireEvent.change(screen.getByLabelText('Intelligence background increase'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Wisdom background increase'), { target: { value: '1' } });
  next(); // Background -> Species
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'human' } });
  next(); // Species -> Skills
  next(); // Skills -> Ability Scores
  expect(screen.getByRole('heading', { name: /Ability Scores/ })).toBeInTheDocument();
  ABILITIES.forEach((a, i) => {
    fireEvent.change(screen.getByLabelText(`${NAMES[a]} score assignment`), { target: { value: String(i) } });
  });
}
function toEquipment(classId: string) {
  toAbilities(classId);
  next();
  expect(screen.getByRole('heading', { name: /Equipment/ })).toBeInTheDocument();
}
function toClassFeatures(classId: string) {
  toEquipment(classId);
  next();
  expect(screen.getByRole('heading', { name: /Class Features/ })).toBeInTheDocument();
}
const addButtons = () =>
  within(screen.getByTestId('features-weapon-mastery'))
    .queryAllByRole('button', { name: /^Add [A-Z]/ })
    .map((b) => b.textContent);

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('wizard step order', () => {
  it('puts Equipment before Class Features, and the step bar reads in that order', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
    expect(screen.getByRole('group', { name: 'Step progress' }).textContent).toMatch(
      /Ability Scores.*Equipment.*Class Features.*Details.*Review/,
    );
    toClassFeatures('fighter');
    const features = stepNumber(/Class Features/);
    // Equipment is exactly one step earlier.
    next();
    expect(screen.getByRole('heading', { name: /Alignment & Details/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(stepNumber(/Equipment/)).toBe(features - 1);
  });
});

describe('Weapon Mastery reflects the equipment actually chosen', () => {
  it('offers the weapons the player bought, not a default package, when taking gold', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toEquipment('fighter');
    fireEvent.click(screen.getByRole('tab', { name: '155 GP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Buy one Dagger' }));
    next();
    expect(screen.getByRole('heading', { name: /Class Features/ })).toBeInTheDocument();
    expect(screen.getByText(/Suggested: weapons in the equipment you chose\./)).toBeInTheDocument();
    // Gold only: nothing from the Fighter package, so the Dagger is the only suggestion.
    expect(addButtons()).toEqual(['Add Dagger']);
  });

  it('offers the default package weapons when the package is kept, and not a weapon that was never taken', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toClassFeatures('fighter');
    const offered = addButtons();
    expect(offered.length).toBeGreaterThan(0);
    expect(offered).not.toContain('Add Dagger');
  });
});

describe('Class feature languages sit on Class Features, not Species', () => {
  it('shows the Rogue picker on Class Features only', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'rogue' } });
    fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Shadow' } });
    next();
    fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
    fireEvent.change(screen.getByLabelText('Intelligence background increase'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Wisdom background increase'), { target: { value: '1' } });
    next();
    expect(screen.getByRole('heading', { name: /Species & Languages/ })).toBeInTheDocument();
    expect(screen.queryByText(/feature languages/)).toBeNull();
    expect(screen.queryByLabelText('Goblin (feature)')).toBeNull();
    fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'human' } });
    goTo(/Ability Scores/);
    ABILITIES.forEach((a, i) => {
      fireEvent.change(screen.getByLabelText(`${NAMES[a]} score assignment`), { target: { value: String(i) } });
    });
    goTo(/Class Features/);
    const section = within(screen.getByTestId('features-languages'));
    expect(section.getByText(/Rogue feature languages/)).toBeInTheDocument();
    expect(section.getByText(/choose 1/)).toBeInTheDocument();
    expect(section.getByText(/Known automatically: .*Thieves/)).toBeInTheDocument();
    expect(section.queryByLabelText(/Thieves.*\(feature\)/)).toBeNull();
    fireEvent.click(section.getByLabelText('Goblin (feature)'));
    expect(section.getByText('1 of 1 chosen')).toBeInTheDocument();
    expect(section.getByLabelText('Giant (feature)')).toBeDisabled();
  });

  it.each(['fighter', 'ranger'])('shows %s no feature-language section (none granted at level 1)', (classId) => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toClassFeatures(classId);
    expect(screen.queryByTestId('features-languages')).toBeNull();
    expect(screen.getByTestId('class-features-step')).toBeInTheDocument();
  });
});

describe('full wizard flow in the new order', () => {
  it('Fighter: buys a weapon with gold, masters it, and finishes', () => {
    const onComplete = vi.fn();
    render(<CreationWizard onComplete={onComplete} onCancel={vi.fn()} />);
    toEquipment('fighter');
    fireEvent.click(screen.getByRole('tab', { name: '155 GP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Buy one Dagger' }));
    next();
    const style = within(screen.getByTestId('features-fighting-style'));
    fireEvent.click(style.getByRole('radio', { name: 'Archery' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Dagger' }));
    goTo(/Review/);
    expect(screen.getByTestId('review-class-features')).toHaveTextContent('Fighting Style: Archery');
    next();
    expect(onComplete).toHaveBeenCalledTimes(1);
    const built = onComplete.mock.calls[0][0] as Character;
    expect(built.inventory?.some((i) => i.catalogId === 'dagger')).toBe(true);
    expect(masteryChoices(built).chosen).toContain('dagger');
  });

  it('Rogue: Expertise, a Weapon Mastery and a feature language, Fix button returns to Class Features, then finishes', () => {
    const onComplete = vi.fn();
    render(<CreationWizard onComplete={onComplete} onCancel={vi.fn()} />);
    toClassFeatures('rogue');
    // Review lists the unfinished picks; the languages Fix button lands back here.
    goTo(/Review/);
    const open = within(screen.getByTestId('review-open'));
    expect(open.getByText(/feature languages/)).toBeInTheDocument();
    fireEvent.click(open.getByRole('button', { name: 'Fix feature languages' }));
    expect(screen.getByRole('heading', { name: /Class Features/ })).toBeInTheDocument();
    expect(screen.getByTestId('features-languages')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Goblin (feature)'));
    const expertise = within(screen.getByTestId('features-expertise'));
    // Skills are not picked in this flow, so use the background-granted ones the step lists.
    const boxes = expertise.queryAllByRole('checkbox') as HTMLInputElement[];
    for (const box of boxes.slice(0, 2)) fireEvent.click(box);
    const firstAdd = within(screen.getByTestId('features-weapon-mastery')).queryAllByRole('button', { name: /^Add [A-Z]/ })[0];
    expect(firstAdd).toBeDefined();
    fireEvent.click(firstAdd);

    goTo(/Review/);
    expect(screen.getByTestId('review-open').textContent).not.toMatch(/feature languages/);
    next();
    expect(onComplete).toHaveBeenCalledTimes(1);
    const built = onComplete.mock.calls[0][0] as Character;
    expect(built.languages?.granted).toEqual(['goblin']);
    expect(masteryChoices(built).chosen.length).toBe(1);
  });
});
