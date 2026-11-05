import { describe, it, expect } from 'vitest';
import { fuzzyMatch } from '../fuzzyMatch';

describe('fuzzyMatch', () => {
  it('returns null for an empty or whitespace query', () => {
    expect(fuzzyMatch('', 'character')).toBeNull();
    expect(fuzzyMatch('   ', 'character')).toBeNull();
  });

  it('returns null when the query is not a subsequence of the text', () => {
    expect(fuzzyMatch('xyz', 'character')).toBeNull();
  });

  it('matches a subsequence and returns ranges + a positive score', () => {
    const result = fuzzyMatch('char', 'character');
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
    // 'char' matches the prefix contiguously → one range [0,3].
    expect(result!.ranges).toEqual([[0, 3]]);
  });

  it('ranks a prefix/exact-start match above a scattered match', () => {
    const prefix = fuzzyMatch('spel', 'spells')!;
    const scattered = fuzzyMatch('spel', 'go to spells')!;
    expect(prefix).not.toBeNull();
    expect(scattered).not.toBeNull();
    expect(prefix.score).toBeGreaterThan(scattered.score);
  });

  it('ranks a word-boundary match above a mid-word match', () => {
    // 'go' at a word boundary ("go to …") should beat a buried 'go'.
    const boundary = fuzzyMatch('go', 'go to combat')!;
    const buried = fuzzyMatch('go', 'dragon')!;
    expect(boundary.score).toBeGreaterThan(buried.score);
  });

  it('supports multi-token queries where every token must match', () => {
    expect(fuzzyMatch('go spel', 'go to spells')).not.toBeNull();
    // A token that does not appear fails the whole match.
    expect(fuzzyMatch('go zzz', 'go to spells')).toBeNull();
  });

  it('truncates queries longer than 200 characters without throwing', () => {
    const long = 'a'.repeat(250);
    // No match against a short text, but must not throw.
    expect(() => fuzzyMatch(long, 'character')).not.toThrow();
  });
});
