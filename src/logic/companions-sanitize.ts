/**
 * Sanitizers for the Companions page's additive-optional Character fields
 * (`companions`, `mounts`, `hirelings`, `npcPartyMembers`, `sidekicks`,
 * `loyaltyMaxOverride`). They run on every IMPORTED and SHARED character, which
 * is untrusted data (storage/export-import.ts, logic/share-validate.ts).
 *
 * Posture (same as `sanitizeResourcesSpent` / `sanitizeClassChoices`):
 *  - a wrong-typed field disappears; arrays are capped (companions.ts caps);
 *  - non-object or id-less or duplicate-id entries are dropped;
 *  - a record whose `creatureId` is not in CREATURE_CATALOG is dropped whole;
 *  - a record whose required enum (origin, kind, classId) is invalid is dropped;
 *  - an optional enum or number outside its range removes just that field;
 *  - only KNOWN keys are copied (never the raw object), so no extra or
 *    `__proto__` keys survive;
 *  - strings are control-character stripped, trimmed and length-capped;
 *  - an empty result deletes the field.
 *
 * No game rule lives here: only shape and bounds. The bounds are guards, not
 * rules (the caps are Stage-2 design limits, not book limits).
 */

import type {
  ActiveCondition,
  Ability,
  CompanionOrigin,
  CompanionRecord,
  CompanionSpiritType,
  CustomStatBlock,
  HirelingRecord,
  MountRecord,
  NamedStatEntry,
  NpcPartyMemberRecord,
  SaddleKind,
  SidekickLevelUp,
  SidekickRecord,
  TrackedCreature,
} from '../types/character';
import { ABILITIES } from '../types/character';
import { ARMOR_CATALOG } from '../data/armor';
import { CREATURE_CATALOG } from '../data/creatures';
import type { CreatureSize } from '../data/creatures';
import { SIDEKICK_CLASS_IDS } from '../data/sidekicks';
import type { SidekickClassId } from '../data/sidekicks';
import {
  COMPANIONS_MAX,
  HIRELING_RATES,
  HIRELINGS_MAX,
  LOYALTY_MAX,
  LOYALTY_MIN,
  MOUNTS_MAX,
  NPC_PARTY_MAX,
  SIDEKICKS_MAX,
  HIRELING_UNITS_MAX,
} from './companions';
import type { HirelingKind } from './companions';
import { isTrackedConditionId } from './conditions';

// ─── Bounds (guards, not rules) ──────────────────────────────────────────────

const ID_MAX = 80;
const NAME_MAX = 80;
const NOTES_MAX = 2000;
const ENTRY_DESCRIPTION_MAX = 2000;
const STAT_TEXT_MAX = 500;
const CR_TEXT_MAX = 10;
const ENTRIES_PER_LIST_MAX = 20;
const CONDITIONS_MAX = 40;
const LEVEL_UPS_MAX = 19;
const HP_MAX = 99999;
const TEMP_HP_MAX = 9999;
const WEIGHT_MAX = 1_000_000;
const COST_GP_MAX = 1_000_000_000;
const RATE_CP_MAX = 10_000_000;
const XP_MAX = 10_000_000;

const ORIGINS: readonly CompanionOrigin[] = [
  'primal-companion',
  'find-familiar',
  'pact-of-the-chain',
  'wild-companion',
  'find-steed',
  'animate-dead',
  'pet',
];
const SPIRIT_TYPES: readonly CompanionSpiritType[] = ['Celestial', 'Fey', 'Fiend'];
const SADDLES: readonly SaddleKind[] = ['none', 'riding', 'military', 'exotic'];
const SIZES: readonly CreatureSize[] = ['Tiny', 'Small', 'Medium', 'Large', 'Huge'];
const MARTIAL_ROLES = ['Attacker', 'Defender'] as const;
const SPELLCASTING_ROLES = ['Mage', 'Healer', 'Prodigy'] as const;

// ─── Primitive helpers ───────────────────────────────────────────────────────

type Raw = Record<string, unknown>;

function isPlainObject(value: unknown): value is Raw {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Strip control characters, trim, cap the length; undefined when not a string. */
function cleanString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const stripped = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return stripped.slice(0, max);
}

/** A non-empty cleaned string, else undefined. */
function nonEmptyString(value: unknown, max: number): string | undefined {
  const s = cleanString(value, max);
  return s ? s : undefined;
}

function intInRange(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  return value >= min && value <= max ? value : undefined;
}

function numberInRange(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value >= min && value <= max ? value : undefined;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function assign<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) target[key] = value;
}

/** A record id: a non-empty bounded string (generated at creation, never invented here). */
function recordId(value: unknown): string | undefined {
  return nonEmptyString(value, ID_MAX);
}

/** Sanitize a list of records: array only, drop invalid, drop duplicate ids, cap. */
function sanitizeList<T extends { id: string }>(value: unknown, cap: number, one: (raw: Raw) => T | undefined): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: T[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (out.length >= cap) break;
    if (!isPlainObject(raw)) continue;
    const rec = one(raw);
    if (!rec || seen.has(rec.id)) continue;
    seen.add(rec.id);
    out.push(rec);
  }
  return out.length > 0 ? out : undefined;
}

// ─── Shared tracking fields ──────────────────────────────────────────────────

function sanitizeTrackedConditions(value: unknown): ActiveCondition[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: ActiveCondition[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (out.length >= CONDITIONS_MAX) break;
    if (!isPlainObject(raw)) continue;
    const id = raw.id;
    // Durations are not used for tracked creatures; unknown ids and Exhaustion
    // (its own level field) are dropped. A condition does not stack (PHB L1214).
    if (typeof id !== 'string' || !isTrackedConditionId(id) || seen.has(id)) continue;
    seen.add(id);
    const entry: ActiveCondition = { id };
    const note = nonEmptyString(raw.note, 200);
    if (note) entry.note = note;
    out.push(entry);
  }
  return out.length > 0 ? out : undefined;
}

function sanitizeTracked(raw: Raw, target: TrackedCreature): void {
  assign(target, 'hp', intInRange(raw.hp, 0, HP_MAX));
  assign(target, 'tempHp', intInRange(raw.tempHp, 1, TEMP_HP_MAX));
  assign(target, 'conditions', sanitizeTrackedConditions(raw.conditions));
  assign(target, 'exhaustionLevel', intInRange(raw.exhaustionLevel, 1, 6));
  assign(target, 'notes', nonEmptyString(raw.notes, NOTES_MAX));
}

// ─── Companions ──────────────────────────────────────────────────────────────

function sanitizeCompanion(raw: Raw): CompanionRecord | undefined {
  const id = recordId(raw.id);
  const creatureId = typeof raw.creatureId === 'string' ? raw.creatureId : undefined;
  const origin = oneOf(raw.origin, ORIGINS);
  if (!id || !creatureId || !origin) return undefined;
  if (!Object.hasOwn(CREATURE_CATALOG, creatureId)) return undefined;
  const rec: CompanionRecord = { id, creatureId, origin };
  assign(rec, 'nickname', nonEmptyString(raw.nickname, NAME_MAX));
  if (raw.dismissed === true) rec.dismissed = true;
  assign(rec, 'hpMaxOverride', intInRange(raw.hpMaxOverride, 1, HP_MAX));
  assign(rec, 'spellSlotLevel', intInRange(raw.spellSlotLevel, 2, 9));
  assign(rec, 'steedType', oneOf(raw.steedType, SPIRIT_TYPES));
  assign(rec, 'familiarType', oneOf(raw.familiarType, SPIRIT_TYPES));
  assign(rec, 'castingClassId', nonEmptyString(raw.castingClassId, ID_MAX));
  sanitizeTracked(raw, rec);
  return rec;
}

export function sanitizeCompanions(value: unknown): CompanionRecord[] | undefined {
  return sanitizeList(value, COMPANIONS_MAX, sanitizeCompanion);
}

// ─── Mounts ──────────────────────────────────────────────────────────────────

function sanitizeMount(raw: Raw): MountRecord | undefined {
  const id = recordId(raw.id);
  const creatureId = typeof raw.creatureId === 'string' ? raw.creatureId : undefined;
  if (!id || !creatureId || !Object.hasOwn(CREATURE_CATALOG, creatureId)) return undefined;
  const rec: MountRecord = { id, creatureId };
  assign(rec, 'nickname', nonEmptyString(raw.nickname, NAME_MAX));
  assign(rec, 'carriedLb', numberInRange(raw.carriedLb, 0, WEIGHT_MAX));
  assign(rec, 'saddle', oneOf(raw.saddle, SADDLES));
  if (typeof raw.bardingArmorId === 'string' && Object.hasOwn(ARMOR_CATALOG, raw.bardingArmorId)) {
    rec.bardingArmorId = raw.bardingArmorId;
  }
  if (isPlainObject(raw.bardingCustom)) {
    const costGp = numberInRange(raw.bardingCustom.costGp, 0, COST_GP_MAX);
    const weightLb = numberInRange(raw.bardingCustom.weightLb, 0, WEIGHT_MAX);
    if (costGp !== undefined && weightLb !== undefined) rec.bardingCustom = { costGp, weightLb };
  }
  if (raw.pullsVehicle === true) rec.pullsVehicle = true;
  assign(rec, 'vehicleWeightLb', numberInRange(raw.vehicleWeightLb, 0, WEIGHT_MAX));
  assign(rec, 'notes', nonEmptyString(raw.notes, NOTES_MAX));
  return rec;
}

export function sanitizeMounts(value: unknown): MountRecord[] | undefined {
  return sanitizeList(value, MOUNTS_MAX, sanitizeMount);
}

// ─── Custom stat block ───────────────────────────────────────────────────────

function sanitizeEntries(value: unknown): NamedStatEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: NamedStatEntry[] = [];
  for (const raw of value) {
    if (out.length >= ENTRIES_PER_LIST_MAX) break;
    if (!isPlainObject(raw)) continue;
    const name = nonEmptyString(raw.name, NAME_MAX);
    if (!name) continue;
    out.push({ name, description: cleanString(raw.description, ENTRY_DESCRIPTION_MAX) ?? '' });
  }
  return out.length > 0 ? out : undefined;
}

export function sanitizeCustomStatBlock(value: unknown): CustomStatBlock | undefined {
  if (!isPlainObject(value)) return undefined;
  const out: CustomStatBlock = {};
  assign(out, 'size', oneOf(value.size, SIZES));
  assign(out, 'creatureType', nonEmptyString(value.creatureType, STAT_TEXT_MAX));
  assign(out, 'alignment', nonEmptyString(value.alignment, STAT_TEXT_MAX));
  assign(out, 'ac', intInRange(value.ac, 0, 99));
  assign(out, 'initiativeMod', intInRange(value.initiativeMod, -20, 20));
  assign(out, 'hpMax', intInRange(value.hpMax, 0, HP_MAX));
  assign(out, 'speed', nonEmptyString(value.speed, STAT_TEXT_MAX));
  if (isPlainObject(value.abilities)) {
    const abilities: Partial<Record<Ability, number>> = {};
    for (const ability of ABILITIES) {
      const score = intInRange(value.abilities[ability], 1, 30);
      if (score !== undefined) abilities[ability] = score;
    }
    if (Object.keys(abilities).length > 0) out.abilities = abilities;
  }
  if (Array.isArray(value.saveProficiencies)) {
    const saves = ABILITIES.filter((a) => (value.saveProficiencies as unknown[]).includes(a));
    if (saves.length > 0) out.saveProficiencies = [...saves];
  }
  assign(out, 'proficiencyBonus', intInRange(value.proficiencyBonus, 2, 9));
  assign(out, 'skills', nonEmptyString(value.skills, STAT_TEXT_MAX));
  assign(out, 'senses', nonEmptyString(value.senses, STAT_TEXT_MAX));
  assign(out, 'languages', nonEmptyString(value.languages, STAT_TEXT_MAX));
  assign(out, 'resistances', nonEmptyString(value.resistances, STAT_TEXT_MAX));
  assign(out, 'immunities', nonEmptyString(value.immunities, STAT_TEXT_MAX));
  assign(out, 'vulnerabilities', nonEmptyString(value.vulnerabilities, STAT_TEXT_MAX));
  assign(out, 'cr', nonEmptyString(value.cr, CR_TEXT_MAX));
  assign(out, 'xp', intInRange(value.xp, 0, XP_MAX));
  assign(out, 'traits', sanitizeEntries(value.traits));
  assign(out, 'actions', sanitizeEntries(value.actions));
  assign(out, 'bonusActions', sanitizeEntries(value.bonusActions));
  assign(out, 'reactions', sanitizeEntries(value.reactions));
  return Object.keys(out).length > 0 ? out : undefined;
}

// ─── Hirelings and NPC party members ─────────────────────────────────────────

function sanitizeLoyaltyScore(value: unknown): number | undefined {
  return intInRange(value, LOYALTY_MIN, LOYALTY_MAX);
}

function sanitizeHireling(raw: Raw): HirelingRecord | undefined {
  const id = recordId(raw.id);
  const name = cleanString(raw.name, NAME_MAX);
  const kind = oneOf(raw.kind, Object.keys(HIRELING_RATES) as HirelingKind[]);
  if (!id || name === undefined || !kind) return undefined;
  const rec: HirelingRecord = { id, name, kind, units: intInRange(raw.units, 0, HIRELING_UNITS_MAX) ?? 0 };
  assign(rec, 'customRateCp', intInRange(raw.customRateCp, 1, RATE_CP_MAX));
  assign(rec, 'stats', sanitizeCustomStatBlock(raw.stats));
  assign(rec, 'loyalty', sanitizeLoyaltyScore(raw.loyalty));
  sanitizeTracked(raw, rec);
  return rec;
}

export function sanitizeHirelings(value: unknown): HirelingRecord[] | undefined {
  return sanitizeList(value, HIRELINGS_MAX, sanitizeHireling);
}

function sanitizeNpcMember(raw: Raw): NpcPartyMemberRecord | undefined {
  const id = recordId(raw.id);
  const name = cleanString(raw.name, NAME_MAX);
  if (!id || name === undefined) return undefined;
  const rec: NpcPartyMemberRecord = { id, name };
  assign(rec, 'role', nonEmptyString(raw.role, NAME_MAX));
  assign(rec, 'stats', sanitizeCustomStatBlock(raw.stats));
  assign(rec, 'loyalty', sanitizeLoyaltyScore(raw.loyalty));
  sanitizeTracked(raw, rec);
  return rec;
}

export function sanitizeNpcPartyMembers(value: unknown): NpcPartyMemberRecord[] | undefined {
  return sanitizeList(value, NPC_PARTY_MAX, sanitizeNpcMember);
}

// ─── Sidekicks ───────────────────────────────────────────────────────────────

function sanitizeLevelUps(value: unknown): SidekickLevelUp[] {
  if (!Array.isArray(value)) return [];
  const out: SidekickLevelUp[] = [];
  for (const raw of value) {
    if (out.length >= LEVEL_UPS_MAX) break;
    if (!isPlainObject(raw)) continue;
    const level = intInRange(raw.level, 2, 20);
    const roll = intInRange(raw.roll, 0, 100);
    const hpGained = intInRange(raw.hpGained, 0, 999);
    if (level === undefined || roll === undefined || hpGained === undefined) continue;
    out.push({ level, roll, hpGained });
  }
  return out;
}

function sanitizeSidekick(raw: Raw): SidekickRecord | undefined {
  const id = recordId(raw.id);
  const creatureId = typeof raw.creatureId === 'string' ? raw.creatureId : undefined;
  const classId = oneOf<SidekickClassId>(raw.classId, SIDEKICK_CLASS_IDS);
  const level = intInRange(raw.level, 1, 20);
  const baseHpMax = intInRange(raw.baseHpMax, 0, HP_MAX);
  if (!id || !creatureId || !classId || level === undefined || baseHpMax === undefined) return undefined;
  if (!Object.hasOwn(CREATURE_CATALOG, creatureId)) return undefined;
  const rec: SidekickRecord = { id, creatureId, classId, level, baseHpMax, levelUps: sanitizeLevelUps(raw.levelUps) };
  assign(rec, 'nickname', nonEmptyString(raw.nickname, NAME_MAX));
  assign(rec, 'martialRole', oneOf(raw.martialRole, MARTIAL_ROLES));
  assign(rec, 'spellcastingRole', oneOf(raw.spellcastingRole, SPELLCASTING_ROLES));
  if (isPlainObject(raw.deathSaves)) {
    const successes = intInRange(raw.deathSaves.successes, 0, 3);
    const failures = intInRange(raw.deathSaves.failures, 0, 3);
    if (successes !== undefined && failures !== undefined) rec.deathSaves = { successes, failures };
  }
  if (raw.stable === true) rec.stable = true;
  if (raw.dead === true) rec.dead = true;
  sanitizeTracked(raw, rec);
  return rec;
}

export function sanitizeSidekicks(value: unknown): SidekickRecord[] | undefined {
  return sanitizeList(value, SIDEKICKS_MAX, sanitizeSidekick);
}

// ─── Whole-character entry point ─────────────────────────────────────────────

/** Sanitize the party-wide Loyalty maximum override (an integer 0-20). */
export function sanitizeLoyaltyMaxOverride(value: unknown): number | undefined {
  return intInRange(value, LOYALTY_MIN, LOYALTY_MAX);
}

/**
 * Sanitize every Companions field of an UNTRUSTED character object IN PLACE:
 * valid fields are replaced by their cleaned copy, invalid or empty fields are
 * deleted. Returns the same object. Use after the generic import merge.
 */
export function sanitizeCompanionsState<T extends object>(character: T): T {
  const target = character as Raw;
  const apply = (key: string, value: unknown): void => {
    if (value === undefined) delete target[key];
    else target[key] = value;
  };
  apply('companions', sanitizeCompanions(target.companions));
  apply('mounts', sanitizeMounts(target.mounts));
  apply('hirelings', sanitizeHirelings(target.hirelings));
  apply('npcPartyMembers', sanitizeNpcPartyMembers(target.npcPartyMembers));
  apply('sidekicks', sanitizeSidekicks(target.sidekicks));
  apply('loyaltyMaxOverride', sanitizeLoyaltyMaxOverride(target.loyaltyMaxOverride));
  return character;
}
