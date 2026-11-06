import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { OverviewConditions } from '../OverviewConditions';
import { createCharacter } from '../../../../storage/character-store';
import type { ActiveCondition, Character } from '../../../../types/character';
import { CONDITIONS, getCondition } from '../../../../data/conditions';
import { exhaustionEffects } from '../../../../logic/conditions';

afterEach(cleanup);

function make(overrides: Partial<Character>): Character {
  return {
    ...createCharacter('Tester'),
    level: 5,
    classes: [{ id: 'fighter', level: 5 }],
    ...overrides,
  };
}

describe('OverviewConditions', () => {
  it('shows a calm empty state with a Combat link', () => {
    render(<OverviewConditions character={make({})} />);
    expect(screen.getByText('No active conditions')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage conditions on Combat' })).toHaveAttribute(
      'href',
      '#combat',
    );
    expect(screen.queryByTestId('overview-death-saves')).toBeNull();
  });

  it('renders every non-Exhaustion condition with its catalog effect text', () => {
    const stored = CONDITIONS.filter((c) => c.id !== 'exhaustion').map(
      (c) => ({ id: c.id }) as ActiveCondition,
    );
    render(<OverviewConditions character={make({ conditions: stored })} />);
    for (const c of CONDITIONS.filter((x) => x.id !== 'exhaustion')) {
      const item = screen.getByTestId(`overview-condition-${c.id}`);
      for (const effect of getCondition(c.id)?.effects ?? []) {
        expect(within(item).getByText(effect, { exact: true })).toBeInTheDocument();
      }
    }
  });

  it('shows Exhaustion with the level penalties from the logic', () => {
    render(<OverviewConditions character={make({ exhaustionLevel: 2 })} />);
    const item = screen.getByTestId('overview-condition-exhaustion');
    const fx = exhaustionEffects(2);
    expect(item).toHaveTextContent('Exhaustion (2)');
    expect(
      within(item).getByRole('button', { name: /Exhaustion D20 Test penalty/ }).textContent,
    ).toBe(String(fx.d20Test.total));
    expect(within(item).getByRole('button', { name: /Exhaustion Speed reduction/ })).toHaveTextContent(
      `${fx.speed.total} ft`,
    );
  });

  it('shows conditions implied by a stored condition', () => {
    render(<OverviewConditions character={make({ conditions: [{ id: 'paralyzed' }] })} />);
    expect(screen.getByTestId('overview-condition-paralyzed')).toBeInTheDocument();
    const implied = screen.getByTestId('overview-condition-incapacitated');
    expect(implied).toHaveTextContent('implied by Paralyzed');
  });

  it('shows 0-HP derived conditions and death saves only at 0 HP', () => {
    const down = make({ currentHp: 0, hpMax: 30, deathSaves: { successes: 2, failures: 1 } });
    render(<OverviewConditions character={down} />);
    expect(screen.getByTestId('overview-condition-unconscious')).toHaveTextContent('from 0 HP');
    expect(screen.getByTestId('overview-death-saves')).toBeInTheDocument();
    expect(screen.getByLabelText('Successes 2 of 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Failures 1 of 3')).toBeInTheDocument();
    cleanup();

    render(<OverviewConditions character={make({ currentHp: 10, hpMax: 30 })} />);
    expect(screen.queryByTestId('overview-death-saves')).toBeNull();
  });

  it('shows a Concentration chip with the spell name', () => {
    render(<OverviewConditions character={make({ concentration: { spellId: 'bless' } })} />);
    expect(screen.getByTestId('overview-concentration')).toHaveTextContent('Concentrating: Bless');
  });

  it('summarises attack Advantage/Disadvantage from conditions', () => {
    render(<OverviewConditions character={make({ conditions: [{ id: 'poisoned' }] })} />);
    expect(screen.getByTestId('overview-attack-suggestions')).toHaveTextContent(
      'Your attacks: Disadvantage (Poisoned)',
    );
  });
});
