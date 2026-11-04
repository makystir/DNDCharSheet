import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CombatPage } from '../../pages/CombatPage';
import type { ActiveCondition, Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

let latest: Character;

function Harness({ initial }: { initial: Character }) {
  const [character, setCharacter] = useState<Character>(initial);
  return (
    <CombatPage
      character={character}
      onChange={(next) => {
        latest = next;
        setCharacter(next);
      }}
    />
  );
}

function renderPage(overrides: Partial<Character> = {}) {
  const initial = { ...createCharacter('Tester'), ...overrides };
  latest = initial;
  render(<Harness initial={initial} />);
}

describe('Active Conditions on the Combat page', () => {
  it('shows an empty state with an Add Condition control', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Active Conditions' })).toBeInTheDocument();
    expect(screen.getByText('No Conditions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Condition/ })).toBeInTheDocument();
  });

  it('opens the picker listing all 15 PHB conditions', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));
    const grid = screen.getByTestId('condition-grid');
    expect(grid.children).toHaveLength(15);
    expect(screen.getByRole('dialog', { name: 'Condition Picker' })).toBeInTheDocument();
  });

  it('applies a condition from the picker, shows its badge, and persists additive-optional state', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply Paralyzed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close condition picker' }));
    expect(latest.conditions).toEqual([{ id: 'paralyzed' }]);
    expect(latest.exhaustionLevel).toBeUndefined();
    const row = screen.getByTestId('active-paralyzed');
    expect(within(row).getByText('Paralyzed')).toBeInTheDocument();
    // Implied condition is reported read-only and NOT auto-applied.
    expect(within(row).getByText(/Also applies: Incapacitated/)).toBeInTheDocument();
    expect(latest.conditions?.some((c) => c.id === 'incapacitated')).toBe(false);
  });

  it('tapping an already-active non-stackable condition does not stack', () => {
    renderPage({ conditions: [{ id: 'poisoned' }] });
    fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Poisoned already applied' }));
    expect(latest.conditions).toEqual([{ id: 'poisoned' }]);
  });

  it('removes a condition via its badge remove control', () => {
    renderPage({ conditions: [{ id: 'prone' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Prone' }));
    expect('conditions' in latest).toBe(false);
    expect(screen.getByText('No Conditions')).toBeInTheDocument();
  });

  it('shows a descriptive content tooltip on the badge name', () => {
    renderPage({ conditions: [{ id: 'blinded' }] });
    fireEvent.click(within(screen.getByTestId('active-blinded')).getByRole('button', { name: 'Blinded' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/cannot see/i);
  });

  it('shows the info tooltip for a condition inside the picker', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Info for Restrained' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Speed drops to 0/);
  });

  it('de-duplicates repeated persisted ids and tolerates unknown ids (no duplicate React keys)', () => {
    const errors: unknown[][] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
    try {
      renderPage({
        conditions: [
          { id: 'poisoned' },
          { id: 'poisoned', ends: 'dup' },
          { id: 'not-a-condition' } as unknown as ActiveCondition,
          { id: 'not-a-condition' } as unknown as ActiveCondition,
        ],
      });
      expect(screen.getAllByTestId('active-poisoned')).toHaveLength(1);
      expect(screen.getAllByTestId('active-not-a-condition')).toHaveLength(1);
      const keyWarnings = errors.filter((a) => /same key|unique "key"/.test(String(a[0])));
      expect(keyWarnings).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it('records a free-text ends note', () => {
    renderPage({ conditions: [{ id: 'frightened' }] });
    fireEvent.change(screen.getByLabelText('Frightened ends note'), {
      target: { value: 'save ends' },
    });
    expect(latest.conditions).toEqual([{ id: 'frightened', ends: 'save ends' }]);
  });

  it('hides the Exhaustion stepper at level 0 and builds levels up to 6 via the picker', () => {
    renderPage();
    expect(screen.queryByRole('group', { name: 'Exhaustion level' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));
    for (let i = 0; i < 8; i++) {
      const btn =
        screen.queryByRole('button', { name: 'Add Exhaustion level' }) ??
        screen.getByRole('button', { name: /Exhaustion is at maximum/ });
      fireEvent.click(btn);
    }
    expect(latest.exhaustionLevel).toBe(6);
    expect(latest.conditions ?? []).toEqual([]);
  });

  it('exhaustion stepper clamps, shows penalties with breakdown tooltips, and flags death at 6', () => {
    renderPage({ exhaustionLevel: 5 });
    const row = screen.getByTestId('active-exhaustion');
    expect(within(row).getByRole('button', { name: /Exhaustion D20 Test penalty/ })).toHaveTextContent('-10');
    expect(within(row).getByRole('button', { name: /Exhaustion Speed reduction/ })).toHaveTextContent('-25 ft');
    const inc = within(row).getByRole('button', { name: 'Increase Exhaustion level' });
    fireEvent.click(inc);
    expect(latest.exhaustionLevel).toBe(6);
    expect(screen.getByRole('alert')).toHaveTextContent(/dies/);
    expect(within(screen.getByTestId('active-exhaustion')).getByRole('button', { name: 'Increase Exhaustion level' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Exhaustion level' }));
    expect(latest.exhaustionLevel).toBe(5);
  });

  it('decreasing from level 1 clears Exhaustion entirely', () => {
    renderPage({ exhaustionLevel: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Exhaustion level' }));
    expect('exhaustionLevel' in latest).toBe(false);
    expect(screen.queryByTestId('active-exhaustion')).toBeNull();
  });

  it('exhaustion penalties are informational: AC and Initiative displays are unchanged', () => {
    // Stage A5e: AC renders in both Core Stats and the Defend-mode readout, so
    // read the first AC trigger (they share one breakdown). Exhaustion changes
    // neither the static AC nor Initiative display (D1: it is a roll-time note).
    const { unmount } = render(<Harness initial={createCharacter('Tester')} />);
    const ac = screen.getAllByRole('button', { name: /Armor Class/ })[0].textContent;
    const init = screen.getByRole('button', { name: /^Initiative/ }).textContent;
    unmount();
    renderPage({ exhaustionLevel: 4 });
    expect(screen.getAllByRole('button', { name: /Armor Class/ })[0].textContent).toBe(ac);
    expect(screen.getByRole('button', { name: /^Initiative/ }).textContent).toBe(init);
  });
});
