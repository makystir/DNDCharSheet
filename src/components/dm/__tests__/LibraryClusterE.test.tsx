import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SWUpdateProvider } from '../../../hooks/useSWUpdate';
import { DmShell } from '../DmShell';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import type { DmPage } from '../../../logic/dm-mode';
import { createCampaign, emptyDmData } from '../../../logic/dm-campaign';
import { createEncounter, saveEncounter, openEncounter } from '../../../logic/dm-encounter';
import {
  MAX_RECENT_CREATURES,
  RECENT_CREATURES_KEY,
  loadRecentCreatures,
  recordRecentCreature,
} from '../../../logic/dm-recent-creatures';

function Routed({ initial }: { initial: DmPage }) {
  const [page, setPage] = useState<DmPage>(initial);
  return (
    <SWUpdateProvider>
      <DmShell page={page} onNavigate={setPage} onOpenPlayer={() => {}} onTurnOff={() => {}} theme="dark" onThemeToggle={() => {}} />
    </SWUpdateProvider>
  );
}

function seed() {
  let d = createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 });
  d = saveEncounter(d, 'c', createEncounter('e1', 'Ambush', 1), 1);
  d = saveEncounter(d, 'c', createEncounter('e2', 'Second', 1), 1);
  d = openEncounter(d, 'c', 'e1');
  localStorage.setItem(DM_DATA_KEY, JSON.stringify(d));
}

const results = () => within(screen.getByRole('list', { name: 'Creatures' }));
const pick = (name: string) => {
  fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: name } });
  fireEvent.click(results().getByRole('button', { name: new RegExp(`^${name}.*Monster Manual NPCs`) }));
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('recent creatures store', () => {
  it('puts the newest first, drops duplicates, caps the list and survives bad storage', () => {
    recordRecentCreature('a');
    recordRecentCreature('b');
    expect(recordRecentCreature('a')).toEqual(['a', 'b']);
    for (let i = 0; i < MAX_RECENT_CREATURES + 3; i++) recordRecentCreature(`k${i}`);
    expect(loadRecentCreatures()).toHaveLength(MAX_RECENT_CREATURES);
    localStorage.setItem(RECENT_CREATURES_KEY, '{not json');
    expect(loadRecentCreatures()).toEqual([]);
  });
});

describe('Library cluster E', () => {
  it('shows the target encounter count, XP and fit beside Add, and updates after an add', () => {
    seed();
    render(<Routed initial="library" />);
    pick('Bandit Captain');
    const line = screen.getByTestId('library-encounter-summary');
    expect(line).toHaveTextContent('Ambush: 0 combatants');
    fireEvent.click(screen.getByRole('button', { name: 'Add to Ambush' }));
    expect(screen.getByTestId('library-encounter-summary')).toHaveTextContent('Ambush: 1 combatant ·');
    expect(screen.getByTestId('library-encounter-summary')).toHaveTextContent(/\d+ XP/);
  });

  it('opens the target encounter from the summary line', () => {
    seed();
    render(<Routed initial="library" />);
    pick('Bandit Captain');
    fireEvent.change(screen.getByLabelText('Encounter'), { target: { value: 'e2' } });
    fireEvent.click(within(screen.getByTestId('library-encounter-summary')).getByRole('button', { name: 'Open encounter' }));
    expect(screen.queryByRole('heading', { name: 'Creature library' })).toBeNull();
    expect(JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].activeEncounterId).toBe('e2');
  });

  it('lists recently added creatures and persists them', () => {
    seed();
    const first = render(<Routed initial="library" />);
    expect(screen.queryByRole('group', { name: 'Recently added to an encounter' })).toBeNull();
    pick('Bandit Captain');
    fireEvent.click(screen.getByRole('button', { name: 'Add to Ambush' }));
    const row = () => within(screen.getByRole('group', { name: 'Recently added to an encounter' }));
    expect(row().getByRole('button', { name: 'Bandit Captain' })).toBeInTheDocument();
    first.unmount();
    render(<Routed initial="library" />);
    fireEvent.click(row().getByRole('button', { name: 'Bandit Captain' }));
    expect(screen.getByRole('article', { name: 'Bandit Captain stat block' })).toBeInTheDocument();
  });

  it('scrolls the stat block into view on a narrow screen only', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const mq = (matches: boolean) =>
      vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({ matches, media: q, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList);
    mq(false);
    const wide = render(<Routed initial="library" />);
    pick('Bandit Captain');
    expect(scroll).not.toHaveBeenCalled();
    wide.unmount();
    mq(true);
    render(<Routed initial="library" />);
    pick('Bandit Captain');
    expect(scroll).toHaveBeenCalledTimes(1);
  });
});