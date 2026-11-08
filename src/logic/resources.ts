/**
 * Per-use resource tracking (D1, D&D 5.5e / 2024): class, subclass, feat and
 * Eldritch Invocation features that have a limited number of uses.
 *
 * Pure functions, no Date / Math.random, never mutate their input. The tracker
 * list is DERIVED from data (`ClassFeature.uses`, `FeatData.uses`,
 * `InvocationData.uses`); only the SPENT count is stored
 * (`Character.resourcesSpent`, same convention as `hitDiceSpent`). The maximum
 * is always recomputed from level, ability scores and the PHB tables.
 *
 * TRACKER IDS: `<classId>.<pool>` for class AND subclass features (the class id
 * keeps two classes' same-name pools apart), `feat:<featId>[@n].<pool>` for
 * feats (`@n` = the n-th repeat of a repeatable feat, n >= 1), and
 * `warlock.invocation-<id>` for invocations. Variants (N independent single
 * uses, e.g. Phantasmal Creatures) append `#<index>`.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md, 1-based lines):
 *  - Proficiency Bonus uses TOTAL character level (L2092); every class pool
 *    scales with the level of the class that grants it.
 *  - Recovery (see each feature's PHB lines in data): a Short Rest regains ALL
 *    uses ('short-or-long-rest'), ONE expended use ('short-one-long-all': Rage
 *    L2428, Channel Divinity L3240-3242, Wild Shape L3678, Second Wind L4120,
 *    Psionic Energy Dice L4437); a Long Rest regains all. 'dawn' and 'other'
 *    never recover automatically.
 *
 * INTERPRETATIONS / FLAGS (plan.md section 6):
 *  - MULTICLASS (flag 1): the PHB multiclass text (L2104-2106) covers only
 *    Extra Attack, Spellcasting and alternative AC, nothing on resource pools.
 *    The class texts scope same-name pools to their own class ("this class's
 *    Channel Divinity" L3238-3242, L4920-4924; "only the dice from this
 *    subclass" L4435, L6125). So a Cleric 6 / Paladin 3 has TWO Channel Divinity
 *    trackers (3 and 2), never merged or summed, each scaled by its own class.
 *  - 'short-rest' (all on a Short Rest only) is not used by any PHB feature; a
 *    Long Rest does NOT recover it here (the PHB gives a Long Rest no Short
 *    Rest effect). Unpinned by the golden; nothing in the catalog uses it.
 *  - Invalid spend / regain amounts (negative, NaN, fractional, Infinity) are
 *    treated as a no-op after truncating fractions toward zero: the invariant is
 *    that `remaining` is an integer in 0..max.
 *  - Boon of Fate / Bardic Inspiration extra restore triggers (Initiative, a
 *    spell slot) are text only (`alsoRestoredBy`); use the manual controls.
 */

import type { AbilityScores, Character } from '../types/character';
import { ABILITY_NAMES } from '../types/character';
import type { FeatureRecharge, OwnUses, UsesCount, LevelTable, ClassFeature } from '../data/classes';
import { featOwnUses, getFeat } from '../data/feats';
import { getInvocation } from '../data/invocations';
import type { Breakdown, BreakdownComponent } from './breakdown';
import { abilityModifier, proficiencyBonus } from './abilities';
import { entrySubclass, resolveClasses } from './classes';
import { parseInvocationEntry } from './class-choices';
import { characterFeats, effectiveAbilityScores } from './feats';

// ─── Public types ────────────────────────────────────────────────────────────

/** Which rest finished (structurally the same as rests.ts `RestKind`; declared here so this module never imports rests.ts). */
export type ResourceRestKind = 'short' | 'long';

export interface TrackerDef {
  /** Tracker id, see the module header. */
  id: string;
  /** Class id for class / subclass features, `feat:<id>[@n]` for feats, 'invocation' for invocations. */
  ownerKey: string;
  /** 'Barbarian', 'Lucky', 'Warlock' ... */
  ownerName: string;
  /** Display name: the highest-level feature of the pool (variants append `: <variant>`). */
  name: string;
  /** Names of all reached features sharing the pool (for content tooltips). */
  featureNames: string[];
  sourceKind: 'class' | 'subclass' | 'feat' | 'invocation';
  subclassName?: string;
  /** Owner class level at which the tracker appears (0 for feats and invocations). */
  sourceLevel: number;
  /** The effective merged definition (highest-level feature wins per field). */
  uses: OwnUses;
  /** Reached features that spend a use of this pool (`{ spends }`), for display only. */
  spendsFeatures: Array<{ name: string; level: number }>;
  /** Owner class level used to resolve the max (total level for feats). */
  ownerLevel: number;
}

export interface ResourceState extends TrackerDef {
  max: number;
  /** Components sum to `max` (calculated-totals rule). */
  maxBreakdown: Breakdown;
  /** Spent, clamped into 0..max. */
  spent: number;
  remaining: number;
  recharge: FeatureRecharge;
  /** Resolved die size at the owner level, for dice pools. */
  dieSize?: number;
}

export interface ResourceRecovery {
  id: string;
  name: string;
  /** REMAINING uses before the rest. */
  before: number;
  /** REMAINING uses after the rest. */
  after: number;
  max: number;
  rule: 'all' | 'one';
}

export interface UsesCountContext {
  /** Level of the class that grants the feature (total level for feats / invocations). */
  ownerLevel: number;
  /** Total character level (Proficiency Bonus). */
  totalLevel: number;
  abilityScores: AbilityScores;
  /** Labels for the breakdown. */
  name: string;
  ownerName: string;
}

// ─── Max resolution ──────────────────────────────────────────────────────────

/** Value of the last row whose level <= `level`, 0 before the first row. */
function tableValue(table: LevelTable, level: number): number {
  let value = 0;
  for (const [rowLevel, rowValue] of table) {
    if (rowLevel <= level) value = rowValue;
  }
  return value;
}

/** Resolve a `UsesCount` to a whole number >= 0 with a breakdown whose components sum to it. */
export function resolveUsesCount(count: UsesCount, ctx: UsesCountContext): { value: number; breakdown: Breakdown } {
  const finish = (components: BreakdownComponent[]): { value: number; breakdown: Breakdown } => {
    const total = components.reduce((sum, c) => sum + c.value, 0);
    return { value: total, breakdown: { total, components } };
  };
  if (typeof count === 'number') {
    return finish([{ label: `${ctx.name} (PHB)`, value: count }]);
  }
  switch (count.by) {
    case 'class-level':
      return finish([
        { label: `${ctx.name} at ${ctx.ownerName} level ${ctx.ownerLevel} (PHB table)`, value: tableValue(count.table, ctx.ownerLevel) },
      ]);
    case 'class-level-multiple': {
      const components: BreakdownComponent[] = [
        { label: `${ctx.ownerName} level ${ctx.ownerLevel} x ${count.factor}`, value: ctx.ownerLevel * count.factor },
      ];
      if (count.offset !== undefined) components.push({ label: 'Base', value: count.offset });
      return finish(components);
    }
    case 'ability-mod': {
      const mod = abilityModifier(ctx.abilityScores[count.ability]);
      return finish([
        { label: `${ABILITY_NAMES[count.ability]} modifier`, value: mod },
        { label: `Minimum of ${count.min}`, value: Math.max(0, count.min - mod) },
      ]);
    }
    case 'proficiency-bonus':
      return finish([{ label: `Proficiency Bonus (character level ${ctx.totalLevel})`, value: proficiencyBonus(ctx.totalLevel) }]);
  }
}

function resolveDieSize(dieSize: OwnUses['dieSize'], ownerLevel: number): number | undefined {
  if (dieSize === undefined) return undefined;
  if (typeof dieSize === 'number') return dieSize;
  const value = tableValue(dieSize, ownerLevel);
  return value > 0 ? value : undefined;
}

// ─── Tracker derivation ──────────────────────────────────────────────────────

/** Same pool-id slug the catalog uses: lower case, apostrophes dropped, other runs -> '-'. */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface ReachedFeature {
  feature: ClassFeature;
  subclassName?: string;
}

/** Merge the definitions of the features of one pool: the highest level wins per field. */
function mergePool(group: ReachedFeature[]): OwnUses {
  const ordered = [...group].sort((a, b) => a.feature.level - b.feature.level);
  let merged: OwnUses | undefined;
  for (const { feature } of ordered) {
    const u = feature.uses as OwnUses;
    merged = {
      ...(merged ?? u),
      count: u.count,
      recharge: u.recharge,
      ...(u.unit !== undefined ? { unit: u.unit } : {}),
      ...(u.dieSize !== undefined ? { dieSize: u.dieSize } : {}),
      ...(u.alsoRestoredBy !== undefined ? { alsoRestoredBy: u.alsoRestoredBy } : {}),
      ...(u.variants !== undefined ? { variants: u.variants } : {}),
    };
  }
  return merged as OwnUses;
}

/** Expand one definition (plus variants) into tracker definitions. */
function expand(base: Omit<TrackerDef, 'id' | 'name'> & { baseId: string; baseName: string }): TrackerDef[] {
  const { baseId, baseName, ...rest } = base;
  const variants = rest.uses.variants;
  if (variants && variants.length > 0) {
    return variants.map((variant, i) => ({ ...rest, id: `${baseId}#${i}`, name: `${baseName}: ${variant}` }));
  }
  return [{ ...rest, id: baseId, name: baseName }];
}

/**
 * Every limited-use tracker the character currently has, in a stable order:
 * class order (class features, then that class's subclass), then feats, then
 * invocations. A `{ spends }` feature never creates a tracker.
 */
export function resourceTrackers(character: Character): TrackerDef[] {
  const result: TrackerDef[] = [];

  for (const { entry, data } of resolveClasses(character)) {
    const subclass = entrySubclass(entry);
    const reached: ReachedFeature[] = [
      ...data.features.filter((f) => f.level <= entry.level).map((feature) => ({ feature })),
      ...(subclass?.features ?? []).filter((f) => f.level <= entry.level).map((feature) => ({ feature, subclassName: subclass?.name })),
    ];
    const pools = new Map<string, ReachedFeature[]>();
    for (const item of reached) {
      const u = item.feature.uses;
      if (!u || 'spends' in u) continue;
      const pool = u.pool ?? slug(item.feature.name);
      const group = pools.get(pool);
      if (group) group.push(item);
      else pools.set(pool, [item]);
    }
    for (const [pool, group] of pools) {
      const byLevel = [...group].sort((a, b) => a.feature.level - b.feature.level);
      const first = byLevel[0];
      const last = byLevel[byLevel.length - 1];
      const spendsFeatures = reached
        .filter((r) => r.feature.uses && 'spends' in r.feature.uses && r.feature.uses.spends === pool)
        .map((r) => ({ name: r.feature.name, level: r.feature.level }));
      result.push(
        ...expand({
          baseId: `${data.id}.${pool}`,
          baseName: last.feature.name,
          ownerKey: data.id,
          ownerName: data.name,
          featureNames: byLevel.map((g) => g.feature.name),
          sourceKind: first.subclassName ? 'subclass' : 'class',
          ...(first.subclassName ? { subclassName: first.subclassName } : {}),
          sourceLevel: first.feature.level,
          uses: mergePool(group),
          spendsFeatures,
          ownerLevel: entry.level,
        }),
      );
    }
  }

  // Feats: every selection (incl. background / Fighting Style feats), in the order taken.
  const seen = new Map<string, number>();
  for (const selection of characterFeats(character)) {
    const feat = getFeat(selection.featId);
    const n = seen.get(selection.featId) ?? 0;
    seen.set(selection.featId, n + 1);
    if (!feat) continue;
    const ownerKey = n === 0 ? `feat:${feat.id}` : `feat:${feat.id}@${n}`;
    for (const u of featOwnUses(feat)) {
      const pool = u.pool ?? slug(feat.name);
      result.push(
        ...expand({
          baseId: `${ownerKey}.${pool}`,
          baseName: featOwnUses(feat).length > 1 ? `${feat.name}: ${poolTitle(pool)}` : feat.name,
          ownerKey,
          ownerName: feat.name,
          featureNames: [feat.name],
          sourceKind: 'feat',
          sourceLevel: 0,
          uses: u,
          spendsFeatures: [],
          ownerLevel: character.level,
        }),
      );
    }
  }

  // Eldritch Invocations: only a Warlock has them (the choice list may outlive the class).
  const warlock = resolveClasses(character).find(({ data }) => data.id === 'warlock');
  if (warlock) {
    const picked = new Set<string>();
    for (const raw of character.classChoices?.['warlock.invocations'] ?? []) {
      const { id } = parseInvocationEntry(raw);
      if (picked.has(id)) continue;
      picked.add(id);
      const invocation = getInvocation(id);
      if (!invocation?.uses) continue;
      result.push(
        ...expand({
          baseId: `warlock.invocation-${id}`,
          baseName: invocation.name,
          ownerKey: 'invocation',
          ownerName: 'Warlock',
          featureNames: [invocation.name],
          sourceKind: 'invocation',
          sourceLevel: 0,
          uses: invocation.uses,
          spendsFeatures: [],
          ownerLevel: warlock.entry.level,
        }),
      );
    }
  }
  return result;
}

/** 'recover-vitality' -> 'Recover Vitality' (feat pools with more than one tracker). */
function poolTitle(pool: string): string {
  return pool
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── State ───────────────────────────────────────────────────────────────────

function storedSpent(character: Character, id: string): number {
  const value = character.resourcesSpent?.[id];
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** Trackers with their resolved maximum, spent (clamped into 0..max) and remaining. */
export function characterResources(character: Character): ResourceState[] {
  const scores = effectiveAbilityScores(character);
  return resourceTrackers(character).map((tracker) => {
    const { value, breakdown } = resolveUsesCount(tracker.uses.count, {
      ownerLevel: tracker.ownerLevel,
      totalLevel: character.level,
      abilityScores: scores,
      name: tracker.name,
      ownerName: tracker.ownerName,
    });
    const max = Math.max(0, value);
    const spent = Math.min(storedSpent(character, tracker.id), max);
    const dieSize = resolveDieSize(tracker.uses.dieSize, tracker.ownerLevel);
    return {
      ...tracker,
      max,
      maxBreakdown: breakdown,
      spent,
      remaining: max - spent,
      recharge: tracker.uses.recharge,
      ...(dieSize !== undefined ? { dieSize } : {}),
    };
  });
}

// ─── Spend / regain / set ────────────────────────────────────────────────────

/** Write a spent map: zero entries dropped, the field removed when empty. */
function withSpent(character: Character, spent: Record<string, number>): Character {
  const cleaned: Record<string, number> = {};
  for (const [id, value] of Object.entries(spent)) {
    if (value > 0) cleaned[id] = value;
  }
  const next: Character = { ...character };
  if (Object.keys(cleaned).length === 0) delete next.resourcesSpent;
  else next.resourcesSpent = cleaned;
  return next;
}

function wholeAmount(amount: number): number {
  return Number.isFinite(amount) ? Math.trunc(amount) : 0;
}

function findState(character: Character, id: string): ResourceState | undefined {
  return characterResources(character).find((s) => s.id === id);
}

/** Spend `amount` (default 1) uses. Unknown id, nothing remaining or an invalid amount returns the same object. */
export function spendResource(character: Character, id: string, amount = 1): Character {
  const state = findState(character, id);
  const n = Math.min(wholeAmount(amount), state?.remaining ?? 0);
  if (!state || n <= 0) return character;
  return withSpent(character, { ...character.resourcesSpent, [id]: state.spent + n });
}

/** Regain `amount` (default 1) uses, never above the maximum. Unknown id, nothing spent or an invalid amount returns the same object. */
export function regainResource(character: Character, id: string, amount = 1): Character {
  const state = findState(character, id);
  const n = Math.min(wholeAmount(amount), state?.spent ?? 0);
  if (!state || n <= 0) return character;
  return withSpent(character, { ...character.resourcesSpent, [id]: state.spent - n });
}

/** Manual adjust: set the REMAINING uses (truncated, clamped into 0..max). */
export function setResourceRemaining(character: Character, id: string, remaining: number): Character {
  const state = findState(character, id);
  if (!state || Number.isNaN(remaining)) return character;
  const target = Math.max(0, Math.min(state.max, Number.isFinite(remaining) ? Math.trunc(remaining) : remaining > 0 ? state.max : 0));
  if (target === state.remaining) return character;
  return withSpent(character, { ...character.resourcesSpent, [id]: state.max - target });
}

/**
 * Rewrite stored spent so it never exceeds the current maximum (used after any
 * level change). Only the ids of CURRENT trackers are touched; ids of features the
 * character no longer has are left alone (re-picking the class restores them).
 * Returns the same object when nothing changes.
 */
export function clampResourcesSpent(character: Character): Character {
  const stored = character.resourcesSpent;
  if (!stored) return character;
  const next: Record<string, number> = { ...stored };
  let changed = false;
  for (const state of characterResources(character)) {
    if (!(state.id in stored)) continue;
    if (state.spent === 0) {
      delete next[state.id];
      changed = true;
    } else if (state.spent !== stored[state.id]) {
      next[state.id] = state.spent;
      changed = true;
    }
  }
  return changed ? withSpent(character, next) : character;
}

// ─── Rests ───────────────────────────────────────────────────────────────────

/** How a finished rest recovers a recharge kind: all, one, or nothing. */
function recoveryRule(recharge: FeatureRecharge, kind: ResourceRestKind): 'all' | 'one' | undefined {
  if (kind === 'short') {
    if (recharge === 'short-rest' || recharge === 'short-or-long-rest') return 'all';
    if (recharge === 'short-one-long-all') return 'one';
    return undefined;
  }
  if (recharge === 'long-rest' || recharge === 'short-or-long-rest' || recharge === 'short-one-long-all') return 'all';
  return undefined;
}

/**
 * Recharge limited-use features for a COMPLETED rest (callers do not call this
 * for rejected or interrupted rests). Returns the new character and what was
 * recovered (only trackers that had something spent). 'dawn' and 'other' never
 * recover automatically.
 */
export function rechargeResources(
  character: Character,
  kind: ResourceRestKind,
): { character: Character; recovered: ResourceRecovery[] } {
  const recovered: ResourceRecovery[] = [];
  const spent: Record<string, number> = { ...character.resourcesSpent };
  for (const state of characterResources(character)) {
    if (state.spent === 0) continue;
    const rule = recoveryRule(state.recharge, kind);
    if (!rule) continue;
    const newSpent = rule === 'all' ? 0 : state.spent - 1;
    spent[state.id] = newSpent;
    recovered.push({ id: state.id, name: state.name, before: state.remaining, after: state.max - newSpent, max: state.max, rule });
  }
  if (recovered.length === 0) return { character, recovered };
  return { character: withSpent(character, spent), recovered };
}

/** Player-facing recharge text (PHB recovery rules, see the module header). */
export function rechargeLabel(recharge: FeatureRecharge): string {
  switch (recharge) {
    case 'short-rest':
      return 'Short Rest';
    case 'long-rest':
      return 'Long Rest';
    case 'short-or-long-rest':
      return 'Short or Long Rest';
    case 'short-one-long-all':
      return 'Short Rest: regain 1. Long Rest: regain all';
    case 'dawn':
      return 'Dawn (manual)';
    case 'other':
      return 'Manual';
  }
}

/** 'Rage'/'Rages', 'Hit Point'/'Hit Points', default 'use'/'uses'. */
export function usesUnitLabel(state: Pick<ResourceState, 'uses'>, n: number): string {
  const [one, many] = state.uses.unit ?? ['use', 'uses'];
  return n === 1 ? one : many;
}
// ─── Sanitiser (import / share) ──────────────────────────────────────────────

const MAX_ENTRIES = 200;
const MAX_KEY_LENGTH = 80;
const MAX_VALUE = 9999;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Sanitise an untrusted `resourcesSpent`: a plain object only, keys 1..80
 * characters (never `__proto__`), values finite integers 0..9999, at most 200
 * entries (the first 200 valid ones in key order), zero entries dropped,
 * `undefined` when nothing is left.
 */
export function sanitizeResourcesSpent(value: unknown): Record<string, number> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries: Array<[string, number]> = [];
  for (const key of Object.keys(value)) {
    if (entries.length >= MAX_ENTRIES) break;
    if (key.length < 1 || key.length > MAX_KEY_LENGTH || FORBIDDEN_KEYS.has(key)) continue;
    const v = (value as Record<string, unknown>)[key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0 || v > MAX_VALUE) continue;
    entries.push([key, v]);
  }
  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}
