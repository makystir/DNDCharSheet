import type { Character, ClassEntry, ClassChoiceKey, FeatSelection } from '../types/character';
import { getClass } from '../data/classes';
import { getFeat } from '../data/feats';
import { getSpell } from '../data/spells';
import { allClasses } from './classes';
import { CLASS_CHOICE_GRANTS, choiceOwed, choiceStatus } from './class-choices';
import { characterFeats, featSlotAssignments, fightingStyleSlots } from './feats';
import { featSlotLevels } from './advancement';
import { reconcileSpellcastingForLevel } from './spellcasting';
import { clampResourcesSpent } from './resources';
import { expertiseStatus } from './expertise';
import { languagePicksStatus } from './language-picks';
import { masteryChoices } from './weapon-mastery';
import { hitPointMaxOf } from './hit-points-state';

/**
 * "Undo last level-up": step the character back exactly ONE level and clean up
 * everything that level made possible. This is sheet bookkeeping (taking back a
 * choice the player made in the app), not a game rule, so it computes no
 * mechanics of its own: every count comes from the existing logic, re-read at
 * the lower level.
 *
 * What it does, in order:
 *  1. Lowers the class that gained the level (the per-level record's classId;
 *     the only class for a single-class character; the player's pick when a
 *     multiclass level was never recorded). A class at level 1 is removed (the
 *     starting class can't be removed while another class remains).
 *  2. Drops the subclass of that class when its level falls below the class's
 *     subclass level (PHB 2024: every class chooses at level 3).
 *  3. Removes the HP record for the undone level and its level-up / HP log
 *     entries, then appends one "level-undo" entry describing the undo.
 *  4. Removes feats whose slot no longer exists (an Ability Score Improvement
 *     slot of a class level you no longer have) and Fighting Style picks whose
 *     class feature is gone.
 *  5. Removes class-feature choices for features you no longer have at all
 *     (the group is owed 0 now but was owed before), and spells that are no
 *     longer legal at the lower level (the existing spell reconcile).
 *  6. Clamps spent resources, spent Hit Dice and current HP to the new maxima.
 * Picks that still apply but now exceed what is owed (more invocations,
 * Expertise, languages or Weapon Masteries than the lower level grants) are
 * KEPT and listed as notes; the Advancement page already flags them.
 */

export interface LevelUndoPreview {
  /** Character level before and after. */
  fromLevel: number;
  toLevel: number;
  classId: string;
  className: string;
  /** The class's own level before and after (0 = the class is removed). */
  classFrom: number;
  classTo: number;
  /** Plain-language lines: everything that will be removed or lowered. */
  removals: string[];
  /** Plain-language lines: picks that are kept but now exceed what is owed. */
  notes: string[];
}

export type LevelUndoResult =
  | { ok: true; character: Character; preview: LevelUndoPreview }
  | { ok: false; reason: string };

/** Whether there is a level to undo at all (level 2 or higher). */
export function canUndoLevel(character: Character): boolean {
  return character.level >= 2 && allClasses(character).length > 0;
}

/**
 * The class that gained the character's current level, when it is known: the
 * per-level record's classId, else the only class. Undefined when a multiclass
 * character's last level was never recorded (the player must pick).
 */
export function lastLevelClassId(character: Character): string | undefined {
  const classes = allClasses(character);
  const record = (character.advancement?.levels ?? []).find((l) => l.level === character.level);
  if (record?.classId && classes.some((c) => c.id === record.classId)) return record.classId;
  if (classes.length === 1) return classes[0].id;
  // A legacy record without classId is read as the initial class (see LevelUpRecord).
  if (record && record.classId === undefined && classes.length > 0) return classes[0].id;
  return undefined;
}

/** The classes the player may choose to lower when the last level's class is unknown. */
export function undoableClassIds(character: Character): string[] {
  const classes = allClasses(character);
  return classes.filter((c, i) => !(i === 0 && c.level <= 1 && classes.length > 1)).map((c) => c.id);
}

const featLabel = (f: FeatSelection) => getFeat(f.featId)?.name ?? f.featId;

function increaseText(f: FeatSelection): string {
  const parts = Object.entries(f.abilityIncreases ?? {})
    .filter(([, v]) => typeof v === 'number' && v !== 0)
    .map(([a, v]) => `+${v} ${a.toUpperCase()}`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

/** Feat selections that fill a slot (ASI slot or Fighting Style feature) on this character. */
function placedFeats(character: Character): Set<FeatSelection> {
  const placed = new Set<FeatSelection>();
  for (const a of featSlotAssignments(character, featSlotLevels(character))) if (a.filled) placed.add(a.filled);
  for (const s of fightingStyleSlots(character)) if (s.filled) placed.add(s.filled);
  return placed;
}

function spellIds(character: Character): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [classId, sel] of Object.entries(character.spellcasting?.byClass ?? {})) {
    out.set(classId, new Set([...(sel?.cantrips ?? []), ...(sel?.prepared ?? []), ...(sel?.spellbook ?? [])]));
  }
  return out;
}

/**
 * Undo the last level-up. Returns the new character and a preview of what
 * changed (the same preview the confirmation dialog shows), or a reason when it
 * can't be done. `classId` picks the class to lower when it is not known.
 */
export function undoLastLevel(character: Character, timestamp: number, classId?: string): LevelUndoResult {
  if (!canUndoLevel(character)) return { ok: false, reason: 'You are at level 1, so there is no level-up to undo.' };
  const classes = allClasses(character);
  const targetId = lastLevelClassId(character) ?? classId;
  if (targetId === undefined) return { ok: false, reason: 'Choose which class gained your last level.' };
  const index = classes.findIndex((c) => c.id === targetId);
  if (index === -1) return { ok: false, reason: 'That class is not on this character.' };
  const target = classes[index];
  if (index === 0 && target.level <= 1 && classes.length > 1) {
    return { ok: false, reason: "Your starting class can't be removed while you have other classes." };
  }

  const data = getClass(target.id);
  const className = data?.name ?? target.id;
  const fromLevel = character.level;
  const toLevel = fromLevel - 1;
  const classTo = target.level - 1;
  const removals: string[] = [];
  const notes: string[] = [];

  // 1-2. Lower (or remove) the class; drop a subclass it is no longer high enough for.
  let nextClasses: ClassEntry[];
  let subclassRemoved = false;
  if (classTo <= 0) {
    nextClasses = classes.filter((_, i) => i !== index);
    removals.push(`The ${className} class (your level 1 in it), with the skill picks it gave you`);
  } else {
    const lowered: ClassEntry = { ...target, level: classTo };
    if (lowered.subclassId !== undefined && data && classTo < data.subclassLevel) {
      const name = data.subclasses.find((s) => s.id === lowered.subclassId)?.name ?? lowered.subclassId;
      removals.push(`Subclass: ${name} (${className} chooses its subclass at level ${data.subclassLevel})`);
      delete lowered.subclassId;
      subclassRemoved = true;
    }
    nextClasses = classes.map((c, i) => (i === index ? lowered : c));
  }

  // 3. HP record and log.
  const levels = character.advancement?.levels ?? [];
  const record = levels.find((l) => l.level === fromLevel);
  if (record?.hp) {
    removals.push(`Hit points gained at level ${fromLevel} (${record.hp.mode === 'rolled' ? `rolled ${record.hp.value}` : 'fixed value'})`);
  }
  let next: Character = {
    ...character,
    classes: nextClasses,
    level: toLevel,
    advancement: {
      ...character.advancement,
      levels: levels.filter((l) => l.level !== fromLevel),
      log: (character.advancement?.log ?? []).filter(
        (e) => !((e.kind === 'level-up' || e.kind === 'hp') && e.level === fromLevel),
      ),
    },
  };

  // 4. Feats whose slot (or Fighting Style feature) is gone.
  const placedBefore = placedFeats(character);
  const placedAfter = placedFeats(next);
  const lostFeats = characterFeats(character).filter((f) => placedBefore.has(f) && !placedAfter.has(f));
  for (const f of lostFeats) {
    removals.push(
      f.grantedBy
        ? `Fighting Style: ${featLabel(f)}`
        : `Feat: ${featLabel(f)}${increaseText(f)}, from the level ${f.level} slot`,
    );
  }
  if (lostFeats.length > 0) {
    const lost = new Set(lostFeats);
    next = { ...next, advancement: { ...next.advancement, feats: characterFeats(next).filter((f) => !lost.has(f)) } };
  }

  // 5a. Class-feature choices for features no longer held at all.
  const choices = { ...(character.classChoices ?? {}) };
  for (const grant of CLASS_CHOICE_GRANTS) {
    const held = choices[grant.key as ClassChoiceKey];
    if (!held || held.length === 0) continue;
    const owedBefore = choiceOwed(character, grant.key);
    const classGone = classTo <= 0 && grant.classId === target.id;
    if (classGone || (owedBefore > 0 && choiceOwed(next, grant.key) === 0)) {
      removals.push(`${grant.label}: ${held.length} pick${held.length === 1 ? '' : 's'}`);
      delete choices[grant.key as ClassChoiceKey];
    }
  }
  if (classTo <= 0) {
    // Any other group belonging to the removed class (e.g. its multiclass instrument).
    for (const key of Object.keys(choices) as ClassChoiceKey[]) {
      if (key.startsWith(`${target.id}.`)) {
        removals.push(`${key.split('.')[1]}: ${choices[key]?.length ?? 0} pick(s)`);
        delete choices[key];
      }
    }
  }
  if (Object.keys(choices).length > 0) next = { ...next, classChoices: choices };
  else {
    const { classChoices: _drop, ...rest } = next;
    void _drop;
    next = rest as Character;
  }

  // 5b. Spells no longer legal at the lower level.
  if (next.spellcasting) {
    const before = spellIds(next);
    const reconciled = reconcileSpellcastingForLevel(next);
    if (reconciled) next = { ...next, spellcasting: reconciled };
    else {
      const { spellcasting: _sc, ...rest } = next;
      void _sc;
      next = rest as Character;
    }
    const after = spellIds(next);
    const dropped: string[] = [];
    for (const [cid, ids] of before) {
      for (const id of ids) if (!after.get(cid)?.has(id)) dropped.push(getSpell(id)?.name ?? id);
    }
    if (dropped.length > 0) removals.push(`Spells you can no longer have at this level: ${dropped.join(', ')}`);
  }

  // 6. Clamp spent resources, Hit Dice and current HP.
  next = clampResourcesSpent(next);
  if ((next.hitDiceSpent ?? 0) > toLevel) next = { ...next, hitDiceSpent: toLevel };
  const max = hitPointMaxOf(next);
  if (max !== undefined && next.currentHp !== undefined && next.currentHp > max) {
    removals.push(`Current hit points lowered from ${next.currentHp} to your new maximum, ${max}`);
    next = { ...next, currentHp: max };
  }

  // Kept-but-over notes (the Advancement page flags these as well).
  for (const s of choiceStatus(next)) {
    const was = choiceStatus(character).find((x) => x.key === s.key);
    if (s.over > 0 && (was?.over ?? 0) < s.over) notes.push(`${s.label}: ${s.chosen} chosen, now ${s.owed} owed`);
  }
  const exp = expertiseStatus(next);
  if (exp.over > expertiseStatus(character).over) notes.push(`Expertise: ${exp.chosen} skills marked, now ${exp.owed} owed`);
  const lang = languagePicksStatus(next);
  if (lang.over > languagePicksStatus(character).over) notes.push(`Class language picks: ${lang.chosen} chosen, now ${lang.owed} owed`);
  const mastery = masteryChoices(next);
  if (mastery.overCap.length > masteryChoices(character).overCap.length) {
    notes.push(`Weapon Mastery: ${mastery.chosen.length} weapons chosen, now ${mastery.cap} allowed`);
  }
  if (subclassRemoved && (character.companions ?? []).some((c) => c.origin === 'primal-companion' && !c.dismissed)) {
    notes.push('Your Primal Companion stays on the Companions page; remove it there if it no longer applies.');
  }

  const detail =
    classTo <= 0
      ? `Undid level ${fromLevel}: removed ${className}; now level ${toLevel}`
      : `Undid level ${fromLevel}: ${className} ${target.level} to ${classTo}; now level ${toLevel}`;
  next = {
    ...next,
    advancement: {
      ...next.advancement,
      log: [...(next.advancement?.log ?? []), { timestamp, kind: 'level-undo', level: fromLevel, detail }],
    },
  };

  return {
    ok: true,
    character: next,
    preview: { fromLevel, toLevel, classId: target.id, className, classFrom: target.level, classTo, removals, notes },
  };
}
