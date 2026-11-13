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

// Stage-4 class id/subclass unions, re-exported from the data catalog so the
// persisted shape and the catalog cannot drift (same pattern as SpeciesId).
// See src/data/classes.ts for the source of truth.
import type { ClassId, SubclassId } from '../data/classes';
import type { ConditionId } from '../data/conditions';

// Stage-8 spell catalog key, re-exported from the data catalog so the persisted
// spellcasting state and the catalog cannot drift (same pattern as SpeciesId /
// ClassId). See src/data/spells.ts for the source of truth.
import type { SpellId } from '../data/spells';

// Stage A6b feat catalog key, re-exported from the data catalog so the persisted
// feat selections and the catalog cannot drift (same pattern as SpellId /
// ClassId). See src/data/feats.ts for the source of truth.
import type { FeatId } from '../data/feats';

// Stage A7 background catalog key, re-exported from the data catalog so the
// persisted background selection and the catalog cannot drift (same pattern as
// SpeciesId / ClassId / FeatId). See src/data/backgrounds.ts for the source.
import type { BackgroundId } from '../data/backgrounds';

// Stage A2/A3 coin-purse shape, re-exported from the currency logic so the
// persisted purse and the currency math cannot drift. currency.ts has no
// dependency on this module, so this import introduces no cycle.
import type { CurrencyAmount } from '../logic/currency';

// Stage B7 roll-log mode. dice.ts has no dependency on this module, so this
// type-only import introduces no cycle. The d20 resolution math lives in
// dice.ts; this type is reused so the event-log roll payload cannot drift from
// the dice engine's notion of Advantage / Disadvantage.
import type { D20Mode } from '../logic/dice';

// Companions page record types (additive-optional Character fields). Type-only
// imports of the catalog/logic keys so the persisted records and the catalogs
// cannot drift.
import type { CreatureSize as CatalogCreatureSize } from '../data/creatures';
import type { SidekickClassId } from '../data/sidekicks';
import type { HirelingKind } from '../logic/companions';

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
 * Transcribed from the PHB 2024 "Skills" table / "Skill List" (mechanical
 * identifiers only; no descriptive prose is reproduced).
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

/** A class-feature choice group (see {@link ClassChoices}). */
export type ClassChoiceKey =
  | 'sorcerer.metamagic'
  | 'warlock.invocations'
  | 'fighter.maneuvers'
  | 'cleric.divineOrder'
  | 'cleric.blessedStrikes'
  | 'druid.primalOrder'
  | 'druid.elementalFury'
  | 'barbarian.primalKnowledge'
  | 'barbarian.aspectOfTheWilds'
  | 'fighter.studentOfWarSkill'
  | 'fighter.studentOfWarTool'
  | 'bard.loreSkills'
  | 'bard.multiclassInstrument'
  | 'ranger.glamourSkill'
  | 'ranger.huntersPrey'
  | 'ranger.defensiveTactics'
  | 'ranger.primalCompanion'
  | 'druid.landType'
  | 'sorcerer.elementalAffinity'
  | 'wizard.spellMastery'
  | 'wizard.signatureSpells';

/** Chosen option ids per choice group. Single-pick groups hold 0 or 1 ids. */
export type ClassChoices = Partial<Record<ClassChoiceKey, string[]>>;

/**
 * One class a character has levels in (PHB 2024 "Multiclassing"). In 2024 a
 * class sets the Hit Die, save proficiencies, armor/weapon/tool proficiencies, a
 * starting skill choice, and level-by-level features (PHB 2024 Chapter 3).
 *
 * This is the per-class entry stored in `Character.classes`. The first entry is
 * the INITIAL class (it grants the full starting proficiencies; later entries
 * grant only the reduced multiclass subset — PHB 2024 "Multiclassing:
 * Proficiencies"). Sub-choice fields are optional so a class can be chosen
 * before its subclass/skills are. Its fields are identical to the pre-Stage-M1
 * single `ClassSelection`, which is now folded into the `classes[]` array.
 */
export interface ClassEntry {
  /** Catalog key, e.g. 'wizard'. An unknown/invalid id is treated as no class. */
  id: ClassId;
  /** Chosen subclass id (valid from the class's subclassLevel). */
  subclassId?: SubclassId;
  /**
   * Levels in THIS class (1..20). The sum across entries equals
   * `Character.level` (PHB 2024 "Multiclassing": your character level is the
   * total of your levels in all your classes). For a single-class character
   * this equals the character level.
   */
  level: number;
  /** The starting skill proficiencies chosen for this class. */
  skillChoices?: SkillId[];
}

/**
 * Temporary alias for the pre-Stage-M1 name. Behaviour-neutral M1 reshape: the
 * single `Character.class` field is replaced by `Character.classes: ClassEntry[]`.
 * This alias eases incremental migration of imports; prefer `ClassEntry`.
 */
export type ClassSelection = ClassEntry;

/**
 * A character's spellcasting selections and slot tracking (Stage 8).
 *
 * Additive-optional on Character (no CURRENT_VERSION bump): absent = "no
 * spellcasting state", a valid state for non-casters and for casters who have
 * not chosen anything yet — same convention as the Stage-3 `species` and
 * Stage-4 `class` optional fields. 2024 RAW models every caster uniformly as
 * cantrips + a changeable prepared set (PHB 2024 Chapter 7 "Spellcasting"),
 * so there is no separate "known" collection.
 */
/**
 * One class's spell selections (PHB 2024 "Multiclassing: Spells Prepared"). The
 * cantrips/prepared lists are determined per class as a single-classed member
 * of that class; a Wizard entry also carries its spellbook. Shared/pooled slot
 * tracking lives on `SpellcastingState` (slots are a combined pool).
 */
export interface ClassSpellcasting {
  /** Cantrip spell ids this class knows (always available, never use slots). */
  cantrips?: SpellId[];
  /** Leveled spell ids currently prepared for this class (the changeable list). */
  prepared?: SpellId[];
  /**
   * Wizard only: the superset of leveled spells scribed in the spellbook, from
   * which the prepared list is chosen (PHB 2024 "Wizard: Spellcasting"). A
   * minimal field this stage; full scribe/copy mechanics are a later stage.
   */
  spellbook?: SpellId[];
}

export interface SpellcastingState {
  /**
   * Per-class spell selections, keyed by ClassId (PHB 2024 "Multiclassing:
   * Spells Prepared" — each class's cantrips/prepared/spellbook are tracked as a
   * single-classed member of that class). For a single-class character there is
   * exactly one key. Absent = no selections yet.
   */
  byClass?: Partial<Record<ClassId, ClassSpellcasting>>;
  /**
   * Standard spell slots expended, keyed by spell level, e.g. { 1: 2, 3: 1 }.
   * Absent = none spent (PHB 2024: slots recover on a Long Rest).
   */
  slotsExpended?: Partial<Record<number, number>>;
  /**
   * Warlock Pact Magic slots expended (all one level). Absent = none spent
   * (PHB 2024 "Warlock: Pact Magic": slots recover on a Short OR Long Rest).
   */
  pactSlotsExpended?: number;
  /**
   * Warlock only: the Mystic Arcanum spells chosen at Warlock levels 11/13/15/
   * 17, keyed by arcanum spell level (6/7/8/9), e.g. { 6: 'disintegrate' }.
   * These are cast without a spell slot and recover on a Long Rest, so they are
   * tracked SEPARATELY from Pact Magic slots and the prepared cap (PHB 2024
   * "Warlock: Mystic Arcanum"). Absent = none chosen.
   */
  mysticArcana?: Partial<Record<number, SpellId>>;
  /**
   * Warlock only: which Mystic Arcanum uses are expended, keyed by arcanum
   * spell level (6/7/8/9). true = that arcanum has been cast and not yet
   * recovered (PHB 2024: recovers on a Long Rest). Absent = none expended.
   */
  mysticArcanaExpended?: Partial<Record<number, boolean>>;
}

/**
 * Opt-in house rules. Rules-as-written is the default; each flag gates an
 * optional/variant rule (PHB 2024 "Optional Rule" sidebars). `rolledHp`
 * selects rolling the Hit Die for HP each level instead of the fixed value
 * (PHB 2024 "Hit Points": the fixed value is the default, rolling is the
 * optional alternative).
 */
export interface HouseRules {
  /** When true, HP gains per level use a rolled total instead of the fixed value. */
  rolledHp?: boolean;
  /**
   * When true, enable the variant "Encumbered / Heavily Encumbered" speed-penalty
   * bands (Encumbered at Strength × 5 lb, Heavily Encumbered at Strength × 10 lb).
   *
   * RULES-COMPLIANCE NOTE (rule 1 / rule 2 / rule 4): these bands are NOT in the
   * 2024 PHB (Docs/PlayersHandbook.md defines only Carrying Capacity = Str × 15;
   * the index entry reads "encumbrance. See carrying capacity"). The band rule is
   * a 2014-era variant (2014 PHB "Variant: Encumbrance"). It is therefore an
   * OPT-IN house rule that is OFF by default — RAW 2024 behaviour is a binary
   * over/under-capacity flag only. Enabling it requires a cited external source
   * (the 2014 variant); the band thresholds live behind this flag in
   * encumbrance.ts and are explicitly marked as not-2024-RAW there. Absent = off.
   */
  variantEncumbrance?: boolean;
  /**
   * When true, a multiclass that FAILS the ability-score prerequisite (PHB 2024
   * "Multiclassing: Prerequisites" — a score of at least 13 in the primary
   * ability of each class) is PERMITTED with a warning instead of being blocked.
   *
   * RULES-COMPLIANCE NOTE (rule 1 / rule 4): this is NOT a 2024 RAW rule — it is
   * an OPT-IN house rule that is OFF by default, so default behaviour is RAW (the
   * prerequisite is enforced). Declared now for the multiclass prerequisite stage
   * (M4); NO behaviour is wired to it this stage. Absent = off (RAW).
   */
  allowIllegalMulticlass?: boolean;
  /**
   * When true, a level 20 character in XP leveling mode gains one bonus feat for
   * every 30,000 XP above 355,000 XP.
   *
   * RULES-COMPLIANCE NOTE (rule 4): this is NOT the default rules-as-written
   * behaviour. PHB 2024 "Bonus Feats at Level 20" (Docs/PlayersHandbook.md
   * L2029-2031) is an optional approach a DM may use; it is an OPT-IN house rule
   * that is OFF by default. Absent = off (no bonus feat slots).
   */
  bonusFeatsAfter20?: boolean;
  /**
   * When true, the Companions page offers Tasha's Sidekicks (Expert, Spellcaster,
   * Warrior).
   *
   * RULES-COMPLIANCE NOTE (rule 3 / rule 4): Sidekicks are an optional
   * supplement from Tasha's Cauldron of Everything (2020), "Sidekicks"
   * (Docs/TashasCauldronOfEverything.md), a 2014-edition (5e) book. They are
   * NOT part of the 2024 rules, so this is an OPT-IN house rule that is OFF by
   * default and the UI marks them "Tasha's 2020 (5e, 2014 rules)". Absent = off.
   */
  sidekicks?: boolean;
  /**
   * When true, hirelings and NPC party members on the Companions page track a
   * Loyalty Score (0-20).
   *
   * RULES-COMPLIANCE NOTE (rule 4): Loyalty is an optional rule in the Dungeon
   * Master's Guide 2024, "Loyalty" (Docs/DungeonMastersGuide.md L3572-3586). It
   * is an OPT-IN house rule that is OFF by default. Absent = off.
   */
  loyalty?: boolean;
}

// ─── Companions page records (additive-optional; no CURRENT_VERSION bump) ─────

/**
 * Shared tracking fields of every creature the Companions page tracks (HP, temp
 * HP, conditions, notes). Edited only on the Companions page. Absent `hp` = at
 * the maximum and follows it (same convention as `Character.currentHp`).
 */
export interface TrackedCreature {
  /** Current HP; absent = at maximum. PHB 2024 "Hit Points" (L1073-1079). */
  hp?: number;
  /** Temporary Hit Points; absent = 0. They do not stack (L1179-1193). */
  tempHp?: number;
  /** Active conditions (ids from the condition catalog, no durations). */
  conditions?: ActiveCondition[];
  /** Exhaustion level 0..6; absent = 0. */
  exhaustionLevel?: number;
  notes?: string;
  /**
   * What it looks like, in the player's words (feeds the portrait prompt). For
   * a Primal Companion this is where the chosen kind of animal goes: the
   * Ranger decides what animal it is (PHB 2024 Beast Master, L5583).
   */
  appearance?: string;
}

/** How a companion came to the character. */
export type CompanionOrigin =
  | 'primal-companion'
  | 'find-familiar'
  | 'pact-of-the-chain'
  | 'wild-companion'
  | 'find-steed'
  | 'animate-dead'
  | 'pet';

/** Celestial / Fey / Fiend type choice for a familiar or the Otherworldly Steed. */
export type CompanionSpiritType = 'Celestial' | 'Fey' | 'Fiend';

/**
 * A permanent creature companion. Stats are NEVER stored: they are read from the
 * creature catalog (and the owner's live level, Wisdom and spellcasting for the
 * Primal Companion and the Otherworldly Steed).
 */
export interface CompanionRecord extends TrackedCreature, RidingDetails {
  /** Instance id. */
  id: string;
  /** CREATURE_CATALOG key; an unknown id drops the record on import. */
  creatureId: string;
  origin: CompanionOrigin;
  nickname?: string;
  /** True = dismissed (kept but inactive); absent = active. */
  dismissed?: boolean;
  /** The actual maximum when it differs from the printed average (e.g. rolled). */
  hpMaxOverride?: number;
  /** Find Steed: level of the spell slot used (2-9). */
  spellSlotLevel?: number;
  /** Find Steed: creature type chosen on the cast. */
  steedType?: CompanionSpiritType;
  /** Find Familiar / Pact of the Chain: creature type chosen. */
  familiarType?: CompanionSpiritType;
  /** Find Steed: id of the character's class entry whose spellcasting supplies attack and DC. */
  castingClassId?: string;
}

/** Saddle kinds (PHB 2024 "Mounts and Vehicles" equipment, L10388). */
export type SaddleKind = 'none' | 'riding' | 'military' | 'exotic';

/**
 * Riding and packing details of a creature companion (PHB 2024 "Mounts and
 * Vehicles", L10372-10401). Until schema v3 these lived on a separate `mounts`
 * list; storage/migration.ts MIGRATIONS[2] folds those records into
 * `companions` (origin 'pet') with these fields.
 */
export interface RidingDetails {
  /** Weight carried, in pounds. */
  carriedLb?: number;
  saddle?: SaddleKind;
  /** ARMOR_CATALOG key of armor bought as barding. */
  bardingArmorId?: string;
  /** Custom barding base armor: normal cost and weight (before the barding multipliers). */
  bardingCustom?: { costGp: number; weightLb: number };
  pullsVehicle?: boolean;
  /** Weight of the vehicle this animal helps pull (lb). */
  vehicleWeightLb?: number;
}

/** A user-typed named stat block entry (trait, action, bonus action or reaction). */
export interface NamedStatEntry {
  name: string;
  description: string;
}

/**
 * A fully user-entered stat block for a hireling or NPC party member. The PHB
 * gives hirelings no statistics and the Monster Manual holds the NPC stat
 * blocks, so nothing here is pre-filled from the book.
 */
export interface CustomStatBlock {
  size?: CatalogCreatureSize;
  creatureType?: string;
  alignment?: string;
  ac?: number;
  initiativeMod?: number;
  hpMax?: number;
  speed?: string;
  abilities?: Partial<Record<Ability, number>>;
  saveProficiencies?: Ability[];
  proficiencyBonus?: number;
  skills?: string;
  /** The MM 2024 "Gear" line (items the creature carries). */
  gear?: string;
  senses?: string;
  languages?: string;
  resistances?: string;
  immunities?: string;
  vulnerabilities?: string;
  cr?: string;
  xp?: number;
  traits?: NamedStatEntry[];
  actions?: NamedStatEntry[];
  bonusActions?: NamedStatEntry[];
  reactions?: NamedStatEntry[];
}

/** A hireling (PHB 2024 services table, L10523-10533). */
export interface HirelingRecord extends TrackedCreature {
  id: string;
  name: string;
  kind: HirelingKind;
  /** Days (skilled, untrained) or miles (messenger). */
  units: number;
  /** Copper pieces per unit the user actually pays (the table pay is a minimum). */
  customRateCp?: number;
  stats?: CustomStatBlock;
  /** Loyalty Score 0-20, used only when the loyalty house rule is on. */
  loyalty?: number;
}

/** An NPC party member (DMG 2024 L833, L3553-3560). */
export interface NpcPartyMemberRecord extends TrackedCreature {
  id: string;
  name: string;
  role?: string;
  stats?: CustomStatBlock;
  /** Loyalty Score 0-20, used only when the loyalty house rule is on. */
  loyalty?: number;
}

/** One recorded sidekick level-up. */
export interface SidekickLevelUp {
  /** The new level reached (2-20). */
  level: number;
  /** The Hit Die roll entered (or rolled). */
  roll: number;
  /** Hit points gained (computed by the helper at the time). */
  hpGained: number;
}

/** A Tasha's sidekick (2014 rules; only with the `sidekicks` house rule). */
export interface SidekickRecord extends TrackedCreature {
  id: string;
  /** CREATURE_CATALOG key; an unknown id drops the record on import. */
  creatureId: string;
  nickname?: string;
  classId: SidekickClassId;
  /** Sidekick level 1-20. */
  level: number;
  /** User-entered maximum HP at the start level. */
  baseHpMax: number;
  levelUps: SidekickLevelUp[];
  martialRole?: 'Attacker' | 'Defender';
  spellcastingRole?: 'Mage' | 'Healer' | 'Prodigy';
  deathSaves?: { successes: number; failures: number };
  stable?: boolean;
  dead?: boolean;
}

/**
 * Alignment labels — PHB 2024 "Alignment": the nine-alignment grid plus
 * Unaligned. These are descriptive identity labels only; they carry no
 * mechanical effect in this app (no rule is invented — rules-compliance rule 1).
 */
export const ALIGNMENTS = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'True Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
  'Unaligned',
] as const;

export type Alignment = (typeof ALIGNMENTS)[number];

/**
 * A single carried item instance on a character's sheet (Stage A1).
 *
 * This is a per-CHARACTER instance, distinct from the per-CATALOG definitions in
 * src/data/{weapons,armor,equipment}.ts. `kind` discriminates which catalog
 * `catalogId` points at; the resolved stats are read from the catalog at
 * display time (so the catalog stays the single source of truth), while the
 * optional override fields support custom/homebrew items with no catalog entry.
 *
 * Additive-optional on Character (no CURRENT_VERSION bump): a record with no
 * `inventory` loads unchanged — absent = empty inventory, a valid prior state
 * (same convention as the `species`/`class`/`spellcasting` optional fields).
 */
export interface InventoryItem {
  /** Instance id (crypto.randomUUID via the newCharacterId pattern). */
  id: string;
  /** Discriminates how to resolve stats + which catalog `catalogId` indexes. */
  kind: 'weapon' | 'armor' | 'equipment';
  /** Catalog key (WeaponData/ArmorData/EquipmentData id), or undefined if custom. */
  catalogId?: string;
  /** Custom/override display name; required when `catalogId` is absent. */
  name?: string;
  /** Count of this item (>= 1). */
  quantity: number;
  /** Per-instance weight override (lb) for custom items; else read from catalog. */
  weightLb?: number;
  /** Doses remaining for a dose-tracked consumable (ports Consumable.currentDoses). */
  currentDoses?: number;
  /** Maximum doses for a dose-tracked consumable (ports Consumable.maxDoses). */
  maxDoses?: number;
  /** Free-text per-instance notes. */
  notes?: string;
  /**
   * Weapon proficiency override (Stage A5d). true = proficient, false = not,
   * absent = decided by the class. Covers feat- or species-granted proficiency,
   * which is not modelled. Additive-optional; no `_v` bump.
   */
  proficiencyOverride?: boolean;
  /** Magic or other flat bonus to this weapon's attack rolls (Stage A5d). Absent = 0. */
  attackBonus?: number;
  /** Magic or other flat bonus to this weapon's damage rolls (Stage A5d). Absent = 0. */
  damageBonus?: number;
  // Reserved for the future magic-items stage: whether the item is attuned.
  // PHB 2024 attunement mechanics (slot limits, attunement requirements) are
  // OUT OF SCOPE for this arc and are NOT implemented here (rules-compliance
  // rule 1: no invented mechanic). The field is reserved only, so the persisted
  // shape need not change when the magic-items stage lands.
  // attuned?: boolean;
}

/**
 * One active condition on a character (Stage A4). `id` is a PHB condition id
 * other than Exhaustion (Exhaustion uses `Character.exhaustionLevel`). `note`
 * is a free-text source label; `ends` is a free-text note on how/when it ends
 * (rounds, save-ends, until a rest) and stays available as the label/notes
 * field. `duration` (Stage E) is an additive-optional STRUCTURED duration that
 * can tick down and expire; absent = the free-text-only behaviour of older saves.
 */
export interface ActiveCondition {
  id: Exclude<ConditionId, 'exhaustion'>;
  note?: string;
  ends?: string;
  duration?: ConditionDuration;
}

/**
 * Structured duration of one active condition (Stage E bookkeeping; the PHB has
 * no generic condition duration, L1210-1212). `rounds`, `minutes` and `hours`
 * are TIMED: `rounds` is the REMAINING count in combat rounds (1 minute = 10
 * rounds, 1 hour = 600; the kind only chooses the display unit). `short-rest`
 * and `long-rest` end when that rest completes; `concentration` ends with the
 * character's Concentration; `manual` never expires by itself.
 */
export type ConditionDurationKind =
  | 'rounds'
  | 'minutes'
  | 'hours'
  | 'short-rest'
  | 'long-rest'
  | 'concentration'
  | 'manual';

export interface ConditionDuration {
  kind: ConditionDurationKind;
  /** Remaining rounds; present (integer >= 1) only for the timed kinds. */
  rounds?: number;
}

/**
 * Death Saving Throw tally (Stage A5a). Each counter runs 0..3. `stable` means
 * the creature is at 0 HP and no longer makes Death Saving Throws (PHB 2024
 * "Stabilizing a Character", L1176-1177).
 */
export interface DeathSaveState {
  successes: number;
  failures: number;
  stable?: boolean;
}

/**
 * One entry in the ad-hoc Initiative roster (Stage A5c, decision D13): a flat
 * name plus Initiative count. No stat blocks and no HP for other combatants.
 * `isCharacter` marks the sheet owner's own entry.
 */
export interface Combatant {
  id: string;
  name: string;
  initiative: number;
  isCharacter?: boolean;
}

/**
 * The character's own turn economy (Stage A5c). `movementUsed` is in feet and
 * `dashes` counts Dash actions taken this turn. The tracker is advisory, so
 * these flags never block anything. PHB 2024 "Your Turn" (L880-909).
 */
export interface TurnState {
  actionUsed: boolean;
  bonusUsed: boolean;
  reactionUsed: boolean;
  objectInteractionUsed: boolean;
  movementUsed: number;
  dashes: number;
}

/**
 * An effect the player is tracking during a fight (for example Bless, Rage or a
 * spell's duration). Bookkeeping only: the app never applies what the effect
 * does. `rounds` is the REMAINING combat rounds; absent means no timer (it stays
 * until the player removes it). Additive-optional on Character; no version bump.
 */
export interface TrackedEffect {
  id: string;
  name: string;
  /** Remaining rounds (integer >= 1); absent = no timer. */
  rounds?: number;
  note?: string;
}

/** The combat tracker (Stage A5c). `combat` is absent when not in combat. */
export interface CombatState {
  inCombat: boolean;
  /** Round number, starting at 1. */
  round: number;
  /**
   * Highest round whose start already ticked the condition timers (Stage E
   * bookkeeping), so stepping back and forward over one boundary ticks once.
   * Optional and additive; absent means "the current round".
   */
  tickedThroughRound?: number;
  /** The character's own Initiative result for this fight (shown on the Combat page). */
  initiative?: number;
  /**
   * LEGACY (the retired initiative tracker): the roster, the active index and the
   * turn economy. Older saves may still carry them; nothing reads them now except
   * `turn.reactionUsed` (logic/reactions.ts, optional).
   */
  combatants?: Combatant[];
  activeIndex?: number;
  turn?: TurnState;
}

/**
 * Which inventory items a character currently has equipped (Stage A1).
 *
 * PHB 2024 "Armor: One at a Time" (Docs/PlayersHandbook.md L9638): a creature
 * can wear only one suit of armor and wield only one Shield at a time — hence a
 * single `armorItemId` and single `shieldItemId` rather than arrays. Weapons are
 * an array because a character can ready more than one (surfaced on the Combat
 * page in a later stage).
 *
 * Additive-optional on Character (no CURRENT_VERSION bump): absent = nothing
 * equipped, a valid prior state.
 */
export interface EquippedState {
  /** InventoryItem id worn as armour (0 or 1 suit — PHB "One at a Time"). */
  armorItemId?: string;
  /** InventoryItem id of the wielded shield (0 or 1 — PHB "One at a Time"). */
  shieldItemId?: string;
  /** InventoryItem ids of readied/wielded weapons. */
  weaponItemIds?: string[];
}

/**
 * One entry in the per-character advancement audit log (Stage A6a). Oldest-first;
 * the UI reverses for display. Deliberately NOT coupled to the Phase B7 unified
 * event log. `timestamp` doubles as the display key. See logic/advancement.ts
 * for the append helpers.
 */
export interface AdvancementLogEntry {
  /** Epoch milliseconds from an injected clock. */
  timestamp: number;
  kind: 'level-up' | 'hp' | 'subclass' | 'xp-award' | 'feat' | 'level-undo';
  /** The level the entry concerns, when relevant. */
  level?: number;
  /** Human-readable detail, e.g. 'Level 4: HP +8 (fixed)'. */
  detail: string;
  /** The XP awarded (xp-award entries only). */
  xpAmount?: number;
}

/**
 * A single level-up record (Stage A6a): the HP choice taken at that level. The
 * stored HP `value` is the Hit-Dice portion only (fixed = Hit Die/2+1, rolled =
 * the Hit Die face); the Constitution rider and the minimum-1 floor are applied
 * by the HP math (logic/hit-points.ts), so a later Con change still recomputes
 * the rider. Level 1 is never recorded (its HP is always the full Hit Die + Con,
 * no choice). PHB 2024 "Gaining a Level" (L2011-2016).
 */
export interface LevelUpRecord {
  /** The level this record is for (2..20). */
  level: number;
  /**
   * The class the level was gained in (PHB 2024 "Gaining a Level" / "Multiclassing:
   * Hit Points": the Hit Die is that class's). Absent on legacy records, which
   * are read as the initial class.
   */
  classId?: string;
  /** The HP choice taken this level. Absent = not recorded (HP as computed). */
  hp?: { mode: 'fixed' | 'rolled'; value: number };
}

/**
 * One feat (or Ability Score Improvement) a character has taken (Stage A6b).
 *
 * In 2024 the ASI IS a feat: at an asi-marker slot level you take the Ability
 * Score Improvement feat or any feat you qualify for (PHB 2024 "Ability Score
 * Improvement" L8558, "Gaining a Level" L2011). The ability increases a feat
 * grants are recorded here as TRACKED INCREASES and summed over the BASE
 * `abilities` by effectiveAbilityScores — the base scores are NEVER mutated, so
 * the creation value stays auditable and a feat can be removed cleanly (honours
 * the no-ASI guard in the class logic). Each increase is clamped under its
 * feat's cap (20 for General/ASI, 30 for Epic Boon).
 */
export interface FeatSelection {
  /** Catalog key into FEAT_CATALOG (data/feats.ts). */
  featId: FeatId;
  /** The asi-marker slot level this feat fills (validated against featSlots). */
  level: number;
  /**
   * For the ASI feat / any feat with an Ability Score Increase benefit: the
   * increases the player allocated, e.g. { str: 2 } or { dex: 1, con: 1 }.
   * Summed into the effective score; the base `abilities` is never mutated.
   */
  abilityIncreases?: Partial<Record<Ability, number>>;
  /** Feat-granted skill/expertise/tool choices, for auditability (A6b: simple grants). */
  choices?: { skills?: SkillId[]; expertise?: SkillId[]; tools?: string[]; notes?: string };
  /**
   * The class id whose Fighting Style feature granted this feat (Fighter,
   * Paladin, Ranger). Such a selection is stored at `level: 0` (no ASI slot).
   * Absent for ASI-slot and background feats.
   */
  grantedBy?: string;
}

/**
 * Advancement / level-up state (Stage A6a; feats added A6b). All fields
 * additive-optional: absent `advancement` (or any absent sub-field) means
 * milestone leveling with no per-level HP records, no feats, and HP computed as
 * today.
 */
export interface AdvancementState {
  /** Per-level HP choices, oldest level first (A6a). */
  levels?: LevelUpRecord[];
  /**
   * Feats / Ability Score Improvements taken, in the order chosen (A6b). The
   * order matters: effective-score caps are applied per increase cumulatively
   * in this order (an epic-boon increase can carry a total above 20). Each is
   * tied to an asi-marker slot level. PHB 2024 "Gaining a Level" / "Ability
   * Score Improvement". Additive-optional; no CURRENT_VERSION bump.
   */
  feats?: FeatSelection[];
  /** Leveling model + XP. Absent = milestone (the RAW-neutral default). */
  leveling?: { mode: 'milestone' | 'xp'; xp?: number };
  /** Minimal append-only audit trail, oldest-first (UI reverses). */
  log?: AdvancementLogEntry[];
}

// ── Stage B7: Unified event log + roll payload ───────────────────────────────
//
// The event log (`Character.eventLog`) is a per-character, append-only stream of
// structured `LogEvent` records, stored oldest-first and bounded by a cap. It is
// DISPLAY / AUDIT ONLY and is NEVER read to reconstruct mechanics (XP, HP,
// advancement) — those remain owned by their own authoritative structures.
// Ported near-verbatim from PWACharSheet's event log; only the category/type
// VALUES are D&D-specific. Additive-optional: absent/malformed ⇒ `[]` (no
// migration, no CURRENT_VERSION bump).

/**
 * Event categories surfaced in the unified log. `roll` is the only category
 * emitted this stage (roll mirror); `combat` and `advancement` are reserved for
 * the golden's filter cases and future mirrors. Extend additively.
 */
export type LogCategory = 'roll' | 'combat' | 'advancement';

/**
 * One structured event in the unified log. Stored oldest-first. `payload` is an
 * opaque display/audit bag — the log is never read back to drive mechanics.
 */
export interface LogEvent {
  /** Unique id (generateUUID). */
  id: string;
  /** Epoch milliseconds when the event was recorded. */
  timestamp: number;
  /** Top-level category used for filtering. */
  category: LogCategory;
  /** Finer-grained type string, e.g. 'roll.generic'. */
  type: string;
  /** Human-readable one-line summary for the timeline. */
  summary: string;
  /** Structured, display-only detail. */
  payload: Record<string, unknown>;
}

/**
 * The structured payload for a `category: 'roll'` event (d20-reshaped, NOT the
 * WFRP roll/target/SL shape). Mirrors a resolved d20 roll: the kept natural die,
 * the total (die + modifiers + exhaustion), the roll mode, an optional DC/AC,
 * and the derived flags. Nat-20 crit / nat-1 fumble are judged on `natural`, and
 * `passed` is `total >= dc` when a `dc` is given (PHB 2024 "D20 Tests").
 */
export interface RollEventPayload {
  /** What was rolled, e.g. 'Stealth' or 'Longsword attack'. */
  name: string;
  /** The total (die + modifiers + exhaustion). */
  total: number;
  /** The raw kept d20 face; nat-20/nat-1 are judged on this. */
  natural: number;
  /** How the d20 was rolled. */
  mode: D20Mode;
  /** Optional DC (ability/save) or target AC (attack). */
  dc?: number;
  /** natural === 20. */
  isCrit: boolean;
  /** natural === 1. */
  isFumble: boolean;
  /** total >= dc when a dc is given; undefined for a flat roll. */
  passed?: boolean;
}

/**
 * The current persisted-schema version. Bumped only on breaking changes.
 *
 * v2 (Stage M1 "Multiclassing"): the single `Character.class?: ClassSelection`
 * became `Character.classes?: ClassEntry[]`, and `SpellcastingState` moved the
 * flat per-class selections (cantrips/prepared/spellbook) under `byClass`.
 * `MIGRATIONS[1]` upgrades v1 records transparently (src/storage/migration.ts).
 */
export const CURRENT_VERSION = 3;

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
  /**
   * Classes the character has levels in (PHB 2024 "Multiclassing"). The first
   * entry (`classes[0]`) is the INITIAL class — it grants the full starting
   * proficiencies; later entries grant only the reduced multiclass subset. Order
   * is meaningful. Absent/empty = no class chosen (a valid state).
   *
   * `Character.level` stays the authoritative TOTAL character level; the sum of
   * the entry levels equals it. For a single-class character there is exactly
   * one entry whose level equals `Character.level`. Migrated from the
   * pre-Stage-M1 single `class?: ClassSelection` field (schema v1 → v2).
   */
  classes?: ClassEntry[];
  /**
   * Spellcasting selections & slot tracking. Absent = none (a valid state for
   * non-casters and un-chosen casters). Additive-optional: pre-Stage-8 records
   * without this field load unchanged (PHB 2024 Chapter 7 "Spellcasting").
   */
  spellcasting?: SpellcastingState;
  /**
   * Hit Dice spent on Short Rests (for HP recovery). Absent = none spent
   * (PHB 2024 "Short Rest": spend Hit Dice to regain HP).
   */
  hitDiceSpent?: number;
  /**
   * Per-use resource tracking (D1): uses SPENT per tracker, keyed by tracker id
   * (`<classId>.<pool>`, `feat:<featId>.<pool>`, `warlock.invocation-<id>`; see
   * logic/resources.ts). Same convention as `hitDiceSpent`: the value is the
   * number spent, remaining = max - spent (the max is derived from level,
   * ability scores and data, never stored). Absent / missing key = nothing
   * spent. Additive-optional: no CURRENT_VERSION bump, no migration; not in
   * BLANK_CHARACTER. Ids of features the character no longer has are ignored
   * when read and kept in storage.
   */
  resourcesSpent?: Record<string, number>;
  /**
   * Permanent creature companions, including mounts and pack animals
   * (Companions page, Creatures tab). Not in BLANK_CHARACTER. Sanitized on
   * import and share (logic/companions-sanitize.ts). The former `mounts` list
   * was folded in here by the v2 -> v3 migration. Temporary summons are
   * deliberately not tracked.
   */
  companions?: CompanionRecord[];
  /** Hirelings (Companions page). Additive-optional; no `_v` bump. */
  hirelings?: HirelingRecord[];
  /** NPC party members (Companions page). Additive-optional; no `_v` bump. */
  npcPartyMembers?: NpcPartyMemberRecord[];
  /** Tasha's sidekicks (Companions page, house rule). Additive-optional; no `_v` bump. */
  sidekicks?: SidekickRecord[];
  /**
   * Party-wide Loyalty maximum override, an integer 0-20 (DMG 2024 L3578). Absent
   * = this character's Charisma score. Additive-optional; no `_v` bump.
   */
  loyaltyMaxOverride?: number;
  /**
   * Heroic Inspiration (PHB 2024 "Heroic Inspiration", Docs/PlayersHandbook.md
   * L498-501): a character either has it or not (never more than one). Absent =
   * false. Set manually from the Overview only (the DM awards it); never changed
   * automatically. Additive-optional; no _v bump.
   */
  heroicInspiration?: boolean;
  /**
   * The rolled HP maximum when the rolledHp house rule is in effect. Absent
   * means the fixed-value HP max is used (PHB 2024 "Hit Points").
   */
  rolledHpTotal?: number;
  /** Opt-in house rules; absent = rules-as-written. */
  houseRules?: HouseRules;

  /**
   * Carried items (Stage A1). Absent = empty inventory, a valid state.
   * Additive-optional: pre-A1 records without this field load unchanged (same
   * convention as the `species`/`class`/`spellcasting` optional fields). No
   * CURRENT_VERSION bump and no migration (PHB 2024 Chapter 6 "Equipment").
   */
  inventory?: InventoryItem[];
  /**
   * Which inventory items are currently equipped (Stage A1). Absent = nothing
   * equipped, a valid state. Additive-optional; no CURRENT_VERSION bump.
   */
  equipped?: EquippedState;
  /**
   * The carried coin purse in the five PHB denominations (Stage A3). Absent =
   * no coins carried (ZERO_CURRENCY), a valid state. Additive-optional: pre-A3
   * records without this field load unchanged, so there is no CURRENT_VERSION
   * bump and no migration (same convention as `inventory`/`equipped` above).
   * PHB 2024 "Coins" (Docs/PlayersHandbook.md L9247-9272).
   */
  coins?: CurrencyAmount;
  /**
   * Active non-Exhaustion conditions (Stage A4). Absent or empty = none, a
   * valid state. Additive-optional: no CURRENT_VERSION bump, no migration.
   * Exhaustion is tracked separately in `exhaustionLevel`. PHB 2024
   * "Conditions" (Docs/PlayersHandbook.md L1197-1216).
   */
  conditions?: ActiveCondition[];
  /**
   * Exhaustion level, 0..6 (Stage A4). Absent or 0 = none. Additive-optional;
   * no `_v` bump. PHB 2024 "Exhaustion" (Docs/PlayersHandbook.md L21018-21028).
   */
  exhaustionLevel?: number;
  /**
   * Current Hit Points (Stage A5a). Absent = "at Hit Point maximum" and follows
   * the maximum as it changes; an explicit 0 is a real value. Written back to
   * absent when it equals the maximum. Additive-optional; no `_v` bump. PHB
   * 2024 "Hit Points" (Docs/PlayersHandbook.md L1073-1079).
   */
  currentHp?: number;
  /**
   * Temporary Hit Points (Stage A5a). Absent = 0. They are not Hit Points and
   * do not stack. Additive-optional; no `_v` bump. PHB 2024 "Temporary Hit
   * Points" (L1179-1193).
   */
  tempHp?: number;
  /**
   * Death Saving Throw tally and Stable flag (Stage A5a). Absent = 0 successes,
   * 0 failures, not Stable. Cleared when Hit Points are regained or on Stable.
   * Additive-optional; no `_v` bump. PHB 2024 "Death Saving Throws" (L1155-1177).
   */
  deathSaves?: DeathSaveState;
  /**
   * Explicit death flag (Stage A5a), set by a third death-save failure or
   * instant death. Absent = not dead. Exhaustion level 6 and a Hit Point maximum
   * of 0 are derived as dead and never write this flag. Additive-optional.
   */
  dead?: boolean;
  /**
   * The spell the character is concentrating on (Stage A5b). Absent = not
   * concentrating. Additive-optional; no `_v` bump. PHB 2024 "Concentration"
   * (Docs/PlayersHandbook.md L20767-20777).
   */
  concentration?: { spellId: SpellId };
  /**
   * When the character last finished a Long Rest, epoch milliseconds from an
   * injected clock (Stage A5b, decision D5). Used only for the advisory
   * 16-hour wait; it never blocks a rest. Additive-optional; no `_v` bump.
   * PHB 2024 "Long Rest" (L21243).
   */
  lastLongRestAt?: number;
  /**
   * The combat tracker (Stage A5c). Absent = not in combat; ending combat removes
   * the field. Additive-optional; no `_v` bump. PHB 2024 "Initiative" and "Your
   * Turn" (Docs/PlayersHandbook.md L870-909).
   */
  /** Effects the player is tracking in a fight (see TrackedEffect). */
  effects?: TrackedEffect[];
  combat?: CombatState;
  /**
   * The weapon kinds (weapon catalog ids, e.g. 'longsword') whose Weapon Mastery
   * property the character has chosen (Stage A5d, decision D8). The list is capped
   * by the class's Weapon Mastery count at the current level; if the level drops so
   * the list exceeds the cap it is kept, never silently deleted. Absent = none
   * chosen. Additive-optional; no `_v` bump. PHB 2024 "Mastery Properties" (L9351)
   * and the Barbarian, Fighter, Paladin, Ranger and Rogue "Weapon Mastery" features.
   */
  weaponMasteries?: string[];
  /**
   * Advancement / level-up state (Stage A6a): per-level HP choices, the
   * leveling mode + XP, and a minimal audit log. Absent = milestone leveling,
   * no per-level records, HP computed as today (a valid prior state).
   * Additive-optional; no CURRENT_VERSION bump and no migration (same
   * convention as the other Stage-A fields). PHB 2024 "Gaining a Level".
   */
  advancement?: AdvancementState;
  /**
   * Class-feature CHOICES (Metamagic, Eldritch Invocations, Maneuvers, Divine /
   * Primal Order, ...): the chosen option ids per choice group. Absent = nothing
   * chosen. Additive-optional; no CURRENT_VERSION bump and no migration (same
   * convention as `weaponMasteries` / `languages`). Counts owed come from
   * logic/class-choices.ts; over-allocation is a warning, never a block.
   */
  classChoices?: ClassChoices;

  // ── Stage 7: Personal Details (identity / roleplay) ────────────────────────
  // Additive-optional, free-text identity fields. NONE is a game mechanic or
  // feeds a derived value, so there is no CURRENT_VERSION bump and no migration
  // (same convention as the Stage-3 `species` / Stage-4 `class` optional fields
  // above). A record lacking any of these loads unchanged.
  //
  // `name` already exists above and remains the single identity name — there is
  // deliberately NO second name field here.

  /** Alignment — a PHB 2024 nine-alignment label or "Unaligned" (descriptive, not a mechanic). */
  alignment?: Alignment;
  /**
   * Faith / patron deity (free text; no mechanic here). The DMG 2024 "Gods of
   * Greyhawk" catalog (src/data/deities.ts) powers a suggestion list for this
   * field, but the stored value stays free text so homebrew / other-setting
   * deities are still allowed.
   */
  faith?: string;
  /** Age (free text — species lifespans vary; no validation). */
  age?: string;
  /** Height (free text). */
  height?: string;
  /** Weight (free text). */
  weight?: string;
  /** Eye colour (free text). */
  eyes?: string;
  /** Hair (free text). */
  hair?: string;
  /** Skin (free text). */
  skin?: string;
  /**
   * Background — FREE TEXT / notes only this stage. The 2024 Background
   * MECHANICS (ability-score increases, skill & tool proficiencies, origin feat
   * — PHB 2024 "Backgrounds") are a LATER stage and are deliberately NOT
   * modelled here.
   */
  background?: string;
  /** Free-text personality notes, rendered as a multiline textarea. */
  personality?: string;

  // ── Stage A7: Character Creation (background / languages / generation) ─────
  // Additive-optional, no CURRENT_VERSION bump: absent = a valid prior state
  // (same convention as the Stage-3 `species` / Stage-4 `class` fields). The
  // free-text `background?: string` above stays for display/notes; the
  // STRUCTURED selection below uses a DIFFERENT field name so there is no
  // breaking type change. PHB 2024 "Parts of a Background" / "Choose Languages".

  /**
   * Structured 2024 background selection (distinct from the free-text
   * `background` above). Records the chosen ability allocation (applied through
   * the A6b effective-score layer as a FeatSelection, so base `abilities` is
   * never mutated), the resolved tool proficiency, and the equipment choice.
   * PHB 2024 "Parts of a Background" (L7806-7820). Absent = no structured
   * background chosen.
   */
  backgroundSelection?: {
    id: BackgroundId;
    /** The chosen +2/+1 or +1/+1/+1 split across the background's three abilities. */
    abilities?: { ability: Ability; amount: number }[];
    /** The resolved tool proficiency (a specific tool id after any category choice). */
    toolProficiency?: string;
    /** Equipment option: 'A' = the package, 'B' = 50 GP. PHB 2024 L7820. */
    equipmentChoice?: 'A' | 'B';
  };
  /**
   * Chosen additional languages. Common is always known implicitly and is never
   * stored here (resolveLanguages prepends it). 2024 species grant no fixed
   * languages (PHB 2024 "Choose Languages", L1294). Absent = only Common.
   *
   * `granted` holds the player's "choose N" picks from base-class features that
   * grant languages (Rogue L1 "Thieves' Cant" → choose 1; Ranger L2 "Deft
   * Explorer" → choose 2 — PHB 2024). These are ADDITIONAL to the creation
   * `chosen` two and are stored separately so the creation cap and the feature
   * cap stay independent. Fixed auto-grants (e.g. Thieves' Cant itself) are NOT
   * stored here — they are derived from the class (see featureLanguageGrants).
   * Additive-optional; no CURRENT_VERSION bump — absent = today's behaviour.
   */
  languages?: { chosen: string[]; granted?: string[] };
  /**
   * Gender used to drive name/appearance generation and shown under Personal
   * Details. Absent = unset. No mechanic (rules-compliance).
   */
  gender?: 'male' | 'female' | 'neutral';
  /**
   * Which ability-score generation method was used (optional audit of creation;
   * PHB 2024 "Step 3: Determine Ability Scores" L1666-1726). Absent = unrecorded.
   */
  abilityGenMethod?: 'standard-array' | 'point-buy' | 'roll';
  /**
   * Optional audit of the generation inputs — the rolled/assigned scores, for
   * review. No mechanic; informational only. Absent = unrecorded.
   */
  abilityGenRecord?: { scores?: number[] };

  /**
   * Stage B7 unified event log (per-character, append-only, oldest-first,
   * bounded). DISPLAY / AUDIT ONLY — never read to reconstruct mechanics. Absent
   * or malformed persisted logs normalise to `[]` (see normaliseEventLog).
   * Additive-optional; no CURRENT_VERSION bump and no migration (same convention
   * as the other optional Stage-A/B fields above).
   */
  eventLog?: LogEvent[];

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
