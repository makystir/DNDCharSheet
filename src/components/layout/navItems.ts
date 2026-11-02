import { User, Swords, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * The routing key for a top-level page. This is the single source of truth for
 * the page-section type; `logic/hash-route` and `useHashRoute` import it from
 * here (rather than from a component) so the pure routing logic stays free of
 * React imports and there is no circular dependency.
 */
export type PageSection = 'character' | 'combat' | 'settings';

export interface NavItem {
  id: PageSection;
  label: string;
  icon: LucideIcon;
  /** The number key that switches to this page. */
  shortcut: string;
}

/**
 * Page-navigation items. The `shortcut` field is the number key handled by the
 * keydown listener in Navigation. This array is the single source of truth for
 * both the rendered nav and the page-switch shortcuts; adding a future tab
 * (Spells, Inventory, Features, Advancement) is a one-line addition here plus a
 * new page module wired into the shell's page switch.
 */
export const NAV_ITEMS: NavItem[] = [
  { id: 'character', label: 'Character', icon: User, shortcut: '1' },
  { id: 'combat', label: 'Combat', icon: Swords, shortcut: '2' },
  { id: 'settings', label: 'Settings', icon: Settings, shortcut: '3' },
];
