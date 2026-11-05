/**
 * GOLDEN TABLE for the FEATURE-GRANTED LANGUAGES fix: base-class features that
 * grant languages (Rogue "Thieves' Cant", Ranger "Deft Explorer"), and how they
 * compose into the character's known languages.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md) + the shipped src/data/classes.ts feature rows
 * BEFORE the logic is implemented. The implementer must make the real functions
 * reproduce every row and MUST NOT edit this file. If a row looks wrong, STOP
 * and flag it in the summary instead of changing it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. A harness in
 * the implementer's tests maps each row onto the real API.
 *
 * Sources (PHB 2024, Docs/PlayersHandbook.md; counts re-verified against
 * src/data/classes.ts):
 *  - Rogue L1 "Thieves' Cant" (PHB L5898; classes.ts ~L1476): "You know Thieves'
 *    Cant plus one other language of your choice." → one FIXED language
 *    ('thieves-cant', auto-granted, the player does not pick it) PLUS one CHOSEN
 *    language from the standard-language table.
 *  - Ranger L2 "Deft Explorer" (PHB L5411-5416; classes.ts ~L1319): "...learn
 *    two languages of your choice." → TWO CHOSEN languages, no fixed grant.
 *  - Choose Languages at creation (PHB L1627): Common + two chosen (already
 *    modelled/capped; the creation `chosen` list). Feature grants are ADDITIONAL
 *    to the creation two, stored separately (languages.granted) and, for fixed
 *    grants, auto-derived from the class.
 *  - Gating: a grant applies only once the character has REACHED the feature's
 *    level (Rogue at level >= 1 — always; Ranger at level >= 2). Below that
 *    level the grant does not apply. Multiclassing is out of scope (single-class
 *    characters); the character's class + level drive the grant.
 *  - A fixed grant ('thieves-cant') is AUTO (not a player pick) and is counted
 *    toward the known set but NOT toward the "choose N" count. The "choose N"
 *    picks are stored in languages.granted and are capped at N by the feature.
 *
 * Known-language resolution: Common is always first and never duplicated; the
 * creation `chosen`, the feature `granted` picks, and any fixed auto-grant are
 * unioned and de-duplicated (resolveLanguages already does the union/de-dup; the
 * fix feeds it the granted + fixed set).
 */

export type ClassId =
  | 'barbarian' | 'bard' | 'cleric' | 'druid' | 'fighter' | 'monk'
  | 'paladin' | 'ranger' | 'rogue' | 'sorcerer' | 'warlock' | 'wizard';

// ─── featureLanguageGrants(character) — per class/level grant descriptor ─────
//
// For a single-class character at a given level, the function reports the
// feature-driven language grant: the FIXED languages auto-granted (e.g.
// Thieves' Cant) and the NUMBER of languages the player chooses from features
// (the "choose N" count). A class/level with no language feature yields
// { fixed: [], chooseCount: 0 }.
export interface GrantCase {
  name: string;
  cite: string;
  classId: ClassId;
  level: number;
  expect: {
    /** Fixed, auto-granted language ids (no player choice), e.g. ['thieves-cant']. */
    fixed: string[];
    /** How many languages the player chooses from features at this class/level. */
    chooseCount: number;
  };
}

export const GRANT_CASES: GrantCase[] = [
  {
    name: 'Rogue level 1 → Thieves\u2019 Cant (fixed) + choose 1',
    cite: 'Rogue L1 Thieves\u2019 Cant (L5898)',
    classId: 'rogue',
    level: 1,
    expect: { fixed: ['thieves-cant'], chooseCount: 1 },
  },
  {
    name: 'Rogue level 5 → still Thieves\u2019 Cant + choose 1 (grant persists)',
    cite: 'Rogue L1 feature persists at higher levels',
    classId: 'rogue',
    level: 5,
    expect: { fixed: ['thieves-cant'], chooseCount: 1 },
  },
  {
    name: 'Ranger level 2 → Deft Explorer: choose 2, no fixed',
    cite: 'Ranger L2 Deft Explorer (L5411-5416)',
    classId: 'ranger',
    level: 2,
    expect: { fixed: [], chooseCount: 2 },
  },
  {
    name: 'Ranger level 1 → Deft Explorer NOT yet reached: no grant',
    cite: 'Deft Explorer is a level-2 feature',
    classId: 'ranger',
    level: 1,
    expect: { fixed: [], chooseCount: 0 },
  },
  {
    name: 'Ranger level 11 → still choose 2',
    cite: 'Ranger L2 feature persists',
    classId: 'ranger',
    level: 11,
    expect: { fixed: [], chooseCount: 2 },
  },
  {
    name: 'Fighter level 20 → no language-granting base feature',
    cite: 'No Fighter base feature grants a language',
    classId: 'fighter',
    level: 20,
    expect: { fixed: [], chooseCount: 0 },
  },
  {
    name: 'Wizard level 5 → none',
    cite: 'No Wizard base feature grants a language',
    classId: 'wizard',
    level: 5,
    expect: { fixed: [], chooseCount: 0 },
  },
  {
    name: 'Cleric level 3 → none',
    cite: 'No Cleric base feature grants a language',
    classId: 'cleric',
    level: 3,
    expect: { fixed: [], chooseCount: 0 },
  },
  {
    name: 'Barbarian level 10 → none',
    cite: 'No Barbarian base feature grants a language',
    classId: 'barbarian',
    level: 10,
    expect: { fixed: [], chooseCount: 0 },
  },
];

// ─── knownLanguages(character) — composition with feature grants ─────────────
//
// The full known set: Common (always, first, never duplicated) + creation
// `chosen` + feature `granted` picks + fixed auto-grants, unioned + de-duped.
// Compared as a SET (order not significant beyond Common-present). Inputs pin
// the class/level (which drives fixed grants + validates the granted count),
// the creation `chosen`, and the feature `granted` picks.
export interface KnownCase {
  name: string;
  cite: string;
  classId: ClassId;
  level: number;
  chosen: string[];
  granted: string[];
  expectedSet: string[];
}

export const KNOWN_CASES: KnownCase[] = [
  {
    name: 'Rogue 1: Common + 2 creation + Thieves\u2019 Cant (auto) + 1 granted pick',
    cite: 'Rogue adds Thieves\u2019 Cant + 1 chosen on top of creation',
    classId: 'rogue',
    level: 1,
    chosen: ['elvish', 'dwarvish'],
    granted: ['goblin'],
    expectedSet: ['common', 'elvish', 'dwarvish', 'thieves-cant', 'goblin'],
  },
  {
    name: 'Rogue 1 with no granted pick yet still knows Thieves\u2019 Cant (fixed is automatic)',
    cite: 'Fixed grant is auto, independent of the player\u2019s pick',
    classId: 'rogue',
    level: 1,
    chosen: ['elvish', 'dwarvish'],
    granted: [],
    expectedSet: ['common', 'elvish', 'dwarvish', 'thieves-cant'],
  },
  {
    name: 'Ranger 2: Common + 2 creation + 2 granted picks, no fixed',
    cite: 'Deft Explorer adds 2 chosen, no fixed language',
    classId: 'ranger',
    level: 2,
    chosen: ['elvish', 'dwarvish'],
    granted: ['giant', 'orc'],
    expectedSet: ['common', 'elvish', 'dwarvish', 'giant', 'orc'],
  },
  {
    name: 'Ranger 1: Deft Explorer not reached → only Common + creation (granted ignored)',
    cite: 'A grant below its feature level does not apply',
    classId: 'ranger',
    level: 1,
    chosen: ['elvish'],
    granted: ['giant', 'orc'], // stale/not-yet-earned picks are not counted
    expectedSet: ['common', 'elvish'],
  },
  {
    name: 'Fighter 3: no feature grant → Common + creation only',
    cite: 'No Fighter language feature',
    classId: 'fighter',
    level: 3,
    chosen: ['elvish', 'dwarvish'],
    granted: [],
    expectedSet: ['common', 'elvish', 'dwarvish'],
  },
  {
    name: 'A granted pick duplicating a creation pick is de-duplicated',
    cite: 'union + de-dup across chosen/granted/fixed',
    classId: 'ranger',
    level: 2,
    chosen: ['elvish', 'dwarvish'],
    granted: ['elvish', 'giant'], // 'elvish' already chosen → not duplicated
    expectedSet: ['common', 'elvish', 'dwarvish', 'giant'],
  },
  {
    name: 'Rogue granted pick duplicating the fixed Thieves\u2019 Cant is de-duplicated',
    cite: 'fixed + granted de-dup',
    classId: 'rogue',
    level: 1,
    chosen: ['elvish'],
    granted: ['thieves-cant'], // redundant with the auto grant → single entry
    expectedSet: ['common', 'elvish', 'thieves-cant'],
  },
];

// ─── Feature-grant pick validity (isFeatureLanguageSelectionValid) ───────────
//
// The player's feature `granted` picks must be valid for the class/level: at
// most `chooseCount` picks, none Common, none a fixed auto-grant id (those are
// automatic, not a pick), no duplicates. (A pick equal to a creation `chosen`
// language is allowed at the data level — resolveLanguages de-dups it — but the
// UI should steer away from it; validity here is about the per-feature cap.)
export interface GrantValidityCase {
  name: string;
  cite: string;
  classId: ClassId;
  level: number;
  granted: string[];
  valid: boolean;
}

export const GRANT_VALIDITY_CASES: GrantValidityCase[] = [
  { name: 'Rogue 1, one granted pick → valid (choose 1)', cite: 'at most chooseCount', classId: 'rogue', level: 1, granted: ['goblin'], valid: true },
  { name: 'Rogue 1, two granted picks → invalid (only choose 1)', cite: 'exceeds chooseCount', classId: 'rogue', level: 1, granted: ['goblin', 'giant'], valid: false },
  { name: 'Ranger 2, two granted picks → valid (choose 2)', cite: 'at most chooseCount', classId: 'ranger', level: 2, granted: ['giant', 'orc'], valid: true },
  { name: 'Ranger 2, three granted picks → invalid', cite: 'exceeds chooseCount', classId: 'ranger', level: 2, granted: ['giant', 'orc', 'goblin'], valid: false },
  { name: 'Ranger 1, any granted pick → invalid (feature not reached, chooseCount 0)', cite: 'no grant below feature level', classId: 'ranger', level: 1, granted: ['giant'], valid: false },
  { name: 'Fighter, any granted pick → invalid (no language feature)', cite: 'chooseCount 0', classId: 'fighter', level: 5, granted: ['giant'], valid: false },
  { name: 'Rogue 1, picking Common → invalid (Common is implicit)', cite: 'Common never a pick', classId: 'rogue', level: 1, granted: ['common'], valid: false },
  { name: 'Rogue 1, picking the fixed thieves-cant → invalid (fixed is automatic, not a pick)', cite: 'fixed is auto, not a choose-N pick', classId: 'rogue', level: 1, granted: ['thieves-cant'], valid: false },
  { name: 'Rogue 1, duplicate granted picks → invalid', cite: 'no duplicates', classId: 'rogue', level: 1, granted: ['goblin', 'goblin'], valid: false },
  { name: 'Ranger 2, zero picks → valid (under the cap; player may defer)', cite: 'at most chooseCount, not exactly', classId: 'ranger', level: 2, granted: [], valid: true },
];
