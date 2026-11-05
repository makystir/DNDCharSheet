/**
 * Backup reminder tracking (B3 data-safety UX).
 *
 * Records when the player last downloaded a full backup so the UI can show a
 * gentle "you haven't backed up in a while" nudge. This is advisory only and
 * never blocks any action. Stored app-wide in localStorage (backups span all
 * characters, so this is not per-character).
 *
 * Ported from the WFRP app's `src/storage/backup-reminder.ts`, re-themed only
 * in the storage key prefix (wfrp- -> dnd-). B3 durability infra, no game
 * mechanics — no rulebook citation applies.
 */

export const LAST_BACKUP_KEY = 'dnd-last-backup-at';

/** Days after which a backup is considered stale and worth reminding about. */
export const BACKUP_STALE_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Record that a full backup just happened (ms since epoch). */
export function recordBackup(now: number = Date.now()): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(now));
  } catch {
    // Ignore — reminder simply won't update.
  }
}

/** Read the last-backup timestamp, or null if never backed up / unreadable. */
export function getLastBackupAt(): number | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export interface BackupReminderState {
  /** True when a reminder should be shown (never backed up, or stale). */
  show: boolean;
  /** Whole days since the last backup, or null if never backed up. */
  daysSince: number | null;
  /** True when there is no recorded backup at all. */
  never: boolean;
}

/**
 * Compute whether to nudge the player to back up. Pure given `lastBackupAt`
 * and `now`, so it is easy to test.
 */
export function getBackupReminder(
  lastBackupAt: number | null,
  now: number = Date.now(),
  staleDays: number = BACKUP_STALE_DAYS,
): BackupReminderState {
  if (lastBackupAt === null) {
    return { show: true, daysSince: null, never: true };
  }
  const daysSince = Math.floor((now - lastBackupAt) / MS_PER_DAY);
  return { show: daysSince >= staleDays, daysSince, never: false };
}
