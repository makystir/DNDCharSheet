import { useEffect, useState, useRef, useCallback } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  ChevronDown,
  Users,
  Search,
  Keyboard,
} from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { HelpPopover } from '../shared/HelpPopover';
import { getHelpContent } from '../../logic/help-content';
import { useCommandPaletteContext } from '../command-palette/commandPaletteContextValue';
import { visibleNavItems } from './navItems';
import type { PageSection } from './navItems';
import type { Character } from '../../types/character';
import styles from './Navigation.module.css';

interface NavigationProps {
  activePage: PageSection;
  onPageChange: (page: PageSection) => void;
  /**
   * The active character, used to filter conditional nav items (the
   * level-gated Spells tab). Undefined while loading — no conditional item is
   * shown until a character is available.
   */
  character?: Character;
  /**
   * Opens the multi-character management sheet (Stage B1). When provided, the
   * sidebar renders a character switcher showing the active character. The
   * forwarded ref is wired to the switcher button so focus can return to it
   * when the sheet closes.
   */
  onOpenCharacterManager?: () => void;
  /** Ref to the desktop switcher button (focus-return target for the sheet). */
  characterManagerTriggerRef?: React.RefObject<HTMLButtonElement | null>;
}

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem('nav-collapsed') === 'true';
  } catch {
    return false;
  }
}

/**
 * The app shell navigation: a collapsible sidebar on desktop and a horizontally
 * scrollable tab bar on mobile. Rendered from the single NAV_ITEMS source of
 * truth; number-key shortcuts and aria-current all derive from it.
 */
export function Navigation({
  activePage,
  onPageChange,
  character,
  onOpenCharacterManager,
  characterManagerTriggerRef,
}: NavigationProps) {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const activeItemRef = useRef<HTMLButtonElement>(null);
  // Stage B6: palette-open + shortcuts-overlay affordances delegate to the
  // CommandPaletteContext (integration point 3). This renders buttons only; it
  // adds NO keyboard handler, so Navigation remains the sole owner of the
  // number-key page shortcuts (integration point 2, approach (a)).
  const { open: openPalette, openShortcuts } = useCommandPaletteContext();

  // Items visible for the active character: the conditional Spells tab is
  // filtered out for a non-caster (or a sub-caster below its casting level).
  const navItems = visibleNavItems(character);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nav-collapsed', String(next));
      } catch {
        // Private browsing or storage full — ignore
      }
      return next;
    });
  }, []);

  // Auto-scroll the active item into view on mobile (scrollable bar).
  useEffect(() => {
    if (isMobile && activeItemRef.current) {
      const el = activeItemRef.current;
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
      }
    }
  }, [isMobile, activePage]);

  // Number-key shortcuts. Ignored while typing in a form field.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }
      // Only the VISIBLE items' shortcuts fire; a hidden tab's key is inert.
      const item = navItems.find((n) => n.shortcut === e.key);
      if (item) {
        onPageChange(item.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPageChange, navItems]);

  // Prevent synthesized clicks from carrying over to the new page after
  // touch-based navigation: calling preventDefault() on touchend stops the
  // browser synthesizing a click that would land on the new page's content.
  const handleNavTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLButtonElement>, page: PageSection) => {
      e.preventDefault();
      onPageChange(page);
    },
    [onPageChange],
  );

  const renderMobileNav = () => (
    <div className={styles.mobileScrollRow}>
      {navItems.map((item) => {
        const isActive = activePage === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            ref={isActive ? activeItemRef : undefined}
            type="button"
            className={isActive ? styles.navItemActive : styles.navItem}
            onClick={() => onPageChange(item.id)}
            onTouchEnd={(e) => handleNavTouchEnd(e, item.id)}
            aria-current={isActive ? 'page' : undefined}
            data-section={item.id}
          >
            <span className={styles.iconWrapper}>
              <Icon size={18} />
            </span>
            <span className={styles.mobileLabelRow}>
              {item.label}
              {item.subTabHint && (
                <ChevronRight size={10} className={styles.subTabCaret} aria-hidden="true" />
              )}
            </span>
          </button>
        );
      })}

      {/* Stage B6: command-palette open affordance (mobile scroll row). */}
      <button
        type="button"
        className={styles.navItem}
        onClick={() => openPalette()}
        onTouchEnd={(e) => {
          e.preventDefault();
          openPalette();
        }}
        aria-label="Open command palette"
        data-section="search"
      >
        <span className={styles.iconWrapper}>
          <Search size={18} />
        </span>
        <span className={styles.mobileLabelRow}>Search</span>
      </button>

      {/* Stage B6: keyboard-shortcuts overlay affordance (mobile scroll row). */}
      <button
        type="button"
        className={styles.navItem}
        onClick={() => openShortcuts()}
        onTouchEnd={(e) => {
          e.preventDefault();
          openShortcuts();
        }}
        aria-label="Keyboard shortcuts"
        data-section="shortcuts"
      >
        <span className={styles.iconWrapper}>
          <Keyboard size={18} />
        </span>
        <span className={styles.mobileLabelRow}>Shortcuts</span>
      </button>
    </div>
  );

  const renderDesktopNav = () =>
    navItems.map((item) => {
      const isActive = activePage === item.id;
      const Icon = item.icon;
      return (
        <button
          key={item.id}
          type="button"
          className={`${isActive ? styles.navItemActive : styles.navItem} ${collapsed ? styles.navItemCollapsed : ''}`}
          onClick={() => onPageChange(item.id)}
          onTouchEnd={(e) => handleNavTouchEnd(e, item.id)}
          aria-current={isActive ? 'page' : undefined}
          aria-label={collapsed ? item.label : undefined}
          title={collapsed ? item.label : undefined}
          data-section={item.id}
        >
          <span className={styles.iconWrapper}>
            <Icon size={18} />
          </span>
          {!collapsed && (
            <span className={styles.navItemLabel}>
              <span className={styles.navItemLabelRow}>
                {item.label}
                {item.subTabHint && (
                  <ChevronRight size={12} className={styles.subTabCaret} aria-hidden="true" />
                )}
              </span>
              {item.subTabHint && (
                <span className={styles.navItemSubHint} aria-hidden="true">
                  {item.subTabHint}
                </span>
              )}
            </span>
          )}
        </button>
      );
    });

  return (
    <nav
      className={`${styles.sidebar} ${!isMobile && collapsed ? styles.sidebarCollapsed : ''}`}
      aria-label="Main navigation"
    >
      {!isMobile && !collapsed && (
        <div className={styles.appTitle}>⚔ D&amp;D 5.5e Character Assistant</div>
      )}

      {/* Character switcher (Stage B1): shows the active character and opens the
          management sheet. Desktop-only — on mobile the CharacterNameHeader
          hosts the switcher. Rendered only once a character is active. */}
      {!isMobile && onOpenCharacterManager && character && (
        <button
          ref={characterManagerTriggerRef}
          type="button"
          className={`${styles.characterSwitcher} ${collapsed ? styles.characterSwitcherCollapsed : ''}`}
          onClick={onOpenCharacterManager}
          aria-haspopup="dialog"
          aria-label={
            collapsed
              ? `Manage characters (active: ${character.name.trim() === '' ? 'Unnamed Character' : character.name})`
              : 'Manage characters'
          }
          title={collapsed ? 'Manage characters' : undefined}
        >
          <span className={styles.iconWrapper}>
            <Users size={18} />
          </span>
          {!collapsed && (
            <>
              <span className={styles.characterSwitcherName}>
                {character.name.trim() === '' ? 'Unnamed Character' : character.name}
              </span>
              <ChevronDown size={14} className={styles.characterSwitcherCaret} aria-hidden="true" />
            </>
          )}
        </button>
      )}

      {isMobile ? renderMobileNav() : renderDesktopNav()}

      {/* Stage B6: command-palette open affordance (desktop sidebar). When the
          sidebar is expanded, a dismissible contextual HelpPopover (the
          'command-palette' concept) sits beside it to introduce the palette and
          its Ctrl/⌘+K shortcut on first use. */}
      {!isMobile && (
        <div className={styles.searchAffordance}>
          <button
            type="button"
            className={`${styles.navItem} ${collapsed ? styles.navItemCollapsed : ''}`}
            onClick={() => openPalette()}
            aria-label="Open command palette"
            title={collapsed ? 'Search' : undefined}
            data-section="search"
          >
            <span className={styles.iconWrapper}>
              <Search size={18} />
            </span>
            {!collapsed && <span>Search</span>}
          </button>
          {!collapsed && (
            <HelpPopover concept="command-palette">
              {getHelpContent('command-palette')}
            </HelpPopover>
          )}
        </div>
      )}

      {/* Stage B6: keyboard-shortcuts overlay affordance (desktop sidebar). */}
      {!isMobile && (
        <button
          type="button"
          className={`${styles.navItem} ${collapsed ? styles.navItemCollapsed : ''}`}
          onClick={() => openShortcuts()}
          aria-label="Keyboard shortcuts"
          title={collapsed ? 'Keyboard shortcuts' : undefined}
          data-section="shortcuts"
        >
          <span className={styles.iconWrapper}>
            <Keyboard size={18} />
          </span>
          {!collapsed && <span>Keyboard Shortcuts</span>}
        </button>
      )}

      {/* Collapse toggle button (desktop only) */}
      {!isMobile && (
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      )}
    </nav>
  );
}
