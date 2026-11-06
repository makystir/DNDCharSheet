import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataBackupCard } from '../DataBackupCard';
import { getSnapshotStore, _resetSnapshotDbForTests } from '../../../storage/snapshot-store';
import { takeSnapshot } from '../../../storage/snapshot-service';
import * as exportImport from '../../../storage/export-import';
import * as restoreService from '../../../storage/restore-service';
import * as backupService from '../../../storage/backup-service';
import { adoptCharacter, listSummaries } from '../../../storage/character-manager';
import { isAutoBackupEnabled, AUTO_BACKUP_ENABLED_KEY } from '../../../storage/snapshot-settings';
import { createCharacter, _resetDbForTests, deleteCharacter } from '../../../storage/character-store';
import { _resetPortraitDbForTests } from '../../../storage/portrait-store';
import type { Character } from '../../../types/character';

/**
 * DataBackupCard tests (B3 auto-backup §5). Uses fake-indexeddb under jsdom and
 * the real storage layer bound to this app's async manager.
 *
 * Covers: the card renders; the toggle persists via snapshot-settings;
 * "Download full backup" calls the backup path; and the restore list routes a
 * chosen snapshot through restoreFromSnapshot/commitSnapshotRestore and calls
 * onRestored.
 */

// Mint a real character id via the store factory (the live app's creation
// flows all build on this), then name it — an empty id is never a valid record.
function makeCharacter(name: string): Character {
  return { ...createCharacter(name), level: 1 };
}

function baseProps(over: { onRestored?: Mock<() => void> } = {}) {
  return {
    character: makeCharacter('Current'),
    onAdopt: vi.fn(async (c: Character) => ({ ...c, id: 'adopted-id' })),
    onRestored: vi.fn<() => void>(),
    ...over,
  };
}

function jsonFile(content: string, name = 'data.json'): File {
  return new File([content], name, { type: 'application/json' });
}

const FILE_INPUT = 'Choose a character JSON file to import';

async function resetAllDbs(): Promise<void> {
  _resetSnapshotDbForTests();
  _resetDbForTests();
  _resetPortraitDbForTests();
  for (const name of ['dnd-snapshots', 'dnd-char-sheet', 'dnd-portraits']) {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
}

beforeEach(async () => {
  await resetAllDbs();
  localStorage.clear();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  await getSnapshotStore().init();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DataBackupCard', () => {
  it('renders the card with its controls', () => {
    render(<DataBackupCard {...baseProps()} />);
    expect(screen.getByText('Data & Backup')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Enable automatic backups' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Download full backup/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Restore from auto-backup/ }),
    ).toBeInTheDocument();
    // Never backed up in a fresh store.
    expect(screen.getByText('Last backed up: never')).toBeInTheDocument();
  });

  it('persists the toggle via snapshot-settings', async () => {
    const user = userEvent.setup();
    render(<DataBackupCard {...baseProps()} />);

    const toggle = screen.getByRole('checkbox', { name: 'Enable automatic backups' });
    expect(toggle).toBeChecked(); // default ON

    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(isAutoBackupEnabled()).toBe(false);
    expect(localStorage.getItem(AUTO_BACKUP_ENABLED_KEY)).toBe('false');

    await user.click(toggle);
    expect(isAutoBackupEnabled()).toBe(true);
  });

  it('"Download full backup" calls the backup path', async () => {
    await adoptCharacter(makeCharacter('Hero'));

    const assembleSpy = vi.spyOn(backupService, 'assembleBackup');
    const downloadSpy = vi.spyOn(backupService, 'downloadBackup');
    const user = userEvent.setup();

    render(<DataBackupCard {...baseProps()} />);
    await user.click(screen.getByRole('button', { name: /Download full backup/ }));

    await waitFor(() => {
      expect(assembleSpy).toHaveBeenCalledTimes(1);
      expect(downloadSpy).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/Backup downloaded — 1 character saved\./)).toBeInTheDocument();
  });

  it('routes a chosen snapshot through restore and calls onRestored', async () => {
    // Seed + snapshot, then delete live so a restore re-adds the character.
    const seeded = await adoptCharacter(makeCharacter('Ghost'));
    await takeSnapshot(getSnapshotStore());
    await deleteCharacter(seeded.id);

    const restoreSpy = vi.spyOn(restoreService, 'restoreCharacters');
    const onRestored = vi.fn();
    const user = userEvent.setup();

    render(<DataBackupCard {...baseProps({ onRestored })} />);

    // Reveal the snapshot list, then choose the snapshot.
    await user.click(screen.getByRole('button', { name: /Restore from auto-backup/ }));
    const snapshotButton = await screen.findByText(/1 character/, { selector: 'span' });
    await user.click(snapshotButton);

    // Confirm dialog -> Restore.
    await waitFor(() => {
      expect(screen.getByText(/Restore 1 character\?/)).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(restoreSpy).toHaveBeenCalledTimes(1);
      expect(onRestored).toHaveBeenCalledTimes(1);
    });

    const summaries = await listSummaries();
    expect(summaries.length).toBe(1);
    expect(summaries[0].name).toBe('Ghost');
  });

  it('renders all three scopes with their controls', () => {
    render(<DataBackupCard {...baseProps()} />);
    expect(screen.getByRole('heading', { name: 'This character' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All characters' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Automatic safety net' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export current character/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import from file/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restore from backup file/ })).toBeInTheDocument();
  });

  it('export still calls exportToFile', async () => {
    const exportSpy = vi.spyOn(exportImport, 'exportToFile').mockResolvedValue();
    const props = baseProps();
    const user = userEvent.setup();
    render(<DataBackupCard {...props} />);
    await user.click(screen.getByRole('button', { name: /Export current character/ }));
    await waitFor(() => expect(exportSpy).toHaveBeenCalledWith(props.character, props.character.id));
    expect(await screen.findByText(/Exported/)).toBeInTheDocument();
  });

  it('imports a single-character file as a new character', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<DataBackupCard {...props} />);
    const single = JSON.stringify({ ...makeCharacter('Solo'), id: 'old' });
    await user.upload(screen.getByLabelText(FILE_INPUT), jsonFile(single));
    await waitFor(() => expect(props.onAdopt).toHaveBeenCalledTimes(1));
    expect(props.onAdopt.mock.calls[0][0].name).toBe('Solo');
    expect(props.onAdopt.mock.calls[0][0].id).toBe('');
    expect(await screen.findByText(/Imported .Solo. as a new character/)).toBeInTheDocument();
    expect(props.onRestored).not.toHaveBeenCalled();
  });

  it('a full-backup file shows the confirm dialog, then restores and calls onRestored', async () => {
    await adoptCharacter(makeCharacter('Alpha'));
    await adoptCharacter(makeCharacter('Beta'));
    const assembled = await backupService.assembleBackup();
    if (!assembled.ok) throw new Error('assemble failed');
    const json = JSON.stringify(assembled.payload);

    const props = baseProps();
    const user = userEvent.setup();
    render(<DataBackupCard {...props} />);
    await user.upload(screen.getByLabelText(FILE_INPUT), jsonFile(json));

    expect(await screen.findByText(/Restore 2 characters\?/)).toBeInTheDocument();
    expect(screen.getByText(/Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/Beta/)).toBeInTheDocument();
    // Existing names are called out as duplicates.
    expect(screen.getByRole('dialog').textContent).toMatch(/already exist/i);
    expect(props.onAdopt).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(props.onRestored).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Restored 2 characters\./)).toBeInTheDocument();

    const summaries = await listSummaries();
    expect(summaries).toHaveLength(4);
    expect(props.onAdopt).not.toHaveBeenCalled();
  });

  it('cancelling the backup confirm changes nothing', async () => {
    await adoptCharacter(makeCharacter('Alpha'));
    const assembled = await backupService.assembleBackup();
    if (!assembled.ok) throw new Error('assemble failed');
    const props = baseProps();
    const user = userEvent.setup();
    render(<DataBackupCard {...props} />);
    await user.click(screen.getByRole('button', { name: /Restore from backup file/ }));
    await user.upload(
      screen.getByLabelText(FILE_INPUT),
      jsonFile(JSON.stringify(assembled.payload)),
    );
    await screen.findByText(/Restore 1 character\?/);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onRestored).not.toHaveBeenCalled();
    expect(await listSummaries()).toHaveLength(1);
  });

  it.each([
    ['malformed JSON', '{not json'],
    ['wrong shape', JSON.stringify({ foo: 'bar' })],
    ['newer-version backup', JSON.stringify({ version: 99, characters: [{}] })],
    ['empty backup', JSON.stringify({ version: 1, characters: [] })],
  ])('an invalid file (%s) shows an alert and changes nothing', async (_label, content) => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<DataBackupCard {...props} />);
    await user.upload(screen.getByLabelText(FILE_INPUT), jsonFile(content));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(props.onAdopt).not.toHaveBeenCalled();
    expect(props.onRestored).not.toHaveBeenCalled();
    expect(await listSummaries()).toHaveLength(0);
  });

  it.each([
    ['malformed JSON', '{not json'],
    ['a backup whose character entries are corrupt', JSON.stringify({ version: 1, characters: [{}] })],
  ])('a bad file (%s) leaves the existing roster untouched', async (_label, content) => {
    await adoptCharacter(makeCharacter('Keeper'));
    const before = await listSummaries();
    expect(before).toHaveLength(1);

    const props = baseProps();
    const user = userEvent.setup();
    render(<DataBackupCard {...props} />);
    await user.upload(screen.getByLabelText(FILE_INPUT), jsonFile(content));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(props.onAdopt).not.toHaveBeenCalled();
    expect(props.onRestored).not.toHaveBeenCalled();
    const after = await listSummaries();
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(before[0].id);
  });

  it('can re-choose the same file after an error', async () => {
    const props = baseProps();
    const user = userEvent.setup();
    render(<DataBackupCard {...props} />);
    const input = screen.getByLabelText(FILE_INPUT) as HTMLInputElement;
    const bad = jsonFile('{nope');
    await user.upload(input, bad);
    await screen.findByRole('alert');
    expect(input.value).toBe('');
    await user.upload(input, bad);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});