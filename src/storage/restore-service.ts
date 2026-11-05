/**
 * Restore service for bulk character backup import.
 * Handles validation, duplicate detection, and sequential character restoration.
 *
 * Ported from the WFRP app's `src/storage/restore-service.ts` and RE-BOUND to
 * this app's ASYNC manager + B2 migration:
 *   - `validateBackupFile` is ported verbatim (untrusted-input guards).
 *   - `detectDuplicates` compares against `listSummaries()` (async manager).
 *   - `restoreCharacters` validates the DND core keys (name/level/abilities,
 *     NOT WFRP's name/species/chars), runs each record through `runMigration`
 *     (B2), mints a FRESH id (the store put()s under the supplied key and does
 *     NOT mint one) so a restore NEVER overwrites an existing character, then
 *     `adoptCharacter` persists it and restores the portrait under the new id.
 *
 * B3 durability infra, no game mechanics — no rulebook citation applies.
 */

import type {
  ValidationResult,
  BackupMetadata,
  BackupCharacterEntry,
  ProgressCallback,
  RestoreSummary,
} from './backup-types';
import { adoptCharacter, listSummaries } from './character-manager';
import { newCharacterId } from './character-store';
import { getPortraitStore } from './portrait-store';
import { base64ToBlob, isValidPortraitDataUrl } from './portrait-codec';
import { runMigration } from './migration';

/**
 * Parse and validate a backup file string (treated as UNTRUSTED input).
 * Checks JSON validity, version compatibility, structure, and metadata
 * consistency. Ported verbatim from the WFRP validator (system-agnostic).
 */
export function validateBackupFile(json: string): ValidationResult {
  // 1. Try JSON.parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Invalid JSON: failed to parse backup file.' };
  }

  // 2. Must be a non-null, non-array object
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Invalid backup file: expected a JSON object.' };
  }

  const obj = parsed as Record<string, unknown>;

  // 3. Must have a numeric version field
  if (typeof obj.version !== 'number') {
    return { ok: false, error: 'Invalid backup file: missing version field.' };
  }

  // 4. Version must be <= 1
  if (obj.version > 1) {
    return {
      ok: false,
      error: `Unsupported backup version: ${obj.version}. Maximum supported version is 1.`,
    };
  }

  // 5. Must have a characters array
  if (!Array.isArray(obj.characters)) {
    return { ok: false, error: 'Invalid backup file: missing characters array.' };
  }

  // 6. Characters array must not be empty
  if (obj.characters.length === 0) {
    return { ok: false, error: 'Invalid backup file: no characters found.' };
  }

  // 7. If characterCount exists, it must match characters.length
  if (
    'characterCount' in obj &&
    typeof obj.characterCount === 'number' &&
    obj.characterCount !== obj.characters.length
  ) {
    return {
      ok: false,
      error: `Invalid backup file: character count mismatch (metadata says ${obj.characterCount}, file contains ${obj.characters.length}).`,
    };
  }

  // 8. Success
  const metadata: BackupMetadata = {
    version: obj.version,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
    characterCount: obj.characters.length,
  };

  return {
    ok: true,
    metadata,
    characters: obj.characters as BackupCharacterEntry[],
  };
}

/**
 * Check which character names in the backup already exist locally.
 * Compares each backup character's name against existing character names from
 * the manager. Returns an array of names that already exist locally.
 */
export async function detectDuplicates(
  backupCharacters: BackupCharacterEntry[],
): Promise<string[]> {
  const existing = await listSummaries();
  const existingNames = new Set(existing.map((c) => c.name));

  const duplicates: string[] = [];
  for (const entry of backupCharacters) {
    const name = entry.character.name as string;
    if (name && existingNames.has(name)) {
      duplicates.push(name);
    }
  }

  return duplicates;
}

/**
 * Validate that an individual character entry has the required fields for
 * import. A valid DND character must have: name (non-empty string), level
 * (number), abilities (object). These are the B2 core keys the import validator
 * also requires (NOT WFRP's name/species/chars).
 */
function isValidCharacterEntry(character: Record<string, unknown>): boolean {
  if (!character || typeof character !== 'object') return false;
  if (typeof character.name !== 'string' || character.name.length === 0) return false;
  if (typeof character.level !== 'number') return false;
  if (!character.abilities || typeof character.abilities !== 'object' || Array.isArray(character.abilities)) {
    return false;
  }
  return true;
}

/** True when an unknown error looks like an IndexedDB/localStorage quota error. */
function isQuotaError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('QuotaExceededError') || msg.includes('quota');
}

/**
 * Import all characters from a validated backup, sequentially.
 * Yields to the event loop between characters to avoid blocking the UI.
 * Stops on quota errors, retaining already-restored characters.
 *
 * Every restored character is adopted under a FRESH minted id so an existing
 * character is NEVER overwritten, and is first run through `runMigration` so a
 * stale/legacy record is upgraded (skipped if migration fails).
 *
 * @param characters - Array of backup character entries (from a validated BackupFile)
 * @param onProgress - Optional callback invoked after each character is processed
 * @returns RestoreSummary with counts and details of the operation
 */
export async function restoreCharacters(
  characters: BackupCharacterEntry[],
  onProgress?: ProgressCallback
): Promise<RestoreSummary> {
  // Snapshot existing names before starting (for duplicate tracking).
  const existing = await listSummaries();
  const existingNames = new Set(existing.map((c) => c.name));

  let imported = 0;
  const skippedDetails: Array<{ nameOrIndex: string; reason: string }> = [];
  const duplicateNames: string[] = [];
  let stoppedByQuota = false;

  const total = characters.length;

  for (let i = 0; i < total; i++) {
    // Yield to the event loop for UI responsiveness.
    await new Promise((r) => setTimeout(r, 0));

    const entry = characters[i];
    const charData = entry.character;

    // Validate the individual character against the DND core keys.
    if (!charData || !isValidCharacterEntry(charData)) {
      const nameOrIndex =
        charData && typeof charData.name === 'string' && charData.name.length > 0
          ? charData.name
          : `Character at index ${i}`;
      skippedDetails.push({
        nameOrIndex,
        reason: 'Missing required fields (name, level, or abilities)',
      });
      onProgress?.(i + 1, total);
      continue;
    }

    const name = charData.name as string;

    // Run the record through the versioned migration pipeline; skip on failure.
    const { portrait: _portraitField, ...charWithoutPortrait } = charData;
    void _portraitField;
    const migration = runMigration(charWithoutPortrait);
    if (!migration.success) {
      skippedDetails.push({ nameOrIndex: name, reason: migration.error });
      onProgress?.(i + 1, total);
      continue;
    }

    // Track duplicates (character name already exists locally).
    if (existingNames.has(name)) {
      duplicateNames.push(name);
    }

    try {
      // Adopt as a NEW character — mint a FRESH id here so a restore can never
      // overwrite an existing character. The underlying store put()s under the
      // provided key (keyPath:'id', no autoIncrement) and does NOT mint an id,
      // so a blank id would make every restored record collapse onto key ''.
      // Reset timestamps too so the backup's own identity never leaks through;
      // saveCharacter stamps a fresh updatedAt.
      const saved = await adoptCharacter({
        ...migration.character,
        id: newCharacterId(),
        createdAt: Date.now(),
        updatedAt: 0,
      });

      // Restore the portrait under the NEW id if present and valid.
      const portraitValue = entry.portrait || '';
      if (portraitValue && isValidPortraitDataUrl(portraitValue)) {
        const blob = base64ToBlob(portraitValue);
        if (blob) {
          const result = await getPortraitStore().savePortrait(saved.id, blob);
          // A rejected portrait save due to quota stops the restore.
          if (!result.ok && /quota/i.test(result.error)) {
            stoppedByQuota = true;
            imported++;
            break;
          }
        }
      }

      imported++;
    } catch (err: unknown) {
      // A quota rejection stops the restore, retaining what was already saved.
      if (isQuotaError(err)) {
        stoppedByQuota = true;
        break;
      }
      // Non-quota error: skip this character and continue.
      const errorMsg = err instanceof Error ? err.message : String(err);
      skippedDetails.push({ nameOrIndex: name, reason: errorMsg || 'Unknown error during import' });
    }

    onProgress?.(i + 1, total);
  }

  return {
    imported,
    skipped: skippedDetails.length,
    skippedDetails,
    duplicateNames,
    stoppedByQuota,
  };
}
