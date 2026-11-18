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

export const DM_PAGES = ['campaign', 'party', 'encounter', 'library', 'journal', 'generators', 'treasure', 'xp', 'settings'] as const;
export type DmPage = (typeof DM_PAGES)[number];
export const DEFAULT_DM_PAGE: DmPage = 'party';

/**
 * Label and number-key shortcut for each DM page. The single source for the DM
 * navigation, its shortcut handler, the command palette entries and the
 * shortcuts overlay, so they cannot drift apart.
 */
export const DM_PAGE_INFO: ReadonlyArray<{ id: DmPage; label: string; shortcut: string }> = [
  { id: 'campaign', label: 'Campaign', shortcut: '1' },
  { id: 'party', label: 'Party', shortcut: '2' },
  { id: 'encounter', label: 'Encounter', shortcut: '3' },
  { id: 'library', label: 'Library', shortcut: '4' },
  { id: 'journal', label: 'Journal', shortcut: '5' },
  { id: 'generators', label: 'Generators', shortcut: '6' },
  { id: 'treasure', label: 'Treasure', shortcut: '7' },
  { id: 'xp', label: 'Party XP', shortcut: '8' },
  { id: 'settings', label: 'Settings', shortcut: '9' },
];

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
