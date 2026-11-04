import type { CurrencyAmount } from '../../logic/currency';
import { coinWeightLb, totalCoins } from '../../logic/encumbrance';
import styles from './CoinWeightBreakdownContent.module.css';

export interface CoinWeightBreakdownContentProps {
  /** The coin purse whose weight is broken down. */
  coins: CurrencyAmount;
}

/**
 * Tooltip body for the coin-weight total.
 *
 * Ported from PWACharSheet's CoinWeightBreakdownContent (ui-parity: the same
 * labelled per-denomination rows → sum → "÷ N" divider → separator → weight
 * total). Recomputed for D&D: five denominations PP/GP/EP/SP/CP and the PHB
 * 2024 ÷ 50 conversion (50 coins = 1 lb, Docs/PlayersHandbook.md L9266) instead
 * of WFRP's three coins and ÷ 200.
 *
 * This is the tooltip BODY only; where it is surfaced on-screen is A3's job.
 */
export function CoinWeightBreakdownContent({ coins }: CoinWeightBreakdownContentProps) {
  const sum = totalCoins(coins);
  const weight = coinWeightLb(coins);

  return (
    <div>
      {/* calculated-totals: show every component including zeros, so even an
          empty purse's displayed 0 lb total is fully explained. The empty-state
          message is additive context, not a replacement for the breakdown. */}
      {sum === 0 && <div className={styles.emptyMessage}>No coins carried</div>}
      <div className={styles.row}>
        <span className={styles.label}>PP:</span>
        <span className={styles.value}>{coins.pp}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>GP:</span>
        <span className={styles.value}>{coins.gp}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>EP:</span>
        <span className={styles.value}>{coins.ep}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>SP:</span>
        <span className={styles.value}>{coins.sp}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>CP:</span>
        <span className={styles.value}>{coins.cp}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Sum:</span>
        <span className={styles.value}>{sum}</span>
      </div>
      <div className={styles.dividerRow}>÷ 50 (50 coins = 1 lb)</div>
      <hr className={styles.separator} />
      <div className={styles.totalRow}>
        <span>Weight:</span>
        <span>{weight} lb</span>
      </div>
    </div>
  );
}
