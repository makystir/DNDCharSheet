import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CombatPage } from '../CombatPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

/** Stateful Combat page harness that also records Toast notices. */
function renderCombat(overrides: Partial<Character> = {}) {
  const onNotify = vi.fn();
  const latest: { current: Character } = { current: { ...createCharacter('Tester'), ...overrides } };
  function Harness() {
    const [character, setCharacter] = useState<Character>(latest.current);
    return (
      <CombatPage
        character={character}
        onChange={(next) => {
          latest.current = next;
          setCharacter(next);
        }}
        onNotify={onNotify}
      />
    );
  }
  render(<Harness />);
  return { latest, onNotify };
}

const wizard: Partial<Character> = {
  level: 5,
  classes: [{ id: 'wizard', level: 5 }],
  spellcasting: {
    byClass: {
      wizard: {
        spellbook: ['magic-missile', 'hold-person', 'web'],
        prepared: ['magic-missile', 'hold-person', 'web'],
      },
    },
  },
};

describe('Combat status strip: conditions and resources (UX audit E2.3, E2.7)', () => {
  it('shows a chip for each active condition', () => {
    renderCombat({ conditions: [{ id: 'prone' }, { id: 'frightened' }] });
    const strip = screen.getByRole('group', { name: 'Combat summary' });
    expect(within(strip).getByTestId('strip-condition-prone')).toHaveTextContent('Prone');
    expect(within(strip).getByTestId('strip-condition-frightened')).toHaveTextContent('Frightened');
  });

  it('shows Exhaustion with its level', () => {
    renderCombat({ exhaustionLevel: 2 });
    const strip = screen.getByRole('group', { name: 'Combat summary' });
    expect(within(strip).getByTestId('strip-condition-exhaustion')).toHaveTextContent('Exhaustion (2)');
  });

  it('shows no condition chips when there are none', () => {
    renderCombat();
    const strip = screen.getByRole('group', { name: 'Combat summary' });
    expect(strip.querySelector('[data-testid^="strip-condition-"]')).toBeNull();
  });

  it('shows remaining / max for a limited-use feature', () => {
    renderCombat({ level: 1, classes: [{ id: 'fighter', level: 1 }] });
    const strip = screen.getByRole('group', { name: 'Combat summary' });
    const chip = strip.querySelector('[data-testid^="strip-resource-"]');
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toMatch(/Second Wind \d+\/\d+/);
  });
});

describe('Combat spell list: start concentrating (UX audit Summary-1)', () => {
  it('starts, swaps and stops Concentration with the shared logic and Toast text', () => {
    const { latest, onNotify } = renderCombat(wizard);
    expect(screen.queryByRole('button', { name: /Start concentrating on Magic Missile/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start concentrating on Hold Person' }));
    expect(latest.current.concentration?.spellId).toBe('hold-person');
    expect(onNotify).toHaveBeenLastCalledWith('Now concentrating on Hold Person.');
    expect(screen.getByTestId('strip-concentration')).toHaveTextContent('Concentrating: Hold Person');

    fireEvent.click(screen.getByRole('button', { name: 'Start concentrating on Web' }));
    expect(latest.current.concentration?.spellId).toBe('web');
    expect(onNotify).toHaveBeenLastCalledWith('Now concentrating on Web. Concentration on Hold Person ended.');

    fireEvent.click(screen.getByRole('button', { name: 'Stop concentrating on Web' }));
    expect(latest.current.concentration).toBeUndefined();
    expect(onNotify).toHaveBeenLastCalledWith('Concentration on Web ended.');
  });
});

describe('Exhaustion text agrees with the code (UX audit U2.5)', () => {
  // PHB 2024 "Exhaustion [Condition]": D20 Tests are reduced by 2 x level; Speed by 5 ft x level.
  it('does not claim the static totals are untouched, and the totals do apply it', () => {
    renderCombat({ exhaustionLevel: 2 });
    const note = screen.getByTestId('active-exhaustion');
    expect(note).not.toHaveTextContent(/not applied/i);
    expect(note).toHaveTextContent(/attacks, spell attacks, skills, saving throws, Initiative/);
    // Speed in the strip is reduced by 5 x 2 = 10 ft (base 30 ft).
    expect(screen.getByTestId('strip-speed')).toHaveTextContent('20 ft');
  });
});

describe('Hit Points card wording (UX audit U2.6)', () => {
  it('heads the Heal and Temp HP controls with a heading that covers both', () => {
    renderCombat({ hpMax: 20 });
    expect(screen.getByRole('heading', { name: 'Healing and Temp HP' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Heal' })).toBeNull();
    expect(screen.getAllByText('Heal')).toHaveLength(1);
  });
});
