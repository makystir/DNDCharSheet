import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
  validateStoredValue,
  loadTabOrder,
  saveTabOrder,
  removeTabOrder,
  reconcileTabOrder,
} from '../tab-order-store';

const KEY = 'tabOrder:character';

beforeEach(() => {
  localStorage.removeItem(KEY);
});

afterEach(() => {
  localStorage.removeItem(KEY);
});

describe('tab-order-store — validateStoredValue', () => {
  it('accepts a well-formed JSON string array', () => {
    expect(validateStoredValue(JSON.stringify(['a', 'b']))).toEqual(['a', 'b']);
  });

  it('rejects malformed JSON', () => {
    expect(validateStoredValue('{not json')).toBeNull();
  });

  it('rejects a non-array JSON value', () => {
    expect(validateStoredValue(JSON.stringify({ a: 1 }))).toBeNull();
  });

  it('rejects an array with an empty-string element', () => {
    expect(validateStoredValue(JSON.stringify(['a', '']))).toBeNull();
  });

  it('rejects an array with a non-string element', () => {
    expect(validateStoredValue(JSON.stringify(['a', 3]))).toBeNull();
  });

  it('rejects a non-string raw value', () => {
    expect(validateStoredValue(42)).toBeNull();
  });
});

describe('tab-order-store — load/save/remove', () => {
  it('round-trips a saved order', () => {
    expect(saveTabOrder('character', ['b', 'a'])).toBe(true);
    expect(loadTabOrder('character')).toEqual(['b', 'a']);
  });

  it('returns null for an unset key', () => {
    expect(loadTabOrder('character')).toBeNull();
  });

  it('returns null for a stored invalid value', () => {
    localStorage.setItem(KEY, 'not json');
    expect(loadTabOrder('character')).toBeNull();
  });

  it('removes a stored order', () => {
    saveTabOrder('character', ['a']);
    removeTabOrder('character');
    expect(loadTabOrder('character')).toBeNull();
  });
});

describe('tab-order-store — reconcileTabOrder', () => {
  // P3: the Character page's three-tab default set.
  const defaults = ['identity', 'abilities', 'build'];

  it('is identity when the stored order equals defaults', () => {
    expect(reconcileTabOrder(defaults, defaults)).toEqual(defaults);
  });

  it('preserves a valid custom order', () => {
    expect(reconcileTabOrder(['build', 'identity', 'abilities'], defaults)).toEqual([
      'build',
      'identity',
      'abilities',
    ]);
  });

  it('drops an unknown stored ID', () => {
    expect(reconcileTabOrder(['identity', 'ghost', 'abilities', 'build'], defaults)).toEqual([
      'identity',
      'abilities',
      'build',
    ]);
  });

  it('appends a newly-added default in default relative order', () => {
    expect(reconcileTabOrder(['abilities', 'identity'], defaults)).toEqual([
      'abilities',
      'identity',
      'build',
    ]);
  });

  it('dedupes a doubled ID, keeping the first occurrence', () => {
    expect(reconcileTabOrder(['identity', 'identity', 'abilities', 'build'], defaults)).toEqual([
      'identity',
      'abilities',
      'build',
    ]);
  });

  it('P3 migration: a stored order of the OLD four ids reconciles to the new default order', () => {
    // A tabOrder:character saved before P3 holds {overview,skills,species,class}.
    // All four are unknown to the new defaults, so they are dropped and the new
    // defaults are appended — yielding the new default order, not an empty bar.
    expect(
      reconcileTabOrder(['overview', 'skills', 'species', 'class'], defaults),
    ).toEqual(['identity', 'abilities', 'build']);
  });

  it('P3 migration: a mix of old and new ids keeps the new ids in their stored order', () => {
    expect(
      reconcileTabOrder(['skills', 'build', 'overview', 'identity'], defaults),
    ).toEqual(['build', 'identity', 'abilities']);
  });

  it('property: result is always a permutation whose set equals defaults', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(
            'identity',
            'abilities',
            'build',
            'overview',
            'skills',
            'species',
            'class',
            'ghost',
          ),
        ),
        (stored) => {
          const result = reconcileTabOrder(stored, defaults);
          // Exactly every default, each once, nothing extra.
          expect(new Set(result)).toEqual(new Set(defaults));
          expect(result.length).toBe(defaults.length);
        },
      ),
    );
  });
});
