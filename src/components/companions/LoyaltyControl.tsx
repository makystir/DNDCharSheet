import { useState } from 'react';
import type { Breakdown } from '../../logic/breakdown';
import {
  adjustLoyalty,
  clampLoyalty,
  effectiveLoyalty,
  LOYALTY_CHANGES,
  LOYALTY_MAX,
  LOYALTY_MIN,
  loyaltyBand,
  loyaltyStart,
} from '../../logic/companions';
import type { LoyaltyBand } from '../../logic/companions';
import { rollDice } from '../../logic/dice';
import { createDefaultRng } from '../../logic/random';
import type { RNG } from '../../logic/random';
import { resolveCompanionRuleTooltip } from '../../logic/tooltip-content';
import { CalculatedValue } from '../shared/CalculatedValue';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import styles from './CompanionsShared.module.css';

const BAND_LABELS: Record<LoyaltyBand, string> = {
  'risks-anything': 'Risks anything for the party',
  tenuous: 'Tenuously faithful',
  disloyal: 'No longer acts in the party\u2019s interest',
};

export interface LoyaltyControlProps {
  /** Stored score; undefined = still at the starting value (half the maximum). */
  score: number | undefined;
  /** Party-wide maximum (highest Charisma, or the override). */
  max: number;
  subject: string;
  onChange: (score: number) => void;
  /** Random source for the optional 1d4 / 2d4 rolls (injected in tests). */
  rng?: RNG;
}

/**
 * Optional DMG Loyalty Score (0-20) for a hireling or NPC party member. Shown
 * only while the `loyalty` house rule is on (the caller gates it). The user can
 * type the score, or roll the book's 1d4 / 2d4 changes; the result is always
 * clamped between 0 and the maximum. DMG 2024 "Loyalty" (L3572-3584).
 */
export function LoyaltyControl({ score, max, subject, onChange, rng }: LoyaltyControlProps) {
  const [lastRoll, setLastRoll] = useState('');
  const current = effectiveLoyalty(score, max);
  const band = loyaltyBand(current);

  const roll = (change: (typeof LOYALTY_CHANGES)[number]) => {
    const result = rollDice(change.dice, rng ?? createDefaultRng());
    const delta = change.sign * result.total;
    const next = adjustLoyalty(current, delta, max);
    setLastRoll(`Rolled ${change.dice}: ${result.total}. Loyalty ${delta >= 0 ? '+' : ''}${delta}, now ${next}.`);
    onChange(next);
  };

  return (
    <div className={styles.row} data-testid="loyalty-control">
      <label className={styles.field}>
        {`Loyalty Score (${LOYALTY_MIN}-${max})`}
        <input
          type="number"
          className={`${styles.control} ${styles.controlNarrow}`}
          min={LOYALTY_MIN}
          max={max}
          value={current}
          aria-label={`${subject} Loyalty Score`}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n)) onChange(clampLoyalty(n, max));
          }}
        />
      </label>
      <span className={styles.figure}>
        <MaybeContentTooltip content={resolveCompanionRuleTooltip('loyalty-bands')} className={styles.chip}>
          {BAND_LABELS[band]}
        </MaybeContentTooltip>
        <span className={styles.figureLabel}>Starts at {loyaltyStart(max)}</span>
      </span>
      <div className={styles.inline} role="group" aria-label={`${subject} Loyalty changes`}>
        {LOYALTY_CHANGES.map((change) => (
          <button key={change.id} type="button" className={styles.btn} onClick={() => roll(change)}>
            {`${change.label} (${change.sign > 0 ? '+' : '-'}${change.dice})`}
          </button>
        ))}
      </div>
      <p className={styles.hint} aria-live="polite" hidden={lastRoll === ''}>
        {lastRoll}
      </p>
    </div>
  );
}

export interface LoyaltyMaximumFieldProps {
  max: number;
  breakdown: Breakdown;
  override: number | undefined;
  onOverride: (value: number | undefined) => void;
}

/**
 * The party-wide Loyalty maximum: the highest Charisma score in the party. On a
 * single-character sheet that is this character's Charisma; the user can
 * override it (another party member may have a higher score).
 */
export function LoyaltyMaximumField({ max, breakdown, override, onOverride }: LoyaltyMaximumFieldProps) {
  return (
    <div className={styles.summary} data-testid="loyalty-maximum">
      <span className={styles.summaryTitle}>
        <MaybeContentTooltip content={resolveCompanionRuleTooltip('loyalty-score')}>Loyalty maximum</MaybeContentTooltip>
      </span>
      <CalculatedValue label="Loyalty maximum" breakdown={breakdown}>
        {max}
      </CalculatedValue>
      <label className={styles.checkLabel}>
        Highest party Charisma override
        <input
          type="number"
          className={`${styles.control} ${styles.controlNarrow}`}
          min={LOYALTY_MIN}
          max={LOYALTY_MAX}
          value={override ?? ''}
          placeholder="Auto"
          aria-label="Loyalty maximum override"
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              onOverride(undefined);
              return;
            }
            const n = Number.parseInt(raw, 10);
            if (Number.isFinite(n)) onOverride(n);
          }}
        />
      </label>
    </div>
  );
}
