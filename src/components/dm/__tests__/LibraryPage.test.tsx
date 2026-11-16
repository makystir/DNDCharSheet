import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SWUpdateProvider } from '../../../hooks/useSWUpdate';
import { DmShell } from '../DmShell';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import type { DmPage } from '../../../logic/dm-mode';
import { createCampaign, emptyDmData } from '../../../logic/dm-campaign';
import { createEncounter, saveEncounter, openEncounter } from '../../../logic/dm-encounter';
import { NPC_TEMPLATE_LIST } from '../../../data/npc-templates';

function Routed({ initial }: { initial: DmPage }) {
  const [page, setPage] = useState<DmPage>(initial);
  return (
    <SWUpdateProvider>
      <DmShell page={page} onNavigate={setPage} onOpenPlayer={() => {}} onTurnOff={() => {}} theme="dark" onThemeToggle={() => {}} />
    </SWUpdateProvider>
  );
}

function seed(withEncounter: boolean) {
  let d = createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 });
  if (withEncounter) {
    d = saveEncounter(d, 'c', createEncounter('e1', 'Ambush', 1), 1);
    d = openEncounter(d, 'c', 'e1');
  }
  localStorage.setItem(DM_DATA_KEY, JSON.stringify(d));
}

const saved = () => JSON.parse(localStorage.getItem(DM_DATA_KEY)!);
const results = () => within(screen.getByRole('list', { name: 'Creatures' }));

beforeEach(() => localStorage.clear());

describe('Library page', () => {
  it('lists creatures and narrows them by search', () => {
    render(<Routed initial="library" />);
    expect(screen.getByRole('heading', { name: 'Creature library' })).toBeInTheDocument();
    const before = results().getAllByRole('button').length;
    expect(before).toBeGreaterThan(NPC_TEMPLATE_LIST.length);
    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'guard' } });
    const after = results().getAllByRole('button');
    expect(after.length).toBeGreaterThan(0);
    expect(after.length).toBeLessThan(before);
    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'no-such-creature-xyz' } });
    expect(screen.getByText('No creature matches those filters.')).toBeInTheDocument();
  });

  it('filters by source', () => {
    render(<Routed initial="library" />);
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'npc' } });
    expect(results().getAllByRole('button')).toHaveLength(NPC_TEMPLATE_LIST.length);
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'custom' } });
    expect(screen.getByText('No creature matches those filters.')).toBeInTheDocument();
  });

  it('shows a stat block with the printed numbers and a modifier tooltip', () => {
    render(<Routed initial="library" />);
    const t = NPC_TEMPLATE_LIST.find((x) => x.id === 'bandit-captain')!;
    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'Bandit Captain' } });
    fireEvent.click(results().getByRole('button', { name: /^Bandit Captain/ }));
    const block = screen.getByRole('article', { name: 'Bandit Captain stat block' });
    expect(within(block).getByText(`Monster Manual 2024, p.${t.page}`)).toBeInTheDocument();
    expect(block).toHaveTextContent(`AC ${t.stats.ac}`);
    expect(block).toHaveTextContent(`HP ${t.stats.hpMax}`);
    expect(within(block).getAllByRole('button', { name: /modifier:/ }).length).toBe(6);
    expect(within(block).getByRole('region', { name: 'Actions' })).toBeInTheDocument();
  });

  it('adds copies to an open encounter', () => {
    seed(true);
    render(<Routed initial="library" />);
    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'Bandit Captain' } });
    fireEvent.click(results().getByRole('button', { name: /^Bandit Captain/ }));
    fireEvent.change(screen.getByLabelText('How many'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Ambush' }));
    const e = saved().campaigns[0].encounters[0];
    expect(e.combatants.map((c: { name: string }) => c.name)).toEqual(['Bandit Captain 1', 'Bandit Captain 2']);
    expect(e.combatants[0].groupId).toBe(e.combatants[1].groupId);
    expect(e.combatants[0].groupId).toBeDefined();
  });

  it('points to the Encounter page when there is nowhere to add to', () => {
    seed(false);
    render(<Routed initial="library" />);
    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'Bandit Captain' } });
    fireEvent.click(results().getByRole('button', { name: /^Bandit Captain/ }));
    expect(screen.getByText(/no open encounter to add to/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Add to/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Encounter' }));
    expect(screen.getByRole('heading', { name: 'Encounter' })).toBeInTheDocument();
  });

  it('copies a creature into an editable monster, saves it, edits and deletes it', () => {
    render(<Routed initial="library" />);
    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'Bandit Captain' } });
    fireEvent.click(results().getByRole('button', { name: /^Bandit Captain/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Make an editable copy' }));

    const editor = screen.getByRole('dialog', { name: 'New custom monster' });
    expect(within(editor).getByText(/Copy of Bandit Captain/)).toBeInTheDocument();
    fireEvent.change(within(editor).getByLabelText('Name'), { target: { value: 'Bandit Warlord' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Save monster' }));

    expect(saved().customMonsters).toHaveLength(1);
    expect(saved().customMonsters[0]).toMatchObject({ name: 'Bandit Warlord', ac: 15, hpMax: 52 });
    expect(screen.getByRole('article', { name: 'Bandit Warlord stat block' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const again = screen.getByRole('dialog', { name: 'Edit custom monster' });
    fireEvent.change(within(again).getByLabelText('Hit Points'), { target: { value: '70' } });
    fireEvent.click(within(again).getByRole('button', { name: 'Save monster' }));
    expect(saved().customMonsters[0].hpMax).toBe(70);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete monster' })).getByRole('button', { name: 'Delete' }));
    expect(saved().customMonsters).toEqual([]);
  });

  it('writes a new monster from scratch, with a legendary action', () => {
    render(<Routed initial="library" />);
    fireEvent.click(screen.getByRole('button', { name: 'New custom monster' }));
    const editor = screen.getByRole('dialog', { name: 'New custom monster' });
    fireEvent.change(within(editor).getByLabelText('Name'), { target: { value: 'Ash Wyrm' } });
    fireEvent.change(within(editor).getByLabelText('Legendary action uses per round (0 for none)'), { target: { value: '3' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Add to Legendary Actions' }));
    fireEvent.change(within(editor).getByLabelText('Legendary Actions 1 name'), { target: { value: 'Tail Swipe' } });
    fireEvent.change(within(editor).getByLabelText('Legendary Actions 1 description'), { target: { value: 'Makes a tail attack.' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Save monster' }));
    const m = saved().customMonsters[0];
    expect(m.legendaryUses).toBe(3);
    expect(m.legendaryActions).toEqual([{ name: 'Tail Swipe', description: 'Makes a tail attack.' }]);
    const block = screen.getByRole('article', { name: 'Ash Wyrm stat block' });
    expect(within(block).getByRole('region', { name: 'Legendary Actions' })).toBeInTheDocument();
  });

  it('needs a name before saving', () => {
    render(<Routed initial="library" />);
    fireEvent.click(screen.getByRole('button', { name: 'New custom monster' }));
    const editor = screen.getByRole('dialog', { name: 'New custom monster' });
    fireEvent.change(within(editor).getByLabelText('Name'), { target: { value: '   ' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Save monster' }));
    expect(within(editor).getByRole('alert')).toHaveTextContent('Give the monster a name.');
    expect(localStorage.getItem(DM_DATA_KEY)).toBeNull();
  });

  it('offers custom monsters when adding combatants to an encounter', () => {
    seed(true);
    const d = saved();
    d.customMonsters = [{ id: 'm1', name: 'Zorbo the Odd', cr: '2', ac: 13, hpMax: 33, abilities: {} }];
    localStorage.setItem(DM_DATA_KEY, JSON.stringify(d));
    render(<Routed initial="encounter" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add combatants' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Creature library' }));
    fireEvent.change(screen.getByLabelText('Search creatures'), { target: { value: 'Zorbo' } });
    fireEvent.click(screen.getByRole('radio'));
    fireEvent.click(screen.getByRole('button', { name: 'Add to encounter' }));
    expect(screen.getByText('Zorbo the Odd')).toBeInTheDocument();
  });
});
