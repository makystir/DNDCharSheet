/** The last creatures the DM added to an encounter from the Library or the Add combatants dialog (newest first). */
export const RECENT_CREATURES_KEY = 'dm:recentCreatures';
export const MAX_RECENT_CREATURES = 8;

export function loadRecentCreatures(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_CREATURES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string').slice(0, MAX_RECENT_CREATURES) : [];
  } catch {
    return [];
  }
}

/** Put a library key first (no duplicates, capped) and persist it. Storage failures are ignored. Returns the new list. */
export function recordRecentCreature(key: string): string[] {
  const next = [key, ...loadRecentCreatures().filter((k) => k !== key)].slice(0, MAX_RECENT_CREATURES);
  try {
    localStorage.setItem(RECENT_CREATURES_KEY, JSON.stringify(next));
  } catch {
    // Best-effort: keep going with the in-memory list.
  }
  return next;
}
