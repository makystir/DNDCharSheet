/**
 * Beast Master Primal Companion resolver (D&D 5.5e / 2024).
 *
 * PHB 2024, Ranger: Beast Master, "Level 3: Primal Companion" (L5581) and the
 * Beast of the Land / Sea / Sky stat blocks (L5611-L5690). The three stat blocks
 * are formula-scaled by the Ranger's level, Wisdom modifier and Proficiency
 * Bonus; `src/data/creatures.ts` holds the formulas, this module turns them
 * into concrete numbers.
 *
 *  - AC            = 13 + Wisdom modifier
 *  - HP (Land/Sea) = 5 + 5 x Ranger level; Hit Dice = Ranger level d8
 *  - HP (Sky)      = 4 + 4 x Ranger level; Hit Dice = Ranger level d6
 *  - Attack bonus  = your spell attack modifier = spellcasting ability (Wisdom)
 *                    modifier + Proficiency Bonus (PHB Spellcasting, L1950-L1955)
 *  - Damage        = die + flat + your Wisdom modifier
 *  - Grapple escape DC (Sea) = your spell save DC = 8 + Wisdom modifier + PB
 *  - Primal Bond: add your PB to any ability check or saving throw the beast makes.
 *
 * It also resolves the Otherworldly Steed of Find Steed (PHB 2024 p. 273, level 2
 * Conjuration, Paladin), which scales with the level of the spell slot used.
 */

import { CREATURE_CATALOG } from '../data/creatures';
import type { CreatureDamage, CreatureHitPoints } from '../data/creatures';

export type PrimalCompanionId = 'beast-of-the-land' | 'beast-of-the-sea' | 'beast-of-the-sky';

export const PRIMAL_COMPANION_IDS: readonly PrimalCompanionId[] = ['beast-of-the-land', 'beast-of-the-sea', 'beast-of-the-sky'];

/** Ranger level at which the Beast Master gets Primal Companion (PHB L5581). */
export const PRIMAL_COMPANION_MIN_LEVEL = 3;

export interface PrimalCompanionUpgrade {
  /** Ranger level that grants the upgrade. */
  level: number;
  name: string;
  /** Paraphrased summary of the PHB text. */
  effects: string[];
}

/** Later-level upgrades listed in the PHB Beast Master subclass (L5593-L5610). */
export const PRIMAL_COMPANION_UPGRADES: readonly PrimalCompanionUpgrade[] = [
  {
    level: 7,
    name: 'Exceptional Training',
    effects: [
      "When you use a Bonus Action to command the beast to take an action, it can also take the Dash, Disengage, Dodge or Help action using its own Bonus Action.",
      'Whenever it hits with an attack roll and deals damage, it can deal your choice of Force damage or its normal damage type.',
    ],
  },
  {
    level: 11,
    name: 'Bestial Fury',
    effects: [
      "When you command the beast to take the Beast's Strike action, it can use it twice.",
      "The first time each turn it hits a creature under the effect of your Hunter's Mark spell, it deals extra Force damage equal to that spell's bonus damage.",
    ],
  },
  {
    level: 15,
    name: 'Share Spells',
    effects: ['When you cast a spell targeting yourself, you can also affect the beast with it if the beast is within 30 feet of you.'],
  },
];

export interface PrimalCompanionInput {
  beastId: PrimalCompanionId;
  /** Ranger level (3-20 for a Beast Master). */
  rangerLevel: number;
  /** The Ranger's Wisdom modifier (can be negative). */
  wisdomModifier: number;
  /** The Ranger's Proficiency Bonus. */
  proficiencyBonus: number;
}

export interface PrimalCompanionStrike {
  /** Damage die expression of the strike without flat bonuses, e.g. "1d8". */
  dice: string;
  /** Flat damage printed in the stat block (the "+ 2" / "+ 3"). */
  flatBonus: number;
  /** Your Wisdom modifier, added to the damage. */
  wisdomBonus: number;
  /** Total flat damage modifier = flatBonus + wisdomBonus. */
  totalFlat: number;
  /** Damage types; the Land and Sea beasts let you choose one when you summon the beast. */
  damageTypeOptions: string[];
  /** Extra damage when the beast moved 20+ ft. straight toward the target (Land only). */
  chargeExtraDice?: string;
  /** Prone on a charge hit vs Large or smaller (Land only). */
  chargeProne?: boolean;
  /** Grapples the target (Sea only). */
  grapples?: boolean;
  /** Escape DC of the grapple = your spell save DC (Sea only). */
  grappleEscapeDc?: number;
}

export interface PrimalCompanionStats {
  beastId: PrimalCompanionId;
  name: string;
  armorClass: number;
  hitPoints: number;
  hitDice: { count: number; die: number };
  /** Spell attack modifier = Wisdom modifier + Proficiency Bonus. */
  attackBonus: number;
  /** Spell save DC = 8 + Wisdom modifier + Proficiency Bonus. */
  spellSaveDc: number;
  /** Primal Bond: added to every ability check and saving throw the beast makes. */
  primalBondBonus: number;
  strike: PrimalCompanionStrike;
  /** Number of Beast's Strike uses per command (2 from Ranger level 11, Bestial Fury). */
  strikesPerCommand: number;
  /** Exceptional Training (level 7): Dash/Disengage/Dodge/Help as a Bonus Action and optional Force damage. */
  exceptionalTraining: boolean;
  /** Bestial Fury (level 11). */
  bestialFury: boolean;
  /** Share Spells (level 15). */
  shareSpells: boolean;
  /** Upgrades active at this Ranger level. */
  activeUpgrades: PrimalCompanionUpgrade[];
}

function formulaHp(hp: CreatureHitPoints): { base: number; perLevel: number; hitDie: number } {
  if (!('formula' in hp)) throw new Error('Stat block is missing its HP formula');
  return hp.formula;
}

function parseStrikeDice(damage: CreatureDamage): { dice: string; flat: number } {
  const m = /^(\d+d\d+)\+(\d+)$/.exec(damage.dice);
  if (!m) throw new Error(`Unexpected Beast's Strike damage expression: ${damage.dice}`);
  return { dice: m[1], flat: Number(m[2]) };
}

/**
 * Resolve a Primal Companion beast to concrete numbers.
 * Throws a RangeError for a Ranger level outside 3-20 (the Beast Master gets the
 * feature at level 3; the Ranger caps at 20).
 */
export function resolvePrimalCompanion(input: PrimalCompanionInput): PrimalCompanionStats {
  const { beastId, rangerLevel, wisdomModifier, proficiencyBonus } = input;
  if (!Number.isInteger(rangerLevel) || rangerLevel < PRIMAL_COMPANION_MIN_LEVEL || rangerLevel > 20) {
    throw new RangeError(`Primal Companion needs a Ranger level of ${PRIMAL_COMPANION_MIN_LEVEL}-20, got ${rangerLevel}`);
  }
  const block = CREATURE_CATALOG[beastId];
  if (!block || block.kind !== 'primal-companion') throw new Error(`Unknown Primal Companion: ${beastId}`);
  if (typeof block.ac !== 'object' || block.ac === null || !('plusAbility' in block.ac)) throw new Error(`${beastId} has no AC formula`);

  const hp = formulaHp(block.hp);
  const strikeAction = block.actions.find((a) => a.name === "Beast's Strike");
  const mainDamage = strikeAction?.damage?.[0];
  if (!mainDamage) throw new Error(`${beastId} has no Beast's Strike damage`);
  const { dice, flat } = parseStrikeDice(mainDamage);

  const spellSaveDc = 8 + wisdomModifier + proficiencyBonus;
  const strike: PrimalCompanionStrike = {
    dice,
    flatBonus: flat,
    wisdomBonus: wisdomModifier,
    totalFlat: flat + wisdomModifier,
    damageTypeOptions: mainDamage.typeChoice ?? [mainDamage.type],
  };
  const charge = strikeAction?.damage?.[1];
  if (charge) {
    strike.chargeExtraDice = charge.dice;
    strike.chargeProne = true; // Beast of the Land: Prone if the target is Large or smaller
  }
  if (beastId === 'beast-of-the-sea') {
    strike.grapples = true;
    strike.grappleEscapeDc = spellSaveDc;
  }

  const activeUpgrades = PRIMAL_COMPANION_UPGRADES.filter((u) => rangerLevel >= u.level);
  const bestialFury = rangerLevel >= 11;

  return {
    beastId,
    name: block.name,
    armorClass: block.ac.base + wisdomModifier,
    hitPoints: hp.base + hp.perLevel * rangerLevel,
    hitDice: { count: rangerLevel, die: hp.hitDie },
    attackBonus: wisdomModifier + proficiencyBonus,
    spellSaveDc,
    primalBondBonus: proficiencyBonus,
    strike,
    strikesPerCommand: bestialFury ? 2 : 1,
    exceptionalTraining: rangerLevel >= 7,
    bestialFury,
    shareSpells: rangerLevel >= 15,
    activeUpgrades,
  };
}

// ─── Otherworldly Steed (Find Steed) ─────────────────────────────────────────

export type OtherworldlySteedType = 'Celestial' | 'Fey' | 'Fiend';

export const OTHERWORLDLY_STEED_TYPES: readonly OtherworldlySteedType[] = ['Celestial', 'Fey', 'Fiend'];

/** Find Steed is a level 2 spell; the highest slot level is 9 (PHB spell header). */
export const OTHERWORLDLY_STEED_MIN_SPELL_LEVEL = 2;
export const OTHERWORLDLY_STEED_MAX_SPELL_LEVEL = 9;
/** The Fly Speed requires a level 4+ spell (Otherworldly Steed stat block). */
export const OTHERWORLDLY_STEED_FLY_MIN_SPELL_LEVEL = 4;

const SLAM_DAMAGE_TYPE: Readonly<Record<OtherworldlySteedType, string>> = {
  Celestial: 'Radiant',
  Fey: 'Psychic',
  Fiend: 'Necrotic',
};

export interface OtherworldlySteedInput {
  /** Level of the spell slot used to cast Find Steed (2-9). */
  spellLevel: number;
  /** The caster's spell attack modifier (spellcasting ability modifier + PB). */
  spellAttackModifier: number;
  /** The caster's spell save DC. */
  spellSaveDc: number;
  /** The caster's Proficiency Bonus (the steed's PB equals it). Optional; echoed back when given. */
  proficiencyBonus?: number;
  /** Creature type chosen when the spell is cast. */
  creatureType: OtherworldlySteedType;
}

export interface OtherworldlySteedStats {
  name: string;
  creatureType: OtherworldlySteedType;
  spellLevel: number;
  /** 10 + 1 per spell level. */
  armorClass: number;
  /** 5 + 10 per spell level. */
  hitPoints: number;
  /** Hit Dice are d10s equal to the spell's level. */
  hitDice: { count: number; die: number };
  speeds: { walk: number; fly?: number };
  /** The caster's spell attack modifier. */
  attackBonus: number;
  slam: { dice: string; flat: number; damageType: string };
  /** Fiend only: Fell Glare (Wisdom save) DC = your spell save DC. */
  fellGlare?: { saveAbility: 'wis'; dc: number; rangeFt: number };
  /** Fey only: Fey Step teleport distance in feet. */
  feyStepFt?: number;
  /** Celestial only: Healing Touch = 2d8 + spell level, within 5 feet. */
  healingTouch?: { dice: string; flat: number };
  proficiencyBonus?: number;
}

/**
 * Resolve the Otherworldly Steed to concrete numbers from the spell level, the
 * caster's spell attack modifier and spell save DC (Find Steed, PHB 2024 p. 273).
 * Throws a RangeError for a spell level outside 2-9.
 */
export function resolveOtherworldlySteed(input: OtherworldlySteedInput): OtherworldlySteedStats {
  const { spellLevel, spellAttackModifier, spellSaveDc, creatureType, proficiencyBonus } = input;
  if (!Number.isInteger(spellLevel) || spellLevel < OTHERWORLDLY_STEED_MIN_SPELL_LEVEL || spellLevel > OTHERWORLDLY_STEED_MAX_SPELL_LEVEL) {
    throw new RangeError(`Find Steed needs a spell level of ${OTHERWORLDLY_STEED_MIN_SPELL_LEVEL}-${OTHERWORLDLY_STEED_MAX_SPELL_LEVEL}, got ${spellLevel}`);
  }
  const block = CREATURE_CATALOG['otherworldly-steed'];
  if (!block) throw new Error('Otherworldly Steed is missing from the catalog');
  if (typeof block.ac !== 'object' || block.ac === null || !('perSpellLevel' in block.ac)) throw new Error('Otherworldly Steed has no AC formula');
  const hp = formulaHp(block.hp);

  const stats: OtherworldlySteedStats = {
    name: block.name,
    creatureType,
    spellLevel,
    armorClass: block.ac.base + block.ac.perSpellLevel * spellLevel,
    hitPoints: hp.base + hp.perLevel * spellLevel,
    hitDice: { count: spellLevel, die: hp.hitDie },
    speeds: {
      walk: block.speeds?.walk ?? 0,
      ...(spellLevel >= OTHERWORLDLY_STEED_FLY_MIN_SPELL_LEVEL && block.speeds?.fly ? { fly: block.speeds.fly } : {}),
    },
    attackBonus: spellAttackModifier,
    slam: { dice: block.actions[0].damage?.[0].dice ?? '1d8', flat: spellLevel, damageType: SLAM_DAMAGE_TYPE[creatureType] },
    ...(proficiencyBonus !== undefined ? { proficiencyBonus } : {}),
  };
  if (creatureType === 'Fiend') stats.fellGlare = { saveAbility: 'wis', dc: spellSaveDc, rangeFt: 60 };
  if (creatureType === 'Fey') stats.feyStepFt = 60;
  if (creatureType === 'Celestial') stats.healingTouch = { dice: '2d8', flat: spellLevel };
  return stats;
}
