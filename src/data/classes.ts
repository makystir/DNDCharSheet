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
 * entry/feature carries a `source` citation and a matching `// PHB 2024 "â€¦"`
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
 * CLASS FEATURE LISTS
 * -------------------
 * All twelve classes now ship with their full level-1-to-20 CLASS feature
 * lists transcribed from each class's Features table (PHB 2024 Chapter 3).
 * Only class-level rows are modelled here; rows the Features table marks as a
 * "Subclass feature" (and Paladin's level-20 subclass-feature row) are granted
 * through the chosen subclass, whose own `features` carry them (Stage 2 fills these in).
 * All twelve select their subclass at level 3, read per class from each
 * "<Class> Subclass" Features-table row (PHB 2024), not defaulted.
 */

import type { Ability, SkillId } from '../types/character';
import type { WeaponProperty } from './weapons';

/** Spell names -> spell-catalog ids ("Hunter's Mark" -> 'hunter-s-mark'). */
const spellIds = (...names: string[]): string[] =>
  names.map((n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));

/** Line-anchored PHB citation for a subclass feature. */
const phbSub = (label: string, line: number): string => `PHB 2024 "${label}" (line ${line})`;

/** A class Hit Die size. Only these four appear among the PHB classes. */
export type HitDie = 6 | 8 | 10 | 12;

/**
 * A single class feature gained at a specific class level. Descriptions are
 * paraphrased; only mechanical values are transcribed.
 */
export interface ClassFeature {
  /** Feature name as printed, e.g. 'Rage', 'Sneak Attack'. */
  name: string;
  /** Class level at which the feature is gained (1â€“20). */
  level: number;
  /** Paraphrased effect â€” NEVER verbatim PHB prose (rules-compliance rule 5). */
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
  /**
   * STRUCTURED mechanics (all optional; used by subclass features so a golden
   * oracle can compare VALUES rather than prose). Descriptive text stays in
   * `effect`; these carry only the numbers/lists the feature prints.
   */
  /** Limited uses: `count` is a number or a short formula ('PB', 'Wis mod (min 1)'). */
  uses?: { count: number | string; recharge: FeatureRecharge };
  /** Dice the feature rolls, e.g. { expr: '1d8', label: 'Rage damage' }. */
  dice?: Array<{ expr: string; label: string }>;
  /** A saving throw DC the feature sets. `dcAbility` 'spellcasting' = the class's spellcasting ability. */
  saveDc?: { dcAbility: Ability | 'spellcasting'; saveAbility?: Ability };
  /** Spells the feature grants: `level` is the class level they arrive at. */
  grantedSpells?: Array<{ level: number; spells: string[]; alwaysPrepared: boolean }>;
  /** Proficiencies / languages the feature grants (fixed lists plus pick counts). */
  grantedProficiencies?: {
    skills?: SkillId[];
    skillChoices?: number;
    tools?: string[];
    toolChoices?: number;
    languages?: string[];
    languageChoices?: number;
    weapons?: string[];
    armor?: string[];
  };
  /** Number of skills that gain Expertise from this feature (0/absent = none). */
  grantsExpertise?: number;
  /** True when the feature grants an additional Fighting Style feat pick. */
  grantsFightingStyle?: boolean;
  /** A feat (by id) or feat category the feature grants outright. */
  grantsFeat?: { featId?: string; category?: string };
  /** Sub-choices the player makes with this feature (e.g. Rage of the Wilds: Bear/Eagle/Wolf). */
  choices?: Array<{ key: string; count: number; options: string[] }>;
  /**
   * Spells granted per option of a sub-choice (Circle of the Land: land type), keyed by option
   * name. Data only: NOT read by spellcasting.ts (the land type is chosen after each Long Rest).
   */
  choiceSpells?: Record<string, Array<{ level: number; spells: string[] }>>;
  /** Line-anchored PHB citation this feature is transcribed from. */
  source: string;
}

/** When a limited-use feature's uses return. */
export type FeatureRecharge =
  | 'short-rest'
  | 'long-rest'
  | 'short-or-long-rest'
  | 'dawn'
  | 'other';

/**
 * A subclass: id, name, and its features (each gained at a class level at or
 * above the class's `subclassLevel`).
 */
export interface SubclassData {
  id: string;
  name: string;
  /** Subclass features, each with its class level. */
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
  /**
   * The multiclass PREREQUISITE ability shape (PHB 2024 "Multiclassing:
   * Prerequisites" â€” you need a score of at least 13 in the primary ability of
   * each class). Encoded EXPLICITLY per class (NOT inferred from
   * `primaryAbilities`, whose AND/OR semantics are ambiguous): `all` = every
   * listed ability must be >= 13; `any` = at least one must be. Exactly one of
   * `all`/`any` is present per class. Single-primary classes use `all:[x]`;
   * Fighter is the only `any` (Str OR Dex); Monk/Paladin/Ranger are multi-`all`.
   */
  multiclassPrereq: { all?: Ability[]; any?: Ability[] };
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
  /** Line-anchored PHB citation this entry is transcribed from. */
  source: string;
}

// â”€â”€ Subclass features: Fighter, Monk, Paladin, Ranger (Stage 2, step 2) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Effect text is paraphrased; only mechanical values are transcribed from the PHB 2024.

const MANEUVER_NAMES = [
  'Ambush', 'Bait and Switch', "Commander's Strike", 'Commanding Presence', 'Disarming Attack',
  'Distracting Strike', 'Evasive Footwork', 'Feinting Attack', 'Goading Attack', 'Lunging Attack',
  'Maneuvering Attack', 'Menacing Attack', 'Parry', 'Precision Attack', 'Pushing Attack', 'Rally',
  'Riposte', 'Sweeping Attack', 'Tactical Assessment', 'Trip Attack',
];

const BATTLE_MASTER_FEATURES: ClassFeature[] = [
  {
    name: 'Combat Superiority',
    level: 3,
    effect: 'You learn 3 maneuvers (2 more at Fighter levels 7, 10 and 15, and you may swap one whenever you learn new ones). You have 4 Superiority Dice (d8s), a fifth at level 7 and a sixth at level 15, all regained on a Short or Long Rest. A maneuver that forces a save uses DC 8 + your Strength or Dexterity modifier (your choice) + Proficiency Bonus; only one maneuver can be used per attack.',
    mechanics: { maneuversL3: 3, maneuversL7: 5, maneuversL10: 7, maneuversL15: 9, diceL3: 4, diceL7: 5, diceL15: 6, dcAbilityAlt: 'dex' },
    uses: { count: 4, recharge: 'short-or-long-rest' },
    dice: [{ expr: '4d8 Superiority Dice (5 at L7, 6 at L15)', label: 'Superiority Dice pool' }],
    saveDc: { dcAbility: 'str', saveAbility: 'str' },
    choices: [{ key: 'maneuvers', count: 3, options: MANEUVER_NAMES }],
    source: phbSub('Battle Master: Combat Superiority', 4229),
  },
  {
    name: 'Student of War',
    level: 3,
    effect: "You gain proficiency with one Artisan's Tools of your choice and one skill of your choice from the Fighter's level 1 skill list.",
    grantedProficiencies: { skillChoices: 1, toolChoices: 1 },
    source: phbSub('Battle Master: Student of War', 4247),
  },
  {
    name: 'Know Your Enemy',
    level: 7,
    effect: 'As a Bonus Action, learn whether a creature you can see within 30 feet has any Immunities, Resistances or Vulnerabilities, and which. One use per Long Rest; expend a Superiority Die (no action) to restore it.',
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Battle Master: Know Your Enemy', 4251),
  },
  {
    name: 'Improved Combat Superiority',
    level: 10,
    effect: 'Your Superiority Dice become d10s.',
    dice: [{ expr: 'd10', label: 'Superiority Die size' }],
    source: phbSub('Battle Master: Improved Combat Superiority', 4257),
  },
  {
    name: 'Relentless',
    level: 15,
    effect: 'Once per turn when you use a maneuver, you can roll 1d8 and use that result instead of expending a Superiority Die.',
    dice: [{ expr: '1d8', label: 'Free maneuver die, once per turn' }],
    source: phbSub('Battle Master: Relentless', 4259),
  },
  {
    name: 'Ultimate Combat Superiority',
    level: 18,
    effect: 'Your Superiority Dice become d12s.',
    dice: [{ expr: 'd12', label: 'Superiority Die size' }],
    source: phbSub('Battle Master: Ultimate Combat Superiority', 4263),
  },
];

const CHAMPION_FEATURES: ClassFeature[] = [
  {
    name: 'Improved Critical',
    level: 3,
    effect: 'Weapon attacks and Unarmed Strikes score a Critical Hit on a d20 roll of 19 or 20.',
    mechanics: { critRangeMin: 19 },
    source: phbSub('Champion: Improved Critical', 4319),
  },
  {
    name: 'Remarkable Athlete',
    level: 3,
    effect: 'You have Advantage on Initiative rolls and Strength (Athletics) checks. Right after you score a Critical Hit, you can move up to half your Speed without provoking Opportunity Attacks.',
    source: phbSub('Champion: Remarkable Athlete', 4321),
  },
  {
    name: 'Additional Fighting Style',
    level: 7,
    effect: 'You gain a second Fighting Style feat of your choice.',
    grantsFightingStyle: true,
    source: phbSub('Champion: Additional Fighting Style', 4325),
  },
  {
    name: 'Heroic Warrior',
    level: 10,
    effect: 'During combat, whenever you start your turn without Heroic Inspiration you can give it to yourself.',
    source: phbSub('Champion: Heroic Warrior', 4327),
  },
  {
    name: 'Superior Critical',
    level: 15,
    effect: 'Weapon attacks and Unarmed Strikes now score a Critical Hit on a d20 roll of 18-20.',
    mechanics: { critRangeMin: 18 },
    source: phbSub('Champion: Superior Critical', 4329),
  },
  {
    name: 'Survivor',
    level: 18,
    effect: 'Defy Death: you have Advantage on Death Saving Throws, and a roll of 18-20 counts as a 20. Heroic Rally: at the start of each of your turns while Bloodied with at least 1 Hit Point, you regain 5 + your Constitution modifier Hit Points.',
    dice: [{ expr: '5 + ConMod', label: 'Heroic Rally: HP regained at the start of each turn while Bloodied with at least 1 HP' }],
    source: phbSub('Champion: Survivor', 4331),
  },
];

const ELDRITCH_KNIGHT_FEATURES: ClassFeature[] = [
  {
    // FLAG: the PHB prints no "LEVEL 3: SPELLCASTING" heading; name and level 3 are inferred from the
    // Eldritch Knight Spellcasting table. The OCR dropped the level-4 slot column; the 1 slot at Fighter
    // 19-20 comes from the printed table (supplied by the user), covering slot levels 1-4 (arrays are indexed by Fighter level 1-20).
    name: 'Spellcasting',
    level: 3,
    effect: 'You cast Wizard spells using Intelligence, with an Arcane Focus allowed. You know 2 Wizard cantrips (a third at level 10) and prepare Wizard spells of levels you have slots for, per the Eldritch Knight Spellcasting table; you can swap one cantrip and one prepared spell whenever you gain a Fighter level. Slots return on a Long Rest.',
    mechanics: {
      spellAbility: 'int',
      spellList: 'Wizard',
      cantripsKnownByLevel: [0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      preparedByLevel: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
      slotsL1ByLevel: [0, 0, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      slotsL2ByLevel: [0, 0, 0, 0, 0, 0, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      slotsL3ByLevel: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 3, 3, 3, 3, 3],
      slotsL4ByLevel: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    },
    source: phbSub('Eldritch Knight: Spellcasting', 4345),
  },
  {
    name: 'War Bond',
    level: 3,
    effect: 'A 1-hour ritual (doable in a Short Rest) bonds you to a weapon you touch. You cannot be disarmed of it unless Incapacitated, and you can summon it to your hand as a Bonus Action when on the same plane. You can have two bonded weapons but summon only one at a time; bonding a third breaks one bond. It fails if another Fighter is bonded to the weapon or someone else is attuned to it.',
    mechanics: { maxBondedWeapons: 2 },
    source: phbSub('Eldritch Knight: War Bond', 4390),
  },
  {
    name: 'War Magic',
    level: 7,
    effect: 'When you take the Attack action, you can replace one attack with a Wizard cantrip that has a casting time of an action.',
    source: phbSub('Eldritch Knight: War Magic', 4398),
  },
  {
    name: 'Eldritch Strike',
    level: 10,
    effect: 'When you hit a creature with a weapon attack, it has Disadvantage on its next saving throw against a spell you cast before the end of your next turn.',
    source: phbSub('Eldritch Knight: Eldritch Strike', 4402),
  },
  {
    name: 'Arcane Charge',
    level: 15,
    effect: 'When you use Action Surge, you can teleport up to 30 feet to an unoccupied space you can see, before or after the extra action.',
    mechanics: { teleportFeet: 30 },
    source: phbSub('Eldritch Knight: Arcane Charge', 4406),
  },
  {
    name: 'Improved War Magic',
    level: 18,
    effect: 'When you take the Attack action, you can replace two attacks with a level 1 or 2 Wizard spell that has a casting time of an action.',
    source: phbSub('Eldritch Knight: Improved War Magic', 4410),
  },
];

const PSI_WARRIOR_FEATURES: ClassFeature[] = [
  {
    name: 'Psionic Power',
    level: 3,
    effect: 'You have Psionic Energy Dice (4d6 at level 3, 6d8 at 5, 8d8 at 9, 8d10 at 11, 10d10 at 13, 12d12 at 17); regain one on a Short Rest and all on a Long Rest. Protective Field: Reaction, spend a die to reduce damage to you or a creature you see within 30 feet by the roll + Intelligence modifier (minimum 1 reduction). Psionic Strike: once per turn after a weapon hit on a target within 30 feet, spend a die for Force damage equal to the roll + Intelligence modifier. Telekinetic Movement: Magic action to move a loose Large-or-smaller object or willing creature up to 30 feet, once per Short or Long Rest unless you spend a die to restore it.',
    mechanics: { activation: 'reaction', dieL3: 'd6', numberL3: 4, dieL5: 'd8', numberL5: 6, dieL9: 'd8', numberL9: 8, dieL11: 'd10', numberL11: 8, dieL13: 'd10', numberL13: 10, dieL17: 'd12', numberL17: 12 },
    uses: { count: 4, recharge: 'other' },
    dice: [
      { expr: 'Psionic Energy Dice: 4d6 (L3), 6d8 (L5), 8d8 (L9), 8d10 (L11), 10d10 (L13), 12d12 (L17)', label: 'Psionic Energy Dice pool' },
      { expr: '1 Psionic Die + IntMod (min 1)', label: 'Protective Field damage reduction (Reaction, 30 ft)' },
      { expr: '1 Psionic Die + IntMod', label: 'Psionic Strike Force damage (once per turn, 30 ft)' },
    ],
    source: phbSub('Psi Warrior: Psionic Power', 4420),
  },
  {
    name: 'Telekinetic Adept',
    level: 7,
    effect: 'Psi-Powered Leap: Bonus Action for a Fly Speed of twice your Speed until the end of the turn. Telekinetic Thrust: when Psionic Strike deals damage, the target makes a Strength save (DC 8 + Intelligence modifier + Proficiency Bonus) or is knocked Prone or moved up to 10 feet horizontally. The Leap is usable once per Short or Long Rest, restorable by expending a Psionic Energy Die (no action).',
    uses: { count: 1, recharge: 'short-or-long-rest' },
    saveDc: { dcAbility: 'int', saveAbility: 'str' },
    source: phbSub('Psi Warrior: Telekinetic Adept', 4447),
  },
  {
    name: 'Guarded Mind',
    level: 10,
    effect: 'You have Resistance to Psychic damage. If you start your turn Charmed or Frightened, you can expend a Psionic Energy Die (no action) to end every effect on you causing those conditions.',
    source: phbSub('Psi Warrior: Guarded Mind', 4455),
  },
  {
    name: 'Bulwark of Force',
    level: 15,
    effect: 'As a Bonus Action, choose up to your Intelligence modifier (minimum 1) creatures within 30 feet, yourself included; each has Half Cover for 1 minute or until you are Incapacitated. Once per Long Rest, or restore it by expending a Psionic Energy Die (no action).',
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Psi Warrior: Bulwark of Force', 4459),
  },
  {
    name: 'Telekinetic Master',
    level: 18,
    effect: 'You always have Telekinesis prepared and can cast it without a slot or components, using Intelligence. While concentrating on it you can make a weapon attack as a Bonus Action each turn. Once per Long Rest this way, or restore it by expending a Psionic Energy Die (no action).',
    grantedSpells: [{ level: 18, spells: spellIds('Telekinesis'), alwaysPrepared: true }],
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Psi Warrior: Telekinetic Master', 4465),
  },
];

const MERCY_FEATURES: ClassFeature[] = [
  {
    name: 'Hand of Harm',
    level: 3,
    effect: 'Once per turn when you hit with an Unarmed Strike and deal damage, spend 1 Focus Point to add Necrotic damage equal to one Martial Arts die roll + your Wisdom modifier.',
    dice: [{ expr: '1 Martial Arts die + WisMod', label: 'Extra Necrotic damage (1 Focus Point, once per turn)' }],
    source: phbSub('Warrior of Mercy: Hand of Harm', 4681),
  },
  {
    name: 'Hand of Healing',
    level: 3,
    effect: 'As a Magic action, spend 1 Focus Point to touch a creature and restore Hit Points equal to one Martial Arts die roll + your Wisdom modifier. During Flurry of Blows you can replace one strike with this healing without spending the Focus Point.',
    dice: [{ expr: '1 Martial Arts die + WisMod', label: 'Hit Points restored (Magic action, 1 Focus Point)' }],
    source: phbSub('Warrior of Mercy: Hand of Healing', 4685),
  },
  {
    name: 'Implements of Mercy',
    level: 3,
    effect: 'You gain proficiency in Insight and Medicine and with the Herbalism Kit.',
    grantedProficiencies: { skills: ['insight', 'medicine'], tools: ['Herbalism Kit'] },
    source: phbSub('Warrior of Mercy: Implements of Mercy', 4691),
  },
  {
    name: "Physician's Touch",
    level: 6,
    effect: 'Hand of Harm can also give the target the Poisoned condition until the end of your next turn. Hand of Healing can also end one of Blinded, Deafened, Paralyzed, Poisoned or Stunned on the target.',
    source: phbSub("Warrior of Mercy: Physician's Touch", 4693),
  },
  {
    name: 'Flurry of Healing and Harm',
    level: 11,
    effect: 'During Flurry of Blows you can replace each strike with Hand of Healing at no Focus Point cost, and use Hand of Harm on a damaging Flurry strike at no Focus Point cost (still once per turn). You can do this a number of times equal to your Wisdom modifier (minimum 1), regained on a Long Rest.',
    uses: { count: 'Wis mod (min 1)', recharge: 'long-rest' },
    source: phbSub('Warrior of Mercy: Flurry of Healing and Harm', 4701),
  },
  {
    name: 'Hand of Ultimate Mercy',
    level: 17,
    effect: 'As a Magic action, touch a creature that died within the past 24 hours and spend 5 Focus Points; it returns to life with 4d10 + your Wisdom modifier Hit Points, and Blinded, Deafened, Paralyzed, Poisoned and Stunned conditions it died with are removed. Once per Long Rest.',
    uses: { count: 1, recharge: 'long-rest' },
    dice: [{ expr: '4d10 + WisMod', label: 'Hit Points of the revived creature (costs 5 Focus Points)' }],
    source: phbSub('Warrior of Mercy: Hand of Ultimate Mercy', 4707),
  },
];

const SHADOW_FEATURES: ClassFeature[] = [
  {
    name: 'Shadow Arts',
    level: 3,
    effect: 'Spend 1 Focus Point to cast Darkness without components; you can see inside it and can move its area up to 60 feet at the start of each of your turns. You gain Darkvision 60 feet (60 feet more if you already have it). You know Minor Illusion, with Wisdom as its spellcasting ability.',
    grantedSpells: [
      { level: 3, spells: spellIds('Darkness'), alwaysPrepared: false },
      { level: 3, spells: spellIds('Minor Illusion'), alwaysPrepared: false },
    ],
    mechanics: { darkvisionFeet: 60, focusPointCost: 1 },
    source: phbSub('Warrior of Shadow: Shadow Arts', 4717),
  },
  {
    name: 'Shadow Step',
    level: 6,
    effect: 'While entirely in Dim Light or Darkness, use a Bonus Action to teleport up to 60 feet to an unoccupied space you can see that is also in Dim Light or Darkness. You then have Advantage on your next melee attack this turn.',
    mechanics: { teleportFeet: 60 },
    source: phbSub('Warrior of Shadow: Shadow Step', 4727),
  },
  {
    name: 'Improved Shadow Step',
    level: 11,
    effect: 'When you use Shadow Step you can spend 1 Focus Point to ignore the Dim Light or Darkness requirement for that use, and you can make an Unarmed Strike right after teleporting as part of the same Bonus Action.',
    source: phbSub('Warrior of Shadow: Improved Shadow Step', 4731),
  },
  {
    name: 'Cloak of Shadows',
    level: 17,
    effect: 'As a Magic action in Dim Light or Darkness, spend 3 Focus Points to wrap yourself in shadow for 1 minute (ends if Incapacitated or if you end a turn in Bright Light). You can move through occupied spaces as Difficult Terrain (if you end a turn in one you are shunted to your last open space), you have the Invisible condition, and Flurry of Blows costs no Focus Points.',
    mechanics: { focusPointCost: 3 },
    source: phbSub('Warrior of Shadow: Cloak of Shadows', 4735),
  },
];

const ELEMENTS_FEATURES: ClassFeature[] = [
  {
    // FLAG: the PHB states no DC for the Elemental Strikes save; the Monk chapter (line 4573) sets Focus Point save DCs at 8 + Wisdom modifier + Proficiency Bonus.
    name: 'Elemental Attunement',
    level: 3,
    effect: 'At the start of your turn, spend 1 Focus Point to become attuned for 10 minutes (ends if Incapacitated). Your Unarmed Strike reach is 10 feet greater, and your Unarmed Strikes can deal Acid, Cold, Fire, Lightning or Thunder damage; on such a hit the target can be forced to make a Strength save or be moved up to 10 feet toward or away from you.',
    mechanics: { focusPointCost: 1, reachBonusFeet: 10, moveFeet: 10 },
    saveDc: { dcAbility: 'wis', saveAbility: 'str' },
    source: phbSub('Warrior of the Elements: Elemental Attunement', 4753),
  },
  {
    name: 'Manipulate Elements',
    level: 3,
    effect: 'You know the Elementalism cantrip, with Wisdom as its spellcasting ability.',
    grantedSpells: [{ level: 3, spells: spellIds('Elementalism'), alwaysPrepared: false }],
    source: phbSub('Warrior of the Elements: Manipulate Elements', 4759),
  },
  {
    name: 'Elemental Burst',
    level: 6,
    effect: 'As a Magic action, spend 2 Focus Points to burst a 20-foot-radius Sphere centered on a point within 120 feet, choosing Acid, Cold, Fire, Lightning or Thunder. Each creature in it makes a Dexterity save, taking three Martial Arts die rolls of the chosen damage on a failure or half on a success.',
    mechanics: { focusPointCost: 2 },
    dice: [{ expr: '3 Martial Arts dice', label: 'Elemental damage in a 20-ft-radius Sphere (2 Focus Points; half on success)' }],
    saveDc: { dcAbility: 'wis', saveAbility: 'dex' },
    source: phbSub('Warrior of the Elements: Elemental Burst', 4761),
  },
  {
    name: 'Stride of the Elements',
    level: 11,
    effect: 'While Elemental Attunement is active, you also have a Fly Speed and a Swim Speed equal to your Speed.',
    source: phbSub('Warrior of the Elements: Stride of the Elements', 4767),
  },
  {
    name: 'Elemental Epitome',
    level: 17,
    effect: 'While Elemental Attunement is active: you have Resistance to one chosen type among Acid, Cold, Fire, Lightning and Thunder (changeable at the start of each turn); Step of the Wind adds 20 feet to your Speed and damages creatures you move next to (one Martial Arts die roll, once per creature per turn, damage type of your choice); and once per turn an Unarmed Strike deals extra damage of one Martial Arts die roll in the strike\'s type.',
    dice: [{ expr: '1 Martial Arts die', label: 'Destructive Stride damage / Empowered Strikes extra damage' }],
    source: phbSub('Warrior of the Elements: Elemental Epitome', 4769),
  },
];

const OPEN_HAND_FEATURES: ClassFeature[] = [
  {
    name: 'Open Hand Technique',
    level: 3,
    effect: 'When you hit with an attack from Flurry of Blows, you can impose one effect: Addle (no Opportunity Attacks until the start of its next turn), Push (Strength save or pushed up to 15 feet away), or Topple (Dexterity save or Prone). Save DC is 8 + Wisdom modifier + Proficiency Bonus (per the Monk chapter, line 4573).',
    mechanics: { pushFeet: 15 },
    saveDc: { dcAbility: 'wis', saveAbility: 'str' },
    source: phbSub('Warrior of the Open Hand: Open Hand Technique', 4783),
  },
  {
    name: 'Wholeness of Body',
    level: 6,
    effect: 'As a Bonus Action, roll your Martial Arts die and regain that many Hit Points + your Wisdom modifier (minimum 1 regained). Uses equal your Wisdom modifier (minimum 1), regained on a Long Rest.',
    uses: { count: 'Wis mod (min 1)', recharge: 'long-rest' },
    dice: [{ expr: '1 Martial Arts die + WisMod (min 1)', label: 'Hit Points regained (Bonus Action)' }],
    source: phbSub('Warrior of the Open Hand: Wholeness of Body', 4793),
  },
  {
    name: 'Fleet Step',
    level: 11,
    effect: 'After taking a Bonus Action other than Step of the Wind, you can use Step of the Wind immediately afterward.',
    source: phbSub('Warrior of the Open Hand: Fleet Step', 4799),
  },
  {
    name: 'Quivering Palm',
    level: 17,
    effect: 'When you hit with an Unarmed Strike you can spend 4 Focus Points to start harmless vibrations lasting a number of days equal to your Monk level. Later, on the same plane, you can end them (or forgo an attack in the Attack action to do so): the target makes a Constitution save, taking 10d12 Force damage on a failure or half on a success. Only one creature can be affected at a time, and you can end the vibrations harmlessly (no action).',
    mechanics: { focusPointCost: 4 },
    dice: [{ expr: '10d12', label: 'Force damage (half on success); costs 4 Focus Points' }],
    saveDc: { dcAbility: 'wis', saveAbility: 'con' },
    source: phbSub('Warrior of the Open Hand: Quivering Palm', 4803),
  },
];

const DEVOTION_FEATURES: ClassFeature[] = [
  {
    name: 'Oath of Devotion Spells',
    level: 3,
    effect: 'You always have these spells prepared from the listed Paladin level: 3 Protection from Evil and Good, Shield of Faith; 5 Aid, Zone of Truth; 9 Beacon of Hope, Dispel Magic; 13 Freedom of Movement, Guardian of Faith; 17 Commune, Flame Strike.',
    grantedSpells: [
      { level: 3, spells: spellIds('Protection from Evil and Good', 'Shield of Faith'), alwaysPrepared: true },
      { level: 5, spells: spellIds('Aid', 'Zone of Truth'), alwaysPrepared: true },
      { level: 9, spells: spellIds('Beacon of Hope', 'Dispel Magic'), alwaysPrepared: true },
      { level: 13, spells: spellIds('Freedom of Movement', 'Guardian of Faith'), alwaysPrepared: true },
      { level: 17, spells: spellIds('Commune', 'Flame Strike'), alwaysPrepared: true },
    ],
    source: phbSub('Oath of Devotion: Oath of Devotion Spells', 5111),
  },
  {
    name: 'Sacred Weapon',
    level: 3,
    effect: 'When you take the Attack action, expend a Channel Divinity use to imbue a held Melee weapon for 10 minutes (or until you use this again or stop carrying it): add your Charisma modifier (minimum +1) to its attack rolls, its hits can deal Radiant damage instead of the normal type, and it sheds Bright Light 20 feet and Dim Light 20 feet beyond.',
    mechanics: { channelDivinity: 1 },
    uses: { count: 'Channel Divinity use', recharge: 'other' },
    dice: [{ expr: 'ChaMod (min +1)', label: 'Attack roll bonus with the imbued weapon' }],
    source: phbSub('Oath of Devotion: Sacred Weapon', 5123),
  },
  {
    name: 'Aura of Devotion',
    level: 7,
    effect: 'You and your allies are Immune to the Charmed condition while in your Aura of Protection; a Charmed ally entering it is unaffected by the condition while there.',
    source: phbSub('Oath of Devotion: Aura of Devotion', 5135),
  },
  {
    name: 'Smite of Protection',
    level: 15,
    effect: 'Whenever you cast Divine Smite, you and your allies have Half Cover while in your Aura of Protection, until the start of your next turn.',
    source: phbSub('Oath of Devotion: Smite of Protection', 5139),
  },
  {
    name: 'Holy Nimbus',
    level: 20,
    effect: 'As a Bonus Action, empower your Aura of Protection for 10 minutes: you have Advantage on saves forced by Fiends and Undead; enemies starting their turn in the aura take Radiant damage equal to your Charisma modifier + Proficiency Bonus; the aura is sunlight Bright Light. Once per Long Rest, or restore it by expending a level 5 spell slot (no action).',
    uses: { count: 1, recharge: 'long-rest' },
    dice: [{ expr: 'ChaMod + Prof', label: 'Radiant damage to enemies starting their turn in the aura' }],
    source: phbSub('Oath of Devotion: Holy Nimbus', 5143),
  },
];

const GLORY_FEATURES: ClassFeature[] = [
  {
    name: 'Inspiring Smite',
    level: 3,
    effect: 'Right after casting Divine Smite, expend a Channel Divinity use to divide Temporary Hit Points equal to 2d8 + your Paladin level among creatures of your choice within 30 feet (you can be included).',
    mechanics: { channelDivinity: 1 },
    uses: { count: 'Channel Divinity use', recharge: 'other' },
    dice: [{ expr: '2d8 + PaladinLevel', label: 'Temporary Hit Points divided among creatures within 30 ft' }],
    source: phbSub('Oath of Glory: Inspiring Smite', 5165),
  },
  {
    name: 'Oath of Glory Spells',
    level: 3,
    effect: 'You always have these spells prepared from the listed Paladin level: 3 Guiding Bolt, Heroism; 5 Enhance Ability, Magic Weapon; 9 Haste, Protection from Energy; 13 Compulsion, Freedom of Movement; 17 Legend Lore, Yolande\'s Regal Presence.',
    grantedSpells: [
      { level: 3, spells: spellIds('Guiding Bolt', 'Heroism'), alwaysPrepared: true },
      { level: 5, spells: spellIds('Enhance Ability', 'Magic Weapon'), alwaysPrepared: true },
      { level: 9, spells: spellIds('Haste', 'Protection from Energy'), alwaysPrepared: true },
      { level: 13, spells: spellIds('Compulsion', 'Freedom of Movement'), alwaysPrepared: true },
      { level: 17, spells: spellIds('Legend Lore', "Yolande's Regal Presence"), alwaysPrepared: true },
    ],
    source: phbSub('Oath of Glory: Oath of Glory Spells', 5169),
  },
  {
    name: 'Peerless Athlete',
    level: 3,
    effect: 'As a Bonus Action, expend a Channel Divinity use for 1 hour of Advantage on Strength (Athletics) and Dexterity (Acrobatics) checks, with Long and High Jump distance increased by 10 feet (the extra distance costs movement).',
    mechanics: { channelDivinity: 1 },
    uses: { count: 'Channel Divinity use', recharge: 'other' },
    source: phbSub('Oath of Glory: Peerless Athlete', 5183),
  },
  {
    name: 'Aura of Alacrity',
    level: 7,
    effect: 'Your Speed increases by 10 feet. Allies entering your Aura of Protection for the first time on a turn, or starting their turn there, gain +10 feet of Speed until the end of their next turn.',
    mechanics: { speedBonusFeet: 10 },
    source: phbSub('Oath of Glory: Aura of Alacrity', 5187),
  },
  {
    name: 'Glorious Defense',
    level: 15,
    effect: 'When you or a creature you see within 10 feet is hit by an attack roll, use your Reaction to add your Charisma modifier (minimum +1) to its AC against that attack. If the attack then misses, you can make a weapon attack against the attacker if it is in range. Uses equal your Charisma modifier (minimum 1), regained on a Long Rest.',
    mechanics: { activation: 'reaction' },
    uses: { count: 'Cha mod (min 1)', recharge: 'long-rest' },
    source: phbSub('Oath of Glory: Glorious Defense', 5193),
  },
  {
    name: 'Living Legend',
    level: 20,
    effect: 'As a Bonus Action, gain for 10 minutes: Advantage on all Charisma checks; a Reaction to reroll a failed saving throw (you must keep the new roll); and once per turn, turn a missed weapon attack into a hit. Once per Long Rest, or restore it by expending a level 5 spell slot (no action).',
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Oath of Glory: Living Legend', 5199),
  },
];

const ANCIENTS_FEATURES: ClassFeature[] = [
  {
    // FLAG: the feature states no DC; the Paladin Channel Divinity text (line 4924) sets Channel Divinity save DCs to the spell save DC.
    name: "Nature's Wrath",
    level: 3,
    effect: 'As a Magic action, expend a Channel Divinity use to conjure spectral vines on creatures of your choice you see within 15 feet. Each makes a Strength save or is Restrained for 1 minute, repeating the save at the end of each of its turns. The save DC is your spell save DC.',
    mechanics: { channelDivinity: 1 },
    uses: { count: 'Channel Divinity use', recharge: 'other' },
    saveDc: { dcAbility: 'spellcasting', saveAbility: 'str' },
    source: phbSub("Oath of the Ancients: Nature's Wrath", 5221),
  },
  {
    name: 'Oath of the Ancients Spells',
    level: 3,
    effect: 'You always have these spells prepared from the listed Paladin level: 3 Ensnaring Strike, Speak with Animals; 5 Misty Step, Moonbeam; 9 Plant Growth, Protection from Energy; 13 Ice Storm, Stoneskin; 17 Commune with Nature, Tree Stride.',
    grantedSpells: [
      { level: 3, spells: spellIds('Ensnaring Strike', 'Speak with Animals'), alwaysPrepared: true },
      { level: 5, spells: spellIds('Misty Step', 'Moonbeam'), alwaysPrepared: true },
      { level: 9, spells: spellIds('Plant Growth', 'Protection from Energy'), alwaysPrepared: true },
      { level: 13, spells: spellIds('Ice Storm', 'Stoneskin'), alwaysPrepared: true },
      { level: 17, spells: spellIds('Commune with Nature', 'Tree Stride'), alwaysPrepared: true },
    ],
    source: phbSub('Oath of the Ancients: Oath of the Ancients Spells', 5225),
  },
  {
    name: 'Aura of Warding',
    level: 7,
    effect: 'You and your allies have Resistance to Necrotic, Psychic and Radiant damage while in your Aura of Protection.',
    source: phbSub('Oath of the Ancients: Aura of Warding', 5241),
  },
  {
    name: 'Undying Sentinel',
    level: 15,
    effect: 'When reduced to 0 Hit Points without being killed outright, you can instead drop to 1 and regain Hit Points equal to three times your Paladin level. Once per Long Rest. You also cannot be aged magically and stop visibly aging.',
    uses: { count: 1, recharge: 'long-rest' },
    dice: [{ expr: '3 x PaladinLevel', label: 'Hit Points regained when dropping to 1 HP instead of 0' }],
    source: phbSub('Oath of the Ancients: Undying Sentinel', 5245),
  },
  {
    name: 'Elder Champion',
    level: 20,
    effect: 'As a Bonus Action, empower your Aura of Protection for 1 minute: you regain 10 Hit Points at the start of each of your turns; enemies in the aura have Disadvantage on saves against your spells and Channel Divinity options; and you can cast action-time spells as a Bonus Action. Once per Long Rest, or restore it by expending a level 5 spell slot (no action).',
    uses: { count: 1, recharge: 'long-rest' },
    dice: [{ expr: '10', label: 'Hit Points regained at the start of each of your turns' }],
    source: phbSub('Oath of the Ancients: Elder Champion', 5251),
  },
];

const VENGEANCE_FEATURES: ClassFeature[] = [
  {
    // FLAG: the OCR prints the Haste / Protection from Energy row as Paladin level 6; read as 9 to match the 3/5/9/13/17 pattern of the other oaths.
    name: 'Oath of Vengeance Spells',
    level: 3,
    effect: 'You always have these spells prepared from the listed Paladin level: 3 Bane, Hunter\'s Mark; 5 Hold Person, Misty Step; 9 Haste, Protection from Energy; 13 Banishment, Dimension Door; 17 Hold Monster, Scrying.',
    grantedSpells: [
      { level: 3, spells: spellIds('Bane', "Hunter's Mark"), alwaysPrepared: true },
      { level: 5, spells: spellIds('Hold Person', 'Misty Step'), alwaysPrepared: true },
      { level: 9, spells: spellIds('Haste', 'Protection from Energy'), alwaysPrepared: true },
      { level: 13, spells: spellIds('Banishment', 'Dimension Door'), alwaysPrepared: true },
      { level: 17, spells: spellIds('Hold Monster', 'Scrying'), alwaysPrepared: true },
    ],
    source: phbSub('Oath of Vengeance: Oath of Vengeance Spells', 5273),
  },
  {
    name: 'Vow of Enmity',
    level: 3,
    effect: 'When you take the Attack action, expend a Channel Divinity use to swear enmity against a creature you see within 30 feet: Advantage on attack rolls against it for 1 minute or until you use this again. If it drops to 0 Hit Points you can transfer the vow to another creature within 30 feet (no action).',
    mechanics: { channelDivinity: 1 },
    uses: { count: 'Channel Divinity use', recharge: 'other' },
    source: phbSub('Oath of Vengeance: Vow of Enmity', 5287),
  },
  {
    name: 'Relentless Avenger',
    level: 7,
    effect: 'When you hit with an Opportunity Attack, you can reduce the target\'s Speed to 0 until the end of the turn, then move up to half your Speed as part of the same Reaction without provoking Opportunity Attacks.',
    source: phbSub('Oath of Vengeance: Relentless Avenger', 5293),
  },
  {
    name: 'Soul of Vengeance',
    level: 15,
    effect: 'Right after a creature under your Vow of Enmity hits or misses with an attack roll, use your Reaction to make a melee attack against it if it is within range.',
    mechanics: { activation: 'reaction' },
    source: phbSub('Oath of Vengeance: Soul of Vengeance', 5297),
  },
  {
    // FLAG: the feature states no DC for Frightful Aura; spell save DC is assumed (Paladin Channel Divinity text, line 4924, only covers Channel Divinity).
    name: 'Avenging Angel',
    level: 20,
    effect: 'As a Bonus Action, for 10 minutes: you gain spectral wings with a 60-foot Fly Speed and can hover, and enemies starting their turn in your Aura of Protection make a Wisdom save or are Frightened for 1 minute or until they take damage (attacks against a Frightened creature have Advantage). Once per Long Rest, or restore it by expending a level 5 spell slot (no action). The feature prints no save DC.',
    uses: { count: 1, recharge: 'long-rest' },
    saveDc: { dcAbility: 'spellcasting', saveAbility: 'wis' },
    mechanics: { flySpeedFeet: 60 },
    source: phbSub('Oath of Vengeance: Avenging Angel', 5301),
  },
];

const BEAST_MASTER_FEATURES: ClassFeature[] = [
  {
    // FLAG: the Beast of the Land / Sea / Sky stat blocks are not transcribed here.
    name: 'Primal Companion',
    level: 3,
    effect: 'You summon a Friendly primal beast with the stat block of your choice (Beast of the Land, Sea or Sky) that obeys you and vanishes if you die. It acts on your turn, taking only Dodge unless you use a Bonus Action to command it (or give up one of your attacks to have it use Beast\'s Strike). If it died within the last hour, a Magic action and a spell slot revive it after 1 minute at full Hit Points. After each Long Rest you may summon a different beast, replacing the old one.',
    choices: [{ key: 'beast', count: 1, options: ['Beast of the Land', 'Beast of the Sea', 'Beast of the Sky'] }],
    source: phbSub('Beast Master: Primal Companion', 5581),
  },
  {
    name: 'Exceptional Training',
    level: 7,
    effect: 'When you use a Bonus Action to command your beast, it can also take Dash, Disengage, Dodge or Help using its own Bonus Action. Its damaging hits can deal Force damage instead of their normal type.',
    source: phbSub('Beast Master: Exceptional Training', 5593),
  },
  {
    name: 'Bestial Fury',
    level: 11,
    effect: 'Your beast can use Beast\'s Strike twice when commanded to. The first time each turn it hits a creature under your Hunter\'s Mark, it deals extra Force damage equal to that spell\'s bonus damage.',
    source: phbSub('Beast Master: Bestial Fury', 5601),
  },
  {
    name: 'Share Spells',
    level: 15,
    effect: 'When you cast a spell targeting yourself, it can also affect your beast if it is within 30 feet of you.',
    source: phbSub('Beast Master: Share Spells', 5607),
  },
];

const FEY_WANDERER_FEATURES: ClassFeature[] = [
  {
    name: 'Dreadful Strikes',
    level: 3,
    effect: 'When you hit a creature with a weapon, you can deal extra 1d4 Psychic damage, once per turn per target. It becomes 1d6 at Ranger level 11.',
    dice: [{ expr: '1d4 (1d6 at L11)', label: 'Extra Psychic damage, once per turn' }],
    source: phbSub('Fey Wanderer: Dreadful Strikes', 5710),
  },
  {
    name: 'Fey Wanderer Spells',
    level: 3,
    effect: 'You always have these spells prepared from the listed Ranger level: 3 Charm Person; 5 Misty Step; 9 Summon Fey; 13 Dimension Door; 17 Mislead. You also have a cosmetic fey blessing chosen from or rolled on the Feywild Gifts d6 table.',
    grantedSpells: [
      { level: 3, spells: spellIds('Charm Person'), alwaysPrepared: true },
      { level: 5, spells: spellIds('Misty Step'), alwaysPrepared: true },
      { level: 9, spells: spellIds('Summon Fey'), alwaysPrepared: true },
      { level: 13, spells: spellIds('Dimension Door'), alwaysPrepared: true },
      { level: 17, spells: spellIds('Mislead'), alwaysPrepared: true },
    ],
    source: phbSub('Fey Wanderer: Fey Wanderer Spells', 5714),
  },
  {
    name: 'Otherworldly Glamour',
    level: 3,
    effect: 'You add your Wisdom modifier (minimum +1) to Charisma checks. You also gain proficiency in your choice of Deception, Performance or Persuasion.',
    grantedProficiencies: { skillChoices: 1 },
    choices: [{ key: 'glamour-skill', count: 1, options: ['Deception', 'Performance', 'Persuasion'] }],
    source: phbSub('Fey Wanderer: Otherworldly Glamour', 5741),
  },
  {
    name: 'Beguiling Twist',
    level: 7,
    effect: 'You have Advantage on saves against being Charmed or Frightened (to avoid or end it). When you or a creature you see within 120 feet succeeds on such a save, use your Reaction to force a different creature you see within 120 feet to make a Wisdom save against your spell save DC or be Charmed or Frightened (your choice) for 1 minute, repeating the save at the end of each of its turns.',
    mechanics: { activation: 'reaction' },
    saveDc: { dcAbility: 'spellcasting', saveAbility: 'wis' },
    source: phbSub('Fey Wanderer: Beguiling Twist', 5747),
  },
  {
    name: 'Fey Reinforcements',
    level: 11,
    effect: 'You can cast Summon Fey without a Material component, and once without a spell slot, regaining that free casting on a Long Rest. When you start casting it you may drop its Concentration requirement, making the duration 1 minute.',
    grantedSpells: [{ level: 11, spells: spellIds('Summon Fey'), alwaysPrepared: false }],
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Fey Wanderer: Fey Reinforcements', 5753),
  },
  {
    name: 'Misty Wanderer',
    level: 15,
    effect: 'You can cast Misty Step without a spell slot a number of times equal to your Wisdom modifier (minimum 1), regained on a Long Rest. Whenever you cast it you can bring one willing creature within 5 feet of you along to a space within 5 feet of your destination.',
    grantedSpells: [{ level: 15, spells: spellIds('Misty Step'), alwaysPrepared: false }],
    uses: { count: 'Wis mod (min 1)', recharge: 'long-rest' },
    source: phbSub('Fey Wanderer: Misty Wanderer', 5757),
  },
];

const GLOOM_STALKER_FEATURES: ClassFeature[] = [
  {
    name: 'Dread Ambusher',
    level: 3,
    effect: 'Ambusher\'s Leap: your Speed rises 10 feet until the end of your first turn of each combat. Dreadful Strike: when you hit with a weapon, deal extra 2d6 Psychic damage (once per turn), a number of times equal to your Wisdom modifier (minimum 1) per Long Rest. Initiative Bonus: add your Wisdom modifier to Initiative rolls.',
    mechanics: { speedBonusFeet: 10 },
    uses: { count: 'Wis mod (min 1)', recharge: 'long-rest' },
    dice: [{ expr: '2d6 (2d8 at L11)', label: 'Dreadful Strike extra Psychic damage, once per turn' }],
    source: phbSub('Gloom Stalker: Dread Ambusher', 5769),
  },
  {
    name: 'Gloom Stalker Spells',
    level: 3,
    effect: 'You always have these spells prepared from the listed Ranger level: 3 Disguise Self; 5 Rope Trick; 9 Fear; 13 Greater Invisibility; 17 Seeming.',
    grantedSpells: [
      { level: 3, spells: spellIds('Disguise Self'), alwaysPrepared: true },
      { level: 5, spells: spellIds('Rope Trick'), alwaysPrepared: true },
      { level: 9, spells: spellIds('Fear'), alwaysPrepared: true },
      { level: 13, spells: spellIds('Greater Invisibility'), alwaysPrepared: true },
      { level: 17, spells: spellIds('Seeming'), alwaysPrepared: true },
    ],
    source: phbSub('Gloom Stalker: Gloom Stalker Spells', 5781),
  },
  {
    name: 'Umbral Sight',
    level: 3,
    effect: 'You gain Darkvision 60 feet (60 feet more if you already have it). While entirely in Darkness, you have the Invisible condition to any creature relying on Darkvision to see you.',
    mechanics: { darkvisionFeet: 60 },
    source: phbSub('Gloom Stalker: Umbral Sight', 5795),
  },
  {
    name: 'Iron Mind',
    level: 7,
    effect: 'You gain proficiency in Wisdom saving throws; if you already have it, you instead gain proficiency in Intelligence or Charisma saving throws (your choice).',
    mechanics: { saveProficiency: 'wis', fallbackSaveChoice: 'int|cha' },
    source: phbSub('Gloom Stalker: Iron Mind', 5801),
  },
  {
    name: "Stalker's Flurry",
    level: 11,
    effect: 'Dreadful Strike damage becomes 2d8. When you use Dreadful Strike you can add one effect: Sudden Strike (another attack with the same weapon against a different creature within 5 feet of the target and within range) or Mass Fear (the target and creatures within 10 feet make a Wisdom save against your spell save DC or are Frightened until the start of your next turn).',
    saveDc: { dcAbility: 'spellcasting', saveAbility: 'wis' },
    source: phbSub("Gloom Stalker: Stalker's Flurry", 5805),
  },
  {
    name: 'Shadowy Dodge',
    level: 15,
    effect: 'When a creature attacks you, use your Reaction to impose Disadvantage on the roll; whether it hits or misses, you can then teleport up to 30 feet to an unoccupied space you can see.',
    mechanics: { activation: 'reaction', teleportFeet: 30 },
    source: phbSub('Gloom Stalker: Shadowy Dodge', 5813),
  },
];

const HUNTER_FEATURES: ClassFeature[] = [
  {
    name: "Hunter's Lore",
    level: 3,
    effect: 'While a creature is marked by your Hunter\'s Mark, you know whether it has any Immunities, Resistances or Vulnerabilities, and which.',
    source: phbSub("Hunter: Hunter's Lore", 5823),
  },
  {
    name: "Hunter's Prey",
    level: 3,
    effect: 'Choose one option, swappable after a Short or Long Rest. Colossus Slayer: a weapon hit deals extra 1d8 damage to a target missing any Hit Points (once per turn). Horde Breaker: once per turn when you attack with a weapon, make another attack with the same weapon against a different creature within 5 feet of the first, within range, that you have not attacked this turn.',
    choices: [{ key: 'hunters-prey', count: 1, options: ['Colossus Slayer', 'Horde Breaker'] }],
    dice: [{ expr: '1d8', label: 'Colossus Slayer extra damage, once per turn' }],
    source: phbSub("Hunter: Hunter's Prey", 5825),
  },
  {
    name: 'Defensive Tactics',
    level: 7,
    effect: 'Choose one option, swappable after a Short or Long Rest. Escape the Horde: Opportunity Attacks against you have Disadvantage. Multiattack Defense: when a creature hits you, it has Disadvantage on all its other attack rolls against you this turn.',
    choices: [{ key: 'defensive-tactics', count: 1, options: ['Escape the Horde', 'Multiattack Defense'] }],
    source: phbSub('Hunter: Defensive Tactics', 5831),
  },
  {
    name: "Superior Hunter's Prey",
    level: 11,
    effect: 'Once per turn when you damage a creature marked by Hunter\'s Mark, you can also deal that spell\'s extra damage to a different creature you see within 30 feet of the first.',
    source: phbSub("Hunter: Superior Hunter's Prey", 5839),
  },
  {
    name: "Superior Hunter's Defense",
    level: 15,
    effect: 'When you take damage, use your Reaction to gain Resistance to that damage and any other damage of the same type until the end of the turn.',
    mechanics: { activation: 'reaction' },
    source: phbSub("Hunter: Superior Hunter's Defense", 5841),
  },
];

// ── Subclass features: Rogue, Sorcerer, Warlock, Wizard (Stage 2, step 3) ───────────────────────
// Effect text is paraphrased; only mechanical values are transcribed from the PHB 2024.

const ARCANE_TRICKSTER_FEATURES: ClassFeature[] = [
  {
    // FLAG: the Arcane Trickster Spellcasting table is OCR-damaged ("ll" = 11, merged slot headers); values
    // were cross-checked with the prose (Rogue level 7 = five spells of level 1 or 2) and match the Eldritch Knight progression.
    name: 'Spellcasting',
    level: 3,
    effect: 'You cast Wizard spells using Intelligence, with an Arcane Focus allowed. You know Mage Hand plus two other Wizard cantrips (one more cantrip at level 10), and you can swap any cantrip except Mage Hand whenever you gain a Rogue level. You prepare Wizard spells of levels you have slots for, per the Arcane Trickster Spellcasting table, and can swap one whenever you gain a Rogue level. Slots return on a Long Rest.',
    mechanics: {
      spellAbility: 'int',
      spellList: 'Wizard',
      cantripsKnownByLevel: [0, 0, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      preparedByLevel: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
      slotsL1ByLevel: [0, 0, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      slotsL2ByLevel: [0, 0, 0, 0, 0, 0, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      slotsL3ByLevel: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 3, 3, 3, 3, 3],
      slotsL4ByLevel: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    },
    grantedSpells: [{ level: 3, spells: spellIds('Mage Hand'), alwaysPrepared: false }],
    source: phbSub('Arcane Trickster: Spellcasting', 6009),
  },
  {
    name: 'Mage Hand Legerdemain',
    level: 3,
    effect: 'Mage Hand can be cast as a Bonus Action and its spectral hand can be Invisible. You control the hand as a Bonus Action and can make Dexterity (Sleight of Hand) checks through it.',
    source: phbSub('Arcane Trickster: Mage Hand Legerdemain', 6052),
  },
  {
    name: 'Magical Ambush',
    level: 9,
    effect: 'If you are Invisible when you cast a spell on a creature, that creature has Disadvantage on any saving throw against the spell on that same turn.',
    source: phbSub('Arcane Trickster: Magical Ambush', 6054),
  },
  {
    name: 'Versatile Trickster',
    level: 13,
    effect: 'When you use the Trip option of Cunning Strike on a creature, you can also use Trip on a second creature within 5 feet of your Mage Hand.',
    source: phbSub('Arcane Trickster: Versatile Trickster', 6056),
  },
  {
    name: 'Spell Thief',
    level: 17,
    effect: 'As a Reaction right after a creature casts a spell that targets you or includes you in its area, it makes an Intelligence save against your spell save DC. On a failure the spell has no effect on you and you steal it (it must be level 1+ and of a level you can cast; it need not be a Wizard spell): you have it prepared for 8 hours and the creature cannot cast it for that time. Once per Long Rest.',
    mechanics: { activation: 'reaction', stolenSpellHours: 8 },
    uses: { count: 1, recharge: 'long-rest' },
    saveDc: { dcAbility: 'spellcasting', saveAbility: 'int' },
    source: phbSub('Arcane Trickster: Spell Thief', 6058),
  },
];

const ASSASSIN_FEATURES: ClassFeature[] = [
  {
    name: 'Assassinate',
    level: 3,
    effect: 'You have Advantage on Initiative rolls. During the first round of each combat you have Advantage on attack rolls against any creature that has not yet taken a turn, and if your Sneak Attack hits a target that round it takes extra damage of the weapon\'s type equal to your Rogue level.',
    dice: [{ expr: 'RogueLevel', label: 'Surprising Strikes extra damage on a Sneak Attack hit in the first round' }],
    source: phbSub('Assassin: Assassinate', 6080),
  },
  {
    name: "Assassin's Tools",
    level: 3,
    effect: "You gain a Disguise Kit and a Poisoner's Kit and are proficient with both.",
    grantedProficiencies: { tools: ['Disguise Kit', "Poisoner's Kit"] },
    source: phbSub("Assassin: Assassin's Tools", 6086),
  },
  {
    // FLAG: named "Expertise" but grants no skill Expertise (Masterful Mimicry and Roving Aim only), so grantsExpertise is not set.
    name: 'Infiltration Expertise',
    level: 9,
    effect: 'Masterful Mimicry: after studying a person for at least 1 hour you can flawlessly mimic their speech, handwriting, or both. Roving Aim: using Steady Aim no longer drops your Speed to 0.',
    source: phbSub('Assassin: Infiltration Expertise', 6090),
  },
  {
    name: 'Envenom Weapons',
    level: 13,
    effect: 'When your Poison Cunning Strike option is used and the target fails its save, it also takes 2d6 Poison damage, which ignores Resistance to Poison.',
    dice: [{ expr: '2d6', label: 'Poison damage added to the Poison Cunning Strike on a failed save' }],
    source: phbSub('Assassin: Envenom Weapons', 6098),
  },
  {
    name: 'Death Strike',
    level: 17,
    effect: 'When your Sneak Attack hits in the first round of a combat, the target makes a Constitution save (DC 8 + your Dexterity modifier + Proficiency Bonus) or takes double damage from the attack.',
    saveDc: { dcAbility: 'dex', saveAbility: 'con' },
    source: phbSub('Assassin: Death Strike', 6102),
  },
];

const SOULKNIFE_FEATURES: ClassFeature[] = [
  {
    name: 'Psionic Power',
    level: 3,
    effect: 'You have Psionic Energy Dice (4d6 at level 3, 6d8 at 5, 8d8 at 9, 8d10 at 11, 10d10 at 13, 12d12 at 17); regain one on a Short Rest and all on a Long Rest. Psi-Bolstered Knack: after failing an ability check with a skill or tool you are proficient in, roll one die and add it; the die is spent only if the check then succeeds. Psychic Whispers: as a Magic action choose up to your Proficiency Bonus creatures you can see and roll one die; for that many hours you can speak telepathically with them while within 1 mile. The first use after each Long Rest does not spend the die.',
    mechanics: { dieL3: 'd6', numberL3: 4, dieL5: 'd8', numberL5: 6, dieL9: 'd8', numberL9: 8, dieL11: 'd10', numberL11: 8, dieL13: 'd10', numberL13: 10, dieL17: 'd12', numberL17: 12 },
    uses: { count: 4, recharge: 'other' },
    dice: [
      { expr: 'Psionic Energy Dice: 4d6 (L3), 6d8 (L5), 8d8 (L9), 8d10 (L11), 10d10 (L13), 12d12 (L17)', label: 'Psionic Energy Dice pool' },
      { expr: '1 Psionic Die', label: 'Psi-Bolstered Knack bonus to a failed proficient check (expended only on success)' },
      { expr: '1 Psionic Die = hours', label: 'Psychic Whispers duration (targets up to Proficiency Bonus creatures)' },
    ],
    source: phbSub('Soulknife: Psionic Power', 6110),
  },
  {
    name: 'Psychic Blades',
    level: 3,
    effect: 'When you take the Attack action or make an Opportunity Attack you can manifest a Psychic Blade in your free hand and attack with it: Simple Melee, 1d6 Psychic plus the attack ability modifier, Finesse and Thrown (range 60/120), with the Vex mastery that does not count against your Weapon Mastery limit. The blade vanishes after hitting or missing and leaves no mark. After attacking with it you can make a second blade attack as a Bonus Action with a free hand, dealing 1d4 instead.',
    mechanics: { range: '60/120', mastery: 'Vex' },
    dice: [
      { expr: '1d6', label: 'Psychic Blade damage (plus attack ability modifier)' },
      { expr: '1d4', label: 'Bonus Action second Psychic Blade damage' },
    ],
    source: phbSub('Soulknife: Psychic Blades', 6139),
  },
  {
    // Homing Strikes text is from the printed PHB (the OCR shows it only as an image, L6157).
    name: 'Soul Blades',
    level: 9,
    effect: 'Your Psychic Blades gain two powers. Homing Strikes: when a Psychic Blade attack roll misses, you can roll one Psionic Energy Die and add the result to the roll; the die is expended only if that makes the attack hit. Psychic Teleportation: as a Bonus Action, manifest a Psychic Blade, spend and roll one Psionic Energy Die, and throw the blade to an unoccupied space you can see up to 10 times the roll in feet away; you teleport there and the blade vanishes.',
    mechanics: { homingStrikesDice: 1, homingStrikesExpended: 'only-if-hit', teleportActivation: 'bonus-action' },
    dice: [
      { expr: '1 Psionic Die', label: 'Homing Strikes bonus to a missed Psychic Blade attack roll (expended only if it hits)' },
      { expr: '10 x 1 Psionic Die ft', label: 'Psychic Teleportation distance (Bonus Action)' },
    ],
    source: phbSub('Soulknife: Soul Blades', 6153),
  },
  {
    name: 'Psychic Veil',
    level: 13,
    effect: 'As a Magic action you gain the Invisible condition for 1 hour or until you dismiss it; it ends early right after you damage a creature or force a creature to make a save. Once per Long Rest, or restore it by expending a Psionic Energy Die (no action).',
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Soulknife: Psychic Veil', 6161),
  },
  {
    name: 'Rend Mind',
    level: 17,
    effect: 'When you deal Sneak Attack damage with your Psychic Blades you can force the target to make a Wisdom save (DC 8 + your Dexterity modifier + Proficiency Bonus). On a failure it is Stunned for 1 minute, repeating the save at the end of each of its turns. Once per Long Rest, or restore it by expending three Psionic Energy Dice (no action).',
    uses: { count: 1, recharge: 'long-rest' },
    saveDc: { dcAbility: 'dex', saveAbility: 'wis' },
    source: phbSub('Soulknife: Rend Mind', 6167),
  },
];

const THIEF_FEATURES: ClassFeature[] = [
  {
    name: 'Fast Hands',
    level: 3,
    effect: 'As a Bonus Action you can make a Dexterity (Sleight of Hand) check to pick a lock, disarm a trap with Thieves\' Tools, or pick a pocket, or take the Utilize action, or the Magic action to use a magic item that needs it.',
    source: phbSub('Thief: Fast Hands', 6179),
  },
  {
    name: 'Second-Story Work',
    level: 3,
    effect: 'You gain a Climb Speed equal to your Speed, and you can use Dexterity instead of Strength to work out your jump distance.',
    source: phbSub('Thief: Second-Story Work', 6185),
  },
  {
    name: 'Supreme Sneak',
    level: 9,
    effect: 'You gain the Stealth Attack Cunning Strike option (cost 1d6): if you are Invisible from the Hide action, the attack does not end that condition provided you end the turn behind Three-Quarters or Total Cover.',
    dice: [{ expr: '1d6', label: 'Stealth Attack Cunning Strike cost' }],
    source: phbSub('Thief: Supreme Sneak', 6193),
  },
  {
    name: 'Use Magic Device',
    level: 13,
    effect: 'You can attune to up to four magic items. When you use an item property that expends charges, roll 1d6; on a 6 no charges are spent. You can use any Spell Scroll with Intelligence as the spellcasting ability: cantrips and level 1 spells work reliably, higher-level spells need an Intelligence (Arcana) check (DC 10 + spell level) or the scroll crumbles.',
    mechanics: { maxAttunedItems: 4 },
    dice: [
      { expr: '1d6 (6 = no charge spent)', label: 'Charges: free use of a charged item property' },
      { expr: '10 + SpellLevel', label: 'Scrolls: Arcana (Int) check DC for scroll spells above level 1' },
    ],
    source: phbSub('Thief: Use Magic Device', 6199),
  },
  {
    name: "Thief's Reflexes",
    level: 17,
    effect: 'You take two turns in the first round of any combat: the first at your normal Initiative and the second at your Initiative minus 10.',
    source: phbSub("Thief: Thief's Reflexes", 6209),
  },
];

const ABERRANT_FEATURES: ClassFeature[] = [
  {
    // FLAG: the OCR prints the Rary's Telepathic Bond / Telekinesis row as Sorcerer level 6; read as 9 to match the 3/5/7/9 pattern of the other subclasses.
    name: 'Psionic Spells',
    level: 3,
    effect: 'You always have these spells prepared from the listed Sorcerer level: 3 Arms of Hadar, Calm Emotions, Detect Thoughts, Dissonant Whispers, Mind Sliver; 5 Hunger of Hadar, Sending; 7 Evard\'s Black Tentacles, Summon Aberration; 9 Rary\'s Telepathic Bond, Telekinesis.',
    grantedSpells: [
      { level: 3, spells: spellIds('Arms of Hadar', 'Calm Emotions', 'Detect Thoughts', 'Dissonant Whispers', 'Mind Sliver'), alwaysPrepared: true },
      { level: 5, spells: spellIds('Hunger of Hadar', 'Sending'), alwaysPrepared: true },
      { level: 7, spells: spellIds("Evard's Black Tentacles", 'Summon Aberration'), alwaysPrepared: true },
      { level: 9, spells: spellIds("Rary's Telepathic Bond", 'Telekinesis'), alwaysPrepared: true },
    ],
    source: phbSub('Aberrant Sorcery: Psionic Spells', 6540),
  },
  {
    name: 'Telepathic Speech',
    level: 3,
    effect: 'As a Bonus Action, link minds with a creature you can see within 30 feet. You can speak telepathically while within a number of miles equal to your Charisma modifier (minimum 1) of each other, provided you share a language. The link lasts a number of minutes equal to your Sorcerer level and ends early if you link to a different creature.',
    source: phbSub('Aberrant Sorcery: Telepathic Speech', 6553),
  },
  {
    name: 'Psionic Sorcery',
    level: 6,
    effect: 'You can cast any level 1+ spell from Psionic Spells either with a spell slot or by spending Sorcery Points equal to the spell\'s level. Cast with Sorcery Points it needs no Verbal or Somatic components, and no Material components unless they are consumed or have a listed cost.',
    source: phbSub('Aberrant Sorcery: Psionic Sorcery', 6561),
  },
  {
    name: 'Psychic Defenses',
    level: 6,
    effect: 'You have Resistance to Psychic damage and Advantage on saves to avoid or end the Charmed or Frightened condition.',
    source: phbSub('Aberrant Sorcery: Psychic Defenses', 6565),
  },
  {
    name: 'Revelation in Flesh',
    level: 14,
    effect: 'As a Bonus Action spend 1 or more Sorcery Points to alter your body for 10 minutes, gaining one benefit per point spent: Aquatic Adaptation (Swim Speed twice your Speed and water breathing), Glistening Flight (Fly Speed equal to your Speed, can hover), See the Invisible (see Invisible creatures within 60 feet not behind Total Cover), or Wormlike Movement (squeeze through 1-inch spaces and spend 5 feet of movement to escape nonmagical restraints or the Grappled condition).',
    choices: [{ key: 'revelation-in-flesh', count: 1, options: ['Aquatic Adaptation', 'Glistening Flight', 'See the Invisible', 'Wormlike Movement'] }],
    source: phbSub('Aberrant Sorcery: Revelation in Flesh', 6569),
  },
  {
    name: 'Warping Implosion',
    level: 18,
    effect: 'As a Magic action, teleport to an unoccupied space you can see within 120 feet. Each creature within 30 feet of the space you left makes a Strength save against your spell save DC: on a failure it takes 3d10 Force damage and is pulled toward that space; on a success it takes half damage only. Once per Long Rest, or restore it by spending 5 Sorcery Points (no action).',
    dice: [{ expr: '3d10', label: 'Force damage (half on a successful save)' }],
    saveDc: { dcAbility: 'spellcasting', saveAbility: 'str' },
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Aberrant Sorcery: Warping Implosion', 6581),
  },
];

const CLOCKWORK_FEATURES: ClassFeature[] = [
  {
    name: 'Clockwork Spells',
    level: 3,
    effect: 'You always have these spells prepared from the listed Sorcerer level: 3 Aid, Alarm, Lesser Restoration, Protection from Evil and Good; 5 Dispel Magic, Protection from Energy; 7 Freedom of Movement, Summon Construct; 9 Greater Restoration, Wall of Force. You may also pick or roll a purely cosmetic manifestation of order that shows while you cast Sorcerer spells.',
    grantedSpells: [
      { level: 3, spells: spellIds('Aid', 'Alarm', 'Lesser Restoration', 'Protection from Evil and Good'), alwaysPrepared: true },
      { level: 5, spells: spellIds('Dispel Magic', 'Protection from Energy'), alwaysPrepared: true },
      { level: 7, spells: spellIds('Freedom of Movement', 'Summon Construct'), alwaysPrepared: true },
      { level: 9, spells: spellIds('Greater Restoration', 'Wall of Force'), alwaysPrepared: true },
    ],
    source: phbSub('Clockwork Sorcery: Clockwork Spells', 6593),
  },
  {
    name: 'Restore Balance',
    level: 3,
    effect: 'As a Reaction, when a creature you can see within 60 feet is about to roll a d20 with Advantage or Disadvantage, the roll is made without either. You can do this a number of times equal to your Charisma modifier (minimum 1), regaining all uses on a Long Rest.',
    mechanics: { activation: 'reaction' },
    uses: { count: 'Cha mod (min 1)', recharge: 'long-rest' },
    source: phbSub('Clockwork Sorcery: Restore Balance', 6620),
  },
  {
    name: 'Bastion of Law',
    level: 6,
    effect: 'As a Magic action, spend 1 to 5 Sorcery Points to put a ward on yourself or a creature you can see within 30 feet, made of that many d8s. When the warded creature takes damage it can expend some of the dice, roll them, and reduce the damage by the total. The ward lasts until you finish a Long Rest or use this feature again.',
    dice: [{ expr: '1d8 to 5d8 (1 die per Sorcery Point spent, 1-5)', label: 'Ward dice that reduce damage' }],
    source: phbSub('Clockwork Sorcery: Bastion of Law', 6626),
  },
  {
    name: 'Trance of Order',
    level: 14,
    effect: 'As a Bonus Action, enter a trance for 1 minute: attack rolls against you cannot have Advantage, and on any D20 Test a d20 result of 9 or lower counts as 10. Once per Long Rest, or restore it by spending 5 Sorcery Points (no action).',
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Clockwork Sorcery: Trance of Order', 6632),
  },
  {
    name: 'Clockwork Cavalcade',
    level: 18,
    effect: 'As a Magic action, summon spirits of order in a 30-foot Cube from you. They restore up to 100 Hit Points divided as you choose among creatures in the Cube, instantly repair damaged objects entirely inside it, and end every spell of level 6 or lower on creatures and objects of your choice there. Once per Long Rest, or restore it by spending 7 Sorcery Points (no action).',
    dice: [{ expr: '100', label: 'Hit Points restored, divided among creatures in the 30-foot Cube' }],
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Clockwork Sorcery: Clockwork Cavalcade', 6638),
  },
];

const DRACONIC_FEATURES: ClassFeature[] = [
  {
    name: 'Draconic Resilience',
    level: 3,
    effect: 'Your Hit Point maximum rises by 3, plus 1 more each time you gain a Sorcerer level. While you wear no armor, your base Armor Class is 10 + your Dexterity modifier + your Charisma modifier.',
    mechanics: { hpBonusBase: 3, hpBonusPerLevelAfter3: 1, unarmoredAcBase: 10, unarmoredAcAbilities: 'dex+cha' },
    dice: [
      { expr: '3 + (SorcererLevel - 3)', label: 'Hit Point maximum increase (+3, +1 per Sorcerer level gained)' },
      { expr: '10 + DexMod + ChaMod', label: 'Base AC while not wearing armor' },
    ],
    source: phbSub('Draconic Sorcery: Draconic Resilience', 6658),
  },
  {
    name: 'Draconic Spells',
    level: 3,
    effect: 'You always have these spells prepared from the listed Sorcerer level: 3 Alter Self, Chromatic Orb, Command, Dragon\'s Breath; 5 Fear, Fly; 7 Arcane Eye, Charm Monster; 9 Legend Lore, Summon Dragon.',
    grantedSpells: [
      { level: 3, spells: spellIds('Alter Self', 'Chromatic Orb', 'Command', "Dragon's Breath"), alwaysPrepared: true },
      { level: 5, spells: spellIds('Fear', 'Fly'), alwaysPrepared: true },
      { level: 7, spells: spellIds('Arcane Eye', 'Charm Monster'), alwaysPrepared: true },
      { level: 9, spells: spellIds('Legend Lore', 'Summon Dragon'), alwaysPrepared: true },
    ],
    source: phbSub('Draconic Sorcery: Draconic Spells', 6664),
  },
  {
    name: 'Elemental Affinity',
    level: 6,
    effect: 'Choose Acid, Cold, Fire, Lightning or Poison. You gain Resistance to that damage type, and when a spell you cast deals that type you can add your Charisma modifier to one damage roll of the spell.',
    choices: [{ key: 'elemental-affinity', count: 1, options: ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'] }],
    source: phbSub('Draconic Sorcery: Elemental Affinity', 6677),
  },
  {
    name: 'Dragon Wings',
    level: 14,
    effect: 'As a Bonus Action, sprout draconic wings for 1 hour (or until dismissed with no action), giving you a Fly Speed of 60 feet. Once per Long Rest, or restore it by spending 3 Sorcery Points (no action).',
    mechanics: { flySpeedFeet: 60 },
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Draconic Sorcery: Dragon Wings', 6683),
  },
  {
    name: 'Dragon Companion',
    level: 18,
    effect: 'You can cast Summon Dragon without a Material component, and once without a spell slot, regaining that free casting on a Long Rest. When you start casting it you may drop its Concentration requirement, making the duration 1 minute for that casting.',
    grantedSpells: [{ level: 18, spells: spellIds('Summon Dragon'), alwaysPrepared: false }],
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Draconic Sorcery: Dragon Companion', 6689),
  },
];

const WILD_MAGIC_FEATURES: ClassFeature[] = [
  {
    name: 'Wild Magic Surge',
    level: 3,
    effect: 'Once per turn, right after you cast a Sorcerer spell with a spell slot, roll 1d20; on a 20, roll on the Wild Magic Surge table. A spell produced that way is too wild to be affected by your Metamagic.',
    dice: [{ expr: '1d20 (20 = surge)', label: 'Surge trigger, once per turn' }],
    source: phbSub('Wild Magic Sorcery: Wild Magic Surge', 6699),
  },
  {
    name: 'Tides of Chaos',
    level: 3,
    effect: 'You can give yourself Advantage on one D20 Test before rolling. You cannot use this again until you cast a Sorcerer spell with a spell slot or finish a Long Rest; if you cast one before a Long Rest, you automatically roll on the Wild Magic Surge table.',
    uses: { count: 1, recharge: 'other' },
    source: phbSub('Wild Magic Sorcery: Tides of Chaos', 6705),
  },
  {
    name: 'Bend Luck',
    level: 6,
    effect: 'Right after another creature you can see rolls the d20 for a D20 Test, use a Reaction and spend 1 Sorcery Point to roll 1d4 and apply it as a bonus or penalty (your choice) to that roll.',
    mechanics: { activation: 'reaction' },
    dice: [{ expr: '1d4', label: "Bonus or penalty to another creature's d20 (costs 1 Sorcery Point)" }],
    source: phbSub('Wild Magic Sorcery: Bend Luck', 6711),
  },
  {
    name: 'Controlled Chaos',
    level: 14,
    effect: 'Whenever you roll on the Wild Magic Surge table you can roll twice and use either result.',
    source: phbSub('Wild Magic Sorcery: Controlled Chaos', 6715),
  },
  {
    name: 'Tamed Surge',
    level: 18,
    effect: 'Right after you cast a Sorcerer spell with a spell slot, you can choose any effect on the Wild Magic Surge table except the final row instead of rolling (making any roll the effect involves). Once per Long Rest.',
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Wild Magic Sorcery: Tamed Surge', 6721),
  },
];

const ARCHFEY_FEATURES: ClassFeature[] = [
  {
    name: 'Archfey Spells',
    level: 3,
    effect: 'You always have these spells prepared from the listed Warlock level: 3 Calm Emotions, Faerie Fire, Misty Step, Phantasmal Force, Sleep; 5 Blink, Plant Growth; 7 Dominate Beast, Greater Invisibility; 9 Dominate Person, Seeming.',
    grantedSpells: [
      { level: 3, spells: spellIds('Calm Emotions', 'Faerie Fire', 'Misty Step', 'Phantasmal Force', 'Sleep'), alwaysPrepared: true },
      { level: 5, spells: spellIds('Blink', 'Plant Growth'), alwaysPrepared: true },
      { level: 7, spells: spellIds('Dominate Beast', 'Greater Invisibility'), alwaysPrepared: true },
      { level: 9, spells: spellIds('Dominate Person', 'Seeming'), alwaysPrepared: true },
    ],
    source: phbSub('Archfey Patron: Archfey Spells', 7187),
  },
  {
    name: 'Steps of the Fey',
    level: 3,
    effect: 'You can cast Misty Step without a spell slot a number of times equal to your Charisma modifier (minimum 1), regaining all uses on a Long Rest. Whenever you cast it you may add an effect. Refreshing Step: you or a creature you can see within 10 feet gains 1d10 Temporary Hit Points after the teleport. Taunting Step: creatures within 5 feet of the space you left make a Wisdom save against your spell save DC or have Disadvantage on attacks against anyone but you until the start of your next turn.',
    grantedSpells: [{ level: 3, spells: spellIds('Misty Step'), alwaysPrepared: false }],
    uses: { count: 'Cha mod (min 1)', recharge: 'long-rest' },
    dice: [{ expr: '1d10', label: 'Refreshing Step Temporary Hit Points' }],
    saveDc: { dcAbility: 'spellcasting', saveAbility: 'wis' },
    source: phbSub('Archfey Patron: Steps of the Fey', 7200),
  },
  {
    name: 'Misty Escape',
    level: 6,
    effect: 'You can cast Misty Step as a Reaction when you take damage. Two more Steps of the Fey options appear. Disappearing Step: you are Invisible until the start of your next turn or right after you make an attack roll, deal damage or cast a spell. Dreadful Step: creatures within 5 feet of the space you left or the one you appear in (your choice) make a Wisdom save against your spell save DC or take 2d10 Psychic damage.',
    mechanics: { activation: 'reaction' },
    dice: [{ expr: '2d10', label: 'Dreadful Step Psychic damage' }],
    saveDc: { dcAbility: 'spellcasting', saveAbility: 'wis' },
    source: phbSub('Archfey Patron: Misty Escape', 7210),
  },
  {
    name: 'Beguiling Defenses',
    level: 10,
    effect: 'You are immune to the Charmed condition. As a Reaction right after a creature you can see hits you with an attack roll, halve the damage you take (round down) and force the attacker to make a Wisdom save against your spell save DC; on a failure it takes Psychic damage equal to the damage you take. Once per Long Rest, or restore it by expending a Pact Magic spell slot (no action).',
    mechanics: { activation: 'reaction', immuneCondition: 'Charmed' },
    uses: { count: 1, recharge: 'long-rest' },
    saveDc: { dcAbility: 'spellcasting', saveAbility: 'wis' },
    source: phbSub('Archfey Patron: Beguiling Defenses', 7220),
  },
  {
    name: 'Bewitching Magic',
    level: 14,
    effect: 'Right after you cast an Enchantment or Illusion spell using an action and a spell slot, you can cast Misty Step as part of the same action without expending a slot.',
    grantedSpells: [{ level: 14, spells: spellIds('Misty Step'), alwaysPrepared: false }],
    source: phbSub('Archfey Patron: Bewitching Magic', 7228),
  },
];

const CELESTIAL_FEATURES: ClassFeature[] = [
  {
    // FLAG: Light and Sacred Flame are cantrips; they are recorded as always-prepared like the rest of the table row.
    name: 'Celestial Spells',
    level: 3,
    effect: 'You always have these spells prepared from the listed Warlock level: 3 Aid, Cure Wounds, Guiding Bolt, Lesser Restoration, Light, Sacred Flame; 5 Daylight, Revivify; 7 Guardian of Faith, Wall of Fire; 9 Greater Restoration, Summon Celestial.',
    grantedSpells: [
      { level: 3, spells: spellIds('Aid', 'Cure Wounds', 'Guiding Bolt', 'Lesser Restoration', 'Light', 'Sacred Flame'), alwaysPrepared: true },
      { level: 5, spells: spellIds('Daylight', 'Revivify'), alwaysPrepared: true },
      { level: 7, spells: spellIds('Guardian of Faith', 'Wall of Fire'), alwaysPrepared: true },
      { level: 9, spells: spellIds('Greater Restoration', 'Summon Celestial'), alwaysPrepared: true },
    ],
    source: phbSub('Celestial Patron: Celestial Spells', 7238),
  },
  {
    name: 'Healing Light',
    level: 3,
    effect: 'You have a pool of d6s equal in number to 1 + your Warlock level. As a Bonus Action, heal yourself or a creature you can see within 60 feet by spending dice from the pool (at most your Charisma modifier, minimum 1, at once) and restoring Hit Points equal to the total rolled. The pool refills on a Long Rest.',
    uses: { count: 1, recharge: 'long-rest' },
    dice: [{ expr: '(1 + WarlockLevel)d6', label: 'Healing dice pool (spend up to ChaMod, min 1, at once)' }],
    source: phbSub('Celestial Patron: Healing Light', 7252),
  },
  {
    name: 'Radiant Soul',
    level: 6,
    effect: 'You have Resistance to Radiant damage. Once per turn, when a spell you cast deals Radiant or Fire damage, you can add your Charisma modifier to the damage against one of its targets.',
    source: phbSub('Celestial Patron: Radiant Soul', 7258),
  },
  {
    name: 'Celestial Resilience',
    level: 10,
    effect: 'Whenever you use Magical Cunning or finish a Short or Long Rest, you gain Temporary Hit Points equal to your Warlock level + your Charisma modifier. You also choose up to five creatures you can see, each gaining Temporary Hit Points equal to half your Warlock level + your Charisma modifier.',
    dice: [
      { expr: 'WarlockLevel + ChaMod', label: 'Temporary Hit Points for you' },
      { expr: 'floor(WarlockLevel/2) + ChaMod', label: 'Temporary Hit Points for up to five chosen creatures' },
    ],
    source: phbSub('Celestial Patron: Celestial Resilience', 7262),
  },
  {
    name: 'Searing Vengeance',
    level: 14,
    effect: 'When you or an ally within 60 feet is about to make a Death Saving Throw, you can release radiant energy: that creature regains Hit Points equal to half its Hit Point maximum and can end the Prone condition on itself, and each creature of your choice within 30 feet of it takes Radiant damage of 2d8 + your Charisma modifier and is Blinded until the end of the current turn. Once per Long Rest.',
    uses: { count: 1, recharge: 'long-rest' },
    dice: [{ expr: '2d8 + ChaMod', label: 'Radiant damage to creatures within 30 feet' }],
    source: phbSub('Celestial Patron: Searing Vengeance', 7264),
  },
];

const FIEND_FEATURES: ClassFeature[] = [
  {
    name: "Dark One's Blessing",
    level: 3,
    effect: 'When you reduce an enemy to 0 Hit Points, you gain Temporary Hit Points equal to your Charisma modifier + your Warlock level (minimum 1). You also gain them when someone else reduces an enemy within 10 feet of you to 0.',
    dice: [{ expr: 'ChaMod + WarlockLevel (min 1)', label: 'Temporary Hit Points' }],
    source: phbSub("Fiend Patron: Dark One's Blessing", 7274),
  },
  {
    name: 'Fiend Spells',
    level: 3,
    effect: 'You always have these spells prepared from the listed Warlock level: 3 Burning Hands, Command, Scorching Ray, Suggestion; 5 Fireball, Stinking Cloud; 7 Fire Shield, Wall of Fire; 9 Geas, Insect Plague.',
    grantedSpells: [
      { level: 3, spells: spellIds('Burning Hands', 'Command', 'Scorching Ray', 'Suggestion'), alwaysPrepared: true },
      { level: 5, spells: spellIds('Fireball', 'Stinking Cloud'), alwaysPrepared: true },
      { level: 7, spells: spellIds('Fire Shield', 'Wall of Fire'), alwaysPrepared: true },
      { level: 9, spells: spellIds('Geas', 'Insect Plague'), alwaysPrepared: true },
    ],
    source: phbSub('Fiend Patron: Fiend Spells', 7276),
  },
  {
    name: "Dark One's Own Luck",
    level: 6,
    effect: 'When you make an ability check or saving throw, you can add 1d10 to the roll after seeing it but before its effects occur, no more than once per roll. You can do this a number of times equal to your Charisma modifier (minimum 1), regaining all uses on a Long Rest.',
    dice: [{ expr: '1d10', label: 'Bonus to an ability check or saving throw' }],
    uses: { count: 'Cha mod (min 1)', recharge: 'long-rest' },
    source: phbSub("Fiend Patron: Dark One's Own Luck", 7293),
  },
  {
    name: 'Fiendish Resilience',
    level: 10,
    effect: 'Whenever you finish a Short or Long Rest, choose one damage type other than Force; you have Resistance to it until you choose a different one with this feature.',
    source: phbSub('Fiend Patron: Fiendish Resilience', 7299),
  },
  {
    name: 'Hurl Through Hell',
    level: 14,
    effect: 'Once per turn when you hit a creature with an attack roll, you can force it to make a Charisma save against your spell save DC. On a failure it is sent through a nightmare landscape, taking 8d10 Psychic damage (none if it is a Fiend) and being Incapacitated until the end of your next turn, when it returns to its space or the nearest free one. Once per Long Rest, or restore it by expending a Pact Magic spell slot (no action).',
    dice: [{ expr: '8d10', label: 'Psychic damage (not to Fiends)' }],
    saveDc: { dcAbility: 'spellcasting', saveAbility: 'cha' },
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Fiend Patron: Hurl Through Hell', 7303),
  },
];

const GREAT_OLD_ONE_FEATURES: ClassFeature[] = [
  {
    name: 'Awakened Mind',
    level: 3,
    effect: 'As a Bonus Action, link minds with a creature you can see within 30 feet. You can speak telepathically while within a number of miles equal to your Charisma modifier (minimum 1) of each other, provided you share a language. The link lasts a number of minutes equal to your Warlock level and ends early if you link to a different creature.',
    source: phbSub('Great Old One Patron: Awakened Mind', 7315),
  },
  {
    name: 'Great Old One Spells',
    level: 3,
    effect: 'You always have these spells prepared from the listed Warlock level: 3 Detect Thoughts, Dissonant Whispers, Phantasmal Force, Tasha\'s Hideous Laughter; 5 Clairvoyance, Hunger of Hadar; 7 Confusion, Summon Aberration; 9 Modify Memory, Telekinesis.',
    grantedSpells: [
      { level: 3, spells: spellIds('Detect Thoughts', 'Dissonant Whispers', 'Phantasmal Force', "Tasha's Hideous Laughter"), alwaysPrepared: true },
      { level: 5, spells: spellIds('Clairvoyance', 'Hunger of Hadar'), alwaysPrepared: true },
      { level: 7, spells: spellIds('Confusion', 'Summon Aberration'), alwaysPrepared: true },
      { level: 9, spells: spellIds('Modify Memory', 'Telekinesis'), alwaysPrepared: true },
    ],
    source: phbSub('Great Old One Patron: Great Old One Spells', 7323),
  },
  {
    name: 'Psychic Spells',
    level: 3,
    effect: 'Warlock spells you cast that deal damage can have their damage type changed to Psychic, and Warlock Enchantment or Illusion spells you cast can omit Verbal and Somatic components.',
    source: phbSub('Great Old One Patron: Psychic Spells', 7336),
  },
  {
    name: 'Clairvoyant Combatant',
    level: 6,
    effect: 'When you form a bond with Awakened Mind you can force the creature to make a Wisdom save against your spell save DC. On a failure, for the duration of the bond it has Disadvantage on attack rolls against you and you have Advantage on attack rolls against it. Once per Short or Long Rest, or restore it by expending a Pact Magic spell slot (no action).',
    uses: { count: 1, recharge: 'short-or-long-rest' },
    saveDc: { dcAbility: 'spellcasting', saveAbility: 'wis' },
    source: phbSub('Great Old One Patron: Clairvoyant Combatant', 7340),
  },
  {
    name: 'Eldritch Hex',
    level: 10,
    effect: 'You always have Hex prepared. When you cast Hex and choose an ability, the target also has Disadvantage on saving throws of that ability for the spell\'s duration.',
    grantedSpells: [{ level: 10, spells: spellIds('Hex'), alwaysPrepared: true }],
    source: phbSub('Great Old One Patron: Eldritch Hex', 7346),
  },
  {
    name: 'Thought Shield',
    level: 10,
    effect: 'Your thoughts cannot be read by telepathy or other means unless you allow it. You have Resistance to Psychic damage, and any creature that deals Psychic damage to you takes the same amount of damage.',
    source: phbSub('Great Old One Patron: Thought Shield', 7350),
  },
  {
    // FLAG: the opening paragraph of this feature is missing from the OCR, so what the feature itself grants is not recorded; only the surviving riders are.
    name: 'Create Thrall',
    level: 14,
    effect: 'The first time each turn your summoned Aberration hits a creature under your Hex, it deals extra Psychic damage equal to the Hex bonus damage. When you cast Summon Aberration you can drop its Concentration requirement, making the duration 1 minute for that casting; the Aberration then has Temporary Hit Points equal to your Warlock level + your Charisma modifier.',
    source: phbSub('Great Old One Patron: Create Thrall', 7354),
  },
];

const ABJURER_FEATURES: ClassFeature[] = [
  {
    name: 'Abjuration Savant',
    level: 3,
    effect: 'Add two Abjuration Wizard spells of level 2 or lower to your spellbook for free. Whenever you gain access to a new level of spell slots as a Wizard, you can add one more Abjuration Wizard spell of a level you have slots for.',
    choices: [{ key: 'abjuration-savant-spells', count: 2, options: ['Abjuration school Wizard spells of level 2 or lower'] }],
    source: phbSub('Abjurer: Abjuration Savant', 7658),
  },
  {
    name: 'Arcane Ward',
    level: 3,
    effect: 'When you cast an Abjuration spell with a spell slot, you can create a ward on yourself that lasts until a Long Rest. Its Hit Point maximum is twice your Wizard level + your Intelligence modifier. It takes damage instead of you (after your Resistances and Vulnerabilities apply); remaining damage passes to you, and at 0 Hit Points it cannot absorb damage but persists. Casting an Abjuration spell with a slot, or spending a slot as a Bonus Action, restores twice the slot level in ward Hit Points. You can create the ward only once per Long Rest.',
    dice: [{ expr: '2 x WizardLevel + IntMod', label: 'Ward Hit Point maximum' }],
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Abjurer: Arcane Ward', 7664),
  },
  {
    name: 'Projected Ward',
    level: 6,
    effect: 'When a creature you can see within 30 feet takes damage, you can use a Reaction to have your Arcane Ward absorb it. If that reduces the ward to 0 Hit Points the creature takes the rest, applying its Resistances and Vulnerabilities before reducing the ward.',
    mechanics: { activation: 'reaction' },
    source: phbSub('Abjurer: Projected Ward', 7672),
  },
  {
    // The second paragraph (slot not expended on failure) is from the printed PHB (the OCR is garbled, L7680).
    name: 'Spell Breaker',
    level: 10,
    effect: 'You always have Counterspell and Dispel Magic prepared. You can cast Dispel Magic as a Bonus Action and add your Proficiency Bonus to its ability check. When you cast either spell with a spell slot, the slot is not expended if the spell fails to stop a spell.',
    mechanics: { dispelMagicActivation: 'bonus-action', dispelMagicCheckBonus: 'proficiency-bonus', slotNotExpendedOnFailure: 'counterspell|dispel-magic' },
    grantedSpells: [{ level: 10, spells: spellIds('Counterspell', 'Dispel Magic'), alwaysPrepared: true }],
    source: phbSub('Abjurer: Spell Breaker', 7676),
  },
  {
    name: 'Spell Resistance',
    level: 14,
    effect: 'You have Advantage on saving throws against spells and Resistance to spell damage.',
    source: phbSub('Abjurer: Spell Resistance', 7682),
  },
];

const DIVINER_FEATURES: ClassFeature[] = [
  {
    name: 'Divination Savant',
    level: 3,
    effect: 'Add two Divination Wizard spells of level 2 or lower to your spellbook for free. Whenever you gain access to a new level of spell slots as a Wizard, you can add one more Divination Wizard spell of a level you have slots for.',
    choices: [{ key: 'divination-savant-spells', count: 2, options: ['Divination school Wizard spells of level 2 or lower'] }],
    source: phbSub('Diviner: Divination Savant', 7692),
  },
  {
    name: 'Portent',
    level: 3,
    effect: 'After each Long Rest, roll two d20s and record them as foretelling rolls. Before a D20 Test made by you or a creature you can see, you can replace its roll with one of them, once per turn. Each foretelling roll is used once, and unused ones are lost at your next Long Rest.',
    dice: [{ expr: '2d20 (3d20 at L14 via Greater Portent)', label: 'Foretelling rolls after a Long Rest' }],
    source: phbSub('Diviner: Portent', 7698),
  },
  {
    name: 'Expert Divination',
    level: 6,
    effect: 'When you cast a Divination spell using a level 2+ slot, you regain one expended spell slot of a lower level than the one you spent, no higher than level 5.',
    source: phbSub('Diviner: Expert Divination', 7704),
  },
  {
    name: 'The Third Eye',
    level: 10,
    effect: 'You gain Darkvision with a range of 120 feet. As a Bonus Action choose one benefit lasting until you start a Short or Long Rest: Greater Comprehension (read any language) or See Invisibility (cast it without a spell slot). You cannot use this again until a Short or Long Rest.',
    mechanics: { darkvisionFeet: 120 },
    grantedSpells: [{ level: 10, spells: spellIds('See Invisibility'), alwaysPrepared: false }],
    uses: { count: 1, recharge: 'short-or-long-rest' },
    choices: [{ key: 'third-eye', count: 1, options: ['Greater Comprehension', 'See Invisibility'] }],
    source: phbSub('Diviner: The Third Eye', 7708),
  },
  {
    name: 'Greater Portent',
    level: 14,
    effect: 'You roll three d20s instead of two for your Portent feature.',
    source: phbSub('Diviner: Greater Portent', 7718),
  },
];

const EVOKER_FEATURES: ClassFeature[] = [
  {
    name: 'Evocation Savant',
    level: 3,
    effect: 'Add two Evocation Wizard spells of level 2 or lower to your spellbook for free. Whenever you gain access to a new level of spell slots as a Wizard, you can add one more Evocation Wizard spell of a level you have slots for.',
    choices: [{ key: 'evocation-savant-spells', count: 2, options: ['Evocation school Wizard spells of level 2 or lower'] }],
    source: phbSub('Evoker: Evocation Savant', 7732),
  },
  {
    name: 'Potent Cantrip',
    level: 3,
    effect: 'When you miss with a cantrip attack roll or a target succeeds on its save against your cantrip, the target still takes half the cantrip\'s damage (if any) but suffers no additional effect.',
    source: phbSub('Evoker: Potent Cantrip', 7738),
  },
  {
    name: 'Sculpt Spells',
    level: 6,
    effect: 'When you cast an Evocation spell affecting other creatures you can see, choose a number of them equal to 1 + the spell\'s level. They automatically succeed on their saves against it and take no damage if they would normally take half on a success.',
    mechanics: { protectedCreaturesBase: 1 },
    source: phbSub('Evoker: Sculpt Spells', 7742),
  },
  {
    name: 'Empowered Evocation',
    level: 10,
    effect: 'When you cast a Wizard spell from the Evocation school, you can add your Intelligence modifier to one damage roll of that spell.',
    source: phbSub('Evoker: Empowered Evocation', 7746),
  },
  {
    name: 'Overchannel',
    level: 14,
    effect: 'When you cast a damaging Wizard spell with a slot of level 1-5, you can deal its maximum damage on the turn you cast it. The first use before a Long Rest has no drawback; each later use before a Long Rest, right after casting you take 2d12 Necrotic damage per level of the slot spent, increasing by 1d12 per level for each further use. This damage ignores Resistance and Immunity.',
    dice: [{ expr: '2d12 per spell level, +1d12 per further use before a Long Rest', label: 'Necrotic damage from repeated use' }],
    source: phbSub('Evoker: Overchannel', 7748),
  },
];

const ILLUSIONIST_FEATURES: ClassFeature[] = [
  {
    // FLAG: the "Illusionist" heading is missing from the OCR (only the tagline survives); the name comes from the class intro.
    name: 'Illusion Savant',
    level: 3,
    effect: 'Add two Illusion Wizard spells of level 2 or lower to your spellbook for free. Whenever you gain access to a new level of spell slots as a Wizard, you can add one more Illusion Wizard spell of a level you have slots for.',
    choices: [{ key: 'illusion-savant-spells', count: 2, options: ['Illusion school Wizard spells of level 2 or lower'] }],
    source: phbSub('Illusionist: Illusion Savant', 7760),
  },
  {
    name: 'Improved Illusions',
    level: 3,
    effect: 'You can cast Illusion spells without Verbal components, and an Illusion spell with a range of 10+ feet gains 60 feet of range. You also know Minor Illusion (if you already know it, learn a different Wizard cantrip) without it counting against your cantrips known; one casting can produce both a sound and an image, and you can cast it as a Bonus Action.',
    mechanics: { illusionRangeBonusFeet: 60 },
    grantedSpells: [{ level: 3, spells: spellIds('Minor Illusion'), alwaysPrepared: false }],
    source: phbSub('Illusionist: Improved Illusions', 7766),
  },
  {
    name: 'Phantasmal Creatures',
    level: 6,
    effect: 'You always have Summon Beast and Summon Fey prepared. When you cast either you can change its school to Illusion, making the creature spectral, and cast that version without a spell slot, which halves the creature\'s Hit Points. After casting either spell without a slot, you must finish a Long Rest before casting that spell that way again.',
    grantedSpells: [{ level: 6, spells: spellIds('Summon Beast', 'Summon Fey'), alwaysPrepared: true }],
    uses: { count: 1, recharge: 'long-rest' },
    source: phbSub('Illusionist: Phantasmal Creatures', 7772),
  },
  {
    name: 'Illusory Self',
    level: 10,
    effect: 'When a creature hits you with an attack roll, use a Reaction to interpose an illusory duplicate so the attack automatically misses and the illusion dissipates. Once per Short or Long Rest, or restore it by expending a level 2+ spell slot (no action).',
    mechanics: { activation: 'reaction' },
    uses: { count: 1, recharge: 'short-or-long-rest' },
    source: phbSub('Illusionist: Illusory Self', 7776),
  },
  {
    name: 'Illusory Reality',
    level: 14,
    effect: 'When you cast an Illusion spell with a spell slot, you can use a Bonus Action on your turn while it is ongoing to make one inanimate, nonmagical object in the illusion real for 1 minute. It cannot deal damage or inflict conditions.',
    source: phbSub('Illusionist: Illusory Reality', 7782),
  },
];

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
    multiclassPrereq: { all: ['str'] }, // PHB 2024 "Multiclassing: Prerequisites" + Barbarian primary Str (line ~2385).
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
      {
        id: 'berserker',
        name: 'Path of the Berserker',
        features: [
          {
            // FLAG: the die size is OCR-damaged in the PHB text ("dÃ¡s"); only the count source is recorded.
            name: 'Frenzy',
            level: 3,
            effect: 'While Raging, if you use Reckless Attack, the first target you hit each turn with a Strength-based attack takes extra damage: roll a number of dice equal to your Rage Damage bonus and add them. It matches the damage type of the weapon or Unarmed Strike.',
            source: phbSub('Path of the Berserker: Frenzy', 2561),
          },
          {
            name: 'Mindless Rage',
            level: 6,
            effect: 'While Raging you are immune to the Charmed and Frightened conditions, and entering a Rage ends either condition already on you.',
            source: phbSub('Path of the Berserker: Mindless Rage', 2565),
          },
          {
            name: 'Retaliation',
            level: 10,
            effect: 'When a creature within 5 feet damages you, use your Reaction to make one melee attack against it with a weapon or Unarmed Strike.',
            mechanics: { activation: 'reaction' },
            source: phbSub('Path of the Berserker: Retaliation', 2567),
          },
          {
            name: 'Intimidating Presence',
            level: 14,
            effect: 'As a Bonus Action, each creature of your choice in a 30-foot Emanation makes a Wisdom save (DC 8 + Str mod + Proficiency Bonus) or is Frightened for 1 minute, repeating the save at the end of each of its turns. One use per Long Rest; expend a use of Rage (no action) to restore it.',
            uses: { count: 1, recharge: 'long-rest' },
            saveDc: { dcAbility: 'str', saveAbility: 'wis' },
            source: phbSub('Path of the Berserker: Intimidating Presence', 2571),
          },
        ], source: 'PHB 2024 "Barbarian Subclasses" (line ~2556)' },
      {
        id: 'wildHeart',
        name: 'Path of the Wild Heart',
        features: [
          {
            name: 'Animal Speaker',
            level: 3,
            effect: 'You can cast Beast Sense and Speak with Animals, but only as Rituals, using Wisdom as the spellcasting ability.',
            grantedSpells: [{ level: 3, spells: spellIds('Beast Sense', 'Speak with Animals'), alwaysPrepared: false }],
            source: phbSub('Path of the Wild Heart: Animal Speaker', 2581),
          },
          {
            name: 'Rage of the Wilds',
            level: 3,
            effect: 'Each time you activate Rage, pick one: Bear (Resistance to all damage except Force, Necrotic, Psychic, Radiant), Eagle (Disengage and Dash as part of the Rage Bonus Action, and as a Bonus Action while Raging), or Wolf (allies have Advantage on attacks against enemies within 5 feet of you).',
            choices: [{ key: 'rage-of-the-wilds', count: 1, options: ['Bear', 'Eagle', 'Wolf'] }],
            source: phbSub('Path of the Wild Heart: Rage of the Wilds', 2583),
          },
          {
            name: 'Aspect of the Wilds',
            level: 6,
            effect: 'Choose one, changeable after each Long Rest: Owl (Darkvision 60 feet, or +60 feet if you already have it), Panther (Climb Speed equal to your Speed), or Salmon (Swim Speed equal to your Speed).',
            choices: [{ key: 'aspect-of-the-wilds', count: 1, options: ['Owl', 'Panther', 'Salmon'] }],
            source: phbSub('Path of the Wild Heart: Aspect of the Wilds', 2593),
          },
          {
            name: 'Nature Speaker',
            level: 10,
            effect: 'You can cast Commune with Nature, but only as a Ritual, using Wisdom as the spellcasting ability.',
            grantedSpells: [{ level: 10, spells: spellIds('Commune with Nature'), alwaysPrepared: false }],
            source: phbSub('Path of the Wild Heart: Nature Speaker', 2601),
          },
          {
            name: 'Power of the Wilds',
            level: 14,
            effect: 'Each time you activate Rage, pick one: Falcon (Fly Speed equal to your Speed while unarmored), Lion (enemies within 5 feet have Disadvantage on attacks against anyone except you or another Barbarian with this option), or Ram (melee hits can knock a Large or smaller creature Prone).',
            choices: [{ key: 'power-of-the-wilds', count: 1, options: ['Falcon', 'Lion', 'Ram'] }],
            source: phbSub('Path of the Wild Heart: Power of the Wilds', 2605),
          },
        ], source: 'PHB 2024 "Barbarian Subclasses" (line ~2553)' },
      {
        id: 'worldTree',
        name: 'Path of the World Tree',
        features: [
          {
            name: 'Vitality of the Tree',
            level: 3,
            effect: 'Vitality Surge: activating Rage gives you Temporary Hit Points equal to your Barbarian level. Life-Giving Force: at the start of each of your turns while Raging, another creature within 10 feet gains Temporary Hit Points equal to Rage Damage bonus d6s rolled (they vanish when the Rage ends).',
            dice: [{ expr: 'RageDamage d6', label: 'Life-Giving Force temporary hit points' }],
            source: phbSub('Path of the World Tree: Vitality of the Tree', 2623),
          },
          {
            name: 'Branches of the Tree',
            level: 6,
            effect: 'While Raging, when a creature you can see starts its turn within 30 feet, use your Reaction to force a Strength save (DC 8 + Str mod + Proficiency Bonus) or it is teleported to an unoccupied space you can see within 5 feet of you; you can then reduce its Speed to 0 until the turn ends.',
            mechanics: { activation: 'reaction' },
            saveDc: { dcAbility: 'str', saveAbility: 'str' },
            source: phbSub('Path of the World Tree: Branches of the Tree', 2629),
          },
          {
            name: 'Battering Roots',
            level: 10,
            effect: 'On your turn, your reach is 10 feet greater with Melee weapons that have the Heavy or Versatile property, and when you hit with one you can use the Push or Topple mastery in addition to another mastery property you are using.',
            source: phbSub('Path of the World Tree: Battering Roots', 2631),
          },
          {
            name: 'Travel Along the Tree',
            level: 14,
            effect: 'When you activate Rage, and as a Bonus Action while Raging, teleport up to 60 feet to an unoccupied space you can see. Once per Rage the range becomes 150 feet and you can bring up to six willing creatures within 10 feet of you.',
            uses: { count: 1, recharge: 'other' },
            source: phbSub('Path of the World Tree: Travel Along the Tree', 2635),
          },
        ], source: 'PHB 2024 "Barbarian Subclasses" (line ~2553)' },
      {
        id: 'zealot',
        name: 'Path of the Zealot',
        features: [
          {
            name: 'Divine Fury',
            level: 3,
            effect: 'While Raging, the first creature you hit on each of your turns with a weapon or Unarmed Strike takes extra damage of 1d6 + half your Barbarian level (round down), Necrotic or Radiant (your choice each time).',
            dice: [{ expr: '1d6 + floor(BarbarianLevel/2)', label: 'Necrotic or Radiant extra damage' }],
            source: phbSub('Path of the Zealot: Divine Fury', 2643),
          },
          {
            name: 'Warrior of the Gods',
            level: 3,
            effect: 'You have a pool of d12s (4, rising to 5 at level 6, 6 at level 12, 7 at level 17). As a Bonus Action, spend dice from the pool, roll them, and regain Hit Points equal to the total. The pool refills on a Long Rest.',
            dice: [{ expr: '4d12 (5 at L6, 6 at L12, 7 at L17)', label: 'Bonus Action healing pool' }],
            uses: { count: 4, recharge: 'long-rest' },
            source: phbSub('Path of the Zealot: Warrior of the Gods', 2647),
          },
          {
            name: 'Fanatical Focus',
            level: 6,
            effect: 'Once per active Rage, when you fail a saving throw you can reroll it with a bonus equal to your Rage Damage bonus, and you must keep the new roll.',
            uses: { count: 1, recharge: 'other' },
            source: phbSub('Path of the Zealot: Fanatical Focus', 2655),
          },
          {
            name: 'Zealous Presence',
            level: 10,
            effect: 'As a Bonus Action, up to ten other creatures of your choice within 60 feet gain Advantage on attack rolls and saving throws until the start of your next turn. One use per Long Rest; expend a use of Rage (no action) to restore it.',
            uses: { count: 1, recharge: 'long-rest' },
            source: phbSub('Path of the Zealot: Zealous Presence', 2659),
          },
          {
            name: 'Rage of the Gods',
            level: 14,
            effect: 'When you activate Rage you can take a divine form for 1 minute (ends at 0 Hit Points): Fly Speed equal to your Speed with hovering; Resistance to Necrotic, Psychic and Radiant damage; and a Reaction to expend a Rage use so a creature within 30 feet that would drop to 0 HP instead is set to HP equal to your Barbarian level. Once per Long Rest.',
            uses: { count: 1, recharge: 'long-rest' },
            source: phbSub('Path of the Zealot: Rage of the Gods', 2665),
          },
        ], source: 'PHB 2024 "Barbarian Subclasses" (line ~2553)' },
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
    multiclassPrereq: { all: ['cha'] }, // PHB 2024 "Multiclassing: Prerequisites" + Bard primary Cha (line ~2691).
    savingThrows: ['dex', 'cha'], // PHB 2024 "Core Bard Traits": Dex & Cha saves (line ~2691).
    skillChoices: { count: 3, from: 'any' }, // PHB 2024 "Core Bard Traits": Choose any 3 skills (line ~2691).
    armorTraining: ['Light armor'], // PHB 2024 "Core Bard Traits" (line ~2691).
    weaponProficiencies: ['Simple weapons'], // PHB 2024 "Core Bard Traits" (line ~2691).
    weaponProficiency: { simple: true, martial: false }, // structured form of the line above (Stage A5d)
    toolProficiencies: ['Three Musical Instruments of your choice'], // PHB 2024 "Core Bard Traits" (line ~2691).
    startingEquipment:
      "(A) Leather Armor, 2 Daggers, Musical Instrument, Entertainer's Pack, 19 GP; or (B) 90 GP", // PHB 2024 "Core Bard Traits".
    subclassLevel: 3, // PHB 2024 "Bard: Bard Subclass" at level 3 (line ~2806).
    source: 'PHB 2024 "Core Bard Traits" / "Bard Features"',
    // PHB 2024 p.58: Bard features by level (features table line ~2763; descriptions line ~2727).
    features: [
      {
        name: 'Bardic Inspiration',
        level: 1,
        effect: 'As a Bonus Action, give a creature within 60 feet a Bardic Inspiration die (added to a later failed D20 Test). Uses equal your Cha mod (minimum 1); the die grows (d6â†’d8â†’d10â†’d12) at levels 5/10/15.',
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
        mechanics: { activation: 'reaction' },
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
      {
        id: 'dance',
        name: 'College of Dance',
        features: [
          {
            name: 'Dazzling Footwork',
            level: 3,
            effect: 'Advantage on Charisma (Performance) checks that involve dancing. While wearing no armor and no Shield: base AC is 10 + Dex mod + Cha mod; Unarmed Strikes can use Dexterity and can deal your Bardic Inspiration die + Dex mod Bludgeoning damage instead (the die is not spent); and when you expend Bardic Inspiration as part of an action, Bonus Action or Reaction you can make one Unarmed Strike as part of it.',
            source: phbSub('College of Dance: Dazzling Footwork', 2987),
          },
          {
            name: 'Inspiring Movement',
            level: 6,
            effect: 'When an enemy you can see ends its turn within 5 feet of you, use your Reaction and expend a Bardic Inspiration use to move up to half your Speed; one ally within 30 feet may then use their Reaction to move up to half their Speed. This movement provokes no Opportunity Attacks.',
            mechanics: { activation: 'reaction' },
            uses: { count: 'Bardic Inspiration use', recharge: 'other' },
            source: phbSub('College of Dance: Inspiring Movement', 2999),
          },
          {
            name: 'Tandem Footwork',
            level: 6,
            effect: 'When you roll Initiative (and are not Incapacitated), you can expend a Bardic Inspiration use and roll the die; you and each ally within 30 feet who can see or hear you gain an Initiative bonus equal to the roll.',
            uses: { count: 'Bardic Inspiration use', recharge: 'other' },
            source: phbSub('College of Dance: Tandem Footwork', 3005),
          },
          {
            name: 'Leading Evasion',
            level: 14,
            effect: 'On a Dexterity save that halves damage, you take no damage on a success and half on a failure. You can share this with creatures within 5 feet making the same save. Not usable while Incapacitated.',
            source: phbSub('College of Dance: Leading Evasion', 3009),
          },
        ], source: 'PHB 2024 "Bard: Bard Subclass" (line ~2809)' },
      {
        id: 'glamour',
        name: 'College of Glamour',
        features: [
          {
            name: 'Beguiling Magic',
            level: 3,
            effect: 'Charm Person and Mirror Image are always prepared. Right after you cast an Enchantment or Illusion spell with a spell slot, a creature you can see within 60 feet must make a Wisdom save against your spell save DC or be Charmed or Frightened (your choice) for 1 minute, repeating the save at the end of each of its turns. Once per Long Rest, or restore it by expending a Bardic Inspiration use (no action).',
            grantedSpells: [{ level: 3, spells: spellIds('Charm Person', 'Mirror Image'), alwaysPrepared: true }],
            saveDc: { dcAbility: 'spellcasting', saveAbility: 'wis' },
            uses: { count: 1, recharge: 'long-rest' },
            source: phbSub('College of Glamour: Beguiling Magic', 3021),
          },
          {
            name: 'Mantle of Inspiration',
            level: 3,
            effect: 'As a Bonus Action, expend a Bardic Inspiration use and roll the die. Up to your Charisma modifier (minimum 1) other creatures within 60 feet each gain Temporary Hit Points equal to twice the roll and can use their Reaction to move up to their Speed without provoking Opportunity Attacks.',
            uses: { count: 'Bardic Inspiration use', recharge: 'other' },
            source: phbSub('College of Glamour: Mantle of Inspiration', 3029),
          },
          {
            name: 'Mantle of Majesty',
            level: 6,
            effect: 'Command is always prepared. As a Bonus Action, cast Command without a spell slot and take on an unearthly appearance for 1 minute (until your Concentration ends); while it lasts you can cast Command as a Bonus Action without a slot. Creatures Charmed by you automatically fail the save. Once per Long Rest, or restore it by expending a level 3+ spell slot (no action).',
            grantedSpells: [{ level: 6, spells: spellIds('Command'), alwaysPrepared: true }],
            uses: { count: 1, recharge: 'long-rest' },
            source: phbSub('College of Glamour: Mantle of Majesty', 3033),
          },
          {
            name: 'Unbreakable Majesty',
            level: 14,
            effect: 'As a Bonus Action, assume a majestic presence for 1 minute (ends if you are Incapacitated). The first time each turn a creature hits you with an attack roll, it must succeed on a Charisma save against your spell save DC or the attack misses. Once per Short or Long Rest.',
            saveDc: { dcAbility: 'spellcasting', saveAbility: 'cha' },
            uses: { count: 1, recharge: 'short-or-long-rest' },
            source: phbSub('College of Glamour: Unbreakable Majesty', 3047),
          },
        ], source: 'PHB 2024 "Bard: Bard Subclass" (line ~2809)' },
      {
        id: 'lore',
        name: 'College of Lore',
        features: [
          {
            name: 'Bonus Proficiencies',
            level: 3,
            effect: 'You gain proficiency in three skills of your choice.',
            grantedProficiencies: { skillChoices: 3 },
            source: phbSub('College of Lore: Bonus Proficiencies', 3057),
          },
          {
            name: 'Cutting Words',
            level: 3,
            effect: 'When a creature you can see within 60 feet deals damage or succeeds on an ability check or attack roll, use your Reaction and expend a Bardic Inspiration use; roll the die and subtract the result from that roll.',
            mechanics: { activation: 'reaction' },
            uses: { count: 'Bardic Inspiration use', recharge: 'other' },
            source: phbSub('College of Lore: Cutting Words', 3061),
          },
          {
            name: 'Magical Discoveries',
            level: 6,
            effect: 'Choose two spells from the Cleric, Druid or Wizard lists (each a cantrip or a level for which you have slots); they are always prepared, and you can swap one for another valid spell whenever you gain a Bard level.',
            grantedSpells: [{ level: 6, spells: [], alwaysPrepared: true }],
            source: phbSub('College of Lore: Magical Discoveries', 3065),
          },
          {
            name: 'Peerless Skill',
            level: 14,
            effect: 'When you fail an ability check or attack roll, you can expend a Bardic Inspiration use, roll the die and add it to the d20. If the roll still fails, the use is not expended.',
            uses: { count: 'Bardic Inspiration use', recharge: 'other' },
            source: phbSub('College of Lore: Peerless Skill', 3071),
          },
        ], source: 'PHB 2024 "Bard: Bard Subclass" (line ~2809)' },
      {
        id: 'valor',
        name: 'College of Valor',
        features: [
          {
            name: 'Combat Inspiration',
            level: 3,
            effect: 'A creature holding your Bardic Inspiration die can spend it either on Defense (as a Reaction when hit, add the roll to AC against that attack) or Offense (right after hitting, add the roll to the damage).',
            source: phbSub('College of Valor: Combat Inspiration', 3081),
          },
          {
            name: 'Martial Training',
            level: 3,
            effect: 'You gain Martial weapon proficiency and training with Medium armor and Shields, and can use a Simple or Martial weapon as a Spellcasting Focus for Bard spells.',
            grantedProficiencies: { weapons: ['Martial weapons'], armor: ['Medium armor', 'Shields'] },
            source: phbSub('College of Valor: Martial Training', 3089),
          },
          {
            name: 'Extra Attack',
            level: 6,
            effect: 'You attack twice when you take the Attack action, and can replace one of those attacks with a cantrip that has an action casting time.',
            source: phbSub('College of Valor: Extra Attack', 3095),
          },
          {
            name: 'Battle Magic',
            level: 14,
            effect: 'After casting a spell with an action casting time, you can make one weapon attack as a Bonus Action.',
            source: phbSub('College of Valor: Battle Magic', 3101),
          },
        ], source: 'PHB 2024 "Bard: Bard Subclass" (line ~2809)' },
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
    multiclassPrereq: { all: ['wis'] }, // PHB 2024 "Multiclassing: Prerequisites" + Cleric primary Wis (line ~3122).
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
      {
        id: 'life',
        name: 'Life Domain',
        features: [
          {
            name: 'Disciple of Life',
            level: 3,
            effect: 'When a spell you cast with a spell slot restores Hit Points to a creature, that creature regains an additional 2 + the slot level Hit Points that turn.',
            source: phbSub('Life Domain: Disciple of Life', 3415),
          },
          {
            name: 'Life Domain Spells',
            level: 3,
            effect: 'You always have these spells prepared once you reach the listed Cleric level: 3 Aid, Bless, Cure Wounds, Lesser Restoration; 5 Mass Healing Word, Revivify; 7 Aura of Life, Death Ward; 9 Greater Restoration, Mass Cure Wounds.',
            grantedSpells: [
              { level: 3, spells: spellIds('Aid', 'Bless', 'Cure Wounds', 'Lesser Restoration'), alwaysPrepared: true },
              { level: 5, spells: spellIds('Mass Healing Word', 'Revivify'), alwaysPrepared: true },
              { level: 7, spells: spellIds('Aura of Life', 'Death Ward'), alwaysPrepared: true },
              { level: 9, spells: spellIds('Greater Restoration', 'Mass Cure Wounds'), alwaysPrepared: true },
            ],
            source: phbSub('Life Domain: Life Domain Spells', 3419),
          },
          {
            name: 'Preserve Life',
            level: 3,
            effect: 'As a Magic action, expend a Channel Divinity use to distribute healing equal to five times your Cleric level among Bloodied creatures within 30 feet (you included). It cannot raise a creature above half its Hit Point maximum.',
            mechanics: { channelDivinity: 1 },
            uses: { count: 'Channel Divinity use', recharge: 'other' },
            source: phbSub('Life Domain: Preserve Life', 3432),
          },
          {
            // FLAG: the OCR interleaves the Light Domain heading into this feature; attributed to Life Domain per its text.
            name: 'Blessed Healer',
            level: 6,
            effect: 'Right after you cast a spell with a spell slot that restores Hit Points to one or more creatures other than you, you regain 2 + the slot level Hit Points.',
            source: phbSub('Life Domain: Blessed Healer', 3436),
          },
          {
            name: 'Supreme Healing',
            level: 17,
            effect: 'When a spell or Channel Divinity would have you roll dice to restore Hit Points, use the maximum value of each die instead of rolling.',
            source: phbSub('Life Domain: Supreme Healing', 3442),
          },
        ], source: 'PHB 2024 "Cleric: Cleric Subclass" (line ~3221)' },
      {
        id: 'light',
        name: 'Light Domain',
        features: [
          {
            name: 'Light Domain Spells',
            level: 3,
            effect: 'You always have these spells prepared once you reach the listed Cleric level: 3 Burning Hands, Faerie Fire, Scorching Ray, See Invisibility; 5 Daylight, Fireball; 7 Arcane Eye, Wall of Fire; 9 Flame Strike, Scrying.',
            grantedSpells: [
              { level: 3, spells: spellIds('Burning Hands', 'Faerie Fire', 'Scorching Ray', 'See Invisibility'), alwaysPrepared: true },
              { level: 5, spells: spellIds('Daylight', 'Fireball'), alwaysPrepared: true },
              { level: 7, spells: spellIds('Arcane Eye', 'Wall of Fire'), alwaysPrepared: true },
              { level: 9, spells: spellIds('Flame Strike', 'Scrying'), alwaysPrepared: true },
            ],
            source: phbSub('Light Domain: Light Domain Spells', 3454),
          },
          {
            name: 'Radiance of the Dawn',
            level: 3,
            effect: 'As a Magic action, expend a Channel Divinity use to emit light in a 30-foot Emanation that dispels magical Darkness there. Creatures of your choice in it make a Constitution save or take 2d10 + your Cleric level Radiant damage (half on a success).',
            mechanics: { channelDivinity: 1 },
            uses: { count: 'Channel Divinity use', recharge: 'other' },
            dice: [{ expr: '2d10 + ClericLevel', label: 'Radiant damage (half on a successful save)' }],
            saveDc: { dcAbility: 'spellcasting', saveAbility: 'con' },
            source: phbSub('Light Domain: Radiance of the Dawn', 3467),
          },
          {
            name: 'Warding Flare',
            level: 3,
            effect: 'When a creature you can see within 30 feet makes an attack roll, use your Reaction to impose Disadvantage on it. Uses equal your Wisdom modifier (minimum 1), regained on a Long Rest.',
            mechanics: { activation: 'reaction' },
            uses: { count: 'Wis mod (min 1)', recharge: 'long-rest' },
            source: phbSub('Light Domain: Warding Flare', 3471),
          },
          {
            name: 'Improved Warding Flare',
            level: 6,
            effect: 'Warding Flare uses are now regained on a Short or Long Rest, and when you use it you can give the target of the triggering attack Temporary Hit Points equal to 2d6 + your Wisdom modifier.',
            uses: { count: 'Wis mod (min 1)', recharge: 'short-or-long-rest' },
            dice: [{ expr: '2d6 + WisMod', label: 'Temporary Hit Points for the triggering attack target' }],
            source: phbSub('Light Domain: Improved Warding Flare', 3477),
          },
          {
            name: 'Corona of Light',
            level: 17,
            effect: 'As a Magic action, emit sunlight for 1 minute (or until dismissed): Bright Light in a 60-foot radius and Dim Light for 30 feet more. Enemies in the Bright Light have Disadvantage on saves against Radiance of the Dawn and spells that deal Fire or Radiant damage. Uses equal your Wisdom modifier (minimum 1), regained on a Long Rest.',
            uses: { count: 'Wis mod (min 1)', recharge: 'long-rest' },
            source: phbSub('Light Domain: Corona of Light', 3481),
          },
        ], source: 'PHB 2024 "Cleric: Cleric Subclass" (line ~3221)' },
      {
        id: 'trickery',
        name: 'Trickery Domain',
        features: [
          {
            name: 'Blessing of the Trickster',
            level: 3,
            effect: 'As a Magic action, give yourself or a willing creature within 30 feet Advantage on Dexterity (Stealth) checks until you finish a Long Rest or use this feature again.',
            source: phbSub('Trickery Domain: Blessing of the Trickster', 3495),
          },
          {
            name: 'Invoke Duplicity',
            level: 3,
            effect: 'As a Bonus Action, expend a Channel Divinity use to create an intangible illusory double within 30 feet for 1 minute (ends if dismissed or you are Incapacitated). You get Advantage on attacks against a creature that can see it when both you and the double are within 5 feet of it, can cast spells as if in its space, and can move it up to 30 feet (within 120 feet of you) as a Bonus Action.',
            mechanics: { channelDivinity: 1 },
            uses: { count: 'Channel Divinity use', recharge: 'other' },
            source: phbSub('Trickery Domain: Invoke Duplicity', 3499),
          },
          {
            name: 'Trickery Domain Spells',
            level: 3,
            effect: 'You always have these spells prepared once you reach the listed Cleric level: 3 Charm Person, Disguise Self, Invisibility, Pass without Trace; 5 Hypnotic Pattern, Nondetection; 7 Confusion, Dimension Door; 9 Dominate Person, Modify Memory.',
            grantedSpells: [
              { level: 3, spells: spellIds('Charm Person', 'Disguise Self', 'Invisibility', 'Pass without Trace'), alwaysPrepared: true },
              { level: 5, spells: spellIds('Hypnotic Pattern', 'Nondetection'), alwaysPrepared: true },
              { level: 7, spells: spellIds('Confusion', 'Dimension Door'), alwaysPrepared: true },
              { level: 9, spells: spellIds('Dominate Person', 'Modify Memory'), alwaysPrepared: true },
            ],
            source: phbSub('Trickery Domain: Trickery Domain Spells', 3513),
          },
          {
            name: "Trickster's Transposition",
            level: 6,
            effect: 'Whenever you use the Bonus Action to create or move your Invoke Duplicity illusion, you can teleport and swap places with it.',
            source: phbSub("Trickery Domain: Trickster's Transposition", 3524),
          },
          {
            name: 'Improved Duplicity',
            level: 17,
            effect: 'When the Invoke Duplicity illusion ends, you or a creature of your choice within 5 feet of it regains Hit Points equal to your Cleric level. You and your allies also have Advantage on attack rolls against a creature within 5 feet of the illusion.',
            source: phbSub('Trickery Domain: Improved Duplicity', 3526),
          },
        ], source: 'PHB 2024 "Cleric: Cleric Subclass" (line ~3221)' },
      {
        id: 'war',
        name: 'War Domain',
        features: [
          {
            name: 'Guided Strike',
            level: 3,
            effect: 'When you or a creature within 30 feet misses with an attack roll, expend a Channel Divinity use to give that roll a +10 bonus. Using it for another creature costs your Reaction.',
            mechanics: { channelDivinity: 1 },
            uses: { count: 'Channel Divinity use', recharge: 'other' },
            source: phbSub('War Domain: Guided Strike', 3540),
          },
          {
            name: 'War Domain Spells',
            level: 3,
            effect: "You always have these spells prepared once you reach the listed Cleric level: 3 Guiding Bolt, Magic Weapon, Shield of Faith, Spiritual Weapon; 5 Crusader's Mantle, Spirit Guardians; 7 Fire Shield, Freedom of Movement; 9 Hold Monster, Steel Wind Strike.",
            grantedSpells: [
              { level: 3, spells: spellIds('Guiding Bolt', 'Magic Weapon', 'Shield of Faith', 'Spiritual Weapon'), alwaysPrepared: true },
              { level: 5, spells: spellIds("Crusader's Mantle", 'Spirit Guardians'), alwaysPrepared: true },
              { level: 7, spells: spellIds('Fire Shield', 'Freedom of Movement'), alwaysPrepared: true },
              { level: 9, spells: spellIds('Hold Monster', 'Steel Wind Strike'), alwaysPrepared: true },
            ],
            source: phbSub('War Domain: War Domain Spells', 3544),
          },
          {
            name: 'War Priest',
            level: 3,
            effect: 'As a Bonus Action, make one attack with a weapon or an Unarmed Strike. Uses equal your Wisdom modifier (minimum 1), regained on a Short or Long Rest.',
            uses: { count: 'Wis mod (min 1)', recharge: 'short-or-long-rest' },
            source: phbSub('War Domain: War Priest', 3557),
          },
          {
            name: "War God's Blessing",
            level: 6,
            effect: 'Expend a Channel Divinity use instead of a spell slot to cast Shield of Faith or Spiritual Weapon. Cast this way it needs no Concentration and lasts 1 minute, ending early if you recast it, are Incapacitated, or die.',
            mechanics: { channelDivinity: 1 },
            uses: { count: 'Channel Divinity use', recharge: 'other' },
            source: phbSub("War Domain: War God's Blessing", 3561),
          },
          {
            name: 'Avatar of Battle',
            level: 17,
            effect: 'You have Resistance to Bludgeoning, Piercing and Slashing damage.',
            source: phbSub('War Domain: Avatar of Battle', 3565),
          },
        ], source: 'PHB 2024 "Cleric: Cleric Subclass" (line ~3221)' },
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
    multiclassPrereq: { all: ['wis'] }, // PHB 2024 "Multiclassing: Prerequisites" + Druid primary Wis (line ~3587).
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
      {
        id: 'land',
        name: 'Circle of the Land',
        features: [
          {
            // FLAG: the Arid table is OCR-scrambled in the PHB text; read as 3: Blur, Burning Hands, Fire Bolt; 5: Fireball; 7: Blight; 9: Wall of Stone.
            name: 'Circle of the Land Spells',
            level: 3,
            effect: 'After each Long Rest, choose a land type (arid, polar, temperate or tropical); you have prepared the spells listed for your Druid level and lower in that land type\u2019s table.',
            choices: [{ key: 'land-type', count: 1, options: ['Arid', 'Polar', 'Temperate', 'Tropical'] }],
            choiceSpells: {
              Arid: [
                { level: 3, spells: spellIds('Blur', 'Burning Hands', 'Fire Bolt') },
                { level: 5, spells: spellIds('Fireball') },
                { level: 7, spells: spellIds('Blight') },
                { level: 9, spells: spellIds('Wall of Stone') },
              ],
              Polar: [
                { level: 3, spells: spellIds('Fog Cloud', 'Hold Person', 'Ray of Frost') },
                { level: 5, spells: spellIds('Sleet Storm') },
                { level: 7, spells: spellIds('Ice Storm') },
                { level: 9, spells: spellIds('Cone of Cold') },
              ],
              Temperate: [
                { level: 3, spells: spellIds('Misty Step', 'Shocking Grasp', 'Sleep') },
                { level: 5, spells: spellIds('Lightning Bolt') },
                { level: 7, spells: spellIds('Freedom of Movement') },
                { level: 9, spells: spellIds('Tree Stride') },
              ],
              Tropical: [
                { level: 3, spells: spellIds('Acid Splash', 'Ray of Sickness', 'Web') },
                { level: 5, spells: spellIds('Stinking Cloud') },
                { level: 7, spells: spellIds('Polymorph') },
                { level: 9, spells: spellIds('Insect Plague') },
              ],
            },
            source: phbSub('Circle of the Land: Circle of the Land Spells', 3860),
          },
          {
            name: "Land's Aid",
            level: 3,
            effect: 'As a Magic action, expend a Wild Shape use and pick a point within 60 feet. Creatures of your choice in a 10-foot-radius Sphere make a Constitution save against your spell save DC, taking 2d6 Necrotic damage (half on a success), and one creature of your choice there regains 2d6 Hit Points. Damage and healing rise to 3d6 at Druid level 10 and 4d6 at level 14.',
            uses: { count: 'Wild Shape use', recharge: 'other' },
            dice: [{ expr: '2d6 (3d6 at L10, 4d6 at L14)', label: 'Necrotic damage; one creature regains the same dice in HP' }],
            saveDc: { dcAbility: 'spellcasting', saveAbility: 'con' },
            source: phbSub("Circle of the Land: Land's Aid", 3896),
          },
          {
            name: 'Natural Recovery',
            level: 6,
            effect: 'Cast one level 1+ spell you have prepared from Circle Spells without a spell slot, once per Long Rest. Also, after a Short Rest, recover expended spell slots with combined level up to half your Druid level (round up), none level 6 or higher, once per Long Rest.',
            uses: { count: 1, recharge: 'long-rest' },
            source: phbSub('Circle of the Land: Natural Recovery', 3902),
          },
          {
            name: "Nature's Ward",
            level: 10,
            effect: 'You are immune to the Poisoned condition and have Resistance to a damage type set by your current land choice: Arid Fire, Polar Cold, Temperate Lightning, Tropical Poison.',
            source: phbSub("Circle of the Land: Nature's Ward", 3908),
          },
          {
            name: "Nature's Sanctuary",
            level: 14,
            effect: 'As a Magic action, expend a Wild Shape use to raise a 15-foot Cube of spectral trees and vines within 120 feet for 1 minute (ends if you are Incapacitated or die). You and allies there have Half Cover and your allies gain your Nature\u2019s Ward Resistance. As a Bonus Action you can move the Cube up to 60 feet.',
            uses: { count: 'Wild Shape use', recharge: 'other' },
            source: phbSub("Circle of the Land: Nature's Sanctuary", 3923),
          },
        ], source: 'PHB 2024 "Druid: Druid Subclass" (line ~3713)' },
      {
        id: 'moon',
        name: 'Circle of the Moon',
        features: [
          {
            name: 'Circle Forms',
            level: 3,
            effect: 'In a Wild Shape form: the maximum Challenge Rating is your Druid level divided by 3 (round down); your AC is 13 + Wis mod if that beats the Beast\u2019s AC; and you gain Temporary Hit Points equal to three times your Druid level.',
            source: phbSub('Circle of the Moon: Circle Forms', 3937),
          },
          {
            name: 'Circle of the Moon Spells',
            level: 3,
            effect: 'You always have these spells prepared once you reach the listed Druid level: 3 Cure Wounds, Moonbeam, Starry Wisp; 5 Conjure Animals; 7 Fount of Moonlight; 9 Mass Cure Wounds. You can cast them while in a Wild Shape form.',
            grantedSpells: [
              { level: 3, spells: spellIds('Cure Wounds', 'Moonbeam', 'Starry Wisp'), alwaysPrepared: true },
              { level: 5, spells: spellIds('Conjure Animals'), alwaysPrepared: true },
              { level: 7, spells: spellIds('Fount of Moonlight'), alwaysPrepared: true },
              { level: 9, spells: spellIds('Mass Cure Wounds'), alwaysPrepared: true },
            ],
            source: phbSub('Circle of the Moon: Circle of the Moon Spells', 3947),
          },
          {
            name: 'Improved Circle Forms',
            level: 6,
            effect: 'In a Wild Shape form you add your Wisdom modifier to Constitution saving throws, and each of your attacks can deal its normal damage type or Radiant damage (chosen per hit).',
            source: phbSub('Circle of the Moon: Improved Circle Forms', 3962),
          },
          {
            name: 'Moonlight Step',
            level: 10,
            effect: 'As a Bonus Action, teleport up to 30 feet to an unoccupied space you can see and gain Advantage on your next attack roll this turn. Uses equal your Wisdom modifier (minimum 1), regained on a Long Rest, or expend a level 2+ spell slot per use to restore it (no action).',
            uses: { count: 'Wis mod (min 1)', recharge: 'long-rest' },
            source: phbSub('Circle of the Moon: Moonlight Step', 3968),
          },
          {
            name: 'Lunar Form',
            level: 14,
            effect: 'When you use Moonlight Step you can also teleport one willing creature within 10 feet to a space within 10 feet of your destination. Once per turn, a Wild Shape attack that hits deals an extra 2d10 Radiant damage.',
            dice: [{ expr: '2d10', label: 'Extra Radiant damage, once per turn, Wild Shape attack' }],
            source: phbSub('Circle of the Moon: Lunar Form', 3974),
          },
        ], source: 'PHB 2024 "Druid: Druid Subclass" (line ~3713)' },
      {
        id: 'sea',
        name: 'Circle of the Sea',
        features: [
          {
            name: 'Circle of the Sea Spells',
            level: 3,
            effect: 'You always have these spells prepared once you reach the listed Druid level: 3 Fog Cloud, Gust of Wind, Ray of Frost, Shatter, Thunderwave; 5 Lightning Bolt, Water Breathing; 7 Control Water, Ice Storm; 9 Conjure Elemental, Hold Monster.',
            grantedSpells: [
              { level: 3, spells: spellIds('Fog Cloud', 'Gust of Wind', 'Ray of Frost', 'Shatter', 'Thunderwave'), alwaysPrepared: true },
              { level: 5, spells: spellIds('Lightning Bolt', 'Water Breathing'), alwaysPrepared: true },
              { level: 7, spells: spellIds('Control Water', 'Ice Storm'), alwaysPrepared: true },
              { level: 9, spells: spellIds('Conjure Elemental', 'Hold Monster'), alwaysPrepared: true },
            ],
            source: phbSub('Circle of the Sea: Circle of the Sea Spells', 3988),
          },
          {
            // FLAG: the die size is OCR-damaged in the PHB text ("dÃ¡s"); only the count (Wisdom modifier, minimum 1) is recorded.
            name: 'Wrath of the Sea',
            level: 3,
            effect: 'As a Bonus Action, expend a Wild Shape use to manifest a 5-foot Emanation of ocean spray for 10 minutes. When you manifest it and as a Bonus Action on later turns, a creature you can see in it must succeed on a Constitution save against your spell save DC or take Cold damage (dice equal to your Wisdom modifier, minimum 1) and, if Large or smaller, be pushed up to 15 feet.',
            uses: { count: 'Wild Shape use', recharge: 'other' },
            saveDc: { dcAbility: 'spellcasting', saveAbility: 'con' },
            source: phbSub('Circle of the Sea: Wrath of the Sea', 3999),
          },
          {
            name: 'Aquatic Affinity',
            level: 6,
            effect: 'The Wrath of the Sea Emanation grows to 10 feet, and you gain a Swim Speed equal to your Speed.',
            source: phbSub('Circle of the Sea: Aquatic Affinity', 4005),
          },
          {
            name: 'Stormborn',
            level: 10,
            effect: 'While Wrath of the Sea is active you have a Fly Speed equal to your Speed and Resistance to Cold, Lightning and Thunder damage.',
            source: phbSub('Circle of the Sea: Stormborn', 4011),
          },
          {
            name: 'Oceanic Gift',
            level: 14,
            effect: 'You can manifest the Wrath of the Sea Emanation around a willing creature within 60 feet instead of yourself (it uses your spell save DC and Wisdom modifier), or around both of you by expending two Wild Shape uses instead of one.',
            source: phbSub('Circle of the Sea: Oceanic Gift', 4019),
          },
        ], source: 'PHB 2024 "Druid: Druid Subclass" (line ~3713)' },
      {
        id: 'stars',
        name: 'Circle of the Stars',
        features: [
          {
            // FLAG: Guidance and Guiding Bolt are prepared only while holding the star map; the boolean cannot express that condition.
            name: 'Star Map',
            level: 3,
            effect: 'Your Tiny star chart works as a Druid Spellcasting Focus. While holding it you have Guidance and Guiding Bolt prepared and can cast Guiding Bolt without a spell slot a number of times equal to your Wisdom modifier (minimum 1) per Long Rest. A lost map can be replaced with a 1-hour ceremony.',
            grantedSpells: [{ level: 3, spells: spellIds('Guidance', 'Guiding Bolt'), alwaysPrepared: true }],
            uses: { count: 'Wis mod (min 1)', recharge: 'long-rest' },
            source: phbSub('Circle of the Stars: Star Map', 4031),
          },
          {
            name: 'Starry Form',
            level: 3,
            effect: 'As a Bonus Action, expend a Wild Shape use to become luminous for 10 minutes instead of shape-shifting, choosing a constellation: Archer (ranged spell attack within 60 feet for 1d8 + Wis mod Radiant, as a Bonus Action each turn), Chalice (when a spell-slot spell restores HP, you or a creature within 30 feet regains 1d8 + Wis mod), or Dragon (treat a d20 roll of 9 or lower as 10 on Intelligence/Wisdom checks and Concentration saves).',
            uses: { count: 'Wild Shape use', recharge: 'other' },
            dice: [
              { expr: '1d8 + WisMod (2d8 at L10)', label: 'Archer: Radiant ranged spell attack damage' },
              { expr: '1d8 + WisMod (2d8 at L10)', label: 'Chalice: Hit Points regained' },
            ],
            choices: [{ key: 'constellation', count: 1, options: ['Archer', 'Chalice', 'Dragon'] }],
            source: phbSub('Circle of the Stars: Starry Form', 4050),
          },
          {
            name: 'Cosmic Omen',
            level: 6,
            effect: 'After a Long Rest, roll a die: even gives Weal, odd gives Woe, until your next Long Rest. As a Reaction when a creature you can see within 30 feet is about to make a D20 Test, roll 1d6 and add it (Weal) or subtract it (Woe). Uses equal your Wisdom modifier (minimum 1), regained on a Long Rest.',
            mechanics: { activation: 'reaction' },
            uses: { count: 'Wis mod (min 1)', recharge: 'long-rest' },
            dice: [{ expr: '1d6', label: 'Added to (Weal) or subtracted from (Woe) a D20 Test' }],
            choices: [{ key: 'omen', count: 1, options: ['Weal (Even)', 'Woe (Odd)'] }],
            source: phbSub('Circle of the Stars: Cosmic Omen', 4064),
          },
          {
            name: 'Twinkling Constellations',
            level: 10,
            effect: 'The Archer and Chalice 1d8 becomes 2d8, and the Dragon form also gives a Fly Speed of 20 feet with hovering. At the start of each of your turns in Starry Form you can switch constellation.',
            source: phbSub('Circle of the Stars: Twinkling Constellations', 4074),
          },
          {
            name: 'Full of Stars',
            level: 14,
            effect: 'While in Starry Form you have Resistance to Bludgeoning, Piercing and Slashing damage.',
            source: phbSub('Circle of the Stars: Full of Stars', 4078),
          },
        ], source: 'PHB 2024 "Druid: Druid Subclass" (line ~3713)' },
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
    multiclassPrereq: { any: ['str', 'dex'] }, // PHB 2024 "Multiclassing: Prerequisites" + Fighter primary Str OR Dex (line ~4089).
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
      { id: 'battleMaster', name: 'Battle Master', features: BATTLE_MASTER_FEATURES, source: 'PHB 2024 "Fighter: Fighter Subclass" (line ~4184)' },
      { id: 'champion', name: 'Champion', features: CHAMPION_FEATURES, source: 'PHB 2024 "Fighter: Fighter Subclass" (line ~4184)' },
      { id: 'eldritchKnight', name: 'Eldritch Knight', features: ELDRITCH_KNIGHT_FEATURES, source: 'PHB 2024 "Fighter: Fighter Subclass" (line ~4184)' },
      { id: 'psiWarrior', name: 'Psi Warrior', features: PSI_WARRIOR_FEATURES, source: 'PHB 2024 "Fighter: Fighter Subclass" (line ~4184)' },
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
    multiclassPrereq: { all: ['dex', 'wis'] }, // PHB 2024 "Multiclassing: Prerequisites" + Monk primary Dex AND Wis (line ~4481).
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
        mechanics: { activation: 'reaction' },
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
        mechanics: { activation: 'reaction' },
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
      { id: 'elements', name: 'Warrior of the Elements', features: ELEMENTS_FEATURES, source: 'PHB 2024 "Monk Subclasses" (Chapter 3)' },
      { id: 'mercy', name: 'Warrior of Mercy', features: MERCY_FEATURES, source: 'PHB 2024 "Monk Subclasses" (Chapter 3)' },
      { id: 'openHand', name: 'Warrior of the Open Hand', features: OPEN_HAND_FEATURES, source: 'PHB 2024 "Monk Subclasses" (Chapter 3)' },
      { id: 'shadow', name: 'Warrior of Shadow', features: SHADOW_FEATURES, source: 'PHB 2024 "Monk Subclasses" (Chapter 3)' },
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
    multiclassPrereq: { all: ['str', 'cha'] }, // PHB 2024 "Multiclassing: Prerequisites" + Paladin primary Str AND Cha (line ~4820).
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
      { id: 'devotion', name: 'Oath of Devotion', features: DEVOTION_FEATURES, source: 'PHB 2024 "Paladin Subclasses" (Chapter 3)' },
      { id: 'glory', name: 'Oath of Glory', features: GLORY_FEATURES, source: 'PHB 2024 "Paladin Subclasses" (Chapter 3)' },
      { id: 'ancients', name: 'Oath of the Ancients', features: ANCIENTS_FEATURES, source: 'PHB 2024 "Paladin Subclasses" (Chapter 3)' },
      { id: 'vengeance', name: 'Oath of Vengeance', features: VENGEANCE_FEATURES, source: 'PHB 2024 "Paladin Subclasses" (Chapter 3)' },
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
    multiclassPrereq: { all: ['dex', 'wis'] }, // PHB 2024 "Multiclassing: Prerequisites" + Ranger primary Dex AND Wis (line ~5319).
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
      { id: 'beastMaster', name: 'Beast Master', features: BEAST_MASTER_FEATURES, source: 'PHB 2024 "Ranger: Ranger Subclass" (line ~5427)' },
      { id: 'feyWanderer', name: 'Fey Wanderer', features: FEY_WANDERER_FEATURES, source: 'PHB 2024 "Ranger: Ranger Subclass" (line ~5427)' },
      { id: 'gloomStalker', name: 'Gloom Stalker', features: GLOOM_STALKER_FEATURES, source: 'PHB 2024 "Ranger: Ranger Subclass" (line ~5427)' },
      { id: 'hunter', name: 'Hunter', features: HUNTER_FEATURES, source: 'PHB 2024 "Ranger: Ranger Subclass" (line ~5427)' },
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
    multiclassPrereq: { all: ['dex'] }, // PHB 2024 "Multiclassing: Prerequisites" + Rogue primary Dex (line ~5874).
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
        mechanics: { activation: 'reaction' },
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
      { id: 'arcaneTrickster', name: 'Arcane Trickster', features: ARCANE_TRICKSTER_FEATURES, source: 'PHB 2024 "Rogue: Rogue Subclass" (line ~5937)' },
      { id: 'assassin', name: 'Assassin', features: ASSASSIN_FEATURES, source: 'PHB 2024 "Rogue: Rogue Subclass" (line ~5937)' },
      { id: 'soulknife', name: 'Soulknife', features: SOULKNIFE_FEATURES, source: 'PHB 2024 "Rogue: Rogue Subclass" (line ~5937)' },
      { id: 'thief', name: 'Thief', features: THIEF_FEATURES, source: 'PHB 2024 "Rogue: Rogue Subclass" (line ~5937)' },
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
    multiclassPrereq: { all: ['cha'] }, // PHB 2024 "Multiclassing: Prerequisites" + Sorcerer primary Cha (line ~6232).
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
      { id: 'aberrant', name: 'Aberrant Sorcery', features: ABERRANT_FEATURES, source: 'PHB 2024 "Sorcerer: Sorcerer Subclass" (line ~6352)' },
      { id: 'clockwork', name: 'Clockwork Sorcery', features: CLOCKWORK_FEATURES, source: 'PHB 2024 "Sorcerer: Sorcerer Subclass" (line ~6352)' },
      { id: 'draconic', name: 'Draconic Sorcery', features: DRACONIC_FEATURES, source: 'PHB 2024 "Sorcerer: Sorcerer Subclass" (line ~6352)' },
      { id: 'wildMagic', name: 'Wild Magic Sorcery', features: WILD_MAGIC_FEATURES, source: 'PHB 2024 "Sorcerer: Sorcerer Subclass" (line ~6352)' },
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
    multiclassPrereq: { all: ['cha'] }, // PHB 2024 "Multiclassing: Prerequisites" + Warlock primary Cha (line ~6775).
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
      { id: 'archfey', name: 'Archfey Patron', features: ARCHFEY_FEATURES, source: 'PHB 2024 "Warlock: Warlock Subclass" (line ~6877)' },
      { id: 'celestial', name: 'Celestial Patron', features: CELESTIAL_FEATURES, source: 'PHB 2024 "Warlock: Warlock Subclass" (line ~6877)' },
      { id: 'fiend', name: 'Fiend Patron', features: FIEND_FEATURES, source: 'PHB 2024 "Warlock: Warlock Subclass" (line ~6877)' },
      { id: 'greatOldOne', name: 'Great Old One Patron', features: GREAT_OLD_ONE_FEATURES, source: 'PHB 2024 "Warlock: Warlock Subclass" (line ~6877)' },
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
    multiclassPrereq: { all: ['int'] }, // PHB 2024 "Multiclassing: Prerequisites" + Wizard primary Int (line ~7320).
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
      { id: 'abjurer', name: 'Abjurer', features: ABJURER_FEATURES, source: 'PHB 2024 "Wizard: Wizard Subclass" (line ~7366)' },
      { id: 'diviner', name: 'Diviner', features: DIVINER_FEATURES, source: 'PHB 2024 "Wizard: Wizard Subclass" (line ~7366)' },
      { id: 'evoker', name: 'Evoker', features: EVOKER_FEATURES, source: 'PHB 2024 "Wizard: Wizard Subclass" (line ~7366)' },
      { id: 'illusionist', name: 'Illusionist', features: ILLUSIONIST_FEATURES, source: 'PHB 2024 "Wizard: Wizard Subclass" (line ~7366)' },
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
