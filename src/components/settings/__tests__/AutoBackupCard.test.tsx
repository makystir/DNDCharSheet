import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutoBackupCard } from '../AutoBackupCard';
import { getSnapshotStore, _resetSnapshotDbForTests } from '../../../storage/snapshot-store';
import { takeSnapshot } from '../../../storage/snapshot-service';
import * as restoreService from '../../../storage/restore-service';
import * as backupService from '../../../storage/backup-service';
import { adoptCharacter, listSummaries } from '../../../storage/character-manager';
import { isAutoBackupEnabled, AUTO_BACKUP_ENABLED_KEY } from '../../../storage/snapshot-settings';
import { createCharacter, _resetDbForTests, deleteCharacter } from '../../../storage/character-store';
import { _resetPortraitDbForTests } from '../../../storage/portrait-store';
import type { Character } from '../../../types/character';

/**
 * AutoBackupCard tests (B3 auto-backup §5). Uses fake-indexeddb under jsdom and
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

describe('AutoBackupCard', () => {
  it('renders the card with its controls', () => {
    render(<AutoBackupCard onRestored={vi.fn()} />);
    expect(screen.getByText('Auto-backup')).toBeInTheDocument();
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
    render(<AutoBackupCard onRestored={vi.fn()} />);

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

    render(<AutoBackupCard onRestored={vi.fn()} />);
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

    render(<AutoBackupCard onRestored={onRestored} />);

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
});
