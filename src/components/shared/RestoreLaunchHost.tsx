import { useEffect, useRef, useState } from 'react';
import { RestoreLaunchDialog } from './RestoreLaunchDialog';
import { RestoreConfirmDialog } from './RestoreConfirmDialog';
import { getSnapshotStore } from '../../storage/snapshot-store';
import { isAutoBackupEnabled } from '../../storage/snapshot-settings';
import {
  evaluateLaunchDiscrepancy,
  restoreFromSnapshot,
  commitSnapshotRestore,
  type LaunchPrompt,
  type SnapshotRestorePlan,
} from '../../storage/snapshot-service';

/**
 * Restore-on-launch host (B3 auto-backup §4). Owns the run-once mount check
 * (`evaluateLaunchDiscrepancy`) and renders `RestoreLaunchDialog` ONLY when a
 * genuine discrepancy is found. On Restore it routes through the existing
 * validated, non-destructive restore path (`restoreFromSnapshot` ->
 * `RestoreConfirmDialog` -> `commitSnapshotRestore`) and then calls
 * `onRestored()` so the shell can refresh its roster. On Decline it clears state
 * and leaves snapshots intact.
 *
 * Gated by `isAutoBackupEnabled()`. Set-state happens inside the async callback
 * (not synchronously in the effect body), so there is no set-state-in-effect.
 *
 * B3 durability infra, no game mechanics — no rulebook citation applies.
 */
interface RestoreLaunchHostProps {
  /** Called after a successful restore so the shell can refresh its roster. */
  onRestored: () => void;
}

function formatTimestamp(exportedAt: string): string {
  const d = new Date(exportedAt);
  if (Number.isNaN(d.getTime())) return exportedAt || 'an earlier time';
  return d.toLocaleString();
}

export function RestoreLaunchHost({ onRestored }: RestoreLaunchHostProps) {
  const [launchPrompt, setLaunchPrompt] = useState<LaunchPrompt | null>(null);
  const [restorePlan, setRestorePlan] = useState<SnapshotRestorePlan | null>(null);
  const launchCheckedRef = useRef(false);

  // Run-once mount check. Set-state happens inside the async callback (not
  // synchronously in the effect body), so there is no set-state-in-effect.
  useEffect(() => {
    if (launchCheckedRef.current) return;
    launchCheckedRef.current = true;
    if (!isAutoBackupEnabled()) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await evaluateLaunchDiscrepancy(getSnapshotStore());
        if (!cancelled && result) setLaunchPrompt(result);
      } catch {
        // No prompt on failure; already logged at most in the service.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRestoreClick = async () => {
    if (!launchPrompt) return;
    const outcome = await restoreFromSnapshot(getSnapshotStore(), launchPrompt.seq);
    setLaunchPrompt(null);
    if (outcome.ok) {
      setRestorePlan(outcome.plan);
    }
    // On a graceful validation failure there is nothing to restore; the prompt
    // is dismissed and live data is untouched.
  };

  const handleConfirmRestore = async () => {
    if (!restorePlan) return;
    const plan = restorePlan;
    setRestorePlan(null);
    await commitSnapshotRestore(getSnapshotStore(), plan);
    onRestored();
  };

  if (restorePlan) {
    return (
      <RestoreConfirmDialog
        characterCount={restorePlan.characterCount}
        characterNames={restorePlan.characterNames}
        duplicateNames={restorePlan.duplicateNames}
        onConfirm={() => void handleConfirmRestore()}
        onCancel={() => setRestorePlan(null)}
      />
    );
  }

  if (launchPrompt) {
    return (
      <RestoreLaunchDialog
        exportedAtLabel={formatTimestamp(launchPrompt.exportedAt)}
        onRestore={() => void handleRestoreClick()}
        onDecline={() => setLaunchPrompt(null)}
      />
    );
  }

  return null;
}
