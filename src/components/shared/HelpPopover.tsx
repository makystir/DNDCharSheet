import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
import styles from './HelpPopover.module.css';
import { incrementDismissCount, isSuppressed } from './helpPopoverStorage';

// FRAMEWORK ported from PWACharSheet's HelpPopover.tsx: a dismissible contextual
// help popover whose seen-state persists (auto-shows until dismissed 3 times).

export interface HelpPopoverProps {
  concept: string; // concept ID for localStorage key
  children: string; // help text content (max 280 chars)
}

/** Estimated popover box used to decide flip/clamp before it is measured. */
const EST_WIDTH = 300;
const EST_HEIGHT = 120;
const GAP = 6;
const MARGIN = 8;

/**
 * Compute a fixed-position box for the popover from the trigger's rect. Prefers
 * opening below the trigger, flips above when there isn't room, and clamps
 * horizontally to the viewport. Mirrors the shared Tooltip positioning so the
 * popover escapes any clipping ancestor (e.g. a collapsible section's
 * overflow:hidden content area).
 */
function computePosition(trigger: HTMLElement): { top: number; left: number } {
  const rect = trigger.getBoundingClientRect();

  const spaceBelow = window.innerHeight - rect.bottom;
  let top: number;
  if (spaceBelow >= EST_HEIGHT + GAP) {
    top = rect.bottom + GAP;
  } else {
    top = rect.top - EST_HEIGHT - GAP;
    if (top < MARGIN) top = MARGIN;
  }

  // Left-align with the trigger, then clamp into the viewport.
  let left = rect.left;
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - EST_WIDTH - MARGIN));

  return { top, left };
}

export function HelpPopover({ concept, children }: HelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const autoShowedRef = useRef(false);

  // Auto-show on first render if not yet suppressed (dismissed < 3 times).
  // Intentional setState-in-effect: reads suppression state from an external
  // store on mount and opens the popover once accordingly.
  useEffect(() => {
    if (!autoShowedRef.current && !isSuppressed(concept)) {
      autoShowedRef.current = true;
      setOpen(true);
    }
  }, [concept]);

  // Position the popover (in a portal) whenever it opens, and keep it anchored on
  // scroll/resize. Positioning from the trigger's live rect means it is never
  // clipped by an ancestor's overflow.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    // Intentional setState-in-effect: the popover position is derived from the
    // trigger's live DOM rect, which is only available after mount and must be
    // recomputed on scroll/resize (same pattern as the shared Tooltip).
    if (!open) {
      setPosition(null);
      return;
    }
    const reposition = () => {
      if (buttonRef.current) setPosition(computePosition(buttonRef.current));
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  const dismiss = useCallback(() => {
    setOpen(false);
    incrementDismissCount(concept);
  }, [concept]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) {
        incrementDismissCount(concept);
        return false;
      }
      return true;
    });
  }, [concept]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss();
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, dismiss]);

  // Close on outside click. The popover lives in a portal (outside the trigger's
  // DOM subtree), so "inside" means either the trigger button or the popover box.
  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = buttonRef.current?.contains(target);
      const insidePopover = popoverRef.current?.contains(target);
      if (!insideTrigger && !insidePopover) {
        dismiss();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open, dismiss]);

  return (
    <span className={styles.container}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={`Help: ${concept}`}
        aria-expanded={open}
        onClick={toggle}
      >
        <HelpCircle size={16} aria-hidden="true" />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            className={styles.popover}
            role="tooltip"
            style={{ top: position.top, left: position.left }}
          >
            <p className={styles.content}>{children}</p>
          </div>,
          document.body,
        )}
    </span>
  );
}
