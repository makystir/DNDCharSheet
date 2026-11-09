import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { CompanionsTab } from '../CompanionsTab';
import type { Character, CompanionRecord } from '../../../types/character';
import { plainCharacter, rangerCharacter, track, undoStub } from './helpers';
import { Stateful } from './Stateful';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

const primal: CompanionRecord = { id: 'p1', creatureId: 'beast-of-the-land', origin: 'primal-companion' };

function renderTab(initial: Character, latest?: { current: Character }, undo = undoStub()) {
  render(
    <Stateful initial={initial} onState={latest ? track(latest) : undefined}>
      {(character, onChange) => <CompanionsTab character={character} onChange={onChange} undo={undo} />}
    </Stateful>,
  );
  return undo;
}

function expand(name: RegExp | string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('CompanionsTab: add and remove', () => {
  it('adds a companion through the creation dialog', () => {
    const latest = { current: plainCharacter() };
    renderTab(latest.current, latest);
    expect(screen.getByText('No companions yet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add Companion' }));
    const dialog = screen.getByRole('dialog', { name: 'Add companion' });
    fireEvent.change(within(dialog).getByLabelText('Source'), { target: { value: 'pet' } });
    fireEvent.change(within(dialog).getByLabelText('Creature'), { target: { value: 'cat' } });
    fireEvent.change(within(dialog).getByLabelText('Nickname (optional)'), { target: { value: 'Mittens' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add companion' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(latest.current.companions).toHaveLength(1);
    expect(latest.current.companions?.[0]).toMatchObject({ creatureId: 'cat', origin: 'pet', nickname: 'Mittens' });
    expect(screen.queryByText('No companions yet')).toBeNull();
    expect(screen.getByText('Mittens')).toBeInTheDocument();
  });

  it('removes a companion after confirmation and offers undo', () => {
    const latest = { current: plainCharacter({ companions: [primal] }) };
    const undo = renderTab(latest.current, latest);
    expand(/Beast of the Land/);
    fireEvent.click(screen.getByRole('button', { name: /Remove Beast of the Land/ }));
    // Cancel keeps it.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(latest.current.companions).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Remove Beast of the Land/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(latest.current.companions ?? []).toHaveLength(0);
    expect(screen.getByText('No companions yet')).toBeInTheDocument();
    expect(undo.show).toHaveBeenCalledTimes(1);

    // Running the undo callback restores the record at its index.
    const [, item, index, restore] = vi.mocked(undo.show).mock.calls[0];
    restore(item, index);
    expect(latest.current.companions).toHaveLength(1);
  });
});

describe('CompanionsTab: live Primal Companion numbers', () => {
  it('recomputes AC, HP and Hit Dice when the Ranger level and Wisdom change', () => {
    const lvl5 = rangerCharacter(5, 16); // Wis +3
    const { rerender } = render(
      <CompanionsTab character={{ ...lvl5, companions: [primal] }} onChange={vi.fn()} undo={undoStub()} />,
    );
    expand(/Beast of the Land/);
    // AC = 13 + Wis +3, HP = 5 + 5 x Ranger level, Hit Dice = Ranger level.
    expect(screen.getByRole('button', { name: /^Armor Class:/ })).toHaveTextContent('16');
    expect(screen.getByRole('button', { name: /^Hit Points maximum:/ })).toHaveTextContent('30');
    expect(screen.getByRole('button', { name: /^Hit Dice:/ })).toHaveTextContent(/^5d/);

    const lvl9 = rangerCharacter(9, 20); // Wis +5
    rerender(<CompanionsTab character={{ ...lvl9, companions: [primal] }} onChange={vi.fn()} undo={undoStub()} />);
    expect(screen.getByRole('button', { name: /^Armor Class:/ })).toHaveTextContent('18');
    expect(screen.getByRole('button', { name: /^Hit Points maximum:/ })).toHaveTextContent('50');
    expect(screen.getByRole('button', { name: /^Hit Dice:/ })).toHaveTextContent(/^9d/);
  });

  it('warns but does not block a non-Ranger and shows no invented numbers', () => {
    renderTab(plainCharacter({ companions: [primal] }));
    expand(/Beast of the Land/);
    expect(screen.getByRole('alert')).toHaveTextContent(/Ranger/);
    expect(screen.queryByRole('button', { name: /^Armor Class:/ })).toBeNull();
  });
});

describe('CompanionsTab: HP damage and heal', () => {
  const hpOf = () => screen.getByLabelText(/hit points \d+ of \d+/).getAttribute('aria-label');

  it('damage drains temp HP first, heal is capped at the maximum', () => {
    const latest = { current: { ...rangerCharacter(5, 16), companions: [primal] } as Character };
    renderTab(latest.current, latest);
    expand(/Beast of the Land/);
    expect(hpOf()).toBe('Beast of the Land hit points 30 of 30');

    const amount = screen.getByLabelText('Beast of the Land hit point amount');
    fireEvent.change(amount, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Temp HP' }));
    expect(screen.getByText('Temp 5')).toBeInTheDocument();

    // 8 damage: 5 temp absorbed, 3 from HP.
    fireEvent.change(amount, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Damage' }));
    expect(hpOf()).toBe('Beast of the Land hit points 27 of 30');
    expect(screen.queryByText(/^Temp \d/)).toBeNull();
    expect(latest.current.companions?.[0].hp).toBe(27);

    // Heal more than missing: capped at the maximum, stored value follows the maximum again.
    fireEvent.change(amount, { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
    expect(hpOf()).toBe('Beast of the Land hit points 30 of 30');
    expect(latest.current.companions?.[0].hp).toBeUndefined();
  });

  it('shows the 0 HP chip when reduced to zero', () => {
    renderTab({ ...rangerCharacter(5, 16), companions: [primal] });
    expand(/Beast of the Land/);
    fireEvent.change(screen.getByLabelText('Beast of the Land hit point amount'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Damage' }));
    expect(hpOf()).toBe('Beast of the Land hit points 0 of 30');
    expect(screen.getByText('0 HP')).toBeInTheDocument();
  });
});
