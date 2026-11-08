import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FightingStyleSection } from '../FightingStyleSection';
import { FeatSlotsSection } from '../FeatSlotsSection';
import type { Character } from '../../../../types/character';
import { createCharacter } from '../../../../storage/character-store';

/**
 * The class Fighting Style pick on the Advancement page (Fighter 1, Paladin 2,
 * Ranger 2). The rules live in logic/feats; these tests assert the UI wires them.
 */
function renderSection(overrides: Partial<Character>) {
  let latest: Character = { ...createCharacter('Tester'), ...overrides };
  function Harness() {
    const [character, setCharacter] = useState<Character>(latest);
    return (
      <FightingStyleSection
        character={character}
        now={() => 1000}
        onChange={(next) => {
          latest = next;
          setCharacter(next);
        }}
      />
    );
  }
  const view = render(<Harness />);
  return { get: () => latest, container: view.container };
}

describe('FightingStyleSection', () => {
  it('renders nothing for a class without the Fighting Style feature', () => {
    const { container } = renderSection({ level: 5, classes: [{ id: 'wizard', level: 5 }] });
    expect(container).toBeEmptyDOMElement();
  });

  it('does not offer the pick to a Paladin before level 2', () => {
    const { container } = renderSection({ level: 1, classes: [{ id: 'paladin', level: 1 }] });
    expect(container).toBeEmptyDOMElement();
  });

  it('lets a level-1 Fighter pick a Fighting Style feat, then change or remove it', () => {
    const { get } = renderSection({ level: 1, classes: [{ id: 'fighter', level: 1 }] });
    fireEvent.click(screen.getByRole('button', { name: /Choose a Fighting Style feat/ }));
    const dialog = screen.getByRole('dialog', { name: /Fighting Style feat — Fighter/ });
    // Only Fighting Style feats are listed.
    expect(within(dialog).getByText('Archery')).toBeInTheDocument();
    expect(within(dialog).getByText('Unarmed Fighting')).toBeInTheDocument();
    expect(within(dialog).queryByText('Alert')).not.toBeInTheDocument();
    // Two clicks: expand, then select.
    fireEvent.click(within(dialog).getByText('Archery'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Select Archery' }));
    expect(get().advancement?.feats).toEqual([{ featId: 'archery', level: 0, grantedBy: 'fighter' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Fighter Fighting Style Archery' }));
    expect(get().advancement?.feats ?? []).toEqual([]);
  });

  it('gives a Champion a second pick from Additional Fighting Style at Fighter 7 only', () => {
    const { container } = renderSection({ level: 6, classes: [{ id: 'fighter', level: 6, subclassId: 'champion' }] });
    expect(within(container).getAllByRole('button', { name: /Choose a Fighting Style feat/ })).toHaveLength(1);
  });

  it('records the Champion Additional Fighting Style pick against the subclass slot', () => {
    const { get } = renderSection({
      level: 7,
      classes: [{ id: 'fighter', level: 7, subclassId: 'champion' }],
      advancement: { feats: [{ featId: 'archery', level: 0, grantedBy: 'fighter' }] },
    } as Partial<Character>);
    expect(screen.getByText('Fighter 7 (Additional Fighting Style)')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose a Fighting Style feat for Fighter Additional Fighting Style' }),
    );
    const dialog = screen.getByRole('dialog', { name: /Fighting Style feat — Fighter \(Additional Fighting Style\)/ });
    // Archery is already taken by the class's own Fighting Style.
    expect(within(dialog).getByText('Archery').closest('button')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(within(dialog).getByText('Defense'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Select Defense' }));
    expect(get().advancement?.feats).toEqual([
      { featId: 'archery', level: 0, grantedBy: 'fighter' },
      { featId: 'defense', level: 0, grantedBy: 'fighter:subclass' },
    ]);
  });

  it('is also offered in an Ability Score Improvement slot picker (RAW: any feat you qualify for)', () => {
    const fighter4: Character = {
      ...createCharacter('Tester'),
      level: 4,
      classes: [{ id: 'fighter', level: 4 }],
    };
    render(<FeatSlotsSection character={fighter4} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose a feat…' }));
    const dialog = screen.getByRole('dialog', { name: /Choose a feat for level 4/ });
    expect(within(dialog).getByText('Ability Score Improvement')).toBeInTheDocument();
    expect(within(dialog).getByText('Archery')).toBeInTheDocument();
  });
});
