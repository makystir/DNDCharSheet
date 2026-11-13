import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WeaponCards } from '../WeaponCards';
import { createCharacter } from '../../../storage/character-store';
import type { Character } from '../../../types/character';

afterEach(cleanup);

const make = (overrides: Partial<Character>): Character => ({ ...createCharacter('Tester'), ...overrides });

// PHB 2024 "Conditions": Poisoned gives Disadvantage on attack rolls; Invisible
// gives Advantage unless the target can somehow see you.
describe('Attacks card: Advantage / Disadvantage from your conditions', () => {
  it('names each condition and its side, with the situation when it is conditional', () => {
    render(<WeaponCards character={make({ conditions: [{ id: 'poisoned' }, { id: 'invisible' }] })} />);
    const hint = screen.getByTestId('attack-condition-hint');
    expect(hint).toHaveTextContent('Disadvantage from Poisoned');
    expect(hint).toHaveTextContent('Advantage from Invisible (not against a creature that can somehow see you)');
  });

  it('is absent when no condition affects your attacks', () => {
    render(<WeaponCards character={make({})} />);
    expect(screen.queryByTestId('attack-condition-hint')).toBeNull();
  });
});
