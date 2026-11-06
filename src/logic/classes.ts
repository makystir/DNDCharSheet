/**
 * Class rules (D&D 5.5e / 2024).
 *
 * Pure resolvers over a character's class selection and the data catalog
 * (src/data/classes.ts), following the species.ts pattern: each function
 * tolerates an unset or unknown `class` and returns a sensible default, never
 * throwing. These resolvers surface class-granted proficiencies, skills, and
 * features for display; they never read or write `character.abilities` (ASI
 * and Epic Boon rows are feat choices, not automatic stat bumps — PHB 2024
 * "Ability Score Improvement" / "Epic Boon"). The no-ASI guard in the logic
 * tests locks this in.
 */

import type { Ability, Character, ClassEntry, SkillId } from '../types/character';
import type { ClassData, ClassFeature, HitDie, SubclassData } from '../data/classes';
import { getClass } from '../data/classes';

/**
 * Every class entry resolved against the catalog, in stored order (the first is
 * the INITIAL class — PHB 2024 "Multiclassing"). Entries with an unknown id are
 * dropped (tolerant resolvers, never throwing). Each result pairs the stored
 * entry (per-class level, subclass, skill choices) with its catalog data.
 */
export function resolveClasses(
  character: Character,
): Array<{ entry: ClassEntry; data: ClassData; initial: boolean }> {
  return allClasses(character).flatMap((entry, index) => {
    const data = getClass(entry.id);
    return data ? [{ entry, data, initial: index === 0 }] : [];
  });
}

/**
 * The PRIMARY class entry (the INITIAL class, `classes[0]`), or undefined when
 * no class is chosen (PHB 2024 "Multiclassing": the first class is the initial
 * class). Single-class characters have exactly one entry, so this is that class.
 */
export function primaryClass(character: Character): ClassEntry | undefined {
  return character.classes?.[0];
}

/** Every class the character has levels in (PHB 2024 "Multiclassing"), or []. */
export function allClasses(character: Character): ClassEntry[] {
  return character.classes ?? [];
}

/**
 * The total character level = the sum of the per-class entry levels (PHB 2024
 * "Multiclassing": your character level is the total of your levels in all your
 * classes). 0 when there are no classes. `Character.level` stores this total
 * authoritatively; this helper derives it from the entries for the invariant
 * check and is NOT a replacement for the stored value on hot paths.
 */
export function totalLevel(character: Character): number {
  return allClasses(character).reduce((sum, entry) => sum + entry.level, 0);
}

/** Resolves the selected class data, or undefined when unset/unknown. */
export function resolveClass(character: Character): ClassData | undefined {
  return getClass(primaryClass(character)?.id);
}

/**
 * Resolves the chosen subclass, or undefined when no class/subclass is chosen,
 * the id is unknown, or the character's level in that class is below the class's
 * subclassLevel (PHB 2024: a subclass is gained at the class's subclass level).
 *
 * The gate uses the PRIMARY class ENTRY's own level, not `character.level` —
 * for a single-class character the two coincide, so behaviour is unchanged, but
 * encoding against the per-class level is the correct multiclass rule (a
 * subclass is gained at that class's level) and fixes the latent single-class-
 * coincidence bug (design decision 9-F).
 */
export function resolveSubclass(character: Character): SubclassData | undefined {
  const cls = resolveClass(character);
  if (!cls) return undefined;
  const primary = primaryClass(character);
  const subclassId = primary?.subclassId;
  if (subclassId === undefined) return undefined;
  if ((primary?.level ?? 0) < cls.subclassLevel) return undefined;
  return cls.subclasses.find((s) => s.id === subclassId);
}

/**
 * The class save-proficiency abilities, keyed by Ability with a source label
 * (e.g. 'Barbarian (class)'). Empty when no class is selected.
 *
 * PHB 2024 Core <Class> Traits "Saving Throw Proficiencies" + "Multiclassing:
 * Proficiencies" (L2106): you gain save proficiencies only from your INITIAL
 * class — a class taken as a multiclass grants NO save proficiencies (its
 * multiclass entry lists none). So only `classes[0]` contributes here; for a
 * single-class character this is unchanged.
 */
export function classSaveProficiencies(
  character: Character,
): Partial<Record<Ability, string>> {
  const result: Partial<Record<Ability, string>> = {};
  const cls = resolveClass(character); // the INITIAL class only
  if (!cls) return result;
  const label = `${cls.name} (class)`;
  for (const ability of cls.savingThrows) {
    result[ability] = label;
  }
  return result;
}

/**
 * The skill proficiencies granted by the character's class skill choices, keyed
 * by SkillId with a source label (e.g. 'Wizard (class)'). Built from each
 * entry's stored `skillChoices`, unioned across all classes, ignoring any
 * stale/duplicate ids. Empty when no class is selected.
 *
 * PHB 2024 Core <Class> Traits "Skill Proficiencies" + each non-initial class's
 * "As a Multiclass Character" entry (a multiclass that grants a skill lets you
 * choose from its list — e.g. Bard/Ranger/Rogue). The player's stored choices
 * carry which skills were picked, so this unions every class's picks. For a
 * single-class character only the one entry contributes (unchanged).
 */
export function classGrantedSkills(
  character: Character,
): Partial<Record<SkillId, string>> {
  const result: Partial<Record<SkillId, string>> = {};
  for (const { entry, data } of resolveClasses(character)) {
    const label = `${data.name} (class)`;
    for (const skillId of entry.skillChoices ?? []) {
      // First-seen source wins (initial class is resolved first).
      if (result[skillId] === undefined) result[skillId] = label;
    }
  }
  return result;
}

/**
 * The character's class-granted armor/weapon/tool proficiencies as display
 * strings, unioned across all classes. Empty arrays when no class is selected.
 * Display only — not a computed total, so no Breakdown.
 *
 * PHB 2024 Core <Class> Traits + "Multiclassing: Proficiencies" (L2106): the
 * INITIAL class (`classes[0]`) grants its FULL starting proficiencies; each
 * NON-INITIAL class grants only its reduced `multiclassProficiencies` subset
 * (never Heavy armor, never save proficiencies). Entries are unioned preserving
 * first-seen order and de-duplicated. For a single-class character this is the
 * initial class's full set only (unchanged).
 */
export function classProficiencies(character: Character): {
  armor: string[];
  weapons: string[];
  tools: string[];
} {
  const armor: string[] = [];
  const weapons: string[] = [];
  const tools: string[] = [];
  const pushUnique = (list: string[], value: string): void => {
    if (!list.includes(value)) list.push(value);
  };
  for (const { data, initial } of resolveClasses(character)) {
    if (initial) {
      // Initial class: the full starting proficiencies (unchanged).
      for (const a of data.armorTraining) pushUnique(armor, a);
      for (const w of data.weaponProficiencies) pushUnique(weapons, w);
      for (const t of data.toolProficiencies) pushUnique(tools, t);
    } else {
      // Non-initial class: the reduced multiclass subset (PHB "Multiclassing").
      const mc = data.multiclassProficiencies;
      for (const a of mc.armor) {
        pushUnique(armor, `${a.charAt(0).toUpperCase()}${a.slice(1)} armor`.replace('Shields armor', 'Shields'));
      }
      if (mc.martialWeapons) pushUnique(weapons, 'Martial weapons');
      for (const t of mc.tools) pushUnique(tools, multiclassToolLabel(t));
    }
  }
  return { armor, weapons, tools };
}

/** A display label for a multiclass tool/instrument CHOICE marker. */
function multiclassToolLabel(marker: string): string {
  switch (marker) {
    case 'thieves-tools':
      return "Thieves' Tools";
    case 'musical-instrument':
      return 'One Musical Instrument of your choice';
    default:
      return marker;
  }
}

/**
 * The class's features grouped by the level at which they are gained, as a Map
 * whose keys are inserted in ascending numeric order. A copy of the features is
 * sorted by level with a stable comparator BEFORE grouping so features within a
 * level keep their authored order. Empty Map when no class is selected (PHB
 * 2024 <Class> Features table).
 */
export function classFeaturesByLevel(
  character: Character,
): Map<number, ClassFeature[]> {
  const result = new Map<number, ClassFeature[]>();
  const classes = resolveClasses(character);
  if (classes.length === 0) return result;
  // Union across classes of the FULL feature lists, grouped by the level at
  // which each feature is gained. This is NOT gated by the character's level —
  // callers that need lookahead (nextLevelPreview, advancement-planner) read
  // levels above the current one, and callers that need "reached" features
  // (featSlotLevels, featureLanguageGrants) apply the per-class level gate
  // themselves. For a single-class character this is exactly that one class's
  // features grouped by level (the whole list, byte-identical to before).
  const sorted = classes
    .flatMap(({ data }) => data.features)
    .sort((a, b) => a.level - b.level);
  for (const feature of sorted) {
    const bucket = result.get(feature.level);
    if (bucket) bucket.push(feature);
    else result.set(feature.level, [feature]);
  }
  return result;
}

/**
 * Class features tagged with the class they came from, grouped by the level at
 * which they are gained (keyed by the feature's class level). Each class
 * contributes its features whose level is at or below THAT class's own level
 * (PHB 2024 "Multiclassing"). Lets the UI label which class each feature is
 * from in a multiclass character; {@link classFeaturesByLevel} is the untagged
 * view that keeps the existing single-class callers unchanged.
 */
export function classFeaturesByLevelTagged(
  character: Character,
): Map<number, Array<{ feature: ClassFeature; classId: string; className: string }>> {
  const result = new Map<number, Array<{ feature: ClassFeature; classId: string; className: string }>>();
  const tagged = resolveClasses(character)
    .flatMap(({ entry, data }) =>
      data.features
        .filter((f) => f.level <= entry.level)
        .map((feature) => ({ feature, classId: data.id, className: data.name })),
    )
    .sort((a, b) => a.feature.level - b.feature.level);
  for (const item of tagged) {
    const bucket = result.get(item.feature.level);
    if (bucket) bucket.push(item);
    else result.set(item.feature.level, [item]);
  }
  return result;
}

/**
 * The character's total number of Hit Dice, which equals the character level
 * (PHB 2024 "Hit Points": you have Hit Dice equal to your level). For a
 * multiclass character this is the sum across classes = the total level.
 * Tolerant of an unset class (Hit Dice still track character level).
 */
export function hitDiceTotal(character: Character): number {
  return character.level;
}

/**
 * The character's Hit Dice POOLED BY DIE TYPE (PHB 2024 "Multiclassing: Hit
 * Points", L2094): sum each class's level into its die-type bucket, so classes
 * sharing a die size pool together and different die sizes are tracked
 * separately. e.g. Barbarian 3 / Wizard 2 → { 12: 3, 6: 2 }. Classes with an
 * unknown id are dropped. For a single-class character this is a single bucket
 * holding the character level. Empty object when no class is selected.
 */
export function hitDiceByDieType(character: Character): Partial<Record<HitDie, number>> {
  const pool: Partial<Record<HitDie, number>> = {};
  for (const { entry, data } of resolveClasses(character)) {
    const die = data.hitDie;
    pool[die] = (pool[die] ?? 0) + entry.level;
  }
  return pool;
}
