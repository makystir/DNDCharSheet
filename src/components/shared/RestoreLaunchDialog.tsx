import { useEffect, useId, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import styles from './RestoreConfirmDialog.module.css';

/**
 * Restore-on-launch prompt (B3 auto-backup §4). Shown ONLY when the pure
 * discrepancy predicate flags a genuine discrepancy. It NEVER auto-acts: the
 * user explicitly chooses Restore or Not now (declinable).
 *
 * Borrows the visual markup + CSS of `RestoreConfirmDialog`, and uses this
 * app's shared dialog a11y convention (matching `ConfirmDialog.tsx`):
 * `useFocusTrap` (focus moves into the dialog and returns to the trigger on
 * close) + `useBodyScrollLock` + `role="dialog"` + `aria-modal` + a labelled
 * heading, with Escape / overlay-click declining.
 *
 * B3 durability infra, no game mechanics — no rulebook citation applies.
 */
interface RestoreLaunchDialogProps {
  /** Formatted timestamp of the snapshot ("<time>"). */
  exportedAtLabel: string;
  onRestore: () => void;
  onDecline: () => void;
}

export function RestoreLaunchDialog({
  exportedAtLabel,
  onRestore,
  onDecline,
}: RestoreLaunchDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  useFocusTrap(dialogRef, true);
  useBodyScrollLock(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDecline();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDecline]);

  return (
    <div className={styles.overlay} onClick={onDecline}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <h3 id={headingId} className={styles.heading}>
          A more recent backup from {exportedAtLabel} was found — restore it?
        </h3>
        <div className={styles.actions}>
          <button type="button" onClick={onDecline} className={styles.cancelBtn}>
            Not now
          </button>
          <button type="button" onClick={onRestore} className={styles.confirmBtn}>
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}
