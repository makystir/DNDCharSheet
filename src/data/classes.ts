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
 * INCLUDED VS NAMES-ONLY (Stage 4 FEAT-001)
 * -----------------------------------------
 * Four classes ship with their full level-1-to-20 feature lists transcribed:
 * Barbarian (d12), Wizard (d6), Rogue (d8), and Cleric (d8). The remaining
 * eight (Bard, Druid, Fighter, Monk, Paladin, Ranger, Sorcerer, Warlock) ship
 * "names-only": full core traits (Hit Die, abilities, proficiencies, starting
 * equipment, subclass names + level) but with `features: []` pending a later
 * pass. All twelve select their subclass at level 3, read per class from each
 * "<Class> Subclass" Features-table row (PHB 2024), not defaulted.
 */

import type { Ability, SkillId } from '../types/character';

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
  /** Tool proficiencies, display strings (PHB 2024 Core <Class> Traits). */
  toolProficiencies: string[];
  /** Starting-equipment choice text (PHB 2024 Core <Class> Traits). */
  startingEquipment: string;
  /** Level-by-level features. Empty for names-only classes this stage. */
  features: ClassFeature[];
  /** Subclasses (names + level only this stage). */
  subclasses: SubclassData[];
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
  },

  // PHB 2024 "CORE BARD TRAITS" (line ~2682). Names-only (features deferred).
  bard: {
    id: 'bard',
    name: 'Bard',
    hitDie: 8, // PHB 2024 "Core Bard Traits": Hit Point Die D8 (line ~2691).
    primaryAbilities: ['cha'], // PHB 2024 "Core Bard Traits": Primary Ability Charisma (line ~2691).
    savingThrows: ['dex', 'cha'], // PHB 2024 "Core Bard Traits": Dex & Cha saves (line ~2691).
    skillChoices: { count: 3, from: 'any' }, // PHB 2024 "Core Bard Traits": Choose any 3 skills (line ~2691).
    armorTraining: ['Light armor'], // PHB 2024 "Core Bard Traits" (line ~2691).
    weaponProficiencies: ['Simple weapons'], // PHB 2024 "Core Bard Traits" (line ~2691).
    toolProficiencies: ['Three Musical Instruments of your choice'], // PHB 2024 "Core Bard Traits" (line ~2691).
    startingEquipment:
      "(A) Leather Armor, 2 Daggers, Musical Instrument, Entertainer's Pack, 19 GP; or (B) 90 GP", // PHB 2024 "Core Bard Traits".
    subclassLevel: 3, // PHB 2024 "Bard: Bard Subclass" at level 3 (line ~2806).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Bard Traits"',
    features: [], // Names-only this stage.
    subclasses: [
      { id: 'dance', name: 'College of Dance', srd: 'non-srd', features: [], source: 'PHB 2024 "Bard: Bard Subclass" (line ~2809)' },
      { id: 'glamour', name: 'College of Glamour', srd: 'non-srd', features: [], source: 'PHB 2024 "Bard: Bard Subclass" (line ~2809)' },
      { id: 'lore', name: 'College of Lore', srd: 'non-srd', features: [], source: 'PHB 2024 "Bard: Bard Subclass" (line ~2809)' },
      { id: 'valor', name: 'College of Valor', srd: 'non-srd', features: [], source: 'PHB 2024 "Bard: Bard Subclass" (line ~2809)' },
    ],
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
  },

  // PHB 2024 "CORE DRUID TRAITS" (line ~3587). Names-only (features deferred).
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
    toolProficiencies: ['Herbalism Kit'], // PHB 2024 "Core Druid Traits" (line ~3590).
    startingEquipment:
      "(A) Leather Armor, Shield, Sickle, Druidic Focus (Quarterstaff), Explorer's Pack, Herbalism Kit, 9 GP; or (B) 50 GP", // PHB 2024 "Core Druid Traits" (line ~3590).
    subclassLevel: 3, // PHB 2024 "Druid: Druid Subclass" at level 3 (line ~3710).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Druid Traits"',
    features: [], // Names-only this stage.
    subclasses: [
      { id: 'land', name: 'Circle of the Land', srd: 'non-srd', features: [], source: 'PHB 2024 "Druid: Druid Subclass" (line ~3713)' },
      { id: 'moon', name: 'Circle of the Moon', srd: 'non-srd', features: [], source: 'PHB 2024 "Druid: Druid Subclass" (line ~3713)' },
      { id: 'sea', name: 'Circle of the Sea', srd: 'non-srd', features: [], source: 'PHB 2024 "Druid: Druid Subclass" (line ~3713)' },
      { id: 'stars', name: 'Circle of the Stars', srd: 'non-srd', features: [], source: 'PHB 2024 "Druid: Druid Subclass" (line ~3713)' },
    ],
  },

  // PHB 2024 "CORE FIGHTER TRAITS" (line ~4086). Names-only (features deferred).
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
    toolProficiencies: [],
    startingEquipment:
      "(A) Chain Mail, Greatsword, Flail, 8 Javelins, Dungeoneer's Pack, 4 GP; (B) Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Dungeoneer's Pack, 11 GP; or (C) 155 GP", // PHB 2024 "Core Fighter Traits" (line ~4089).
    subclassLevel: 3, // PHB 2024 "Fighter: Fighter Subclass" at level 3 (line ~4181).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Fighter Traits"',
    features: [], // Names-only this stage.
    subclasses: [
      { id: 'battleMaster', name: 'Battle Master', srd: 'non-srd', features: [], source: 'PHB 2024 "Fighter: Fighter Subclass" (line ~4184)' },
      { id: 'champion', name: 'Champion', srd: 'non-srd', features: [], source: 'PHB 2024 "Fighter: Fighter Subclass" (line ~4184)' },
      { id: 'eldritchKnight', name: 'Eldritch Knight', srd: 'non-srd', features: [], source: 'PHB 2024 "Fighter: Fighter Subclass" (line ~4184)' },
      { id: 'psiWarrior', name: 'Psi Warrior', srd: 'non-srd', features: [], source: 'PHB 2024 "Fighter: Fighter Subclass" (line ~4184)' },
    ],
  },

  // PHB 2024 "CORE MONK TRAITS" (line ~4479). Names-only (features deferred).
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
    toolProficiencies: ["One type of Artisan's Tools or Musical Instrument"], // PHB 2024 "Core Monk Traits" (line ~4481).
    startingEquipment:
      "(A) Spear, 5 Daggers, Artisan's Tools or Musical Instrument, Explorer's Pack, 11 GP; or (B) 50 GP", // PHB 2024 "Core Monk Traits".
    subclassLevel: 3, // PHB 2024 Monk Features: Monk Subclass at level 3 (Chapter 3).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Monk Traits"',
    features: [], // Names-only this stage.
    subclasses: [
      { id: 'elements', name: 'Warrior of the Elements', srd: 'non-srd', features: [], source: 'PHB 2024 "Monk Subclasses" (Chapter 3)' },
      { id: 'mercy', name: 'Warrior of Mercy', srd: 'non-srd', features: [], source: 'PHB 2024 "Monk Subclasses" (Chapter 3)' },
      { id: 'openHand', name: 'Warrior of the Open Hand', srd: 'non-srd', features: [], source: 'PHB 2024 "Monk Subclasses" (Chapter 3)' },
      { id: 'shadow', name: 'Warrior of Shadow', srd: 'non-srd', features: [], source: 'PHB 2024 "Monk Subclasses" (Chapter 3)' },
    ],
  },

  // PHB 2024 "CORE PALADIN TRAITS" (line ~4817). Names-only (features deferred).
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
    toolProficiencies: [],
    startingEquipment:
      "(A) Chain Mail, Shield, Longsword, 6 Javelins, Holy Symbol, Priest's Pack, 9 GP; or (B) 150 GP", // PHB 2024 "Core Paladin Traits" (line ~4820).
    subclassLevel: 3, // PHB 2024 Paladin Features: Paladin Subclass at level 3 (Chapter 3).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Paladin Traits"',
    features: [], // Names-only this stage.
    subclasses: [
      { id: 'devotion', name: 'Oath of Devotion', srd: 'non-srd', features: [], source: 'PHB 2024 "Paladin Subclasses" (Chapter 3)' },
      { id: 'glory', name: 'Oath of Glory', srd: 'non-srd', features: [], source: 'PHB 2024 "Paladin Subclasses" (Chapter 3)' },
      { id: 'ancients', name: 'Oath of the Ancients', srd: 'non-srd', features: [], source: 'PHB 2024 "Paladin Subclasses" (Chapter 3)' },
      { id: 'vengeance', name: 'Oath of Vengeance', srd: 'non-srd', features: [], source: 'PHB 2024 "Paladin Subclasses" (Chapter 3)' },
    ],
  },

  // PHB 2024 "CORE RANGER TRAITS" (line ~5316). Names-only (features deferred).
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
    toolProficiencies: [],
    startingEquipment:
      "(A) Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Druidic Focus, Explorer's Pack, 7 GP; or (B) 150 GP", // PHB 2024 "Core Ranger Traits" (line ~5334).
    subclassLevel: 3, // PHB 2024 "Ranger: Ranger Subclass" at level 3 (line ~5424).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Ranger Traits"',
    features: [], // Names-only this stage.
    subclasses: [
      { id: 'beastMaster', name: 'Beast Master', srd: 'non-srd', features: [], source: 'PHB 2024 "Ranger: Ranger Subclass" (line ~5427)' },
      { id: 'feyWanderer', name: 'Fey Wanderer', srd: 'non-srd', features: [], source: 'PHB 2024 "Ranger: Ranger Subclass" (line ~5427)' },
      { id: 'gloomStalker', name: 'Gloom Stalker', srd: 'non-srd', features: [], source: 'PHB 2024 "Ranger: Ranger Subclass" (line ~5427)' },
      { id: 'hunter', name: 'Hunter', srd: 'non-srd', features: [], source: 'PHB 2024 "Ranger: Ranger Subclass" (line ~5427)' },
    ],
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
  },

  // PHB 2024 "CORE SORCERER TRAITS" (line ~6229). Names-only (features deferred).
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
    toolProficiencies: [],
    startingEquipment:
      "(A) Spear, 2 Daggers, Arcane Focus (crystal), Dungeoneer's Pack, 28 GP; or (B) 50 GP", // PHB 2024 "Core Sorcerer Traits" (line ~6232).
    subclassLevel: 3, // PHB 2024 "Sorcerer: Sorcerer Subclass" at level 3 (line ~6349).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Sorcerer Traits"',
    features: [], // Names-only this stage.
    subclasses: [
      { id: 'aberrant', name: 'Aberrant Sorcery', srd: 'non-srd', features: [], source: 'PHB 2024 "Sorcerer: Sorcerer Subclass" (line ~6352)' },
      { id: 'clockwork', name: 'Clockwork Sorcery', srd: 'non-srd', features: [], source: 'PHB 2024 "Sorcerer: Sorcerer Subclass" (line ~6352)' },
      { id: 'draconic', name: 'Draconic Sorcery', srd: 'non-srd', features: [], source: 'PHB 2024 "Sorcerer: Sorcerer Subclass" (line ~6352)' },
      { id: 'wildMagic', name: 'Wild Magic Sorcery', srd: 'non-srd', features: [], source: 'PHB 2024 "Sorcerer: Sorcerer Subclass" (line ~6352)' },
    ],
  },

  // PHB 2024 "CORE WARLOCK TRAITS" (line ~6771). Names-only (features deferred).
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
    toolProficiencies: [],
    startingEquipment:
      "(A) Leather Armor, Sickle, 2 Daggers, Arcane Focus (orb), Book (occult lore), Scholar's Pack, 15 GP; or (B) 100 GP", // PHB 2024 "Core Warlock Traits" (line ~6784).
    subclassLevel: 3, // PHB 2024 "Warlock: Warlock Subclass" at level 3 (line ~6874).
    srd: 'uncertain',
    source: 'PHB 2024 "Core Warlock Traits"',
    features: [], // Names-only this stage.
    subclasses: [
      { id: 'archfey', name: 'Archfey Patron', srd: 'non-srd', features: [], source: 'PHB 2024 "Warlock: Warlock Subclass" (line ~6877)' },
      { id: 'celestial', name: 'Celestial Patron', srd: 'non-srd', features: [], source: 'PHB 2024 "Warlock: Warlock Subclass" (line ~6877)' },
      { id: 'fiend', name: 'Fiend Patron', srd: 'non-srd', features: [], source: 'PHB 2024 "Warlock: Warlock Subclass" (line ~6877)' },
      { id: 'greatOldOne', name: 'Great Old One Patron', srd: 'non-srd', features: [], source: 'PHB 2024 "Warlock: Warlock Subclass" (line ~6877)' },
    ],
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
