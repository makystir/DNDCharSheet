import { describe, it, expect } from 'vitest';
import { parseViewRoute, formatViewHref, VIEW_ROUTE_PREFIX } from '../view-route';

/** `#view/<payload>` parse/format round-trip + non-view rejection (Stage B5). */
describe('view-route', () => {
  it('parses the payload from a #view/ hash', () => {
    expect(parseViewRoute('#view/ABC123')).toBe('ABC123');
    expect(parseViewRoute('view/ABC123')).toBe('ABC123'); // tolerant of a missing leading #
  });

  it('returns null for a non-view hash', () => {
    expect(parseViewRoute('#character')).toBeNull();
    expect(parseViewRoute('#combat/attack')).toBeNull();
    expect(parseViewRoute('')).toBeNull();
    expect(parseViewRoute('#')).toBeNull();
  });

  it('returns an empty string for the bare #view/ route', () => {
    expect(parseViewRoute('#view/')).toBe('');
  });

  it('format -> parse round-trips the encoded payload', () => {
    const encoded = 'eJzT0yMAAGTvBe8';
    const href = formatViewHref('https://example.io', '/DNDCharSheet/', encoded);
    expect(href).toBe(`https://example.io/DNDCharSheet/#${VIEW_ROUTE_PREFIX}/${encoded}`);
    const hash = href.slice(href.indexOf('#'));
    expect(parseViewRoute(hash)).toBe(encoded);
  });
});
