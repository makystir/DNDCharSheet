import { useId, useState } from 'react';
import type { Character, ConditionDurationKind, ActiveCondition } from '../../types/character';
import { getCondition } from '../../data/conditions';
import {
  describeDuration,
  durationBreakdown,
  durationFromAmount,
  durationKindLabel,
  isTimed,
  isTimedKind,
  setConditionDuration,
  tickConditionManually,
} from '../../logic/condition-duration';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './ConditionDurationControl.module.css';

export interface ConditionDurationControlProps {
  character: Character;
  condition: ActiveCondition;
  onChange: (next: Character) => void;
}

const KINDS: ConditionDurationKind[] = [
  'rounds',
  'minutes',
  'hours',
  'short-rest',
  'long-rest',
  'concentration',
  'manual',
];

const UNIT: Partial<Record<ConditionDurationKind, string>> = {
  rounds: 'rounds',
  minutes: 'minutes (10 rounds each)',
  hours: 'hours (600 rounds each)',
};

/**
 * Editor for one active condition's structured duration (Stage E; Combat tab
 * only, the Overview mirror is read-only). Bookkeeping only: the PHB gives a
 * condition no generic duration, so the user picks one. Timed durations show the
 * remaining rounds as a calculated value with a breakdown, and a manual
 * "-1 round" button. All rules live in logic/condition-duration.ts.
 */
export function ConditionDurationControl({ character, condition, onChange }: ConditionDurationControlProps) {
  const name = getCondition(condition.id)?.name ?? condition.id;
  const duration = condition.duration;
  const selectId = useId();
  const amountId = useId();
  const [kind, setKind] = useState<ConditionDurationKind>('rounds');
  const [amount, setAmount] = useState('');
  const concentrating = character.concentration !== undefined;
  // The "While concentrating" option is disabled once concentration ends, so
  // fall back to Rounds rather than leave a disabled option selected.
  if (kind === 'concentration' && !concentrating) setKind('rounds');

  const timedKind = isTimedKind(kind);
  const parsed = Number(amount);
  const candidate = durationFromAmount(kind, timedKind ? parsed : undefined);
  const canSet = candidate !== undefined && (kind !== 'concentration' || concentrating);

  const breakdown = durationBreakdown(duration);
  const text = describeDuration(duration);

  return (
    <div className={styles.wrap} data-testid={`duration-${condition.id}`}>
      <div className={styles.current}>
        <span className={styles.label}>Duration</span>
        {duration && text ? (
          breakdown ? (
            <span className={styles.value} data-testid={`duration-remaining-${condition.id}`}>
              <CalculatedValue label={`${name} remaining rounds`} breakdown={breakdown}>
                {text}
              </CalculatedValue>
            </span>
          ) : (
            <span className={styles.value}>{text}</span>
          )
        ) : (
          <span className={styles.none}>No timer (use the note below)</span>
        )}
        {isTimed(duration) && (
          <button
            type="button"
            className={styles.btn}
            title="Take one round off this timer. It ends the condition when it reaches 0."
            aria-label={`Take one round off ${name}`}
            onClick={() => onChange(tickConditionManually(character, condition.id))}
          >
            {'\u22121 round'}
          </button>
        )}
        {duration && (
          <button
            type="button"
            className={styles.btn}
            aria-label={`Clear ${name} duration`}
            onClick={() => onChange(setConditionDuration(character, condition.id, undefined))}
          >
            Clear timer
          </button>
        )}
      </div>
      <div className={styles.setter}>
        <label htmlFor={selectId} className={styles.label}>
          Set duration
        </label>
        <select
          id={selectId}
          className={styles.input}
          value={kind}
          aria-label={`${name} duration kind`}
          onChange={(e) => setKind(e.target.value as ConditionDurationKind)}
        >
          {KINDS.map((k) => (
            <option key={k} value={k} disabled={k === 'concentration' && !concentrating}>
              {durationKindLabel(k)}
            </option>
          ))}
        </select>
        {timedKind && (
          <>
            <label htmlFor={amountId} className={styles.label}>
              {`Amount in ${UNIT[kind]}`}
            </label>
            <input
              id={amountId}
              className={styles.input}
              type="number"
              min={1}
              step={1}
              value={amount}
              aria-label={`${name} duration amount`}
              onChange={(e) => setAmount(e.target.value)}
            />
          </>
        )}
        <button
          type="button"
          className={styles.btn}
          disabled={!canSet}
          aria-label={`Set ${name} duration`}
          onClick={() => {
            if (!candidate) return;
            onChange(setConditionDuration(character, condition.id, candidate));
            setAmount('');
          }}
        >
          Set
        </button>
      </div>
    </div>
  );
}
