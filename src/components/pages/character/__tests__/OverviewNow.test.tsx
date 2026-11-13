import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { OverviewNow } from '../OverviewNow';
import { createCharacter } from '../../../../storage/character-store';
import type { Character } from '../../../../types/character';
import { CONDITIONS } from '../../../../data/conditions';
import { exhaustionEffects } from '../../../../logic/conditions';
import { characterResources } from '../../../../logic/resources';

afterEach(cleanup);

function make(overrides: Partial<Character>): Character {
  return { ...createCharacter('Tester'), level: 1, classes: [], ...overrides };
}

describe('OverviewNow (Right now)', () => {
  it('shows every stored condition as a chip, with effects in the tooltip rather than inline', () => {
    const conditions = CONDITIONS.filter((c) => c.id !== 'exhaustion').map((c) => ({ id: c.id }));
    render(<OverviewNow character={make({ conditions } as Partial<Character>)} />);
    const row = screen.getByTestId('now-conditions');
    for (const c of CONDITIONS.filter((x) => x.id !== 'exhaustion')) {
      expect(within(row).getByTestId(`now-condition-${c.id}`)).toHaveTextContent(c.name);
    }
    // Effect text is not written out inline (it lives in each chip's tooltip).
    const first = CONDITIONS.find((c) => c.id === 'blinded');
    expect(row).not.toHaveTextContent(first?.effects[0] ?? '#');
  });

  it('marks implied and 0-HP conditions and shows death saves only at 0 HP', () => {
    render(<OverviewNow character={make({ conditions: [{ id: 'paralyzed' }] })} />);
    expect(screen.getByTestId('now-condition-incapacitated')).toHaveTextContent('implied by Paralyzed');
    expect(screen.queryByTestId('now-death-saves')).toBeNull();
    cleanup();

    render(<OverviewNow character={make({ currentHp: 0, hpMax: 30, deathSaves: { successes: 2, failures: 1 } })} />);
    expect(screen.getByTestId('now-condition-unconscious')).toHaveTextContent('from 0 HP');
    expect(screen.getByLabelText('Successes 2 of 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Failures 1 of 3')).toBeInTheDocument();
  });

  it('shows Exhaustion with its D20 Test and Speed penalties from the logic', () => {
    render(<OverviewNow character={make({ exhaustionLevel: 2 })} />);
    const chip = screen.getByTestId('now-condition-exhaustion');
    const fx = exhaustionEffects(2);
    expect(chip).toHaveTextContent('Exhaustion (2)');
    expect(within(chip).getByRole('button', { name: /D20 Test penalty/ })).toHaveTextContent(String(fx.d20Test.total));
    expect(within(chip).getByRole('button', { name: /Speed reduction/ })).toHaveTextContent(`${fx.speed.total} ft`);
  });

  it('shows the concentration spell and the Reaction only when used or blocked', () => {
    render(<OverviewNow character={make({ concentration: { spellId: 'bless' } })} />);
    expect(screen.getByTestId('now-concentration')).toHaveTextContent('Bless');
    expect(screen.queryByTestId('now-reaction')).toBeNull();
    cleanup();

    render(<OverviewNow character={make({ combat: { inCombat: true, round: 1, turn: { reactionUsed: true } } } as Partial<Character>)} />);
    expect(screen.getByTestId('now-reaction')).toHaveTextContent('Reaction used this round');
    cleanup();

    render(<OverviewNow character={make({ conditions: [{ id: 'stunned' }] })} />);
    expect(screen.getByTestId('now-reaction')).toHaveTextContent("Can't take Reactions (Incapacitated)");
  });

  it('lists resource counts and spell slots with their breakdowns', () => {
    const fighter = make({ level: 2, classes: [{ id: 'fighter', level: 2 }] });
    render(<OverviewNow character={fighter} />);
    const rows = screen.getAllByTestId('now-resource');
    expect(rows).toHaveLength(characterResources(fighter).length);
    expect(screen.queryByTestId('now-spell-slots')).toBeNull();
    cleanup();

    render(<OverviewNow character={make({ level: 3, classes: [{ id: 'wizard', level: 3 }] })} />);
    const slots = screen.getByRole('list', { name: 'Spell slots' });
    expect(within(slots).getByText('Level 1')).toBeInTheDocument();
    expect(within(slots).getByRole('button', { name: /Level 1 slots available/ })).toHaveTextContent('4 / 4');
    expect(within(slots).getByRole('button', { name: /Level 2 slots available/ })).toHaveTextContent('2 / 2');
  });

  it('hides every empty row and links to Combat', () => {
    render(<OverviewNow character={make({})} />);
    for (const id of ['now-conditions', 'now-concentration', 'now-death-saves', 'now-reaction', 'now-resources', 'now-spell-slots']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(screen.getByRole('link', { name: 'Manage on Combat' })).toHaveAttribute('href', '#combat');
  });
});
