import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, InventoryItem } from '../../types/character';
import { CLASS_LIST, getClass, type ClassId } from '../../data/classes';
import { getWeapon, type WeaponData, type WeaponProperty } from '../../data/weapons';
import { classProficientWithWeapon, isProficient, weaponProficiency } from '../attacks';
import {
  CLASS_WEAPON_PROFICIENCY,
  PROFICIENCY_CASES,
  type ProficiencyCase,
} from './weapon-golden';

function withClass(classId: string | undefined, level = 5): Character {
  const base = { ...createCharacter('Tester'), level };
  return classId === undefined ? base : { ...base, classes: [{ id: classId as ClassId, level }] };
}

function weaponItem(catalogId: string, extra: Partial<InventoryItem> = {}): InventoryItem {
  return { id: `item-${catalogId}`, kind: 'weapon', catalogId, quantity: 1, ...extra };
}

type ProficiencyFn = (character: Character, item: InventoryItem) => boolean;

/** Names of the golden rows a proficiency implementation gets wrong; empty = all pass. */
function proficiencyMismatches(fn: ProficiencyFn): string[] {
  return PROFICIENCY_CASES.filter((row) => fn(withClass(row.classId), weaponItem(row.weaponId)) !== row.expect).map(
    (row: ProficiencyCase) => `${row.classId}/${row.weaponId}`,
  );
}

describe('golden: CLASS_WEAPON_PROFICIENCY (structured data)', () => {
  for (const [classId, rule] of Object.entries(CLASS_WEAPON_PROFICIENCY)) {
    it(`${classId}: ClassData.weaponProficiency matches the golden rule`, () => {
      const data = getClass(classId);
      expect(data).toBeDefined();
      expect(data?.weaponProficiency.simple).toBe(rule.simple);
      expect(data?.weaponProficiency.martial).toBe(rule.martial);
      expect(data?.weaponProficiency.martialWithAnyOf ?? []).toEqual(rule.martialWithAnyOf ?? []);
    });
  }

  it('covers all 12 classes exactly', () => {
    expect(Object.keys(CLASS_WEAPON_PROFICIENCY).sort()).toEqual(CLASS_LIST.map((c) => c.id).sort());
    expect(CLASS_LIST).toHaveLength(12);
  });
});

/**
 * TEST-ONLY reading of the display strings (never done at runtime): the oracle that the
 * structured field and ClassData.weaponProficiencies cannot drift apart.
 */
function readDisplayStrings(strings: string[]): { simple: boolean; martial: boolean; martialWithAnyOf: string[] } {
  let simple = false;
  let martial = false;
  let martialWithAnyOf: string[] = [];
  for (const text of strings) {
    if (text === 'Simple weapons') simple = true;
    else if (text === 'Martial weapons') martial = true;
    else {
      const match = /^Martial weapons with the (.+) property$/.exec(text);
      if (!match) throw new Error(`Unrecognised weapon proficiency string: ${text}`);
      martialWithAnyOf = match[1].split(' or ').map((p) => p.trim().toLowerCase());
    }
  }
  return { simple, martial, martialWithAnyOf };
}

describe('oracle: structured weaponProficiency agrees with the display strings (all 12 classes)', () => {
  for (const cls of CLASS_LIST) {
    it(`${cls.id}`, () => {
      const read = readDisplayStrings(cls.weaponProficiencies);
      expect(cls.weaponProficiency.simple).toBe(read.simple);
      expect(cls.weaponProficiency.martial).toBe(read.martial);
      expect(cls.weaponProficiency.martialWithAnyOf ?? []).toEqual(read.martialWithAnyOf);
    });
  }

  it('is not satisfied trivially: the reader throws on an unknown string', () => {
    expect(() => readDisplayStrings(['Exotic weapons'])).toThrow();
  });

  it('every listed property is a real weapon property', () => {
    const known: WeaponProperty[] = ['ammunition', 'finesse', 'heavy', 'light', 'loading', 'range', 'reach', 'thrown', 'two-handed', 'versatile'];
    for (const cls of CLASS_LIST) {
      for (const p of cls.weaponProficiency.martialWithAnyOf ?? []) expect(known).toContain(p);
    }
  });
});

describe('golden: PROFICIENCY_CASES', () => {
  for (const row of PROFICIENCY_CASES) {
    it(`${row.classId} / ${row.weaponId}: ${row.why}`, () => {
      expect(isProficient(withClass(row.classId), weaponItem(row.weaponId))).toBe(row.expect);
      const result = weaponProficiency(withClass(row.classId), weaponItem(row.weaponId));
      expect(result.proficient).toBe(row.expect);
      expect(result.source).toBe('class');
    });
  }

  it('the unmutated implementation has no mismatching rows', () => {
    expect(proficiencyMismatches(isProficient)).toEqual([]);
  });
});

describe('weapon proficiency: own behaviour', () => {
  it('an item override wins over the class, in both directions', () => {
    const wizard = withClass('wizard');
    const yes = weaponProficiency(wizard, weaponItem('longsword', { proficiencyOverride: true }));
    expect(yes).toMatchObject({ proficient: true, source: 'override' });
    const fighter = withClass('fighter');
    const no = weaponProficiency(fighter, weaponItem('longsword', { proficiencyOverride: false }));
    expect(no).toMatchObject({ proficient: false, source: 'override' });
  });

  it('with no class selected the weapon is not proficient and the reason says so', () => {
    const result = weaponProficiency(withClass(undefined), weaponItem('dagger'));
    expect(result.proficient).toBe(false);
    expect(result.source).toBe('no-class');
    expect(result.reason).toMatch(/no class/i);
  });

  it('no class but an override still counts', () => {
    expect(isProficient(withClass(undefined), weaponItem('dagger', { proficiencyOverride: true }))).toBe(true);
  });

  it('a custom weapon with no catalog entry is not proficient unless overridden, with a reason', () => {
    const custom: InventoryItem = { id: 'c', kind: 'weapon', name: 'Homebrew Blade', quantity: 1 };
    const result = weaponProficiency(withClass('fighter'), custom);
    expect(result).toMatchObject({ proficient: false, source: 'unknown-weapon' });
    expect(result.reason).toMatch(/catalog/i);
    expect(isProficient(withClass('fighter'), { ...custom, proficiencyOverride: true })).toBe(true);
  });

  it('does not mutate the character or the item', () => {
    const character: Character = Object.freeze({ ...withClass('monk'), classes: [Object.freeze({ id: 'monk' as ClassId, level: 5 })] });
    const item = Object.freeze(weaponItem('shortsword'));
    expect(() => weaponProficiency(character, item)).not.toThrow();
  });

  it('classProficientWithWeapon works from the structured rule alone', () => {
    const dagger = getWeapon('dagger') as WeaponData;
    const rapier = getWeapon('rapier') as WeaponData;
    expect(classProficientWithWeapon({ simple: true, martial: false }, dagger)).toBe(true);
    expect(classProficientWithWeapon({ simple: false, martial: false }, dagger)).toBe(false);
    expect(classProficientWithWeapon({ simple: true, martial: false, martialWithAnyOf: ['finesse'] }, rapier)).toBe(true);
    expect(classProficientWithWeapon({ simple: true, martial: false, martialWithAnyOf: ['light'] }, rapier)).toBe(false);
  });
});

describe('fail-closed: proficiency mutants are caught by the golden rows', () => {
  it('"every class is proficient with everything" fails the non-proficient rows', () => {
    expect(proficiencyMismatches(() => true).length).toBeGreaterThan(0);
  });

  it('"Simple only, ignore Martial-with-property" fails the Monk and Rogue rows', () => {
    const mutant: ProficiencyFn = (character, item) => {
      const weapon = getWeapon(item.catalogId ?? '') as WeaponData;
      const rule = getClass(character.classes?.[0]?.id)?.weaponProficiency;
      if (!rule) return false;
      return weapon.category === 'simple' ? rule.simple : rule.martial;
    };
    const missed = proficiencyMismatches(mutant);
    expect(missed).toContain('monk/shortsword');
    expect(missed).toContain('rogue/rapier');
  });

  it('"Monk accepts Finesse as well as Light" fails the Monk Rapier row', () => {
    const mutant: ProficiencyFn = (character, item) => {
      const weapon = getWeapon(item.catalogId ?? '') as WeaponData;
      const rule = getClass(character.classes?.[0]?.id)?.weaponProficiency;
      if (!rule) return false;
      const widened =
        character.classes?.[0]?.id === 'monk' ? { ...rule, martialWithAnyOf: ['light', 'finesse'] as WeaponProperty[] } : rule;
      return classProficientWithWeapon(widened, weapon);
    };
    expect(proficiencyMismatches(mutant)).toContain('monk/rapier');
  });

  it('"Druid gets the 2014 Scimitar" fails the Druid Scimitar row', () => {
    const mutant: ProficiencyFn = (character, item) =>
      character.classes?.[0]?.id === 'druid' && item.catalogId === 'scimitar' ? true : isProficient(character, item);
    expect(proficiencyMismatches(mutant)).toContain('druid/scimitar');
  });

  it('perturbing the class changes the answer (Fighter Longsword yes, Wizard Longsword no)', () => {
    expect(isProficient(withClass('fighter'), weaponItem('longsword'))).toBe(true);
    expect(isProficient(withClass('wizard'), weaponItem('longsword'))).toBe(false);
  });
});
