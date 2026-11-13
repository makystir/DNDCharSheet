import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { getPortraitStore, _resetPortraitDbForTests } from '../portrait-store';
import * as codec from '../portrait-codec';
import {
  collectCompanionPortraits,
  companionPortraitKey,
  copyCompanionPortraits,
  deleteCompanionPortraits,
  pruneCompanionPortraits,
  restoreCompanionPortraits,
  sanitizeCompanionPortraitMap,
  trackedRecordIds,
} from '../companion-portraits';
import { exportCharacter, importFromJSON } from '../export-import';
import { trimForLink } from '../../logic/share-portrait';
import { createCharacter, listCharacters, newCharacterId, saveCharacter, _resetDbForTests } from '../character-store';
import { assembleBackup } from '../backup-service';
import { restoreCharacters } from '../restore-service';
import type { Character } from '../../types/character';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function pngBlob(): Blob {
  return new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });
}

function sheet(id = 'char-1'): Character {
  return {
    ...createCharacter('Owner'),
    id,
    companions: [{ id: 'c1', creatureId: 'wolf', origin: 'pet' }],
    hirelings: [{ id: 'h1', name: 'Smith', kind: 'skilled', units: 1 }],
  };
}

beforeEach(async () => {
  _resetPortraitDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('dnd-portraits');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  // jsdom's FileReader cannot read a Blob that came back out of fake-indexeddb,
  // so stand in for the encoder (the codec has its own tests).
  vi.spyOn(codec, 'blobToBase64').mockResolvedValue(PNG);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('companion portraits in the Portrait Store', () => {
  it('keys a record portrait by character and record id, apart from the character portrait', async () => {
    const store = getPortraitStore();
    expect(companionPortraitKey('char-1', 'c1')).toBe('char-1:c1');
    await store.savePortrait('char-1', pngBlob());
    await store.savePortrait('char-1:c1', pngBlob());
    await store.savePortrait('char-10:c1', pngBlob());
    const keys = await store.listKeysWithPrefix('char-1:');
    expect(keys.ok && keys.value).toEqual(['char-1:c1']);
  });

  it('lists every record id across the Companions page lists', () => {
    expect(trackedRecordIds(sheet())).toEqual(['c1', 'h1']);
  });

  it('collects portraits as data-URLs by record id, and restores them under a new character id', async () => {
    const store = getPortraitStore();
    await store.savePortrait('char-1:c1', pngBlob());
    const collected = await collectCompanionPortraits(sheet());
    expect(Object.keys(collected ?? {})).toEqual(['c1']);
    expect(collected?.c1).toBe(PNG);

    const restored = await restoreCompanionPortraits(sheet('char-2'), collected);
    expect(restored).toEqual({ saved: 1, quota: false });
    const blob = await store.getPortraitBlob('char-2:c1');
    expect(blob.ok && blob.value).toBeTruthy();
  });

  it('collects nothing for a sheet without portraits', async () => {
    expect(await collectCompanionPortraits(sheet())).toBeUndefined();
  });

  it('keeps only valid image data-URLs for records the character has', () => {
    const clean = sanitizeCompanionPortraitMap(
      { c1: PNG, h1: 'javascript:alert(1)', ghost: PNG, __proto__: PNG },
      sheet(),
    );
    expect(clean).toEqual({ c1: PNG });
    expect(sanitizeCompanionPortraitMap('nope', sheet())).toBeUndefined();
    expect(sanitizeCompanionPortraitMap([PNG], sheet())).toBeUndefined();
  });

  it('copies a sheet\u2019s portraits to a duplicate and deletes them with the character', async () => {
    const store = getPortraitStore();
    await store.savePortrait('char-1:c1', pngBlob());
    await store.savePortrait('char-1:h1', pngBlob());
    await copyCompanionPortraits('char-1', 'char-9');
    const copied = await store.listKeysWithPrefix('char-9:');
    expect(copied.ok && copied.value.sort()).toEqual(['char-9:c1', 'char-9:h1']);

    await deleteCompanionPortraits('char-1');
    const left = await store.listKeysWithPrefix('char-1:');
    expect(left.ok && left.value).toEqual([]);
    const other = await store.listKeysWithPrefix('char-9:');
    expect(other.ok && other.value).toHaveLength(2);
  });

  it('prunes portraits whose record was removed', async () => {
    const store = getPortraitStore();
    await store.savePortrait('char-1:c1', pngBlob());
    await store.savePortrait('char-1:gone', pngBlob());
    await pruneCompanionPortraits(sheet());
    const keys = await store.listKeysWithPrefix('char-1:');
    expect(keys.ok && keys.value).toEqual(['char-1:c1']);
  });
});

describe('companion portraits in a full backup', () => {
  it('backs them up with the character and restores them under the restored character\u2019s new id', async () => {
    _resetDbForTests();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('dnd-char-sheet');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
    const saved = await saveCharacter(sheet(newCharacterId()));
    await getPortraitStore().savePortrait(`${saved.id}:c1`, pngBlob());

    const backup = await assembleBackup();
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    expect(backup.payload.characters[0].companionPortraits).toEqual({ c1: PNG });

    const summary = await restoreCharacters(backup.payload.characters);
    expect(summary.imported).toBe(1);
    const all = await listCharacters();
    const restored = all.find((c) => c.id !== saved.id);
    expect(restored).toBeDefined();
    const blob = await getPortraitStore().getPortraitBlob(`${restored?.id}:c1`);
    expect(blob.ok && blob.value).toBeTruthy();
  });
});

describe('companion portraits travel with export and import, never with a share link', () => {
  it('embeds them in an export and separates them on import (records that exist only)', async () => {
    await getPortraitStore().savePortrait('char-1:c1', pngBlob());
    const json = await exportCharacter(sheet());
    const envelope = JSON.parse(json) as Record<string, unknown>;
    expect(Object.keys(envelope.companionPortraits as object)).toEqual(['c1']);

    const tampered = JSON.stringify({ ...envelope, companionPortraits: { ...(envelope.companionPortraits as object), ghost: PNG } });
    const result = importFromJSON(tampered);
    expect(result.success).toBe(true);
    expect(Object.keys(result.companionPortraits ?? {})).toEqual(['c1']);
    expect(result.character && 'companionPortraits' in result.character).toBe(false);
  });

  it('the link variant drops companion portraits', () => {
    const json = JSON.stringify({ name: 'X', companionPortraits: { c1: PNG } });
    expect(JSON.parse(trimForLink(json))).toEqual({ name: 'X' });
  });
});
