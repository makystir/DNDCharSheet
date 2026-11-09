import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { HirelingsTab } from '../HirelingsTab';
import { NpcPartyTab } from '../NpcPartyTab';
import type { Character } from '../../../types/character';
import { plainCharacter, track, undoStub, withHouseRule } from './helpers';
import { Stateful } from './Stateful';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

function renderHirelings(initial: Character, latest?: { current: Character }, rng?: () => number) {
  render(
    <Stateful initial={initial} onState={latest ? track(latest) : undefined}>
      {(character, onChange) => <HirelingsTab character={character} onChange={onChange} undo={undoStub()} rng={rng} />}
    </Stateful>,
  );
}

function renderNpcs(initial: Character, latest?: { current: Character }, rng?: () => number) {
  render(
    <Stateful initial={initial} onState={latest ? track(latest) : undefined}>
      {(character, onChange) => <NpcPartyTab character={character} onChange={onChange} undo={undoStub()} rng={rng} />}
    </Stateful>,
  );
}

function openCard(testId: string) {
  fireEvent.click(within(screen.getByTestId(testId)).getAllByRole('button')[0]);
}

const total = () => screen.getByRole('button', { name: /^Total for all hirelings:/ });

describe('HirelingsTab', () => {
  it('adds a hireling and shows the PHB cost and the running total', () => {
    const latest = { current: plainCharacter() };
    renderHirelings(latest.current, latest);
    expect(screen.getByText('No hirelings yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Total for all hirelings:/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add Hireling' }));
    const dialog = screen.getByRole('dialog', { name: 'Add hireling' });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Sellsword' } });
    fireEvent.change(within(dialog).getByLabelText('Days hired'), { target: { value: '5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add hireling' }));

    expect(latest.current.hirelings?.[0]).toMatchObject({ name: 'Sellsword', kind: 'skilled', units: 5 });
    // Skilled: 2 GP per day x 5 days = 10 GP.
    expect(total()).toHaveTextContent('10 GP');
  });

  it('keeps a running total across skilled, untrained and messenger hirelings', () => {
    renderHirelings(
      plainCharacter({
        hirelings: [
          { id: 'h1', name: 'Smith', kind: 'skilled', units: 3 }, // 600 CP
          { id: 'h2', name: 'Porter', kind: 'untrained', units: 4 }, // 80 CP
          { id: 'h3', name: 'Runner', kind: 'messenger', units: 25 }, // 50 CP
        ],
      }),
    );
    // 730 CP = 7 GP 3 SP.
    expect(total()).toHaveTextContent('7 GP 3 SP');
  });

  it('updates the total when a hireling is edited and when one is removed', () => {
    renderHirelings(
      plainCharacter({
        hirelings: [
          { id: 'h1', name: 'Smith', kind: 'skilled', units: 3 },
          { id: 'h2', name: 'Porter', kind: 'untrained', units: 4 },
        ],
      }),
    );
    expect(total()).toHaveTextContent('6 GP 8 SP');

    openCard('hireling-h1');
    const days = screen.getByLabelText('Smith days');
    fireEvent.change(days, { target: { value: '7' } });
    fireEvent.blur(days);
    // 7 x 2 GP + 8 SP = 14 GP 8 SP.
    expect(total()).toHaveTextContent('14 GP 8 SP');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Smith' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(total()).toHaveTextContent('8 SP');
  });

  it('warns (without blocking) when the entered pay is below the table minimum', () => {
    renderHirelings(plainCharacter({ hirelings: [{ id: 'h1', name: 'Smith', kind: 'skilled', units: 1, customRateCp: 100 }] }));
    openCard('hireling-h1');
    expect(screen.getByRole('status')).toHaveTextContent(/is a minimum/);
  });
});

describe('Loyalty gating and rolls', () => {
  const hireling = { id: 'h1', name: 'Smith', kind: 'skilled' as const, units: 1 };

  it('hides Loyalty while the house rule is off', () => {
    renderHirelings(plainCharacter({ hirelings: [hireling] }));
    openCard('hireling-h1');
    expect(screen.queryByTestId('loyalty-control')).toBeNull();
    expect(screen.queryByTestId('loyalty-maximum')).toBeNull();
  });

  it('shows Loyalty with the Charisma-based maximum while the house rule is on', () => {
    const base = plainCharacter({ hirelings: [hireling] });
    renderHirelings(withHouseRule({ ...base, abilities: { ...base.abilities, cha: 14 } }, 'loyalty'));
    expect(screen.getByRole('button', { name: /^Loyalty maximum:/ })).toHaveTextContent('14');
    openCard('hireling-h1');
    // Starts at half the maximum.
    expect(screen.getByLabelText('Smith Loyalty Score')).toHaveValue(7);
    expect(screen.getByText('Starts at 7')).toBeInTheDocument();
  });

  it('rolls 1d4 with the injected RNG and never goes above the maximum', () => {
    const latest = { current: plainCharacter() };
    const base = plainCharacter({ hirelings: [hireling] });
    latest.current = withHouseRule({ ...base, abilities: { ...base.abilities, cha: 8 } }, 'loyalty');
    renderHirelings(latest.current, latest, () => 0.99); // every die shows its highest face (4)
    openCard('hireling-h1');
    expect(screen.getByLabelText('Smith Loyalty Score')).toHaveValue(4);

    const up = screen.getByRole('button', { name: /Helped with a goal/ });
    fireEvent.click(up); // 4 + 4 = 8 (the maximum)
    expect(screen.getByLabelText('Smith Loyalty Score')).toHaveValue(8);
    fireEvent.click(up); // clamped at 8
    expect(screen.getByLabelText('Smith Loyalty Score')).toHaveValue(8);
    expect(latest.current.hirelings?.[0].loyalty).toBe(8);

    // 2d4 of 4 each = -8: floors at 0.
    fireEvent.click(screen.getByRole('button', { name: /Abused, misled/ }));
    expect(screen.getByLabelText('Smith Loyalty Score')).toHaveValue(0);
  });

  it('shows Loyalty on NPC party members only while the rule is on', () => {
    const npc = { id: 'n1', name: 'Mira' };
    const first = render(
      <Stateful initial={plainCharacter({ npcPartyMembers: [npc] })}>
        {(c, onChange) => <NpcPartyTab character={c} onChange={onChange} undo={undoStub()} />}
      </Stateful>,
    );
    openCard('npc-n1');
    expect(screen.queryByTestId('loyalty-control')).toBeNull();
    first.unmount();

    renderNpcs(withHouseRule(plainCharacter({ npcPartyMembers: [npc] }), 'loyalty'));
    openCard('npc-n1');
    expect(screen.getByTestId('loyalty-control')).toBeInTheDocument();
  });
});

describe('NpcPartyTab', () => {
  it('adds an NPC party member and warns when its CR is above half the level', () => {
    const latest = { current: plainCharacter({ level: 3 }) };
    renderNpcs(latest.current, latest);
    expect(screen.getByText('No NPC party members yet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add NPC Party Member' }));
    const dialog = screen.getByRole('dialog', { name: 'Add NPC party member' });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Mira' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add member' }));
    expect(latest.current.npcPartyMembers?.[0]).toMatchObject({ name: 'Mira' });

    openCard(`npc-${latest.current.npcPartyMembers?.[0].id}`);
    fireEvent.click(screen.getByRole('button', { name: 'Edit stat block' }));
    const cr = screen.getByLabelText('Mira Challenge Rating');

    // Level 3: half is 1.5. CR 1 is fine, CR 2 is one too many.
    fireEvent.change(cr, { target: { value: '1' } });
    fireEvent.blur(cr);
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.change(screen.getByLabelText('Mira Challenge Rating'), { target: { value: '2' } });
    fireEvent.blur(screen.getByLabelText('Mira Challenge Rating'));
    expect(screen.getByRole('status')).toHaveTextContent(/half/i);
  });
});
