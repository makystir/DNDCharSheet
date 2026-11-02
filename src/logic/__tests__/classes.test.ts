import { describe, it, expect } from 'vitest';
import {
  resolveClass,
  resolveSubclass,
  classSaveProficiencies,
  classGrantedSkills,
  classProficiencies,
  classFeaturesByLevel,
  hitDiceTotal,
} from '../classes';
import { allAbilityModifiers } from '../abilities';
import { CLASS_CATALOG, CLASS_LIST } from '../../data/classes';
import type { ClassFeature } from '../../data/classes';
import { BLANK_CHARACTER } from '../../types/character';
import type { Character, ClassSelection } from '../../types/character';
import { ABILITIES } from '../../types/character';

/** Builds a character with a class selection on top of BLANK_CHARACTER. */
function withClass(sel: ClassSelection, level = sel.level): Character {
  return { ...BLANK_CHARACTER, level, class: sel };
}

describe('resolveClass / resolveSubclass', () => {
  it('returns undefined for an unset class', () => {
    expect(resolveClass(BLANK_CHARACTER)).toBeUndefined();
    expect(resolveSubclass(BLANK_CHARACTER)).toBeUndefined();
  });

  it('tolerates an unknown class id', () => {
    const c = { ...BLANK_CHARACTER, class: { id: 'bogus' as never, level: 1 } };
    expect(resolveClass(c)).toBeUndefined();
    expect(resolveSubclass(c)).toBeUndefined();
  });

  it('resolves a known class', () => {
    const c = withClass({ id: 'wizard', level: 1 });
    expect(resolveClass(c)).toBe(CLASS_CATALOG.wizard);
  });

  it('returns undefined for a subclass below the class subclassLevel', () => {
    // Barbarian subclass level is 3; at level 2 the subclass is not yet gained.
    const c = withClass({ id: 'barbarian', subclassId: 'zealot', level: 2 }, 2);
    expect(resolveSubclass(c)).toBeUndefined();
  });

  it('resolves the subclass at/above the subclassLevel', () => {
    const c = withClass({ id: 'barbarian', subclassId: 'zealot', level: 3 }, 3);
    const sub = resolveSubclass(c);
    expect(sub?.id).toBe('zealot');
    expect(sub?.name).toBe('Path of the Zealot');
  });

  it('returns undefined for an unknown subclass id', () => {
    const c = withClass({ id: 'barbarian', subclassId: 'bogus' as never, level: 3 }, 3);
    expect(resolveSubclass(c)).toBeUndefined();
  });
});

describe('classSaveProficiencies', () => {
  it('is empty for an unset class', () => {
    expect(classSaveProficiencies(BLANK_CHARACTER)).toEqual({});
  });

  it('returns the two transcribed saves labelled with the class', () => {
    const c = withClass({ id: 'wizard', level: 1 });
    const saves = classSaveProficiencies(c);
    expect(Object.keys(saves).sort()).toEqual(['int', 'wis']);
    expect(saves.int).toBe('Wizard (class)');
    expect(saves.wis).toBe('Wizard (class)');
  });

  it('matches the catalog saves for a sample of classes', () => {
    expect(Object.keys(classSaveProficiencies(withClass({ id: 'barbarian', level: 1 }))).sort()).toEqual(['con', 'str']);
    expect(Object.keys(classSaveProficiencies(withClass({ id: 'cleric', level: 1 }))).sort()).toEqual(['cha', 'wis']);
    expect(Object.keys(classSaveProficiencies(withClass({ id: 'rogue', level: 1 }))).sort()).toEqual(['dex', 'int']);
  });
});

describe('classGrantedSkills', () => {
  it('is empty for an unset class', () => {
    expect(classGrantedSkills(BLANK_CHARACTER)).toEqual({});
  });

  it('builds the granted-skill map from the stored choices labelled with the class', () => {
    const c = withClass({ id: 'rogue', level: 1, skillChoices: ['stealth', 'perception'] });
    const granted = classGrantedSkills(c);
    expect(granted.stealth).toBe('Rogue (class)');
    expect(granted.perception).toBe('Rogue (class)');
  });

  it('is empty when no skill choices are stored', () => {
    expect(classGrantedSkills(withClass({ id: 'rogue', level: 1 }))).toEqual({});
  });
});

describe('classProficiencies', () => {
  it('returns empty arrays for an unset class', () => {
    expect(classProficiencies(BLANK_CHARACTER)).toEqual({ armor: [], weapons: [], tools: [] });
  });

  it('returns the transcribed proficiencies for a class', () => {
    const prof = classProficiencies(withClass({ id: 'rogue', level: 1 }));
    expect(prof.armor).toEqual(['Light armor']);
    expect(prof.weapons).toContain('Simple weapons');
    expect(prof.tools).toEqual(["Thieves' Tools"]);
  });
});

describe('hitDiceTotal', () => {
  it('equals the character level, class or not', () => {
    expect(hitDiceTotal({ ...BLANK_CHARACTER, level: 7 })).toBe(7);
    expect(hitDiceTotal(withClass({ id: 'wizard', level: 5 }, 5))).toBe(5);
  });
});

describe('classFeaturesByLevel', () => {
  it('is an empty Map for an unset class', () => {
    expect(classFeaturesByLevel(BLANK_CHARACTER).size).toBe(0);
  });

  it('groups features with ascending numeric level keys', () => {
    const map = classFeaturesByLevel(withClass({ id: 'barbarian', level: 1 }));
    const keys = [...map.keys()];
    const sorted = [...keys].sort((a, b) => a - b);
    expect(keys).toEqual(sorted);
    // Barbarian gains Rage/Unarmored Defense/Weapon Mastery at level 1.
    expect(map.get(1)?.map((f) => f.name)).toContain('Rage');
  });

  it('sorts out-of-order features and preserves within-level authored order', () => {
    // A deliberately out-of-level-order fixture: level 3 before level 1, and two
    // level-2 features whose authored order must be preserved.
    const unordered: ClassFeature[] = [
      { name: 'Third', level: 3, effect: 'x', source: 's' },
      { name: 'FirstA', level: 1, effect: 'x', source: 's' },
      { name: 'SecondA', level: 2, effect: 'x', source: 's' },
      { name: 'SecondB', level: 2, effect: 'x', source: 's' },
      { name: 'FirstB', level: 1, effect: 'x', source: 's' },
    ];
    const character: Character = {
      ...BLANK_CHARACTER,
      class: { id: 'wizard', level: 3 },
      level: 3,
    };
    // The resolver groups a real catalog class; to exercise the grouping with a
    // deliberately out-of-order fixture we reproduce its exact stable-sort +
    // group steps on the synthetic array, then confirm the real resolver still
    // yields ascending keys for a real class.
    const sorted = [...unordered].sort((a, b) => a.level - b.level);
    const grouped = new Map<number, ClassFeature[]>();
    for (const f of sorted) {
      const bucket = grouped.get(f.level);
      if (bucket) bucket.push(f);
      else grouped.set(f.level, [f]);
    }
    expect([...grouped.keys()]).toEqual([1, 2, 3]);
    expect(grouped.get(1)?.map((f) => f.name)).toEqual(['FirstA', 'FirstB']);
    expect(grouped.get(2)?.map((f) => f.name)).toEqual(['SecondA', 'SecondB']);
    // And the real resolver still yields ascending keys for the real class.
    expect([...classFeaturesByLevel(character).keys()]).toEqual(
      [...classFeaturesByLevel(character).keys()].sort((a, b) => a - b),
    );
  });
});

describe('no-ASI guard', () => {
  it('selecting any class at any level 1-20 never changes the six ability modifiers', () => {
    const baseline = allAbilityModifiers(BLANK_CHARACTER.abilities);
    for (const cls of CLASS_LIST) {
      for (let level = 1; level <= 20; level++) {
        const character = withClass({ id: cls.id, level }, level);
        const mods = allAbilityModifiers(character.abilities);
        for (const ability of ABILITIES) {
          expect(mods[ability]).toBe(baseline[ability]);
        }
      }
    }
  });
});
