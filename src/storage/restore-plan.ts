/**
 * Pure import-kind detection + the shared restore-plan builder.
 *
 * A file the user picks in Settings is UNTRUSTED. `detectImportKind` only
 * routes it (single-character export vs. full multi-character backup); the real
 * validation still happens in `importFromJSON` / `validateBackupFile`, which are
 * not weakened here. `buildRestorePlan` is the single place a validated backup
 * becomes a confirm-dialog plan, shared by the in-browser snapshot restore and
 * the backup-file restore.
 *
 * B3 durability infra, no game mechanics — no rulebook citation applies.
 */

import type { BackupCharacterEntry } from './backup-types';
import { validateBackupFile, detectDuplicates } from './restore-service';

export type ImportKind = 'character' | 'backup' | 'unknown';

/** A validated backup ready for the confirm dialog + `restoreCharacters`. */
export interface RestorePlan {
  characterCount: number;
  characterNames: string[];
  duplicateNames: string[];
  characters: BackupCharacterEntry[];
}

export type RestorePlanOutcome =
  | { ok: true; plan: RestorePlan }
  | { ok: false; error: string };

/**
 * Classify a JSON string without trusting it.
 *  - 'backup'    : object with a `characters` array (even a newer-version one,
 *                  so `validateBackupFile` can report the precise version error)
 *  - 'character' : object with `name` and `abilities` (a single-character export)
 *  - 'unknown'   : unparsable, non-object, array, or neither shape
 */
export function detectImportKind(json: string): ImportKind {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return 'unknown';
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return 'unknown';
  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj.characters)) return 'backup';
  if ('name' in obj && 'abilities' in obj) return 'character';
  return 'unknown';
}

/**
 * Validate backup JSON (via the untouched `validateBackupFile` guard) and build
 * the confirm-dialog plan. Never mutates live data.
 */
export async function buildRestorePlan(json: string): Promise<RestorePlanOutcome> {
  const validation = validateBackupFile(json);
  if (!validation.ok) return { ok: false, error: validation.error };

  const characters = validation.characters;
  try {
    const duplicateNames = await detectDuplicates(characters);
    const characterNames = characters
      .map((c) => (c && c.character && typeof c.character.name === 'string' ? c.character.name : ''))
      .filter((n) => n.length > 0);

    return {
      ok: true,
      plan: {
        characterCount: validation.metadata.characterCount,
        characterNames,
        duplicateNames,
        characters,
      },
    };
  } catch {
    return { ok: false, error: 'Invalid backup file: unreadable character entries.' };
  }
}
