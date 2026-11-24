import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react';
import { SWUpdateProvider } from '../../../hooks/useSWUpdate';
import { DmShell } from '../DmShell';
import { AddMemberDialog } from '../AddMemberDialog';
import { AddCombatantsDialog } from '../AddCombatantsDialog';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import type { DmPage } from '../../../logic/dm-mode';
import { generateRandomCharacter } from '../../../logic/personal-details-generation';
import { createSeededRng } from '../../../logic/random';
import { exportToJSON } from '../../../storage/export-import';
import { encodeSharePayload } from '../../../logic/share-codec';
import { PARTY_STALE_DAYS } from '../../../logic/dm-campaign';

function Routed({ initial }: { initial: DmPage }) {
  const [page, setPage] = useState<DmPage>(initial);
  return (
    <SWUpdateProvider>
      <DmShell page={page} onNavigate={setPage} onOpenPlayer={() => {}} onTurnOff={() => {}} theme="dark" onThemeToggle={() => {}} />
    </SWUpdateProvider>
  );
}

function openParty() {
  fireEvent.change(screen.getByLabelText('New campaign name'), { target: { value: 'Test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open party' }));
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Add member dialog (cluster B)', () => {
  it('names the member in the update-from-link title and helper text', () => {
    render(
      <AddMemberDialog initialMode="import" lockedTo="import" memberName="Tordek" onImport={vi.fn()} onSaveManual={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: 'Update Tordek from a share link' })).toBeInTheDocument();
    expect(screen.getByText(/replaces Tordek's party card/)).toBeInTheDocument();
  });

  it('clears the name-required error when the name is typed', () => {
    render(<AddMemberDialog initialMode="manual" onImport={vi.fn()} onSaveManual={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to party' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give the member a name.');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'M' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not carry the error across tabs', () => {
    render(<AddMemberDialog initialMode="manual" onImport={vi.fn()} onSaveManual={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to party' }));
    fireEvent.click(screen.getByRole('tab', { name: 'From a share link' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Mismatched share link (cluster B)', () => {
  it('asks before replacing a card with a different character, and only replaces once confirmed', async () => {
    const a = generateRandomCharacter(createSeededRng(11), {});
    let b = generateRandomCharacter(createSeededRng(12), {});
    for (let s = 13; b.name.trim().toLowerCase() === a.name.trim().toLowerCase(); s++) b = generateRandomCharacter(createSeededRng(s), {});
    const codeA = await encodeSharePayload(exportToJSON(a));
    const codeB = await encodeSharePayload(exportToJSON(b));
    render(<Routed initial="campaign" />);
    openParty();
    fireEvent.click(screen.getByRole('button', { name: /Add member/ }));
    fireEvent.change(screen.getByLabelText(/Share link, code/), { target: { value: `https://example.com/#view/${codeA}` } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to party' }));
    await waitFor(() => expect(screen.getByTestId('party-member-card')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Update from link' }));
    fireEvent.change(screen.getByLabelText(/Share link, code/), { target: { value: `https://example.com/#view/${codeB}` } });
    fireEvent.click(screen.getByRole('button', { name: 'Update member' }));
    const confirm = await screen.findByRole('dialog', { name: 'Replace party member' });
    expect(confirm).toHaveTextContent(`This link is for ${b.name.trim()}, not ${a.name.trim()}. Replace ${a.name.trim()}?`);
    expect(JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].party[0].name).toBe(a.name.trim());

    fireEvent.click(within(confirm).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].party[0].name).toBe(b.name.trim()));
  });

  it('refreshes without asking when the names match (ignoring case)', async () => {
    const a = generateRandomCharacter(createSeededRng(11), {});
    const code = await encodeSharePayload(exportToJSON(a));
    render(<Routed initial="campaign" />);
    openParty();
    fireEvent.click(screen.getByRole('button', { name: /Add member/ }));
    fireEvent.change(screen.getByLabelText(/Share link, code/), { target: { value: `https://example.com/#view/${code}` } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to party' }));
    await waitFor(() => expect(screen.getByTestId('party-member-card')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Update from link' }));
    fireEvent.change(screen.getByLabelText(/Share link, code/), { target: { value: `https://example.com/#view/${code}` } });
    fireEvent.click(screen.getByRole('button', { name: 'Update member' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Update ' + a.name.trim() + ' from a share link' })).toBeNull());
    expect(screen.queryByRole('dialog', { name: 'Replace party member' })).toBeNull();
  });
});

describe('Add combatants dialog dirty check (cluster B)', () => {
  const props = { party: [], customMonsters: [], presentMemberIds: [] as string[] };
  it('closes at once when nothing was typed', () => {
    const onClose = vi.fn();
    render(<AddCombatantsDialog {...props} onAdd={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks before discarding Custom tab work on Escape and overlay click', () => {
    const onClose = vi.fn();
    render(<AddCombatantsDialog {...props} onAdd={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gribbly' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Discard changes' })).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Gribbly');
    fireEvent.click(screen.getByRole('dialog', { name: 'Add combatants' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Discard changes' })).getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Stale party card flag (cluster B)', () => {
  const DAY = 24 * 60 * 60 * 1000;
  function seedMember(updatedAt: number) {
    localStorage.setItem(
      DM_DATA_KEY,
      JSON.stringify({
        v: 1,
        activeCampaignId: 'c',
        customMonsters: [],
        campaigns: [
          {
            id: 'c', name: 'Test', notes: '', encounters: [], activeEncounterId: null, journal: [], awards: [],
            createdAt: 1, updatedAt: 1,
            party: [{ id: 'm', name: 'Pip', source: 'manual', manual: {
              classLabel: 'Rogue 1', level: 1, ac: 12, hpMax: 8, hpCurrent: 8, passivePerception: 10, passiveInsight: 10,
              passiveInvestigation: 10, spellSaveDc: null, speed: 30, darkvisionFt: 0, languages: ['Common'], conditions: [],
            }, addedAt: 1, updatedAt }],
          },
        ],
      }),
    );
  }
  it(`flags a card not updated for ${PARTY_STALE_DAYS} days`, () => {
    seedMember(Date.now() - (PARTY_STALE_DAYS + 1) * DAY);
    render(<Routed initial="party" />);
    expect(screen.getByTestId('stale-badge')).toBeInTheDocument();
  });
  it('does not flag a recently updated card', () => {
    seedMember(Date.now() - 2 * DAY);
    render(<Routed initial="party" />);
    expect(screen.queryByTestId('stale-badge')).toBeNull();
  });
});
