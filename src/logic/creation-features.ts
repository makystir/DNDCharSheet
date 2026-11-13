import type { Character, ClassChoiceKey, ClassChoices, SkillId } from '../types/character';
import { SKILLS } from '../types/character';
import { createCharacter } from '../storage/character-store';
import { CREATION_CHOICE_KEYS, choiceOwed, invocationEligibility, parseInvocationEntry } from './class-choices';
import { choiceOptionViews } from './class-choice-options';
import { applyFightingStyle, characterFeats, fightingStyleSlots } from './feats';
import { expertiseStatus, setSkillExpertise } from './expertise';
import { masteryChoices, masteryEligibleForCharacter } from './weapon-mastery';
import { effectiveSkillTraining } from './skills';
import { skillsUsingPrimaryAbility } from './creation-guidance';
import { allFeats } from '../data/feats';
import { getWeapon, WEAPON_LIST } from '../data/weapons';

/**
 * The level 1 class-feature picks the creation wizard collects on its "Class
 * Features" step, so a new character leaves the wizard with nothing owed:
 *  - Fighting Style (Fighter level 1),
 *  - Divine Order (Cleric 1), Primal Order (Druid 1), Eldritch Invocations
 *    (Warlock 1): the CREATION_CHOICE_KEYS class choices,
 *  - Expertise (Rogue 1),
 *  - Weapon Mastery (Barbarian, Fighter, Paladin, Ranger, Rogue at level 1).
 * Every count comes from the logic that owns it (feats, class-choices,
 * expertise, weapon-mastery); nothing here is a rule of its own.
 */
export interface WizardFeatures {
  /** Feat id of the class's Fighting Style pick. */
  fightingStyle?: string;
  /** Picks for the level 1 class-choice groups (Divine Order, ...). */
  classChoices?: ClassChoices;
  /** Skills given Expertise. */
  expertise?: SkillId[];
  /** Weapon ids chosen for Weapon Mastery. */
  weaponMasteries?: string[];
}

export interface CreationFeatureNeeds {
  fightingStyle: boolean;
  choiceKeys: ClassChoiceKey[];
  expertise: number;
  weaponMastery: number;
}

/** What a level 1 character of this class picks on the Class Features step. */
export function creationFeatureNeeds(classId: string): CreationFeatureNeeds {
  const c: Character = { ...createCharacter(''), level: 1, classes: [{ id: classId as never, level: 1 }] };
  return {
    fightingStyle: fightingStyleSlots(c).some((s) => s.classId === classId),
    choiceKeys: CREATION_CHOICE_KEYS.filter((k) => choiceOwed(c, k) > 0),
    expertise: expertiseStatus(c).owed,
    weaponMastery: masteryChoices(c).cap,
  };
}

/** Whether the class gets a Class Features step at all. */
export function hasCreationFeatures(classId: string): boolean {
  if (!classId) return false;
  const n = creationFeatureNeeds(classId);
  return n.fightingStyle || n.choiceKeys.length > 0 || n.expertise > 0 || n.weaponMastery > 0;
}

/** Apply the step's picks to a freshly built level 1 character. */
export function applyWizardFeatures(character: Character, classId: string, f: WizardFeatures, timestamp: number): Character {
  let next = character;
  const choices = Object.entries(f.classChoices ?? {}).filter(([, v]) => v && v.length > 0);
  if (choices.length > 0) next = { ...next, classChoices: { ...(next.classChoices ?? {}), ...Object.fromEntries(choices) } };
  if (f.weaponMasteries && f.weaponMasteries.length > 0) next = { ...next, weaponMasteries: [...f.weaponMasteries] };
  for (const skill of f.expertise ?? []) {
    if (effectiveSkillTraining(next, skill).proficient) next = setSkillExpertise(next, skill, true);
  }
  if (f.fightingStyle) next = applyFightingStyle(next, classId, f.fightingStyle, timestamp);
  return next;
}

/**
 * Make every level 1 feature pick for a built character, choosing with `pickIndex`
 * (n => an index below n; random for a random character, 0 in tests). Weapon
 * Mastery prefers the weapons already in the inventory; Expertise prefers skills
 * that use the class's main ability. Invocations respect their prerequisites.
 */
export function autoPickFeatures(character: Character, classId: string, pickIndex: (n: number) => number): WizardFeatures {
  const needs = creationFeatureNeeds(classId);
  const out: WizardFeatures = {};
  const take = <T>(pool: T[], count: number): T[] => {
    const left = [...pool];
    const chosen: T[] = [];
    while (chosen.length < count && left.length > 0) chosen.push(left.splice(pickIndex(left.length), 1)[0]);
    return chosen;
  };

  if (needs.fightingStyle) {
    const styles = allFeats().filter((f) => f.category === 'fighting-style').map((f) => f.id);
    out.fightingStyle = take(styles, 1)[0];
  }

  if (needs.choiceKeys.length > 0) {
    const choices: ClassChoices = {};
    let working = character;
    for (const key of needs.choiceKeys) {
      const owed = choiceOwed(character, key);
      const picked: string[] = [];
      for (let i = 0; i < owed; i++) {
        const held = picked.map((e) => parseInvocationEntry(e).id);
        const options = choiceOptionViews(working, key)
          .map((o) => o.id)
          .filter((id) => !picked.includes(id))
          .filter((id) => key !== 'warlock.invocations' || invocationEligibility(working, id, held).ok);
        const [id] = take(options, 1);
        if (id === undefined) break;
        picked.push(id);
        working = { ...working, classChoices: { ...(working.classChoices ?? {}), [key]: [...picked] } };
      }
      if (picked.length > 0) choices[key] = picked;
    }
    if (Object.keys(choices).length > 0) out.classChoices = choices;
  }

  if (needs.expertise > 0) {
    const proficient = SKILLS.map((s) => s.id).filter((id) => effectiveSkillTraining(character, id).proficient);
    const preferred = skillsUsingPrimaryAbility(classId, proficient);
    const rest = proficient.filter((id) => !preferred.includes(id));
    const first = take(preferred, needs.expertise);
    out.expertise = [...first, ...take(rest, needs.expertise - first.length)];
  }

  if (needs.weaponMastery > 0) {
    const eligible = (id: string) => {
      const w = getWeapon(id);
      return w !== undefined && masteryEligibleForCharacter(character, w);
    };
    const owned = [
      ...new Set((character.inventory ?? []).filter((i) => i.kind === 'weapon' && i.catalogId).map((i) => i.catalogId as string)),
    ].filter(eligible);
    const others = WEAPON_LIST.map((w) => w.id).filter((id) => !owned.includes(id) && eligible(id));
    const first = take(owned, needs.weaponMastery);
    out.weaponMasteries = [...first, ...take(others, needs.weaponMastery - first.length)];
  }
  return out;
}

/** Read the step's picks back from a preview character the pickers edited. */
export function extractWizardFeatures(character: Character, classId: string): WizardFeatures {
  const out: WizardFeatures = {};
  const style = characterFeats(character).find((s) => s.grantedBy === classId);
  if (style) out.fightingStyle = style.featId;
  const choices: ClassChoices = {};
  for (const key of CREATION_CHOICE_KEYS) {
    const held = character.classChoices?.[key];
    if (held && held.length > 0) choices[key] = [...held];
  }
  if (Object.keys(choices).length > 0) out.classChoices = choices;
  const expertise = SKILLS.map((s) => s.id).filter((id) => character.skills?.[id]?.expertise === true);
  if (expertise.length > 0) out.expertise = expertise;
  if (character.weaponMasteries && character.weaponMasteries.length > 0) out.weaponMasteries = [...character.weaponMasteries];
  return out;
}
