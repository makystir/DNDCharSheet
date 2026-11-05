import type { Breakdown } from '../../logic/breakdown';
import type { RollEventPayload } from '../../types/character';
import { CalculatedValue } from './CalculatedValue';
import styles from './RollResultDisplay.module.css';

interface RollResultDisplayProps {
  /** The resolved roll payload. */
  payload: RollEventPayload;
  /**
   * The breakdown that produced the total (kept die + modifiers + exhaustion),
   * shown through CalculatedValue so the components are visible on hover/tap.
   */
  breakdown: Breakdown;
}

const MODE_LABEL: Record<RollEventPayload['mode'], string> = {
  normal: 'Normal',
  advantage: 'Advantage',
  disadvantage: 'Disadvantage',
};

/**
 * Displays a resolved d20 roll (Stage B7): the total (via CalculatedValue), the
 * kept natural die, the roll mode, and — when a DC/AC was given — the hit/miss
 * verdict, plus crit/fumble markers.
 *
 * RULES (PHB 2024 "D20 Tests", Docs/PlayersHandbook.md L364): the test succeeds
 * (hit) when the total EQUALS OR EXCEEDS the DC/AC. A natural 20 is a crit and a
 * natural 1 is a fumble, both judged on the kept die (L457-461).
 */
export function RollResultDisplay({ payload, breakdown }: RollResultDisplayProps) {
  const { name, natural, mode, dc, isCrit, isFumble, passed } = payload;
  return (
    <div className={styles.result} role="status" aria-live="polite">
      <div className={styles.totalRow}>
        <span className={styles.label}>Total</span>
        <span className={styles.total} data-testid="roll-result-total">
          <CalculatedValue label={`${name} total`} breakdown={breakdown} />
        </span>
      </div>
      <div className={styles.meta}>
        <span className={styles.die} data-testid="roll-result-die">
          d20: {natural}
        </span>
        {mode !== 'normal' && <span className={styles.modeTag}>{MODE_LABEL[mode]}</span>}
      </div>
      {dc !== undefined && (
        <div
          className={`${styles.verdict} ${passed ? styles.pass : styles.fail}`}
          data-testid="roll-result-verdict"
        >
          vs DC {dc} — {passed ? 'hit' : 'miss'}
        </div>
      )}
      {isCrit && <div className={styles.crit}>Critical!</div>}
      {isFumble && <div className={styles.fumble}>Fumble!</div>}
    </div>
  );
}
