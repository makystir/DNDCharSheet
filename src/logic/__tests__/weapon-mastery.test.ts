import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, InventoryItem } from '../../types/character';
import type { ClassId } from '../../data/classes';
import { CLASS_LIST } from '../../data/classes';
import { CLASS_MASTERY_RULES } from '../../data/weapon-mastery';
import { WEAPON_LIST, getWeapon, type MasteryProperty, type WeaponData } from '../../data/weapons';
import { sumComponents } from './breakdown-helpers';
import {
  chooseWeaponMastery,
  grazeDamage,
  isInformationalMastery,
  itemMasteryStatus,
  masteryChoices,
  masteryCount,
  masteryEligible,
  removeWeaponMastery,
  toppleDc,
  weaponMasteryStatus,
} from '../weapon-mastery';
import {
  GRAZE_CASES,
  MASTERY_COUNT_CASES,
  MASTERY_ELIGIBILITY_CASES,
  TOPPLE_CASES,
  type MasteryCountCase,
  type MasteryEligibilityCase,
} from './weapon-golden';

const weaponOf = (id: string): WeaponData => {
  const weapon = getWeapon(id);
  if (!weapon) throw new Error(`unknown weapon ${id}`);
  return weapon;
};

function withClass(classId: string | undefined, level: number, masteries?: string[]): Character {
  const base: Character = { ...createCharacter('Tester'), level };
  const withClassSel = classId === undefined ? base : { ...base, class: { id: classId as ClassId, level } };
  return masteries === undefined ? withClassSel : { ...withClassSel, weaponMasteries: masteries };
}

type CountFn = (classId: string, level: number) => number;
type EligibleFn = (classId: string, weapon: WeaponData) => boolean;

const countMismatches = (fn: CountFn): string[] =>
  MASTERY_COUNT_CASES.filter((row: MasteryCountCase) => fn(row.classId, row.level) !== row.expect).map((r) => `${r.classId}@${r.level}`);

const eligibilityMismatches = (fn: EligibleFn): string[] =>
  MASTERY_ELIGIBILITY_CASES.filter((row: MasteryEligibilityCase) => fn(row.classId, weaponOf(row.weaponId)) !== row.expect).map(
    (r) => `${r.classId}/${r.weaponId}`,
  );

describe('golden: MASTERY_COUNT_CASES', () => {
  for (const row of MASTERY_COUNT_CASES) {
    it(`${row.classId} level ${row.level} -> ${row.expect}`, () => {
      expect(masteryCount(row.classId, row.level)).toBe(row.expect);
    });
  }

  it('the unmutated implementation has no mismatching rows', () => {
    expect(countMismatches(masteryCount)).toEqual([]);
  });

  it('covers all 12 classes in the data table', () => {
    expect(Object.keys(CLASS_MASTERY_RULES).sort()).toEqual(CLASS_LIST.map((c) => c.id).sort());
  });

  it('an unknown or missing class has no masteries; level 0 has none', () => {
    expect(masteryCount(undefined, 5)).toBe(0);
    expect(masteryCount('artificer', 5)).toBe(0);
    expect(masteryCount('toString', 5)).toBe(0);
    expect(masteryCount('fighter', 0)).toBe(0);
  });

  it('fail-closed: mutants are caught (flat Fighter 3, Barbarian never growing)', () => {
    expect(countMismatches((c, l) => (c === 'fighter' ? 3 : masteryCount(c, l)))).toContain('fighter@4');
    expect(countMismatches((c, l) => (c === 'barbarian' ? 2 : masteryCount(c, l)))).toContain('barbarian@4');
    expect(countMismatches((c, l) => (c === 'monk' ? 2 : masteryCount(c, l)))).toContain('monk@1');
  });
});

describe('golden: MASTERY_ELIGIBILITY_CASES', () => {
  for (const row of MASTERY_ELIGIBILITY_CASES) {
    it(`${row.classId} / ${row.weaponId}: ${row.why}`, () => {
      expect(masteryEligible(row.classId, weaponOf(row.weaponId))).toBe(row.expect);
    });
  }

  it('the unmutated implementation has no mismatching rows', () => {
    expect(eligibilityMismatches(masteryEligible)).toEqual([]);
  });

  it('fail-closed: a non-proficient Rogue picking Longsword is caught', () => {
    const anyMartial: EligibleFn = (classId, weapon) => (classId === 'rogue' ? true : masteryEligible(classId, weapon));
    expect(eligibilityMismatches(anyMartial)).toContain('rogue/longsword');
    const meleeToo: EligibleFn = (classId, weapon) => (classId === 'barbarian' ? true : masteryEligible(classId, weapon));
    expect(eligibilityMismatches(meleeToo)).toContain('barbarian/longbow');
    const noFeatureOk: EligibleFn = (classId, weapon) => (classId === 'monk' ? true : masteryEligible(classId, weapon));
    expect(eligibilityMismatches(noFeatureOk)).toContain('monk/dagger');
  });

  it('chooseWeaponMastery refuses a non-proficient Rogue pick of Longsword (and accepts Rapier)', () => {
    const rogue = withClass('rogue', 5);
    expect(chooseWeaponMastery(rogue, 'longsword')).toMatchObject({ ok: false, reason: 'not-eligible' });
    expect(chooseWeaponMastery(rogue, 'rapier').ok).toBe(true);
  });

  it('Barbarian is melee only, Fighter takes any Simple/Martial weapon', () => {
    for (const weapon of WEAPON_LIST) {
      expect(masteryEligible('barbarian', weapon)).toBe(weapon.range === 'melee');
      expect(masteryEligible('fighter', weapon)).toBe(true);
      expect(masteryEligible('wizard', weapon)).toBe(false);
    }
  });
});

describe('golden: GRAZE_CASES', () => {
  for (const row of GRAZE_CASES) {
    it(`mod ${row.mod} -> ${row.expect}`, () => {
      const b = grazeDamage(row.mod);
      expect(b.total).toBe(row.expect);
      expect(sumComponents(b)).toBe(b.total);
    });
  }

  it('fail-closed: negative graze damage is caught', () => {
    expect(GRAZE_CASES.some((row) => row.mod < 0 && row.mod !== row.expect)).toBe(true);
  });
});

describe('golden: TOPPLE_CASES', () => {
  for (const row of TOPPLE_CASES) {
    it(`mod ${row.mod}, PB ${row.pb} -> DC ${row.expectDc}`, () => {
      const b = toppleDc(row.mod, row.pb);
      expect(b.total).toBe(row.expectDc);
      expect(sumComponents(b)).toBe(b.total);
      expect(b.components.map((c) => c.label)).toEqual(['Base', 'Attack ability mod', 'Proficiency']);
    });
  }
});

describe('D8 gate: usable only if a feature unlocks it AND the character chose the weapon', () => {
  it('a Fighter who chose Longsword can use it; one who did not cannot', () => {
    const fighter = withClass('fighter', 1, ['longsword']);
    expect(weaponMasteryStatus(fighter, 'longsword')).toMatchObject({ usable: true, cap: 3 });
    expect(weaponMasteryStatus(fighter, 'greataxe')).toMatchObject({ usable: false, reason: 'not-chosen' });
  });

  it('classes with no Weapon Mastery show every mastery locked, even with a stored list', () => {
    const wizard = withClass('wizard', 5, ['dagger']);
    expect(weaponMasteryStatus(wizard, 'dagger')).toMatchObject({ usable: false, reason: 'no-feature', cap: 0 });
    for (const id of ['monk', 'bard', 'cleric', 'druid', 'sorcerer', 'warlock']) {
      expect(weaponMasteryStatus(withClass(id, 5, ['dagger']), 'dagger').usable).toBe(false);
    }
  });

  it('no class selected: locked with the no-class reason', () => {
    expect(weaponMasteryStatus(withClass(undefined, 5, ['dagger']), 'dagger')).toMatchObject({ usable: false, reason: 'no-class' });
  });

  it('a stored but ineligible choice is locked (a non-proficient Rogue with Longsword)', () => {
    const rogue = withClass('rogue', 5, ['longsword', 'rapier']);
    expect(weaponMasteryStatus(rogue, 'longsword')).toMatchObject({ usable: false, reason: 'not-eligible' });
    expect(weaponMasteryStatus(rogue, 'rapier').usable).toBe(true);
  });

  it('every locked status has a plain explanation', () => {
    for (const status of [
      weaponMasteryStatus(withClass(undefined, 1), 'dagger'),
      weaponMasteryStatus(withClass('wizard', 1), 'dagger'),
      weaponMasteryStatus(withClass('fighter', 1), 'dagger'),
      weaponMasteryStatus(withClass('rogue', 1, ['longsword']), 'longsword'),
    ]) {
      expect(status.usable).toBe(false);
      expect(status.explanation.length).toBeGreaterThan(10);
    }
  });

  it('an inventory item is checked through its catalog weapon; a custom weapon is locked', () => {
    const fighter = withClass('fighter', 1, ['longsword']);
    const sword: InventoryItem = { id: 's', kind: 'weapon', catalogId: 'longsword', quantity: 1 };
    expect(itemMasteryStatus(fighter, sword).usable).toBe(true);
    const custom: InventoryItem = { id: 'c', kind: 'weapon', name: 'Homebrew', quantity: 1 };
    expect(itemMasteryStatus(fighter, custom)).toMatchObject({ usable: false, reason: 'not-chosen', cap: 3 });
  });
});

describe('over-cap list is kept, never silently deleted', () => {
  const list = ['longsword', 'greataxe', 'glaive'];

  it('a Barbarian who dropped from level 4 (3 slots) to level 1 (2 slots) keeps all three', () => {
    const barbarian = withClass('barbarian', 1, list);
    const choices = masteryChoices(barbarian);
    expect(choices).toMatchObject({ cap: 2, chosen: list, usable: ['longsword', 'greataxe'], overCap: ['glaive'], slotsLeft: 0 });
    expect(barbarian.weaponMasteries).toEqual(list);
  });

  it('only the first `cap` entries are usable; the extra is locked as over-cap', () => {
    const barbarian = withClass('barbarian', 1, list);
    expect(weaponMasteryStatus(barbarian, 'longsword').usable).toBe(true);
    expect(weaponMasteryStatus(barbarian, 'greataxe').usable).toBe(true);
    expect(weaponMasteryStatus(barbarian, 'glaive')).toMatchObject({ usable: false, reason: 'over-cap' });
  });

  it('removing one frees the slot, and the over-cap entry becomes usable', () => {
    const barbarian = withClass('barbarian', 1, list);
    const next = removeWeaponMastery(barbarian, 'longsword');
    expect(next.weaponMasteries).toEqual(['greataxe', 'glaive']);
    expect(weaponMasteryStatus(next, 'glaive').usable).toBe(true);
  });

  it('adding past the cap is refused and changes nothing', () => {
    const barbarian = withClass('barbarian', 1, ['longsword', 'greataxe']);
    const result = chooseWeaponMastery(barbarian, 'glaive');
    expect(result).toMatchObject({ ok: false, reason: 'list-full' });
    expect(result.character).toBe(barbarian);
  });

  it('a level-up raises the cap and the earlier choices stay', () => {
    const at3 = withClass('barbarian', 3, ['longsword', 'greataxe']);
    expect(masteryChoices(at3).slotsLeft).toBe(0);
    const at4 = { ...at3, class: { id: 'barbarian' as ClassId, level: 4 }, level: 4 };
    expect(masteryChoices(at4)).toMatchObject({ cap: 3, slotsLeft: 1 });
    expect(chooseWeaponMastery(at4, 'glaive').ok).toBe(true);
  });

  it('duplicates in the stored list count once', () => {
    const fighter = withClass('fighter', 1, ['longsword', 'longsword', 'dagger']);
    expect(masteryChoices(fighter)).toMatchObject({ chosen: ['longsword', 'dagger'], slotsLeft: 1 });
  });
});

describe('choosing and removing masteries: immutability and refusals', () => {
  it('never mutates the input character or its list', () => {
    const list = Object.freeze(['longsword']) as unknown as string[];
    const fighter = Object.freeze({ ...withClass('fighter', 1), weaponMasteries: list });
    const added = chooseWeaponMastery(fighter, 'dagger');
    expect(added.ok).toBe(true);
    expect(added.character.weaponMasteries).toEqual(['longsword', 'dagger']);
    expect(added.character).not.toBe(fighter);
    expect(fighter.weaponMasteries).toEqual(['longsword']);
    const removed = removeWeaponMastery(fighter, 'longsword');
    expect(removed.weaponMasteries).toBeUndefined();
    expect('weaponMasteries' in removed).toBe(false);
    expect(fighter.weaponMasteries).toEqual(['longsword']);
  });

  it('refuses with a reason: no class, no feature, unknown weapon, duplicate', () => {
    expect(chooseWeaponMastery(withClass(undefined, 1), 'dagger')).toMatchObject({ ok: false, reason: 'no-class' });
    expect(chooseWeaponMastery(withClass('wizard', 1), 'dagger')).toMatchObject({ ok: false, reason: 'no-feature' });
    expect(chooseWeaponMastery(withClass('fighter', 1), 'lightsaber')).toMatchObject({ ok: false, reason: 'unknown-weapon' });
    expect(chooseWeaponMastery(withClass('fighter', 1, ['dagger']), 'dagger')).toMatchObject({ ok: false, reason: 'already-chosen' });
  });

  it('removing an absent weapon returns the same character', () => {
    const fighter = withClass('fighter', 1, ['dagger']);
    expect(removeWeaponMastery(fighter, 'longsword')).toBe(fighter);
  });
});

describe('informational masteries (Nick is flagged as ambiguous)', () => {
  it('Nick, Push, Sap, Slow and Vex are informational; Cleave, Graze and Topple are computed', () => {
    const informational: MasteryProperty[] = ['nick', 'push', 'sap', 'slow', 'vex'];
    const computed: MasteryProperty[] = ['cleave', 'graze', 'topple'];
    for (const p of informational) expect(isInformationalMastery(p)).toBe(true);
    for (const p of computed) expect(isInformationalMastery(p)).toBe(false);
  });
});
