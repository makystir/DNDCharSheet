import type { SpellSchool } from '../../data/spells';
import type { SpellFilterState } from './spellFilter';
import { SCHOOL_LABELS } from './spellSchoolLabels';
import styles from './SpellFilterBar.module.css';

function levelOptionLabel(level: number): string {
  return level === 0 ? 'Cantrips' : `Level ${level}`;
}

export interface SpellFilterBarProps {
  value: SpellFilterState;
  onChange: (next: SpellFilterState) => void;
  /** Appended to the control aria-labels so several bars on a page stay distinguishable. */
  labelSuffix?: string;
}

/** Search box, Level and School selects and Ritual / Concentration toggles. */
export function SpellFilterBar({ value, onChange, labelSuffix = '' }: SpellFilterBarProps) {
  const sfx = labelSuffix ? ` ${labelSuffix}` : '';
  return (
    <div className={styles.filterRow}>
      <label className={`${styles.filterField} ${styles.searchField}`}>
        <span className={styles.fieldLabel}>Search</span>
        <input
          type="search"
          className={styles.searchInput}
          value={value.query}
          placeholder="Spell name or any word in its text"
          aria-label={`Search spells${sfx}`}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
      </label>

      <label className={styles.filterField}>
        <span className={styles.fieldLabel}>Level</span>
        <select
          className={styles.filterSelect}
          value={value.level === 'all' ? 'all' : String(value.level)}
          aria-label={`Filter by spell level${sfx}`}
          onChange={(e) => onChange({ ...value, level: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
        >
          <option value="all">All levels</option>
          {Array.from({ length: 10 }, (_, i) => i).map((l) => (
            <option key={l} value={l}>
              {levelOptionLabel(l)}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.filterField}>
        <span className={styles.fieldLabel}>School</span>
        <select
          className={styles.filterSelect}
          value={value.school}
          aria-label={`Filter by school${sfx}`}
          onChange={(e) => onChange({ ...value, school: e.target.value as 'all' | SpellSchool })}
        >
          <option value="all">All schools</option>
          {(Object.keys(SCHOOL_LABELS) as SpellSchool[]).map((s) => (
            <option key={s} value={s}>
              {SCHOOL_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.filterCheck}>
        <input
          type="checkbox"
          checked={value.ritual}
          aria-label={`Only rituals${sfx}`}
          onChange={(e) => onChange({ ...value, ritual: e.target.checked })}
        />
        <span className={styles.checkboxText}>Ritual</span>
      </label>

      <label className={styles.filterCheck}>
        <input
          type="checkbox"
          checked={value.concentration}
          aria-label={`Only concentration spells${sfx}`}
          onChange={(e) => onChange({ ...value, concentration: e.target.checked })}
        />
        <span className={styles.checkboxText}>Concentration</span>
      </label>
    </div>
  );
}
