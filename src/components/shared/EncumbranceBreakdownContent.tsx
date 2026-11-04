import styles from './EncumbranceBreakdownContent.module.css';

export interface EncumbranceBreakdownContentProps {
  /** Strength score (the carrying-capacity multiplicand). */
  strengthScore: number;
  /** Size multiplier (Small/Medium = 15 — PHB 2024 "Carrying Capacity"). */
  multiplier: number;
  /** Human-readable size label, e.g. "Small/Medium". */
  sizeLabel: string;
  /** The resulting carrying capacity in pounds (Str × multiplier). */
  total: number;
}

/**
 * Tooltip body for the carrying-capacity (max encumbrance) total.
 *
 * Ported from PWACharSheet's EncumbranceBreakdownContent (ui-parity: the same
 * labelled-row list + separator + bold total row). Recomputed for D&D: carrying
 * capacity is Strength × size multiplier (PHB 2024 "Carrying Capacity",
 * Docs/PlayersHandbook.md L20757), so the WFRP SB / TB / Strong Back / Sturdy
 * rows are dropped and replaced by a Strength row, a multiplier row, and the
 * product in the total.
 *
 * Because capacity is a PRODUCT not a sum, the rows show the multiplicands and
 * the total is the product (the "×" is spelled out in the multiplier row
 * label), mirroring how the carryingCapacityBreakdown models it (single
 * component + note). This is the tooltip BODY only; A3 places it on-screen.
 */
export function EncumbranceBreakdownContent({
  strengthScore,
  multiplier,
  sizeLabel,
  total,
}: EncumbranceBreakdownContentProps) {
  return (
    <div>
      <div className={styles.row}>
        <span className={styles.label}>Strength:</span>
        <span className={styles.value}>{strengthScore}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>× multiplier ({sizeLabel}):</span>
        <span className={styles.value}>{multiplier}</span>
      </div>
      <hr className={styles.separator} />
      <div className={styles.totalRow}>
        <span>Capacity:</span>
        <span>{total} lb</span>
      </div>
      <div className={styles.note}>
        Strength {strengthScore} × {multiplier} ({sizeLabel}) = {total} lb
      </div>
    </div>
  );
}
