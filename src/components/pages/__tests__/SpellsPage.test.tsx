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
    expect(screen.getByText(/Always prepared.*Hunter.s Mark/i)).toBeInTheDocument();
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
