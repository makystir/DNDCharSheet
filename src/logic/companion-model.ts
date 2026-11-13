/**
 * Stat block model of one tracked companion, built live from the owner.
 *
 * Nothing derived is stored: a Primal Companion's numbers follow the owner's
 * Ranger level, Wisdom modifier and Proficiency Bonus; the Otherworldly Steed's
 * follow its slot level and the owner's spellcasting (see companion-view.ts).
 * Rules: PHB 2024 Ranger "Beast Master" (Docs/PlayersHandbook.md L5581-5610),
 * Find Familiar (L13127), Find Steed (L13147), Wild Companion (L3704-3708).
 */

import type { Character, CompanionRecord, RidingDetails } from '../types/character';
import { CREATURE_CATALOG, CREATURE_LIST } from '../data/creatures';
import type { CreatureStatBlock } from '../data/creatures';
import { PRIMAL_COMPANION_IDS, PRIMAL_COMPANION_UPGRADES } from './primal-companion';
import type { PrimalCompanionId } from './primal-companion';
import { primalCompanionOwner, resolveLiveOtherworldlySteed, resolveLivePrimalCompanion } from './companion-view';
import { catalogStatBlockModel } from './stat-block-model';
import type { StatBlockLive, StatBlockModel } from './stat-block-model';

export const ORIGIN_LABELS: Record<CompanionRecord['origin'], string> = {
  'primal-companion': 'Primal Companion',
  'find-familiar': 'Find Familiar',
  'pact-of-the-chain': 'Pact of the Chain',
  'wild-companion': 'Wild Companion',
  'find-steed': 'Find Steed',
  'animate-dead': 'Animate Dead',
  pet: 'Pet, mount or pack animal',
};

const RIDING_KEYS = ['carriedLb', 'saddle', 'bardingArmorId', 'bardingCustom', 'pullsVehicle', 'vehicleWeightLb'] as const;

/** True when any riding or packing field has been filled in on the record. */
export function hasRidingDetails(record: RidingDetails): boolean {
  return RIDING_KEYS.some((k) => record[k] !== undefined);
}

/**
 * Whether the Riding & packing section starts open on a creature's card: it
 * already has riding details, or the creature is listed as a mount or steed
 * (Mounts and Other Animals table, Find Steed / Phantom Steed). Any creature
 * with a size and Strength can still open it.
 */
export function ridingOpenByDefault(record: RidingDetails, creature: CreatureStatBlock): boolean {
  return hasRidingDetails(record) || creature.forms.mount === true || creature.forms.steed === true;
}

export interface CompanionModel {
  creature: CreatureStatBlock;
  model: StatBlockModel;
  /** Maximum HP when it can be determined (null for an unresolved Primal Companion). */
  hpMax: number | null;
  /** Warning for the card (not a Beast Master, Ranger level too low). Never blocks. */
  warning?: string;
  /** Formula text shown instead of numbers when they cannot be computed. */
  formulaNote?: string;
  /** Plain notes under the stat block (active Primal Companion upgrades, Strikes per command). */
  notes: string[];
}

function isPrimalId(id: string): id is PrimalCompanionId {
  return (PRIMAL_COMPANION_IDS as readonly string[]).includes(id);
}

function formulaText(creature: CreatureStatBlock): string {
  const parts: string[] = [];
  if (typeof creature.ac === 'object' && creature.ac !== null) {
    if ('plusAbility' in creature.ac) parts.push(`AC ${creature.ac.base} + ${creature.ac.plusAbility === 'wis' ? 'Wisdom' : creature.ac.plusAbility} modifier`);
    else parts.push(`AC ${creature.ac.base} + ${creature.ac.perSpellLevel} per spell level`);
  }
  if ('formula' in creature.hp) {
    const f = creature.hp.formula;
    parts.push(`HP ${f.base} + ${f.perLevel} x ${f.levelSource === 'ranger-level' ? 'Ranger level' : 'spell level'}`);
  }
  return parts.join('; ');
}

/** Creatures that can be added for an origin (PHB 2024: Find Familiar L13127, Pact of the Chain L7040-7044, Find Steed L13147, Animate Dead). */
export function creatureOptionsForOrigin(origin: CompanionRecord['origin']): CreatureStatBlock[] {
  switch (origin) {
    case 'primal-companion':
      return CREATURE_LIST.filter((c) => c.kind === 'primal-companion');
    case 'find-familiar':
    case 'wild-companion':
      return CREATURE_LIST.filter((c) => c.forms.wildCompanion);
    case 'pact-of-the-chain':
      return CREATURE_LIST.filter((c) => c.forms.familiar);
    case 'find-steed':
      return CREATURE_LIST.filter((c) => c.id === 'otherworldly-steed');
    case 'animate-dead':
      return CREATURE_LIST.filter((c) => c.id === 'skeleton' || c.id === 'zombie');
    default:
      // Pet, mount or pack animal: every catalog animal, plus the Riding Horse.
      return CREATURE_LIST.filter((c) => c.kind === 'animal' || c.id === 'riding-horse');
  }
}

/** The tracked name shown on the card: the nickname when given, else the creature name. */
export function companionDisplayName(record: Pick<CompanionRecord, 'nickname' | 'creatureId'>): string {
  const nick = record.nickname?.trim();
  if (nick) return nick;
  return CREATURE_CATALOG[record.creatureId]?.name ?? record.creatureId;
}

/** Build the live model of a companion record, or null when its creature is not in the catalog. */
export function buildCompanionModel(record: CompanionRecord, character: Character): CompanionModel | null {
  const creature = CREATURE_CATALOG[record.creatureId];
  if (!creature) return null;
  const notes: string[] = [];

  if (record.origin === 'primal-companion' && isPrimalId(record.creatureId)) {
    const owner = primalCompanionOwner(character);
    const live = resolveLivePrimalCompanion(character, record.creatureId);
    if (!live) {
      return {
        creature,
        model: catalogStatBlockModel(creature),
        hpMax: null,
        ...(owner.warning ? { warning: owner.warning } : {}),
        formulaNote: formulaText(creature),
        notes,
      };
    }
    const statLive: StatBlockLive = {
      armorClass: live.armorClass,
      hitPoints: live.hitPoints,
      hitDice: live.hitDice,
      attackBonus: live.attackBonus,
      spellSaveDc: live.spellSaveDc,
      damageFlat: live.strikeDamageBonus,
      primalBond: live.primalBond,
    };
    if (live.stats.strikesPerCommand > 1) notes.push(`Beast's Strike can be used ${live.stats.strikesPerCommand} times per command.`);
    for (const up of PRIMAL_COMPANION_UPGRADES) {
      if (up.level <= live.owner.rangerLevel) notes.push(`${up.name} (Ranger level ${up.level}): ${up.effects.join(' ')}`);
    }
    return {
      creature,
      model: catalogStatBlockModel(creature, statLive),
      hpMax: live.stats.hitPoints,
      ...(owner.warning ? { warning: owner.warning } : {}),
      notes,
    };
  }

  if (record.origin === 'find-steed' && record.creatureId === 'otherworldly-steed') {
    const live = resolveLiveOtherworldlySteed(character, record);
    const speeds = live.stats.speeds;
    const speedText = `${speeds.walk} ft.${speeds.fly !== undefined ? `, Fly ${speeds.fly} ft.` : ''}`;
    const statLive: StatBlockLive = {
      armorClass: live.armorClass,
      hitPoints: live.hitPoints,
      hitDice: live.hitDice,
      attackBonus: live.attackBonus,
      spellSaveDc: live.spellSaveDc,
      damageFlat: live.slamBonus,
      creatureTypeOverride: live.creatureType,
      speedText,
      ...(live.hasSpellcasting ? {} : { missingSpellcastingNote: 'needs a spellcasting class' }),
    };
    if (live.typeAssumed) notes.push(`No steed type chosen yet: showing ${live.creatureType}. Pick one when you summon it.`);
    notes.push(`Summoned with a level ${live.spellLevel} spell slot.`);
    return { creature, model: catalogStatBlockModel(creature, statLive), hpMax: live.stats.hitPoints, notes };
  }

  // Familiars: Wild Companion is always Fey; Find Familiar / Pact of the Chain use the chosen type.
  const liveType =
    record.origin === 'wild-companion' ? 'Fey' : record.origin === 'find-familiar' || record.origin === 'pact-of-the-chain' ? record.familiarType : undefined;
  const statLive: StatBlockLive | undefined = liveType ? { creatureTypeOverride: liveType } : undefined;
  const model = catalogStatBlockModel(creature, statLive, record.hpMaxOverride);
  return { creature, model, hpMax: model.hpMax, notes };
}

export const HIRELING_KIND_LABELS: Record<'skilled' | 'untrained' | 'messenger', string> = {
  skilled: 'Skilled hireling',
  untrained: 'Untrained hireling',
  messenger: 'Messenger',
};

/**
 * Monster Manual 2024 NPC stat blocks (CR 10 or lower) that pre-fill the
 * editable stat block (CustomStatBlock) of a new NPC party member. The data and
 * its sources live in src/data/npc-templates.ts.
 */
export type { NpcTemplate } from '../data/npc-templates';
export { NPC_TEMPLATE_LIST as NPC_TEMPLATES } from '../data/npc-templates';
