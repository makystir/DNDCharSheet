import { useEffect, useState, useRef, useCallback } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { NAV_ITEMS } from './navItems';
import type { PageSection } from './navItems';
import styles from './Navigation.module.css';

interface NavigationProps {
  activePage: PageSection;
  onPageChange: (page: PageSection) => void;
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
export function Navigation({ activePage, onPageChange }: NavigationProps) {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const activeItemRef = useRef<HTMLButtonElement>(null);

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
      const item = NAV_ITEMS.find((n) => n.shortcut === e.key);
      if (item) {
        onPageChange(item.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPageChange]);

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
      {NAV_ITEMS.map((item) => {
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
            <span className={styles.mobileLabelRow}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderDesktopNav = () =>
    NAV_ITEMS.map((item) => {
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
          {!collapsed && <span className={styles.navItemLabel}>{item.label}</span>}
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

      {isMobile ? renderMobileNav() : renderDesktopNav()}

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
