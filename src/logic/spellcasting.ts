/**
 * Spellcasting rules (D&D 5.5e / 2024).
 *
 * Pure resolvers over a character's class selection and the progression tables
 * (src/data/spell-progression.ts), following the classes.ts / saving-throws.ts
 * patterns: every function tolerates an unset or non-caster class and returns a
 * sensible default (undefined / empty), never throwing. The derived totals
 * (spell save DC, spell attack bonus, slot maxima) return a Breakdown so the UI
 * can render a tooltip (calculated-totals steering).
 *
 * SOURCING / RULES COMPLIANCE
 * ---------------------------
 * - Spell save DC = 8 + Proficiency Bonus + spellcasting-ability modifier.
 * - Spell attack bonus = Proficiency Bonus + spellcasting-ability modifier.
 *   PHB 2024 Chapter 7 "Spellcasting": "Spell Save DC" / "Spell Attack Modifier"
 *   (~p.235). Both reuse proficiencyBonus(level) and abilityModifier(score).
 * - Slot / cantrip / prepared counts are table LOOKUPS (never computed from a
 *   level÷2/3 shortcut) — see src/data/spell-progression.ts (rules-compliance
 *   rule 1).
 */

import type { Ability, Character, SpellcastingState } from '../types/character';
import { ABILITY_NAMES } from '../types/character';
import { abilityModifier, proficiencyBonus } from './abilities';
import type { Breakdown } from './breakdown';
import { resolveClass } from './classes';
import { getSpell } from '../data/spells';
import type { SpellId } from '../data/spells';
import {
  CANTRIPS_KNOWN,
  MYSTIC_ARCANUM_LEVELS,
  PACT_MAGIC,
  PREPARED_COUNT,
  SPELLCASTING_DESCRIPTORS,
  slotTableForKind,
} from '../data/spell-progression';
import type {
  CasterKind,
  PactMagicRow,
  SlotVector,
  SpellcastingDescriptor,
} from '../data/spell-progression';

/**
 * The spellcasting descriptor for the character's class, or undefined when no
 * class is chosen / the class is not a caster.
 */
function descriptorFor(character: Character): SpellcastingDescriptor | undefined {
  const cls = resolveClass(character);
  if (!cls) return undefined;
  return SPELLCASTING_DESCRIPTORS[cls.id as keyof typeof SPELLCASTING_DESCRIPTORS];
}

/**
 * Whether the character can cast spells RIGHT NOW. Level-aware, not merely
 * class-aware: a full/half caster casts from level 1, but a subclass caster
 * (Eldritch Knight / Arcane Trickster) only casts once it has both chosen the
 * casting subclass AND reached the subclass's spellcasting level (3 in 2024).
 *
 * PHB 2024: a class with the Spellcasting / Pact Magic feature casts from level
 * 1; the Eldritch Knight (Fighter ~p.52) and Arcane Trickster (Rogue ~p.123)
 * subclasses gain Spellcasting at class level 3.
 */
export function isSpellcaster(character: Character): boolean {
  const descriptor = descriptorFor(character);
  if (!descriptor) return false;
  // Subclass-only caster: require the casting subclass AND the casting level.
  if (descriptor.subclassCastingLevel !== undefined) {
    if (character.class?.subclassId !== descriptor.subclassId) return false;
    return character.level >= descriptor.subclassCastingLevel;
  }
  // Base-class caster: casts from level 1.
  return true;
}

/**
 * The spellcasting ability for the character, or undefined for a non-caster.
 * PHB 2024: set by the feature that grants casting (Int for Eldritch Knight /
 * Arcane Trickster; Cha/Wis/Int per the base class otherwise).
 */
export function spellcastingAbility(character: Character): Ability | undefined {
  if (!isSpellcaster(character)) return undefined;
  return descriptorFor(character)?.ability;
}

/** The caster kind (full/half/third/pact), or undefined for a non-caster. */
export function casterKind(character: Character): CasterKind | undefined {
  if (!isSpellcaster(character)) return undefined;
  return descriptorFor(character)?.kind;
}

/**
 * Spell save DC with a breakdown for a tooltip.
 * PHB 2024 "Spell Save DC" (~p.235): 8 + Proficiency Bonus + ability modifier.
 * Returns undefined for a non-caster (no DC to show).
 */
export function spellSaveDcBreakdown(character: Character): Breakdown | undefined {
  const ability = spellcastingAbility(character);
  if (ability === undefined) return undefined;
  const pb = proficiencyBonus(character.level);
  const mod = abilityModifier(character.abilities[ability]);
  return {
    total: 8 + pb + mod,
    components: [
      { label: 'Base', value: 8 },
      { label: 'Proficiency', value: pb },
      { label: `${ABILITY_NAMES[ability]} mod`, value: mod },
    ],
  };
}

/**
 * Spell attack bonus with a breakdown for a tooltip.
 * PHB 2024 "Spell Attack Modifier" (~p.235): Proficiency Bonus + ability mod.
 * Returns undefined for a non-caster.
 */
export function spellAttackBreakdown(character: Character): Breakdown | undefined {
  const ability = spellcastingAbility(character);
  if (ability === undefined) return undefined;
  const pb = proficiencyBonus(character.level);
  const mod = abilityModifier(character.abilities[ability]);
  return {
    total: pb + mod,
    components: [
      { label: 'Proficiency', value: pb },
      { label: `${ABILITY_NAMES[ability]} mod`, value: mod },
    ],
  };
}

/**
 * The standard spell-slot vector for the character's level (1-indexed by spell
 * level, index 0 unused), or undefined for a non-caster or a Warlock (whose
 * slots come from pactMagicSlots). PHB 2024 class Features tables.
 */
export function spellSlots(character: Character): SlotVector | undefined {
  const kind = casterKind(character);
  if (kind === undefined || kind === 'pact') return undefined;
  const table = slotTableForKind(kind);
  if (!table) return undefined;
  return table[character.level];
}

/**
 * The Warlock's Pact Magic row for the character's level, or undefined when the
 * character is not a Pact Magic caster. PHB 2024 Warlock Features table (~p.154)
 * — slots are all the same level and recharge on a Short or Long Rest.
 */
export function pactMagicSlots(character: Character): PactMagicRow | undefined {
  if (casterKind(character) !== 'pact') return undefined;
  return PACT_MAGIC[character.level];
}

/**
 * A breakdown for a single slot-level maximum (the slot count is a direct table
 * lookup, so the breakdown names the class + level as its single source).
 * Returns undefined when the character has no slots of that level.
 */
export function spellSlotMaxBreakdown(
  character: Character,
  slotLevel: number,
): Breakdown | undefined {
  const slots = spellSlots(character);
  if (!slots) return undefined;
  const max = slots[slotLevel] ?? 0;
  if (max <= 0) return undefined;
  const cls = resolveClass(character);
  const className = cls?.name ?? 'Class';
  return {
    total: max,
    components: [
      { label: `${className} level ${character.level}, level-${slotLevel} slots`, value: max },
    ],
  };
}

/**
 * The number of cantrips the character knows at its level, or 0 when the class
 * has no cantrips (Paladin/Ranger) or is a non-caster. PHB 2024 "Cantrips"
 * column of the class Features table.
 */
export function cantripsKnown(character: Character): number {
  if (!isSpellcaster(character)) return 0;
  const cls = resolveClass(character);
  if (!cls) return 0;
  const table = CANTRIPS_KNOWN[cls.id as keyof typeof CANTRIPS_KNOWN];
  return table?.[character.level] ?? 0;
}

/**
 * A breakdown for the cantrips-known cap (a direct table lookup, so the single
 * component names the class + level as its source). Returns a zero breakdown for
 * a class with no cantrips (Paladin/Ranger) and undefined for a non-caster —
 * the calculated-totals rule requires even zero-valued caps to show a tooltip.
 */
export function cantripsKnownBreakdown(character: Character): Breakdown | undefined {
  if (!isSpellcaster(character)) return undefined;
  const cls = resolveClass(character);
  if (!cls) return undefined;
  const table = CANTRIPS_KNOWN[cls.id as keyof typeof CANTRIPS_KNOWN];
  const total = table?.[character.level] ?? 0;
  return {
    total,
    components: [{ label: `${cls.name} level ${character.level} (Cantrips)`, value: total }],
  };
}

/**
 * A breakdown for the prepared-spells cap (a direct table lookup). Returns
 * undefined for a non-caster or a level with no prepared spells.
 */
export function preparedCountBreakdown(character: Character): Breakdown | undefined {
  if (!isSpellcaster(character)) return undefined;
  const cls = resolveClass(character);
  if (!cls) return undefined;
  const table = PREPARED_COUNT[cls.id as keyof typeof PREPARED_COUNT];
  const total = table?.[character.level] ?? 0;
  if (total <= 0) return undefined;
  return {
    total,
    components: [{ label: `${cls.name} level ${character.level} (Prepared Spells)`, value: total }],
  };
}

/**
 * A breakdown for a slot level's AVAILABLE count: max minus expended. The
 * components sum to the available total (max + (-expended)), satisfying the
 * breakdown invariant and the calculated-totals steering.
 */
export function spellSlotAvailableBreakdown(
  max: number,
  expended: number,
  label: string,
): Breakdown {
  const available = Math.max(0, max - expended);
  const spent = Math.min(expended, max);
  return {
    total: available,
    components: [
      { label: `${label} max`, value: max },
      { label: 'Expended', value: -spent },
    ],
  };
}

/**
 * The number of leveled spells the character can prepare at its level, or 0 for
 * a non-caster. PHB 2024 "Prepared Spells" column of the class Features table
 * (2024 RAW models every caster as a changeable prepared list).
 */
export function preparedCount(character: Character): number {
  if (!isSpellcaster(character)) return 0;
  const cls = resolveClass(character);
  if (!cls) return 0;
  const table = PREPARED_COUNT[cls.id as keyof typeof PREPARED_COUNT];
  return table?.[character.level] ?? 0;
}

/**
 * The highest spell level the character can currently cast (1-9), or 0 when the
 * character has no leveled slots. For a Warlock this is the Pact Magic slot
 * level; otherwise it is the highest spell level with a non-zero slot count.
 */
export function maxSpellLevel(character: Character): number {
  const pact = pactMagicSlots(character);
  if (pact) return pact.slotLevel;
  const slots = spellSlots(character);
  if (!slots) return 0;
  let max = 0;
  for (let level = 1; level < slots.length; level++) {
    if ((slots[level] ?? 0) > 0) max = level;
  }
  return max;
}

/**
 * The Mystic Arcanum spell LEVELS (6/7/8/9) the character has access to at its
 * current level, or [] when it is not a Warlock or has not yet reached level
 * 11. PHB 2024 "Warlock: Mystic Arcanum" (~p.154): a level 6 arcanum at Warlock
 * 11, level 7 at 13, level 8 at 15, level 9 at 17 — each cast once without a
 * spell slot, recovering on a Long Rest (tracked outside Pact Magic slots).
 */
export function mysticArcanumLevels(character: Character): number[] {
  if (casterKind(character) !== 'pact') return [];
  const levels = MYSTIC_ARCANUM_LEVELS[character.level];
  return levels ? [...levels] : [];
}

/**
 * The PRIMARY class id whose spell list the character draws from, or undefined
 * for a non-caster. For subclass casters (Eldritch Knight / Arcane Trickster)
 * this is the Wizard list (PHB 2024); otherwise it is the character's own
 * class. For the full set of lists a character may draw from (e.g. a level-10+
 * Bard's Magical Secrets), use spellListClassIds.
 */
export function spellListClassId(character: Character): string | undefined {
  if (!isSpellcaster(character)) return undefined;
  const descriptor = descriptorFor(character);
  const cls = resolveClass(character);
  return descriptor?.spellListClassId ?? cls?.id;
}

/**
 * Every class spell list the character may browse / prepare from, or [] for a
 * non-caster. Normally this is just the primary list (spellListClassId), but a
 * Bard of level 10+ gains Magical Secrets, which lets them prepare spells from
 * the Bard, Cleric, Druid, and Wizard lists (PHB 2024 "Bard: Magical Secrets"
 * ~p.57 — "choose any of your new prepared spells from the Bard, Cleric, Druid,
 * and Wizard spell lists"). The chosen spells still count as Bard spells, so
 * the cap/progression is unchanged; only the available pool widens.
 */
export function spellListClassIds(character: Character): string[] {
  const primary = spellListClassId(character);
  if (primary === undefined) return [];
  const cls = resolveClass(character);
  // PHB 2024 Bard Magical Secrets unlocks the Bard/Cleric/Druid/Wizard union.
  if (cls?.id === 'bard' && character.level >= 10) {
    return ['bard', 'cleric', 'druid', 'wizard'];
  }
  return [primary];
}

/**
 * The class list the character draws CANTRIPS from, or [] for a non-caster.
 *
 * Unlike spellListClassIds, this is NOT widened by Bard Magical Secrets:
 * Magical Secrets lets a level-10+ Bard prepare level-1+ spells from the Bard/
 * Cleric/Druid/Wizard lists, but a Bard's cantrips are always chosen from the
 * Bard list only (PHB 2024 "Bard: Spellcasting" — "you learn another cantrip …
 * from the Bard spell list"; "Bard: Magical Secrets" applies to prepared
 * spells, not cantrips). So cantrips use only the primary list for every class.
 */
export function cantripListClassIds(character: Character): string[] {
  const primary = spellListClassId(character);
  return primary === undefined ? [] : [primary];
}

/**
 * Cantrip ids the character is REQUIRED to know and cannot replace, or [] when
 * there are none. PHB 2024: an Arcane Trickster always knows Mage Hand and
 * cannot replace it ("Arcane Trickster: Spellcasting" ~p.123 — "you can replace
 * one of your cantrips, except Mage Hand"). The required cantrip still counts
 * against the cantrips-known total.
 */
export function requiredCantrips(character: Character): SpellId[] {
  if (!isSpellcaster(character)) return [];
  if (character.class?.subclassId === 'arcaneTrickster' && getSpell('mage-hand')) {
    return ['mage-hand'];
  }
  return [];
}

/**
 * Leveled spells a class/subclass feature makes ALWAYS prepared at the
 * character's current level, or [] when there are none. These are granted by
 * features (not chosen by the player) and the PHB 2024 states they do NOT count
 * against the class's Prepared Spells number — so the UI must render them as
 * locked and exclude them from the prepared cap (reviewer finding).
 *
 * Each entry is gated on the level the granting feature is gained, and keyed to
 * a spell id present in the catalog (guarded by getSpell so a missing catalog
 * entry is simply omitted rather than crashing). Sources per feature:
 *   - Druid: "Druidic" (L1) — always have Speak with Animals prepared. PHB 2024 ~p.85.
 *   - Paladin: "Paladin's Smite" (L2) — always have Divine Smite prepared. PHB 2024 ~p.111.
 *   - Paladin: "Faithful Steed" (L5) — always have Find Steed prepared. PHB 2024 ~p.111.
 *   - Ranger: "Favored Enemy" (L1) — always have Hunter's Mark prepared. PHB 2024 ~p.120.
 *   - Warlock: "Contact Patron" (L9) — always have Contact Other Plane prepared. PHB 2024 ~p.155.
 *   - Bard: "Words of Creation" (L20) — always have Power Word Heal and Power Word Kill prepared. PHB 2024 ~p.61.
 * The "always prepared … don't count against the number in the Prepared Spells
 * column" rule is the per-class spellcasting text (PHB 2024 Bard p.57, Druid
 * p.83, Paladin p.109, Ranger p.119, Warlock p.153).
 */
export function alwaysPreparedSpells(character: Character): SpellId[] {
  if (!isSpellcaster(character)) return [];
  const cls = resolveClass(character);
  if (!cls) return [];
  const level = character.level;
  // [spellId, grantedAtLevel] pairs per class.
  const grants: Record<string, Array<[SpellId, number]>> = {
    druid: [['speak-with-animals', 1]],
    paladin: [
      ['divine-smite', 2],
      ['find-steed', 5],
    ],
    ranger: [['hunter-s-mark', 1]],
    warlock: [['contact-other-plane', 9]],
    bard: [
      ['power-word-heal', 20],
      ['power-word-kill', 20],
    ],
  };
  const forClass = grants[cls.id] ?? [];
  const ids: SpellId[] = [];
  for (const [id, grantedAt] of forClass) {
    if (level >= grantedAt && getSpell(id)) ids.push(id);
  }
  return ids;
}

/**
 * Whether the stored spellcasting state (chosen cantrips, prepared spells,
 * spellbook, expended slots) is still valid after a class/subclass change.
 *
 * Spell selections are drawn from a specific class's list (the Wizard list for
 * the subclass casters). When the granting class changes — or the subclass
 * changes on a class whose casting comes from the subclass (Eldritch Knight /
 * Arcane Trickster) — the old selections belong to a different list and must be
 * dropped, or hidden-but-retained entries can leave a new caster over its cap
 * and unable to choose (review finding: spell state survived class changes).
 *
 * Returns true when the state should be CLEARED for the transition from
 * `prev` to `next` class selection (either may be undefined for "no class").
 */
export function shouldResetSpellcasting(
  prev: Character['class'],
  next: Character['class'],
): boolean {
  // Class id changed (including to/from no class): different spell list.
  if (prev?.id !== next?.id) return true;
  // Same class: a subclass change only affects spell state for a subclass
  // caster (its spell list / casting is granted by the subclass).
  if (prev?.subclassId !== next?.subclassId) {
    const descriptor = next
      ? SPELLCASTING_DESCRIPTORS[next.id as keyof typeof SPELLCASTING_DESCRIPTORS]
      : undefined;
    if (descriptor?.subclassCastingLevel !== undefined) return true;
  }
  return false;
}

/**
 * The read-only spellcasting-focus description for the character's class, or
 * undefined for a non-caster. PHB 2024: the focus (Arcane Focus / Holy Symbol /
 * Druidic Focus / Musical Instrument) has no effect on DC/attack, so it is
 * surfaced as text and stored nowhere. The focus kind is a fixed per-class
 * value (see spellcastingFocusOptions), each cited to the PHB 2024 class text.
 */
export function spellcastingFocus(character: Character): string | undefined {
  const options = spellcastingFocusOptions(character);
  return options.length > 0 ? options.join(' or ') : undefined;
}

/**
 * The read-only spellcasting-focus options from the class data, or [] for a
 * non-caster. PHB 2024: the focus has no effect on DC/attack, so it is surfaced
 * as text and stored nowhere. Most casters have a single focus kind; a Wizard
 * may use either an Arcane Focus OR their spellbook as a Spellcasting Focus
 * (PHB 2024 "Wizard: Spellcasting" ~p.165 — the spellbook can serve as the
 * Wizard's Spellcasting Focus).
 */
export function spellcastingFocusOptions(character: Character): string[] {
  if (!isSpellcaster(character)) return [];
  const cls = resolveClass(character);
  if (!cls) return [];
  // PHB 2024: focus named in each class's Spellcasting focus text.
  const byClass: Record<string, string[]> = {
    bard: ['Musical Instrument'],
    cleric: ['Holy Symbol'],
    druid: ['Druidic Focus'],
    sorcerer: ['Arcane Focus'],
    warlock: ['Arcane Focus'],
    wizard: ['Arcane Focus', 'Spellbook'],
    paladin: ['Holy Symbol'],
    ranger: ['Druidic Focus'],
    fighter: ['Arcane Focus'], // Eldritch Knight (PHB 2024 ~p.52).
    rogue: ['Arcane Focus'], // Arcane Trickster (PHB 2024 ~p.123).
  };
  return byClass[cls.id] ?? [];
}

/**
 * Prunes stored spellcasting selections that are no longer legal at the
 * character's CURRENT level, returning a reconciled SpellcastingState (or
 * undefined when nothing remains). Needed because caps are enforced only when
 * ADDING: lowering a character's level can strand cantrips over the (lower)
 * cantrip cap and prepared/spellbook spells above the (lower) maximum castable
 * spell level, which would otherwise stay hidden yet still count toward caps
 * and be unremovable from the picker (review finding: level reduction strands
 * spell state).
 *
 * Rules basis: a prepared spell "must be of a level for which you have spell
 * slots" (PHB 2024 class Spellcasting features), and cantrips known are capped
 * by the class "Cantrips" column — so an over-level or over-cap selection is
 * not a legal choice at the current level and is dropped. Required cantrips
 * (Arcane Trickster's Mage Hand) are always retained.
 */
export function reconcileSpellcastingForLevel(
  character: Character,
): SpellcastingState | undefined {
  const sc = character.spellcasting;
  if (!sc) return undefined;

  const topLevel = maxSpellLevel(character);
  const cantripCap = cantripsKnown(character);
  const preparedCap = preparedCount(character);
  const required = requiredCantrips(character);
  const next: SpellcastingState = { ...sc };

  // The spell lists currently legal for this character. Prepared/spellbook
  // spells must belong to one of them, and cantrips to the (narrower) cantrip
  // list — otherwise a list change (e.g. Bard 10→9 dropping Magical Secrets, or
  // a class change) can strand an entry that is hidden in the picker yet still
  // counts toward a cap (review finding: level-down reconciliation incomplete).
  const preparedLists = new Set(spellListClassIds(character));
  const cantripLists = new Set(cantripListClassIds(character));
  const onLists = (id: SpellId, lists: Set<string>): boolean => {
    const spell = getSpell(id);
    return spell !== undefined && spell.classes.some((c) => lists.has(c));
  };

  // Drop leveled spells above the highest castable level OR off the current
  // legal lists (prepared + spellbook).
  const legalLeveled = (id: SpellId, lists: Set<string>): boolean => {
    const spell = getSpell(id);
    return (
      spell !== undefined &&
      spell.level >= 1 &&
      spell.level <= topLevel &&
      onLists(id, lists)
    );
  };
  if (sc.prepared) {
    // Keep only level-legal, list-legal prepared spells, then clamp to the
    // current Prepared Spells cap (PHB 2024 class "Prepared Spells" column).
    const pruned = sc.prepared.filter((id) => legalLeveled(id, preparedLists));
    const capped = preparedCap > 0 ? pruned.slice(0, preparedCap) : [];
    if (capped.length > 0) next.prepared = capped;
    else delete next.prepared;
  }
  if (sc.spellbook) {
    // The spellbook is Wizard-only and uncapped this stage, but still must stay
    // within the castable level and on the (Wizard) list.
    const pruned = sc.spellbook.filter((id) => legalLeveled(id, preparedLists));
    if (pruned.length > 0) next.spellbook = pruned;
    else delete next.spellbook;
  }

  // Trim cantrips to the current cap and legal cantrip list, keeping required
  // cantrips (Arcane Trickster's Mage Hand) first.
  if (sc.cantrips) {
    const legalCantrips = sc.cantrips.filter(
      (id) => required.includes(id) || onLists(id, cantripLists),
    );
    const requiredKept = legalCantrips.filter((id) => required.includes(id));
    const optional = legalCantrips.filter((id) => !required.includes(id));
    const room = Math.max(0, cantripCap - requiredKept.length);
    const kept = [...requiredKept, ...optional.slice(0, room)];
    if (kept.length > 0) next.cantrips = kept;
    else delete next.cantrips;
  }

  // Clamp expended standard slots to the new per-level maxima.
  if (sc.slotsExpended) {
    const slots = spellSlots(character);
    const clamped: Partial<Record<number, number>> = {};
    for (const [key, spent] of Object.entries(sc.slotsExpended)) {
      const level = Number(key);
      const max = slots?.[level] ?? 0;
      const value = Math.max(0, Math.min(max, spent ?? 0));
      if (value > 0) clamped[level] = value;
    }
    if (Object.keys(clamped).length > 0) next.slotsExpended = clamped;
    else delete next.slotsExpended;
  }

  // Clamp expended Pact Magic slots to the new maximum.
  if (sc.pactSlotsExpended !== undefined) {
    const pactMax = pactMagicSlots(character)?.slots ?? 0;
    const value = Math.max(0, Math.min(pactMax, sc.pactSlotsExpended));
    if (value > 0) next.pactSlotsExpended = value;
    else delete next.pactSlotsExpended;
  }

  // Drop Mystic Arcanum choices (and their expended flags) for arcanum levels
  // the character no longer has access to, and any choice that is no longer a
  // legal Warlock spell of the matching level (PHB 2024 "Warlock: Mystic
  // Arcanum" — one Warlock spell per granted arcanum level).
  const arcanumLevels = new Set(mysticArcanumLevels(character));
  const arcanumLegal = (level: number, id: SpellId | undefined): boolean => {
    if (id === undefined || !arcanumLevels.has(level)) return false;
    const spell = getSpell(id);
    return (
      spell !== undefined &&
      spell.level === level &&
      (spell.classes as readonly string[]).includes('warlock')
    );
  };
  if (sc.mysticArcana) {
    const kept: Partial<Record<number, SpellId>> = {};
    for (const [key, id] of Object.entries(sc.mysticArcana)) {
      const level = Number(key);
      if (arcanumLegal(level, id)) kept[level] = id!;
    }
    if (Object.keys(kept).length > 0) next.mysticArcana = kept;
    else delete next.mysticArcana;
  }
  if (sc.mysticArcanaExpended) {
    const kept: Partial<Record<number, boolean>> = {};
    for (const [key, spent] of Object.entries(sc.mysticArcanaExpended)) {
      const level = Number(key);
      if (spent && arcanumLevels.has(level)) kept[level] = true;
    }
    if (Object.keys(kept).length > 0) next.mysticArcanaExpended = kept;
    else delete next.mysticArcanaExpended;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}
