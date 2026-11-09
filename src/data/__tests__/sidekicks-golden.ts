/**
 * GOLDEN FIXTURE for the Sidekick class catalog (Stage 1b).
 *
 * Tasha's 2020 (5e, 2014 rules): Docs/TashasCauldronOfEverything.md, "Sidekicks"
 * (heading L6917; Expert L6972-7071, table L7010-7031; Spellcaster L7073-7172,
 * tables L7099-7103 (roles) and L7117-7138 (spell slots); Warrior L7174-7275, table L7254-7275). Line numbers
 * are 1-based as counted by PowerShell Get-Content. Sidekicks are an OPTIONAL
 * DM rule (opt-in house rule) and the source is 2014-edition: see
 * .agents/tasks/sidekicks-stage1b/findings.md for compatibility doubts.
 *
 * Independent of src/data/sidekicks.ts: nothing is imported from the app.
 * `null` marks a value that is absent or unreadable in the source (never
 * invented); every null/inferred value is explained in findings.md.
 */
export type GoldenSidekickClass = 'expert' | 'spellcaster' | 'warrior';

export interface GoldenSidekickLevel {
  level: number;
  /** Printed "Proficiency Bonus" column. */
  proficiencyBonus: number;
  /** Printed "Features" column, in printed order, OCR spacing repaired. */
  features: string[];
}

export interface GoldenSpellcasterLevel extends GoldenSidekickLevel {
  cantripsKnown: number;
  /** Printed column is BLANK at level 1; 1 is INFERRED from the prose (L7107 "one 1st-level spell"). */
  spellsKnown: number;
  spellsKnownInferred: boolean;
  /** Slots for spell levels 1..5 (index 0 = 1st). Blank printed cells = 0. */
  slots: [number, number, number, number, number];
}

const lv = (level: number, proficiencyBonus: number, features: string[] = []): GoldenSidekickLevel => ({
  level,
  proficiencyBonus,
  features,
});

/** Expert table, L7010-7031 (L7012 = 1st row, L7031 = 20th row). */
export const EXPERT_GOLDEN: GoldenSidekickLevel[] = [
  lv(1, 2, ['Bonus Proficiencies', 'Helpful']),
  lv(2, 2, ['Cunning Action']),
  lv(3, 2, ['Expertise']),
  lv(4, 2, ['Ability Score Improvement']),
  lv(5, 3),
  lv(6, 3, ['Coordinated Strike']),
  lv(7, 3, ['Evasion']),
  lv(8, 3, ['Ability Score Improvement']),
  lv(9, 4),
  lv(10, 4, ['Ability Score Improvement']),
  lv(11, 4, ['Inspiring Help (1d6)']),
  lv(12, 4, ['Ability Score Improvement']),
  lv(13, 5), // OCR prints "+S"; read as +5 (matches the PB progression of every other table)
  lv(14, 5, ['Reliable Talent']),
  lv(15, 5, ['Expertise']),
  lv(16, 5, ['Ability Score Improvement']),
  lv(17, 6),
  lv(18, 6, ['Sharp Mind']),
  lv(19, 6, ['Ability Score Improvement']),
  lv(20, 6, ['Inspiring Help (2d6)']),
];

/** Spellcaster table, L7119 (1st row) - L7138 (20th row). */
const sc = (
  level: number,
  pb: number,
  features: string[],
  cantrips: number,
  known: number | null,
  slots: [number, number, number, number, number],
): GoldenSpellcasterLevel => ({
  level,
  proficiencyBonus: pb,
  features,
  cantripsKnown: cantrips,
  spellsKnown: known ?? 1,
  spellsKnownInferred: known === null,
  slots,
});

export const SPELLCASTER_GOLDEN: GoldenSpellcasterLevel[] = [
  sc(1, 2, ['Bonus Proficiencies', 'Spellcasting'], 2, null, [2, 0, 0, 0, 0]),
  sc(2, 2, [], 2, 2, [2, 0, 0, 0, 0]),
  sc(3, 2, [], 2, 3, [3, 0, 0, 0, 0]),
  sc(4, 2, ['Ability Score Improvement'], 3, 3, [3, 0, 0, 0, 0]),
  sc(5, 3, [], 3, 4, [4, 2, 0, 0, 0]),
  sc(6, 3, ['Potent Cantrips'], 3, 4, [4, 2, 0, 0, 0]),
  sc(7, 3, [], 3, 5, [4, 3, 0, 0, 0]),
  sc(8, 3, ['Ability Score Improvement'], 3, 5, [4, 3, 0, 0, 0]),
  sc(9, 4, [], 3, 6, [4, 3, 2, 0, 0]),
  sc(10, 4, [], 4, 6, [4, 3, 2, 0, 0]),
  sc(11, 4, [], 4, 7, [4, 3, 3, 0, 0]),
  sc(12, 4, ['Ability Score Improvement'], 4, 7, [4, 3, 3, 0, 0]),
  sc(13, 5, [], 4, 8, [4, 3, 3, 0, 0]),
  sc(14, 5, ['Empowered Spells'], 4, 8, [4, 3, 3, 0, 0]),
  sc(15, 5, [], 4, 9, [4, 3, 3, 2, 0]),
  sc(16, 5, ['Ability Score Improvement'], 4, 9, [4, 3, 3, 2, 0]),
  sc(17, 6, [], 4, 10, [4, 3, 3, 3, 0]),
  sc(18, 6, ['Ability Score Improvement'], 4, 10, [4, 3, 3, 3, 0]),
  sc(19, 6, [], 4, 11, [4, 3, 3, 3, 2]),
  sc(20, 6, ['Focused Casting'], 4, 11, [4, 3, 3, 3, 2]),
];

/** Warrior table, L7254-7275 (L7256 = 1st row, L7275 = 20th row). */
export const WARRIOR_GOLDEN: GoldenSidekickLevel[] = [
  lv(1, 2, ['Bonus Proficiencies', 'Martial Role']),
  lv(2, 2, ['Second Wind (1 use)']),
  lv(3, 2, ['Improved Critical']),
  lv(4, 2, ['Ability Score Improvement']),
  lv(5, 3),
  lv(6, 3, ['Extra Attack (1 extra)']),
  lv(7, 3, ['Battle Readiness']),
  lv(8, 3, ['Ability Score Improvement']),
  lv(9, 4),
  lv(10, 4, ['Improved Defense']),
  lv(11, 4, ['Indomitable (1 use)']),
  lv(12, 4, ['Ability Score Improvement']),
  lv(13, 5),
  lv(14, 5, ['Ability Score Improvement']),
  lv(15, 5, ['Extra Attack (2 extra)']),
  lv(16, 5, ['Ability Score Improvement']),
  lv(17, 6),
  lv(18, 6, ['Indomitable (2 uses)']),
  lv(19, 6, ['Ability Score Improvement']),
  lv(20, 6, ['Second Wind (2 uses)']),
];

/** ASI levels from each class's prose (Expert L7037, Spellcaster L7152, Warrior L7216); equal to the table rows above. */
export const SIDEKICK_ASI_LEVELS_GOLDEN: Record<GoldenSidekickClass, number[]> = {
  expert: [4, 8, 10, 12, 16, 19],
  spellcaster: [4, 8, 12, 16, 18],
  warrior: [4, 8, 12, 14, 16, 19],
};

/** Hit Die: "the type of die appears in the sidekick's stat block" (L6954-6958); no class-fixed die is printed. */
export const SIDEKICK_HIT_DIE_GOLDEN = null;

/** Eligibility and progression (L6927-6952). */
export const SIDEKICK_RULES_GOLDEN = {
  maxChallengeRating: 0.5, // "1/2 or lower" (L6929)
  mustBeFriendOfACharacter: true, // L6931
  startingLevel: 'average party level', // L6946-6948
  levelsUpWhen: 'party average level rises', // L6950-6952
  countsAsCharacterForEncounterDifficulty: true, // L6940
  expertAndSpellcasterNeedSpokenLanguage: true, // L6976, L7077
  warriorNeedsLanguage: false, // L7174-7178: no language requirement printed
  // L6960-6964: when PB rises by 1, +1 to hit on all attacks and +1 to DCs in the stat block.
  pbRiseAddsToAttacksAndDcs: 1,
} as const;

/** Spellcasting roles, table L7099-7103. */
export const SIDEKICK_SPELLCASTING_ROLES_GOLDEN = [
  { role: 'Mage', spellList: ['Wizard'], ability: 'int' },
  { role: 'Healer', spellList: ['Cleric', 'Druid'], ability: 'wis' },
  { role: 'Prodigy', spellList: ['Bard', 'Warlock'], ability: 'cha' },
] as const;

/** Level-1 Bonus Proficiencies per class (L6982-6988, L7081-7089, L7180-7188). */
export const SIDEKICK_BONUS_PROFICIENCIES_GOLDEN = {
  expert: {
    saveChoices: ['dex', 'int', 'cha'],
    skillCount: 5,
    skillChoices: null as string[] | null, // any skill ("five skills of your choice")
    armor: ['light'],
    weaponsAndToolsIfHumanoidOrHasWeapon: { weapons: ['simple'], toolChoices: 2 },
  },
  spellcaster: {
    saveChoices: ['wis', 'int', 'cha'],
    skillCount: 2,
    skillChoices: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Performance', 'Persuasion', 'Religion'],
    armor: ['light'],
    weaponsIfHumanoidOrHasWeapon: ['simple'],
  },
  warrior: {
    saveChoices: ['str', 'dex', 'con'],
    skillCount: 2,
    skillChoices: ['Acrobatics', 'Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'],
    armor: ['all'],
    weaponsAndShieldsIfHumanoidOrHasWeapon: ['shields', 'simple', 'martial'],
  },
} as const;

/** Sharp Mind (Expert 18, L7067-7071) save choices. */
export const EXPERT_SHARP_MIND_SAVES_GOLDEN = ['int', 'wis', 'cha'] as const;

/** Warrior Martial Role options (L7190-7198). */
export const WARRIOR_MARTIAL_ROLES_GOLDEN = ['Attacker', 'Defender'] as const;

/**
 * "Bonus Proficiencies by creature type" table: NOT PRESENT in the source text
 * (L7283-7305 is the Monster Research table, unrelated). Recorded as null; see findings.md.
 */
export const SIDEKICK_BONUS_PROFICIENCIES_BY_CREATURE_TYPE_GOLDEN = null;
