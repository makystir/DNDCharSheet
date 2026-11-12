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
