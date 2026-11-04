/**
 * Dose tracking for consumable inventory items.
 *
 * Ported VERBATIM IN STRUCTURE from PWACharSheet's src/logic/consumables.ts
 * (incrementDose / decrementDose), retargeted from the WFRP `Consumable` type
 * onto the D&D `InventoryItem`'s optional `currentDoses` / `maxDoses` fields.
 *
 * The only behavioural adaptation is that D&D's dose fields are OPTIONAL on
 * InventoryItem (not every item is dose-tracked), so an absent `currentDoses`
 * is treated as 0 and an absent `maxDoses` as 0 — keeping the same cap-at-max /
 * floor-at-0 semantics as the source. These functions are pure (return a new
 * item; never mutate the input), matching the source.
 */

import type { InventoryItem } from '../types/character';

/**
 * Decrement dose count, flooring at 0. Returns a new item (pure).
 */
export function decrementDose(item: InventoryItem): InventoryItem {
  const current = item.currentDoses ?? 0;
  return {
    ...item,
    currentDoses: Math.max(0, current - 1),
  };
}

/**
 * Increment dose count, capping at maxDoses. Returns a new item (pure).
 */
export function incrementDose(item: InventoryItem): InventoryItem {
  const current = item.currentDoses ?? 0;
  const max = item.maxDoses ?? 0;
  return {
    ...item,
    currentDoses: Math.min(max, current + 1),
  };
}
