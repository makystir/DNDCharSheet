import { describe, it, expect, afterEach } from 'vitest';
import { screen, fireEvent, cleanup, within } from '@testing-library/react';
import { createCharacter } from '../../../storage/character-store';
import type { Character } from '../../../types/character';
import type { PeopleFilter } from '../PeopleTab';
import { renderPeople } from './PeopleHarness';

afterEach(cleanup);

function renderTab(filter: PeopleFilter, initial: Character, rng?: () => number) {
  // The Sidekicks filter exists only while the Tasha's house rule is on.
  const start = filter === 'sidekicks' ? { ...initial, houseRules: { ...initial.houseRules, sidekicks: true } } : initial;
  const latest = { current: start };
  renderPeople(start, { latest, filter, rng });
  return { get: () => latest.current };
}

function base(): Character {
  return createCharacter('Tester');
}

function expand(name: RegExp) {
  fireEvent.click(screen.getAllByRole('button', { name })[0]);
}

describe('People: hirelings', () => {
  it('adds hirelings and shows the running total for all', () => {
    const { get } = renderTab('hirelings', base());
    const add = (kind: string, name: string, units: string) => {
      fireEvent.click(screen.getByRole('button', { name: /Add Hireling/ }));
      const dialog = screen.getByRole('dialog', { name: 'Add hireling' });
      fireEvent.change(within(dialog).getByLabelText('Kind'), { target: { value: kind } });
      fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: name } });
      fireEvent.change(within(dialog).getByLabelText(/Days hired|Miles/), { target: { value: units } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add hireling' }));
    };
    add('skilled', 'Ana', '3');
    add('untrained', 'Bo', '4');
    add('messenger', 'Cy', '25');
    expect(get().hirelings).toHaveLength(3);
    expect(screen.getByRole('button', { name: /^Total for all hirelings:/ })).toHaveTextContent('7 GP 3 SP');
  });

  it('warns (without blocking) when your pay is below the table minimum, and hides Loyalty when the rule is off', () => {
    const c = { ...base(), hirelings: [{ id: 'h', name: 'Ana', kind: 'skilled', units: 2 }] } as Character;
    renderTab('hirelings', c);
    expand(/^Ana/);
    expect(screen.queryByTestId('loyalty-control')).toBeNull();
    const rate = screen.getByLabelText('Ana pay per day in copper');
    fireEvent.change(rate, { target: { value: '100' } });
    fireEvent.blur(rate);
    expect(screen.getByText(/is a minimum; your rate is lower/)).toBeInTheDocument();
  });

  it('starts with an empty stat block and lets you enter one by hand', () => {
    const c = { ...base(), hirelings: [{ id: 'h', name: 'Ana', kind: 'skilled', units: 1 }] } as Character;
    const { get } = renderTab('hirelings', c);
    expand(/^Ana/);
    expect(screen.getByText(/No stats entered yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Edit stat block/ }));
    const ac = screen.getByLabelText('Ana Armor Class');
    fireEvent.change(ac, { target: { value: '16' } });
    fireEvent.blur(ac);
    const str = screen.getByLabelText('Ana Strength score');
    fireEvent.change(str, { target: { value: '16' } });
    fireEvent.blur(str);
    expect(get().hirelings?.[0].stats).toMatchObject({ ac: 16, abilities: { str: 16 } });
    expect(screen.getByTestId('stat-block')).toBeInTheDocument();
  });
});

describe('People: NPC party members', () => {
  const npc = (cr: string) => ({ id: 'n', name: 'Guard', stats: { cr } });

  it('warns about a CR above half the level and never blocks, boundary at half', () => {
    const lvl3 = { ...base(), level: 3, npcPartyMembers: [npc('2')] } as Character;
    renderTab('npc', lvl3);
    expand(/^Guard/);
    expect(screen.getByText(/above half your level \(max CR 1.5\)/)).toBeInTheDocument();
    cleanup();
    renderTab('npc', { ...base(), level: 1, npcPartyMembers: [npc('1/2')] } as Character);
    expand(/^Guard/);
    expect(screen.queryByText(/above half your level/)).toBeNull();
  });

  it('hides Loyalty when the toggle is off and shows it (clamped, rolled) when on', () => {
    const off = { ...base(), npcPartyMembers: [npc('1/8')] } as Character;
    renderTab('npc', off);
    expand(/^Guard/);
    expect(screen.queryByTestId('loyalty-control')).toBeNull();
    expect(screen.queryByTestId('loyalty-maximum')).toBeNull();
    cleanup();

    const on = {
      ...base(),
      abilities: { ...base().abilities, cha: 14 },
      houseRules: { loyalty: true },
      npcPartyMembers: [{ ...npc('1/8'), loyalty: 19 }],
    } as Character;
    const { get } = renderTab('npc', on, () => 0.99);
    expect(screen.getByTestId('loyalty-maximum')).toHaveTextContent('14');
    expand(/^Guard/);
    // stored 19 is clamped to the maximum 14 when shown
    expect(screen.getByLabelText('Guard Loyalty Score')).toHaveValue(14);
    fireEvent.click(screen.getByRole('button', { name: /treated well/ }));
    expect(get().npcPartyMembers?.[0].loyalty).toBe(14);
    fireEvent.click(screen.getByRole('button', { name: /Abused/ }));
    expect(get().npcPartyMembers?.[0].loyalty).toBe(6);
  });

  it('shows an empty state pointing at the editable stat block and no template button', () => {
    renderTab('npc', base());
    expect(screen.getByText('No NPC party members yet')).toBeInTheDocument();
    expect(screen.getByText(/Edit stat block/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add NPC Party Member/ }));
    expect(screen.queryByLabelText('Start from template')).toBeNull();
  });
});

describe('People: sidekicks', () => {
  it('marks the tab as Tasha 2014 rules, defaults the level to the character level and records a level up', () => {
    const c = { ...base(), level: 4 } as Character;
    const { get } = renderTab('sidekicks', c);
    expect(screen.getAllByText(/Tasha's 2020 \(5e, 2014 rules\)/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Add Sidekick/ }));
    const dialog = screen.getByRole('dialog', { name: 'Add sidekick' });
    fireEvent.change(within(dialog).getByLabelText('Creature'), { target: { value: 'cat' } });
    expect(within(dialog).getByLabelText(/Starting level/)).toHaveValue(4);
    // above level 1 the HP must be entered
    expect(within(dialog).getByRole('button', { name: 'Add sidekick' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Hit Points maximum/), { target: { value: '20' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add sidekick' }));
    expect(get().sidekicks?.[0]).toMatchObject({ creatureId: 'cat', classId: 'warrior', level: 4, baseHpMax: 20 });

    expand(/^Cat/);
    expect(screen.queryByText(/Your level is/)).toBeNull();
    expect(screen.getAllByText('Features').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Cat level-up Hit Die roll'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Level up to 5/ }));
    const rec = get().sidekicks?.[0];
    expect(rec?.level).toBe(5);
    expect(rec?.levelUps).toEqual([{ level: 5, roll: 2, hpGained: 2 }]);
    expect(screen.getByRole('button', { name: /Cat Hit Points maximum/ })).toHaveTextContent('22');
  });

  it('prompts when the character level is above the sidekick level', () => {
    const c = {
      ...base(),
      level: 6,
      sidekicks: [{ id: 's', creatureId: 'cat', classId: 'expert', level: 4, baseHpMax: 20, levelUps: [] }],
    } as Character;
    renderTab('sidekicks', c);
    expand(/^Cat/);
    expect(screen.getByText(/Your level is 6; this sidekick is level 4/)).toBeInTheDocument();
  });
});