import { useCallback, useEffect, useRef, useState } from 'react';
import { Save, Download, History, RotateCcw } from 'lucide-react';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { RestoreConfirmDialog } from '../shared/RestoreConfirmDialog';
import { assembleBackup, downloadBackup } from '../../storage/backup-service';
import { getLastBackupAt, getBackupReminder } from '../../storage/backup-reminder';
import { isAutoBackupEnabled, setAutoBackupEnabled } from '../../storage/snapshot-settings';
import { getSnapshotStore } from '../../storage/snapshot-store';
import type { SnapshotMeta } from '../../storage/snapshot-store';
import {
  restoreFromSnapshot,
  commitSnapshotRestore,
  type SnapshotRestorePlan,
} from '../../storage/snapshot-service';
import styles from './AutoBackupCard.module.css';

export interface AutoBackupCardProps {
  /** Called after a successful restore so the shell can refresh its roster. */
  onRestored: () => void;
}

/** Transient status shown under the controls. */
type Status = { kind: 'idle' } | { kind: 'ok'; text: string } | { kind: 'error'; text: string };

function formatSnapshotTime(exportedAt: string): string {
  const d = new Date(exportedAt);
  if (Number.isNaN(d.getTime())) return exportedAt || 'unknown time';
  return d.toLocaleString();
}

/**
 * The Settings "Auto-backup" card (Stage B3). Follows the `ExportImportCard`
 * pattern (Card + SectionHeader + lucide icons + transient status).
 *
 *   - An auto-backup toggle bound to `isAutoBackupEnabled`/`setAutoBackupEnabled`.
 *   - A "Download full backup" button (`assembleBackup` -> `downloadBackup` over
 *     ALL characters, with a count/skipped message).
 *   - A "Restore from auto-backup" affordance listing snapshots by timestamp
 *     (`getSnapshotStore().listSnapshots()`); choosing one routes through
 *     `restoreFromSnapshot` -> `RestoreConfirmDialog` -> `commitSnapshotRestore`
 *     -> `onRestored()` (restore ADDS — it never overwrites a live character).
 *   - The backup reminder text (`getLastBackupAt` + `getBackupReminder`).
 *
 * B3 durability infra, no game mechanics — no rulebook citation applies.
 */
export function AutoBackupCard({ onRestored }: AutoBackupCardProps) {
  const [autoBackupEnabled, setAutoBackupEnabledState] = useState<boolean>(() =>
    isAutoBackupEnabled(),
  );
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(() => getLastBackupAt());
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);

  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  const [restorePlan, setRestorePlan] = useState<SnapshotRestorePlan | null>(null);

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

  const handleChooseSnapshot = async (seq: number) => {
    setStatus({ kind: 'idle' });
    const outcome = await restoreFromSnapshot(getSnapshotStore(), seq);
    if (!outcome.ok) {
      setStatus({ kind: 'error', text: outcome.error });
      return;
    }
    // Route through the SAME validated confirm path as the launch restore.
    setRestorePlan(outcome.plan);
  };

  const handleConfirmRestore = async () => {
    if (!restorePlan) return;
    const plan = restorePlan;
    setRestorePlan(null);
    setBusy(true);
    try {
      const summary = await commitSnapshotRestore(getSnapshotStore(), plan);
      let text = `Restored ${summary.imported} character${summary.imported !== 1 ? 's' : ''}.`;
      if (summary.skipped > 0) text += ` ${summary.skipped} skipped.`;
      if (summary.stoppedByQuota) text += ' Storage quota reached — some could not be imported.';
      setStatus({ kind: 'ok', text });
      await refreshSnapshots();
      onRestored();
    } finally {
      setBusy(false);
    }
  };

  const reminderText = backupReminder.never
    ? 'Last backed up: never'
    : `Last backed up ${backupReminder.daysSince} day${backupReminder.daysSince === 1 ? '' : 's'} ago`;

  return (
    <Card>
      <SectionHeader icon={Save} title="Auto-backup" />
      <p className={styles.hint}>
        Keeps a small rolling set of automatic backups of <strong>all</strong> your characters in
        this browser so a bad save can be recovered. This is a safety net — download a full backup
        file for off-device safety.
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

      <p className={backupReminder.show ? styles.reminderWarn : styles.reminder}>{reminderText}</p>

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
