/**
 * GOLDEN TABLE for the CLASS GUIDANCE / creation-wizard recommendations feature.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md) + the shipped class data, BEFORE the guidance logic
 * is implemented. The implementer must make the real functions reproduce every
 * row and MUST NOT edit this file. If a row looks wrong, STOP and flag it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists.
 *
 * This feature is a DETERMINISTIC, READ-ONLY ADVISOR (no AI; suggest-don't-auto-
 * apply): it surfaces what matters for a chosen class in the creation wizard. It
 * invents no mechanics — every value comes from an existing class-data field or
 * a transcribed PHB table.
 *
 * Sources (PHB 2024, Docs/PlayersHandbook.md):
 *  - Standard Array by Class (L1701-1716): the suggested placement of the
 *    standard array (15,14,13,12,10,8) per class. Transcribed below as
 *    RECOMMENDED_ARRAY_CASES. (OCR note: Fighter's Wis prints as "lO" = 10; each
 *    row is a permutation of the standard array, which is the self-check.)
 *  - Ability Scores and Backgrounds (L1583-1589): which backgrounds boost each
 *    ability. Mapped per class (via the class's primary ability) as
 *    BACKGROUND_FIT_CASES.
 *  - Class overview facts from src/data/classes.ts: primaryAbilities, savingThrows,
 *    hitDie; and SPELLCASTING_DESCRIPTORS for the spellcasting ability.
 */

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type ClassId =
  | 'barbarian' | 'bard' | 'cleric' | 'druid' | 'fighter' | 'monk'
  | 'paladin' | 'ranger' | 'rogue' | 'sorcerer' | 'warlock' | 'wizard';

// ─── Recommended ability array by class (recommendedArray) ───────────────────
// PHB 2024 "Standard Array by Class" (L1701-1716). The suggested score for each
// ability; every row is a permutation of the standard array 15/14/13/12/10/8.
// A one-tap "apply recommended array" fills these (player-initiated, editable).
export interface RecommendedArrayCase {
  classId: ClassId;
  cite: string;
  scores: Record<Ability, number>;
}

export const RECOMMENDED_ARRAY_CASES: RecommendedArrayCase[] = [
  { classId: 'barbarian', cite: 'Standard Array by Class: Barbarian', scores: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } },
  { classId: 'bard', cite: 'Standard Array by Class: Bard', scores: { str: 8, dex: 14, con: 12, int: 13, wis: 10, cha: 15 } },
  { classId: 'cleric', cite: 'Standard Array by Class: Cleric', scores: { str: 14, dex: 8, con: 13, int: 10, wis: 15, cha: 12 } },
  { classId: 'druid', cite: 'Standard Array by Class: Druid', scores: { str: 8, dex: 12, con: 14, int: 13, wis: 15, cha: 10 } },
  { classId: 'fighter', cite: 'Standard Array by Class: Fighter (Wis "lO" = 10)', scores: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 } },
  { classId: 'monk', cite: 'Standard Array by Class: Monk', scores: { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 } },
  { classId: 'paladin', cite: 'Standard Array by Class: Paladin', scores: { str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 } },
  { classId: 'ranger', cite: 'Standard Array by Class: Ranger', scores: { str: 12, dex: 15, con: 13, int: 8, wis: 14, cha: 10 } },
  { classId: 'rogue', cite: 'Standard Array by Class: Rogue', scores: { str: 12, dex: 15, con: 13, int: 14, wis: 10, cha: 8 } },
  { classId: 'sorcerer', cite: 'Standard Array by Class: Sorcerer', scores: { str: 10, dex: 13, con: 14, int: 8, wis: 12, cha: 15 } },
  { classId: 'warlock', cite: 'Standard Array by Class: Warlock', scores: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 } },
  { classId: 'wizard', cite: 'Standard Array by Class: Wizard', scores: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 } },
];

// Self-check the harness asserts for EVERY row: the six scores are exactly a
// permutation of the standard array. Pinned as data so the harness can read it.
export const STANDARD_ARRAY_MULTISET: number[] = [15, 14, 13, 12, 10, 8];

// ─── Class overview facts (classGuidance) ────────────────────────────────────
// What the Class-step blurb shows, all from existing class data: the primary
// ability(ies), the two saving-throw proficiencies, the hit die (durability),
// and the spellcasting ability (undefined for a non-caster or a subclass-only
// caster whose base class does not cast). The advisor reads these; it does not
// recompute them.
export interface ClassGuidanceCase {
  classId: ClassId;
  cite: string;
  expect: {
    /** Primary ability(ies) for the class (the score(s) that matter most). */
    primaryAbilities: Ability[];
    /** True when the primaries are EITHER/OR (join with "or"), false when ALL
     *  are primary (join with "&"). Sourced from the explicit multiclassPrereq
     *  shape: `any` = or, `all` = and. Fighter (Str OR Dex) is the ONLY OR class;
     *  Monk/Paladin/Ranger are AND, and single-primary classes are trivially AND. */
    primaryIsOr: boolean;
    /** The two saving-throw proficiencies. */
    savingThrows: Ability[];
    /** Hit die face (durability signal): 12/10/8/6. */
    hitDie: number;
    /** Base-class spellcasting ability, or null for a non-caster base class
     *  (Barbarian, Fighter, Monk, Rogue — EK/AT are subclass-only, so the BASE
     *  class advertises no spellcasting ability at creation). */
    spellcastingAbility: Ability | null;
  };
}

export const CLASS_GUIDANCE_CASES: ClassGuidanceCase[] = [
  { classId: 'barbarian', cite: 'Core Barbarian Traits', expect: { primaryAbilities: ['str'], primaryIsOr: false, savingThrows: ['str', 'con'], hitDie: 12, spellcastingAbility: null } },
  { classId: 'bard', cite: 'Core Bard Traits; Bard Spellcasting (Cha)', expect: { primaryAbilities: ['cha'], primaryIsOr: false, savingThrows: ['dex', 'cha'], hitDie: 8, spellcastingAbility: 'cha' } },
  { classId: 'cleric', cite: 'Core Cleric Traits; Cleric Spellcasting (Wis)', expect: { primaryAbilities: ['wis'], primaryIsOr: false, savingThrows: ['wis', 'cha'], hitDie: 8, spellcastingAbility: 'wis' } },
  { classId: 'druid', cite: 'Core Druid Traits; Druid Spellcasting (Wis)', expect: { primaryAbilities: ['wis'], primaryIsOr: false, savingThrows: ['int', 'wis'], hitDie: 8, spellcastingAbility: 'wis' } },
  { classId: 'fighter', cite: 'Core Fighter Traits (Str or Dex); EK is subclass-only', expect: { primaryAbilities: ['str', 'dex'], primaryIsOr: true, savingThrows: ['str', 'con'], hitDie: 10, spellcastingAbility: null } },
  { classId: 'monk', cite: 'Core Monk Traits', expect: { primaryAbilities: ['dex', 'wis'], primaryIsOr: false, savingThrows: ['str', 'dex'], hitDie: 8, spellcastingAbility: null } },
  { classId: 'paladin', cite: 'Core Paladin Traits; Paladin Spellcasting (Cha)', expect: { primaryAbilities: ['str', 'cha'], primaryIsOr: false, savingThrows: ['wis', 'cha'], hitDie: 10, spellcastingAbility: 'cha' } },
  { classId: 'ranger', cite: 'Core Ranger Traits; Ranger Spellcasting (Wis)', expect: { primaryAbilities: ['dex', 'wis'], primaryIsOr: false, savingThrows: ['str', 'dex'], hitDie: 10, spellcastingAbility: 'wis' } },
  { classId: 'rogue', cite: 'Core Rogue Traits; AT is subclass-only', expect: { primaryAbilities: ['dex'], primaryIsOr: false, savingThrows: ['dex', 'int'], hitDie: 8, spellcastingAbility: null } },
  { classId: 'sorcerer', cite: 'Core Sorcerer Traits; Sorcerer Spellcasting (Cha)', expect: { primaryAbilities: ['cha'], primaryIsOr: false, savingThrows: ['con', 'cha'], hitDie: 6, spellcastingAbility: 'cha' } },
  { classId: 'warlock', cite: 'Core Warlock Traits; Warlock Pact Magic (Cha)', expect: { primaryAbilities: ['cha'], primaryIsOr: false, savingThrows: ['wis', 'cha'], hitDie: 8, spellcastingAbility: 'cha' } },
  { classId: 'wizard', cite: 'Core Wizard Traits; Wizard Spellcasting (Int)', expect: { primaryAbilities: ['int'], primaryIsOr: false, savingThrows: ['int', 'wis'], hitDie: 6, spellcastingAbility: 'int' } },
];

// ─── Per-ability placement hint (abilityHints) ───────────────────────────────
// On the Ability Scores step, each ability gets a short hint keyed to its
// recommended value for the chosen class. The ability with the HIGHEST
// recommended score is tagged 'primary'; the class's save-proficiency abilities
// are tagged 'save'; the lowest recommended score is tagged 'dump'. The hint set
// per ability is derived (NOT free-form), so it is pinned per class as the set
// of tags each ability carries. Tags: 'primary' | 'save' | 'dump' (an ability
// may carry more than one, e.g. a save that is also the dump). The harness
// asserts, per class, which ability is primary (max recommended) and which is
// the dump (min recommended), and that the save tags match the class saves.
export interface AbilityHintCase {
  classId: ClassId;
  cite: string;
  /** The ability with the highest recommended score (the primary placement). */
  primaryPlacement: Ability;
  /** The ability with the lowest recommended score (the dump). */
  dumpPlacement: Ability;
  /** The save-proficiency abilities (tagged 'save'). */
  saveAbilities: Ability[];
}

export const ABILITY_HINT_CASES: AbilityHintCase[] = [
  // Highest recommended = 15 (the class's top ability per the array); lowest = 8.
  { classId: 'barbarian', cite: 'array max Str 15, min Cha 8', primaryPlacement: 'str', dumpPlacement: 'cha', saveAbilities: ['str', 'con'] },
  { classId: 'bard', cite: 'array max Cha 15, min Str 8', primaryPlacement: 'cha', dumpPlacement: 'str', saveAbilities: ['dex', 'cha'] },
  { classId: 'cleric', cite: 'array max Wis 15, min Dex 8', primaryPlacement: 'wis', dumpPlacement: 'dex', saveAbilities: ['wis', 'cha'] },
  { classId: 'druid', cite: 'array max Wis 15, min Str 8', primaryPlacement: 'wis', dumpPlacement: 'str', saveAbilities: ['int', 'wis'] },
  { classId: 'fighter', cite: 'array max Str 15, min Int 8', primaryPlacement: 'str', dumpPlacement: 'int', saveAbilities: ['str', 'con'] },
  { classId: 'monk', cite: 'array max Dex 15, min Cha 8', primaryPlacement: 'dex', dumpPlacement: 'cha', saveAbilities: ['str', 'dex'] },
  { classId: 'paladin', cite: 'array max Str 15, min Int 8', primaryPlacement: 'str', dumpPlacement: 'int', saveAbilities: ['wis', 'cha'] },
  { classId: 'ranger', cite: 'array max Dex 15, min Int 8', primaryPlacement: 'dex', dumpPlacement: 'int', saveAbilities: ['str', 'dex'] },
  { classId: 'rogue', cite: 'array max Dex 15, min Cha 8', primaryPlacement: 'dex', dumpPlacement: 'cha', saveAbilities: ['dex', 'int'] },
  { classId: 'sorcerer', cite: 'array max Cha 15, min Int 8', primaryPlacement: 'cha', dumpPlacement: 'int', saveAbilities: ['con', 'cha'] },
  { classId: 'warlock', cite: 'array max Cha 15, min Str 8', primaryPlacement: 'cha', dumpPlacement: 'str', saveAbilities: ['wis', 'cha'] },
  { classId: 'wizard', cite: 'array max Int 15, min Str 8', primaryPlacement: 'int', dumpPlacement: 'str', saveAbilities: ['int', 'wis'] },
];

// ─── Background-fit hint (suggestedBackgrounds) ──────────────────────────────
// PHB 2024 "Ability Scores and Backgrounds" (L1583-1589): which backgrounds
// boost each ability. The hint on the Background step = the backgrounds that boost
// the chosen class's PRIMARY ability (for a paired primary, the union across
// those abilities). Order not significant (compared as a set). The table maps
// ability → backgrounds (verbatim from the PHB, OCR spacing cleaned):
//   Str: Artisan, Entertainer, Farmer, Guard, Noble, Sailor, Soldier
//   Dex: Artisan, Charlatan, Criminal, Entertainer, Guide, Sailor, Scribe, Soldier, Wayfarer
//   Con: Charlatan, Criminal, Farmer, Guide, Hermit, Merchant, Sage, Soldier
//   Int: Acolyte, Artisan, Criminal, Guard, Merchant, Noble, Sage, Scribe
//   Wis: Acolyte, Farmer, Guard, Guide, Hermit, Sage, Sailor, Scribe, Wayfarer
//   Cha: Acolyte, Charlatan, Entertainer, Hermit, Merchant, Noble, Wayfarer
export interface BackgroundFitCase {
  classId: ClassId;
  cite: string;
  /** Background ids that boost the class's primary ability (a set). */
  suggested: string[];
}

export const BACKGROUND_FIT_CASES: BackgroundFitCase[] = [
  // Single-primary classes: the backgrounds for that one ability.
  { classId: 'barbarian', cite: 'Str backgrounds', suggested: ['artisan', 'entertainer', 'farmer', 'guard', 'noble', 'sailor', 'soldier'] },
  { classId: 'bard', cite: 'Cha backgrounds', suggested: ['acolyte', 'charlatan', 'entertainer', 'hermit', 'merchant', 'noble', 'wayfarer'] },
  { classId: 'cleric', cite: 'Wis backgrounds', suggested: ['acolyte', 'farmer', 'guard', 'guide', 'hermit', 'sage', 'sailor', 'scribe', 'wayfarer'] },
  { classId: 'wizard', cite: 'Int backgrounds', suggested: ['acolyte', 'artisan', 'criminal', 'guard', 'merchant', 'noble', 'sage', 'scribe'] },
  { classId: 'rogue', cite: 'Dex backgrounds', suggested: ['artisan', 'charlatan', 'criminal', 'entertainer', 'guide', 'sailor', 'scribe', 'soldier', 'wayfarer'] },
  { classId: 'sorcerer', cite: 'Cha backgrounds', suggested: ['acolyte', 'charlatan', 'entertainer', 'hermit', 'merchant', 'noble', 'wayfarer'] },
  { classId: 'warlock', cite: 'Cha backgrounds', suggested: ['acolyte', 'charlatan', 'entertainer', 'hermit', 'merchant', 'noble', 'wayfarer'] },
  { classId: 'druid', cite: 'Wis backgrounds', suggested: ['acolyte', 'farmer', 'guard', 'guide', 'hermit', 'sage', 'sailor', 'scribe', 'wayfarer'] },
  // Paired-primary classes: the UNION of the backgrounds for both abilities.
  {
    classId: 'fighter',
    cite: 'Str ∪ Dex backgrounds (primary Str or Dex)',
    suggested: ['artisan', 'entertainer', 'farmer', 'guard', 'noble', 'sailor', 'soldier', 'charlatan', 'criminal', 'guide', 'scribe', 'wayfarer'],
  },
  {
    classId: 'monk',
    cite: 'Dex ∪ Wis backgrounds (primary Dex and Wis)',
    suggested: ['artisan', 'charlatan', 'criminal', 'entertainer', 'guide', 'sailor', 'scribe', 'soldier', 'wayfarer', 'acolyte', 'farmer', 'guard', 'hermit', 'sage'],
  },
  {
    classId: 'paladin',
    cite: 'Str ∪ Cha backgrounds (primary Str and Cha)',
    suggested: ['artisan', 'entertainer', 'farmer', 'guard', 'noble', 'sailor', 'soldier', 'acolyte', 'charlatan', 'hermit', 'merchant', 'wayfarer'],
  },
  {
    classId: 'ranger',
    cite: 'Dex ∪ Wis backgrounds (primary Dex and Wis)',
    suggested: ['artisan', 'charlatan', 'criminal', 'entertainer', 'guide', 'sailor', 'scribe', 'soldier', 'wayfarer', 'acolyte', 'farmer', 'guard', 'hermit', 'sage'],
  },
];
