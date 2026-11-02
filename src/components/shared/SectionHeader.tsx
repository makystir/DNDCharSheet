import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import styles from './SectionHeader.module.css';

interface SectionHeaderProps {
  icon: LucideIcon;
  title: ReactNode;
  /**
   * Optional id applied to the rendered <h3> so a surrounding region can point
   * `aria-labelledby` at it, preserving the section's accessible name.
   */
  titleId?: string;
  action?: ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/** Icon + title header for a section, with an optional collapse toggle. */
export function SectionHeader({
  icon: Icon,
  title,
  titleId,
  action,
  collapsible,
  collapsed,
  onToggleCollapse,
}: SectionHeaderProps) {
  return (
    <div className={styles.header}>
      <Icon size={14} />
      {collapsible ? (
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
        >
          <h3 id={titleId} className={styles.title}>
            {title}
          </h3>
          {/* Chevron pushed to the far right of the clickable header area
              (margin-left:auto) so collapse affordances align consistently. */}
          <span
            className={collapsed ? styles.chevron : styles.chevronExpanded}
            aria-hidden="true"
          >
            ▼
          </span>
        </button>
      ) : (
        <h3 id={titleId} className={styles.title}>
          {title}
        </h3>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
