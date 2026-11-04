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

  // Stage 7: Personal Details additive-optional fields.
  it('round-trips every Stage-7 personal-details field', async () => {
    const base = createCharacter('Identity');
    const withDetails = {
      ...base,
      alignment: 'Chaotic Good' as const,
      faith: 'Sigmar',
      sex: 'Female',
      age: '27',
      height: "5'8\"",
      weight: '140 lb',
      eyes: 'Green',
      hair: 'Auburn',
      skin: 'Fair',
      background: 'Soldier',
      personality: 'Brave and reckless.',
    };
    const saved = await saveCharacter(withDetails);
    const loaded = await getCharacter(saved.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.alignment).toBe('Chaotic Good');
    expect(loaded?.faith).toBe('Sigmar');
    expect(loaded?.sex).toBe('Female');
    expect(loaded?.age).toBe('27');
    expect(loaded?.height).toBe("5'8\"");
    expect(loaded?.weight).toBe('140 lb');
    expect(loaded?.eyes).toBe('Green');
    expect(loaded?.hair).toBe('Auburn');
    expect(loaded?.skin).toBe('Fair');
    expect(loaded?.background).toBe('Soldier');
    expect(loaded?.personality).toBe('Brave and reckless.');
  });

  it('loads a pre-Stage-7 record without personal-details fields unchanged', async () => {
    const legacy = createCharacter('Legacy7');
    const saved = await saveCharacter(legacy);
    const loaded = await getCharacter(saved.id);
    expect(loaded).not.toBeNull();
    for (const field of [
      'alignment',
      'faith',
      'sex',
      'age',
      'height',
      'weight',
      'eyes',
      'hair',
      'skin',
      'background',
      'personality',
    ] as const) {
      expect(loaded?.[field]).toBeUndefined();
    }
  });

  it('createCharacter leaves Stage-7 fields unset and does not alias them', () => {
    const a = createCharacter('A');
    const b = createCharacter('B');
    expect(a.alignment).toBeUndefined();
    expect(a.personality).toBeUndefined();
    // Primitive strings: setting one must never affect the other.
    a.personality = 'only A';
    expect(b.personality).toBeUndefined();
  });

  // Stage 8: Spellcasting state additive-optional field.
  it('round-trips a full spellcasting state', async () => {
    const base = createCharacter('Mystra');
    const withSpells = {
      ...base,
      level: 5,
      class: { id: 'wizard' as const, level: 5 },
      spellcasting: {
        cantrips: ['fire-bolt' as const, 'mage-hand' as const, 'light' as const],
        prepared: ['magic-missile' as const, 'shield' as const, 'fireball' as const],
        spellbook: ['magic-missile' as const, 'shield' as const, 'fireball' as const, 'misty-step' as const],
        slotsExpended: { 1: 2, 3: 1 },
      },
    };
    const saved = await saveCharacter(withSpells);
    const loaded = await getCharacter(saved.id);
    expect(loaded?.spellcasting).toEqual(withSpells.spellcasting);
  });

  it('round-trips Warlock pact-slot tracking', async () => {
    const base = createCharacter('Pactbound');
    const withPact = {
      ...base,
      level: 5,
      class: { id: 'warlock' as const, level: 5 },
      spellcasting: { pactSlotsExpended: 1 },
    };
    const saved = await saveCharacter(withPact);
    const loaded = await getCharacter(saved.id);
    expect(loaded?.spellcasting?.pactSlotsExpended).toBe(1);
  });

  it('round-trips Warlock Mystic Arcanum choices and expended flags', async () => {
    // Mystic Arcanum state is tracked separately from Pact slots and the
    // prepared cap (PHB 2024 "Warlock: Mystic Arcanum"); confirm it persists.
    const base = createCharacter('Arcanist');
    const withArcana = {
      ...base,
      level: 17,
      class: { id: 'warlock' as const, level: 17 },
      spellcasting: {
        mysticArcana: {
          6: 'eyebite' as const,
          7: 'forcecage' as const,
          8: 'power-word-stun' as const,
          9: 'power-word-kill' as const,
        },
        mysticArcanaExpended: { 6: true },
      },
    };
    const saved = await saveCharacter(withArcana);
    const loaded = await getCharacter(saved.id);
    expect(loaded?.spellcasting?.mysticArcana).toEqual(withArcana.spellcasting.mysticArcana);
    expect(loaded?.spellcasting?.mysticArcanaExpended).toEqual({ 6: true });
  });

  it('loads a pre-Stage-8 record without a spellcasting field unchanged', async () => {
    const legacy = createCharacter('Legacy8');
    delete (legacy as { spellcasting?: unknown }).spellcasting;
    const saved = await saveCharacter(legacy);
    const loaded = await getCharacter(saved.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.spellcasting).toBeUndefined();
  });

  it('createCharacter leaves spellcasting unset', () => {
    expect(createCharacter('Fresh').spellcasting).toBeUndefined();
  });

  // Stage A1: inventory + equipped additive-optional fields.
  it('round-trips an inventory and equipped state', async () => {
    const base = createCharacter('Packrat');
    const withGear = {
      ...base,
      inventory: [
        { id: 'w1', kind: 'weapon' as const, catalogId: 'longsword', quantity: 1 },
        { id: 'a1', kind: 'armor' as const, catalogId: 'chain-shirt', quantity: 1 },
        { id: 'e1', kind: 'equipment' as const, catalogId: 'rope', quantity: 2 },
        {
          id: 'c1',
          kind: 'equipment' as const,
          catalogId: 'antitoxin',
          quantity: 1,
          currentDoses: 1,
          maxDoses: 1,
          notes: 'from the healer',
        },
      ],
      equipped: { armorItemId: 'a1', shieldItemId: undefined, weaponItemIds: ['w1'] },
    };
    const saved = await saveCharacter(withGear);
    const loaded = await getCharacter(saved.id);
    expect(loaded?.inventory).toEqual(withGear.inventory);
    expect(loaded?.equipped).toEqual(withGear.equipped);
  });

  it('loads a pre-A1 record without inventory/equipped fields unchanged', async () => {
    const legacy = createCharacter('LegacyA1');
    delete (legacy as { inventory?: unknown }).inventory;
    delete (legacy as { equipped?: unknown }).equipped;
    const saved = await saveCharacter(legacy);
    const loaded = await getCharacter(saved.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.inventory).toBeUndefined();
    expect(loaded?.equipped).toBeUndefined();
  });

  it('createCharacter leaves inventory and equipped unset', () => {
    const c = createCharacter('Fresh');
    expect(c.inventory).toBeUndefined();
    expect(c.equipped).toBeUndefined();
  });
});
