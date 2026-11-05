import { useCallback, useEffect, useState } from 'react';
import type { Character } from '../types/character';
import type { CharacterSummary } from '../storage/character-manager';
import {
  listSummaries,
  resolveActiveCharacter,
  adoptCharacter as cmAdopt,
  switchCharacter as cmSwitch,
  duplicateCharacter as cmDuplicate,
  renameCharacter as cmRename,
  deleteCharacter as cmDelete,
  toSummary,
} from '../storage/character-manager';

/**
 * Loading phase for the manager, mirroring the App's existing status machine:
 *   - 'loading' while the first resolve is in flight,
 *   - 'welcome' when the store is empty (no characters),
 *   - 'ready' with an active character,
 *   - 'error' if the initial load throws.
 */
export type ManagerStatus = 'loading' | 'welcome' | 'ready' | 'error';

export interface UseCharacterManagerResult {
  status: ManagerStatus;
  errorMessage: string | null;
  characters: CharacterSummary[];
  activeId: string;
  activeCharacter: Character | null;
  /** Persist an edit to the active character (updates the in-memory list too). */
  updateActiveCharacter: (next: Character) => void;
  /** Persist an already-built character (wizard/random/skip) and make it active. */
  adoptCharacter: (next: Character) => Promise<Character>;
  switchCharacter: (id: string) => Promise<void>;
  duplicateCharacter: (id: string) => Promise<void>;
  renameCharacter: (id: string, name: string) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
  /**
   * Re-run the initial resolve (active character + summary list) and re-settle
   * the status machine. Used after a bulk restore (B3), which adopts new
   * records straight into the store/manager outside this hook's own actions.
   */
  reload: () => Promise<void>;
}

/**
 * React hook over the Stage-B1 character-manager. Owns `{ characters, activeId,
 * activeCharacter }` and the loading status, and exposes the create/switch/
 * duplicate/rename/delete orchestration. Ported from the WFRP
 * `useCharacterManager`, adapted to this app's ASYNC IndexedDB store (the WFRP
 * one is synchronous over localStorage) and to its LoadState status machine.
 */
export function useCharacterManager(): UseCharacterManagerResult {
  const [status, setStatus] = useState<ManagerStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [activeCharacter, setActiveCharacter] = useState<Character | null>(null);

  // Shared load body: resolve the active character (persisted id → most recent
  // → none) and the summary list, then settle into welcome/ready/error. Called
  // by both the mount effect and `reload()`. The optional cancellation guard
  // lets the mount effect drop a stale in-flight resolve on unmount.
  const runLoad = useCallback(async (isCancelled?: () => boolean) => {
    try {
      const active = await resolveActiveCharacter();
      const summaries = await listSummaries();
      if (isCancelled?.()) return;
      setCharacters(summaries);
      if (active) {
        setActiveCharacter(active);
        setActiveId(active.id);
        setStatus('ready');
      } else {
        setActiveCharacter(null);
        setActiveId('');
        setStatus('welcome');
      }
    } catch (err) {
      if (isCancelled?.()) return;
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to load character data.',
      );
      setStatus('error');
    }
  }, []);

  // Initial load on mount. The shared body is invoked inside an async IIFE so
  // every setState it performs happens only AFTER an awaited resolve, never
  // synchronously in the effect body (satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await runLoad(() => cancelled);
    })();
    return () => {
      cancelled = true;
    };
  }, [runLoad]);

  // Re-run the resolve after an out-of-band change (e.g. a bulk restore).
  const reload = useCallback(async () => {
    await runLoad();
  }, [runLoad]);

  // Local edit to the active character: update in-memory state immediately
  // (the caller already persists via the store), and refresh this character's
  // summary (name/level/updatedAt) in the list without a storage round-trip.
  const updateActiveCharacter = useCallback((next: Character) => {
    setActiveCharacter(next);
    setActiveId(next.id);
    setStatus('ready');
    setCharacters((prev) => {
      const summary = toSummary(next);
      const idx = prev.findIndex((c) => c.id === next.id);
      if (idx === -1) return [summary, ...prev];
      const copy = [...prev];
      copy[idx] = summary;
      return copy;
    });
  }, []);

  const adoptCharacter = useCallback(async (next: Character): Promise<Character> => {
    const saved = await cmAdopt(next);
    setActiveCharacter(saved);
    setActiveId(saved.id);
    setStatus('ready');
    setCharacters(await listSummaries());
    return saved;
  }, []);

  const switchCharacter = useCallback(async (id: string) => {
    const loaded = await cmSwitch(id);
    if (!loaded) return;
    setActiveCharacter(loaded);
    setActiveId(loaded.id);
    setStatus('ready');
    setCharacters(await listSummaries());
  }, []);

  const duplicateCharacter = useCallback(async (id: string) => {
    const copy = await cmDuplicate(id);
    if (!copy) return;
    setActiveCharacter(copy);
    setActiveId(copy.id);
    setStatus('ready');
    setCharacters(await listSummaries());
  }, []);

  const renameCharacter = useCallback(
    async (id: string, name: string) => {
      const saved = await cmRename(id, name);
      setCharacters(await listSummaries());
      if (saved && saved.id === activeId) {
        setActiveCharacter(saved);
      }
    },
    [activeId],
  );

  const deleteCharacter = useCallback(async (id: string) => {
    const { deletedWasActive, nextActiveId } = await cmDelete(id);
    const summaries = await listSummaries();
    setCharacters(summaries);
    if (deletedWasActive) {
      const loaded = nextActiveId ? await cmSwitch(nextActiveId) : null;
      if (loaded) {
        setActiveCharacter(loaded);
        setActiveId(loaded.id);
        setStatus('ready');
      } else {
        // Last character deleted — or the fallback record vanished between the
        // delete and the switch (a narrow race) — so there is nothing to show:
        // fall back to the welcome screen rather than leaving status 'ready'
        // with a null active character (which renders nothing).
        setActiveCharacter(null);
        setActiveId('');
        setStatus('welcome');
      }
    }
  }, []);

  return {
    status,
    errorMessage,
    characters,
    activeId,
    activeCharacter,
    updateActiveCharacter,
    adoptCharacter,
    switchCharacter,
    duplicateCharacter,
    renameCharacter,
    deleteCharacter,
    reload,
  };
}
