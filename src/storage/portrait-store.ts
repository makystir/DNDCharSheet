/**
 * Portrait Store — IndexedDB storage for character portrait Blobs.
 *
 * Portrait images are stored as raw Blobs in a SEPARATE IndexedDB database
 * (`dnd-portraits`), keyed by character id, so they never bloat the character
 * JSON record in the `dnd-char-sheet` DB. This mirrors the WFRP app's separate
 * portrait DB, but is re-implemented on the module-singleton idiom used by this
 * project's `character-store.ts` (not WFRP's class + init()), so the
 * close-before-delete test-reset gotcha is handled identically.
 *
 * NO codec: WFRP's portrait-codec exists only for base64 export/import and its
 * localStorage→IndexedDB migration, both out of scope here — we store the
 * uploaded Blob directly and let the browser decode it via createObjectURL.
 *
 * NO migration: this app has never stored portraits anywhere, so there is no
 * legacy data to move; the DB is created lazily on first open.
 *
 * Every public method degrades gracefully (returns a typed error result, never
 * throws) when IndexedDB is unavailable (e.g. private browsing).
 */

const DB_NAME = 'dnd-portraits';
const DB_VERSION = 1;
const STORE_NAME = 'portraits';

/** Result of a portrait operation. */
export type PortraitResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface IPortraitStore {
  /** Save a portrait Blob for a character. */
  savePortrait(characterId: string, blob: Blob): Promise<PortraitResult<void>>;
  /** Retrieve a portrait as an object URL, or null if none exists. */
  getPortraitURL(characterId: string): Promise<PortraitResult<string | null>>;
  /** Retrieve the raw portrait Blob, or null if none exists. */
  getPortraitBlob(characterId: string): Promise<PortraitResult<Blob | null>>;
  /** Delete a portrait for a character (deleting a missing id is a no-op). */
  deletePortrait(characterId: string): Promise<PortraitResult<void>>;
  /**
   * Every stored key that starts with `prefix` (companion portraits are keyed
   * `<characterId>:<recordId>`, so `<characterId>:` lists one sheet's set).
   */
  listKeysWithPrefix(prefix: string): Promise<PortraitResult<string[]>>;
  /** Revoke a previously created object URL (cleanup). */
  revokeURL(url: string): void;
}

let dbPromise: Promise<IDBDatabase> | null = null;
let openDbInstance: IDBDatabase | null = null;
let warnedOnOpenFailure = false;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Failed to open dnd-portraits.'));
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Out-of-line keys: the character id is supplied explicitly on put/get.
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      // Cache the resolved handle so _resetPortraitDbForTests can close it
      // before deleteDatabase (otherwise the delete request blocks).
      openDbInstance = request.result;
      resolve(request.result);
    };
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open dnd-portraits.'));
  });

  return dbPromise;
}

/** Open the DB, surfacing an open failure as a typed error (warned once). */
async function openOrError(): Promise<
  { ok: true; db: IDBDatabase } | { ok: false; error: string }
> {
  try {
    const db = await openDb();
    return { ok: true, db };
  } catch (err) {
    if (!warnedOnOpenFailure) {
      warnedOnOpenFailure = true;
      console.warn(
        '[portrait-store] IndexedDB unavailable — portraits are disabled this session.',
      );
    }
    return { ok: false, error: `Portrait store unavailable: ${errorMessage(err)}` };
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function getBlob(db: IDBDatabase, characterId: string): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(characterId);
    request.onsuccess = () => {
      const result = request.result;
      // A stored value may round-trip as a Blob (prod) or, under some test
      // environments, a different clone; treat any non-undefined stored value
      // as the portrait and null only when truly absent.
      resolve(result == null ? null : (result as Blob));
    };
    request.onerror = () => reject(request.error ?? new Error('Get request failed.'));
    tx.onerror = () => reject(tx.error ?? new Error('Transaction failed.'));
  });
}

function writeTransaction(
  db: IDBDatabase,
  operation: (store: IDBObjectStore) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    operation(tx.objectStore(STORE_NAME));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Transaction failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted.'));
  });
}

const store: IPortraitStore = {
  async savePortrait(characterId, blob) {
    const opened = await openOrError();
    if (!opened.ok) return opened;
    try {
      await writeTransaction(opened.db, (s) => s.put(blob, characterId));
      return { ok: true, value: undefined };
    } catch (err) {
      return { ok: false, error: `Failed to save portrait: ${errorMessage(err)}` };
    }
  },

  async getPortraitURL(characterId) {
    const opened = await openOrError();
    if (!opened.ok) return opened;
    try {
      const blob = await getBlob(opened.db, characterId);
      if (!blob) return { ok: true, value: null };
      return { ok: true, value: URL.createObjectURL(blob) };
    } catch (err) {
      return { ok: false, error: `Failed to retrieve portrait URL: ${errorMessage(err)}` };
    }
  },

  async getPortraitBlob(characterId) {
    const opened = await openOrError();
    if (!opened.ok) return opened;
    try {
      return { ok: true, value: await getBlob(opened.db, characterId) };
    } catch (err) {
      return { ok: false, error: `Failed to retrieve portrait blob: ${errorMessage(err)}` };
    }
  },

  async deletePortrait(characterId) {
    const opened = await openOrError();
    if (!opened.ok) return opened;
    try {
      // IndexedDB delete of a non-existent key is itself a successful no-op.
      await writeTransaction(opened.db, (s) => s.delete(characterId));
      return { ok: true, value: undefined };
    } catch (err) {
      return { ok: false, error: `Failed to delete portrait: ${errorMessage(err)}` };
    }
  },

  async listKeysWithPrefix(prefix) {
    const opened = await openOrError();
    if (!opened.ok) return opened;
    try {
      const keys = await new Promise<string[]>((resolve, reject) => {
        const tx = opened.db.transaction(STORE_NAME, 'readonly');
        // Every key from `prefix` up to `prefix` + the highest BMP character.
        const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
        const request = tx.objectStore(STORE_NAME).getAllKeys(range);
        request.onsuccess = () => resolve(request.result.filter((k): k is string => typeof k === 'string'));
        request.onerror = () => reject(request.error ?? new Error('Key listing failed.'));
      });
      return { ok: true, value: keys };
    } catch (err) {
      return { ok: false, error: `Failed to list portraits: ${errorMessage(err)}` };
    }
  },

  revokeURL(url) {
    URL.revokeObjectURL(url);
  },
};

/** Returns the singleton portrait store. */
export function getPortraitStore(): IPortraitStore {
  return store;
}

/**
 * Test-only: closes any open connection and clears the cached promise so a
 * fresh DB can be opened. Closing is required before deleteDatabase, otherwise
 * the delete request blocks on the still-open connection (same gotcha as
 * character-store._resetDbForTests).
 */
export function _resetPortraitDbForTests(): void {
  if (openDbInstance) {
    openDbInstance.close();
    openDbInstance = null;
  }
  dbPromise = null;
  warnedOnOpenFailure = false;
}
