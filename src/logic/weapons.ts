/**
 * Weapon lookup + resolution helpers.
 *
 * Ported in structure from PWACharSheet's src/logic/weapons.ts: the
 * `hasWeaponQuality` comma-split lookup becomes `hasWeaponProperty`, an array
 * `.includes` over the 2024 property list. The WFRP SB-based `calcWeaponDamage`
 * is NOT ported: weapon ATTACK/DAMAGE MATH is deferred to the Combat stage (A5)
 * per the blueprint. This module ships ONLY lookup + resolution.
 *
 * Cite: PHB 2024 "Weapons"/"Properties" (Docs/PlayersHandbook.md L9280-9432).
 */

import type { InventoryItem } from '../types/character';
import type { WeaponData, WeaponProperty } from '../data/weapons';
import { getWeapon } from '../data/weapons';

/**
 * A weapon resolved for a specific inventory instance: the catalog WeaponData
 * with the InventoryItem's supported per-instance OVERRIDES applied (blueprint
 * §2.3: "a merged WeaponData result"). Only `name` and `weightLb` are
 * instance-overridable today; everything else is read from the catalog.
 */
export type ResolvedWeapon = WeaponData;

/**
 * Whether a weapon has a given property. The source parsed a comma-separated
 * qualities STRING; the 2024 model stores `properties` as a typed ARRAY, so this
 * is a direct `.includes` (PHB 2024 "Properties", L9300-9346).
 */
export function hasWeaponProperty(weapon: WeaponData, property: WeaponProperty): boolean {
  return weapon.properties.includes(property);
}

/**
 * Resolve the merged WeaponData for a weapon inventory item.
 *
 * Pure lookup + MERGE: given a weapon InventoryItem and the weapon catalog,
 * return the catalog entry with the item's supported instance overrides applied
 * (`name` and `weightLb` per InventoryItem / blueprint §2.3), or undefined when
 * the item is not a weapon or its `catalogId` is missing/unknown (a custom
 * weapon with no catalog entry carries its stats on the instance and is handled
 * by the UI stage). Returns a fresh object; never mutates the catalog entry.
 *
 * The catalog is injected (defaulting to the real catalog) so callers/tests can
 * supply a fixture, mirroring the resolver's injectable-data seam.
 */
export function resolveWeapon(
  item: InventoryItem,
  catalog: (id: string) => WeaponData | undefined = getWeapon,
): ResolvedWeapon | undefined {
  if (item.kind !== 'weapon' || !item.catalogId) return undefined;
  const base = catalog(item.catalogId);
  if (!base) return undefined;
  // Apply the supported instance overrides. `name`/`weightLb` are documented on
  // InventoryItem as per-instance overrides (e.g. a renamed or reweighted
  // catalog weapon); apply them when present so they are not silently lost.
  return {
    ...base,
    ...(item.name !== undefined ? { name: item.name } : {}),
    ...(item.weightLb !== undefined ? { weightLb: item.weightLb } : {}),
  };
}
