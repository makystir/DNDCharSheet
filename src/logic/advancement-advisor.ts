/**
 * Advancement ADVISOR — the READ-ONLY XP/milestone progress projection and the
 * deterministic level-up suggestions (Stage A6c, D&D 5.5e / 2024).
 *
 * This module is a PURE projection over a `Character`: it computes an XP-progress
 * view, a sessions-to-next planning aid, and a set of deterministic suggestion
 * IDs the UI can render as short, PHB-cited prompts. It NEVER mutates the
 * character, awards XP, or applies a level — real changes stay on the Stage A6a
 * controls (awardXp / applyLevelUp). It invents no mechanics: every threshold
 * and bonus comes from the already-verified A6a engine (xpForLevel / xpToLevel /
 * canLevelUp / featSlotLevels) and abilities.ts (proficiencyBonus).
 *
 * The `deterministicAdvisorSource` boundary mirrors the WFRP source app's
 * progression-advisor seam (ProgressionAdvisorSource) so a later async /
 * LLM-backed advisor is a NON-BREAKING addition; the deterministic engine stays
 * the permanent offline default.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md), already verified by the A6a data:
 *  - Character Advancement table (L1982-2003): the total XP to BE each level and
 *    the Proficiency Bonus per level; level cap 20. (A6a's xpForLevel / xpToLevel
 *    own the table; this module only composes them.)
 *  - Experience Points (optional rule): reaching a threshold PERMITS a level; it
 *    never auto-levels, so XP can sit above several thresholds — the advisor
 *    reports how many levels are EARNED-but-unapplied.
 *  - Gaining a Level (L2011-2026): a level-up may open a feat/ASI slot (an
 *    asi-marker row) and adjusts PB at the table's breakpoints.
 *  - Subclass at level 3 for every 2024 class (the subclass-choice row).
 */

import type { Character } from '../types/character';
import type { TooltipContent } from './tooltip-content';
import { clampLevel, proficiencyBonus, MAX_LEVEL } from './abilities';
import { resolveClass } from './classes';
import { formatSigned } from './breakdown';
import {
  canLevelUp,
  characterXp,
  featSlotLevels,
  levelingMode,
  xpForLevel,
  xpToLevel,
} from './advancement';
import { characterFeats } from './feats';

// ─── XP-progress projection (xpProgress) ─────────────────────────────────────

/**
 * The XP-progress projection toward the NEXT level. All fields are deterministic
 * functions of (level, XP) against the A6a Character Advancement thresholds; at
 * the level cap the next-level fields are null and `atCap` is true. XP is floored
 * at 0 for negative/NaN inputs (defensive — matches the golden).
 */
export interface XpProgress {
  /** xpForLevel(level): the threshold to BE this level. */
  currentLevelXp: number;
  /** xpForLevel(level+1), or null at level 20. */
  nextLevelXp: number | null;
  /** max(0, xp - currentLevelXp). */
  xpIntoLevel: number;
  /** max(0, nextLevelXp - xp), or null at 20. */
  xpToNext: number | null;
  /** nextLevelXp - currentLevelXp, or null at 20. */
  span: number | null;
  /** clamp01(xpIntoLevel / span); 1 at the cap (no span). */
  fractionToNext: number;
  /** The highest level the XP total has reached (xpToLevel(xp)). */
  earnedLevel: number;
  /** max(0, earnedLevel - level): levels earned but not yet applied. */
  levelsBehind: number;
  /** level >= 20. */
  atCap: boolean;
}

/** XP floored at 0 for negative/NaN values (XP is never negative). */
function floorXp(xp: number): number {
  return Number.isFinite(xp) && xp > 0 ? xp : 0;
}

/** Clamp a fraction to the 0..1 range. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * The XP-progress projection for a character. READ-ONLY and deterministic.
 * Reuses xpForLevel / xpToLevel from A6a for every threshold (no table here).
 */
export function xpProgress(character: Character): XpProgress {
  const level = clampLevel(character.level);
  const xp = floorXp(characterXp(character));

  // PHB 2024 "Character Advancement" table (via A6a): threshold to BE this level.
  const currentLevelXp = xpForLevel(level);
  const atCap = level >= MAX_LEVEL;

  const nextLevelXp = atCap ? null : xpForLevel(level + 1);
  const xpIntoLevel = Math.max(0, xp - currentLevelXp);
  const xpToNext = nextLevelXp === null ? null : Math.max(0, nextLevelXp - xp);
  const span = nextLevelXp === null ? null : nextLevelXp - currentLevelXp;
  // At the cap there is no span, so progress is 1 (full). Otherwise clamp 0..1.
  // `span <= 0` is unreachable with the monotonic Character Advancement table
  // (each threshold strictly exceeds the previous); it can only arise from a
  // corrupted table, and is treated as full progress rather than dividing by 0.
  const fractionToNext = span === null || span <= 0 ? 1 : clamp01(xpIntoLevel / span);

  // PHB 2024 "Experience Points" (optional rule): the highest level the total has
  // reached; levels above the current one are earned but not yet applied.
  const earnedLevel = xpToLevel(xp);
  const levelsBehind = Math.max(0, earnedLevel - level);

  return {
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpToNext,
    span,
    fractionToNext,
    earnedLevel,
    levelsBehind,
    atCap,
  };
}

// ─── Sessions-to-next projection (sessionsToNextLevel) ───────────────────────

/**
 * How many sessions remain to reach the next level at a UI-supplied XP-per-
 * session rate: ceil(xpToNext / rate). NOT a rulebook value — a planning aid.
 *   - at the level cap (no next level) → null
 *   - rate <= 0 or non-finite → null (cannot project)
 *   - next level already earned (xpToNext === 0) → 0
 */
export function sessionsToNextLevel(
  character: Character,
  xpPerSession: number,
): number | null {
  const progress = xpProgress(character);
  if (progress.xpToNext === null) return null; // at the cap
  if (!Number.isFinite(xpPerSession) || xpPerSession <= 0) return null;
  if (progress.xpToNext === 0) return 0;
  return Math.ceil(progress.xpToNext / xpPerSession);
}

// ─── Deterministic suggestions (advisorSuggestions) ──────────────────────────

/** The deterministic suggestion IDs the advisor can emit. */
export type AdvisorSuggestionId =
  | 'choose-subclass'
  | 'pending-feat-slot'
  | 'can-level-up'
  | 'level-earned-unapplied'
  | 'pb-increases-next';

/**
 * One advisor suggestion: a stable ID plus short, PHB-cited, paraphrased content
 * for the UI to render (content-tooltips / rules-compliance licensing — no long
 * verbatim PHB text). READ-ONLY: the suggestion is a prompt toward the A6a
 * controls, never an action.
 */
export interface AdvisorSuggestion {
  id: AdvisorSuggestionId;
  /** A one-line summary for the list item. */
  title: string;
  /** Structured, cited explanation for a ContentTooltip. */
  content: TooltipContent;
}

/**
 * Whether a subclass is RECORDED on the character (a stored subclassId), as
 * distinct from resolveSubclass which is additionally level-gated. The
 * choose-subclass suggestion fires only at/above the subclass level, so at that
 * point a recorded id is exactly a resolvable subclass.
 */
function hasSubclassRecorded(character: Character): boolean {
  return character.class?.subclassId !== undefined;
}

/**
 * The asi-marker slot levels at/below the current level that have NO feat
 * selected yet (an open ASI/feat). Reuses A6a's featSlotLevels for the slot set
 * and the A6b feat selections (advancement.feats, matched by slot level).
 */
function unfilledFeatSlotLevels(character: Character): number[] {
  const feats = characterFeats(character);
  const filled = new Set(feats.map((f) => f.level));
  return featSlotLevels(character).filter((level) => !filled.has(level));
}

/**
 * The SET of deterministic suggestions for the character's current situation.
 * Order is not significant (the UI renders the list as-is; the golden compares
 * as a set). Each suggestion is derived, never invented:
 *  - 'choose-subclass'        : level >= subclass level (3) AND no subclass recorded.
 *  - 'pending-feat-slot'      : an asi-marker slot at/below the level has no feat.
 *  - 'can-level-up'           : A6a canLevelUp(character) is true.
 *  - 'level-earned-unapplied' : XP mode AND levelsBehind >= 1.
 *  - 'pb-increases-next'      : proficiencyBonus(level+1) > proficiencyBonus(level).
 */
export function advisorSuggestions(character: Character): AdvisorSuggestion[] {
  const level = clampLevel(character.level);
  const cls = resolveClass(character);
  const suggestions: AdvisorSuggestion[] = [];

  // 'choose-subclass' — PHB 2024: a subclass is chosen at the class's subclass
  // level (3 for every 2024 class) and is a choice the player owes until made.
  if (cls !== undefined && level >= cls.subclassLevel && !hasSubclassRecorded(character)) {
    suggestions.push({
      id: 'choose-subclass',
      title: 'Choose a subclass',
      content: {
        title: 'Subclass choice',
        sections: [
          {
            label: 'Rule',
            text: `You reach the subclass level (${cls.subclassLevel}) but have not recorded a ${cls.name} subclass yet (PHB 2024 "${cls.name}: ${cls.name} Subclass").`,
          },
        ],
      },
    });
  }

  // 'pending-feat-slot' — an asi-marker slot already gained has no feat chosen.
  const unfilled = unfilledFeatSlotLevels(character);
  if (unfilled.length > 0) {
    const levelsText = unfilled.join(', ');
    suggestions.push({
      id: 'pending-feat-slot',
      title: unfilled.length === 1 ? `Choose a feat for level ${levelsText}` : `Choose feats for levels ${levelsText}`,
      content: {
        title: 'Open feat / ASI slot',
        sections: [
          {
            label: 'Rule',
            text: `An Ability Score Improvement slot is open with no feat selected (levels ${levelsText}). Take the Ability Score Improvement feat or another you qualify for (PHB 2024 "Ability Score Improvement").`,
          },
        ],
      },
    });
  }

  // 'can-level-up' — A6a canLevelUp (milestone below 20; XP at the next threshold).
  if (canLevelUp(character)) {
    suggestions.push({
      id: 'can-level-up',
      title: 'You can level up',
      content: {
        title: 'Level up available',
        sections: [
          {
            label: 'Rule',
            text:
              levelingMode(character) === 'xp'
                ? 'Your XP total has reached the next level\u2019s threshold — apply the level on the controls above (PHB 2024 "Character Advancement").'
                : 'Milestone mode: the DM may grant the next level now (PHB 2024 "Character Advancement").',
          },
        ],
      },
    });
  }

  // 'level-earned-unapplied' — XP mode with XP sitting above the next threshold.
  const progress = xpProgress(character);
  if (levelingMode(character) === 'xp' && progress.levelsBehind >= 1) {
    suggestions.push({
      id: 'level-earned-unapplied',
      title: `Level ${progress.earnedLevel} earned but not applied`,
      content: {
        title: 'Earned level pending',
        sections: [
          {
            label: 'Rule',
            text: `Your XP (${progress.earnedLevel >= MAX_LEVEL ? 'at the cap' : 'above the next threshold'}) has earned level ${progress.earnedLevel}, but a level is applied one at a time (PHB 2024 "Experience Points").`,
          },
        ],
      },
    });
  }

  // 'pb-increases-next' — the next level raises the Proficiency Bonus.
  if (level < MAX_LEVEL) {
    const currentPb = proficiencyBonus(level);
    const nextPb = proficiencyBonus(level + 1);
    if (nextPb > currentPb) {
      suggestions.push({
        id: 'pb-increases-next',
        title: `Next level raises your Proficiency Bonus (${formatSigned(currentPb)} \u2192 ${formatSigned(nextPb)})`,
        content: {
          title: 'Proficiency Bonus increase',
          sections: [
            {
              label: 'Rule',
              text: `Leveling to ${level + 1} raises your Proficiency Bonus from ${formatSigned(currentPb)} to ${formatSigned(nextPb)} (PHB 2024 "Character Advancement").`,
            },
            {
              // PHB 2024 "Character Advancement" table: PB = 2 + floor((level − 1) / 4).
              label: 'Formula',
              text: `Proficiency Bonus = 2 + floor((level − 1) ÷ 4): level ${level} → ${formatSigned(currentPb)}, level ${level + 1} → ${formatSigned(nextPb)}.`,
            },
          ],
        },
      });
    }
  }

  return suggestions;
}

// ─── Future-proofing source boundary ─────────────────────────────────────────

/**
 * The advisor's result bundle for a single character (the deterministic
 * engine's complete output). Grouped so a later source implementation returns
 * one shape.
 */
export interface AdvisorResult {
  progress: XpProgress;
  suggestions: AdvisorSuggestion[];
}

/**
 * Future-proofing boundary mirroring the WFRP source app's
 * ProgressionAdvisorSource. The return type is sync-or-async so an LLM-backed
 * source is a non-breaking add; the deterministic default is ALWAYS synchronous
 * and the permanent offline fallback.
 */
export interface AdvisorSource {
  advise(character: Character): AdvisorResult | Promise<AdvisorResult>;
}

export const deterministicAdvisorSource: AdvisorSource = {
  advise: (character) => ({
    progress: xpProgress(character),
    suggestions: advisorSuggestions(character),
  }),
};
