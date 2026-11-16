/**
 * The 2024 Monster Manual creatures converted into `monsters.json`
 * (printed page numbers are in each entry's `page`). This module only types the
 * file; `src/logic/dm-library.ts` turns each entry into a library creature.
 * Optional properties are absent on entries that do not have them.
 */
import monstersJson from './monsters.json';

export interface MmDamage {
  avg: number;
  dice?: string;
  type: string;
}

export interface MmAlternateDamage extends MmDamage {
  condition?: string;
}

export interface MmSave {
  ability: string;
  dc: number;
}

export interface MmFeature {
  name: string;
  type?: string;
  uses?: string;
  recharge?: string;
  cost?: string;
  /** Names of the attacks a Multiattack uses. */
  attacks?: string[];
  attack?: { kind: string; bonus: number; reach?: number; range?: string };
  attackBonus?: number;
  damage?: MmDamage[];
  alternateDamage?: MmAlternateDamage | MmAlternateDamage[];
  extraDamage?: MmDamage[];
  onHitOrMiss?: string;
  saves?: MmSave[];
  halfOnSuccess?: boolean;
  conditions?: string[];
  ability?: string;
  saveDC?: number;
  components?: string;
  spells?: { atWill?: string[]; perDay?: Record<string, string[]> };
  summary: string;
}

export interface MmAbility {
  score: number;
  mod: number;
  save: number;
}

export interface MonsterManual2024Entry {
  name: string;
  size: string;
  type: string;
  tags?: string[];
  alignment: string;
  habitat: string[];
  treasure: string[];
  ac: number;
  initiative: { mod: number; score: number };
  hp: { avg: number; dice: string };
  speed: { walk?: number; fly?: number; swim?: number; climb?: number; burrow?: number; hover?: boolean };
  abilities: { str: MmAbility; dex: MmAbility; con: MmAbility; int: MmAbility; wis: MmAbility; cha: MmAbility };
  skills: Record<string, number>;
  senses: {
    passivePerception: number;
    blindsight?: number;
    darkvision?: number;
    tremorsense?: number;
    truesight?: number;
  };
  resistances?: string[];
  vulnerabilities?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  languages: string[];
  /** Challenge Rating text, e.g. "4" or "1/4". */
  cr: string;
  xp: number;
  pb: number;
  traits: MmFeature[];
  actions: MmFeature[];
  bonusActions: MmFeature[];
  reactions: MmFeature[];
  legendaryActions: MmFeature[];
  /** Legendary Action uses per round; `inLair` is the count when the creature is in its lair. */
  legendaryActionUses?: { normal: number; inLair?: number };
  lairActions: MmFeature[];
  description: string;
  page: number;
}

export const MONSTER_MANUAL_2024_LIST: readonly MonsterManual2024Entry[] =
  monstersJson as unknown as MonsterManual2024Entry[];
