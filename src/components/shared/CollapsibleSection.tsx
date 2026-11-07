import { useId } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { usePersistedExpanded } from '../../hooks/usePersistedExpanded';
import styles from './CollapsibleSection.module.css';

interface CollapsibleSectionProps {
  title: string;
  storageKey: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

/**
 * A section with a localStorage-persisted expand/collapse toggle. The header
 * is an <h3> carrying a generated id; the content wrapper is a labelled region
 * (`role="region"` + `aria-labelledby`) so the section keeps its accessible
 * name for screen readers even once its old <section aria-labelledby> wrapper
 * is gone.
 */
export function CollapsibleSection({
  title,
  storageKey,
  defaultExpanded = true,
  children,
}: CollapsibleSectionProps) {
  const [expanded, toggle] = usePersistedExpanded(storageKey, defaultExpanded);
  const titleId = useId();

  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.header}
        onClick={toggle}
        aria-expanded={expanded}
      >
        <h3 id={titleId} className={styles.title}>
          {title}
        </h3>
        {expanded ? (
          <ChevronDown size={18} className={styles.chevron} aria-hidden="true" />
        ) : (
          <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
        )}
      </button>
      <div
        className={styles.content}
        data-expanded={String(expanded)}
        aria-hidden={!expanded}
      >
        <div className={styles.contentInner} role="region" aria-labelledby={titleId}>
          {children}
        </div>
      </div>
    </div>
  );
}
