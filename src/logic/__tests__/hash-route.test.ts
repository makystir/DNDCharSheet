import { describe, it, expect } from 'vitest';
import { parseHash, formatHash, VALID_PAGES } from '../hash-route';

describe('hash-route', () => {
  it('round-trips every valid page', () => {
    for (const page of VALID_PAGES) {
      const hash = formatHash(page);
      expect(hash).toBe(`#${page}`);
      expect(parseHash(hash).page).toBe(page);
    }
  });

  it('falls back to character for an empty hash', () => {
    expect(parseHash('').page).toBe('character');
    expect(parseHash('#').page).toBe('character');
  });

  it('falls back to character for an unknown hash', () => {
    expect(parseHash('#nonsense').page).toBe('character');
    expect(parseHash('#spells').page).toBe('character');
  });

  it('is case-insensitive on the page segment', () => {
    expect(parseHash('#COMBAT').page).toBe('combat');
    expect(parseHash('#Settings').page).toBe('settings');
  });

  it('ignores a second /subtab segment (forward-compat)', () => {
    expect(parseHash('#combat/attacks').page).toBe('combat');
  });
});
