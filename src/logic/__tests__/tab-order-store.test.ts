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
  const defaults = ['overview', 'skills', 'species', 'class'];

  it('is identity when the stored order equals defaults', () => {
    expect(reconcileTabOrder(defaults, defaults)).toEqual(defaults);
  });

  it('preserves a valid custom order', () => {
    expect(reconcileTabOrder(['class', 'overview', 'species', 'skills'], defaults)).toEqual([
      'class',
      'overview',
      'species',
      'skills',
    ]);
  });

  it('drops an unknown stored ID', () => {
    expect(reconcileTabOrder(['overview', 'ghost', 'skills', 'species', 'class'], defaults)).toEqual([
      'overview',
      'skills',
      'species',
      'class',
    ]);
  });

  it('appends a newly-added default in default relative order', () => {
    expect(reconcileTabOrder(['skills', 'overview', 'species'], defaults)).toEqual([
      'skills',
      'overview',
      'species',
      'class',
    ]);
  });

  it('dedupes a doubled ID, keeping the first occurrence', () => {
    expect(reconcileTabOrder(['overview', 'overview', 'skills', 'species', 'class'], defaults)).toEqual([
      'overview',
      'skills',
      'species',
      'class',
    ]);
  });

  it('property: result is always a permutation whose set equals defaults', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('overview', 'skills', 'species', 'class', 'ghost', 'extra')),
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
