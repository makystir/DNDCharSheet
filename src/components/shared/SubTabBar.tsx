import styles from './SubTabBar.module.css';

export interface SubTabBarProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

/**
 * A role=tablist sub-navigation bar for use within a page. Ported from the WFRP
 * shell with its tab-reorder edit mode removed (out of scope). No page wires it
 * this stage; it is provided so a future page can use sub-tabs.
 */
export function SubTabBar({ tabs, activeTab, onTabChange }: SubTabBarProps) {
  return (
    <div className={styles.subTabBar} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === activeTab}
          className={tab.id === activeTab ? styles.tabActive : styles.tab}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
