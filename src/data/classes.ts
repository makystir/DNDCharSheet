/**
 * D&D 5.5e (2024) class catalog.
 *
 * A flat, typed data module mirroring src/data/species.ts: one exported record
 * keyed by class id, plus the id/enum unions derived from the data so the
 * Character type and the catalog cannot drift.
 *
 * SOURCING / RULES COMPLIANCE
 * ---------------------------
 * Every mechanical value (Hit Die, primary ability, saving throws, skill/armor/
 * weapon/tool proficiencies, feature levels, ASI levels, subclass level) is
 * transcribed from Docs/PlayersHandbook.md Chapter 3 "CHARACTER CLASSES". Each
 * entry/feature carries a `source` citation and a matching `// PHB 2024 "…"`
 * comment. NO long verbatim PHB prose is reproduced: every `effect` string is a
 * short paraphrase of the printed rule; only numeric/mechanical values are
 * transcribed verbatim (rules-compliance rule 5).
 *
 * ASI / EPIC BOON ARE NOT AUTOMATIC STAT BUMPS
 * --------------------------------------------
 * Each "Ability Score Improvement" row and the level-19 "Epic Boon" row are
 * feat CHOICES, never an automatic change to the six ability scores (PHB 2024:
 * "Ability Score Improvement" grants the ASI feat or another feat; "Epic Boon"
 * grants an Epic Boon feat). They are represented as `kind: 'asi-marker'`
 * features so the sheet can surface them without the class logic ever mutating
 * ability modifiers. The no-ASI guard in the logic tests locks this in.
 *
 * CONTENT LICENSING — FLAGGED FOR THE USER
 * ----------------------------------------
 * The SRD 5.2 document is not in the repo, so SRD membership cannot be
 * positively confirmed. Per rules-compliance rule 5 the conservative default is
 * to FLAG everything: no class or subclass is marked `srd-safe`. Each class is
 * `uncertain` and each subclass is `non-srd` (subclass content historically
 * sits outside the SRD). Every class/subclass is surfaced with its flag so the
 * user can decide how to handle redistribution before publishing.
 *
 * CLASS FEATURE LISTS
 * -------------------
 * All twelve classes now ship with their full level-1-to-20 CLASS feature
 * lists transcribed from each class's Features table (PHB 2024 Chapter 3).
 * Only class-level rows are modelled here; rows the Features table marks as a
 * "Subclass feature" (and Paladin's level-20 subclass-feature row) are granted
 * through the chosen subclass, whose own `features` remain deferred (empty).
 * All twelve select their subclass at level 3, read per class from each
 * "<Class> Subclass" Features-table row (PHB 2024), not defaulted.
 */

import type { Ability, SkillId } from '../types/character';
import type { WeaponProperty } from './weapons';

/** A class Hit Die size. Only these four appear among the PHB classes. */
export type HitDie = 6 | 8 | 10 | 12;

/**
 * A single class feature gained at a specific class level. Descriptions are
 * paraphrased; only mechanical values are transcribed.
 */
export interface ClassFeature {
  /** Feature name as printed, e.g. 'Rage', 'Sneak Attack'. */
  name: string;
  /** Class level at which the feature is gained (1–20). */
  level: number;
  /** Paraphrased effect — NEVER verbatim PHB prose (rules-compliance rule 5). */
  effect: string;
  /** Machine-usable mechanical values where the feature is numeric/mechanical. */
  mechanics?: { [k: string]: number | string | number[] };
  /**
   * Marks a feature that is a player choice rather than a static benefit:
   * - 'asi-marker': an Ability Score Improvement row or the level-19 Epic Boon
   *   (a feat choice, never an automatic ability-score change).
   * - 'subclass-choice': the level-3 subclass-selection feature.
   */
  kind?: 'asi-marker' | 'subclass-choice';
  /** Line-anchored PHB citation this feature is transcribed from. */
  source: string;
}

/**
 * A subclass. For Stage 4 FEAT-001 only the NAME + selection level are modelled;
 * `features` is deferred (empty) for every subclass in every class.
 */
export interface SubclassData {
  id: string;
  name: string;
  /** SRD-safety classification for redistribution (see file header). */
  srd: 'non-srd' | 'uncertain';
  /** Subclass features — deferred for all subclasses this stage. */
  features: ClassFeature[];
  /** Line-anchored PHB citation this entry is transcribed from. */
  source: string;
}

/** Structured class weapon proficiency (Stage A5d). PHB 2024 Core <Class> Traits. */
export interface WeaponProficiencyRule {
  simple: boolean;
  martial: boolean;
  /** Martial weapons that have ANY of these properties (e.g. Monk: Light). */
  martialWithAnyOf?: WeaponProperty[];
}

/**
 * The REDUCED set of proficiencies a class grants when it is taken as a
 * NON-INITIAL (multiclass) class (PHB 2024, each class's "As a Multiclass
 * Character" entry in Chapter 3). The INITIAL class (`classes[0]`) still grants
 * its FULL starting proficiencies (the `armorTraining` / `weaponProficiency` /
 * `skillChoices` / `toolProficiencies` above); later classes contribute only
 * this subset. No save proficiencies are ever granted on a multiclass (PHB:
 * the multiclass entries list none), and Heavy armor is never granted this way.
 *
 * Shape mirrors the Stage-M2 golden (MULTICLASS_PROF_CASES):
 *  - `armor`:  armor-training categories ('light' | 'medium' | 'shields').
 *  - `martialWeapons`:  true when Martial weapon proficiency is granted.
 *  - `skills`:  how many skills are chosen from this class's list (0 = none).
 *  - `tools`:  tool/instrument CHOICE markers (e.g. 'thieves-tools',
 *             'musical-instrument'), empty when none.
 */
export interface MulticlassProficiencies {
  /** Armor training granted ('light' | 'medium' | 'shields'); never 'heavy'. */
  armor: Array<'light' | 'medium' | 'shields'>;
  /** Martial weapon proficiency granted? */
  martialWeapons: boolean;
  /** Number of skills chosen from this class's skill list (0 = none). */
  skills: number;
  /** Tool/instrument choice markers granted (e.g. 'thieves-tools'). */
  tools: string[];
}

/** A class' full mechanical profile. */
export interface ClassData {
  id: string;
  name: string;
  /** Hit Die size (PHB 2024 Core <Class> Traits: Hit Point Die). */
  hitDie: HitDie;
  /** Primary ability(ies) (PHB 2024 Core <Class> Traits: Primary Ability). */
  primaryAbilities: Ability[];
  /** The two save proficiencies (PHB 2024 Core <Class> Traits). */
  savingThrows: [Ability, Ability];
  /** Starting skill choice: how many, and from which list ('any' = all skills). */
  skillChoices: { count: number; from: SkillId[] | 'any' };
  /** Armor training, display strings (PHB 2024 Core <Class> Traits). */
  armorTraining: string[];
  /** Weapon proficiencies, display strings (PHB 2024 Core <Class> Traits). */
  weaponProficiencies: string[];
  /**
   * Weapon proficiencies in MACHINE-USABLE form (Stage A5d), so attack logic never
   * parses the display strings above. `simple` / `martial` = proficient with every
   * weapon of that category; `martialWithAnyOf` = proficient with Martial weapons that
   * have at least one of the listed properties (Monk: Light; Rogue: Finesse or Light).
   * An oracle test pins this to `weaponProficiencies` for all 12 classes.
   */
  weaponProficiency: WeaponProficiencyRule;
  /** Tool proficiencies, display strings (PHB 2024 Core <Class> Traits). */
  toolProficiencies: string[];
  /** Starting-equipment choice text (PHB 2024 Core <Class> Traits). */
  startingEquipment: string;
  /** Level-by-level class features (full level 1-20 list per class). */
  features: ClassFeature[];
  /** Subclasses (names + level only this stage). */
  subclasses: SubclassData[];
  /**
   * The reduced proficiencies granted when this class is taken as a NON-initial
   * multiclass (PHB 2024, each class's "As a Multiclass Character" entry). The
   * initial class grants its full starting proficiencies instead; see
   * {@link MulticlassProficiencies}.
   */
  multiclassProficiencies: MulticlassProficiencies;
  /** Class level at which the subclass is chosen (PHB 2024 Features table). */
  subclassLevel: number;
  /** SRD-safety classification for redistribution (see file header). */
  srd: 'non-srd' | 'uncertain';
  /** Line-anchored PHB citation this entry is transcribed from. */
  source: string;
}

/**
 * The twelve PHB (2024) classes, keyed alphabetically. Values transcribed from
 * Docs/PlayersHandbook.md Chapter 3 "CHARACTER CLASSES".
 */
export const CLASS_CATALOG = {
  // PHB 2024 "CORE BARBARIAN TRAITS" / "BARBARIAN FEATURES" (line ~2382/~2446).
  barbarian: {
    id: 'barbarian',
    name: 'Barbarian',
    hitDie: 12, // PHB 2024 "Core Barbarian Traits": Hit Point Die D12 (line ~2385).
    primaryAbilities: ['str'], // PHB 2024 "Core Barbarian Traits": Primary Ability Strength (line ~2385).
    savingThrows: ['str', 'con'], // PHB 2024 "Core Barbarian Traits": Str & Con saves (line ~2385).
    // PHB 2024 "Core Barbarian Traits": Choose 2 skills (line ~2385).
    skillChoices: {
      count: 2,
      from: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
    },
    armorTraining: ['Light armor', 'Medium armor', 'Shields'], // PHB 2024 "Core Barbarian Traits" (line ~2385).
    weaponProficiencies: ['Simple weapons', 'Martial weapons'], // PHB 2024 "Core Barbarian Traits" (line ~2385).
    weaponProficiency: { simple: true, martial: true }, // structured form of the line above (Stage A5d)
    toolProficiencies: [],
    startingEquipment:
      "(A) Greataxe, 4 Handaxes, Explorer's Pack, 15 GP; or (B) 75 GP", // PHB 2024 "Core Barbarian Traits" (line ~2389).
    subclassLevel: 3, // PHB 2024 "Barbarian Features": Barbarian Subclass at level 3 (line ~2456).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Barbarian Traits" / "Barbarian Features"',
    features: [
      {
        name: 'Rage',
        level: 1,
        effect:
          'Enter a Rage as a Bonus Action (not in Heavy armor) for bonus Strength damage, Resistance to Bludgeoning/Piercing/Slashing, and Advantage on Strength checks and saves. Limited uses per the Rages column.',
        mechanics: { rageDamage: 2, ragesAtLevel1: 2 },
        source: 'PHB 2024 "Barbarian: Rage" (line ~2446)',
      },
      {
        name: 'Unarmored Defense',
        level: 1,
        effect: 'While wearing no armor, base AC equals 10 + Dex modifier + Con modifier; a Shield is allowed.',
        mechanics: { acBase: 10 },
        source: 'PHB 2024 "Barbarian: Unarmored Defense" (line ~2477)',
      },
      {
        name: 'Weapon Mastery',
        level: 1,
        effect: 'Use the mastery property of two kinds of Simple/Martial Melee weapons; the number grows per the Weapon Mastery column.',
        mechanics: { weaponsAtLevel1: 2 },
        source: 'PHB 2024 "Barbarian: Weapon Mastery" (line ~2479)',
      },
      {
        name: 'Danger Sense',
        level: 2,
        effect: 'Advantage on Dexterity saving throws unless Incapacitated.',
        source: 'PHB 2024 "Barbarian: Danger Sense" (line ~2483)',
      },
      {
        name: 'Reckless Attack',
        level: 2,
        effect: 'On your first attack roll each turn, gain Advantage on Strength attacks until your next turn, but attacks against you also have Advantage.',
        source: 'PHB 2024 "Barbarian: Reckless Attack" (line ~2487)',
      },
      {
        name: 'Barbarian Subclass',
        level: 3,
        effect: 'Choose a Barbarian subclass; you gain its features of your Barbarian level or lower.',
        kind: 'subclass-choice',
        source: 'PHB 2024 "Barbarian: Barbarian Subclass" (line ~2489)',
      },
      {
        name: 'Primal Knowledge',
        level: 3,
        effect: 'Gain one more Barbarian skill proficiency; while Raging you can make certain skill checks as Strength checks.',
        source: 'PHB 2024 "Barbarian: Primal Knowledge" (line ~2494)',
      },
      {
        name: 'Ability Score Improvement',
        level: 4,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for (repeats at 8, 12, 16).',
        kind: 'asi-marker',
        source: 'PHB 2024 "Barbarian: Ability Score Improvement" (line ~2458)',
      },
      {
        name: 'Extra Attack',
        level: 5,
        effect: 'Attack twice instead of once when you take the Attack action.',
        mechanics: { attacks: 2 },
        source: 'PHB 2024 "Barbarian: Extra Attack" (line ~2459)',
      },
      {
        name: 'Fast Movement',
        level: 5,
        effect: 'Speed increases by 10 feet while not wearing Heavy armor.',
        mechanics: { speedBonusFt: 10 },
        source: 'PHB 2024 "Barbarian: Fast Movement" (line ~2459)',
      },
      {
        name: 'Feral Instinct',
        level: 7,
        effect: 'Advantage on Initiative rolls.',
        source: 'PHB 2024 "Barbarian: Feral Instinct" (line ~2461)',
      },
      {
        name: 'Instinctive Pounce',
        level: 7,
        effect: 'When you enter your Rage as a Bonus Action, move up to half your Speed.',
        source: 'PHB 2024 "Barbarian: Instinctive Pounce" (line ~2461)',
      },
      {
        name: 'Ability Score Improvement',
        level: 8,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Barbarian: Ability Score Improvement" (line ~2462)',
      },
      {
        name: 'Brutal Strike',
        level: 9,
        effect: 'Forgo Advantage from Reckless Attack on one attack to add 1d10 damage and a Brutal Strike effect (Forceful or Hamstring Blow).',
        mechanics: { extraDamageDice: '1d10' },
        source: 'PHB 2024 "Barbarian: Brutal Strike" (line ~2463)',
      },
      {
        name: 'Relentless Rage',
        level: 11,
        effect: 'When dropped to 0 HP while Raging (not killed outright), a DC 10 Con save sets your HP to twice your Barbarian level; the DC rises by 5 per use and resets on a rest.',
        mechanics: { saveDc: 10 },
        source: 'PHB 2024 "Barbarian: Relentless Rage" (line ~2465)',
      },
      {
        name: 'Ability Score Improvement',
        level: 12,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Barbarian: Ability Score Improvement" (line ~2466)',
      },
      {
        name: 'Improved Brutal Strike',
        level: 13,
        effect: 'Brutal Strike gains the Staggering Blow and Sundering Blow effect options.',
        source: 'PHB 2024 "Barbarian: Improved Brutal Strike" (line ~2467)',
      },
      {
        name: 'Persistent Rage',
        level: 15,
        effect: 'Regain all Rage uses on Initiative (once per Long Rest); your Rage lasts 10 minutes without needing to be extended.',
        source: 'PHB 2024 "Barbarian: Persistent Rage" (line ~2469)',
      },
      {
        name: 'Ability Score Improvement',
        level: 16,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Barbarian: Ability Score Improvement" (line ~2470)',
      },
      {
        name: 'Improved Brutal Strike',
        level: 17,
        effect: 'Brutal Strike extra damage rises to 2d10, and you can use two different Brutal Strike effects at once.',
        mechanics: { extraDamageDice: '2d10' },
        source: 'PHB 2024 "Barbarian: Improved Brutal Strike" (line ~2472)',
      },
      {
        name: 'Indomitable Might',
        level: 18,
        effect: 'If a Strength check or save total is below your Strength score, use the score instead.',
        source: 'PHB 2024 "Barbarian: Indomitable Might" (line ~2472)',
      },
      {
        name: 'Epic Boon',
        level: 19,
        effect: 'Gain an Epic Boon feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Barbarian: Epic Boon" (line ~2473)',
      },
      {
        name: 'Primal Champion',
        level: 20,
        effect: 'Your Strength and Constitution scores increase by 4, to a maximum of 25.',
        mechanics: { strIncrease: 4, conIncrease: 4, scoreMax: 25 },
        source: 'PHB 2024 "Barbarian: Primal Champion" (line ~2474)',
      },
    ],
    subclasses: [
      { id: 'berserker', name: 'Path of the Berserker', srd: 'non-srd', features: [], source: 'PHB 2024 "Barbarian Subclasses" (line ~2556)' },
      { id: 'wildHeart', name: 'Path of the Wild Heart', srd: 'non-srd', features: [], source: 'PHB 2024 "Barbarian Subclasses" (line ~2553)' },
      { id: 'worldTree', name: 'Path of the World Tree', srd: 'non-srd', features: [], source: 'PHB 2024 "Barbarian Subclasses" (line ~2553)' },
      { id: 'zealot', name: 'Path of the Zealot', srd: 'non-srd', features: [], source: 'PHB 2024 "Barbarian Subclasses" (line ~2553)' },
    ],
    // PHB 2024 "Barbarian: As a Multiclass Character" (line ~2407): Martial weapons + training with Shields.
    multiclassProficiencies: { armor: ['shields'], martialWeapons: true, skills: 0, tools: [] },
  },

  // PHB 2024 "CORE BARD TRAITS" / "BARD FEATURES" (line ~2682/~2763).
  bard: {
    id: 'bard',
    name: 'Bard',
    hitDie: 8, // PHB 2024 "Core Bard Traits": Hit Point Die D8 (line ~2691).
    primaryAbilities: ['cha'], // PHB 2024 "Core Bard Traits": Primary Ability Charisma (line ~2691).
    savingThrows: ['dex', 'cha'], // PHB 2024 "Core Bard Traits": Dex & Cha saves (line ~2691).
    skillChoices: { count: 3, from: 'any' }, // PHB 2024 "Core Bard Traits": Choose any 3 skills (line ~2691).
    armorTraining: ['Light armor'], // PHB 2024 "Core Bard Traits" (line ~2691).
    weaponProficiencies: ['Simple weapons'], // PHB 2024 "Core Bard Traits" (line ~2691).
    weaponProficiency: { simple: true, martial: false }, // structured form of the line above (Stage A5d)
    toolProficiencies: ['Three Musical Instruments of your choice'], // PHB 2024 "Core Bard Traits" (line ~2691).
    startingEquipment:
      "(A) Leather Armor, 2 Daggers, Musical Instrument, Entertainer's Pack, 19 GP; or (B) 90 GP", // PHB 2024 "Core Bard Traits".
    subclassLevel: 3, // PHB 2024 "Bard: Bard Subclass" at level 3 (line ~2806).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Bard Traits" / "Bard Features"',
    // PHB 2024 p.58: Bard features by level (features table line ~2763; descriptions line ~2727).
    features: [
      {
        name: 'Bardic Inspiration',
        level: 1,
        effect: 'As a Bonus Action, give a creature within 60 feet a Bardic Inspiration die (added to a later failed D20 Test). Uses equal your Cha mod (minimum 1); the die grows (d6→d8→d10→d12) at levels 5/10/15.',
        mechanics: { die: 'd6', dieAt5: 'd8', dieAt10: 'd10', dieAt15: 'd12' },
        source: 'PHB 2024 "Bard: Bardic Inspiration" (line ~2729)',
      },
      {
        name: 'Spellcasting',
        level: 1,
        effect: 'Cast Bard spells using Charisma; prepare a changeable list, know cantrips, and use a Musical Instrument as a Spellcasting Focus. Slots per the Bard Features table.',
        mechanics: { spellcastingAbility: 'cha', cantripsAtLevel1: 2, preparedAtLevel1: 4 },
        source: 'PHB 2024 "Bard: Spellcasting" (line ~2743)',
      },
      {
        name: 'Expertise',
        level: 2,
        effect: 'Gain Expertise in two of your skill proficiencies; you gain Expertise in two more at Bard level 9.',
        mechanics: { skillsAtLevel2: 2 },
        source: 'PHB 2024 "Bard: Expertise" (line ~2902)',
      },
      {
        name: 'Jack of All Trades',
        level: 2,
        effect: 'Add half your Proficiency Bonus (round down) to ability checks that use a skill you lack proficiency in and that do not already add your PB.',
        source: 'PHB 2024 "Bard: Jack of All Trades" (line ~2906)',
      },
      {
        name: 'Bard Subclass',
        level: 3,
        effect: 'Choose a Bard subclass; you gain its features of your Bard level or lower.',
        kind: 'subclass-choice',
        source: 'PHB 2024 "Bard: Bard Subclass" (line ~2910)',
      },
      {
        name: 'Ability Score Improvement',
        level: 4,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for (repeats at 8, 12, 16).',
        kind: 'asi-marker',
        source: 'PHB 2024 "Bard: Ability Score Improvement" (line ~2922)',
      },
      {
        name: 'Font of Inspiration',
        level: 5,
        effect: 'Regain all Bardic Inspiration uses on a Short or Long Rest; you can also expend a spell slot (no action) to regain one use.',
        source: 'PHB 2024 "Bard: Font of Inspiration" (line ~2926)',
      },
      {
        name: 'Countercharm',
        level: 7,
        effect: 'When you or a creature within 30 feet fails a save against being Charmed or Frightened, use a Reaction to reroll it with Advantage.',
        source: 'PHB 2024 "Bard: Countercharm" (line ~2930)',
      },
      {
        name: 'Ability Score Improvement',
        level: 8,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Bard: Ability Score Improvement" (line ~2922)',
      },
      {
        name: 'Expertise',
        level: 9,
        effect: 'Gain Expertise in two more of your skill proficiencies.',
        mechanics: { skillsAtLevel9: 2 },
        source: 'PHB 2024 "Bard: Expertise" (line ~2902)',
      },
      {
        name: 'Magical Secrets',
        level: 10,
        effect: 'Whenever your prepared-spells number increases, new picks can be drawn from the Bard, Cleric, Druid, and Wizard spell lists; replacements too.',
        source: 'PHB 2024 "Bard: Magical Secrets" (line ~2934)',
      },
      {
        name: 'Ability Score Improvement',
        level: 12,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Bard: Ability Score Improvement" (line ~2922)',
      },
      {
        name: 'Ability Score Improvement',
        level: 16,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Bard: Ability Score Improvement" (line ~2922)',
      },
      {
        name: 'Superior Inspiration',
        level: 18,
        effect: 'When you roll Initiative, regain expended Bardic Inspiration uses until you have two if you have fewer.',
        source: 'PHB 2024 "Bard: Superior Inspiration" (line ~2936)',
      },
      {
        name: 'Epic Boon',
        level: 19,
        effect: 'Gain an Epic Boon feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Bard: Epic Boon" (line ~2938)',
      },
      {
        name: 'Words of Creation',
        level: 20,
        effect: 'You always have Power Word Heal and Power Word Kill prepared; when you cast either, you can target a second creature within 10 feet of the first.',
        source: 'PHB 2024 "Bard: Words of Creation" (line ~2940)',
      },
    ],
    subclasses: [
      { id: 'dance', name: 'College of Dance', srd: 'non-srd', features: [], source: 'PHB 2024 "Bard: Bard Subclass" (line ~2809)' },
      { id: 'glamour', name: 'College of Glamour', srd: 'non-srd', features: [], source: 'PHB 2024 "Bard: Bard Subclass" (line ~2809)' },
      { id: 'lore', name: 'College of Lore', srd: 'non-srd', features: [], source: 'PHB 2024 "Bard: Bard Subclass" (line ~2809)' },
      { id: 'valor', name: 'College of Valor', srd: 'non-srd', features: [], source: 'PHB 2024 "Bard: Bard Subclass" (line ~2809)' },
    ],
    // PHB 2024 "Bard: As a Multiclass Character" (line ~2716): one skill of your choice, one Musical Instrument, Light armor training.
    multiclassProficiencies: { armor: ['light'], martialWeapons: false, skills: 1, tools: ['musical-instrument'] },
  },

  // PHB 2024 "CORE CLERIC TRAITS" / "CLERIC FEATURES" (line ~3119/~3178).
  cleric: {
    id: 'cleric',
    name: 'Cleric',
    hitDie: 8, // PHB 2024 "Core Cleric Traits": Hit Point Die D8 (line ~3122).
    primaryAbilities: ['wis'], // PHB 2024 "Core Cleric Traits": Primary Ability Wisdom (line ~3122).
    savingThrows: ['wis', 'cha'], // PHB 2024 "Core Cleric Traits": Wis & Cha saves (line ~3122).
    // PHB 2024 "Core Cleric Traits": Choose 2 skills (line ~3122).
    skillChoices: {
      count: 2,
      from: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
    },
    armorTraining: ['Light armor', 'Medium armor', 'Shields'], // PHB 2024 "Core Cleric Traits" (line ~3122).
    weaponProficiencies: ['Simple weapons'], // PHB 2024 "Core Cleric Traits" (line ~3122).
    weaponProficiency: { simple: true, martial: false }, // structured form of the line above (Stage A5d)
    toolProficiencies: [],
    startingEquipment:
      "(A) Chain Shirt, Shield, Mace, Holy Symbol, Priest's Pack, 7 GP; or (B) 110 GP", // PHB 2024 "Core Cleric Traits" (line ~3122).
    subclassLevel: 3, // PHB 2024 "Cleric Features": Cleric Subclass at level 3 (line ~3197).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Cleric Traits" / "Cleric Features"',
    features: [
      {
        name: 'Spellcasting',
        level: 1,
        effect: 'Cast Cleric spells using Wisdom; prepare a changeable list, know cantrips, and use a Holy Symbol as a Spellcasting Focus. Slots per the Cleric Features table.',
        mechanics: { spellcastingAbility: 'wis', cantripsAtLevel1: 3, preparedAtLevel1: 4 },
        source: 'PHB 2024 "Cleric: Spellcasting" (line ~3178)',
      },
      {
        name: 'Divine Order',
        level: 1,
        effect: 'Choose Protector (Martial weapons + Heavy armor training) or Thaumaturge (an extra cantrip + a bonus to Arcana/Religion checks equal to your Wis mod, min +1).',
        source: 'PHB 2024 "Cleric: Divine Order" (line ~3208)',
      },
      {
        name: 'Channel Divinity',
        level: 2,
        effect: 'Fuel Divine Spark (heal or deal Necrotic/Radiant via a 1d8 + Wis mod) and Turn Undead; limited uses that scale, with the extra d8 growing at levels 7/13/18.',
        mechanics: { usesAtLevel2: 2 },
        source: 'PHB 2024 "Cleric: Channel Divinity" (line ~3213)',
      },
      {
        name: 'Cleric Subclass',
        level: 3,
        effect: 'Choose a Cleric subclass; you gain its features of your Cleric level or lower.',
        kind: 'subclass-choice',
        source: 'PHB 2024 "Cleric: Cleric Subclass" (line ~3221)',
      },
      {
        name: 'Ability Score Improvement',
        level: 4,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for (repeats at 8, 12, 16).',
        kind: 'asi-marker',
        source: 'PHB 2024 "Cleric: Ability Score Improvement" (line ~3223)',
      },
      {
        name: 'Sear Undead',
        level: 5,
        effect: 'When you use Turn Undead, Undead that fail take Radiant damage equal to a roll of Wis-mod d8s (min 1d8).',
        source: 'PHB 2024 "Cleric: Sear Undead" (line ~3225)',
      },
      {
        name: 'Blessed Strikes',
        level: 7,
        effect: 'Choose Divine Strike (once per turn, +1d8 Necrotic/Radiant on a weapon hit) or Potent Spellcasting (add Wis mod to Cleric cantrip damage).',
        mechanics: { divineStrikeDice: '1d8' },
        source: 'PHB 2024 "Cleric: Blessed Strikes" (line ~3231)',
      },
      {
        name: 'Ability Score Improvement',
        level: 8,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Cleric: Ability Score Improvement" (line ~3223)',
      },
      {
        name: 'Divine Intervention',
        level: 10,
        effect: 'As a Magic action, cast one Cleric spell of level 5 or lower (no Reaction-cast spells) without a slot or Material components; once per Long Rest.',
        source: 'PHB 2024 "Cleric: Divine Intervention" (line ~3233)',
      },
      {
        name: 'Ability Score Improvement',
        level: 12,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Cleric: Ability Score Improvement" (line ~3223)',
      },
      {
        name: 'Improved Blessed Strikes',
        level: 14,
        effect: 'Your Blessed Strikes option improves: Divine Strike rises to 2d8, or Potent Spellcasting grants Temp HP equal to twice your Wis mod on a cantrip hit.',
        mechanics: { divineStrikeDice: '2d8' },
        source: 'PHB 2024 "Cleric: Improved Blessed Strikes" (line ~3235)',
      },
      {
        name: 'Ability Score Improvement',
        level: 16,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Cleric: Ability Score Improvement" (line ~3223)',
      },
      {
        name: 'Epic Boon',
        level: 19,
        effect: 'Gain an Epic Boon feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Cleric Features: Epic Boon" (line ~3257)',
      },
      {
        name: 'Greater Divine Intervention',
        level: 20,
        effect: 'Your Divine Intervention improves, letting you call on a more powerful effect as described by the feature.',
        source: 'PHB 2024 "Cleric Features: Greater Divine Intervention" (line ~3257)',
      },
    ],
    subclasses: [
      { id: 'life', name: 'Life Domain', srd: 'non-srd', features: [], source: 'PHB 2024 "Cleric: Cleric Subclass" (line ~3221)' },
      { id: 'light', name: 'Light Domain', srd: 'non-srd', features: [], source: 'PHB 2024 "Cleric: Cleric Subclass" (line ~3221)' },
      { id: 'trickery', name: 'Trickery Domain', srd: 'non-srd', features: [], source: 'PHB 2024 "Cleric: Cleric Subclass" (line ~3221)' },
      { id: 'war', name: 'War Domain', srd: 'non-srd', features: [], source: 'PHB 2024 "Cleric: Cleric Subclass" (line ~3221)' },
    ],
    // PHB 2024 "Cleric: As a Multiclass Character" (line ~3158): training with Light and Medium armor and Shields.
    multiclassProficiencies: { armor: ['light', 'medium', 'shields'], martialWeapons: false, skills: 0, tools: [] },
  },

  // PHB 2024 "CORE DRUID TRAITS" / "DRUID FEATURES" (line ~3587/~3633).
  druid: {
    id: 'druid',
    name: 'Druid',
    hitDie: 8, // PHB 2024 "Core Druid Traits": Hit Point Die D8 (line ~3587).
    primaryAbilities: ['wis'], // PHB 2024 "Core Druid Traits": Primary Ability Wisdom (line ~3587).
    savingThrows: ['int', 'wis'], // PHB 2024 "Core Druid Traits": Int & Wis saves (line ~3587).
    // PHB 2024 "Core Druid Traits": Choose 2 skills (line ~3586).
    skillChoices: {
      count: 2,
      from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
    },
    armorTraining: ['Light armor', 'Shields'], // PHB 2024 "Core Druid Traits" (line ~3590).
    weaponProficiencies: ['Simple weapons'], // PHB 2024 "Core Druid Traits" (line ~3590).
    weaponProficiency: { simple: true, martial: false }, // structured form of the line above (Stage A5d)
    toolProficiencies: ['Herbalism Kit'], // PHB 2024 "Core Druid Traits" (line ~3590).
    startingEquipment:
      "(A) Leather Armor, Shield, Sickle, Druidic Focus (Quarterstaff), Explorer's Pack, Herbalism Kit, 9 GP; or (B) 50 GP", // PHB 2024 "Core Druid Traits" (line ~3590).
    subclassLevel: 3, // PHB 2024 "Druid: Druid Subclass" at level 3 (line ~3710).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Druid Traits" / "Druid Features"',
    // PHB 2024 p.78: Druid features by level (features table line ~3633; descriptions line ~3647).
    features: [
      {
        name: 'Spellcasting',
        level: 1,
        effect: 'Cast Druid spells using Wisdom; prepare a changeable list, know cantrips, and use a Druidic Focus as a Spellcasting Focus. Slots per the Druid Features table.',
        mechanics: { spellcastingAbility: 'wis', cantripsAtLevel1: 2, preparedAtLevel1: 4 },
        source: 'PHB 2024 "Druid: Spellcasting" (line ~3613)',
      },
      {
        name: 'Druidic',
        level: 1,
        effect: 'You know Druidic, the secret language of Druids, and always have Speak with Animals prepared; you can leave hidden Druidic messages.',
        source: 'PHB 2024 "Druid: Druidic" (line ~3653)',
      },
      {
        name: 'Primal Order',
        level: 1,
        effect: 'Choose Warden (Martial weapons + Medium armor training) or Magician (an extra cantrip + a bonus to Arcana/Nature checks equal to your Wis mod, min +1).',
        source: 'PHB 2024 "Druid: Primal Order" (line ~3659)',
      },
      {
        name: 'Wild Shape',
        level: 2,
        effect: 'As a Bonus Action, shape-shift into a known Beast form for hours equal to half your Druid level; gain Temp HP equal to your level. Uses scale per the Wild Shape column.',
        mechanics: { usesAtLevel2: 2, knownFormsAtLevel2: 4 },
        source: 'PHB 2024 "Druid: Wild Shape" (line ~3665)',
      },
      {
        name: 'Wild Companion',
        level: 2,
        effect: 'As a Magic action, expend a spell slot or a Wild Shape use to cast Find Familiar without Material components; the Fey familiar lasts until a Long Rest.',
        source: 'PHB 2024 "Druid: Wild Companion" (line ~3697)',
      },
      {
        name: 'Druid Subclass',
        level: 3,
        effect: 'Choose a Druid subclass; you gain its features of your Druid level or lower.',
        kind: 'subclass-choice',
        source: 'PHB 2024 "Druid: Druid Subclass" (line ~3701)',
      },
      {
        name: 'Ability Score Improvement',
        level: 4,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for (repeats at 8, 12, 16).',
        kind: 'asi-marker',
        source: 'PHB 2024 "Druid: Ability Score Improvement" (line ~3713)',
      },
      {
        name: 'Wild Resurgence',
        level: 5,
        effect: 'Once per turn, if out of Wild Shape uses, expend a spell slot (no action) to regain one; or expend a Wild Shape use (no action) to gain a level 1 slot, once per Long Rest.',
        source: 'PHB 2024 "Druid: Wild Resurgence" (line ~3717)',
      },
      {
        name: 'Elemental Fury',
        level: 7,
        effect: 'Choose Potent Spellcasting (add Wis mod to Druid cantrip damage) or Primal Strike (once per turn, +1d8 Cold/Fire/Lightning/Thunder on a weapon or Wild Shape attack hit).',
        mechanics: { primalStrikeDice: '1d8' },
        source: 'PHB 2024 "Druid: Elemental Fury" (line ~3723)',
      },
      {
        name: 'Ability Score Improvement',
        level: 8,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Druid: Ability Score Improvement" (line ~3713)',
      },
      {
        name: 'Ability Score Improvement',
        level: 12,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Druid: Ability Score Improvement" (line ~3713)',
      },
      {
        name: 'Improved Elemental Fury',
        level: 15,
        effect: 'Your Elemental Fury option improves: Potent Spellcasting increases a Druid cantrip\'s range by 300 feet (only cantrips with a range of 10 feet or greater), or Primal Strike rises to 2d8.',
        mechanics: { primalStrikeDice: '2d8' },
        source: 'PHB 2024 "Druid: Improved Elemental Fury" (line ~3731)',
      },
      {
        name: 'Ability Score Improvement',
        level: 16,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Druid: Ability Score Improvement" (line ~3713)',
      },
      {
        name: 'Beast Spells',
        level: 18,
        effect: 'While using Wild Shape, you can cast spells in Beast form, except spells with a costly or consumed Material component.',
        source: 'PHB 2024 "Druid: Beast Spells" (line ~3737)',
      },
      {
        name: 'Epic Boon',
        level: 19,
        effect: 'Gain an Epic Boon feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Druid: Epic Boon" (line ~3741)',
      },
      {
        name: 'Archdruid',
        level: 20,
        effect: 'Regain a Wild Shape use on Initiative when out; convert Wild Shape uses into a spell slot (2 levels each, once per Long Rest); you age ten times more slowly.',
        source: 'PHB 2024 "Druid: Archdruid" (line ~3745)',
      },
    ],
    subclasses: [
      { id: 'land', name: 'Circle of the Land', srd: 'non-srd', features: [], source: 'PHB 2024 "Druid: Druid Subclass" (line ~3713)' },
      { id: 'moon', name: 'Circle of the Moon', srd: 'non-srd', features: [], source: 'PHB 2024 "Druid: Druid Subclass" (line ~3713)' },
      { id: 'sea', name: 'Circle of the Sea', srd: 'non-srd', features: [], source: 'PHB 2024 "Druid: Druid Subclass" (line ~3713)' },
      { id: 'stars', name: 'Circle of the Stars', srd: 'non-srd', features: [], source: 'PHB 2024 "Druid: Druid Subclass" (line ~3713)' },
    ],
    // PHB 2024 "Druid: As a Multiclass Character" (line ~3606): training with Light armor and Shields.
    multiclassProficiencies: { armor: ['light', 'shields'], martialWeapons: false, skills: 0, tools: [] },
  },

  // PHB 2024 "CORE FIGHTER TRAITS" / "FIGHTER FEATURES" (line ~4086/~4156).
  fighter: {
    id: 'fighter',
    name: 'Fighter',
    hitDie: 10, // PHB 2024 "Core Fighter Traits": Hit Point Die D10 (line ~4089).
    primaryAbilities: ['str', 'dex'], // PHB 2024 "Core Fighter Traits": Str or Dex (line ~4089).
    savingThrows: ['str', 'con'], // PHB 2024 "Core Fighter Traits": Str & Con saves (line ~4089).
    // PHB 2024 "Core Fighter Traits": Choose 2 skills (line ~4089).
    skillChoices: {
      count: 2,
      from: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'persuasion', 'perception', 'survival'],
    },
    armorTraining: ['Light armor', 'Medium armor', 'Heavy armor', 'Shields'], // PHB 2024 "Core Fighter Traits" (line ~4089).
    weaponProficiencies: ['Simple weapons', 'Martial weapons'], // PHB 2024 "Core Fighter Traits" (line ~4089).
    weaponProficiency: { simple: true, martial: true }, // structured form of the line above (Stage A5d)
    toolProficiencies: [],
    startingEquipment:
      "(A) Chain Mail, Greatsword, Flail, 8 Javelins, Dungeoneer's Pack, 4 GP; (B) Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Dungeoneer's Pack, 11 GP; or (C) 155 GP", // PHB 2024 "Core Fighter Traits" (line ~4089).
    subclassLevel: 3, // PHB 2024 "Fighter: Fighter Subclass" at level 3 (line ~4181).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Fighter Traits" / "Fighter Features"',
    // PHB 2024 p.90: Fighter features by level (features table line ~4156; descriptions line ~4106).
    features: [
      {
        name: 'Fighting Style',
        level: 1,
        effect: 'Gain a Fighting Style feat of your choice; you can swap it for another Fighting Style feat whenever you gain a Fighter level.',
        source: 'PHB 2024 "Fighter: Fighting Style" (line ~4108)',
      },
      {
        name: 'Second Wind',
        level: 1,
        effect: 'As a Bonus Action, regain 1d10 + Fighter level Hit Points. Uses scale per the Second Wind column; regain one on a Short Rest, all on a Long Rest.',
        mechanics: { usesAtLevel1: 2 },
        source: 'PHB 2024 "Fighter: Second Wind" (line ~4112)',
      },
      {
        name: 'Weapon Mastery',
        level: 1,
        effect: 'Use the mastery property of three kinds of Simple/Martial weapons you are proficient with; swap one on a Long Rest. The number grows per the Weapon Mastery column.',
        mechanics: { weaponsAtLevel1: 3 },
        source: 'PHB 2024 "Fighter: Weapon Mastery" (line ~4122)',
      },
      {
        name: 'Action Surge',
        level: 2,
        effect: 'On your turn, take one extra action (not the Magic action); once per Short or Long Rest. At level 17 you can use it twice per rest but only once per turn.',
        mechanics: { usesAtLevel2: 1 },
        source: 'PHB 2024 "Fighter: Action Surge" (line ~4147)',
      },
      {
        name: 'Tactical Mind',
        level: 2,
        effect: 'When you fail an ability check, expend a use of Second Wind to roll 1d10 and add it; if the check still fails, the use is not expended.',
        source: 'PHB 2024 "Fighter: Tactical Mind" (line ~4153)',
      },
      {
        name: 'Fighter Subclass',
        level: 3,
        effect: 'Choose a Fighter subclass; you gain its features of your Fighter level or lower.',
        kind: 'subclass-choice',
        source: 'PHB 2024 "Fighter: Fighter Subclass" (line ~4181)',
      },
      {
        name: 'Ability Score Improvement',
        level: 4,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for (repeats at 6, 8, 12, 14, 16).',
        kind: 'asi-marker',
        source: 'PHB 2024 "Fighter: Ability Score Improvement" (line ~4185)',
      },
      {
        name: 'Extra Attack',
        level: 5,
        effect: 'Attack twice instead of once when you take the Attack action.',
        mechanics: { attacks: 2 },
        source: 'PHB 2024 "Fighter: Extra Attack" (line ~4189)',
      },
      {
        name: 'Tactical Shift',
        level: 5,
        effect: 'When you activate Second Wind with a Bonus Action, move up to half your Speed without provoking Opportunity Attacks.',
        source: 'PHB 2024 "Fighter: Tactical Shift" (line ~4193)',
      },
      {
        name: 'Ability Score Improvement',
        level: 6,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Fighter: Ability Score Improvement" (line ~4185)',
      },
      {
        name: 'Ability Score Improvement',
        level: 8,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Fighter: Ability Score Improvement" (line ~4185)',
      },
      {
        name: 'Indomitable',
        level: 9,
        effect: 'When you fail a saving throw, reroll it with a bonus equal to your Fighter level (use the new roll). Uses grow to two at level 13 and three at level 17.',
        mechanics: { usesAtLevel9: 1 },
        source: 'PHB 2024 "Fighter: Indomitable" (line ~4197)',
      },
      {
        name: 'Tactical Master',
        level: 9,
        effect: 'When attacking with a weapon whose mastery property you can use, you can swap that property for Push, Sap, or Slow for that attack.',
        source: 'PHB 2024 "Fighter: Tactical Master" (line ~4203)',
      },
      {
        name: 'Two Extra Attacks',
        level: 11,
        effect: 'Attack three times instead of once when you take the Attack action.',
        mechanics: { attacks: 3 },
        source: 'PHB 2024 "Fighter: Two Extra Attacks" (line ~4207)',
      },
      {
        name: 'Ability Score Improvement',
        level: 12,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Fighter: Ability Score Improvement" (line ~4185)',
      },
      {
        name: 'Indomitable',
        level: 13,
        effect: 'Your Indomitable uses increase to two per Long Rest.',
        mechanics: { usesAtLevel13: 2 },
        source: 'PHB 2024 "Fighter: Indomitable" (line ~4197)',
      },
      {
        name: 'Studied Attacks',
        level: 13,
        effect: 'When you miss a creature with an attack roll, you have Advantage on your next attack roll against it before the end of your next turn.',
        source: 'PHB 2024 "Fighter: Studied Attacks" (line ~4211)',
      },
      {
        name: 'Ability Score Improvement',
        level: 14,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Fighter: Ability Score Improvement" (line ~4185)',
      },
      {
        name: 'Ability Score Improvement',
        level: 16,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Fighter: Ability Score Improvement" (line ~4185)',
      },
      {
        name: 'Action Surge',
        level: 17,
        effect: 'Your Action Surge uses increase to two per Short or Long Rest, but you can use it only once on a turn.',
        mechanics: { usesAtLevel17: 2 },
        source: 'PHB 2024 "Fighter: Action Surge" (line ~4147)',
      },
      {
        name: 'Indomitable',
        level: 17,
        effect: 'Your Indomitable uses increase to three per Long Rest.',
        mechanics: { usesAtLevel17: 3 },
        source: 'PHB 2024 "Fighter: Indomitable" (line ~4197)',
      },
      {
        name: 'Epic Boon',
        level: 19,
        effect: 'Gain an Epic Boon feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Fighter: Epic Boon" (line ~4215)',
      },
      {
        name: 'Three Extra Attacks',
        level: 20,
        effect: 'Attack four times instead of once when you take the Attack action.',
        mechanics: { attacks: 4 },
        source: 'PHB 2024 "Fighter: Three Extra Attacks" (line ~4219)',
      },
    ],
    subclasses: [
      { id: 'battleMaster', name: 'Battle Master', srd: 'non-srd', features: [], source: 'PHB 2024 "Fighter: Fighter Subclass" (line ~4184)' },
      { id: 'champion', name: 'Champion', srd: 'non-srd', features: [], source: 'PHB 2024 "Fighter: Fighter Subclass" (line ~4184)' },
      { id: 'eldritchKnight', name: 'Eldritch Knight', srd: 'non-srd', features: [], source: 'PHB 2024 "Fighter: Fighter Subclass" (line ~4184)' },
      { id: 'psiWarrior', name: 'Psi Warrior', srd: 'non-srd', features: [], source: 'PHB 2024 "Fighter: Fighter Subclass" (line ~4184)' },
    ],
    // PHB 2024 "Fighter: As a Multiclass Character" (line ~4137): Martial weapons, training with Light and Medium armor and Shields.
    multiclassProficiencies: { armor: ['light', 'medium', 'shields'], martialWeapons: true, skills: 0, tools: [] },
  },

  // PHB 2024 "CORE MONK TRAITS" / "MONK FEATURES" (line ~4479/~4544).
  monk: {
    id: 'monk',
    name: 'Monk',
    hitDie: 8, // PHB 2024 "Core Monk Traits": Hit Point Die D8 (line ~4481).
    primaryAbilities: ['dex', 'wis'], // PHB 2024 "Core Monk Traits": Dex & Wis (line ~4481).
    savingThrows: ['str', 'dex'], // PHB 2024 "Core Monk Traits": Str & Dex saves (line ~4481).
    // PHB 2024 "Core Monk Traits": Choose 2 skills (line ~4481).
    skillChoices: {
      count: 2,
      from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
    },
    armorTraining: [], // PHB 2024 "Core Monk Traits": None (line ~4481).
    weaponProficiencies: ['Simple weapons', 'Martial weapons with the Light property'], // PHB 2024 "Core Monk Traits" (line ~4481).
    weaponProficiency: { simple: true, martial: false, martialWithAnyOf: ['light'] }, // structured form of the line above (Stage A5d)
    toolProficiencies: ["One type of Artisan's Tools or Musical Instrument"], // PHB 2024 "Core Monk Traits" (line ~4481).
    startingEquipment:
      "(A) Spear, 5 Daggers, Artisan's Tools or Musical Instrument, Explorer's Pack, 11 GP; or (B) 50 GP", // PHB 2024 "Core Monk Traits".
    subclassLevel: 3, // PHB 2024 "Monk Features": Monk Subclass at level 3 (line ~4544).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Monk Traits" / "Monk Features"',
    // PHB 2024 p.100: Monk features by level (features table line ~4544; descriptions line ~4513).
    features: [
      {
        name: 'Martial Arts',
        level: 1,
        effect: 'While unarmed or wielding only Monk weapons and no armor/shield: make a Bonus Action Unarmed Strike, use Dex for attacks, and roll a Martial Arts die for damage. The die grows per the table.',
        mechanics: { die: 'd6', dieAt5: 'd8', dieAt11: 'd10', dieAt17: 'd12' },
        source: 'PHB 2024 "Monk: Martial Arts" (line ~4515)',
      },
      {
        name: 'Unarmored Defense',
        level: 1,
        effect: 'While wearing no armor and no Shield, base AC equals 10 + Dex modifier + Wis modifier.',
        mechanics: { acBase: 10 },
        source: 'PHB 2024 "Monk: Unarmored Defense" (line ~4538)',
      },
      {
        name: "Monk's Focus",
        level: 2,
        effect: 'Gain Focus Points (equal to your Monk level) to fuel Flurry of Blows, Patient Defense, and Step of the Wind; regain all on a Short or Long Rest. Save DC is 8 + Wis mod + PB.',
        mechanics: { focusPointsAtLevel2: 2 },
        source: 'PHB 2024 "Monk: Monk\'s Focus" (line ~4540)',
      },
      {
        name: 'Unarmored Movement',
        level: 2,
        effect: 'Speed increases by 10 feet while you wear no armor and wield no Shield; the bonus grows with level (up to +30 feet).',
        mechanics: { speedBonusFt: 10 },
        source: 'PHB 2024 "Monk: Unarmored Movement" (line ~4583)',
      },
      {
        name: 'Uncanny Metabolism',
        level: 2,
        effect: 'When you roll Initiative, regain all Focus Points and heal your Monk level plus a Martial Arts die; once per Long Rest.',
        source: 'PHB 2024 "Monk: Uncanny Metabolism" (line ~4587)',
      },
      {
        name: 'Deflect Attacks',
        level: 3,
        effect: 'When hit by an attack dealing Bludgeoning/Piercing/Slashing, use a Reaction to reduce damage by 1d10 + Dex mod + Monk level; if reduced to 0, spend 1 Focus Point to redirect force.',
        source: 'PHB 2024 "Monk: Deflect Attacks" (line ~4591)',
      },
      {
        name: 'Monk Subclass',
        level: 3,
        effect: 'Choose a Monk subclass; you gain its features of your Monk level or lower.',
        kind: 'subclass-choice',
        source: 'PHB 2024 "Monk: Monk Subclass" (line ~4595)',
      },
      {
        name: 'Ability Score Improvement',
        level: 4,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for (repeats at 8, 12, 16).',
        kind: 'asi-marker',
        source: 'PHB 2024 "Monk: Ability Score Improvement" (line ~4599)',
      },
      {
        name: 'Slow Fall',
        level: 4,
        effect: 'Use a Reaction when you fall to reduce the fall damage by five times your Monk level.',
        source: 'PHB 2024 "Monk: Slow Fall" (line ~4603)',
      },
      {
        name: 'Extra Attack',
        level: 5,
        effect: 'Attack twice instead of once when you take the Attack action.',
        mechanics: { attacks: 2 },
        source: 'PHB 2024 "Monk: Extra Attack" (line ~4607)',
      },
      {
        name: 'Stunning Strike',
        level: 5,
        effect: 'Once per turn on a hit with a Monk weapon or Unarmed Strike, spend 1 Focus Point to force a Con save. On a failure the target is Stunned until the start of your next turn; on a success its Speed is halved and the next attack roll against it has Advantage, until the start of your next turn.',
        source: 'PHB 2024 "Monk: Stunning Strike" (line ~4611)',
      },
      {
        name: 'Empowered Strikes',
        level: 6,
        effect: 'Your Unarmed Strikes can deal Force damage instead of their normal type.',
        source: 'PHB 2024 "Monk: Empowered Strikes" (line ~4615)',
      },
      {
        name: 'Evasion',
        level: 7,
        effect: 'On a Dexterity save for half damage, take no damage on a success and half on a failure (not while Incapacitated).',
        source: 'PHB 2024 "Monk: Evasion" (line ~4621)',
      },
      {
        name: 'Ability Score Improvement',
        level: 8,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Monk: Ability Score Improvement" (line ~4599)',
      },
      {
        name: 'Acrobatic Movement',
        level: 9,
        effect: 'While wearing no armor and no Shield, you can move along vertical surfaces and across liquids without falling during the move.',
        source: 'PHB 2024 "Monk: Acrobatic Movement" (line ~4625)',
      },
      {
        name: 'Heightened Focus',
        level: 10,
        effect: 'Flurry of Blows makes three strikes; Patient Defense grants Temp HP of two Martial Arts die rolls; Step of the Wind can pull a willing ally along.',
        source: 'PHB 2024 "Monk: Heightened Focus" (line ~4629)',
      },
      {
        name: 'Self-Restoration',
        level: 10,
        effect: 'At the end of each turn, remove Charmed, Frightened, or Poisoned from yourself; going without food/drink gives you no Exhaustion.',
        source: 'PHB 2024 "Monk: Self-Restoration" (line ~4635)',
      },
      {
        name: 'Ability Score Improvement',
        level: 12,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Monk: Ability Score Improvement" (line ~4599)',
      },
      {
        name: 'Deflect Energy',
        level: 13,
        effect: 'You can use Deflect Attacks against attacks dealing any damage type, not just Bludgeoning/Piercing/Slashing.',
        source: 'PHB 2024 "Monk: Deflect Energy" (line ~4639)',
      },
      {
        name: 'Disciplined Survivor',
        level: 14,
        effect: 'Gain proficiency in all saving throws; when you fail a save, spend 1 Focus Point to reroll and use the new roll.',
        source: 'PHB 2024 "Monk: Disciplined Survivor" (line ~4643)',
      },
      {
        name: 'Perfect Focus',
        level: 15,
        effect: 'When you roll Initiative and do not use Uncanny Metabolism, regain Focus Points until you have 4 if you have 3 or fewer.',
        source: 'PHB 2024 "Monk: Perfect Focus" (line ~4647)',
      },
      {
        name: 'Ability Score Improvement',
        level: 16,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Monk: Ability Score Improvement" (line ~4599)',
      },
      {
        name: 'Superior Defense',
        level: 18,
        effect: 'At the start of your turn, spend 3 Focus Points to gain Resistance to all damage except Force for 1 minute or until Incapacitated.',
        source: 'PHB 2024 "Monk: Superior Defense" (line ~4651)',
      },
      {
        name: 'Epic Boon',
        level: 19,
        effect: 'Gain an Epic Boon feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Monk: Epic Boon" (line ~4655)',
      },
      {
        name: 'Body and Mind',
        level: 20,
        effect: 'Your Dexterity and Wisdom scores increase by 4, to a maximum of 25.',
        mechanics: { dexIncrease: 4, wisIncrease: 4, scoreMax: 25 },
        source: 'PHB 2024 "Monk: Body and Mind" (line ~4659)',
      },
    ],
    subclasses: [
      { id: 'elements', name: 'Warrior of the Elements', srd: 'non-srd', features: [], source: 'PHB 2024 "Monk Subclasses" (Chapter 3)' },
      { id: 'mercy', name: 'Warrior of Mercy', srd: 'non-srd', features: [], source: 'PHB 2024 "Monk Subclasses" (Chapter 3)' },
      { id: 'openHand', name: 'Warrior of the Open Hand', srd: 'non-srd', features: [], source: 'PHB 2024 "Monk Subclasses" (Chapter 3)' },
      { id: 'shadow', name: 'Warrior of Shadow', srd: 'non-srd', features: [], source: 'PHB 2024 "Monk Subclasses" (Chapter 3)' },
    ],
    // PHB 2024 "Monk: As a Multiclass Character" (line ~4509): nothing beyond the Hit Point Die.
    multiclassProficiencies: { armor: [], martialWeapons: false, skills: 0, tools: [] },
  },

  // PHB 2024 "CORE PALADIN TRAITS" / "PALADIN FEATURES" (line ~4817/~4871).
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    hitDie: 10, // PHB 2024 "Core Paladin Traits": Hit Point Die D10 (line ~4820).
    primaryAbilities: ['str', 'cha'], // PHB 2024 "Core Paladin Traits": Str & Cha (line ~4820).
    savingThrows: ['wis', 'cha'], // PHB 2024 "Core Paladin Traits": Wis & Cha saves (line ~4820).
    // PHB 2024 "Core Paladin Traits": Choose 2 skills (line ~4820).
    skillChoices: {
      count: 2,
      from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
    },
    armorTraining: ['Light armor', 'Medium armor', 'Heavy armor', 'Shields'], // PHB 2024 "Core Paladin Traits" (line ~4820).
    weaponProficiencies: ['Simple weapons', 'Martial weapons'], // PHB 2024 "Core Paladin Traits" (line ~4820).
    weaponProficiency: { simple: true, martial: true }, // structured form of the line above (Stage A5d)
    toolProficiencies: [],
    startingEquipment:
      "(A) Chain Mail, Shield, Longsword, 6 Javelins, Holy Symbol, Priest's Pack, 9 GP; or (B) 150 GP", // PHB 2024 "Core Paladin Traits" (line ~4820).
    subclassLevel: 3, // PHB 2024 "Paladin Features": Paladin Subclass at level 3 (line ~4871).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Paladin Traits" / "Paladin Features"',
    // PHB 2024 p.108: Paladin features by level (features table line ~4871; descriptions line ~4849).
    // Level 20 is a subclass feature (no class-level feature), so no row is added for it.
    features: [
      {
        name: 'Lay On Hands',
        level: 1,
        effect: 'A pool of healing equal to five times your Paladin level (refills on a Long Rest); as a Bonus Action, touch a creature to restore HP, or spend 5 to cure the Poisoned condition.',
        mechanics: { poolPerLevel: 5 },
        source: 'PHB 2024 "Paladin: Lay On Hands" (line ~4851)',
      },
      {
        name: 'Spellcasting',
        level: 1,
        effect: 'Cast Paladin spells using Charisma; prepare a changeable list and use a Holy Symbol as a Spellcasting Focus. Slots per the Paladin Features table.',
        mechanics: { spellcastingAbility: 'cha', preparedAtLevel1: 2 },
        source: 'PHB 2024 "Paladin: Spellcasting" (line ~4857)',
      },
      {
        name: 'Weapon Mastery',
        level: 1,
        effect: 'Use the mastery property of two kinds of weapons you are proficient with; swap your choices on a Long Rest.',
        mechanics: { weaponsAtLevel1: 2 },
        source: 'PHB 2024 "Paladin: Weapon Mastery" (line ~4893)',
      },
      {
        name: 'Fighting Style',
        level: 2,
        effect: 'Gain a Fighting Style feat, or instead choose Blessed Warrior (learn two Cleric cantrips cast with Charisma, swappable on level-up).',
        source: 'PHB 2024 "Paladin: Fighting Style" (line ~4899)',
      },
      {
        name: "Paladin's Smite",
        level: 2,
        effect: 'You always have Divine Smite prepared, and you can cast it once without a spell slot per Long Rest.',
        source: 'PHB 2024 "Paladin: Paladin\'s Smite" (line ~4905)',
      },
      {
        name: 'Channel Divinity',
        level: 3,
        effect: 'Channel divine energy for effects starting with Divine Sense. Use twice (regain one on a Short Rest, all on a Long Rest); a third use at level 11. Save DC equals your spell save DC.',
        mechanics: { usesAtLevel3: 2 },
        source: 'PHB 2024 "Paladin: Channel Divinity" (line ~4909)',
      },
      {
        name: 'Paladin Subclass',
        level: 3,
        effect: 'Choose a Paladin subclass; you gain its features of your Paladin level or lower.',
        kind: 'subclass-choice',
        source: 'PHB 2024 "Paladin: Paladin Subclass" (line ~4921)',
      },
      {
        name: 'Ability Score Improvement',
        level: 4,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for (repeats at 8, 12, 16).',
        kind: 'asi-marker',
        source: 'PHB 2024 "Paladin: Ability Score Improvement" (line ~4925)',
      },
      {
        name: 'Extra Attack',
        level: 5,
        effect: 'Attack twice instead of once when you take the Attack action.',
        mechanics: { attacks: 2 },
        source: 'PHB 2024 "Paladin: Extra Attack" (line ~4929)',
      },
      {
        name: 'Faithful Steed',
        level: 5,
        effect: 'You always have Find Steed prepared, and you can cast it once without a spell slot per Long Rest.',
        source: 'PHB 2024 "Paladin: Faithful Steed" (line ~4933)',
      },
      {
        name: 'Aura of Protection',
        level: 6,
        effect: 'You and allies in a 10-foot Emanation gain a bonus to saving throws equal to your Cha modifier (min +1); inactive while Incapacitated.',
        source: 'PHB 2024 "Paladin: Aura of Protection" (line ~4937)',
      },
      {
        name: 'Ability Score Improvement',
        level: 8,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Paladin: Ability Score Improvement" (line ~4925)',
      },
      {
        name: 'Abjure Foes',
        level: 9,
        effect: 'As a Magic action, expend a Channel Divinity use to frighten up to your Cha mod (minimum 1) creatures within 60 feet (Wis save) for 1 minute or until they take damage. While Frightened this way, each turn a target may do only one of: move, take an action, or take a Bonus Action.',
        source: 'PHB 2024 "Paladin: Abjure Foes" (line ~4952)',
      },
      {
        name: 'Aura of Courage',
        level: 10,
        effect: 'You and allies in your Aura of Protection have Immunity to the Frightened condition.',
        source: 'PHB 2024 "Paladin: Aura of Courage" (line ~4957)',
      },
      {
        name: 'Radiant Strikes',
        level: 11,
        effect: 'When you hit with a Melee weapon or Unarmed Strike, the target takes an extra 1d8 Radiant damage.',
        mechanics: { extraDamageDice: '1d8' },
        source: 'PHB 2024 "Paladin: Radiant Strikes" (line ~4961)',
      },
      {
        name: 'Ability Score Improvement',
        level: 12,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Paladin: Ability Score Improvement" (line ~4925)',
      },
      {
        name: 'Restoring Touch',
        level: 14,
        effect: 'When you use Lay On Hands, spend 5 HP from the pool per condition to also remove Blinded, Charmed, Deafened, Frightened, Paralyzed, or Stunned.',
        source: 'PHB 2024 "Paladin: Restoring Touch" (line ~4965)',
      },
      {
        name: 'Ability Score Improvement',
        level: 16,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Paladin: Ability Score Improvement" (line ~4925)',
      },
      {
        name: 'Aura Expansion',
        level: 18,
        effect: 'Your Aura of Protection becomes a 30-foot Emanation.',
        source: 'PHB 2024 "Paladin: Aura Expansion" (line ~4969)',
      },
      {
        name: 'Epic Boon',
        level: 19,
        effect: 'Gain an Epic Boon feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Paladin: Epic Boon" (line ~4973)',
      },
    ],
    subclasses: [
      { id: 'devotion', name: 'Oath of Devotion', srd: 'non-srd', features: [], source: 'PHB 2024 "Paladin Subclasses" (Chapter 3)' },
      { id: 'glory', name: 'Oath of Glory', srd: 'non-srd', features: [], source: 'PHB 2024 "Paladin Subclasses" (Chapter 3)' },
      { id: 'ancients', name: 'Oath of the Ancients', srd: 'non-srd', features: [], source: 'PHB 2024 "Paladin Subclasses" (Chapter 3)' },
      { id: 'vengeance', name: 'Oath of Vengeance', srd: 'non-srd', features: [], source: 'PHB 2024 "Paladin Subclasses" (Chapter 3)' },
    ],
    // PHB 2024 "Paladin: As a Multiclass Character" (line ~4845): Martial weapons, training with Light and Medium armor and Shields.
    multiclassProficiencies: { armor: ['light', 'medium', 'shields'], martialWeapons: true, skills: 0, tools: [] },
  },

  // PHB 2024 "CORE RANGER TRAITS" / "RANGER FEATURES" (line ~5316/~5379).
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    hitDie: 10, // PHB 2024 "Core Ranger Traits": Hit Point Die D10 (line ~5319).
    primaryAbilities: ['dex', 'wis'], // PHB 2024 "Core Ranger Traits": Dex & Wis (line ~5319).
    savingThrows: ['str', 'dex'], // PHB 2024 "Core Ranger Traits": Str & Dex saves (line ~5319).
    // PHB 2024 "Core Ranger Traits": Choose 3 skills (line ~5331).
    skillChoices: {
      count: 3,
      from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
    },
    armorTraining: ['Light armor', 'Medium armor', 'Shields'], // PHB 2024 "Core Ranger Traits" (line ~5333).
    weaponProficiencies: ['Simple weapons', 'Martial weapons'], // PHB 2024 "Core Ranger Traits" (line ~5331).
    weaponProficiency: { simple: true, martial: true }, // structured form of the line above (Stage A5d)
    toolProficiencies: [],
    startingEquipment:
      "(A) Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Druidic Focus, Explorer's Pack, 7 GP; or (B) 150 GP", // PHB 2024 "Core Ranger Traits" (line ~5334).
    subclassLevel: 3, // PHB 2024 "Ranger: Ranger Subclass" at level 3 (line ~5424).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Ranger Traits" / "Ranger Features"',
    // PHB 2024 p.118: Ranger features by level (features table line ~5379; descriptions line ~5329).
    features: [
      {
        name: 'Spellcasting',
        level: 1,
        effect: 'Cast Ranger spells using Wisdom; prepare a changeable list and use a Druidic Focus as a Spellcasting Focus. Slots per the Ranger Features table.',
        mechanics: { spellcastingAbility: 'wis', preparedAtLevel1: 2 },
        source: 'PHB 2024 "Ranger: Spellcasting" (line ~5346)',
      },
      {
        name: 'Favored Enemy',
        level: 1,
        effect: 'You always have Hunter\u2019s Mark prepared and can cast it without a spell slot a number of times shown in the Favored Enemy column (regained on a Long Rest).',
        mechanics: { castsAtLevel1: 2 },
        source: 'PHB 2024 "Ranger: Favored Enemy" (line ~5373)',
      },
      {
        name: 'Weapon Mastery',
        level: 1,
        effect: 'Use the mastery property of two kinds of weapons you are proficient with; swap your choices on a Long Rest.',
        mechanics: { weaponsAtLevel1: 2 },
        source: 'PHB 2024 "Ranger: Weapon Mastery" (line ~5413)',
      },
      {
        name: 'Deft Explorer',
        level: 2,
        effect: 'Gain Expertise in one skill you are proficient in and learn two languages of your choice.',
        source: 'PHB 2024 "Ranger: Deft Explorer" (line ~5419)',
      },
      {
        name: 'Fighting Style',
        level: 2,
        effect: 'Gain a Fighting Style feat, or instead choose Druidic Warrior (learn two Druid cantrips cast with Wisdom, swappable on level-up).',
        source: 'PHB 2024 "Ranger: Fighting Style" (line ~5427)',
      },
      {
        name: 'Ranger Subclass',
        level: 3,
        effect: 'Choose a Ranger subclass; you gain its features of your Ranger level or lower.',
        kind: 'subclass-choice',
        source: 'PHB 2024 "Ranger: Ranger Subclass" (line ~5433)',
      },
      {
        name: 'Ability Score Improvement',
        level: 4,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for (repeats at 8, 12, 16).',
        kind: 'asi-marker',
        source: 'PHB 2024 "Ranger: Ability Score Improvement" (line ~5437)',
      },
      {
        name: 'Extra Attack',
        level: 5,
        effect: 'Attack twice instead of once when you take the Attack action.',
        mechanics: { attacks: 2 },
        source: 'PHB 2024 "Ranger: Extra Attack" (line ~5441)',
      },
      {
        name: 'Roving',
        level: 6,
        effect: 'Your Speed increases by 10 feet while not in Heavy armor, and you gain a Climb Speed and Swim Speed equal to your Speed.',
        mechanics: { speedBonusFt: 10 },
        source: 'PHB 2024 "Ranger: Roving" (line ~5445)',
      },
      {
        name: 'Ability Score Improvement',
        level: 8,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Ranger: Ability Score Improvement" (line ~5437)',
      },
      {
        name: 'Expertise',
        level: 9,
        effect: 'Gain Expertise in two of your skill proficiencies you lack Expertise in.',
        mechanics: { skillsAtLevel9: 2 },
        source: 'PHB 2024 "Ranger: Expertise" (line ~5449)',
      },
      {
        name: 'Tireless',
        level: 10,
        effect: 'As a Magic action, give yourself 1d8 + Wis mod Temp HP (minimum 1 Temp HP); uses equal your Wis mod (minimum 1), regained on a Long Rest. A Short Rest reduces your Exhaustion level by 1.',
        source: 'PHB 2024 "Ranger: Tireless" (line ~5442)',
      },
      {
        name: 'Ability Score Improvement',
        level: 12,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Ranger: Ability Score Improvement" (line ~5437)',
      },
      {
        name: 'Relentless Hunter',
        level: 13,
        effect: 'Taking damage cannot break your Concentration on Hunter\u2019s Mark.',
        source: 'PHB 2024 "Ranger: Relentless Hunter" (line ~5459)',
      },
      {
        name: "Nature's Veil",
        level: 14,
        effect: 'As a Bonus Action, give yourself the Invisible condition until the end of your next turn; uses equal your Wis mod (minimum 1), regained on a Long Rest.',
        source: 'PHB 2024 "Ranger: Nature\'s Veil" (line ~5463)',
      },
      {
        name: 'Ability Score Improvement',
        level: 16,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Ranger: Ability Score Improvement" (line ~5437)',
      },
      {
        name: 'Precise Hunter',
        level: 17,
        effect: 'You have Advantage on attack rolls against the creature currently marked by your Hunter\u2019s Mark.',
        source: 'PHB 2024 "Ranger: Precise Hunter" (line ~5467)',
      },
      {
        name: 'Feral Senses',
        level: 18,
        effect: 'You gain Blindsight with a range of 30 feet.',
        source: 'PHB 2024 "Ranger: Feral Senses" (line ~5471)',
      },
      {
        name: 'Epic Boon',
        level: 19,
        effect: 'Gain an Epic Boon feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Ranger: Epic Boon" (line ~5475)',
      },
      {
        name: 'Foe Slayer',
        level: 20,
        effect: 'The damage die of your Hunter\u2019s Mark becomes a d10 instead of a d6.',
        mechanics: { huntersMarkDie: 'd10' },
        source: 'PHB 2024 "Ranger: Foe Slayer" (line ~5479)',
      },
    ],
    subclasses: [
      { id: 'beastMaster', name: 'Beast Master', srd: 'non-srd', features: [], source: 'PHB 2024 "Ranger: Ranger Subclass" (line ~5427)' },
      { id: 'feyWanderer', name: 'Fey Wanderer', srd: 'non-srd', features: [], source: 'PHB 2024 "Ranger: Ranger Subclass" (line ~5427)' },
      { id: 'gloomStalker', name: 'Gloom Stalker', srd: 'non-srd', features: [], source: 'PHB 2024 "Ranger: Ranger Subclass" (line ~5427)' },
      { id: 'hunter', name: 'Hunter', srd: 'non-srd', features: [], source: 'PHB 2024 "Ranger: Ranger Subclass" (line ~5427)' },
    ],
    // PHB 2024 "Ranger: As a Multiclass Character" (line ~5364): Martial weapons, one skill from the Ranger list, training with Light and Medium armor and Shields.
    multiclassProficiencies: { armor: ['light', 'medium', 'shields'], martialWeapons: true, skills: 1, tools: [] },
  },

  // PHB 2024 "CORE ROGUE TRAITS" / "ROGUE FEATURES" (line ~5872/~5908).
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    hitDie: 8, // PHB 2024 "Core Rogue Traits": Hit Point Die D8 (line ~5874).
    primaryAbilities: ['dex'], // PHB 2024 "Core Rogue Traits": Primary Ability Dexterity (line ~5874).
    savingThrows: ['dex', 'int'], // PHB 2024 "Core Rogue Traits": Dex & Int saves (line ~5874).
    // PHB 2024 "Core Rogue Traits": Choose 4 skills (line ~5874).
    skillChoices: {
      count: 4,
      from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'persuasion', 'sleightOfHand', 'stealth'],
    },
    armorTraining: ['Light armor'], // PHB 2024 "Core Rogue Traits" (line ~5874).
    weaponProficiencies: ['Simple weapons', 'Martial weapons with the Finesse or Light property'], // PHB 2024 "Core Rogue Traits" (line ~5874).
    weaponProficiency: { simple: true, martial: false, martialWithAnyOf: ['finesse', 'light'] }, // structured form of the line above (Stage A5d)
    toolProficiencies: ["Thieves' Tools"], // PHB 2024 "Core Rogue Traits" (line ~5874).
    startingEquipment:
      "(A) Leather Armor, 2 Daggers, Shortsword, Shortbow, 20 Arrows, Quiver, Thieves' Tools, Burglar's Pack, 8 GP; or (B) 100 GP", // PHB 2024 "Core Rogue Traits" (line ~5874).
    subclassLevel: 3, // PHB 2024 "Rogue Features": Rogue Subclass at level 3 (line ~5908).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Rogue Traits" / "Rogue Features"',
    features: [
      {
        name: 'Expertise',
        level: 1,
        effect: 'Gain Expertise in two of your skill proficiencies; you gain Expertise in two more at Rogue level 6.',
        mechanics: { skillsAtLevel1: 2 },
        source: 'PHB 2024 "Rogue: Expertise" (line ~5863)',
      },
      {
        name: 'Sneak Attack',
        level: 1,
        effect: 'Once per turn, add extra damage to a Finesse/Ranged attack you hit with Advantage (or with an ally adjacent and no Disadvantage). Scales per the Sneak Attack column.',
        mechanics: { sneakAttackDice: '1d6' },
        source: 'PHB 2024 "Rogue: Sneak Attack" (line ~5867)',
      },
      {
        name: "Thieves' Cant",
        level: 1,
        effect: "You know Thieves' Cant plus one other language of your choice.",
        source: "PHB 2024 \"Rogue: Thieves' Cant\" (line ~5873)",
      },
      {
        name: 'Weapon Mastery',
        level: 1,
        effect: 'Use the mastery property of two kinds of weapons you are proficient with; swap the choices on a Long Rest.',
        mechanics: { weaponsAtLevel1: 2 },
        source: 'PHB 2024 "Rogue: Weapon Mastery" (line ~5878)',
      },
      {
        name: 'Cunning Action',
        level: 2,
        effect: 'As a Bonus Action, take the Dash, Disengage, or Hide action.',
        source: 'PHB 2024 "Rogue: Cunning Action" (line ~5911)',
      },
      {
        name: 'Rogue Subclass',
        level: 3,
        effect: 'Choose a Rogue subclass; you gain its features of your Rogue level or lower.',
        kind: 'subclass-choice',
        source: 'PHB 2024 "Rogue: Rogue Subclass" (line ~5937)',
      },
      {
        name: 'Steady Aim',
        level: 3,
        effect: 'As a Bonus Action (if you have not moved this turn), gain Advantage on your next attack roll; your Speed becomes 0 until end of turn.',
        source: 'PHB 2024 "Rogue: Steady Aim" (line ~5941)',
      },
      {
        name: 'Ability Score Improvement',
        level: 4,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for (repeats at 8, 10, 12, 16).',
        kind: 'asi-marker',
        source: 'PHB 2024 "Rogue: Ability Score Improvement" (line ~5945)',
      },
      {
        name: 'Cunning Strike',
        level: 5,
        effect: 'When you deal Sneak Attack damage, forgo dice to add Cunning Strike effects (Poison, Trip, Withdraw). Effect save DC is 8 + Dex mod + PB.',
        source: 'PHB 2024 "Rogue: Cunning Strike" (line ~5934)',
      },
      {
        name: 'Uncanny Dodge',
        level: 5,
        effect: 'When a visible attacker hits you, use your Reaction to halve the attack\u2019s damage.',
        source: 'PHB 2024 "Rogue: Uncanny Dodge" (line ~5963)',
      },
      {
        name: 'Expertise',
        level: 6,
        effect: 'Gain Expertise in two more of your skill proficiencies.',
        mechanics: { skillsAtLevel6: 2 },
        source: 'PHB 2024 "Rogue Features: Expertise" (line ~5908)',
      },
      {
        name: 'Evasion',
        level: 7,
        effect: 'On a Dexterity save for half damage, take no damage on a success and half on a failure (not while Incapacitated).',
        source: 'PHB 2024 "Rogue: Evasion" (line ~5965)',
      },
      {
        name: 'Reliable Talent',
        level: 7,
        effect: 'When you make an ability check with a skill or tool proficiency, treat a d20 roll of 9 or lower as a 10.',
        source: 'PHB 2024 "Rogue: Reliable Talent" (line ~5967)',
      },
      {
        name: 'Ability Score Improvement',
        level: 8,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Rogue: Ability Score Improvement" (line ~5945)',
      },
      {
        name: 'Ability Score Improvement',
        level: 10,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Rogue: Ability Score Improvement" (line ~5945)',
      },
      {
        name: 'Improved Cunning Strike',
        level: 11,
        effect: 'You can use up to two Cunning Strike effects at once, paying the die cost for each.',
        source: 'PHB 2024 "Rogue: Improved Cunning Strike" (line ~5967)',
      },
      {
        name: 'Ability Score Improvement',
        level: 12,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Rogue: Ability Score Improvement" (line ~5945)',
      },
      {
        name: 'Devious Strikes',
        level: 14,
        effect: 'Cunning Strike gains the Knock Out, Obscure, and Daze effect options.',
        source: 'PHB 2024 "Rogue: Devious Strikes" (line ~5969)',
      },
      {
        name: 'Slippery Mind',
        level: 15,
        effect: 'Gain proficiency in Wisdom and Charisma saving throws.',
        source: 'PHB 2024 "Rogue: Slippery Mind" (line ~5975)',
      },
      {
        name: 'Ability Score Improvement',
        level: 16,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Rogue: Ability Score Improvement" (line ~5945)',
      },
      {
        name: 'Elusive',
        level: 18,
        effect: 'No attack roll can have Advantage against you unless you are Incapacitated.',
        source: 'PHB 2024 "Rogue: Elusive" (line ~5977)',
      },
      {
        name: 'Epic Boon',
        level: 19,
        effect: 'Gain an Epic Boon feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Rogue: Epic Boon" (line ~5979)',
      },
      {
        name: 'Stroke of Luck',
        level: 20,
        effect: 'When you fail a D20 Test, you can turn the roll into a 20; once per Short or Long Rest.',
        source: 'PHB 2024 "Rogue: Stroke of Luck" (line ~5981)',
      },
    ],
    subclasses: [
      { id: 'arcaneTrickster', name: 'Arcane Trickster', srd: 'non-srd', features: [], source: 'PHB 2024 "Rogue: Rogue Subclass" (line ~5937)' },
      { id: 'assassin', name: 'Assassin', srd: 'non-srd', features: [], source: 'PHB 2024 "Rogue: Rogue Subclass" (line ~5937)' },
      { id: 'soulknife', name: 'Soulknife', srd: 'non-srd', features: [], source: 'PHB 2024 "Rogue: Rogue Subclass" (line ~5937)' },
      { id: 'thief', name: 'Thief', srd: 'non-srd', features: [], source: 'PHB 2024 "Rogue: Rogue Subclass" (line ~5937)' },
    ],
    // PHB 2024 "Rogue: As a Multiclass Character" (line ~5875): one skill from the Rogue list, Thieves' Tools, training with Light armor.
    multiclassProficiencies: { armor: ['light'], martialWeapons: false, skills: 1, tools: ['thieves-tools'] },
  },

  // PHB 2024 "CORE SORCERER TRAITS" / "SORCERER FEATURES" (line ~6229/~6273).
  sorcerer: {
    id: 'sorcerer',
    name: 'Sorcerer',
    hitDie: 6, // PHB 2024 "Core Sorcerer Traits": Hit Point Die D6 (line ~6232).
    primaryAbilities: ['cha'], // PHB 2024 "Core Sorcerer Traits": Primary Ability Charisma (line ~6232).
    savingThrows: ['con', 'cha'], // PHB 2024 "Core Sorcerer Traits": Con & Cha saves (line ~6232).
    // PHB 2024 "Core Sorcerer Traits": Choose 2 skills (line ~6232).
    skillChoices: {
      count: 2,
      from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
    },
    armorTraining: [], // PHB 2024 "Core Sorcerer Traits": None (line ~6232).
    weaponProficiencies: ['Simple weapons'], // PHB 2024 "Core Sorcerer Traits" (line ~6232).
    weaponProficiency: { simple: true, martial: false }, // structured form of the line above (Stage A5d)
    toolProficiencies: [],
    startingEquipment:
      "(A) Spear, 2 Daggers, Arcane Focus (crystal), Dungeoneer's Pack, 28 GP; or (B) 50 GP", // PHB 2024 "Core Sorcerer Traits" (line ~6232).
    subclassLevel: 3, // PHB 2024 "Sorcerer: Sorcerer Subclass" at level 3 (line ~6349).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Sorcerer Traits" / "Sorcerer Features"',
    // PHB 2024 p.138: Sorcerer features by level (features table line ~6273; descriptions line ~6257).
    features: [
      {
        name: 'Spellcasting',
        level: 1,
        effect: 'Cast Sorcerer spells using Charisma; prepare a changeable list, know cantrips, and use an Arcane Focus as a Spellcasting Focus. Slots per the Sorcerer Features table.',
        mechanics: { spellcastingAbility: 'cha', cantripsAtLevel1: 4, preparedAtLevel1: 2 },
        source: 'PHB 2024 "Sorcerer: Spellcasting" (line ~6259)',
      },
      {
        name: 'Innate Sorcery',
        level: 1,
        effect: 'As a Bonus Action, for 1 minute raise your Sorcerer spell save DC by 1 and gain Advantage on your Sorcerer spell attack rolls. Use twice per Long Rest.',
        mechanics: { usesAtLevel1: 2 },
        source: 'PHB 2024 "Sorcerer: Innate Sorcery" (line ~6301)',
      },
      {
        name: 'Font of Magic',
        level: 2,
        effect: 'Gain Sorcery Points (per the table) to fuel effects: convert spell slots into points and points into spell slots (up to level 5). Regain all on a Long Rest.',
        mechanics: { sorceryPointsAtLevel2: 2 },
        source: 'PHB 2024 "Sorcerer: Font of Magic" (line ~6313)',
      },
      {
        name: 'Metamagic',
        level: 2,
        effect: 'Learn two Metamagic options that modify spells for a cost in Sorcery Points; gain two more at level 10 and two more at level 17, and you can swap one on level-up.',
        mechanics: { optionsAtLevel2: 2 },
        source: 'PHB 2024 "Sorcerer: Metamagic" (line ~6339)',
      },
      {
        name: 'Sorcerer Subclass',
        level: 3,
        effect: 'Choose a Sorcerer subclass; you gain its features of your Sorcerer level or lower.',
        kind: 'subclass-choice',
        source: 'PHB 2024 "Sorcerer: Sorcerer Subclass" (line ~6349)',
      },
      {
        name: 'Ability Score Improvement',
        level: 4,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for (repeats at 8, 12, 16).',
        kind: 'asi-marker',
        source: 'PHB 2024 "Sorcerer: Ability Score Improvement" (line ~6353)',
      },
      {
        name: 'Sorcerous Restoration',
        level: 5,
        effect: 'On a Short Rest, regain expended Sorcery Points up to half your Sorcerer level (round down); once per Long Rest.',
        source: 'PHB 2024 "Sorcerer: Sorcerous Restoration" (line ~6357)',
      },
      {
        name: 'Sorcery Incarnate',
        level: 7,
        effect: 'If out of Innate Sorcery uses, spend 2 Sorcery Points to activate it; while it is active you can use up to two Metamagic options on each spell.',
        source: 'PHB 2024 "Sorcerer: Sorcery Incarnate" (line ~6361)',
      },
      {
        name: 'Ability Score Improvement',
        level: 8,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Sorcerer: Ability Score Improvement" (line ~6353)',
      },
      {
        name: 'Metamagic',
        level: 10,
        effect: 'Learn two more Metamagic options.',
        mechanics: { optionsAtLevel10: 2 },
        source: 'PHB 2024 "Sorcerer: Metamagic" (line ~6339)',
      },
      {
        name: 'Ability Score Improvement',
        level: 12,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Sorcerer: Ability Score Improvement" (line ~6353)',
      },
      {
        name: 'Ability Score Improvement',
        level: 16,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Sorcerer: Ability Score Improvement" (line ~6353)',
      },
      {
        name: 'Metamagic',
        level: 17,
        effect: 'Learn two more Metamagic options.',
        mechanics: { optionsAtLevel17: 2 },
        source: 'PHB 2024 "Sorcerer: Metamagic" (line ~6339)',
      },
      {
        name: 'Epic Boon',
        level: 19,
        effect: 'Gain an Epic Boon feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Sorcerer: Epic Boon" (line ~6377)',
      },
      {
        name: 'Arcane Apotheosis',
        level: 20,
        effect: 'While your Innate Sorcery is active, you can use one Metamagic option on each of your turns without spending Sorcery Points.',
        source: 'PHB 2024 "Sorcerer: Arcane Apotheosis" (line ~6381)',
      },
    ],
    subclasses: [
      { id: 'aberrant', name: 'Aberrant Sorcery', srd: 'non-srd', features: [], source: 'PHB 2024 "Sorcerer: Sorcerer Subclass" (line ~6352)' },
      { id: 'clockwork', name: 'Clockwork Sorcery', srd: 'non-srd', features: [], source: 'PHB 2024 "Sorcerer: Sorcerer Subclass" (line ~6352)' },
      { id: 'draconic', name: 'Draconic Sorcery', srd: 'non-srd', features: [], source: 'PHB 2024 "Sorcerer: Sorcerer Subclass" (line ~6352)' },
      { id: 'wildMagic', name: 'Wild Magic Sorcery', srd: 'non-srd', features: [], source: 'PHB 2024 "Sorcerer: Sorcerer Subclass" (line ~6352)' },
    ],
    // PHB 2024 "Sorcerer: As a Multiclass Character" (line ~6253): nothing beyond the Hit Point Die.
    multiclassProficiencies: { armor: [], martialWeapons: false, skills: 0, tools: [] },
  },

  // PHB 2024 "CORE WARLOCK TRAITS" / "WARLOCK FEATURES" (line ~6771/~6829).
  warlock: {
    id: 'warlock',
    name: 'Warlock',
    hitDie: 8, // PHB 2024 "Core Warlock Traits": Hit Point Die D8 (line ~6775).
    primaryAbilities: ['cha'], // PHB 2024 "Core Warlock Traits": Primary Ability Charisma (line ~6775).
    savingThrows: ['wis', 'cha'], // PHB 2024 "Core Warlock Traits": Wis & Cha saves (line ~6775).
    // PHB 2024 "Core Warlock Traits": Choose 2 skills (line ~6784).
    skillChoices: {
      count: 2,
      from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
    },
    armorTraining: ['Light armor'], // PHB 2024 "Core Warlock Traits" (line ~6784).
    weaponProficiencies: ['Simple weapons'], // PHB 2024 "Core Warlock Traits" (line ~6784).
    weaponProficiency: { simple: true, martial: false }, // structured form of the line above (Stage A5d)
    toolProficiencies: [],
    startingEquipment:
      "(A) Leather Armor, Sickle, 2 Daggers, Arcane Focus (orb), Book (occult lore), Scholar's Pack, 15 GP; or (B) 100 GP", // PHB 2024 "Core Warlock Traits" (line ~6784).
    subclassLevel: 3, // PHB 2024 "Warlock: Warlock Subclass" at level 3 (line ~6874).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Warlock Traits" / "Warlock Features"',
    // PHB 2024 p.152: Warlock features by level (features table line ~6829; descriptions line ~6807).
    features: [
      {
        name: 'Eldritch Invocations',
        level: 1,
        effect: 'Learn an Eldritch Invocation and gain more as you level (per the Invocations column); you can swap one whenever you gain a Warlock level.',
        mechanics: { invocationsAtLevel1: 1 },
        source: 'PHB 2024 "Warlock: Eldritch Invocations" (line ~6807)',
      },
      {
        name: 'Pact Magic',
        level: 1,
        effect: 'Cast Warlock spells using Charisma with slots that are all the same level and recharge on a Short or Long Rest; know cantrips and use an Arcane Focus as a Spellcasting Focus.',
        mechanics: { spellcastingAbility: 'cha', cantripsAtLevel1: 2, preparedAtLevel1: 2 },
        source: 'PHB 2024 "Warlock: Pact Magic" (line ~6823)',
      },
      {
        name: 'Magical Cunning',
        level: 2,
        effect: 'Perform a 1-minute rite to regain Pact Magic spell slots up to half your maximum (round up); once per Long Rest.',
        source: 'PHB 2024 "Warlock: Magical Cunning" (line ~6881)',
      },
      {
        name: 'Warlock Subclass',
        level: 3,
        effect: 'Choose a Warlock subclass; you gain its features of your Warlock level or lower.',
        kind: 'subclass-choice',
        source: 'PHB 2024 "Warlock: Warlock Subclass" (line ~6887)',
      },
      {
        name: 'Ability Score Improvement',
        level: 4,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for (repeats at 8, 12, 16).',
        kind: 'asi-marker',
        source: 'PHB 2024 "Warlock: Ability Score Improvement" (line ~6891)',
      },
      {
        name: 'Ability Score Improvement',
        level: 8,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Warlock: Ability Score Improvement" (line ~6891)',
      },
      {
        name: 'Contact Patron',
        level: 9,
        effect: 'You always have Contact Other Plane prepared; cast it to contact your patron without a slot and automatically succeed on its save, once per Long Rest.',
        source: 'PHB 2024 "Warlock: Contact Patron" (line ~6895)',
      },
      {
        name: 'Mystic Arcanum',
        level: 11,
        effect: 'Choose a level 6 Warlock spell you can cast once without a slot per Long Rest; gain a level 7/8/9 arcanum spell at levels 13/15/17.',
        mechanics: { spellLevel: 6 },
        source: 'PHB 2024 "Warlock: Mystic Arcanum" (line ~6901)',
      },
      {
        name: 'Ability Score Improvement',
        level: 12,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Warlock: Ability Score Improvement" (line ~6891)',
      },
      {
        name: 'Mystic Arcanum',
        level: 13,
        effect: 'Gain a level 7 Warlock spell as an arcanum, castable once without a slot per Long Rest.',
        mechanics: { spellLevel: 7 },
        source: 'PHB 2024 "Warlock: Mystic Arcanum" (line ~6901)',
      },
      {
        name: 'Mystic Arcanum',
        level: 15,
        effect: 'Gain a level 8 Warlock spell as an arcanum, castable once without a slot per Long Rest.',
        mechanics: { spellLevel: 8 },
        source: 'PHB 2024 "Warlock: Mystic Arcanum" (line ~6901)',
      },
      {
        name: 'Ability Score Improvement',
        level: 16,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Warlock: Ability Score Improvement" (line ~6891)',
      },
      {
        name: 'Mystic Arcanum',
        level: 17,
        effect: 'Gain a level 9 Warlock spell as an arcanum, castable once without a slot per Long Rest.',
        mechanics: { spellLevel: 9 },
        source: 'PHB 2024 "Warlock: Mystic Arcanum" (line ~6901)',
      },
      {
        name: 'Epic Boon',
        level: 19,
        effect: 'Gain an Epic Boon feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Warlock: Epic Boon" (line ~6911)',
      },
      {
        name: 'Eldritch Master',
        level: 20,
        effect: 'When you use Magical Cunning, you regain all expended Pact Magic spell slots.',
        source: 'PHB 2024 "Warlock: Eldritch Master" (line ~6915)',
      },
    ],
    subclasses: [
      { id: 'archfey', name: 'Archfey Patron', srd: 'non-srd', features: [], source: 'PHB 2024 "Warlock: Warlock Subclass" (line ~6877)' },
      { id: 'celestial', name: 'Celestial Patron', srd: 'non-srd', features: [], source: 'PHB 2024 "Warlock: Warlock Subclass" (line ~6877)' },
      { id: 'fiend', name: 'Fiend Patron', srd: 'non-srd', features: [], source: 'PHB 2024 "Warlock: Warlock Subclass" (line ~6877)' },
      { id: 'greatOldOne', name: 'Great Old One Patron', srd: 'non-srd', features: [], source: 'PHB 2024 "Warlock: Warlock Subclass" (line ~6877)' },
    ],
    // PHB 2024 "Warlock: As a Multiclass Character" (line ~6782): training with Light armor only.
    multiclassProficiencies: { armor: ['light'], martialWeapons: false, skills: 0, tools: [] },
  },

  // PHB 2024 "CORE WIZARD TRAITS" / "WIZARD FEATURES" (line ~7320/~7395).
  wizard: {
    id: 'wizard',
    name: 'Wizard',
    hitDie: 6, // PHB 2024 "Core Wizard Traits": Hit Point Die D6 (line ~7320).
    primaryAbilities: ['int'], // PHB 2024 "Core Wizard Traits": Primary Ability Intelligence (line ~7320).
    savingThrows: ['int', 'wis'], // PHB 2024 "Core Wizard Traits": Int & Wis saves (line ~7320).
    // PHB 2024 "Core Wizard Traits": Choose 2 skills (line ~7320).
    skillChoices: {
      count: 2,
      from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'nature', 'religion'],
    },
    armorTraining: [], // PHB 2024 "Core Wizard Traits": None (line ~7320).
    weaponProficiencies: ['Simple weapons'], // PHB 2024 "Core Wizard Traits" (line ~7320).
    weaponProficiency: { simple: true, martial: false }, // structured form of the line above (Stage A5d)
    toolProficiencies: [],
    startingEquipment:
      "(A) 2 Daggers, Arcane Focus (Quarterstaff), Robe, Spellbook, Scholar's Pack, 5 GP; or (B) 55 GP", // PHB 2024 "Core Wizard Traits" (line ~7320).
    subclassLevel: 3, // PHB 2024 "Wizard Features": Wizard Subclass at level 3 (line ~7366).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Wizard Traits" / "Wizard Features"',
    features: [
      {
        name: 'Spellcasting',
        level: 1,
        effect: 'Cast Wizard spells using Intelligence from a spellbook; prepare a changeable list and know cantrips. Slots per the Wizard Features table.',
        mechanics: { spellcastingAbility: 'int', cantripsAtLevel1: 3, preparedAtLevel1: 4 },
        source: 'PHB 2024 "Wizard: Spellcasting" (line ~7395)',
      },
      {
        name: 'Ritual Adept',
        level: 1,
        effect: 'Cast any Ritual-tagged spell in your spellbook as a Ritual, without preparing it, by reading from the book.',
        source: 'PHB 2024 "Wizard: Ritual Adept" (line ~7366)',
      },
      {
        name: 'Arcane Recovery',
        level: 1,
        effect: 'On a Short Rest, recover expended spell slots totalling up to half your Wizard level (round up), none level 6+; once per Long Rest.',
        source: 'PHB 2024 "Wizard: Arcane Recovery" (line ~7366)',
      },
      {
        name: 'Scholar',
        level: 2,
        effect: 'Gain Expertise in one of Arcana, History, Investigation, Medicine, Nature, or Religion you are proficient in.',
        source: 'PHB 2024 "Wizard: Scholar" (line ~7366)',
      },
      {
        name: 'Wizard Subclass',
        level: 3,
        effect: 'Choose a Wizard subclass; you gain its features of your Wizard level or lower.',
        kind: 'subclass-choice',
        source: 'PHB 2024 "Wizard Features: Wizard Subclass" (line ~7366)',
      },
      {
        name: 'Ability Score Improvement',
        level: 4,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for (repeats at 8, 12, 16).',
        kind: 'asi-marker',
        source: 'PHB 2024 "Wizard: Ability Score Improvement" (line ~7366)',
      },
      {
        name: 'Memorize Spell',
        level: 5,
        effect: 'On a Short Rest, replace one prepared level 1+ Wizard spell with another from your spellbook.',
        source: 'PHB 2024 "Wizard: Memorize Spell" (line ~7366)',
      },
      {
        name: 'Ability Score Improvement',
        level: 8,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Wizard: Ability Score Improvement" (line ~7366)',
      },
      {
        name: 'Ability Score Improvement',
        level: 12,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Wizard: Ability Score Improvement" (line ~7366)',
      },
      {
        name: 'Ability Score Improvement',
        level: 16,
        effect: 'Gain the Ability Score Improvement feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Wizard: Ability Score Improvement" (line ~7366)',
      },
      {
        name: 'Spell Mastery',
        level: 18,
        effect: 'Choose a level 1 and a level 2 spell in your spellbook to cast at will at their lowest level; swap them on a Long Rest.',
        source: 'PHB 2024 "Wizard: Spell Mastery" (line ~7366)',
      },
      {
        name: 'Epic Boon',
        level: 19,
        effect: 'Gain an Epic Boon feat or another feat you qualify for.',
        kind: 'asi-marker',
        source: 'PHB 2024 "Wizard: Epic Boon" (line ~7366)',
      },
      {
        name: 'Signature Spells',
        level: 20,
        effect: 'Choose two level 3 spellbook spells as signature spells, each castable once at level 3 without a slot, regained on a rest.',
        source: 'PHB 2024 "Wizard: Signature Spells" (line ~7366)',
      },
    ],
    subclasses: [
      { id: 'abjurer', name: 'Abjurer', srd: 'non-srd', features: [], source: 'PHB 2024 "Wizard: Wizard Subclass" (line ~7366)' },
      { id: 'diviner', name: 'Diviner', srd: 'non-srd', features: [], source: 'PHB 2024 "Wizard: Wizard Subclass" (line ~7366)' },
      { id: 'evoker', name: 'Evoker', srd: 'non-srd', features: [], source: 'PHB 2024 "Wizard: Wizard Subclass" (line ~7366)' },
      { id: 'illusionist', name: 'Illusionist', srd: 'non-srd', features: [], source: 'PHB 2024 "Wizard: Wizard Subclass" (line ~7366)' },
    ],
    // PHB 2024 "Wizard: As a Multiclass Character" (line ~7389): nothing beyond the Hit Point Die.
    multiclassProficiencies: { armor: [], martialWeapons: false, skills: 0, tools: [] },
  },
} as const satisfies Record<string, ClassData>;

/** A valid class catalog key, e.g. 'wizard'. */
export type ClassId = keyof typeof CLASS_CATALOG;

/** A valid subclass id for any class in the catalog. */
export type SubclassId =
  (typeof CLASS_CATALOG)[ClassId]['subclasses'][number]['id'];

/** A class entry whose `id` is narrowed to the literal ClassId union. */
export type ClassEntry = ClassData & { id: ClassId };

/** The catalog as an array, in alphabetical (declaration) order. */
export const CLASS_LIST: readonly ClassEntry[] = Object.values(
  CLASS_CATALOG,
) as readonly ClassEntry[];

/** Looks up a class by id, tolerating an unknown/absent id (returns undefined). */
export function getClass(id: string | undefined): ClassData | undefined {
  if (id === undefined) return undefined;
  return (CLASS_CATALOG as Record<string, ClassData>)[id];
}
