/**
 * Spending and recovering spell slots from the Combat page (the same storage the
 * Spells page uses: `spellcasting.slotsExpended[level]` for the Spellcasting pool,
 * `spellcasting.pactSlotsExpended` for Pact Magic). Counts are clamped to the
 * pool's maximum, which comes from logic/spellcasting.ts (the combined pool for a
 * multiclass caster, PHB 2024 "Multiclassing: Spellcasting").
 */

import type { Character } from '../types/character';
import { effectiveSpellSlots, pactMagicSlotsForClass } from './spellcasting';

export interface SlotLevelState {
  level: number;
  max: number;
  expended: number;
}

/** Spell slots by level (levels with no slots left out). */
export function slotLevels(character: Character): SlotLevelState[] {
  const slots = effectiveSpellSlots(character);
  if (!slots) return [];
  const out: SlotLevelState[] = [];
  for (let level = 1; level < slots.length; level += 1) {
    const max = slots[level] ?? 0;
    if (max <= 0) continue;
    const expended = Math.min(max, Math.max(0, character.spellcasting?.slotsExpended?.[level] ?? 0));
    out.push({ level, max, expended });
  }
  return out;
}

export interface PactSlotState {
  slotLevel: number;
  max: number;
  expended: number;
}

export function pactSlots(character: Character): PactSlotState | undefined {
  const pact = pactMagicSlotsForClass(character);
  if (!pact || pact.slots <= 0) return undefined;
  const expended = Math.min(pact.slots, Math.max(0, character.spellcasting?.pactSlotsExpended ?? 0));
  return { slotLevel: pact.slotLevel, max: pact.slots, expended };
}

/** Set how many slots of a level are expended (clamped to 0..max). */
export function setSlotsExpended(character: Character, level: number, expended: number): Character {
  const max = effectiveSpellSlots(character)?.[level] ?? 0;
  const clamped = Math.max(0, Math.min(max, Math.trunc(expended)));
  const sc = character.spellcasting ?? {};
  return { ...character, spellcasting: { ...sc, slotsExpended: { ...sc.slotsExpended, [level]: clamped } } };
}

/** Set how many Pact Magic slots are expended (clamped to 0..max). */
export function setPactExpended(character: Character, expended: number): Character {
  const max = pactMagicSlotsForClass(character)?.slots ?? 0;
  const clamped = Math.max(0, Math.min(max, Math.trunc(expended)));
  return { ...character, spellcasting: { ...(character.spellcasting ?? {}), pactSlotsExpended: clamped } };
}

export type CastPlan =
  | { kind: 'cantrip' }
  | { kind: 'slot'; source: 'spellcasting' | 'pact'; level: number }
  | { kind: 'none'; reason: string };

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/**
 * Which slot a Combat "Cast" spends for a spell of `spellLevel`.
 * PHB 2024 "Spell Slots" (Docs/PlayersHandbook.md L10709): "you expend a slot of
 * that spell's level or higher"; "Casting Without Slots" (L10717): a cantrip is
 * cast without a spell slot. So the spell's own level comes first and a higher
 * slot is used only when every lower valid one is spent. Pact Magic slots may
 * cast prepared spells (L2169); when a Spellcasting slot and the Pact slot are
 * the same level, the Spellcasting slot is used first (the PHB does not rank them).
 */
export function planCast(character: Character, spellLevel: number): CastPlan {
  if (spellLevel <= 0) return { kind: 'cantrip' };
  const candidates: { source: 'spellcasting' | 'pact'; level: number }[] = [];
  for (const s of slotLevels(character)) {
    if (s.level >= spellLevel && s.max - s.expended > 0) candidates.push({ source: 'spellcasting', level: s.level });
  }
  const pact = pactSlots(character);
  if (pact && pact.slotLevel >= spellLevel && pact.max - pact.expended > 0) {
    candidates.push({ source: 'pact', level: pact.slotLevel });
  }
  if (candidates.length === 0) {
    return { kind: 'none', reason: `No ${ordinal(spellLevel)}-level+ slots remaining` };
  }
  // Array.sort is stable, so a Spellcasting slot stays ahead of a same-level Pact slot.
  candidates.sort((a, b) => a.level - b.level);
  return { kind: 'slot', ...candidates[0]! };
}

/** Apply a plan with the same setters the slot pips use (one more slot expended). */
export function spendForCast(character: Character, plan: CastPlan): Character {
  if (plan.kind !== 'slot') return character;
  if (plan.source === 'pact') return setPactExpended(character, (pactSlots(character)?.expended ?? 0) + 1);
  const current = slotLevels(character).find((s) => s.level === plan.level)?.expended ?? 0;
  return setSlotsExpended(character, plan.level, current + 1);
}
