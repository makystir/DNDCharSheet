/**
 * IndexedDB-backed persistence for characters.
 *
 * A thin promise wrapper over a single object store keyed by character id.
 * IndexedDB is used (rather than localStorage) so later stages can store
 * larger data — portraits, spell lists, inventory — without hitting the
 * ~5 MB localStorage ceiling.
 */

import type { Character } from '../types/character';
import { BLANK_CHARACTER, CURRENT_VERSION } from '../types/character';
import { migrateCharacter } from './migration';

const DB_NAME = 'dnd-char-sheet';
const DB_VERSION = 1;
const STORE_NAME = 'characters';

let dbPromise: Promise<IDBDatabase> | null = null;
let openDbInstance: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      openDbInstance = request.result;
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });

  return dbPromise;
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

/** Generates a stable unique id for a new character. */
export function newCharacterId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID.
  return `char-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Creates a fresh character (not yet persisted) with a real id and timestamps.
 */
export function createCharacter(name = ''): Character {
  const now = Date.now();
  return {
    ...BLANK_CHARACTER,
    _v: CURRENT_VERSION,
    id: newCharacterId(),
    name,
    abilities: { ...BLANK_CHARACTER.abilities },
    // Detach the mutable default maps so edits to one character never alias
    // another. Shallow spread is sufficient while these defaults are flat:
    // saveProficiencies holds only primitives, and skills defaults to {} (no
    // nested values to alias). INVARIANT: if a future stage ships a non-empty
    // default `skills`, copy each SkillTraining entry per-entry here (e.g.
    // Object.fromEntries(Object.entries(src).map(([k, v]) => [k, { ...v }])))
    // to avoid sharing the nested objects across characters.
    skills: { ...BLANK_CHARACTER.skills },
    saveProficiencies: { ...BLANK_CHARACTER.saveProficiencies },
    // Stage-7 Personal Details fields (alignment/faith/sex/age/height/weight/
    // eyes/hair/skin/background/personality) default to unset via the spread
    // above — they are primitive strings, so there is no shared reference to
    // detach (unlike the maps copied above).
    // Stage-8 `spellcasting` likewise defaults to unset via the spread (absent =
    // no spellcasting state, a valid state); no nested default map to detach.
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Returns all stored characters, most recently updated first.
 *
 * Every record is run through the versioned `migrateCharacter` pipeline on the
 * way out (Stage B2) so callers only ever see a CURRENT_VERSION character — a
 * stale-version or legacy (no `_v`) record is upgraded before the app uses it.
 * At v1 this is an identity no-op; it becomes meaningful when a future breaking
 * change bumps CURRENT_VERSION.
 */
export async function listCharacters(): Promise<Character[]> {
  const db = await openDb();
  const all = await promisifyRequest(tx(db, 'readonly').getAll() as IDBRequest<Character[]>);
  return all.map(migrateCharacter).sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Loads a single character by id, or null if not found. The record is run
 * through the versioned `migrateCharacter` pipeline on read (Stage B2) so the
 * caller always receives a CURRENT_VERSION character (identity no-op at v1).
 */
export async function getCharacter(id: string): Promise<Character | null> {
  const db = await openDb();
  const result = await promisifyRequest(tx(db, 'readonly').get(id) as IDBRequest<Character | undefined>);
  return result ? migrateCharacter(result) : null;
}

/**
 * Persists a character, stamping updatedAt. Returns the saved record.
 */
export async function saveCharacter(character: Character): Promise<Character> {
  const db = await openDb();
  const toSave: Character = { ...character, updatedAt: Date.now() };
  await promisifyRequest(tx(db, 'readwrite').put(toSave));
  return toSave;
}

/** Deletes a character by id. */
export async function deleteCharacter(id: string): Promise<void> {
  const db = await openDb();
  await promisifyRequest(tx(db, 'readwrite').delete(id));
}

/**
 * Test-only: closes any open connection and clears the cached promise so a
 * fresh DB can be opened. Closing is required before deleteDatabase, otherwise
 * the delete request blocks on the still-open connection.
 */
export function _resetDbForTests(): void {
  if (openDbInstance) {
    openDbInstance.close();
    openDbInstance = null;
  }
  dbPromise = null;
}
