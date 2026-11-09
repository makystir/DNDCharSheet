import { useState } from 'react';
import type { CSSProperties } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { TrackedCreature } from '../../types/character';
import type { Breakdown } from '../../logic/breakdown';
import { CONDITION_COLORS, CONDITION_COLOR_FALLBACK, EXHAUSTION, getCondition } from '../../data/conditions';
import type { ConditionId } from '../../data/conditions';
import {
  addConditionPatch,
  damagePatch,
  fullHealPatch,
  healPatch,
  removeConditionPatch,
  tempHpPatch,
  trackedHpOf,
} from '../../logic/companions-actions';
import { isAtZeroHp } from '../../logic/companions';
import {
  resolveCompanionRuleTooltip,
  resolveConditionTooltip,
  resolveExhaustionLevelTooltip,
} from '../../logic/tooltip-content';
import type { CompanionRuleTooltipKey } from '../../logic/tooltip-content';
import { CalculatedValue } from '../shared/CalculatedValue';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import { ConditionPicker } from '../combat/ConditionPicker';
import styles from './TrackedVitals.module.css';

export interface TrackedVitalsProps {
  /** The tracked fields of the record (hp, tempHp, conditions, exhaustionLevel). */
  record: TrackedCreature;
  /** Hit point maximum; null when it cannot be determined (no HP controls then). */
  max: number | null;
  /** Explains the maximum when it is derived (rendered as a CalculatedValue). */
  maxBreakdown?: Breakdown;
  /** Name used to label the controls for assistive technology. */
  subject: string;
  /** Which rule note explains 0 HP for this record. */
  zeroHpRule: CompanionRuleTooltipKey;
  /** Merge a patch into the record (`undefined` values delete the field). */
  onPatch: (patch: Partial<TrackedCreature>) => void;
}

function hpColor(pct: number): string {
  if (pct > 50) return 'var(--success)';
  if (pct > 20) return 'var(--accent-gold)';
  return 'var(--accent-red)';
}

function parseAmount(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * HP, temporary HP and condition tracking shared by every tracked creature on
 * the Companions page. Presentation follows the WFRP HirelingCard wound bar
 * (colour-coded progress bar, minus/plus/Full controls), adapted to D&D:
 * Hit Points with temporary Hit Points, one amount input with Damage / Heal /
 * Temp HP buttons, and conditions from the app's condition catalog (the
 * existing ConditionPicker). The 0 HP rule is tooltip text only; nothing is
 * automated.
 */
export function TrackedVitals({ record, max, maxBreakdown, subject, zeroHpRule, onPatch }: TrackedVitalsProps) {
  const [amount, setAmount] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const conditions = (record.conditions ?? []).filter((c, i, arr) => arr.findIndex((o) => o.id === c.id) === i);
  const exhaustion = record.exhaustionLevel ?? 0;

  const hasMax = max !== null;
  const cur = hasMax ? trackedHpOf(record, max) : 0;
  const temp = record.tempHp ?? 0;
  const pct = hasMax && max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  const atZero = hasMax && isAtZeroHp(cur);
  const amt = parseAmount(amount);

  const badgeStyle = (id: ConditionId): CSSProperties => {
    const c = CONDITION_COLORS[id] ?? CONDITION_COLOR_FALLBACK;
    return { backgroundColor: c.bg, color: c.text, borderColor: c.bg };
  };

  const apply = (patch: Partial<TrackedCreature>) => {
    onPatch(patch);
    setAmount('');
  };

  return (
    <div className={styles.vitals} data-testid="tracked-vitals">
      {hasMax ? (
        <>
          <div className={styles.hpRow}>
            <span className={styles.hpLabel}>Hit Points</span>
            <div className={styles.track} aria-hidden="true">
              <div className={styles.fill} style={{ width: `${pct}%`, background: hpColor(pct) }} />
            </div>
            <span className={styles.hpCount} aria-label={`${subject} hit points ${cur} of ${max}`}>
              {cur}/
              {maxBreakdown ? (
                <CalculatedValue label={`${subject} Hit Points maximum`} breakdown={maxBreakdown}>
                  {max}
                </CalculatedValue>
              ) : (
                max
              )}
            </span>
            {temp > 0 && <span className={styles.tempChip}>Temp {temp}</span>}
            {atZero && (
              <MaybeContentTooltip content={resolveCompanionRuleTooltip(zeroHpRule)} className={styles.zeroChip}>
                0 HP
              </MaybeContentTooltip>
            )}
          </div>
          <div className={styles.controls} role="group" aria-label={`${subject} hit point controls`}>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className={styles.amount}
              value={amount}
              placeholder="Amount"
              aria-label={`${subject} hit point amount`}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button type="button" className={styles.btnDamage} disabled={amt === 0} onClick={() => apply(damagePatch(record, max, amt))}>
              Damage
            </button>
            <button type="button" className={styles.btn} disabled={amt === 0} onClick={() => apply(healPatch(record, max, amt))}>
              Heal
            </button>
            <button type="button" className={styles.btn} disabled={amt === 0} onClick={() => apply(tempHpPatch(record, amt))}>
              Temp HP
            </button>
            <button type="button" className={styles.btn} onClick={() => onPatch(fullHealPatch())}>
              Full
            </button>
          </div>
        </>
      ) : (
        <p className={styles.hint}>Hit Points appear once the maximum can be calculated.</p>
      )}

      <div className={styles.conditionRow}>
        <span className={styles.hpLabel}>Conditions</span>
        <div className={styles.chips}>
          {conditions.map((cond) => {
            const data = getCondition(cond.id);
            const name = data?.name ?? cond.id;
            return (
              <span key={cond.id} className={styles.badge} style={badgeStyle(cond.id)}>
                <MaybeContentTooltip content={resolveConditionTooltip(cond.id)} className={styles.badgeName}>
                  {name}
                </MaybeContentTooltip>
                <button
                  type="button"
                  className={styles.removeBtn}
                  aria-label={`Remove ${name} from ${subject}`}
                  onClick={() => onPatch(removeConditionPatch(record, cond.id))}
                >
                  {'\u2715'}
                </button>
              </span>
            );
          })}
          {exhaustion > 0 && (
            <span className={styles.badge} style={badgeStyle('exhaustion')}>
              <MaybeContentTooltip content={resolveExhaustionLevelTooltip(exhaustion)} className={styles.badgeName}>
                {`Exhaustion (${exhaustion})`}
              </MaybeContentTooltip>
              <button
                type="button"
                className={styles.removeBtn}
                aria-label={`Remove Exhaustion from ${subject}`}
                onClick={() => onPatch(removeConditionPatch(record, 'exhaustion'))}
              >
                {'\u2715'}
              </button>
            </span>
          )}
          <button type="button" className={styles.btn} onClick={() => setPickerOpen(true)}>
            <AlertTriangle size={14} aria-hidden="true" /> Add condition
          </button>
        </div>
      </div>
      {exhaustion >= EXHAUSTION.deathLevel && (
        <p className={styles.fatal} role="alert">
          Exhaustion level {EXHAUSTION.deathLevel}: a creature with this level dies.
        </p>
      )}

      {pickerOpen && (
        <ConditionPicker
          conditions={conditions}
          exhaustionLevel={exhaustion}
          onApply={(id) => onPatch(addConditionPatch(record, id))}
          onRemove={(id) => onPatch(removeConditionPatch(record, id))}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
