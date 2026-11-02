import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveLastSubTab, loadLastSubTab } from '../sub-tab-store';

const KEY = 'lastSubTab:character';

beforeEach(() => {
  localStorage.removeItem(KEY);
});

afterEach(() => {
  localStorage.removeItem(KEY);
  vi.restoreAllMocks();
});

describe('sub-tab-store', () => {
  it('round-trips a saved sub-tab through load', () => {
    saveLastSubTab('character', 'skills');
    expect(loadLastSubTab('character')).toBe('skills');
  });

  it('returns null for an unset key', () => {
    expect(loadLastSubTab('character')).toBeNull();
  });

  it('returns null for an empty / whitespace stored value', () => {
    localStorage.setItem(KEY, '   ');
    expect(loadLastSubTab('character')).toBeNull();
  });

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => saveLastSubTab('character', 'skills')).not.toThrow();
  });

  it('returns null when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied');
    });
    expect(loadLastSubTab('character')).toBeNull();
  });
});
