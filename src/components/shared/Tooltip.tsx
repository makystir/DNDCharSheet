import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  anchorEl: HTMLElement;
  title: string;
  children: ReactNode;
  onClose: () => void;
  id: string;
}

interface Placement {
  top: number;
  left: number;
}

const MARGIN = 8;
const GAP = 6;
/** Widths tried, narrowest first, when the tooltip is too tall at its normal width. */
const WIDTHS = [320, 440, 560, 720];

/**
 * Where the tooltip fits WHOLE next to its anchor without covering it: below, then
 * above, then to the right or left (vertically centred on the anchor, kept on
 * screen). Null when none of those has room for its measured size.
 *
 * Not covering the anchor matters on touch screens; on hover devices the tooltip
 * ignores the pointer (CSS), so covering the anchor cannot steal the hover.
 */
function besideAnchor(rect: DOMRect, width: number, height: number): Placement | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const centredLeft = Math.max(MARGIN, Math.min(rect.left + rect.width / 2 - width / 2, vw - width - MARGIN));
  if (height <= vh - rect.bottom - GAP - MARGIN) return { top: rect.bottom + GAP, left: centredLeft };
  if (height <= rect.top - GAP - MARGIN) return { top: rect.top - GAP - height, left: centredLeft };
  if (height <= vh - 2 * MARGIN) {
    const top = Math.max(MARGIN, Math.min(rect.top + rect.height / 2 - height / 2, vh - height - MARGIN));
    if (rect.right + GAP + width <= vw - MARGIN) return { top, left: rect.right + GAP };
    if (rect.left - GAP - width >= MARGIN) return { top, left: rect.left - GAP - width };
  }
  return null;
}

/** Fully on screen, centred on the anchor as far as the viewport allows (may cover it). */
function onScreen(rect: DOMRect, width: number, height: number): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    top: Math.max(MARGIN, Math.min(rect.top + rect.height / 2 - height / 2, vh - height - MARGIN)),
    left: Math.max(MARGIN, Math.min(rect.left + rect.width / 2 - width / 2, vw - width - MARGIN)),
  };
}

/**
 * Lay the tooltip out so ALL of its content is visible without scrolling (the page may
 * already be scrolled as far as it goes, and a hover tooltip cannot be scrolled):
 *  1. at its normal width, beside the anchor (below, above, right, left);
 *  2. wider, so the same text takes fewer lines, again beside the anchor;
 *  3. at the widest width that fits the screen, fully on screen even if it covers the anchor;
 *  4. the same with compact text;
 *  5. only if it is still taller than the screen, capped to the screen and scrollable
 *     (the tooltip then takes the pointer so it can actually be scrolled).
 * The tooltip's real rendered size is measured at each step.
 */
function layout(el: HTMLElement, anchorEl: HTMLElement): void {
  const rect = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxWidth = Math.max(160, vw - 2 * MARGIN);
  el.style.maxHeight = '';
  el.style.maxWidth = '';
  el.classList.remove(styles.compact, styles.scrollable);

  const place = (p: Placement) => {
    el.style.top = `${p.top}px`;
    el.style.left = `${p.left}px`;
  };
  const tryWidth = (w: number): Placement | null => {
    el.style.maxWidth = `${Math.min(w, maxWidth)}px`;
    return besideAnchor(rect, el.offsetWidth, el.offsetHeight);
  };

  for (const w of WIDTHS) {
    const p = tryWidth(w);
    if (p) return place(p);
    if (w >= maxWidth) break;
  }

  const widest = Math.min(WIDTHS[WIDTHS.length - 1], maxWidth);
  el.style.maxWidth = `${widest}px`;
  if (el.offsetHeight <= vh - 2 * MARGIN) return place(onScreen(rect, el.offsetWidth, el.offsetHeight));

  el.classList.add(styles.compact);
  if (el.offsetHeight <= vh - 2 * MARGIN) return place(onScreen(rect, el.offsetWidth, el.offsetHeight));

  el.classList.add(styles.scrollable);
  el.style.maxHeight = `${vh - 2 * MARGIN}px`;
  place(onScreen(rect, el.offsetWidth, vh - 2 * MARGIN));
}

export function Tooltip({ anchorEl, title, children, onClose, id }: TooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Lay out from the real rendered size before the browser paints (no flash at the
  // wrong spot). Written straight to the element, not through state, so a re-render
  // can never overwrite the measured placement with a stale estimate.
  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (el) layout(el, anchorEl);
  }, [anchorEl, title, children]);

  // Re-lay out when the window size changes while it is open.
  useEffect(() => {
    const onResize = () => {
      if (tooltipRef.current) layout(tooltipRef.current, anchorEl);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [anchorEl]);

  // Auto-focus on mount
  useEffect(() => {
    tooltipRef.current?.focus();
  }, []);

  // Dismiss on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  // Dismiss on mousedown outside
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleKeyDown, handleMouseDown]);

  return createPortal(
    <div
      ref={tooltipRef}
      id={id}
      role="tooltip"
      tabIndex={-1}
      className={styles.tooltip}
    >
      <div className={styles.title}>{title}</div>
      <div className={styles.body}>{children}</div>
    </div>,
    document.body,
  );
}
