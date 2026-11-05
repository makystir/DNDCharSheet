import { useCallback } from 'react';
import type { PageSection } from '../layout/navItems';
import type { D20Mode } from '../../logic/dice';
import type { SuggestionAction } from '../../logic/assistant/types';
import { assembleBackup, downloadBackup } from '../../storage/backup-service';

/**
 * The shell state a seeded roll opens the B7 `RollDialog` with. The Exhaustion
 * level is NOT carried here — the shell reads it off the active character when
 * it mounts the dialog (RollDialogProps.exhaustionLevel), exactly as the shell
 * Roll button does.
 */
export interface AssistantRollSeed {
  label: string;
  dc?: number;
  initialMode?: D20Mode;
}

export interface UseAssistantActionsArgs {
  /** The existing navigate(page, subTab) threaded through App.tsx. */
  navigate: (page: PageSection, subTab?: string | null) => void;
  /** Opens the shell's B7 `RollDialog` seeded for a suggestion's roll action. */
  openRoll: (seed: AssistantRollSeed) => void;
  /**
   * Optional: invoked AFTER a successful `backup-file` export so the shell can
   * refresh `lastBackupAt`/`now` and clear the stale nudge. Optional so the
   * existing call site/tests compile unchanged.
   */
  onFileBackedUp?: () => void;
}

/**
 * Maps a serializable `SuggestionAction` descriptor to the real, player-confirmed
 * app handler already in scope. The dispatcher NEVER applies a mutation:
 * `navigate` just routes, `roll` only SEEDS the shared B7 `RollDialog` (the
 * player still rolls and confirms), and `backup-file` runs the EXISTING bulk
 * file export (a user-gesture download). It never writes to character state.
 */
export function useAssistantActions({
  navigate,
  openRoll,
  onFileBackedUp,
}: UseAssistantActionsArgs): (action: SuggestionAction) => void {
  return useCallback(
    (action: SuggestionAction) => {
      switch (action.kind) {
        case 'navigate':
          navigate(action.page, action.subTab);
          break;
        case 'roll':
          // Seed the shared RollDialog; the player resolves and logs the roll.
          openRoll({ label: action.label, dc: action.dc, initialMode: action.initialMode });
          break;
        case 'backup-file': {
          // One-tap: run the EXISTING bulk file export (user-gesture download).
          // downloadBackup already records the backup timestamp; on success we
          // notify the shell so the stale nudge clears. Fire-and-forget: the
          // dispatcher stays sync for existing callers.
          void (async () => {
            const r = await assembleBackup();
            if (r.ok) {
              const dl = downloadBackup(r.payload);
              if (dl.ok) onFileBackedUp?.();
            }
          })();
          break;
        }
        default: {
          // Compile-time exhaustiveness guard: any future action.kind the UI
          // does not understand (e.g. from a later async source) is a no-op
          // plus a warning — never a crash.
          const _exhaustive: never = action;
          console.warn('Assistant: unknown action', _exhaustive);
        }
      }
    },
    [navigate, openRoll, onFileBackedUp],
  );
}
