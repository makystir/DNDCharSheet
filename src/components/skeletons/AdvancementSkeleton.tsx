import styles from './Skeleton.module.css';

/**
 * Loading skeleton shaped like the Advancement page (level/XP summary, the
 * hit-points section, the next-level/feat area, and the advancement log). Shown
 * while the lazy Advancement chunk loads. Reads no character data. Bucket-1 port
 * of the WFRP AdvancementSkeleton.
 */
export function AdvancementSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Loading page content">
      {/* Level / XP summary header. */}
      <div className={styles.shimmer} style={{ height: '48px' }} />
      {/* Hit points + next-level columns. */}
      <div className={styles.row}>
        <div className={styles.shimmer} style={{ height: '120px' }} />
        <div className={styles.shimmer} style={{ height: '120px' }} />
      </div>
      {/* Feat / ASI slots. */}
      <div className={styles.shimmer} style={{ height: '180px' }} />
      {/* Advancement log. */}
      <div className={styles.shimmer} style={{ height: '140px' }} />
    </div>
  );
}
