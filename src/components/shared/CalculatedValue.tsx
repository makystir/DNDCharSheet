import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import { formatBreakdown, formatEquation } from '../../logic/breakdown';
import type { Breakdown } from '../../logic/breakdown';
import styles from './CalculatedValue.module.css';

export interface CalculatedValueProps {
  /** Tooltip heading, e.g. "Strength Modifier". */
  label: string;
  /** The breakdown describing how the displayed value was produced. */
  breakdown: Breakdown;
  /** What to render as the visible value. Defaults to the breakdown total. */
  children?: ReactNode;
  /** Optional extra className for the trigger element. */
  className?: string;
}

/**
 * Renders a calculated total as an interactive trigger that reveals a
 * breakdown Tooltip. Opens on hover/focus (desktop) and tap (touch), per the
 * calculated-totals steering rule. Every derived number in the UI should be
 * presented through this component so its derivation is always explainable.
 */
export function CalculatedValue({
  label,
  breakdown,
  children,
  className,
}: CalculatedValueProps) {
  // Track the trigger element in state (not just a ref) so it can be used as a
  // reactive anchor for the Tooltip without reading a ref during render.
  const [triggerEl, setTriggerEl] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  const show = () => setOpen(true);
  const hide = () => setOpen(false);
  const toggle = () => setOpen((v) => !v);

  const rows = breakdown.components.map((c, i) => (
    <div key={i} className={styles.row}>
      <span className={styles.rowLabel}>{c.label}</span>
      <span className={styles.rowValue}>{c.value}</span>
    </div>
  ));

  return (
    <>
      <button
        ref={setTriggerEl}
        type="button"
        className={`${styles.trigger}${className ? ` ${className}` : ''}`}
        aria-describedby={open ? tooltipId : undefined}
        aria-label={`${label}: ${formatBreakdown(breakdown)}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={toggle}
      >
        {children ?? breakdown.total}
      </button>
      {open && triggerEl && (
        <Tooltip
          id={tooltipId}
          anchorEl={triggerEl}
          title={label}
          onClose={hide}
        >
          <div className={styles.rows}>{rows}</div>
          <div className={styles.formula}>{formatEquation(breakdown)}</div>
          {breakdown.note && <div className={styles.note}>{breakdown.note}</div>}
        </Tooltip>
      )}
    </>
  );
}
