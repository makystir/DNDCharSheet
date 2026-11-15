/**
 * Dungeon Master mode data (design: .agents/tasks/dm-mode/design.md).
 *
 * DM data lives in its own store, separate from the player's characters. A
 * campaign holds a party; each party member is either an imported snapshot of a
 * player's character (from a share link) or a manual stat line the DM typed in.
 */
import type { Character } from './character';

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
  createdAt: number;
  updatedAt: number;
}

export interface DmData {
  /** Storage format version. */
  v: 1;
  campaigns: DmCampaign[];
  activeCampaignId: string | null;
}
