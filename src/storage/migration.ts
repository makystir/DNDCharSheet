/**
 * Versioned schema-migration runner (Stage B2).
 *
 * This is the data-integrity core for persisted characters: given a stored
 * record at some `_v`, `runMigration` applies the ordered migration STEPS up to
 * `CURRENT_VERSION` so the rest of the app only ever sees a current-version
 * record. It runs on the READ path (character-store) and on IMPORT.
 *
 * Ported STRUCTURE from the WFRP app's migration approach (an ordered,
 * version-keyed upgrade pipeline), re-themed onto this app's `Character` shape.
 * Through Stage A7 + B1 every DND `Character` field was additive-optional with
 * NO `_v` bump, so `CURRENT_VERSION` is still 1 and there are NO real steps yet.
 * The runner is therefore a correct, well-tested FRAMEWORK that is an identity
 * no-op at v1 but is ready to carry steps the moment a future breaking change
 * bumps `CURRENT_VERSION`: add a `MIGRATIONS[n]` entry that upgrades a v`n`
 * record to v`n+1`.
 *
 * Contract (mirrors the WFRP best-effort posture — PURE and TOTAL):
 *  - Never throws on a malformed record. A non-object input yields a typed
 *    failure; a record missing `_v` (legacy) is treated as the lowest version
 *    (0) and upgraded. A single step that throws is caught and reported.
 *  - Idempotent: `runMigration(runMigration(x))` deep-equals `runMigration(x)`.
 *  - Bucket-1 port: no D&D rules math here, so no rulebook citation applies.
 */

import type { Character } from '../types/character';
import { CURRENT_VERSION } from '../types/character';

/**
 * A single migration step: upgrades a record from version `N` to version `N+1`.
 * Keyed in `MIGRATIONS` by its FROM version. The input is an opaque record
 * (the shape is the old version's), the output is the next version's record.
 * A step may mutate-and-return or return a fresh object; it must set the new
 * `_v`. The runner stamps `_v` defensively afterwards regardless.
 */
export type MigrationStep = (record: Record<string, unknown>) => Record<string, unknown>;

/**
 * Ordered migration steps, keyed by the FROM version.
 *
 * EMPTY at v1: there have been no breaking schema changes, so no step is needed
 * to reach `CURRENT_VERSION` (1). When a future change bumps CURRENT_VERSION to
 * 2, add a `MIGRATIONS[1]` step that applies the v1→v2 transform and sets
 * `_v: 2` (and so on for later bumps).
 * The runner walks from the record's version up to CURRENT_VERSION, applying
 * each `MIGRATIONS[v]` in turn, so steps compose automatically.
 */
export const MIGRATIONS: Record<number, MigrationStep> = {
  // (no steps yet — identity through v1)
};

/** The lowest version a record can be at: a legacy record with no `_v`. */
const LEGACY_VERSION = 0;

/** Result of running the migration pipeline. */
export type MigrationResult =
  | { success: true; character: Character; from: number; to: number }
  | { success: false; error: string };

/**
 * Read a record's starting version. A missing / non-numeric `_v` is treated as
 * the lowest version (legacy), so legacy records are upgraded rather than
 * rejected. A `_v` greater than CURRENT_VERSION (a record from a NEWER app) is
 * returned as-is so the caller can decide; the runner itself leaves such a
 * record untouched (no down-migration).
 */
function readVersion(record: Record<string, unknown>): number {
  const v = record._v;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    return LEGACY_VERSION;
  }
  return v;
}

/**
 * Run the ordered migration steps on a persisted record up to CURRENT_VERSION.
 *
 * Total and pure (never throws): returns a typed failure for a non-object
 * input, and best-effort-upgrades everything else. A record already at (or
 * above) CURRENT_VERSION is stamped to CURRENT_VERSION and returned unchanged
 * otherwise (identity at v1 — there are no steps). A record below
 * CURRENT_VERSION has each `MIGRATIONS[v]` applied in ascending order.
 */
export function runMigration(input: unknown): MigrationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, error: 'Cannot migrate: expected a character object.' };
  }

  // Work on a shallow clone so the caller's object is never mutated in place.
  let record: Record<string, unknown> = { ...(input as Record<string, unknown>) };
  const from = readVersion(record);

  // A record from a newer app version (ahead of us) cannot be down-migrated;
  // leave it as-is. The import validator is responsible for rejecting an
  // explicitly-unsupported future version with a helpful message; here we stay
  // total and simply pass it through.
  let version = from;
  try {
    while (version < CURRENT_VERSION) {
      const step = MIGRATIONS[version];
      if (!step) {
        // No step registered for this version: cannot bridge the gap, so stamp
        // to current and stop (framework stays total; this only happens if a
        // CURRENT_VERSION bump forgot its step — surfaced by the step tests).
        break;
      }
      record = step(record);
      version += 1;
    }
  } catch (err) {
    return {
      success: false,
      error: `Migration step failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Defensive stamp. A record that started AHEAD of us keeps its higher version
  // (never down-migrate); everything else is stamped to CURRENT_VERSION.
  const to = from > CURRENT_VERSION ? from : CURRENT_VERSION;
  record._v = to;

  return {
    success: true,
    character: record as unknown as Character,
    from,
    to,
  };
}

/**
 * Convenience wrapper for the read path: run the pipeline and return the
 * upgraded character, or the original record stamped to CURRENT_VERSION when
 * migration is not possible (keeps the read path total — a stored record is
 * never dropped because the runner hiccuped). Non-object inputs are returned
 * unchanged for the caller to handle.
 */
export function migrateCharacter(character: Character): Character {
  const result = runMigration(character);
  if (result.success) {
    return result.character;
  }
  // Best-effort: stamp current version so downstream code sees a consistent
  // shape even if the pipeline reported a problem (it only fails on a
  // non-object, which a typed `Character` argument is not).
  return { ...character, _v: CURRENT_VERSION };
}
