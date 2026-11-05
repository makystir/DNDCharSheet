/**
 * Multi-character manager (Stage B1).
 *
 * This is the INDEX / active-id / orchestration layer that sits ON TOP of the
 * existing IndexedDB `character-store` (which already does all the real
 * persistence: listCharacters / getCharacter / saveCharacter / deleteCharacter,
 * keyed by `Character.id`, newest-`updatedAt` first).
 *
 * Ported STRUCTURE + UX from the WFRP app's `src/storage/character-manager.ts`,
 * re-themed onto this app's store:
 *   - WFRP keeps its own localStorage index (id → summary) because its store is
 *     localStorage-per-character. This app's store ALREADY returns the full
 *     list from IndexedDB, so the "index" here is just a derived list of
 *     lightweight summaries computed from the store — no second source of truth.
 *   - The ACTIVE id is the one piece of manager state the store does not own, so
 *     it is persisted separately in localStorage (same idea as WFRP's
 *     `index.activeId`). On reload the app reopens the active character rather
 *     than merely "the most recent".
 *   - Duplicate copies the portrait association; delete cleans the portrait up —
 *     mirroring the WFRP character-manager portrait handling (see the WFRP
 *     `__tests__/character-manager.portrait*.test.ts` for the intended
 *     behaviour).
 *
 * No D&D rules math lives here (Bucket-1 port): this is pure UI/infra plumbing.
 */

import type { Character } from '../types/character';
import {
  createCharacter as storeCreateCharacter,
  listCharacters as storeListCharacters,
  getCharacter as storeGetCharacter,
  saveCharacter as storeSaveCharacter,
  deleteCharacter as storeDeleteCharacter,
} from './character-store';
import { getPortraitStore } from './portrait-store';
import { CLASS_CATALOG } from '../data/classes';

const ACTIVE_ID_KEY = 'dnd-active-character-id';

/**
 * Character-change listener set (B3 auto-backup durability plumbing — no
 * rulebook citation applies). Mirrors the WFRP character-manager change signal
 * (lines 29-47) so the snapshot controller can throttle rolling auto-backups
 * after a consistent save. A listener fault is contained per-listener so it can
 * NEVER break the live save path.
 */
const changeListeners = new Set<() => void>();

/** Subscribe to consistent character-data changes. Returns an unsubscribe fn. */
export function onCharacterDataChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => {
    changeListeners.delete(fn);
  };
}

/** Notify all subscribers of a character-data change (faults contained). */
export function notifyCharacterDataChange(): void {
  changeListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // A listener fault must never break a save.
    }
  });
}

/**
 * A lightweight, display-only summary of a stored character used by the
 * management sheet's card list. Derived from the full `Character` record; the
 * store remains the single source of truth (mirrors WFRP's `CharacterSummary`,
 * re-themed to D&D fields — class + level instead of career/careerLevel).
 */
export interface CharacterSummary {
  id: string;
  name: string;
  /** Human-readable class name, or '' if no class chosen. */
  className: string;
  /** Total character level. */
  level: number;
  /** updatedAt epoch ms (newest first ordering). */
  updatedAt: number;
}

/** Builds the display summary for a single character. */
export function toSummary(character: Character): CharacterSummary {
  const classId = character.class?.id;
  const className = classId ? (CLASS_CATALOG[classId]?.name ?? '') : '';
  return {
    id: character.id,
    name: character.name,
    className,
    level: character.level,
    updatedAt: character.updatedAt,
  };
}

/** Reads the persisted active-character id, or '' when none is set. */
export function getActiveCharacterId(): string {
  try {
    return localStorage.getItem(ACTIVE_ID_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Persists the active-character id (empty string clears it). */
export function setActiveCharacterId(id: string): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_ID_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_ID_KEY);
    }
  } catch {
    // Private browsing / storage full — the active id simply won't persist
    // across reloads, which degrades to "open the most recent" (store order).
  }
}

/** Returns every stored character as a summary, newest-updated first. */
export async function listSummaries(): Promise<CharacterSummary[]> {
  const all = await storeListCharacters();
  return all.map(toSummary);
}

/**
 * Resolves which character should be active, persisting + returning it.
 *
 * Preference order: the persisted active id (if it still exists), else the most
 * recently updated character, else null when the store is empty. The resolved
 * id is written back so a stale/missing active id self-heals.
 */
export async function resolveActiveCharacter(): Promise<Character | null> {
  const all = await storeListCharacters();
  if (all.length === 0) {
    setActiveCharacterId('');
    return null;
  }
  const activeId = getActiveCharacterId();
  const active = activeId ? all.find((c) => c.id === activeId) : undefined;
  const resolved = active ?? all[0];
  setActiveCharacterId(resolved.id);
  return resolved;
}

/**
 * Creates and persists a fresh blank character, making it active. Does NOT
 * touch any existing characters (the store is keyed by id). Returns the saved
 * record.
 */
export async function createCharacter(name = ''): Promise<Character> {
  const saved = await storeSaveCharacter(storeCreateCharacter(name));
  setActiveCharacterId(saved.id);
  return saved;
}

/**
 * Persists an already-built character (e.g. from the creation wizard / random
 * generator / skip flow) and makes it active. Returns the saved record.
 */
export async function adoptCharacter(character: Character): Promise<Character> {
  const saved = await storeSaveCharacter(character);
  setActiveCharacterId(saved.id);
  return saved;
}

/** Loads the character with `id` and marks it active. Returns null if missing. */
export async function switchCharacter(id: string): Promise<Character | null> {
  const loaded = await storeGetCharacter(id);
  if (!loaded) return null;
  setActiveCharacterId(id);
  return loaded;
}

/**
 * Deep-copies a character under a new id with a "(Copy)" name, copies its
 * portrait association, persists the copy, and makes it active. Returns the
 * saved copy, or null if the source no longer exists.
 */
export async function duplicateCharacter(id: string): Promise<Character | null> {
  const original = await storeGetCharacter(id);
  if (!original) return null;

  const copy = storeCreateCharacter(`${original.name} (Copy)`);
  // Deep-copy every field of the original EXCEPT the identity/timestamps the
  // fresh record already owns (id/createdAt/updatedAt are set by the store).
  const cloned: Character = {
    ...structuredClone(original),
    id: copy.id,
    createdAt: copy.createdAt,
    updatedAt: copy.updatedAt,
    name: `${original.name} (Copy)`,
  };
  const saved = await storeSaveCharacter(cloned);

  // Copy the portrait association (WFRP character-manager portrait parity): the
  // portrait blob is keyed by character id in a separate store, so a duplicate
  // needs its own copy under the new id. Portrait store degrades gracefully, so
  // a copy failure never blocks the duplication.
  const portraits = getPortraitStore();
  const blobResult = await portraits.getPortraitBlob(id);
  if (blobResult.ok && blobResult.value) {
    await portraits.savePortrait(saved.id, blobResult.value);
  }

  setActiveCharacterId(saved.id);
  return saved;
}

/**
 * Renames the character with `id`, stamping updatedAt (via the store). Returns
 * the saved record, or null if missing.
 */
export async function renameCharacter(id: string, name: string): Promise<Character | null> {
  const loaded = await storeGetCharacter(id);
  if (!loaded) return null;
  return storeSaveCharacter({ ...loaded, name });
}

/**
 * Result of a delete: whether the deleted character WAS the active one, and the
 * id that should become active next (the most-recent remaining, or '' when the
 * last character was deleted → the caller shows the welcome screen).
 */
export interface DeleteResult {
  deletedWasActive: boolean;
  nextActiveId: string;
}

/**
 * Deletes the character with `id` from the store AND cleans up its portrait.
 * If the deleted character was active, falls back to the next most-recently-
 * updated remaining character, or to no active character (welcome) when the
 * last one is deleted. The resolved next active id is persisted.
 */
export async function deleteCharacter(id: string): Promise<DeleteResult> {
  const wasActive = getActiveCharacterId() === id;

  await storeDeleteCharacter(id);
  // Portrait cleanup (WFRP deleteCharacterFull parity). Degrades gracefully.
  await getPortraitStore().deletePortrait(id);

  const remaining = await storeListCharacters();
  let nextActiveId = getActiveCharacterId();
  if (wasActive) {
    nextActiveId = remaining.length > 0 ? remaining[0].id : '';
    setActiveCharacterId(nextActiveId);
  }
  return { deletedWasActive: wasActive, nextActiveId };
}
