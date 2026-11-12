import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CombatPage } from '../../pages/CombatPage';
import { OverviewConditions } from '../../pages/character/OverviewConditions';
import type { Character } from '../../../types/character';
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

describe('structured condition duration on the Combat page', () => {
  it('sets a minutes duration (10 rounds per minute) and shows the remaining time', () => {
    renderPage({ conditions: [{ id: 'poisoned', ends: 'legacy note' }] });
    const row = screen.getByTestId('active-poisoned');
    fireEvent.change(within(row).getByLabelText('Poisoned duration kind'), { target: { value: 'minutes' } });
    fireEvent.change(within(row).getByLabelText('Poisoned duration amount'), { target: { value: '1' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Set Poisoned duration' }));
    expect(latest.conditions).toEqual([
      { id: 'poisoned', ends: 'legacy note', duration: { kind: 'minutes', rounds: 10 } },
    ]);
    expect(within(row).getByTestId('duration-remaining-poisoned')).toHaveTextContent('1 min left');
  });

  it('the manual tick takes one round off and ends the condition at 0', () => {
    renderPage({ conditions: [{ id: 'blinded', duration: { kind: 'rounds', rounds: 2 } }] });
    const tick = () => fireEvent.click(screen.getByRole('button', { name: 'Take one round off Blinded' }));
    tick();
    expect(latest.conditions).toEqual([{ id: 'blinded', duration: { kind: 'rounds', rounds: 1 } }]);
    tick();
    expect(latest.conditions).toBeUndefined();
    expect(latest.eventLog?.some((e) => e.type === 'condition-expired')).toBe(true);
  });

  it('a legacy free-text condition shows no timer and keeps its note', () => {
    renderPage({ conditions: [{ id: 'charmed', ends: 'save ends' }] });
    const row = screen.getByTestId('active-charmed');
    expect(within(row).getByText(/No timer/)).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /Take one round off/ })).toBeNull();
    expect(within(row).getByLabelText('Charmed ends note')).toHaveValue('save ends');
  });

  it('the concentration option is disabled when not concentrating', () => {
    renderPage({ conditions: [{ id: 'charmed' }] });
    const option = screen.getByRole('option', { name: 'While concentrating' }) as HTMLOptionElement;
    expect(option.disabled).toBe(true);
  });

  it('Next round ticks the timed conditions and says what ended', () => {
    renderPage({ conditions: [{ id: 'poisoned', duration: { kind: 'rounds', rounds: 1 } }] });
    fireEvent.click(screen.getByRole('button', { name: 'Start fight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next round' }));
    expect(latest.combat?.round).toBe(2);
    expect(latest.conditions).toBeUndefined();
    expect(screen.getByTestId('round-status')).toHaveTextContent('Ended: Poisoned');
  });
});

describe('structured condition duration on the Overview (read-only)', () => {
  it('shows the remaining duration with no editing controls', () => {
    const character = {
      ...createCharacter('Tester'),
      conditions: [{ id: 'poisoned' as const, duration: { kind: 'rounds' as const, rounds: 3 } }],
    };
    render(<OverviewConditions character={character} />);
    expect(screen.getByTestId('overview-duration-poisoned')).toHaveTextContent('3 rounds left');
    expect(screen.queryByRole('button', { name: /Take one round off/ })).toBeNull();
  });
});
