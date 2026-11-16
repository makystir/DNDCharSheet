import { useMemo, useState, type ReactNode } from 'react';
import { crOptions, filterMonsters, typeOptions, type LibraryMonster, type LibraryOrigin } from '../../logic/dm-library';
import styles from './dm.module.css';

export interface MonsterFilter {
  query: string;
  cr: string;
  type: string;
  setQuery: (v: string) => void;
  setCr: (v: string) => void;
  setType: (v: string) => void;
  /** CR choices present in the list being filtered. */
  crs: string[];
  /** Creature-type choices present in the list being filtered. */
  types: string[];
  /** The creatures that match the name, CR and type (and the optional origin passed in). */
  matches: LibraryMonster[];
}

/** Name, CR and type filter state over a list of library creatures. Pass `origin` to narrow by source as well. */
export function useMonsterFilter(list: LibraryMonster[], origin?: LibraryOrigin): MonsterFilter {
  const [query, setQuery] = useState('');
  const [cr, setCr] = useState('');
  const [type, setType] = useState('');
  const crs = useMemo(() => crOptions(list), [list]);
  const types = useMemo(() => typeOptions(list), [list]);
  const matches = useMemo(() => filterMonsters(list, { query, cr, type, origin }), [list, query, cr, type, origin]);
  return { query, cr, type, setQuery, setCr, setType, crs, types, matches };
}

/**
 * The name box, Challenge Rating select and Creature type select shared by the Library page and the Add combatants
 * dialog. Renders as a fragment of fields so the caller chooses the wrapper; `children` adds extra fields (for example
 * the Library's Source select).
 */
export function MonsterFilterBar({
  filter,
  searchLabel,
  children,
}: {
  filter: MonsterFilter;
  searchLabel: string;
  children?: ReactNode;
}) {
  return (
    <>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{searchLabel}</span>
        <input
          className={styles.input}
          value={filter.query}
          onChange={(e) => filter.setQuery(e.target.value)}
          placeholder="For example: guard"
        />
      </label>
      <label className={styles.field} style={{ flex: '0 1 140px' }}>
        <span className={styles.fieldLabel}>Challenge Rating</span>
        <select className={styles.input} value={filter.cr} onChange={(e) => filter.setCr(e.target.value)}>
          <option value="">Any</option>
          {filter.crs.map((c) => (
            <option key={c} value={c}>
              CR {c}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field} style={{ flex: '0 1 170px' }}>
        <span className={styles.fieldLabel}>Creature type</span>
        <select className={styles.input} value={filter.type} onChange={(e) => filter.setType(e.target.value)}>
          <option value="">Any</option>
          {filter.types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {children}
    </>
  );
}
