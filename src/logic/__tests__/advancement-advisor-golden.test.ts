/**
 * Golden-table HARNESS for Stage A6c: the XP/milestone advisor + level-up
 * planner.
 *
 * Maps EVERY row of the four golden groups (advancement-advisor-golden.ts —
 * authored by the orchestrator from the PHB 2024 text, NEVER edited here) onto
 * the real A6c API and asserts each expected field:
 *   - XP_PROGRESS_CASES  → xpProgress
 *   - SESSIONS_CASES     → sessionsToNextLevel
 *   - SUGGESTION_CASES   → advisorSuggestions (compared as a SET of IDs)
 *   - UPCOMING_CASES     → upcomingMilestones
 *
 * Real characters are built from the existing character factory plus direct
 * advancement-field writes (XP, leveling mode, subclass, filled feat slots) —
 * the same style the A6a/A6b harnesses use. The advisor/planner are READ-ONLY,
 * so no awardXp / applyLevelUp mutation is needed to reach the input states.
 */
import { describe, it, expect } from 'vitest';
import type { Character, FeatSelection } from '../../types/character';
import type { ClassId, SubclassId } from '../../data/classes';
import type { FeatId } from '../../data/feats';
import { createCharacter } from '../../storage/character-store';
import {
  advisorSuggestions,
  sessionsToNextLevel,
  xpProgress,
  deterministicAdvisorSource,
  type AdvisorSuggestionId,
} from '../advancement-advisor';
import { upcomingMilestones } from '../advancement-planner';
import {
  SESSIONS_CASES,
  SUGGESTION_CASES,
  UPCOMING_CASES,
  XP_PROGRESS_CASES,
} from './advancement-advisor-golden';

// ─── Character builders ──────────────────────────────────────────────────────

/** A valid recorded subclass id per class (for the hasSubclass cases). */
const SUBCLASS_BY_CLASS: Record<string, SubclassId> = {
  fighter: 'champion',
  rogue: 'thief',
  wizard: 'evoker',
  cleric: 'life',
};

/** A character at `level` in `classId` with an optional XP/milestone mode. */
function charWith(
  classId: string,
  level: number,
  opts?: {
    mode?: 'milestone' | 'xp';
    xp?: number;
    hasSubclass?: boolean;
    filledFeatSlotLevels?: number[];
  },
): Character {
  const c = createCharacter('T');
  c.level = level;
  if (classId !== '') {
    c.classes = [{ id: classId as ClassId, level, skillChoices: [] }];
    if (opts?.hasSubclass) {
      c.classes[0].subclassId = SUBCLASS_BY_CLASS[classId];
    }
  }

  const feats: FeatSelection[] = (opts?.filledFeatSlotLevels ?? []).map((slotLevel) => ({
    // Any catalog feat fills the slot; the advisor only checks slot occupancy by
    // level, not the feat identity.
    featId: 'ability-score-improvement' as FeatId,
    level: slotLevel,
  }));

  if (opts?.mode !== undefined || opts?.xp !== undefined || feats.length > 0) {
    c.advancement = {
      ...(feats.length > 0 ? { feats } : {}),
      ...(opts?.mode !== undefined || opts?.xp !== undefined
        ? { leveling: { mode: opts?.mode ?? 'milestone', xp: opts?.xp } }
        : {}),
    };
  }

  return c;
}

/** A character at `level` in XP mode with `xp` recorded (XP-progress cases). */
function xpChar(level: number, xp: number): Character {
  const c = createCharacter('T');
  c.level = level;
  // Any class works for the XP math; use wizard. The progress projection reads
  // only level + XP, both independent of class.
  c.classes = [{ id: 'wizard', level, skillChoices: [] }];
  c.advancement = { leveling: { mode: 'xp', xp } };
  return c;
}

// ─── XP_PROGRESS_CASES → xpProgress ──────────────────────────────────────────

describe('XP_PROGRESS_CASES golden harness (xpProgress)', () => {
  it.each(XP_PROGRESS_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const progress = xpProgress(xpChar(tc.level, tc.xp));
    expect(progress.currentLevelXp).toBe(tc.expect.currentLevelXp);
    expect(progress.nextLevelXp).toBe(tc.expect.nextLevelXp);
    expect(progress.xpIntoLevel).toBe(tc.expect.xpIntoLevel);
    expect(progress.xpToNext).toBe(tc.expect.xpToNext);
    expect(progress.span).toBe(tc.expect.span);
    // fractionToNext is rounded to 4 dp in the golden; compare with a tolerance.
    expect(progress.fractionToNext).toBeCloseTo(tc.expect.fractionToNext, 4);
    expect(progress.earnedLevel).toBe(tc.expect.earnedLevel);
    expect(progress.levelsBehind).toBe(tc.expect.levelsBehind);
    expect(progress.atCap).toBe(tc.expect.atCap);
  });

  it('consumes every XP_PROGRESS_CASES row', () => {
    expect(XP_PROGRESS_CASES.length).toBeGreaterThan(0);
  });
});

// ─── SESSIONS_CASES → sessionsToNextLevel ────────────────────────────────────

describe('SESSIONS_CASES golden harness (sessionsToNextLevel)', () => {
  it.each(SESSIONS_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const result = sessionsToNextLevel(xpChar(tc.level, tc.xp), tc.xpPerSession);
    expect(result).toBe(tc.expect);
  });

  it('consumes every SESSIONS_CASES row', () => {
    expect(SESSIONS_CASES.length).toBeGreaterThan(0);
  });
});

// ─── SUGGESTION_CASES → advisorSuggestions (set comparison) ──────────────────

describe('SUGGESTION_CASES golden harness (advisorSuggestions as a set)', () => {
  it.each(SUGGESTION_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const character = charWith(tc.classId, tc.level, {
      mode: tc.mode,
      xp: tc.xp,
      hasSubclass: tc.hasSubclass,
      filledFeatSlotLevels: tc.filledFeatSlotLevels,
    });
    const ids = new Set<AdvisorSuggestionId>(advisorSuggestions(character).map((s) => s.id));

    for (const present of tc.expectPresent) {
      expect(ids.has(present as AdvisorSuggestionId)).toBe(true);
    }
    for (const absent of tc.expectAbsent) {
      expect(ids.has(absent as AdvisorSuggestionId)).toBe(false);
    }
  });

  it('consumes every SUGGESTION_CASES row', () => {
    expect(SUGGESTION_CASES.length).toBeGreaterThan(0);
  });
});

// ─── UPCOMING_CASES → upcomingMilestones ─────────────────────────────────────

describe('UPCOMING_CASES golden harness (upcomingMilestones)', () => {
  it.each(UPCOMING_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const milestones = upcomingMilestones(charWith(tc.classId, tc.level));
    expect(milestones.featSlotLevelsAhead).toEqual(tc.expect.featSlotLevelsAhead);
    expect(milestones.nextFeatSlotLevel).toBe(tc.expect.nextFeatSlotLevel);
    expect(milestones.subclassAhead).toBe(tc.expect.subclassAhead);
  });

  it('consumes every UPCOMING_CASES row', () => {
    expect(UPCOMING_CASES.length).toBeGreaterThan(0);
  });
});

// ─── deterministicAdvisorSource seam ─────────────────────────────────────────

describe('deterministicAdvisorSource mirrors the direct functions', () => {
  it('returns the same progress + suggestions synchronously', () => {
    const character = charWith('fighter', 4, { hasSubclass: true });
    const result = deterministicAdvisorSource.advise(character);
    // The deterministic source is always synchronous (the permanent default).
    expect(result).not.toBeInstanceOf(Promise);
    const sync = result as { progress: ReturnType<typeof xpProgress>; suggestions: ReturnType<typeof advisorSuggestions> };
    expect(sync.progress).toEqual(xpProgress(character));
    expect(sync.suggestions.map((s) => s.id)).toEqual(advisorSuggestions(character).map((s) => s.id));
  });
});
