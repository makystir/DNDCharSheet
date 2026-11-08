/**
 * D&D 5.5e (2024) species catalog.
 *
 * A flat, typed data module (mirroring the SKILLS table in
 * src/types/character.ts and the WFRP app's src/data/species.ts convention):
 * one exported record keyed by species id, plus the id/enum unions derived
 * from the data so the Character type and the catalog cannot drift.
 *
 * SOURCING / RULES COMPLIANCE
 * ---------------------------
 * Every mechanical value (size, speed, darkvision range, resistances, dice,
 * trait names, sub-choice options) is transcribed from Docs/PlayersHandbook.md
 * "SPECIES DESCRIPTIONS" (the ten 2024 PHB species, read during Stage 3). Each
 * entry/trait carries a `source` citation and a matching `// PHB 2024 "…"`
 * comment. NO long verbatim PHB prose is reproduced: every `effect` string is a
 * short paraphrase of the printed rule; only numeric/mechanical values are
 * transcribed verbatim (rules-compliance rule 5).
 *
 * 2024 RULE — NO SPECIES ABILITY SCORE INCREASES
 * -----------------------------------------------
 * In the 2024 ruleset a species grants Creature Type, Size, Speed, and Special
 * Traits ONLY — ability score increases come from the Background, not the
 * species (PHB 2024 "Parts of a Species"; older-books rule: ignore species ASIs
 * and use the background's). This catalog therefore has NO ability-score field
 * and no species applies an ASI. Confirmed against every species block in
 * Docs/PlayersHandbook.md "SPECIES DESCRIPTIONS".
 */

import type { Ability, SkillId } from '../types/character';
import type { ReactionTag } from './classes';

/** A creature's size category. Only Small/Medium appear among PHB species. */
export type CreatureSize = 'small' | 'medium';

/**
 * A species special trait. Descriptions are paraphrased; mechanical values are
 * transcribed. Traits that are action-triggered or higher-level (e.g. Breath
 * Weapon, Celestial Revelation) are surfaced descriptively — their active
 * effects belong to later stages.
 */
export interface SpeciesTrait {
  /** Trait name as printed, e.g. 'Darkvision', 'Dwarven Toughness'. */
  name: string;
  /** Paraphrased effect — NEVER verbatim PHB prose (rules-compliance rule 5). */
  effect: string;
  /** Machine-usable mechanical values where the trait is numeric/mechanical. */
  mechanics?: {
    /** Darkvision range in feet granted by this trait. */
    darkvisionFt?: number;
    /** A walking-speed value this trait sets, in feet (e.g. Wood Elf 35). */
    speedOverrideFt?: number;
    /** Damage types this trait grants Resistance to. */
    resistances?: string[];
    /** HP-max increase per character level (Dwarven Toughness = 1). */
    hpPerLevel?: number;
  };
  /** Line-anchored PHB citation this trait is transcribed from. */
  source: string;
  /** True when this trait requires a player sub-choice (lineage/ancestry/…). */
  requiresChoice?: boolean;
}

/** A single selectable option for a species sub-choice. */
export interface SpeciesChoiceOption {
  id: string;
  label: string;
  note?: string;
  /** Set when choosing this option grants a Reaction (Overview Reactions card); explicit, never derived from `note`. */
  reaction?: ReactionTag;
}

/**
 * Declarative description of a required sub-choice, consumed by the selection
 * UI so a new species needs only a new data entry, no component changes.
 * `field` names the SpeciesSelection field the chosen value is written to.
 */
export interface SpeciesChoiceSpec {
  kind:
    | 'size'
    | 'draconicAncestry'
    | 'elvenLineage'
    | 'gnomishLineage'
    | 'giantAncestry'
    | 'fiendishLegacy'
    | 'spellcastingAbility'
    | 'keenSensesSkill'
    | 'skillfulSkill';
  /** The SpeciesSelection field this choice writes to. */
  field:
    | 'size'
    | 'draconicAncestry'
    | 'elvenLineage'
    | 'gnomishLineage'
    | 'giantAncestry'
    | 'fiendishLegacy'
    | 'spellcastingAbility'
    | 'keenSensesSkill'
    | 'skillfulSkill';
  label: string;
  options: SpeciesChoiceOption[];
}

/** A species' full mechanical profile. */
export interface SpeciesData {
  id: string;
  name: string;
  /** Every PHB species is Humanoid (PHB 2024 "Parts of a Species"). */
  creatureType: 'Humanoid';
  /** Fixed size, or 'choice' when the player picks Small/Medium. */
  size: CreatureSize | 'choice';
  /** Base walking speed in feet (before lineage/trait overrides). */
  baseSpeedFt: number;
  /** Base darkvision range in feet; 0 = none (before lineage overrides). */
  darkvisionFt: number;
  /**
   * Languages granted BY THE SPECIES BLOCK. In 2024 this is ALWAYS empty:
   * languages come from the "Choose Languages" creation step, not the species
   * (PHB 2024 "Choose Languages"). Kept for forward-compat; [] for all ten.
   */
  grantedLanguages: string[];
  traits: SpeciesTrait[];
  /** Sub-choices this species requires (drives the selection UI). */
  choices?: SpeciesChoiceSpec[];
  /** Line-anchored PHB citation this entry is transcribed from. */
  source: string;
}

// --- Shared sub-choice option sets (transcribed mechanical values) ---

/**
 * Int/Wis/Cha spellcasting-ability choice shared by Elf lineage, Gnome lineage,
 * and Tiefling legacy traits (PHB 2024: those trait blocks).
 */
const SPELLCASTING_ABILITY_OPTIONS: SpeciesChoiceOption[] = [
  { id: 'int', label: 'Intelligence' },
  { id: 'wis', label: 'Wisdom' },
  { id: 'cha', label: 'Charisma' },
] satisfies { id: Ability | string; label: string }[];

/** Small/Medium size choice (Aasimar/Human/Tiefling). */
const SIZE_CHOICE_OPTIONS: SpeciesChoiceOption[] = [
  { id: 'medium', label: 'Medium' },
  { id: 'small', label: 'Small' },
];

/**
 * The ten PHB (2024) species, keyed alphabetically. Values transcribed from
 * Docs/PlayersHandbook.md "SPECIES DESCRIPTIONS".
 */
export const SPECIES_CATALOG = {
  // PHB 2024 "Aasimar Traits" (Docs/PlayersHandbook.md "AASIMAR TRAITS").
  aasimar: {
    id: 'aasimar',
    name: 'Aasimar',
    creatureType: 'Humanoid',
    size: 'choice', // Medium or Small, chosen at selection.
    baseSpeedFt: 30,
    darkvisionFt: 60,
    grantedLanguages: [],
    source: 'PHB 2024 "Aasimar Traits"',
    traits: [
      {
        name: 'Celestial Resistance',
        effect: 'Resistance to Necrotic and Radiant damage.',
        mechanics: { resistances: ['Necrotic', 'Radiant'] },
        source: 'PHB 2024 "Aasimar Traits: Celestial Resistance"',
      },
      {
        name: 'Darkvision',
        effect: 'See in the dark out to 60 feet.',
        mechanics: { darkvisionFt: 60 },
        source: 'PHB 2024 "Aasimar Traits: Darkvision"',
      },
      {
        name: 'Healing Hands',
        effect:
          'Magic action to heal a touched creature, rolling d4s equal to your Proficiency Bonus; recharges on a Long Rest.',
        source: 'PHB 2024 "Aasimar Traits: Healing Hands"',
      },
      {
        name: 'Light Bearer',
        effect: 'You know the Light cantrip (Charisma is its spellcasting ability).',
        source: 'PHB 2024 "Aasimar Traits: Light Bearer"',
      },
      {
        name: 'Celestial Revelation',
        effect:
          'At character level 3 you can transform as a Bonus Action (Heavenly Wings, Inner Radiance, or Necrotic Shroud), adding bonus damage once per turn.',
        source: 'PHB 2024 "Aasimar Traits: Celestial Revelation"',
      },
    ],
    choices: [
      {
        kind: 'size',
        field: 'size',
        label: 'Size',
        options: SIZE_CHOICE_OPTIONS,
      },
    ],
  },

  // PHB 2024 "Dragonborn Traits" (Docs/PlayersHandbook.md "DRAGONBORN TRAITS").
  dragonborn: {
    id: 'dragonborn',
    name: 'Dragonborn',
    creatureType: 'Humanoid',
    size: 'medium',
    baseSpeedFt: 30,
    darkvisionFt: 60,
    grantedLanguages: [],
    source: 'PHB 2024 "Dragonborn Traits"',
    traits: [
      {
        name: 'Draconic Ancestry',
        effect:
          'Choose a dragon kind; it sets the damage type of your Breath Weapon and Damage Resistance.',
        source: 'PHB 2024 "Dragonborn Traits: Draconic Ancestry"',
        requiresChoice: true,
      },
      {
        name: 'Breath Weapon',
        effect:
          'Replace one attack with a 15-ft Cone or 30-ft Line; targets make a Dex save (DC 8 + Con mod + PB) for 1d10 of your ancestry damage type (scales at levels 5/11/17).',
        source: 'PHB 2024 "Dragonborn Traits: Breath Weapon"',
      },
      {
        name: 'Damage Resistance',
        effect: 'Resistance to the damage type set by your Draconic Ancestry.',
        source: 'PHB 2024 "Dragonborn Traits: Damage Resistance"',
      },
      {
        name: 'Darkvision',
        effect: 'See in the dark out to 60 feet.',
        mechanics: { darkvisionFt: 60 },
        source: 'PHB 2024 "Dragonborn Traits: Darkvision"',
      },
      {
        name: 'Draconic Flight',
        effect:
          'At character level 5 you can sprout spectral wings as a Bonus Action for a Fly Speed equal to your Speed.',
        source: 'PHB 2024 "Dragonborn Traits: Draconic Flight"',
      },
    ],
    choices: [
      {
        kind: 'draconicAncestry',
        field: 'draconicAncestry',
        label: 'Draconic Ancestry',
        // PHB 2024 "Draconic Ancestors" table (damage type per dragon kind).
        options: [
          { id: 'black', label: 'Black', note: 'Acid' },
          { id: 'blue', label: 'Blue', note: 'Lightning' },
          { id: 'brass', label: 'Brass', note: 'Fire' },
          { id: 'bronze', label: 'Bronze', note: 'Lightning' },
          { id: 'copper', label: 'Copper', note: 'Acid' },
          { id: 'gold', label: 'Gold', note: 'Fire' },
          { id: 'green', label: 'Green', note: 'Poison' },
          { id: 'red', label: 'Red', note: 'Fire' },
          { id: 'silver', label: 'Silver', note: 'Cold' },
          { id: 'white', label: 'White', note: 'Cold' },
        ],
      },
    ],
  },

  // PHB 2024 "Dwarf Traits" (Docs/PlayersHandbook.md "DWARF TRAITS").
  dwarf: {
    id: 'dwarf',
    name: 'Dwarf',
    creatureType: 'Humanoid',
    size: 'medium',
    baseSpeedFt: 30,
    darkvisionFt: 120,
    grantedLanguages: [],
    source: 'PHB 2024 "Dwarf Traits"',
    traits: [
      {
        name: 'Darkvision',
        effect: 'See in the dark out to 120 feet.',
        mechanics: { darkvisionFt: 120 },
        source: 'PHB 2024 "Dwarf Traits: Darkvision"',
      },
      {
        name: 'Dwarven Resilience',
        effect:
          'Resistance to Poison damage, and Advantage on saves to avoid or end the Poisoned condition.',
        mechanics: { resistances: ['Poison'] },
        source: 'PHB 2024 "Dwarf Traits: Dwarven Resilience"',
      },
      {
        name: 'Dwarven Toughness',
        effect: 'Your Hit Point maximum increases by 1, and by 1 again each level (+1 per level).',
        mechanics: { hpPerLevel: 1 },
        source: 'PHB 2024 "Dwarf Traits: Dwarven Toughness"',
      },
      {
        name: 'Stonecunning',
        effect:
          'Bonus Action to gain Tremorsense 60 ft for 10 minutes while on/touching stone; uses equal to your Proficiency Bonus, recharging on a Long Rest.',
        source: 'PHB 2024 "Dwarf Traits: Stonecunning"',
      },
    ],
  },

  // PHB 2024 "Elf Traits" (Docs/PlayersHandbook.md "ELF TRAITS").
  elf: {
    id: 'elf',
    name: 'Elf',
    creatureType: 'Humanoid',
    size: 'medium',
    baseSpeedFt: 30,
    darkvisionFt: 60,
    grantedLanguages: [],
    source: 'PHB 2024 "Elf Traits"',
    traits: [
      {
        name: 'Darkvision',
        effect: 'See in the dark out to 60 feet (120 feet for the Drow lineage).',
        mechanics: { darkvisionFt: 60 },
        source: 'PHB 2024 "Elf Traits: Darkvision"',
      },
      {
        name: 'Elven Lineage',
        effect:
          'Choose Drow, High Elf, or Wood Elf for a level-1 benefit plus spells at levels 3 and 5 (Int/Wis/Cha spellcasting ability).',
        source: 'PHB 2024 "Elf Traits: Elven Lineage" / "Elven Lineages" table',
        requiresChoice: true,
      },
      {
        name: 'Fey Ancestry',
        effect: 'Advantage on saves to avoid or end the Charmed condition.',
        source: 'PHB 2024 "Elf Traits: Fey Ancestry"',
      },
      {
        name: 'Keen Senses',
        effect: 'Proficiency in Insight, Perception, or Survival (your choice).',
        source: 'PHB 2024 "Elf Traits: Keen Senses"',
        requiresChoice: true,
      },
      {
        name: 'Trance',
        effect:
          "You don't sleep and can't be magically put to sleep; a Long Rest takes 4 hours of trancelike meditation.",
        source: 'PHB 2024 "Elf Traits: Trance"',
      },
    ],
    choices: [
      {
        kind: 'elvenLineage',
        field: 'elvenLineage',
        label: 'Elven Lineage',
        // PHB 2024 "Elven Lineages" table.
        options: [
          { id: 'drow', label: 'Drow', note: 'Darkvision 120 ft; Dancing Lights' },
          { id: 'highElf', label: 'High Elf', note: 'Prestidigitation (swappable)' },
          { id: 'woodElf', label: 'Wood Elf', note: 'Speed 35 ft; Druidcraft' },
        ],
      },
      {
        kind: 'spellcastingAbility',
        field: 'spellcastingAbility',
        label: 'Lineage Spellcasting Ability',
        options: SPELLCASTING_ABILITY_OPTIONS,
      },
      {
        kind: 'keenSensesSkill',
        field: 'keenSensesSkill',
        label: 'Keen Senses Skill',
        options: [
          { id: 'insight', label: 'Insight' },
          { id: 'perception', label: 'Perception' },
          { id: 'survival', label: 'Survival' },
        ] satisfies { id: SkillId | string; label: string }[],
      },
    ],
  },

  // PHB 2024 "Gnome Traits" (Docs/PlayersHandbook.md "GNOME TRAITS").
  gnome: {
    id: 'gnome',
    name: 'Gnome',
    creatureType: 'Humanoid',
    size: 'small',
    baseSpeedFt: 30,
    darkvisionFt: 60,
    grantedLanguages: [],
    source: 'PHB 2024 "Gnome Traits"',
    traits: [
      {
        name: 'Darkvision',
        effect: 'See in the dark out to 60 feet.',
        mechanics: { darkvisionFt: 60 },
        source: 'PHB 2024 "Gnome Traits: Darkvision"',
      },
      {
        name: 'Gnomish Cunning',
        effect: 'Advantage on Intelligence, Wisdom, and Charisma saving throws.',
        source: 'PHB 2024 "Gnome Traits: Gnomish Cunning"',
      },
      {
        name: 'Gnomish Lineage',
        effect:
          'Choose Forest (Minor Illusion + Speak with Animals) or Rock (Mending + Prestidigitation + a clockwork device); Int/Wis/Cha spellcasting ability.',
        source: 'PHB 2024 "Gnome Traits: Gnomish Lineage"',
        requiresChoice: true,
      },
    ],
    choices: [
      {
        kind: 'gnomishLineage',
        field: 'gnomishLineage',
        label: 'Gnomish Lineage',
        options: [
          { id: 'forest', label: 'Forest Gnome', note: 'Minor Illusion; Speak with Animals' },
          { id: 'rock', label: 'Rock Gnome', note: 'Mending; Prestidigitation; clockwork device' },
        ],
      },
      {
        kind: 'spellcastingAbility',
        field: 'spellcastingAbility',
        label: 'Lineage Spellcasting Ability',
        options: SPELLCASTING_ABILITY_OPTIONS,
      },
    ],
  },

  // PHB 2024 "Goliath Traits" (Docs/PlayersHandbook.md "GOLIATH TRAITS").
  goliath: {
    id: 'goliath',
    name: 'Goliath',
    creatureType: 'Humanoid',
    size: 'medium',
    baseSpeedFt: 35,
    darkvisionFt: 0,
    grantedLanguages: [],
    source: 'PHB 2024 "Goliath Traits"',
    traits: [
      {
        name: 'Giant Ancestry',
        effect:
          'Choose one giant boon (Cloud/Fire/Hill/Frost/Stone/Storm); uses equal to your Proficiency Bonus, recharging on a Long Rest.',
        source: 'PHB 2024 "Goliath Traits: Giant Ancestry"',
        requiresChoice: true,
      },
      {
        name: 'Large Form',
        effect:
          'At character level 5 you can become Large as a Bonus Action for 10 minutes (Advantage on Strength checks, +10 ft Speed).',
        source: 'PHB 2024 "Goliath Traits: Large Form"',
      },
      {
        name: 'Powerful Build',
        effect:
          'Advantage on saves to end the Grappled condition, and you count as one size larger for carrying capacity.',
        source: 'PHB 2024 "Goliath Traits: Powerful Build"',
      },
    ],
    choices: [
      {
        kind: 'giantAncestry',
        field: 'giantAncestry',
        label: 'Giant Ancestry',
        options: [
          { id: 'cloud', label: "Cloud's Jaunt", note: 'Teleport 30 ft (Bonus Action)' },
          { id: 'fire', label: "Fire's Burn", note: '+1d10 Fire on a hit' },
          { id: 'hill', label: "Hill's Tumble", note: 'Knock a hit target Prone' },
          { id: 'frost', label: "Frost's Chill", note: '+1d6 Cold and −10 ft Speed on a hit' },
          {
            id: 'stone',
            label: "Stone's Endurance",
            note: 'Reaction: reduce damage by 1d12 + Con',
            reaction: {
              name: "Stone's Endurance",
              summary: 'When you take damage, roll 1d12, add your Constitution modifier, and reduce the damage by that total. Proficiency Bonus uses per Long Rest (Giant Ancestry).',
              source: 'PHB 2024 "Goliath Traits: Giant Ancestry, Stone\'s Endurance" (L8196)',
            },
          },
          {
            id: 'storm',
            label: "Storm's Thunder",
            note: 'Reaction: 1d8 Thunder to attacker',
            reaction: {
              name: "Storm's Thunder",
              summary: 'When you take damage from a creature within 60 feet of you, deal 1d8 Thunder damage to that creature. Proficiency Bonus uses per Long Rest (Giant Ancestry).',
              source: 'PHB 2024 "Goliath Traits: Giant Ancestry, Storm\'s Thunder" (L8198)',
            },
          },
        ],
      },
    ],
  },

  // PHB 2024 "Halfling Traits" (Docs/PlayersHandbook.md "HALFLING TRAITS").
  halfling: {
    id: 'halfling',
    name: 'Halfling',
    creatureType: 'Humanoid',
    size: 'small',
    baseSpeedFt: 30,
    darkvisionFt: 0,
    grantedLanguages: [],
    source: 'PHB 2024 "Halfling Traits"',
    traits: [
      {
        name: 'Brave',
        effect: 'Advantage on saves to avoid or end the Frightened condition.',
        source: 'PHB 2024 "Halfling Traits: Brave"',
      },
      {
        name: 'Halfling Nimbleness',
        effect: "Move through the space of any creature a size larger than you (can't stop there).",
        source: 'PHB 2024 "Halfling Traits: Halfling Nimbleness"',
      },
      {
        name: 'Luck',
        effect: 'When you roll a 1 on the d20 of a D20 Test, reroll and use the new roll.',
        source: 'PHB 2024 "Halfling Traits: Luck"',
      },
      {
        name: 'Naturally Stealthy',
        effect: 'Take the Hide action even when obscured only by a creature at least one size larger.',
        source: 'PHB 2024 "Halfling Traits: Naturally Stealthy"',
      },
    ],
  },

  // PHB 2024 "Human Traits" (Docs/PlayersHandbook.md "HUMAN TRAITS").
  human: {
    id: 'human',
    name: 'Human',
    creatureType: 'Humanoid',
    size: 'choice', // Medium or Small, chosen at selection.
    baseSpeedFt: 30,
    darkvisionFt: 0,
    grantedLanguages: [],
    source: 'PHB 2024 "Human Traits"',
    traits: [
      {
        name: 'Resourceful',
        effect: 'Gain Heroic Inspiration whenever you finish a Long Rest.',
        source: 'PHB 2024 "Human Traits: Resourceful"',
      },
      {
        name: 'Skillful',
        effect: 'Proficiency in one skill of your choice.',
        source: 'PHB 2024 "Human Traits: Skillful"',
        requiresChoice: true,
      },
      {
        name: 'Versatile',
        effect:
          'Gain an Origin feat of your choice (Skilled is recommended).',
        source: 'PHB 2024 "Human Traits: Versatile"',
      },
    ],
    choices: [
      {
        kind: 'size',
        field: 'size',
        label: 'Size',
        options: SIZE_CHOICE_OPTIONS,
      },
      {
        kind: 'skillfulSkill',
        field: 'skillfulSkill',
        label: 'Skillful Skill',
        // Any one skill; options built from the SKILLS table in the UI layer so
        // this spec stays data-only. Left empty here; the UI fills skill names.
        options: [],
      },
    ],
  },

  // PHB 2024 "Orc Traits" (Docs/PlayersHandbook.md "ORC TRAITS").
  orc: {
    id: 'orc',
    name: 'Orc',
    creatureType: 'Humanoid',
    size: 'medium',
    baseSpeedFt: 30,
    darkvisionFt: 120,
    grantedLanguages: [],
    source: 'PHB 2024 "Orc Traits"',
    traits: [
      {
        name: 'Adrenaline Rush',
        effect:
          'Dash as a Bonus Action and gain Temporary Hit Points equal to your Proficiency Bonus; uses equal to your Proficiency Bonus, recharging on a Short or Long Rest.',
        source: 'PHB 2024 "Orc Traits: Adrenaline Rush"',
      },
      {
        name: 'Darkvision',
        effect: 'See in the dark out to 120 feet.',
        mechanics: { darkvisionFt: 120 },
        source: 'PHB 2024 "Orc Traits: Darkvision"',
      },
      {
        name: 'Relentless Endurance',
        effect:
          'When reduced to 0 HP but not killed outright, drop to 1 HP instead; recharges on a Long Rest.',
        source: 'PHB 2024 "Orc Traits: Relentless Endurance"',
      },
    ],
  },

  // PHB 2024 "Tiefling Traits" (Docs/PlayersHandbook.md "TIEFLING TRAITS").
  tiefling: {
    id: 'tiefling',
    name: 'Tiefling',
    creatureType: 'Humanoid',
    size: 'choice', // Medium or Small, chosen at selection.
    baseSpeedFt: 30,
    darkvisionFt: 60,
    grantedLanguages: [],
    source: 'PHB 2024 "Tiefling Traits"',
    traits: [
      {
        name: 'Darkvision',
        effect: 'See in the dark out to 60 feet.',
        mechanics: { darkvisionFt: 60 },
        source: 'PHB 2024 "Tiefling Traits: Darkvision"',
      },
      {
        name: 'Fiendish Legacy',
        effect:
          'Choose Abyssal, Chthonic, or Infernal for a level-1 benefit (a resistance + a cantrip) plus spells at levels 3 and 5 (Int/Wis/Cha spellcasting ability).',
        source: 'PHB 2024 "Tiefling Traits: Fiendish Legacy" / "Fiendish Legacies" table',
        requiresChoice: true,
      },
      {
        name: 'Otherworldly Presence',
        effect:
          'You know the Thaumaturgy cantrip, cast with your Fiendish Legacy spellcasting ability.',
        source: 'PHB 2024 "Tiefling Traits: Otherworldly Presence"',
      },
    ],
    choices: [
      {
        kind: 'fiendishLegacy',
        field: 'fiendishLegacy',
        label: 'Fiendish Legacy',
        // PHB 2024 "Fiendish Legacies" table (level-1 resistance + cantrip).
        options: [
          { id: 'abyssal', label: 'Abyssal', note: 'Resist Poison; Poison Spray' },
          { id: 'chthonic', label: 'Chthonic', note: 'Resist Necrotic; Chill Touch' },
          { id: 'infernal', label: 'Infernal', note: 'Resist Fire; Fire Bolt' },
        ],
      },
      {
        kind: 'spellcastingAbility',
        field: 'spellcastingAbility',
        label: 'Legacy Spellcasting Ability',
        options: SPELLCASTING_ABILITY_OPTIONS,
      },
      {
        kind: 'size',
        field: 'size',
        label: 'Size',
        options: SIZE_CHOICE_OPTIONS,
      },
    ],
  },
} as const satisfies Record<string, SpeciesData>;

/** A valid species catalog key, e.g. 'dwarf'. */
export type SpeciesId = keyof typeof SPECIES_CATALOG;

/** A species entry whose `id` is narrowed to the literal SpeciesId union. */
export type SpeciesEntry = SpeciesData & { id: SpeciesId };

/** The catalog as an array, in alphabetical (declaration) order. */
export const SPECIES_LIST: readonly SpeciesEntry[] = Object.values(
  SPECIES_CATALOG,
) as readonly SpeciesEntry[];

/** Looks up a species by id, tolerating an unknown/absent id (returns undefined). */
export function getSpecies(id: string | undefined): SpeciesData | undefined {
  if (id === undefined) return undefined;
  return (SPECIES_CATALOG as Record<string, SpeciesData>)[id];
}

// --- Sub-choice id unions, derived from the catalog options ---

/** Dragonborn Draconic Ancestry id. */
export type DraconicAncestry =
  (typeof SPECIES_CATALOG)['dragonborn']['choices'][number]['options'][number]['id'];
/** Elf Elven Lineage id. */
export type ElvenLineageId =
  (typeof SPECIES_CATALOG)['elf']['choices'][0]['options'][number]['id'];
/** Gnome Gnomish Lineage id. */
export type GnomishLineageId =
  (typeof SPECIES_CATALOG)['gnome']['choices'][0]['options'][number]['id'];
/** Goliath Giant Ancestry id. */
export type GiantAncestryId =
  (typeof SPECIES_CATALOG)['goliath']['choices'][number]['options'][number]['id'];
/** Tiefling Fiendish Legacy id. */
export type FiendishLegacyId =
  (typeof SPECIES_CATALOG)['tiefling']['choices'][0]['options'][number]['id'];
