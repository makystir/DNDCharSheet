/**
 * Conditions logic (Stage A4).
 *
 * Ported IN STRUCTURE from PWACharSheet's src/logic/conditions.ts (a thin
 * pure seam over a conditions array: apply / remove / evaluate) and
 * src/logic/combat.ts applyCondition/removeCondition. The WFRP
 * Fatigued->Unconscious threshold evaluation has no D&D analogue and is
 * dropped. All functions are pure and never mutate their input.
 *
 * SCOPE: this module only records which conditions a character has and reports
 * DERIVED information (implied conditions, Exhaustion penalties). It does NOT
 * automatically add or remove other conditions, and it does NOT feed any
 * condition effect into skill / save / attack / speed / AC totals - that wiring
 * is a separate, flagged decision. Combat resolution, death saves,
 * concentration and rests are Stage A5.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md):
 *  - No stacking (L1214-1216): a condition is had or not had; re-applying an
 *    active condition is a no-op. Exhaustion is the exception: cumulative.
 *  - Exhaustion (L21018-21028): level 0..6, dies at 6, -2 x level on D20 Tests,
 *    -5 ft x level Speed, a Long Rest removes 1 level.
 *  - "Some conditions apply other conditions" (L1208): reported via `implies`.
 */
import type { ActiveCondition, Character } from '../types/character';
import {
  CONDITIONS,
  EXHAUSTION,
  getCondition,
  isConditionId,
  type ConditionId,
} from '../data/conditions';
import type { Breakdown } from './breakdown';

/** A condition id that is stored in `Character.conditions` (everything but Exhaustion). */
export type TrackedConditionId = ActiveCondition['id'];

/** Narrow an id to a non-Exhaustion (stored-array) condition id. */
export function isTrackedConditionId(id: string): id is TrackedConditionId {
  return isConditionId(id) && id !== 'exhaustion';
}

// ── Exhaustion ─────────────────────────────────────────────────────────────

/** Clamp to an integer in 0..6 (PHB L21022). Non-finite input yields 0. */
export function clampExhaustionLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.min(EXHAUSTION.maxLevel, Math.max(0, Math.trunc(level)));
}

/** The character's Exhaustion level (0 when absent). */
export function exhaustionLevelOf(character: Pick<Character, 'exhaustionLevel'>): number {
  return clampExhaustionLevel(character.exhaustionLevel ?? 0);
}

/** Level after a Long Rest: removes 1 level, floor 0 (PHB L21028). Used by rests (A5). */
export function exhaustionAfterLongRest(level: number): number {
  return clampExhaustionLevel(clampExhaustionLevel(level) - EXHAUSTION.longRestReduction);
}

/** Informational Exhaustion penalties for a level (not wired into totals). */
export interface ExhaustionEffects {
  level: number;
  /** Change to D20 Test rolls: total is -2 x level (<= 0). */
  d20Test: Breakdown;
  /** Change to Speed in feet: total is -5 x level (<= 0). */
  speed: Breakdown;
  /** True when the level is fatal (6). */
  fatal: boolean;
}

/**
 * PHB 2024 "Exhaustion" (L21024-21026): D20 Tests are reduced by 2 x level;
 * Speed is reduced by 5 ft x level. Pure so it CAN be wired into totals later;
 * today it is displayed informationally only.
 */
export function exhaustionEffects(rawLevel: number): ExhaustionEffects {
  const level = clampExhaustionLevel(rawLevel);
  // `0 -` (not unary minus) avoids producing -0 at level 0.
  const d20 = 0 - level * EXHAUSTION.d20PenaltyPerLevel;
  const speed = 0 - level * EXHAUSTION.speedPenaltyPerLevel;
  // One addend per Exhaustion level so each factor is visible and the
  // components sum to the total (Breakdown invariant).
  const perLevel = (penalty: number, unit: string) =>
    level === 0
      ? [{ label: 'No Exhaustion', value: 0 }]
      : Array.from({ length: level }, (_, i) => ({
          label: `Exhaustion level ${i + 1}${unit}`,
          value: 0 - penalty,
        }));
  return {
    level,
    d20Test: {
      total: d20,
      components: perLevel(EXHAUSTION.d20PenaltyPerLevel, ''),
    },
    speed: {
      total: speed,
      components: perLevel(EXHAUSTION.speedPenaltyPerLevel, ' (ft)'),
    },
    fatal: level >= EXHAUSTION.deathLevel,
  };
}

// ── Array-level seam (apply / remove / has) ────────────────────────────────

/**
 * Apply a condition to a conditions array. Idempotent (no stacking, PHB
 * L1214): if already present the array is returned unchanged unless a
 * note/ends is supplied, which updates the existing entry. Never adds any
 * other condition.
 */
export function applyCondition(
  conditions: ActiveCondition[] | null | undefined,
  id: TrackedConditionId,
  details?: { note?: string; ends?: string },
): ActiveCondition[] {
  const list = conditions ?? [];
  const existing = list.find((c) => c.id === id);
  if (!existing) return [...list, { id, ...cleanDetails(details) }];
  if (!details || (details.note === undefined && details.ends === undefined)) return list;
  return list.map((c) => (c.id === id ? { ...c, ...cleanDetails(details) } : c));
}

/** Remove a condition by id. Removing an absent condition is a no-op. */
export function removeCondition(
  conditions: ActiveCondition[] | null | undefined,
  id: TrackedConditionId,
): ActiveCondition[] {
  return (conditions ?? []).filter((c) => c.id !== id);
}

/** Set (or clear with '') the free-text `ends` / `note` on an active condition. */
export function setConditionDetails(
  conditions: ActiveCondition[] | null | undefined,
  id: TrackedConditionId,
  details: { note?: string; ends?: string },
): ActiveCondition[] {
  return (conditions ?? []).map((c) => {
    if (c.id !== id) return c;
    const next: ActiveCondition = { ...c };
    if (details.note !== undefined) {
      if (details.note === '') delete next.note;
      else next.note = details.note;
    }
    if (details.ends !== undefined) {
      if (details.ends === '') delete next.ends;
      else next.ends = details.ends;
    }
    return next;
  });
}

function cleanDetails(details?: { note?: string; ends?: string }): { note?: string; ends?: string } {
  const out: { note?: string; ends?: string } = {};
  if (details?.note) out.note = details.note;
  if (details?.ends) out.ends = details.ends;
  return out;
}

// ── Character-level seam ───────────────────────────────────────────────────

/** True when the character currently has the condition (Exhaustion: level > 0). Direct only. */
export function hasCondition(character: Character, id: ConditionId): boolean {
  if (id === 'exhaustion') return exhaustionLevelOf(character) > 0;
  return (character.conditions ?? []).some((c) => c.id === id);
}

/**
 * Receive a condition. Exhaustion is cumulative: each application adds 1 level
 * up to 6 (PHB L21022). Every other condition is idempotent. No other
 * condition is ever added as a side effect.
 */
export function addCondition(
  character: Character,
  id: ConditionId,
  details?: { note?: string; ends?: string },
): Character {
  if (id === 'exhaustion') {
    return setExhaustion(character, exhaustionLevelOf(character) + 1);
  }
  return { ...character, conditions: applyCondition(character.conditions, id, details) };
}

/** Drop a condition entirely (Exhaustion: clears all levels). */
export function dropCondition(character: Character, id: ConditionId): Character {
  if (id === 'exhaustion') return setExhaustion(character, 0);
  const remaining = removeCondition(character.conditions, id);
  if (remaining.length === 0) {
    // Delete the field when empty, consistent with setExhaustion(0).
    const { conditions: _removed, ...rest } = character;
    void _removed;
    return rest;
  }
  return { ...character, conditions: remaining };
}

/** Set Exhaustion to a clamped level; 0 removes the field (absent = none). */
export function setExhaustion(character: Character, level: number): Character {
  const clamped = clampExhaustionLevel(level);
  if (clamped === 0) {
    const { exhaustionLevel: _removed, ...rest } = character;
    void _removed;
    return rest;
  }
  return { ...character, exhaustionLevel: clamped };
}

/** Ids of all active conditions in PHB list order, including Exhaustion when level > 0. */
export function activeConditionIds(character: Character): ConditionId[] {
  return CONDITIONS.filter((c) => hasCondition(character, c.id)).map((c) => c.id);
}

/**
 * DERIVED / READ-ONLY: conditions that an active condition applies, with the
 * condition(s) that imply each (e.g. Paralyzed -> Incapacitated). Never
 * mutates the character and never auto-adds anything. PHB L1208 and the
 * individual entries (Paralyzed L21348, Petrified L21376, Stunned L21615,
 * Unconscious L21701).
 */
export interface ImpliedCondition {
  id: ConditionId;
  impliedBy: ConditionId[];
}

export function impliedConditions(character: Character): ImpliedCondition[] {
  const map = new Map<ConditionId, ConditionId[]>();
  for (const id of activeConditionIds(character)) {
    for (const implied of getCondition(id)?.implies ?? []) {
      map.set(implied, [...(map.get(implied) ?? []), id]);
    }
  }
  return [...map.entries()].map(([id, impliedBy]) => ({ id, impliedBy }));
}
