import { NAV_ITEMS } from '../components/layout/navItems';

/**
 * Single source of truth for the app's keyboard shortcuts, surfaced by the
 * ShortcutsHelp overlay.
 *
 * FRAMEWORK ported from PWACharSheet's config/shortcuts.ts, re-themed to the
 * D&D app's actual bindings. Each entry mirrors a REAL handler wired elsewhere:
 * - Page-switch number keys come from `NAV_ITEMS` in
 *   `components/layout/navItems.ts` — the SAME array the keydown listener in
 *   `components/layout/Navigation.tsx` matches `event.key` against. Deriving
 *   them here guarantees the overlay stays in sync with the real bindings and
 *   does NOT register a second handler (integration point 2, approach (a):
 *   Navigation remains the sole owner of the number-key handler; this registry
 *   only DOCUMENTS those keys).
 * - Ctrl/Cmd+K opens the command palette (see command-palette/useCommandPalette.ts)
 *   — a NEW, non-conflicting binding.
 * - The shortcuts overlay itself is reachable via visible affordances (the nav
 *   Shortcuts button + the palette footer), so it is documented, not key-bound.
 *
 * If a handler's binding changes, update it here (or in `NAV_ITEMS`) so the
 * help overlay reflects reality.
 */

export interface KeyboardShortcut {
  /** Human-readable key combination, e.g. "1", "Ctrl / ⌘ + K". */
  keys: string;
  /** What the shortcut does. */
  description: string;
}

export interface ShortcutGroup {
  /** Section heading in the help overlay. */
  title: string;
  shortcuts: KeyboardShortcut[];
}

/** Page-switch shortcuts, derived from the navigation items themselves. */
const PAGE_SHORTCUTS: KeyboardShortcut[] = NAV_ITEMS.map((item) => ({
  keys: item.shortcut,
  description: `Go to ${item.label}`,
}));

/** Global action shortcuts handled outside the navigation. */
const GLOBAL_SHORTCUTS: KeyboardShortcut[] = [
  // Ctrl/Cmd+K → toggles the command palette (see useCommandPalette.ts).
  { keys: 'Ctrl / ⌘ + K', description: 'Open search / command palette' },
];

/** Grouped shortcut definitions consumed by the ShortcutsHelp overlay. */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  { title: 'Navigation', shortcuts: PAGE_SHORTCUTS },
  { title: 'Actions', shortcuts: GLOBAL_SHORTCUTS },
];
