import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { CreationWizard } from '../CreationWizard';
import { CharacterPage } from '../../pages/CharacterPage';
import { ABILITIES } from '../../../types/character';
import type { Character } from '../../../types/character';
import type { ClassId } from '../../../data/classes';
import { pendingSetupChoices } from '../../../logic/starting-choices';
import { STARTING_CHOICES } from '../../../logic/__tests__/starting-choices-golden';

afterEach(cleanup);

const NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));

/** Name + class, then Origin (acolyte + human), landing on the Skills step. */
function toSkills(classId: string) {
  fireEvent.change(screen.getByLabelText('Class'), { target: { value: classId } });
  fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Tester' } });
  next();
  fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
  fireEvent.change(screen.getByLabelText('Intelligence background increase'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Wisdom background increase'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'human' } });
  next();
}

/** From Skills: pick `skills` class skills (0 = none), then assign the standard array. */
function toAfterAbilities(skills: number) {
  if (skills > 0) pickAll(screen.getByRole('group', { name: /Choose \d+ class skill/ }), skills);
  next();
  ABILITIES.forEach((ability, i) => {
    fireEvent.change(screen.getByLabelText(`${NAMES[ability]} score assignment`), {
      target: { value: String(i) },
    });
  });
  next();
}

/** Clicks up to limit enabled, unchecked checkboxes in the group (the cap stops it sooner). */
function pickAll(group: HTMLElement, limit = Infinity) {
  let clicked = 0;
  for (const box of within(group).getAllByRole('checkbox') as HTMLInputElement[]) {
    if (clicked < limit && !box.disabled && !box.checked) {
      fireEvent.click(box);
      clicked++;
    }
  }
  expect(clicked).toBeGreaterThan(0);
}

const group = (name: RegExp) => screen.getByRole('group', { name });
const checkedCount = (g: HTMLElement) =>
  (within(g).getAllByRole('checkbox') as HTMLInputElement[]).filter((b) => b.checked && !b.disabled).length;

const CASTERS = STARTING_CHOICES.filter((r) => r.spells !== null);
const NON_CASTERS = STARTING_CHOICES.filter((r) => r.spells === null);

describe('CreationWizard Spells step', () => {
  it.each(NON_CASTERS.map((r) => [r.classId] as const))('%s never sees a Spells step', (classId) => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: classId } });
    expect(screen.getByRole('group', { name: 'Step progress' }).textContent).not.toMatch(/Spells/);
    toSkills(classId);
    toAfterAbilities(0);
    expect(screen.getByRole('heading', { name: /Alignment & Details/ })).toBeInTheDocument();
  });

  it.each(CASTERS.map((r) => [r.classId, r] as const))('%s: step appears, caps hold, picks land in byClass', (classId, row) => {
    const onComplete = vi.fn();
    render(<CreationWizard onComplete={onComplete} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: classId } });
    expect(screen.getByRole('group', { name: 'Step progress' }).textContent).toMatch(
      /Ability Scores.*Spells.*Details/,
    );
    toSkills(classId);
    toAfterAbilities(0);
    expect(screen.getByRole('heading', { name: /Step 5: Spells/ })).toBeInTheDocument();
    expect(screen.getByText(/Casters prepare a list of spells\./)).toBeInTheDocument();
    expect(screen.getByText(/You can change your prepared spells after a Long Rest/)).toBeInTheDocument();
    expect(screen.queryByText(/memoriz/i)).toBeNull();
    const spells = row.spells!;

    if (spells.cantrips > 0) {
      expect(screen.getByTestId('spells-cantrips-counter')).toHaveTextContent(`0 of ${spells.cantrips} chosen`);
      const g = group(/cantrips: choose/);
      pickAll(g);
      expect(checkedCount(g)).toBe(spells.cantrips);
      expect(screen.getByTestId('spells-cantrips-counter')).toHaveTextContent(
        `${spells.cantrips} of ${spells.cantrips} chosen`,
      );
      // At the cap every unchecked pick is disabled.
      const unchecked = (within(g).getAllByRole('checkbox') as HTMLInputElement[]).filter((b) => !b.checked);
      expect(unchecked.length).toBeGreaterThan(0);
      expect(unchecked.every((b) => b.disabled)).toBe(true);
    } else {
      expect(screen.queryByRole('group', { name: /cantrips: choose/ })).toBeNull();
    }

    if (spells.spellbook !== null) {
      expect(screen.getByTestId('spells-spellbook-counter')).toHaveTextContent(`0 of ${spells.spellbook} chosen`);
      pickAll(group(/Spellbook: choose/));
      expect(screen.getByTestId('spells-spellbook-counter')).toHaveTextContent(
        `${spells.spellbook} of ${spells.spellbook} chosen`,
      );
    }
    pickAll(group(/Prepared spells: choose/));
    expect(screen.getByTestId('spells-prepared-counter')).toHaveTextContent(
      `${spells.prepared} of ${spells.prepared} chosen`,
    );

    next(); // Details
    next(); // Equipment
    next(); // Review
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    const stored = (onComplete.mock.calls[0][0] as Character).spellcasting?.byClass?.[classId as ClassId];
    expect(stored?.cantrips?.length ?? 0).toBe(spells.cantrips);
    expect(stored?.prepared).toHaveLength(spells.prepared);
    if (spells.spellbook !== null) {
      expect(stored?.spellbook).toHaveLength(spells.spellbook);
      expect(stored?.prepared?.every((id) => stored.spellbook?.includes(id))).toBe(true);
    }
    expect(Object.keys((onComplete.mock.calls[0][0] as Character).spellcasting ?? {})).toEqual(['byClass']);
  });

  it('a Wizard prepares only from the spellbook', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toSkills('wizard');
    toAfterAbilities(0);
    expect(screen.getByText(/Choose your spellbook spells first/)).toBeInTheDocument();
    const book = group(/Spellbook: choose/);
    const first = within(book).getAllByRole('checkbox')[0] as HTMLInputElement;
    fireEvent.click(first);
    const prepared = group(/Prepared spells: choose/);
    expect(within(prepared).getAllByRole('checkbox')).toHaveLength(1);
    // Removing it from the book also unprepares it.
    fireEvent.click(within(prepared).getAllByRole('checkbox')[0]);
    expect(screen.getByTestId('spells-prepared-counter')).toHaveTextContent('1 of 4');
    fireEvent.click(first);
    expect(screen.getByTestId('spells-prepared-counter')).toHaveTextContent('0 of 4');
  });

  it('shows school, casting time and tags per row and never blocks Next', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toSkills('cleric');
    toAfterAbilities(0);
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.getAllByText(/You can finish this later: the Overview will remind you/).length).toBeGreaterThan(0);
    const g = group(/cantrips: choose/);
    expect(within(g).getAllByText(/Action|Bonus Action|Reaction/).length).toBeGreaterThan(0);
    expect(within(g).getAllByRole('button', { name: /Details for/ }).length).toBeGreaterThan(0);
  });

  it('goes Back from Spells to Ability Scores', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toSkills('wizard');
    toAfterAbilities(0);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: /Ability Scores/ })).toBeInTheDocument();
  });
});

describe('CreationWizard Review step', () => {
  function toReview(classId: string, skills: number, pickSpells: boolean) {
    const onComplete = vi.fn();
    render(<CreationWizard onComplete={onComplete} onCancel={vi.fn()} />);
    toSkills(classId);
    toAfterAbilities(skills);
    if (pickSpells) {
      for (const name of [/cantrips: choose/, /Spellbook: choose/, /Prepared spells: choose/]) {
        const g = screen.queryByRole('group', { name });
        if (g) pickAll(g);
      }
    }
    // Spells (if any) -> Details -> Equipment -> Review.
    const total = pickSpells || classId === 'wizard' ? 3 : 2;
    for (let i = 0; i < total; i++) next();
    return onComplete;
  }

  it('summarises saves, skills and spells, and lists what is still open', () => {
    toReview('wizard', 1, false);
    expect(screen.getByRole('heading', { name: /Review/ })).toBeInTheDocument();
    expect(screen.getByTestId('review-saves')).toHaveTextContent('Intelligence & Wisdom');
    const skills = screen.getByRole('list', { name: 'Skill proficiencies' });
    expect(within(skills).getByText(/Insight/)).toBeInTheDocument(); // acolyte background
    expect(within(skills).getByText(/Religion/)).toBeInTheDocument();
    const open = screen.getByTestId('review-open');
    expect(open).toHaveTextContent(/cantrips: 0 of 3/);
    expect(open).toHaveTextContent(/spellbook spells: 0 of 6/);
    expect(open).toHaveTextContent(/prepared spells: 0 of 4/);
    expect(open).toHaveTextContent(/class skills: 1 of 2/);
    expect(open).toHaveTextContent('You can finish these any time — the Overview will remind you.');
  });

  it('shows the chosen spells and "Everything is set." when nothing is open, and Finish works', () => {
    const onComplete = toReview('wizard', 2, true);
    expect(screen.getByRole('list', { name: 'Spells chosen' })).toBeInTheDocument();
    expect(screen.getByTestId('review-open')).toHaveTextContent('Everything is set.');
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows ability modifiers from effective scores including background increases', () => {
    toReview('fighter', 0, false);
    const list = screen.getByRole('list', { name: 'Ability scores' });
    // Array 15 for Str; Int is the 4th value (12) +2 from the background = 14.
    expect(within(list).getByText(/Intelligence/).closest('li')).toHaveTextContent('14');
  });

  it('end to end: completing every pick leaves nothing pending and no Finish setting up card', () => {
    const onComplete = toReview('wizard', 2, true);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    const finished = onComplete.mock.calls[0][0] as Character;
    expect(pendingSetupChoices(finished)).toEqual([]);
    cleanup();
    render(<CharacterPage character={finished} onChange={vi.fn()} subTab="identity" />);
    expect(screen.queryByText('Finish setting up')).toBeNull();
  });
});
