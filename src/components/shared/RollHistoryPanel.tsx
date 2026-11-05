import { useState } from 'react';
import type { Breakdown } from '../../logic/breakdown';
import { CalculatedValue } from './CalculatedValue';
import type { RollHistoryEntry } from './rollHistoryAdapter';
import styles from './RollHistoryPanel.module.css';

interface RollHistoryPanelProps {
  history: RollHistoryEntry[];
  onClear: () => void;
  defaultExpanded?: boolean;
}

const MODE_TAG: Record<RollHistoryEntry['mode'], string> = {
  normal: '',
  advantage: 'adv',
  disadvantage: 'dis',
};

/**
 * Build a Breakdown for the roll total so the calculated-totals rule is honoured
 * in the history list: the tooltip shows `kept die (+ adjustments) = total`.
 * The exact per-source modifier components are not persisted in the log payload,
 * so the adjustment is shown as a single derived line (total − natural) labelled
 * "Modifiers & effects"; the kept die and the total are always named.
 */
function totalBreakdown(entry: RollHistoryEntry): Breakdown {
  const adjustment = entry.total - entry.natural;
  return {
    total: entry.total,
    components: [
      { label: 'd20 (kept)', value: entry.natural },
      { label: 'Modifiers & effects', value: adjustment },
    ],
  };
}

/**
 * Roll history list (Stage B7). Collapsible, newest-first. Each entry shows the
 * name, the kept d20, the total (through CalculatedValue so its breakdown shows
 * on hover/tap), the Advantage/Disadvantage tag, and the hit/miss vs DC with
 * crit/fumble markers.
 */
export function RollHistoryPanel({ history, onClear, defaultExpanded = false }: RollHistoryPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={styles.panel}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls="roll-history-body"
      >
        <span>Roll History ({history.length})</span>
        <span className={expanded ? styles.chevronExpanded : styles.chevron} aria-hidden="true">
          ▼
        </span>
      </button>

      {expanded && (
        <div id="roll-history-body" className={styles.body}>
          {history.length === 0 ? (
            <div className={styles.emptyMessage}>No rolls yet</div>
          ) : (
            <>
              {history.map((entry) => {
                const modeTag = MODE_TAG[entry.mode];
                const outcomeClass = entry.passed
                  ? styles.passColor
                  : entry.passed === false
                    ? styles.failColor
                    : '';
                return (
                  <div key={entry.id} className={styles.entry}>
                    <span className={styles.rollName}>{entry.name}</span>
                    <span className={styles.die} title={`Kept d20: ${entry.natural}`}>
                      {entry.natural}
                    </span>
                    <span className={styles.total}>
                      <CalculatedValue label={`${entry.name} total`} breakdown={totalBreakdown(entry)} />
                    </span>
                    {modeTag && <span className={styles.modeTag}>{modeTag}</span>}
                    {entry.dc !== undefined && (
                      <span className={`${styles.outcome} ${outcomeClass}`}>
                        DC {entry.dc} {entry.passed ? '✓' : '✗'}
                      </span>
                    )}
                    {entry.isCrit && <span className={styles.crit}>crit!</span>}
                    {entry.isFumble && <span className={styles.fumble}>fumble!</span>}
                  </div>
                );
              })}
              <button type="button" className={styles.clearBtn} onClick={onClear}>
                Clear History
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
