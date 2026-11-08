/**
 * Multiclass proficiency picks (D&D 5.5e / 2024): a class taken as a NON-INITIAL
 * class grants a reduced proficiency set, and some of it is a choice.
 *
 * PHB 2024 "Multiclassing: Proficiencies" (L2104-ish) and each class's "As a
 * Multiclass Character" entry: Bard (one skill of your choice + one Musical
 * Instrument, L2716), Ranger (one skill from the Ranger list, L5364), Rogue (one
 * skill from the Rogue list, L5875-5877; Thieves' Tools is fixed, not a pick).
 * The data lives in ClassData.multiclassProficiencies.
 *
 * Skills are stored in the existing ClassEntry.skillChoices (classGrantedSkills
 * already unions them); the Bard instrument is stored in
 * classChoices['bard.multiclassInstrument']. Over-allocation is a warning, never
 * a block. Pure.
 */

import type { Character, SkillId } from '../types/character';
import { SKILLS } from '../types/character';
import { resolveClasses } from './classes';

export interface MulticlassPick {
  classId: string;
  kind: 'skill' | 'instrument';
  owed: number;
  chosen: number;
  remaining: number;
  over: number;
  /** Skill picks: the allowed skills (the class list, or every skill for 'any'). */
  from?: readonly SkillId[];
}

/** Owed / chosen multiclass skill and instrument picks for every non-initial class. */
export function multiclassPickStatus(character: Character): MulticlassPick[] {
  const picks: MulticlassPick[] = [];
  for (const { entry, data, initial } of resolveClasses(character)) {
    if (initial) continue;
    const mc = data.multiclassProficiencies;
    if (mc.skills > 0) {
      const list = data.skillChoices.from;
      const from: readonly SkillId[] = Array.isArray(list) ? list : SKILLS.map((s) => s.id);
      const chosen = (entry.skillChoices ?? []).filter((id) => from.includes(id)).length;
      picks.push({
        classId: entry.id,
        kind: 'skill',
        owed: mc.skills,
        chosen,
        remaining: Math.max(0, mc.skills - chosen),
        over: Math.max(0, chosen - mc.skills),
        from,
      });
    }
    if ((mc.tools as readonly string[]).includes('musical-instrument')) {
      const chosen = character.classChoices?.['bard.multiclassInstrument']?.length ?? 0;
      picks.push({
        classId: entry.id,
        kind: 'instrument',
        owed: 1,
        chosen,
        remaining: Math.max(0, 1 - chosen),
        over: Math.max(0, chosen - 1),
      });
    }
  }
  return picks;
}

/** Multiclass picks still to make. */
export function pendingMulticlassPicks(character: Character): MulticlassPick[] {
  return multiclassPickStatus(character).filter((p) => p.remaining > 0);
}
