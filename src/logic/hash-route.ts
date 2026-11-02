/**
 * Pure logic for hash-based routing. Parses and formats URL hash strings for
 * page navigation. Ported from the WFRP shell, narrowed to the D&D tab set.
 */
import type { PageSection } from '../components/layout/navItems';

export const VALID_PAGES = ['character', 'combat', 'settings'] as const;

/**
 * Parse a URL hash string into a page value.
 * - Strips a leading '#', lowercases the first path segment, and validates it
 *   against VALID_PAGES.
 * - A second `/subtab` segment is ignored (reserved for forward-compat with a
 *   future page that uses sub-tabs).
 * - An empty or unknown hash falls back to the default page ('character').
 */
export function parseHash(hash: string): { page: PageSection } {
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;

  if (!stripped) {
    return { page: 'character' };
  }

  const segments = stripped.split('/');
  const rawPage = segments[0]?.toLowerCase() ?? '';

  const page: PageSection = VALID_PAGES.includes(rawPage as PageSection)
    ? (rawPage as PageSection)
    : 'character';

  return { page };
}

/**
 * Format a page into a URL hash string, e.g. 'character' -> '#character'.
 */
export function formatHash(page: PageSection): string {
  return `#${page}`;
}
