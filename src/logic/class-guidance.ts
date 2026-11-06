/**
 * Class guidance (D&D 5.5e / 2024) — a DETERMINISTIC, READ-ONLY advisor for the
 * character-creation wizard.
 *
 * These pure functions surface what matters for a chosen class during creation:
 * a class overview (primary ability / saves / hit die / spellcasting ability),
 * per-ability placement hints, the PHB "Standard Array by Class" recommended
 * placement, and background-fit hints. They invent NO mechanics — every value
 * comes from an existing class-data field (src/data/classes.ts /
 * src/data/spell-progression.ts) or a transcribed PHB table (cited below).
 *
 * SUGGEST, DON'T AUTO-APPLY: nothing here mutates a character. The only state
 * change the feature makes is the opt-in "Use recommended array" button in the
 * wizard, which copies `recommendedArray()` into the existing abilities field
 * on an explicit tap. These functions are side-effect-free.
 *
 * Every function tolerates an unknown/empty classId (returns undefined/[] and
 * never throws), matching the tolerant resolvers in src/logic/classes.ts.
 *
 * SOURCES (PHB 2024, Docs/PlayersHandbook.md):
 *  - Standard Array by Class (L1701-1716): per-class placement of the standard
 *    array 15/14/13/12/10/8 — RECOMMENDED_PLACEMENTS below.
 *  - Ability Scores and Backgrounds (L1583-1589): ability → backgrounds —
 *    ABILITY_BACKGROUNDS below.
 *  - Class facts (primaryAbilities / savingThrows / hitDie): Core <Class>
 *    Traits, read from src/data/classes.ts.
 *  - Spellcasting ability: SPELLCASTING_DESCRIPTORS (src/data/spell-progression.ts);
 *    null for a non-caster BASE class (Barbarian/Fighter/Monk/Rogue — EK/AT are
 *    subclass-only, so the base class advertises no spellcasting at creation).
 */

import type { Ability } from '../types/character';
import { getClass } from '../data/classes';
import { SPELLCASTING_DESCRIPTORS } from '../data/spell-progression';

/**
 * PHB 2024 "Standard Array by Class" (Docs/PlayersHandbook.md L1701-1716): the
 * suggested placement of the standard array (15/14/13/12/10/8) for each class.
 * Each row is a permutation of the standard array. (OCR note: Fighter's Wis
 * prints as "lO" = 10.) Transcribed verbatim (numeric values only) and pinned
 * here so `recommendedArray()` is a pure lookup — the class-guidance golden
 * (class-guidance-golden.ts, RECOMMENDED_ARRAY_CASES) verifies every row.
 */
const RECOMMENDED_PLACEMENTS: Record<string, Record<Ability, number>> = {
  barbarian: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
  bard: { str: 8, dex: 14, con: 12, int: 13, wis: 10, cha: 15 },
  cleric: { str: 14, dex: 8, con: 13, int: 10, wis: 15, cha: 12 },
  druid: { str: 8, dex: 12, con: 14, int: 13, wis: 15, cha: 10 },
  fighter: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 },
  monk: { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 },
  paladin: { str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 },
  ranger: { str: 12, dex: 15, con: 13, int: 8, wis: 14, cha: 10 },
  rogue: { str: 12, dex: 15, con: 13, int: 14, wis: 10, cha: 8 },
  sorcerer: { str: 10, dex: 13, con: 14, int: 8, wis: 12, cha: 15 },
  warlock: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 },
  wizard: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 },
};

/**
 * PHB 2024 "Ability Scores and Backgrounds" (Docs/PlayersHandbook.md
 * L1583-1589): which backgrounds boost each ability. Background ids are the
 * real catalog keys (src/data/backgrounds.ts). Transcribed verbatim (ids only)
 * and used by `suggestedBackgrounds()`; the class-guidance golden
 * (BACKGROUND_FIT_CASES) verifies every per-class union.
 */
const ABILITY_BACKGROUNDS: Record<Ability, string[]> = {
  str: ['artisan', 'entertainer', 'farmer', 'guard', 'noble', 'sailor', 'soldier'],
  dex: ['artisan', 'charlatan', 'criminal', 'entertainer', 'guide', 'sailor', 'scribe', 'soldier', 'wayfarer'],
  con: ['charlatan', 'criminal', 'farmer', 'guide', 'hermit', 'merchant', 'sage', 'soldier'],
  int: ['acolyte', 'artisan', 'criminal', 'guard', 'merchant', 'noble', 'sage', 'scribe'],
  wis: ['acolyte', 'farmer', 'guard', 'guide', 'hermit', 'sage', 'sailor', 'scribe', 'wayfarer'],
  cha: ['acolyte', 'charlatan', 'entertainer', 'hermit', 'merchant', 'noble', 'wayfarer'],
};

/**
 * The PHB "Standard Array by Class" recommended placement for a class: the
 * suggested score for each ability. Returns undefined for an unknown/empty
 * classId (never throws). READ-ONLY — a fresh copy is returned so callers can
 * assign it to the character's abilities without aliasing the table.
 */
export function recommendedArray(
  classId: string | undefined,
): Record<Ability, number> | undefined {
  if (classId === undefined) return undefined;
  const placement = RECOMMENDED_PLACEMENTS[classId];
  return placement ? { ...placement } : undefined;
}

/** Short PHB-cited overview facts for a class, surfaced on the Class step. */
export interface ClassGuidance {
  /** Primary ability(ies) — PHB 2024 Core <Class> Traits (classes.ts). */
  primaryAbilities: Ability[];
  /**
   * True when the primary abilities are an EITHER/OR choice (join with "or"),
   * false when ALL are primary (join with "&"). Sourced from the explicit
   * `multiclassPrereq` shape (`any` = or, `all` = and) rather than guessing from
   * `primaryAbilities`, whose AND/OR semantics are ambiguous (classes.ts ~L139).
   * Fighter is the only OR class (Str or Dex); Monk/Paladin/Ranger are AND.
   */
  primaryIsOr: boolean;
  /** The two saving-throw proficiencies — Core <Class> Traits (classes.ts). */
  savingThrows: Ability[];
  /** Hit die face (durability signal) — Core <Class> Traits (classes.ts). */
  hitDie: number;
  /**
   * Base-class spellcasting ability, or null for a non-caster base class
   * (Barbarian/Fighter/Monk/Rogue — EK/AT are subclass-only). From
   * SPELLCASTING_DESCRIPTORS (spell-progression.ts).
   */
  spellcastingAbility: Ability | null;
  /** A brief, factual paraphrase of what the class is about (NOT verbatim). */
  blurb: string;
}

/**
 * Short, factual one-line paraphrases of each class's playstyle. These are the
 * implementer's own brief summaries (NOT transcribed PHB prose — rules-
 * compliance rule 5: paraphrase, no long verbatim); the mechanical facts beside
 * them (primary ability, saves, hit die, spellcasting) are read from the data.
 */
const CLASS_BLURBS: Record<string, string> = {
  barbarian: 'A ferocious front-line warrior who channels Rage for extra damage and durability.',
  bard: 'A versatile, Charisma-driven caster who inspires allies and dabbles in every art.',
  cleric: 'A divine caster who heals, protects, and calls on a deity for miracles.',
  druid: 'A nature caster who shapeshifts and commands the power of the wilds.',
  fighter: 'A master of weapons and armor, adaptable to any style of combat.',
  monk: 'A fast, unarmored martial artist who strikes with focused Ki.',
  paladin: 'A holy warrior who blends martial might with divine oaths and spells.',
  ranger: 'A wilderness hunter who tracks foes and casts nature magic.',
  rogue: 'A nimble skirmisher who relies on stealth, skills, and Sneak Attack.',
  sorcerer: 'An innate Charisma caster who bends raw magic with Metamagic.',
  warlock: 'A caster bound to an otherworldly patron, wielding Eldritch Invocations.',
  wizard: 'A scholarly Intelligence caster with the broadest spellbook of all.',
};

/**
 * The class overview facts the Class step shows, all read from existing data.
 * Returns undefined for an unknown/empty classId (never throws).
 *
 * `spellcastingAbility` is null for a BASE class that does not cast at level 1:
 * a class is only treated as a caster here when its SPELLCASTING_DESCRIPTORS
 * entry has NO `subclassCastingLevel` (Eldritch Knight / Arcane Trickster carry
 * one, so Fighter/Rogue — like Barbarian/Monk, which have no descriptor at all
 * — report null).
 */
export function classGuidance(classId: string | undefined): ClassGuidance | undefined {
  const data = getClass(classId);
  if (!data || classId === undefined) return undefined;
  const descriptor = SPELLCASTING_DESCRIPTORS[classId as keyof typeof SPELLCASTING_DESCRIPTORS];
  // Subclass-only casters (EK/AT) carry subclassCastingLevel; their BASE class
  // advertises no spellcasting ability at creation (golden: null).
  const spellcastingAbility: Ability | null =
    descriptor && descriptor.subclassCastingLevel === undefined ? descriptor.ability : null;
  return {
    primaryAbilities: [...data.primaryAbilities],
    // `any` present => either/or primaries (Fighter); otherwise ALL are primary.
    primaryIsOr: data.multiclassPrereq.any !== undefined,
    savingThrows: [...data.savingThrows],
    hitDie: data.hitDie,
    spellcastingAbility,
    blurb: CLASS_BLURBS[classId] ?? '',
  };
}

/** Per-ability placement tags for the Ability Scores step. */
export interface AbilityHints {
  /** The ability with the HIGHEST recommended score (put your best here). */
  primaryPlacement: Ability;
  /** The ability with the LOWEST recommended score (the safe dump). */
  dumpPlacement: Ability;
  /** The class's save-proficiency abilities (tagged 'save'). */
  saveAbilities: Ability[];
  /** The recommended score for each ability (the PHB array placement). */
  recommended: Record<Ability, number>;
}

const ABILITY_ORDER: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/**
 * Per-ability placement hints derived from `recommendedArray()` + the class's
 * save proficiencies. The primary placement is the ability with the max
 * recommended score; the dump is the min; the saves are the class saves.
 * Returns undefined for an unknown/empty classId (never throws).
 *
 * Ties in the array never occur (each row is a permutation of the standard
 * array, so all six scores are distinct), but the scan uses canonical ability
 * order as a stable tiebreak for safety.
 */
export function abilityHints(classId: string | undefined): AbilityHints | undefined {
  const recommended = recommendedArray(classId);
  const data = getClass(classId);
  if (!recommended || !data) return undefined;
  let primaryPlacement: Ability = ABILITY_ORDER[0];
  let dumpPlacement: Ability = ABILITY_ORDER[0];
  for (const ability of ABILITY_ORDER) {
    if (recommended[ability] > recommended[primaryPlacement]) primaryPlacement = ability;
    if (recommended[ability] < recommended[dumpPlacement]) dumpPlacement = ability;
  }
  return {
    primaryPlacement,
    dumpPlacement,
    saveAbilities: [...data.savingThrows],
    recommended,
  };
}

/**
 * The background ids that boost the class's primary ability — the PHB "Ability
 * Scores and Backgrounds" table filtered to the class's primary ability(ies).
 * For a paired primary (Fighter Str/Dex; Monk Dex/Wis; Paladin Str/Cha; Ranger
 * Dex/Wis) the result is the UNION across those abilities, first-seen order
 * preserved and de-duplicated. Returns [] for an unknown/empty classId (never
 * throws). Purely a nudge — the Origin step never restricts the pick.
 */
export function suggestedBackgrounds(classId: string | undefined): string[] {
  const data = getClass(classId);
  if (!data) return [];
  const result: string[] = [];
  for (const ability of data.primaryAbilities) {
    for (const id of ABILITY_BACKGROUNDS[ability]) {
      if (!result.includes(id)) result.push(id);
    }
  }
  return result;
}
