import { User, Swords, Sparkles, Settings, Backpack, TrendingUp, PawPrint } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Character } from '../../types/character';
import { anySpellcaster } from '../../logic/spellcasting';
import { pendingChoiceCount } from '../../logic/pending-choices';

/**
 * The routing key for a top-level page. This is the single source of truth for
 * the page-section type; `logic/hash-route` and `useHashRoute` import it from
 * here (rather than from a component) so the pure routing logic stays free of
 * React imports and there is no circular dependency.
 */
export type PageSection =
  | 'character'
  | 'combat'
  | 'inventory'
  | 'spells'
  | 'advancement'
  | 'companions'
  | 'settings';

export interface NavItem {
  id: PageSection;
  label: string;
  icon: LucideIcon;
  /** The number key that switches to this page. */
  shortcut: string;
  /**
   * Advertises the combined scope of this page's sub-tabs (e.g. shown as a
   * secondary hint line beside the label). Purely presentational — it does not
   * change the routing key (`#<id>`).
   */
  subTabHint?: string;
  /**
   * Optional visibility predicate over the active character. When present and
   * it returns false, the tab is NOT rendered, its route is guarded, and its
   * number-key shortcut is inert. Used for the conditional, level-gated Spells
   * tab (shown only to a spellcaster at/above its casting level).
   */
  predicate?: (character: Character) => boolean;
  /**
   * Optional count shown as a badge on the nav item (for example the choices a
   * character still owes). 0 shows nothing. Derived from the character, so the
   * badge and the page it points to always agree.
   */
  badge?: (character: Character) => number;
}

/**
 * Page-navigation items. The `shortcut` field is the number key handled by the
 * keydown listener in Navigation. This array is the single source of truth for
 * both the rendered nav and the page-switch shortcuts; adding a future tab
 * (Spells, Inventory, Features, Advancement) is a one-line addition here plus a
 * new page module wired into the shell's page switch.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'character',
    label: 'Character',
    icon: User,
    shortcut: '1',
    subTabHint: 'Overview · Abilities & Skills · Class & Features',
  },
  { id: 'combat', label: 'Combat', icon: Swords, shortcut: '2' },
  // Inventory: an UNCONDITIONAL top-level tab (every character has gear, so no
  // predicate). Keyed '5' so the existing tabs keep their shortcuts (Character
  // '1', Combat '2', Settings '3', Spells '4'); the number does not match the
  // visual position, which is intentional — stable shortcuts are preferred over
  // renumbering (same stable-shortcut rule as Spells above). This is a
  // DELIBERATE ui-parity deviation from PWACharSheet (where Gear is a Character
  // SUB-tab): the D&D nav was built for an Inventory top tab and AC lives on
  // Combat, so Inventory sits naturally as a top-level tab (blueprint 7.6).
  { id: 'inventory', label: 'Inventory', icon: Backpack, shortcut: '5' },
  // Conditional + level-gated: shown only when the active character can cast
  // (isSpellcaster is level-aware — Eldritch Knight / Arcane Trickster appear
  // only from level 3). Given its OWN shortcut '4' so existing tabs keep their
  // keys (Character '1', Combat '2', Settings '3' are unchanged). DELIBERATE:
  // Spells renders third (between Combat and Settings) but is keyed '4', so its
  // key does not match its visual position. This is intentional — stable
  // shortcuts that don't churn muscle memory/tests are preferred over renumbering
  // Settings. Do NOT "fix" the mismatch by renumbering (confirmed with the user).
  {
    id: 'spells',
    label: 'Spells',
    icon: Sparkles,
    shortcut: '4',
    subTabHint: 'Summary · Prepared · Browse',
    predicate: anySpellcaster,
  },
  // Advancement: an UNCONDITIONAL top-level tab (every character can level up, so
  // no predicate). Keyed '6' — the next free number key — so every existing tab
  // keeps its shortcut (Character '1', Combat '2', Settings '3', Spells '4',
  // Inventory '5'). The key does NOT match the visual position (Advancement
  // renders after Spells, before Settings), which is the same deliberate
  // stable-shortcut convention used by Inventory '5' and Spells '4': stable
  // shortcuts are preferred over renumbering so muscle memory / tests do not
  // churn. Do NOT "fix" the mismatch by renumbering.
  {
    id: 'advancement',
    label: 'Advancement',
    icon: TrendingUp,
    shortcut: '6',
    subTabHint: 'Level · Hit Points · Next level · Log',
    badge: pendingChoiceCount,
  },
  // Companions: an UNCONDITIONAL top-level tab (permanent creature companions,
  // mounts, hirelings and NPC party members; any character may keep a pet or hire
  // help, so no predicate). Keyed '7', the next free number key, so every existing
  // tab keeps its shortcut (same stable-shortcut convention as Inventory '5' and
  // Advancement '6'). Do NOT renumber. Modelled on the WFRP app's Retinue page.
  {
    id: 'companions',
    label: 'Companions',
    icon: PawPrint,
    shortcut: '7',
    subTabHint: 'Companions · Mounts · Hirelings · NPC Party',
  },
  { id: 'settings', label: 'Settings', icon: Settings, shortcut: '3' },
];

/**
 * The nav items visible for a given character: items without a predicate are
 * always shown; a predicated item (Spells) is shown only when its predicate
 * passes. Used by Navigation to render + to gate the number-key shortcuts, and
 * by the shell to guard the active route.
 */
export function visibleNavItems(character: Character | undefined): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.predicate || (character !== undefined && item.predicate(character)),
  );
}
