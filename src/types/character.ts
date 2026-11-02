/**
 * Core D&D 5.5e (2024) character data model.
 *
 * This is the persisted shape for a single character. Stage 1 covers the
 * mechanical foundation: identity, the six ability scores, and level. Later
 * stages extend this type additively (species, class, spells, inventory, etc.).
 *
 * Rules references throughout cite the 2024 Player's Handbook (PHB). See the
 * rules-compliance steering file for edition precedence and sourcing rules.
 */

// Stage-3 species id/sub-choice unions, re-exported from the data catalog so
// the persisted shape and the catalog cannot drift (same pattern as SkillId
// being derived from SKILLS). See src/data/species.ts for the source of truth.
import type {
  CreatureSize,
  DraconicAncestry,
  ElvenLineageId,
  FiendishLegacyId,
  GiantAncestryId,
  GnomishLineageId,
  SpeciesId,
} from '../data/species';

/** The six abilities, in the canonical PHB order. PHB 2024 "Ability Scores". */
export const ABILITIES = [
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha',
] as const;

export type Ability = (typeof ABILITIES)[number];

/** Human-readable names for each ability. */
export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

/** Short uppercase labels used on the sheet. */
export const ABILITY_ABBR: Record<Ability, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};

/**
 * A character's six ability scores. A score ranges 1–30 in the 2024 rules
 * (PHB 2024: Ability Modifiers table spans scores 1–30). Validation of bounds
 * is handled by the rules logic, not the type.
 */
export type AbilityScores = Record<Ability, number>;

/**
 * A skill's stored training state. Both default to false/absent.
 * Expertise doubles the Proficiency Bonus and is only meaningful when
 * proficient (PHB 2024: Expertise — the Proficiency Bonus can be multiplied
 * only once, so expertise adds one extra PB on top of the proficient PB).
 */
export interface SkillTraining {
  proficient?: boolean;
  expertise?: boolean;
}

/**
 * The canonical 2024 skill list with each skill's governing ability.
 * Transcribed from the PHB 2024 "Skills" table / "Skill List" (SRD-safe
 * mechanical identifiers only; no descriptive prose is reproduced).
 * This is the single source of truth shared by the logic and the UI,
 * mirroring how ABILITIES / ABILITY_NAMES are placed above.
 */
export const SKILLS = [
  { id: 'acrobatics', name: 'Acrobatics', ability: 'dex' },
  { id: 'animalHandling', name: 'Animal Handling', ability: 'wis' },
  { id: 'arcana', name: 'Arcana', ability: 'int' },
  { id: 'athletics', name: 'Athletics', ability: 'str' },
  { id: 'deception', name: 'Deception', ability: 'cha' },
  { id: 'history', name: 'History', ability: 'int' },
  { id: 'insight', name: 'Insight', ability: 'wis' },
  { id: 'intimidation', name: 'Intimidation', ability: 'cha' },
  { id: 'investigation', name: 'Investigation', ability: 'int' },
  { id: 'medicine', name: 'Medicine', ability: 'wis' },
  { id: 'nature', name: 'Nature', ability: 'int' },
  { id: 'perception', name: 'Perception', ability: 'wis' },
  { id: 'performance', name: 'Performance', ability: 'cha' },
  { id: 'persuasion', name: 'Persuasion', ability: 'cha' },
  { id: 'religion', name: 'Religion', ability: 'int' },
  { id: 'sleightOfHand', name: 'Sleight of Hand', ability: 'dex' },
  { id: 'stealth', name: 'Stealth', ability: 'dex' },
  { id: 'survival', name: 'Survival', ability: 'wis' },
] as const satisfies ReadonlyArray<{ id: string; name: string; ability: Ability }>;

export type SkillId = (typeof SKILLS)[number]['id'];

/**
 * A character's species selection and the sub-choices the 2024 rules require
 * for it (lineage/ancestry/legacy, size when the species offers Small/Medium,
 * and the skill/ability picks some species traits grant). All sub-choice
 * fields are optional: a species can be chosen before its sub-choices are made,
 * and the sheet renders fine with them unset (PHB 2024 "Parts of a Species").
 *
 * Additive-optional on Character (no CURRENT_VERSION bump): an absent `species`
 * means "no species chosen", a valid pre-Stage-3 state, so no migration is
 * needed (same convention as the Stage-2 optional fields below).
 */
export interface SpeciesSelection {
  /** Catalog key, e.g. 'dwarf'. An unknown/invalid id is treated as no species. */
  id: SpeciesId;
  /** Chosen size when the species offers Small/Medium (Aasimar/Human/Tiefling). */
  size?: CreatureSize;
  /** Dragonborn Draconic Ancestry (sets Breath Weapon / Resistance damage type). */
  draconicAncestry?: DraconicAncestry;
  /** Elf Elven Lineage (Drow/High Elf/Wood Elf) — affects Speed & Darkvision. */
  elvenLineage?: ElvenLineageId;
  /** Gnome Gnomish Lineage (Forest/Rock). */
  gnomishLineage?: GnomishLineageId;
  /** Goliath Giant Ancestry (one of six). */
  giantAncestry?: GiantAncestryId;
  /** Tiefling Fiendish Legacy (Abyssal/Chthonic/Infernal). */
  fiendishLegacy?: FiendishLegacyId;
  /** Spellcasting-ability choice for lineage/legacy traits (Int/Wis/Cha). */
  spellcastingAbility?: Ability;
  /** Elf Keen Senses skill choice (Insight/Perception/Survival). */
  keenSensesSkill?: Extract<SkillId, 'insight' | 'perception' | 'survival'>;
  /** Human Skillful skill proficiency choice (any single skill). */
  skillfulSkill?: SkillId;
}

/** The current persisted-schema version. Bumped only on breaking changes. */
export const CURRENT_VERSION = 1;

/**
 * A single character sheet.
 */
export interface Character {
  /** Schema version for migrations. */
  _v: number;
  /** Stable unique id (used as the storage key). */
  id: string;
  /** Character name (free text). */
  name: string;
  /**
   * Total character level, 1–20 (PHB 2024: Character Advancement table).
   * Multiclass level breakdown is handled in a later stage.
   */
  level: number;
  /** The six ability scores. */
  abilities: AbilityScores;
  /**
   * Per-skill proficiency/expertise flags. Absent entries default to
   * untrained (PHB 2024: Skill Proficiencies / Expertise). Optional and
   * additive: Stage-1 records without this field load unchanged.
   */
  skills?: Partial<Record<SkillId, SkillTraining>>;
  /**
   * Per-ability saving-throw proficiency flags. Absent entries default to
   * non-proficient (PHB 2024: Saving Throw Proficiencies).
   */
  saveProficiencies?: Partial<Record<Ability, boolean>>;
  /**
   * Manual Armor Class override. When set (finite), it supersedes the
   * computed base AC. A sheet convenience, not a PHB mechanic — armor,
   * shields, and feature-based AC arrive in a later stage.
   */
  acOverride?: number;
  /**
   * Editable Hit Point maximum. No RAW HP-max formula exists without a class
   * (class Hit Dice are a later stage), so this is an explicit value for now.
   */
  hpMax?: number;
  /** Generic manual bonus to Initiative (PHB 2024: Initiative). */
  initiativeBonus?: number;
  /**
   * Selected species and its required sub-choices. Absent = no species chosen
   * (a valid state). Additive-optional: pre-Stage-3 records without this field
   * load unchanged (PHB 2024 "Parts of a Species").
   */
  species?: SpeciesSelection;
  /** Creation timestamp (epoch ms). */
  createdAt: number;
  /** Last-modified timestamp (epoch ms). */
  updatedAt: number;
}

/**
 * A fresh, valid character with default values.
 *
 * Default ability scores are 10 (a +0 modifier — PHB 2024: Ability Modifiers
 * table maps a score of 10–11 to +0), matching an unassigned baseline.
 * The id and timestamps are placeholders; callers should assign a real id
 * and timestamps when creating a character (see the character store).
 */
export const BLANK_CHARACTER: Character = {
  _v: CURRENT_VERSION,
  id: '',
  name: '',
  level: 1,
  abilities: {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
  },
  skills: {},
  saveProficiencies: {},
  // acOverride, hpMax, initiativeBonus are left unset (undefined == default).
  createdAt: 0,
  updatedAt: 0,
};
