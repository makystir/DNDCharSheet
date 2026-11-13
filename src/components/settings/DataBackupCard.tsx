import { useCallback, useEffect, useRef, useState } from 'react';
import { Database, Download, Upload, History, RotateCcw, ArchiveRestore } from 'lucide-react';
import type { Character } from '../../types/character';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { RestoreConfirmDialog } from '../shared/RestoreConfirmDialog';
import { exportToFile, importFromJSON } from '../../storage/export-import';
import { base64ToBlob } from '../../storage/portrait-codec';
import { getPortraitStore } from '../../storage/portrait-store';
import { restoreCompanionPortraits } from '../../storage/companion-portraits';
import { assembleBackup, downloadBackup } from '../../storage/backup-service';
import { getLastBackupAt, getBackupReminder } from '../../storage/backup-reminder';
import { isAutoBackupEnabled, setAutoBackupEnabled } from '../../storage/snapshot-settings';
import { getSnapshotStore } from '../../storage/snapshot-store';
import type { SnapshotMeta } from '../../storage/snapshot-store';
import { restoreFromSnapshot, commitSnapshotRestore } from '../../storage/snapshot-service';
import { detectImportKind, buildRestorePlan, type RestorePlan } from '../../storage/restore-plan';
import type { RestoreSummary } from '../../storage/backup-types';
import styles from './DataBackupCard.module.css';

export interface DataBackupCardProps {
  /** The active character to export. */
  character: Character;
  /**
   * Adopt an imported character as a NEW character (manager mints a fresh id and
   * makes it active). Returns the saved record so its real id is known for the
   * portrait association. Import ADDS — it never overwrites the active one.
   */
  onAdopt: (next: Character) => Promise<Character>;
  /** Called after a successful bulk restore so the shell can refresh its roster. */
  onRestored: () => void;
}

/** Transient status shown under the controls. */
type Status = { kind: 'idle' } | { kind: 'ok'; text: string } | { kind: 'error'; text: string };

/** Reject absurdly large picks before reading them into memory. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

function formatSnapshotTime(exportedAt: string): string {
  const d = new Date(exportedAt);
  if (Number.isNaN(d.getTime())) return exportedAt || 'unknown time';
  return d.toLocaleString();
}

function summarize(summary: RestoreSummary): string {
  let text = `Restored ${summary.imported} character${summary.imported !== 1 ? 's' : ''}.`;
  if (summary.skipped > 0) text += ` ${summary.skipped} skipped.`;
  if (summary.stoppedByQuota) text += ' Storage quota reached — some could not be imported.';
  return text;
}

/**
 * The Settings "Data & Backup" card: every data-safety control in one place,
 * grouped by scope.
 *
 *   - This character: export to a `.json` file; import from a file.
 *   - All characters: download a full backup file; restore from a backup file.
 *   - Automatic safety net: the auto-backup toggle, last-backed-up reminder, and
 *     restore from the in-browser snapshots.
 *
 * File picking: "Import from file" and "Restore from backup file" share ONE
 * hidden file input and ONE handler. The handler sniffs the content with
 * `detectImportKind` and routes it — a single-character export is adopted as a
 * NEW character (portrait restored); a full backup goes through
 * `buildRestorePlan` (the same `validateBackupFile` guard) -> RestoreConfirmDialog
 * -> `commitSnapshotRestore` (the same commit path as the snapshot restore) ->
 * `onRestored()`. Rather than erroring when the "wrong" button is used, both
 * buttons accept either kind and route correctly; the buttons differ only in
 * wording/scope. Every restore ADDS characters as new records and never
 * overwrites live data.
 *
 * B2/B3 durability infra, no game mechanics — no rulebook citation applies.
 */
export function DataBackupCard({ character, onAdopt, onRestored }: DataBackupCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoBackupEnabled, setAutoBackupEnabledState] = useState<boolean>(() =>
    isAutoBackupEnabled(),
  );
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(() => getLastBackupAt());
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);

  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  /** A validated backup (file or snapshot) awaiting the user's confirmation. */
  const [restorePlan, setRestorePlan] = useState<RestorePlan | null>(null);

  const backupReminder = getBackupReminder(lastBackupAt);

  const refreshSnapshots = useCallback(async () => {
    setSnapshotsError(null);
    const store = getSnapshotStore();
    if (store.isDegraded()) {
      await store.init();
    }
    const result = await store.listSnapshots();
    if (result.ok) {
      setSnapshots(result.value);
    } else {
      setSnapshots([]);
      setSnapshotsError('Auto-backups are unavailable on this device.');
    }
  }, []);

  // Load the snapshot list when the restore section is revealed.
  const revealedRef = useRef(false);
  useEffect(() => {
    if (!showSnapshots || revealedRef.current) return;
    revealedRef.current = true;
    void refreshSnapshots();
  }, [showSnapshots, refreshSnapshots]);

  const handleToggle = (enabled: boolean) => {
    setAutoBackupEnabled(enabled);
    setAutoBackupEnabledState(enabled);
  };

  const handleExport = async () => {
    setStatus({ kind: 'idle' });
    try {
      await exportToFile(character, character.id);
      setStatus({ kind: 'ok', text: `Exported “${character.name || 'character'}”.` });
    } catch {
      setStatus({ kind: 'error', text: 'Export failed. Please try again.' });
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    setStatus({ kind: 'idle' });
    try {
      const result = await assembleBackup();
      if (!result.ok) {
        setStatus({ kind: 'error', text: result.error });
        return;
      }
      const dl = downloadBackup(result.payload);
      if (!dl.ok) {
        setStatus({ kind: 'error', text: dl.error });
        return;
      }
      const count = result.payload.characterCount;
      const text = `Backup downloaded — ${count} character${count !== 1 ? 's' : ''} saved.`;
      // downloadBackup recorded the timestamp; refresh the reminder state.
      setLastBackupAt(getLastBackupAt());
      setStatus({ kind: 'ok', text });
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Backup failed.' });
    } finally {
      setBusy(false);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so choosing the SAME file again still fires onChange.
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setStatus({ kind: 'error', text: 'That file is too large to import.' });
      return;
    }

    setBusy(true);
    setStatus({ kind: 'idle' });
    try {
      const text = await file.text();
      const kind = detectImportKind(text);

      if (kind === 'backup') {
        const built = await buildRestorePlan(text);
        if (!built.ok) {
          setStatus({ kind: 'error', text: built.error });
          return;
        }
        // Confirm before anything is written.
        setRestorePlan(built.plan);
        return;
      }

      // 'character' and 'unknown' both go to the single-character importer, which
      // owns the precise error messages (bad JSON, missing fields, newer version).
      const result = importFromJSON(text);
      if (!result.success || !result.character) {
        setStatus({ kind: 'error', text: result.error ?? 'Import failed.' });
        return;
      }

      // Adopt as a NEW character (manager mints a fresh id + makes it active).
      const saved = await onAdopt(result.character);

      // Restore the embedded portrait into the Portrait Store under the new id.
      if (result.portraitDataUrl) {
        const blob = base64ToBlob(result.portraitDataUrl);
        if (blob) {
          await getPortraitStore().savePortrait(saved.id, blob);
        }
      }
      // Companion portraits follow the character to its new id.
      await restoreCompanionPortraits(saved, result.companionPortraits);

      setStatus({ kind: 'ok', text: `Imported “${saved.name || 'character'}” as a new character.` });
    } catch {
      setStatus({ kind: 'error', text: 'Could not read that file.' });
    } finally {
      setBusy(false);
    }
  };

  const handleChooseSnapshot = async (seq: number) => {
    if (busy) return;
    setBusy(true);
    setStatus({ kind: 'idle' });
    try {
      const outcome = await restoreFromSnapshot(getSnapshotStore(), seq);
      if (!outcome.ok) {
        setStatus({ kind: 'error', text: outcome.error });
        return;
      }
      // Route through the SAME validated confirm path as the file restore.
      setRestorePlan(outcome.plan);
    } finally {
      // Guards against a second click starting another plan build while the
      // first is still being validated.
      setBusy(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restorePlan) return;
    const plan = restorePlan;
    setRestorePlan(null);
    setBusy(true);
    try {
      const summary = await commitSnapshotRestore(getSnapshotStore(), plan);
      setStatus({ kind: 'ok', text: summarize(summary) });
      if (showSnapshots) await refreshSnapshots();
      onRestored();
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Restore failed.' });
    } finally {
      setBusy(false);
    }
  };

  const reminderText = backupReminder.never
    ? 'Last backed up: never'
    : `Last backed up ${backupReminder.daysSince} day${backupReminder.daysSince === 1 ? '' : 's'} ago`;

  return (
    <Card>
      <SectionHeader icon={Database} title="Data & Backup" />
      <p className={styles.hint}>
        Your characters live in this browser. Export or download a file to keep a copy off this
        device, and restore it here whenever you need it. Importing or restoring always{' '}
        <strong>adds</strong> characters as new records — existing characters are never overwritten.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className={styles.fileInput}
        onChange={(e) => void handleFileChosen(e)}
        aria-label="Choose a character JSON file to import"
      />

      <section className={styles.group} aria-labelledby="data-backup-this-character">
        <h3 id="data-backup-this-character" className={styles.groupTitle}>
          This character
        </h3>
        <p className={styles.hint}>
          Export <strong>{character.name || 'the current character'}</strong> to a{' '}
          <code>.json</code> file (portrait included). Import also accepts a full backup file and
          routes it to the restore step.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() => void handleExport()}
            disabled={busy}
          >
            <Download size={16} aria-hidden="true" />
            Export current character
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={openFilePicker}
            disabled={busy}
          >
            <Upload size={16} aria-hidden="true" />
            {busy ? 'Working…' : 'Import from file'}
          </button>
        </div>
      </section>

      <section className={styles.group} aria-labelledby="data-backup-all-characters">
        <h3 id="data-backup-all-characters" className={styles.groupTitle}>
          All characters
        </h3>
        <p className={styles.hint}>
          The full backup file holds every character and is your off-device safety net. Restore it
          here to bring them back.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() => void handleDownload()}
            disabled={busy}
          >
            <Download size={16} aria-hidden="true" />
            {busy ? 'Working…' : 'Download full backup'}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={openFilePicker}
            disabled={busy}
          >
            <ArchiveRestore size={16} aria-hidden="true" />
            Restore from backup file
          </button>
        </div>
      </section>

      <section className={styles.group} aria-labelledby="data-backup-auto">
        <h3 id="data-backup-auto" className={styles.groupTitle}>
          Automatic safety net
        </h3>
        <p className={styles.hint}>
          Keeps a small rolling set of automatic backups of <strong>all</strong> your characters.
          They live only in this browser, so clearing site data removes them — download a full
          backup file for real safety.
        </p>

        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>
            <span className={styles.settingName}>Automatic backups</span>
            <span className={styles.settingHint}>
              {autoBackupEnabled ? 'On' : 'Off'} — kept only in this browser.
            </span>
          </span>
          <label className={styles.toggleControl}>
            <input
              type="checkbox"
              checked={autoBackupEnabled}
              aria-label="Enable automatic backups"
              onChange={(e) => handleToggle(e.target.checked)}
            />
            <span>{autoBackupEnabled ? 'On' : 'Off'}</span>
          </label>
        </div>

        <p className={backupReminder.show ? styles.reminderWarn : styles.reminder}>
          {reminderText}
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() => setShowSnapshots((v) => !v)}
            disabled={busy}
            aria-expanded={showSnapshots}
          >
            <History size={16} aria-hidden="true" />
            Restore from auto-backup
          </button>
        </div>

        {showSnapshots && (
          <div className={styles.snapshotList}>
            {snapshotsError && (
              <p className={styles.error} role="alert">
                {snapshotsError}
              </p>
            )}
            {!snapshotsError && snapshots.length === 0 && (
              <p className={styles.ok}>No automatic backups yet.</p>
            )}
            {snapshots.map((snap) => (
              <button
                key={snap.seq}
                type="button"
                className={styles.snapshotItem}
                onClick={() => void handleChooseSnapshot(snap.seq)}
                disabled={busy}
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span className={styles.snapshotTime}>{formatSnapshotTime(snap.exportedAt)}</span>
                <span className={styles.snapshotCount}>
                  {snap.characterCount} character{snap.characterCount !== 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {status.kind !== 'idle' && (
        <p
          className={status.kind === 'error' ? styles.error : styles.ok}
          role={status.kind === 'error' ? 'alert' : 'status'}
        >
          {status.text}
        </p>
      )}

      {restorePlan && (
        <RestoreConfirmDialog
          characterCount={restorePlan.characterCount}
          characterNames={restorePlan.characterNames}
          duplicateNames={restorePlan.duplicateNames}
          onConfirm={() => void handleConfirmRestore()}
          onCancel={() => setRestorePlan(null)}
        />
      )}
    </Card>
  );
}
