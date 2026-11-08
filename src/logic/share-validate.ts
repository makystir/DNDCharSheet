/**
 * Validate an UNTRUSTED decoded share payload into a D&D `Character` safe for
 * read-only display (Stage B5).
 *
 * SECURITY POSTURE: the input JSON came from a `#view/…` URL hash and is
 * attacker-controllable. It must be treated as untrusted data, NOT as a trusted
 * `Character`. A shared character is exactly the same problem as an IMPORTED
 * file — an untrusted serialized character — so this delegates to the B2
 * import/migration path (storage/export-import.ts `importFromJSON`, which
 * JSON-parses, requires the identity core, rejects a newer `_v`, deep-merges
 * over `BLANK_CHARACTER`, and runs `storage/migration.ts` `runMigration`) rather
 * than forking that logic. On top of that it adds a small amount of DEFENSIVE
 * normalisation of the fields the read-only viewer's derived-stat functions read
 * (abilities, level, array fields), so a present-but-wrong-typed value can never
 * throw during display.
 *
 * Performs NO storage writes and never adopts the character — validation only.
 *
 * Bucket-1 port of the WFRP app's `src/logic/share-validate.ts`, re-themed to
 * the D&D `Character` shape. No game rules math here, so no rulebook citation.
 */

import type { AbilityScores, Character } from '../types/character';
import { ABILITIES, BLANK_CHARACTER } from '../types/character';
import { importFromJSON } from '../storage/export-import';
import { sanitizeClassChoices } from './class-choices';
import { sanitizeResourcesSpent } from './resources';

/**
 * Array-valued `Character` fields the viewer may iterate. Each is re-normalised
 * to an array after import so a present-but-wrong-typed value (e.g. a string)
 * cannot throw inside `.map`/`.length`.
 */
const ARRAY_FIELDS = ['inventory', 'conditions'] as const;

export type ValidateResult =
  | { ok: true; character: Character }
  | { ok: false; error: string };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Validate and normalise an untrusted shared-character JSON string into a
 * `Character`.
 *
 * Steps:
 *  1. Pre-coerce `abilities` + the array fields on the RAW parse so the B2
 *     importer's required-shape checks and merge never choke on a wrong type.
 *  2. Delegate structural validation + `BLANK_CHARACTER` merge + `runMigration`
 *     to `importFromJSON` (the single untrusted-character validator). Its
 *     embedded-portrait separation and identity reset apply here too.
 *  3. Defensively normalise the display-critical fields in place: the six
 *     ability scores (non-finite -> 10), level (non-finite/out-of-range ->
 *     clamped 1..20), and the array fields.
 */
export function validateSharedPayload(json: string): ValidateResult {
  // Pre-parse so wrong-typed required fields can be coerced before the B2
  // importer inspects them. A non-object / unparseable payload is handed to the
  // importer unchanged so its own typed failure message is produced.
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Invalid JSON: failed to parse.' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Invalid data: expected a JSON object.' };
  }
  const rawObj = raw as Record<string, unknown>;

  // Coerce the array fields so a present-but-wrong-typed value is an empty array
  // before the merge (the viewer iterates these).
  for (const field of ARRAY_FIELDS) {
    if (field in rawObj && !Array.isArray(rawObj[field])) {
      rawObj[field] = [];
    }
  }

  // (2) Structural validation + merge + migration via the B2 importer.
  const imported = importFromJSON(JSON.stringify(rawObj));
  if (!imported.success || !imported.character) {
    return { ok: false, error: imported.error ?? 'Invalid data.' };
  }
  const c = imported.character as unknown as Record<string, unknown>;

  // (3) Defensive normalisation of the display-critical fields.
  // Ability scores: non-object -> the BLANK defaults; non-finite member -> 10.
  const abilities = c.abilities;
  if (!abilities || typeof abilities !== 'object' || Array.isArray(abilities)) {
    c.abilities = { ...BLANK_CHARACTER.abilities } satisfies AbilityScores;
  } else {
    const ab = abilities as Record<string, unknown>;
    for (const key of ABILITIES) {
      if (!isFiniteNumber(ab[key])) {
        ab[key] = BLANK_CHARACTER.abilities[key];
      }
    }
  }

  // Level: non-finite -> 1; clamp to the PHB 1..20 range so derived-stat
  // functions (proficiency bonus by level, etc.) stay in-bounds.
  if (!isFiniteNumber(c.level)) {
    c.level = 1;
  } else {
    c.level = Math.max(1, Math.min(20, Math.trunc(c.level as number)));
  }

  // Array fields: non-array -> [] (defensive; already coerced on the raw input).
  for (const field of ARRAY_FIELDS) {
    if (!Array.isArray(c[field])) {
      c[field] = [];
    }
  }

  // classChoices: drop unknown keys / wrong shapes; remove the field if empty.
  const choices = sanitizeClassChoices(c.classChoices);
  if (choices) c.classChoices = choices;
  else delete c.classChoices;

  // resourcesSpent: bounded integer counts only; remove the field if empty.
  const spent = sanitizeResourcesSpent(c.resourcesSpent);
  if (spent) c.resourcesSpent = spent;
  else delete c.resourcesSpent;

  return { ok: true, character: c as unknown as Character };
}
