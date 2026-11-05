import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import {
  createCharacter,
  adoptCharacter,
  switchCharacter,
  duplicateCharacter,
  renameCharacter,
  deleteCharacter,
  listSummaries,
  resolveActiveCharacter,
  getActiveCharacterId,
  setActiveCharacterId,
  toSummary,
} from '../character-manager';
import {
  createCharacter as storeCreateCharacter,
  getCharacter,
  _resetDbForTests,
} from '../character-store';
import { getPortraitStore, _resetPortraitDbForTests } from '../portrait-store';
import type { Character } from '../../types/character';

const ACTIVE_ID_KEY = 'dnd-active-character-id';

function makeBlob(bytes = 8): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'image/png' });
}

beforeEach(async () => {
  // Fresh DBs + localStorage per test.
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
  // jsdom lacks URL.createObjectURL/revokeObjectURL.
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('character-manager: active id persistence', () => {
  it('createCharacter persists the new character as active', async () => {
    const char = await createCharacter('Aric');
    expect(getActiveCharacterId()).toBe(char.id);
    expect(localStorage.getItem(ACTIVE_ID_KEY)).toBe(char.id);
    expect(await getCharacter(char.id)).not.toBeNull();
  });

  it('creating a second character does not delete the first', async () => {
    const a = await createCharacter('First');
    const b = await createCharacter('Second');
    const summaries = await listSummaries();
    expect(summaries.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
    expect(getActiveCharacterId()).toBe(b.id);
  });

  it('resolveActiveCharacter reopens the persisted active character, not just the newest', async () => {
    const a = await createCharacter('Alpha');
    await new Promise((r) => setTimeout(r, 2));
    await createCharacter('Beta'); // Beta is newest + active
    // Force the active id back to Alpha, as a reload of a prior session would.
    setActiveCharacterId(a.id);
    const resolved = await resolveActiveCharacter();
    expect(resolved?.id).toBe(a.id);
    expect(getActiveCharacterId()).toBe(a.id);
  });

  it('resolveActiveCharacter falls back to the newest when the active id is stale', async () => {
    const a = await createCharacter('Alpha');
    await new Promise((r) => setTimeout(r, 2));
    const b = await createCharacter('Beta');
    setActiveCharacterId('does-not-exist');
    const resolved = await resolveActiveCharacter();
    // Newest-updated first → Beta.
    expect(resolved?.id).toBe(b.id);
    expect(getActiveCharacterId()).toBe(b.id);
    expect(a.id).not.toBe(b.id);
  });

  it('resolveActiveCharacter returns null + clears active id when the store is empty', async () => {
    setActiveCharacterId('ghost');
    const resolved = await resolveActiveCharacter();
    expect(resolved).toBeNull();
    expect(getActiveCharacterId()).toBe('');
  });
});

describe('character-manager: adopt', () => {
  it('adoptCharacter persists a pre-built character and makes it active', async () => {
    const built: Character = { ...storeCreateCharacter('Wizard'), level: 3 };
    const saved = await adoptCharacter(built);
    expect(saved.id).toBe(built.id);
    expect(getActiveCharacterId()).toBe(built.id);
    const loaded = await getCharacter(built.id);
    expect(loaded?.level).toBe(3);
  });
});

describe('character-manager: switch', () => {
  it('switchCharacter loads the target and persists it as active', async () => {
    const a = await createCharacter('A');
    const b = await createCharacter('B');
    expect(getActiveCharacterId()).toBe(b.id);
    const loaded = await switchCharacter(a.id);
    expect(loaded?.id).toBe(a.id);
    expect(getActiveCharacterId()).toBe(a.id);
  });

  it('switchCharacter returns null for a missing id and does not change the active id', async () => {
    const a = await createCharacter('A');
    const result = await switchCharacter('missing');
    expect(result).toBeNull();
    expect(getActiveCharacterId()).toBe(a.id);
  });
});

describe('character-manager: rename', () => {
  it('renameCharacter updates the name and stamps a newer updatedAt', async () => {
    const a = await createCharacter('Old Name');
    const before = (await getCharacter(a.id))!.updatedAt;
    await new Promise((r) => setTimeout(r, 2));
    const saved = await renameCharacter(a.id, 'New Name');
    expect(saved?.name).toBe('New Name');
    expect(saved!.updatedAt).toBeGreaterThanOrEqual(before);
    expect((await getCharacter(a.id))?.name).toBe('New Name');
  });

  it('renameCharacter returns null for a missing id', async () => {
    expect(await renameCharacter('nope', 'X')).toBeNull();
  });
});

describe('character-manager: duplicate', () => {
  it('duplicateCharacter deep-copies with a new id, a "(Copy)" name, and makes it active', async () => {
    const original = await adoptCharacter({
      ...storeCreateCharacter('Hero'),
      level: 5,
      class: { id: 'fighter', level: 5 },
    });
    const copy = await duplicateCharacter(original.id);
    expect(copy).not.toBeNull();
    expect(copy!.id).not.toBe(original.id);
    expect(copy!.name).toBe('Hero (Copy)');
    expect(copy!.level).toBe(5);
    expect(copy!.class?.id).toBe('fighter');
    expect(getActiveCharacterId()).toBe(copy!.id);
    // Both characters exist independently.
    const summaries = await listSummaries();
    expect(summaries).toHaveLength(2);
  });

  it('duplicateCharacter deep-copies nested state (no aliasing)', async () => {
    const original = await adoptCharacter({
      ...storeCreateCharacter('Nested'),
      inventory: [{ id: 'w1', kind: 'weapon', catalogId: 'longsword', quantity: 1 }],
    });
    const copy = await duplicateCharacter(original.id);
    // Mutate the copy's stored inventory; the original must be unaffected.
    await renameCharacter(copy!.id, 'Nested (Copy)'); // touch copy
    const loadedOriginal = await getCharacter(original.id);
    expect(loadedOriginal?.inventory).toEqual([
      { id: 'w1', kind: 'weapon', catalogId: 'longsword', quantity: 1 },
    ]);
  });

  it('duplicateCharacter copies the portrait association to the new id', async () => {
    const original = await createCharacter('Portrayed');
    await getPortraitStore().savePortrait(original.id, makeBlob(16));
    const copy = await duplicateCharacter(original.id);
    const copyPortrait = await getPortraitStore().getPortraitBlob(copy!.id);
    expect(copyPortrait.ok).toBe(true);
    expect(copyPortrait.ok && copyPortrait.value).not.toBeNull();
    // Original portrait still present too.
    const origPortrait = await getPortraitStore().getPortraitBlob(original.id);
    expect(origPortrait.ok && origPortrait.value).not.toBeNull();
  });

  it('duplicateCharacter returns null for a missing id', async () => {
    expect(await duplicateCharacter('missing')).toBeNull();
  });
});

describe('character-manager: delete', () => {
  it('deleteCharacter removes the character and its portrait', async () => {
    const a = await createCharacter('Doomed');
    await getPortraitStore().savePortrait(a.id, makeBlob());
    await deleteCharacter(a.id);
    expect(await getCharacter(a.id)).toBeNull();
    const portrait = await getPortraitStore().getPortraitBlob(a.id);
    expect(portrait.ok && portrait.value).toBeNull();
  });

  it('deleting the active character falls back to the next most-recent', async () => {
    const a = await createCharacter('Alpha');
    await new Promise((r) => setTimeout(r, 2));
    const b = await createCharacter('Beta'); // active + newest
    const result = await deleteCharacter(b.id);
    expect(result.deletedWasActive).toBe(true);
    expect(result.nextActiveId).toBe(a.id);
    expect(getActiveCharacterId()).toBe(a.id);
  });

  it('deleting a non-active character keeps the active id', async () => {
    const a = await createCharacter('Alpha');
    const b = await createCharacter('Beta'); // active
    const result = await deleteCharacter(a.id);
    expect(result.deletedWasActive).toBe(false);
    expect(getActiveCharacterId()).toBe(b.id);
  });

  it('deleting the last character clears the active id (→ welcome)', async () => {
    const a = await createCharacter('OnlyOne');
    const result = await deleteCharacter(a.id);
    expect(result.deletedWasActive).toBe(true);
    expect(result.nextActiveId).toBe('');
    expect(getActiveCharacterId()).toBe('');
    expect(await listSummaries()).toHaveLength(0);
  });
});

describe('character-manager: toSummary', () => {
  it('derives name, class name, level, and updatedAt', async () => {
    const char = await adoptCharacter({
      ...storeCreateCharacter('Rogueish'),
      level: 4,
      class: { id: 'rogue', level: 4 },
    });
    const summary = toSummary(char);
    expect(summary.name).toBe('Rogueish');
    expect(summary.className).toBe('Rogue');
    expect(summary.level).toBe(4);
    expect(summary.updatedAt).toBe(char.updatedAt);
  });

  it('leaves className empty when no class is chosen', () => {
    const summary = toSummary(storeCreateCharacter('Classless'));
    expect(summary.className).toBe('');
  });
});
