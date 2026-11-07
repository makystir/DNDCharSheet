import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { OverviewSetup } from '../OverviewSetup';
import { createCharacter } from '../../../../storage/character-store';
import type { Character } from '../../../../types/character';

afterEach(cleanup);

describe('OverviewSetup', () => {
  it('renders nothing when no choices are pending', () => {
    const fighter: Character = {
      ...createCharacter('Done'),
      classes: [{ id: 'fighter', level: 1, skillChoices: ['athletics', 'acrobatics'] }],
    };
    const { container } = render(<OverviewSetup character={fighter} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing without a class', () => {
    const { container } = render(<OverviewSetup character={createCharacter('None')} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the open choices with counts and links, and the friendly intro', () => {
    const wizard: Character = {
      ...createCharacter('Wiz'),
      classes: [{ id: 'wizard', level: 1, skillChoices: ['arcana'] }],
    };
    render(<OverviewSetup character={wizard} />);
    expect(screen.getByRole('heading', { name: 'Finish setting up' })).toBeInTheDocument();
    expect(
      screen.getByText(/A few choices are still open\. Finish them any time/),
    ).toBeInTheDocument();
    const skills = screen.getByTestId('overview-setup-class-skills');
    expect(skills).toHaveTextContent('Class skills');
    expect(skills).toHaveTextContent('1 of 2');
    expect(within(skills).getByRole('link')).toHaveAttribute('href', '#character/build');
    for (const [kind, text] of [
      ['cantrips', '0 of 3'],
      ['spellbook', '0 of 6'],
      ['prepared', '0 of 4'],
    ] as const) {
      const row = screen.getByTestId('overview-setup-' + kind);
      expect(row).toHaveTextContent(text);
      expect(within(row).getByRole('link')).toHaveAttribute('href', '#spells');
    }
  });

  it('is read-only: it has no buttons or inputs', () => {
    const rogue: Character = { ...createCharacter('R'), classes: [{ id: 'rogue', level: 1 }] };
    render(<OverviewSetup character={rogue} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('names the class for each item on a multiclass caster', () => {
    const multi: Character = {
      ...createCharacter('M'),
      level: 2,
      classes: [
        { id: 'cleric', level: 1, skillChoices: ['history', 'insight'] },
        { id: 'wizard', level: 1 },
      ],
    };
    render(<OverviewSetup character={multi} />);
    expect(screen.getByText('Wizard spellbook spells')).toBeInTheDocument();
    expect(screen.getByText('Cleric cantrips')).toBeInTheDocument();
  });
});
