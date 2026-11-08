/**
 * GOLDEN FIXTURE for the feat catalog (Stage 1 of the level-up gap work).
 *
 * Authored ONLY from the PHB 2024 (Docs/PlayersHandbook.md, Chapter 5 "Feats",
 * Feat List table + each feat's description). It is independent of
 * src/data/feats.ts: only TYPES from the app are imported (never values), so a
 * drift in the catalog fails the oracle instead of silently updating this file.
 *
 * LINE NUMBERS are 1-based lines of the feat's `## NAME` heading as counted by
 * PowerShell `Get-Content` (the grep tool numbers the same file about 1 higher
 * in places because of stray control characters in the OCR text).
 *
 * ── PHB feat list (Feat List table, PHB ~L8372-8452) ────────────────────────
 * 75 feats: 10 Origin, 43 General, 10 Fighting Style, 12 Epic Boon.
 * Repeatable ('*' in the table): Ability Score Improvement, Elemental Adept,
 * Magic Initiate, Skilled. (Resilient is NOT repeatable.)
 *
 * ── VARIANT MAPPING (catalog records vs PHB feats) ──────────────────────────
 * The PHB prints Magic Initiate as ONE repeatable Origin feat whose spell list
 * (Cleric, Druid or Wizard) is chosen when taken, a different list each time
 * it is repeated (L8506). The existing catalog models it as THREE per-variant
 * records, `magic-initiate-cleric|druid|wizard`, each non-repeatable on its
 * own id (repeating = taking a DIFFERENT variant). So the catalog holds
 * 75 - 1 + 3 = 77 records: 12 Origin, 43 General, 10 Fighting Style, 12 Epic
 * Boon. Every other feat is ONE record (Resilient, Elemental Adept, Weapon
 * Master, Fey-Touched ... keep their choice in FeatSelection.choices, not in
 * the id). See GOLDEN_VARIANT_MAP / expandGoldenRecords().
 *
 * ── INTENDED RECORD SHAPE (what the oracle expects of src/data/feats.ts) ────
 * Beyond today's FeatData (id, name, category, prerequisite.minLevel/
 * abilityMin, repeatable, abilityIncrease, grants), the oracle expects:
 *  - prerequisite.abilityAnyOf?: { abilities: Ability[]; min: number }
 *      ("Strength or Dexterity 13+"; abilityMin stays ALL-OF, for one ability).
 *  - prerequisite.armorTraining?: 'light'|'medium'|'heavy'|'shield'
 *  - prerequisite.spellcasting?: 'spellcasting-or-pact-magic' | 'spellcasting'
 *  - prerequisite.fightingStyleFeature?: true
 *  - abilityIncrease: { kind:'fixed', ability, amount:1, max:20 }
 *                   | { kind:'choose-one', abilities: Ability[], amount:1, max:20 }
 *                   | { kind:'epic-boon', abilities: Ability[], amount:1, max:30 }
 *                   | { kind:'asi' }
 *    (choose-one / epic-boon now carry the ALLOWED abilities.)
 *  - mechanics: GoldenMechanics (below), a structured, prose-free summary.
 */
import type { Ability } from '../../types/character';

export type GoldenCategory = 'origin' | 'general' | 'fighting-style' | 'epic-boon';
export type GoldenArmorTraining = 'light' | 'medium' | 'heavy' | 'shield';

export interface GoldenPrereq {
  minLevel?: number;
  /** Single-ability minimum (all-of semantics). */
  abilityMin?: Partial<Record<Ability, number>>;
  /** "A or B 13+": at least one listed ability must reach `min`. */
  abilityAnyOf?: { abilities: Ability[]; min: number };
  armorTraining?: GoldenArmorTraining;
  /** 'spellcasting-or-pact-magic' = "Spellcasting or Pact Magic Feature"; 'spellcasting' = "Spellcasting Feature". */
  spellcasting?: 'spellcasting-or-pact-magic' | 'spellcasting';
  fightingStyleFeature?: true;
}

export type GoldenAbilityIncrease =
  | null
  | { kind: 'asi' }
  | { kind: 'fixed'; ability: Ability; amount: 1; max: 20 }
  | { kind: 'choose-one'; abilities: Ability[]; amount: 1; max: 20 }
  | { kind: 'epic-boon'; abilities: Ability[]; amount: 1; max: 30 };

/** A player choice other than the skill/tool COUNTS held in `grants`. */
export interface GoldenChoice {
  key: string;
  /** A number, or 'proficiency-bonus' (Ritual Caster). */
  count: number | 'proficiency-bonus';
  /** The allowed options (sorted), or a symbolic source tag. */
  from: string[] | string;
}

export interface GoldenMechanics {
  grants: {
    /** Free-choice skill proficiencies. */
    skills: number;
    /** Free-choice tool / instrument proficiencies. */
    tools: number;
    /** Picks that may each be a skill OR a tool (Skilled). */
    skillsOrTools: number;
    /** Expertise picks the feat itself grants. */
    expertise: number;
    /** Resilient: gain save proficiency in the chosen ability. */
    saveProficiencyChoice: boolean;
    /** Boon of Skill: proficiency in ALL skills. */
    allSkills: boolean;
  };
  /** Restriction on the free-choice tool picks, when any. */
  toolsFrom?: 'artisan-tools-fast-crafting' | 'musical-instruments';
  /** Fixed, non-choice grants (sorted): proficiencies, spells, senses, speed... */
  fixed: string[];
  /** Other choices, sorted by key. */
  choices: GoldenChoice[];
}

export interface GoldenFeat {
  id: string;
  name: string;
  category: GoldenCategory;
  /** PHB heading line (see header note). */
  line: number;
  /** undefined = no prerequisite (Origin feats). */
  prerequisite?: GoldenPrereq;
  repeatable: boolean;
  abilityIncrease: GoldenAbilityIncrease;
  mechanics: GoldenMechanics;
}

// ─── builders ────────────────────────────────────────────────────────────────

const STR_DEX: Ability[] = ['str', 'dex'];
const INT_WIS_CHA: Ability[] = ['int', 'wis', 'cha'];
const ALL_SIX: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function mech(
  grants: Partial<GoldenMechanics['grants']> = {},
  rest: Partial<Omit<GoldenMechanics, 'grants'>> = {},
): GoldenMechanics {
  return {
    grants: {
      skills: 0,
      tools: 0,
      skillsOrTools: 0,
      expertise: 0,
      saveProficiencyChoice: false,
      allSkills: false,
      ...grants,
    },
    ...(rest.toolsFrom ? { toolsFrom: rest.toolsFrom } : {}),
    fixed: [...(rest.fixed ?? [])].sort(),
    choices: [...(rest.choices ?? [])].sort((a, b) => a.key.localeCompare(b.key)),
  };
}

const L4: GoldenPrereq = { minLevel: 4 };
const L19: GoldenPrereq = { minLevel: 19 };
const FS: GoldenPrereq = { fightingStyleFeature: true };
const anyOf = (abilities: Ability[], min = 13): GoldenPrereq => ({
  minLevel: 4,
  abilityAnyOf: { abilities, min },
});
const choose = (abilities: Ability[]): GoldenAbilityIncrease => ({
  kind: 'choose-one',
  abilities,
  amount: 1,
  max: 20,
});
const fixedInc = (ability: Ability): GoldenAbilityIncrease => ({
  kind: 'fixed',
  ability,
  amount: 1,
  max: 20,
});
const boon = (abilities: Ability[] = ALL_SIX): GoldenAbilityIncrease => ({
  kind: 'epic-boon',
  abilities,
  amount: 1,
  max: 30,
});

function feat(
  id: string,
  name: string,
  category: GoldenCategory,
  line: number,
  o: {
    prerequisite?: GoldenPrereq;
    repeatable?: boolean;
    abilityIncrease?: GoldenAbilityIncrease;
    mechanics?: GoldenMechanics;
  } = {},
): GoldenFeat {
  return {
    id,
    name,
    category,
    line,
    ...(o.prerequisite ? { prerequisite: o.prerequisite } : {}),
    repeatable: o.repeatable ?? false,
    abilityIncrease: o.abilityIncrease ?? null,
    mechanics: o.mechanics ?? mech(),
  };
}

// ─── Origin feats (PHB L8454+). No prerequisite, no ability increase. ────────

const ORIGIN: GoldenFeat[] = [
  feat('alert', 'Alert', 'origin', 8458, {
    mechanics: mech({}, { fixed: ['initiative:+proficiency-bonus'] }),
  }),
  feat('crafter', 'Crafter', 'origin', 8468, {
    // Three DIFFERENT Artisan's Tools from the Fast Crafting table (8 tools).
    mechanics: mech({ tools: 3 }, { toolsFrom: 'artisan-tools-fast-crafting' }),
  }),
  feat('healer', 'Healer', 'origin', 8488),
  feat('lucky', 'Lucky', 'origin', 8496),
  // magic-initiate: see GOLDEN_VARIANT_MAP (three per-variant catalog records).
  feat('musician', 'Musician', 'origin', 8520, {
    mechanics: mech({ tools: 3 }, { toolsFrom: 'musical-instruments' }),
  }),
  feat('savage-attacker', 'Savage Attacker', 'origin', 8528),
  feat('skilled', 'Skilled', 'origin', 8532, {
    // Any combination of THREE skills or tools; repeatable.
    repeatable: true,
    mechanics: mech({ skillsOrTools: 3 }),
  }),
  feat('tavern-brawler', 'Tavern Brawler', 'origin', 8538, {
    mechanics: mech({}, { fixed: ['weapon-proficiency:improvised'] }),
  }),
  feat('tough', 'Tough', 'origin', 8550, {
    mechanics: mech({}, { fixed: ['hp-max:+2-per-level'] }),
  }),
];

/** The PHB's single Magic Initiate entry (L8506) and how it maps to catalog ids. */
export const GOLDEN_MAGIC_INITIATE = {
  name: 'Magic Initiate',
  category: 'origin' as const,
  line: 8506,
  /** PHB: repeatable, but a different spell list each time. */
  repeatable: true,
  prerequisite: undefined,
  abilityIncrease: null as GoldenAbilityIncrease,
  lists: ['cleric', 'druid', 'wizard'] as const,
};

/** Per-variant mechanics: 2 cantrips + one level-1 spell from the list; ability Int/Wis/Cha. */
function magicInitiateVariant(list: 'cleric' | 'druid' | 'wizard'): GoldenFeat {
  const source = `spell-list:${list}`;
  return {
    id: `magic-initiate-${list}`,
    name: `Magic Initiate (${list.charAt(0).toUpperCase()}${list.slice(1)})`,
    category: 'origin',
    line: GOLDEN_MAGIC_INITIATE.line,
    // Each variant id is non-repeatable; repeating the PHB feat = another variant.
    repeatable: false,
    abilityIncrease: null,
    mechanics: mech(
      {},
      {
        choices: [
          { key: 'cantrip', count: 2, from: source },
          { key: 'level-1-spell', count: 1, from: source },
          { key: 'spellcasting-ability', count: 1, from: ['int', 'wis', 'cha'] },
        ],
      },
    ),
  };
}

export const GOLDEN_VARIANT_MAP: Record<string, string[]> = {
  'Magic Initiate': ['magic-initiate-cleric', 'magic-initiate-druid', 'magic-initiate-wizard'],
};

// ─── General feats (PHB L8554+). All "Level 4+". ─────────────────────────────

const GENERAL: GoldenFeat[] = [
  feat('ability-score-improvement', 'Ability Score Improvement', 'general', 8558, {
    prerequisite: L4,
    repeatable: true,
    abilityIncrease: { kind: 'asi' },
  }),
  feat('actor', 'Actor', 'general', 8564, {
    prerequisite: { minLevel: 4, abilityMin: { cha: 13 } },
    abilityIncrease: fixedInc('cha'),
  }),
  feat('athlete', 'Athlete', 'general', 8576, {
    prerequisite: anyOf(STR_DEX),
    abilityIncrease: choose(STR_DEX),
    mechanics: mech({}, { fixed: ['speed:climb-equals-speed'] }),
  }),
  feat('charger', 'Charger', 'general', 8592, {
    prerequisite: anyOf(STR_DEX),
    abilityIncrease: choose(STR_DEX),
  }),
  feat('chef', 'Chef', 'general', 8604, {
    prerequisite: L4,
    abilityIncrease: choose(['con', 'wis']),
    mechanics: mech({}, { fixed: ['tool-proficiency:cooks-utensils'] }),
  }),
  feat('crossbow-expert', 'Crossbow Expert', 'general', 8618, {
    prerequisite: { minLevel: 4, abilityMin: { dex: 13 } },
    abilityIncrease: fixedInc('dex'),
  }),
  feat('crusher', 'Crusher', 'general', 8632, {
    prerequisite: L4,
    abilityIncrease: choose(['str', 'con']),
  }),
  feat('defensive-duelist', 'Defensive Duelist', 'general', 8644, {
    prerequisite: { minLevel: 4, abilityMin: { dex: 13 } },
    abilityIncrease: fixedInc('dex'),
  }),
  feat('dual-wielder', 'Dual Wielder', 'general', 8654, {
    prerequisite: anyOf(STR_DEX),
    abilityIncrease: choose(STR_DEX),
  }),
  feat('durable', 'Durable', 'general', 8666, {
    prerequisite: L4,
    abilityIncrease: fixedInc('con'),
  }),
  feat('elemental-adept', 'Elemental Adept', 'general', 8678, {
    prerequisite: { minLevel: 4, spellcasting: 'spellcasting-or-pact-magic' },
    repeatable: true, // a different damage type each time
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech(
      {},
      {
        choices: [
          { key: 'damage-type', count: 1, from: ['acid', 'cold', 'fire', 'lightning', 'thunder'] },
        ],
      },
    ),
  }),
  feat('fey-touched', 'Fey-Touched', 'general', 8690, {
    prerequisite: L4,
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech(
      {},
      {
        fixed: ['spell:misty-step'],
        choices: [{ key: 'level-1-spell', count: 1, from: ['divination', 'enchantment'] }],
      },
    ),
  }),
  feat('grappler', 'Grappler', 'general', 8700, {
    prerequisite: anyOf(STR_DEX),
    abilityIncrease: choose(STR_DEX),
  }),
  feat('great-weapon-master', 'Great Weapon Master', 'general', 8714, {
    prerequisite: { minLevel: 4, abilityMin: { str: 13 } },
    abilityIncrease: fixedInc('str'),
  }),
  feat('heavily-armored', 'Heavily Armored', 'general', 8728, {
    prerequisite: { minLevel: 4, armorTraining: 'medium' },
    abilityIncrease: choose(['con', 'str']),
    mechanics: mech({}, { fixed: ['armor-training:heavy'] }),
  }),
  feat('heavy-armor-master', 'Heavy Armor Master', 'general', 8738, {
    prerequisite: { minLevel: 4, armorTraining: 'heavy' },
    abilityIncrease: choose(['con', 'str']),
  }),
  feat('inspiring-leader', 'Inspiring Leader', 'general', 8748, {
    prerequisite: anyOf(['wis', 'cha']),
    abilityIncrease: choose(['wis', 'cha']),
  }),
  feat('keen-mind', 'Keen Mind', 'general', 8758, {
    prerequisite: { minLevel: 4, abilityMin: { int: 13 } },
    abilityIncrease: fixedInc('int'),
    mechanics: mech(
      {},
      {
        // Proficiency if lacking, else Expertise (not a free Expertise pick).
        choices: [
          {
            key: 'skill-proficiency-or-expertise',
            count: 1,
            from: ['arcana', 'history', 'investigation', 'nature', 'religion'],
          },
        ],
      },
    ),
  }),
  feat('lightly-armored', 'Lightly Armored', 'general', 8768, {
    prerequisite: L4, // PHB prints only "Level 4+" here
    abilityIncrease: choose(STR_DEX),
    mechanics: mech({}, { fixed: ['armor-training:light', 'armor-training:shield'] }),
  }),
  feat('mage-slayer', 'Mage Slayer', 'general', 8776, {
    prerequisite: L4, // PHB (this OCR) prints only "Level 4+"; see ambiguity notes
    abilityIncrease: choose(STR_DEX),
  }),
  feat('martial-weapon-training', 'Martial Weapon Training', 'general', 8786, {
    prerequisite: L4,
    abilityIncrease: choose(STR_DEX),
    mechanics: mech({}, { fixed: ['weapon-proficiency:martial'] }),
  }),
  feat('medium-armor-master', 'Medium Armor Master', 'general', 8796, {
    prerequisite: { minLevel: 4, armorTraining: 'medium' },
    abilityIncrease: choose(STR_DEX),
    mechanics: mech({}, { fixed: ['ac:medium-armor-plus-3-if-dex-16-plus'] }),
  }),
  feat('moderately-armored', 'Moderately Armored', 'general', 8806, {
    prerequisite: { minLevel: 4, armorTraining: 'light' },
    abilityIncrease: choose(STR_DEX),
    mechanics: mech({}, { fixed: ['armor-training:medium'] }),
  }),
  feat('mounted-combatant', 'Mounted Combatant', 'general', 8816, {
    prerequisite: L4,
    abilityIncrease: choose(['str', 'dex', 'wis']),
  }),
  feat('observant', 'Observant', 'general', 8828, {
    prerequisite: anyOf(['int', 'wis']),
    abilityIncrease: choose(['int', 'wis']),
    mechanics: mech(
      {},
      {
        choices: [
          {
            key: 'skill-proficiency-or-expertise',
            count: 1,
            from: ['insight', 'investigation', 'perception'],
          },
        ],
      },
    ),
  }),
  feat('piercer', 'Piercer', 'general', 8840, {
    prerequisite: L4,
    abilityIncrease: choose(STR_DEX),
  }),
  feat('poisoner', 'Poisoner', 'general', 8852, {
    prerequisite: L4,
    abilityIncrease: choose(['dex', 'int']),
    mechanics: mech({}, { fixed: ['tool-proficiency:poisoners-kit'] }),
  }),
  feat('polearm-master', 'Polearm Master', 'general', 8862, {
    prerequisite: anyOf(STR_DEX),
    abilityIncrease: choose(STR_DEX),
  }),
  feat('resilient', 'Resilient', 'general', 8874, {
    prerequisite: L4,
    // Any ability in which you LACK save proficiency (all six are candidates).
    abilityIncrease: choose(ALL_SIX),
    mechanics: mech({ saveProficiencyChoice: true }),
  }),
  feat('ritual-caster', 'Ritual Caster', 'general', 8884, {
    prerequisite: anyOf(INT_WIS_CHA),
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech(
      {},
      {
        choices: [{ key: 'ritual-spell-level-1', count: 'proficiency-bonus', from: 'tag:ritual' }],
      },
    ),
  }),
  feat('sentinel', 'Sentinel', 'general', 8902, {
    prerequisite: anyOf(STR_DEX),
    abilityIncrease: choose(STR_DEX),
  }),
  feat('shadow-touched', 'Shadow-Touched', 'general', 8914, {
    prerequisite: L4,
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech(
      {},
      {
        fixed: ['spell:invisibility'],
        choices: [{ key: 'level-1-spell', count: 1, from: ['illusion', 'necromancy'] }],
      },
    ),
  }),
  feat('sharpshooter', 'Sharpshooter', 'general', 8924, {
    prerequisite: { minLevel: 4, abilityMin: { dex: 13 } },
    abilityIncrease: fixedInc('dex'),
  }),
  feat('shield-master', 'Shield Master', 'general', 8938, {
    prerequisite: { minLevel: 4, armorTraining: 'shield' },
    abilityIncrease: fixedInc('str'),
  }),
  feat('skill-expert', 'Skill Expert', 'general', 8950, {
    prerequisite: L4,
    abilityIncrease: choose(ALL_SIX),
    // One new skill proficiency AND one Expertise (in a proficient skill lacking it).
    mechanics: mech({ skills: 1, expertise: 1 }),
  }),
  feat('skulker', 'Skulker', 'general', 8962, {
    prerequisite: { minLevel: 4, abilityMin: { dex: 13 } },
    abilityIncrease: fixedInc('dex'),
    mechanics: mech({}, { fixed: ['sense:blindsight-10'] }),
  }),
  feat('slasher', 'Slasher', 'general', 8976, {
    prerequisite: L4,
    abilityIncrease: choose(STR_DEX),
  }),
  feat('speedy', 'Speedy', 'general', 8988, {
    prerequisite: anyOf(['dex', 'con']),
    abilityIncrease: choose(['dex', 'con']),
    mechanics: mech({}, { fixed: ['speed:+10'] }),
  }),
  feat('spell-sniper', 'Spell Sniper', 'general', 9002, {
    prerequisite: { minLevel: 4, spellcasting: 'spellcasting-or-pact-magic' },
    abilityIncrease: choose(INT_WIS_CHA),
  }),
  feat('telekinetic', 'Telekinetic', 'general', 9016, {
    prerequisite: L4,
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech({}, { fixed: ['spell:mage-hand'] }),
  }),
  feat('telepathic', 'Telepathic', 'general', 9028, {
    prerequisite: L4,
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech({}, { fixed: ['spell:detect-thoughts'] }),
  }),
  feat('war-caster', 'War Caster', 'general', 9042, {
    prerequisite: { minLevel: 4, spellcasting: 'spellcasting-or-pact-magic' },
    abilityIncrease: choose(INT_WIS_CHA),
  }),
  feat('weapon-master', 'Weapon Master', 'general', 9056, {
    prerequisite: L4,
    abilityIncrease: choose(STR_DEX),
    mechanics: mech(
      {},
      {
        choices: [{ key: 'weapon-mastery-kind', count: 1, from: 'proficient-simple-or-martial' }],
      },
    ),
  }),
];

// ─── Fighting Style feats (PHB L9064+). Prereq: Fighting Style feature. ──────

const FIGHTING_STYLE: GoldenFeat[] = [
  feat('archery', 'Archery', 'fighting-style', 9068, {
    prerequisite: FS,
    mechanics: mech({}, { fixed: ['attack-bonus:+2-ranged'] }),
  }),
  feat('blind-fighting', 'Blind Fighting', 'fighting-style', 9072, {
    prerequisite: FS,
    mechanics: mech({}, { fixed: ['sense:blindsight-10'] }),
  }),
  feat('defense', 'Defense', 'fighting-style', 9076, {
    prerequisite: FS,
    mechanics: mech({}, { fixed: ['ac:+1-while-wearing-light-medium-or-heavy-armor'] }),
  }),
  feat('dueling', 'Dueling', 'fighting-style', 9082, {
    prerequisite: FS,
    mechanics: mech({}, { fixed: ['damage:+2-one-handed-melee'] }),
  }),
  feat('great-weapon-fighting', 'Great Weapon Fighting', 'fighting-style', 9088, { prerequisite: FS }),
  feat('interception', 'Interception', 'fighting-style', 9092, { prerequisite: FS }),
  feat('protection', 'Protection', 'fighting-style', 9096, { prerequisite: FS }),
  feat('thrown-weapon-fighting', 'Thrown Weapon Fighting', 'fighting-style', 9104, {
    prerequisite: FS,
    mechanics: mech({}, { fixed: ['damage:+2-thrown-ranged'] }),
  }),
  feat('two-weapon-fighting', 'Two-Weapon Fighting', 'fighting-style', 9110, { prerequisite: FS }),
  feat('unarmed-fighting', 'Unarmed Fighting', 'fighting-style', 9116, { prerequisite: FS }),
];

// ─── Epic Boon feats (PHB L9124+). Level 19+; +1 to one ability, max 30. ─────

const EPIC_BOON: GoldenFeat[] = [
  feat('boon-of-combat-prowess', 'Boon of Combat Prowess', 'epic-boon', 9130, {
    prerequisite: L19,
    abilityIncrease: boon(),
  }),
  feat('boon-of-dimensional-travel', 'Boon of Dimensional Travel', 'epic-boon', 9142, {
    prerequisite: L19,
    abilityIncrease: boon(),
  }),
  feat('boon-of-energy-resistance', 'Boon of Energy Resistance', 'epic-boon', 9152, {
    prerequisite: L19,
    abilityIncrease: boon(),
    // Two damage types, re-choosable after each Long Rest.
    mechanics: mech(
      {},
      {
        choices: [
          {
            key: 'resistance-type',
            count: 2,
            from: [
              'acid',
              'cold',
              'fire',
              'lightning',
              'necrotic',
              'poison',
              'psychic',
              'radiant',
              'thunder',
            ],
          },
        ],
      },
    ),
  }),
  feat('boon-of-fate', 'Boon of Fate', 'epic-boon', 9164, { prerequisite: L19, abilityIncrease: boon() }),
  feat('boon-of-fortitude', 'Boon of Fortitude', 'epic-boon', 9172, {
    prerequisite: L19,
    abilityIncrease: boon(),
    mechanics: mech({}, { fixed: ['hp-max:+40'] }),
  }),
  feat('boon-of-irresistible-offense', 'Boon of Irresistible Offense', 'epic-boon', 9180, {
    prerequisite: L19,
    abilityIncrease: boon(STR_DEX), // Strength or Dexterity only
  }),
  feat('boon-of-recovery', 'Boon of Recovery', 'epic-boon', 9190, {
    prerequisite: L19,
    abilityIncrease: boon(),
  }),
  feat('boon-of-skill', 'Boon of Skill', 'epic-boon', 9200, {
    prerequisite: L19,
    abilityIncrease: boon(),
    // Proficiency in ALL skills, plus one Expertise pick (a skill lacking Expertise).
    mechanics: mech({ allSkills: true, expertise: 1 }),
  }),
  feat('boon-of-speed', 'Boon of Speed', 'epic-boon', 9212, {
    prerequisite: L19,
    abilityIncrease: boon(),
    mechanics: mech({}, { fixed: ['speed:+30'] }),
  }),
  feat('boon-of-spell-recall', 'Boon of Spell Recall', 'epic-boon', 9226, {
    // "Spellcasting Feature" (NOT "or Pact Magic"): see ambiguity notes.
    prerequisite: { minLevel: 19, spellcasting: 'spellcasting' },
    abilityIncrease: boon(INT_WIS_CHA),
  }),
  feat('boon-of-the-night-spirit', 'Boon of the Night Spirit', 'epic-boon', 9236, {
    prerequisite: L19,
    abilityIncrease: boon(),
  }),
  feat('boon-of-truesight', 'Boon of Truesight', 'epic-boon', 9246, {
    prerequisite: L19,
    abilityIncrease: boon(),
    mechanics: mech({}, { fixed: ['sense:truesight-60'] }),
  }),
];

// ─── Exports ─────────────────────────────────────────────────────────────────

/** Every PHB feat EXCEPT Magic Initiate (modelled per variant below). */
const NON_VARIANT_FEATS: GoldenFeat[] = [...ORIGIN, ...GENERAL, ...FIGHTING_STYLE, ...EPIC_BOON];

/** The expected catalog records: PHB feats with Magic Initiate expanded to 3 variants. */
export function expandGoldenRecords(): GoldenFeat[] {
  return [
    ...ORIGIN,
    ...GOLDEN_MAGIC_INITIATE.lists.map(magicInitiateVariant),
    ...GENERAL,
    ...FIGHTING_STYLE,
    ...EPIC_BOON,
  ];
}

/** PHB Feat List: 75 feats (Magic Initiate counted once). */
export const GOLDEN_PHB_FEAT_COUNT = 75;
/** Catalog records: 75 - 1 + 3 Magic Initiate variants. */
export const GOLDEN_RECORD_COUNT = 77;

/** PHB per-category counts (Magic Initiate counted once, as Origin). */
export const GOLDEN_PHB_CATEGORY_COUNTS: Record<GoldenCategory, number> = {
  origin: 10,
  general: 43,
  'fighting-style': 10,
  'epic-boon': 12,
};

/** Catalog per-category record counts (Origin = 10 - 1 + 3). */
export const GOLDEN_RECORD_CATEGORY_COUNTS: Record<GoldenCategory, number> = {
  origin: 12,
  general: 43,
  'fighting-style': 10,
  'epic-boon': 12,
};

/** PHB feat names (as printed) by category, Magic Initiate included once. */
export function goldenPhbNames(): Record<GoldenCategory, string[]> {
  const out: Record<GoldenCategory, string[]> = {
    origin: [GOLDEN_MAGIC_INITIATE.name],
    general: [],
    'fighting-style': [],
    'epic-boon': [],
  };
  for (const f of NON_VARIANT_FEATS) out[f.category].push(f.name);
  for (const k of Object.keys(out) as GoldenCategory[]) out[k].sort();
  return out;
}

/** Feats the PHB marks repeatable ('*' in the Feat List table). */
export const GOLDEN_REPEATABLE_PHB_NAMES = [
  'Ability Score Improvement',
  'Elemental Adept',
  'Magic Initiate',
  'Skilled',
] as const;

/**
 * Fighting Style feature sources (PHB 2024) that give a "Fighting Style" feature
 * and so satisfy the "Fighting Style Feature" prerequisite and offer the
 * Fighting Style feats via the class feature:
 *  - Fighter level 1 (PHB class table: "Fighting Style" at L1)
 *  - Paladin level 2, Ranger level 2
 * (Champion's Additional Fighting Style is a subclass feature; out of scope.)
 */
export const GOLDEN_FIGHTING_STYLE_CLASS_LEVELS: ReadonlyArray<{
  classId: string;
  level: number;
}> = [
  { classId: 'fighter', level: 1 },
  { classId: 'paladin', level: 2 },
  { classId: 'ranger', level: 2 },
];
