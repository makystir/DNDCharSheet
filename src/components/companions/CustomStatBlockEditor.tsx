import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Ability, CustomStatBlock, NamedStatEntry } from '../../types/character';
import { ABILITY_NAMES } from '../../types/character';
import type { CreatureSize } from '../../data/creatures';
import { customStatBlockModel, ABILITY_ORDER } from '../../logic/stat-block-model';
import { StatBlockView } from './StatBlockView';
import { BlurInput } from './BlurInput';
import styles from './CompanionsShared.module.css';

export interface CustomStatBlockEditorProps {
  /** Name shown in labels (the hireling or NPC name). */
  subject: string;
  stats: CustomStatBlock | undefined;
  /** `undefined` when every field has been cleared. */
  onChange: (next: CustomStatBlock | undefined) => void;
}

type ListKey = 'traits' | 'actions' | 'bonusActions' | 'reactions';

const SIZES: readonly CreatureSize[] = ['Tiny', 'Small', 'Medium', 'Large', 'Huge'];
const ENTRIES_PER_LIST_MAX = 20;

const LIST_LABELS: Record<ListKey, { plural: string; singular: string }> = {
  traits: { plural: 'Traits', singular: 'Trait' },
  actions: { plural: 'Actions', singular: 'Action' },
  bonusActions: { plural: 'Bonus Actions', singular: 'Bonus Action' },
  reactions: { plural: 'Reactions', singular: 'Reaction' },
};

const TEXT_FIELDS: { key: 'creatureType' | 'alignment' | 'speed' | 'skills' | 'senses' | 'languages' | 'resistances' | 'immunities' | 'vulnerabilities'; label: string }[] = [
  { key: 'creatureType', label: 'Creature type' },
  { key: 'alignment', label: 'Alignment' },
  { key: 'speed', label: 'Speed' },
  { key: 'skills', label: 'Skills' },
  { key: 'senses', label: 'Senses' },
  { key: 'languages', label: 'Languages' },
  { key: 'resistances', label: 'Resistances' },
  { key: 'immunities', label: 'Immunities' },
  { key: 'vulnerabilities', label: 'Vulnerabilities' },
];

/** Drop `undefined` and empty values; `undefined` when nothing is left. */
function compact(block: CustomStatBlock): CustomStatBlock | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(block)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    out[k] = v;
  }
  return Object.keys(out).length === 0 ? undefined : (out as CustomStatBlock);
}

/**
 * The editable stat block of a hireling or NPC party member. It always renders
 * the SAME 2024 stat block view the creatures use (MOD and SAVE are derived from
 * the typed scores and Proficiency Bonus), with an editor underneath.
 *
 * NOTHING is pre-filled: the PHB gives hirelings no statistics and the NPC stat
 * blocks live in the Monster Manual, so the user types a Guard or Scout in by
 * hand. Extension point: Monster Manual NPC templates (Guard, Scout, Noble,
 * Commoner...) will pre-fill this same shape later (deferred by user request).
 */
export function CustomStatBlockEditor({ subject, stats, onChange }: CustomStatBlockEditorProps) {
  const [editing, setEditing] = useState(false);
  const block: CustomStatBlock = stats ?? {};
  const model = customStatBlockModel(subject, stats);

  const setField = <K extends keyof CustomStatBlock>(key: K, value: CustomStatBlock[K] | undefined) => {
    onChange(compact({ ...block, [key]: value }));
  };
  const setNumber = (key: 'ac' | 'initiativeMod' | 'hpMax' | 'proficiencyBonus' | 'xp') => (v: string | number | undefined) =>
    setField(key, typeof v === 'number' ? v : undefined);
  const setText =
    (key: (typeof TEXT_FIELDS)[number]['key'] | 'cr') =>
    (v: string | number | undefined) =>
      setField(key, typeof v === 'string' ? v : undefined);

  const setScore = (ability: Ability) => (v: string | number | undefined) => {
    const abilities = { ...(block.abilities ?? {}) };
    if (typeof v === 'number') abilities[ability] = v;
    else delete abilities[ability];
    setField('abilities', abilities);
  };
  const toggleSave = (ability: Ability, on: boolean) => {
    const current = block.saveProficiencies ?? [];
    const next = on ? [...current.filter((a) => a !== ability), ability] : current.filter((a) => a !== ability);
    setField('saveProficiencies', next);
  };

  const setEntry = (key: ListKey, index: number, patch: Partial<NamedStatEntry>) => {
    const list = [...(block[key] ?? [])];
    list[index] = { ...list[index], ...patch };
    setField(key, list);
  };
  const addEntry = (key: ListKey) => {
    const list = block[key] ?? [];
    if (list.length >= ENTRIES_PER_LIST_MAX) return;
    setField(key, [...list, { name: LIST_LABELS[key].singular, description: '' }]);
  };
  const removeEntry = (key: ListKey, index: number) => {
    setField(key, (block[key] ?? []).filter((_, i) => i !== index));
  };

  return (
    <div className={styles.body} data-testid="custom-stat-block">
      <StatBlockView
        model={model}
        hideName
        emptyHint={
          <p className={styles.hint}>
            No stats entered yet. The PHB gives hirelings no statistics and NPC stat blocks are in the Monster Manual, so
            nothing is filled in for you. Use Edit stat block to type one in by hand.
          </p>
        }
      />

      <div className={styles.footer}>
        <button type="button" className={styles.btn} aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
          <Pencil size={14} aria-hidden="true" /> {editing ? 'Done editing' : 'Edit stat block'}
        </button>
      </div>

      {editing && (
        <div className={styles.body} role="group" aria-label={`${subject} stat block editor`}>
          <div className={styles.row}>
            <label className={styles.field}>
              Size
              <select
                className={styles.control}
                value={block.size ?? ''}
                aria-label={`${subject} size`}
                onChange={(e) => setField('size', (e.target.value || undefined) as CreatureSize | undefined)}
              >
                <option value="">Not set</option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {TEXT_FIELDS.slice(0, 2).map((f) => (
              <label key={f.key} className={styles.field}>
                {f.label}
                <BlurInput className={styles.control} value={block[f.key]} maxLength={500} ariaLabel={`${subject} ${f.label}`} onCommit={setText(f.key)} />
              </label>
            ))}
          </div>

          <div className={styles.row}>
            <label className={styles.field}>
              Armor Class
              <BlurInput kind="number" min={0} max={99} className={`${styles.control} ${styles.controlNarrow}`} value={block.ac} ariaLabel={`${subject} Armor Class`} onCommit={setNumber('ac')} />
            </label>
            <label className={styles.field}>
              Initiative modifier
              <BlurInput kind="number" min={-20} max={20} className={`${styles.control} ${styles.controlNarrow}`} value={block.initiativeMod} ariaLabel={`${subject} initiative modifier`} onCommit={setNumber('initiativeMod')} />
            </label>
            <label className={styles.field}>
              Hit Points maximum
              <BlurInput kind="number" min={0} max={99999} className={`${styles.control} ${styles.controlNarrow}`} value={block.hpMax} ariaLabel={`${subject} Hit Points maximum`} onCommit={setNumber('hpMax')} />
            </label>
            <label className={styles.field}>
              Proficiency Bonus
              <BlurInput kind="number" min={2} max={9} className={`${styles.control} ${styles.controlNarrow}`} value={block.proficiencyBonus} ariaLabel={`${subject} Proficiency Bonus`} onCommit={setNumber('proficiencyBonus')} />
            </label>
            <label className={styles.field}>
              Speed
              <BlurInput className={styles.control} value={block.speed} maxLength={500} ariaLabel={`${subject} Speed`} onCommit={setText('speed')} />
            </label>
          </div>

          <fieldset className={styles.row} style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className={styles.sectionTitle}>Ability scores (MOD and SAVE are worked out for you)</legend>
            {ABILITY_ORDER.map((a) => (
              <div key={a} className={styles.field}>
                <label className={styles.field}>
                  {ABILITY_NAMES[a]}
                  <BlurInput kind="number" min={1} max={30} className={`${styles.control} ${styles.controlNarrow}`} value={block.abilities?.[a]} ariaLabel={`${subject} ${ABILITY_NAMES[a]} score`} onCommit={setScore(a)} />
                </label>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={block.saveProficiencies?.includes(a) === true}
                    aria-label={`${subject} ${ABILITY_NAMES[a]} saving throw proficiency`}
                    onChange={(e) => toggleSave(a, e.target.checked)}
                  />
                  Save
                </label>
              </div>
            ))}
          </fieldset>

          <div className={styles.row}>
            {TEXT_FIELDS.slice(3).map((f) => (
              <label key={f.key} className={styles.field}>
                {f.label}
                <BlurInput className={styles.control} value={block[f.key]} maxLength={500} ariaLabel={`${subject} ${f.label}`} onCommit={setText(f.key)} />
              </label>
            ))}
            <label className={styles.field}>
              Challenge Rating
              <BlurInput className={`${styles.control} ${styles.controlNarrow}`} value={block.cr} maxLength={10} ariaLabel={`${subject} Challenge Rating`} placeholder="1/2" onCommit={setText('cr')} />
            </label>
            <label className={styles.field}>
              XP
              <BlurInput kind="number" min={0} max={10000000} className={`${styles.control} ${styles.controlNarrow}`} value={block.xp} ariaLabel={`${subject} XP`} onCommit={setNumber('xp')} />
            </label>
          </div>

          {(Object.keys(LIST_LABELS) as ListKey[]).map((key) => {
            const list = block[key] ?? [];
            const { plural, singular } = LIST_LABELS[key];
            return (
              <section key={key} className={styles.body} aria-label={`${subject} ${plural}`}>
                <h4 className={styles.sectionTitle}>{plural}</h4>
                {list.map((entry, i) => (
                  <div key={i} className={styles.row}>
                    <label className={styles.field}>
                      {`${singular} name`}
                      <BlurInput className={styles.control} value={entry.name} maxLength={80} ariaLabel={`${subject} ${singular} ${i + 1} name`} onCommit={(v) => typeof v === 'string' && setEntry(key, i, { name: v })} />
                    </label>
                    <label className={styles.field} style={{ flex: 1 }}>
                      Description
                      <BlurInput multiline className={styles.textarea} value={entry.description} maxLength={2000} ariaLabel={`${subject} ${singular} ${i + 1} description`} onCommit={(v) => setEntry(key, i, { description: typeof v === 'string' ? v : '' })} />
                    </label>
                    <button type="button" className={styles.deleteBtn} aria-label={`Remove ${singular} ${i + 1} from ${subject}`} onClick={() => removeEntry(key, i)}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <div>
                  <button type="button" className={styles.btn} disabled={list.length >= ENTRIES_PER_LIST_MAX} onClick={() => addEntry(key)}>
                    <Plus size={14} aria-hidden="true" /> {`Add ${singular}`}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
