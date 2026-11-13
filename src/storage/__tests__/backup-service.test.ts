import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { assembleBackup, downloadBackup } from '../backup-service';
import type { BackupFile } from '../backup-types';
import { createCharacter } from '../character-manager';
import { getPortraitStore, _resetPortraitDbForTests } from '../portrait-store';
import * as portraitStoreModule from '../portrait-store';
import * as characterStoreModule from '../character-store';
import { _resetDbForTests } from '../character-store';
import { getLastBackupAt, LAST_BACKUP_KEY } from '../backup-reminder';

/**
 * Unit tests for the B3 BackupService:
 *  - round-trip: every character (+ portrait) is assembled.
 *  - empty roster -> { ok: false } and no download.
 *  - a load/portrait failure is skipped, not fatal.
 *  - downloadBackup updates the backup reminder.
 *
 * Uses the REAL async stores (fake-indexeddb) rather than mocking the manager,
 * so the async store/manager binding is exercised end-to-end.
 */

function makeBlob(bytes = 8): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'image/png' });
}

beforeEach(async () => {
  _resetPortraitDbForTests();
  _resetDbForTests();
  localStorage.clear();
  for (const name of ['dnd-portraits', 'dnd-char-sheet']) {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
  // jsdom lacks URL.createObjectURL / revokeObjectURL — stub per method.
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('assembleBackup — round-trip', () => {
  it('assembles all characters with their portraits', async () => {
    const a = await createCharacter('Aric');
    const b = await createCharacter('Brina');
    // Give one character a portrait.
    await getPortraitStore().savePortrait(a.id, makeBlob());

    const result = await assembleBackup();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.version).toBe(1);
      expect(result.payload.characterCount).toBe(2);
      const ids = result.payload.characters.map((c) => c.id).sort();
      expect(ids).toEqual([a.id, b.id].sort());
      const names = result.payload.characters
        .map((c) => c.character.name as string)
        .sort();
      expect(names).toEqual(['Aric', 'Brina']);
      expect(typeof result.payload.exportedAt).toBe('string');
      expect(result.payload.exportedAt.length).toBeGreaterThan(0);
    }
  });

  it('reports progress once per character', async () => {
    await createCharacter('One');
    await createCharacter('Two');
    const seen: Array<[number, number]> = [];
    await assembleBackup((current, total) => seen.push([current, total]));
    expect(seen).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });
});

describe('assembleBackup — empty roster', () => {
  it('returns { ok: false } and never triggers a download', async () => {
    const createElementSpy = vi.spyOn(document, 'createElement');
    const result = await assembleBackup();
    expect(result).toEqual({ ok: false, error: 'No characters to back up.' });
    expect(createElementSpy).not.toHaveBeenCalledWith('a');
  });
});

describe('assembleBackup — failure isolation', () => {
  it('skips a character whose load fails without aborting the backup', async () => {
    const a = await createCharacter('Good');
    const b = await createCharacter('Bad');

    // Make getCharacter reject for one id only, pass through for the other.
    const realGet = characterStoreModule.getCharacter;
    vi.spyOn(characterStoreModule, 'getCharacter').mockImplementation(async (id: string) => {
      if (id === b.id) throw new Error('boom');
      return realGet(id);
    });

    const result = await assembleBackup();
    // The good character still produces a payload; the bad one is skipped.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.characterCount).toBe(1);
      expect(result.payload.characters[0].id).toBe(a.id);
    }
  });

  it('includes a character with an empty portrait when portrait retrieval fails', async () => {
    await createCharacter('NoPic');
    vi.spyOn(portraitStoreModule, 'getPortraitStore').mockReturnValue({
      savePortrait: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
      getPortraitURL: vi.fn().mockResolvedValue({ ok: true, value: null }),
      getPortraitBlob: vi.fn().mockRejectedValue(new Error('portrait boom')),
      deletePortrait: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
      listKeysWithPrefix: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      revokeURL: vi.fn(),
    });

    const result = await assembleBackup();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.characters[0].portrait).toBe('');
    }
  });
});

describe('downloadBackup', () => {
  function minimalPayload(): BackupFile {
    return {
      version: 1,
      exportedAt: '2025-06-15T14:30:00.000Z',
      characterCount: 1,
      characters: [
        { id: 'id-1', character: { name: 'Test', level: 1, abilities: {} }, portrait: '' },
      ],
    };
  }

  it('produces a dnd-backup_YYYYMMDD-HHmm.json filename and records the backup', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T14:30:00'));
    const mockAnchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);

    expect(getLastBackupAt()).toBeNull();

    const result = downloadBackup(minimalPayload());
    expect(result.ok).toBe(true);
    expect(mockAnchor.download).toBe('dnd-backup_20250615-1430.json');
    expect(mockAnchor.download).toMatch(/^dnd-backup_\d{8}-\d{4}\.json$/);

    // The reminder timestamp was recorded.
    expect(localStorage.getItem(LAST_BACKUP_KEY)).not.toBeNull();
    expect(getLastBackupAt()).not.toBeNull();

    vi.useRealTimers();
  });

  it('returns a "too large" error when Blob construction throws', () => {
    const originalBlob = globalThis.Blob;
    // @ts-expect-error — deliberately replace Blob to force the failure path.
    globalThis.Blob = class {
      constructor() {
        throw new Error('Blob too large');
      }
    };
    try {
      const result = downloadBackup(minimalPayload());
      expect(result).toEqual({
        ok: false,
        error: 'Backup file is too large to download. Try exporting characters in smaller groups.',
      });
    } finally {
      globalThis.Blob = originalBlob;
    }
  });
});
