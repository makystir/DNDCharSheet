import { useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Suggestion, SuggestionAction, SuggestionCategory } from '../../logic/assistant/types';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useAssistantContext } from './assistantContextValue';
import { SuggestionItem } from './SuggestionItem';
import styles from './AssistantPanel.module.css';

export interface AssistantPanelProps {
  /** Visible (dismiss/snooze-filtered) suggestions to display. */
  suggestions: Suggestion[];
  /** Invoke the real handler for a suggestion's action descriptor. */
  onAction: (action: SuggestionAction) => void;
  /** Dismiss a suggestion until its condition clears and re-triggers. */
  onDismiss: (id: string) => void;
  /** Snooze a suggestion for a fixed window (24h). */
  onSnooze: (id: string) => void;
}

/**
 * Human-readable heading for each category group. The groups are rendered in
 * the order the engine already sorted them into (ordering.ts), so this map only
 * supplies display labels — it does not reorder.
 */
const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  combat: 'Combat',
  health: 'Health & Rest',
  encumbrance: 'Encumbrance',
  advancement: 'Advancement',
  resource: 'Data & Backup',
};

/** Group the already-ordered suggestions by category, preserving their order. */
function groupByCategory(
  suggestions: Suggestion[],
): { category: SuggestionCategory; items: Suggestion[] }[] {
  const groups: { category: SuggestionCategory; items: Suggestion[] }[] = [];
  for (const s of suggestions) {
    const last = groups[groups.length - 1];
    if (last && last.category === s.category) {
      last.items.push(s);
    } else {
      groups.push({ category: s.category, items: [s] });
    }
  }
  return groups;
}

/**
 * The Character Assistant panel: one component, two presentations switched on
 * the `max-width: 767px` breakpoint via `data-variant` — a right-side slide-over
 * drawer on desktop, a bottom sheet on mobile. Rendered via portal; returns
 * `null` when closed (no layout footprint, covers no primary content).
 *
 * Mirrors the shared overlay model: role="dialog" + aria-modal, body
 * scroll-lock (useBodyScrollLock), a shared focus trap (useFocusTrap, which
 * also moves focus into the panel on open and restores it to the trigger on
 * close), and Escape + backdrop close. The panel only DESCRIBES actions through
 * SuggestionItem — it never mutates the character.
 */
export function AssistantPanel({ suggestions, onAction, onDismiss, onSnooze }: AssistantPanelProps) {
  const { isOpen, close } = useAssistantContext();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const panelRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupByCategory(suggestions), [suggestions]);

  // Lock body scroll while the drawer/sheet is open (dialog convention —
  // matches CommandPalette and every other overlay via useBodyScrollLock).
  useBodyScrollLock(isOpen);

  // Shared focus trap: moves focus into the panel on open (the close button is
  // the first focusable element), traps Tab/Shift+Tab, and restores focus to
  // the previously focused trigger on close — the convention every other dialog
  // uses. Replaces the former hand-rolled trap + previousFocusRef restore.
  useFocusTrap(panelRef, isOpen);

  const handleClose = useCallback(() => {
    close();
  }, [close]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose],
  );

  // Escape closes; Tab/Shift+Tab trapping is handled by useFocusTrap.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    },
    [handleClose],
  );

  if (!isOpen) return null;

  const panelContent = (
    <div
      className={styles.backdrop}
      data-variant={isMobile ? 'sheet' : 'drawer'}
      onClick={handleBackdropClick}
      data-testid="assistant-panel-backdrop"
    >
      <div
        ref={panelRef}
        className={styles.panel}
        data-variant={isMobile ? 'sheet' : 'drawer'}
        role="dialog"
        aria-modal="true"
        aria-label="Character Assistant"
        onKeyDown={handleKeyDown}
      >
        <div className={styles.header}>
          <h2 className={styles.heading}>Character Assistant</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close assistant"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          {suggestions.length === 0 ? (
            <div className={styles.emptyState}>No suggestions right now.</div>
          ) : (
            groups.map((group) => (
              <section key={group.category} className={styles.group}>
                <h3 className={styles.groupHeading}>{CATEGORY_LABELS[group.category]}</h3>
                <ul className={styles.list}>
                  {group.items.map((s) => (
                    <SuggestionItem
                      key={s.id}
                      suggestion={s}
                      onAction={onAction}
                      onDismiss={onDismiss}
                      onSnooze={onSnooze}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(panelContent, document.body);
}
