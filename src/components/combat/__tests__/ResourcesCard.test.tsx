import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ResourcesCard } from '../ResourcesCard';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

let latest: Character;

function Harness({ initial }: { initial: Character }) {
  const [character, setCharacter] = useState<Character>(initial);
  return (
    <ResourcesCard
      character={character}
      onChange={(next) => {
        latest = next;
        setCharacter(next);
      }}
    />
  );
}

/** Level 3 Fighter: Second Wind (max 2, PHB L4158-4179 table) and Action Surge (max 1). */
function fighter(overrides: Partial<Character> = {}): Character {
  return {
    ...createCharacter('Tester'),
    level: 3,
    classes: [{ id: 'fighter', level: 3 }],
    ...overrides,
  };
}

function row(name: string): HTMLElement {
  const found = screen.getAllByTestId('resource-row').find((r) => within(r).queryByText(name));
  if (!found) throw new Error(`no row for ${name}`);
  return found;
}

describe('ResourcesCard', () => {
  it('renders nothing when the character has no limited-use features', () => {
    const { container } = render(<Harness initial={createCharacter('Empty')} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows remaining / max, recharge text and labelled controls', () => {
    render(<Harness initial={fighter()} />);
    const r = row('Second Wind');
    expect(within(r).getByTestId('resource-count')).toHaveTextContent('2 / 2 uses');
    expect(within(r).getByText(/Recharge: Short Rest: regain 1\. Long Rest: regain all/)).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: 'Spend one use of Second Wind' })).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: 'Regain one use of Second Wind' })).toBeDisabled();
    expect(within(r).getByLabelText('Second Wind remaining')).toHaveValue(2);
  });

  it('spends and regains one use, clamping at the ends', () => {
    render(<Harness initial={fighter()} />);
    const r = row('Action Surge');
    const spend = within(r).getByRole('button', { name: 'Spend one use of Action Surge' });
    fireEvent.click(spend);
    expect(latest.resourcesSpent).toEqual({ 'fighter.action-surge': 1 });
    expect(within(r).getByTestId('resource-count')).toHaveTextContent('0 / 1');
    expect(spend).toBeDisabled();
    fireEvent.click(within(r).getByRole('button', { name: 'Regain one use of Action Surge' }));
    expect(latest.resourcesSpent).toBeUndefined();
    expect(within(r).getByTestId('resource-count')).toHaveTextContent('1 / 1');
  });

  it('sets remaining manually and clamps into 0..max', () => {
    render(<Harness initial={fighter()} />);
    const r = row('Second Wind');
    const input = within(r).getByLabelText('Second Wind remaining');
    fireEvent.change(input, { target: { value: '0' } });
    expect(latest.resourcesSpent).toEqual({ 'fighter.second-wind': 2 });
    fireEvent.change(input, { target: { value: '9' } });
    expect(latest.resourcesSpent).toBeUndefined();
    expect(within(r).getByTestId('resource-count')).toHaveTextContent('2 / 2');
  });

  it('shows the max breakdown tooltip with components that sum to the max', () => {
    render(<Harness initial={fighter()} />);
    const r = row('Second Wind');
    fireEvent.mouseEnter(within(r).getByRole('button', { name: /Second Wind maximum/ }));
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent(/Fighter level 3/);
    expect(tip).toHaveTextContent('2');
  });

  it('shows a content tooltip on the feature name', () => {
    render(<Harness initial={fighter()} />);
    const r = row('Second Wind');
    fireEvent.mouseEnter(within(r).getByRole('button', { name: 'Second Wind' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Second Wind/);
  });

  it('shows the also-restored hint and the spending features (Bardic Inspiration)', () => {
    const bard: Character = {
      ...createCharacter('Bard'),
      level: 5,
      classes: [{ id: 'bard', level: 5 }],
      abilities: { ...createCharacter('x').abilities, cha: 16 },
    };
    render(<Harness initial={bard} />);
    const r = row('Font of Inspiration');
    expect(within(r).getByText(/Also restored by:/)).toBeInTheDocument();
    expect(within(r).getByText(/Recharge: Short or Long Rest/)).toBeInTheDocument();
  });
});
