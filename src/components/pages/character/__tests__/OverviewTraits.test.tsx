import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { OverviewTraits } from '../OverviewTraits';
import { createCharacter } from '../../../../storage/character-store';
import type { Character } from '../../../../types/character';
import { getFeat } from '../../../../data/feats';
import { proficiencyBonus } from '../../../../logic/abilities';
import { speciesTraits } from '../../../../logic/species';

afterEach(cleanup);

function make(overrides: Partial<Character>): Character {
  return {
    ...createCharacter('Tester'),
    level: 5,
    classes: [{ id: 'fighter', level: 5 }],
    ...overrides,
  };
}

const withFeats = make({
  advancement: {
    feats: [
      { featId: 'alert', level: 0 },
      { featId: 'lucky', level: 0 },
      { featId: 'tough', level: 4 },
      {
        featId: 'skilled',
        level: 0,
        choices: { skills: ['stealth'], tools: ['Thieves\u2019 Tools'], notes: 'Chosen at creation' },
      },
    ],
  },
});

describe('OverviewTraits', () => {
  it('renders feats with the catalog effect, labelling level-0 feats Origin (Background)', () => {
    render(<OverviewTraits character={withFeats} />);
    const feats = screen.getAllByTestId('overview-feat');
    expect(feats).toHaveLength(4);
    const alert = feats[0];
    expect(alert).toHaveTextContent('Alert');
    expect(alert).toHaveTextContent('Origin (Background)');
    expect(within(alert).getByText(getFeat('alert')!.effect)).toBeInTheDocument();
    const tough = feats[2];
    expect(tough).toHaveTextContent('Tough');
    expect(tough).toHaveTextContent('Feat');
    expect(tough).not.toHaveTextContent('Origin (Background)');
    expect(within(tough).getByText(getFeat('tough')!.effect)).toBeInTheDocument();
  });

  it('shows Lucky Luck Points derived from the Proficiency Bonus', () => {
    render(<OverviewTraits character={withFeats} />);
    const lucky = screen.getByTestId('overview-lucky');
    expect(lucky).toHaveTextContent(
      `Luck Points: up to ${proficiencyBonus(5)} per Long Rest`,
    );
    expect(within(lucky).getByRole('button', { name: /Proficiency Bonus/ })).toBeInTheDocument();
  });

  it('shows recorded feat choices as a muted second line', () => {
    render(<OverviewTraits character={withFeats} />);
    expect(screen.getByText(/Skills: Stealth/)).toHaveTextContent('Chosen at creation');
  });

  it('renders species traits for a species with choices, without dev notes', () => {
    const character = make({
      species: { id: 'dragonborn', draconicAncestry: 'black' },
    });
    render(<OverviewTraits character={character} />);
    const traits = speciesTraits(character);
    expect(traits.length).toBeGreaterThan(0);
    const rendered = screen.getAllByTestId('overview-species-trait');
    expect(rendered).toHaveLength(traits.length);
    for (const trait of traits) {
      expect(screen.getByText(trait.name)).toBeInTheDocument();
      expect(screen.getByText(trait.effect)).toBeInTheDocument();
    }
    expect(document.body.textContent).not.toMatch(/later stage/i);
  });

  it('has a single card header that is also the collapse toggle', () => {
    render(<OverviewTraits character={withFeats} />);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Traits & Feats',
    ]);
    expect(screen.queryByText(/Traits, feats and features/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Traits & Feats' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('lists class features gained so far with a link to Class & Features', () => {
    render(<OverviewTraits character={make({ classes: [{ id: 'fighter', level: 1 }], level: 1 })} />);
    const group = screen.getByRole('region', { name: 'Class features' });
    expect(within(group).getByText('Second Wind')).toBeInTheDocument();
    expect(within(group).queryByText('Action Surge')).toBeNull();
    expect(within(group).getByRole('link', { name: 'Full list on Class & Features' })).toHaveAttribute(
      'href',
      '#character/build',
    );
  });

  it('expands a clamped line with a keyboard-accessible toggle', () => {
    render(<OverviewTraits character={withFeats} />);
    const toggle = screen.getAllByRole('button', { name: 'Show more' })[0];
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getAllByRole('button', { name: 'Show less' })[0]).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
