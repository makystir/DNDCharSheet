import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AdvancementPage } from '../AdvancementPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

/**
 * Component tests for the Advancement tab (Stage A6a). They assert the UI wires
 * the pure advancement logic correctly; the rules themselves are covered by the
 * logic + golden suites. No rule is recomputed in a test.
 */

/** Stateful harness so onChange-driven updates persist across renders. */
function renderStateful(overrides: Partial<Character> = {}, now: () => number = () => 1000) {
  const onChange = vi.fn();
  let latest: Character = { ...createCharacter('Tester'), ...overrides };
  function Harness() {
    const [character, setCharacter] = useState<Character>(latest);
    return (
      <AdvancementPage
        character={character}
        now={now}
        onChange={(next) => {
          onChange(next);
          latest = next;
          setCharacter(next);
        }}
      />
    );
  }
  render(<Harness />);
  return { onChange, get: () => latest };
}

/** A level-4 Fighter (d10) with Con 14 (+2). */
function fighter4(): Partial<Character> {
  return {
    level: 4,
    classes: [{ id: 'fighter', level: 4 }],
    abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
  };
}

describe('AdvancementPage — level & mode', () => {
  it('renders the authoritative Level control and Proficiency Bonus', () => {
    renderStateful(fighter4());
    expect((screen.getByLabelText('Level') as HTMLInputElement).value).toBe('4');
    // PB at level 4 is +2 (shown as a CalculatedValue trigger displaying "+2").
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('setting the level routes through the logic clamp', () => {
    const { get } = renderStateful(fighter4());
    fireEvent.change(screen.getByLabelText('Level'), { target: { value: '25' } });
    expect(get().level).toBe(20); // clampLevel caps at 20
  });

  it('defaults to milestone mode (no XP controls shown)', () => {
    renderStateful(fighter4());
    expect(screen.getByRole('tab', { name: 'Milestone' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByLabelText('Experience Points')).not.toBeInTheDocument();
  });

  it('switching to XP mode reveals the XP entry and permitted level', () => {
    const { get } = renderStateful(fighter4());
    fireEvent.click(screen.getByRole('tab', { name: 'XP' }));
    expect(get().advancement?.leveling?.mode).toBe('xp');
    expect(screen.getByLabelText('Experience Points')).toBeInTheDocument();
  });
});

describe('AdvancementPage — XP permits, never auto-levels', () => {
  it('milestone mode permits a level-up regardless of XP', () => {
    renderStateful(fighter4());
    // The fixed-HP level-up button is enabled under milestone.
    expect(screen.getByRole('button', { name: 'Level up (fixed HP)' })).not.toBeDisabled();
  });

  it('XP mode blocks level-up below the next threshold and permits it once met', () => {
    // Level 4 → level 5 needs 6500 XP total (PHB). Start just below.
    const { get } = renderStateful({
      ...fighter4(),
      advancement: { leveling: { mode: 'xp', xp: 6499 } },
    });
    expect(screen.getByRole('button', { name: 'Level up (fixed HP)' })).toBeDisabled();
    // Raise XP to the threshold.
    fireEvent.change(screen.getByLabelText('Experience Points'), { target: { value: '6500' } });
    expect(get().advancement?.leveling?.xp).toBe(6500);
    expect(screen.getByRole('button', { name: 'Level up (fixed HP)' })).not.toBeDisabled();
    // Crossing the threshold does NOT auto-level: level stays 4 until applied.
    expect(get().level).toBe(4);
  });

  it('applying a level-up advances exactly one level and logs it', () => {
    const { get } = renderStateful(fighter4(), () => 2000);
    fireEvent.click(screen.getByRole('button', { name: 'Level up (fixed HP)' }));
    expect(get().level).toBe(5);
    const log = get().advancement?.log ?? [];
    expect(log.some((e) => e.kind === 'level-up' && e.level === 5)).toBe(true);
    expect(log.some((e) => e.kind === 'hp' && e.level === 5)).toBe(true);
  });
});

describe('AdvancementPage — per-level HP choice + breakdown', () => {
  it('shows the HP max as a CalculatedValue and records a fixed choice', () => {
    const { get } = renderStateful(fighter4());
    // Fighter d10, levels 1-4 fixed: 10 + 3*6 = 28 Hit-Dice; + Con 2*4 = 8 → 36.
    const hpTrigger = screen.getByRole('button', { name: /Hit Point maximum:/ });
    expect(hpTrigger).toHaveTextContent('36');
    // Record a fixed HP choice for the current level.
    fireEvent.click(screen.getByRole('button', { name: 'Take fixed value' }));
    const rec = (get().advancement?.levels ?? []).find((l) => l.level === 4);
    expect(rec?.hp).toEqual({ mode: 'fixed', value: 6 }); // d10 fixed = 6
  });

  it('records a rolled HP choice for the CURRENT level without leveling up (milestone)', () => {
    // Regression for B1: in milestone mode a level-up is always permitted, but
    // the Hit Points card's "Roll the Hit Die" button must RE-RECORD the current
    // level's HP (a correction), NOT advance the character a level.
    const { get } = renderStateful(fighter4());
    // Open the current-level roller from the Hit Points card.
    fireEvent.click(screen.getByRole('button', { name: 'Roll the Hit Die' }));
    fireEvent.click(screen.getByRole('button', { name: /Roll d10/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Record HP' }));
    // Level is unchanged; the roll is recorded against the CURRENT level (4).
    expect(get().level).toBe(4);
    const rec = (get().advancement?.levels ?? []).find((l) => l.level === 4);
    expect(rec?.hp?.mode).toBe('rolled');
    expect(rec?.hp?.value).toBeGreaterThanOrEqual(1);
    expect(rec?.hp?.value).toBeLessThanOrEqual(10);
    // No level-5 record was created.
    expect((get().advancement?.levels ?? []).some((l) => l.level === 5)).toBe(false);
  });

  it('records a rolled HP choice via the Hit-Die dialog on level-up', () => {
    const { get } = renderStateful(fighter4());
    // Under milestone a level-up is permitted, so rolling HP applies the level-up
    // and records the roll for the NEW level (5). Open the roller, resolve the
    // auto-roll, then record.
    fireEvent.click(screen.getByRole('button', { name: 'Level up (roll HP)' }));
    fireEvent.click(screen.getByRole('button', { name: /Roll d10/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Record HP' }));
    expect(get().level).toBe(5);
    const rec = (get().advancement?.levels ?? []).find((l) => l.level === 5);
    expect(rec?.hp?.mode).toBe('rolled');
    expect(rec?.hp?.value).toBeGreaterThanOrEqual(1);
    expect(rec?.hp?.value).toBeLessThanOrEqual(10);
  });
});

describe('AdvancementPage — next-level preview flags', () => {
  it('flags the subclass choice at level 3 (Fighter at level 2)', () => {
    renderStateful({ level: 2, classes: [{ id: 'fighter', level: 2 }] });
    expect(within(screen.getByText(/Advancing to level 3/).closest('div')!).getByText('Choose a subclass')).toBeInTheDocument();
  });

  it('flags a feat slot opening at level 4 (Fighter at level 3)', () => {
    renderStateful({ level: 3, classes: [{ id: 'fighter', level: 3 }] });
    expect(screen.getByRole('button', { name: /A feat slot opens/ })).toBeInTheDocument();
  });

  it('flags a Proficiency Bonus change at level 5 (character at level 4)', () => {
    renderStateful(fighter4());
    expect(screen.getByText(/Proficiency Bonus rises to \+3/)).toBeInTheDocument();
  });
});

describe('AdvancementPage — choices pending', () => {
  it('shows an UNFILLED feat slot as a pending choice (A6b)', () => {
    // Fighter level 4 has one asi-marker (level 4); with no feat taken it is a
    // pending choice. (The slot itself is filled via the Feats section — A6b.)
    renderStateful(fighter4());
    expect(screen.getByText(/Feat not chosen for level 4/)).toBeInTheDocument();
  });

  it('drops the feat from Choices Pending once a feat fills the slot (A6b)', () => {
    renderStateful({
      ...fighter4(),
      advancement: {
        feats: [{ featId: 'ability-score-improvement', level: 4, abilityIncreases: { str: 2 } }],
      },
    });
    expect(screen.queryByText(/Feat not chosen for level 4/)).not.toBeInTheDocument();
  });

  it('flags the subclass as pending at or above the subclass level', () => {
    renderStateful({ level: 3, classes: [{ id: 'fighter', level: 3 }] });
    expect(screen.getByText(/Subclass not chosen/)).toBeInTheDocument();
  });
});

describe('AdvancementPage — audit log', () => {
  it('records level-ups and HP choices, and clears via the confirm dialog', () => {
    const { get } = renderStateful(fighter4(), () => 3000);
    // Level up to generate log entries.
    fireEvent.click(screen.getByRole('button', { name: 'Level up (fixed HP)' }));
    // Open the log entries.
    fireEvent.click(screen.getByRole('button', { name: /Show entries/ }));
    const list = screen.getByRole('list', { name: 'Advancement log entries' });
    expect(within(list).getByText(/Advanced to level 5/)).toBeInTheDocument();
    expect(within(list).getByText(/HP \+/)).toBeInTheDocument();
    // Clear the log: open the confirm (trigger ends with an ellipsis), then
    // confirm in the dialog.
    fireEvent.click(screen.getByRole('button', { name: /Clear log…/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear log' }));
    expect(get().advancement?.log).toBeUndefined();
  });
});

describe('AdvancementPage — multiclass add-a-class (M4)', () => {
  /** A level-4 Fighter with Dex 14 (so a Dex-based class prereq is met). */
  function fighterDex(): Partial<Character> {
    return {
      level: 4,
      classes: [{ id: 'fighter', level: 4 }],
      abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    };
  }

  it('renders the add-a-class control with the current build', () => {
    renderStateful(fighterDex());
    expect(screen.getByLabelText('New class to add a level in')).toBeInTheDocument();
    expect(screen.getByTestId('mc-current-build')).toHaveTextContent('Fighter 4');
  });

  it('disables a prereq-failing class when the house rule is off', () => {
    renderStateful(fighterDex());
    const select = screen.getByLabelText('New class to add a level in');
    // Wizard needs Int 13; the Fighter has Int 10, so it fails and is disabled.
    const wizardOption = within(select).getByRole('option', { name: /Wizard/ }) as HTMLOptionElement;
    expect(wizardOption.disabled).toBe(true);
    // Rogue needs Dex 13; Dex 14 meets it, so it is NOT disabled.
    const rogueOption = within(select).getByRole('option', { name: /Rogue/ }) as HTMLOptionElement;
    expect(rogueOption.disabled).toBe(false);
  });

  it('makes a prereq-failing class selectable-with-warning when the house rule is on', () => {
    const { get } = renderStateful({
      ...fighterDex(),
      houseRules: { allowIllegalMulticlass: true },
    });
    const select = screen.getByLabelText('New class to add a level in');
    const wizardOption = within(select).getByRole('option', { name: /Wizard/ }) as HTMLOptionElement;
    // Now selectable, and labelled as a house-rule option.
    expect(wizardOption.disabled).toBe(false);
    expect(wizardOption.textContent).toMatch(/house rule/);
    // Selecting it surfaces the warning note and a preview of the resulting build.
    fireEvent.change(select, { target: { value: 'wizard' } });
    expect(screen.getByText(/does not meet the multiclass prerequisite/)).toBeInTheDocument();
    expect(screen.getByTestId('mc-result-build')).toHaveTextContent('Fighter 4 / Wizard 1');
    // Apply the level: the new class is appended at level 1 and the total rises.
    fireEvent.click(screen.getByRole('button', { name: 'Add level (fixed HP)' }));
    expect(get().classes).toEqual([
      { id: 'fighter', level: 4 },
      { id: 'wizard', level: 1 },
    ]);
    expect(get().level).toBe(5);
  });

  it('adds a level in a prereq-met NEW class and appends it at level 1', () => {
    const { get } = renderStateful(fighterDex(), () => 4000);
    const select = screen.getByLabelText('New class to add a level in');
    // Rogue (Dex 14 meets the prereq) is selectable.
    fireEvent.change(select, { target: { value: 'rogue' } });
    expect(screen.getByTestId('mc-result-build')).toHaveTextContent('Fighter 4 / Rogue 1');
    fireEvent.click(screen.getByRole('button', { name: 'Add level (fixed HP)' }));
    expect(get().classes).toEqual([
      { id: 'fighter', level: 4 },
      { id: 'rogue', level: 1 },
    ]);
    expect(get().level).toBe(5);
    // A level-up log entry names the multiclass.
    const log = get().advancement?.log ?? [];
    expect(log.some((e) => e.kind === 'level-up' && /Rogue/.test(e.detail))).toBe(true);
  });

  /** A Fighter 5 / Wizard 1 multiclass build (d10 / d6), Dex & Int 14. */
  function fighterWizard(): Partial<Character> {
    return {
      level: 6,
      classes: [
        { id: 'fighter', level: 5 },
        { id: 'wizard', level: 1 },
      ],
      abilities: { str: 10, dex: 14, con: 14, int: 14, wis: 10, cha: 10 },
    };
  }

  it('offers a class-to-advance picker for a multiclass character and advances the chosen held class', () => {
    const { get } = renderStateful(fighterWizard(), () => 5000);
    // The picker lists both held classes; the main Level-up button advances the
    // one selected, NOT always the primary.
    const picker = screen.getByLabelText('Class to advance');
    fireEvent.change(picker, { target: { value: 'wizard' } });
    fireEvent.click(screen.getByRole('button', { name: 'Level up (fixed HP)' }));
    expect(get().classes).toEqual([
      { id: 'fighter', level: 5 },
      { id: 'wizard', level: 2 }, // the SECONDARY class gained the level
    ]);
    expect(get().level).toBe(7);
    const log = get().advancement?.log ?? [];
    expect(log.some((e) => e.kind === 'level-up' && /Wizard/.test(e.detail))).toBe(true);
  });

  it('offers fixed HP only for a multiclass level-up (no roll-HP button)', () => {
    renderStateful(fighterWizard());
    // Multiclass HP max is fixed-only until M5, so no roll-HP button is shown for
    // the level-up action or the add-a-class control.
    expect(screen.getByRole('button', { name: 'Level up (fixed HP)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Level up (roll HP)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add level (roll HP)' })).not.toBeInTheDocument();
  });
});

describe('AdvancementPage Expertise', () => {
  it('lists owed Expertise in Choices Pending and records picks on the skill', () => {
    const { get } = renderStateful({
      level: 1,
      classes: [{ id: 'rogue', level: 1 }],
      skills: { stealth: { proficient: true }, perception: { proficient: true } },
    });
    const pending = screen.getByTestId('pending-expertise');
    expect(pending).toHaveTextContent('Choose 2 more Expertise skills');
    fireEvent.click(within(pending).getByRole('checkbox', { name: 'Stealth' }));
    expect(get().skills?.stealth?.expertise).toBe(true);
    expect(screen.getByTestId('pending-expertise')).toHaveTextContent('Choose 1 more Expertise skill ');
    fireEvent.click(within(screen.getByTestId('pending-expertise')).getByRole('checkbox', { name: 'Perception' }));
    expect(screen.queryByTestId('pending-expertise')).toBeNull();
  });

  it('shows a non-blocking note when more Expertise is marked than granted', () => {
    renderStateful({
      level: 1,
      classes: [{ id: 'rogue', level: 1 }],
      skills: {
        stealth: { proficient: true, expertise: true },
        perception: { proficient: true, expertise: true },
        insight: { proficient: true, expertise: true },
      },
    });
    expect(screen.queryByTestId('pending-expertise')).toBeNull();
    expect(screen.getByTestId('expertise-over-note')).toBeInTheDocument();
  });
});
describe('AdvancementPage class-feature choices', () => {
  it('counts owed class choices in Choices Pending and shows the Class Choices card', () => {
    renderStateful({ level: 2, classes: [{ id: 'sorcerer', level: 2 }] });
    expect(screen.getByRole('heading', { name: /Choices Pending \(4\)/ })).toBeInTheDocument(); // Metamagic + unrecorded level-2 HP + Sorcerer cantrips + prepared spells (Spells page)
    expect(screen.getByRole('heading', { name: /Class Choices \(1\)/ })).toBeInTheDocument();
    const item = screen.getByTestId('pending-choice-sorcerer.metamagic');
    fireEvent.click(within(item).getByRole('checkbox', { name: 'Careful Spell' }));
    fireEvent.click(within(screen.getByTestId('pending-choice-sorcerer.metamagic')).getByRole('checkbox', { name: 'Quickened Spell' }));
    expect(screen.queryByTestId('pending-choice-sorcerer.metamagic')).toBeNull();
    expect(screen.getByRole('heading', { name: /Choices Pending \(3\)/ })).toBeInTheDocument();
  });
});

describe('AdvancementPage spell legality', () => {
  it('lists spell picks that are not on the class list as a pending item', () => {
    renderStateful({
      level: 1,
      classes: [{ id: 'cleric', level: 1 }],
      spellcasting: { byClass: { cleric: { cantrips: ['sacred-flame'], prepared: ['fireball'] } } },
    });
    const item = screen.getByTestId('pending-illegal-spells');
    expect(item).toHaveTextContent('1 selected spell is not on your class');
    expect(item).toHaveTextContent('Fireball');
  });

  it('shows no illegal-spell item when every pick is on the class list', () => {
    renderStateful({
      level: 1,
      classes: [{ id: 'cleric', level: 1 }],
      spellcasting: { byClass: { cleric: { cantrips: ['sacred-flame'], prepared: ['bless'] } } },
    });
    expect(screen.queryByTestId('pending-illegal-spells')).toBeNull();
  });
});

describe('AdvancementPage - Progression Advisor subclass link', () => {
  it('links the "Choose a subclass" suggestion to Class & Features', () => {
    renderStateful({ level: 3, classes: [{ id: 'fighter', level: 3 }] });
    const advisor = screen.getByRole('list', { name: 'Advisor suggestions' });
    expect(within(advisor).getByText('Choose a subclass')).toBeInTheDocument();
    expect(within(advisor).getByRole('link', { name: 'Choose on Class & Features' })).toHaveAttribute(
      'href',
      '#character/build',
    );
  });

  it('shows no subclass link once a subclass is chosen', () => {
    renderStateful({
      level: 3,
      classes: [{ id: 'fighter', level: 3, subclassId: 'champion' }],
    });
    expect(screen.queryByRole('link', { name: 'Choose on Class & Features' })).toBeNull();
  });
});

describe('AdvancementPage - Progression Advisor action links', () => {
  const advisor = () => screen.getByRole('list', { name: 'Advisor suggestions' });

  it('links an open feat slot to the Feats section and scrolls and focuses it', () => {
    renderStateful({ level: 4, classes: [{ id: 'fighter', level: 4, subclassId: 'champion' }] });
    const link = within(advisor()).getByRole('link', { name: 'Choose in Feats & ASIs' });
    const target = document.getElementById('adv-section-feats')!;
    expect(target).not.toBeNull();
    const scroll = vi.fn();
    target.scrollIntoView = scroll;
    fireEvent.click(link);
    expect(scroll).toHaveBeenCalled();
    expect(document.activeElement).toBe(target);
  });

  it('links "You can level up" to the Next Level section', () => {
    renderStateful({ level: 4, classes: [{ id: 'fighter', level: 4, subclassId: 'champion' }] });
    const link = screen.getAllByRole('link', { name: 'Go to Next Level' })[0];
    const target = document.getElementById('adv-section-next-level')!;
    expect(target).not.toBeNull();
    fireEvent.click(link);
    expect(document.activeElement).toBe(target);
  });

  it('has no link on the informational Proficiency Bonus note', () => {
    renderStateful({ level: 4, classes: [{ id: 'fighter', level: 4, subclassId: 'champion' }] });
    const item = within(advisor()).getByText(/raises your Proficiency Bonus|Next level raises/).closest('li')!;
    expect(within(item).queryByRole('link')).toBeNull();
  });

  it('every suggestion that names an action has a link', () => {
    renderStateful({ level: 4, classes: [{ id: 'fighter', level: 4 }] });
    const items = within(advisor()).getAllByRole('listitem');
    for (const li of items) {
      const informational = /Proficiency Bonus/.test(li.textContent ?? '');
      expect(within(li).queryAllByRole('link').length > 0, li.textContent ?? '').toBe(!informational);
    }
  });
});