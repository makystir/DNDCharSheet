/**
 * GOLDEN TABLE for Stage A6a: XP thresholds, the per-class feat/ASI level map,
 * fixed Hit Points per class, and the forced-choice level-up flow.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md) BEFORE the logic is implemented. The implementer must
 * make the real functions reproduce every row and MUST NOT edit this file. If a row
 * looks wrong, flag it in the summary instead of changing it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. A harness in the
 * implementer's tests maps each row to the real API.
 *
 * Sources (PHB 2024, Docs/PlayersHandbook.md):
 *  - Character Advancement table (L1982-2003): total XP and Proficiency Bonus per
 *    level 1-20. (The source renders levels 15/16 PB as "+S"; the correct value is
 *    +5. PB itself is already computed by proficiencyBonus(level); the XP column is
 *    the only new table.)
 *  - Gaining a Level (L2011-2026): adjust Hit Points (the fixed value OR roll the
 *    Hit Die + Con, minimum 1), record new features and choices, adjust PB, adjust
 *    ability modifiers if a feat raised a score.
 *  - Fixed Hit Points by Class (L2016): the per-class fixed value added each level
 *    after the first (= Hit Die / 2 + 1, before the Con modifier).
 *  - Experience Points (optional rule): crossing a threshold PERMITS a level-up; it
 *    never auto-levels. Milestone is the no-table alternative (the app default).
 *  - The feat/ASI levels per class are the kind:'asi-marker' rows in
 *    src/data/classes.ts (the authoritative source; verified by extraction):
 *    standard classes 4/8/12/16/19; Fighter also 6 and 14; Rogue also 10. Level 19
 *    is the Epic Boon slot. A6 READS these markers from classFeaturesByLevel rather
 *    than hard-coding them; this table pins the expected sets so a data edit that
 *    drops or adds a marker fails a test.
 *
 * Rows tagged `interpretation` are orchestrator-approved readings where the PHB does
 * not state the point verbatim.
 */

// ─── XP thresholds (Character Advancement table) ─────────────────────────────
export interface XpThresholdRow {
  level: number;
  /** Total XP required to BE this level. */
  xp: number;
  /** Proficiency Bonus (cross-check against proficiencyBonus(level)). */
  pb: number;
}

export const XP_THRESHOLDS: XpThresholdRow[] = [
  { level: 1, xp: 0, pb: 2 },
  { level: 2, xp: 300, pb: 2 },
  { level: 3, xp: 900, pb: 2 },
  { level: 4, xp: 2700, pb: 2 },
  { level: 5, xp: 6500, pb: 3 },
  { level: 6, xp: 14000, pb: 3 },
  { level: 7, xp: 23000, pb: 3 },
  { level: 8, xp: 34000, pb: 3 },
  { level: 9, xp: 48000, pb: 4 },
  { level: 10, xp: 64000, pb: 4 },
  { level: 11, xp: 85000, pb: 4 },
  { level: 12, xp: 100000, pb: 4 },
  { level: 13, xp: 120000, pb: 5 },
  { level: 14, xp: 140000, pb: 5 },
  { level: 15, xp: 165000, pb: 5 },
  { level: 16, xp: 195000, pb: 5 },
  { level: 17, xp: 225000, pb: 6 },
  { level: 18, xp: 265000, pb: 6 },
  { level: 19, xp: 305000, pb: 6 },
  { level: 20, xp: 355000, pb: 6 },
];

/** xpForLevel(level) -> the total XP needed to BE that level (the table value). */
export interface XpForLevelCase {
  level: number;
  expect: number;
}
export const XP_FOR_LEVEL_CASES: XpForLevelCase[] = XP_THRESHOLDS.map((r) => ({ level: r.level, expect: r.xp }));

/**
 * xpToLevel(xp) -> the HIGHEST level whose threshold the XP total has reached
 * (clamped 1..20). Crossing a threshold permits that level; it does not auto-apply.
 */
export interface XpToLevelCase {
  name: string;
  xp: number;
  expect: number;
}
export const XP_TO_LEVEL_CASES: XpToLevelCase[] = [
  { name: '0 XP = level 1', xp: 0, expect: 1 },
  { name: 'negative XP clamps to level 1', xp: -50, expect: 1 },
  { name: '299 XP is still level 1', xp: 299, expect: 1 },
  { name: 'exactly 300 XP reaches level 2', xp: 300, expect: 2 },
  { name: '301 XP is level 2', xp: 301, expect: 2 },
  { name: '2,699 XP is level 3', xp: 2699, expect: 3 },
  { name: 'exactly 2,700 XP reaches level 4', xp: 2700, expect: 4 },
  { name: '6,499 XP is level 4', xp: 6499, expect: 4 },
  { name: '6,500 XP reaches level 5', xp: 6500, expect: 5 },
  { name: '99,999 XP is level 11', xp: 99999, expect: 11 },
  { name: '100,000 XP reaches level 12', xp: 100000, expect: 12 },
  { name: 'exactly 355,000 XP reaches level 20', xp: 355000, expect: 20 },
  { name: 'XP beyond the table stays level 20', xp: 1000000, expect: 20 },
];

// ─── Feat / ASI level map per class (from the asi-marker rows) ───────────────
/**
 * The exact set of levels at which each class takes a feat (General feat / ASI feat),
 * with level 19 being the Epic Boon slot. Compare as SETS (ascending).
 */
export const FEAT_LEVELS_BY_CLASS: Record<string, number[]> = {
  barbarian: [4, 8, 12, 16, 19],
  bard: [4, 8, 12, 16, 19],
  cleric: [4, 8, 12, 16, 19],
  druid: [4, 8, 12, 16, 19],
  fighter: [4, 6, 8, 12, 14, 16, 19],
  monk: [4, 8, 12, 16, 19],
  paladin: [4, 8, 12, 16, 19],
  ranger: [4, 8, 12, 16, 19],
  rogue: [4, 8, 10, 12, 16, 19],
  sorcerer: [4, 8, 12, 16, 19],
  warlock: [4, 8, 12, 16, 19],
  wizard: [4, 8, 12, 16, 19],
};

/** featSlots(character): the feat-granting levels AT OR BELOW the character's level. */
export interface FeatSlotCase {
  name: string;
  classId: string;
  level: number;
  /** The slot levels that exist at this character level (<= level). */
  expectLevels: number[];
}
export const FEAT_SLOT_CASES: FeatSlotCase[] = [
  { name: 'Wizard level 3: no feat slots yet', classId: 'wizard', level: 3, expectLevels: [] },
  { name: 'Wizard level 4: first slot', classId: 'wizard', level: 4, expectLevels: [4] },
  { name: 'Wizard level 12: three slots', classId: 'wizard', level: 12, expectLevels: [4, 8, 12] },
  { name: 'Wizard level 20: five slots incl. the level-19 Epic Boon', classId: 'wizard', level: 20, expectLevels: [4, 8, 12, 16, 19] },
  { name: 'Fighter level 6: the extra level-6 slot', classId: 'fighter', level: 6, expectLevels: [4, 6] },
  { name: 'Fighter level 14: both extras (6 and 14)', classId: 'fighter', level: 14, expectLevels: [4, 6, 8, 12, 14] },
  { name: 'Fighter level 20: seven slots', classId: 'fighter', level: 20, expectLevels: [4, 6, 8, 12, 14, 16, 19] },
  { name: 'Rogue level 10: the extra level-10 slot', classId: 'rogue', level: 10, expectLevels: [4, 8, 10] },
  { name: 'Rogue level 20: six slots', classId: 'rogue', level: 20, expectLevels: [4, 8, 10, 12, 16, 19] },
  { name: 'No class: no feat slots', classId: '', level: 20, expectLevels: [] },
];

// ─── Fixed Hit Points per class (Gaining a Level) ────────────────────────────
/**
 * The fixed value ADDED per level after the first (before the Con modifier), and
 * the level-1 value which is always the full Hit Die (before Con). This mirrors the
 * already-shipped hit-points.ts (fixedPerLevel = hitDie / 2 + 1). Golden rows let
 * A6a's per-level HP record be checked against the class without re-deriving.
 */
export interface FixedHpRow {
  classId: string;
  hitDie: number;
  /** Fixed value added at levels 2+ (before Con): hitDie/2 + 1. */
  fixedPerLevel: number;
  /** Level-1 contribution before Con: the full Hit Die. */
  level1: number;
}
export const FIXED_HP_BY_CLASS: FixedHpRow[] = [
  { classId: 'barbarian', hitDie: 12, fixedPerLevel: 7, level1: 12 },
  { classId: 'fighter', hitDie: 10, fixedPerLevel: 6, level1: 10 },
  { classId: 'paladin', hitDie: 10, fixedPerLevel: 6, level1: 10 },
  { classId: 'ranger', hitDie: 10, fixedPerLevel: 6, level1: 10 },
  { classId: 'bard', hitDie: 8, fixedPerLevel: 5, level1: 8 },
  { classId: 'cleric', hitDie: 8, fixedPerLevel: 5, level1: 8 },
  { classId: 'druid', hitDie: 8, fixedPerLevel: 5, level1: 8 },
  { classId: 'monk', hitDie: 8, fixedPerLevel: 5, level1: 8 },
  { classId: 'rogue', hitDie: 8, fixedPerLevel: 5, level1: 8 },
  { classId: 'warlock', hitDie: 8, fixedPerLevel: 5, level1: 8 },
  { classId: 'sorcerer', hitDie: 6, fixedPerLevel: 4, level1: 6 },
  { classId: 'wizard', hitDie: 6, fixedPerLevel: 4, level1: 6 },
];

// ─── Per-level HP record and the HP-choice bounds ────────────────────────────
/**
 * A level-up's HP choice: the FIXED value is hitDie/2 + 1 + Con modifier (minimum 1);
 * a ROLLED value is a Hit Die face (1..hitDie) + Con modifier (minimum 1). The level-1
 * contribution is always the full Hit Die + Con (no choice).
 */
export interface HpChoiceCase {
  name: string;
  cite: string;
  hitDie: number;
  conMod: number;
  mode: 'fixed' | 'rolled';
  /** The rolled Hit Die face (ignored for 'fixed'). */
  face?: number;
  expect: number;
}
export const HP_CHOICE_CASES: HpChoiceCase[] = [
  { name: 'd10 fixed + Con 2 = 6 + 2 = 8', cite: 'Fixed HP by Class', hitDie: 10, conMod: 2, mode: 'fixed', expect: 8 },
  { name: 'd8 fixed + Con 0 = 5', cite: 'Fixed HP by Class', hitDie: 8, conMod: 0, mode: 'fixed', expect: 5 },
  { name: 'd6 fixed + Con 3 = 4 + 3 = 7', cite: 'Fixed HP by Class', hitDie: 6, conMod: 3, mode: 'fixed', expect: 7 },
  { name: 'd12 fixed + Con -1 = 7 - 1 = 6', cite: 'Fixed HP by Class', hitDie: 12, conMod: -1, mode: 'fixed', expect: 6 },
  { name: 'Fixed with a big negative Con floors at 1 (d6 fixed 4 + Con -5 = -1 -> 1)', cite: 'Gaining a Level: minimum 1', hitDie: 6, conMod: -5, mode: 'fixed', expect: 1 },
  { name: 'd10 rolled face 7 + Con 2 = 9', cite: 'Gaining a Level: roll the Hit Die + Con', hitDie: 10, conMod: 2, mode: 'rolled', face: 7, expect: 9 },
  { name: 'd8 rolled face 1 + Con 0 = 1', cite: 'Gaining a Level: roll + Con', hitDie: 8, conMod: 0, mode: 'rolled', face: 1, expect: 1 },
  { name: 'Rolled face 1 with a negative Con still floors at 1', cite: 'Gaining a Level: minimum 1', hitDie: 8, conMod: -2, mode: 'rolled', face: 1, expect: 1 },
  { name: 'd12 rolled face 12 + Con 3 = 15', cite: 'Gaining a Level: roll + Con', hitDie: 12, conMod: 3, mode: 'rolled', face: 12, expect: 15 },
];

// ─── canLevelUp (XP mode gates on the threshold; milestone always permits) ───
export interface CanLevelUpCase {
  name: string;
  cite: string;
  mode: 'milestone' | 'xp';
  level: number;
  xp?: number;
  /** May the character advance to level+1 right now? */
  expect: boolean;
}
export const CAN_LEVEL_UP_CASES: CanLevelUpCase[] = [
  { name: 'Milestone always permits (level 3)', cite: 'Milestone leveling', mode: 'milestone', level: 3, expect: true },
  { name: 'Milestone does not permit past 20', cite: 'Levels cap at 20', mode: 'milestone', level: 20, expect: false },
  { name: 'XP mode: 300 XP at level 1 permits level 2', cite: 'Character Advancement table', mode: 'xp', level: 1, xp: 300, expect: true },
  { name: 'XP mode: 299 XP at level 1 does not permit level 2', cite: 'Character Advancement table', mode: 'xp', level: 1, xp: 299, expect: false },
  { name: 'XP mode: enough XP for several levels still only permits the next one', cite: 'Gaining a Level is a deliberate step', mode: 'xp', level: 1, xp: 6500, expect: true },
  { name: 'XP mode: at the XP for the current level but not the next (level 4, 2,700 XP)', cite: 'Character Advancement table', mode: 'xp', level: 4, xp: 2700, expect: false },
  { name: 'XP mode: exactly the next threshold (level 4, 6,500 XP) permits level 5', cite: 'Character Advancement table', mode: 'xp', level: 4, xp: 6500, expect: true },
  { name: 'XP mode at level 20 never permits more', cite: 'Levels cap at 20', mode: 'xp', level: 20, xp: 1000000, expect: false },
];

// ─── Next-level preview: what you gain going from `level` to `level`+1 ───────
/**
 * The preview lists, for the NEXT level, whether a feat slot opens, whether the
 * subclass choice happens (level 3), and the Proficiency Bonus if it changes. The
 * exact feature TEXT comes from classFeaturesByLevel; these rows pin the structural
 * flags the preview must surface.
 */
export interface NextLevelPreviewCase {
  name: string;
  cite: string;
  classId: string;
  level: number;
  expect: {
    nextLevel: number;
    featSlotOpens: boolean;
    subclassChoice: boolean;
    /** The PB AFTER leveling, present only when it changes from the current level. */
    proficiencyBonusChangesTo?: number;
  };
}
export const NEXT_LEVEL_PREVIEW_CASES: NextLevelPreviewCase[] = [
  { name: 'Wizard 2 -> 3: subclass choice, no feat, PB unchanged', cite: 'Subclass at level 3', classId: 'wizard', level: 2, expect: { nextLevel: 3, featSlotOpens: false, subclassChoice: true, proficiencyBonusChangesTo: undefined } },
  { name: 'Wizard 3 -> 4: a feat slot opens, PB unchanged (still +2)', cite: 'Feat at level 4', classId: 'wizard', level: 3, expect: { nextLevel: 4, featSlotOpens: true, subclassChoice: false } },
  { name: 'Any class 4 -> 5: PB rises to +3, no feat, no subclass', cite: 'Character Advancement table', classId: 'wizard', level: 4, expect: { nextLevel: 5, featSlotOpens: false, subclassChoice: false, proficiencyBonusChangesTo: 3 } },
  { name: 'Fighter 5 -> 6: the extra feat slot', cite: 'Fighter feat at level 6', classId: 'fighter', level: 5, expect: { nextLevel: 6, featSlotOpens: true, subclassChoice: false } },
  { name: 'Rogue 9 -> 10: the extra feat slot', cite: 'Rogue feat at level 10', classId: 'rogue', level: 9, expect: { nextLevel: 10, featSlotOpens: true, subclassChoice: false } },
  { name: 'Wizard 18 -> 19: the Epic Boon feat slot', cite: 'Epic Boon at level 19', classId: 'wizard', level: 18, expect: { nextLevel: 19, featSlotOpens: true, subclassChoice: false } },
  { name: 'Wizard 12 -> 13: PB rises to +5', cite: 'Character Advancement table', classId: 'wizard', level: 12, expect: { nextLevel: 13, featSlotOpens: false, subclassChoice: false, proficiencyBonusChangesTo: 5 } },
  { name: 'Wizard 16 -> 17: PB rises to +6', cite: 'Character Advancement table', classId: 'wizard', level: 16, expect: { nextLevel: 17, featSlotOpens: false, subclassChoice: false, proficiencyBonusChangesTo: 6 } },
];
