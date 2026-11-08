import { describe, it, expect } from 'vitest';
import { validateSharedPayload } from '../share-validate';
import { decodeSharePayload, encodeSharePayload } from '../share-codec';
import { BLANK_CHARACTER, CURRENT_VERSION } from '../../types/character';
import type { Character } from '../../types/character';

/**
 * share-validate treats the decoded payload as UNTRUSTED (Stage B5): it rejects
 * wrong-shape/garbage via the B2 import path and defensively normalises the
 * display-critical fields so a hostile payload can never crash the viewer.
 */
function validChar(overrides: Partial<Character> = {}): Character {
  return {
    ...structuredClone(BLANK_CHARACTER),
    _v: CURRENT_VERSION,
    id: 'x',
    name: 'Aric the Bold',
    level: 5,
    ...overrides,
  };
}

describe('share-validate', () => {
  it('accepts a valid serialized character', () => {
    const result = validateSharedPayload(JSON.stringify(validChar()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.character.name).toBe('Aric the Bold');
      expect(result.character.level).toBe(5);
    }
  });

  it('rejects unparseable garbage with a typed failure', () => {
    const result = validateSharedPayload('this is not json');
    expect(result.ok).toBe(false);
  });

  it('rejects a JSON array (not a character object)', () => {
    const result = validateSharedPayload('[1,2,3]');
    expect(result.ok).toBe(false);
  });

  it('rejects an object missing required identity-core fields', () => {
    const result = validateSharedPayload(JSON.stringify({ hello: 'world' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a newer-than-current schema version', () => {
    const future = { ...validChar(), _v: CURRENT_VERSION + 50 };
    const result = validateSharedPayload(JSON.stringify(future));
    expect(result.ok).toBe(false);
  });

  it('coerces a wrong-typed array field (inventory) to an empty array', () => {
    const bad = { ...validChar(), inventory: 'not-an-array' as unknown };
    const result = validateSharedPayload(JSON.stringify(bad));
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.isArray(result.character.inventory)).toBe(true);
  });

  it('normalises non-finite ability scores to the blank default', () => {
    const bad = {
      ...validChar(),
      abilities: { str: 'abc', dex: null, con: 14, int: 10, wis: 10, cha: 10 } as unknown,
    };
    const result = validateSharedPayload(JSON.stringify(bad));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.character.abilities.str).toBe(BLANK_CHARACTER.abilities.str);
      expect(result.character.abilities.dex).toBe(BLANK_CHARACTER.abilities.dex);
      expect(result.character.abilities.con).toBe(14);
    }
  });

  it('clamps an out-of-range / non-finite level into 1..20', () => {
    const high = validateSharedPayload(JSON.stringify({ ...validChar(), level: 999 }));
    expect(high.ok).toBe(true);
    if (high.ok) expect(high.character.level).toBe(20);

    const low = validateSharedPayload(JSON.stringify({ ...validChar(), level: -5 }));
    expect(low.ok).toBe(true);
    if (low.ok) expect(low.character.level).toBe(1);

    const nan = validateSharedPayload(JSON.stringify({ ...validChar(), level: 'NaN' as unknown }));
    expect(nan.ok).toBe(true);
    if (nan.ok) expect(nan.character.level).toBe(1);
  });
});

describe('share-validate classChoices (additive-optional field)', () => {
  it('keeps valid choices and strips junk keys, wrong shapes and bad entries', () => {
    const payload = {
      ...validChar(),
      classChoices: {
        'sorcerer.metamagic': ['careful-spell', 7, ''],
        'bogus.key': ['x'],
        'warlock.invocations': 'nope',
      },
    };
    const result = validateSharedPayload(JSON.stringify(payload));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.character.classChoices).toEqual({ 'sorcerer.metamagic': ['careful-spell'] });
  });

  it('removes the field when nothing survives, and leaves absent absent', () => {
    const junk = validateSharedPayload(JSON.stringify({ ...validChar(), classChoices: 'hostile' }));
    expect(junk.ok).toBe(true);
    if (junk.ok) expect('classChoices' in junk.character).toBe(false);
    const absent = validateSharedPayload(JSON.stringify(validChar()));
    expect(absent.ok).toBe(true);
    if (absent.ok) expect('classChoices' in absent.character).toBe(false);
  });
});

describe('share-validate resourcesSpent (additive-optional field)', () => {
  it('keeps valid counts and strips hostile entries', () => {
    const payload = { ...validChar(), resourcesSpent: { 'barbarian.rage': 2, bad: -3, worse: 'x', big: 99999 } };
    const result = validateSharedPayload(JSON.stringify(payload));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.character.resourcesSpent).toEqual({ 'barbarian.rage': 2 });
  });

  it('removes the field when nothing survives, and leaves absent absent', () => {
    const junk = validateSharedPayload(JSON.stringify({ ...validChar(), resourcesSpent: ['hostile'] }));
    expect(junk.ok).toBe(true);
    if (junk.ok) expect('resourcesSpent' in junk.character).toBe(false);
    const absent = validateSharedPayload(JSON.stringify(validChar()));
    expect(absent.ok).toBe(true);
    if (absent.ok) expect('resourcesSpent' in absent.character).toBe(false);
  });

  it('round-trips through the share codec unchanged', async () => {
    const json = JSON.stringify({ ...validChar(), resourcesSpent: { 'fighter.second-wind': 1 } });
    const decoded = await decodeSharePayload(await encodeSharePayload(json));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const result = validateSharedPayload(decoded.json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.character.resourcesSpent).toEqual({ 'fighter.second-wind': 1 });
  });
});