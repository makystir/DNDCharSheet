import { describe, it, expect, beforeEach } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { detectImportKind, buildRestorePlan } from '../restore-plan';
import { assembleBackup } from '../backup-service';
import { restoreCharacters } from '../restore-service';
import { adoptCharacter, listSummaries } from '../character-manager';
import { createCharacter, _resetDbForTests } from '../character-store';
import { _resetPortraitDbForTests } from '../portrait-store';
import { CURRENT_VERSION } from '../../types/character';

async function resetAllDbs(): Promise<void> {
  _resetDbForTests();
  _resetPortraitDbForTests();
  for (const name of ['dnd-char-sheet', 'dnd-portraits']) {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
}

const backupJson = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    version: 1,
    exportedAt: '2024-01-01T00:00:00.000Z',
    characterCount: 1,
    characters: [
      { id: 'a', character: { name: 'Aric', level: 1, abilities: {} }, portrait: '' },
    ],
    ...over,
  });

describe('detectImportKind', () => {
  it('detects a single-character export', () => {
    expect(
      detectImportKind(JSON.stringify({ name: 'Aric', level: 3, abilities: { str: 10 } })),
    ).toBe('character');
  });

  it('detects a full backup', () => {
    expect(detectImportKind(backupJson())).toBe('backup');
  });

  it('treats a newer-version backup as a backup (validation reports the version)', () => {
    expect(detectImportKind(backupJson({ version: 99 }))).toBe('backup');
  });

  it('treats a newer-version character as a character', () => {
    expect(
      detectImportKind(
        JSON.stringify({ name: 'A', level: 1, abilities: {}, _v: CURRENT_VERSION + 1 }),
      ),
    ).toBe('character');
  });

  it('returns unknown for garbage, empty, arrays and primitives', () => {
    expect(detectImportKind('not json')).toBe('unknown');
    expect(detectImportKind('')).toBe('unknown');
    expect(detectImportKind('null')).toBe('unknown');
    expect(detectImportKind('42')).toBe('unknown');
    expect(detectImportKind('[]')).toBe('unknown');
    expect(detectImportKind('{}')).toBe('unknown');
    expect(detectImportKind(JSON.stringify({ foo: 'bar' }))).toBe('unknown');
  });
});

describe('buildRestorePlan', () => {
  beforeEach(async () => {
    await resetAllDbs();
  });

  it('builds a plan with count and names', async () => {
    const out = await buildRestorePlan(backupJson());
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.plan.characterCount).toBe(1);
      expect(out.plan.characterNames).toEqual(['Aric']);
      expect(out.plan.duplicateNames).toEqual([]);
    }
  });

  it('flags names that already exist locally as duplicates', async () => {
    await adoptCharacter({ ...createCharacter('Aric'), level: 1 });
    const out = await buildRestorePlan(backupJson());
    expect(out.ok && out.plan.duplicateNames).toEqual(['Aric']);
  });

  it('rejects a newer-version backup, bad JSON and wrong shapes', async () => {
    const newer = await buildRestorePlan(backupJson({ version: 2 }));
    expect(newer.ok).toBe(false);
    expect((await buildRestorePlan('nope')).ok).toBe(false);
    expect((await buildRestorePlan(backupJson({ characters: [] }))).ok).toBe(false);
    expect((await buildRestorePlan(backupJson({ characterCount: 5 }))).ok).toBe(false);
  });

  it('round-trips assembleBackup -> JSON -> restore as NEW records', async () => {
    const a = await adoptCharacter({ ...createCharacter('Aric'), level: 3 });
    const b = await adoptCharacter({ ...createCharacter('Brea'), level: 5 });

    const assembled = await assembleBackup();
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;
    const json = JSON.stringify(assembled.payload);
    expect(detectImportKind(json)).toBe('backup');

    const built = await buildRestorePlan(json);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.plan.characterNames.sort()).toEqual(['Aric', 'Brea']);
    expect(built.plan.duplicateNames.sort()).toEqual(['Aric', 'Brea']);

    const summary = await restoreCharacters(built.plan.characters);
    expect(summary.imported).toBe(2);
    expect(summary.skipped).toBe(0);

    const all = await listSummaries();
    expect(all).toHaveLength(4);
    const ids = all.map((c) => c.id);
    expect(new Set(ids).size).toBe(4);
    // Originals untouched; copies carry the same names/levels under fresh ids.
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
    expect(all.filter((c) => c.name === 'Aric')).toHaveLength(2);
    expect(all.filter((c) => c.name === 'Brea')).toHaveLength(2);
  });
});
