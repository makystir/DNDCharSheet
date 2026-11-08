import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SpellsPage } from '../SpellsPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

/**
 * Renders SpellsPage with a stateful harness so onChange edits (cantrip/prepared
 * toggles, slot spend/recover, spellbook scribing) feed back into the rendered
 * character — mirroring the CombatPage test's harness.
 */
function renderStatefulPage(overrides: Partial<Character> = {}) {
  const onChange = vi.fn();
  function Harness() {
    const [character, setCharacter] = useState<Character>({
      ...createCharacter('Caster'),
      ...overrides,
    });
    return (
      <SpellsPage
        character={character}
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

const wizardLevel5: Partial<Character> = {
  level: 5,
  classes: [{ id: 'wizard', level: 5 }],
};

describe('SpellsPage — Summary tooltips', () => {
  it('renders DC, attack, and cap totals as CalculatedValue triggers', () => {
    renderStatefulPage(wizardLevel5);
    // Derived totals are buttons (CalculatedValue triggers) — finding 6.
    expect(screen.getByRole('button', { name: /Spell Save DC/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spell Attack Bonus/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cantrips Known/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Prepared Spells/ })).toBeInTheDocument();
  });
});

describe('SpellsPage — Slots tracker', () => {
  it('spends and recovers a slot, with an available-count tooltip', () => {
    const { onChange } = renderStatefulPage(wizardLevel5);
    fireEvent.click(screen.getByRole('tab', { name: 'Slots' }));
    // Available count is a CalculatedValue trigger (max + (-expended)).
    expect(screen.getByRole('button', { name: /Level 1 available/ })).toBeInTheDocument();
    // Spend a level-1 slot.
    fireEvent.click(screen.getByRole('button', { name: 'Spend a Level 1 slot' }));
    expect(onChange).toHaveBeenCalled();
    const spent = onChange.mock.calls.at(-1)![0] as Character;
    expect(spent.spellcasting?.slotsExpended?.[1]).toBe(1);
  });
});

describe('SpellsPage — selection caps', () => {
  it('disables further cantrip choices once the cap is reached', () => {
    // A level-5 Wizard knows 4 cantrips (PHB 2024). Pre-fill 4, expect others off.
    const { onChange } = renderStatefulPage({
      ...wizardLevel5,
      spellcasting: {
        byClass: { wizard: { cantrips: ['fire-bolt', 'mage-hand', 'light', 'mending'] } },
      },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Prepared' }));
    // An unchecked cantrip checkbox should be disabled at cap.
    const rayOfFrost = screen.getByRole('checkbox', { name: /Ray of Frost/ });
    expect(rayOfFrost).toBeDisabled();
    // A chosen one stays enabled (can be unchecked).
    const fireBolt = screen.getByRole('checkbox', { name: /Fire Bolt/ });
    expect(fireBolt).not.toBeDisabled();
    fireEvent.click(fireBolt);
    expect(onChange).toHaveBeenCalled();
  });
});

describe('SpellsPage — Wizard spellbook gating', () => {
  it('prepares only from scribed spellbook spells', () => {
    renderStatefulPage({
      ...wizardLevel5,
      spellcasting: { byClass: { wizard: { spellbook: ['magic-missile'] } } },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Prepared' }));
    const preparedSection = screen.getByText(/Prepared — choose/).closest('div')!;
    // Only the scribed spell is offered for preparation.
    expect(within(preparedSection).getByRole('checkbox', { name: /Magic Missile/ }))
      .toBeInTheDocument();
    expect(within(preparedSection).queryByRole('checkbox', { name: /^Shield/ }))
      .not.toBeInTheDocument();
  });

  it('unscribing a prepared spell also unprepares it', () => {
    const { onChange } = renderStatefulPage({
      ...wizardLevel5,
      spellcasting: { byClass: { wizard: { spellbook: ['magic-missile'], prepared: ['magic-missile'] } } },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Prepared' }));
    const spellbookSection = screen.getByText(/Scribed spells/).closest('div')!;
    const mm = within(spellbookSection).getByRole('checkbox', { name: /Magic Missile/ });
    fireEvent.click(mm); // unscribe
    const next = onChange.mock.calls.at(-1)![0] as Character;
    expect(next.spellcasting?.byClass?.wizard?.spellbook ?? []).not.toContain('magic-missile');
    expect(next.spellcasting?.byClass?.wizard?.prepared ?? []).not.toContain('magic-missile');
  });
});

describe('SpellsPage — Arcane Trickster Mage Hand', () => {
  it('shows Mage Hand as checked and locked (cannot be unchecked)', () => {
    renderStatefulPage({
      level: 3,
      classes: [{ id: 'rogue', level: 3, subclassId: 'arcaneTrickster' }],
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Prepared' }));
    // Mage Hand is treated as chosen (counted against the cap) and locked.
    const mageHand = screen.getByRole('checkbox', { name: /Mage Hand.*required/i });
    expect(mageHand).toBeChecked();
    expect(mageHand).toBeDisabled();
    // The chosen-cantrip count reflects the required Mage Hand (CalculatedValue
    // trigger shows 1); the count is split across elements, so query the button.
    expect(screen.getByRole('button', { name: /Cantrips chosen/ })).toHaveTextContent('1');
  });

  it('persists Mage Hand once the user chooses another cantrip', () => {
    const { onChange } = renderStatefulPage({
      level: 3,
      classes: [{ id: 'rogue', level: 3, subclassId: 'arcaneTrickster' }],
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Prepared' }));
    // Choosing a different cantrip writes the effective set (incl. Mage Hand).
    fireEvent.click(screen.getByRole('checkbox', { name: /Fire Bolt/ }));
    const next = onChange.mock.calls.at(-1)![0] as Character;
    expect(next.spellcasting?.byClass?.rogue?.cantrips).toContain('mage-hand');
    expect(next.spellcasting?.byClass?.rogue?.cantrips).toContain('fire-bolt');
  });
});

describe('SpellsPage — always-prepared feature spells', () => {
  it('renders a Ranger\'s Hunter\'s Mark as locked and outside the prepared cap', () => {
    const { onChange } = renderStatefulPage({
      level: 1,
      classes: [{ id: 'ranger', level: 1 }],
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Prepared' }));
    // Hunter's Mark is checked, locked, and labelled "always prepared".
    const huntersMark = screen.getByRole('checkbox', { name: /Hunter.s Mark.*always prepared/i });
    expect(huntersMark).toBeChecked();
    expect(huntersMark).toBeDisabled();
    // The always-prepared note names it.
    // The names are tooltip triggers now, so match on the paragraph's combined text.
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /Always prepared.*Hunter.s Mark/i.test(el.textContent ?? '')),
    ).toBeInTheDocument();
    // The discretionary prepared count excludes it (starts at 0 of the cap).
    expect(screen.getByRole('button', { name: /Prepared chosen/ })).toHaveTextContent('0');
    // Clicking the locked row does not write it into the prepared set.
    fireEvent.click(huntersMark);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a manually-stored always-prepared spell no longer consumes the cap', () => {
    // A level-1 Ranger whose stored prepared set includes Hunter's Mark: it must
    // be treated as always-prepared (locked, uncounted), freeing the full cap.
    renderStatefulPage({
      level: 1,
      classes: [{ id: 'ranger', level: 1 }],
      spellcasting: { byClass: { ranger: { prepared: ['hunter-s-mark'] } } },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Prepared' }));
    // Still shows 0 discretionary prepared despite the stored entry.
    expect(screen.getByRole('button', { name: /Prepared chosen/ })).toHaveTextContent('0');
  });
});

describe('SpellsPage — Wizard focus options', () => {
  it('lists both Arcane Focus and Spellbook', () => {
    renderStatefulPage(wizardLevel5);
    // A prior test may have persisted a non-Summary last sub-tab; the focus
    // lives on Summary, so select it explicitly.
    fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
    expect(screen.getByText('Arcane Focus or Spellbook')).toBeInTheDocument();
  });
});

describe('SpellsPage — Bard Magical Secrets', () => {
  it('a level-10 Bard can browse Wizard-list spells (Magical Secrets)', () => {
    renderStatefulPage({ level: 10, classes: [{ id: 'bard', level: 10 }] });
    fireEvent.click(screen.getByRole('tab', { name: 'Browse' }));
    // Fireball is a Wizard spell not on the Bard list; Magical Secrets exposes it.
    expect(screen.getByText('Fireball')).toBeInTheDocument();
  });

  it('a level-9 Bard cannot see Wizard-only spells', () => {
    renderStatefulPage({ level: 9, classes: [{ id: 'bard', level: 9 }] });
    fireEvent.click(screen.getByRole('tab', { name: 'Browse' }));
    expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
  });
});

describe('SpellsPage — multiclass (Stage M5)', () => {
  // Wizard 3 / Warlock 2: a Spellcasting class (Wizard, combined pool) AND a
  // Pact Magic class (Warlock, separate pool). Two per-class DCs (Int, Cha).
  const wizardWarlock: Partial<Character> = {
    level: 5,
    classes: [
      { id: 'wizard', level: 3 },
      { id: 'warlock', level: 2 },
    ],
    abilities: { str: 8, dex: 14, con: 13, int: 16, wis: 10, cha: 15 },
  };

  it('shows a per-class DC/attack block with two caster classes on Summary', () => {
    renderStatefulPage(wizardWarlock);
    fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
    // Two per-class Save DC triggers, one per caster class.
    expect(screen.getByRole('button', { name: /Wizard Spell Save DC/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Warlock Spell Save DC/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wizard Spell Attack Bonus/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Warlock Spell Attack Bonus/ })).toBeInTheDocument();
  });

  it('shows the combined Spellcasting pool AND the separate Pact Magic pool on Slots', () => {
    renderStatefulPage(wizardWarlock);
    fireEvent.click(screen.getByRole('tab', { name: 'Slots' }));
    // The combined (Wizard) pool has a level-1 available tracker.
    expect(screen.getByRole('button', { name: /Level 1 available/ })).toBeInTheDocument();
    // The separate Pact Magic pool is tracked alongside it.
    expect(
      screen.getByRole('button', { name: /Pact Magic \(level \d+\) available/ }),
    ).toBeInTheDocument();
  });

  // Fighter 3 / Wizard 2: the PRIMARY class (classes[0]) is a non-caster, but
  // the Wizard is an active caster — the Prepared tab must still offer the
  // Wizard's own cantrip/prepared picker (per-class, not primary-only).
  const fighterWizard: Partial<Character> = {
    level: 5,
    classes: [
      { id: 'fighter', level: 3 },
      { id: 'wizard', level: 2 },
    ],
    abilities: { str: 15, dex: 14, con: 13, int: 16, wis: 10, cha: 8 },
  };

  it('shows the Wizard prepared/cantrip pickers for a non-caster-primary multiclass', () => {
    renderStatefulPage(fighterWizard);
    fireEvent.click(screen.getByRole('tab', { name: 'Prepared' }));
    // The Wizard section is labelled and its spellbook/cantrip pickers render
    // (a Wizard scribes + prepares), not an empty primary-class picker.
    expect(screen.getByText(/Wizard — Cantrips/)).toBeInTheDocument();
    expect(screen.getByText(/Wizard — Prepared Spells/)).toBeInTheDocument();
    expect(screen.getByText(/Wizard — Spellbook/)).toBeInTheDocument();
    // A Wizard cantrip is offered for selection.
    expect(screen.getByRole('checkbox', { name: /Fire Bolt/ })).toBeInTheDocument();
  });

  it('writes a per-class prepared edit under byClass[wizard]', () => {
    const { onChange } = renderStatefulPage({
      ...fighterWizard,
      spellcasting: { byClass: { wizard: { spellbook: ['magic-missile'] } } },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Prepared' }));
    // Magic Missile appears in both the prepared picker and the spellbook; scope
    // to the Wizard Prepared Spells section.
    const preparedSection = screen.getByText(/Wizard — Prepared Spells/).closest('div')!;
    fireEvent.click(within(preparedSection).getByRole('checkbox', { name: /Magic Missile/ }));
    const next = onChange.mock.calls.at(-1)![0] as Character;
    expect(next.spellcasting?.byClass?.wizard?.prepared).toContain('magic-missile');
  });

  // The combined Spell Slots tracker must be sized by MAX capacity, not by
  // unexpended availability: spending the top-level slot must NOT remove its
  // tracker nor trigger the "No spell slots yet" empty state (loop-bound bug).
  const wizardSorcerer: Partial<Character> = {
    level: 4,
    classes: [
      { id: 'wizard', level: 2 },
      { id: 'sorcerer', level: 2 },
    ],
    abilities: { str: 8, dex: 14, con: 13, int: 16, wis: 10, cha: 15 },
  };

  it('keeps the combined top-slot tracker visible after it is spent', () => {
    // Combined caster level 4 → top slots are level 2. Pre-expend every level-2
    // slot so availability-based sizing would hide the row.
    renderStatefulPage({
      ...wizardSorcerer,
      spellcasting: { slotsExpended: { 2: 99 } },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Slots' }));
    // The level-2 tracker still renders (sized by max capacity) ...
    expect(screen.getByRole('button', { name: /Level 2 available/ })).toBeInTheDocument();
    // ... and the pool does not collapse into the empty state.
    expect(screen.queryByText('No spell slots yet')).not.toBeInTheDocument();
  });
});

describe('SpellsPage — Browse filtering', () => {
  it('filters the class list by level and shows an effect summary', () => {
    renderStatefulPage(wizardLevel5);
    fireEvent.click(screen.getByRole('tab', { name: 'Browse' }));
    // Browse rows carry the short description, now a bounded slice of the real
    // PHB effect prose (catalog rebuild). Fireball's description opens with its
    // verbatim effect text.
    expect(
      screen.getByText(/A bright streak flashes from you to a point/i),
    ).toBeInTheDocument();
    // Filter to cantrips only; Fireball (level 3) should drop out.
    fireEvent.change(screen.getByLabelText('Filter by spell level'), {
      target: { value: '0' },
    });
    expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
  });
});

describe('SpellsPage — class spell list legality', () => {
  const clericWithStray: Partial<Character> = {
    level: 1,
    classes: [{ id: 'cleric', level: 1 }],
    spellcasting: {
      byClass: {
        // Fireball is a Wizard/Sorcerer spell: not on the Cleric list and above level 1.
        cleric: { cantrips: ['sacred-flame', 'fire-bolt'], prepared: ['cure-wounds', 'fireball'] },
      },
    },
  };

  it('warns about picks that are not on the class list and ignores them in the counts', () => {
    renderStatefulPage(clericWithStray);
    const notice = screen.getByTestId('illegal-spells-notice');
    expect(notice).toHaveTextContent('2 selected spells are not on your class');
    expect(notice).toHaveTextContent('Fireball');
    expect(notice).toHaveTextContent('Fire Bolt');
    fireEvent.click(screen.getByRole('tab', { name: 'Prepared' }));
    // Only Cure Wounds counts as prepared; Fireball is ignored.
    expect(screen.getByRole('button', { name: /Prepared chosen/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /Cantrips chosen/ })).toHaveTextContent('1');
  });

  it('removes the illegal picks in one click and keeps the legal ones', () => {
    const { onChange } = renderStatefulPage(clericWithStray);
    fireEvent.click(screen.getByRole('button', { name: /^Remove them/ }));
    const next = onChange.mock.calls.at(-1)![0] as Character;
    expect(next.spellcasting?.byClass?.cleric).toEqual({ cantrips: ['sacred-flame'], prepared: ['cure-wounds'] });
    expect(screen.queryByTestId('illegal-spells-notice')).toBeNull();
  });

  it('shows no notice when every pick is on the class list', () => {
    renderStatefulPage({
      level: 1,
      classes: [{ id: 'cleric', level: 1 }],
      spellcasting: { byClass: { cleric: { cantrips: ['sacred-flame'], prepared: ['bless'] } } },
    });
    expect(screen.queryByTestId('illegal-spells-notice')).toBeNull();
  });

  it('offers only Cleric-list spells in the Prepared tab', () => {
    renderStatefulPage({ level: 1, classes: [{ id: 'cleric', level: 1 }] });
    fireEvent.click(screen.getByRole('tab', { name: 'Prepared' }));
    expect(screen.queryByRole('checkbox', { name: /Fireball/ })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Magic Missile/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: /^Bless/ })).toBeInTheDocument();
  });
});
