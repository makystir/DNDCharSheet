import { Heart, Shield } from 'lucide-react';
import type { Breakdown } from '../../logic/breakdown';
import type { Character } from '../../types/character';
import {
  effectiveHp,
  hitPointMaxOf,
  effectiveTempHp,
  currentHpBreakdown,
  characterHitPointMaxBreakdown,
} from '../../logic/hit-points-state';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './CombatCompactBar.module.css';

export interface CombatCompactBarProps {
  character: Character;
  /** The resolved AC breakdown (computed once on the page and passed in). */
  acBreakdown: Breakdown;
}

/**
 * A compact, sticky HP / AC strip for mobile and tablet while in combat,
 * mirroring PWACharSheet's CombatDashboardCompact (a small always-visible
 * heart + current / max readout). Parity note: the PWA strip also carries
 * Advantage and round controls; the D&D version keeps only the read-only HP
 * and AC glance (the full controls live in the HP card and Core Stats below),
 * which is the "keep it simple" scope for this stage.
 *
 * Read-only: it computes no rule. HP comes from `effectiveHp` / `hitPointMaxOf`
 * / `effectiveTempHp` (A5a) and AC is the page's already-resolved breakdown.
 */
export function CombatCompactBar({ character, acBreakdown }: CombatCompactBarProps) {
  const hp = effectiveHp(character);
  const max = hitPointMaxOf(character);
  const temp = effectiveTempHp(character);
  const currentBreakdown = currentHpBreakdown(character);

  return (
    <div className={styles.bar} role="status" aria-label="Combat summary">
      <span className={styles.stat}>
        <Heart size={16} aria-hidden="true" className={styles.icon} />
        {/* Derived HP totals carry their breakdown tooltip (calculated-totals):
            current HP and max HP are each wrapped in CalculatedValue, matching
            how HitPointsCard presents them. */}
        <span className={styles.value} data-testid="compact-hp">
          {max === undefined || currentBreakdown === undefined ? (
            '—'
          ) : (
            <>
              <CalculatedValue label="Current HP" breakdown={currentBreakdown}>
                {hp ?? 0}
              </CalculatedValue>
              <span className={styles.slash} aria-hidden="true">
                {' / '}
              </span>
              <CalculatedValue label="Max HP" breakdown={characterHitPointMaxBreakdown(character)}>
                {max}
              </CalculatedValue>
            </>
          )}
        </span>
        {temp > 0 && <span className={styles.temp} data-testid="compact-temp">+{temp}</span>}
        <span className={styles.srLabel}>Hit Points</span>
      </span>
      <span className={styles.stat}>
        <Shield size={16} aria-hidden="true" className={styles.icon} />
        {/* AC is a derived total, so it carries the full AC breakdown tooltip. */}
        <span className={styles.value} data-testid="compact-ac">
          <CalculatedValue label="Armor Class" breakdown={acBreakdown}>
            {acBreakdown.total}
          </CalculatedValue>
        </span>
        <span className={styles.srLabel}>Armor Class</span>
      </span>
    </div>
  );
}
