/**
 * GOLDEN TABLE: level-1 STARTING CHOICES per class, saving-throw proficiency
 * display, and the "finish setting up" checklist.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md) BEFORE the implementation. The implementer must make
 * the real functions reproduce every row and MUST NOT edit this file. If a row
 * looks wrong, STOP and flag it in the summary instead of changing it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. Skill names are
 * as printed in the PHB; the harness maps them to the app's SkillId by name.
 *
 * Sources (PHB 2024, Docs/PlayersHandbook.md; line numbers verified):
 *  - Core <Class> Traits, "Skill Proficiencies": Barbarian L2388, Bard L2689,
 *    Cleric L3127, Druid L3585, Fighter L4094, Monk L4489, Paladin L4823,
 *    Ranger L5331, Rogue L5857, Sorcerer L6231, Warlock L6784, Wizard L7370.
 *  - Level 1 Spellcasting / Pact Magic text: Bard L2745-2753, Cleric L3171-3177,
 *    Druid L3615-3621, Paladin L4859-4865, Ranger L5343-5349, Sorcerer
 *    L6263-6269, Warlock L6827-6858, Wizard L7400-7412. Paladin and Ranger have
 *    NO cantrips. Barbarian, Fighter, Monk and Rogue have no spellcasting at
 *    level 1 (Eldritch Knight / Arcane Trickster begin at level 3).
 *  - Wizard Spellbook (L7404-7408): starts with SIX level 1 Wizard spells; you
 *    then PREPARE four of them (L7412). 2024 has no separate "memorize" step:
 *    every spellcasting class "prepares" its list.
 *  - At level 1 the only spell level you can prepare is 1 (you need a slot of
 *    that level); cantrips are level 0.
 *  - Saving Throw Proficiencies come from your INITIAL class only (Multiclassing:
 *    Proficiencies, L2106); they are granted automatically, never chosen.
 *  - Proficiency Bonus is never added twice (L525), so a manual save-proficiency
 *    tick on a class-granted save adds nothing.
 *
 * RULES AMBIGUITY (flagged): the PHB prints no "pick a different skill if you
 * already have it" rule, only that the bonus is not added twice. The app lets a
 * player pick a class skill they already hold from their Background and shows a
 * note; it does not block the pick. Out of scope for this table.
 */

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export interface StartingChoicesRow {
  classId: string;
  cite: string;
  /** Class skill picks: how many, from which list ('any' = any skill). */
  skills: { count: number; from: string[] | 'any' };
  /** Saving throws the class grants automatically (initial class only). */
  savingThrows: [Ability, Ability];
  /**
   * Level-1 spell picks. `null` = the class has no spellcasting at level 1.
   * cantrips: cantrips known; prepared: level 1 spells prepared;
   * spellbook: starting spellbook size (Wizard only, else null).
   */
  spells: { cantrips: number; prepared: number; spellbook: number | null } | null;
}

export const STARTING_CHOICES: StartingChoicesRow[] = [
  {
    classId: 'barbarian',
    cite: 'Core Barbarian Traits L2388',
    skills: { count: 2, from: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'] },
    savingThrows: ['str', 'con'],
    spells: null,
  },
  {
    classId: 'bard',
    cite: 'Core Bard Traits L2689; Spellcasting L2745-2753',
    skills: { count: 3, from: 'any' },
    savingThrows: ['dex', 'cha'],
    spells: { cantrips: 2, prepared: 4, spellbook: null },
  },
  {
    classId: 'cleric',
    cite: 'Core Cleric Traits L3127; Spellcasting L3171-3177',
    skills: { count: 2, from: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'] },
    savingThrows: ['wis', 'cha'],
    spells: { cantrips: 3, prepared: 4, spellbook: null },
  },
  {
    classId: 'druid',
    cite: 'Core Druid Traits L3585; Spellcasting L3615-3621',
    skills: { count: 2, from: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'] },
    savingThrows: ['int', 'wis'],
    spells: { cantrips: 2, prepared: 4, spellbook: null },
  },
  {
    classId: 'fighter',
    cite: 'Core Fighter Traits L4094 (Eldritch Knight casting starts at level 3)',
    skills: { count: 2, from: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Persuasion', 'Perception', 'Survival'] },
    savingThrows: ['str', 'con'],
    spells: null,
  },
  {
    classId: 'monk',
    cite: 'Core Monk Traits L4489',
    skills: { count: 2, from: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'] },
    savingThrows: ['str', 'dex'],
    spells: null,
  },
  {
    classId: 'paladin',
    cite: 'Core Paladin Traits L4823; Spellcasting L4859-4865 (no cantrips)',
    skills: { count: 2, from: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'] },
    savingThrows: ['wis', 'cha'],
    spells: { cantrips: 0, prepared: 2, spellbook: null },
  },
  {
    classId: 'ranger',
    cite: 'Core Ranger Traits L5331; Spellcasting L5343-5349 (no cantrips)',
    skills: { count: 3, from: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'] },
    savingThrows: ['str', 'dex'],
    spells: { cantrips: 0, prepared: 2, spellbook: null },
  },
  {
    classId: 'rogue',
    cite: 'Core Rogue Traits L5857 (Arcane Trickster casting starts at level 3)',
    skills: { count: 4, from: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Persuasion', 'Sleight of Hand', 'Stealth'] },
    savingThrows: ['dex', 'int'],
    spells: null,
  },
  {
    classId: 'sorcerer',
    cite: 'Core Sorcerer Traits L6231; Spellcasting L6263-6269',
    skills: { count: 2, from: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'] },
    savingThrows: ['con', 'cha'],
    spells: { cantrips: 4, prepared: 2, spellbook: null },
  },
  {
    classId: 'warlock',
    cite: 'Core Warlock Traits L6784; Pact Magic L6827-6858',
    skills: { count: 2, from: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'] },
    savingThrows: ['wis', 'cha'],
    spells: { cantrips: 2, prepared: 2, spellbook: null },
  },
  {
    classId: 'wizard',
    cite: 'Core Wizard Traits L7370; Spellcasting L7400-7412; Spellbook L7404-7408',
    skills: { count: 2, from: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Nature', 'Religion'] },
    savingThrows: ['int', 'wis'],
    spells: { cantrips: 3, prepared: 4, spellbook: 6 },
  },
];

// ─── Saving-throw proficiency DISPLAY (savingThrowProficiency) ───────────────
// For each ability, where does the proficiency come from?
//   'class'  : granted by the INITIAL class (shown ticked + locked, labelled
//              with the class). A manual tick on the same save adds nothing, so
//              the source is still 'class'.
//   'manual' : only the player's own tick (e.g. a feat such as Resilient).
//   null     : not proficient.
export type SaveSource = 'class' | 'manual' | null;

export interface SaveDisplayCase {
  name: string;
  cite: string;
  /** Classes in order; level is the level IN THAT CLASS. Empty = no class. */
  classes: { id: string; level: number }[];
  /** Abilities the player ticked manually (character.saveProficiencies). */
  manual: Ability[];
  expected: Record<Ability, SaveSource>;
}

const NONE: Record<Ability, SaveSource> = {
  str: null, dex: null, con: null, int: null, wis: null, cha: null,
};

export const SAVE_DISPLAY_CASES: SaveDisplayCase[] = [
  {
    name: 'No class and no manual ticks: nothing proficient',
    cite: 'Saving Throw Proficiencies come from the class',
    classes: [],
    manual: [],
    expected: { ...NONE },
  },
  {
    name: 'Wizard 1: Int and Wis are class-granted without any tick',
    cite: 'Core Wizard Traits L7370',
    classes: [{ id: 'wizard', level: 1 }],
    manual: [],
    expected: { ...NONE, int: 'class', wis: 'class' },
  },
  {
    name: 'Fighter 1: Str and Con are class-granted',
    cite: 'Core Fighter Traits L4094',
    classes: [{ id: 'fighter', level: 1 }],
    manual: [],
    expected: { ...NONE, str: 'class', con: 'class' },
  },
  {
    name: 'Wizard 1 + a manual Str tick (e.g. a feat): Str is manual, Int/Wis stay class',
    cite: 'Resilient-style feats grant a save; Core Wizard Traits L7370',
    classes: [{ id: 'wizard', level: 1 }],
    manual: ['str'],
    expected: { ...NONE, str: 'manual', int: 'class', wis: 'class' },
  },
  {
    name: 'Wizard 1 + a redundant manual Int tick: still reported as class (Proficiency Bonus is not added twice)',
    cite: 'L525 (bonus never added twice)',
    classes: [{ id: 'wizard', level: 1 }],
    manual: ['int'],
    expected: { ...NONE, int: 'class', wis: 'class' },
  },
  {
    name: 'Rogue 1 / Wizard 1: only the INITIAL class (Rogue) grants saves',
    cite: 'Multiclassing: Proficiencies L2106',
    classes: [
      { id: 'rogue', level: 1 },
      { id: 'wizard', level: 1 },
    ],
    manual: [],
    expected: { ...NONE, dex: 'class', int: 'class' },
  },
  {
    name: 'No class but a manual tick: manual',
    cite: 'Manual proficiency stays available',
    classes: [],
    manual: ['wis'],
    expected: { ...NONE, wis: 'manual' },
  },
];

// ─── "Finish setting up" checklist (pendingSetupChoices) ─────────────────────
// For a LEVEL 1 single-class character. The checklist lists only the groups
// that are still short of the STARTING_CHOICES requirement, in this order:
// 'class-skills', 'cantrips', 'spellbook', 'prepared' (a Wizard fills the
// spellbook first because the prepared list is chosen FROM it, L7412). Groups the class does not
// have (e.g. cantrips for a Paladin, spells for a Fighter) never appear. A group
// that is complete is omitted. `have` counts valid, distinct picks only.
export type PendingKind = 'class-skills' | 'cantrips' | 'prepared' | 'spellbook';

export interface PendingItem {
  kind: PendingKind;
  have: number;
  need: number;
}

export interface PendingSetupCase {
  name: string;
  cite: string;
  classId: string;
  /** Number of valid class-skill picks made so far. */
  classSkillsChosen: number;
  cantripsChosen?: number;
  preparedChosen?: number;
  spellbookChosen?: number;
  expected: PendingItem[];
}

export const PENDING_SETUP_CASES: PendingSetupCase[] = [
  {
    name: 'Fighter 1, nothing chosen: only class skills (no spells exist at level 1)',
    cite: 'Core Fighter Traits L4094',
    classId: 'fighter',
    classSkillsChosen: 0,
    expected: [{ kind: 'class-skills', have: 0, need: 2 }],
  },
  {
    name: 'Fighter 1, both skills chosen: nothing pending',
    cite: 'Core Fighter Traits L4094',
    classId: 'fighter',
    classSkillsChosen: 2,
    expected: [],
  },
  {
    name: 'Rogue 1, three of four skills chosen',
    cite: 'Core Rogue Traits L5857',
    classId: 'rogue',
    classSkillsChosen: 3,
    expected: [{ kind: 'class-skills', have: 3, need: 4 }],
  },
  {
    name: 'Cleric 1, nothing chosen: skills, cantrips and prepared spells',
    cite: 'L3127; L3171-3177',
    classId: 'cleric',
    classSkillsChosen: 0,
    expected: [
      { kind: 'class-skills', have: 0, need: 2 },
      { kind: 'cantrips', have: 0, need: 3 },
      { kind: 'prepared', have: 0, need: 4 },
    ],
  },
  {
    name: 'Cleric 1, skills done and 3 cantrips done, prepared 2 of 4',
    cite: 'L3171-3177',
    classId: 'cleric',
    classSkillsChosen: 2,
    cantripsChosen: 3,
    preparedChosen: 2,
    expected: [{ kind: 'prepared', have: 2, need: 4 }],
  },
  {
    name: 'Paladin 1, nothing chosen: skills and prepared spells, no cantrips group',
    cite: 'L4823; L4859-4865 (no cantrips)',
    classId: 'paladin',
    classSkillsChosen: 0,
    expected: [
      { kind: 'class-skills', have: 0, need: 2 },
      { kind: 'prepared', have: 0, need: 2 },
    ],
  },
  {
    name: 'Wizard 1, nothing chosen: skills, cantrips, spellbook (6) and prepared (4)',
    cite: 'L7370; L7400-7412',
    classId: 'wizard',
    classSkillsChosen: 0,
    expected: [
      { kind: 'class-skills', have: 0, need: 2 },
      { kind: 'cantrips', have: 0, need: 3 },
      { kind: 'spellbook', have: 0, need: 6 },
      { kind: 'prepared', have: 0, need: 4 },
    ],
  },
  {
    name: 'Wizard 1, spellbook of 6 done but nothing prepared yet',
    cite: 'L7404-7412: prepare four from the spellbook',
    classId: 'wizard',
    classSkillsChosen: 2,
    cantripsChosen: 3,
    spellbookChosen: 6,
    preparedChosen: 0,
    expected: [{ kind: 'prepared', have: 0, need: 4 }],
  },
  {
    name: 'Wizard 1, fully set up: nothing pending',
    cite: 'L7370; L7400-7412',
    classId: 'wizard',
    classSkillsChosen: 2,
    cantripsChosen: 3,
    spellbookChosen: 6,
    preparedChosen: 4,
    expected: [],
  },
  {
    name: 'Warlock 1, nothing chosen: skills, cantrips and prepared spells',
    cite: 'L6784; L6827-6858',
    classId: 'warlock',
    classSkillsChosen: 0,
    expected: [
      { kind: 'class-skills', have: 0, need: 2 },
      { kind: 'cantrips', have: 0, need: 2 },
      { kind: 'prepared', have: 0, need: 2 },
    ],
  },
  {
    name: 'Sorcerer 1, only prepared spells left',
    cite: 'L6263-6269',
    classId: 'sorcerer',
    classSkillsChosen: 2,
    cantripsChosen: 4,
    preparedChosen: 0,
    expected: [{ kind: 'prepared', have: 0, need: 2 }],
  },
];

// ─── "Finish setting up": class-feature picks (pendingFeaturePicks) ──────────
// Expertise and feature-language picks that a level-1 feature owes. Scope is the
// SETUP card: an item appears only when the character has reached a LEVEL 1
// class feature that grants the pick, i.e. Rogue (Expertise L5882-5884 owes two;
// Thieves' Cant L5873-5898 "plus one other language of your choice" owes one).
// Bard Expertise (L2794) and Ranger Deft Explorer (L5411-5419) begin at class
// level 2, Wizard Scholar at 2 (L7465); those picks are listed on the
// Advancement page, not on the setup card. The counts are POOLS shared across
// classes (the app does not record which feature a pick came from), so a
// multiclass character shows the pooled have/need labelled with the class whose
// LEVEL 1 feature opens the item (Rogue). Order: expertise, then languages,
// after every spell/skill item. `have` counts valid, distinct picks; picks past
// the grant are a warning elsewhere and never keep an item open.
export type FeaturePickKind = 'expertise' | 'languages';

export interface FeaturePickItem {
  kind: FeaturePickKind;
  have: number;
  need: number;
  /** Class that opens the item (level-1 feature); set for multiclass only. */
  classId?: string;
}

export interface FeaturePickCase {
  name: string;
  cite: string;
  classes: { id: string; level: number }[];
  /** PHB skill names that carry Expertise (the character is proficient in each). */
  expertise: string[];
  /** Feature-language picks stored (not Common, not Thieves' Cant). */
  languages: string[];
  expected: FeaturePickItem[];
}

export const FEATURE_PICK_CASES: FeaturePickCase[] = [
  {
    name: 'Rogue 1, nothing chosen: two Expertise and one language owed',
    cite: 'Rogue Expertise L5882-5884; Thieves\' Cant L5873-5898',
    classes: [{ id: 'rogue', level: 1 }],
    expertise: [],
    languages: [],
    expected: [
      { kind: 'expertise', have: 0, need: 2 },
      { kind: 'languages', have: 0, need: 1 },
    ],
  },
  {
    name: 'Rogue 1, one Expertise made, no language',
    cite: 'L5882-5884; L5873-5898',
    classes: [{ id: 'rogue', level: 1 }],
    expertise: ['Stealth'],
    languages: [],
    expected: [
      { kind: 'expertise', have: 1, need: 2 },
      { kind: 'languages', have: 0, need: 1 },
    ],
  },
  {
    name: 'Rogue 1, Expertise done, language still owed',
    cite: 'L5882-5884; L5873-5898',
    classes: [{ id: 'rogue', level: 1 }],
    expertise: ['Stealth', 'Perception'],
    languages: [],
    expected: [{ kind: 'languages', have: 0, need: 1 }],
  },
  {
    name: 'Rogue 1, language done, one Expertise owed',
    cite: 'L5882-5884; L5873-5898',
    classes: [{ id: 'rogue', level: 1 }],
    expertise: ['Stealth'],
    languages: ['dwarvish'],
    expected: [{ kind: 'expertise', have: 1, need: 2 }],
  },
  {
    name: 'Rogue 1, complete: nothing pending',
    cite: 'L5882-5884; L5873-5898',
    classes: [{ id: 'rogue', level: 1 }],
    expertise: ['Stealth', 'Perception'],
    languages: ['dwarvish'],
    expected: [],
  },
  {
    name: 'Rogue 1, one too many of each: over-allocation never keeps the card open',
    cite: 'L5882-5884; L5873-5898 (the grant is two and one)',
    classes: [{ id: 'rogue', level: 1 }],
    expertise: ['Stealth', 'Perception', 'Deception'],
    languages: ['dwarvish', 'elvish'],
    expected: [],
  },
  {
    name: 'Rogue 1, a duplicate language pick counts once',
    cite: 'L5873-5898 ("one other language")',
    classes: [{ id: 'rogue', level: 1 }],
    expertise: ['Stealth', 'Perception'],
    languages: ['dwarvish', 'Dwarvish'],
    expected: [],
  },
  {
    name: 'Fighter 1: no Expertise or language feature',
    cite: 'Core Fighter Traits L4094',
    classes: [{ id: 'fighter', level: 1 }],
    expertise: [],
    languages: [],
    expected: [],
  },
  {
    name: 'Bard 1: Expertise starts at level 2, so nothing on the setup card',
    cite: 'Bard Expertise L2794',
    classes: [{ id: 'bard', level: 1 }],
    expertise: [],
    languages: [],
    expected: [],
  },
  {
    name: 'Ranger 1: Deft Explorer starts at level 2, so nothing on the setup card',
    cite: 'Ranger Deft Explorer L5411-5419',
    classes: [{ id: 'ranger', level: 1 }],
    expertise: [],
    languages: [],
    expected: [],
  },
  {
    name: 'Bard 2 and Ranger 2: owed, but on the Advancement page, not the setup card',
    cite: 'L2794; L5411-5419',
    classes: [
      { id: 'bard', level: 2 },
      { id: 'ranger', level: 2 },
    ],
    expertise: [],
    languages: [],
    expected: [],
  },
  {
    name: 'Wizard 1 / Rogue 1: the Rogue level 1 features owe it, labelled Rogue',
    cite: 'Multiclassing: features of each class L2106+; Rogue L5873-5898, L5882-5884',
    classes: [
      { id: 'wizard', level: 1 },
      { id: 'rogue', level: 1 },
    ],
    expertise: [],
    languages: [],
    expected: [
      { kind: 'expertise', have: 0, need: 2, classId: 'rogue' },
      { kind: 'languages', have: 0, need: 1, classId: 'rogue' },
    ],
  },
  {
    name: 'Rogue 1 / Ranger 2: pooled counts (Expertise 2+1, languages 1+2)',
    cite: 'Rogue L5882-5884, L5873-5898; Ranger L5411-5419',
    classes: [
      { id: 'rogue', level: 1 },
      { id: 'ranger', level: 2 },
    ],
    expertise: ['Stealth'],
    languages: ['dwarvish'],
    expected: [
      { kind: 'expertise', have: 1, need: 3, classId: 'rogue' },
      { kind: 'languages', have: 1, need: 3, classId: 'rogue' },
    ],
  },
];
