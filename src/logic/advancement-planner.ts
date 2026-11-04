/**
 * Advancement PLANNER — the READ-ONLY projection of UPCOMING level-up
 * milestones (Stage A6c, D&D 5.5e / 2024).
 *
 * This module is a PURE projection over a `Character`: from the current level it
 * reports the future feat/ASI slot levels, the next such level, and whether the
 * subclass choice is still ahead. It NEVER mutates the character, awards XP, or
 * applies a level — real changes stay on the Stage A6a controls. The structural
 * milestones are read from the class feature table (classFeaturesByLevel), never
 * hard-coded per class (rules-compliance: no invented mechanics).
 *
 * Mirrors the WFRP source app's advancement-planner seam (a read-only "what is
 * ahead" projection) in SHAPE only; the WFRP career-climb/XP-spend machinery
 * does not port — D&D advancement is far simpler.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md), already verified by the A6a data:
 *  - Gaining a Level + the class features tables: asi-marker rows (standard
 *    classes 4/8/12/16/19; Fighter also 6 and 14; Rogue also 10 — the level-19
 *    row is the Epic Boon slot) and the subclass-choice row (level 3 for every
 *    2024 class). Level cap 20.
 */

import type { Character } from '../types/character';
import type { ClassFeature } from '../data/classes';
import { clampLevel, MAX_LEVEL } from './abilities';
import { classFeaturesByLevel, resolveClass } from './classes';

/**
 * The upcoming structural milestones strictly AHEAD of the current level, read
 * from the class feature table. Empty / null / false when nothing is ahead (at
 * the cap, or no class).
 */
export interface UpcomingMilestones {
  /** asi-marker levels strictly greater than the current level, ascending. */
  featSlotLevelsAhead: number[];
  /** The first asi-marker level ahead, or null when none remain. */
  nextFeatSlotLevel: number | null;
  /** The subclass-choice level (3) is strictly greater than the current level. */
  subclassAhead: boolean;
}

/**
 * The upcoming feat/ASI + subclass milestones for the character. READ-ONLY and
 * deterministic. Reads asi-marker and subclass-choice rows from
 * classFeaturesByLevel (never hard-coded); returns an empty projection at the
 * level cap or when no class is selected.
 */
export function upcomingMilestones(character: Character): UpcomingMilestones {
  const level = clampLevel(character.level);
  const cls = resolveClass(character);

  // No class → nothing structural to project (Hit Dice still track level, but
  // feat slots / subclass come from the class feature table).
  if (cls === undefined || level >= MAX_LEVEL) {
    return { featSlotLevelsAhead: [], nextFeatSlotLevel: null, subclassAhead: false };
  }

  const byLevel = classFeaturesByLevel(character);

  // PHB 2024: asi-marker rows strictly above the current level, ascending.
  const featSlotLevelsAhead: number[] = [];
  for (const [featureLevel, features] of byLevel) {
    if (featureLevel <= level) continue;
    if (features.some((f: ClassFeature) => f.kind === 'asi-marker')) {
      featSlotLevelsAhead.push(featureLevel);
    }
  }
  featSlotLevelsAhead.sort((a, b) => a - b);

  const nextFeatSlotLevel = featSlotLevelsAhead.length > 0 ? featSlotLevelsAhead[0] : null;

  // PHB 2024: the subclass is chosen at the class's subclass level; it is "ahead"
  // only while the current level is below it.
  const subclassAhead = level < cls.subclassLevel;

  return { featSlotLevelsAhead, nextFeatSlotLevel, subclassAhead };
}
