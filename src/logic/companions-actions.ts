/**
 * Pure state transitions (Character -> Character) the Companions page needs.
 * The page calls these and passes the result to its single `onChange`. Nothing
 * here mutates; an unknown id or a refused add returns the SAME character so a
 * caller can detect "no change" by identity. Rules live in companions.ts; this
 * module is only list plumbing and the tracked-HP write-back.
 */

import type {
  Character,
  CompanionRecord,
  HirelingRecord,
  HouseRules,
  MountRecord,
  NpcPartyMemberRecord,
  SidekickRecord,
  TrackedCreature,
} from '../types/character';
import {
  applyTrackedDamage,
  applyTrackedHealing,
  canAddRecord,
  clampLoyalty,
  effectiveTrackedHp,
  giveTrackedTempHp,
  LOYALTY_MAX,
  LOYALTY_MIN,
  loyaltyMaximum,
  addTrackedCondition,
  removeTrackedCondition,
  storedHpFor,
} from './companions';
import type { TempHpChoice } from './hit-points-state';
import type { Breakdown } from './breakdown';
import { effectiveAbilityScores } from './feats';

/** The Character fields that hold record lists, and their record types. */
export interface CompanionListMap {
  companions: CompanionRecord;
  mounts: MountRecord;
  hirelings: HirelingRecord;
  npcPartyMembers: NpcPartyMemberRecord;
  sidekicks: SidekickRecord;
}

export type CompanionListKey = keyof CompanionListMap;

/** The list stored under `key` (empty when absent). */
export function recordsOf<K extends CompanionListKey>(character: Character, key: K): readonly CompanionListMap[K][] {
  return (character[key] ?? []) as unknown as readonly CompanionListMap[K][];
}

function withList<K extends CompanionListKey>(character: Character, key: K, list: CompanionListMap[K][]): Character {
  const next: Character = { ...character };
  if (list.length === 0) delete next[key];
  else (next as unknown as Record<string, unknown>)[key] = list;
  return next;
}

/** Append a record. Refused (same character) at the cap or when the id already exists. */
export function addRecord<K extends CompanionListKey>(character: Character, key: K, record: CompanionListMap[K]): Character {
  const list = recordsOf(character, key);
  if (!canAddRecord(key, list.length)) return character;
  if (list.some((r) => r.id === record.id)) return character;
  return withList(character, key, [...list, record]);
}

/** Merge `patch` into the record with `id`. `undefined` values in the patch delete the field. */
export function updateRecord<K extends CompanionListKey>(
  character: Character,
  key: K,
  id: string,
  patch: Partial<CompanionListMap[K]>,
): Character {
  const list = recordsOf(character, key);
  if (!list.some((r) => r.id === id)) return character;
  const next = list.map((r) => {
    if (r.id !== id) return r;
    const merged = { ...r, ...patch } as Record<string, unknown>;
    for (const field of Object.keys(merged)) if (merged[field] === undefined) delete merged[field];
    return merged as unknown as CompanionListMap[K];
  });
  return withList(character, key, next);
}

/** Remove the record with `id`; the field is deleted when the list becomes empty. */
export function removeRecord<K extends CompanionListKey>(character: Character, key: K, id: string): Character {
  const list = recordsOf(character, key);
  if (!list.some((r) => r.id === id)) return character;
  return withList(character, key, list.filter((r) => r.id !== id));
}

/** Put a removed record back at its old index (undo of a delete). Refused at the cap or duplicate id. */
export function restoreRecord<K extends CompanionListKey>(
  character: Character,
  key: K,
  record: CompanionListMap[K],
  index: number,
): Character {
  const list = recordsOf(character, key);
  if (!canAddRecord(key, list.length) || list.some((r) => r.id === record.id)) return character;
  const at = Math.max(0, Math.min(list.length, Math.trunc(index)));
  return withList(character, key, [...list.slice(0, at), record, ...list.slice(at)]);
}

// ─── Tracked HP and conditions (patch builders) ──────────────────────────────

/** The tracked fields of a record, for building a patch. */
type TrackedPatch = Pick<TrackedCreature, 'hp' | 'tempHp'>;

/** Current HP in force for a record against its maximum. */
export function trackedHpOf(rec: Pick<TrackedCreature, 'hp'>, max: number): number {
  return effectiveTrackedHp(rec.hp, max);
}

/** Patch for taking damage: temp HP first, floor 0, write-back rules of Character.currentHp. */
export function damagePatch(rec: Pick<TrackedCreature, 'hp' | 'tempHp'>, max: number, amount: number): TrackedPatch {
  const r = applyTrackedDamage({ max, hp: trackedHpOf(rec, max), temp: rec.tempHp ?? 0 }, amount);
  return { hp: storedHpFor(r.hp, max), tempHp: r.temp > 0 ? r.temp : undefined };
}

/** Patch for healing: capped at the maximum, temp HP untouched. */
export function healPatch(rec: Pick<TrackedCreature, 'hp' | 'tempHp'>, max: number, amount: number): TrackedPatch {
  const r = applyTrackedHealing({ max, hp: trackedHpOf(rec, max), temp: rec.tempHp ?? 0 }, amount);
  return { hp: storedHpFor(r.hp, max), tempHp: r.temp > 0 ? r.temp : undefined };
}

/** Patch for receiving Temporary Hit Points (never stack; default keeps the larger). */
export function tempHpPatch(rec: Pick<TrackedCreature, 'tempHp'>, offered: number, choice?: TempHpChoice): Pick<TrackedCreature, 'tempHp'> {
  const next = giveTrackedTempHp(rec.tempHp ?? 0, offered, choice);
  return { tempHp: next > 0 ? next : undefined };
}

/** Patch that restores the record to its maximum HP (temp HP is kept). */
export function fullHealPatch(): Pick<TrackedCreature, 'hp'> {
  return { hp: undefined };
}

/** Patch for receiving a condition (Exhaustion stacks to 6; others are idempotent). */
export function addConditionPatch(rec: TrackedCreature, id: string): Pick<TrackedCreature, 'conditions' | 'exhaustionLevel'> {
  const next = addTrackedCondition(rec, id);
  return { conditions: next.conditions, exhaustionLevel: next.exhaustionLevel };
}

/** Patch for dropping a condition (Exhaustion: all levels). */
export function removeConditionPatch(rec: TrackedCreature, id: string): Pick<TrackedCreature, 'conditions' | 'exhaustionLevel'> {
  const next = removeTrackedCondition(rec, id);
  return { conditions: next.conditions, exhaustionLevel: next.exhaustionLevel };
}

// ─── House rules and Loyalty ─────────────────────────────────────────────────

export type CompanionHouseRule = Extract<keyof HouseRules, 'sidekicks' | 'loyalty'>;

/** Whether Tasha's Sidekicks are switched on (opt-in, default off). */
export function sidekicksEnabled(character: Character): boolean {
  return character.houseRules?.sidekicks === true;
}

/** Whether the DMG Loyalty rule is switched on (opt-in, default off). */
export function loyaltyEnabled(character: Character): boolean {
  return character.houseRules?.loyalty === true;
}

/** Switch a companion house rule on or off. */
export function setCompanionHouseRule(character: Character, rule: CompanionHouseRule, on: boolean): Character {
  return { ...character, houseRules: { ...character.houseRules, [rule]: on } };
}

/** Set (or clear with `undefined`) the party-wide Loyalty maximum override, clamped to 0-20. */
export function setLoyaltyMaxOverride(character: Character, value: number | undefined): Character {
  const next: Character = { ...character };
  if (value === undefined || !Number.isFinite(value)) delete next.loyaltyMaxOverride;
  else next.loyaltyMaxOverride = clampLoyalty(Math.trunc(value), LOYALTY_MAX);
  return next;
}

/**
 * The party-wide Loyalty maximum with its breakdown (DMG L3578: the highest
 * Charisma score in the party; a single-character sheet uses this character's
 * score unless the user overrides it). Capped to the 0-20 scale (D8a); the cap
 * is shown as its own component so the components still sum to the total.
 */
export function loyaltyMaximumFor(character: Character): { max: number; breakdown: Breakdown } {
  const override = character.loyaltyMaxOverride;
  const hasOverride = override !== undefined && Number.isFinite(override);
  const base = hasOverride ? override : effectiveAbilityScores(character).cha;
  const max = loyaltyMaximum(base, hasOverride ? override : undefined);
  const components = [{ label: hasOverride ? 'Override you entered' : 'Highest Charisma in the party (this character)', value: base }];
  if (max !== base) components.push({ label: 'Capped to the 0-20 Loyalty scale', value: max - base });
  return { max, breakdown: { total: max, components } };
}

/** Re-exported bounds so the page does not import them from two modules. */
export { LOYALTY_MAX, LOYALTY_MIN };
