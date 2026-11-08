/**
 * Weapon attacks, damage, cover, Advantage/Disadvantage suggestions, Unarmed Strike,
 * ammunition and the Light extra attack (Stage A5d, logic only).
 *
 * Everything is pure. Rolling takes an injected RNG (random.ts); resolution takes
 * the d20 faces as arguments so typed-in physical dice work the same way. Every
 * derived number is a Breakdown whose components sum to its total (zeros included).
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md; line numbers are 1-indexed):
 *  - "Attack Rolls" (L432-492): a roll equal to or above the target's AC hits; Strength
 *    for melee weapons and Unarmed Strikes, Dexterity for ranged weapons; add the
 *    Proficiency Bonus when proficient; "Rolling 20 or 1" (L466-471): a natural 20 always
 *    hits and is a Critical Hit, a natural 1 always misses (attack rolls only).
 *  - "Damage Rolls" (L1081-1086): add the same ability modifier used for the attack;
 *    damage can reach 0 but never go negative; a fixed damage amount (Blowgun) gets no
 *    ability modifier. "Critical Hits" (L1087-1100): roll the damage dice twice and add
 *    modifiers as normal (once).
 *  - Weapon "Properties" (L9300-9346): Finesse, Heavy, Light, Range, Thrown, Versatile,
 *    Ammunition. "Mastery Properties" Cleave (L9355) adds no positive modifier.
 *  - "Cover" (L977-1000, L20830): Half +2, Three-Quarters +5, Total cannot be targeted;
 *    only the most protective degree applies.
 *  - "Unseen Attackers and Targets" (L983-990), "Ranged Attacks" (L1001-1010) and
 *    "Ranged Attacks in Close Combat" (L1011-1014).
 *  - "Unarmed Strike" (L21683-21690) and "Exhaustion" (D20 Tests, L21024; decision D1).
 *
 * Not modelled here (out of scope for A5d): Extra Attack, Sneak Attack, Smite, Rage,
 * Fighting Styles and feats (including the Two-Weapon Fighting feat, L9110, which is
 * why the Light extra attack must NOT add the modifier by itself), monsters and target HP.
 */
import {
  ABILITY_NAMES,
  type Ability,
  type AbilityScores,
  type Character,
  type InventoryItem,
} from '../types/character';
import type { WeaponData } from '../data/weapons';
import type { WeaponProficiencyRule } from '../data/classes';
import { getCondition } from '../data/conditions';
import { getEquipment } from '../data/equipment';
import { abilityModifier, proficiencyBonus } from './abilities';
import type { Breakdown, BreakdownComponent } from './breakdown';
import { resolveClass, weaponProficiencyRules } from './classes';
import { exhaustionLevelOf } from './conditions';
import { effectiveAbilityScores } from './feats';
import {
  combineD20Mode,
  d20FromFaces,
  d20TestBreakdown,
  rollD20,
  rollDice,
  type D20Mode,
} from './dice';
import { effectiveConditionIds } from './hit-points-state';
import type { RNG } from './random';
import { resolveWeapon } from './weapons';
import { choiceGrantsMartialWeapons } from './class-choice-effects';

// ─── Proficiency ─────────────────────────────────────────────────────────────

/**
 * Whether a class rule makes the character proficient with a weapon. Simple weapons
 * need `simple`; Martial weapons need `martial`, or at least one property listed in
 * `martialWithAnyOf` (Monk: Light; Rogue: Finesse or Light). PHB 2024 Core <Class>
 * Traits "Weapon Proficiencies" and "Weapon Proficiency" (L9296).
 */
export function classProficientWithWeapon(rule: WeaponProficiencyRule, weapon: WeaponData): boolean {
  if (weapon.category === 'simple') return rule.simple;
  if (rule.martial) return true;
  return (rule.martialWithAnyOf ?? []).some((property) => weapon.properties.includes(property));
}

export type ProficiencySource = 'override' | 'class' | 'no-class' | 'unknown-weapon';

export interface WeaponProficiencyResult {
  proficient: boolean;
  source: ProficiencySource;
  /** A plain sentence for the tooltip. */
  reason: string;
}

/**
 * Proficiency for one inventory weapon. The item's `proficiencyOverride` wins; with
 * no class selected the answer is "not proficient" and the reason says so; a custom
 * weapon with no catalog entry cannot be judged and is not proficient unless overridden.
 */
export function weaponProficiency(character: Character, item: InventoryItem): WeaponProficiencyResult {
  if (item.proficiencyOverride !== undefined) {
    return {
      proficient: item.proficiencyOverride,
      source: 'override',
      reason: item.proficiencyOverride
        ? 'Marked proficient on this item (overrides the class).'
        : 'Marked not proficient on this item (overrides the class).',
    };
  }
  const weapon = resolveWeapon(item);
  if (!weapon) {
    return {
      proficient: false,
      source: 'unknown-weapon',
      reason: 'This weapon is not in the catalog, so proficiency cannot be worked out. Mark it proficient on the item if it is.',
    };
  }
  const cls = resolveClass(character);
  if (!cls) {
    return {
      proficient: false,
      source: 'no-class',
      reason: 'No class is selected, so no weapon proficiency is known. Choose a class or mark the item proficient.',
    };
  }
  // PHB 2024 "Multiclassing: Proficiencies" (L2104-2106): the initial class's full
  // weapon proficiencies plus each other class's reduced multiclass set.
  const granting = weaponProficiencyRules(character).find((r) => classProficientWithWeapon(r.rule, weapon));
  const proficient = granting !== undefined;
  // Cleric Protector / Druid Warden grant Martial weapon proficiency (PHB 2024
  // L3232, L3668).
  if (!proficient && choiceGrantsMartialWeapons(character)) {
    return {
      proficient: true,
      source: 'class',
      reason: 'Your Divine Order / Primal Order grants proficiency with Martial weapons.',
    };
  }
  return {
    proficient,
    source: 'class',
    reason: proficient
      ? `${granting.className} is proficient with this weapon.`
      : `${cls.name} is not proficient with this weapon.`,
  };
}

/**
 * Whether the character, across ALL classes, is proficient with a catalog weapon
 * (class proficiencies only: no item override, no Divine/Primal Order grant, which
 * the item-level {@link weaponProficiency} layers on top).
 */
export function characterProficientWithWeapon(character: Character, weapon: WeaponData): boolean {
  return (
    weaponProficiencyRules(character).some((r) => classProficientWithWeapon(r.rule, weapon)) ||
    choiceGrantsMartialWeapons(character)
  );
}

/** True when the character is proficient with the weapon item. */
export function isProficient(character: Character, item: InventoryItem): boolean {
  return weaponProficiency(character, item).proficient;
}

// ─── Attack ability and attack bonus ─────────────────────────────────────────

type MeleeRangedAbility = Extract<Ability, 'str' | 'dex'>;

export interface AttackAbilityResult {
  ability: MeleeRangedAbility;
  /** The ability modifier used for BOTH the attack and the damage roll. */
  mod: number;
}

/**
 * The ability used for a weapon attack. Finesse: the player's choice, defaulting to
 * the higher modifier and to Strength on a tie (the orchestrator's default; the player
 * can still choose Dexterity). Otherwise Strength for a Melee weapon (a thrown Melee
 * weapon keeps its melee modifier, Thrown L9335) and Dexterity for a Ranged weapon.
 * PHB 2024 "Attack Roll Abilities" (L436-449) and "Finesse" (L9308). The choice is
 * ignored on a weapon without Finesse.
 */
export function attackAbility(
  weapon: WeaponData,
  scores: Pick<AbilityScores, 'str' | 'dex'>,
  abilityChoice?: MeleeRangedAbility,
): AttackAbilityResult {
  const str = abilityModifier(scores.str);
  const dex = abilityModifier(scores.dex);
  let ability: MeleeRangedAbility;
  if (weapon.properties.includes('finesse')) {
    ability = abilityChoice ?? (dex > str ? 'dex' : 'str');
  } else {
    ability = weapon.range === 'ranged' ? 'dex' : 'str';
  }
  return { ability, mod: ability === 'str' ? str : dex };
}

export interface AttackBonusInput {
  weapon: WeaponData;
  scores: Pick<AbilityScores, 'str' | 'dex'>;
  proficient: boolean;
  /** Proficiency Bonus. */
  pb: number;
  /** Magic or other flat bonus to the attack roll. */
  attackBonus?: number;
  /** Finesse weapons only: use this ability instead of the higher modifier. */
  abilityChoice?: MeleeRangedAbility;
}

export interface AttackBonus {
  ability: MeleeRangedAbility;
  abilityMod: number;
  /** Ability modifier + Proficiency (if proficient) + Magic / other. */
  breakdown: Breakdown;
}

/** Attack bonus = ability modifier + Proficiency Bonus if proficient + magic/other. PHB L436-453. */
export function attackBonusBreakdown(input: AttackBonusInput): AttackBonus {
  const { ability, mod } = attackAbility(input.weapon, input.scores, input.abilityChoice);
  const components: BreakdownComponent[] = [
    { label: `${ABILITY_NAMES[ability]} mod`, value: mod },
    { label: input.proficient ? 'Proficiency' : 'Proficiency (not proficient)', value: input.proficient ? input.pb : 0 },
    { label: 'Magic / other', value: input.attackBonus ?? 0 },
  ];
  return { ability, abilityMod: mod, breakdown: sum(components) };
}

// ─── Damage ──────────────────────────────────────────────────────────────────

/**
 * normal = the usual attack; light-extra = the Light property's Bonus Action attack
 * (L9312); cleave = the Cleave mastery's second attack (L9355). The last two add the
 * ability modifier to damage only when it is negative.
 */
export type AttackKind = 'normal' | 'light-extra' | 'cleave';

export interface WeaponDamageInput {
  weapon: WeaponData;
  /** The ability modifier USED FOR THE ATTACK. */
  mod: number;
  /** The ability that modifier came from (label only). */
  ability?: Ability;
  /** Wielded two-handed in melee (Versatile weapons only). */
  twoHanded?: boolean;
  /** The weapon is being thrown (a Versatile weapon's two-handed dice need a melee attack). */
  thrown?: boolean;
  kind?: AttackKind;
  /** Magic or other flat bonus to damage. */
  damageBonus?: number;
}

export interface WeaponDamage {
  /** Dice to roll, e.g. '1d8', or a fixed amount like '1'. */
  dice: string;
  /** Flat part: ability modifier (when it applies) + magic/other. */
  flat: number;
  /** The flat part as components (ability modifier, magic/other); sums to `flat`. */
  breakdown: Breakdown;
  damageType: WeaponData['damageType'];
}

const FIXED_DAMAGE = /^\d+$/;

/**
 * Weapon damage: the weapon's dice (the Versatile dice when wielded two-handed in a
 * melee attack) plus the same ability modifier used to attack. A fixed-damage weapon
 * (Blowgun) adds none; the Light extra attack and Cleave add it only when negative.
 * A magic damage bonus is not "your ability modifier", so it is always kept.
 */
export function weaponDamage(input: WeaponDamageInput): WeaponDamage {
  const { weapon } = input;
  const kind = input.kind ?? 'normal';
  const useVersatile =
    input.twoHanded === true && input.thrown !== true && weapon.properties.includes('versatile') && weapon.versatileDice !== undefined;
  const dice = useVersatile ? (weapon.versatileDice as string) : weapon.damageDice;
  const fixed = FIXED_DAMAGE.test(dice);

  let modValue = input.mod;
  const notes: string[] = [];
  if (fixed) {
    modValue = 0;
    notes.push('A fixed damage amount gets no ability modifier.');
  } else if (kind !== 'normal' && input.mod > 0) {
    modValue = 0;
    notes.push(
      kind === 'light-extra'
        ? 'The Light extra attack adds no ability modifier unless it is negative.'
        : 'The Cleave attack adds no ability modifier unless it is negative.',
    );
  }
  const abilityLabel = input.ability ? `${ABILITY_NAMES[input.ability]} mod` : 'Ability mod';
  const components: BreakdownComponent[] = [
    { label: abilityLabel, value: modValue },
    { label: 'Magic / other', value: input.damageBonus ?? 0 },
  ];
  const breakdown = sum(components);
  if (notes.length > 0) breakdown.note = notes.join(' ');
  return { dice, flat: breakdown.total, breakdown, damageType: weapon.damageType };
}

const DICE_TERM = /^(\d+)d(\d+)$/i;

/**
 * Critical Hit dice: the damage dice are rolled twice, modifiers once. '1d8' becomes
 * '2d8'; a fixed amount with no dice stays as it is. PHB 2024 "Critical Hits" (L1087-1100).
 */
export function doubleDice(dice: string): string {
  const text = dice.trim();
  if (FIXED_DAMAGE.test(text)) return text;
  const match = DICE_TERM.exec(text);
  if (!match) throw new Error(`doubleDice(): unsupported dice expression "${dice}"`);
  return `${Number(match[1]) * 2}d${match[2]}`;
}

/** Damage after the dice are known: flat added, never below 0 (L1084). */
export function damageTotal(diceTotal: number, flat: number): number {
  return Math.max(0, diceTotal + flat);
}

export interface RolledDamage {
  /** The dice actually rolled (doubled on a Critical Hit). */
  dice: string;
  rolls: number[];
  diceTotal: number;
  flat: number;
  total: number;
}

/** Roll weapon damage with an injected RNG; a Critical Hit doubles the dice only. */
export function rollWeaponDamage(damage: WeaponDamage, critical: boolean, rng: RNG): RolledDamage {
  const dice = critical ? doubleDice(damage.dice) : damage.dice;
  const rolled = rollDice(dice, rng);
  return { dice, rolls: rolled.rolls, diceTotal: rolled.total, flat: damage.flat, total: damageTotal(rolled.total, damage.flat) };
}

// ─── Resolving an attack roll ────────────────────────────────────────────────

export type AttackResult = 'critical-hit' | 'hit' | 'miss';

export interface AttackResolution {
  mode: D20Mode;
  rolls: number[];
  /** The face kept after Advantage / Disadvantage. */
  used: number;
  /** The raw kept face; natural 20 / natural 1 are judged on this alone. */
  natural: number;
  /** d20 + attack bonus + Exhaustion (-2 x level, decision D1). */
  total: number;
  result: AttackResult;
  /** d20, attack bonus components, Exhaustion; components sum to the total. */
  breakdown: Breakdown;
}

/**
 * Resolve an attack roll from d20 face(s). `bonus` is a number or the attack-bonus
 * Breakdown (its components are listed individually). Exhaustion subtracts 2 per level
 * as its own component (D1), but a natural 20 / natural 1 is judged on the raw die:
 * 20 always hits as a Critical Hit, 1 always misses, anything else hits when the total
 * equals or exceeds `ac`. PHB 2024 "Attack Rolls" (L435) and "Rolling 20 or 1" (L466-471).
 * Throws a RangeError for faces that do not match the mode.
 */
export function resolveAttack(
  faces: number[],
  mode: D20Mode,
  bonus: number | Breakdown,
  exhaustion: number,
  ac: number,
): AttackResolution {
  const d20 = d20FromFaces(faces, mode);
  const modifiers: BreakdownComponent[] =
    typeof bonus === 'number' ? [{ label: 'Attack bonus', value: bonus }] : bonus.components.map((c) => ({ ...c }));
  const breakdown = d20TestBreakdown(d20.used, exhaustion, modifiers);
  let result: AttackResult;
  if (d20.natural === 20) result = 'critical-hit';
  else if (d20.natural === 1) result = 'miss';
  else result = breakdown.total >= ac ? 'hit' : 'miss';
  if (mode !== 'normal') {
    breakdown.note = `${mode === 'advantage' ? 'Advantage' : 'Disadvantage'}: rolled ${d20.rolls.join(' and ')}, kept ${d20.used}.`;
  }
  return { mode, rolls: d20.rolls, used: d20.used, natural: d20.natural, total: breakdown.total, result, breakdown };
}

/** Roll an attack with an injected RNG, then resolve it. */
export function rollAttack(
  rng: RNG,
  mode: D20Mode,
  bonus: number | Breakdown,
  exhaustion: number,
  ac: number,
): AttackResolution {
  const d20 = rollD20(rng, mode);
  return resolveAttack(d20.rolls, mode, bonus, exhaustion, ac);
}

// ─── Cover ───────────────────────────────────────────────────────────────────

export type CoverDegree = 'half' | 'three-quarters' | 'total';

const COVER_BONUS: Record<Exclude<CoverDegree, 'total'>, number> = { half: 2, 'three-quarters': 5 };

export interface CoverResult {
  /** false under Total Cover: the target cannot be targeted directly. */
  targetable: boolean;
  /** The single degree that applies (the most protective), or null for none. */
  applied: CoverDegree | null;
  /** Effective AC when targetable. */
  effectiveAc?: number;
  /** AC + cover bonus; components sum to the total. */
  breakdown: Breakdown;
}

/**
 * The target's effective AC behind cover. Only the most protective degree applies; the
 * degrees are never added together. Half +2, Three-Quarters +5, Total Cover means the
 * target cannot be targeted directly. PHB 2024 "Cover" (L977-1000, L20830-20833).
 */
export function coverAc(ac: number, covers: CoverDegree[]): CoverResult {
  if (covers.includes('total')) {
    return {
      targetable: false,
      applied: 'total',
      breakdown: { total: ac, components: [{ label: 'Armor Class', value: ac }], note: 'Total Cover: the target cannot be targeted directly.' },
    };
  }
  let applied: 'half' | 'three-quarters' | null = null;
  if (covers.includes('three-quarters')) applied = 'three-quarters';
  else if (covers.includes('half')) applied = 'half';
  const bonus = applied === null ? 0 : COVER_BONUS[applied];
  const breakdown = sum([
    { label: 'Armor Class', value: ac },
    { label: applied === 'three-quarters' ? 'Three-Quarters Cover' : applied === 'half' ? 'Half Cover' : 'Cover (none)', value: bonus },
  ]);
  return { targetable: true, applied, effectiveAc: breakdown.total, breakdown };
}

// ─── Advantage / Disadvantage suggestions ────────────────────────────────────

export type DisadvantageSource = 'beyond-normal-range' | 'ranged-in-close-combat' | 'heavy-weapon' | 'target-unseen';
export type AdvantageSource = 'attacker-unseen';

export interface AttackSuggestionContext {
  /** Ability SCORES (Heavy compares the score, not the modifier). */
  str: number;
  dex: number;
  /** The weapon is thrown (a ranged attack). Ignored on a weapon without Thrown. */
  thrown?: boolean;
  /** Distance to the target in feet (matters for ranged and thrown attacks). */
  distanceFt?: number;
  /** An enemy within 5 feet can see you and is not Incapacitated. */
  hostileAdjacentSeesYou?: boolean;
  /** You cannot see the target. */
  targetUnseen?: boolean;
  /** The target cannot see you. */
  attackerUnseen?: boolean;
  /** Extra suggested sources, e.g. from `attackerConditionSuggestions`. */
  extraAdvantageFrom?: string[];
  extraDisadvantageFrom?: string[];
}

export interface AttackSuggestions {
  disadvantageFrom: string[];
  advantageFrom: string[];
  /** What the suggested sources add up to (any mix cancels; nothing stacks). */
  mode: D20Mode;
  /** The target is beyond the weapon's long range: the attack cannot be made. */
  blocked: boolean;
}

/** Combine Advantage / Disadvantage source lists. Any mix cancels; nothing stacks. L472-492. */
export function resolveAttackMode(advantageFrom: readonly string[], disadvantageFrom: readonly string[]): D20Mode {
  return combineD20Mode(advantageFrom.length > 0, disadvantageFrom.length > 0);
}

/**
 * The Advantage / Disadvantage sources the rules suggest for an attack. These are
 * SUGGESTIONS the player toggles; nothing is applied automatically. Range (L1010),
 * ranged attack in close combat (L1014), Heavy (L9316), unseen target (L985) and unseen
 * attacker (Unseen Attackers and Targets). Beyond long range the attack is blocked.
 */
export function attackSuggestions(weapon: WeaponData, context: AttackSuggestionContext): AttackSuggestions {
  const thrown = context.thrown === true && weapon.properties.includes('thrown');
  const rangedAttack = weapon.range === 'ranged' || thrown;
  const disadvantageFrom: string[] = [];
  const advantageFrom: string[] = [];

  if (rangedAttack && context.distanceFt !== undefined && weapon.normalRange !== undefined) {
    if (weapon.longRange !== undefined && context.distanceFt > weapon.longRange) {
      return { disadvantageFrom: [], advantageFrom: [], mode: 'normal', blocked: true };
    }
    if (context.distanceFt > weapon.normalRange) disadvantageFrom.push('beyond-normal-range');
  }
  if (rangedAttack && context.hostileAdjacentSeesYou === true) disadvantageFrom.push('ranged-in-close-combat');
  if (weapon.properties.includes('heavy')) {
    const score = weapon.range === 'melee' ? context.str : context.dex;
    if (score < 13) disadvantageFrom.push('heavy-weapon');
  }
  if (context.targetUnseen === true) disadvantageFrom.push('target-unseen');
  if (context.attackerUnseen === true) advantageFrom.push('attacker-unseen');
  for (const source of context.extraDisadvantageFrom ?? []) disadvantageFrom.push(source);
  for (const source of context.extraAdvantageFrom ?? []) advantageFrom.push(source);

  return { disadvantageFrom, advantageFrom, mode: resolveAttackMode(advantageFrom, disadvantageFrom), blocked: false };
}

export interface AttackConditionSuggestion {
  /** Source id, `condition:<conditionId>`. */
  source: string;
  conditionId: string;
  side: 'advantage' | 'disadvantage';
  /** Present when the condition's effect depends on the situation. */
  situational?: string;
}

/**
 * Suggested Advantage / Disadvantage on the character's OWN attack rolls from their
 * conditions (the stored ones plus the derived 0-HP Unconscious), read from the
 * conditions catalog `mechanics.ownAttacks`. Conditional effects (Frightened, Grappled,
 * Invisible) are listed with the situation that triggers them. They are suggestions to
 * toggle, not automatic. PHB 2024 "Conditions" (L1197-1216, glossary entries).
 */
export function attackerConditionSuggestions(character: Character): AttackConditionSuggestion[] {
  const out: AttackConditionSuggestion[] = [];
  for (const id of effectiveConditionIds(character)) {
    const effect = getCondition(id)?.mechanics.ownAttacks;
    if (effect === undefined) continue;
    const source = `condition:${id}`;
    switch (effect) {
      case 'advantage':
        out.push({ source, conditionId: id, side: 'advantage' });
        break;
      case 'advantage-unless-seen':
        out.push({ source, conditionId: id, side: 'advantage', situational: 'Not against a creature that can somehow see you.' });
        break;
      case 'disadvantage':
        out.push({ source, conditionId: id, side: 'disadvantage' });
        break;
      case 'disadvantage-while-source-in-sight':
        out.push({ source, conditionId: id, side: 'disadvantage', situational: 'While the source of your fear is in your line of sight.' });
        break;
      case 'disadvantage-vs-non-grappler':
        out.push({ source, conditionId: id, side: 'disadvantage', situational: 'Against any target other than the grappler.' });
        break;
    }
  }
  return out;
}

// ─── Unarmed Strike ──────────────────────────────────────────────────────────

export interface UnarmedStrike {
  /** Strength modifier + Proficiency Bonus (always proficient). */
  attack: Breakdown;
  /** Bludgeoning damage on a hit: 1 + Strength modifier, never below 0. */
  damage: Breakdown;
  /** Grapple save DC: 8 + Strength modifier + Proficiency Bonus. */
  grappleDc: Breakdown;
  /** Shove save DC: 8 + Strength modifier + Proficiency Bonus. */
  shoveDc: Breakdown;
}

/** Unarmed Strike numbers. PHB 2024 "Unarmed Strike" (L21683-21690). */
export function unarmedStrike(scores: Pick<AbilityScores, 'str'>, pb: number): UnarmedStrike {
  const mod = abilityModifier(scores.str);
  const strMod: BreakdownComponent = { label: 'Strength mod', value: mod };
  const pbc: BreakdownComponent = { label: 'Proficiency', value: pb };
  const raw = 1 + mod;
  const damage = sum([
    { label: 'Base damage', value: 1 },
    strMod,
    { label: 'Cannot go below 0', value: raw < 0 ? -raw : 0 },
  ]);
  const dc = (): Breakdown => sum([{ label: 'Base', value: 8 }, { ...strMod }, { ...pbc }]);
  return { attack: sum([{ ...strMod }, { ...pbc }]), damage, grappleDc: dc(), shoveDc: dc() };
}

// ─── Ammunition ──────────────────────────────────────────────────────────────

/** Half the pieces used, rounded down, can be recovered after a fight. L9304. */
export function recoverAmmo(used: number): number {
  return Math.floor(Math.max(0, used) / 2);
}

/** The ammunition equipment ids a weapon's `ammunitionType` fires. PHB "Ammunition" table (L9947-9952). */
export function ammunitionEquipmentIds(weapon: WeaponData): string[] {
  switch (weapon.ammunitionType) {
    case 'Arrow':
      return ['arrows'];
    case 'Bolt':
      return ['bolts'];
    case 'Needle':
      return ['needles'];
    case 'Bullet':
      return [weapon.id === 'sling' ? 'bullets-sling' : 'bullets-firearm'];
    default:
      return [];
  }
}

/** Inventory ammunition stacks that fit the weapon, in inventory order. */
export function matchingAmmunition(character: Character, weapon: WeaponData): InventoryItem[] {
  const ids = ammunitionEquipmentIds(weapon);
  if (ids.length === 0) return [];
  return (character.inventory ?? []).filter(
    (item) =>
      item.kind === 'equipment' &&
      item.catalogId !== undefined &&
      ids.includes(item.catalogId) &&
      getEquipment(item.catalogId)?.kind === 'ammunition',
  );
}

export interface FireAmmoResult {
  character: Character;
  /** true when the weapon needs ammunition and none is on hand: the attack cannot be made. */
  blocked: boolean;
  /** true when one piece was used. */
  consumed: boolean;
  /** Pieces left in the stack that was used. */
  remaining?: number;
  ammoItemId?: string;
}

/**
 * One Ammunition attack uses one piece: the first matching inventory stack with pieces
 * left loses one. A weapon without Ammunition returns the character unchanged; a missing
 * or empty stack blocks the attack. PHB 2024 "Ammunition" (L9304).
 */
export function fireAmmo(character: Character, weapon: WeaponData): FireAmmoResult {
  if (!weapon.properties.includes('ammunition')) return { character, blocked: false, consumed: false };
  const stack = matchingAmmunition(character, weapon).find((item) => item.quantity > 0);
  if (!stack) return { character, blocked: true, consumed: false, remaining: 0 };
  const remaining = stack.quantity - 1;
  return {
    character: {
      ...character,
      inventory: (character.inventory ?? []).map((item) => (item.id === stack.id ? { ...item, quantity: remaining } : item)),
    },
    blocked: false,
    consumed: true,
    remaining,
    ammoItemId: stack.id,
  };
}

// ─── The Light extra attack ──────────────────────────────────────────────────

export interface WieldedWeapon {
  /** Inventory item id, so the SAME item cannot be both weapons. */
  itemId: string;
  weapon: WeaponData;
}

export interface LightExtraStatus {
  available: boolean;
  reason?: string;
}

/**
 * Whether the Light property's Bonus Action extra attack can be made: the Attack action
 * has been taken, and both weapons are Light and are different items. PHB 2024 "Light"
 * (L9312). The Nick mastery lets the extra attack be part of the Attack action instead;
 * that is informational and not modelled (see weapon-mastery.ts).
 */
export function lightExtraStatus(main: WieldedWeapon, off: WieldedWeapon, attackActionTaken: boolean): LightExtraStatus {
  if (!attackActionTaken) return { available: false, reason: 'Take the Attack action first.' };
  if (!main.weapon.properties.includes('light')) return { available: false, reason: 'The weapon used for the Attack action must be Light.' };
  if (!off.weapon.properties.includes('light')) return { available: false, reason: 'The extra attack needs a different Light weapon.' };
  if (main.itemId === off.itemId) return { available: false, reason: 'The extra attack must use a different weapon.' };
  return { available: true };
}

export function lightExtraAvailable(main: WieldedWeapon, off: WieldedWeapon, attackActionTaken: boolean): boolean {
  return lightExtraStatus(main, off, attackActionTaken).available;
}

// ─── Equipped weapons and the combined attack profile ────────────────────────

export interface EquippedWeapon {
  item: InventoryItem;
  weapon: WeaponData;
}

/**
 * The character's EQUIPPED weapons that resolve to a catalog weapon, in the order of
 * `equipped.weaponItemIds`. Unequipped weapons, ids with no inventory item, non-weapon
 * items and custom weapons with no catalog entry are left out.
 */
export function equippedWeapons(character: Character): EquippedWeapon[] {
  const inventory = character.inventory ?? [];
  const out: EquippedWeapon[] = [];
  for (const id of character.equipped?.weaponItemIds ?? []) {
    const item = inventory.find((candidate) => candidate.id === id);
    if (!item) continue;
    const weapon = resolveWeapon(item);
    if (weapon) out.push({ item, weapon });
  }
  return out;
}

export interface WeaponAttackOptions {
  abilityChoice?: MeleeRangedAbility;
  twoHanded?: boolean;
  thrown?: boolean;
  kind?: AttackKind;
}

export interface WeaponAttackProfile {
  weapon: WeaponData;
  proficiency: WeaponProficiencyResult;
  attack: AttackBonus;
  damage: WeaponDamage;
  /** The dice for a Critical Hit (doubled). */
  criticalDice: string;
  /** Exhaustion level to hand to `resolveAttack` (D1). */
  exhaustion: number;
}

/** Attack bonus, damage and crit dice for one inventory weapon, from the character's own numbers. */
export function weaponAttackProfile(
  character: Character,
  item: InventoryItem,
  options: WeaponAttackOptions = {},
): WeaponAttackProfile | undefined {
  const weapon = resolveWeapon(item);
  if (!weapon) return undefined;
  const proficiency = weaponProficiency(character, item);
  const attack = attackBonusBreakdown({
    weapon,
    scores: effectiveAbilityScores(character),
    proficient: proficiency.proficient,
    pb: proficiencyBonus(character.level),
    attackBonus: item.attackBonus,
    abilityChoice: options.abilityChoice,
  });
  const damage = weaponDamage({
    weapon,
    mod: attack.abilityMod,
    ability: attack.ability,
    twoHanded: options.twoHanded,
    thrown: options.thrown,
    kind: options.kind,
    damageBonus: item.damageBonus,
  });
  return { weapon, proficiency, attack, damage, criticalDice: doubleDice(damage.dice), exhaustion: exhaustionLevelOf(character) };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sum(components: BreakdownComponent[]): Breakdown {
  return { total: components.reduce((total, c) => total + c.value, 0), components };
}
