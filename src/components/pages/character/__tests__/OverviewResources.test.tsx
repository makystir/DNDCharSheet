import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { OverviewResources } from '../OverviewResources';
import type { Character } from '../../../../types/character';
import { createCharacter } from '../../../../storage/character-store';

function fighter(overrides: Partial<Character> = {}): Character {
  return {
    ...createCharacter('Tester'),
    level: 3,
    classes: [{ id: 'fighter', level: 3 }],
    ...overrides,
  };
}

describe('OverviewResources', () => {
  it('lists remaining / max read-only with a Manage on Combat link', () => {
    render(<OverviewResources character={fighter({ resourcesSpent: { 'fighter.second-wind': 1 } })} />);
    const rows = screen.getAllByTestId('overview-resource');
    const second = rows.find((r) => within(r).queryByText('Second Wind'));
    expect(second).toHaveTextContent('1 / 2 uses');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('button', { name: /Spend|Regain/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Manage on Combat' })).toHaveAttribute('href', '#combat');
  });

  it('opens a breakdown tooltip on the max', () => {
    render(<OverviewResources character={fighter()} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Action Surge maximum/ }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Fighter level 3/);
  });

  it('shows the empty state with a link when there are no trackers', () => {
    render(<OverviewResources character={createCharacter('Empty')} />);
    expect(screen.getByTestId('overview-empty')).toHaveTextContent('No limited-use features yet');
    expect(screen.getByRole('link', { name: 'Manage on Combat' })).toBeInTheDocument();
  });
});
