import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import {
  validateBackupFile,
  detectDuplicates,
  restoreCharacters,
} from '../restore-service';
import { createCharacter, listSummaries } from '../character-manager';
import * as managerModule from '../character-manager';
import { _resetDbForTests, getCharacter } from '../character-store';
import { _resetPortraitDbForTests } from '../portrait-store';
import type { BackupCharacterEntry } from '../backup-types';

/**
 * Unit tests for the B3 RestoreService:
 *  - validateBackupFile rejects garbage / wrong-version / count-mismatch.
 *  - detectDuplicates returns names that already exist locally.
 *  - restoreCharacters adopts each character under a FRESH id (never
 *    overwrites an existing character), runs each through runMigration, and
 *    reports quota stop + counts.
 *
 * Uses the REAL async manager/store (fake-indexeddb) to exercise the binding.
 */

/** A valid DND backup entry (name + numeric level + abilities object). */
function makeEntry(name: string, extra: Record<string, unknown> = {}): BackupCharacterEntry {
  return {
    id: crypto.randomUUID(),
    character: {
      _v: 1,
      name,
      level: 1,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ...extra,
    },
    portrait: '',
  };
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
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validateBackupFile', () => {
  it('rejects non-JSON', () => {
    const r = validateBackupFile('not json {');
    expect(r.ok).toBe(false);
  });

  it('rejects a non-object top level', () => {
    expect(validateBackupFile('[]').ok).toBe(false);
    expect(validateBackupFile('42').ok).toBe(false);
    expect(validateBackupFile('null').ok).toBe(false);
  });

  it('rejects a missing/non-numeric version', () => {
    const r = validateBackupFile(JSON.stringify({ characters: [makeEntry('A')] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/version/i);
  });

  it('rejects a version newer than 1', () => {
    const r = validateBackupFile(
      JSON.stringify({ version: 2, characters: [makeEntry('A')] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Unsupported backup version/);
  });

  it('rejects a missing or empty characters array', () => {
    expect(validateBackupFile(JSON.stringify({ version: 1 })).ok).toBe(false);
    expect(validateBackupFile(JSON.stringify({ version: 1, characters: [] })).ok).toBe(false);
  });

  it('rejects a characterCount that mismatches the array length', () => {
    const r = validateBackupFile(
      JSON.stringify({ version: 1, characterCount: 5, characters: [makeEntry('A')] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/mismatch/);
  });

  it('accepts a valid file and reports the metadata/characters', () => {
    const characters = Array.from({ length: 3 }, (_, i) => makeEntry(`C${i}`));
    const r = validateBackupFile(
      JSON.stringify({ version: 1, exportedAt: 'x', characterCount: 3, characters }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.metadata.characterCount).toBe(3);
      expect(r.characters).toHaveLength(3);
    }
  });
});

describe('detectDuplicates', () => {
  it('returns names that already exist locally', async () => {
    await createCharacter('Aldric');
    await createCharacter('Brunhild');

    const result = await detectDuplicates([
      makeEntry('Aldric'),
      makeEntry('Cassius'),
      makeEntry('Brunhild'),
    ]);
    expect(result.sort()).toEqual(['Aldric', 'Brunhild']);
  });

  it('returns empty when there are no existing characters', async () => {
    const result = await detectDuplicates([makeEntry('Aldric')]);
    expect(result).toHaveLength(0);
  });
});

describe('restoreCharacters — fresh-id adoption (never overwrites)', () => {
  it('adopts each restored character under a NEW id, leaving the existing one intact', async () => {
    const existing = await createCharacter('Original');
    const existingId = existing.id;

    // A backup entry carrying the SAME id as the existing character.
    const entry = makeEntry('Original');
    entry.id = existingId;

    const summary = await restoreCharacters([entry]);
    expect(summary.imported).toBe(1);
    // The existing character is untouched.
    expect(await getCharacter(existingId)).not.toBeNull();
    // A fresh character was added (same name, different id) → duplicate name.
    const all = await listSummaries();
    expect(all).toHaveLength(2);
    expect(all.filter((c) => c.name === 'Original')).toHaveLength(2);
    expect(summary.duplicateNames).toEqual(['Original']);
  });

  it('restores MULTIPLE characters as distinct records (no collapse onto one id)', async () => {
    const summary = await restoreCharacters([
      makeEntry('Alpha'),
      makeEntry('Bravo'),
      makeEntry('Charlie'),
    ]);
    expect(summary.imported).toBe(3);

    const all = await listSummaries();
    expect(all).toHaveLength(3);
    expect(all.map((c) => c.name).sort()).toEqual(['Alpha', 'Bravo', 'Charlie']);

    // Every persisted record has a distinct, non-empty id.
    const ids = all.map((c) => c.id);
    expect(ids.every((id) => id !== '')).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });

  it('skips an entry missing required fields (name/level/abilities)', async () => {
    const bad: BackupCharacterEntry = {
      id: 'x',
      character: { name: 'NoLevel' }, // missing level + abilities
      portrait: '',
    };
    const summary = await restoreCharacters([bad, makeEntry('Good')]);
    expect(summary.imported).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.skippedDetails[0].nameOrIndex).toBe('NoLevel');
  });

  it('runs each record through runMigration (stamps _v to current)', async () => {
    // A legacy record with no _v should be upgraded and adopted.
    const entry = makeEntry('Legacy');
    delete (entry.character as Record<string, unknown>)._v;

    const summary = await restoreCharacters([entry]);
    expect(summary.imported).toBe(1);
    const all = await listSummaries();
    const saved = await getCharacter(all[0].id);
    expect(saved?._v).toBe(1);
  });
});

describe('restoreCharacters — quota stop', () => {
  it('stops importing when adopt rejects with a quota error and reports stoppedByQuota', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const realAdopt = managerModule.adoptCharacter;
    vi.spyOn(managerModule, 'adoptCharacter').mockImplementation(async (character) => {
      calls++;
      if (calls <= 2) return realAdopt(character);
      throw new DOMException('quota', 'QuotaExceededError');
    });

    const characters = [
      makeEntry('C1'),
      makeEntry('C2'),
      makeEntry('C3'),
      makeEntry('C4'),
      makeEntry('C5'),
    ];

    const promise = restoreCharacters(characters);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.imported).toBe(2);
    expect(result.stoppedByQuota).toBe(true);
    // Only 3 adopt calls (2 ok + 1 rejecting); 4 and 5 are never processed.
    expect(calls).toBe(3);

    vi.useRealTimers();
  });
});
