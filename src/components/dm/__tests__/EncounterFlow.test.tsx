import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { SWUpdateProvider } from '../../../hooks/useSWUpdate';
import { DmShell } from '../DmShell';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import type { DmPage } from '../../../logic/dm-mode';
import { createCampaign, emptyDmData } from '../../../logic/dm-campaign';

function Routed({ initial }: { initial: DmPage }) {
  const [page, setPage] = useState<DmPage>(initial);
  return (
    <SWUpdateProvider>
      <DmShell page={page} onNavigate={setPage} onOpenPlayer={() => {}} onTurnOff={() => {}} theme="dark" onThemeToggle={() => {}} />
    </SWUpdateProvider>
  );
}

function setupEncounter() {
  localStorage.setItem(DM_DATA_KEY, JSON.stringify(createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 })));
  render(<Routed initial="encounter" />);
  fireEvent.change(screen.getByLabelText('New encounter name'), { target: { value: 'Ambush' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create encounter' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add combatants' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ogre' } });
  fireEvent.change(screen.getByLabelText('Hit Points'), { target: { value: '30' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to encounter' }));
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('Encounter setup controls (D-E4)', () => {
  it('groups the buttons into Add and Initiative clusters, each with its own hint, and keeps Start combat as the primary action', () => {
    setupEncounter();
    const toolbar = screen.getByTestId('encounter-toolbar');
    const add = within(toolbar).getByRole('group', { name: 'Add' });
    expect(within(add).getByRole('button', { name: 'Add combatants' })).toBeInTheDocument();
    expect(within(add).getByRole('button', { name: 'Add whole party' })).toBeInTheDocument();
    const init = within(toolbar).getByRole('group', { name: 'Initiative' });
    expect(within(init).getByRole('button', { name: 'Roll Initiative for monsters' })).toBeInTheDocument();
    expect(within(init).getByRole('button', { name: 'Roll everyone missing' })).toBeInTheDocument();
    expect(init).toHaveTextContent('Players roll their own Initiative');
    expect(within(toolbar).getAllByRole('button', { name: 'Start combat' })).toHaveLength(1);
  });
});

describe('After-combat card order (D-E9)', () => {
  it('shows XP for this fight first, then the treasure, journal and party actions', () => {
    setupEncounter();
    fireEvent.change(screen.getByLabelText('Initiative for Ogre'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    fireEvent.click(screen.getByRole('button', { name: 'End combat' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'End combat' })).getByRole('button', { name: 'End combat' }));
    const xp = screen.getByText('XP for this fight');
    const finish = screen.getByTestId('after-combat');
    expect(xp.compareDocumentPosition(finish) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const treasure = within(finish).getByRole('button', { name: 'Roll treasure for this encounter' });
    const journal = within(finish).getByRole('button', { name: 'Add combat summary to the session note' });
    expect(treasure.compareDocumentPosition(journal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});