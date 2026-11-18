import { useEffect, useRef, useState } from 'react';
import type { Ability } from '../../types/character';
import { ABILITY_NAMES } from '../../types/character';
import type { DmCustomMonster, DmMonsterEntry } from '../../types/dm';
import { ABILITY_KEYS, ABILITY_LABELS } from '../../logic/dm-library';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import styles from './dm.module.css';
import lib from './library.module.css';

interface MonsterEditorDialogProps {
  monster: DmCustomMonster;
  isNew: boolean;
  onSave: (monster: DmCustomMonster) => void;
  onClose: () => void;
}

type EntryKey = 'traits' | 'actions' | 'bonusActions' | 'reactions' | 'legendaryActions';

const ENTRY_SECTIONS: { key: EntryKey; title: string }[] = [
  { key: 'traits', title: 'Traits' },
  { key: 'actions', title: 'Actions' },
  { key: 'bonusActions', title: 'Bonus Actions' },
  { key: 'reactions', title: 'Reactions' },
  { key: 'legendaryActions', title: 'Legendary Actions' },
];

const TEXT_FIELDS: { key: keyof DmCustomMonster; label: string }[] = [
  { key: 'skills', label: 'Skills' },
  { key: 'senses', label: 'Senses' },
  { key: 'languages', label: 'Languages' },
  { key: 'vulnerabilities', label: 'Damage vulnerabilities' },
  { key: 'resistances', label: 'Damage resistances' },
  { key: 'immunities', label: 'Damage immunities' },
  { key: 'conditionImmunities', label: 'Condition immunities' },
];

function num(value: string, fallback: number): number {
  return value.trim() === '' || !Number.isFinite(Number(value)) ? fallback : Number(value);
}

/** Create or edit one of the DM's own monsters. */
export function MonsterEditorDialog({ monster, isNew, onSave, onClose }: MonsterEditorDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);
  useBodyScrollLock(true);
  const [d, setD] = useState<DmCustomMonster>(monster);
  // Numbers are typed as text so a field can be empty while editing.
  const [initialNumbers] = useState(
    () =>
      ({
        ac: String(monster.ac),
        hpMax: String(monster.hpMax),
        initiativeMod: String(monster.initiativeMod),
        proficiencyBonus: String(monster.proficiencyBonus),
        legendaryUses: String(monster.legendaryUses),
        ...Object.fromEntries(ABILITY_KEYS.map((a) => [a, String(monster.abilities[a])])),
      }) as Record<string, string>,
  );
  const [numbers, setNumbers] = useState(initialNumbers);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);

  // Unsaved work: any field differs from what the dialog opened with.
  const dirty = JSON.stringify(d) !== JSON.stringify(monster) || JSON.stringify(numbers) !== JSON.stringify(initialNumbers);
  // Overlay click and Escape ask first when there is unsaved work; Cancel is an explicit discard.
  const requestClose = () => (dirty ? setDiscarding(true) : onClose());

  useEffect(() => {
    if (discarding) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dirty) setDiscarding(true);
        else onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, dirty, discarding]);

  const setText = <K extends keyof DmCustomMonster>(key: K, value: DmCustomMonster[K]) => setD((x) => ({ ...x, [key]: value }));
  const setNum = (key: string, value: string) => setNumbers((n) => ({ ...n, [key]: value }));

  const setEntry = (key: EntryKey, index: number, patch: Partial<DmMonsterEntry>) =>
    setD((x) => ({ ...x, [key]: x[key].map((e, i) => (i === index ? { ...e, ...patch } : e)) }));
  const addEntry = (key: EntryKey) => setD((x) => ({ ...x, [key]: [...x[key], { name: '', description: '' }] }));
  const removeEntry = (key: EntryKey, index: number) => setD((x) => ({ ...x, [key]: x[key].filter((_, i) => i !== index) }));

  const toggleSave = (a: Ability, on: boolean) =>
    setD((x) => ({
      ...x,
      saveProficiencies: on ? [...new Set([...x.saveProficiencies, a])] : x.saveProficiencies.filter((s) => s !== a),
    }));

  const submit = () => {
    if (d.name.trim() === '') {
      setError('Give the monster a name.');
      return;
    }
    const abilities = { ...d.abilities };
    for (const a of ABILITY_KEYS) abilities[a] = Math.min(30, Math.max(1, Math.trunc(num(numbers[a], 10))));
    onSave({
      ...d,
      name: d.name.trim(),
      ac: Math.min(40, Math.max(0, Math.trunc(num(numbers.ac, 10)))),
      hpMax: Math.min(9999, Math.max(1, Math.trunc(num(numbers.hpMax, 1)))),
      initiativeMod: Math.min(30, Math.max(-10, Math.trunc(num(numbers.initiativeMod, 0)))),
      proficiencyBonus: Math.min(9, Math.max(0, Math.trunc(num(numbers.proficiencyBonus, 2)))),
      legendaryUses: Math.min(10, Math.max(0, Math.trunc(num(numbers.legendaryUses, 0)))),
      abilities,
      traits: d.traits.filter((e) => e.name.trim() || e.description.trim()),
      actions: d.actions.filter((e) => e.name.trim() || e.description.trim()),
      bonusActions: d.bonusActions.filter((e) => e.name.trim() || e.description.trim()),
      reactions: d.reactions.filter((e) => e.name.trim() || e.description.trim()),
      legendaryActions: d.legendaryActions.filter((e) => e.name.trim() || e.description.trim()),
    });
  };

  const title = isNew ? 'New custom monster' : 'Edit custom monster';

  return (
    <>
    <div className={styles.overlay} onClick={requestClose} role="dialog" aria-modal="true" aria-label={title}>
      <div ref={ref} className={styles.dialog} style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.dialogTitle}>{title}</h2>
        {d.basedOn && <p className={styles.muted}>{d.basedOn}</p>}

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Name</span>
            <input className={styles.input} value={d.name} onChange={(e) => setText('name', e.target.value)} autoFocus />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Size</span>
            <input className={styles.input} value={d.size} onChange={(e) => setText('size', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Creature type</span>
            <input className={styles.input} value={d.creatureType} onChange={(e) => setText('creatureType', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Alignment</span>
            <input className={styles.input} value={d.alignment} onChange={(e) => setText('alignment', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Challenge Rating (for example 1/4 or 5)</span>
            <input className={styles.input} value={d.cr} onChange={(e) => setText('cr', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Armor Class</span>
            <input className={styles.input} type="number" value={numbers.ac} onChange={(e) => setNum('ac', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Hit Points</span>
            <input className={styles.input} type="number" value={numbers.hpMax} onChange={(e) => setNum('hpMax', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Hit Point dice (optional)</span>
            <input className={styles.input} value={d.hpDice} onChange={(e) => setText('hpDice', e.target.value)} placeholder="4d8 + 8" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Speed</span>
            <input className={styles.input} value={d.speed} onChange={(e) => setText('speed', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Initiative modifier</span>
            <input className={styles.input} type="number" value={numbers.initiativeMod} onChange={(e) => setNum('initiativeMod', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Proficiency Bonus</span>
            <input className={styles.input} type="number" value={numbers.proficiencyBonus} onChange={(e) => setNum('proficiencyBonus', e.target.value)} />
          </label>
        </div>

        <fieldset className={lib.entryRow}>
          <legend>Ability scores and saving throw proficiency</legend>
          <div className={lib.scoreGrid}>
            {ABILITY_KEYS.map((a) => (
              <div key={a} className={styles.stack}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{ABILITY_LABELS[a]}</span>
                  <input
                    className={styles.input}
                    type="number"
                    aria-label={`${ABILITY_NAMES[a]} score`}
                    value={numbers[a]}
                    onChange={(e) => setNum(a, e.target.value)}
                  />
                </label>
                <label className={styles.row}>
                  <input
                    type="checkbox"
                    checked={d.saveProficiencies.includes(a)}
                    onChange={(e) => toggleSave(a, e.target.checked)}
                    aria-label={`Proficient in ${ABILITY_NAMES[a]} saving throws`}
                  />
                  <span className={styles.muted}>Save</span>
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <div className={styles.formGrid}>
          {TEXT_FIELDS.map(({ key, label }) => (
            <label key={key} className={styles.field}>
              <span className={styles.fieldLabel}>{label}</span>
              <input className={styles.input} value={d[key] as string} onChange={(e) => setText(key, e.target.value as never)} />
            </label>
          ))}
        </div>

        {ENTRY_SECTIONS.map(({ key, title: sectionTitle }) => (
          <fieldset key={key} className={lib.entryRow}>
            <legend>{sectionTitle}</legend>
            {key === 'legendaryActions' && (
              <label className={styles.field} style={{ flex: '0 1 220px' }}>
                <span className={styles.fieldLabel}>Legendary action uses per round (0 for none)</span>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  max={10}
                  value={numbers.legendaryUses}
                  onChange={(e) => setNum('legendaryUses', e.target.value)}
                />
              </label>
            )}
            {d[key].map((entry, i) => (
              <div key={i} className={lib.entryRow}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Entry name</span>
                  <input
                    className={styles.input}
                    aria-label={`${sectionTitle} ${i + 1} name`}
                    value={entry.name}
                    onChange={(e) => setEntry(key, i, { name: e.target.value })}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Entry description</span>
                  <textarea
                    className={styles.textarea}
                    style={{ minHeight: 70 }}
                    aria-label={`${sectionTitle} ${i + 1} description`}
                    value={entry.description}
                    onChange={(e) => setEntry(key, i, { description: e.target.value })}
                  />
                </label>
                <div className={styles.row}>
                  <button type="button" className={styles.btnDanger} onClick={() => removeEntry(key, i)} aria-label={`Remove ${sectionTitle} ${i + 1}`}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div className={styles.row}>
              <button type="button" className={styles.btn} onClick={() => addEntry(key)}>
                Add to {sectionTitle}
              </button>
            </div>
          </fieldset>
        ))}

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
            Save monster
          </button>
        </div>
      </div>
    </div>
    {discarding && (
      <ConfirmDialog
        title="Discard changes"
        message="Discard your unsaved changes to this monster?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setDiscarding(false)}
        onConfirm={onClose}
      />
    )}
    </>
  );
}
