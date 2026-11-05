import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { render, screen, waitFor } from '@testing-library/react';
import { RestoreLaunchHost } from '../RestoreLaunchHost';
import { getSnapshotStore, _resetSnapshotDbForTests } from '../../../storage/snapshot-store';
import { takeSnapshot } from '../../../storage/snapshot-service';
import * as restoreService from '../../../storage/restore-service';
import { adoptCharacter, listSummaries } from '../../../storage/character-manager';
import { createCharacter, _resetDbForTests } from '../../../storage/character-store';
import { _resetPortraitDbForTests } from '../../../storage/portrait-store';
import type { Character } from '../../../types/character';

/**
 * RestoreLaunchHost integration tests (B3 auto-backup §4, adapted from the WFRP
 * `snapshot-restore.integration.test.tsx`). Uses fake-indexeddb under jsdom and
 * the real snapshot store/service bound to this app's async manager.
 *
 * Covers: NO prompt when live is a superset of the latest snapshot; a prompt
 * when live is empty but a snapshot exists; and that a confirmed restore routes
 * through the service (`restoreCharacters`) non-destructively.
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

describe('RestoreLaunchHost', () => {
  it('does NOT prompt when live is a superset of the latest snapshot', async () => {
    // Seed one live character, then snapshot that exact state (live ⊇ snapshot).
    await adoptCharacter(makeCharacter('Only'));
    await takeSnapshot(getSnapshotStore());

    const onRestored = vi.fn();
    render(<RestoreLaunchHost onRestored={onRestored} />);

    // Give the run-once async check time to settle, then assert no dialog.
    await waitFor(async () => {
      const summaries = await listSummaries();
      expect(summaries.length).toBe(1);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onRestored).not.toHaveBeenCalled();
  });

  it('prompts when live is empty but a snapshot exists', async () => {
    // Seed + snapshot, then delete live so the snapshot is strictly newer.
    const seeded = await adoptCharacter(makeCharacter('Ghost'));
    await takeSnapshot(getSnapshotStore());
    const { deleteCharacter } = await import('../../../storage/character-store');
    await deleteCharacter(seeded.id);

    render(<RestoreLaunchHost onRestored={vi.fn()} />);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/A more recent backup from/)).toBeInTheDocument();
  });

  it('routes a confirmed restore through restoreCharacters (non-destructive)', async () => {
    const seeded = await adoptCharacter(makeCharacter('Ghost'));
    await takeSnapshot(getSnapshotStore());
    const { deleteCharacter } = await import('../../../storage/character-store');
    await deleteCharacter(seeded.id);

    const restoreSpy = vi.spyOn(restoreService, 'restoreCharacters');
    const onRestored = vi.fn();
    const { default: userEventModule } = await import('@testing-library/user-event');
    const user = userEventModule.setup();

    render(<RestoreLaunchHost onRestored={onRestored} />);

    // Launch prompt -> Restore.
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    // Confirm dialog -> Restore.
    await waitFor(() => {
      expect(screen.getByText(/Restore 1 character\?/)).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(restoreSpy).toHaveBeenCalledTimes(1);
      expect(onRestored).toHaveBeenCalledTimes(1);
    });

    // The restore ADDED a fresh record (non-destructive): one live character.
    const summaries = await listSummaries();
    expect(summaries.length).toBe(1);
    expect(summaries[0].name).toBe('Ghost');
  });
});
