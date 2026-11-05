import { describe, it, expect } from 'vitest';
import {
  trimForLink,
  classifyLinkLength,
  SHARE_SOFT_LIMIT,
  SHARE_HARD_LIMIT,
} from '../share-portrait';

/** Portrait trimming + link-length classification (Stage B5). */
describe('share-portrait', () => {
  it('drops a large embedded portrait so the trimmed payload is far smaller', () => {
    const bigPortrait = 'data:image/png;base64,' + 'A'.repeat(50_000);
    const envelope = JSON.stringify({ name: 'Aric', level: 3, portrait: bigPortrait });
    const trimmed = trimForLink(envelope);
    expect(trimmed.length).toBeLessThan(envelope.length);
    const parsed = JSON.parse(trimmed);
    expect('portrait' in parsed).toBe(false);
    // Non-portrait fields survive.
    expect(parsed.name).toBe('Aric');
    expect(parsed.level).toBe(3);
  });

  it('leaves a portrait-less envelope unchanged', () => {
    const envelope = JSON.stringify({ name: 'Bree', level: 1 });
    expect(trimForLink(envelope)).toBe(envelope);
  });

  it('returns a non-object / unparseable payload unchanged', () => {
    expect(trimForLink('not json')).toBe('not json');
    expect(trimForLink('[1,2,3]')).toBe('[1,2,3]');
  });

  it('classifies link length against the soft/hard thresholds (>= boundaries)', () => {
    expect(classifyLinkLength(0)).toBe('none');
    expect(classifyLinkLength(SHARE_SOFT_LIMIT - 1)).toBe('none');
    expect(classifyLinkLength(SHARE_SOFT_LIMIT)).toBe('soft');
    expect(classifyLinkLength(SHARE_HARD_LIMIT - 1)).toBe('soft');
    expect(classifyLinkLength(SHARE_HARD_LIMIT)).toBe('hard');
    expect(classifyLinkLength(SHARE_HARD_LIMIT + 5000)).toBe('hard');
  });
});
