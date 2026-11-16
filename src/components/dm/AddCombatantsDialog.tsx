import { useEffect, useMemo, useRef, useState } from 'react';
import type { DmCombatant, DmCustomMonster, DmPartyMember } from '../../types/dm';
import { combatantFromMember, customCombatant, makeCopies, MAX_COMBATANTS } from '../../logic/dm-encounter';
import { xpForCr } from '../../logic/dm-balance';
import {
  combatantFromLibrary,
  crOptions,
  filterMonsters,
  libraryMonsters,
  typeOptions,
  type LibraryMonster,
} from '../../logic/dm-library';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import styles from './dm.module.css';
import enc from './encounter.module.css';

type Tab = 'party' | 'library' | 'custom';

interface LibraryEntry {
  key: string;
  name: string;
  detail: string;
  monster: LibraryMonster;
}

export interface AddCombatantsDialogProps {
  party: DmPartyMember[];
  /** The DM's own monsters, offered alongside the built-in creatures. */
  customMonsters: DmCustomMonster[];
  /** Party members already in this encounter. */
  presentMemberIds: string[];
  /** keepOpen is true for the library's "Add and keep browsing" button: the caller should not close the dialog. */
  onAdd: (combatants: DmCombatant[], keepOpen?: boolean) => void;
  onClose: () => void;
}

const newId = () => crypto.randomUUID();

/** Rows are not virtualised, so only this many matches are drawn; narrow the filters to reach the rest. */
const MAX_SHOWN = 100;

function libraryEntries(customMonsters: DmCustomMonster[]): LibraryEntry[] {
  return libraryMonsters({ customMonsters })
    .filter((m) => m.addable)
    .map((m) => ({
      key: m.key,
      name: m.name,
      detail: `${m.source} · CR ${m.cr ?? '?'} · AC ${m.ac ?? '?'} · HP ${m.hpAverage ?? '?'}`,
      monster: m,
    }));
}

/** Adds party members, library creatures, or a custom creature to an encounter. */
export function AddCombatantsDialog({ party, customMonsters, presentMemberIds, onAdd, onClose }: AddCombatantsDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);
  useBodyScrollLock(true);
  const [tab, setTab] = useState<Tab>('party');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [cr, setCr] = useState('');
  const [type, setType] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [qty, setQty] = useState('1');
  const [group, setGroup] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState({
    name: '',
    ac: '12',
    hpMax: '10',
    initiativeMod: '0',
    conSaveMod: '',
    cr: '',
    xp: '',
    resistances: '',
    vulnerabilities: '',
    immunities: '',
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const entries = useMemo(() => libraryEntries(customMonsters), [customMonsters]);
  const crs = useMemo(() => crOptions(entries.map((e) => e.monster)), [entries]);
  const types = useMemo(() => typeOptions(entries.map((e) => e.monster)), [entries]);
  const matches = useMemo(() => {
    const keys = new Set(filterMonsters(entries.map((e) => e.monster), { query, cr, type }).map((m) => m.key));
    return entries.filter((e) => keys.has(e.key));
  }, [entries, query, cr, type]);
  const shown = matches.slice(0, MAX_SHOWN);

  const count = Math.min(MAX_COMBATANTS, Math.max(1, Math.trunc(Number(qty)) || 1));

  const submit = (keepOpen = false) => {
    setError(null);
    setAdded(null);
    if (tab === 'party') {
      const made = party
        .filter((m) => picked.has(m.id))
        .flatMap((m) => {
          const c = combatantFromMember(m, newId());
          return c ? [c] : [];
        });
      if (made.length === 0) return setError('Pick at least one party member.');
      return onAdd(made);
    }
    if (tab === 'library') {
      const entry = entries.find((e) => e.key === chosen);
      if (!entry) return setError('Pick a creature from the list.');
      const base = combatantFromLibrary(entry.monster, newId());
      if (!base) return setError('That creature has no fixed Armor Class or Hit Points to track.');
      onAdd(makeCopies(base, count, newId, group), keepOpen);
      if (keepOpen) setAdded(`Added ${count > 1 ? `${count} x ` : ''}${entry.name}.`);
      return;
    }
    if (custom.name.trim() === '') return setError('Give the creature a name.');
    const base = customCombatant(newId(), {
      name: custom.name,
      ac: Number(custom.ac),
      hpMax: Number(custom.hpMax),
      initiativeMod: Number(custom.initiativeMod),
      conSaveMod: custom.conSaveMod.trim() === '' ? undefined : Number(custom.conSaveMod),
      cr: custom.cr,
      xp: custom.xp.trim() === '' ? (xpForCr(custom.cr.trim()) ?? undefined) : Number(custom.xp),
      resistances: custom.resistances,
      vulnerabilities: custom.vulnerabilities,
      immunities: custom.immunities,
    });
    return onAdd(makeCopies(base, count, newId, group));
  };

  const setC = (key: keyof typeof custom, value: string) => setCustom((c) => ({ ...c, [key]: value }));
  const togglePicked = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const copiesControls = (
    <div className={styles.row}>
      <label className={styles.field} style={{ flex: '0 1 120px' }}>
        <span className={styles.fieldLabel}>How many</span>
        <input className={styles.input} type="number" min={1} max={MAX_COMBATANTS} value={qty} onChange={(e) => setQty(e.target.value)} />
      </label>
      {count > 1 && (
        <label className={styles.row}>
          <input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} />
          <span>Roll Initiative once for the group</span>
        </label>
      )}
    </div>
  );

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Add combatants">
      <div ref={ref} className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.dialogTitle}>Add combatants</h2>
        <div className={styles.tabs} role="tablist" aria-label="What to add">
          {(['party', 'library', 'custom'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? styles.tabActive : styles.tab}
              onClick={() => {
                setTab(t);
                setError(null);
              }}
            >
              {t === 'party' ? 'Party' : t === 'library' ? 'Creature library' : 'Custom'}
            </button>
          ))}
        </div>

        {tab === 'party' && (
          <div className={styles.stack}>
            {party.length === 0 ? (
              <p className={styles.muted}>This campaign has no party members yet. Add them on the Party page.</p>
            ) : (
              <>
                <div className={styles.row}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => setPicked(new Set(party.filter((m) => !presentMemberIds.includes(m.id)).map((m) => m.id)))}
                  >
                    Select everyone
                  </button>
                  <button type="button" className={styles.btn} onClick={() => setPicked(new Set())}>
                    Clear
                  </button>
                </div>
                <ul className={enc.pickList}>
                  {party.map((m) => {
                    const present = presentMemberIds.includes(m.id);
                    return (
                      <li key={m.id}>
                        <label className={enc.pickItem}>
                          <input
                            type="checkbox"
                            checked={picked.has(m.id)}
                            disabled={present}
                            onChange={() => togglePicked(m.id)}
                          />
                          <span>
                            {m.name}
                            {present && <span className={styles.muted}> (already in this encounter)</span>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {tab === 'library' && (
          <div className={styles.stack}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Search creatures</span>
              <input className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="For example: guard" />
            </label>
            <div className={styles.row}>
              <label className={styles.field} style={{ flex: '0 1 140px' }}>
                <span className={styles.fieldLabel}>Challenge Rating</span>
                <select className={styles.input} value={cr} onChange={(e) => setCr(e.target.value)}>
                  <option value="">Any</option>
                  {crs.map((c) => (
                    <option key={c} value={c}>
                      CR {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field} style={{ flex: '0 1 170px' }}>
                <span className={styles.fieldLabel}>Creature type</span>
                <select className={styles.input} value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">Any</option>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ul className={enc.pickList} aria-label="Creatures">
              {shown.length === 0 && <li className={styles.muted}>No creature matches those filters.</li>}
              {shown.map((e) => (
                <li key={e.key}>
                  <label className={enc.pickItem}>
                    <input type="radio" name="library-creature" checked={chosen === e.key} onChange={() => setChosen(e.key)} />
                    <span>
                      {e.name}
                      <span className={styles.muted}> · {e.detail}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {matches.length > shown.length && (
              <p className={styles.muted}>
                Showing the first {shown.length} of {matches.length} matches. Narrow the search or filters to see the rest.
              </p>
            )}
            {copiesControls}
            {added && (
              <p className={styles.muted} role="status">
                {added}
              </p>
            )}
          </div>
        )}

        {tab === 'custom' && (
          <div className={styles.stack}>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Name</span>
                <input className={styles.input} value={custom.name} onChange={(e) => setC('name', e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Armor Class</span>
                <input className={styles.input} type="number" value={custom.ac} onChange={(e) => setC('ac', e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Hit Points</span>
                <input className={styles.input} type="number" value={custom.hpMax} onChange={(e) => setC('hpMax', e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Initiative modifier</span>
                <input className={styles.input} type="number" value={custom.initiativeMod} onChange={(e) => setC('initiativeMod', e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Constitution save modifier (optional)</span>
                <input className={styles.input} type="number" value={custom.conSaveMod} onChange={(e) => setC('conSaveMod', e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Challenge Rating (optional)</span>
                <input className={styles.input} value={custom.cr} onChange={(e) => setC('cr', e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>XP value (optional; filled in from the CR if left empty)</span>
                <input className={styles.input} type="number" value={custom.xp} onChange={(e) => setC('xp', e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Resistances (for example Fire; Cold)</span>
                <input className={styles.input} value={custom.resistances} onChange={(e) => setC('resistances', e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Vulnerabilities</span>
                <input className={styles.input} value={custom.vulnerabilities} onChange={(e) => setC('vulnerabilities', e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Immunities</span>
                <input className={styles.input} value={custom.immunities} onChange={(e) => setC('immunities', e.target.value)} />
              </label>
            </div>
            {copiesControls}
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          {tab === 'library' && (
            <button type="button" className={styles.btn} onClick={() => submit(true)}>
              Add and keep browsing
            </button>
          )}
          <button type="button" className={styles.btnPrimary} onClick={() => submit()}>
            Add to encounter
          </button>
        </div>
      </div>
    </div>
  );
}
