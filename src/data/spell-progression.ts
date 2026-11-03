/**
 * D&D 5.5e (2024) spellcasting progression tables.
 *
 * A flat, typed data module that holds the per-class, per-level columns the
 * class catalog (src/data/classes.ts) deliberately does NOT encode: the spell
 * slot matrices, the "Cantrips" column, and the "Prepared Spells" column. The
 * class catalog remains the source of truth for the spellcasting ABILITY and
 * for which classes are casters; this module supplies the numeric progression.
 *
 * SOURCING / RULES COMPLIANCE
 * ---------------------------
 * Every value is transcribed verbatim from the printed PHB 2024 class Features
 * tables (and the Eldritch Knight / Arcane Trickster Spellcasting tables) in
 * Docs/PlayersHandbook.md. NOTHING is computed with a "level ÷ 2/3" shortcut —
 * the half-/third-caster slot rows are the printed rows (rules-compliance rule
 * 1). Each table carries an inline PHB citation. The standard full-caster slot
 * grid is identical across Bard/Cleric/Druid/Sorcerer/Wizard (verified against
 * the Bard, Druid, Cleric, Sorcerer, and Wizard Features tables and the
 * Multiclass Spellcaster table), so it is shared.
 *
 * Index convention: every per-level array is 1-indexed by CHARACTER LEVEL via a
 * leading placeholder at index 0 (so `SLOT_TABLE[level]` reads naturally).
 * A slot vector is itself 1-indexed by SPELL LEVEL (index 0 is a placeholder,
 * index 1 = level-1 slots, …, index 9 = level-9 slots).
 */

import type { Ability } from '../types/character';
import type { ClassId, SubclassId } from './classes';

/** How a class's slots scale. PHB 2024 Multiclass Spellcaster rules (p.37). */
export type CasterKind = 'full' | 'half' | 'third' | 'pact';

/** A per-level spell-slot vector, 1-indexed by spell level (index 0 unused). */
export type SlotVector = readonly number[];

/** A machine-readable descriptor of how a caster class casts. */
export interface SpellcastingDescriptor {
  /** Spellcasting ability (PHB 2024 class "Spellcasting"/"Pact Magic" feature). */
  ability: Ability;
  /** Slot-scaling category. */
  kind: CasterKind;
  /** Class-level Ritual casting capability (PHB 2024). */
  ritual: boolean;
  /** Wizard only: prepares from a spellbook (PHB 2024 "Wizard: Spellcasting"). */
  usesSpellbook: boolean;
  /**
   * For a subclass-only caster (Eldritch Knight, Arcane Trickster), the class
   * level at which casting begins; undefined for base-class casters (level 1).
   * PHB 2024 "Eldritch Knight" / "Arcane Trickster" (Fighter/Rogue level 3).
   */
  subclassCastingLevel?: number;
  /**
   * For a subclass-only caster, the subclass id that grants casting.
   * PHB 2024: Eldritch Knight (Fighter) / Arcane Trickster (Rogue).
   */
  subclassId?: SubclassId;
  /**
   * The spell list a subclass caster draws from, when it differs from a list of
   * its own name. Eldritch Knight and Arcane Trickster both prepare Wizard
   * spells (PHB 2024). Undefined = the class's own list.
   */
  spellListClassId?: ClassId;
  /**
   * Allowed schools for a subclass caster's Browse filter, or undefined for no
   * restriction. PHB 2024 REMOVED the 2014 EK (Abjuration/Evocation) and AT
   * (Enchantment/Illusion) school limits: the 2024 Eldritch Knight and Arcane
   * Trickster Spellcasting features let you prepare any Wizard spell with no
   * school restriction (PHB 2024 "Eldritch Knight: Spellcasting" ~p.52;
   * "Arcane Trickster: Spellcasting" ~p.123). So this is undefined for both.
   */
  allowedSchools?: readonly string[];
}

// ── Spellcasting descriptors, keyed by class id ────────────────────────────
// Ability values mirror the level-1 feature mechanics in src/data/classes.ts.
// Only the eight caster classes appear; non-casters (Barbarian/Monk) are absent.
// Fighter/Rogue are casters ONLY through the Eldritch Knight / Arcane Trickster
// subclasses, so their descriptors carry subclassCastingLevel + subclassId.
export const SPELLCASTING_DESCRIPTORS: Partial<Record<ClassId, SpellcastingDescriptor>> = {
  // PHB 2024 "Bard: Spellcasting" (~p.58): Cha, full caster, Ritual casting.
  bard: { ability: 'cha', kind: 'full', ritual: true, usesSpellbook: false },
  // PHB 2024 "Cleric: Spellcasting" (~p.70): Wis, full caster, Ritual casting.
  cleric: { ability: 'wis', kind: 'full', ritual: true, usesSpellbook: false },
  // PHB 2024 "Druid: Spellcasting" (~p.78): Wis, full caster, Ritual casting.
  druid: { ability: 'wis', kind: 'full', ritual: true, usesSpellbook: false },
  // PHB 2024 "Sorcerer: Spellcasting" (~p.138): Cha, full caster, no Ritual casting.
  sorcerer: { ability: 'cha', kind: 'full', ritual: false, usesSpellbook: false },
  // PHB 2024 "Warlock: Pact Magic" (~p.154): Cha, Pact Magic, no Ritual casting.
  warlock: { ability: 'cha', kind: 'pact', ritual: false, usesSpellbook: false },
  // PHB 2024 "Wizard: Spellcasting" (~p.166): Int, full caster, Ritual casting, spellbook.
  wizard: { ability: 'int', kind: 'full', ritual: true, usesSpellbook: true },
  // PHB 2024 "Paladin: Spellcasting" (~p.106): Cha, half caster, no cantrips.
  paladin: { ability: 'cha', kind: 'half', ritual: false, usesSpellbook: false },
  // PHB 2024 "Ranger: Spellcasting" (~p.129): Wis, half caster, no cantrips.
  ranger: { ability: 'wis', kind: 'half', ritual: false, usesSpellbook: false },
  // PHB 2024 "Eldritch Knight: Spellcasting" (~p.52): Int, third caster via the
  // Eldritch Knight Fighter subclass, casting begins at Fighter level 3; draws
  // from the Wizard spell list with NO school restriction (2024 change).
  fighter: {
    ability: 'int',
    kind: 'third',
    ritual: false,
    usesSpellbook: false,
    subclassCastingLevel: 3,
    subclassId: 'eldritchKnight',
    spellListClassId: 'wizard',
  },
  // PHB 2024 "Arcane Trickster: Spellcasting" (~p.123): Int, third caster via
  // the Arcane Trickster Rogue subclass, casting begins at Rogue level 3; draws
  // from the Wizard spell list with NO school restriction (2024 change).
  rogue: {
    ability: 'int',
    kind: 'third',
    ritual: false,
    usesSpellbook: false,
    subclassCastingLevel: 3,
    subclassId: 'arcaneTrickster',
    spellListClassId: 'wizard',
  },
};

// ── Standard (full-caster) spell-slot grid ─────────────────────────────────
// PHB 2024 full-caster Features tables (Bard ~p.59, Cleric ~p.71, Druid ~p.79,
// Sorcerer ~p.139, Wizard ~p.166) — identical grid, matching the Multiclass
// Spellcaster table (PHB 2024 ~p.37). Index 0 is a placeholder; index = char
// level. Each slot vector is 1-indexed by spell level (index 0 unused).
export const FULL_CASTER_SLOTS: readonly SlotVector[] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 0 (placeholder)
  [0, 2, 0, 0, 0, 0, 0, 0, 0, 0], // 1
  [0, 3, 0, 0, 0, 0, 0, 0, 0, 0], // 2
  [0, 4, 2, 0, 0, 0, 0, 0, 0, 0], // 3
  [0, 4, 3, 0, 0, 0, 0, 0, 0, 0], // 4
  [0, 4, 3, 2, 0, 0, 0, 0, 0, 0], // 5
  [0, 4, 3, 3, 0, 0, 0, 0, 0, 0], // 6
  [0, 4, 3, 3, 1, 0, 0, 0, 0, 0], // 7
  [0, 4, 3, 3, 2, 0, 0, 0, 0, 0], // 8
  [0, 4, 3, 3, 3, 1, 0, 0, 0, 0], // 9
  [0, 4, 3, 3, 3, 2, 0, 0, 0, 0], // 10
  [0, 4, 3, 3, 3, 2, 1, 0, 0, 0], // 11
  [0, 4, 3, 3, 3, 2, 1, 0, 0, 0], // 12
  [0, 4, 3, 3, 3, 2, 1, 1, 0, 0], // 13
  [0, 4, 3, 3, 3, 2, 1, 1, 0, 0], // 14
  [0, 4, 3, 3, 3, 2, 1, 1, 1, 0], // 15
  [0, 4, 3, 3, 3, 2, 1, 1, 1, 0], // 16
  [0, 4, 3, 3, 3, 2, 1, 1, 1, 1], // 17
  [0, 4, 3, 3, 3, 3, 1, 1, 1, 1], // 18
  [0, 4, 3, 3, 3, 3, 2, 1, 1, 1], // 19
  [0, 4, 3, 3, 3, 3, 2, 2, 1, 1], // 20
];

// ── Half-caster spell-slot grid (Paladin, Ranger) ──────────────────────────
// PHB 2024 Paladin Features table (~p.106) and Ranger Features table (~p.129) —
// identical grid. Transcribed rows (NOT computed from half-level). Max spell
// level reached is 5. Index 0 placeholder; index = char level.
export const HALF_CASTER_SLOTS: readonly SlotVector[] = [
  [0, 0, 0, 0, 0, 0], // 0 (placeholder)
  [0, 2, 0, 0, 0, 0], // 1
  [0, 2, 0, 0, 0, 0], // 2
  [0, 3, 0, 0, 0, 0], // 3
  [0, 3, 0, 0, 0, 0], // 4
  [0, 4, 2, 0, 0, 0], // 5
  [0, 4, 2, 0, 0, 0], // 6
  [0, 4, 3, 0, 0, 0], // 7
  [0, 4, 3, 0, 0, 0], // 8
  [0, 4, 3, 2, 0, 0], // 9
  [0, 4, 3, 2, 0, 0], // 10
  [0, 4, 3, 3, 0, 0], // 11
  [0, 4, 3, 3, 0, 0], // 12
  [0, 4, 3, 3, 1, 0], // 13
  [0, 4, 3, 3, 1, 0], // 14
  [0, 4, 3, 3, 2, 0], // 15
  [0, 4, 3, 3, 2, 0], // 16
  [0, 4, 3, 3, 3, 1], // 17
  [0, 4, 3, 3, 3, 1], // 18
  [0, 4, 3, 3, 3, 2], // 19
  [0, 4, 3, 3, 3, 2], // 20
];

// ── Third-caster spell-slot grid (Eldritch Knight, Arcane Trickster) ───────
// PHB 2024 Eldritch Knight Spellcasting table (~p.52) and Arcane Trickster
// Spellcasting table (~p.123) — identical grid. Casting begins at class level
// 3; levels 1-2 have no slots. Max spell level reached is 4 (the printed table
// has a 4th-level column: 1 slot at levels 19-20). Transcribed rows (NOT
// computed from third-level). Each vector is 1-indexed by spell level with a
// placeholder at index 0, so the vector length is 5 (index 0 + levels 1-4).
// Index 0 of the grid is a placeholder; index = char level.
export const THIRD_CASTER_SLOTS: readonly SlotVector[] = [
  [0, 0, 0, 0, 0], // 0 (placeholder)
  [0, 0, 0, 0, 0], // 1 (no casting)
  [0, 0, 0, 0, 0], // 2 (no casting)
  [0, 2, 0, 0, 0], // 3
  [0, 3, 0, 0, 0], // 4
  [0, 3, 0, 0, 0], // 5
  [0, 3, 0, 0, 0], // 6
  [0, 4, 2, 0, 0], // 7
  [0, 4, 2, 0, 0], // 8
  [0, 4, 2, 0, 0], // 9
  [0, 4, 3, 0, 0], // 10
  [0, 4, 3, 0, 0], // 11
  [0, 4, 3, 0, 0], // 12
  [0, 4, 3, 2, 0], // 13
  [0, 4, 3, 2, 0], // 14
  [0, 4, 3, 2, 0], // 15
  [0, 4, 3, 3, 0], // 16
  [0, 4, 3, 3, 0], // 17
  [0, 4, 3, 3, 0], // 18
  [0, 4, 3, 3, 1], // 19
  [0, 4, 3, 3, 1], // 20
];

/** A Warlock Pact Magic row: the number of slots and the single slot level. */
export interface PactMagicRow {
  /** Number of Pact Magic slots (all the same level). */
  slots: number;
  /** The level those slots are cast at (1-5); 0 while the Warlock has none. */
  slotLevel: number;
}

// ── Warlock Pact Magic (its own slot model) ────────────────────────────────
// PHB 2024 Warlock Features table (~p.154): all Pact Magic slots are the SAME
// level, few in number, and recharge on a Short OR Long Rest — never reuse the
// standard slot grid or recovery. Index 0 placeholder; index = char level.
export const PACT_MAGIC: readonly PactMagicRow[] = [
  { slots: 0, slotLevel: 0 }, // 0 (placeholder)
  { slots: 1, slotLevel: 1 }, // 1
  { slots: 2, slotLevel: 1 }, // 2
  { slots: 2, slotLevel: 2 }, // 3
  { slots: 2, slotLevel: 2 }, // 4
  { slots: 2, slotLevel: 3 }, // 5
  { slots: 2, slotLevel: 3 }, // 6
  { slots: 2, slotLevel: 4 }, // 7
  { slots: 2, slotLevel: 4 }, // 8
  { slots: 2, slotLevel: 5 }, // 9
  { slots: 2, slotLevel: 5 }, // 10
  { slots: 3, slotLevel: 5 }, // 11
  { slots: 3, slotLevel: 5 }, // 12
  { slots: 3, slotLevel: 5 }, // 13
  { slots: 3, slotLevel: 5 }, // 14
  { slots: 3, slotLevel: 5 }, // 15
  { slots: 3, slotLevel: 5 }, // 16
  { slots: 4, slotLevel: 5 }, // 17
  { slots: 4, slotLevel: 5 }, // 18
  { slots: 4, slotLevel: 5 }, // 19
  { slots: 4, slotLevel: 5 }, // 20
];

// ── Warlock Mystic Arcanum ─────────────────────────────────────────────────
// PHB 2024 "Warlock: Mystic Arcanum" (~p.154, levels 11/13/15/17): the Warlock
// chooses one spell of level 6, 7, 8, and 9 (one per listed level) that can be
// cast once without a spell slot, recovering on a Long Rest. This is DISTINCT
// from Pact Magic slots and the prepared cap. MYSTIC_ARCANUM_LEVELS[charLevel]
// lists the arcanum SPELL LEVELS available at that Warlock level (cumulative).
// Index 0 placeholder; index = char level.
export const MYSTIC_ARCANUM_LEVELS: readonly (readonly number[])[] = [
  [], // 0 (placeholder)
  [], // 1
  [], // 2
  [], // 3
  [], // 4
  [], // 5
  [], // 6
  [], // 7
  [], // 8
  [], // 9
  [], // 10
  [6], // 11: a level 6 arcanum
  [6], // 12
  [6, 7], // 13: + a level 7 arcanum
  [6, 7], // 14
  [6, 7, 8], // 15: + a level 8 arcanum
  [6, 7, 8], // 16
  [6, 7, 8, 9], // 17: + a level 9 arcanum
  [6, 7, 8, 9], // 18
  [6, 7, 8, 9], // 19
  [6, 7, 8, 9], // 20
];

// ── "Cantrips" column, keyed by class id (1-indexed by char level) ─────────
// Transcribed from each caster's Features table. Paladin and Ranger have NO
// cantrips (no "Cantrips" column in their tables), so they are absent here.
// EK cantrips: 2 known at Fighter level 3, +1 at level 10 (PHB 2024 "Eldritch
// Knight" ~p.52). AT cantrips: 3 known at Rogue level 3 (Mage Hand + 2), +1 at
// level 10 (PHB 2024 "Arcane Trickster" ~p.123).
export const CANTRIPS_KNOWN: Partial<Record<ClassId, readonly number[]>> = {
  // PHB 2024 Bard Features (~p.59): 2 (L1-3), 3 (L4-9), 4 (L10+).
  bard: [0, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  // PHB 2024 Cleric Features (~p.71): 3 (L1-3), 4 (L4-9), 5 (L10+).
  cleric: [0, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  // PHB 2024 Druid Features (~p.79): 2 (L1-3), 3 (L4-9), 4 (L10+).
  druid: [0, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  // PHB 2024 Sorcerer Features (~p.139): 4 (L1-3), 5 (L4-9), 6 (L10+).
  sorcerer: [0, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  // PHB 2024 Warlock Features (~p.154): 2 (L1-3), 3 (L4-9), 4 (L10+).
  warlock: [0, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  // PHB 2024 Wizard Features (~p.166): 3 (L1-3), 4 (L4-9), 5 (L10+).
  wizard: [0, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  // PHB 2024 Eldritch Knight (~p.52): 2 at Fighter L3, 3 at L10.
  fighter: [0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  // PHB 2024 Arcane Trickster (~p.123): 3 at Rogue L3, 4 at L10.
  rogue: [0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
};

// ── "Prepared Spells" column, keyed by class id (1-indexed by char level) ──
// Transcribed from each caster's Features table "Prepared Spells" column. 2024
// RAW models every caster as a changeable prepared list (there is no separate
// "known" column), so this is the single per-class prepared-count table.
export const PREPARED_COUNT: Partial<Record<ClassId, readonly number[]>> = {
  // PHB 2024 Bard Features (~p.59).
  bard: [0, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  // PHB 2024 Cleric Features (~p.71).
  cleric: [0, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  // PHB 2024 Druid Features (~p.79).
  druid: [0, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  // PHB 2024 Sorcerer Features (~p.139).
  sorcerer: [0, 2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  // PHB 2024 Warlock Features (~p.154).
  warlock: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  // PHB 2024 Wizard Features (~p.166).
  wizard: [0, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25],
  // PHB 2024 Paladin Features (~p.106).
  paladin: [0, 2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
  // PHB 2024 Ranger Features (~p.129).
  ranger: [0, 2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
  // PHB 2024 Eldritch Knight Spellcasting (~p.52): starts at Fighter L3.
  fighter: [0, 0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
  // PHB 2024 Arcane Trickster Spellcasting (~p.123): starts at Rogue L3.
  rogue: [0, 0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
};

/** Returns the slot grid for a caster kind (full/half/third). Pact is separate. */
export function slotTableForKind(kind: CasterKind): readonly SlotVector[] | undefined {
  switch (kind) {
    case 'full':
      return FULL_CASTER_SLOTS;
    case 'half':
      return HALF_CASTER_SLOTS;
    case 'third':
      return THIRD_CASTER_SLOTS;
    case 'pact':
      return undefined; // Warlock uses PACT_MAGIC, not a standard grid.
  }
}
