/**
 * Export / Import (Stage B2).
 *
 * Ported STRUCTURE + logic from the WFRP app's `src/storage/export-import.ts`
 * (Bucket-1 port) and re-themed to this app's D&D `Character` shape:
 *  - EXPORT serialises the active character to a JSON string, embedding its
 *    portrait (fetched from the Portrait Store and encoded base64 via the
 *    portrait-codec) so a character round-trips WITH its image.
 *  - IMPORT JSON-parses, VALIDATES the shape against the D&D `Character` type,
 *    runs the record through the versioned `runMigration` pipeline, and
 *    SEPARATES the portrait back out so the caller can store it in the Portrait
 *    Store under the character's (fresh) id.
 *
 * Identity contract (so import never clobbers an existing character): the
 * imported JSON's own `id` is STRIPPED — import yields a character with an
 * empty id and the caller adopts it as NEW (the manager mints a fresh id).
 * Importing therefore always ADDS a character; it can never overwrite the
 * active one.
 *
 * Bucket-1 port: no D&D rules math here, so no rulebook citation applies.
 */

import type { Character } from '../types/character';
import { BLANK_CHARACTER, CURRENT_VERSION } from '../types/character';
import { sanitizeClassChoices } from '../logic/class-choices';
import { sanitizeResourcesSpent } from '../logic/resources';
import { isConcentrating, sanitizeConditionDurations } from '../logic/condition-duration';
import { getPortraitStore } from './portrait-store';
import { blobToBase64, isValidPortraitDataUrl } from './portrait-codec';
import { runMigration } from './migration';

/**
 * Required top-level keys an imported record must carry. These are the D&D
 * `Character` fields that have NO safe default (identity + the mechanical core);
 * every OTHER field is additive-optional and is filled from `BLANK_CHARACTER`.
 * `id`/`createdAt`/`updatedAt` are deliberately NOT required — they are reset on
 * import (the manager mints identity + timestamps on adopt).
 */
const REQUIRED_TOP_LEVEL_KEYS = ['name', 'level', 'abilities'] as const;

/** The envelope embedded in an export: the character JSON plus its portrait. */
type ExportEnvelope = Character & { portrait?: string };

/**
 * Serialise a character to a pretty-printed JSON string.
 *
 * Does NOT embed the portrait (which lives outside the character JSON in the
 * Portrait Store). Use `exportCharacter` for a portrait-embedding export.
 */
export function exportToJSON(character: Character): string {
  return JSON.stringify(character, null, 2);
}

/**
 * Export a character to a JSON string WITH its portrait embedded.
 *
 * Retrieves the portrait Blob from the Portrait Store (keyed by the character
 * id), encodes it to a base64 data-URL, and includes it under a `portrait`
 * field alongside the character. If no portrait exists or retrieval fails, the
 * `portrait` field is omitted (the export is still valid).
 */
export async function exportCharacter(
  character: Character,
  characterId: string = character.id,
): Promise<string> {
  const store = getPortraitStore();
  let portrait: string | undefined;

  try {
    const result = await store.getPortraitBlob(characterId);
    if (result.ok && result.value) {
      portrait = await blobToBase64(result.value);
    }
  } catch {
    // Portrait retrieval failed — continue the export without the image.
    portrait = undefined;
  }

  const envelope: ExportEnvelope = portrait
    ? { ...character, portrait }
    : { ...character };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Build a downloadable filename for a character export, e.g.
 * `Aric_the_Bold_20240131-1409.json`.
 */
export function exportFileName(character: Character): string {
  const safeName = (character.name || 'character').replace(/[^a-zA-Z0-9_-]/g, '_');
  const date = new Date();
  const timestamp =
    `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}` +
    `${String(date.getDate()).padStart(2, '0')}-` +
    `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
  return `${safeName}_${timestamp}.json`;
}

/**
 * Trigger a browser download of a character export (portrait embedded) as a
 * `.json` file. No-op friendly outside a DOM (guards on `document`).
 */
export async function exportToFile(
  character: Character,
  characterId: string = character.id,
): Promise<void> {
  const json = await exportCharacter(character, characterId);
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return;
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(character);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** The successful import payload: the migrated character + separated portrait. */
export interface ImportResult {
  success: boolean;
  /** The validated + migrated character, with its `id` reset for adopt-as-new. */
  character?: Character;
  /** The portrait data-URL extracted from the import, if any (for the store). */
  portraitDataUrl?: string;
  /** A helpful message when `success` is false. */
  error?: string;
}

/**
 * Import a character from a JSON string.
 *
 * Steps (mirrors the WFRP importer, re-themed):
 *  1. JSON-parse — reject unparsable text with a helpful error.
 *  2. Reject non-objects (arrays, primitives, null).
 *  3. Require the D&D core keys (`name`, `level`, `abilities`).
 *  4. Reject a `_v` NEWER than CURRENT_VERSION (a file from a newer app).
 *  5. Separate the embedded `portrait` (validated as an image data-URL).
 *  6. Deep-merge over BLANK_CHARACTER defaults so older/leaner exports fill in.
 *  7. Run the merged record through the versioned `runMigration` pipeline.
 *  8. RESET identity (`id`/`createdAt`/`updatedAt`) so adopt mints a fresh one
 *     — import NEVER overwrites an existing character.
 */
export function importFromJSON(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { success: false, error: 'Invalid JSON: failed to parse.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { success: false, error: 'Invalid data: expected a JSON object.' };
  }

  const data = parsed as Record<string, unknown>;

  // Required top-level keys (identity core; everything else is optional).
  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in data)) {
      return { success: false, error: `Missing required field: "${key}".` };
    }
  }

  // Abilities must be an object (the six scores); reject an obviously-wrong shape.
  if (!data.abilities || typeof data.abilities !== 'object' || Array.isArray(data.abilities)) {
    return { success: false, error: 'Invalid data: "abilities" must be an object.' };
  }

  // Reject a version NEWER than this app understands.
  if (typeof data._v === 'number' && data._v > CURRENT_VERSION) {
    return {
      success: false,
      error: `Unsupported version: ${data._v}. Maximum supported version is ${CURRENT_VERSION}.`,
    };
  }

  // Separate the embedded portrait (kept out of the persisted character JSON).
  let portraitDataUrl: string | undefined;
  const rawPortrait = data.portrait;
  if (typeof rawPortrait === 'string' && isValidPortraitDataUrl(rawPortrait)) {
    portraitDataUrl = rawPortrait;
  }
  // Strip the portrait field regardless of validity so it never lands on the
  // character record (the image belongs in the Portrait Store).
  const { portrait: _portrait, ...characterData } = data;
  void _portrait;

  // Fill missing fields from BLANK_CHARACTER so a leaner/older export loads.
  const merged = deepMergeImport<Character>(structuredClone(BLANK_CHARACTER), characterData);

  // Run the versioned migration pipeline (identity at v1; upgrades legacy/stale).
  const migrated = runMigration(merged);
  if (!migrated.success) {
    return { success: false, error: migrated.error };
  }

  // classChoices is additive-optional and untrusted here: keep only known keys
  // with string-array values (drops the field entirely when nothing survives).
  const sanitizedChoices = sanitizeClassChoices(migrated.character.classChoices);
  if (sanitizedChoices) migrated.character.classChoices = sanitizedChoices;
  else delete migrated.character.classChoices;
  // resourcesSpent (D1) is additive-optional and untrusted: bounded integers only.
  const sanitizedResources = sanitizeResourcesSpent(migrated.character.resourcesSpent);
  if (sanitizedResources) migrated.character.resourcesSpent = sanitizedResources;
  else delete migrated.character.resourcesSpent;

  // Condition durations (Stage E) are additive-optional and untrusted: only the
  // `duration` of each entry is validated; legacy free-text entries are untouched.
  if (Array.isArray(migrated.character.conditions)) {
    migrated.character.conditions = sanitizeConditionDurations(
      migrated.character.conditions,
      isConcentrating(migrated.character.concentration),
    ) as Character['conditions'];
  }
  // Reset identity so the manager adopts this as a NEW character (never clobber
  // the active one). The store/manager assigns a fresh id + timestamps.
  const character: Character = {
    ...migrated.character,
    id: '',
    createdAt: 0,
    updatedAt: 0,
  };

  return { success: true, character, portraitDataUrl };
}

/**
 * Deep merge `source` over `target`. For each key in `source`:
 *  - both plain objects → recurse,
 *  - otherwise → take the source value (arrays replace wholesale).
 * Returns a new object; does not mutate `target`. Ported from the WFRP importer.
 */
function deepMergeImport<T extends object>(target: T, source: Record<string, unknown>): T {
  const result = { ...target } as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    const tVal = result[key];
    const sVal = source[key];
    if (
      tVal !== null && sVal !== null &&
      typeof tVal === 'object' && typeof sVal === 'object' &&
      !Array.isArray(tVal) && !Array.isArray(sVal)
    ) {
      result[key] = deepMergeImport(tVal as Record<string, unknown>, sVal as Record<string, unknown>);
    } else {
      result[key] = sVal;
    }
  }
  return result as T;
}
