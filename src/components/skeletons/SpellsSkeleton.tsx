import styles from './Skeleton.module.css';

/**
 * Loading skeleton shaped like the Spells page (spell save DC / attack summary,
 * the slot track, and the prepared/known spell list). Shown while the lazy
 * Spells chunk loads. Reads no character data. The DND app lazy-loads more pages
 * than the WFRP app, so this skeleton is added to match the page it fronts.
 */
export function SpellsSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Loading page content">
      {/* Spell save DC / spell attack summary. */}
      <div className={styles.shimmer} style={{ height: '64px' }} />
      {/* Spell slot track. */}
      <div className={styles.shimmer} style={{ height: '56px' }} />
      {/* Prepared / known spell list. */}
      <div className={styles.shimmer} style={{ height: '220px' }} />
    </div>
  );
}
