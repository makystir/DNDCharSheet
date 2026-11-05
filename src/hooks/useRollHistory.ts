import { useMemo } from 'react';
import type { Character } from '../types/character';
import {
  rollEventsToHistory,
  type RollHistoryEntry,
} from '../components/shared/rollHistoryAdapter';

/**
 * Per-character roll-history hook (Stage B7).
 *
 * Derives the newest-first roll list from `character.eventLog` (category
 * `roll`) via the shared adapter, and exposes a `clearHistory` that routes
 * through the caller's edit path. This is the per-character path — it does NOT
 * use any global localStorage key (the WFRP global `useRollHistory` is
 * deprecated precisely because it mixed characters).
 *
 * @param character the active character (or undefined before one is ready)
 * @param onClear   clears the roll history (the App wires this to
 *                  `handleChange(clearEventLog(character))`)
 */
export function useRollHistory(
  character: Character | undefined,
  onClear: () => void,
): {
  history: RollHistoryEntry[];
  clearHistory: () => void;
} {
  const history = useMemo(
    () => rollEventsToHistory(character?.eventLog ?? []),
    [character?.eventLog],
  );
  return { history, clearHistory: onClear };
}
