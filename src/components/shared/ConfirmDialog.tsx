import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Accessible name of the dialog (default "Confirmation"). */
  title?: string;
  /** Extra content under the message, e.g. a summary of what will change. */
  children?: ReactNode;
  /** Disable the confirm button (e.g. until a required pick is made). */
  confirmDisabled?: boolean;
}

/**
 * A modal confirmation dialog. Hardened beyond the WFRP source with a focus
 * trap (which also restores focus to the trigger on close), body-scroll-lock,
 * and Escape-to-cancel, so it meets FR-16 / AC-11. Overlay-click also cancels.
 */
export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  title = 'Confirmation',
  children,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);
  useBodyScrollLock(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className={styles.overlay}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div ref={dialogRef} className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <p className={styles.message}>{message}</p>
        {children && <div className={styles.details}>{children}</div>}
        <div className={styles.actions}>
          <button type="button" onClick={onCancel} className={styles.cancelBtn}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={styles.confirmBtn} disabled={confirmDisabled}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
