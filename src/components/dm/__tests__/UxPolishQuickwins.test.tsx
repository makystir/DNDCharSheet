import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { SWUpdateProvider } from '../../../hooks/useSWUpdate';
import { DmShell } from '../DmShell';
import { AddMemberDialog } from '../AddMemberDialog';
import { MonsterEditorDialog } from '../MonsterEditorDialog';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import type { DmPage } from '../../../logic/dm-mode';
import { createCampaign, DEFAULT_MANUAL_STATS, emptyDmData } from '../../../logic/dm-campaign';
import { blankCustomMonster } from '../../../logic/dm-library';

function Routed({ initial }: { initial: DmPage }) {
  const [page, setPage] = useState<DmPage>(initial);
  return (
    <SWUpdateProvider>
      <DmShell page={page} onNavigate={setPage} onOpenPlayer={() => {}} onTurnOff={() => {}} theme="dark" onThemeToggle={() => {}} />
    </SWUpdateProvider>
  );
}

function seedCampaign() {
  const d = createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 });
  localStorage.setItem(DM_DATA_KEY, JSON.stringify(d));
}

function newEncounter(name = 'Ambush') {
  fireEvent.change(screen.getByLabelText('New encounter name'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Create encounter' }));
}

function addCustom(name: string, hp: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Add combatants' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Hit Points'), { target: { value: hp } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to encounter' }));
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Encounter toolbar (D-B2)', () => {
  it('is sticky while combat is running, and not while setting up', () => {
    seedCampaign();
    render(<Routed initial="encounter" />);
    newEncounter();
    addCustom('Ogre', '30');
    expect(screen.getByTestId('encounter-toolbar').className).not.toMatch(/toolbarSticky/);
    fireEvent.change(screen.getByLabelText('Initiative for Ogre'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    expect(screen.getByTestId('encounter-toolbar').className).toMatch(/toolbarSticky/);
  });
});

describe('Dirty-check dialogs (D-B3)', () => {
  it('Add Member: Escape and overlay click ask before discarding typed work', () => {
    const onClose = vi.fn();
    render(<AddMemberDialog initialMode="manual" onImport={vi.fn()} onSaveManual={vi.fn()} onClose={onClose} />);
    // Untouched: Escape closes at once.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    onClose.mockClear();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Mira' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    const confirm = screen.getByRole('dialog', { name: 'Discard changes' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('dialog', { name: 'Discard changes' })).toBeNull();
    expect(screen.getByLabelText('Name')).toHaveValue('Mira');

    fireEvent.click(screen.getByRole('dialog', { name: 'Add a party member' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Discard changes' })).getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Add Member: an edited member is dirty only when a value changed', () => {
    const onClose = vi.fn();
    render(
      <AddMemberDialog
        initialMode="manual"
        lockedTo="manual"
        initialManual={{ name: 'Borin', stats: DEFAULT_MANUAL_STATS }}
        onImport={vi.fn()}
        onSaveManual={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Monster editor: Escape and overlay click ask before discarding edits', () => {
    const onClose = vi.fn();
    render(<MonsterEditorDialog monster={blankCustomMonster('m1', 1)} isNew onSave={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    onClose.mockClear();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gribbly' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Discard changes' })).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Gribbly');

    fireEvent.click(screen.getByRole('dialog', { name: 'New custom monster' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Discard changes' })).getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Save-failure banner (D-B1)', () => {
  it('shows once in the shell on a page that had no banner of its own', () => {
    seedCampaign();
    render(<Routed initial="journal" />);
    expect(screen.queryByText(/would not save your latest changes/)).toBeNull();
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === DM_DATA_KEY) throw new DOMException('full', 'QuotaExceededError');
      return real.call(this, key, value);
    });
    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    expect(screen.getAllByText(/would not save your latest changes/)).toHaveLength(1);
    // Still there on another page, and only once.
    fireEvent.click(screen.getByRole('button', { name: /^Treasure/ }));
    expect(screen.getAllByText(/would not save your latest changes/)).toHaveLength(1);
  });
});

describe('Undo for removing a combatant (D-B4)', () => {
  it('shows an undo toast and restores the combatant', () => {
    seedCampaign();
    render(<Routed initial="encounter" />);
    newEncounter();
    addCustom('Ogre', '30');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ogre' }));
    expect(screen.queryAllByTestId('combatant-card')).toHaveLength(0);
    expect(screen.getByText('Ogre removed from the encounter')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getAllByTestId('combatant-card')).toHaveLength(1);
    expect(screen.getByText('Ogre')).toBeInTheDocument();
  });
});

describe('Encounter XP tooltip (D-B9)', () => {
  it('lists the creatures that make up the XP total', () => {
    seedCampaign();
    render(<Routed initial="encounter" />);
    newEncounter();
    addCustom('Ogre', '30');
    fireEvent.click(screen.getByRole('button', { name: 'All encounters' }));
    const summary = screen.getByTestId('encounter-summary');
    fireEvent.click(within(summary).getByRole('button', { name: /^Encounter XP:/ }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });
});
