import styles from './Skeleton.module.css';

/**
 * Loading skeleton shaped like the Combat page (AC/HP/initiative readouts, the
 * weapon/attack cards, and the turn/actions area). Shown while the lazy Combat
 * chunk loads. Reads no character data. Bucket-1 port of the WFRP CombatSkeleton.
 */
export function CombatSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Loading page content">
      {/* Combat readouts dashboard (AC / HP / Initiative / Speed). */}
      <div className={styles.shimmer} style={{ height: '80px' }} />
      {/* Weapon / attack cards. */}
      <div className={styles.row}>
        <div className={styles.shimmer} style={{ height: '200px' }} />
        <div className={styles.shimmer} style={{ height: '200px' }} />
      </div>
      {/* Actions / turn economy area. */}
      <div className={styles.shimmer} style={{ height: '150px' }} />
    </div>
  );
}
