/**
 * Starting choices & the "finish setting up" checklist (D&D 5.5e / 2024).
 *
 * Pure logic. Reads the existing class data (src/data/classes.ts) and the
 * existing per-class cantrip / prepared caps (src/logic/spellcasting.ts) — no
 * tables are duplicated here. The one number that had no home before is the
 * Wizard spellbook size, cited below.
 *
 * PHB 2024 Chapter 3 "Core <Class> Traits": the class grants two Saving Throw
 * Proficiencies automatically and a "Skill Proficiencies" choice (pick N from a
 * list, or any for the Bard). Spellcasting classes pick cantrips and prepare
 * level 1+ spells (Chapter 3 "<Class> Features" table, Cantrips / Prepared
 * Spells columns).
 */

import type { Ability, Character, ClassEntry, SkillId } from '../types/character';
import { extraCantrips } from './class-choice-effects';
import { getClass } from '../data/classes';
import type { ClassId } from '../data/classes';
import { SKILLS } from '../types/character';
import { getSpell } from '../data/spells';
import type { SpellId } from '../data/spells';
import { primaryClass, allClasses } from './classes';
import { EXPERTISE_GRANTS, expertiseStatus } from './expertise';
import { languagePicksStatus } from './language-picks';
import { levelOneLanguageClassIds } from './languages';
import {
  classAlwaysPreparedSpells,
  classCantripListClassIds,
  classCantripsKnown,
  classMaxPreparedLevel,
  classPreparedCount,
  classRequiredCantrips,
  classSpellListClassIds,
  classUsesSpellbook,
  entryIsSpellcaster,
} from './spellcasting';

/**
 * The Wizard spellbook size at a given Wizard level.
 * PHB 2024 Wizard "Spellbook" (L7404-7409): it starts with six level 1 spells,
 * and "whenever you gain a Wizard level after 1, add two Wizard spells".
 */
export function wizardSpellbookSize(wizardLevel: number): number {
  return 6 + 2 * Math.max(0, wizardLevel - 1);
}

/** What a class asks the player to choose at character creation (level 1). */
export interface StartingChoices {
  /** Class skill picks (PHB Core <Class> Traits "Skill Proficiencies"). */
  skills: { count: number; from: SkillId[] | 'any' };
  /** The two saves granted automatically (never chosen). */
  savingThrows: [Ability, Ability];
  /** Level-1 spell picks, or null when the class has no level-1 spellcasting. */
  spells: { cantrips: number; prepared: number; spellbook: number | null } | null;
}

/** The level-1 starting choices for a class id, or undefined for an unknown id. */
export function startingChoicesFor(classId: string): StartingChoices | undefined {
  const data = getClass(classId);
  if (!data) return undefined;
  const entry: ClassEntry = { id: data.id as ClassId, level: 1 };
  const casts = entryIsSpellcaster(entry);
  return {
    skills: { count: data.skillChoices.count, from: data.skillChoices.from },
    savingThrows: data.savingThrows,
    spells: casts
      ? {
          cantrips: classCantripsKnown(entry),
          prepared: classPreparedCount(entry),
          spellbook: classUsesSpellbook(entry) ? wizardSpellbookSize(1) : null,
        }
      : null,
  };
}

export type PendingKind = 'class-skills' | 'cantrips' | 'spellbook' | 'prepared';

export interface PendingItem {
  kind: PendingKind;
  have: number;
  need: number;
  /** Set only for multiclass characters, to name the class the item belongs to. */
  classId?: ClassId;
  className?: string;
}

/** Counts distinct ids that satisfy `valid`. */
function countValid<T>(ids: readonly T[] | undefined, valid: (id: T) => boolean): number {
  return new Set((ids ?? []).filter(valid)).size;
}

/**
 * The "finish setting up" checklist: groups still short of what the class asks
 * for, in the order class-skills, cantrips, spellbook, prepared (a Wizard fills
 * the spellbook first because it prepares FROM it — PHB Wizard "Spellcasting").
 * Groups the class lacks never appear and complete groups are omitted.
 *
 * - Class skills: the INITIAL class only (PHB "Multiclassing: Proficiencies",
 *   L2106). Skills granted by a later multiclass entry are out of scope.
 * - Spells: one item per caster class per group, each judged against that
 *   class's own caps at its own class level (PHB "Multiclassing: Spellcasting",
 *   L2119) — the same caps the Spells page uses.
 * - Only valid, distinct picks count: skills must be on the class list; spells
 *   must exist, be of a castable level and be on the class's list. Always-
 *   prepared feature spells never count against the prepared cap (Spells page).
 */
export function pendingSetupChoices(character: Character): PendingItem[] {
  const items: PendingItem[] = [];
  const classes = allClasses(character);
  const multi = classes.length >= 2;

  const initial = primaryClass(character);
  const initialData = getClass(initial?.id);
  if (initial && initialData) {
    const { count, from } = initialData.skillChoices;
    const allowed: readonly SkillId[] = from === 'any' ? SKILLS.map((s) => s.id) : from;
    const have = countValid(initial.skillChoices, (id) => allowed.includes(id));
    if (have < count) {
      items.push({
        kind: 'class-skills',
        have,
        need: count,
        ...(multi ? { classId: initialData.id as ClassId, className: initialData.name } : {}),
      });
    }
  }

  const perClassItems: Record<'cantrips' | 'spellbook' | 'prepared', PendingItem[]> = {
    cantrips: [],
    spellbook: [],
    prepared: [],
  };
  for (const entry of classes) {
    const data = getClass(entry.id);
    if (!data || !entryIsSpellcaster(entry)) continue;
    const stored = character.spellcasting?.byClass?.[entry.id] ?? {};
    const label = multi ? { classId: data.id as ClassId, className: data.name } : {};
    const topLevel = classMaxPreparedLevel(entry);
    const leveledLists = new Set(classSpellListClassIds(entry));
    const cantripLists = new Set(classCantripListClassIds(entry));
    const onLists = (id: SpellId, lists: Set<string>) =>
      getSpell(id)?.classes.some((c) => lists.has(c)) ?? false;
    const legalLeveled = (id: SpellId) => {
      const spell = getSpell(id);
      return (
        spell !== undefined && spell.level >= 1 && spell.level <= topLevel && onLists(id, leveledLists)
      );
    };

    // Cantrips (required ones, e.g. Arcane Trickster's Mage Hand, always count).
    const cantripNeed = classCantripsKnown(entry, extraCantrips(character, entry.id));
    if (cantripNeed > 0) {
      const required = classRequiredCantrips(entry);
      const picks = [...required, ...(stored.cantrips ?? [])];
      const have = countValid(picks, (id) => {
        const spell = getSpell(id);
        return spell?.level === 0 && (required.includes(id) || onLists(id, cantripLists));
      });
      if (have < cantripNeed) {
        perClassItems.cantrips.push({ kind: 'cantrips', have, need: cantripNeed, ...label });
      }
    }

    // Wizard spellbook.
    const book = new Set<SpellId>();
    const usesBook = classUsesSpellbook(entry);
    if (usesBook) {
      const need = wizardSpellbookSize(entry.level);
      const have = countValid(stored.spellbook, (id) => {
        const ok = legalLeveled(id);
        if (ok) book.add(id);
        return ok;
      });
      if (have < need) {
        perClassItems.spellbook.push({ kind: 'spellbook', have, need, ...label });
      }
    }

    // Prepared spells (a spellbook class prepares only from its book).
    const preparedNeed = classPreparedCount(entry);
    if (preparedNeed > 0) {
      const always = classAlwaysPreparedSpells(entry);
      const have = countValid(
        stored.prepared,
        (id) => !always.includes(id) && legalLeveled(id) && (!usesBook || book.has(id)),
      );
      if (have < preparedNeed) {
        perClassItems.prepared.push({ kind: 'prepared', have, need: preparedNeed, ...label });
      }
    }
  }

  items.push(...perClassItems.cantrips, ...perClassItems.spellbook, ...perClassItems.prepared);
  return items;
}

export type FeaturePickKind = 'expertise' | 'languages';

export interface FeaturePickItem {
  kind: FeaturePickKind;
  have: number;
  need: number;
  /** Class whose level 1 feature opens the item; set for multiclass characters only. */
  classId?: ClassId;
  className?: string;
}

/**
 * Class-feature picks for the "finish setting up" checklist: Expertise and
 * feature languages, in that order. Counts come from expertiseStatus
 * (logic/expertise.ts) and languagePicksStatus (logic/language-picks.ts), the same
 * functions the Advancement "Choices Pending" list uses, so the two never
 * disagree.
 *
 * Scope is setup: an item is listed only when the character has a LEVEL 1 class
 * feature that grants the pick (Rogue Expertise, PHB 2024 L5882-5884; Rogue
 * Thieves' Cant, L5873-5898). Picks from level 2+ features (Bard/Wizard/Ranger
 * Expertise, Deft Explorer) appear on the Advancement page. The counts are shared
 * pools, so the item shows pooled have/need. Picks beyond the grant never keep an
 * item open.
 */
export function pendingFeaturePicks(character: Character): FeaturePickItem[] {
  const items: FeaturePickItem[] = [];
  const multi = allClasses(character).length >= 2;
  const label = (classId: string | undefined) => {
    const data = classId ? getClass(classId) : undefined;
    return multi && data ? { classId: data.id as ClassId, className: data.name } : {};
  };

  const expertise = expertiseStatus(character);
  const expertiseOpener = allClasses(character).find((e) =>
    EXPERTISE_GRANTS.some((g) => g.classId === e.id && g.level === 1),
  );
  if (expertiseOpener && expertise.remaining > 0) {
    items.push({ kind: 'expertise', have: expertise.chosen, need: expertise.owed, ...label(expertiseOpener.id) });
  }

  const languages = languagePicksStatus(character);
  const [languageOpener] = levelOneLanguageClassIds(character);
  if (languageOpener && languages.remaining > 0) {
    items.push({ kind: 'languages', have: languages.chosen, need: languages.owed, ...label(languageOpener) });
  }
  return items;
}
