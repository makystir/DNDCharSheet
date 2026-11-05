import { useEffect, useId, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import styles from './RestoreConfirmDialog.module.css';

/**
 * Restore confirmation dialog (B3 restore UX). Shows the character count, a
 * names list (truncated at 50), and a warning when some restored names already
 * exist locally (they are imported as new copies — restore never overwrites).
 *
 * Ported from the WFRP app's `RestoreConfirmDialog` but HARDENED with this
 * app's shared dialog a11y convention (the WFRP source had none), matching
 * `ConfirmDialog.tsx`: `useFocusTrap` (also restores focus to the trigger on
 * close) + `useBodyScrollLock` + Escape-to-cancel + `role="dialog"` +
 * `aria-modal` + a labelled heading. Overlay-click also cancels.
 *
 * B3 durability infra, no game mechanics — no rulebook citation applies.
 */

const MAX_DISPLAYED_NAMES = 50;

interface RestoreConfirmDialogProps {
  characterCount: number;
  characterNames: string[];
  duplicateNames: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function RestoreConfirmDialog({
  characterCount,
  characterNames,
  duplicateNames,
  onConfirm,
  onCancel,
}: RestoreConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
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

  const duplicateSet = new Set(duplicateNames);
  const displayedNames = characterNames.slice(0, MAX_DISPLAYED_NAMES);
  const remainingCount = characterNames.length - displayedNames.length;

  return (
    <div
      className={styles.overlay}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <div ref={dialogRef} className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h3 id={headingId} className={styles.heading}>
          Restore {characterCount} character{characterCount !== 1 ? 's' : ''}?
        </h3>

        {duplicateNames.length > 0 && (
          <div className={styles.duplicateWarning}>
            ⚠ {duplicateNames.length} character{duplicateNames.length !== 1 ? 's' : ''} already
            exist{duplicateNames.length === 1 ? 's' : ''} locally and will be imported as new
            copies.
          </div>
        )}

        <ul className={styles.nameList}>
          {displayedNames.map((name, i) => (
            <li
              key={i}
              className={duplicateSet.has(name) ? styles.nameItemDuplicate : styles.nameItem}
            >
              {duplicateSet.has(name) ? `⚠ ${name}` : name}
            </li>
          ))}
          {remainingCount > 0 && (
            <li className={styles.moreText}>...and {remainingCount} more</li>
          )}
        </ul>

        <div className={styles.actions}>
          <button type="button" onClick={onCancel} className={styles.cancelBtn}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className={styles.confirmBtn}>
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}
