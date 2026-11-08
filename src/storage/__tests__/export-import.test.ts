import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import {
  exportToJSON,
  exportCharacter,
  exportFileName,
  importFromJSON,
} from '../export-import';
import { base64ToBlob } from '../portrait-codec';
import { _resetPortraitDbForTests } from '../portrait-store';
import { BLANK_CHARACTER, CURRENT_VERSION } from '../../types/character';
import type { Character } from '../../types/character';

/**
 * Tests for Export/Import (Stage B2). Covers the round-trip (character +
 * portrait survive), identity reset on import (no clobber), validation
 * (garbage / wrong-shape rejected with a clear error), and migration wiring.
 */

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    ...structuredClone(BLANK_CHARACTER),
    _v: CURRENT_VERSION,
    id: 'orig-id',
    name: 'Aric the Bold',
    level: 3,
    createdAt: 111,
    updatedAt: 222,
    ...overrides,
  };
}

/** A valid base64 PNG data-URL (3 decoded bytes). */
const PORTRAIT = 'data:image/png;base64,AAAA';

beforeEach(async () => {
  _resetPortraitDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('dnd-portraits');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('exportToJSON', () => {
  it('serialises a character without a portrait field', () => {
    const json = exportToJSON(makeChar());
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe('Aric the Bold');
    expect('portrait' in parsed).toBe(false);
  });
});

describe('exportFileName', () => {
  it('sanitises the character name and appends a timestamp', () => {
    const name = exportFileName(makeChar({ name: 'Günther "The Brave"' }));
    expect(name).toMatch(/^G_nther__The_Brave__\d{8}-\d{4}\.json$/);
  });

  it('falls back to "character" for an empty name', () => {
    expect(exportFileName(makeChar({ name: '' }))).toMatch(/^character_\d{8}-\d{4}\.json$/);
  });
});

describe('import validation (Property: invalid import is rejected clearly)', () => {
  it('rejects malformed JSON', () => {
    const result = importFromJSON('{ not valid json !!!');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid JSON');
    expect(result.character).toBeUndefined();
  });

  it('rejects an empty string', () => {
    const result = importFromJSON('');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects a JSON array', () => {
    const result = importFromJSON('[1, 2, 3]');
    expect(result.success).toBe(false);
    expect(result.error).toContain('expected a JSON object');
  });

  it('rejects a JSON primitive', () => {
    expect(importFromJSON('42').success).toBe(false);
    expect(importFromJSON('"hello"').success).toBe(false);
    expect(importFromJSON('null').success).toBe(false);
  });

  it('rejects JSON missing required name field', () => {
    const result = importFromJSON(JSON.stringify({ _v: 1, level: 1, abilities: {} }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('name');
  });

  it('rejects JSON missing required level field', () => {
    const result = importFromJSON(JSON.stringify({ _v: 1, name: 'X', abilities: {} }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('level');
  });

  it('rejects JSON missing required abilities field', () => {
    const result = importFromJSON(JSON.stringify({ _v: 1, name: 'X', level: 1 }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('abilities');
  });

  it('rejects an abilities field that is not an object', () => {
    const result = importFromJSON(JSON.stringify({ name: 'X', level: 1, abilities: [1, 2] }));
    expect(result.success).toBe(false);
    expect(result.error).toContain('abilities');
  });

  it('rejects a version newer than current', () => {
    const result = importFromJSON(
      JSON.stringify({ _v: CURRENT_VERSION + 1, name: 'Future', level: 1, abilities: {} }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported version');
    expect(result.error).toContain(String(CURRENT_VERSION + 1));
  });

  it('accepts a version equal to current', () => {
    const result = importFromJSON(JSON.stringify(makeChar()));
    expect(result.success).toBe(true);
  });
});

describe('import identity reset (no clobber)', () => {
  it('strips id/createdAt/updatedAt so adopt mints a fresh identity', () => {
    const result = importFromJSON(JSON.stringify(makeChar({ id: 'should-be-dropped' })));
    expect(result.success).toBe(true);
    expect(result.character!.id).toBe('');
    expect(result.character!.createdAt).toBe(0);
    expect(result.character!.updatedAt).toBe(0);
  });
});

describe('import migration wiring', () => {
  it('stamps a legacy (no _v) import up to CURRENT_VERSION', () => {
    const legacy = makeChar();
    delete (legacy as Partial<Character>)._v;
    const result = importFromJSON(JSON.stringify(legacy));
    expect(result.success).toBe(true);
    expect(result.character!._v).toBe(CURRENT_VERSION);
  });

  it('fills missing optional fields from BLANK_CHARACTER', () => {
    const partial = { _v: CURRENT_VERSION, name: 'Partial', level: 2, abilities: { str: 14 } };
    const result = importFromJSON(JSON.stringify(partial));
    expect(result.success).toBe(true);
    // deep-merged default abilities present alongside the override
    expect(result.character!.abilities.str).toBe(14);
    expect(result.character!.abilities.dex).toBe(10);
    expect(result.character!.skills).toEqual({});
  });
});

describe('import portrait separation', () => {
  it('extracts a valid embedded portrait into portraitDataUrl and off the character', () => {
    const withPortrait = { ...makeChar(), portrait: PORTRAIT };
    const result = importFromJSON(JSON.stringify(withPortrait));
    expect(result.success).toBe(true);
    expect(result.portraitDataUrl).toBe(PORTRAIT);
    expect('portrait' in (result.character as object)).toBe(false);
  });

  it('discards an invalid embedded portrait (no portraitDataUrl) but still imports', () => {
    const withBadPortrait = { ...makeChar(), portrait: 'not-an-image' };
    const result = importFromJSON(JSON.stringify(withBadPortrait));
    expect(result.success).toBe(true);
    expect(result.portraitDataUrl).toBeUndefined();
    expect('portrait' in (result.character as object)).toBe(false);
  });
});

describe('export/import round-trip (character + portrait)', () => {
  it('round-trips a character through export → import (identity reset aside)', async () => {
    const original = makeChar({
      name: 'Brunhilde',
      level: 5,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 13, cha: 8 },
      skills: { athletics: { proficient: true } },
    });
    const json = await exportCharacter(original, original.id);
    const result = importFromJSON(json);
    expect(result.success).toBe(true);
    const imported = result.character!;
    // Everything but identity survives.
    expect(imported.name).toBe('Brunhilde');
    expect(imported.level).toBe(5);
    expect(imported.abilities).toEqual(original.abilities);
    expect(imported.skills).toEqual(original.skills);
    expect(imported.id).toBe('');
  });

  it('round-trips the portrait: an embedded data-URL survives export JSON → import', async () => {
    // NOTE: fake-indexeddb cannot faithfully structured-clone a jsdom Blob (it
    // loses .size, see portrait-store.test), so we cannot exercise the real
    // getPortraitBlob → blobToBase64 encoding here. Instead we embed a portrait
    // data-URL directly in the export envelope (exactly what exportCharacter
    // writes when the store returns a Blob) and assert import extracts it back.
    // The Blob↔base64 encoding itself is covered by portrait-codec.test.
    const envelope = { ...makeChar({ id: 'orig-id' }), portrait: PORTRAIT };
    const json = JSON.stringify(envelope, null, 2);

    const result = importFromJSON(json);
    expect(result.success).toBe(true);
    expect(result.portraitDataUrl).toBe(PORTRAIT);
    // And the extracted data-URL decodes back to a Blob of the original type.
    const blob = base64ToBlob(result.portraitDataUrl!);
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('image/png');
  });

  it('exports with no portrait field when the character has no stored portrait', async () => {
    const json = await exportCharacter(makeChar({ id: 'no-portrait' }), 'no-portrait');
    const parsed = JSON.parse(json);
    expect('portrait' in parsed).toBe(false);
  });
});

describe('classChoices round trip (additive-optional, no version bump)', () => {
  it('survives export then import, sanitised, with no CURRENT_VERSION change', () => {
    const c = makeChar({ classChoices: { 'warlock.invocations': ['pact-of-the-blade', 'agonizing-blast#fire-bolt'] } });
    const result = importFromJSON(exportToJSON(c));
    expect(result.success).toBe(true);
    expect(result.character?.classChoices).toEqual({ 'warlock.invocations': ['pact-of-the-blade', 'agonizing-blast#fire-bolt'] });
    expect(result.character?._v).toBe(CURRENT_VERSION);
  });

  it('strips hostile classChoices on import and drops the field when empty', () => {
    const hostile = { ...makeChar(), classChoices: { 'nope': ['x'], 'sorcerer.metamagic': [1, 'careful-spell'] } };
    const result = importFromJSON(JSON.stringify(hostile));
    expect(result.success).toBe(true);
    expect(result.character?.classChoices).toEqual({ 'sorcerer.metamagic': ['careful-spell'] });
    const empty = importFromJSON(JSON.stringify({ ...makeChar(), classChoices: { nope: [] } }));
    expect(empty.success).toBe(true);
    expect(empty.character && 'classChoices' in empty.character).toBe(false);
  });
});
