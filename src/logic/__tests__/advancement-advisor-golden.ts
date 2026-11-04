/**
 * GOLDEN TABLE for Stage A6c: the XP/milestone advisor + level-up planner.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md) and the Stage A6a engine contract BEFORE the A6c
 * logic is implemented. The implementer must make the real functions reproduce
 * every row and MUST NOT edit this file. If a row looks wrong, flag it in the
 * summary instead of changing it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. A harness in
 * the implementer's tests maps each row onto the real API.
 *
 * Sources (PHB 2024, Docs/PlayersHandbook.md):
 *  - Character Advancement table (L1982-2003): the total XP needed to BE each
 *    level 1..20, and the Proficiency Bonus per level. (The source OCR renders
 *    levels 15/16 PB as "+S"; the value is +5. L13-16 = +5, L17-20 = +6.) The
 *    thresholds are ALREADY implemented by A6a's xpForLevel / XP_THRESHOLD_BY_LEVEL;
 *    this golden re-states them so the advisor's progress math is pinned.
 *  - Experience Points (optional rule): when the XP total EQUALS OR EXCEEDS a
 *    level's threshold the character reaches that level — but applying a level is
 *    a deliberate step, never an auto-level (A6a canLevelUp permits only ONE
 *    level at a time). XP can nonetheless sit above several thresholds, so the
 *    advisor reports how many levels are EARNED-but-unapplied.
 *  - Milestone (the no-table default): no XP is tracked; the DM grants levels.
 *    The advisor shows no XP progress in milestone mode.
 *  - Gaining a Level (L2011-2026) + the class feature tables: a level-up adjusts
 *    PB at the table's breakpoints, may open a feat/ASI slot (an asi-marker row:
 *    standard classes 4/8/12/16/19; Fighter also 6 and 14; Rogue also 10), and
 *    grants the level's named features. Subclass is chosen at level 3 for every
 *    2024 class (the subclass-choice row).
 *
 * The advisor/planner are READ-ONLY and DETERMINISTIC: they compute a projection
 * and suggestions from the character; they never mutate it, award XP, or apply a
 * level. Real changes stay on the A6a controls (awardXp / applyLevelUp).
 */

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

// ─── XP progress projection (xpProgress) ─────────────────────────────────────
//
// For a character in XP mode at a given level with a given XP total, the
// advisor projects progress toward the NEXT level. Fields (all deterministic):
//   currentLevelXp   = xpForLevel(level)                         (threshold to BE this level)
//   nextLevelXp      = xpForLevel(level+1), or null at level 20
//   xpIntoLevel      = max(0, xp - currentLevelXp)
//   xpToNext         = max(0, nextLevelXp - xp), or null at 20
//   span             = nextLevelXp - currentLevelXp, or null at 20
//   fractionToNext   = span ? clamp01(xpIntoLevel / span) : 1    (0..1; 1 at cap)
//   earnedLevel      = the highest level whose threshold xp has reached (xpToLevel(xp))
//   levelsBehind     = max(0, earnedLevel - level)               (earned-but-unapplied)
//   atCap            = level >= 20
//
// fractionToNext is rounded to 4 decimals in the golden for comparison; the
// harness compares with a small tolerance.
export interface XpProgressCase {
  name: string;
  cite: string;
  level: number;
  xp: number;
  expect: {
    currentLevelXp: number;
    nextLevelXp: number | null;
    xpIntoLevel: number;
    xpToNext: number | null;
    span: number | null;
    fractionToNext: number;
    earnedLevel: number;
    levelsBehind: number;
    atCap: boolean;
  };
}

export const XP_PROGRESS_CASES: XpProgressCase[] = [
  {
    name: 'Level 1, 0 XP: start of the track',
    cite: 'Character Advancement table',
    level: 1,
    xp: 0,
    expect: {
      currentLevelXp: 0,
      nextLevelXp: 300,
      xpIntoLevel: 0,
      xpToNext: 300,
      span: 300,
      fractionToNext: 0,
      earnedLevel: 1,
      levelsBehind: 0,
      atCap: false,
    },
  },
  {
    name: 'Level 1, 150 XP: halfway to level 2',
    cite: 'Character Advancement table',
    level: 1,
    xp: 150,
    expect: {
      currentLevelXp: 0,
      nextLevelXp: 300,
      xpIntoLevel: 150,
      xpToNext: 150,
      span: 300,
      fractionToNext: 0.5,
      earnedLevel: 1,
      levelsBehind: 0,
      atCap: false,
    },
  },
  {
    name: 'Level 1, exactly 300 XP: level 2 earned but not applied',
    cite: 'Experience Points optional rule (equals-or-exceeds)',
    level: 1,
    xp: 300,
    expect: {
      currentLevelXp: 0,
      nextLevelXp: 300,
      xpIntoLevel: 300,
      xpToNext: 0,
      span: 300,
      fractionToNext: 1,
      earnedLevel: 2,
      levelsBehind: 1,
      atCap: false,
    },
  },
  {
    name: 'Level 1, 1000 XP: levels 2 and 3 both earned (multi-threshold)',
    cite: 'Experience Points optional rule; one level applied at a time',
    level: 1,
    xp: 1000,
    expect: {
      currentLevelXp: 0,
      nextLevelXp: 300,
      xpIntoLevel: 1000,
      xpToNext: 0,
      span: 300,
      fractionToNext: 1,
      earnedLevel: 3,
      levelsBehind: 2,
      atCap: false,
    },
  },
  {
    name: 'Level 4, 3000 XP: into level 4, 2700 earned, 4300 to level 5',
    cite: 'Character Advancement table',
    level: 4,
    xp: 3000,
    expect: {
      currentLevelXp: 2700,
      nextLevelXp: 6500,
      xpIntoLevel: 300,
      xpToNext: 3500,
      span: 3800,
      fractionToNext: 0.0789,
      earnedLevel: 4,
      levelsBehind: 0,
      atCap: false,
    },
  },
  {
    name: 'Level 5, 6500 XP: exactly at level-5 threshold, none earned beyond',
    cite: 'Character Advancement table (PB rises to +3 at 5)',
    level: 5,
    xp: 6500,
    expect: {
      currentLevelXp: 6500,
      nextLevelXp: 14000,
      xpIntoLevel: 0,
      xpToNext: 7500,
      span: 7500,
      fractionToNext: 0,
      earnedLevel: 5,
      levelsBehind: 0,
      atCap: false,
    },
  },
  {
    name: 'Level 19, 330000 XP: 25000 into level 19, 25000 to level 20 (span 50000)',
    cite: 'Character Advancement table',
    level: 19,
    xp: 330000,
    expect: {
      currentLevelXp: 305000,
      nextLevelXp: 355000,
      xpIntoLevel: 25000,
      xpToNext: 25000,
      span: 50000,
      fractionToNext: 0.5,
      earnedLevel: 19,
      levelsBehind: 0,
      atCap: false,
    },
  },
  {
    name: 'Level 20, 355000 XP: at the cap, no next level',
    cite: 'Character Advancement table (level cap 20)',
    level: 20,
    xp: 355000,
    expect: {
      currentLevelXp: 355000,
      nextLevelXp: null,
      xpIntoLevel: 0,
      xpToNext: null,
      span: null,
      fractionToNext: 1,
      earnedLevel: 20,
      levelsBehind: 0,
      atCap: true,
    },
  },
  {
    name: 'Level 20, 999999 XP: cap holds, no negative or overflow',
    cite: 'Character Advancement table (level cap 20)',
    level: 20,
    xp: 999999,
    expect: {
      currentLevelXp: 355000,
      nextLevelXp: null,
      xpIntoLevel: 644999,
      xpToNext: null,
      span: null,
      fractionToNext: 1,
      earnedLevel: 20,
      levelsBehind: 0,
      atCap: true,
    },
  },
  {
    name: 'Negative/garbage XP is treated as 0 (defensive)',
    cite: 'Defensive: XP floor at 0',
    level: 1,
    xp: -500,
    expect: {
      currentLevelXp: 0,
      nextLevelXp: 300,
      xpIntoLevel: 0,
      xpToNext: 300,
      span: 300,
      fractionToNext: 0,
      earnedLevel: 1,
      levelsBehind: 0,
      atCap: false,
    },
  },
];

// ─── Sessions-to-next projection (sessionsToNextLevel) ───────────────────────
//
// A UI-supplied XP-per-session rate projects how many sessions remain to reach
// the next level: ceil(xpToNext / rate). NOT a rulebook value — a planning aid.
//   - rate <= 0 or non-finite  → null (cannot project)
//   - xpToNext === 0 (next level already earned) → 0
//   - at level 20 (no next level) → null
export interface SessionsCase {
  name: string;
  cite: string;
  level: number;
  xp: number;
  xpPerSession: number;
  expect: number | null;
}

export const SESSIONS_CASES: SessionsCase[] = [
  { name: '150 XP into level 1, 50/session → 3 sessions', cite: 'ceil(150/50)', level: 1, xp: 150, xpPerSession: 50, expect: 3 },
  { name: '150 XP into level 1, 40/session → 4 sessions (ceil)', cite: 'ceil(150/40)=4', level: 1, xp: 150, xpPerSession: 40, expect: 4 },
  { name: 'Next level already earned → 0 sessions', cite: 'xpToNext 0', level: 1, xp: 300, xpPerSession: 50, expect: 0 },
  { name: 'Rate 0 → null (cannot project)', cite: 'rate <= 0', level: 1, xp: 150, xpPerSession: 0, expect: null },
  { name: 'Negative rate → null', cite: 'rate <= 0', level: 1, xp: 150, xpPerSession: -10, expect: null },
  { name: 'At level 20 → null (no next level)', cite: 'level cap', level: 20, xp: 355000, xpPerSession: 1000, expect: null },
];

// ─── Future feat/ASI + subclass slot projection (upcomingMilestones) ─────────
//
// From the character's current level, the planner projects the UPCOMING
// structural milestones at FUTURE levels (strictly greater than current, up to
// 20), read from the class feature table:
//   - featSlotLevels:  the asi-marker levels still ahead (PHB 2024: standard
//     4/8/12/16/19; Fighter also 6 and 14; Rogue also 10).
//   - subclassAhead:   true when the subclass-choice level (3 for every 2024
//     class) is still ahead of the current level.
//   - nextFeatSlotLevel: the first asi-marker level ahead, or null if none.
// These are expressed per class+level so the harness can build a real character.
export interface UpcomingCase {
  name: string;
  cite: string;
  classId: 'fighter' | 'rogue' | 'wizard' | 'cleric';
  level: number;
  expect: {
    featSlotLevelsAhead: number[];
    nextFeatSlotLevel: number | null;
    subclassAhead: boolean;
  };
}

export const UPCOMING_CASES: UpcomingCase[] = [
  {
    name: 'Fighter level 1: subclass at 3 ahead; feat slots 4,6,8,12,14,16,19 ahead',
    cite: 'Fighter ASI levels 4/6/8/12/14/16/19; subclass at 3',
    classId: 'fighter',
    level: 1,
    expect: {
      featSlotLevelsAhead: [4, 6, 8, 12, 14, 16, 19],
      nextFeatSlotLevel: 4,
      subclassAhead: true,
    },
  },
  {
    name: 'Fighter level 5: subclass already past; next feat slot at 6',
    cite: 'Fighter ASI levels; subclass at 3 is behind',
    classId: 'fighter',
    level: 5,
    expect: {
      featSlotLevelsAhead: [6, 8, 12, 14, 16, 19],
      nextFeatSlotLevel: 6,
      subclassAhead: false,
    },
  },
  {
    name: 'Rogue level 1: feat slots 4,8,10,12,16,19 ahead; subclass at 3 ahead',
    cite: 'Rogue ASI levels 4/8/10/12/16/19; subclass at 3',
    classId: 'rogue',
    level: 1,
    expect: {
      featSlotLevelsAhead: [4, 8, 10, 12, 16, 19],
      nextFeatSlotLevel: 4,
      subclassAhead: true,
    },
  },
  {
    name: 'Rogue level 9: next feat slot at 10 (the Rogue-only ASI)',
    cite: 'Rogue extra ASI at 10',
    classId: 'rogue',
    level: 9,
    expect: {
      featSlotLevelsAhead: [10, 12, 16, 19],
      nextFeatSlotLevel: 10,
      subclassAhead: false,
    },
  },
  {
    name: 'Wizard level 3: standard feat slots 4,8,12,16,19 ahead; subclass chosen',
    cite: 'Standard ASI levels 4/8/12/16/19; subclass at 3 is current/behind',
    classId: 'wizard',
    level: 3,
    expect: {
      featSlotLevelsAhead: [4, 8, 12, 16, 19],
      nextFeatSlotLevel: 4,
      subclassAhead: false,
    },
  },
  {
    name: 'Cleric level 16: only the level-19 Epic Boon slot ahead',
    cite: 'Standard ASI; only 19 remains',
    classId: 'cleric',
    level: 16,
    expect: {
      featSlotLevelsAhead: [19],
      nextFeatSlotLevel: 19,
      subclassAhead: false,
    },
  },
  {
    name: 'Wizard level 20: nothing ahead (at cap)',
    cite: 'Level cap 20',
    classId: 'wizard',
    level: 20,
    expect: {
      featSlotLevelsAhead: [],
      nextFeatSlotLevel: null,
      subclassAhead: false,
    },
  },
];

// ─── Deterministic suggestions (advisorSuggestions) ──────────────────────────
//
// The advisor emits a set of deterministic, READ-ONLY suggestion IDs for the
// character's current situation. Each is derived, never invented:
//   - 'choose-subclass'      : level >= the class subclass level (3) AND no
//                              subclass is recorded yet. (A choice the player
//                              owes; PHB 2024: subclass at level 3.)
//   - 'pending-feat-slot'    : at least one asi-marker slot at/below the current
//                              level has no feat selected (an open ASI/feat).
//   - 'can-level-up'         : canLevelUp(character) is true (milestone always
//                              below 20; XP when the next threshold is reached).
//   - 'level-earned-unapplied': XP mode AND levelsBehind >= 1 (XP sits above the
//                              next threshold; apply the pending level).
//   - 'pb-increases-next'    : the next level raises the Proficiency Bonus.
// The golden asserts the SET of IDs present/absent for each situation; order is
// not significant (the harness compares as a set).
export interface SuggestionCase {
  name: string;
  cite: string;
  classId: 'fighter' | 'rogue' | 'wizard' | 'cleric';
  level: number;
  mode: 'milestone' | 'xp';
  xp: number;
  /** Whether a subclass is recorded on the character. */
  hasSubclass: boolean;
  /** asi-marker levels at/below the current level that already have a feat. */
  filledFeatSlotLevels: number[];
  /** The suggestion IDs that MUST be present. */
  expectPresent: string[];
  /** The suggestion IDs that MUST be absent. */
  expectAbsent: string[];
}

export const SUGGESTION_CASES: SuggestionCase[] = [
  {
    // PB(3)=+2, PB(4)=+2 → 3→4 does NOT raise PB, so pb-increases-next is ABSENT.
    name: 'Fighter 3, milestone, no subclass → choose-subclass + can-level-up (no PB bump 3→4)',
    cite: 'Subclass at level 3; milestone permits level-up below 20; PB +2 at both 3 and 4',
    classId: 'fighter',
    level: 3,
    mode: 'milestone',
    xp: 0,
    hasSubclass: false,
    filledFeatSlotLevels: [],
    expectPresent: ['choose-subclass', 'can-level-up'],
    expectAbsent: ['pending-feat-slot', 'level-earned-unapplied', 'pb-increases-next'],
  },
  {
    name: 'Fighter 3, milestone, subclass chosen → no choose-subclass (no PB bump 3→4)',
    cite: 'Subclass already recorded; PB +2 at both 3 and 4',
    classId: 'fighter',
    level: 3,
    mode: 'milestone',
    xp: 0,
    hasSubclass: true,
    filledFeatSlotLevels: [],
    expectPresent: ['can-level-up'],
    expectAbsent: ['choose-subclass', 'pending-feat-slot', 'level-earned-unapplied', 'pb-increases-next'],
  },
  {
    // PB(4)=+2, PB(5)=+3 → 4→5 DOES raise PB, so pb-increases-next is PRESENT.
    name: 'Fighter 4, subclass chosen, feat slot unfilled → pending-feat-slot + PB bump 4→5',
    cite: 'asi-marker at 4 with no feat selected; PB +2 at 4, +3 at 5',
    classId: 'fighter',
    level: 4,
    mode: 'milestone',
    xp: 0,
    hasSubclass: true,
    filledFeatSlotLevels: [],
    expectPresent: ['pending-feat-slot', 'can-level-up', 'pb-increases-next'],
    expectAbsent: ['choose-subclass', 'level-earned-unapplied'],
  },
  {
    name: 'Fighter 4, subclass chosen, feat slot filled → no pending-feat-slot; PB bump 4→5',
    cite: 'asi-marker at 4 filled; PB +2 at 4, +3 at 5',
    classId: 'fighter',
    level: 4,
    mode: 'milestone',
    xp: 0,
    hasSubclass: true,
    filledFeatSlotLevels: [4],
    expectPresent: ['can-level-up', 'pb-increases-next'],
    expectAbsent: ['pending-feat-slot', 'choose-subclass', 'level-earned-unapplied'],
  },
  {
    name: 'Wizard 1, XP mode, 300 XP → level earned but unapplied + can-level-up',
    cite: 'XP >= level-2 threshold; one level applied at a time',
    classId: 'wizard',
    level: 1,
    mode: 'xp',
    xp: 300,
    hasSubclass: false,
    filledFeatSlotLevels: [],
    expectPresent: ['level-earned-unapplied', 'can-level-up'],
    expectAbsent: ['pending-feat-slot', 'choose-subclass'],
  },
  {
    name: 'Wizard 1, XP mode, 100 XP → cannot level up yet',
    cite: 'XP below level-2 threshold (300)',
    classId: 'wizard',
    level: 1,
    mode: 'xp',
    xp: 100,
    hasSubclass: false,
    filledFeatSlotLevels: [],
    expectPresent: [],
    expectAbsent: ['level-earned-unapplied', 'can-level-up', 'pending-feat-slot', 'choose-subclass'],
  },
  {
    name: 'Cleric 20, milestone → no can-level-up (at cap), no pb change',
    cite: 'Level cap 20; PB does not change past 20',
    classId: 'cleric',
    level: 20,
    mode: 'milestone',
    xp: 0,
    hasSubclass: true,
    filledFeatSlotLevels: [4, 8, 12, 16, 19],
    expectPresent: [],
    expectAbsent: ['can-level-up', 'pb-increases-next', 'pending-feat-slot', 'choose-subclass', 'level-earned-unapplied'],
  },
  {
    name: 'Rogue 4, milestone, next level (5) raises PB to +3 → pb-increases-next',
    cite: 'PB +2 at 4, +3 at 5',
    classId: 'rogue',
    level: 4,
    mode: 'milestone',
    xp: 0,
    hasSubclass: true,
    filledFeatSlotLevels: [4],
    expectPresent: ['pb-increases-next', 'can-level-up'],
    expectAbsent: ['pending-feat-slot', 'choose-subclass', 'level-earned-unapplied'],
  },
];
