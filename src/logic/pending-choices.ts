/**
 * Everything the character still owes at the current level, in one place.
 *
 * The Advancement page renders these as its "Choices Pending" list, and the
 * navigation reads `total` for the badge on the Advancement tab, so both always
 * agree. Nothing here is a game rule: each part comes from the logic module that
 * owns it (feat slots, expertise, class choices, spell picks, ...).
 */

import type { Character } from '../types/character';
import { clampLevel } from './abilities';
import { resolveClass, resolveSubclass } from './classes';
import { featSlotAssignments, fightingStyleSlots } from './feats';
import { featSlotLevels } from './advancement';
import { expertiseStatus } from './expertise';
import { languagePicksStatus } from './language-picks';
import { choiceStatus } from './class-choices';
import { pendingMulticlassPicks } from './multiclass-picks';
import { pendingSpellPicks } from './spell-picks-pending';
import { illegalSpellSelections } from './spellcasting';

export interface PendingChoices {
  /** Fighting Style feats not yet chosen (one per class with the feature). */
  unfilledFightingStyles: ReturnType<typeof fightingStyleSlots>;
  /** Levels with an open feat / Ability Score Improvement slot. */
  unfilledFeatLevels: number[];
  /** A subclass is due (level reached, none chosen). */
  subclassDue: boolean;
  /** Levels 2+ with no recorded Hit Point choice. */
  unrecordedHpLevels: number[];
  expertise: ReturnType<typeof expertiseStatus>;
  languagePicks: ReturnType<typeof languagePicksStatus>;
  classChoices: ReturnType<typeof choiceStatus>;
  pendingClassChoiceCount: number;
  pendingMulticlassCount: number;
  spellPicks: ReturnType<typeof pendingSpellPicks>;
  illegalSpells: ReturnType<typeof illegalSpellSelections>;
  /** The number of owed items (what the page heading and the nav badge show). */
  total: number;
}

/** Collects every owed choice for a character. */
export function pendingChoices(character: Character): PendingChoices {
  const cls = resolveClass(character);
  const subclass = resolveSubclass(character);
  const level = clampLevel(character.level);

  const unfilledFeatLevels = featSlotAssignments(character, featSlotLevels(character))
    .filter((a) => a.filled === undefined)
    .map((a) => a.level);
  const subclassDue = cls !== undefined && level >= cls.subclassLevel && subclass === undefined;
  const recordedHpLevels = new Set(
    (character.advancement?.levels ?? []).filter((l) => l.hp !== undefined).map((l) => l.level),
  );
  const unrecordedHpLevels: number[] = [];
  for (let l = 2; l <= level; l += 1) {
    if (!recordedHpLevels.has(l)) unrecordedHpLevels.push(l);
  }
  // Expertise owed by class features counts as one item (the picker is inline).
  const expertise = expertiseStatus(character);
  // Feature languages owed (Rogue L1 Thieves' Cant, Ranger L2 Deft Explorer): one item.
  const languagePicks = languagePicksStatus(character);
  // Class-feature choices (Metamagic, Invocations, Maneuvers, ...) and multiclass
  // skill / instrument picks: one item per group.
  const classChoices = choiceStatus(character);
  const pendingClassChoiceCount = classChoices.filter((s) => s.remaining > 0).length;
  const pendingMulticlassCount = pendingMulticlassPicks(character).length;
  // Owed spell picks, made on the Spells page.
  const spellPicks = pendingSpellPicks(character);
  // Stored spells that are not on the class's spell list (import / class change).
  const illegalSpells = illegalSpellSelections(character);
  // A class with the Fighting Style feature that has not picked its feat yet.
  const unfilledFightingStyles = fightingStyleSlots(character).filter((s) => s.filled === undefined);

  const total =
    unfilledFightingStyles.length +
    unfilledFeatLevels.length +
    (subclassDue ? 1 : 0) +
    unrecordedHpLevels.length +
    (expertise.remaining > 0 ? 1 : 0) +
    (languagePicks.remaining > 0 ? 1 : 0) +
    pendingClassChoiceCount +
    pendingMulticlassCount +
    spellPicks.length +
    (illegalSpells.length > 0 ? 1 : 0);

  return {
    unfilledFightingStyles,
    unfilledFeatLevels,
    subclassDue,
    unrecordedHpLevels,
    expertise,
    languagePicks,
    classChoices,
    pendingClassChoiceCount,
    pendingMulticlassCount,
    spellPicks,
    illegalSpells,
    total,
  };
}

/** Just the count of owed items, for the navigation badge. */
export function pendingChoiceCount(character: Character): number {
  return pendingChoices(character).total;
}
