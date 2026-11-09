/**
 * Sidekick class catalog: Expert, Spellcaster and Warrior (Stage 1b of the
 * Companions work). DATA ONLY: the pure rules live in src/logic/sidekick.ts.
 *
 * Tasha's 2020 (5e, 2014 rules): everything in this file comes from
 * Docs/TashasCauldronOfEverything.md, section "Sidekicks" (heading L6917;
 * Creating L6927, Gaining a Class L6942, Leveling L6950; Expert L6972-7071,
 * Spellcaster L7073-7172, Warrior L7174-7275). Line numbers are 1-based as
 * counted by PowerShell Get-Content (= `Select-String` LineNumber).
 *
 * COMPATIBILITY (rules-compliance steering): Tasha's is a 2014-edition
 * supplement and Sidekicks are an OPTIONAL DM rule, so they must be gated
 * behind an explicit opt-in house-rule toggle (Stage 2). Compatibility doubts
 * with the 2024 rules are listed in
 * .agents/tasks/sidekicks-stage1b/findings.md; nothing here silently adapts a
 * 2014 rule to 2024.
 *
 * CONVENTIONS (match data/creatures.ts): descriptions are PARAPHRASED; every
 * number, die, DC, level and use count is exact. Printed table cells that are
 * blank mean "none" (features) or 0 (slots). The one inferred cell is the
 * Spellcaster level-1 "Spells Known" (blank in the table; the prose says one
 * 1st-level spell): flagged `spellsKnownInferred`. The OCR "+S" in the Expert
 * table (levels 13-16) is read as +5 (matches every other class table).
 *
 * NOT PRESENT IN THE SOURCE TEXT: a "Bonus Proficiencies by creature type"
 * table. The only creature-dependent bonus-proficiency rule is the prose
 * condition "humanoid or has a simple or martial weapon in its stat block".
 * See SIDEKICK_BONUS_PROFICIENCIES_BY_CREATURE_TYPE (null) and findings.md.
 */
import type { Ability } from '../types/character';

// --- Types -----------------------------------------------------------------

export type SidekickClassId = 'expert' | 'spellcaster' | 'warrior';

export const SIDEKICK_CLASS_IDS: readonly SidekickClassId[] = ['expert', 'spellcaster', 'warrior'];

/** Where a record comes from: Tasha's heading line and the md line range of its text. */
export interface SidekickSource {
  book: "Tasha's Cauldron of Everything (2020)";
  /** Edition marker required by the rules-compliance steering. */
  edition: "Tasha's 2020 (5e, 2014 rules)";
  section: string;
  /** Heading line (or first line) of the record in Docs/TashasCauldronOfEverything.md. */
  line: number;
  /** Inclusive line range of the record's text. */
  lines: readonly [number, number];
}

export type SidekickActivation = 'passive' | 'bonus-action' | 'reaction' | 'special';

export type SidekickRecharge = 'short-or-long-rest' | 'long-rest';

/** What a choice picks from, when the options are not a fixed list. */
export type SidekickChoiceKind =
  | 'saving-throw'
  | 'skill'
  | 'tool'
  | 'own-skill-proficiency'
  | 'school-of-magic'
  | 'spellcasting-role'
  | 'martial-role'
  | 'ability-score';

export interface SidekickChoice {
  id: string;
  label: string;
  kind: SidekickChoiceKind;
  /** How many options are picked. */
  pick: number;
  /** Fixed option list, or null when the pool is open (see `kind`). */
  options: readonly string[] | null;
  /** Levels at which this choice is made (default: the feature's level). */
  atLevels?: readonly number[];
}

export interface SidekickGrantedProficiencies {
  /** One saving throw of the listed abilities. */
  savingThrow?: { pick: number; from: readonly Ability[] };
  /** Skill proficiencies: `from` null means any skill ("of your choice"). */
  skills?: { pick: number; from: readonly string[] | null };
  armor?: readonly ('light' | 'all')[];
  /** Granted only when the creature is a humanoid OR has a simple or martial weapon in its stat block. */
  ifHumanoidOrHasWeapon?: {
    weapons: readonly ('simple' | 'martial' | 'shields')[];
    tools?: { pick: number };
  };
}

export interface SidekickFeature {
  /** `<classId>.<slug of name>`. */
  id: string;
  classId: SidekickClassId;
  name: string;
  /** Level the feature is first gained (the "Nth-level <Class> feature" line). */
  level: number;
  /** Every table row on which the feature appears (derived from the table; equals [level] unless it recurs or upgrades). */
  levels: readonly number[];
  /** Paraphrased effect. */
  summary: string;
  activation: SidekickActivation;
  recharge?: SidekickRecharge;
  /** A dice expression that is part of the feature, e.g. '1d10', '2d6'. */
  dice?: string;
  /** Dice that change with level: from `level` on, use `dice`. */
  diceByLevel?: readonly { level: number; dice: string }[];
  /** Uses between rests that change with level. */
  usesByLevel?: readonly { level: number; uses: number }[];
  /** Flat modifier. Martial Role: applies ONLY to the Attacker choice; consumers must use martialRoleAttackBonus(role), never this field directly. */
  flatBonus?: number;
  /** Range in feet. Martial Role: applies ONLY to the Defender choice. */
  rangeFt?: number;
  /** Second Wind adds the sidekick's level in this class to the healing. */
  addsClassLevel?: boolean;
  /** Extra attacks per Attack action, by level (Warrior Extra Attack: 2 at 6, 3 at 15). */
  attacksPerAttackAction?: readonly { level: number; attacks: number }[];
  /** Critical hit threshold (Improved Critical: 19). */
  critRange?: number;
  /** Armor Class bonus (Improved Defense). */
  acBonus?: number;
  grants?: SidekickGrantedProficiencies;
  choices?: readonly SidekickChoice[];
  source: SidekickSource;
}

/** One printed row of a class table. */
export interface SidekickLevelRow {
  level: number;
  proficiencyBonus: number;
  /** Printed "Features" cell split on commas, OCR repaired (e.g. 'Inspiring Help (1d6)'). Blank cell = []. */
  features: readonly string[];
  /** Feature ids of the features named in the row (parenthetical suffix removed). */
  featureIds: readonly string[];
}

export interface SidekickSpellcasterRow extends SidekickLevelRow {
  cantripsKnown: number;
  /** Printed "Spells Known" (level 1 is blank in print; see `spellsKnownInferred`). */
  spellsKnown: number;
  spellsKnownInferred: boolean;
  /** Slots for spell levels 1..5 (index 0 = 1st). Blank printed cells = 0. */
  slots: readonly [number, number, number, number, number];
}

export interface SidekickClassData<Row extends SidekickLevelRow = SidekickLevelRow> {
  id: SidekickClassId;
  name: string;
  /** Paraphrased flavour line. */
  summary: string;
  /** The creature must have a language in its stat block that it can speak (Expert, Spellcaster). */
  requiresSpokenLanguage: boolean;
  /** Levels with the Ability Score Improvement feature (prose; equals the table rows). */
  abilityScoreImprovementLevels: readonly number[];
  rows: readonly Row[];
  features: readonly SidekickFeature[];
  source: SidekickSource;
}

export interface SidekickSpellcastingRole {
  role: 'Mage' | 'Healer' | 'Prodigy';
  /** Spell lists named by the table (2014 lists: see findings.md). */
  spellLists: readonly string[];
  ability: Ability;
  /** Printed focus text; the book says "Priest" for the Healer role. */
  focus: readonly string[];
  /** Recommended 1st-level picks: two cantrips and one 1st-level spell. */
  recommendedSpells: readonly string[];
}

// --- Helpers ---------------------------------------------------------------

const slugOf = (n: string): string => n.toLowerCase().replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const EDITION = "Tasha's 2020 (5e, 2014 rules)" as const;
const BOOK = "Tasha's Cauldron of Everything (2020)" as const;

const src = (section: string, line: number, end: number): SidekickSource => ({
  book: BOOK,
  edition: EDITION,
  section,
  line,
  lines: [line, end],
});

const featureName = (label: string): string => label.replace(/\s*\(.*\)\s*$/, '').trim();

function makeRows<R extends SidekickLevelRow>(
  classId: SidekickClassId,
  raw: ReadonlyArray<readonly [level: number, pb: number, features: readonly string[]]>,
  extend: (level: number) => Omit<R, keyof SidekickLevelRow>,
): R[] {
  return raw.map(([level, proficiencyBonus, features]) => ({
    level,
    proficiencyBonus,
    features,
    featureIds: features.map((f) => `${classId}.${slugOf(featureName(f))}`),
    ...extend(level),
  })) as unknown as R[];
}

type FeatureInput = Omit<SidekickFeature, 'id' | 'classId' | 'levels'>;

/** Builds feature records and fills `levels` from the class table rows. */
function makeFeatures(classId: SidekickClassId, rows: readonly SidekickLevelRow[], inputs: readonly FeatureInput[]): SidekickFeature[] {
  return inputs.map((f) => {
    const id = `${classId}.${slugOf(f.name)}`;
    return { ...f, id, classId, levels: rows.filter((r) => r.featureIds.includes(id)).map((r) => r.level) };
  });
}

const ABILITY_SCORE_IMPROVEMENT_SUMMARY =
  'Increase one ability score of your choice by 2, or two ability scores of your choice by 1 each. No score can go above 20 with this feature. Afterwards, adjust anything in the stat block that relies on the changed modifier.';

const asiChoice: SidekickChoice = {
  id: 'ability-score-improvement',
  label: 'Ability score increase',
  kind: 'ability-score',
  pick: 1,
  options: ['+2 to one ability score', '+1 to two ability scores'],
};

// --- Expert (Tasha's L6972-7071; table L7010-7031) ---------------------------

const EXPERT_ROWS = makeRows<SidekickLevelRow>(
  'expert',
  [
    [1, 2, ['Bonus Proficiencies', 'Helpful']],
    [2, 2, ['Cunning Action']],
    [3, 2, ['Expertise']],
    [4, 2, ['Ability Score Improvement']],
    [5, 3, []],
    [6, 3, ['Coordinated Strike']],
    [7, 3, ['Evasion']],
    [8, 3, ['Ability Score Improvement']],
    [9, 4, []],
    [10, 4, ['Ability Score Improvement']],
    [11, 4, ['Inspiring Help (1d6)']],
    [12, 4, ['Ability Score Improvement']],
    [13, 5, []], // OCR "+S" read as +5 (L7024)
    [14, 5, ['Reliable Talent']],
    [15, 5, ['Expertise']],
    [16, 5, ['Ability Score Improvement']],
    [17, 6, []],
    [18, 6, ['Sharp Mind']],
    [19, 6, ['Ability Score Improvement']],
    [20, 6, ['Inspiring Help (2d6)']],
  ],
  () => ({}),
);

const EXPERT_FEATURES = makeFeatures('expert', EXPERT_ROWS, [
  {
    name: 'Bonus Proficiencies',
    level: 1,
    summary:
      'Gains proficiency in one saving throw of your choice (Dexterity, Intelligence or Charisma), five skills of your choice and light armor. If it is a humanoid or has a simple or martial weapon in its stat block it also gains all simple weapons and two tools of your choice.',
    activation: 'passive',
    grants: {
      savingThrow: { pick: 1, from: ['dex', 'int', 'cha'] },
      skills: { pick: 5, from: null },
      armor: ['light'],
      ifHumanoidOrHasWeapon: { weapons: ['simple'], tools: { pick: 2 } },
    },
    choices: [
      { id: 'save', label: 'Saving throw proficiency', kind: 'saving-throw', pick: 1, options: ['dex', 'int', 'cha'] },
      { id: 'skills', label: 'Skill proficiencies', kind: 'skill', pick: 5, options: null },
      { id: 'tools', label: 'Tool proficiencies (humanoid or armed)', kind: 'tool', pick: 2, options: null },
    ],
    source: src('Sidekicks > Expert > Bonus Proficiencies', 6982, 6988),
  },
  {
    name: 'Helpful',
    level: 1,
    summary: 'The sidekick can take the Help action as a bonus action.',
    activation: 'bonus-action',
    source: src('Sidekicks > Expert > Helpful', 6990, 6994),
  },
  {
    name: 'Cunning Action',
    level: 2,
    summary: 'On its turn in combat the sidekick can take the Dash, Disengage or Hide action as a bonus action.',
    activation: 'bonus-action',
    source: src('Sidekicks > Expert > Cunning Action', 6996, 7000),
  },
  {
    name: 'Expertise',
    level: 3,
    summary:
      'Choose two of the sidekick\'s skill proficiencies; its proficiency bonus is doubled on ability checks that use them. At 15th level choose two more skill proficiencies for the same benefit.',
    activation: 'passive',
    choices: [{ id: 'expertise', label: 'Expertise skills', kind: 'own-skill-proficiency', pick: 2, options: null, atLevels: [3, 15] }],
    source: src('Sidekicks > Expert > Expertise', 7002, 7006),
  },
  {
    name: 'Ability Score Improvement',
    level: 4,
    summary: ABILITY_SCORE_IMPROVEMENT_SUMMARY,
    activation: 'passive',
    choices: [asiChoice],
    source: src('Sidekicks > Expert > Ability Score Improvement', 7035, 7039),
  },
  {
    name: 'Coordinated Strike',
    level: 6,
    summary:
      'When Helpful aids an ally attacking a creature, that target can be up to 30 feet from the sidekick, and the next time the sidekick hits it with an attack roll before the end of the turn it deals an extra 2d6 damage of the attack\'s type.',
    activation: 'special',
    dice: '2d6',
    rangeFt: 30,
    source: src('Sidekicks > Expert > Coordinated Strike', 7041, 7045),
  },
  {
    name: 'Evasion',
    level: 7,
    summary:
      'On a Dexterity saving throw for half damage the sidekick takes no damage on a success and half on a failure. It does not benefit while incapacitated.',
    activation: 'passive',
    source: src('Sidekicks > Expert > Evasion', 7047, 7051),
  },
  {
    name: 'Inspiring Help',
    level: 11,
    summary:
      'When the sidekick takes the Help action, the creature helped also gains a d6 bonus to the d20 roll (an attacker may instead keep it for the damage roll if the attack hits). The bonus becomes 2d6 at 20th level.',
    activation: 'special',
    dice: '1d6',
    diceByLevel: [
      { level: 11, dice: '1d6' },
      { level: 20, dice: '2d6' },
    ],
    source: src('Sidekicks > Expert > Inspiring Help', 7053, 7059),
  },
  {
    name: 'Reliable Talent',
    level: 14,
    summary: 'On an ability check that includes its whole proficiency bonus, the sidekick treats a d20 roll of 9 or lower as a 10.',
    activation: 'passive',
    source: src('Sidekicks > Expert > Reliable Talent', 7061, 7065),
  },
  {
    name: 'Sharp Mind',
    level: 18,
    summary: 'Gains proficiency in one saving throw of your choice: Intelligence, Wisdom or Charisma.',
    activation: 'passive',
    grants: { savingThrow: { pick: 1, from: ['int', 'wis', 'cha'] } },
    choices: [{ id: 'save', label: 'Saving throw proficiency', kind: 'saving-throw', pick: 1, options: ['int', 'wis', 'cha'] }],
    source: src('Sidekicks > Expert > Sharp Mind', 7067, 7071),
  },
]);

// --- Spellcaster (Tasha's L7073-7172; table L7117-7138) ----------------------

/** Spellcasting table (L7099-7103), focus text (L7148), recommendations (L7109). */
export const SIDEKICK_SPELLCASTING_ROLES: readonly SidekickSpellcastingRole[] = [
  {
    role: 'Mage',
    spellLists: ['Wizard'],
    ability: 'int',
    focus: ['arcane focus'],
    recommendedSpells: ['mage hand', 'ray of frost', 'thunderwave'],
  },
  {
    role: 'Healer',
    spellLists: ['Cleric', 'Druid'],
    ability: 'wis',
    focus: ['holy symbol'],
    recommendedSpells: ['cure wounds', 'guidance', 'sacred flame'],
  },
  {
    role: 'Prodigy',
    spellLists: ['Bard', 'Warlock'],
    ability: 'cha',
    focus: ['arcane focus', 'musical instrument'],
    recommendedSpells: ['eldritch blast', 'healing word', 'light'],
  },
];

/** [level, pb, features, cantrips, spellsKnown (null = blank in print), slots 1st..5th]. */
const SPELLCASTER_RAW: ReadonlyArray<
  readonly [number, number, readonly string[], number, number | null, readonly [number, number, number, number, number]]
> = [
  [1, 2, ['Bonus Proficiencies', 'Spellcasting'], 2, null, [2, 0, 0, 0, 0]],
  [2, 2, [], 2, 2, [2, 0, 0, 0, 0]],
  [3, 2, [], 2, 3, [3, 0, 0, 0, 0]],
  [4, 2, ['Ability Score Improvement'], 3, 3, [3, 0, 0, 0, 0]],
  [5, 3, [], 3, 4, [4, 2, 0, 0, 0]],
  [6, 3, ['Potent Cantrips'], 3, 4, [4, 2, 0, 0, 0]],
  [7, 3, [], 3, 5, [4, 3, 0, 0, 0]],
  [8, 3, ['Ability Score Improvement'], 3, 5, [4, 3, 0, 0, 0]],
  [9, 4, [], 3, 6, [4, 3, 2, 0, 0]],
  [10, 4, [], 4, 6, [4, 3, 2, 0, 0]],
  [11, 4, [], 4, 7, [4, 3, 3, 0, 0]],
  [12, 4, ['Ability Score Improvement'], 4, 7, [4, 3, 3, 0, 0]],
  [13, 5, [], 4, 8, [4, 3, 3, 0, 0]],
  [14, 5, ['Empowered Spells'], 4, 8, [4, 3, 3, 0, 0]],
  [15, 5, [], 4, 9, [4, 3, 3, 2, 0]],
  [16, 5, ['Ability Score Improvement'], 4, 9, [4, 3, 3, 2, 0]],
  [17, 6, [], 4, 10, [4, 3, 3, 3, 0]],
  [18, 6, ['Ability Score Improvement'], 4, 10, [4, 3, 3, 3, 0]],
  [19, 6, [], 4, 11, [4, 3, 3, 3, 2]],
  [20, 6, ['Focused Casting'], 4, 11, [4, 3, 3, 3, 2]],
];

const SPELLCASTER_EXTRA = new Map(SPELLCASTER_RAW.map((r) => [r[0], r]));

const SPELLCASTER_ROWS = makeRows<SidekickSpellcasterRow>(
  'spellcaster',
  SPELLCASTER_RAW.map((r) => [r[0], r[1], r[2]] as const),
  (level) => {
    const r = SPELLCASTER_EXTRA.get(level)!;
    return {
      cantripsKnown: r[3],
      // Level 1 "Spells Known" is blank in the table; the prose (L7107) says one 1st-level spell.
      spellsKnown: r[4] ?? 1,
      spellsKnownInferred: r[4] === null,
      slots: r[5],
    };
  },
);

const SPELLCASTER_FEATURES = makeFeatures('spellcaster', SPELLCASTER_ROWS, [
  {
    name: 'Bonus Proficiencies',
    level: 1,
    summary:
      'Gains proficiency in one saving throw of your choice (Wisdom, Intelligence or Charisma), two skills from Arcana, History, Insight, Investigation, Medicine, Performance, Persuasion and Religion, and light armor. If it is a humanoid or has a simple or martial weapon in its stat block it also gains all simple weapons.',
    activation: 'passive',
    grants: {
      savingThrow: { pick: 1, from: ['wis', 'int', 'cha'] },
      skills: { pick: 2, from: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Performance', 'Persuasion', 'Religion'] },
      armor: ['light'],
      ifHumanoidOrHasWeapon: { weapons: ['simple'] },
    },
    choices: [
      { id: 'save', label: 'Saving throw proficiency', kind: 'saving-throw', pick: 1, options: ['wis', 'int', 'cha'] },
      {
        id: 'skills',
        label: 'Skill proficiencies',
        kind: 'skill',
        pick: 2,
        options: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Performance', 'Persuasion', 'Religion'],
      },
    ],
    source: src('Sidekicks > Spellcaster > Bonus Proficiencies', 7081, 7089),
  },
  {
    name: 'Spellcasting',
    level: 1,
    summary:
      'Casts spells from the chosen role\'s list (an existing Spellcasting trait is replaced). Role Mage uses the Wizard list and Intelligence; Healer the Cleric and Druid lists and Wisdom; Prodigy the Bard and Warlock lists and Charisma. Knows two cantrips and one 1st-level spell at 1st level, learning more per the table (each spell of a level the sidekick has slots for). Slots are regained on a long rest; casting needs a slot of the spell\'s level or higher. When it gains a level it may swap one known spell for another from its list. Spell save DC = 8 + proficiency bonus + spellcasting ability modifier; spell attack modifier = proficiency bonus + spellcasting ability modifier.',
    activation: 'special',
    recharge: 'long-rest',
    choices: [
      { id: 'role', label: 'Spellcasting role', kind: 'spellcasting-role', pick: 1, options: ['Mage', 'Healer', 'Prodigy'] },
    ],
    source: src('Sidekicks > Spellcaster > Spellcasting', 7091, 7148),
  },
  {
    name: 'Ability Score Improvement',
    level: 4,
    summary: ABILITY_SCORE_IMPROVEMENT_SUMMARY,
    activation: 'passive',
    choices: [asiChoice],
    source: src('Sidekicks > Spellcaster > Ability Score Improvement', 7150, 7154),
  },
  {
    name: 'Potent Cantrips',
    level: 6,
    summary: 'The sidekick adds its spellcasting ability modifier to the damage of any cantrip it casts.',
    activation: 'passive',
    source: src('Sidekicks > Spellcaster > Potent Cantrips', 7156, 7160),
  },
  {
    name: 'Empowered Spells',
    level: 14,
    summary:
      'Choose one school of magic. When the sidekick casts a spell of that school by expending a spell slot it adds its spellcasting ability modifier to the damage roll or healing roll of the spell, if any.',
    activation: 'passive',
    choices: [{ id: 'school', label: 'School of magic', kind: 'school-of-magic', pick: 1, options: null }],
    source: src('Sidekicks > Spellcaster > Empowered Spells', 7162, 7166),
  },
  {
    name: 'Focused Casting',
    level: 20,
    summary: 'Taking damage cannot break the sidekick\'s concentration on a spell.',
    activation: 'passive',
    source: src('Sidekicks > Spellcaster > Focused Casting', 7168, 7172),
  },
]);

// --- Warrior (Tasha's L7174-7275; table L7254-7275) --------------------------

const WARRIOR_ROWS = makeRows<SidekickLevelRow>(
  'warrior',
  [
    [1, 2, ['Bonus Proficiencies', 'Martial Role']],
    [2, 2, ['Second Wind (1 use)']],
    [3, 2, ['Improved Critical']],
    [4, 2, ['Ability Score Improvement']],
    [5, 3, []],
    [6, 3, ['Extra Attack (1 extra)']],
    [7, 3, ['Battle Readiness']],
    [8, 3, ['Ability Score Improvement']],
    [9, 4, []],
    [10, 4, ['Improved Defense']],
    [11, 4, ['Indomitable (1 use)']],
    [12, 4, ['Ability Score Improvement']],
    [13, 5, []],
    [14, 5, ['Ability Score Improvement']],
    [15, 5, ['Extra Attack (2 extra)']],
    [16, 5, ['Ability Score Improvement']],
    [17, 6, []],
    [18, 6, ['Indomitable (2 uses)']],
    [19, 6, ['Ability Score Improvement']],
    [20, 6, ['Second Wind (2 uses)']],
  ],
  () => ({}),
);

const WARRIOR_FEATURES = makeFeatures('warrior', WARRIOR_ROWS, [
  {
    name: 'Bonus Proficiencies',
    level: 1,
    summary:
      'Gains proficiency in one saving throw of your choice (Strength, Dexterity or Constitution), two skills from Acrobatics, Animal Handling, Athletics, Intimidation, Nature, Perception and Survival, and all armor. If it is a humanoid or has a simple or martial weapon in its stat block it also gains shields and all simple and martial weapons.',
    activation: 'passive',
    grants: {
      savingThrow: { pick: 1, from: ['str', 'dex', 'con'] },
      skills: { pick: 2, from: ['Acrobatics', 'Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'] },
      armor: ['all'],
      ifHumanoidOrHasWeapon: { weapons: ['shields', 'simple', 'martial'] },
    },
    choices: [
      { id: 'save', label: 'Saving throw proficiency', kind: 'saving-throw', pick: 1, options: ['str', 'dex', 'con'] },
      {
        id: 'skills',
        label: 'Skill proficiencies',
        kind: 'skill',
        pick: 2,
        options: ['Acrobatics', 'Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'],
      },
    ],
    source: src('Sidekicks > Warrior > Bonus Proficiencies', 7180, 7188),
  },
  {
    name: 'Martial Role',
    level: 1,
    summary:
      'Choose one. Attacker: +2 bonus to all attack rolls. Defender: as a reaction, impose disadvantage on the attack roll of a creature within 5 feet of the sidekick whose target is not the sidekick, if the sidekick can see the attacker.',
    activation: 'special',
    flatBonus: 2,
    rangeFt: 5,
    choices: [{ id: 'role', label: 'Martial role', kind: 'martial-role', pick: 1, options: ['Attacker', 'Defender'] }],
    source: src('Sidekicks > Warrior > Martial Role', 7190, 7198),
  },
  {
    name: 'Second Wind',
    level: 2,
    summary:
      'As a bonus action the sidekick regains hit points equal to 1d10 + its level in this class, then must finish a short or long rest before using it again. From 20th level it can use it twice between rests.',
    activation: 'bonus-action',
    recharge: 'short-or-long-rest',
    dice: '1d10',
    addsClassLevel: true,
    usesByLevel: [
      { level: 2, uses: 1 },
      { level: 20, uses: 2 },
    ],
    source: src('Sidekicks > Warrior > Second Wind', 7200, 7206),
  },
  {
    name: 'Improved Critical',
    level: 3,
    summary: 'The sidekick\'s attack rolls score a critical hit on a d20 roll of 19 or 20.',
    activation: 'passive',
    critRange: 19,
    source: src('Sidekicks > Warrior > Improved Critical', 7208, 7212),
  },
  {
    name: 'Ability Score Improvement',
    level: 4,
    summary: ABILITY_SCORE_IMPROVEMENT_SUMMARY,
    activation: 'passive',
    choices: [asiChoice],
    source: src('Sidekicks > Warrior > Ability Score Improvement', 7214, 7218),
  },
  {
    name: 'Extra Attack',
    level: 6,
    summary:
      'The sidekick attacks twice instead of once when it takes the Attack action, and three times from 15th level. If it has Multiattack it uses Extra Attack or Multiattack on a turn, not both.',
    activation: 'passive',
    attacksPerAttackAction: [
      { level: 6, attacks: 2 },
      { level: 15, attacks: 3 },
    ],
    source: src('Sidekicks > Warrior > Extra Attack', 7222, 7230),
  },
  {
    name: 'Battle Readiness',
    level: 7,
    summary: 'The sidekick has advantage on initiative rolls.',
    activation: 'passive',
    source: src('Sidekicks > Warrior > Battle Readiness', 7232, 7236),
  },
  {
    name: 'Improved Defense',
    level: 10,
    summary: 'The sidekick\'s Armor Class increases by 1.',
    activation: 'passive',
    acBonus: 1,
    source: src('Sidekicks > Warrior > Improved Defense', 7238, 7242),
  },
  {
    name: 'Indomitable',
    level: 11,
    summary:
      'The sidekick can reroll a failed saving throw and must use the new roll, then cannot use the feature again until it finishes a long rest. From 18th level it can use it twice between long rests.',
    activation: 'special',
    recharge: 'long-rest',
    usesByLevel: [
      { level: 11, uses: 1 },
      { level: 18, uses: 2 },
    ],
    source: src('Sidekicks > Warrior > Indomitable', 7244, 7250),
  },
]);

// --- Catalog ---------------------------------------------------------------

export const SIDEKICK_CLASSES: {
  expert: SidekickClassData;
  spellcaster: SidekickClassData<SidekickSpellcasterRow>;
  warrior: SidekickClassData;
} = {
  expert: {
    id: 'expert',
    name: 'Expert',
    summary: 'A master of certain tasks or knowledge who favors cunning over brawn.',
    requiresSpokenLanguage: true, // L6976
    abilityScoreImprovementLevels: [4, 8, 10, 12, 16, 19], // L7039
    rows: EXPERT_ROWS,
    features: EXPERT_FEATURES,
    source: src('Sidekicks > Expert', 6972, 7071),
  },
  spellcaster: {
    id: 'spellcaster',
    name: 'Spellcaster',
    summary: 'A sidekick who walks the paths of magic: hedge wizard, priest, soothsayer or magical performer.',
    requiresSpokenLanguage: true, // L7077
    abilityScoreImprovementLevels: [4, 8, 12, 16, 18], // L7154
    rows: SPELLCASTER_ROWS,
    features: SPELLCASTER_FEATURES,
    source: src('Sidekicks > Spellcaster', 7073, 7172),
  },
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    summary: 'A sidekick that grows in martial prowess: soldier, town guard, battle-trained beast or any creature honed for combat.',
    requiresSpokenLanguage: false, // L7174-7178: no language requirement is printed
    abilityScoreImprovementLevels: [4, 8, 12, 14, 16, 19], // L7218
    rows: WARRIOR_ROWS,
    features: WARRIOR_FEATURES,
    source: src('Sidekicks > Warrior', 7174, 7275),
  },
};

/** Maximum challenge rating of a creature that can become a sidekick (L6929: "1/2 or lower"). */
export const SIDEKICK_MAX_CHALLENGE_RATING = 0.5;

/** Sidekick level range (the class tables run 1st-20th). */
export const SIDEKICK_MIN_LEVEL = 1;
export const SIDEKICK_MAX_LEVEL = 20;

/**
 * Tasha's 2020 (5e, 2014 rules): "Bonus Proficiencies by creature type" table.
 * ABSENT from Docs/TashasCauldronOfEverything.md (L7283-7305 is the Monster
 * Research table for parleying, unrelated). Left null rather than invented; the
 * printed page must be supplied by the user. The only creature-dependent
 * condition in the text is "humanoid or has a simple or martial weapon in its
 * stat block" (see `grants.ifHumanoidOrHasWeapon`).
 */
export const SIDEKICK_BONUS_PROFICIENCIES_BY_CREATURE_TYPE: null = null;

export function getSidekickClass(id: 'expert'): SidekickClassData;
export function getSidekickClass(id: 'spellcaster'): SidekickClassData<SidekickSpellcasterRow>;
export function getSidekickClass(id: 'warrior'): SidekickClassData;
export function getSidekickClass(id: SidekickClassId): SidekickClassData | SidekickClassData<SidekickSpellcasterRow>;
export function getSidekickClass(id: SidekickClassId): SidekickClassData | SidekickClassData<SidekickSpellcasterRow> {
  return SIDEKICK_CLASSES[id];
}
