import { useEffect, useMemo, useRef, useState } from 'react';
import type { DmCombatant, DmPartyMember } from '../../types/dm';
import { NPC_TEMPLATE_LIST } from '../../data/npc-templates';
import {
  combatantFromCreature,
  combatantFromMember,
  combatantFromTemplate,
  customCombatant,
  makeCopies,
  usableCreatures,
  MAX_COMBATANTS,
} from '../../logic/dm-encounter';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import styles from './dm.module.css';
import enc from './encounter.module.css';

type Tab = 'party' | 'library' | 'custom';

interface LibraryEntry {
  key: string;
  name: string;
  detail: string;
  make: (id: string) => DmCombatant | undefined;
}

export interface AddCombatantsDialogProps {
  party: DmPartyMember[];
  /** Party members already in this encounter. */
  presentMemberIds: string[];
  onAdd: (combatants: DmCombatant[]) => void;
  onClose: () => void;
}

const newId = () => crypto.randomUUID();

function libraryEntries(): LibraryEntry[] {
  const npcs: LibraryEntry[] = NPC_TEMPLATE_LIST.map((t) => ({
    key: `npc:${t.id}`,
    name: t.name,
    detail: `Monster Manual 2024 p.${t.page} · CR ${t.stats.cr ?? '?'} · AC ${t.stats.ac ?? '?'} · HP ${t.stats.hpMax ?? '?'}`,
    make: (id) => combatantFromTemplate(t, id),
  }));
  const creatures: LibraryEntry[] = usableCreatures().map((c) => ({
    key: `creature:${c.id}`,
    name: c.name,
    detail: `Player's Handbook 2024 · CR ${c.challenge.cr ?? '?'} · AC ${String(c.ac)} · HP ${'average' in c.hp ? String(c.hp.average) : '?'}`,
    make: (id) => combatantFromCreature(c, id),
  }));
  return [...npcs, ...creatures].sort((a, b) => a.name.localeCompare(b.name));
}

/** Adds party members, library creatures, or a custom creature to an encounter. */
export function AddCombatantsDialog({ party, presentMemberIds, onAdd, onClose }: AddCombatantsDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);
  useBodyScrollLock(true);
  const [tab, setTab] = useState<Tab>('party');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [qty, setQty] = useState('1');
  const [group, setGroup] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState({
    name: '',
    ac: '12',
    hpMax: '10',
    initiativeMod: '0',
    conSaveMod: '',
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

  const entries = useMemo(() => libraryEntries(), []);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q === '' ? entries : entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, query]);

  const count = Math.min(MAX_COMBATANTS, Math.max(1, Math.trunc(Number(qty)) || 1));

  const submit = () => {
    setError(null);
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
      const base = entry.make(newId());
      if (!base) return setError('That creature has no fixed Armor Class or Hit Points to track.');
      return onAdd(makeCopies(base, count, newId, group));
    }
    if (custom.name.trim() === '') return setError('Give the creature a name.');
    const base = customCombatant(newId(), {
      name: custom.name,
      ac: Number(custom.ac),
      hpMax: Number(custom.hpMax),
      initiativeMod: Number(custom.initiativeMod),
      conSaveMod: custom.conSaveMod.trim() === '' ? undefined : Number(custom.conSaveMod),
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
            <ul className={enc.pickList} aria-label="Creatures">
              {shown.length === 0 && <li className={styles.muted}>No creature matches that search.</li>}
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
            {copiesControls}
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
          <button type="button" className={styles.btnPrimary} onClick={submit}>
            Add to encounter
          </button>
        </div>
      </div>
    </div>
  );
}
