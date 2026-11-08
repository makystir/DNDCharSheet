/**
 * Multiclass weapon proficiency (level-up gap analysis, item 3).
 * PHB 2024 "Multiclassing: Proficiencies" (L2104-2106): the initial class grants
 * its full Core Traits proficiencies; a non-initial class grants only its
 * "As a Multiclass Character" set (Martial weapons for Barbarian, Fighter,
 * Paladin, Ranger; nothing for the other classes).
 */
import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, InventoryItem } from '../../types/character';
import type { ClassId } from '../../data/classes';
import { getWeapon } from '../../data/weapons';
import { characterProficientWithWeapon, weaponProficiency } from '../attacks';
import { masteryEligibleForCharacter } from '../weapon-mastery';

function multi(classes: ReadonlyArray<[string, number]>): Character {
  return {
    ...createCharacter('T'),
    level: classes.reduce((s, [, l]) => s + l, 0),
    classes: classes.map(([id, level]) => ({ id: id as ClassId, level })),
  };
}
const weapon = (id: string) => {
  const w = getWeapon(id);
  if (!w) throw new Error(id);
  return w;
};
const item = (weaponId: string): InventoryItem => ({ id: 'i', kind: 'weapon', catalogId: weaponId, quantity: 1 });

const ROWS: ReadonlyArray<{ name: string; classes: ReadonlyArray<[string, number]>; weapon: string; proficient: boolean }> = [
  { name: 'Wizard 1 / Fighter 1: martial longsword via the Fighter multiclass entry', classes: [['wizard', 1], ['fighter', 1]], weapon: 'longsword', proficient: true },
  { name: 'Wizard 1 / Paladin 1: martial via Paladin', classes: [['wizard', 1], ['paladin', 1]], weapon: 'longsword', proficient: true },
  { name: 'Cleric 1 / Barbarian 1: martial via Barbarian', classes: [['cleric', 1], ['barbarian', 1]], weapon: 'greataxe', proficient: true },
  { name: 'Wizard 1 / Rogue 1: Rogue multiclass grants no weapons (rapier is martial finesse)', classes: [['wizard', 1], ['rogue', 1]], weapon: 'rapier', proficient: false },
  { name: 'Wizard 1 / Monk 1: Monk multiclass grants no weapons (shortsword is martial light)', classes: [['wizard', 1], ['monk', 1]], weapon: 'shortsword', proficient: false },
  { name: 'Fighter 1 / Wizard 1: initial Fighter keeps everything', classes: [['fighter', 1], ['wizard', 1]], weapon: 'longbow', proficient: true },
  { name: 'Fighter 1 / Wizard 1: simple weapon stays proficient', classes: [['fighter', 1], ['wizard', 1]], weapon: 'dagger', proficient: true },
  { name: 'Wizard 1 / Fighter 1: a non-initial class never REMOVES the initial simple set', classes: [['wizard', 1], ['fighter', 1]], weapon: 'dagger', proficient: true },
  { name: 'Wizard 1 / Bard 1: Bard multiclass grants no martial', classes: [['wizard', 1], ['bard', 1]], weapon: 'longsword', proficient: false },
  { name: 'Barbarian 1 / Rogue 1: initial Barbarian is martial', classes: [['barbarian', 1], ['rogue', 1]], weapon: 'longbow', proficient: true },
];

describe('multiclass weapon proficiency golden', () => {
  it.each(ROWS)('$name', (row) => {
    const c = multi(row.classes);
    expect(characterProficientWithWeapon(c, weapon(row.weapon))).toBe(row.proficient);
    expect(weaponProficiency(c, item(row.weapon)).proficient).toBe(row.proficient);
  });
});

describe('Weapon Mastery eligibility uses the character proficiency (Paladin/Ranger/Rogue)', () => {
  it('Wizard 1 / Rogue 1 cannot master a rapier (no martial proficiency) but can a dagger', () => {
    const c = multi([['wizard', 1], ['rogue', 1]]);
    expect(masteryEligibleForCharacter(c, weapon('rapier'))).toBe(false);
    expect(masteryEligibleForCharacter(c, weapon('dagger'))).toBe(true);
  });
  it('Fighter 1 / Rogue 1: a Rogue mastery slot may use any weapon the Fighter is proficient with', () => {
    // Fighter alone already allows everything; Rogue must not narrow it.
    const c = multi([['fighter', 1], ['rogue', 1]]);
    expect(masteryEligibleForCharacter(c, weapon('longbow'))).toBe(true);
  });
  it('Barbarian 1 / Rogue 1: longbow is eligible through Rogue (Barbarian grants Martial proficiency)', () => {
    const c = multi([['barbarian', 1], ['rogue', 1]]);
    expect(masteryEligibleForCharacter(c, weapon('longbow'))).toBe(true);
  });
  it('Rogue 1 / Wizard 1: Rogue full proficiency (martial finesse) applies as the initial class', () => {
    const c = multi([['rogue', 1], ['wizard', 1]]);
    expect(masteryEligibleForCharacter(c, weapon('rapier'))).toBe(true);
  });
});
