import { useState, useCallback, useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import styles from './CollapsibleSection.module.css';

interface CollapsibleSectionProps {
  title: string;
  storageKey: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

/**
 * Read the expanded state from localStorage.
 * Returns undefined if not found or on error (graceful fallback).
 */
function readPersistedState(storageKey: string): boolean | undefined {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Write the expanded state to localStorage.
 * Silently swallows errors (quota exceeded, private browsing, etc.) and
 * continues with in-memory state only.
 */
function writePersistedState(storageKey: string, expanded: boolean): void {
  try {
    localStorage.setItem(storageKey, String(expanded));
  } catch {
    // Graceful fallback: continue with in-memory state only
  }
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
  const [expanded, setExpanded] = useState<boolean>(() => {
    const persisted = readPersistedState(storageKey);
    return persisted ?? defaultExpanded;
  });
  const titleId = useId();

  // Sync with storageKey changes (e.g. character switch).
  // Intentional setState-in-effect: reads persisted expand/collapse state from
  // localStorage (an external system) when the storageKey changes.
  useEffect(() => {
    const persisted = readPersistedState(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded(persisted ?? defaultExpanded);
  }, [storageKey, defaultExpanded]);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      writePersistedState(storageKey, next);
      return next;
    });
  }, [storageKey]);

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
