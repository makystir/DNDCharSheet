import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import styles from './CompanionCreationFlow.module.css';

export interface AddDialogProps {
  /** Heading; also the dialog's accessible name. */
  title: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
}

/**
 * Modal shell for the People tab's add flows (hireling, NPC party member,
 * sidekick, and the kind chooser). Same look and behaviour as CompanionCreationFlow (focus trap,
 * scroll lock, Escape and overlay click cancel). Deviation from the WFRP
 * HirelingCreationFlow wizard: one form step, because the choices are few.
 */
export function AddDialog({ title, confirmLabel, confirmDisabled, onConfirm, onCancel, children }: AddDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);
  useBodyScrollLock(true);

  return (
    <div className={styles.overlay} onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      >
        <h3 className={styles.title}>{title}</h3>
        {children}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.confirmBtn} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
