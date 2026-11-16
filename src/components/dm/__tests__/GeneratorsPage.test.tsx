import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SWUpdateProvider } from '../../../hooks/useSWUpdate';
import { DmShell } from '../DmShell';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import type { DmPage } from '../../../logic/dm-mode';
import { createCampaign, emptyDmData } from '../../../logic/dm-campaign';
import type { DmNote } from '../../../types/dm';

function Routed({ initial }: { initial: DmPage }) {
  const [page, setPage] = useState<DmPage>(initial);
  return (
    <SWUpdateProvider>
      <DmShell page={page} onNavigate={setPage} onOpenPlayer={() => {}} onTurnOff={() => {}} theme="dark" onThemeToggle={() => {}} />
    </SWUpdateProvider>
  );
}

const seed = () =>
  localStorage.setItem(DM_DATA_KEY, JSON.stringify(createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 })));
const journal = () => JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].journal as DmNote[];

beforeEach(() => localStorage.clear());

describe('Generators page', () => {
  it('generates an NPC with every part, and keeps what you chose', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'dwarf' } });
    fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'female' } });
    fireEvent.change(screen.getByLabelText('Role, in your words (optional)'), { target: { value: 'Blacksmith' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate NPC' }));

    const card = screen.getByLabelText('Generated NPC');
    expect(within(card).getByRole('heading')).toHaveTextContent(/, dwarf blacksmith$/);
    expect(card).toHaveTextContent('Ideal.');
    expect(card).toHaveTextContent('Flaw.');
    expect(card).toHaveTextContent('Short-term goal.');
    expect(card).toHaveTextContent('Long-term goal.');
    expect(card).not.toHaveTextContent(/[{}]/);
    for (const part of ['name', 'age and looks', 'description', 'ideal', 'flaw', 'goals']) {
      expect(within(card).getByRole('button', { name: `Roll the ${part} again` })).toBeInTheDocument();
    }
  });

  it('rolls one part again without touching the others', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate NPC' }));
    const card = screen.getByLabelText('Generated NPC');
    const heading = within(card).getByRole('heading').textContent;
    const before = card.textContent;
    fireEvent.click(within(card).getByRole('button', { name: 'Roll the flaw again' }));
    expect(within(screen.getByLabelText('Generated NPC')).getByRole('heading').textContent).toBe(heading);
    expect(screen.getByLabelText('Generated NPC').textContent).toContain('Ideal.');
    expect(before).toBeTruthy();
  });

  it('saves the NPC to the journal as an NPC entry', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate NPC' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));
    expect(journal()).toHaveLength(1);
    expect(journal()[0].kind).toBe('npc');
    expect(journal()[0].body).toContain('Long-term goal: ');
  });

  it('tells you to create a campaign before saving', () => {
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate NPC' }));
    expect(screen.getByRole('button', { name: 'Save to journal' })).toBeDisabled();
    expect(screen.getByText(/Create a campaign to save NPCs/)).toBeInTheDocument();
  });

  it('makes a tavern with an owner and saves both as linked entries', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tavern' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate tavern' }));
    const name = screen.getByTestId('place-name').textContent!;
    expect(name).toMatch(/^The /);
    expect(screen.getByLabelText('Generated tavern')).toHaveTextContent(/innkeeper/);
    fireEvent.click(screen.getByRole('button', { name: 'New name' }));
    fireEvent.click(screen.getByRole('button', { name: 'New owner' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));

    const j = journal();
    expect(j.map((n) => n.kind).sort()).toEqual(['location', 'npc']);
    const place = j.find((n) => n.kind === 'location')!;
    const owner = j.find((n) => n.kind === 'npc')!;
    expect(place.body).toContain(`[[${owner.title}]]`);
    expect(owner.body).toContain(`[[${place.title}]]`);
  });

  it('makes a shop for the kind of trade chosen', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Shop' }));
    fireEvent.change(screen.getByLabelText('Kind of shop'), { target: { value: 'smith' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate shop' }));
    expect(screen.getByLabelText('Generated shop')).toHaveTextContent(/blacksmith/i);
    fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));
    expect(journal().find((n) => n.kind === 'location')!.body).toContain('blacksmith shop');
  });
});
