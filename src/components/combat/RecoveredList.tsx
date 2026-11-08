import type { ResourceRecovery } from '../../logic/resources';
import styles from './Rests.module.css';

export interface RecoveredListProps {
  recovered: ResourceRecovery[];
  testId: string;
}

/**
 * Limited-use features a rest gives back (D1): "Name: before -> after of max".
 * The values are the logic layer's `resourcesRecovered` output; nothing is
 * computed here.
 */
export function RecoveredList({ recovered, testId }: RecoveredListProps) {
  return (
    <div data-testid={testId}>
      <p className={styles.muted}>Features recovered</p>
      <ul className={styles.resetList} aria-label="Features recovered">
        {recovered.map((r) => (
          <li key={r.id}>
            {r.name}: {r.before} {'->'} {r.after} of {r.max}
            {r.rule === 'one' ? ' (regain one)' : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
