import { useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import type { DmCustomMonster } from '../../types/dm';
import type { DmApi } from './dmApi';
import { activeCampaign } from '../../logic/dm-campaign';
import {
  blankCustomMonster,
  combatantFromLibrary,
  crOptions,
  customFromLibrary,
  deleteCustomMonster,
  filterMonsters,
  libraryMonsters,
  saveCustomMonster,
  typeOf,
  typeOptions,
  type LibraryMonster,
  type LibraryOrigin,
} from '../../logic/dm-library';
import { addCombatants, makeCopies, saveEncounter, MAX_COMBATANTS } from '../../logic/dm-encounter';
import { clockNow } from '../../logic/dm-mode';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { MonsterStatBlock } from './MonsterStatBlock';
import { MonsterEditorDialog } from './MonsterEditorDialog';
import styles from './dm.module.css';
import lib from './library.module.css';

interface LibraryPageProps {
  dm: DmApi;
  onNotify: (text: string) => void;
  onOpenEncounter: () => void;
}

const ORIGIN_LABEL: Record<LibraryOrigin, string> = {
  npc: 'Monster Manual NPCs',
  creature: 'Creatures',
  custom: 'My monsters',
};

/** Search the creatures, read a stat block, copy one into your own monsters, or send it into an encounter. */
export function LibraryPage({ dm, onNotify, onOpenEncounter }: LibraryPageProps) {
  const campaign = activeCampaign(dm.data);
  const [query, setQuery] = useState('');
  const [cr, setCr] = useState('');
  const [type, setType] = useState('');
  const [origin, setOrigin] = useState<LibraryOrigin | ''>('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ monster: DmCustomMonster; isNew: boolean } | null>(null);
  const [deleting, setDeleting] = useState<LibraryMonster | null>(null);
  const [encounterId, setEncounterId] = useState('');
  const [qty, setQty] = useState('1');
  const [group, setGroup] = useState(true);

  const all = useMemo(() => libraryMonsters(dm.data), [dm.data]);
  const shown = useMemo(
    () => filterMonsters(all, { query, cr, type, origin: origin || undefined }),
    [all, query, cr, type, origin],
  );
  const crs = useMemo(() => crOptions(all), [all]);
  const types = useMemo(() => typeOptions(all), [all]);
  const selected = all.find((m) => m.key === selectedKey) ?? null;

  const openEncounters = (campaign?.encounters ?? []).filter((e) => e.status !== 'ended');
  const chosenEncounter =
    openEncounters.find((e) => e.id === encounterId) ??
    openEncounters.find((e) => e.id === campaign?.activeEncounterId) ??
    openEncounters[0];
  const count = Math.min(MAX_COMBATANTS, Math.max(1, Math.trunc(Number(qty)) || 1));

  const edit = (m: LibraryMonster) => {
    const found = dm.data.customMonsters.find((c) => c.id === m.customId);
    if (found) setEditing({ monster: found, isNew: false });
  };

  const copy = (m: LibraryMonster) => {
    const made = customFromLibrary(m, crypto.randomUUID(), clockNow());
    setEditing({ monster: made, isNew: true });
  };

  const addToEncounter = (m: LibraryMonster) => {
    if (!campaign || !chosenEncounter) return;
    const base = combatantFromLibrary(m, crypto.randomUUID());
    if (!base) {
      onNotify(`${m.name} has no fixed Armor Class or Hit Points, so it cannot be added to an encounter.`);
      return;
    }
    const list = makeCopies(base, count, () => crypto.randomUUID(), group);
    const next = addCombatants(chosenEncounter, list);
    const now = clockNow();
    dm.update((d) => saveEncounter(d, campaign.id, next, now));
    onNotify(`${count > 1 ? `${count} × ` : ''}${m.name} added to ${chosenEncounter.name}.`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Creature library</h1>
          <div className={styles.muted}>
            {all.length} creatures · {shown.length} shown
          </div>
        </div>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => setEditing({ monster: blankCustomMonster(crypto.randomUUID(), clockNow()), isNew: true })}
        >
          New custom monster
        </button>
      </div>

      <Card>
        <div className={lib.filters}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Search by name</span>
            <input className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="For example: guard" />
          </label>
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
          <label className={styles.field} style={{ flex: '0 1 190px' }}>
            <span className={styles.fieldLabel}>Source</span>
            <select className={styles.input} value={origin} onChange={(e) => setOrigin(e.target.value as LibraryOrigin | '')}>
              <option value="">All</option>
              {(Object.keys(ORIGIN_LABEL) as LibraryOrigin[]).map((o) => (
                <option key={o} value={o}>
                  {ORIGIN_LABEL[o]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <div className={lib.layout}>
        <ul className={lib.results} aria-label="Creatures">
          {shown.length === 0 && <li className={styles.muted} style={{ padding: 12 }}>No creature matches those filters.</li>}
          {shown.map((m) => (
            <li key={m.key}>
              <button
                type="button"
                className={m.key === selectedKey ? lib.resultButtonActive : lib.resultButton}
                onClick={() => setSelectedKey(m.key)}
                aria-pressed={m.key === selectedKey}
              >
                <span>{m.name}</span>
                <span className={lib.resultMeta}>
                  {m.cr !== null ? `CR ${m.cr}` : 'CR ?'} · {typeOf(m) || 'Creature'}
                  {m.origin === 'custom' ? ' · custom' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.stack}>
          {!selected ? (
            <Card>
              <SectionHeader icon={BookOpen} title="Stat block" />
              <p className={styles.muted}>Pick a creature from the list to read its stat block.</p>
            </Card>
          ) : (
            <>
              <Card>
                <div className={lib.actions}>
                  {selected.addable && (
                    <>
                      {openEncounters.length > 1 && (
                        <label className={styles.field} style={{ flex: '0 1 220px' }}>
                          <span className={styles.fieldLabel}>Encounter</span>
                          <select
                            className={styles.input}
                            value={chosenEncounter?.id ?? ''}
                            onChange={(e) => setEncounterId(e.target.value)}
                          >
                            {openEncounters.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className={styles.field} style={{ flex: '0 1 90px' }}>
                        <span className={styles.fieldLabel}>How many</span>
                        <input
                          className={styles.input}
                          type="number"
                          min={1}
                          max={MAX_COMBATANTS}
                          value={qty}
                          onChange={(e) => setQty(e.target.value)}
                        />
                      </label>
                      {count > 1 && (
                        <label className={styles.row}>
                          <input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} />
                          <span>One Initiative roll</span>
                        </label>
                      )}
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => addToEncounter(selected)}
                        disabled={!chosenEncounter}
                      >
                        Add to {chosenEncounter ? chosenEncounter.name : 'encounter'}
                      </button>
                    </>
                  )}
                  <button type="button" className={styles.btn} onClick={() => copy(selected)}>
                    Make an editable copy
                  </button>
                  {selected.origin === 'custom' && (
                    <>
                      <button type="button" className={styles.btn} onClick={() => edit(selected)}>
                        Edit
                      </button>
                      <button type="button" className={styles.btnDanger} onClick={() => setDeleting(selected)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
                {selected.addable && !chosenEncounter && (
                  <p className={styles.muted} style={{ marginTop: 8 }}>
                    {campaign
                      ? 'There is no open encounter to add to. '
                      : 'Create a campaign and an encounter first. '}
                    <button type="button" className={styles.btn} onClick={onOpenEncounter}>
                      Go to Encounter
                    </button>
                  </p>
                )}
                {!selected.addable && (
                  <p className={styles.muted} style={{ marginTop: 8 }}>
                    This creature has no fixed Armor Class or Hit Points, so it cannot go straight into an encounter. Make an
                    editable copy and fill them in.
                  </p>
                )}
              </Card>
              <Card>
                <MonsterStatBlock monster={selected} />
              </Card>
            </>
          )}
        </div>
      </div>

      {editing && (
        <MonsterEditorDialog
          monster={editing.monster}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={(monster) => {
            const now = clockNow();
            dm.update((d) => saveCustomMonster(d, monster, now));
            setSelectedKey(`custom:${monster.id}`);
            setEditing(null);
            onNotify(`${monster.name} saved to your monsters.`);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete monster"
          message={`Delete "${deleting.name}" from your monsters? Encounters that already use it keep their copy.`}
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const id = deleting.customId;
            if (id) dm.update((d) => deleteCustomMonster(d, id));
            setSelectedKey(null);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
