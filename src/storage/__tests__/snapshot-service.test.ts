import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import type { BackupFile } from '../backup-types';
import type {
  ISnapshotStore,
  SnapshotResult,
  SnapshotMeta,
  SnapshotRecord,
} from '../snapshot-store';

/**
 * Service tests (B3 design §9): throttle/flush coalescing, live-save isolation,
 * the no-download-on-any-lifecycle-event negative assertion, and takeSnapshot's
 * empty-roster skip.
 *
 * The backup/download primitives are mocked so we can observe snapshot writes
 * deterministically without real serialization. Because FEAT-001 adds the
 * change SIGNAL (not the wiring into saveCharacter — that is FEAT-002's App
 * wiring), the controller is driven via the public `notifyCharacterDataChange`.
 */

vi.mock('../backup-service', () => ({
  assembleBackup: vi.fn(),
  downloadBackup: vi.fn(() => ({ ok: true })),
}));

import { assembleBackup, downloadBackup } from '../backup-service';
import { startSnapshotController, takeSnapshot } from '../snapshot-service';
import { notifyCharacterDataChange, createCharacter } from '../character-manager';
import { _resetDbForTests } from '../character-store';
import { _resetPortraitDbForTests } from '../portrait-store';

const okBackup: BackupFile = {
  version: 1,
  exportedAt: new Date().toISOString(),
  characterCount: 1,
  characters: [{ id: 'c1', character: { name: 'C1', level: 1, abilities: {} }, portrait: '' }],
};

/** A fake snapshot store that records putSnapshot calls. */
function makeFakeStore(opts: { putOk?: boolean } = {}): {
  store: ISnapshotStore;
  puts: BackupFile[];
} {
  const puts: BackupFile[] = [];
  const store: ISnapshotStore = {
    init: vi.fn(async () => {}),
    isDegraded: vi.fn(() => false),
    putSnapshot: vi.fn(async (payload: BackupFile): Promise<SnapshotResult<void>> => {
      puts.push(payload);
      return opts.putOk === false
        ? { ok: false, error: 'quota' }
        : { ok: true, value: undefined };
    }),
    listSnapshots: vi.fn(async (): Promise<SnapshotResult<SnapshotMeta[]>> => ({ ok: true, value: [] })),
    getSnapshot: vi.fn(async (): Promise<SnapshotResult<SnapshotRecord | null>> => ({ ok: true, value: null })),
    getLatestSnapshot: vi.fn(async (): Promise<SnapshotResult<SnapshotRecord | null>> => ({ ok: true, value: null })),
    clearSnapshots: vi.fn(async (): Promise<SnapshotResult<void>> => ({ ok: true, value: undefined })),
  };
  return { store, puts };
}

beforeEach(async () => {
  _resetDbForTests();
  _resetPortraitDbForTests();
  localStorage.clear();
  for (const name of ['dnd-char-sheet', 'dnd-portraits']) {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
  vi.mocked(assembleBackup).mockResolvedValue({ ok: true, payload: okBackup });
  vi.mocked(downloadBackup).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Test 8: live-save isolation', () => {
  it('a rejecting putSnapshot never breaks a live saveCharacter', async () => {
    const { store } = makeFakeStore({ putOk: false });
    const controller = startSnapshotController(store);

    // A real async save succeeds regardless of the snapshot store rejecting.
    const char = await createCharacter('Hero');
    notifyCharacterDataChange();
    expect(char.id).toBeTruthy();

    controller.stop();
  });
});

describe('Test 14: throttle/flush coalescing + no downloads on lifecycle events', () => {
  it('coalesces rapid changes into one write per window; fires on timer', async () => {
    vi.useFakeTimers();
    const { store, puts } = makeFakeStore();
    const controller = startSnapshotController(store);

    // Three rapid change signals within the window coalesce.
    notifyCharacterDataChange();
    notifyCharacterDataChange();
    notifyCharacterDataChange();

    // Nothing written yet (trailing throttle).
    expect(puts.length).toBe(0);

    // Advance past the throttle window and flush queued microtasks.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(puts.length).toBe(1);

    controller.stop();
  });

  it('visibilitychange→hidden flushes only when dirty', async () => {
    vi.useFakeTimers();
    const { store, puts } = makeFakeStore();
    const controller = startSnapshotController(store);

    // No pending change: a hidden event writes nothing.
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(puts.length).toBe(0);

    // Signal a change, then hide: forces an immediate write.
    notifyCharacterDataChange();
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(puts.length).toBe(1);

    controller.stop();
  });

  it('never triggers a file download on visibilitychange→hidden, pagehide, or beforeunload', async () => {
    vi.useFakeTimers();
    const { store } = makeFakeStore();
    const controller = startSnapshotController(store);

    notifyCharacterDataChange();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('beforeunload'));
    await vi.advanceTimersByTimeAsync(60_000);

    // The controller only writes to IndexedDB; it NEVER triggers a file download.
    expect(downloadBackup).not.toHaveBeenCalled();

    controller.stop();
  });

  it('stop() unsubscribes so later change signals do not write', async () => {
    vi.useFakeTimers();
    const { store, puts } = makeFakeStore();
    const controller = startSnapshotController(store);
    controller.stop();

    notifyCharacterDataChange();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(puts.length).toBe(0);
  });
});

describe('takeSnapshot', () => {
  it('skips the write when there are no characters (assembleBackup ok:false)', async () => {
    const { store, puts } = makeFakeStore();
    vi.mocked(assembleBackup).mockResolvedValueOnce({ ok: false, error: 'No characters to back up.' });
    await takeSnapshot(store);
    expect(puts.length).toBe(0);
  });

  it('writes the assembled payload when characters exist', async () => {
    const { store, puts } = makeFakeStore();
    await takeSnapshot(store);
    expect(puts.length).toBe(1);
    expect(puts[0]).toEqual(okBackup);
  });
});
