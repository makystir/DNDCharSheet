/**
 * Multiclassing — the PREREQUISITE check + the house-rule UI decision (Stage M4,
 * D&D 5.5e / 2024). Pure functions over a character's classes and effective
 * ability scores; none mutate their input.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md), verified before implementing:
 *  - Multiclassing: Prerequisites (PHB L2082): to take a level in a NEW class you
 *    must have a score of at least 13 in the PRIMARY ABILITY of the new class AND
 *    of every class you ALREADY have. The AND/OR shape per class is the explicit
 *    `multiclassPrereq` on ClassData (Fighter = Str OR Dex; Monk/Ranger = Dex AND
 *    Wis; Paladin = Str AND Cha; single-primary classes need that one ability).
 *  - The check reads EFFECTIVE ability scores (post-feat), mirroring canTakeFeat
 *    (feats.ts) — a feat that raised a score counts toward the prereq.
 *  - You cannot "multiclass INTO" a class you already have; that is normal
 *    advancement, not a multiclass (reported as reason 'already-have-class').
 *  - HOUSE RULE houseRules.allowIllegalMulticlass (declared M1, default off =
 *    RAW): when ON, a failed ABILITY prereq is PERMITTED with a warning; when OFF
 *    it is blocked. It NEVER overrides the already-have-class rule.
 */

import type { Ability, Character } from '../types/character';
import type { ClassData, ClassId } from '../data/classes';
import { getClass } from '../data/classes';
import { effectiveAbilityScores } from './feats';
import { allClasses } from './classes';

/** The RAW minimum score for a multiclass primary-ability prereq (PHB L2082). */
const PREREQ_MIN_SCORE = 13;

/**
 * Whether a single class's `multiclassPrereq` shape is satisfied by the given
 * scores (PHB L2082). `all` = every listed ability >= 13; `any` = at least one.
 * Returns the abilities that FAILED (empty when satisfied), so callers can
 * report which scores blocked the multiclass. For an `all` shape every
 * below-13 ability is a failure; for an `any` shape NONE satisfying means every
 * listed ability is reported as failing (the whole OR could not be met).
 */
function failingAbilitiesFor(
  data: ClassData,
  scores: Record<Ability, number>,
): Ability[] {
  const { all, any } = data.multiclassPrereq;
  if (any && any.length > 0) {
    const met = any.some((ability) => scores[ability] >= PREREQ_MIN_SCORE);
    return met ? [] : [...any];
  }
  const required = all ?? [];
  return required.filter((ability) => scores[ability] < PREREQ_MIN_SCORE);
}

/** The outcome of the RAW multiclass-prereq check for a target class. */
export interface CanMulticlassResult {
  /** True when the RAW prerequisite is satisfied and the class is not held. */
  ok: boolean;
  /** Why it failed, when it did (absent when ok). */
  reason?: 'prereq' | 'already-have-class';
  /**
   * Abilities below 13 (for an `all` shape) or the whole unmet OR group (for an
   * `any` shape) that caused a 'prereq' failure. Compared as a set; absent/empty
   * for ok or already-have-class.
   */
  failing?: Ability[];
}

/**
 * The RAW multiclass-prerequisite check for adding a level in `newClassId`
 * (PHB 2024 "Multiclassing: Prerequisites", L2082). Reports the RAW result
 * REGARDLESS of the house-rule toggle (the toggle governs whether the UI lets
 * the action proceed — see {@link mayMulticlass}). An unknown new class id, or
 * a character with no classes yet, is treated as ok (nothing to block against;
 * taking a first class is not a multiclass).
 *
 * Order of checks: already-have-class first (uniqueness), then the ability
 * prereq across the new class AND every current class, against EFFECTIVE scores.
 */
export function canMulticlassInto(
  character: Character,
  newClassId: ClassId,
): CanMulticlassResult {
  const current = allClasses(character);

  // PHB: you cannot multiclass INTO a class you already have (normal advancement).
  if (current.some((entry) => entry.id === newClassId)) {
    return { ok: false, reason: 'already-have-class' };
  }

  const newClass = getClass(newClassId);
  if (!newClass) return { ok: true }; // unknown id: nothing to enforce.

  const scores = effectiveAbilityScores(character);

  // PHB L2082: 13+ in the primary ability of the NEW class AND every CURRENT
  // class. Collect the union of failing abilities across all of those shapes.
  const failing = new Set<Ability>();
  for (const ability of failingAbilitiesFor(newClass, scores)) failing.add(ability);
  for (const entry of current) {
    const data = getClass(entry.id);
    if (!data) continue; // tolerate an unknown stored id.
    for (const ability of failingAbilitiesFor(data, scores)) failing.add(ability);
  }

  if (failing.size > 0) {
    return { ok: false, reason: 'prereq', failing: [...failing] };
  }
  return { ok: true };
}

/** The UI decision: may the add-a-class action proceed, and does it warn? */
export interface MayMulticlassResult {
  /** True when the action is allowed to proceed (RAW met, or house-rule waives). */
  proceed: boolean;
  /** True when it proceeds only because the house rule waived a failed prereq. */
  warning: boolean;
}

/**
 * The UI decision for adding a level in `newClassId`, consulting the house rule
 * houseRules.allowIllegalMulticlass (PHB 2024 "Multiclassing" + the opt-in
 * house rule declared in M1). RAW prereq met → proceed, no warning. Prereq
 * fails + toggle OFF → blocked. Prereq fails + toggle ON → proceed WITH a
 * warning. An already-have-class failure is ALWAYS blocked — the house rule
 * only waives the ability prereq, never the uniqueness rule.
 */
export function mayMulticlass(
  character: Character,
  newClassId: ClassId,
): MayMulticlassResult {
  const raw = canMulticlassInto(character, newClassId);
  if (raw.ok) return { proceed: true, warning: false };
  // The house rule never overrides the uniqueness rule.
  if (raw.reason === 'already-have-class') return { proceed: false, warning: false };
  const allowIllegal = character.houseRules?.allowIllegalMulticlass ?? false;
  return allowIllegal ? { proceed: true, warning: true } : { proceed: false, warning: false };
}

/** One option in the add-a-class dropdown, with its RAW prereq status. */
export interface MulticlassOption {
  classId: ClassId;
  className: string;
  /** The RAW check result (reported regardless of the toggle). */
  status: CanMulticlassResult;
  /** The UI decision for this option under the current house-rule toggle. */
  decision: MayMulticlassResult;
}

/**
 * Every class the character could take a NEW level in (i.e. a class they do NOT
 * already have), each tagged with its RAW prereq status and the toggle-aware UI
 * decision (PHB 2024 "Multiclassing"). Used to populate the Advancement-page
 * add-a-class control: a prereq-failing option is DISABLED when the toggle is
 * off and SELECTABLE-WITH-WARNING when it is on (via `decision`). Classes the
 * character already holds are excluded (they are advanced via the normal
 * level-up, not a multiclass). Ordered by class name for a stable dropdown.
 */
export function multiclassOptions(character: Character): MulticlassOption[] {
  const held = new Set(allClasses(character).map((entry) => entry.id));
  const options: MulticlassOption[] = [];
  for (const id of MULTICLASS_CLASS_IDS) {
    if (held.has(id)) continue;
    const data = getClass(id);
    if (!data) continue;
    options.push({
      classId: id,
      className: data.name,
      status: canMulticlassInto(character, id),
      decision: mayMulticlass(character, id),
    });
  }
  return options.sort((a, b) => a.className.localeCompare(b.className));
}

/** The twelve PHB class ids, used to enumerate multiclass targets. */
const MULTICLASS_CLASS_IDS: ClassId[] = [
  'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
];
