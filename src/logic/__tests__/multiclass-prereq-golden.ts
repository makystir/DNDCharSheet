/**
 * GOLDEN TABLE for Stage M4 (multiclassing: Advancement-page level-up) — the
 * multiclass PREREQUISITE check (AND/OR per class, across current + new classes,
 * against effective scores, with the house-rule override) and the LEVEL-UP
 * INVARIANT (total character level === sum of per-class entry levels).
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md L2082) + the stored primaryAbilities in
 * src/data/classes.ts, BEFORE the M4 logic is implemented. The implementer must
 * make the real functions reproduce every row and MUST NOT edit this file. If a
 * row looks wrong, STOP and flag it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists.
 *
 * Sources (PHB 2024; per-class primary ability re-verified against classes.ts):
 *  - Multiclassing: Prerequisites (PHB L2082): "you must have a score of at
 *    least 13 in the primary ability of the NEW class AND your CURRENT classes."
 *    So to add a new class you need 13+ in the new class's primary ability AND
 *    13+ in every current class's primary ability.
 *  - AND/OR per class (from the Core <Class> Traits "Primary Ability"; a paired
 *    primary is encoded explicitly, NOT inferred):
 *      Barbarian Str | Bard Cha | Cleric Wis | Druid Wis | Rogue Dex |
 *      Sorcerer Cha | Warlock Cha | Wizard Int        — single ability (need it).
 *      Fighter: Str OR Dex (either >= 13 satisfies).
 *      Monk: Dex AND Wis (both >= 13). Paladin: Str AND Cha (both).
 *      Ranger: Dex AND Wis (both).
 *    Encoded as multiclassPrereq { all?: Ability[]; any?: Ability[] }:
 *      single → all:[x]; Fighter → any:[str,dex]; Monk → all:[dex,wis];
 *      Paladin → all:[str,cha]; Ranger → all:[dex,wis].
 *  - The check uses EFFECTIVE ability scores (post-feat, like canTakeFeat).
 *  - You cannot "multiclass into" a class you ALREADY have (that is normal
 *    advancement, not a multiclass).
 *  - HOUSE RULE (houseRules.allowIllegalMulticlass, default off = RAW): when ON,
 *    a failed prereq is PERMITTED with a warning instead of blocked. The check
 *    still REPORTS the failure (ok:false + failing abilities) so the UI can warn;
 *    a separate "is this action allowed to proceed" decision consults the toggle.
 *
 * All functions pure.
 */

export type ClassId =
  | 'barbarian' | 'bard' | 'cleric' | 'druid' | 'fighter' | 'monk'
  | 'paladin' | 'ranger' | 'rogue' | 'sorcerer' | 'warlock' | 'wizard';

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

// ─── Per-class multiclass prereq shape (multiclassPrereq) ────────────────────
// The REQUIRED shape per class. `all` = every listed ability must be >= 13;
// `any` = at least one must be >= 13. Exactly one of all/any per class.
export interface PrereqShapeCase {
  classId: ClassId;
  cite: string;
  all?: Ability[];
  any?: Ability[];
}

export const PREREQ_SHAPE_CASES: PrereqShapeCase[] = [
  { classId: 'barbarian', cite: 'Barbarian primary Str', all: ['str'] },
  { classId: 'bard', cite: 'Bard primary Cha', all: ['cha'] },
  { classId: 'cleric', cite: 'Cleric primary Wis', all: ['wis'] },
  { classId: 'druid', cite: 'Druid primary Wis', all: ['wis'] },
  { classId: 'fighter', cite: 'Fighter primary Str OR Dex', any: ['str', 'dex'] },
  { classId: 'monk', cite: 'Monk primary Dex AND Wis', all: ['dex', 'wis'] },
  { classId: 'paladin', cite: 'Paladin primary Str AND Cha', all: ['str', 'cha'] },
  { classId: 'ranger', cite: 'Ranger primary Dex AND Wis', all: ['dex', 'wis'] },
  { classId: 'rogue', cite: 'Rogue primary Dex', all: ['dex'] },
  { classId: 'sorcerer', cite: 'Sorcerer primary Cha', all: ['cha'] },
  { classId: 'warlock', cite: 'Warlock primary Cha', all: ['cha'] },
  { classId: 'wizard', cite: 'Wizard primary Int', all: ['int'] },
];

// ─── canMulticlassInto(character, newClassId) ────────────────────────────────
// ok = the RAW prereq is satisfied: 13+ in the new class's primary ability (per
// its all/any shape) AND 13+ in EVERY current class's primary ability (per each
// current class's shape). Also ok:false with reason 'already-have-class' when
// the new class is already one of the character's classes. The check reports the
// RAW result regardless of the house-rule toggle (the toggle governs whether the
// UI lets the action proceed, not whether the prereq is met).
export interface CanMulticlassCase {
  name: string;
  cite: string;
  /** Current classes (ids only; levels irrelevant to the prereq). */
  currentClasses: ClassId[];
  /** The class being multiclassed into. */
  newClass: ClassId;
  /** Effective ability scores. */
  scores: Record<Ability, number>;
  expect: {
    ok: boolean;
    reason?: 'prereq' | 'already-have-class';
    /** Abilities below 13 that caused a prereq failure (empty when ok or
     *  already-have-class). Order not significant; compared as a set. */
    failing?: Ability[];
  };
}

const S = (over: Partial<Record<Ability, number>>): Record<Ability, number> => ({
  str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...over,
});

export const CAN_MULTICLASS_CASES: CanMulticlassCase[] = [
  {
    name: 'Barbarian → Druid: PHB example, needs Str 13 AND Wis 13 → both met → ok',
    cite: 'PHB L2082 worked example',
    currentClasses: ['barbarian'],
    newClass: 'druid',
    scores: S({ str: 13, wis: 13 }),
    expect: { ok: true },
  },
  {
    name: 'Barbarian → Druid: Wis 12 (new class fails) → not ok, failing [wis]',
    cite: 'new class primary below 13',
    currentClasses: ['barbarian'],
    newClass: 'druid',
    scores: S({ str: 13, wis: 12 }),
    expect: { ok: false, reason: 'prereq', failing: ['wis'] },
  },
  {
    name: 'Barbarian → Druid: Str 12 (current class fails) → not ok, failing [str]',
    cite: 'current class primary below 13',
    currentClasses: ['barbarian'],
    newClass: 'druid',
    scores: S({ str: 12, wis: 15 }),
    expect: { ok: false, reason: 'prereq', failing: ['str'] },
  },
  {
    name: 'Wizard → Fighter: Fighter needs Str OR Dex 13; Dex 14 satisfies → ok',
    cite: 'Fighter any:[str,dex]; one satisfies',
    currentClasses: ['wizard'],
    newClass: 'fighter',
    scores: S({ int: 13, dex: 14 }), // Wizard Int 13 (current), Fighter Dex 14 (new)
    expect: { ok: true },
  },
  {
    name: 'Wizard → Fighter: both Str and Dex 12 → Fighter OR fails → not ok, failing [str,dex]',
    cite: 'Fighter any:[str,dex]; neither satisfies',
    currentClasses: ['wizard'],
    newClass: 'fighter',
    scores: S({ int: 15, str: 12, dex: 12 }),
    expect: { ok: false, reason: 'prereq', failing: ['str', 'dex'] },
  },
  {
    name: 'Cleric → Paladin: Paladin needs Str 13 AND Cha 13; Cha 12 → not ok, failing [cha]',
    cite: 'Paladin all:[str,cha]; one missing',
    currentClasses: ['cleric'],
    newClass: 'paladin',
    scores: S({ wis: 15, str: 13, cha: 12 }),
    expect: { ok: false, reason: 'prereq', failing: ['cha'] },
  },
  {
    name: 'Cleric → Paladin: Str 13 AND Cha 13 (and Cleric Wis 13) → ok',
    cite: 'Paladin all:[str,cha] both met + current Cleric Wis met',
    currentClasses: ['cleric'],
    newClass: 'paladin',
    scores: S({ wis: 13, str: 13, cha: 13 }),
    expect: { ok: true },
  },
  {
    name: 'Fighter/Wizard (both current) → Cleric: needs Fighter(Str OR Dex) + Wizard Int + Cleric Wis all 13',
    cite: 'prereq across ALL current classes + the new one',
    currentClasses: ['fighter', 'wizard'],
    newClass: 'cleric',
    scores: S({ str: 13, int: 13, wis: 13 }),
    expect: { ok: true },
  },
  {
    name: 'Fighter/Wizard → Cleric: Int 12 (a current class fails) → not ok, failing [int]',
    cite: 'a current class primary below 13 blocks',
    currentClasses: ['fighter', 'wizard'],
    newClass: 'cleric',
    scores: S({ str: 13, int: 12, wis: 13 }),
    expect: { ok: false, reason: 'prereq', failing: ['int'] },
  },
  {
    name: 'Wizard → Wizard: already have the class → not ok, already-have-class',
    cite: 'cannot multiclass into a class you already have',
    currentClasses: ['wizard'],
    newClass: 'wizard',
    scores: S({ int: 18 }),
    expect: { ok: false, reason: 'already-have-class' },
  },
  {
    name: 'Monk → Ranger: Ranger needs Dex AND Wis 13; Monk needs Dex AND Wis 13; Wis 12 → fails both, failing [wis]',
    cite: 'both paired-AND classes share the Wis requirement',
    currentClasses: ['monk'],
    newClass: 'ranger',
    scores: S({ dex: 15, wis: 12 }),
    expect: { ok: false, reason: 'prereq', failing: ['wis'] },
  },
];

// ─── Whether the action may PROCEED (prereq + house rule) ────────────────────
// mayMulticlass(character, newClassId): the UI decision. When the RAW prereq is
// met → proceed (no warning). When it fails: if houseRules.allowIllegalMulticlass
// is ON → proceed WITH a warning; if OFF (default/RAW) → blocked. An
// already-have-class failure is ALWAYS blocked (the house rule does not override
// it — you still cannot "multiclass into" a class you have).
export interface MayMulticlassCase {
  name: string;
  cite: string;
  currentClasses: ClassId[];
  newClass: ClassId;
  scores: Record<Ability, number>;
  allowIllegal: boolean;
  expect: {
    proceed: boolean;
    warning: boolean; // true = proceeds but with a house-rule warning
  };
}

export const MAY_MULTICLASS_CASES: MayMulticlassCase[] = [
  {
    name: 'Prereq met → proceed, no warning (toggle irrelevant)',
    cite: 'RAW satisfied',
    currentClasses: ['barbarian'],
    newClass: 'druid',
    scores: S({ str: 13, wis: 13 }),
    allowIllegal: false,
    expect: { proceed: true, warning: false },
  },
  {
    name: 'Prereq fails, toggle OFF → blocked',
    cite: 'RAW default: enforce the prereq',
    currentClasses: ['barbarian'],
    newClass: 'druid',
    scores: S({ str: 13, wis: 11 }),
    allowIllegal: false,
    expect: { proceed: false, warning: false },
  },
  {
    name: 'Prereq fails, toggle ON → proceed WITH warning (house rule)',
    cite: 'houseRules.allowIllegalMulticlass permits with a warning',
    currentClasses: ['barbarian'],
    newClass: 'druid',
    scores: S({ str: 13, wis: 11 }),
    allowIllegal: true,
    expect: { proceed: true, warning: true },
  },
  {
    name: 'Already-have-class, toggle ON → still blocked (house rule does not override)',
    cite: 'the toggle only waives the ability prereq, not the uniqueness rule',
    currentClasses: ['wizard'],
    newClass: 'wizard',
    scores: S({ int: 18 }),
    allowIllegal: true,
    expect: { proceed: false, warning: false },
  },
];

// ─── Level-up invariant (applyMulticlassLevel / applyLevelUp) ────────────────
// After adding a level (in an existing class OR a new class), the stored total
// character.level === sum of per-class entry levels, and the targeted class's
// entry level increments by 1 (a new class starts at 1). The golden pins the
// resulting class-level map + total for a scripted add.
export interface LevelUpCase {
  name: string;
  cite: string;
  /** Starting class entries (ordered; first = initial). */
  before: { id: ClassId; level: number }[];
  /** The class a level is added in (existing or new). */
  addClass: ClassId;
  expect: {
    /** Resulting class→level map. */
    classLevels: { id: ClassId; level: number }[];
    /** Resulting total character level (= sum of entry levels). */
    total: number;
  };
}

export const LEVELUP_INVARIANT_CASES: LevelUpCase[] = [
  {
    name: 'Add a level in the existing class (single-class advancement)',
    cite: 'total stays the sum',
    before: [{ id: 'fighter', level: 4 }],
    addClass: 'fighter',
    expect: { classLevels: [{ id: 'fighter', level: 5 }], total: 5 },
  },
  {
    name: 'Multiclass: add a NEW class → new entry at level 1, appended',
    cite: 'new class starts at 1; total increments',
    before: [{ id: 'fighter', level: 5 }],
    addClass: 'wizard',
    expect: { classLevels: [{ id: 'fighter', level: 5 }, { id: 'wizard', level: 1 }], total: 6 },
  },
  {
    name: 'Add a level in a SECOND existing class',
    cite: 'increments the targeted entry, order preserved',
    before: [{ id: 'fighter', level: 5 }, { id: 'wizard', level: 1 }],
    addClass: 'wizard',
    expect: { classLevels: [{ id: 'fighter', level: 5 }, { id: 'wizard', level: 2 }], total: 7 },
  },
  {
    name: 'Total is always the sum (3-class build)',
    cite: 'invariant: level === Σ entry levels',
    before: [{ id: 'fighter', level: 3 }, { id: 'wizard', level: 2 }],
    addClass: 'cleric',
    expect: { classLevels: [{ id: 'fighter', level: 3 }, { id: 'wizard', level: 2 }, { id: 'cleric', level: 1 }], total: 6 },
  },
];
