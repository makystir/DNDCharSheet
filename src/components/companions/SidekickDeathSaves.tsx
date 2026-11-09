import { deathSaveAdvance } from '../../logic/hit-points-state';
import type { DeathSaveOutcomeKind } from '../../logic/hit-points-state';
import type { SidekickRecord } from '../../types/character';
import styles from './CompanionsShared.module.css';

export interface SidekickDeathSavesProps {
  record: SidekickRecord;
  subject: string;
  onPatch: (patch: Partial<SidekickRecord>) => void;
}

const BUTTONS: { outcome: DeathSaveOutcomeKind; label: string }[] = [
  { outcome: 'success', label: 'Success (10+)' },
  { outcome: 'failure', label: 'Failure (9 or less)' },
  { outcome: 'critical-failure', label: 'Natural 1 (2 failures)' },
  { outcome: 'regain-hp', label: 'Natural 20 (regain 1 HP)' },
];

/**
 * Death saves for a sidekick at 0 HP, "like a player character". The shared
 * DeathSavesCard needs a whole Character, so this reuses the pure rules
 * (deathSaveAdvance) with record buttons: the user rolls and records the result.
 * Tasha's 2020 (5e, 2014 rules) sidekicks follow the death saving throw rules.
 */
export function SidekickDeathSaves({ record, subject, onPatch }: SidekickDeathSavesProps) {
  const saves = record.deathSaves ?? { successes: 0, failures: 0 };
  const apply = (outcome: DeathSaveOutcomeKind) => {
    const next = deathSaveAdvance(saves, outcome);
    const hasCounts = next.saves.successes > 0 || next.saves.failures > 0;
    onPatch({
      deathSaves: hasCounts ? next.saves : undefined,
      stable: next.stable ? true : undefined,
      dead: next.dead ? true : undefined,
      ...(outcome === 'regain-hp' ? { hp: next.hp } : {}),
    });
  };
  const reset = () => onPatch({ deathSaves: undefined, stable: undefined, dead: undefined });

  return (
    <div className={styles.body} role="group" aria-label={`${subject} death saves`}>
      <p className={styles.figure} aria-live="polite">
        {`Death saves: ${saves.successes} successes, ${saves.failures} failures`}
        {record.stable && ' (Stable)'}
        {record.dead && ' (Dead)'}
      </p>
      <div className={styles.inline}>
        {BUTTONS.map((b) => (
          <button key={b.outcome} type="button" className={styles.btn} disabled={record.dead === true || record.stable === true} onClick={() => apply(b.outcome)}>
            {b.label}
          </button>
        ))}
        <button type="button" className={styles.btn} onClick={reset}>
          Reset death saves
        </button>
      </div>
    </div>
  );
}
