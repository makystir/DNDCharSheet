import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MonsterStatBlock } from '../MonsterStatBlock';
import { blankCustomMonster, fromCustom } from '../../../logic/dm-library';

describe('MonsterStatBlock condition immunities', () => {
  it('gives condition tokens a tooltip trigger and keeps the separators', () => {
    const m = fromCustom({ ...blankCustomMonster('m', 1), name: 'Golem', conditionImmunities: 'Charmed; Frightened', immunities: 'Poison' });
    render(<MonsterStatBlock monster={m} />);
    expect(screen.getByRole('button', { name: 'Charmed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Frightened' })).toBeInTheDocument();
    expect(screen.getByText('Condition immunities').parentElement).toHaveTextContent('Condition immunities Charmed; Frightened');
    // The damage-type Immunities line stays plain text.
    expect(screen.queryByRole('button', { name: 'Poison' })).toBeNull();
  });
});
