import { describe, it, expect } from 'vitest';
import { parseHash, formatHash, VALID_PAGES } from '../hash-route';

describe('hash-route', () => {
  it('round-trips every valid page (no sub-tab)', () => {
    for (const page of VALID_PAGES) {
      const hash = formatHash(page);
      expect(hash).toBe(`#${page}`);
      expect(parseHash(hash)).toEqual({ page, subTab: null });
    }
  });

  it('falls back to character (null sub-tab) for an empty hash', () => {
    expect(parseHash('')).toEqual({ page: 'character', subTab: null });
    expect(parseHash('#')).toEqual({ page: 'character', subTab: null });
  });

  it('falls back to character (null sub-tab) for an unknown hash', () => {
    expect(parseHash('#nonsense')).toEqual({ page: 'character', subTab: null });
    // 'spells' and 'inventory' are now valid pages; caster-gating is the App
    // route guard's job, not the parser's. Use a genuinely unknown page here.
    expect(parseHash('#gobbledygook')).toEqual({ page: 'character', subTab: null });
  });

  it('is case-insensitive on the page segment', () => {
    expect(parseHash('#COMBAT')).toEqual({ page: 'combat', subTab: null });
    expect(parseHash('#Settings')).toEqual({ page: 'settings', subTab: null });
  });

  it('parses a /subtab segment into subTab', () => {
    expect(parseHash('#character/skills')).toEqual({
      page: 'character',
      subTab: 'skills',
    });
  });

  it('returns a null sub-tab when the segment is absent', () => {
    expect(parseHash('#character')).toEqual({ page: 'character', subTab: null });
  });

  it('coerces a trailing-slash (empty) sub-tab segment to null', () => {
    expect(parseHash('#character/')).toEqual({ page: 'character', subTab: null });
  });

  it('formats a page with and without a sub-tab', () => {
    expect(formatHash('character')).toBe('#character');
    expect(formatHash('character', 'skills')).toBe('#character/skills');
    expect(formatHash('character', null)).toBe('#character');
  });

  it('round-trips a page + sub-tab through format then parse', () => {
    expect(parseHash(formatHash('character', 'species'))).toEqual({
      page: 'character',
      subTab: 'species',
    });
  });

  it('parses the Companions page with a sub-tab', () => {
    expect(parseHash('#companions/mounts')).toEqual({ page: 'companions', subTab: 'mounts' });
    expect(formatHash('companions', 'hirelings')).toBe('#companions/hirelings');
  });

  it('discards the sub-tab segment when the page is invalid', () => {
    expect(parseHash('#bogus/foo')).toEqual({ page: 'character', subTab: null });
  });
});
