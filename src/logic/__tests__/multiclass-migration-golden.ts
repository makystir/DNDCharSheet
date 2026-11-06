/**
 * GOLDEN TABLE for Stage M1 (multiclassing: model + migration) — the v1→v2
 * schema migration MIGRATIONS[1], the first genuinely breaking schema change.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR from the approved multiclassing
 * design (.agents/tasks/investigate-multiclassing-design/report.md §6) + the
 * real v1 shapes in src/types/character.ts, BEFORE the migration is implemented.
 * The implementer must make MIGRATIONS[1] reproduce every row and MUST NOT edit
 * this file. If a row looks wrong, STOP and flag it in the summary.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. A harness in
 * the implementer's tests feeds each `v1` object through runMigration and
 * asserts the result equals `v2` (and the idempotence/totality properties).
 *
 * THE RESHAPE (design §3, §6):
 *  - v1: character.class?: { id, subclassId?, level, skillChoices? } (single).
 *    v2: character.classes?: ClassEntry[] (same entry shape; classes[0] = the
 *    INITIAL class). The single v1 class becomes a one-element array.
 *  - v1 SpellcastingState is FLAT: { cantrips?, prepared?, spellbook?,
 *    slotsExpended?, pactSlotsExpended?, mysticArcana?, mysticArcanaExpended? }.
 *    v2 moves the PER-CLASS selections (cantrips, prepared, spellbook) under
 *    byClass[classId]; the shared/pooled fields (slotsExpended, pactSlotsExpended,
 *    mysticArcana, mysticArcanaExpended) stay top-level.
 *  - character.level (the TOTAL character level) is UNCHANGED by the migration
 *    (for a v1 single-class character it already equals the class level, so the
 *    invariant level === sum(classes[].level) holds post-migration).
 *  - _v is stamped to 2.
 *
 * TOTALITY: a v1 record with NO class (valid "no class chosen" state) migrates
 * with no `classes` added and no crash; a record with NO spellcasting is left
 * untouched there. IDEMPOTENCE: runMigration on an already-v2 record is a no-op
 * (runMigration(runMigration(x)) deep-equals runMigration(x)).
 *
 * Each `v1` object below is the FULL persisted record passed to runMigration;
 * `v2` is the exact expected migrated record. The harness compares the migrated
 * result to `v2` with a deep-equal. Only the fields relevant to the reshape are
 * populated; a real character has more fields, but the migration must carry any
 * unrelated field through UNCHANGED (one row exercises that).
 */

export interface MigrationCase {
  name: string;
  cite: string;
  /** The v1 persisted record fed to runMigration. */
  v1: Record<string, unknown>;
  /** The exact expected v2 record (deep-equal). */
  v2: Record<string, unknown>;
}

export const MIGRATION_V1_V2_CASES: MigrationCase[] = [
  {
    name: 'Single class, no spellcasting → classes:[entry], _v 2',
    cite: 'design §6: class → classes[]',
    v1: {
      _v: 1,
      id: 'c1',
      name: 'Grog',
      level: 5,
      class: { id: 'barbarian', level: 5, skillChoices: ['athletics', 'intimidation'] },
    },
    v2: {
      _v: 2,
      id: 'c1',
      name: 'Grog',
      level: 5,
      classes: [{ id: 'barbarian', level: 5, skillChoices: ['athletics', 'intimidation'] }],
    },
  },
  {
    name: 'Single class with subclass → carried into the single entry',
    cite: 'design §3.1: ClassEntry keeps subclassId',
    v1: {
      _v: 1,
      id: 'c2',
      name: 'Vex',
      level: 7,
      class: { id: 'rogue', subclassId: 'thief', level: 7, skillChoices: ['stealth', 'perception'] },
    },
    v2: {
      _v: 2,
      id: 'c2',
      name: 'Vex',
      level: 7,
      classes: [{ id: 'rogue', subclassId: 'thief', level: 7, skillChoices: ['stealth', 'perception'] }],
    },
  },
  {
    name: 'Spellcaster: flat cantrips/prepared/spellbook fold under byClass[classId]',
    cite: 'design §6.1: flat spellcasting → byClass',
    v1: {
      _v: 1,
      id: 'c3',
      name: 'Tasha',
      level: 3,
      class: { id: 'wizard', subclassId: 'evoker', level: 3, skillChoices: ['arcana', 'history'] },
      spellcasting: {
        cantrips: ['fire-bolt', 'mage-hand'],
        prepared: ['magic-missile', 'shield'],
        spellbook: ['magic-missile', 'shield', 'sleep'],
        slotsExpended: { 1: 2 },
      },
    },
    v2: {
      _v: 2,
      id: 'c3',
      name: 'Tasha',
      level: 3,
      classes: [{ id: 'wizard', subclassId: 'evoker', level: 3, skillChoices: ['arcana', 'history'] }],
      spellcasting: {
        byClass: {
          wizard: {
            cantrips: ['fire-bolt', 'mage-hand'],
            prepared: ['magic-missile', 'shield'],
            spellbook: ['magic-missile', 'shield', 'sleep'],
          },
        },
        slotsExpended: { 1: 2 },
      },
    },
  },
  {
    name: 'Warlock: pact + mystic arcanum pooled fields stay top-level; cantrips/prepared fold',
    cite: 'design §6.1: pact/mystic arcanum are top-level (shared), not per-class',
    v1: {
      _v: 1,
      id: 'c4',
      name: 'Fjord',
      level: 11,
      class: { id: 'warlock', subclassId: 'fiend', level: 11 },
      spellcasting: {
        cantrips: ['eldritch-blast'],
        prepared: ['hex', 'hold-person'],
        pactSlotsExpended: 1,
        mysticArcana: { 6: 'circle-of-death' },
        mysticArcanaExpended: { 6: false },
      },
    },
    v2: {
      _v: 2,
      id: 'c4',
      name: 'Fjord',
      level: 11,
      classes: [{ id: 'warlock', subclassId: 'fiend', level: 11 }],
      spellcasting: {
        byClass: {
          warlock: {
            cantrips: ['eldritch-blast'],
            prepared: ['hex', 'hold-person'],
          },
        },
        pactSlotsExpended: 1,
        mysticArcana: { 6: 'circle-of-death' },
        mysticArcanaExpended: { 6: false },
      },
    },
  },
  {
    name: 'No class chosen (valid state) → no classes field added, no crash',
    cite: 'design §6: totality — a class-less record survives',
    v1: {
      _v: 1,
      id: 'c5',
      name: 'Blank',
      level: 1,
    },
    v2: {
      _v: 2,
      id: 'c5',
      name: 'Blank',
      level: 1,
    },
  },
  {
    name: 'Class but no spellcasting → classes[] added, no spellcasting field',
    cite: 'design §6: totality — non-caster has no spellcasting to fold',
    v1: {
      _v: 1,
      id: 'c6',
      name: 'Grunt',
      level: 2,
      class: { id: 'fighter', level: 2 },
    },
    v2: {
      _v: 2,
      id: 'c6',
      name: 'Grunt',
      level: 2,
      classes: [{ id: 'fighter', level: 2 }],
    },
  },
  {
    // A record with NO _v is a legacy/corrupted import. This app never shipped a
    // v0 schema — its earliest persisted shape IS v1 — so a _v-less record is
    // treated as v1 and STILL gets the v1->v2 reshape (not stamped to current
    // with its shape un-migrated). classes[] is added; _v becomes 2.
    name: 'No _v (legacy/corrupted): treated as v1 and reshaped to v2',
    cite: 'design: no v0 schema ever existed; legacy record is v1-shaped',
    v1: {
      id: 'c8',
      name: 'Legacy',
      level: 3,
      class: { id: 'cleric', level: 3 },
    },
    v2: {
      _v: 2,
      id: 'c8',
      name: 'Legacy',
      level: 3,
      classes: [{ id: 'cleric', level: 3 }],
    },
  },
  {
    name: 'Unrelated fields are carried through unchanged',
    cite: 'migration touches only class/classes + spellcasting shape',
    v1: {
      _v: 1,
      id: 'c7',
      name: 'Keyleth',
      level: 4,
      class: { id: 'druid', level: 4 },
      abilities: { str: 8, dex: 14, con: 13, int: 10, wis: 16, cha: 12 },
      advancement: { feats: [], log: [] },
      houseRules: { rolledHp: true },
      languages: { chosen: ['elvish', 'dwarvish'] },
    },
    v2: {
      _v: 2,
      id: 'c7',
      name: 'Keyleth',
      level: 4,
      classes: [{ id: 'druid', level: 4 }],
      abilities: { str: 8, dex: 14, con: 13, int: 10, wis: 16, cha: 12 },
      advancement: { feats: [], log: [] },
      houseRules: { rolledHp: true },
      languages: { chosen: ['elvish', 'dwarvish'] },
    },
  },
];

// ─── Idempotence: a record ALREADY at v2 is unchanged by a second migration ──
// The harness runs runMigration on each v2 result again and asserts it equals
// the v2 (deep-equal) — runMigration(runMigration(v1)) === runMigration(v1).
// (No separate data needed; the harness derives these from MIGRATION_V1_V2_CASES.)

// ─── Model invariant (totalLevel) — level === sum of class entry levels ──────
// Not a migration row, but the design's core invariant (§3.1): the stored TOTAL
// level equals the sum of the per-class entry levels. The harness builds v2
// characters and asserts totalLevel(character) === Σ classes[].level, and that
// a single-class character's total equals its one entry's level.
export interface TotalLevelCase {
  name: string;
  cite: string;
  /** Per-class levels (one entry = single-class). */
  classLevels: number[];
  /** Expected total character level. */
  expectedTotal: number;
}

export const TOTAL_LEVEL_CASES: TotalLevelCase[] = [
  { name: 'Single class level 5 → total 5', cite: 'invariant: single entry', classLevels: [5], expectedTotal: 5 },
  { name: 'Fighter 3 / Wizard 2 → total 5', cite: 'invariant: Σ entry levels', classLevels: [3, 2], expectedTotal: 5 },
  { name: 'Three classes 1/1/1 → total 3', cite: 'invariant: Σ entry levels', classLevels: [1, 1, 1], expectedTotal: 3 },
  { name: 'No classes → total 0 (or the stored level for a class-less sheet)', cite: 'empty = 0 from entries', classLevels: [], expectedTotal: 0 },
  { name: 'Fighter 11 / Rogue 9 → total 20 (cap)', cite: 'invariant holds at the cap', classLevels: [11, 9], expectedTotal: 20 },
];

// ─── primaryClass / allClasses helper semantics ──────────────────────────────
// primaryClass(character) = classes[0] (the INITIAL class) or undefined when none.
// allClasses(character) = classes ?? []. The harness asserts the primary is the
// first entry and that a single-class character's primary is its only class.
export interface PrimaryClassCase {
  name: string;
  cite: string;
  /** Class ids in entry order (first = initial). Empty = no class. */
  classIds: string[];
  /** Expected primary class id, or null when none. */
  expectedPrimary: string | null;
  /** Expected count from allClasses. */
  expectedAllCount: number;
}

export const PRIMARY_CLASS_CASES: PrimaryClassCase[] = [
  { name: 'Single class → primary is it', cite: 'classes[0]', classIds: ['wizard'], expectedPrimary: 'wizard', expectedAllCount: 1 },
  { name: 'Fighter then Wizard → primary is Fighter (initial)', cite: 'classes[0] = initial', classIds: ['fighter', 'wizard'], expectedPrimary: 'fighter', expectedAllCount: 2 },
  { name: 'No class → primary null', cite: 'classes absent/empty', classIds: [], expectedPrimary: null, expectedAllCount: 0 },
];
