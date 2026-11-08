/**
 * FeatPicker: an ASI slot offers Fighting Style feats to a class that meets the
 * Fighting Style Feature prerequisite (RAW: any feat you qualify for, PHB L2499,
 * L8340, L9068+), and still gates them for a class without that feature.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatPicker } from '../FeatPicker';
import { canTakeFeat } from '../../../logic/feats';
import { createCharacter } from '../../../storage/character-store';
import type { Character, ClassEntry } from '../../../types/character';

function fighter(level: number): Character {
  return {
    ...createCharacter('Picker'),
    level,
    classes: [{ id: 'fighter', level }] as unknown as ClassEntry[],
  } as Character;
}

describe('FeatPicker ASI slot categories', () => {
  it('offers General and Fighting Style feats to a Fighter', () => {
    const c = fighter(4);
    expect(canTakeFeat(c, 'dueling').ok).toBe(true);
    render(<FeatPicker character={c} slotLevel={4} onSelect={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /Alert/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dueling/ })).toBeEnabled();
  });
});
