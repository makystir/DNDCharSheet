import { LayoutGrid, List } from 'lucide-react';
import type { ViewMode } from '../../hooks/useViewMode';
import styles from './ViewModeToggle.module.css';

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** Accessible group label, e.g. "Gear view". */
  label: string;
}

/**
 * Small segmented control to switch a section between detailed cards and a
 * compact list. Ported from PWACharSheet's ViewModeToggle (ui-parity);
 * persistence is handled by the owner via `useViewMode`. Presentational
 * radiogroup.
 */
export function ViewModeToggle({ mode, onChange, label }: ViewModeToggleProps) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={label}>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'cards'}
        aria-label="Card view"
        title="Card view"
        className={mode === 'cards' ? styles.btnActive : styles.btn}
        onClick={() => onChange('cards')}
      >
        <LayoutGrid size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'list'}
        aria-label="List view"
        title="List view"
        className={mode === 'list' ? styles.btnActive : styles.btn}
        onClick={() => onChange('list')}
      >
        <List size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
