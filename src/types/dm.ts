/**
 * Dungeon Master mode data (design: .agents/tasks/dm-mode/design.md).
 *
 * DM data lives in its own store, separate from the player's characters. A
 * campaign holds a party; each party member is either an imported snapshot of a
 * player's character (from a share link) or a manual stat line the DM typed in.
 */
import type { Character } from './character';
import type { ConditionId } from '../data/conditions';
import type { HpState } from '../logic/hit-points-state';

/** Stats a DM types in for a party member who has no shared character. */
export interface DmManualStats {
  /** Free text such as "Rogue 4"; shown as the member's identity line. */
  classLabel: string;
  level: number;
  ac: number;
  hpMax: number;
  hpCurrent: number;
  passivePerception: number;
  passiveInsight: number;
  passiveInvestigation: number;
  /** Null when the member does not cast spells. */
  spellSaveDc: number | null;
  speed: number;
  /** 0 when the member has no Darkvision. */
  darkvisionFt: number;
  languages: string[];
  conditions: string[];
}

export interface DmPartyMember {
  id: string;
  name: string;
  source: 'imported' | 'manual';
  /** Snapshot of the player's character (imported members only). */
  character?: Character;
  /** DM-entered stats (manual members only). */
  manual?: DmManualStats;
  addedAt: number;
  /** When the snapshot was last imported (imported) or edited (manual). */
  updatedAt: number;
}

export interface DmCampaign {
  id: string;
  name: string;
  notes: string;
  party: DmPartyMember[];
  /** Saved encounters, newest last. */
  encounters: DmEncounter[];
  /** The encounter open on the Encounter page, if any. */
  activeEncounterId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface DmData {
  /** Storage format version. */
  v: 1;
  campaigns: DmCampaign[];
  activeCampaignId: string | null;
}

// ---------------------------------------------------------------- encounters

/** A timed or open-ended condition on a combatant (Exhaustion is not tracked here). */
export interface DmCombatCondition {
  id: Exclude<ConditionId, 'exhaustion'>;
  /** Rounds remaining; absent = lasts until the DM removes it. */
  rounds?: number;
}

/**
 * Who is fighting. A monster dies the instant it drops to 0 Hit Points unless
 * the DM treats it like a character (PHB 2024 "Instant Death", L1141).
 */
export type DmCombatantKind = 'pc' | 'monster';

export interface DmCombatant {
  id: string;
  name: string;
  kind: DmCombatantKind;
  /** Where the numbers came from, e.g. "Guard (MM 2024 p.250)" or "Party member". */
  sourceLabel: string;
  /** The party member this combatant mirrors (pc only). */
  memberId?: string;
  /** Combatants sharing a group roll the same Initiative. */
  groupId?: string;
  ac: number;
  hp: HpState;
  /** Initiative count; null until rolled or typed in. */
  initiative: number | null;
  initiativeMod: number;
  /** Surprised: Disadvantage on the Initiative roll (PHB 2024 "Initiative", L874). */
  surprised: boolean;
  /** Free text, for example "Fire; Poison". Parsed into damage types for the Damage panel. */
  resistances: string;
  vulnerabilities: string;
  immunities: string;
  conditions: DmCombatCondition[];
  concentration: { active: boolean; label: string };
  /** Concentration save DCs waiting to be resolved, oldest first. */
  concentrationDcs: number[];
  /** Constitution saving throw modifier, when known (enables the Roll button). */
  conSaveMod?: number;
  /** Monster only: make Death Saving Throws at 0 HP instead of dying outright. */
  diesLikeCharacter: boolean;
  notes: string;
}

export type DmEncounterStatus = 'setup' | 'running' | 'ended';

export interface DmEncounter {
  id: string;
  name: string;
  status: DmEncounterStatus;
  /** Current round; 0 while in setup. */
  round: number;
  /** Whose turn it is (running only). */
  activeId: string | null;
  /** Turn order, first to act first. */
  combatants: DmCombatant[];
  /** Newest last, capped. */
  log: string[];
  createdAt: number;
  updatedAt: number;
}