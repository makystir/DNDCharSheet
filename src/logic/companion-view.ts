/**
 * Live derivation of the numbers that scale with the OWNER (Companions page).
 *
 * Nothing derived is ever stored: the Primal Companion's AC / HP / Hit Dice /
 * attack / damage / DC are formulas of the owner's Ranger level, Wisdom modifier
 * and Proficiency Bonus (PHB 2024 Ranger: Beast Master, "Level 3: Primal
 * Companion", L5581), and the Otherworldly Steed's AC / HP / attack / DC come
 * from the Find Steed slot level and the owner's spellcasting (PHB 2024 Find
 * Steed). These helpers read the owner's current `Character`, call the pure
 * resolvers in primal-companion.ts, and attach a `Breakdown` to every derived
 * number so the UI can wrap it in a CalculatedValue (calculated-totals steering).
 */

import type { Character, ClassEntry, CompanionRecord, CompanionSpiritType } from '../types/character';
import { ABILITY_NAMES } from '../types/character';
import { CREATURE_CATALOG } from '../data/creatures';
import type { Breakdown } from './breakdown';
import { abilityModifier, proficiencyBonus } from './abilities';
import { entrySubclass, resolveClasses } from './classes';
import { effectiveAbilityScores } from './feats';
import { classSpellAttackBreakdown, classSpellSaveDcBreakdown, entryIsSpellcaster } from './spellcasting';
import {
  OTHERWORLDLY_STEED_MAX_SPELL_LEVEL,
  OTHERWORLDLY_STEED_MIN_SPELL_LEVEL,
  OTHERWORLDLY_STEED_TYPES,
  PRIMAL_COMPANION_MIN_LEVEL,
  resolveOtherworldlySteed,
  resolvePrimalCompanion,
} from './primal-companion';
import type { OtherworldlySteedStats, PrimalCompanionId, PrimalCompanionStats } from './primal-companion';

// ─── Primal Companion owner ──────────────────────────────────────────────────

/** The owner-side inputs of a Primal Companion, read live from the character. */
export interface PrimalCompanionOwner {
  /** Total Ranger levels (sum over Ranger entries; 0 when none). */
  rangerLevel: number;
  /** Wisdom modifier from the character's effective Wisdom score. */
  wisdomModifier: number;
  /** Proficiency Bonus from the total character level. */
  proficiencyBonus: number;
  /** True when a Ranger entry has the Beast Master subclass (at its subclass level). */
  isBeastMaster: boolean;
  /** True when the numbers can be computed (Ranger level 3 or higher). */
  ok: boolean;
  /** Why the numbers are not computed, or a Beast Master warning; undefined when fine. */
  warning?: string;
}

const RANGER_ID = 'ranger';
const BEAST_MASTER_ID = 'beastMaster';

function rangerEntries(character: Character): ClassEntry[] {
  return resolveClasses(character)
    .map((r) => r.entry)
    .filter((e) => e.id === RANGER_ID);
}

/**
 * Read the owner side of a Primal Companion from the live character. The
 * companion needs a Ranger of level 3+ (PHB L5581): below that no numbers are
 * computed (the resolver would throw, and assuming a level would invent one).
 * A Ranger that is not a Beast Master still gets numbers, with a warning
 * (the app warns rather than blocks).
 */
export function primalCompanionOwner(character: Character): PrimalCompanionOwner {
  const rangers = rangerEntries(character);
  const rangerLevel = rangers.reduce((sum, e) => sum + e.level, 0);
  const isBeastMaster = rangers.some((e) => entrySubclass(e)?.id === BEAST_MASTER_ID);
  const wisdomModifier = abilityModifier(effectiveAbilityScores(character).wis);
  const pb = proficiencyBonus(character.level);
  const ok = rangerLevel >= PRIMAL_COMPANION_MIN_LEVEL;
  let warning: string | undefined;
  if (!ok) {
    warning = `A Primal Companion needs a Ranger with the Beast Master subclass at level ${PRIMAL_COMPANION_MIN_LEVEL} (PHB 2024 Ranger: Beast Master, L5581). Your Ranger level is ${rangerLevel}.`;
  } else if (!isBeastMaster) {
    warning = 'This character is a Ranger but not a Beast Master, so it does not normally have a Primal Companion (PHB 2024 Ranger: Beast Master, L5581).';
  }
  return { rangerLevel, wisdomModifier, proficiencyBonus: pb, isBeastMaster, ok, ...(warning ? { warning } : {}) };
}

/** Every derived Primal Companion number, with the breakdown that explains it. */
export interface LivePrimalCompanion {
  owner: PrimalCompanionOwner;
  stats: PrimalCompanionStats;
  armorClass: Breakdown;
  hitPoints: Breakdown;
  hitDice: Breakdown;
  /** Beast's Strike attack roll: the owner's spell attack modifier. */
  attackBonus: Breakdown;
  /** Beast's Strike flat damage: the printed flat number plus the Wisdom modifier. */
  strikeDamageBonus: Breakdown;
  /** Owner's spell save DC (the Beast of the Sea's grapple escape DC). */
  spellSaveDc: Breakdown;
  /** Primal Bond: the owner's Proficiency Bonus added to the beast's checks and saves. */
  primalBond: Breakdown;
}

function wisdomName(): string {
  return `${ABILITY_NAMES.wis} mod`;
}

/** The Ranger entry that supplies the spell attack / DC for the beast, if it casts. */
function rangerCasterEntry(character: Character): ClassEntry | undefined {
  return rangerEntries(character).find((e) => entryIsSpellcaster(e));
}

/**
 * Resolve a Primal Companion against the live character. Returns null when the
 * owner has no Ranger level 3+ (no numbers are invented below that).
 */
export function resolveLivePrimalCompanion(character: Character, beastId: PrimalCompanionId): LivePrimalCompanion | null {
  const owner = primalCompanionOwner(character);
  if (!owner.ok) return null;
  const stats = resolvePrimalCompanion({
    beastId,
    rangerLevel: owner.rangerLevel,
    wisdomModifier: owner.wisdomModifier,
    proficiencyBonus: owner.proficiencyBonus,
  });
  const block = CREATURE_CATALOG[beastId];
  const wisLabel = wisdomName();
  const baseAc = typeof block.ac === 'object' && block.ac !== null && 'plusAbility' in block.ac ? block.ac.base : 13;
  const hpFormula = 'formula' in block.hp ? block.hp.formula : { base: 0, perLevel: 0, hitDie: 8 };

  const armorClass: Breakdown = {
    total: stats.armorClass,
    components: [
      { label: 'Base', value: baseAc },
      { label: wisLabel, value: owner.wisdomModifier },
    ],
  };
  const hitPoints: Breakdown = {
    total: stats.hitPoints,
    components: [
      { label: 'Base', value: hpFormula.base },
      { label: `${hpFormula.perLevel} x Ranger level ${owner.rangerLevel}`, value: hpFormula.perLevel * owner.rangerLevel },
    ],
  };
  const hitDice: Breakdown = {
    total: stats.hitDice.count,
    components: [{ label: 'Ranger level', value: owner.rangerLevel }],
    note: `${stats.hitDice.count}d${stats.hitDice.die}: one Hit Die per Ranger level.`,
  };

  // The beast's attack roll uses YOUR spell attack modifier. Prefer the Ranger's
  // per-class breakdown (it carries Exhaustion); fall back to Wisdom + Proficiency.
  const caster = rangerCasterEntry(character);
  const casterAttack = caster ? classSpellAttackBreakdown(character, caster) : undefined;
  const attackBonus: Breakdown = casterAttack ?? {
    total: owner.wisdomModifier + owner.proficiencyBonus,
    components: [
      { label: 'Proficiency', value: owner.proficiencyBonus },
      { label: wisLabel, value: owner.wisdomModifier },
    ],
  };
  const casterDc = caster ? classSpellSaveDcBreakdown(character, caster) : undefined;
  const spellSaveDc: Breakdown = casterDc ?? {
    total: stats.spellSaveDc,
    components: [
      { label: 'Base', value: 8 },
      { label: 'Proficiency', value: owner.proficiencyBonus },
      { label: wisLabel, value: owner.wisdomModifier },
    ],
  };
  const strikeDamageBonus: Breakdown = {
    total: stats.strike.totalFlat,
    components: [
      { label: 'Printed bonus', value: stats.strike.flatBonus },
      { label: wisLabel, value: owner.wisdomModifier },
    ],
  };
  const primalBond: Breakdown = {
    total: owner.proficiencyBonus,
    components: [{ label: 'Your Proficiency Bonus', value: owner.proficiencyBonus }],
  };

  return { owner, stats, armorClass, hitPoints, hitDice, attackBonus, strikeDamageBonus, spellSaveDc, primalBond };
}

// ─── Otherworldly Steed (Find Steed) ─────────────────────────────────────────

/** Every derived Otherworldly Steed number, with its breakdown. */
export interface LiveOtherworldlySteed {
  stats: OtherworldlySteedStats;
  /** The slot level actually used (the record's value clamped to 2-9, default 2). */
  spellLevel: number;
  /** The type used; `typeAssumed` is true when the record has none and the first type is shown. */
  creatureType: CompanionSpiritType;
  typeAssumed: boolean;
  /** False when the owner has no spellcasting entry: attack and DC are not available. */
  hasSpellcasting: boolean;
  armorClass: Breakdown;
  hitPoints: Breakdown;
  hitDice: Breakdown;
  /** The owner's spell attack modifier; null when the owner has no spellcasting. */
  attackBonus: Breakdown | null;
  /** The owner's spell save DC (Fiend Fell Glare); null when the owner has no spellcasting. */
  spellSaveDc: Breakdown | null;
  /** Slam flat damage = the spell's level. */
  slamBonus: Breakdown;
}

/** The casting entry for a steed: the record's chosen class, else the first spellcaster. */
export function steedCastingEntry(character: Character, castingClassId?: string): ClassEntry | undefined {
  const casters = resolveClasses(character)
    .map((r) => r.entry)
    .filter((e) => entryIsSpellcaster(e));
  return casters.find((e) => e.id === castingClassId) ?? casters[0];
}

function clampSteedSpellLevel(level: number | undefined): number {
  if (level === undefined || !Number.isInteger(level)) return OTHERWORLDLY_STEED_MIN_SPELL_LEVEL;
  return Math.min(OTHERWORLDLY_STEED_MAX_SPELL_LEVEL, Math.max(OTHERWORLDLY_STEED_MIN_SPELL_LEVEL, level));
}

/**
 * Resolve the Otherworldly Steed against the live character: AC and HP need only
 * the slot level; attack and DC come from the chosen casting class (or the first
 * spellcasting class). With no spellcasting they are null and the stats carry 0.
 */
export function resolveLiveOtherworldlySteed(
  character: Character,
  record: Pick<CompanionRecord, 'spellSlotLevel' | 'steedType' | 'castingClassId'>,
): LiveOtherworldlySteed {
  const spellLevel = clampSteedSpellLevel(record.spellSlotLevel);
  const creatureType = record.steedType ?? OTHERWORLDLY_STEED_TYPES[0];
  const typeAssumed = record.steedType === undefined;
  const entry = steedCastingEntry(character, record.castingClassId);
  const attackBonus = entry ? (classSpellAttackBreakdown(character, entry) ?? null) : null;
  const spellSaveDc = entry ? (classSpellSaveDcBreakdown(character, entry) ?? null) : null;
  const hasSpellcasting = attackBonus !== null && spellSaveDc !== null;
  const stats = resolveOtherworldlySteed({
    spellLevel,
    spellAttackModifier: attackBonus?.total ?? 0,
    spellSaveDc: spellSaveDc?.total ?? 0,
    proficiencyBonus: proficiencyBonus(character.level),
    creatureType,
  });

  const block = CREATURE_CATALOG['otherworldly-steed'];
  const acFormula = typeof block.ac === 'object' && block.ac !== null && 'perSpellLevel' in block.ac ? block.ac : { base: 10, perSpellLevel: 1 };
  const hpFormula = 'formula' in block.hp ? block.hp.formula : { base: 5, perLevel: 10, hitDie: 10 };

  return {
    stats,
    spellLevel,
    creatureType,
    typeAssumed,
    hasSpellcasting,
    armorClass: {
      total: stats.armorClass,
      components: [
        { label: 'Base', value: acFormula.base },
        { label: `${acFormula.perSpellLevel} x spell level ${spellLevel}`, value: acFormula.perSpellLevel * spellLevel },
      ],
    },
    hitPoints: {
      total: stats.hitPoints,
      components: [
        { label: 'Base', value: hpFormula.base },
        { label: `${hpFormula.perLevel} x spell level ${spellLevel}`, value: hpFormula.perLevel * spellLevel },
      ],
    },
    hitDice: {
      total: stats.hitDice.count,
      components: [{ label: 'Spell level', value: spellLevel }],
      note: `${stats.hitDice.count}d${stats.hitDice.die}: one Hit Die per level of the spell.`,
    },
    attackBonus,
    spellSaveDc,
    slamBonus: {
      total: stats.slam.flat,
      components: [{ label: 'Spell level', value: spellLevel }],
    },
  };
}
