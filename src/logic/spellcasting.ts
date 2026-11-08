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
import type { ClassEntry, ClassSpellcasting } from '../types/character';
import type { ClassId } from '../data/classes';
import { getClass } from '../data/classes';
import { abilityModifier, proficiencyBonus } from './abilities';
import type { Breakdown } from './breakdown';
import { exhaustionLevelOf, withExhaustion } from './conditions';
import { allClasses, entrySubclass, primaryClass, resolveClass } from './classes';
import { extraCantripLabel, extraCantrips } from './class-choice-effects';
import { effectiveAbilityScores } from './feats';
import { getSpell } from '../data/spells';
import type { SpellId } from '../data/spells';
import {
  CANTRIPS_KNOWN,
  FULL_CASTER_SLOTS,
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
    if (primaryClass(character)?.subclassId !== descriptor.subclassId) return false;
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
  const mod = abilityModifier(effectiveAbilityScores(character)[ability]);
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
  const mod = abilityModifier(effectiveAbilityScores(character)[ability]);
  // A spell attack roll is a D20 Test: Exhaustion (PHB 2024 L21024) is its own component.
  return withExhaustion(
    {
      total: pb + mod,
      components: [
        { label: 'Proficiency', value: pb },
        { label: `${ABILITY_NAMES[ability]} mod`, value: mod },
      ],
    },
    exhaustionLevelOf(character),
  );
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
  return (table?.[character.level] ?? 0) + extraCantrips(character, cls.id);
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
  const base = table?.[character.level] ?? 0;
  const extra = extraCantrips(character, cls.id);
  const components = [{ label: `${cls.name} level ${character.level} (Cantrips)`, value: base }];
  if (extra !== 0) components.push({ label: extraCantripLabel(character, cls.id) ?? 'Class feature choice', value: extra });
  return { total: base + extra, components };
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
  if (primaryClass(character)?.subclassId === 'arcaneTrickster' && getSpell('mage-hand')) {
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
/**
 * [spellId, grantedAtLevel] pairs per class for the always-prepared feature
 * spells (see {@link alwaysPreparedSpells} for the per-feature citations).
 */
const ALWAYS_PREPARED_GRANTS: Record<string, Array<[SpellId, number]>> = {
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

export function alwaysPreparedSpells(character: Character): SpellId[] {
  if (!isSpellcaster(character)) return [];
  const primary = primaryClass(character);
  if (!primary) return [];
  // The primary class entry at the TOTAL character level — single-class keeps
  // the pre-M5 behaviour exactly (entry.level === character.level).
  return classAlwaysPreparedSpells({ ...primary, level: character.level });
}

/**
 * Per-class analogue of {@link alwaysPreparedSpells}: the leveled spells a given
 * class entry's features make ALWAYS prepared at ITS OWN class level, or [] when
 * none. PHB 2024 "Multiclassing: Spellcasting" (L2119) — each class prepares as
 * a single-classed member of itself, so its always-prepared grants are gated at
 * its own class level. These do NOT count against that class's Prepared Spells
 * number (per-class spellcasting text) and are rendered locked.
 */
export function classAlwaysPreparedSpells(entry: ClassEntry): SpellId[] {
  if (!entryIsSpellcaster(entry)) return [];
  const forClass = ALWAYS_PREPARED_GRANTS[entry.id] ?? [];
  const ids: SpellId[] = [];
  for (const [id, grantedAt] of forClass) {
    if (entry.level >= grantedAt && getSpell(id)) ids.push(id);
  }
  // Subclass-granted always-prepared spells (domain / oath / circle / patron
  // lists): read from the structured `grantedSpells` of the chosen subclass's
  // features, gated at this entry's own class level. Unknown catalog ids are
  // skipped (getSpell guard), duplicates are dropped.
  for (const feature of entrySubclass(entry)?.features ?? []) {
    for (const grant of feature.grantedSpells ?? []) {
      if (!grant.alwaysPrepared || entry.level < grant.level) continue;
      for (const spellId of grant.spells) {
        const id = spellId as SpellId;
        if (getSpell(id) && !ids.includes(id)) ids.push(id);
      }
    }
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
  prev: ClassEntry | undefined,
  next: ClassEntry | undefined,
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

  const next: SpellcastingState = { ...sc };

  // Reconcile EACH class's stored selections under byClass against THAT class's
  // own caps and legal spell lists (PHB 2024 "Multiclassing: Spellcasting",
  // L2119: each class prepares as a single-classed member of itself). For a
  // single-class character byClass has exactly one key = the primary class id,
  // so this loops once and the output is byte-identical to the pre-M3 behaviour.
  // A stored class id that is no longer on the character's classes[] is dropped
  // entirely (its selections belong to a class the character no longer has).
  if (sc.byClass) {
    const entriesById = new Map(allClasses(character).map((e) => [e.id, e] as const));
    const nextByClass: NonNullable<SpellcastingState['byClass']> = {};
    for (const [classId, perClass] of Object.entries(sc.byClass)) {
      const entry = entriesById.get(classId as ClassId);
      if (!entry || !perClass) continue; // class no longer present → drop.
      const reconciled = reconcilePerClass(entry, perClass, extraCantrips(character, entry.id));
      if (Object.keys(reconciled).length > 0) nextByClass[classId as ClassId] = reconciled;
    }
    if (Object.keys(nextByClass).length > 0) next.byClass = nextByClass;
    else delete next.byClass;
  }

  // Clamp expended standard slots to the new per-level maxima. The maxima are
  // the EFFECTIVE Spellcasting slots (combined table for 2+ Spellcasting
  // classes, else the lone class's own table) — a shared pool across all
  // Spellcasting classes (PHB 2024 L2162). For a single-class caster this equals
  // the old spellSlots(character) exactly.
  if (sc.slotsExpended) {
    const slots = effectiveSpellSlots(character);
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

  // Clamp expended Pact Magic slots to the new maximum (the Warlock entry's own
  // level — the Pact Magic pool is separate from the combined Spellcasting
  // slots, PHB 2024 "Warlock: Pact Magic").
  if (sc.pactSlotsExpended !== undefined) {
    const pactMax = pactMagicSlotsForClass(character)?.slots ?? 0;
    const value = Math.max(0, Math.min(pactMax, sc.pactSlotsExpended));
    if (value > 0) next.pactSlotsExpended = value;
    else delete next.pactSlotsExpended;
  }

  // Drop Mystic Arcanum choices (and their expended flags) for arcanum levels
  // the character no longer has access to, and any choice that is no longer a
  // legal Warlock spell of the matching level (PHB 2024 "Warlock: Mystic
  // Arcanum" — one Warlock spell per granted arcanum level).
  // Mystic Arcanum levels come from the WARLOCK entry's own level (PHB 2024
  // "Warlock: Mystic Arcanum", levels 11/13/15/17) — keyed to the Warlock class
  // level, which may not be the primary class in a multiclass character. For a
  // single-class Warlock this equals mysticArcanumLevels(character) exactly.
  const warlockLevel = allClasses(character).find((e) => e.id === 'warlock')?.level ?? 0;
  const arcanumLevels = new Set(MYSTIC_ARCANUM_LEVELS[warlockLevel] ?? []);
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

// ───────────────────────────────────────────────────────────────────────────
// MULTICLASS SPELLCASTING (Stage M3)
//
// PHB 2024 "Multiclassing: Spellcasting" (~p.37, Docs/PlayersHandbook.md
// L2119-2165): "Your capacity for spellcasting depends partly on your combined
// levels in all your spellcasting classes and partly on your individual levels
// in those classes. Once you have the Spellcasting feature from more than one
// class, use the rules below. If you multiclass but have the Spellcasting
// feature from only one class, follow the rules for that class."
//
// Design per .agents/tasks/investigate-multiclassing-design/report.md §4. The
// combined Multiclass Spellcaster slot table IS the full-caster grid, held
// verbatim as FULL_CASTER_SLOTS (reused here, no second copy). The PHB's own
// OCR of the table (L2128-2155) is mangled; FULL_CASTER_SLOTS is the RAW table.
// ───────────────────────────────────────────────────────────────────────────

/**
 * The spellcasting descriptor for a single class entry, or undefined when the
 * class is not a caster. Per-class analogue of {@link descriptorFor}.
 */
function descriptorForEntry(entry: ClassEntry): SpellcastingDescriptor | undefined {
  return SPELLCASTING_DESCRIPTORS[entry.id as keyof typeof SPELLCASTING_DESCRIPTORS];
}

/**
 * Whether a single class entry has an ACTIVE casting feature (Spellcasting OR
 * Pact Magic) at its own class level. Per-class analogue of {@link isSpellcaster}
 * (which gates on the primary class). A subclass caster (Eldritch Knight /
 * Arcane Trickster) is active only once it has the casting subclass AND has
 * reached the subclass's casting level (3 in 2024); base-class casters cast
 * from level 1 (PHB 2024 "Eldritch Knight" ~p.52 / "Arcane Trickster" ~p.123).
 */
export function entryIsSpellcaster(entry: ClassEntry): boolean {
  const descriptor = descriptorForEntry(entry);
  if (!descriptor) return false;
  if (descriptor.subclassCastingLevel !== undefined) {
    if (entry.subclassId !== descriptor.subclassId) return false;
    return entry.level >= descriptor.subclassCastingLevel;
  }
  return true;
}

/**
 * The class entries that have an ACTIVE "Spellcasting" feature (full/half/third
 * kinds), EXCLUDING Warlock Pact Magic — PHB 2024 "Multiclassing: Spellcasting"
 * treats Pact Magic as a separate feature, so it is never counted as "a class
 * whose Spellcasting feature you have" for the combined table / single-vs-
 * combined decision (L2119, "Pact Magic" paragraph L2165). Used to decide
 * whether the combined multiclass slot table applies ({@link effectiveSpellSlots}).
 */
export function spellcastingClasses(character: Character): ClassEntry[] {
  return allClasses(character).filter((entry) => {
    const descriptor = descriptorForEntry(entry);
    return descriptor !== undefined && descriptor.kind !== 'pact' && entryIsSpellcaster(entry);
  });
}

/**
 * Whether ANY of the character's classes is an active caster — Spellcasting
 * (full/half/third) OR Warlock Pact Magic (PHB 2024 "Multiclassing"). Unlike
 * {@link isSpellcaster} (which gates on the PRIMARY class only), this is true
 * for a multiclass build whose caster is a non-initial class (e.g. a Fighter
 * 5 / Wizard 3), so the Spells surfaces render for every spellcasting
 * multiclass. For a single-class / primary-caster character this returns the
 * same value as {@link isSpellcaster} (identical gating), so single-class
 * behaviour is unchanged.
 */
export function anySpellcaster(character: Character): boolean {
  return allClasses(character).some((entry) => entryIsSpellcaster(entry));
}

/**
 * The combined spellcaster level used to index the Multiclass Spellcaster slot
 * table (PHB 2024 "Multiclassing: Spellcasting: Spell Slots", L2156-2163):
 *   + all levels in FULL casters (Bard/Cleric/Druid/Sorcerer/Wizard);
 *   + half your levels ROUNDED UP in Paladin and Ranger — per class;
 *   + one third of your Fighter/Rogue levels ROUNDED DOWN, only with the
 *     Eldritch Knight / Arcane Trickster subclass (and only once its casting
 *     level is reached) — per class;
 *   - Warlock Pact Magic levels are EXCLUDED.
 * Rounding is applied PER CLASS before summing (RAW). A non-EK/AT Fighter/Rogue,
 * and any non-caster class, contributes 0.
 */
export function combinedCasterLevel(character: Character): number {
  let total = 0;
  for (const entry of allClasses(character)) {
    const descriptor = descriptorForEntry(entry);
    if (!descriptor) continue;
    switch (descriptor.kind) {
      case 'full':
        total += entry.level;
        break;
      case 'half':
        // PHB L2160: half your Paladin/Ranger levels, rounded UP, per class.
        total += Math.ceil(entry.level / 2);
        break;
      case 'third':
        // PHB L2161: one third of Fighter/Rogue levels, rounded DOWN, only with
        // the Eldritch Knight / Arcane Trickster subclass active (its casting
        // level reached). entryIsSpellcaster gates the subclass + casting level.
        if (entryIsSpellcaster(entry)) total += Math.floor(entry.level / 3);
        break;
      case 'pact':
        // PHB L2156-2163: Warlock Pact Magic levels are excluded from the sum.
        break;
    }
  }
  return total;
}

/**
 * The combined Multiclass Spellcaster leveled slot vector (1-indexed by spell
 * level, index 0 unused): FULL_CASTER_SLOTS[combinedCasterLevel]. PHB 2024
 * L2162 — "look up this total level in the Level column of the Multiclass
 * Spellcaster table". The table equals the full-caster grid (FULL_CASTER_SLOTS).
 * Does NOT include Warlock Pact Magic slots (tracked separately via
 * {@link pactMagicSlots}). Returns undefined when the combined level is 0.
 */
export function multiclassSpellSlots(character: Character): SlotVector | undefined {
  const level = combinedCasterLevel(character);
  if (level <= 0) return undefined;
  return FULL_CASTER_SLOTS[level];
}

/**
 * Whether the combined Multiclass Spellcaster table applies: true only when 2+
 * classes have an ACTIVE Spellcasting feature (Pact Magic excluded). With
 * exactly one Spellcasting class, PHB 2024 L2122 says to follow that class's own
 * rules (its single-class table at its class level).
 */
export function isCombinedSpellcaster(character: Character): boolean {
  return spellcastingClasses(character).length >= 2;
}

/**
 * The effective leveled Spellcasting slot vector for the character (1-indexed by
 * spell level, index 0 unused), honouring the single-vs-combined rule (PHB 2024
 * "Multiclassing: Spellcasting", L2119-2163):
 *   - 2+ Spellcasting classes → the combined table at the combined caster level
 *     (FULL_CASTER_SLOTS[combinedCasterLevel]);
 *   - exactly 1 Spellcasting class → THAT class's own single-class table at its
 *     own class level (slotTableForKind(kind)[classLevel]);
 *   - 0 Spellcasting classes → undefined.
 * Warlock Pact Magic slots are ALWAYS separate (see {@link pactMagicSlots}) and
 * are never reflected here. For a single-class caster this equals the old
 * {@link spellSlots} exactly (one Spellcasting class → its own table).
 */
export function effectiveSpellSlots(character: Character): SlotVector | undefined {
  const casters = spellcastingClasses(character);
  if (casters.length === 0) return undefined;
  if (casters.length >= 2) {
    // Combined table (PHB L2162): FULL_CASTER_SLOTS[combinedCasterLevel].
    return multiclassSpellSlots(character);
  }
  // Exactly one Spellcasting class (PHB L2122): its own table at its own level.
  const only = casters[0];
  const descriptor = descriptorForEntry(only);
  if (!descriptor) return undefined;
  const table = slotTableForKind(descriptor.kind);
  return table ? table[only.level] : undefined;
}

/**
 * The Warlock Pact Magic row for the character, drawn from the WARLOCK class
 * entry's own level (PHB 2024 "Warlock: Pact Magic" ~p.154), or undefined when
 * the character has no Warlock levels. Multiclass-aware replacement for the
 * primary-class {@link pactMagicSlots}: the Pact Magic pool is separate from the
 * combined Spellcasting slots and keyed to the Warlock class level specifically.
 */
export function pactMagicSlotsForClass(character: Character): PactMagicRow | undefined {
  const warlock = allClasses(character).find((e) => e.id === 'warlock');
  if (!warlock) return undefined;
  return PACT_MAGIC[warlock.level];
}

// ── Per-class resolvers (DC / attack / cantrips / prepared / max level) ──────
// PHB 2024 "Multiclassing: Spellcasting: Spells Prepared" (L2119): prepared
// spells are determined per class as a single-classed member of that class;
// each prepared spell uses that class's spellcasting ability. So save DC /
// attack are PER CLASS. The Proficiency Bonus is by TOTAL character level
// (unchanged — character.level is the stored total). The cantrip/prepared COUNTS
// use each class's own progression at its own class level; cantrip SCALING
// (damage dice) uses total level (L2127), which is unchanged.

/**
 * The spellcasting ability for a given class entry, or undefined when the class
 * is not an active caster. Per-class analogue of {@link spellcastingAbility}.
 * Includes Warlock (Pact Magic still has a spellcasting ability / DC).
 */
export function classSpellcastingAbility(entry: ClassEntry): Ability | undefined {
  if (!entryIsSpellcaster(entry)) return undefined;
  return descriptorForEntry(entry)?.ability;
}

/**
 * Per-class spell save DC breakdown: 8 + Proficiency Bonus (TOTAL level) +
 * modifier of THAT class's spellcasting ability (PHB 2024 L2119). Returns
 * undefined when the class is not an active caster. The components sum to the
 * total (calculated-totals steering — the UI renders this as a tooltip).
 */
export function classSpellSaveDcBreakdown(
  character: Character,
  entry: ClassEntry,
): Breakdown | undefined {
  const ability = classSpellcastingAbility(entry);
  if (ability === undefined) return undefined;
  const pb = proficiencyBonus(character.level);
  const mod = abilityModifier(effectiveAbilityScores(character)[ability]);
  const className = getClass(entry.id)?.name ?? entry.id;
  return {
    total: 8 + pb + mod,
    components: [
      { label: 'Base', value: 8 },
      { label: 'Proficiency', value: pb },
      { label: `${className} ${ABILITY_NAMES[ability]} mod`, value: mod },
    ],
  };
}

/**
 * Per-class spell attack bonus breakdown: Proficiency Bonus (TOTAL level) +
 * modifier of THAT class's spellcasting ability (PHB 2024 L2119). Returns
 * undefined when the class is not an active caster.
 */
export function classSpellAttackBreakdown(
  character: Character,
  entry: ClassEntry,
): Breakdown | undefined {
  const ability = classSpellcastingAbility(entry);
  if (ability === undefined) return undefined;
  const pb = proficiencyBonus(character.level);
  const mod = abilityModifier(effectiveAbilityScores(character)[ability]);
  const className = getClass(entry.id)?.name ?? entry.id;
  // A spell attack roll is a D20 Test: Exhaustion (PHB 2024 L21024) is its own component.
  return withExhaustion(
    {
      total: pb + mod,
      components: [
        { label: 'Proficiency', value: pb },
        { label: `${className} ${ABILITY_NAMES[ability]} mod`, value: mod },
      ],
    },
    exhaustionLevelOf(character),
  );
}

/**
 * The number of cantrips a given class knows at ITS OWN class level, or 0 when
 * the class has no cantrips (Paladin/Ranger) or is not an active caster (PHB
 * 2024 per-class "Cantrips" column). The count is per class; cantrip SCALING is
 * by total level (unchanged, L2127).
 */
export function classCantripsKnown(entry: ClassEntry, bonus = 0): number {
  if (!entryIsSpellcaster(entry)) return 0;
  const table = CANTRIPS_KNOWN[entry.id as keyof typeof CANTRIPS_KNOWN];
  return (table?.[entry.level] ?? 0) + bonus;
}

/**
 * The number of leveled spells a given class can prepare at ITS OWN class level,
 * or 0 when the class is not an active caster (PHB 2024 per-class "Prepared
 * Spells" column; prepared per class as a single-classed member — L2119).
 */
export function classPreparedCount(entry: ClassEntry): number {
  if (!entryIsSpellcaster(entry)) return 0;
  const table = PREPARED_COUNT[entry.id as keyof typeof PREPARED_COUNT];
  return table?.[entry.level] ?? 0;
}

/**
 * Per-class analogue of {@link cantripsKnownBreakdown}: a breakdown for the
 * cantrips-known cap of a given class entry at ITS OWN class level (a direct
 * table lookup). Returns undefined when the entry is not an active caster. A
 * zero total (Paladin/Ranger have no cantrips) still returns a breakdown so the
 * cap can show a tooltip (calculated-totals steering).
 */
export function classCantripsKnownBreakdown(
  entry: ClassEntry,
  bonus?: { label: string; value: number },
): Breakdown | undefined {
  if (!entryIsSpellcaster(entry)) return undefined;
  const className = getClass(entry.id)?.name ?? entry.id;
  const table = CANTRIPS_KNOWN[entry.id as keyof typeof CANTRIPS_KNOWN];
  const base = table?.[entry.level] ?? 0;
  const components = [{ label: `${className} level ${entry.level} (Cantrips)`, value: base }];
  if (bonus && bonus.value !== 0) components.push({ label: bonus.label, value: bonus.value });
  return { total: base + (bonus?.value ?? 0), components };
}

/**
 * Per-class analogue of {@link preparedCountBreakdown}: a breakdown for the
 * prepared-spells cap of a given class entry at ITS OWN class level (a direct
 * table lookup). Returns undefined when the entry is not an active caster or has
 * no prepared spells at its level.
 */
export function classPreparedCountBreakdown(entry: ClassEntry): Breakdown | undefined {
  if (!entryIsSpellcaster(entry)) return undefined;
  const className = getClass(entry.id)?.name ?? entry.id;
  const table = PREPARED_COUNT[entry.id as keyof typeof PREPARED_COUNT];
  const total = table?.[entry.level] ?? 0;
  if (total <= 0) return undefined;
  return {
    total,
    components: [{ label: `${className} level ${entry.level} (Prepared Spells)`, value: total }],
  };
}

/**
 * Whether a given class entry prepares from a spellbook (Wizard only, PHB 2024
 * "Wizard: Spellcasting"). Per-class analogue of the primary-class descriptor's
 * `usesSpellbook`. Subclass casters (Eldritch Knight / Arcane Trickster) draw
 * from the Wizard LIST but do not use a spellbook.
 */
export function classUsesSpellbook(entry: ClassEntry): boolean {
  return descriptorForEntry(entry)?.usesSpellbook ?? false;
}

/**
 * The focus option labels for a given class entry, or [] for a non-caster.
 * Per-class analogue of {@link spellcastingFocusOptions}.
 */
export function classSpellcastingFocusOptions(entry: ClassEntry): string[] {
  if (!entryIsSpellcaster(entry)) return [];
  // PHB 2024: focus named in each class's Spellcasting focus text (same table
  // as spellcastingFocusOptions, keyed per class).
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
  return byClass[entry.id] ?? [];
}

/**
 * The highest spell level a given class can PREPARE at its own class level
 * (1-9), or 0 when it cannot prepare leveled spells. PHB 2024 L2119: each class
 * prepares as a single-classed member of that class, so its prepared-spell level
 * ceiling comes from its OWN single-class table at its OWN level (NOT the
 * combined slots, which may be higher — those higher slots can only cast the
 * lower-level spells you actually prepared, L2163). For a Warlock this is the
 * Pact Magic slot level.
 */
export function classMaxPreparedLevel(entry: ClassEntry): number {
  if (!entryIsSpellcaster(entry)) return 0;
  const descriptor = descriptorForEntry(entry);
  if (!descriptor) return 0;
  if (descriptor.kind === 'pact') {
    return PACT_MAGIC[entry.level]?.slotLevel ?? 0;
  }
  const table = slotTableForKind(descriptor.kind);
  const slots = table?.[entry.level];
  if (!slots) return 0;
  let max = 0;
  for (let level = 1; level < slots.length; level++) {
    if ((slots[level] ?? 0) > 0) max = level;
  }
  return max;
}

/**
 * One per-class spellcasting summary entry for display: the class, its ability,
 * and its save DC / attack breakdowns. Produced for every ACTIVE caster class
 * (including Warlock, whose DC/attack still derive from 8 + PB + Cha mod even
 * though its slots are Pact Magic). This is the per-class data the M5 display
 * reshape will render; M3 only computes it (decision 9-E — display deferred).
 */
export interface ClassSpellcastingSummary {
  classId: ClassId;
  className: string;
  ability: Ability;
  saveDc: Breakdown;
  attack: Breakdown;
  cantripsKnown: number;
  preparedCount: number;
  maxPreparedLevel: number;
}

/**
 * The per-class spellcasting summaries for every ACTIVE caster class (full/half/
 * third AND Warlock pact), in stored class order. Empty for a non-caster. Each
 * carries that class's ability, save DC, attack, and per-class counts (PHB 2024
 * "Multiclassing: Spellcasting", L2119). The combined/single leveled slot vector
 * is obtained separately via {@link effectiveSpellSlots}; Pact Magic via
 * {@link pactMagicSlotsForClass}.
 */
/**
 * The primary class id whose spell list a given class entry draws leveled spells
 * from. Per-class analogue of {@link spellListClassId}: a subclass caster
 * (Eldritch Knight / Arcane Trickster) prepares from the Wizard list (PHB 2024);
 * otherwise the class's own list. Undefined when the entry is not a caster.
 */
export function classSpellListClassId(entry: ClassEntry): string | undefined {
  if (!entryIsSpellcaster(entry)) return undefined;
  const descriptor = descriptorForEntry(entry);
  return descriptor?.spellListClassId ?? entry.id;
}

/**
 * Every leveled-spell list a given class entry may prepare from. Per-class
 * analogue of {@link spellListClassIds}: a level-10+ Bard gains Magical Secrets
 * (Bard/Cleric/Druid/Wizard union — PHB 2024 "Bard: Magical Secrets"); every
 * other caster uses its primary list. [] when the entry is not a caster.
 */
export function classSpellListClassIds(entry: ClassEntry): string[] {
  const primary = classSpellListClassId(entry);
  if (primary === undefined) return [];
  if (entry.id === 'bard' && entry.level >= 10) {
    return ['bard', 'cleric', 'druid', 'wizard'];
  }
  return [primary];
}

/**
 * The list a given class entry draws CANTRIPS from. Per-class analogue of
 * {@link cantripListClassIds}: NOT widened by Bard Magical Secrets (cantrips stay
 * the class's own list). [] when the entry is not a caster.
 */
export function classCantripListClassIds(entry: ClassEntry): string[] {
  const primary = classSpellListClassId(entry);
  return primary === undefined ? [] : [primary];
}

/**
 * Cantrip ids a given class entry is REQUIRED to know (Arcane Trickster's Mage
 * Hand — PHB 2024 ~p.123). Per-class analogue of {@link requiredCantrips}.
 */
export function classRequiredCantrips(entry: ClassEntry): SpellId[] {
  if (!entryIsSpellcaster(entry)) return [];
  if (entry.subclassId === 'arcaneTrickster' && getSpell('mage-hand')) {
    return ['mage-hand'];
  }
  return [];
}

/**
 * Reconciles ONE class's stored selections (cantrips/prepared/spellbook) against
 * that class's current caps and legal spell lists, returning the pruned bucket
 * (possibly empty). Pure per-class analogue of the primary-class pruning that
 * {@link reconcileSpellcastingForLevel} applied pre-M3 — each class prepares as a
 * single-classed member of that class (PHB 2024 "Multiclassing: Spellcasting",
 * L2119), so its caps and lists come from its OWN class level, not the combined
 * level.
 */
function reconcilePerClass(
  entry: ClassEntry,
  perClass: ClassSpellcasting,
  cantripBonus = 0,
): ClassSpellcasting {
  const topLevel = classMaxPreparedLevel(entry);
  const cantripCap = classCantripsKnown(entry, cantripBonus);
  const preparedCap = classPreparedCount(entry);
  const required = classRequiredCantrips(entry);
  const preparedLists = new Set(classSpellListClassIds(entry));
  const cantripLists = new Set(classCantripListClassIds(entry));
  const next: ClassSpellcasting = {};

  const onLists = (id: SpellId, lists: Set<string>): boolean => {
    const spell = getSpell(id);
    return spell !== undefined && spell.classes.some((c) => lists.has(c));
  };
  const legalLeveled = (id: SpellId, lists: Set<string>): boolean => {
    const spell = getSpell(id);
    return (
      spell !== undefined && spell.level >= 1 && spell.level <= topLevel && onLists(id, lists)
    );
  };

  if (perClass.prepared) {
    const pruned = perClass.prepared.filter((id) => legalLeveled(id, preparedLists));
    const capped = preparedCap > 0 ? pruned.slice(0, preparedCap) : [];
    if (capped.length > 0) next.prepared = capped;
  }
  if (perClass.spellbook) {
    const pruned = perClass.spellbook.filter((id) => legalLeveled(id, preparedLists));
    if (pruned.length > 0) next.spellbook = pruned;
  }
  if (perClass.cantrips) {
    const legalCantrips = perClass.cantrips.filter(
      (id) => required.includes(id) || onLists(id, cantripLists),
    );
    const requiredKept = legalCantrips.filter((id) => required.includes(id));
    const optional = legalCantrips.filter((id) => !required.includes(id));
    const room = Math.max(0, cantripCap - requiredKept.length);
    const kept = [...requiredKept, ...optional.slice(0, room)];
    if (kept.length > 0) next.cantrips = kept;
  }
  return next;
}

export function perClassSpellcasting(character: Character): ClassSpellcastingSummary[] {
  const summaries: ClassSpellcastingSummary[] = [];
  for (const entry of allClasses(character)) {
    if (!entryIsSpellcaster(entry)) continue;
    const ability = classSpellcastingAbility(entry);
    const saveDc = classSpellSaveDcBreakdown(character, entry);
    const attack = classSpellAttackBreakdown(character, entry);
    if (ability === undefined || saveDc === undefined || attack === undefined) continue;
    summaries.push({
      classId: entry.id,
      className: getClass(entry.id)?.name ?? entry.id,
      ability,
      saveDc,
      attack,
      cantripsKnown: classCantripsKnown(entry, extraCantrips(character, entry.id)),
      preparedCount: classPreparedCount(entry),
      maxPreparedLevel: classMaxPreparedLevel(entry),
    });
  }
  return summaries;
}

// ───────────────────────────────────────────────────────────────────────────
// CROSS-POOL CASTING (Stage M5)
//
// PHB 2024 "Pact Magic" multiclass paragraph (Docs/PlayersHandbook.md L2168):
//   "If you have the Pact Magic feature and the Spellcasting feature, you can
//    use the spell slots you gain from Pact Magic to cast spells you have
//    prepared from classes with the Spellcasting feature, and you can use the
//    spell slots you gain from the Spellcasting feature to cast Warlock spells
//    you have prepared."
//
// So when BOTH pools exist, they are INTERCHANGEABLE FOR CASTING: a prepared
// spell of level L is castable iff EITHER pool has an UNEXPENDED slot of level
// >= L. The pools are still tracked / recovered separately (Pact Magic on a
// Short or Long Rest, Spellcasting on a Long Rest — M3); this rule is only
// about which slots may cast which prepared spells. When the character has only
// ONE of the two pools, casting uses that pool as normal (no cross-pool).
// ───────────────────────────────────────────────────────────────────────────

/**
 * The highest level with an AVAILABLE (unexpended) slot in an available-slot
 * vector (1-indexed by spell level, index 0 unused), or 0 when none. Pure core
 * of {@link highestCastableSpellLevel} for the Spellcasting pool.
 */
function highestAvailableLevel(available: SlotVector | undefined): number {
  if (!available) return 0;
  let max = 0;
  for (let level = 1; level < available.length; level++) {
    if ((available[level] ?? 0) > 0) max = level;
  }
  return max;
}

/**
 * CROSS-POOL CORE (pure). The highest spell level castable given the two pools'
 * AVAILABLE (unexpended) slots (PHB 2024 L2168): the Spellcasting pool as a
 * per-level available-slot vector, and the Pact Magic pool as (level, count).
 * The highest castable level is the max available slot level across BOTH pools.
 * A pool contributes nothing when it is absent or fully expended. Exposed so
 * the golden table can exercise it with abstract pool inputs.
 */
export function highestCastableLevelFromPools(
  spellcastingAvailable: SlotVector | undefined,
  pact: { slotLevel: number; available: number } | undefined,
): number {
  const fromSpellcasting = highestAvailableLevel(spellcastingAvailable);
  const fromPact = pact && pact.available > 0 ? pact.slotLevel : 0;
  return Math.max(fromSpellcasting, fromPact);
}

/**
 * CROSS-POOL CORE (pure). Whether a prepared spell of `spellLevel` is castable
 * given the two pools' available slots (PHB 2024 L2168). A cantrip (level 0) is
 * always castable (no slot). A leveled spell is castable iff some unexpended
 * slot of level >= `spellLevel` exists in EITHER pool. Exposed for the golden.
 */
export function canCastFromPools(
  spellLevel: number,
  spellcastingAvailable: SlotVector | undefined,
  pact: { slotLevel: number; available: number } | undefined,
): boolean {
  if (spellLevel <= 0) return true; // Cantrips use no slot.
  return highestCastableLevelFromPools(spellcastingAvailable, pact) >= spellLevel;
}

/**
 * The character's AVAILABLE (unexpended) Spellcasting slots as a per-level
 * vector: {@link effectiveSpellSlots} maxima minus the pooled `slotsExpended`.
 * undefined for a non-Spellcasting character. The combined/single routing is
 * M3's; this only subtracts expenditure.
 */
function availableSpellcastingSlots(character: Character): SlotVector | undefined {
  const slots = effectiveSpellSlots(character);
  if (!slots) return undefined;
  const expended = character.spellcasting?.slotsExpended ?? {};
  return slots.map((max, level) => Math.max(0, (max ?? 0) - (expended[level] ?? 0)));
}

/**
 * The character's AVAILABLE Pact Magic pool as (slotLevel, available), or
 * undefined when the character has no Warlock levels. Composes
 * {@link pactMagicSlotsForClass} with the pooled `pactSlotsExpended`.
 */
function availablePactPool(
  character: Character,
): { slotLevel: number; available: number } | undefined {
  const pact = pactMagicSlotsForClass(character);
  if (!pact || pact.slots <= 0) return undefined;
  const expended = character.spellcasting?.pactSlotsExpended ?? 0;
  return { slotLevel: pact.slotLevel, available: Math.max(0, pact.slots - expended) };
}

/**
 * The highest spell level the character can currently cast using EITHER pool
 * (PHB 2024 L2168), 1-9, or 0 when no unexpended slot remains. When both the
 * Spellcasting pool and the Pact Magic pool exist, it is the max available
 * (unexpended) slot level ACROSS BOTH pools (cross-pool). With a single pool it
 * is that pool's top available level; with neither it is 0.
 *
 * For a single-class (single-pool) caster this equals the sole pool's top
 * available level — identical to the pre-M5 single-pool behaviour.
 */
export function highestCastableSpellLevel(character: Character): number {
  return highestCastableLevelFromPools(
    availableSpellcastingSlots(character),
    availablePactPool(character),
  );
}

/**
 * Whether a prepared spell of `spellLevel` is castable RIGHT NOW (PHB 2024
 * L2168). A cantrip (level 0) is always castable (it uses no slot). A leveled
 * spell is castable iff some UNEXPENDED slot of level >= `spellLevel` exists in
 * EITHER pool — when both pools exist a pact slot may cast a prepared
 * Spellcasting spell and vice versa (cross-pool). With a single pool the check
 * is against that pool only (no behaviour change for a single-class caster).
 */
export function canCastPreparedSpell(character: Character, spellLevel: number): boolean {
  return canCastFromPools(
    spellLevel,
    availableSpellcastingSlots(character),
    availablePactPool(character),
  );
}
