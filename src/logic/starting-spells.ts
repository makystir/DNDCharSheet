/**
 * Starting spell pools and random picks for a level-1 caster (D&D 5.5e / 2024).
 *
 * Pure logic. Counts come from startingChoicesFor (which reads the existing
 * per-class caps in spellcasting.ts); the spell pools come from the same class
 * lists the Spells page uses (classSpellListClassIds / classCantripListClassIds).
 *
 * PHB 2024 Wizard "Spellbook" (L7404-7408): the spellbook starts with six level 1
 * Wizard spells; Wizard "Spellcasting" (L7412): prepare four of them. Every other
 * caster prepares N level 1 spells from its class list. 2024 has no separate
 * "memorize" step: every caster prepares its list. At level 1 the only castable
 * spell level is 1, and cantrips are level 0.
 */
import type { ClassSpellcasting } from '../types/character';
import type { CatalogSpell, SpellId } from '../data/spells';
import { spellsForClass } from '../data/spells';
import type { ClassId } from '../data/classes';
import type { RNG } from './random';
import { startingChoicesFor } from './starting-choices';
import {
  classAlwaysPreparedSpells,
  classCantripListClassIds,
  classMaxPreparedLevel,
  classRequiredCantrips,
  classSpellListClassIds,
} from './spellcasting';

/** Merge the catalog spells of a set of class lists (deduped, level/name sorted). */
function mergeLists(ids: string[]): CatalogSpell[] {
  const seen = new Set<SpellId>();
  const merged: CatalogSpell[] = [];
  for (const id of ids) {
    for (const s of spellsForClass(id)) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        merged.push(s);
      }
    }
  }
  merged.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  return merged;
}

export interface StartingSpellPools {
  /** Level-0 spells on the class cantrip list. */
  cantrips: CatalogSpell[];
  /** Level-1 spells on the class list (spellbook candidates / prepared candidates). */
  leveled: CatalogSpell[];
  /** Feature spells that are always prepared (never chosen, never counted). */
  alwaysPrepared: SpellId[];
  /** Cantrips the class must know (locked, count toward the cap). */
  required: SpellId[];
}

/** The spell pools a level-1 character of the class picks from, or undefined for a non-caster. */
export function startingSpellPools(classId: string): StartingSpellPools | undefined {
  if (startingChoicesFor(classId)?.spells == null) return undefined;
  const entry = { id: classId as ClassId, level: 1 };
  const top = classMaxPreparedLevel(entry);
  return {
    cantrips: mergeLists(classCantripListClassIds(entry)).filter((s) => s.level === 0),
    leveled: mergeLists(classSpellListClassIds(entry)).filter((s) => s.level >= 1 && s.level <= top),
    alwaysPrepared: classAlwaysPreparedSpells(entry),
    required: classRequiredCantrips(entry),
  };
}

/** Draws up to n distinct items using the injected RNG (one draw per item). */
function drawDistinct<T>(rng: RNG, list: readonly T[], n: number): T[] {
  const remaining = [...list];
  const out: T[] = [];
  while (out.length < n && remaining.length > 0) {
    out.push(remaining.splice(Math.floor(rng() * remaining.length), 1)[0]);
  }
  return out;
}

/**
 * Deterministic random starting spells in the same shape the Spells page stores
 * (character.spellcasting.byClass[classId]). Order of draws: cantrips, then
 * (Wizard) spellbook, then prepared (a Wizard's prepared set is a subset of its
 * spellbook). Returns undefined for a non-caster.
 */
export function pickStartingSpells(classId: string, rng: RNG): ClassSpellcasting | undefined {
  const choices = startingChoicesFor(classId)?.spells;
  const pools = startingSpellPools(classId);
  if (!choices || !pools) return undefined;
  const result: ClassSpellcasting = {};

  if (choices.cantrips > 0) {
    const eligible = pools.cantrips.filter((s) => !pools.required.includes(s.id)).map((s) => s.id);
    result.cantrips = [
      ...pools.required,
      ...drawDistinct(rng, eligible, choices.cantrips - pools.required.length),
    ];
  }

  const eligibleLeveled = pools.leveled
    .map((s) => s.id)
    .filter((id) => !pools.alwaysPrepared.includes(id));
  if (choices.spellbook !== null) {
    result.spellbook = drawDistinct(rng, eligibleLeveled, choices.spellbook);
    result.prepared = drawDistinct(rng, result.spellbook, choices.prepared);
  } else if (choices.prepared > 0) {
    result.prepared = drawDistinct(rng, eligibleLeveled, choices.prepared);
  }
  return result;
}
