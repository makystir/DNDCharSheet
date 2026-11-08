import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character } from '../../types/character';
import type { ClassId } from '../../data/classes';
import { getWeapon } from '../../data/weapons';
import {
  characterMasteryCap,
  chooseWeaponMastery,
  masteryCapBreakdown,
  masteryChoices,
  masteryEligibleForCharacter,
  weaponMasteryStatus,
} from '../weapon-mastery';
import { MULTICLASS_CAP_CASES, MULTICLASS_ELIGIBILITY_CASES } from './weapon-mastery-multiclass-golden';

function multi(classes: ReadonlyArray<{ id: string; level: number }>, masteries?: string[]): Character {
  const level = classes.reduce((sum, c) => sum + c.level, 0);
  const base: Character = {
    ...createCharacter('Tester'),
    level,
    classes: classes.map((c) => ({ id: c.id as ClassId, level: c.level })),
  };
  return masteries === undefined ? base : { ...base, weaponMasteries: masteries };
}

const weapon = (id: string) => {
  const w = getWeapon(id);
  if (!w) throw new Error(`unknown weapon ${id}`);
  return w;
};

describe('multiclass Weapon Mastery cap (sum of per-class counts)', () => {
  for (const row of MULTICLASS_CAP_CASES) {
    it(`${row.why} -> ${row.cap}`, () => {
      const character = multi(row.classes);
      expect(characterMasteryCap(character)).toBe(row.cap);
      expect(masteryChoices(character).cap).toBe(row.cap);
      const breakdown = masteryCapBreakdown(character);
      expect(breakdown.total).toBe(row.cap);
      expect(breakdown.components.reduce((sum, c) => sum + c.value, 0)).toBe(row.cap);
    });
  }

  it('cardinality: the golden pins nine cap rows', () => {
    expect(MULTICLASS_CAP_CASES).toHaveLength(9);
  });

  it('fail-closed: a primary-class-only cap would be caught', () => {
    const primaryOnly = (c: Character) => characterMasteryCap({ ...c, classes: c.classes?.slice(0, 1) });
    const mismatches = MULTICLASS_CAP_CASES.filter((r) => primaryOnly(multi(r.classes)) !== r.cap);
    expect(mismatches.length).toBeGreaterThan(0);
  });

  it('breakdown lists every class, zero contributors included', () => {
    const labels = masteryCapBreakdown(multi([{ id: 'wizard', level: 5 }, { id: 'fighter', level: 1 }])).components;
    expect(labels).toEqual([
      { label: 'Wizard level 5 Weapon Mastery', value: 0 },
      { label: 'Fighter level 1 Weapon Mastery', value: 3 },
    ]);
  });
});

describe('multiclass Weapon Mastery eligibility (any mastery class)', () => {
  for (const row of MULTICLASS_ELIGIBILITY_CASES) {
    it(`${row.weaponId}: ${row.why}`, () => {
      expect(masteryEligibleForCharacter(multi(row.classes), weapon(row.weaponId))).toBe(row.eligible);
    });
  }
});

describe('multiclass Weapon Mastery choices', () => {
  it('a Fighter 3 / Rogue 2 can list five weapons and is refused a sixth', () => {
    const five = ['longsword', 'greataxe', 'rapier', 'dagger', 'shortsword'];
    const character = multi([{ id: 'fighter', level: 3 }, { id: 'rogue', level: 2 }], five);
    expect(masteryChoices(character)).toMatchObject({ cap: 5, slotsLeft: 0, overCap: [] });
    expect(chooseWeaponMastery(character, 'glaive')).toMatchObject({ ok: false, reason: 'list-full' });
    expect(weaponMasteryStatus(character, 'rapier').usable).toBe(true);
  });

  it('an over-cap list is kept, never trimmed (Barbarian 1 / Wizard 4 with three weapons)', () => {
    const list = ['longsword', 'greataxe', 'glaive'];
    const character = multi([{ id: 'barbarian', level: 1 }, { id: 'wizard', level: 4 }], list);
    expect(masteryChoices(character)).toMatchObject({ cap: 2, overCap: ['glaive'] });
    expect(character.weaponMasteries).toEqual(list);
    expect(weaponMasteryStatus(character, 'glaive')).toMatchObject({ usable: false, reason: 'over-cap' });
  });

  it('a non-primary mastery class unlocks masteries for a caster primary', () => {
    const character = multi([{ id: 'wizard', level: 5 }, { id: 'fighter', level: 1 }], ['longsword']);
    expect(weaponMasteryStatus(character, 'longsword')).toMatchObject({ usable: true, cap: 3 });
    expect(chooseWeaponMastery(character, 'dagger').ok).toBe(true);
  });
});
