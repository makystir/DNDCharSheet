/**
 * Feat catalog (D&D 5.5e / 2024).
 *
 * Stage A6b PART 1 lands the catalog SHAPE and the first TRANCHE of feats (the
 * ids the golden table TRANCHE_FEATS pins). The remaining ~80 Feat List entries
 * (PHB 2024 "Feat List", L8372-8448) are backfilled by PART 2, which only adds
 * more FEAT_CATALOG entries — this module's TYPES are the stable seam PART 2
 * fills, so no logic change is needed for the backfill.
 *
 * CONVENTIONS (match data/classes.ts / data/conditions.ts):
 *  - One keyed record (FEAT_CATALOG); the FeatId union is DERIVED from it so the
 *    persisted FeatSelection.featId and the catalog cannot drift.
 *  - Every entry carries a line-anchored PHB citation (`source`).
 *  - Benefit prose is PARAPHRASED, never verbatim (rules-compliance rule 5).
 *
 * RULES-COMPLIANCE: ability increases are modelled; caps are 20 for General/ASI
 * feats and 30 for Epic Boon feats (PHB 2024 "Ability Score Improvement" L8558,
 * "Epic Boon Feats" L9124+). Benefits beyond ability increases and simple
 * skill/tool grants are stored as `effect` text only (A6b scope guardrail).
 */

import type { Ability } from '../types/character';

/** The four feat categories (PHB 2024 "Parts of a Feat", L8356). */
export type FeatCategory = 'origin' | 'general' | 'fighting-style' | 'epic-boon';

/**
 * A feat's prerequisite. All parts are optional; an Origin feat has none. A
 * class prerequisite needs at least 1 level in that class (PHB 2024 "Parts of a
 * Feat": Prerequisite). `note` holds anything not machine-checkable.
 */
export interface FeatPrerequisite {
  /** Minimum character level (General = 4, Epic Boon = 19). */
  minLevel?: number;
  /** Minimum ability score(s), checked against EFFECTIVE scores, e.g. { cha: 13 }. */
  abilityMin?: Partial<Record<Ability, number>>;
  /** Free-text prerequisite that is not machine-checkable. */
  note?: string;
}

/**
 * How a feat raises ability scores, if at all. The ASI feat carries `kind:'asi'`
 * (its +2-one / +1+1-two options are validated by isAsiAllocationValid, not a
 * single fixed shape); other feats carry the concrete shape they grant.
 *
 *  - 'asi'        — the Ability Score Improvement feat (+2 one OR +1 two, max 20).
 *  - 'fixed'      — a named +1 to one ability (e.g. Actor +1 Cha), max 20.
 *  - 'choose-one' — +amount to ONE ability the player chooses (e.g. Resilient +1).
 *  - 'epic-boon'  — Epic Boon +1 to ONE chosen ability, max 30.
 */
export type FeatAbilityIncrease =
  | { kind: 'asi' }
  | { kind: 'fixed'; ability: Ability; amount: 1; max: 20 }
  | { kind: 'choose-one'; amount: 1; max: 20 }
  | { kind: 'epic-boon'; amount: 1; max: 30 };

/** A single feat's mechanical profile. */
export interface FeatData {
  /** Catalog key, e.g. 'actor'. */
  id: string;
  /** Feat name as printed, e.g. 'Actor'. */
  name: string;
  category: FeatCategory;
  /** Prerequisite, or undefined when the feat has none (most Origin feats). */
  prerequisite?: FeatPrerequisite;
  /** True for the '*' feats in the Feat List table (default once). */
  repeatable?: boolean;
  /** How this feat raises scores, if at all. */
  abilityIncrease?: FeatAbilityIncrease;
  /**
   * Feat-granted skill/tool/expertise picks the selection UI resolves (A6b
   * scope: simple grants only). A count-based shape; which skills/tools is a
   * player choice recorded on FeatSelection.choices. Absent = none.
   */
  grants?: { skills?: number; tools?: number; expertise?: number; note?: string };
  /** Short PHB-cited paraphrase of the benefit (never verbatim). */
  effect: string;
  /** Line-anchored PHB citation this entry is transcribed from. */
  source: string;
}

/**
 * The feat catalog, keyed by id. A6b PART 1 TRANCHE only — PART 2 backfills the
 * remaining Feat List entries by adding more records here (no type change).
 *
 * Ability-increase caps: General/ASI = 20; Epic Boon = 30 (PHB 2024
 * "Ability Score Improvement" L8558; "Epic Boon Feats" L9124+).
 */
export const FEAT_CATALOG: Record<string, FeatData> = {
  // ── The Ability Score Improvement feat (PHB 2024 L8558) ──────────────────
  'ability-score-improvement': {
    id: 'ability-score-improvement',
    name: 'Ability Score Improvement',
    category: 'general',
    prerequisite: { minLevel: 4 }, // PHB 2024 L8558: General Feat (Prerequisite: Level 4+).
    repeatable: true, // PHB 2024 L8558: "Repeatable."
    abilityIncrease: { kind: 'asi' },
    // PHB 2024 L8558: increase one score by 2, or two scores by 1; cannot exceed 20.
    effect:
      'Increase one ability score by 2, or two ability scores by 1 (maximum 20).',
    source: 'PHB 2024 "Ability Score Improvement" (L8558)',
  },

  // ── Origin feats (no level prerequisite — PHB 2024 "Origin Feats" L8454) ──
  alert: {
    id: 'alert',
    name: 'Alert',
    category: 'origin',
    // PHB 2024 L8458: add your Proficiency Bonus to Initiative; swap Initiative with a willing ally.
    effect:
      'Add your Proficiency Bonus to Initiative, and swap Initiative with a willing ally after rolling.',
    source: 'PHB 2024 "Alert" (L8458)',
  },
  'savage-attacker': {
    id: 'savage-attacker',
    name: 'Savage Attacker',
    category: 'origin',
    // PHB 2024 L8528: once per turn on a weapon hit, roll the damage dice twice and use either.
    effect:
      'Once per turn, when you hit with a weapon, roll the damage dice twice and use either roll.',
    source: 'PHB 2024 "Savage Attacker" (L8528)',
  },
  skilled: {
    id: 'skilled',
    name: 'Skilled',
    category: 'origin',
    repeatable: true, // PHB 2024 L8532: "Repeatable."
    // PHB 2024 L8532: proficiency in any combination of three skills or tools.
    grants: { skills: 3, tools: 0, note: 'Any combination of three skills or tools.' },
    effect: 'Gain proficiency in any combination of three skills or tools of your choice.',
    source: 'PHB 2024 "Skilled" (L8532)',
  },
  tough: {
    id: 'tough',
    name: 'Tough',
    category: 'origin',
    // PHB 2024 L8550: HP maximum increases by twice your level, and by 2 more each level after.
    effect:
      'Your Hit Point maximum increases by twice your character level, and by 2 more each level gained thereafter.',
    source: 'PHB 2024 "Tough" (L8550)',
  },

  // ── Origin feats the 16 backgrounds reference (Stage A7 backfill) ─────────
  // Magic Initiate is ONE repeatable Origin feat (PHB 2024 "Magic Initiate"
  // L8506) whose spell list is chosen when taken; a different list each time it
  // is repeated. The three backgrounds that grant it fix the list (Cleric for
  // Acolyte, Druid for Guide, Wizard for Sage), so the catalog carries one id
  // per list — each non-repeatable on its own id (repeating means choosing a
  // DIFFERENT list), each granting two cantrips + one level-1 spell from that
  // list, no ability increase.
  'magic-initiate-cleric': {
    id: 'magic-initiate-cleric',
    name: 'Magic Initiate (Cleric)',
    category: 'origin',
    grants: { note: 'Two Cleric cantrips and one level-1 Cleric spell (Int/Wis/Cha spellcasting ability).' },
    // PHB 2024 L8506: learn two cantrips + one level-1 spell from the chosen list.
    effect:
      'Learn two cantrips and one level-1 spell from the Cleric spell list (the level-1 spell can be cast once per Long Rest without a slot).',
    source: 'PHB 2024 "Magic Initiate" (L8506)',
  },
  'magic-initiate-druid': {
    id: 'magic-initiate-druid',
    name: 'Magic Initiate (Druid)',
    category: 'origin',
    grants: { note: 'Two Druid cantrips and one level-1 Druid spell (Int/Wis/Cha spellcasting ability).' },
    // PHB 2024 L8506: learn two cantrips + one level-1 spell from the chosen list.
    effect:
      'Learn two cantrips and one level-1 spell from the Druid spell list (the level-1 spell can be cast once per Long Rest without a slot).',
    source: 'PHB 2024 "Magic Initiate" (L8506)',
  },
  'magic-initiate-wizard': {
    id: 'magic-initiate-wizard',
    name: 'Magic Initiate (Wizard)',
    category: 'origin',
    grants: { note: 'Two Wizard cantrips and one level-1 Wizard spell (Int/Wis/Cha spellcasting ability).' },
    // PHB 2024 L8506: learn two cantrips + one level-1 spell from the chosen list.
    effect:
      'Learn two cantrips and one level-1 spell from the Wizard spell list (the level-1 spell can be cast once per Long Rest without a slot).',
    source: 'PHB 2024 "Magic Initiate" (L8506)',
  },
  crafter: {
    id: 'crafter',
    name: 'Crafter',
    category: 'origin',
    // PHB 2024 L8468: proficiency with three Artisan's Tools; 20% buy discount; Fast Crafting.
    grants: { tools: 3, note: "Three Artisan's Tools of your choice from the Fast Crafting table." },
    effect:
      "Gain proficiency with three Artisan's Tools; get a 20% discount on nonmagical purchases; craft one piece of gear on a Long Rest (Fast Crafting).",
    source: 'PHB 2024 "Crafter" (L8468)',
  },
  musician: {
    id: 'musician',
    name: 'Musician',
    category: 'origin',
    // PHB 2024 L8520: proficiency with three Musical Instruments; Encouraging Song on a rest.
    grants: { tools: 3, note: 'Three Musical Instruments of your choice.' },
    effect:
      'Gain proficiency with three Musical Instruments; on a Short or Long Rest, grant Heroic Inspiration to allies (up to your Proficiency Bonus) who hear your song.',
    source: 'PHB 2024 "Musician" (L8520)',
  },
  healer: {
    id: 'healer',
    name: 'Healer',
    category: 'origin',
    // PHB 2024 L8488: Battle Medic (Healer's Kit heal via Hit Dice + PB); reroll healing 1s.
    effect:
      "Use a Healer's Kit to let a creature spend a Hit Die and heal (roll + your Proficiency Bonus); reroll any 1 when rolling healing dice.",
    source: 'PHB 2024 "Healer" (L8488)',
  },
  lucky: {
    id: 'lucky',
    name: 'Lucky',
    category: 'origin',
    // PHB 2024 L8496: Luck Points equal to PB; spend for Advantage on a d20 Test or impose Disadvantage.
    effect:
      'You have Luck Points equal to your Proficiency Bonus; spend one for Advantage on a D20 Test, or to impose Disadvantage on an attack against you. Regained on a Long Rest.',
    source: 'PHB 2024 "Lucky" (L8496)',
  },
  'tavern-brawler': {
    id: 'tavern-brawler',
    name: 'Tavern Brawler',
    category: 'origin',
    // PHB 2024 L8538: enhanced Unarmed Strike (1d4 + Str); reroll 1s; improvised weapons; Push.
    effect:
      'Deal 1d4 + Strength modifier Bludgeoning damage with an Unarmed Strike; reroll a 1 on its damage die; gain improvised-weapon proficiency and a once-per-turn 5-ft Push.',
    source: 'PHB 2024 "Tavern Brawler" (L8538)',
  },

  // ── General feats with a clean Ability Score Increase ────────────────────
  actor: {
    id: 'actor',
    name: 'Actor',
    category: 'general',
    // PHB 2024 L8568: General Feat (Prerequisite: Level 4+, Charisma 13+).
    prerequisite: { minLevel: 4, abilityMin: { cha: 13 } },
    abilityIncrease: { kind: 'fixed', ability: 'cha', amount: 1, max: 20 },
    // PHB 2024 L8568: +1 Cha (max 20); Advantage to impersonate; mimic sounds/speech.
    effect:
      'Increase Charisma by 1 (maximum 20); gain Advantage to impersonate a person, and mimic sounds and speech.',
    source: 'PHB 2024 "Actor" (L8568)',
  },
  resilient: {
    id: 'resilient',
    name: 'Resilient',
    category: 'general',
    prerequisite: { minLevel: 4 }, // PHB 2024 L8874: General Feat (Prerequisite: Level 4+).
    abilityIncrease: { kind: 'choose-one', amount: 1, max: 20 },
    // PHB 2024 L8874: +1 to a chosen ability you lack a save proficiency in (max 20); gain that save proficiency.
    effect:
      'Increase one chosen ability (in which you lack save proficiency) by 1 (maximum 20), and gain saving throw proficiency with it.',
    source: 'PHB 2024 "Resilient" (L8874)',
  },

  // ── An Epic Boon feat (PHB 2024 "Epic Boon Feats" L9124+) ────────────────
  'boon-of-combat-prowess': {
    id: 'boon-of-combat-prowess',
    name: 'Boon of Combat Prowess',
    category: 'epic-boon',
    prerequisite: { minLevel: 19 }, // PHB 2024 L9126: Epic Boon Feat (Prerequisite: Level 19+).
    abilityIncrease: { kind: 'epic-boon', amount: 1, max: 30 },
    // PHB 2024 L9126: +1 to one chosen ability (max 30); once per turn turn a miss into a hit.
    effect:
      'Increase one chosen ability by 1 (maximum 30); once per turn, when you miss with an attack roll, you can hit instead.',
    source: 'PHB 2024 "Boon of Combat Prowess" (L9126)',
  },
};

/** A catalog key. Derived from FEAT_CATALOG so the persisted shape cannot drift. */
export type FeatId = keyof typeof FEAT_CATALOG;

/** Look up a feat by id; undefined for an unknown id (never throws). */
export function getFeat(id: string): FeatData | undefined {
  return Object.hasOwn(FEAT_CATALOG, id) ? FEAT_CATALOG[id] : undefined;
}

/** All catalog feats as an array (insertion order). */
export function allFeats(): FeatData[] {
  return Object.values(FEAT_CATALOG);
}
