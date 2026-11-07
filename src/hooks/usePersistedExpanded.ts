import { useCallback, useEffect, useState } from 'react';

/**
 * Read the expanded state from localStorage.
 * Returns undefined if not found or on error (graceful fallback).
 */
function readPersistedState(storageKey: string): boolean | undefined {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Write the expanded state to localStorage.
 * Silently swallows errors (quota exceeded, private browsing, etc.) and
 * continues with in-memory state only.
 */
function writePersistedState(storageKey: string, expanded: boolean): void {
  try {
    localStorage.setItem(storageKey, String(expanded));
  } catch {
    // Graceful fallback: continue with in-memory state only
  }
}

/**
 * Expand/collapse state persisted under `storageKey` in localStorage. Shared by
 * CollapsibleSection and the collapsible card headers (SectionHeader
 * `collapsible`) so both read and write the same 'true' / 'false' values.
 */
export function usePersistedExpanded(
  storageKey: string,
  defaultExpanded = true,
): [expanded: boolean, toggle: () => void] {
  const [expanded, setExpanded] = useState<boolean>(() => {
    const persisted = readPersistedState(storageKey);
    return persisted ?? defaultExpanded;
  });

  // Sync with storageKey changes (e.g. character switch).
  // Intentional setState-in-effect: reads persisted expand/collapse state from
  // localStorage (an external system) when the storageKey changes.
  useEffect(() => {
    const persisted = readPersistedState(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded(persisted ?? defaultExpanded);
  }, [storageKey, defaultExpanded]);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      writePersistedState(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return [expanded, toggle];
}
