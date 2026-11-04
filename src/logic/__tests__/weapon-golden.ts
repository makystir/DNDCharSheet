/**
 * GOLDEN TABLE for Stage A5d: weapon attacks, damage, proficiency, mastery, cover,
 * ammunition and the Light extra attack.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md) BEFORE the logic is implemented. The implementer must
 * make the real functions reproduce every row and MUST NOT edit this file. If a row
 * looks wrong, flag it in the summary instead of changing it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. A harness in the
 * implementer's tests maps each row to the real API. Weapon ids refer to the shipped
 * weapon catalog (src/data/weapons.ts); ability modifier = floor((score - 10) / 2).
 *
 * Sources (PHB 2024 headings / approximate lines):
 *  - Attack Rolls (~L434-492): hit when the roll equals or exceeds AC; Strength for
 *    melee weapons and Unarmed Strikes, Dexterity for ranged weapons; add the
 *    Proficiency Bonus when proficient; natural 20 always hits (Critical Hit) and
 *    natural 1 always misses, for ATTACK ROLLS only.
 *  - Damage Rolls / Critical Hits (~L1085-1100): add the SAME ability modifier used to
 *    attack; a fixed-damage weapon (Blowgun) adds none; a Critical Hit rolls the damage
 *    DICE twice and adds modifiers once.
 *  - Weapon Proficiency / Properties (~L9296-9346): Finesse (choice of Str or Dex,
 *    same modifier for attack and damage), Heavy (Disadvantage if a Melee weapon and
 *    Str < 13, or a Ranged weapon and Dex < 13), Light (extra attack as a Bonus Action
 *    with a DIFFERENT Light weapon, no ability modifier to its damage unless negative),
 *    Thrown (a thrown Melee weapon uses the melee ability modifier), Versatile (the
 *    parenthesised dice when used two-handed in melee), Ammunition (one piece per attack;
 *    after a fight recover half the pieces used, rounded down).
 *  - Mastery Properties (~L9348-9386): usable only with a feature that unlocks them.
 *    Graze: damage equal to the attack ability modifier on a miss. Topple: Constitution
 *    save DC 8 + the attack ability modifier + Proficiency Bonus. Cleave: the second
 *    attack adds no ability modifier unless negative.
 *  - Ranged attacks (~L1000-1030): Disadvantage beyond normal range, no attack beyond
 *    long range, Disadvantage when within 5 feet of an enemy who can see you and is not
 *    Incapacitated. Unseen Attackers and Targets: Disadvantage against a target you
 *    cannot see, Advantage when the target cannot see you. Cover: Half +2, Three-Quarters
 *    +5, Total cannot be targeted, only the most protective degree applies.
 *  - Unarmed Strike (~L21683): attack bonus Str modifier + Proficiency Bonus; on a hit
 *    1 + Str modifier Bludgeoning damage.
 *  - Class weapon proficiencies (Core Traits tables) and the Weapon Mastery features and
 *    Features tables (Barbarian, Fighter scale; Paladin, Ranger, Rogue are a fixed 2).
 *
 * Rows tagged `interpretation` are orchestrator-approved readings where the PHB does not
 * state the point verbatim.
 */

// ─── Class weapon proficiency ────────────────────────────────────────────────
export interface WeaponProficiencyRule {
  simple: boolean;
  martial: boolean;
  /** Martial weapons that have ANY of these properties (e.g. Monk: Light). */
  martialWithAnyOf?: string[];
}

export const CLASS_WEAPON_PROFICIENCY: Record<string, WeaponProficiencyRule> = {
  barbarian: { simple: true, martial: true },
  bard: { simple: true, martial: false },
  cleric: { simple: true, martial: false },
  druid: { simple: true, martial: false },
  fighter: { simple: true, martial: true },
  monk: { simple: true, martial: false, martialWithAnyOf: ['light'] },
  paladin: { simple: true, martial: true },
  ranger: { simple: true, martial: true },
  rogue: { simple: true, martial: false, martialWithAnyOf: ['finesse', 'light'] },
  sorcerer: { simple: true, martial: false },
  warlock: { simple: true, martial: false },
  wizard: { simple: true, martial: false },
};

export interface ProficiencyCase {
  classId: string;
  weaponId: string;
  expect: boolean;
  why: string;
}

export const PROFICIENCY_CASES: ProficiencyCase[] = [
  { classId: 'fighter', weaponId: 'greatsword', expect: true, why: 'Fighter: Simple and Martial' },
  { classId: 'barbarian', weaponId: 'glaive', expect: true, why: 'Barbarian: Simple and Martial' },
  { classId: 'paladin', weaponId: 'lance', expect: true, why: 'Paladin: Simple and Martial' },
  { classId: 'ranger', weaponId: 'longbow', expect: true, why: 'Ranger: Simple and Martial' },
  { classId: 'bard', weaponId: 'dagger', expect: true, why: 'Bard: Simple' },
  { classId: 'bard', weaponId: 'rapier', expect: false, why: 'Bard: Simple only (2024), Rapier is Martial' },
  { classId: 'cleric', weaponId: 'mace', expect: true, why: 'Cleric: Simple' },
  { classId: 'cleric', weaponId: 'battleaxe', expect: false, why: 'Cleric: Battleaxe is Martial' },
  { classId: 'druid', weaponId: 'sickle', expect: true, why: 'Druid: Simple' },
  { classId: 'druid', weaponId: 'scimitar', expect: false, why: 'Druid: Scimitar is Martial in 2024' },
  { classId: 'sorcerer', weaponId: 'dart', expect: true, why: 'Sorcerer: Simple' },
  { classId: 'sorcerer', weaponId: 'longbow', expect: false, why: 'Sorcerer: Longbow is Martial' },
  { classId: 'warlock', weaponId: 'shortbow', expect: true, why: 'Warlock: Simple' },
  { classId: 'wizard', weaponId: 'light-crossbow', expect: true, why: 'Wizard: Simple' },
  { classId: 'wizard', weaponId: 'longsword', expect: false, why: 'Wizard: Longsword is Martial' },
  { classId: 'monk', weaponId: 'quarterstaff', expect: true, why: 'Monk: Simple' },
  { classId: 'monk', weaponId: 'shortsword', expect: true, why: 'Monk: Martial with the Light property (Shortsword is Light)' },
  { classId: 'monk', weaponId: 'scimitar', expect: true, why: 'Monk: Martial with the Light property (Scimitar is Light)' },
  { classId: 'monk', weaponId: 'longsword', expect: false, why: 'Monk: Longsword is Martial without Light' },
  { classId: 'monk', weaponId: 'rapier', expect: false, why: 'Monk needs LIGHT; Rapier is Finesse only' },
  { classId: 'rogue', weaponId: 'rapier', expect: true, why: 'Rogue: Martial with Finesse' },
  { classId: 'rogue', weaponId: 'whip', expect: true, why: 'Rogue: Martial with Finesse (Whip)' },
  { classId: 'rogue', weaponId: 'hand-crossbow', expect: true, why: 'Rogue: Martial with Light (Hand Crossbow)' },
  { classId: 'rogue', weaponId: 'shortbow', expect: true, why: 'Rogue: Simple' },
  { classId: 'rogue', weaponId: 'longsword', expect: false, why: 'Rogue: Longsword is Martial with neither Finesse nor Light' },
];

// ─── Weapon Mastery: how many kinds, and which weapons are eligible ──────────
export interface MasteryCountCase {
  classId: string;
  level: number;
  expect: number;
}

export const MASTERY_COUNT_CASES: MasteryCountCase[] = [
  { classId: 'barbarian', level: 1, expect: 2 },
  { classId: 'barbarian', level: 3, expect: 2 },
  { classId: 'barbarian', level: 4, expect: 3 },
  { classId: 'barbarian', level: 9, expect: 3 },
  { classId: 'barbarian', level: 10, expect: 4 },
  { classId: 'barbarian', level: 20, expect: 4 },
  { classId: 'fighter', level: 1, expect: 3 },
  { classId: 'fighter', level: 3, expect: 3 },
  { classId: 'fighter', level: 4, expect: 4 },
  { classId: 'fighter', level: 9, expect: 4 },
  { classId: 'fighter', level: 10, expect: 5 },
  { classId: 'fighter', level: 15, expect: 5 },
  { classId: 'fighter', level: 16, expect: 6 },
  { classId: 'fighter', level: 20, expect: 6 },
  { classId: 'paladin', level: 1, expect: 2 },
  { classId: 'paladin', level: 20, expect: 2 },
  { classId: 'ranger', level: 1, expect: 2 },
  { classId: 'ranger', level: 20, expect: 2 },
  { classId: 'rogue', level: 1, expect: 2 },
  { classId: 'rogue', level: 20, expect: 2 },
  { classId: 'monk', level: 1, expect: 0 },
  { classId: 'wizard', level: 5, expect: 0 },
  { classId: 'bard', level: 1, expect: 0 },
  { classId: 'cleric', level: 1, expect: 0 },
  { classId: 'druid', level: 1, expect: 0 },
  { classId: 'sorcerer', level: 1, expect: 0 },
  { classId: 'warlock', level: 1, expect: 0 },
];

export interface MasteryEligibilityCase {
  classId: string;
  weaponId: string;
  expect: boolean;
  why: string;
}

export const MASTERY_ELIGIBILITY_CASES: MasteryEligibilityCase[] = [
  { classId: 'barbarian', weaponId: 'greataxe', expect: true, why: 'Barbarian: Simple or Martial MELEE weapons' },
  { classId: 'barbarian', weaponId: 'handaxe', expect: true, why: 'Barbarian: a thrown Melee weapon is still a Melee weapon' },
  { classId: 'barbarian', weaponId: 'javelin', expect: true, why: 'Barbarian: Simple Melee' },
  { classId: 'barbarian', weaponId: 'longbow', expect: false, why: 'Barbarian: Ranged weapons are not eligible' },
  { classId: 'fighter', weaponId: 'longbow', expect: true, why: 'Fighter: Simple or Martial weapons of any kind' },
  { classId: 'fighter', weaponId: 'dagger', expect: true, why: 'Fighter: any' },
  { classId: 'paladin', weaponId: 'longsword', expect: true, why: 'Paladin: weapons with which you have proficiency' },
  { classId: 'paladin', weaponId: 'shortbow', expect: true, why: 'Paladin: proficient (Simple)' },
  { classId: 'ranger', weaponId: 'longbow', expect: true, why: 'Ranger: proficient (Martial)' },
  { classId: 'rogue', weaponId: 'rapier', expect: true, why: 'Rogue: proficient (Martial with Finesse)' },
  { classId: 'rogue', weaponId: 'hand-crossbow', expect: true, why: 'Rogue: proficient (Martial with Light)' },
  { classId: 'rogue', weaponId: 'quarterstaff', expect: true, why: 'Rogue: proficient (Simple)' },
  { classId: 'rogue', weaponId: 'longsword', expect: false, why: 'Rogue: NOT proficient with the Longsword, so not eligible' },
  { classId: 'monk', weaponId: 'dagger', expect: false, why: 'Monk has no Weapon Mastery feature in the 2024 PHB' },
  { classId: 'wizard', weaponId: 'dagger', expect: false, why: 'Wizard has no Weapon Mastery feature' },
];

// ─── Attack bonus ────────────────────────────────────────────────────────────
export interface AttackBonusCase {
  name: string;
  cite: string;
  interpretation?: string;
  input: {
    weaponId: string;
    str: number;
    dex: number;
    proficient: boolean;
    /** Proficiency Bonus. */
    pb: number;
    /** Magic or other flat bonus to the attack roll. */
    attackBonus?: number;
    /** User override for a Finesse weapon (default: the higher modifier). */
    abilityChoice?: 'str' | 'dex';
    /** The weapon is being THROWN (a ranged attack made with a weapon that has Thrown). */
    thrown?: boolean;
  };
  expect: { ability: 'str' | 'dex'; abilityMod: number; attackTotal: number };
}

export const ATTACK_BONUS_CASES: AttackBonusCase[] = [
  { name: 'Melee weapon uses Strength (Longsword, Str 16, proficient, PB 2)', cite: 'Attack Roll Abilities', input: { weaponId: 'longsword', str: 16, dex: 12, proficient: true, pb: 2 }, expect: { ability: 'str', abilityMod: 3, attackTotal: 5 } },
  { name: 'Ranged weapon uses Dexterity (Longbow, Dex 16)', cite: 'Attack Roll Abilities', input: { weaponId: 'longbow', str: 10, dex: 16, proficient: true, pb: 2 }, expect: { ability: 'dex', abilityMod: 3, attackTotal: 5 } },
  { name: 'A ranged weapon without Finesse uses Dex even when Str is higher (Shortbow, Dex 8)', cite: 'Attack Roll Abilities', input: { weaponId: 'shortbow', str: 18, dex: 8, proficient: true, pb: 2 }, expect: { ability: 'dex', abilityMod: -1, attackTotal: 1 } },
  { name: 'Sling (ranged, no Finesse) uses Dex', cite: 'Attack Roll Abilities', input: { weaponId: 'sling', str: 18, dex: 12, proficient: true, pb: 2 }, expect: { ability: 'dex', abilityMod: 1, attackTotal: 3 } },
  { name: 'Finesse defaults to the HIGHER modifier (Dagger, Dex 16 > Str 10)', cite: 'Finesse', input: { weaponId: 'dagger', str: 10, dex: 16, proficient: true, pb: 2 }, expect: { ability: 'dex', abilityMod: 3, attackTotal: 5 } },
  { name: 'Finesse: the user may choose Strength instead', cite: 'Finesse: your choice of Strength or Dexterity', input: { weaponId: 'dagger', str: 10, dex: 16, proficient: true, pb: 2, abilityChoice: 'str' }, expect: { ability: 'str', abilityMod: 0, attackTotal: 2 } },
  { name: 'Finesse picks Strength when it is higher (Rapier, Str 18 > Dex 14)', cite: 'Finesse', input: { weaponId: 'rapier', str: 18, dex: 14, proficient: true, pb: 2 }, expect: { ability: 'str', abilityMod: 4, attackTotal: 6 } },
  { name: 'Finesse tie defaults to Strength', cite: 'Finesse (tie is the orchestrator\'s default)', interpretation: 'Equal modifiers: Strength by default; the user can still choose Dexterity.', input: { weaponId: 'dagger', str: 14, dex: 14, proficient: true, pb: 2 }, expect: { ability: 'str', abilityMod: 2, attackTotal: 4 } },
  { name: 'Finesse applies to a RANGED Finesse weapon too (Dart, Str 18 > Dex 12)', cite: 'Finesse (no melee-only restriction)', input: { weaponId: 'dart', str: 18, dex: 12, proficient: true, pb: 2 }, expect: { ability: 'str', abilityMod: 4, attackTotal: 6 } },
  { name: 'A thrown MELEE weapon without Finesse keeps the melee modifier (Handaxe thrown, Str 16, Dex 8)', cite: 'Thrown: same ability modifier as a melee attack with that weapon', input: { weaponId: 'handaxe', str: 16, dex: 8, proficient: true, pb: 2, thrown: true }, expect: { ability: 'str', abilityMod: 3, attackTotal: 5 } },
  { name: 'A thrown Finesse weapon may still use Dex (Dagger thrown, Dex 16)', cite: 'Thrown + Finesse', input: { weaponId: 'dagger', str: 10, dex: 16, proficient: true, pb: 2, thrown: true }, expect: { ability: 'dex', abilityMod: 3, attackTotal: 5 } },
  { name: 'Not proficient: no Proficiency Bonus', cite: 'Weapon Proficiency', input: { weaponId: 'longsword', str: 16, dex: 12, proficient: false, pb: 2 }, expect: { ability: 'str', abilityMod: 3, attackTotal: 3 } },
  { name: 'A magic +1 to the attack roll adds once', cite: 'Attack Rolls (flat bonus)', input: { weaponId: 'longsword', str: 16, dex: 12, proficient: true, pb: 2, attackBonus: 1 }, expect: { ability: 'str', abilityMod: 3, attackTotal: 6 } },
  { name: 'A negative modifier is allowed (Str 8)', cite: 'Ability modifier', input: { weaponId: 'longsword', str: 8, dex: 12, proficient: true, pb: 2 }, expect: { ability: 'str', abilityMod: -1, attackTotal: 1 } },
  { name: 'High level: Str 20 with PB 6', cite: 'Attack Rolls', input: { weaponId: 'greatsword', str: 20, dex: 10, proficient: true, pb: 6 }, expect: { ability: 'str', abilityMod: 5, attackTotal: 11 } },
];

// ─── Weapon damage ───────────────────────────────────────────────────────────
export interface WeaponDamageCase {
  name: string;
  cite: string;
  interpretation?: string;
  input: {
    weaponId: string;
    /** The ability modifier USED FOR THE ATTACK (damage uses the same one). */
    mod: number;
    /** Wielded two-handed in melee (matters only for Versatile weapons). */
    twoHanded?: boolean;
    /** normal = the usual attack; light-extra = the Light bonus-action attack; cleave = the Cleave second attack. */
    kind?: 'normal' | 'light-extra' | 'cleave';
    /** Magic or other flat bonus to damage. */
    damageBonus?: number;
  };
  expect: { dice: string; flat: number };
}

export const WEAPON_DAMAGE_CASES: WeaponDamageCase[] = [
  { name: 'Longsword one-handed: 1d8 + mod 3', cite: 'Damage Rolls', input: { weaponId: 'longsword', mod: 3 }, expect: { dice: '1d8', flat: 3 } },
  { name: 'Longsword two-handed (Versatile): 1d10 + mod 3', cite: 'Versatile', input: { weaponId: 'longsword', mod: 3, twoHanded: true }, expect: { dice: '1d10', flat: 3 } },
  { name: 'Quarterstaff one-handed: 1d6', cite: 'Versatile', input: { weaponId: 'quarterstaff', mod: 2, twoHanded: false }, expect: { dice: '1d6', flat: 2 } },
  { name: 'Quarterstaff two-handed: 1d8', cite: 'Versatile', input: { weaponId: 'quarterstaff', mod: 2, twoHanded: true }, expect: { dice: '1d8', flat: 2 } },
  { name: 'A non-Versatile weapon ignores the two-handed flag (Greatsword 2d6)', cite: 'Versatile (only Versatile weapons change dice)', input: { weaponId: 'greatsword', mod: 4, twoHanded: true }, expect: { dice: '2d6', flat: 4 } },
  { name: 'Light extra attack adds NO ability modifier when it is positive', cite: 'Light', input: { weaponId: 'dagger', mod: 3, kind: 'light-extra' }, expect: { dice: '1d4', flat: 0 } },
  { name: 'Light extra attack DOES add a negative modifier', cite: 'Light: unless that modifier is negative', input: { weaponId: 'dagger', mod: -1, kind: 'light-extra' }, expect: { dice: '1d4', flat: -1 } },
  { name: 'Light extra attack with a +0 modifier', cite: 'Light', input: { weaponId: 'dagger', mod: 0, kind: 'light-extra' }, expect: { dice: '1d4', flat: 0 } },
  { name: 'Cleave second attack adds NO positive modifier', cite: 'Cleave', input: { weaponId: 'greataxe', mod: 4, kind: 'cleave' }, expect: { dice: '1d12', flat: 0 } },
  { name: 'Cleave second attack DOES add a negative modifier', cite: 'Cleave: unless that modifier is negative', input: { weaponId: 'greataxe', mod: -2, kind: 'cleave' }, expect: { dice: '1d12', flat: -2 } },
  { name: 'A fixed-damage weapon adds no ability modifier (Blowgun 1)', cite: 'Damage Rolls: fixed damage (Blowgun)', input: { weaponId: 'blowgun', mod: 3 }, expect: { dice: '1', flat: 0 } },
  { name: 'Magic +2 to damage adds once: 1d8 + 3 + 2', cite: 'Damage Rolls (flat bonus)', input: { weaponId: 'longsword', mod: 3, damageBonus: 2 }, expect: { dice: '1d8', flat: 5 } },
  { name: 'A magic damage bonus still applies to the Light extra attack (it is not an ability modifier)', cite: 'Light: the ability modifier is excluded, other bonuses are not', interpretation: 'A weapon\'s magic bonus is not "your ability modifier", so it is kept.', input: { weaponId: 'dagger', mod: 3, kind: 'light-extra', damageBonus: 1 }, expect: { dice: '1d4', flat: 1 } },
];

// ─── Critical hits: roll the damage DICE twice ───────────────────────────────
export interface DoubleDiceCase {
  dice: string;
  expect: string;
}

export const DOUBLE_DICE_CASES: DoubleDiceCase[] = [
  { dice: '1d8', expect: '2d8' },
  { dice: '1d4', expect: '2d4' },
  { dice: '2d6', expect: '4d6' },
  { dice: '1d12', expect: '2d12' },
  { dice: '3d4', expect: '6d4' },
  { dice: '1', expect: '1' }, // a fixed amount has no dice to double
];

// ─── Resolving an attack roll ────────────────────────────────────────────────
export type AttackResult = 'critical-hit' | 'hit' | 'miss';

export interface AttackResolutionCase {
  name: string;
  cite: string;
  mode: 'normal' | 'advantage' | 'disadvantage';
  faces: number[];
  bonus: number;
  /** Exhaustion level; the roll is reduced by 2 x level (decision D1). */
  exhaustion: number;
  ac: number;
  expect: { used: number; natural: number; total: number; result: AttackResult };
}

export const ATTACK_RESOLUTION_CASES: AttackResolutionCase[] = [
  { name: 'Natural 20 always hits and is a Critical Hit, even far below the AC', cite: 'Rolling 20 or 1', mode: 'normal', faces: [20], bonus: 0, exhaustion: 0, ac: 25, expect: { used: 20, natural: 20, total: 20, result: 'critical-hit' } },
  { name: 'Natural 1 always misses, even with a huge bonus', cite: 'Rolling 20 or 1', mode: 'normal', faces: [1], bonus: 10, exhaustion: 0, ac: 5, expect: { used: 1, natural: 1, total: 11, result: 'miss' } },
  { name: 'Natural 1 misses even when the total would equal the AC', cite: 'Rolling 20 or 1', mode: 'normal', faces: [1], bonus: 0, exhaustion: 0, ac: 1, expect: { used: 1, natural: 1, total: 1, result: 'miss' } },
  { name: 'Total EQUAL to the AC hits', cite: 'Attack Rolls: equals or exceeds', mode: 'normal', faces: [10], bonus: 5, exhaustion: 0, ac: 15, expect: { used: 10, natural: 10, total: 15, result: 'hit' } },
  { name: 'One below the AC misses', cite: 'Attack Rolls', mode: 'normal', faces: [10], bonus: 4, exhaustion: 0, ac: 15, expect: { used: 10, natural: 10, total: 14, result: 'miss' } },
  { name: 'Natural 20 stays a Critical Hit under Exhaustion (judged on the raw die)', cite: 'Rolling 20 or 1 + Exhaustion', mode: 'normal', faces: [20], bonus: 5, exhaustion: 5, ac: 30, expect: { used: 20, natural: 20, total: 15, result: 'critical-hit' } },
  { name: 'Exhaustion 2 (-4) can still leave a hit: 14 + 5 - 4 = 15 vs AC 15', cite: 'Exhaustion: D20 Tests Affected', mode: 'normal', faces: [14], bonus: 5, exhaustion: 2, ac: 15, expect: { used: 14, natural: 14, total: 15, result: 'hit' } },
  { name: 'Advantage keeps the higher die (3, 17) + 2 vs AC 18 hits', cite: 'Advantage', mode: 'advantage', faces: [3, 17], bonus: 2, exhaustion: 0, ac: 18, expect: { used: 17, natural: 17, total: 19, result: 'hit' } },
  { name: 'Disadvantage keeps the lower die (3, 17) + 2 vs AC 6 misses', cite: 'Disadvantage', mode: 'disadvantage', faces: [3, 17], bonus: 2, exhaustion: 0, ac: 6, expect: { used: 3, natural: 3, total: 5, result: 'miss' } },
  { name: 'Advantage (1, 20) uses the 20: Critical Hit', cite: 'Advantage + Rolling 20 or 1', mode: 'advantage', faces: [1, 20], bonus: 0, exhaustion: 0, ac: 30, expect: { used: 20, natural: 20, total: 20, result: 'critical-hit' } },
  { name: 'Disadvantage (1, 20) uses the 1: miss', cite: 'Disadvantage + Rolling 20 or 1', mode: 'disadvantage', faces: [1, 20], bonus: 9, exhaustion: 0, ac: 5, expect: { used: 1, natural: 1, total: 10, result: 'miss' } },
];

// ─── Cover ───────────────────────────────────────────────────────────────────
export type CoverDegree = 'half' | 'three-quarters' | 'total';

export interface CoverCase {
  name: string;
  ac: number;
  covers: CoverDegree[];
  /** false = Total Cover: the target cannot be targeted directly. */
  targetable: boolean;
  /** Effective AC when targetable. */
  effectiveAc?: number;
}

export const COVER_CASES: CoverCase[] = [
  { name: 'No cover', ac: 15, covers: [], targetable: true, effectiveAc: 15 },
  { name: 'Half Cover: +2', ac: 15, covers: ['half'], targetable: true, effectiveAc: 17 },
  { name: 'Three-Quarters Cover: +5', ac: 15, covers: ['three-quarters'], targetable: true, effectiveAc: 20 },
  { name: 'Only the most protective degree applies (Half + Three-Quarters = +5, not +7)', ac: 15, covers: ['half', 'three-quarters'], targetable: true, effectiveAc: 20 },
  { name: 'Total Cover: cannot be targeted directly', ac: 15, covers: ['total'], targetable: false },
  { name: 'Total Cover wins over any other degree', ac: 15, covers: ['half', 'total'], targetable: false },
];

// ─── Situational Advantage / Disadvantage suggestions for an attack ──────────
export interface AttackSuggestionCase {
  name: string;
  cite: string;
  input: {
    weaponId: string;
    /** The weapon is thrown (a ranged attack). */
    thrown?: boolean;
    /** Distance to the target in feet (matters for ranged and thrown attacks). */
    distanceFt?: number;
    /** A hostile within 5 feet can see you and is not Incapacitated. */
    hostileAdjacentSeesYou?: boolean;
    str: number;
    dex: number;
    /** You cannot see the target. */
    targetUnseen?: boolean;
    /** The target cannot see you. */
    attackerUnseen?: boolean;
  };
  expect: {
    disadvantageFrom: string[];
    advantageFrom: string[];
    mode: 'normal' | 'advantage' | 'disadvantage';
    /** The target is beyond the weapon's long range: the attack cannot be made. */
    blocked: boolean;
  };
}

export const ATTACK_SUGGESTION_CASES: AttackSuggestionCase[] = [
  { name: 'Longbow inside normal range: nothing', cite: 'Range', input: { weaponId: 'longbow', distanceFt: 100, str: 10, dex: 14 }, expect: { disadvantageFrom: [], advantageFrom: [], mode: 'normal', blocked: false } },
  { name: 'Longbow beyond normal range (150) but within long (600): Disadvantage', cite: 'Range', input: { weaponId: 'longbow', distanceFt: 200, str: 10, dex: 14 }, expect: { disadvantageFrom: ['beyond-normal-range'], advantageFrom: [], mode: 'disadvantage', blocked: false } },
  { name: 'Exactly at long range (600) is still allowed', cite: 'Range', input: { weaponId: 'longbow', distanceFt: 600, str: 10, dex: 14 }, expect: { disadvantageFrom: ['beyond-normal-range'], advantageFrom: [], mode: 'disadvantage', blocked: false } },
  { name: 'Beyond long range (601): cannot attack', cite: 'Range: you can\'t attack a target beyond the long range', input: { weaponId: 'longbow', distanceFt: 601, str: 10, dex: 14 }, expect: { disadvantageFrom: [], advantageFrom: [], mode: 'normal', blocked: true } },
  { name: 'Ranged attack with an enemy adjacent who can see you: Disadvantage', cite: 'Ranged Attacks in Close Combat', input: { weaponId: 'longbow', distanceFt: 100, hostileAdjacentSeesYou: true, str: 10, dex: 14 }, expect: { disadvantageFrom: ['ranged-in-close-combat'], advantageFrom: [], mode: 'disadvantage', blocked: false } },
  { name: 'Two Disadvantage sources do not stack but both are listed', cite: 'Advantage/Disadvantage: They Don\'t Stack', input: { weaponId: 'longbow', distanceFt: 200, hostileAdjacentSeesYou: true, str: 10, dex: 14 }, expect: { disadvantageFrom: ['beyond-normal-range', 'ranged-in-close-combat'], advantageFrom: [], mode: 'disadvantage', blocked: false } },
  { name: 'Heavy melee weapon with Str 12: Disadvantage', cite: 'Heavy', input: { weaponId: 'greataxe', str: 12, dex: 14 }, expect: { disadvantageFrom: ['heavy-weapon'], advantageFrom: [], mode: 'disadvantage', blocked: false } },
  { name: 'Heavy melee weapon with Str 13: fine', cite: 'Heavy: Strength score at least 13', input: { weaponId: 'greataxe', str: 13, dex: 8 }, expect: { disadvantageFrom: [], advantageFrom: [], mode: 'normal', blocked: false } },
  { name: 'Heavy melee weapon checks Strength, not Dexterity (Str 8, Dex 18)', cite: 'Heavy', input: { weaponId: 'greataxe', str: 8, dex: 18 }, expect: { disadvantageFrom: ['heavy-weapon'], advantageFrom: [], mode: 'disadvantage', blocked: false } },
  { name: 'Heavy ranged weapon with Dex 12: Disadvantage', cite: 'Heavy', input: { weaponId: 'heavy-crossbow', distanceFt: 50, str: 18, dex: 12 }, expect: { disadvantageFrom: ['heavy-weapon'], advantageFrom: [], mode: 'disadvantage', blocked: false } },
  { name: 'Heavy ranged weapon with Dex 13: fine', cite: 'Heavy: Dexterity score at least 13', input: { weaponId: 'heavy-crossbow', distanceFt: 50, str: 8, dex: 13 }, expect: { disadvantageFrom: [], advantageFrom: [], mode: 'normal', blocked: false } },
  { name: 'A thrown Handaxe beyond its normal range (20): Disadvantage', cite: 'Thrown + Range', input: { weaponId: 'handaxe', thrown: true, distanceFt: 30, str: 14, dex: 14 }, expect: { disadvantageFrom: ['beyond-normal-range'], advantageFrom: [], mode: 'disadvantage', blocked: false } },
  { name: 'A thrown Handaxe beyond its long range (60): cannot attack', cite: 'Thrown + Range', input: { weaponId: 'handaxe', thrown: true, distanceFt: 61, str: 14, dex: 14 }, expect: { disadvantageFrom: [], advantageFrom: [], mode: 'normal', blocked: true } },
  { name: 'A thrown weapon is a ranged attack: adjacent enemy gives Disadvantage', cite: 'Ranged Attacks in Close Combat', input: { weaponId: 'handaxe', thrown: true, distanceFt: 10, hostileAdjacentSeesYou: true, str: 14, dex: 14 }, expect: { disadvantageFrom: ['ranged-in-close-combat'], advantageFrom: [], mode: 'disadvantage', blocked: false } },
  { name: 'The same Handaxe used in MELEE with an adjacent enemy: no penalty', cite: 'Melee Attacks', input: { weaponId: 'handaxe', hostileAdjacentSeesYou: true, str: 14, dex: 14 }, expect: { disadvantageFrom: [], advantageFrom: [], mode: 'normal', blocked: false } },
  { name: 'Target you cannot see: Disadvantage', cite: 'Unseen Attackers and Targets', input: { weaponId: 'longsword', targetUnseen: true, str: 14, dex: 14 }, expect: { disadvantageFrom: ['target-unseen'], advantageFrom: [], mode: 'disadvantage', blocked: false } },
  { name: 'Target that cannot see you: Advantage', cite: 'Unseen Attackers and Targets', input: { weaponId: 'longsword', attackerUnseen: true, str: 14, dex: 14 }, expect: { disadvantageFrom: [], advantageFrom: ['attacker-unseen'], mode: 'advantage', blocked: false } },
  { name: 'Unseen on both sides: Advantage and Disadvantage cancel', cite: 'Advantage/Disadvantage: any mix cancels', input: { weaponId: 'longsword', targetUnseen: true, attackerUnseen: true, str: 14, dex: 14 }, expect: { disadvantageFrom: ['target-unseen'], advantageFrom: ['attacker-unseen'], mode: 'normal', blocked: false } },
];

// ─── Mastery riders that are numbers ─────────────────────────────────────────
export interface GrazeCase {
  /** Ability modifier used for the missed attack roll. */
  mod: number;
  /** Damage dealt on the miss (never negative). */
  expect: number;
}

export const GRAZE_CASES: GrazeCase[] = [
  { mod: 3, expect: 3 },
  { mod: 1, expect: 1 },
  { mod: 0, expect: 0 },
  { mod: -1, expect: 0 },
];

export interface ToppleCase {
  mod: number;
  pb: number;
  /** Constitution save DC = 8 + the attack ability modifier + Proficiency Bonus. */
  expectDc: number;
}

export const TOPPLE_CASES: ToppleCase[] = [
  { mod: 3, pb: 2, expectDc: 13 },
  { mod: 0, pb: 2, expectDc: 10 },
  { mod: -1, pb: 2, expectDc: 9 },
  { mod: 5, pb: 6, expectDc: 19 },
];

// ─── Unarmed Strike ──────────────────────────────────────────────────────────
export interface UnarmedCase {
  str: number;
  pb: number;
  /** Attack bonus = Strength modifier + Proficiency Bonus (always proficient). */
  expectAttack: number;
  /** Bludgeoning damage on a hit = 1 + Strength modifier, never negative. */
  expectDamage: number;
  /** Grapple save DC = 8 + Strength modifier + Proficiency Bonus. */
  expectGrappleDc: number;
}

export const UNARMED_CASES: UnarmedCase[] = [
  { str: 16, pb: 2, expectAttack: 5, expectDamage: 4, expectGrappleDc: 13 },
  { str: 10, pb: 3, expectAttack: 3, expectDamage: 1, expectGrappleDc: 11 },
  { str: 8, pb: 2, expectAttack: 1, expectDamage: 0, expectGrappleDc: 9 },
  { str: 6, pb: 2, expectAttack: 0, expectDamage: 0, expectGrappleDc: 8 },
  { str: 20, pb: 6, expectAttack: 11, expectDamage: 6, expectGrappleDc: 19 },
];

// ─── Ammunition ──────────────────────────────────────────────────────────────
export interface AmmoRecoverCase {
  /** Pieces used in the fight. */
  used: number;
  /** Half of them, rounded DOWN, can be recovered after a fight. */
  expectRecovered: number;
}

export const AMMO_RECOVER_CASES: AmmoRecoverCase[] = [
  { used: 0, expectRecovered: 0 },
  { used: 1, expectRecovered: 0 },
  { used: 2, expectRecovered: 1 },
  { used: 5, expectRecovered: 2 },
  { used: 10, expectRecovered: 5 },
  { used: 11, expectRecovered: 5 },
];

export interface AmmoFireCase {
  /** Pieces on hand before the attack. */
  quantity: number;
  /** After one Ammunition attack. */
  expectQuantity: number;
  /** An attack needs ammunition to fire. */
  blocked: boolean;
}

export const AMMO_FIRE_CASES: AmmoFireCase[] = [
  { quantity: 20, expectQuantity: 19, blocked: false },
  { quantity: 1, expectQuantity: 0, blocked: false },
  { quantity: 0, expectQuantity: 0, blocked: true },
];

// ─── The Light extra attack ──────────────────────────────────────────────────
export interface LightExtraCase {
  name: string;
  cite: string;
  mainWeaponId: string;
  mainItemId: string;
  offWeaponId: string;
  offItemId: string;
  /** The character has taken the Attack action this turn. */
  attackActionTaken: boolean;
  expect: boolean;
}

export const LIGHT_EXTRA_CASES: LightExtraCase[] = [
  { name: 'Dagger then Shortsword: available', cite: 'Light', mainWeaponId: 'dagger', mainItemId: 'i1', offWeaponId: 'shortsword', offItemId: 'i2', attackActionTaken: true, expect: true },
  { name: 'Two separate Daggers: available', cite: 'Light: a different Light weapon', mainWeaponId: 'dagger', mainItemId: 'i1', offWeaponId: 'dagger', offItemId: 'i2', attackActionTaken: true, expect: true },
  { name: 'The SAME weapon item cannot be both: not available', cite: 'Light: a different Light weapon', mainWeaponId: 'dagger', mainItemId: 'i1', offWeaponId: 'dagger', offItemId: 'i1', attackActionTaken: true, expect: false },
  { name: 'The main weapon must be Light (Longsword is not)', cite: 'Light', mainWeaponId: 'longsword', mainItemId: 'i1', offWeaponId: 'dagger', offItemId: 'i2', attackActionTaken: true, expect: false },
  { name: 'The off-hand weapon must be Light', cite: 'Light', mainWeaponId: 'dagger', mainItemId: 'i1', offWeaponId: 'longsword', offItemId: 'i2', attackActionTaken: true, expect: false },
  { name: 'Requires the Attack action first', cite: 'Light: when you take the Attack action', mainWeaponId: 'dagger', mainItemId: 'i1', offWeaponId: 'shortsword', offItemId: 'i2', attackActionTaken: false, expect: false },
];
