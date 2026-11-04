import { useCallback, useEffect, useState } from 'react';

/**
 * Dice-entry mode preference (Stage A5a).
 *
 * Ported from PWACharSheet's src/hooks/useDiceEntryMode.ts. This is a
 * per-player UI PREFERENCE, not a game mechanic or house rule: it does not
 * change any 2024 rule, only how a d20 value reaches the rules resolver. It is
 * therefore stored app-wide in localStorage (like the theme) rather than on a
 * character.
 *
 * - 'auto'   - the app rolls the dice for you (default).
 * - 'manual' - you enter the result from a physical die; the app still
 *              resolves the outcome with the same rules functions.
 *
 * Deviation from the PWA: the storage key and change-event name are renamed
 * for this app (dnd-dice-entry-mode).
 */
export type DiceEntryMode = 'auto' | 'manual';

export const DICE_ENTRY_MODE_KEY = 'dnd-dice-entry-mode';
export const DICE_ENTRY_MODE_EVENT = 'dnd-dice-entry-mode-change';

/** Synchronously read the current dice-entry mode from localStorage. */
export function getDiceEntryMode(): DiceEntryMode {
  try {
    return localStorage.getItem(DICE_ENTRY_MODE_KEY) === 'manual' ? 'manual' : 'auto';
  } catch {
    return 'auto';
  }
}

/** Persist the dice-entry mode. Safe to call in private-browsing / quota states. */
export function setDiceEntryModeStorage(mode: DiceEntryMode): void {
  try {
    localStorage.setItem(DICE_ENTRY_MODE_KEY, mode);
  } catch {
    // Ignore: the preference simply will not persist.
  }
}

/**
 * React hook exposing the dice-entry mode and a setter. Keeps multiple mounted
 * consumers (e.g. Settings and an open dialog) in sync within a tab via a
 * custom event, and across tabs via the native `storage` event.
 */
export function useDiceEntryMode(): {
  mode: DiceEntryMode;
  setMode: (mode: DiceEntryMode) => void;
} {
  const [mode, setModeState] = useState<DiceEntryMode>(() => getDiceEntryMode());

  useEffect(() => {
    const sync = () => setModeState(getDiceEntryMode());
    window.addEventListener('storage', sync);
    window.addEventListener(DICE_ENTRY_MODE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(DICE_ENTRY_MODE_EVENT, sync);
    };
  }, []);

  const setMode = useCallback((next: DiceEntryMode) => {
    setDiceEntryModeStorage(next);
    setModeState(next);
    // Notify other in-tab consumers (the `storage` event only fires cross-tab).
    window.dispatchEvent(new Event(DICE_ENTRY_MODE_EVENT));
  }, []);

  return { mode, setMode };
}
