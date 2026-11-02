import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCharacter,
  saveCharacter,
  getCharacter,
  listCharacters,
  deleteCharacter,
  _resetDbForTests,
} from '../character-store';
import { indexedDB } from 'fake-indexeddb';

beforeEach(async () => {
  // Fresh DB per test: delete and reset the cached connection.
  _resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('dnd-char-sheet');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe('character-store', () => {
  it('creates a character with a unique id and default abilities', () => {
    const a = createCharacter('Aric');
    const b = createCharacter();
    expect(a.id).not.toBe(b.id);
    expect(a.name).toBe('Aric');
    expect(a.level).toBe(1);
    expect(a.abilities.str).toBe(10);
  });

  it('saves and reloads a character', async () => {
    const char = await saveCharacter(createCharacter('Bess'));
    const loaded = await getCharacter(char.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Bess');
  });

  it('lists characters most-recently-updated first', async () => {
    const first = await saveCharacter(createCharacter('First'));
    await new Promise((r) => setTimeout(r, 2));
    const second = await saveCharacter(createCharacter('Second'));
    const list = await listCharacters();
    expect(list[0].id).toBe(second.id);
    expect(list[1].id).toBe(first.id);
  });

  it('deletes a character', async () => {
    const char = await saveCharacter(createCharacter('Gone'));
    await deleteCharacter(char.id);
    expect(await getCharacter(char.id)).toBeNull();
  });

  // Test 14: species selection round-trips through storage unchanged.
  it('round-trips a full species selection', async () => {
    const base = createCharacter('Elowen');
    const withSpecies = {
      ...base,
      species: {
        id: 'elf' as const,
        elvenLineage: 'drow' as const,
        spellcastingAbility: 'int' as const,
        keenSensesSkill: 'perception' as const,
      },
    };
    const saved = await saveCharacter(withSpecies);
    const loaded = await getCharacter(saved.id);
    expect(loaded?.species).toEqual(withSpecies.species);
  });

  // Test 15: backward-compat — a pre-Stage-3 record (no species) loads unchanged.
  it('loads a pre-Stage-3 record without a species field unchanged', async () => {
    const legacy = createCharacter('Legacy');
    delete (legacy as { species?: unknown }).species;
    const saved = await saveCharacter(legacy);
    const loaded = await getCharacter(saved.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.species).toBeUndefined();
  });

  it('createCharacter yields a valid species-less character', () => {
    const c = createCharacter('Fresh');
    expect(c.species).toBeUndefined();
  });

  // Test 18: a full class selection round-trips through storage unchanged.
  it('round-trips a full class selection', async () => {
    const base = createCharacter('Gandry');
    const withClass = {
      ...base,
      level: 3,
      class: {
        id: 'wizard' as const,
        subclassId: 'evoker' as const,
        level: 3,
        skillChoices: ['arcana' as const, 'history' as const],
      },
      hitDiceSpent: 1,
      rolledHpTotal: 17,
      houseRules: { rolledHp: true },
    };
    const saved = await saveCharacter(withClass);
    const loaded = await getCharacter(saved.id);
    expect(loaded?.class).toEqual(withClass.class);
    expect(loaded?.hitDiceSpent).toBe(1);
    expect(loaded?.rolledHpTotal).toBe(17);
    expect(loaded?.houseRules).toEqual({ rolledHp: true });
  });

  // Test 19: backward-compat — a pre-Stage-4 record (no class) loads unchanged.
  it('loads a pre-Stage-4 record without class fields unchanged', async () => {
    const legacy = createCharacter('OldTimer');
    delete (legacy as { class?: unknown }).class;
    delete (legacy as { hitDiceSpent?: unknown }).hitDiceSpent;
    delete (legacy as { rolledHpTotal?: unknown }).rolledHpTotal;
    delete (legacy as { houseRules?: unknown }).houseRules;
    const saved = await saveCharacter(legacy);
    const loaded = await getCharacter(saved.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.class).toBeUndefined();
    expect(loaded?.hitDiceSpent).toBeUndefined();
    expect(loaded?.houseRules).toBeUndefined();
  });

  it('createCharacter yields a valid class-less character', () => {
    const c = createCharacter('Fresh');
    expect(c.class).toBeUndefined();
    expect(c.houseRules).toBeUndefined();
  });
});
