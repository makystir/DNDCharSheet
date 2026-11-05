import styles from './Skeleton.module.css';

/**
 * Loading skeleton shaped like the Inventory page (the carried-weight /
 * encumbrance + currency summary, and the item list). Shown while the lazy
 * Inventory chunk loads. Reads no character data. The DND app lazy-loads more
 * pages than the WFRP app, so this skeleton is added to match the page it fronts.
 */
export function InventorySkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Loading page content">
      {/* Encumbrance + currency summary. */}
      <div className={styles.row}>
        <div className={styles.shimmer} style={{ height: '72px' }} />
        <div className={styles.shimmer} style={{ height: '72px' }} />
      </div>
      {/* Item list. */}
      <div className={styles.shimmer} style={{ height: '220px' }} />
      {/* Add-item / actions area. */}
      <div className={styles.shimmer} style={{ height: '56px' }} />
    </div>
  );
}
