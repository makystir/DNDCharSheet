/**
 * GOLDEN TABLE for Stage A7: character creation — ability-score generation,
 * backgrounds, languages, and the random-generator mechanism contract.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md) BEFORE the A7 logic is implemented. The implementer
 * must make the real functions reproduce every row and MUST NOT edit this file.
 * If a row looks wrong, STOP and flag it in the summary instead of changing it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. A harness in
 * the implementer's tests maps each row onto the real API.
 *
 * Sources (PHB 2024, Docs/PlayersHandbook.md):
 *  - Step 3: Determine Ability Scores (L1666-1726). Three methods:
 *      Standard Array = 15, 14, 13, 12, 10, 8 (L1674).
 *      Random Generation = roll 4d6, keep the highest 3, six times (L1677).
 *      Point Cost = 27 points; the Ability Score Point Costs table (L1680-1690).
 *  - Ability Score Point Costs table (L1683-1685): 8→0, 10→2, 11→3, 12→4,
 *      13→5, 14→7, 15→9. The OCR leaves the 9-cost CELL BLANK; the RAW cost of a
 *      score of 9 is 1 (the 8→9→10→11 steps each cost 1, matching the printed
 *      8→0 / 10→2 / 11→3). Scores below 8 or above 15 are NOT purchasable with
 *      Point Cost. [Flagged: OCR gap resolved from RAW.]
 *  - Parts of a Background (L7806-7820): a background gives THREE ability scores
 *      (increase one by 2 and another by 1, OR increase all three by 1; none
 *      above 20), ONE specified Origin feat, proficiency in TWO specified skills,
 *      ONE tool proficiency, and an Equipment choice between a package and 50 GP.
 *  - Background descriptions (L7806+). Verified rows below: Acolyte, Criminal,
 *      Soldier. (All 16 are transcribed by the implementer; the catalog oracle
 *      asserts the structural invariants for EVERY background.)
 *  - Languages (Step 2, L1294): species grant no fixed languages in 2024; you
 *      know Common and may choose others; the Background's narrative/Origin may
 *      contribute. The app models Common as always-known plus chosen languages.
 *
 * The creation logic is PURE: generation methods and background application
 * return new values / a new Character; they never mutate inputs. Random methods
 * (4d6, random character, flavor generators) take an injected RNG so they are
 * DETERMINISTIC under a fixed sequence — the golden pins those sequences.
 */

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

// ─── Standard Array (pointBuyStandardArray) ──────────────────────────────────
// PHB 2024 L1674: the fixed six scores, highest-first as printed.
export const STANDARD_ARRAY_EXPECTED: number[] = [15, 14, 13, 12, 10, 8];

// ─── Point-Buy cost per score (pointBuyCost) ─────────────────────────────────
// PHB 2024 Ability Score Point Costs table. Scores outside 8..15 are not
// purchasable: the golden marks them `cost: null` and the function must reject
// them (return null / throw per the agreed contract — harness checks for the
// not-purchasable signal, documented in the harness).
export interface PointBuyCostCase {
  name: string;
  cite: string;
  score: number;
  cost: number | null;
}

export const POINT_BUY_COST_CASES: PointBuyCostCase[] = [
  { name: 'score 8 costs 0', cite: 'Point Costs table (8→0)', score: 8, cost: 0 },
  { name: 'score 9 costs 1 (OCR blank; RAW 1)', cite: 'Point Costs table (9→1, OCR gap)', score: 9, cost: 1 },
  { name: 'score 10 costs 2', cite: 'Point Costs table (10→2)', score: 10, cost: 2 },
  { name: 'score 11 costs 3', cite: 'Point Costs table (11→3)', score: 11, cost: 3 },
  { name: 'score 12 costs 4', cite: 'Point Costs table (12→4)', score: 12, cost: 4 },
  { name: 'score 13 costs 5', cite: 'Point Costs table (13→5)', score: 13, cost: 5 },
  { name: 'score 14 costs 7', cite: 'Point Costs table (14→7)', score: 14, cost: 7 },
  { name: 'score 15 costs 9', cite: 'Point Costs table (15→9)', score: 15, cost: 9 },
  { name: 'score 7 not purchasable (below 8)', cite: 'Point Cost range 8..15', score: 7, cost: null },
  { name: 'score 16 not purchasable (above 15)', cite: 'Point Cost range 8..15', score: 16, cost: null },
];

// ─── Point-Buy total + validity (pointBuyTotalCost / isPointBuyValid) ────────
// 27-point budget (PHB L1678). A full allocation's total cost = Σ pointBuyCost.
// isValid = every score in 8..15 AND total <= 27.
export interface PointBuyAllocationCase {
  name: string;
  cite: string;
  scores: Record<Ability, number>;
  totalCost: number;
  valid: boolean;
}

export const POINT_BUY_ALLOCATION_CASES: PointBuyAllocationCase[] = [
  {
    // The Standard-Array numbers happen to cost exactly 27 under Point Buy:
    // 15→9, 14→7, 13→5, 12→4, 10→2, 8→0 = 27. So the array is itself a legal
    // point-buy allocation (every score is in 8..15 and the total is <= 27).
    name: 'Standard Array numbers cost exactly 27 → valid point-buy',
    cite: '27-point budget; 9+7+5+4+2+0 = 27',
    scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    totalCost: 27,
    valid: true,
  },
  {
    name: 'All 15s is far over budget (6×9 = 54) → invalid',
    cite: '27-point budget',
    scores: { str: 15, dex: 15, con: 15, int: 15, wis: 15, cha: 15 },
    totalCost: 54,
    valid: false,
  },
  {
    name: 'All 8s costs 0 → valid (under budget)',
    cite: '27-point budget; 6×0 = 0',
    scores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    totalCost: 0,
    valid: true,
  },
  {
    name: 'Even spread 13/13/13/12/12/12 = 5+5+5+4+4+4 = 27 → valid',
    cite: '27-point budget exactly',
    scores: { str: 13, dex: 13, con: 13, int: 12, wis: 12, cha: 12 },
    totalCost: 27,
    valid: true,
  },
  {
    name: 'A score of 16 makes the whole allocation invalid (out of range)',
    cite: 'Point Cost range 8..15',
    scores: { str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    totalCost: 0, // the in-range scores cost 0; the 16 is rejected → invalid regardless
    valid: false,
  },
];

// ─── 4d6-drop-lowest, deterministic under a fixed RNG (rollAbilityScore) ─────
// PHB 2024 L1677: roll four d6, keep the highest three. The golden supplies the
// four die faces (the injected RNG yields them in order) and the expected total
// of the top three. The harness feeds a scripted RNG returning exactly these
// faces.
export interface RollCase {
  name: string;
  cite: string;
  /** Four d6 faces in roll order. */
  faces: [number, number, number, number];
  /** Sum of the highest three. */
  expected: number;
}

export const ROLL_CASES: RollCase[] = [
  { name: '6,5,4,1 → drop 1 → 15', cite: '4d6 keep highest 3', faces: [6, 5, 4, 1], expected: 15 },
  { name: '3,3,3,3 → drop one 3 → 9', cite: '4d6 keep highest 3', faces: [3, 3, 3, 3], expected: 9 },
  { name: '1,1,1,6 → drop a 1 → 8', cite: '4d6 keep highest 3', faces: [1, 1, 1, 6], expected: 8 },
  { name: '6,6,6,6 → drop one 6 → 18 (max)', cite: '4d6 keep highest 3', faces: [6, 6, 6, 6], expected: 18 },
  { name: '1,1,1,1 → 3 (min)', cite: '4d6 keep highest 3', faces: [1, 1, 1, 1], expected: 3 },
  { name: '2,5,3,6 → drop 2 → 14', cite: '4d6 keep highest 3', faces: [2, 5, 3, 6], expected: 14 },
];

// ─── Background application (applyBackground) ────────────────────────────────
// PHB 2024 "Parts of a Background". A background contributes: three ability
// scores (the player chooses +2/+1 split or +1/+1/+1 — the golden pins the
// catalog's three abilities and one chosen split), one Origin feat id, exactly
// two skill proficiencies, exactly one tool proficiency (some are a category
// choice), and an equipment choice (package 'A' or 50 GP 'B'). These rows pin
// the CATALOG DATA for three verified backgrounds; the catalog oracle below
// asserts the structural invariants for all 16.
export interface BackgroundCase {
  name: string;
  cite: string;
  backgroundId: string;
  abilities: Ability[]; // exactly three, in PHB order
  originFeatId: string; // catalog key the background grants
  skills: string[]; // exactly two
  /** Tool: a specific tool id, or a category-choice marker. */
  tool: string;
  /** The package option A's gold, for a spot-check of equipment resolution. */
  packageGold: number;
}

export const BACKGROUND_CASES: BackgroundCase[] = [
  {
    name: 'Acolyte: Int/Wis/Cha, Magic Initiate (Cleric), Insight+Religion, Calligrapher\u2019s Supplies',
    cite: 'PHB 2024 Acolyte background (L~7848)',
    backgroundId: 'acolyte',
    abilities: ['int', 'wis', 'cha'],
    originFeatId: 'magic-initiate-cleric',
    skills: ['insight', 'religion'],
    tool: 'calligraphers-supplies',
    packageGold: 8,
  },
  {
    name: 'Criminal: Dex/Con/Int, Alert, Sleight of Hand+Stealth, Thieves\u2019 Tools',
    cite: 'PHB 2024 Criminal background (L~7886)',
    backgroundId: 'criminal',
    abilities: ['dex', 'con', 'int'],
    originFeatId: 'alert',
    skills: ['sleight-of-hand', 'stealth'],
    tool: 'thieves-tools',
    packageGold: 16,
  },
  {
    name: 'Soldier: Str/Dex/Con, Savage Attacker, Athletics+Intimidation, Gaming Set (choice)',
    cite: 'PHB 2024 Soldier background (L~7978)',
    backgroundId: 'soldier',
    abilities: ['str', 'dex', 'con'],
    originFeatId: 'savage-attacker',
    skills: ['athletics', 'intimidation'],
    tool: 'gaming-set', // category choice
    packageGold: 14,
  },
];

// ─── Ability-increase application from a background (background +2/+1) ────────
// PHB: increase one of the three by 2 and another by 1 (or all three by +1);
// none above 20. Applied to the EFFECTIVE model as recorded increases (like a
// feat ASI); base scores are not mutated. The golden pins the two legal shapes.
export interface BackgroundAbilityCase {
  name: string;
  cite: string;
  /** The background's three abilities. */
  abilities: [Ability, Ability, Ability];
  /** The player's chosen allocation. */
  allocation: { ability: Ability; amount: number }[];
  /** Whether the allocation is legal per the +2/+1 or +1/+1/+1 rule. */
  valid: boolean;
}

export const BACKGROUND_ABILITY_CASES: BackgroundAbilityCase[] = [
  {
    name: '+2 to the first, +1 to the second → valid',
    cite: 'Increase one by 2 and another by 1',
    abilities: ['int', 'wis', 'cha'],
    allocation: [{ ability: 'int', amount: 2 }, { ability: 'wis', amount: 1 }],
    valid: true,
  },
  {
    name: '+1 to all three → valid',
    cite: 'Or increase all three by 1',
    abilities: ['int', 'wis', 'cha'],
    allocation: [{ ability: 'int', amount: 1 }, { ability: 'wis', amount: 1 }, { ability: 'cha', amount: 1 }],
    valid: true,
  },
  {
    name: '+2 and +2 → invalid (only one +2 allowed, totals must be 2+1 or 1+1+1)',
    cite: 'Increase one by 2 and ANOTHER by 1',
    abilities: ['int', 'wis', 'cha'],
    allocation: [{ ability: 'int', amount: 2 }, { ability: 'wis', amount: 2 }],
    valid: false,
  },
  {
    name: '+2/+1 to an ability NOT among the background\u2019s three → invalid',
    cite: 'Only the three listed abilities',
    abilities: ['int', 'wis', 'cha'],
    allocation: [{ ability: 'str', amount: 2 }, { ability: 'int', amount: 1 }],
    valid: false,
  },
  {
    name: '+3 to one → invalid (no single +3 split exists)',
    cite: '2+1 or 1+1+1 only',
    abilities: ['int', 'wis', 'cha'],
    allocation: [{ ability: 'int', amount: 3 }],
    valid: false,
  },
];

// ─── Catalog structural invariants (every one of the 16 backgrounds) ─────────
// The oracle test asserts these for EACH background in the catalog, so a
// transcription slip (missing feat, 1 or 3 skills, 0 or 2 tools, no equipment
// options) fails loudly. Values are the REQUIRED SHAPE, not specific data.
export interface BackgroundCatalogOracle {
  /** All 16 PHB 2024 background ids must be present. */
  requiredIds: string[];
  /** Each background has exactly this many of each part. */
  abilitiesPerBackground: 3;
  skillsPerBackground: 2;
  toolsPerBackground: 1;
  originFeatsPerBackground: 1;
  /** Equipment always offers option A (package) and option B (50 GP). */
  equipmentOptionBGold: 50;
}

export const BACKGROUND_CATALOG_ORACLE: BackgroundCatalogOracle = {
  requiredIds: [
    'acolyte',
    'artisan',
    'charlatan',
    'criminal',
    'entertainer',
    'farmer',
    'guard',
    'guide',
    'hermit',
    'merchant',
    'noble',
    'sage',
    'sailor',
    'scribe',
    'soldier',
    'wayfarer',
  ],
  abilitiesPerBackground: 3,
  skillsPerBackground: 2,
  toolsPerBackground: 1,
  originFeatsPerBackground: 1,
  equipmentOptionBGold: 50,
};

// ─── Languages (languageModel) ───────────────────────────────────────────────
// PHB 2024 Step 2 (L1294): Common is always known; the player chooses additional
// languages; a background may contribute one. The golden pins the invariant:
// Common is ALWAYS present and never duplicated; chosen languages are unioned.
export interface LanguageCase {
  name: string;
  cite: string;
  chosen: string[];
  /** The resolved set (order not significant; compared as a set). */
  expectedSet: string[];
}

export const LANGUAGE_CASES: LanguageCase[] = [
  {
    name: 'No choices → just Common',
    cite: 'Common always known',
    chosen: [],
    expectedSet: ['common'],
  },
  {
    name: 'Choosing Elvish + Dwarvish → Common + the two',
    cite: 'Common + chosen',
    chosen: ['elvish', 'dwarvish'],
    expectedSet: ['common', 'elvish', 'dwarvish'],
  },
  {
    name: 'Choosing Common again does not duplicate it',
    cite: 'Common never duplicated',
    chosen: ['common', 'giant'],
    expectedSet: ['common', 'giant'],
  },
];

// ─── Random-generator mechanism contract (flavor generators) ─────────────────
// The name/appearance generators are FLAVOR (non-RAW): they are judged on data
// COVERAGE, not a single correct answer, so they are not pinned value-by-value.
// What IS pinned is the MECHANISM contract every generator must satisfy:
//   - respects BOTH species and gender: a generated value comes from the pool
//     for that (species, gender) combination (name/eyes/hair/skin), falling back
//     to a species-neutral or any-gender pool only when a specific pool is empty;
//   - deterministic under a fixed RNG (same seed/sequence → same output);
//   - always returns a NON-EMPTY value for every supported (species, gender);
//   - a VAST name pool: at least this many distinct names per supported
//     (species, gender) combination (user requirement: "a vast array").
// The harness enumerates the app's supported species × {male, female, neutral}
// and asserts each contract point; the golden pins the thresholds.
export interface GeneratorContract {
  /** Minimum distinct first names required per (species, gender) combination. */
  minNamesPerSpeciesGender: number;
  /** Fields whose pools MUST vary by species (not one global list). */
  speciesVaryingFields: string[];
  /** Fields whose pools MUST vary by gender. */
  genderVaryingFields: string[];
  /** Genders the generators must support. */
  genders: string[];
}

export const GENERATOR_CONTRACT: GeneratorContract = {
  // "A vast array of potential names for each race/gender combination" — the
  // user set a firm floor of MORE THAN 200 distinct names per (species, gender).
  // The oracle asserts strictly greater than this value, so the implementer must
  // ship at least 201 per combo. May be exceeded.
  minNamesPerSpeciesGender: 200,
  // Age is a NON-RAW flavor generator (no PHB age table): a species-appropriate
  // range, clearly labeled not-from-the-rulebook, so age varies by species too.
  speciesVaryingFields: ['name', 'eyes', 'hair', 'skin', 'height', 'weight', 'age'],
  genderVaryingFields: ['name'],
  genders: ['male', 'female', 'neutral'],
};
