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
  /** Set when neither side has room for the whole tooltip, so it scrolls instead of covering the anchor. */
  maxHeight?: number;
}

/**
 * Place the tooltip beside its anchor using the tooltip's MEASURED size. It goes
 * below the anchor when it fits, otherwise above, otherwise on the side with more
 * room with a capped height. It must never overlap the anchor: a tooltip that sits
 * under the cursor steals the hover, hides, and reappears in a rapid flicker.
 */
function computePlacement(anchorEl: HTMLElement, width: number, height: number): Placement {
  const rect = anchorEl.getBoundingClientRect();
  const margin = 8;
  const gap = 6;
  const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;

  let top: number;
  let maxHeight: number | undefined;
  if (height <= spaceBelow) {
    top = rect.bottom + gap;
  } else if (height <= spaceAbove) {
    top = rect.top - gap - height;
  } else if (spaceBelow >= spaceAbove) {
    top = rect.bottom + gap;
    maxHeight = Math.max(spaceBelow, 80);
  } else {
    maxHeight = Math.max(spaceAbove, 80);
    top = rect.top - gap - maxHeight;
  }

  // Horizontal: center on the anchor, clamp to the viewport.
  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
  return { top, left, ...(maxHeight !== undefined ? { maxHeight } : {}) };
}

export function Tooltip({ anchorEl, title, children, onClose, id }: TooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Position from the real rendered size before the browser paints (no flash at the
  // wrong spot). Written straight to the element, not through state, so a re-render
  // can never overwrite the measured placement with a stale estimate.
  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    el.style.maxHeight = '';
    const placement = computePlacement(anchorEl, el.offsetWidth, el.offsetHeight);
    el.style.top = `${placement.top}px`;
    el.style.left = `${placement.left}px`;
    if (placement.maxHeight !== undefined) el.style.maxHeight = `${placement.maxHeight}px`;
  }, [anchorEl, title, children]);
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
