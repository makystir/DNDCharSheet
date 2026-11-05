import styles from './Skeleton.module.css';

/**
 * Loading skeleton shaped like the Settings page (appearance header, the toggle
 * rows, and the Export/Import + Share + Auto-backup cards). Shown while the lazy
 * Settings chunk loads. Reads no character data. Bucket-1 port of the WFRP
 * SettingsSkeleton.
 */
export function SettingsSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Loading page content">
      {/* Appearance header. */}
      <div className={styles.shimmer} style={{ height: '40px' }} />
      {/* Toggle rows (theme, dice entry, house rules). */}
      <div className={styles.shimmer} style={{ height: '56px' }} />
      <div className={styles.shimmer} style={{ height: '56px' }} />
      <div className={styles.shimmer} style={{ height: '56px' }} />
      {/* Export/Import + Share + Auto-backup cards. */}
      <div className={styles.shimmer} style={{ height: '100px' }} />
    </div>
  );
}
