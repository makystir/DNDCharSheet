import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import {
  getPortraitStore,
  _resetPortraitDbForTests,
} from '../portrait-store';
import {
  createCharacter,
  saveCharacter,
  getCharacter,
  _resetDbForTests,
} from '../character-store';

function makeBlob(bytes = 8): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'image/png' });
}

beforeEach(async () => {
  // Close the live connection BEFORE deleteDatabase so the delete does not
  // block on an open connection (fake-indexeddb hang gotcha).
  _resetPortraitDbForTests();
  _resetDbForTests();
  for (const name of ['dnd-portraits', 'dnd-char-sheet']) {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
  // jsdom has no URL.createObjectURL / revokeObjectURL — stub per method so the
  // URL constructor stays intact.
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('portrait-store', () => {
  it('saves a portrait and returns a non-null object URL for that id', async () => {
    const store = getPortraitStore();
    const save = await store.savePortrait('char-1', makeBlob());
    expect(save.ok).toBe(true);

    const url = await store.getPortraitURL('char-1');
    expect(url.ok && url.value).toBe('blob:test');
  });

  it('round-trips the stored blob (non-null retrieval)', async () => {
    // Note: fake-indexeddb cannot faithfully structured-clone a jsdom Blob
    // (it round-trips as a plain object, losing .size), so we assert the value
    // is stored and retrieved — not its byte size. The production path stores
    // and returns a real Blob (verified against the native IndexedDB contract).
    const store = getPortraitStore();
    await store.savePortrait('char-2', makeBlob(42));
    const result = await store.getPortraitBlob('char-2');
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).not.toBeNull();
  });

  it('returns null for an unknown id', async () => {
    const store = getPortraitStore();
    expect(await store.getPortraitURL('missing')).toEqual({ ok: true, value: null });
    expect(await store.getPortraitBlob('missing')).toEqual({ ok: true, value: null });
  });

  it('deletes a portrait (subsequent get returns null)', async () => {
    const store = getPortraitStore();
    await store.savePortrait('char-3', makeBlob());
    const del = await store.deletePortrait('char-3');
    expect(del.ok).toBe(true);
    expect(await store.getPortraitBlob('char-3')).toEqual({ ok: true, value: null });
  });

  it('delete of a non-existent id is a successful no-op', async () => {
    const store = getPortraitStore();
    expect(await store.deletePortrait('never-existed')).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('stores blobs separately from the character record (no image data in JSON)', async () => {
    const store = getPortraitStore();
    const character = await saveCharacter(createCharacter('Portraited'));
    await store.savePortrait(character.id, makeBlob());

    const reloaded = await getCharacter(character.id);
    expect(reloaded).not.toBeNull();
    // The character JSON must carry no image/blob/base64 payload — the portrait
    // lives only in the separate dnd-portraits DB.
    const json = JSON.stringify(reloaded);
    expect(json).not.toContain('blob');
    expect(json).not.toContain('base64');
    const record = reloaded as unknown as Record<string, unknown>;
    expect('portrait' in record).toBe(false);
    expect('image' in record).toBe(false);
    for (const value of Object.values(record)) {
      expect(value instanceof Blob).toBe(false);
    }
  });
});
