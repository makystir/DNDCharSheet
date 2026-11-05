import type { Character } from '../../../types/character';
import type { Suggestion, SuggestionContext } from '../types';
import { getBackupReminder } from '../../../storage/backup-reminder';

/**
 * File-backup nudge (B3 data-safety UX).
 *
 * When it has been a while since the user made a FILE backup, surface a single
 * Assistant suggestion whose one-tap action triggers the EXISTING bulk file
 * export (kind: 'backup-file').
 *
 * REUSES `backup-reminder.ts`'s time-tracking (`getBackupReminder`,
 * `BACKUP_STALE_DAYS`) — it does not fork or add a parallel timer. `now` and
 * `lastBackupAt` are threaded through `SuggestionContext` by the shell, so the
 * pure engine performs no storage read / `Date.now()` at eval time.
 *
 * PURITY: the module NEVER calls `Date.now()` itself — a `now` the shell did
 * not thread in (undefined `ctx.now`) yields NO nudge rather than falling back
 * to the clock, so `getSuggestions` stays a pure function of its inputs. The
 * shell always threads `ctx.now`, so the nudge fires normally in the app.
 *
 * Reliability nudge, no game mechanic — no rulebook citation applies.
 */
export function fileBackupSuggestions(_character: Character, ctx: SuggestionContext): Suggestion[] {
  // Not during combat — avoid competing with combat prompts / no spam.
  if (ctx.inCombat) return [];

  // No clock snapshot threaded in ⇒ no nudge (keeps the engine pure; we never
  // read Date.now() here).
  if (ctx.now === undefined) return [];

  const now = ctx.now;
  const lastBackupAt = ctx.lastBackupAt ?? null;
  const reminder = getBackupReminder(lastBackupAt, now);
  if (!reminder.show) return []; // recent file backup ⇒ silent

  return [
    {
      id: 'backup:file-stale',
      title: 'Back up your characters to a file',
      rationale: reminder.never
        ? 'You have no saved file backup yet. Characters live in this browser only.'
        : `It has been ${reminder.daysSince} days since your last file backup.`,
      category: 'resource',
      urgency: 'info',
      action: { kind: 'backup-file' },
    },
  ];
}
