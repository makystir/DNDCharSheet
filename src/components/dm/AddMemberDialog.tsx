import { useEffect, useRef, useState } from 'react';
import type { Character } from '../../types/character';
import type { DmManualStats } from '../../types/dm';
import { DEFAULT_MANUAL_STATS } from '../../logic/dm-campaign';
import { importCharacterFromText } from '../../logic/dm-import';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import styles from './dm.module.css';

export type AddMemberMode = 'import' | 'manual';

export interface AddMemberDialogProps {
  /** Which tab opens first. */
  initialMode: AddMemberMode;
  /** Set when refreshing or editing one member: hides the other tab. */
  lockedTo?: AddMemberMode;
  /** Editing a manual member: start from these values. */
  initialManual?: { name: string; stats: DmManualStats };
  /** The member being refreshed (when `lockedTo` is import): named in the title and helper text. */
  memberName?: string;
  onImport: (character: Character) => void;
  onSaveManual: (name: string, stats: DmManualStats) => void;
  onClose: () => void;
}

interface Draft {
  name: string;
  classLabel: string;
  level: string;
  ac: string;
  hpMax: string;
  hpCurrent: string;
  passivePerception: string;
  passiveInsight: string;
  passiveInvestigation: string;
  casts: boolean;
  spellSaveDc: string;
  speed: string;
  darkvisionFt: string;
  languages: string;
  conditions: string;
}

function toDraft(name: string, s: DmManualStats): Draft {
  return {
    name,
    classLabel: s.classLabel,
    level: String(s.level),
    ac: String(s.ac),
    hpMax: String(s.hpMax),
    hpCurrent: String(s.hpCurrent),
    passivePerception: String(s.passivePerception),
    passiveInsight: String(s.passiveInsight),
    passiveInvestigation: String(s.passiveInvestigation),
    casts: s.spellSaveDc !== null,
    spellSaveDc: String(s.spellSaveDc ?? 10),
    speed: String(s.speed),
    darkvisionFt: String(s.darkvisionFt),
    languages: s.languages.join(', '),
    conditions: s.conditions.join(', '),
  };
}

function listOf(text: string): string[] {
  return text.split(',').map((x) => x.trim()).filter(Boolean);
}

function fromDraft(d: Draft): DmManualStats {
  const n = (v: string, fallback: number) => (v.trim() === '' || !Number.isFinite(Number(v)) ? fallback : Number(v));
  return {
    classLabel: d.classLabel,
    level: n(d.level, 1),
    ac: n(d.ac, 10),
    hpMax: n(d.hpMax, 1),
    hpCurrent: n(d.hpCurrent, n(d.hpMax, 1)),
    passivePerception: n(d.passivePerception, 10),
    passiveInsight: n(d.passiveInsight, 10),
    passiveInvestigation: n(d.passiveInvestigation, 10),
    spellSaveDc: d.casts ? n(d.spellSaveDc, 10) : null,
    speed: n(d.speed, 30),
    darkvisionFt: n(d.darkvisionFt, 0),
    languages: listOf(d.languages),
    conditions: listOf(d.conditions),
  };
}

const NUMBER_FIELDS: { key: keyof Draft; label: string }[] = [
  { key: 'level', label: 'Level' },
  { key: 'ac', label: 'Armor Class' },
  { key: 'hpMax', label: 'Hit Point maximum' },
  { key: 'hpCurrent', label: 'Current Hit Points' },
  { key: 'passivePerception', label: 'Passive Perception' },
  { key: 'passiveInsight', label: 'Passive Insight' },
  { key: 'passiveInvestigation', label: 'Passive Investigation' },
  { key: 'speed', label: 'Speed (ft)' },
  { key: 'darkvisionFt', label: 'Darkvision (ft, 0 for none)' },
];

/**
 * Adds or updates a party member: either from a player's share link, or from
 * stats the DM types in for someone who has no shared character.
 */
export function AddMemberDialog({
  initialMode,
  lockedTo,
  initialManual,
  memberName,
  onImport,
  onSaveManual,
  onClose,
}: AddMemberDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);
  useBodyScrollLock(true);
  const [mode, setMode] = useState<AddMemberMode>(lockedTo ?? initialMode);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialDraft] = useState<Draft>(() =>
    toDraft(initialManual?.name ?? '', initialManual?.stats ?? DEFAULT_MANUAL_STATS),
  );
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [discarding, setDiscarding] = useState(false);

  // Unsaved work: pasted text, or a manual entry that differs from what the dialog opened with.
  const dirty = text.trim() !== '' || JSON.stringify(draft) !== JSON.stringify(initialDraft);
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

  const submitImport = async () => {
    setBusy(true);
    setError(null);
    const result = await importCharacterFromText(text);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onImport(result.character);
  };

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const editing = initialManual !== undefined;
  const title =
    lockedTo === 'import'
      ? memberName
        ? `Update ${memberName} from a share link`
        : 'Update from a share link' : editing ? 'Edit party member' : 'Add a party member';

  return (
    <>
    <div className={styles.overlay} onClick={requestClose} role="dialog" aria-modal="true" aria-label={title}>
      <div ref={dialogRef} className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.dialogTitle}>{title}</h2>

        {lockedTo === undefined && (
          <div className={styles.tabs} role="tablist" aria-label="How to add the member">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'import'}
              className={mode === 'import' ? styles.tabActive : styles.tab}
              onClick={() => {
                setMode('import');
                setError(null);
              }}
            >
              From a share link
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'manual'}
              className={mode === 'manual' ? styles.tabActive : styles.tab}
              onClick={() => {
                setMode('manual');
                setError(null);
              }}
            >
              Enter by hand
            </button>
          </div>
        )}

        {mode === 'import' ? (
          <div className={styles.stack}>
            <p className={styles.muted}>
              {lockedTo === 'import' && memberName
                ? `This replaces ${memberName}'s party card with a fresh snapshot. Ask the player to open Settings, then Share (read-only link), and send you the new link. Paste it here.`
                : 'Ask the player to open Settings, then Share (read-only link), and send you the link. Paste it here. The party card is a snapshot: to refresh it later, paste a new link. A character with the same name as an existing member updates that member.'}
            </p>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Share link, code, or exported character file text</span>
              <textarea
                className={styles.textarea}
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                autoFocus
              />
            </label>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <div className={styles.dialogActions}>
              <button type="button" className={styles.btn} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => void submitImport()}
                disabled={busy || text.trim() === ''}
              >
                {busy ? 'Reading…' : lockedTo === 'import' ? 'Update member' : 'Add to party'}
              </button>
            </div>
          </div>
        ) : (
          <form
            className={styles.stack}
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.name.trim() === '') {
                setError('Give the member a name.');
                return;
              }
              onSaveManual(draft.name, fromDraft(draft));
            }}
          >
            <p className={styles.muted}>
              For a player who has not shared a character. These numbers are exactly what you type, so keep them current.
            </p>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Name</span>
                <input className={styles.input} value={draft.name} onChange={(e) => {
                    setField('name', e.target.value);
                    setError(null);
                  }}
                  autoFocus />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Class (for example Rogue 4)</span>
                <input className={styles.input} value={draft.classLabel} onChange={(e) => setField('classLabel', e.target.value)} />
              </label>
              {NUMBER_FIELDS.map(({ key, label }) => (
                <label key={key} className={styles.field}>
                  <span className={styles.fieldLabel}>{label}</span>
                  <input
                    className={styles.input}
                    type="number"
                    inputMode="numeric"
                    value={String(draft[key])}
                    onChange={(e) => setField(key, e.target.value as never)}
                  />
                </label>
              ))}
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Casts spells</span>
                <input
                  type="checkbox"
                  checked={draft.casts}
                  onChange={(e) => setField('casts', e.target.checked)}
                  style={{ width: 24, height: 24 }}
                />
              </label>
              {draft.casts && (
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Spell save DC</span>
                  <input
                    className={styles.input}
                    type="number"
                    inputMode="numeric"
                    value={draft.spellSaveDc}
                    onChange={(e) => setField('spellSaveDc', e.target.value)}
                  />
                </label>
              )}
              <label className={styles.field} style={{ flexBasis: '100%' }}>
                <span className={styles.fieldLabel}>Languages (separate with commas)</span>
                <input className={styles.input} value={draft.languages} onChange={(e) => setField('languages', e.target.value)} />
              </label>
              <label className={styles.field} style={{ flexBasis: '100%' }}>
                <span className={styles.fieldLabel}>Conditions (separate with commas)</span>
                <input className={styles.input} value={draft.conditions} onChange={(e) => setField('conditions', e.target.value)} />
              </label>
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <div className={styles.dialogActions}>
              <button type="button" className={styles.btn} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={styles.btnPrimary}>
                {editing ? 'Save changes' : 'Add to party'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
    {discarding && (
      <ConfirmDialog
        title="Discard changes"
        message="Discard what you have entered?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setDiscarding(false)}
        onConfirm={onClose}
      />
    )}
    </>
  );
}
