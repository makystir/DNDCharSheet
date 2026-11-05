import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SHORTCUT_GROUPS } from '../../config/shortcuts';
import styles from './ShortcutsHelp.module.css';

export interface ShortcutsHelpProps {
  onClose: () => void;
}

/**
 * Keyboard-shortcut reference overlay. FRAMEWORK ported from PWACharSheet's
 * ShortcutsHelp.tsx.
 *
 * The list is generated from `config/shortcuts.ts` — the single source of truth
 * derived from the ACTUAL handlers: the page number keys from `NAV_ITEMS`
 * (whose only keydown handler lives in Navigation) plus Ctrl/⌘+K to open the
 * command palette. It is reachable via visible affordances (the palette footer
 * + the navigation Shortcuts button) so users never need a hidden combination
 * to discover the shortcuts. This overlay only DOCUMENTS the number keys; it
 * registers no handler for them (integration point 2, approach (a)).
 */
export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Dismiss on Escape.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus the panel on mount for keyboard users.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Tab focus trap: keep focus within the overlay panel while it is open, so a
  // Tab cannot reach the page behind this aria-modal dialog. Mirrors the command
  // palette's trap so both dialogs share the same containment behaviour.
  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const panel = panelRef.current;
    if (!panel) return;

    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) {
      // Nothing focusable inside — keep focus on the panel itself.
      e.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      if (active === first || active === panel) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  return createPortal(
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        ref={panelRef}
        className={styles.panel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handlePanelKeyDown}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Keyboard Shortcuts</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.groups}>
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className={styles.group}>
              <h3 className={styles.groupTitle}>{group.title}</h3>
              <dl className={styles.list}>
                {group.shortcuts.map((shortcut) => (
                  <div key={`${group.title}-${shortcut.keys}`} className={styles.row}>
                    <dt className={styles.keys}>
                      <kbd className={styles.kbd}>{shortcut.keys}</kbd>
                    </dt>
                    <dd className={styles.description}>{shortcut.description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
