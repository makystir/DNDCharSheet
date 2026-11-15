/**
 * Dungeon Master mode: the on/off setting and the DM hash routes.
 *
 * DM mode is an app-level setting (like the theme), stored on this device. When
 * it is on, the app opens to the DM workspace and the player sheet becomes a
 * secondary area reached from the DM navigation.
 */
export const DM_MODE_KEY = 'dnd-dm-mode';

export function readDmMode(): boolean {
  try {
    return localStorage.getItem(DM_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeDmMode(on: boolean): void {
  try {
    localStorage.setItem(DM_MODE_KEY, String(on));
  } catch {
    // Private browsing or storage full: the in-memory state still applies.
  }
}

/** The current time in ms, for event handlers (a component cannot call Date.now while rendering). */
export function clockNow(): number {
  return Date.now();
}

export const DM_PAGES = ['campaign', 'party', 'encounter', 'settings'] as const;
export type DmPage = (typeof DM_PAGES)[number];
export const DEFAULT_DM_PAGE: DmPage = 'party';

/**
 * Where the current hash points while DM mode is on. `#dm/<page>` is a DM page,
 * an empty hash is the DM home, and any player page hash (`#character`,
 * `#combat`, ...) is the player area. A `#view/...` link is handled before this.
 */
export type DmRoute = { area: 'dm'; page: DmPage } | { area: 'player' };

export function parseDmRoute(hash: string): DmRoute {
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  if (stripped === '' || stripped === 'dm') return { area: 'dm', page: DEFAULT_DM_PAGE };
  const [first, second] = stripped.split('/');
  if (first?.toLowerCase() === 'dm') {
    const page = (second ?? '').toLowerCase();
    return { area: 'dm', page: (DM_PAGES as readonly string[]).includes(page) ? (page as DmPage) : DEFAULT_DM_PAGE };
  }
  return { area: 'player' };
}

export function formatDmHash(page: DmPage): string {
  return `#dm/${page}`;
}
