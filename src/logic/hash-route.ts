/**
 * Pure logic for hash-based routing. Parses and formats URL hash strings for
 * page navigation. Ported from the WFRP shell, narrowed to the D&D tab set.
 */

export const VALID_PAGES = [
  'character',
  'combat',
  'inventory',
  'spells',
  'advancement',
  'settings',
] as const;

/**
 * The set of valid top-level pages. Identical union to `PageSection` (the nav
 * source of truth); the parser returns `ValidPage` and callers cast to
 * `PageSection` where a component prop requires it.
 */
export type ValidPage = (typeof VALID_PAGES)[number];

/**
 * Per-page default sub-tab, for callers that want to normalise a bare page hash
 * to its default sub-tab. Only the Character page has sub-tabs this stage; the
 * page itself owns the actual resolution, so this map is advisory.
 */
export const PAGE_DEFAULT_SUBTABS: Partial<Record<ValidPage, string>> = {
  character: 'overview',
  spells: 'summary',
};

/**
 * Parse a URL hash string into a page and optional sub-tab value.
 * - Strips a leading '#', lowercases the first path segment, and validates it
 *   against VALID_PAGES.
 * - The second `/subtab` segment is returned verbatim (or `null` when absent);
 *   sub-tab validity is the owning page's concern, not the parser's.
 * - An empty or unknown hash falls back to the default page ('character') with
 *   a `null` sub-tab (an invalid page discards any sub-tab segment).
 */
export function parseHash(hash: string): { page: ValidPage; subTab: string | null } {
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;

  if (!stripped) {
    return { page: 'character', subTab: null };
  }

  const segments = stripped.split('/');
  const rawPage = segments[0]?.toLowerCase() ?? '';
  const rawSubTab = segments[1] ?? null;

  // Invalid page → fall back to character and discard any sub-tab.
  if (!VALID_PAGES.includes(rawPage as ValidPage)) {
    return { page: 'character', subTab: null };
  }

  // An empty-string segment (e.g. trailing slash) coerces to null.
  return { page: rawPage as ValidPage, subTab: rawSubTab || null };
}

/**
 * Format a page and optional sub-tab into a URL hash string.
 * - Returns `#<page>` when no sub-tab is given.
 * - Returns `#<page>/<subtab>` when a sub-tab is given.
 */
export function formatHash(page: string, subTab?: string | null): string {
  if (subTab) {
    return `#${page}/${subTab}`;
  }
  return `#${page}`;
}
