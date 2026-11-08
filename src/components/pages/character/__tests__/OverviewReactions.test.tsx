import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { OverviewReactions } from '../OverviewReactions';
import { createCharacter } from '../../../../storage/character-store';
import type { Character } from '../../../../types/character';

afterEach(cleanup);

function make(overrides: Partial<Character>): Character {
  return {
    ...createCharacter('Tester'),
    level: 5,
    classes: [{ id: 'rogue', level: 5 }],
    ...overrides,
  };
}

const wizard = (extra: Partial<Character> = {}): Character =>
  make({
    classes: [{ id: 'wizard', level: 5 }],
    spellcasting: { byClass: { wizard: { prepared: ['shield', 'counterspell'] } } },
    ...extra,
  });

const spentTurn = {
  inCombat: true,
  round: 1,
  combatants: [],
  activeIndex: 0,
  turn: {
    actionUsed: false,
    bonusUsed: false,
    reactionUsed: true,
    objectInteractionUsed: false,
    movementUsed: 0,
    dashes: 0,
  },
};

describe('OverviewReactions', () => {
  it('shows just Opportunity Attack when there is nothing else', () => {
    render(<OverviewReactions character={make({ classes: [{ id: 'fighter', level: 5 }] })} />);
    const rows = screen.getAllByTestId('overview-reaction');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Opportunity Attack');
    expect(screen.getByTestId('overview-reaction-status')).toHaveTextContent('Reaction available');
  });

  it('shows the footer note and the Combat link', () => {
    render(<OverviewReactions character={make({})} />);
    expect(screen.getByText('Absorb Elements and the Ready action are not listed.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reaction used? Manage on Combat' })).toHaveAttribute(
      'href',
      '#combat',
    );
  });

  it('lists class features with a kind tag', () => {
    render(<OverviewReactions character={make({})} />);
    const row = screen.getByText('Uncanny Dodge').closest('li') as HTMLElement;
    expect(within(row).getByText(/Class feature/)).toBeInTheDocument();
  });

  it('lists subclass, feat, species and class-choice reactions with a label and origin', () => {
    render(
      <OverviewReactions
        character={make({
          classes: [{ id: 'fighter', level: 3, subclassId: 'battleMaster' }],
          advancement: { feats: [{ featId: 'shield-master', level: 0 }, { featId: 'interception', level: 0 }] },
          species: { id: 'goliath', giantAncestry: 'stone' },
          classChoices: { 'fighter.maneuvers': ['parry'] },
        })}
      />,
    );
    const tag = (name: string) => (screen.getByText(name).closest('li') as HTMLElement).textContent ?? '';
    expect(tag('Shield Master: Interpose Shield')).toContain('Feat \u00B7 Shield Master');
    expect(tag('Interception')).toContain('Fighting Style feat \u00B7 Interception');
    expect(tag("Stone's Endurance")).toContain('Species \u00B7 Goliath');
    expect(tag('Maneuver: Parry')).toContain('Class choice \u00B7 Battle Master');
  });

  it('greys a subclass reaction whose limited-use pool is empty and says why', () => {
    render(
      <OverviewReactions
        character={make({
          classes: [{ id: 'cleric', level: 3, subclassId: 'light' }],
          resourcesSpent: { 'cleric.warding-flare': 99 },
        })}
      />,
    );
    const row = screen.getByText('Warding Flare').closest('li') as HTMLElement;
    expect(within(row).getByText(/Subclass feature/)).toBeInTheDocument();
    expect(within(row).getByText('No uses left')).toBeInTheDocument();
  });

  it('shows spell entries with their level', () => {
    render(
      <OverviewReactions
        character={wizard({ spellcasting: { byClass: { wizard: { prepared: ['shield', 'counterspell'] } } } })}
      />,
    );
    const shield = screen.getByText('Shield').closest('li') as HTMLElement;
    expect(shield).toHaveTextContent('Spell');
    expect(shield).toHaveTextContent('Level 1');
    const counter = screen.getByText('Counterspell').closest('li') as HTMLElement;
    expect(counter).toHaveTextContent('Level 3');
  });

  it('greys a spell with no slot and says why', () => {
    render(
      <OverviewReactions
        character={wizard({
          spellcasting: {
            byClass: { wizard: { prepared: ['shield'] } },
            slotsExpended: { 1: 4, 2: 3, 3: 2 },
          },
        })}
      />,
    );
    const shield = screen.getByText('Shield').closest('li') as HTMLElement;
    expect(shield).toHaveTextContent('No spell slot available');
    expect(screen.getByTestId('overview-reaction-status')).toHaveTextContent('Reaction available');
  });

  it('marks every row spent when the Reaction is used', () => {
    render(<OverviewReactions character={make({ combat: spentTurn })} />);
    expect(screen.getByTestId('overview-reaction-status')).toHaveTextContent(
      'Reaction used this round',
    );
    for (const row of screen.getAllByTestId('overview-reaction')) {
      expect(row).toHaveTextContent('Reaction already used');
    }
  });

  it('marks every row Incapacitated and says the character cannot react', () => {
    render(<OverviewReactions character={make({ conditions: [{ id: 'stunned' }], combat: spentTurn })} />);
    expect(screen.getByTestId('overview-reaction-status')).toHaveTextContent(
      "Can't take Reactions (Incapacitated)",
    );
    for (const row of screen.getAllByTestId('overview-reaction')) {
      expect(row).toHaveTextContent('Incapacitated');
    }
  });

  it('expands a summary with an accessible Show more button', () => {
    render(<OverviewReactions character={make({})} />);
    const button = screen.getAllByRole('button', { name: 'Show more' })[0];
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
