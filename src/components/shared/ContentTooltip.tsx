import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import type { TooltipContent } from '../../logic/tooltip-content';
import styles from './ContentTooltip.module.css';

export interface ContentTooltipProps {
  /** The structured content to render (A1 resolver output). */
  content: TooltipContent;
  /** The visible trigger (e.g. a weapon name or a property chip). */
  children: ReactNode;
  /** Optional extra className for the trigger element. */
  className?: string;
}

/**
 * Renders an A1 tooltip-content resolver's output (title + labelled sections)
 * through the shared Tooltip, as an interactive trigger that opens on
 * hover/focus (desktop) and tap (touch) — the activation parity the
 * content-tooltips steering rule requires.
 *
 * This mirrors CalculatedValue's trigger/anchor pattern, but renders descriptive
 * TooltipContent sections instead of a numeric Breakdown, so weapon/armor/item
 * cards and property chips can surface the A1 catalog descriptions.
 */
export function ContentTooltip({ content, children, className }: ContentTooltipProps) {
  const [triggerEl, setTriggerEl] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  const show = () => setOpen(true);
  const hide = () => setOpen(false);
  const toggle = () => setOpen((v) => !v);

  return (
    <>
      <button
        ref={setTriggerEl}
        type="button"
        className={`${styles.trigger}${className ? ` ${className}` : ''}`}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={toggle}
      >
        {children}
      </button>
      {open && triggerEl && (
        <Tooltip id={tooltipId} anchorEl={triggerEl} title={content.title} onClose={hide}>
          <div className={styles.sections}>
            {content.sections.map((s, i) => (
              <div key={i} className={styles.section}>
                <span className={styles.sectionLabel}>{s.label}</span>
                <span className={styles.sectionText}>{s.text}</span>
              </div>
            ))}
          </div>
        </Tooltip>
      )}
    </>
  );
}
