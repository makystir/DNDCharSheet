import { BACKUP_STALE_DAYS, getBackupReminder } from './backup-reminder';
import type { BackupReminderState } from './backup-reminder';

/**
 * Export tracking for Dungeon Master data. DM data is exported with its own
 * file (see dm-store), separate from the player's bulk backup, so it keeps its
 * own last-export timestamp. The staleness rule is the player's
 * (getBackupReminder, BACKUP_STALE_DAYS = 14 days), reused as is.
 * Reliability nudge, no game mechanic: no rulebook citation applies.
 */
export const DM_LAST_EXPORT_KEY = 'dnd-dm-last-export-at';
/** Holds the last-export marker the user dismissed the nudge for. */
export const DM_BACKUP_DISMISSED_KEY = 'dnd-dm-backup-nudge-dismissed';

/** Record that DM data was just exported (ms since epoch). */
export function recordDmExport(now: number = Date.now()): void {
  try {
    localStorage.setItem(DM_LAST_EXPORT_KEY, String(now));
  } catch {
    // Storage unavailable: the nudge simply keeps showing.
  }
}

/** The last DM export time, or null if never exported / unreadable. */
export function getDmLastExportAt(): number | null {
  try {
    const raw = localStorage.getItem(DM_LAST_EXPORT_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function marker(lastExportAt: number | null): string {
  return lastExportAt === null ? 'never' : String(lastExportAt);
}

/** Dismiss the nudge until the next export (a new export changes the marker). */
export function dismissDmBackupNudge(lastExportAt: number | null): void {
  try {
    localStorage.setItem(DM_BACKUP_DISMISSED_KEY, marker(lastExportAt));
  } catch {
    // Storage unavailable: the dismissal lasts for this session only.
  }
}

function isDismissed(lastExportAt: number | null): boolean {
  try {
    return localStorage.getItem(DM_BACKUP_DISMISSED_KEY) === marker(lastExportAt);
  } catch {
    return false;
  }
}

/**
 * Whether to show the DM backup nudge. Nothing to lose without a campaign, so
 * an empty document never nudges. Dismissal holds until the next export.
 */
export function getDmBackupNudge(
  hasCampaigns: boolean,
  lastExportAt: number | null,
  now: number,
  staleDays: number = BACKUP_STALE_DAYS,
): BackupReminderState {
  const reminder = getBackupReminder(lastExportAt, now, staleDays);
  if (!hasCampaigns || isDismissed(lastExportAt)) return { ...reminder, show: false };
  return reminder;
}