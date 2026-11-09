/**
 * Companions page: pure rules logic (hirelings, mounts, NPC party members,
 * Loyalty, tracked hit points and conditions, sidekick hit points).
 *
 * Every function here is pure and reproduces the golden table in
 * src/logic/__tests__/companions-golden.ts, which was written first from the
 * rulebook text. Line numbers are 1-based numbers for Docs/*.md (grep/read tools).
 *   PHB = Docs/PlayersHandbook.md (2024), DMG = Docs/DungeonMastersGuide.md (2024),
 *   Tasha = Docs/TashasCauldronOfEverything.md (2020; 5e, 2014 rules; opt-in).
 *
 * Interpretations flagged to the user (plan D7-D10, D12) are marked INTERPRETATION.
 */
import type { ActiveCondition } from '../types/character';
import type { Breakdown } from './breakdown';
import { applyCondition, clampExhaustionLevel, isTrackedConditionId, removeCondition } from './conditions';
import { grantTempHp, type TempHpChoice } from './hit-points-state';
import { parseChallengeRating, sidekickHitPointsGained, sidekickLevelForParty } from './sidekick';

// -- Shared numeric helpers ---------------------------------------------------

/** Finite number -> whole number >= 0 (fractions truncate, PHB L257 "Round Down"); anything else 0. */
function wholeNonNegative(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

/** Finite number >= 0 (fractions kept, e.g. 0.5 lb); anything else 0. */
function nonNegative(n: number): number {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function clampInt(n: number, min: number, max: number): number {
  const t = Number.isFinite(n) ? Math.trunc(n) : 0;
  return Math.min(max, Math.max(min, t));
}

// -- Cardinality caps ---------------------------------------------------------

/** Sanitizer / UI guards (plan D12). The books set no cap. */
export const COMPANIONS_MAX = 20;
export const MOUNTS_MAX = 20;
export const HIRELINGS_MAX = 30;
export const NPC_PARTY_MAX = 10;
export const SIDEKICKS_MAX = 10;

export const COMPANION_CAPS = {
  companions: COMPANIONS_MAX,
  mounts: MOUNTS_MAX,
  hirelings: HIRELINGS_MAX,
  npcPartyMembers: NPC_PARTY_MAX,
  sidekicks: SIDEKICKS_MAX,
} as const;

export type CompanionCapKind = keyof typeof COMPANION_CAPS;

/** True while one more record fits under the cap for `kind`. */
export function canAddRecord(kind: CompanionCapKind, currentCount: number): boolean {
  return currentCount < COMPANION_CAPS[kind];
}

// -- Coins and hirelings ------------------------------------------------------

export const CP_PER_SP = 10;
export const CP_PER_GP = 100;
/** Days or miles of a hireling: whole number 0..99999 (sanitizer guard, not a book rule). */
export const HIRELING_UNITS_MAX = 99999;

export type HirelingKind = 'skilled' | 'untrained' | 'messenger';

/** PHB L10530-10533 (Hirelings table), in copper pieces per unit. */
export const HIRELING_RATES: Readonly<Record<HirelingKind, { rateCp: number; unit: 'day' | 'mile'; printed: string }>> = {
  skilled: { rateCp: 2 * CP_PER_GP, unit: 'day', printed: '2 GP per day' },
  untrained: { rateCp: 2 * CP_PER_SP, unit: 'day', printed: '2 SP per day' },
  messenger: { rateCp: 2, unit: 'mile', printed: '2 CP per mile' },
};

/** The fields of a hireling record that cost depends on. */
export interface HirelingCostInput {
  kind: HirelingKind;
  units: number;
  /** Copper pieces per unit entered by the user; the table pay is a minimum (PHB L10525). */
  customRateCp?: number | undefined;
}

export function hirelingRatePerUnitCp(kind: HirelingKind): number {
  return HIRELING_RATES[kind].rateCp;
}

export function hirelingUnitName(kind: HirelingKind): 'day' | 'mile' {
  return HIRELING_RATES[kind].unit;
}

/** Whole number of days or miles, 0..99999. */
export function clampHirelingUnits(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n >= HIRELING_UNITS_MAX) return HIRELING_UNITS_MAX;
  return wholeNonNegative(n);
}

function validCustomRate(h: HirelingCostInput): number | null {
  const r = h.customRateCp;
  if (r === undefined || !Number.isFinite(r) || r < 0) return null;
  return Math.trunc(r);
}

/** The pay per unit actually applied: a valid custom rate wins over the table. */
export function effectiveRatePerUnitCp(h: HirelingCostInput): number {
  return validCustomRate(h) ?? hirelingRatePerUnitCp(h.kind);
}

/** PHB L10525: the table pay is a minimum. True when a custom rate is below it (warn, never block). */
export function isBelowMinimumRate(h: HirelingCostInput): boolean {
  const custom = validCustomRate(h);
  return custom !== null && custom < hirelingRatePerUnitCp(h.kind);
}

export function hirelingTotalCp(h: HirelingCostInput): number {
  return effectiveRatePerUnitCp(h) * clampHirelingUnits(h.units);
}

export function hirelingsTotalCp(list: readonly HirelingCostInput[]): number {
  return list.reduce((sum, h) => sum + hirelingTotalCp(h), 0);
}

/** 1 GP = 10 SP = 100 CP. Negative input counts as 0; fractions truncate. */
export function splitCopper(cp: number): { gp: number; sp: number; cp: number } {
  const n = wholeNonNegative(cp);
  return { gp: Math.floor(n / CP_PER_GP), sp: Math.floor((n % CP_PER_GP) / CP_PER_SP), cp: n % CP_PER_SP };
}

/** "7 GP 3 SP"; zero parts are omitted; nothing at all is "0 CP". */
export function formatCopper(cp: number): string {
  const { gp, sp, cp: rest } = splitCopper(cp);
  const parts: string[] = [];
  if (gp > 0) parts.push(`${gp} GP`);
  if (sp > 0) parts.push(`${sp} SP`);
  if (rest > 0) parts.push(`${rest} CP`);
  return parts.length === 0 ? '0 CP' : parts.join(' ');
}

/**
 * Breakdown for a hireling's total cost. The single component carries the whole
 * product (components must sum to the total); `note` spells out the multiplication.
 */
export function hirelingCostBreakdown(h: HirelingCostInput): Breakdown {
  const unit = hirelingUnitName(h.kind);
  const units = clampHirelingUnits(h.units);
  const rate = effectiveRatePerUnitCp(h);
  const total = rate * units;
  return {
    total,
    components: [{ label: `${rate} CP per ${unit} x ${units} ${unit}${units === 1 ? '' : 's'}`, value: total }],
    note: `${formatCopper(rate)} per ${unit} x ${units} = ${formatCopper(total)}`,
  };
}

// -- Mounts: carrying capacity ------------------------------------------------

export type CarrySize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';

/** Size order, smallest to largest (PHB creature sizes). */
export const SIZE_ORDER: readonly CarrySize[] = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

/** PHB L20795-20800, Carrying Capacity table, "Carry" column (lb per point of Strength). */
export const CARRY_MULTIPLIER_BY_SIZE: Readonly<Record<CarrySize, number>> = {
  Tiny: 7.5,
  Small: 15,
  Medium: 15,
  Large: 30,
  Huge: 60,
  Gargantuan: 120,
};

/** PHB L10378: an animal pulling a vehicle can move up to five times its base carrying capacity. */
export const VEHICLE_PULL_FACTOR = 5;
/** PHB L10384: barding costs four times the normal cost and weighs twice as much. */
export const BARDING_COST_FACTOR = 4;
export const BARDING_WEIGHT_FACTOR = 2;

function isCarrySize(s: string | null | undefined): s is CarrySize {
  return s !== null && s !== undefined && (SIZE_ORDER as readonly string[]).includes(s);
}

export function sizeCarryMultiplier(size: CarrySize): number {
  if (!isCarrySize(size)) throw new RangeError(`Unknown creature size: ${String(size)}`);
  return CARRY_MULTIPLIER_BY_SIZE[size];
}

/** The next larger size; Gargantuan has none and stays Gargantuan. */
export function sizeOneLarger(size: CarrySize): CarrySize {
  if (!isCarrySize(size)) throw new RangeError(`Unknown creature size: ${String(size)}`);
  return SIZE_ORDER[Math.min(SIZE_ORDER.length - 1, SIZE_ORDER.indexOf(size) + 1)];
}

/**
 * floor(Strength x size multiplier) (PHB L20795-20800; Round Down, L257).
 * INTERPRETATION D9: the PHB table is stated for characters; applying it to other
 * creatures is an extension that reproduces all eight printed Mounts table values.
 * `oneSizeLarger` is the Mule's Beast of Burden step.
 */
export function derivedCarryingCapacityLb(
  str: number,
  size: CarrySize,
  opts: { oneSizeLarger?: boolean } = {},
): number {
  const effective = opts.oneSizeLarger ? sizeOneLarger(size) : size;
  return Math.floor(nonNegative(str) * sizeCarryMultiplier(effective));
}

/** Minimal creature shape the mount functions read (a CreatureStatBlock satisfies it). */
export interface MountCreatureLike {
  size: string | null;
  abilities: { str: { score: number | null } };
  traits: readonly { name: string }[];
  mountTable?: { carryingCapacityLb: number } | undefined;
}

/** The Mule's trait: "counts as one size larger when determining its carrying capacity". */
export function creatureHasBeastOfBurden(creature: Pick<MountCreatureLike, 'traits'>): boolean {
  return creature.traits.some((t) => t.name.trim().toLowerCase() === 'beast of burden');
}

export interface MountCapacity {
  capacityLb: number | null;
  source: 'table' | 'derived' | 'unknown';
  /** True only when the size step was applied while DERIVING a capacity (never on a table value). */
  beastOfBurdenApplied: boolean;
  breakdown: Breakdown;
}

/**
 * Carrying capacity of a mount. The printed Mounts and Other Animals value wins
 * (PHB L10392-10401) and ALREADY includes the Mule's Beast of Burden step (14 x 30
 * = 420), so the step is never added on top of it. Creatures without a table row
 * derive floor(Str x size multiplier), stepping the size up for Beast of Burden.
 */
export function mountCapacity(creature: MountCreatureLike): MountCapacity {
  if (creature.mountTable) {
    const lb = creature.mountTable.carryingCapacityLb;
    return {
      capacityLb: lb,
      source: 'table',
      beastOfBurdenApplied: false,
      breakdown: { total: lb, components: [{ label: 'Mounts and Other Animals table (PHB)', value: lb }] },
    };
  }
  const str = creature.abilities.str.score;
  if (!isCarrySize(creature.size) || str === null || !Number.isFinite(str)) {
    return {
      capacityLb: null,
      source: 'unknown',
      beastOfBurdenApplied: false,
      breakdown: { total: 0, components: [{ label: 'Unknown (needs a size and a Strength score)', value: 0 }] },
    };
  }
  const bob = creatureHasBeastOfBurden(creature);
  const effective = bob ? sizeOneLarger(creature.size) : creature.size;
  const lb = derivedCarryingCapacityLb(str, creature.size, { oneSizeLarger: bob });
  const sizeLabel = bob ? `${effective} (Beast of Burden: one size larger than ${creature.size})` : effective;
  return {
    capacityLb: lb,
    source: 'derived',
    beastOfBurdenApplied: bob,
    breakdown: { total: lb, components: [{ label: `Str ${str} x ${CARRY_MULTIPLIER_BY_SIZE[effective]} for ${sizeLabel}`, value: lb }] },
  };
}

// -- Mounts: vehicles and carried weight --------------------------------------

/** Five times the SUM of the pulling animals' base capacities (PHB L10378). */
export function vehiclePullLimitLb(capacitiesLb: readonly number[]): number {
  return VEHICLE_PULL_FACTOR * capacitiesLb.reduce((sum, c) => sum + nonNegative(c), 0);
}

export interface VehicleLoad {
  limitLb: number;
  usedLb: number;
  remainingLb: number;
  overByLb: number;
  over: boolean;
}

/** The limit includes the weight of the vehicle itself (PHB L10378). */
export function vehicleLoad(capacitiesLb: readonly number[], vehicleWeightLb: number, cargoLb: number): VehicleLoad {
  const limitLb = vehiclePullLimitLb(capacitiesLb);
  const usedLb = nonNegative(vehicleWeightLb) + nonNegative(cargoLb);
  return {
    limitLb,
    usedLb,
    remainingLb: Math.max(0, limitLb - usedLb),
    overByLb: Math.max(0, usedLb - limitLb),
    over: usedLb > limitLb,
  };
}

export interface CapacityStatus {
  remainingLb: number;
  overByLb: number;
  over: boolean;
}

/** Over means strictly greater than the capacity; exactly at capacity is fine. No further penalty is invented. */
export function capacityStatus(carriedLb: number, capacityLb: number): CapacityStatus {
  const carried = nonNegative(carriedLb);
  const cap = nonNegative(capacityLb);
  return { remainingLb: Math.max(0, cap - carried), overByLb: Math.max(0, carried - cap), over: carried > cap };
}

// -- Barding and mounting -----------------------------------------------------

/** PHB L10384: barding costs four times the normal cost. */
export function bardingCostGp(normalCostGp: number): number {
  return nonNegative(normalCostGp) * BARDING_COST_FACTOR;
}

/** PHB L10384: barding weighs twice as much. */
export function bardingWeightLb(normalWeightLb: number): number {
  return nonNegative(normalWeightLb) * BARDING_WEIGHT_FACTOR;
}

/** PHB L1037: mounting or dismounting costs half your Speed (round down). */
export function mountingCostFt(speedFt: number): number {
  return Math.floor(nonNegative(speedFt) / 2);
}

// -- NPC party members --------------------------------------------------------

/**
 * DMG L3557: a Challenge Rating no higher than half the characters' level.
 * INTERPRETATION D7: compared against the exact value level / 2 (no rounding);
 * PHB "Round Down" (L257) would make half of level 1 equal 0. Character levels
 * run 1-20, so the level is clamped to that range.
 */
export function npcMaxChallengeRating(partyLevel: number): number {
  return clampInt(partyLevel, 1, 20) / 2;
}

export interface NpcCrCheck {
  status: 'ok' | 'exceeds' | 'unknown';
  /** Parsed CR, null when unreadable. */
  cr: number | null;
  maxCr: number;
  /** Warning text for `exceeds`; empty otherwise. Warn only, never block. */
  message: string;
}

export function npcChallengeRatingCheck(crText: string | null | undefined, partyLevel: number): NpcCrCheck {
  const maxCr = npcMaxChallengeRating(partyLevel);
  const cr = parseChallengeRating(crText);
  if (cr === null) return { status: 'unknown', cr: null, maxCr, message: '' };
  if (cr > maxCr) {
    return {
      status: 'exceeds',
      cr,
      maxCr,
      message: `CR ${(crText ?? '').trim()} is above half your level (max CR ${maxCr}). DMG: use a stat block whose CR is no higher than half the characters' level.`,
    };
  }
  return { status: 'ok', cr, maxCr, message: '' };
}

// -- Loyalty (DMG L3577-3584, optional rule) ----------------------------------

export const LOYALTY_MIN = 0;
export const LOYALTY_MAX = 20;

export type LoyaltyBand = 'risks-anything' | 'tenuous' | 'disloyal';

/** DMG L3580-3582: the three ways a Loyalty Score changes. The user rolls `dice` and applies sign x total. */
export const LOYALTY_CHANGES: readonly { id: string; label: string; dice: string; sign: 1 | -1 }[] = [
  { id: 'helped-or-treated-well', label: 'Helped with a goal / treated well', dice: '1d4', sign: 1 },
  { id: 'against-alignment-or-personality', label: 'Acted against alignment or personality', dice: '1d4', sign: -1 },
  { id: 'abused-misled-or-endangered', label: 'Abused, misled or endangered for selfish reasons', dice: '2d4', sign: -1 },
];

/**
 * Maximum Loyalty Score: the highest Charisma among the party (DMG L3578), or the
 * user's override. INTERPRETATION D8a: the scale ends at 20, so it is capped to 0..20.
 */
export function loyaltyMaximum(highestCharisma: number, override?: number): number {
  const base = override !== undefined && Number.isFinite(override) ? override : highestCharisma;
  return clampInt(base, LOYALTY_MIN, LOYALTY_MAX);
}

/** Starting score: half the maximum (DMG L3578), rounded down (D8b, PHB L257). */
export function loyaltyStart(max: number): number {
  return Math.floor(clampInt(max, LOYALTY_MIN, LOYALTY_MAX) / 2);
}

/** A whole score from 0 to the maximum (never below 0, L3580; never above the maximum, L3582). */
export function clampLoyalty(score: number, max: number): number {
  return clampInt(score, LOYALTY_MIN, clampInt(max, LOYALTY_MIN, LOYALTY_MAX));
}

/** Apply a signed change, then clamp. Fractions of `delta` truncate. */
export function adjustLoyalty(score: number, delta: number, max: number): number {
  const d = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return clampLoyalty(clampInt(score, -Infinity, Infinity) + d, max);
}

/**
 * The score in force: a stored score clamped to the current maximum (D8d, "adjust
 * accordingly" L3578); an absent score follows the starting value.
 */
export function effectiveLoyalty(stored: number | undefined, max: number): number {
  return stored === undefined ? loyaltyStart(max) : clampLoyalty(stored, max);
}

/**
 * DMG L3584. The text overlaps at 10 ("10 or higher" / "between 1 and 10");
 * INTERPRETATION D8c: 10 counts as "risks anything".
 */
export function loyaltyBand(score: number): LoyaltyBand {
  if (score >= 10) return 'risks-anything';
  if (score >= 1) return 'tenuous';
  return 'disloyal';
}

// -- Tracked hit points (PHB L1133, L1183, L1191, L1194) ----------------------

export interface TrackedHpState {
  max: number;
  hp: number;
  temp: number;
}

export interface TrackedDamageResult {
  hp: number;
  temp: number;
  tempAbsorbed: number;
  hpLost: number;
  /** Damage left over after reaching 0 HP. */
  overkill: number;
  atZero: boolean;
}

/**
 * Damage: Temporary Hit Points are lost first and leftover damage carries to Hit
 * Points (PHB L1183). Current HP floors at 0. Negative, NaN and fractional amounts
 * are ignored / truncated. A stored HP above the maximum is clamped first.
 */
export function applyTrackedDamage(state: TrackedHpState, amount: number): TrackedDamageResult {
  const max = wholeNonNegative(state.max);
  const hp = Math.min(wholeNonNegative(state.hp), max);
  const temp = wholeNonNegative(state.temp);
  const damage = wholeNonNegative(amount);
  const tempAbsorbed = Math.min(temp, damage);
  const carried = damage - tempAbsorbed;
  const hpLost = Math.min(hp, carried);
  return {
    hp: hp - hpLost,
    temp: temp - tempAbsorbed,
    tempAbsorbed,
    hpLost,
    overkill: carried - hpLost,
    atZero: hp - hpLost <= 0,
  };
}

export interface TrackedHealResult {
  hp: number;
  /** Unchanged: healing cannot restore Temporary Hit Points (PHB L1194). */
  temp: number;
  regained: number;
}

/** Healing is capped at the maximum, excess is lost (PHB L1133). */
export function applyTrackedHealing(state: TrackedHpState, amount: number): TrackedHealResult {
  const max = wholeNonNegative(state.max);
  const hp = Math.min(wholeNonNegative(state.hp), max);
  const regained = Math.min(wholeNonNegative(amount), max - hp);
  return { hp: hp + regained, temp: wholeNonNegative(state.temp), regained };
}

/**
 * Receive Temporary Hit Points: they never stack (PHB L1191); the default keeps
 * the larger. INTERPRETATION D10: NOT capped by the maximum, because a creature
 * "can be at full Hit Points and receive Temporary Hit Points" (PHB L1194).
 */
export function giveTrackedTempHp(current: number, offered: number, choice?: TempHpChoice): number {
  return grantTempHp(current, offered, choice);
}

/** Value to store: `undefined` ("follows the maximum") when hp >= max, like Character.currentHp. */
export function storedHpFor(hp: number, max: number): number | undefined {
  const m = wholeNonNegative(max);
  const h = wholeNonNegative(hp);
  return h >= m ? undefined : h;
}

/** Current HP in force: an absent value follows the maximum; a stored value is clamped to 0..max. */
export function effectiveTrackedHp(stored: number | undefined, max: number): number {
  const m = wholeNonNegative(max);
  return stored === undefined ? m : Math.min(m, wholeNonNegative(stored));
}

export function isAtZeroHp(hp: number): boolean {
  return hp <= 0;
}

// -- Tracked conditions (PHB L1214, Exhaustion) -------------------------------

/** The condition fields a tracked creature carries. */
export interface TrackedConditionsState {
  conditions?: ActiveCondition[];
  exhaustionLevel?: number;
}

/**
 * Receive a condition. Exhaustion is cumulative up to level 6; every other
 * condition is idempotent (no stacking, PHB L1214). Unknown ids are ignored.
 */
export function addTrackedCondition<T extends TrackedConditionsState>(t: T, id: string): T {
  if (id === 'exhaustion') {
    return { ...t, exhaustionLevel: clampExhaustionLevel((t.exhaustionLevel ?? 0) + 1) };
  }
  if (!isTrackedConditionId(id)) return t;
  return { ...t, conditions: applyCondition(t.conditions, id) };
}

/** Drop a condition (Exhaustion: all levels). The field is deleted when it becomes empty. */
export function removeTrackedCondition<T extends TrackedConditionsState>(t: T, id: string): T {
  const next: T = { ...t };
  if (id === 'exhaustion') {
    delete next.exhaustionLevel;
    return next;
  }
  if (!isTrackedConditionId(id)) return t;
  const remaining = removeCondition(t.conditions, id);
  if (remaining.length === 0) delete next.conditions;
  else next.conditions = remaining;
  return next;
}

// -- Sidekick hit points (Tasha's 2020, 5e / 2014 rules) -----------------------

export interface SidekickHpLike {
  level: number;
  baseHpMax: number;
  levelUps: readonly { level: number; roll: number; hpGained: number }[];
}

const SIDEKICK_TOP_LEVEL = 20;

/** Entered starting HP plus every recorded gain. */
export function sidekickMaxHp(rec: Pick<SidekickHpLike, 'baseHpMax' | 'levelUps'>): number {
  return rec.levelUps.reduce((sum, l) => sum + l.hpGained, rec.baseHpMax);
}

/**
 * Gain a level (Tasha L6956 via sidekick.ts): the rolled Hit Die plus the
 * Constitution modifier, minimum 1. Returns null at level 20. Does not mutate.
 */
export function sidekickLevelUp<T extends SidekickHpLike>(
  rec: T,
  roll: number,
  conMod: number,
  hitDie: number,
): T | null {
  if (rec.level >= SIDEKICK_TOP_LEVEL) return null;
  const hpGained = sidekickHitPointsGained(roll, conMod, hitDie);
  const level = rec.level + 1;
  return { ...rec, level, levelUps: [...rec.levelUps, { level, roll, hpGained }] };
}

/** Default starting level: the party's level, rounded down, within 1-20 (single-character sheet). */
export function sidekickDefaultStartLevel(characterLevel: number): number {
  return sidekickLevelForParty([characterLevel]);
}
