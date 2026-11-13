/**
 * GOLDEN TABLE: Companions page pure logic (Stage 2, process step b).
 *
 * AUTHORSHIP RULE: written BEFORE src/logic/companions.ts. The implementer must
 * make the logic reproduce every row and MUST NOT edit this file to fit.
 *
 * DATA ONLY (no imports). companions-golden.test.ts maps each row onto the real
 * functions. Expected values are hand-computed from the cited rule text.
 *
 * Line numbers are the 1-based numbers reported by the grep/read tools for
 * Docs/*.md (PowerShell Get-Content numbering is one lower).
 *   PHB = Docs/PlayersHandbook.md (2024), DMG = Docs/DungeonMastersGuide.md (2024),
 *   Tasha = Docs/TashasCauldronOfEverything.md (2020, 5e/2014 rules, opt-in).
 *
 * RULES BASIS
 *  - Hirelings (PHB L10530-10533): Skilled 2 GP per day, Untrained 2 SP per day,
 *    Messenger 2 CP per mile. "The pay shown on the Hirelings table is a minimum;
 *    some expert hirelings require more pay" (L10525). Coins: 1 GP = 10 SP = 100 CP
 *    (PHB coin table, Equipment chapter). So per unit: skilled 200 CP, untrained
 *    20 CP, messenger 2 CP. Days/miles of a hireling are user input, clamped to a
 *    whole number 0..99999 (a sanitizer guard, NOT a book rule).
 *  - Mounts (PHB L10372-10401): the Mounts and Other Animals table gives each
 *    animal's carrying capacity. "An animal pulling a carriage, cart, chariot,
 *    sled, or wagon can move weight up to five times its base carrying capacity,
 *    including the weight of the vehicle. If multiple animals pull the same
 *    vehicle, add their carrying capacities together." (L10378).
 *  - Carrying Capacity table (PHB L20795-20800): Tiny Str x 7.5, Small/Medium
 *    Str x 15, Large Str x 30, Huge Str x 60, Gargantuan Str x 120 (lb). The
 *    PHB states that table for characters; applying it to other creatures is an
 *    EXTENSION (plan decision D9) that reproduces all eight printed table values
 *    exactly (rows below prove it). Round Down (PHB L255-257) applies to the
 *    fraction in Tiny x 7.5.
 *  - Mule "Beast of Burden": counts as one size larger for carrying capacity
 *    (Monster Manual, Mule; catalog src/data/creatures.ts L982). TRAP: the printed
 *    Mule table value (420) ALREADY includes that step (14 x 30), so the step is
 *    applied only when DERIVING a capacity, never on top of a table value.
 *  - Barding (PHB L10384): any Armor-table armor can be bought as barding; the
 *    cost is four times the normal cost and it weighs twice as much.
 *  - Mounting (PHB L1037): mounting or dismounting costs half your Speed (round down).
 *  - NPC party members (DMG L3557): use a stat block whose Challenge Rating is no
 *    higher than half the characters' level. INTERPRETATION D7 (flagged): compare
 *    the CR against the EXACT value level / 2 (no rounding): PHB "Round Down"
 *    (L257) would make half of level 1 equal 0 and exclude every CR 1/8..1/2 stat
 *    block, defeating the rule's purpose. Warn only, never block.
 *  - Loyalty (DMG L3577-3584, optional rule): score on a scale 0 to 20; the
 *    maximum equals the highest Charisma among the party, the starting score is
 *    half that number; +1d4 when helped with a personal goal or treated well;
 *    -1d4 when the party acts against the NPC's alignment or personality; -2d4
 *    when abused, misled or endangered for selfish reasons; never below 0, never
 *    above the maximum; 10 or higher risks anything, between 1 and 10 tenuously
 *    faithful, 0 no longer acts in the party's best interests.
 *    INTERPRETATIONS D8 (flagged): (a) Charisma can exceed 20 but the scale ends
 *    at 20, so the maximum is capped at 20; (b) "half" rounds down (PHB L257);
 *    (c) the bands overlap at 10: 10 counts as "risks anything"; (d) a stored
 *    score is clamped to the current maximum ("adjust accordingly", L3578).
 *  - Hit points (PHB L1133, L1183, L1191, L1194): healing cannot exceed the
 *    maximum (14/20 + 8 -> 20, regains 6); Temporary Hit Points are lost first
 *    and leftover damage carries to Hit Points (5 temp, 7 damage -> lose the 5,
 *    then 2 HP); temporary points do not stack (have 10, offered 12 -> 12 or 10,
 *    not 22); they are not Hit Points or healing and a creature "can be at full
 *    Hit Points and receive Temporary Hit Points". INTERPRETATION D10 (flagged):
 *    the brief's phrase "temp HP cannot exceed max" is NOT in the PHB; current
 *    HP never exceeds the maximum, temp HP is not capped by it.
 *    A monster dies at 0 HP unless the DM treats it like a character (PHB L1139);
 *    nothing is automated at 0 HP here (tooltip text only).
 *  - Conditions (PHB L1214): a condition does not stack with itself, except
 *    Exhaustion, which is cumulative to level 6 (PHB Exhaustion entry, L21022).
 *  - Cardinality caps (CAPS) are sanitizer / UI guards chosen by the plan
 *    (decision D12); the books set no cap.
 *  - Sidekick hit points (Tasha L6956, via src/logic/sidekick.ts): on a level
 *    gain the sidekick adds its rolled Hit Die plus its Constitution modifier,
 *    minimum 1; levels run 1-20.
 */

// -- Hirelings ---------------------------------------------------------------

export type GoldenHirelingKind = 'skilled' | 'untrained' | 'messenger';

/** PHB L10531-10533 converted to copper pieces (1 GP = 100 CP, 1 SP = 10 CP). */
export const HIRELING_RATE_ROWS: ReadonlyArray<{
  kind: GoldenHirelingKind;
  rateCp: number;
  unit: 'day' | 'mile';
  /** The printed table text, for the record. */
  printed: string;
}> = [
  { kind: 'skilled', rateCp: 200, unit: 'day', printed: '2 GP per day' },
  { kind: 'untrained', rateCp: 20, unit: 'day', printed: '2 SP per day' },
  { kind: 'messenger', rateCp: 2, unit: 'mile', printed: '2 CP per mile' },
];

export interface HirelingCostRow {
  name: string;
  kind: GoldenHirelingKind;
  units: number;
  totalCp: number;
}

/** Total cost in copper = table rate x units (no custom rate). */
export const HIRELING_COST_ROWS: readonly HirelingCostRow[] = [
  { name: 'skilled, 0 days is free (boundary)', kind: 'skilled', units: 0, totalCp: 0 },
  { name: 'skilled, 1 day = 2 GP', kind: 'skilled', units: 1, totalCp: 200 },
  { name: 'skilled, 7 days = 14 GP', kind: 'skilled', units: 7, totalCp: 1400 },
  { name: 'untrained, 1 day = 2 SP', kind: 'untrained', units: 1, totalCp: 20 },
  { name: 'untrained, 3 days = 6 SP', kind: 'untrained', units: 3, totalCp: 60 },
  { name: 'untrained, 5 days = 1 GP (SP rolls over to GP)', kind: 'untrained', units: 5, totalCp: 100 },
  { name: 'messenger, 1 mile = 2 CP', kind: 'messenger', units: 1, totalCp: 2 },
  { name: 'messenger, 10 miles = 2 SP', kind: 'messenger', units: 10, totalCp: 20 },
  { name: 'messenger, 50 miles = 1 GP', kind: 'messenger', units: 50, totalCp: 100 },
  { name: 'messenger, 55 miles = 1 GP 1 SP', kind: 'messenger', units: 55, totalCp: 110 },
  { name: 'skilled at the unit cap 99999 days', kind: 'skilled', units: 99999, totalCp: 19999800 },
  { name: 'messenger at the unit cap 99999 miles', kind: 'messenger', units: 99999, totalCp: 199998 },
];

/** Units are a whole number 0..99999 (sanitizer guard, not a book rule). */
export const UNIT_CLAMP_ROWS: ReadonlyArray<{ name: string; input: number; expected: number }> = [
  { name: 'negative becomes 0', input: -3, expected: 0 },
  { name: 'zero stays 0', input: 0, expected: 0 },
  { name: 'fraction truncates (round down, PHB L257)', input: 2.9, expected: 2 },
  { name: 'NaN becomes 0', input: Number.NaN, expected: 0 },
  { name: 'Infinity becomes the cap', input: Number.POSITIVE_INFINITY, expected: 99999 },
  { name: 'the cap itself is kept', input: 99999, expected: 99999 },
  { name: 'one over the cap clamps (one too many)', input: 100000, expected: 99999 },
];

export interface CustomRateRow {
  name: string;
  kind: GoldenHirelingKind;
  units: number;
  /** undefined = no custom rate entered. */
  customRateCp: number | undefined;
  /** The rate actually applied per unit. */
  effectiveRateCp: number;
  totalCp: number;
  /** PHB L10525: table pay is a minimum; paying less is flagged (warn, never block). */
  belowMinimum: boolean;
}

export const CUSTOM_RATE_ROWS: readonly CustomRateRow[] = [
  { name: 'no custom rate uses the table', kind: 'skilled', units: 2, customRateCp: undefined, effectiveRateCp: 200, totalCp: 400, belowMinimum: false },
  { name: 'expert paid more: 5 GP/day x 2 days', kind: 'skilled', units: 2, customRateCp: 500, effectiveRateCp: 500, totalCp: 1000, belowMinimum: false },
  { name: 'custom rate equal to the minimum is not below (boundary)', kind: 'skilled', units: 1, customRateCp: 200, effectiveRateCp: 200, totalCp: 200, belowMinimum: false },
  { name: 'one copper under the skilled minimum is below', kind: 'skilled', units: 1, customRateCp: 199, effectiveRateCp: 199, totalCp: 199, belowMinimum: true },
  { name: 'one copper over the skilled minimum is fine', kind: 'skilled', units: 1, customRateCp: 201, effectiveRateCp: 201, totalCp: 201, belowMinimum: false },
  { name: 'skilled at 1 GP/day is below the 2 GP minimum', kind: 'skilled', units: 3, customRateCp: 100, effectiveRateCp: 100, totalCp: 300, belowMinimum: true },
  { name: 'untrained at 19 CP is below 2 SP', kind: 'untrained', units: 2, customRateCp: 19, effectiveRateCp: 19, totalCp: 38, belowMinimum: true },
  { name: 'untrained at exactly 2 SP is not below', kind: 'untrained', units: 2, customRateCp: 20, effectiveRateCp: 20, totalCp: 40, belowMinimum: false },
  { name: 'messenger at 1 CP/mile is below 2 CP', kind: 'messenger', units: 10, customRateCp: 1, effectiveRateCp: 1, totalCp: 10, belowMinimum: true },
  { name: 'messenger at exactly 2 CP is not below', kind: 'messenger', units: 10, customRateCp: 2, effectiveRateCp: 2, totalCp: 20, belowMinimum: false },
  { name: 'custom rate 0 is below the minimum (free service) and costs 0', kind: 'messenger', units: 10, customRateCp: 0, effectiveRateCp: 0, totalCp: 0, belowMinimum: true },
  { name: 'negative custom rate is ignored: table applies', kind: 'skilled', units: 1, customRateCp: -5, effectiveRateCp: 200, totalCp: 200, belowMinimum: false },
  { name: 'fractional custom rate truncates (copper is whole)', kind: 'skilled', units: 1, customRateCp: 250.9, effectiveRateCp: 250, totalCp: 250, belowMinimum: false },
];

export interface RunningTotalRow {
  name: string;
  hirelings: ReadonlyArray<{ kind: GoldenHirelingKind; units: number; customRateCp?: number }>;
  totalCp: number;
  formatted: string;
}

export const RUNNING_TOTAL_ROWS: readonly RunningTotalRow[] = [
  { name: 'empty list is free', hirelings: [], totalCp: 0, formatted: '0 CP' },
  { name: 'a single 0-unit hireling adds nothing', hirelings: [{ kind: 'skilled', units: 0 }], totalCp: 0, formatted: '0 CP' },
  {
    name: 'skilled 3 d + untrained 4 d + messenger 25 mi = 600 + 80 + 50',
    hirelings: [
      { kind: 'skilled', units: 3 },
      { kind: 'untrained', units: 4 },
      { kind: 'messenger', units: 25 },
    ],
    totalCp: 730,
    formatted: '7 GP 3 SP',
  },
  {
    name: 'custom rate and table rate mix: 2 d at 5 GP + 1 mile',
    hirelings: [
      { kind: 'skilled', units: 2, customRateCp: 500 },
      { kind: 'messenger', units: 1 },
    ],
    totalCp: 1002,
    formatted: '10 GP 2 CP',
  },
  {
    name: 'ten untrained hirelings for one day each = 2 GP',
    hirelings: Array.from({ length: 10 }, () => ({ kind: 'untrained' as const, units: 1 })),
    totalCp: 200,
    formatted: '2 GP',
  },
  {
    name: 'one too many hirelings: 31 untrained x 1 day still just adds up (the cap is a UI/sanitizer guard)',
    hirelings: Array.from({ length: 31 }, () => ({ kind: 'untrained' as const, units: 1 })),
    totalCp: 620,
    formatted: '6 GP 2 SP',
  },
];

/** Coin split: 1 GP = 10 SP = 100 CP. Negative and fractional input are floored at 0 / truncated. */
export const SPLIT_COPPER_ROWS: ReadonlyArray<{
  cp: number;
  gp: number;
  sp: number;
  rest: number;
  formatted: string;
}> = [
  { cp: 0, gp: 0, sp: 0, rest: 0, formatted: '0 CP' },
  { cp: 1, gp: 0, sp: 0, rest: 1, formatted: '1 CP' },
  { cp: 9, gp: 0, sp: 0, rest: 9, formatted: '9 CP' },
  { cp: 10, gp: 0, sp: 1, rest: 0, formatted: '1 SP' },
  { cp: 99, gp: 0, sp: 9, rest: 9, formatted: '9 SP 9 CP' },
  { cp: 100, gp: 1, sp: 0, rest: 0, formatted: '1 GP' },
  { cp: 101, gp: 1, sp: 0, rest: 1, formatted: '1 GP 1 CP' },
  { cp: 110, gp: 1, sp: 1, rest: 0, formatted: '1 GP 1 SP' },
  { cp: 1099, gp: 10, sp: 9, rest: 9, formatted: '10 GP 9 SP 9 CP' },
  { cp: -5, gp: 0, sp: 0, rest: 0, formatted: '0 CP' },
  { cp: 2.9, gp: 0, sp: 0, rest: 2, formatted: '2 CP' },
];

// -- Mounts: carrying capacity ------------------------------------------------

/** PHB L20795-20800 multipliers ("Carry" column), pounds per point of Strength. */
export const SIZE_MULTIPLIER_ROWS: ReadonlyArray<{ size: string; multiplier: number }> = [
  { size: 'Tiny', multiplier: 7.5 },
  { size: 'Small', multiplier: 15 },
  { size: 'Medium', multiplier: 15 },
  { size: 'Large', multiplier: 30 },
  { size: 'Huge', multiplier: 60 },
  { size: 'Gargantuan', multiplier: 120 },
];

/** One size larger (Beast of Burden). Gargantuan has no larger size and stays. */
export const SIZE_STEP_ROWS: ReadonlyArray<{ size: string; larger: string }> = [
  { size: 'Tiny', larger: 'Small' },
  { size: 'Small', larger: 'Medium' },
  { size: 'Medium', larger: 'Large' },
  { size: 'Large', larger: 'Huge' },
  { size: 'Huge', larger: 'Gargantuan' },
  { size: 'Gargantuan', larger: 'Gargantuan' },
];

export interface DerivedCapacityRow {
  name: string;
  str: number;
  size: string;
  oneSizeLarger: boolean;
  capacityLb: number;
}

/** floor(Str x multiplier of the (possibly stepped) size). */
export const DERIVED_CAPACITY_ROWS: readonly DerivedCapacityRow[] = [
  { name: 'Tiny Str 3: floor(22.5) = 22 (round down)', str: 3, size: 'Tiny', oneSizeLarger: false, capacityLb: 22 },
  { name: 'Tiny Str 2 = 15', str: 2, size: 'Tiny', oneSizeLarger: false, capacityLb: 15 },
  { name: 'Tiny Str 1: floor(7.5) = 7', str: 1, size: 'Tiny', oneSizeLarger: false, capacityLb: 7 },
  { name: 'Small Str 10 = 150', str: 10, size: 'Small', oneSizeLarger: false, capacityLb: 150 },
  { name: 'Medium Str 10 = 150 (same as Small)', str: 10, size: 'Medium', oneSizeLarger: false, capacityLb: 150 },
  { name: 'Large Str 10 = 300', str: 10, size: 'Large', oneSizeLarger: false, capacityLb: 300 },
  { name: 'Huge Str 10 = 600', str: 10, size: 'Huge', oneSizeLarger: false, capacityLb: 600 },
  { name: 'Gargantuan Str 10 = 1200', str: 10, size: 'Gargantuan', oneSizeLarger: false, capacityLb: 1200 },
  { name: 'Gargantuan Str 30 = 3600', str: 30, size: 'Gargantuan', oneSizeLarger: false, capacityLb: 3600 },
  { name: 'Str 0 carries nothing', str: 0, size: 'Medium', oneSizeLarger: false, capacityLb: 0 },
  { name: 'Mule without the trait: Medium Str 14 = 210', str: 14, size: 'Medium', oneSizeLarger: false, capacityLb: 210 },
  { name: 'Mule with Beast of Burden: counts as Large, 14 x 30 = 420', str: 14, size: 'Medium', oneSizeLarger: true, capacityLb: 420 },
  { name: 'Tiny + Beast of Burden counts as Small: Str 3 x 15 = 45', str: 3, size: 'Tiny', oneSizeLarger: true, capacityLb: 45 },
  { name: 'Small + Beast of Burden counts as Medium: Str 10 x 15 = 150 (no change)', str: 10, size: 'Small', oneSizeLarger: true, capacityLb: 150 },
  { name: 'Large + Beast of Burden counts as Huge: Str 10 x 60 = 600', str: 10, size: 'Large', oneSizeLarger: true, capacityLb: 600 },
  { name: 'Huge + Beast of Burden counts as Gargantuan: Str 10 x 120 = 1200', str: 10, size: 'Huge', oneSizeLarger: true, capacityLb: 1200 },
  { name: 'Gargantuan + Beast of Burden stays Gargantuan (no larger size)', str: 10, size: 'Gargantuan', oneSizeLarger: true, capacityLb: 1200 },
];

/**
 * The eight Mounts and Other Animals table rows (PHB L10392-10401) with the
 * Strength score and size of each animal's stat block. `id` is the catalog id in
 * src/data/creatures.ts; the test cross-checks size, Strength and the table value
 * against the catalog. `beastOfBurden` is true only for the Mule.
 */
export const TABLE_ANIMAL_ROWS: ReadonlyArray<{
  id: string;
  name: string;
  size: string;
  str: number;
  tableCapacityLb: number;
  costGp: number;
  beastOfBurden: boolean;
}> = [
  { id: 'camel', name: 'Camel', size: 'Large', str: 15, tableCapacityLb: 450, costGp: 50, beastOfBurden: false },
  { id: 'elephant', name: 'Elephant', size: 'Huge', str: 22, tableCapacityLb: 1320, costGp: 200, beastOfBurden: false },
  { id: 'draft-horse', name: 'Horse, Draft', size: 'Large', str: 18, tableCapacityLb: 540, costGp: 50, beastOfBurden: false },
  { id: 'riding-horse', name: 'Horse, Riding', size: 'Large', str: 16, tableCapacityLb: 480, costGp: 75, beastOfBurden: false },
  { id: 'mastiff', name: 'Mastiff', size: 'Medium', str: 13, tableCapacityLb: 195, costGp: 25, beastOfBurden: false },
  { id: 'mule', name: 'Mule', size: 'Medium', str: 14, tableCapacityLb: 420, costGp: 8, beastOfBurden: true },
  { id: 'pony', name: 'Pony', size: 'Medium', str: 15, tableCapacityLb: 225, costGp: 30, beastOfBurden: false },
  { id: 'warhorse', name: 'Warhorse', size: 'Large', str: 18, tableCapacityLb: 540, costGp: 400, beastOfBurden: false },
];

/** Synthetic creatures for mountCapacity() (no mountTable row, so the capacity is derived). */
export interface SyntheticMountRow {
  name: string;
  size: string | null;
  str: number | null;
  traits: readonly string[];
  /** null when neither a table value nor a derivation is possible. */
  capacityLb: number | null;
  source: 'table' | 'derived' | 'unknown';
  beastOfBurdenApplied: boolean;
}

export const SYNTHETIC_MOUNT_ROWS: readonly SyntheticMountRow[] = [
  { name: 'Medium Str 14 with Beast of Burden derives 420', size: 'Medium', str: 14, traits: ['Beast of Burden'], capacityLb: 420, source: 'derived', beastOfBurdenApplied: true },
  { name: 'the trait name matches case-insensitively', size: 'Medium', str: 14, traits: ['beast of burden'], capacityLb: 420, source: 'derived', beastOfBurdenApplied: true },
  { name: 'Medium Str 14 without the trait derives 210', size: 'Medium', str: 14, traits: ['Keen Smell'], capacityLb: 210, source: 'derived', beastOfBurdenApplied: false },
  { name: 'a different trait that merely mentions burden does not count', size: 'Medium', str: 14, traits: ['Burden Bearer'], capacityLb: 210, source: 'derived', beastOfBurdenApplied: false },
  { name: 'Gargantuan Str 20 derives 2400', size: 'Gargantuan', str: 20, traits: [], capacityLb: 2400, source: 'derived', beastOfBurdenApplied: false },
  { name: 'missing size: unknown', size: null, str: 14, traits: [], capacityLb: null, source: 'unknown', beastOfBurdenApplied: false },
  { name: 'missing Strength: unknown', size: 'Medium', str: null, traits: [], capacityLb: null, source: 'unknown', beastOfBurdenApplied: false },
];

// -- Mounts: vehicles and carried weight --------------------------------------

export interface VehiclePullRow {
  name: string;
  capacitiesLb: readonly number[];
  limitLb: number;
}

/** PHB L10378: five times the base capacity; several animals add up. */
export const VEHICLE_PULL_ROWS: readonly VehiclePullRow[] = [
  { name: 'no animals pull nothing', capacitiesLb: [], limitLb: 0 },
  { name: 'one Warhorse 540 x 5', capacitiesLb: [540], limitLb: 2700 },
  { name: 'one Mastiff 195 x 5', capacitiesLb: [195], limitLb: 975 },
  { name: 'one Elephant 1320 x 5', capacitiesLb: [1320], limitLb: 6600 },
  { name: 'two Draft Horses: (540 + 540) x 5', capacitiesLb: [540, 540], limitLb: 5400 },
  { name: 'Mule + Pony: (420 + 225) x 5', capacitiesLb: [420, 225], limitLb: 3225 },
  { name: 'Camel + Elephant: (450 + 1320) x 5', capacitiesLb: [450, 1320], limitLb: 8850 },
  { name: 'four Mules: 4 x 420 x 5', capacitiesLb: [420, 420, 420, 420], limitLb: 8400 },
];

export interface VehicleLoadRow {
  name: string;
  capacitiesLb: readonly number[];
  vehicleWeightLb: number;
  cargoLb: number;
  limitLb: number;
  usedLb: number;
  remainingLb: number;
  overByLb: number;
  over: boolean;
}

/** Limit includes the vehicle's own weight (PHB L10378). */
export const VEHICLE_LOAD_ROWS: readonly VehicleLoadRow[] = [
  { name: 'two Draft Horses, 600 lb wagon, empty: 4800 left', capacitiesLb: [540, 540], vehicleWeightLb: 600, cargoLb: 0, limitLb: 5400, usedLb: 600, remainingLb: 4800, overByLb: 0, over: false },
  { name: 'exactly at the limit is not over (cargo 4800)', capacitiesLb: [540, 540], vehicleWeightLb: 600, cargoLb: 4800, limitLb: 5400, usedLb: 5400, remainingLb: 0, overByLb: 0, over: false },
  { name: 'one pound too many is over (cargo 4801)', capacitiesLb: [540, 540], vehicleWeightLb: 600, cargoLb: 4801, limitLb: 5400, usedLb: 5401, remainingLb: 0, overByLb: 1, over: true },
  { name: 'one pound under the limit (cargo 4799)', capacitiesLb: [540, 540], vehicleWeightLb: 600, cargoLb: 4799, limitLb: 5400, usedLb: 5399, remainingLb: 1, overByLb: 0, over: false },
  { name: 'no animals and an empty weightless vehicle is not over', capacitiesLb: [], vehicleWeightLb: 0, cargoLb: 0, limitLb: 0, usedLb: 0, remainingLb: 0, overByLb: 0, over: false },
  { name: 'no animals and 1 lb of cargo is over by 1', capacitiesLb: [], vehicleWeightLb: 0, cargoLb: 1, limitLb: 0, usedLb: 1, remainingLb: 0, overByLb: 1, over: true },
  { name: 'negative cargo and vehicle weight count as 0', capacitiesLb: [540], vehicleWeightLb: -10, cargoLb: -50, limitLb: 2700, usedLb: 0, remainingLb: 2700, overByLb: 0, over: false },
  { name: 'vehicle heavier than the limit leaves no cargo room', capacitiesLb: [195], vehicleWeightLb: 1000, cargoLb: 0, limitLb: 975, usedLb: 1000, remainingLb: 0, overByLb: 25, over: true },
];

export interface CapacityStatusRow {
  name: string;
  carriedLb: number;
  capacityLb: number;
  remainingLb: number;
  overByLb: number;
  over: boolean;
}

/** Over means strictly greater than the capacity. No further penalty is invented. */
export const CAPACITY_STATUS_ROWS: readonly CapacityStatusRow[] = [
  { name: 'Pony carrying nothing', carriedLb: 0, capacityLb: 225, remainingLb: 225, overByLb: 0, over: false },
  { name: 'Pony at 224 lb has 1 lb left', carriedLb: 224, capacityLb: 225, remainingLb: 1, overByLb: 0, over: false },
  { name: 'Pony at exactly 225 lb is not over (boundary)', carriedLb: 225, capacityLb: 225, remainingLb: 0, overByLb: 0, over: false },
  { name: 'Pony at 226 lb is over by 1 (one too many)', carriedLb: 226, capacityLb: 225, remainingLb: 0, overByLb: 1, over: true },
  { name: 'Mule at exactly 420 is not over', carriedLb: 420, capacityLb: 420, remainingLb: 0, overByLb: 0, over: false },
  { name: 'Mule at 421 is over by 1', carriedLb: 421, capacityLb: 420, remainingLb: 0, overByLb: 1, over: true },
  { name: 'negative carried weight counts as 0', carriedLb: -50, capacityLb: 225, remainingLb: 225, overByLb: 0, over: false },
  { name: 'half a pound over is over', carriedLb: 225.5, capacityLb: 225, remainingLb: 0, overByLb: 0.5, over: true },
  { name: 'capacity 0 with 1 lb is over', carriedLb: 1, capacityLb: 0, remainingLb: 0, overByLb: 1, over: true },
];

// -- Barding and mounting -----------------------------------------------------

/**
 * Barding (PHB L10384): four times the cost, twice the weight. Armor values from
 * the PHB Armor table (L9591-9608): Leather Armor 10 GP / 10 lb, Chain Mail
 * 75 GP / 55 lb, Plate Armor 1,500 GP / 65 lb.
 */
export const BARDING_ROWS: ReadonlyArray<{
  name: string;
  normalCostGp: number;
  normalWeightLb: number;
  costGp: number;
  weightLb: number;
}> = [
  { name: 'Leather Armor as barding', normalCostGp: 10, normalWeightLb: 10, costGp: 40, weightLb: 20 },
  { name: 'Chain Mail as barding', normalCostGp: 75, normalWeightLb: 55, costGp: 300, weightLb: 110 },
  { name: 'Plate Armor as barding', normalCostGp: 1500, normalWeightLb: 65, costGp: 6000, weightLb: 130 },
  { name: 'a free, weightless custom item stays 0', normalCostGp: 0, normalWeightLb: 0, costGp: 0, weightLb: 0 },
  { name: 'fractional weight 0.5 lb doubles to 1', normalCostGp: 1, normalWeightLb: 0.5, costGp: 4, weightLb: 1 },
  { name: 'fractional cost 0.5 GP quadruples to 2', normalCostGp: 0.5, normalWeightLb: 1, costGp: 2, weightLb: 2 },
  { name: 'negative custom values count as 0', normalCostGp: -10, normalWeightLb: -5, costGp: 0, weightLb: 0 },
];

/** PHB L1037: half your Speed (round down); the printed example is 30 ft -> 15 ft. */
export const MOUNTING_COST_ROWS: ReadonlyArray<{ speedFt: number; costFt: number }> = [
  { speedFt: 30, costFt: 15 },
  { speedFt: 25, costFt: 12 },
  { speedFt: 35, costFt: 17 },
  { speedFt: 60, costFt: 30 },
  { speedFt: 1, costFt: 0 },
  { speedFt: 0, costFt: 0 },
  { speedFt: -10, costFt: 0 },
];

// -- NPC party members --------------------------------------------------------

/** DMG L3557 (interpretation D7): max CR = level / 2, exact. */
export const NPC_MAX_CR_ROWS: ReadonlyArray<{ level: number; maxCr: number }> = [
  { level: 1, maxCr: 0.5 },
  { level: 2, maxCr: 1 },
  { level: 3, maxCr: 1.5 },
  { level: 4, maxCr: 2 },
  { level: 5, maxCr: 2.5 },
  { level: 20, maxCr: 10 },
  // Character levels run 1-20 (PHB); out-of-range input clamps.
  { level: 0, maxCr: 0.5 },
  { level: 21, maxCr: 10 },
  { level: 1.9, maxCr: 0.5 },
];

export interface NpcCrRow {
  name: string;
  cr: string | null | undefined;
  level: number;
  status: 'ok' | 'exceeds' | 'unknown';
  /** Parsed CR, null when unreadable. */
  parsedCr: number | null;
}

export const NPC_CR_ROWS: readonly NpcCrRow[] = [
  // Level 1: max CR 1/2.
  { name: 'L1: CR 0 ok', cr: '0', level: 1, status: 'ok', parsedCr: 0 },
  { name: 'L1: CR 1/8 ok', cr: '1/8', level: 1, status: 'ok', parsedCr: 0.125 },
  { name: 'L1: CR 1/4 ok', cr: '1/4', level: 1, status: 'ok', parsedCr: 0.25 },
  { name: 'L1: CR 1/2 ok (boundary, equals half the level)', cr: '1/2', level: 1, status: 'ok', parsedCr: 0.5 },
  { name: 'L1: CR 1 exceeds (one step too high)', cr: '1', level: 1, status: 'exceeds', parsedCr: 1 },
  // Level 2: max CR 1.
  { name: 'L2: CR 1/2 ok', cr: '1/2', level: 2, status: 'ok', parsedCr: 0.5 },
  { name: 'L2: CR 1 ok (boundary)', cr: '1', level: 2, status: 'ok', parsedCr: 1 },
  { name: 'L2: CR 2 exceeds', cr: '2', level: 2, status: 'exceeds', parsedCr: 2 },
  // Level 3: max CR 1.5 (exact, not rounded).
  { name: 'L3: CR 1 ok', cr: '1', level: 3, status: 'ok', parsedCr: 1 },
  { name: 'L3: CR 2 exceeds (max is 1.5)', cr: '2', level: 3, status: 'exceeds', parsedCr: 2 },
  // Level 4: max CR 2.
  { name: 'L4: CR 2 ok (boundary)', cr: '2', level: 4, status: 'ok', parsedCr: 2 },
  { name: 'L4: CR 3 exceeds', cr: '3', level: 4, status: 'exceeds', parsedCr: 3 },
  // Level 5: max CR 2.5.
  { name: 'L5: CR 2 ok', cr: '2', level: 5, status: 'ok', parsedCr: 2 },
  { name: 'L5: CR 3 exceeds (max is 2.5)', cr: '3', level: 5, status: 'exceeds', parsedCr: 3 },
  // Level 20: max CR 10.
  { name: 'L20: CR 10 ok (boundary)', cr: '10', level: 20, status: 'ok', parsedCr: 10 },
  { name: 'L20: CR 11 exceeds', cr: '11', level: 20, status: 'exceeds', parsedCr: 11 },
  // Unreadable CR never warns.
  { name: 'None is unknown', cr: 'None', level: 5, status: 'unknown', parsedCr: null },
  { name: 'empty string is unknown', cr: '', level: 5, status: 'unknown', parsedCr: null },
  { name: 'blank spaces are unknown', cr: '   ', level: 5, status: 'unknown', parsedCr: null },
  { name: 'text is unknown', cr: 'abc', level: 5, status: 'unknown', parsedCr: null },
  { name: 'division by zero is unknown', cr: '1/0', level: 5, status: 'unknown', parsedCr: null },
  { name: 'decimal text is unknown (CRs are integers or fractions)', cr: '0.5', level: 5, status: 'unknown', parsedCr: null },
  { name: 'negative is unknown', cr: '-1', level: 5, status: 'unknown', parsedCr: null },
  { name: 'null is unknown', cr: null, level: 5, status: 'unknown', parsedCr: null },
  { name: 'undefined is unknown', cr: undefined, level: 5, status: 'unknown', parsedCr: null },
  // Parsing tolerance.
  { name: 'surrounding spaces are trimmed', cr: '  1/2  ', level: 1, status: 'ok', parsedCr: 0.5 },
  { name: 'spaces around the slash are tolerated', cr: '1 / 2', level: 1, status: 'ok', parsedCr: 0.5 },
];

// -- Loyalty ------------------------------------------------------------------

export const LOYALTY_BOUNDS = { min: 0, max: 20 } as const;

/** Maximum from the party's highest Charisma (override wins), capped to 0..20; start = floor(max / 2). */
export const LOYALTY_MAX_ROWS: ReadonlyArray<{
  name: string;
  charisma: number;
  override?: number;
  max: number;
  start: number;
}> = [
  { name: 'Cha 14: max 14, start 7', charisma: 14, max: 14, start: 7 },
  { name: 'Cha 15: max 15, start 7 (half rounds down)', charisma: 15, max: 15, start: 7 },
  { name: 'Cha 20: max 20, start 10', charisma: 20, max: 20, start: 10 },
  { name: 'Cha 30: scale ends at 20 (D8a), start 10', charisma: 30, max: 20, start: 10 },
  { name: 'Cha 21: capped to 20', charisma: 21, max: 20, start: 10 },
  { name: 'Cha 1: max 1, start 0', charisma: 1, max: 1, start: 0 },
  { name: 'Cha 0: max 0, start 0', charisma: 0, max: 0, start: 0 },
  { name: 'override 12 beats Cha 18: max 12, start 6', charisma: 18, override: 12, max: 12, start: 6 },
  { name: 'override 25 caps to 20', charisma: 10, override: 25, max: 20, start: 10 },
  { name: 'override -3 floors at 0', charisma: 10, override: -3, max: 0, start: 0 },
  { name: 'override 0 is a real value, not "absent"', charisma: 14, override: 0, max: 0, start: 0 },
  { name: 'fractional Cha truncates', charisma: 14.9, max: 14, start: 7 },
  { name: 'NaN Cha is 0', charisma: Number.NaN, max: 0, start: 0 },
];

export const LOYALTY_CLAMP_ROWS: ReadonlyArray<{ score: number; max: number; expected: number }> = [
  { score: 18, max: 20, expected: 18 },
  { score: 25, max: 20, expected: 20 },
  { score: 20, max: 20, expected: 20 },
  { score: 21, max: 20, expected: 20 },
  { score: -1, max: 20, expected: 0 },
  { score: 0, max: 20, expected: 0 },
  { score: 7.9, max: 20, expected: 7 },
  { score: 5, max: 0, expected: 0 },
  { score: Number.NaN, max: 20, expected: 0 },
];

/** adjustLoyalty(score, delta, max): never above max (L3582), never below 0 (L3580). */
export const LOYALTY_ADJUST_ROWS: ReadonlyArray<{
  name: string;
  score: number;
  delta: number;
  max: number;
  expected: number;
}> = [
  { name: '18 + 4 on max 20 caps at 20', score: 18, delta: 4, max: 20, expected: 20 },
  { name: '3 - 4 floors at 0', score: 3, delta: -4, max: 20, expected: 0 },
  { name: '7 - 8 (worst 2d4) floors at 0', score: 7, delta: -8, max: 20, expected: 0 },
  { name: 'delta 0 is a no-op', score: 10, delta: 0, max: 20, expected: 10 },
  { name: 'already at max, +1 stays at max', score: 20, delta: 1, max: 20, expected: 20 },
  { name: 'already at 0, -1 stays 0', score: 0, delta: -1, max: 20, expected: 0 },
  { name: '12 + 5 on a max of 12 stays 12', score: 12, delta: 5, max: 12, expected: 12 },
  { name: '7 + 2 = 9', score: 7, delta: 2, max: 20, expected: 9 },
  { name: 'fractional delta truncates toward zero: 7 + 2.9 = 9', score: 7, delta: 2.9, max: 20, expected: 9 },
];

/** Stored score clamped to the current maximum (D8d); an absent score follows the start. */
export const LOYALTY_EFFECTIVE_ROWS: ReadonlyArray<{
  name: string;
  stored: number | undefined;
  max: number;
  expected: number;
}> = [
  { name: 'stored 18, maximum lowered to 12 -> 12', stored: 18, max: 12, expected: 12 },
  { name: 'absent on max 14 -> start 7', stored: undefined, max: 14, expected: 7 },
  { name: 'absent on max 15 -> start 7 (round down)', stored: undefined, max: 15, expected: 7 },
  { name: 'stored 0 is a real value, not the start', stored: 0, max: 14, expected: 0 },
  { name: 'stored 5 on max 14 stays 5', stored: 5, max: 14, expected: 5 },
  { name: 'absent on max 0 -> 0', stored: undefined, max: 0, expected: 0 },
  { name: 'stored negative -> 0', stored: -3, max: 14, expected: 0 },
];

export type GoldenLoyaltyBand = 'risks-anything' | 'tenuous' | 'disloyal';

/** DMG L3584. The text overlaps at 10 ("10 or higher" / "between 1 and 10"): 10 counts as risks-anything. */
export const LOYALTY_BAND_ROWS: ReadonlyArray<{ score: number; band: GoldenLoyaltyBand }> = [
  { score: 20, band: 'risks-anything' },
  { score: 11, band: 'risks-anything' },
  { score: 10, band: 'risks-anything' },
  { score: 9, band: 'tenuous' },
  { score: 1, band: 'tenuous' },
  { score: 0, band: 'disloyal' },
  { score: -1, band: 'disloyal' },
];

/** DMG L3580-3582: the three score changes, as dice expressions the UI rolls. */
export const LOYALTY_CHANGE_ROWS: ReadonlyArray<{
  id: string;
  dice: string;
  sign: 1 | -1;
  /** Smallest and largest possible change, signed. */
  minChange: number;
  maxChange: number;
}> = [
  { id: 'helped-or-treated-well', dice: '1d4', sign: 1, minChange: 1, maxChange: 4 },
  { id: 'against-alignment-or-personality', dice: '1d4', sign: -1, minChange: -4, maxChange: -1 },
  { id: 'abused-misled-or-endangered', dice: '2d4', sign: -1, minChange: -8, maxChange: -2 },
];

// -- Tracked hit points -------------------------------------------------------

export interface DamageRow {
  name: string;
  max: number;
  hp: number;
  temp: number;
  amount: number;
  hpAfter: number;
  tempAfter: number;
  tempAbsorbed: number;
  hpLost: number;
  /** Damage left over after reaching 0 HP. */
  overkill: number;
  atZero: boolean;
}

export const DAMAGE_ROWS: readonly DamageRow[] = [
  { name: 'PHB example: 5 temp, 7 damage -> lose the 5 then 2 HP', max: 10, hp: 10, temp: 5, amount: 7, hpAfter: 8, tempAfter: 0, tempAbsorbed: 5, hpLost: 2, overkill: 0, atZero: false },
  { name: 'temp absorbs everything: 5 temp, 3 damage', max: 10, hp: 10, temp: 5, amount: 3, hpAfter: 10, tempAfter: 2, tempAbsorbed: 3, hpLost: 0, overkill: 0, atZero: false },
  { name: 'damage equal to temp exactly leaves HP alone', max: 10, hp: 10, temp: 5, amount: 5, hpAfter: 10, tempAfter: 0, tempAbsorbed: 5, hpLost: 0, overkill: 0, atZero: false },
  { name: 'damage exactly hp + temp drops to 0 with no overkill', max: 10, hp: 10, temp: 5, amount: 15, hpAfter: 0, tempAfter: 0, tempAbsorbed: 5, hpLost: 10, overkill: 0, atZero: true },
  { name: 'one too many: hp + temp + 1 leaves overkill 1', max: 10, hp: 10, temp: 5, amount: 16, hpAfter: 0, tempAfter: 0, tempAbsorbed: 5, hpLost: 10, overkill: 1, atZero: true },
  { name: 'no temp: damage equal to hp is exactly 0 HP', max: 10, hp: 10, temp: 0, amount: 10, hpAfter: 0, tempAfter: 0, tempAbsorbed: 0, hpLost: 10, overkill: 0, atZero: true },
  { name: 'no temp: ordinary damage', max: 10, hp: 10, temp: 0, amount: 4, hpAfter: 6, tempAfter: 0, tempAbsorbed: 0, hpLost: 4, overkill: 0, atZero: false },
  { name: 'already at 0 HP: HP floors at 0, all damage is overkill', max: 10, hp: 0, temp: 0, amount: 4, hpAfter: 0, tempAfter: 0, tempAbsorbed: 0, hpLost: 0, overkill: 4, atZero: true },
  { name: 'zero damage at 0 HP is still at zero', max: 10, hp: 0, temp: 0, amount: 0, hpAfter: 0, tempAfter: 0, tempAbsorbed: 0, hpLost: 0, overkill: 0, atZero: true },
  { name: 'negative damage is ignored (not a heal)', max: 10, hp: 8, temp: 3, amount: -5, hpAfter: 8, tempAfter: 3, tempAbsorbed: 0, hpLost: 0, overkill: 0, atZero: false },
  { name: 'NaN damage is ignored', max: 10, hp: 8, temp: 3, amount: Number.NaN, hpAfter: 8, tempAfter: 3, tempAbsorbed: 0, hpLost: 0, overkill: 0, atZero: false },
  { name: 'fractional damage 2.9 truncates to 2', max: 10, hp: 10, temp: 0, amount: 2.9, hpAfter: 8, tempAfter: 0, tempAbsorbed: 0, hpLost: 2, overkill: 0, atZero: false },
  { name: 'stored HP above a lowered maximum is clamped first (12 of 10, damage 1 -> 9)', max: 10, hp: 12, temp: 0, amount: 1, hpAfter: 9, tempAfter: 0, tempAbsorbed: 0, hpLost: 1, overkill: 0, atZero: false },
  { name: 'temp HP above max HP (allowed) absorbs first: 50 temp on max 10, 30 damage', max: 10, hp: 10, temp: 50, amount: 30, hpAfter: 10, tempAfter: 20, tempAbsorbed: 30, hpLost: 0, overkill: 0, atZero: false },
];

export interface HealRow {
  name: string;
  max: number;
  hp: number;
  temp: number;
  amount: number;
  hpAfter: number;
  regained: number;
}

export const HEAL_ROWS: readonly HealRow[] = [
  { name: 'PHB example L1133: 14/20 + 8 -> 20, regains 6 not 8', max: 20, hp: 14, temp: 0, amount: 8, hpAfter: 20, regained: 6 },
  { name: 'ordinary heal 3/10 + 5 -> 8', max: 10, hp: 3, temp: 0, amount: 5, hpAfter: 8, regained: 5 },
  { name: 'massive heal 3/10 + 99 -> 10, regains 7', max: 10, hp: 3, temp: 0, amount: 99, hpAfter: 10, regained: 7 },
  { name: 'heal exactly to max (boundary)', max: 10, hp: 3, temp: 0, amount: 7, hpAfter: 10, regained: 7 },
  { name: 'one too many: 8 heal from 3/10 regains only 7', max: 10, hp: 3, temp: 0, amount: 8, hpAfter: 10, regained: 7 },
  { name: 'heal at full regains 0', max: 10, hp: 10, temp: 0, amount: 5, hpAfter: 10, regained: 0 },
  { name: 'healing from 0 HP works', max: 10, hp: 0, temp: 0, amount: 1, hpAfter: 1, regained: 1 },
  { name: 'healing leaves temp HP untouched (L1194)', max: 10, hp: 4, temp: 6, amount: 3, hpAfter: 7, regained: 3 },
  { name: 'negative heal is ignored', max: 10, hp: 4, temp: 0, amount: -3, hpAfter: 4, regained: 0 },
  { name: 'NaN heal is ignored', max: 10, hp: 4, temp: 0, amount: Number.NaN, hpAfter: 4, regained: 0 },
  { name: 'fractional heal 2.9 truncates to 2', max: 10, hp: 4, temp: 0, amount: 2.9, hpAfter: 6, regained: 2 },
  { name: 'stored HP above a lowered maximum heals nothing (12 of 10)', max: 10, hp: 12, temp: 0, amount: 3, hpAfter: 10, regained: 0 },
];

/** grantTempHp semantics (L1191): never stack; default keeps the larger; not capped by max HP (L1194, D10). */
export const TEMP_HP_ROWS: ReadonlyArray<{
  name: string;
  current: number;
  offered: number;
  choice: 'keep' | 'replace' | undefined;
  expected: number;
}> = [
  { name: 'PHB example: have 10, offered 12, default keeps the larger -> 12 (never 22)', current: 10, offered: 12, choice: undefined, expected: 12 },
  { name: 'PHB example: have 10, offered 12, player keeps 10', current: 10, offered: 12, choice: 'keep', expected: 10 },
  { name: 'PHB example: have 10, offered 12, player takes 12', current: 10, offered: 12, choice: 'replace', expected: 12 },
  { name: 'offered less than held, default keeps held', current: 12, offered: 10, choice: undefined, expected: 12 },
  { name: 'offered less than held, player replaces anyway', current: 12, offered: 10, choice: 'replace', expected: 10 },
  { name: 'none held: take the offer', current: 0, offered: 5, choice: undefined, expected: 5 },
  { name: 'offer of 0 keeps what is held', current: 5, offered: 0, choice: undefined, expected: 5 },
  { name: 'equal amounts do not add (5 + 5 is 5)', current: 5, offered: 5, choice: undefined, expected: 5 },
  { name: 'negative offer counts as 0', current: 5, offered: -3, choice: undefined, expected: 5 },
  { name: 'temp HP is not capped by the maximum: 50 temp is allowed on a max of 10', current: 0, offered: 50, choice: undefined, expected: 50 },
];

/**
 * storedHpFor writes `undefined` ("follows the maximum") when hp >= max, like
 * Character.currentHp; effectiveTrackedHp reads it back clamped to 0..max.
 */
export const STORED_HP_ROWS: ReadonlyArray<{ hp: number; max: number; stored: number | undefined }> = [
  { hp: 10, max: 10, stored: undefined },
  { hp: 9, max: 10, stored: 9 },
  { hp: 0, max: 10, stored: 0 },
  { hp: 12, max: 10, stored: undefined },
  { hp: -3, max: 10, stored: 0 },
];

export const EFFECTIVE_HP_ROWS: ReadonlyArray<{
  name: string;
  stored: number | undefined;
  max: number;
  expected: number;
}> = [
  { name: 'absent follows the maximum (Ranger levels up -> companion max rises)', stored: undefined, max: 18, expected: 18 },
  { name: 'stored 8 of 18 is 8', stored: 8, max: 18, expected: 8 },
  { name: 'stored above a lowered maximum clamps to it', stored: 30, max: 18, expected: 18 },
  { name: 'stored 0 is a real value (the creature is at 0 HP), not absent', stored: 0, max: 18, expected: 0 },
  { name: 'negative stored clamps to 0', stored: -4, max: 18, expected: 0 },
  { name: 'maximum 0: absent is 0', stored: undefined, max: 0, expected: 0 },
];

export const AT_ZERO_ROWS: ReadonlyArray<{ hp: number; atZero: boolean }> = [
  { hp: 0, atZero: true },
  { hp: 1, atZero: false },
  { hp: -2, atZero: true },
];

// -- Tracked conditions -------------------------------------------------------

export interface ConditionScenario {
  name: string;
  steps: ReadonlyArray<{ op: 'add' | 'remove'; id: string }>;
  /** Condition ids left in `conditions`, in order; undefined = the field is deleted. */
  conditions: readonly string[] | undefined;
  /** undefined = the field is deleted (level 0). */
  exhaustionLevel: number | undefined;
}

export const CONDITION_SCENARIOS: readonly ConditionScenario[] = [
  { name: 'applying a condition twice leaves one entry (no stacking, L1214)', steps: [{ op: 'add', id: 'blinded' }, { op: 'add', id: 'blinded' }], conditions: ['blinded'], exhaustionLevel: undefined },
  { name: 'two different conditions keep application order', steps: [{ op: 'add', id: 'poisoned' }, { op: 'add', id: 'blinded' }], conditions: ['poisoned', 'blinded'], exhaustionLevel: undefined },
  { name: 'removing an absent condition is a no-op', steps: [{ op: 'remove', id: 'blinded' }], conditions: undefined, exhaustionLevel: undefined },
  { name: 'removing the last condition deletes the field', steps: [{ op: 'add', id: 'blinded' }, { op: 'remove', id: 'blinded' }], conditions: undefined, exhaustionLevel: undefined },
  { name: 'removing one of two keeps the other', steps: [{ op: 'add', id: 'blinded' }, { op: 'add', id: 'poisoned' }, { op: 'remove', id: 'blinded' }], conditions: ['poisoned'], exhaustionLevel: undefined },
  { name: 'Exhaustion stacks: three applications = level 3', steps: [{ op: 'add', id: 'exhaustion' }, { op: 'add', id: 'exhaustion' }, { op: 'add', id: 'exhaustion' }], conditions: undefined, exhaustionLevel: 3 },
  { name: 'Exhaustion stops at level 6 (6th application)', steps: Array.from({ length: 6 }, () => ({ op: 'add' as const, id: 'exhaustion' })), conditions: undefined, exhaustionLevel: 6 },
  { name: 'one too many: a 7th Exhaustion application stays at 6', steps: Array.from({ length: 7 }, () => ({ op: 'add' as const, id: 'exhaustion' })), conditions: undefined, exhaustionLevel: 6 },
  { name: 'removing Exhaustion clears every level and deletes the field', steps: [{ op: 'add', id: 'exhaustion' }, { op: 'add', id: 'exhaustion' }, { op: 'remove', id: 'exhaustion' }], conditions: undefined, exhaustionLevel: undefined },
  { name: 'Exhaustion and a normal condition live side by side', steps: [{ op: 'add', id: 'exhaustion' }, { op: 'add', id: 'poisoned' }], conditions: ['poisoned'], exhaustionLevel: 1 },
];

// -- Sidekick hit points (Tasha's 2020, 5e / 2014 rules) -----------------------

export const SIDEKICK_MAX_HP_ROWS: ReadonlyArray<{
  name: string;
  baseHpMax: number;
  gains: readonly number[];
  maxHp: number;
}> = [
  { name: 'no level-ups: the entered starting HP', baseHpMax: 9, gains: [], maxHp: 9 },
  { name: 'three level-ups add up: 9 + 5 + 4 + 1', baseHpMax: 9, gains: [5, 4, 1], maxHp: 19 },
];

export const SIDEKICK_LEVEL_UP_ROWS: ReadonlyArray<{
  name: string;
  level: number;
  baseHpMax: number;
  roll: number;
  conMod: number;
  hitDie: number;
  /** null = no level-up possible (already level 20). */
  newLevel: number | null;
  hpGained: number | null;
  maxHpAfter: number | null;
}> = [
  { name: 'level 3 -> 4: roll 4 + Con +2 = 6 gained', level: 3, baseHpMax: 20, roll: 4, conMod: 2, hitDie: 8, newLevel: 4, hpGained: 6, maxHpAfter: 26 },
  { name: 'a poor roll with a negative modifier still gains the minimum 1', level: 3, baseHpMax: 20, roll: 1, conMod: -3, hitDie: 8, newLevel: 4, hpGained: 1, maxHpAfter: 21 },
  { name: 'max roll on the die (boundary): 8 + 0', level: 1, baseHpMax: 9, roll: 8, conMod: 0, hitDie: 8, newLevel: 2, hpGained: 8, maxHpAfter: 17 },
  { name: 'level 19 -> 20 is allowed', level: 19, baseHpMax: 100, roll: 5, conMod: 1, hitDie: 8, newLevel: 20, hpGained: 6, maxHpAfter: 106 },
  { name: 'level 20 cannot level up (one too many)', level: 20, baseHpMax: 100, roll: 5, conMod: 1, hitDie: 8, newLevel: null, hpGained: null, maxHpAfter: null },
];

/** Default starting level = the party's level, rounded down, within 1-20 (src/logic/sidekick.ts). */
export const SIDEKICK_START_LEVEL_ROWS: ReadonlyArray<{ characterLevel: number; startLevel: number }> = [
  { characterLevel: 1, startLevel: 1 },
  { characterLevel: 7, startLevel: 7 },
  { characterLevel: 20, startLevel: 20 },
];

// -- Cardinality ---------------------------------------------------------------

/** Sanitizer / UI guard caps (plan D12; the books set no cap). */
export const CAPS = {
  // Creatures holds the former Companions (20) and Mounts (20) lists (v3 merge).
  companions: 40,
  hirelings: 30,
  npcPartyMembers: 10,
  sidekicks: 10,
} as const;

export type GoldenCapKind = keyof typeof CAPS;

/** canAddRecord(kind, currentCount): true while currentCount is below the cap. */
export const CAP_ROWS: ReadonlyArray<{ kind: GoldenCapKind; count: number; canAdd: boolean }> = [
  { kind: 'companions', count: 0, canAdd: true },
  { kind: 'companions', count: 39, canAdd: true },
  { kind: 'companions', count: 40, canAdd: false },
  { kind: 'companions', count: 41, canAdd: false },
  { kind: 'hirelings', count: 29, canAdd: true },
  { kind: 'hirelings', count: 30, canAdd: false },
  { kind: 'npcPartyMembers', count: 9, canAdd: true },
  { kind: 'npcPartyMembers', count: 10, canAdd: false },
  { kind: 'sidekicks', count: 9, canAdd: true },
  { kind: 'sidekicks', count: 10, canAdd: false },
  { kind: 'sidekicks', count: -1, canAdd: true },
];
