import { useCallback, useEffect, useState } from 'react';

/** Display mode for list-like sections: detailed cards or a compact list. */
export type ViewMode = 'cards' | 'list';

/** Read a persisted view mode from localStorage, or undefined on miss/error. */
function readPersisted(storageKey: string): ViewMode | undefined {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === 'cards' || raw === 'list') return raw;
    return undefined;
  } catch {
    return undefined;
  }
}

/** Persist a view mode; silently ignores storage errors (quota, private mode). */
function writePersisted(storageKey: string, mode: ViewMode): void {
  try {
    localStorage.setItem(storageKey, mode);
  } catch {
    // Graceful fallback: keep in-memory state only.
  }
}

/**
 * View-mode preference (cards vs compact list) persisted to localStorage under
 * `storageKey`. Ported from PWACharSheet's src/hooks/useViewMode.ts; returns the
 * current mode plus a setter and a convenience toggle.
 */
export function useViewMode(
  storageKey: string,
  defaultMode: ViewMode = 'cards',
): { mode: ViewMode; setMode: (mode: ViewMode) => void; toggle: () => void } {
  const [mode, setModeState] = useState<ViewMode>(() => readPersisted(storageKey) ?? defaultMode);

  // Re-read when the storage key changes (e.g. character switch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModeState(readPersisted(storageKey) ?? defaultMode);
  }, [storageKey, defaultMode]);

  const setMode = useCallback(
    (next: ViewMode) => {
      setModeState(next);
      writePersisted(storageKey, next);
    },
    [storageKey],
  );

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next: ViewMode = prev === 'cards' ? 'list' : 'cards';
      writePersisted(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return { mode, setMode, toggle };
}
