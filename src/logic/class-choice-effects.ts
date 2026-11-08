/**
 * Computed effects of the class-feature choices stored in `Character.classChoices`
 * that feed EXISTING systems (proficiencies, armor training, cantrips known).
 *
 * Kept free of imports from other logic modules (data and types only) so that
 * classes.ts, feats.ts, skills.ts, attacks.ts and spellcasting.ts can use it
 * without an import cycle. Reads `character.classes` directly.
 *
 * Effects (PHB 2024):
 *  - Cleric Divine Order: Protector = Martial weapons + Heavy armor training
 *    (L3228-3234); Thaumaturge = one extra Cleric cantrip.
 *  - Druid Primal Order: Warden = Martial weapons + Medium armor training
 *    (L3664-3670); Magician = one extra Druid cantrip.
 *  - Barbarian Primal Knowledge, Battle Master Student of War, College of Lore
 *    Bonus Proficiencies, Fey Wanderer Otherworldly Glamour: skill proficiencies.
 *  - Student of War: one Artisan's Tools proficiency; Bard multiclass: one
 *    Musical Instrument (display tool proficiencies).
 * NOT computed (no clean hook; display only): the Wisdom-modifier skill bonus of
 * Thaumaturge / Magician, and every other chosen feature (Metamagic, Invocations,
 * Maneuvers, Blessed Strikes, Elemental Fury, Hunter's Prey, ...).
 *
 * Every valid pick applies, even beyond the owed count (over-allocation is a
 * warning elsewhere, never a block).
 */

import type { Character, ClassChoiceKey, SkillId } from '../types/character';
import { SKILLS } from '../types/character';
import {
  ARTISANS_TOOLS,
  DIVINE_ORDER_OPTIONS,
  MUSICAL_INSTRUMENTS,
  PRIMAL_ORDER_OPTIONS,
} from '../data/class-options';
import type { OrderOption } from '../data/class-options';

const SKILL_IDS: readonly string[] = SKILLS.map((s) => s.id);

/** Whether the character has this class entry (and, optionally, the subclass) at `minLevel`. */
function hasClassAt(character: Character, classId: string, minLevel: number, subclassId?: string): boolean {
  return (character.classes ?? []).some(
    (e) => e.id === classId && e.level >= minLevel && (subclassId === undefined || e.subclassId === subclassId),
  );
}

function picks(character: Character, key: ClassChoiceKey): string[] {
  return character.classChoices?.[key] ?? [];
}

/** The chosen Divine Order / Primal Order options in effect, with their class id. */
export function chosenOrders(character: Character): Array<{ classId: 'cleric' | 'druid'; option: OrderOption }> {
  const result: Array<{ classId: 'cleric' | 'druid'; option: OrderOption }> = [];
  if (hasClassAt(character, 'cleric', 1)) {
    const option = DIVINE_ORDER_OPTIONS.find((o) => o.id === picks(character, 'cleric.divineOrder')[0]);
    if (option) result.push({ classId: 'cleric', option });
  }
  if (hasClassAt(character, 'druid', 1)) {
    const option = PRIMAL_ORDER_OPTIONS.find((o) => o.id === picks(character, 'druid.primalOrder')[0]);
    if (option) result.push({ classId: 'druid', option });
  }
  return result;
}

/** Extra cantrips a class knows from its chosen order (Thaumaturge / Magician). */
export function extraCantrips(character: Character, classId: string): number {
  return chosenOrders(character)
    .filter((o) => o.classId === classId)
    .reduce((sum, o) => sum + o.option.extraCantrips, 0);
}

/** Label of the order granting extra cantrips to a class (for breakdowns), if any. */
export function extraCantripLabel(character: Character, classId: string): string | undefined {
  return chosenOrders(character).find((o) => o.classId === classId && o.option.extraCantrips > 0)?.option.name;
}

/** Skills granted by class-feature choices, keyed by SkillId with a source label. */
export function choiceGrantedSkills(character: Character): Partial<Record<SkillId, string>> {
  const result: Partial<Record<SkillId, string>> = {};
  const add = (key: ClassChoiceKey, label: string, ok: boolean): void => {
    if (!ok) return;
    for (const id of picks(character, key)) {
      if (SKILL_IDS.includes(id) && result[id as SkillId] === undefined) result[id as SkillId] = label;
    }
  };
  add('barbarian.primalKnowledge', 'Primal Knowledge (class)', hasClassAt(character, 'barbarian', 3));
  add('fighter.studentOfWarSkill', 'Student of War (class)', hasClassAt(character, 'fighter', 3, 'battleMaster'));
  add('bard.loreSkills', 'Bonus Proficiencies (class)', hasClassAt(character, 'bard', 3, 'lore'));
  add('ranger.glamourSkill', 'Otherworldly Glamour (class)', hasClassAt(character, 'ranger', 3, 'feyWanderer'));
  return result;
}

/** Armor / weapon / tool proficiencies granted by class-feature choices (display strings). */
export function choiceGrantedProficiencies(character: Character): {
  armor: string[];
  weapons: string[];
  tools: string[];
} {
  const armor: string[] = [];
  const weapons: string[] = [];
  const tools: string[] = [];
  for (const { option } of chosenOrders(character)) {
    for (const a of option.armor) armor.push(`${a.charAt(0).toUpperCase()}${a.slice(1)} armor`);
    for (const w of option.weapons) weapons.push(`${w.charAt(0).toUpperCase()}${w.slice(1)} weapons`);
  }
  if (hasClassAt(character, 'fighter', 3, 'battleMaster')) {
    const tool = ARTISANS_TOOLS.find((t) => t.id === picks(character, 'fighter.studentOfWarTool')[0]);
    if (tool) tools.push(tool.name);
  }
  const instrument = MUSICAL_INSTRUMENTS.find((t) => t.id === picks(character, 'bard.multiclassInstrument')[0]);
  if (instrument && (character.classes ?? []).some((e, i) => e.id === 'bard' && i > 0)) tools.push(instrument.name);
  return { armor, weapons, tools };
}

/** True when a chosen order grants proficiency with Martial weapons. */
export function choiceGrantsMartialWeapons(character: Character): boolean {
  return choiceGrantedProficiencies(character).weapons.includes('Martial weapons');
}
