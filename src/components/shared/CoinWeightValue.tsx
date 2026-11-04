import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import { CoinWeightBreakdownContent } from './CoinWeightBreakdownContent';
import type { CurrencyAmount } from '../../logic/currency';
import styles from './CalculatedValue.module.css';

export interface CoinWeightValueProps {
  /** The coin purse whose weight is displayed and broken down. */
  coins: CurrencyAmount;
  /** What to render as the visible value (defaults to the caller's children). */
  children: ReactNode;
  /** Optional extra className for the trigger element. */
  className?: string;
}

/**
 * Renders the coin-weight total as an interactive trigger that reveals the
 * per-denomination coin-weight breakdown through the shared Tooltip (finding
 * #1). Opens on hover/focus (desktop) and tap (touch), matching CalculatedValue
 * — but the body is CoinWeightBreakdownContent (PP/GP/EP/SP/CP counts incl.
 * zeros, the sum, the ÷ 50 formula, and the resulting weight) rather than a bare
 * numeric Breakdown, so the whole calculation lives in the tooltip and nothing
 * is rendered as an always-visible static panel.
 */
export function CoinWeightValue({ coins, children, className }: CoinWeightValueProps) {
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
        <Tooltip id={tooltipId} anchorEl={triggerEl} title="Coin weight" onClose={hide}>
          <CoinWeightBreakdownContent coins={coins} />
        </Tooltip>
      )}
    </>
  );
}
