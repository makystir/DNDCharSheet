import type { EncumbranceLevel } from '../../logic/encumbrance';
import styles from './ProgressBar.module.css';

export interface ProgressBarProps {
  current: number;
  max: number;
  level: EncumbranceLevel;
  label: string;
  ariaLabel: string;
}

/**
 * Horizontal progress/severity bar.
 *
 * Ported from PWACharSheet's src/components/shared/ProgressBar.tsx (ui-parity:
 * same label row + track + fill structure, same role="progressbar" ARIA). The
 * fill-colour map is retargeted to the D&D EncumbranceLevel union
 * ('neutral' | 'over' | 'encumbered' | 'heavilyEncumbered') — RAW 2024 is
 * binary (neutral/over); the two variant bands are only reachable under the
 * opt-in house rule (see logic/encumbrance.getEncumbranceLevel).
 */
const fillClassByLevel: Record<EncumbranceLevel, string> = {
  neutral: styles.fillNeutral,
  encumbered: styles.fillWarning,
  heavilyEncumbered: styles.fillDanger,
  over: styles.fillCritical,
};

export function ProgressBar({ current, max, level, label, ariaLabel }: ProgressBarProps) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 100;

  return (
    <div className={styles.container}>
      <div className={styles.labelRow}>
        <span>{label}</span>
        {level === 'over' && <span className={styles.overEncumbered}>Over capacity</span>}
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className={fillClassByLevel[level]} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
