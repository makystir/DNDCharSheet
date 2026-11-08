/**
 * Weapon Mastery (Stage A5d, decision D8): which weapon kinds a character has
 * chosen, whether a mastery property is usable, and the two numeric riders.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md):
 *  - "Mastery Properties" (L9351-9352): a weapon's mastery property is usable only by a
 *    character who has a feature, such as Weapon Mastery, that unlocks it.
 *  - Barbarian, Fighter, Paladin, Ranger and Rogue "Weapon Mastery" (data in
 *    src/data/weapon-mastery.ts): a number of weapon KINDS chosen from an eligible set.
 *  - Graze (L9358): on a miss, damage equal to the ability modifier used for the attack.
 *  - Topple (L9376): Constitution save, DC 8 + the attack ability modifier + Proficiency Bonus.
 *
 * D8 gate: usable only if a feature unlocks it AND the character chose that weapon.
 * `Character.weaponMasteries` is capped by `masteryCount`; a list that exceeds the cap
 * (the level dropped) is KEPT, never silently deleted, but only its first `cap` entries
 * are usable. Classes with no Weapon Mastery show every mastery locked.
 *
 * NICK AMBIGUITY (flagged, informational only): Nick lets the Light extra attack be made
 * as part of the Attack action instead of a Bonus Action, once per turn (L9366). The PHB
 * does not say whether that extra attack still needs the Attack action's weapon to be a
 * different Light weapon, or how it interacts with Extra Attack. The app therefore only
 * shows Nick as text and never changes the Light extra attack's availability.
 * Push, Sap, Slow, Vex and Nick are informational; Cleave's damage rule is in
 * attacks.ts `weaponDamage` (kind 'cleave').
 */
import type { Character, InventoryItem } from '../types/character';
import { getWeapon, type MasteryProperty, type WeaponData } from '../data/weapons';
import { getClass } from '../data/classes';
import { CLASS_MASTERY_RULES } from '../data/weapon-mastery';
import { allClasses, resolveClass } from './classes';
import { characterProficientWithWeapon, classProficientWithWeapon } from './attacks';
import type { Breakdown } from './breakdown';
import { resolveWeapon } from './weapons';

/** How many weapon kinds a class can master at a class level (0 = no Weapon Mastery). */
export function masteryCount(classId: string | undefined, level: number): number {
  if (classId === undefined || !Object.hasOwn(CLASS_MASTERY_RULES, classId)) return 0;
  const rule = CLASS_MASTERY_RULES[classId as keyof typeof CLASS_MASTERY_RULES];
  let count = 0;
  for (const [fromLevel, value] of rule.counts) {
    if (level >= fromLevel) count = value;
  }
  return count;
}

/** Whether a class may choose this weapon for Weapon Mastery. */
export function masteryEligible(classId: string | undefined, weapon: WeaponData): boolean {
  if (classId === undefined || !Object.hasOwn(CLASS_MASTERY_RULES, classId)) return false;
  const rule = CLASS_MASTERY_RULES[classId as keyof typeof CLASS_MASTERY_RULES];
  switch (rule.eligibility) {
    case 'simple-or-martial-melee':
      return weapon.range === 'melee';
    case 'simple-or-martial':
      return true;
    case 'proficient': {
      const cls = getClass(classId);
      return cls !== undefined && classProficientWithWeapon(cls.weaponProficiency, weapon);
    }
    case 'none':
      return false;
  }
}

export type MasteryLockReason = 'no-class' | 'no-feature' | 'not-chosen' | 'not-eligible' | 'over-cap';

export interface MasteryStatus {
  usable: boolean;
  reason?: MasteryLockReason;
  /** A plain sentence for the locked chip's tooltip. */
  explanation: string;
  /** How many kinds the class can master at this level. */
  cap: number;
}

const LOCK_TEXT: Record<MasteryLockReason, string> = {
  'no-class': 'No class is selected, so no feature unlocks weapon masteries.',
  'no-feature': 'Your class has no Weapon Mastery feature, so mastery properties are locked.',
  'not-chosen': 'You have not chosen this weapon for Weapon Mastery.',
  'not-eligible': 'Your class cannot use Weapon Mastery with this weapon.',
  'over-cap': 'You have chosen more weapons than your level allows; this one is past the limit.',
};

/**
 * The Weapon Mastery cap across ALL of the character's classes: the sum of each
 * class's own count at that class's own level (PHB 2024 "Multiclassing": you gain the
 * features of each class you take levels in, and Weapon Mastery is a level 1 feature
 * of Barbarian, Fighter, Paladin, Ranger and Rogue).
 * AMBIGUITY (flagged): the PHB does not say whether the counts of two classes add up
 * or whether weapons are assigned per class. This sums the counts and treats the
 * single flat list as shared; the app cannot enforce a per-class share of it.
 * A character with no class entries has a cap of 0.
 */
export function characterMasteryCap(character: Character): number {
  return allClasses(character).reduce((sum, entry) => sum + masteryCount(entry.id, entry.level), 0);
}

/** Per-class parts of {@link characterMasteryCap}; the components sum to the total. */
export function masteryCapBreakdown(character: Character): Breakdown {
  const components = allClasses(character).map((entry) => ({
    label: `${getClass(entry.id)?.name ?? entry.id} level ${entry.level} Weapon Mastery`,
    value: masteryCount(entry.id, entry.level),
  }));
  return { total: components.reduce((sum, c) => sum + c.value, 0), components };
}

/** Whether ANY of the character's Weapon Mastery classes lets it choose this weapon. */
export function masteryEligibleForCharacter(character: Character, weapon: WeaponData): boolean {
  return allClasses(character).some((entry) => {
    if (masteryCount(entry.id, entry.level) <= 0) return false;
    // Paladin / Ranger / Rogue: "weapons of your choice with which you have
    // proficiency" (PHB 2024 L4904, L5406, L5902) is the CHARACTER's proficiency
    // across all classes (initial class full set + multiclass grants), not just
    // the class that owns the Weapon Mastery feature.
    if (Object.hasOwn(CLASS_MASTERY_RULES, entry.id) &&
        CLASS_MASTERY_RULES[entry.id as keyof typeof CLASS_MASTERY_RULES].eligibility === 'proficient') {
      return characterProficientWithWeapon(character, weapon);
    }
    return masteryEligible(entry.id, weapon);
  });
}

function uniqueChosen(character: Character): string[] {
  return [...new Set(character.weaponMasteries ?? [])];
}

/** The stored weapon ids, how many the class allows, and which are past the limit. */
export function masteryChoices(character: Character): {
  cap: number;
  chosen: string[];
  usable: string[];
  overCap: string[];
  slotsLeft: number;
} {
  const cap = characterMasteryCap(character);
  const chosen = uniqueChosen(character);
  return {
    cap,
    chosen,
    usable: chosen.slice(0, cap),
    overCap: chosen.slice(cap),
    slotsLeft: Math.max(0, cap - chosen.length),
  };
}

/** Whether the mastery of one weapon kind (catalog id) is usable (D8). */
export function weaponMasteryStatus(character: Character, weaponId: string): MasteryStatus {
  const cap = characterMasteryCap(character);
  const locked = (reason: MasteryLockReason): MasteryStatus => ({ usable: false, reason, explanation: LOCK_TEXT[reason], cap });
  if (!resolveClass(character)) return locked('no-class');
  if (cap === 0) return locked('no-feature');
  const chosen = uniqueChosen(character);
  const index = chosen.indexOf(weaponId);
  if (index < 0) return locked('not-chosen');
  const weapon = getWeapon(weaponId);
  if (!weapon || !masteryEligibleForCharacter(character, weapon)) return locked('not-eligible');
  if (index >= cap) return locked('over-cap');
  return { usable: true, explanation: 'Unlocked by your Weapon Mastery feature.', cap };
}

/** The same check for an inventory weapon item (custom weapons are locked: no catalog kind). */
export function itemMasteryStatus(character: Character, item: InventoryItem): MasteryStatus {
  const weapon = resolveWeapon(item);
  if (!weapon) return { usable: false, reason: 'not-chosen', explanation: LOCK_TEXT['not-chosen'], cap: characterMasteryCap(character) };
  return weaponMasteryStatus(character, weapon.id);
}

export interface ChooseMasteryResult {
  character: Character;
  ok: boolean;
  reason?: 'no-class' | 'no-feature' | 'unknown-weapon' | 'not-eligible' | 'already-chosen' | 'list-full';
}

/** Choose a weapon kind for Weapon Mastery. Never mutates; rejects ineligible or over-cap picks. */
export function chooseWeaponMastery(character: Character, weaponId: string): ChooseMasteryResult {
  if (!resolveClass(character)) return { character, ok: false, reason: 'no-class' };
  const cap = characterMasteryCap(character);
  if (cap === 0) return { character, ok: false, reason: 'no-feature' };
  const weapon = getWeapon(weaponId);
  if (!weapon) return { character, ok: false, reason: 'unknown-weapon' };
  if (!masteryEligibleForCharacter(character, weapon)) return { character, ok: false, reason: 'not-eligible' };
  const chosen = uniqueChosen(character);
  if (chosen.includes(weaponId)) return { character, ok: false, reason: 'already-chosen' };
  if (chosen.length >= cap) return { character, ok: false, reason: 'list-full' };
  return { character: { ...character, weaponMasteries: [...chosen, weaponId] }, ok: true };
}

/** Drop a weapon kind from the list (the only way entries leave it). Empty list removes the field. */
export function removeWeaponMastery(character: Character, weaponId: string): Character {
  const stored = character.weaponMasteries ?? [];
  if (!stored.includes(weaponId)) return character;
  const remaining = stored.filter((id) => id !== weaponId);
  const next: Character = { ...character };
  if (remaining.length === 0) delete next.weaponMasteries;
  else next.weaponMasteries = remaining;
  return next;
}

/** Properties shown as text only: they need a target or position the app does not track. */
const INFORMATIONAL: ReadonlySet<MasteryProperty> = new Set<MasteryProperty>(['nick', 'push', 'sap', 'slow', 'vex']);

export function isInformationalMastery(property: MasteryProperty): boolean {
  return INFORMATIONAL.has(property);
}

/** Graze: damage equal to the attack ability modifier on a miss, never below 0. L9358. */
export function grazeDamage(mod: number): Breakdown {
  return {
    total: Math.max(0, mod),
    components: [
      { label: 'Attack ability mod', value: mod },
      { label: 'Cannot go below 0', value: mod < 0 ? -mod : 0 },
    ],
  };
}

/** Topple: Constitution save DC = 8 + the attack ability modifier + Proficiency Bonus. L9376. */
export function toppleDc(mod: number, pb: number): Breakdown {
  return {
    total: 8 + mod + pb,
    components: [
      { label: 'Base', value: 8 },
      { label: 'Attack ability mod', value: mod },
      { label: 'Proficiency', value: pb },
    ],
  };
}
