/**
 * Pure logic for Dungeon Master mode campaigns and the party tracker.
 *
 * Every number shown for an imported member comes from the same functions the
 * player's own sheet uses (armor class, hit points, passive checks, spell save
 * DC, speed, Darkvision), so the DM sees exactly what the player sees. Manual
 * members show what the DM typed. Each value keeps a breakdown for its tooltip.
 *
 * The only rule used here that is not a sheet calculation is the party
 * average level, which is the sum of levels divided by the party size, rounded
 * down (PHB 2024 "Round Down", Docs/PlayersHandbook.md L255: dividing rounds
 * down unless a rule says otherwise). It is a convenience figure, not a rule.
 */
import type { Character } from '../types/character';
import type { DmCampaign, DmData, DmManualStats, DmPartyMember } from '../types/dm';
import type { Breakdown } from './breakdown';
import { characterArmorClassBreakdown } from './armor-class';
import { characterHitPointMaxBreakdown, effectiveHp, effectiveTempHp, hitPointMaxOf } from './hit-points-state';
import { passivePerceptionBreakdown, passiveSkillBreakdown } from './passive-checks';
import { spellSaveDcBreakdown } from './spellcasting';
import { darkvisionBreakdown, resolveSpecies, speedBreakdown } from './species';
import { activeConditionIds, exhaustionLevelOf } from './conditions';
import { knownLanguages } from './languages';
import { primaryClass, resolveClass } from './classes';
import { getCondition } from '../data/conditions';

export function emptyDmData(): DmData {
  return { v: 1, campaigns: [], customMonsters: [], activeCampaignId: null };
}

export const DEFAULT_MANUAL_STATS: DmManualStats = {
  classLabel: '',
  level: 1,
  ac: 10,
  hpMax: 1,
  hpCurrent: 1,
  passivePerception: 10,
  passiveInsight: 10,
  passiveInvestigation: 10,
  spellSaveDc: null,
  speed: 30,
  darkvisionFt: 0,
  languages: ['Common'],
  conditions: [],
};

// ---------------------------------------------------------------- campaigns

export function activeCampaign(data: DmData): DmCampaign | undefined {
  return data.campaigns.find((c) => c.id === data.activeCampaignId) ?? data.campaigns[0];
}

function cleanName(name: string, fallback: string): string {
  const trimmed = name.trim().slice(0, 80);
  return trimmed === '' ? fallback : trimmed;
}

function mapCampaign(data: DmData, id: string, fn: (c: DmCampaign) => DmCampaign): DmData {
  return { ...data, campaigns: data.campaigns.map((c) => (c.id === id ? fn(c) : c)) };
}

export function createCampaign(data: DmData, input: { id: string; name: string; now: number }): DmData {
  const campaign: DmCampaign = {
    id: input.id,
    name: cleanName(input.name, 'New campaign'),
    notes: '',
    party: [],
    encounters: [],
    activeEncounterId: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
  return { ...data, campaigns: [...data.campaigns, campaign], activeCampaignId: campaign.id };
}

export function renameCampaign(data: DmData, id: string, name: string, now: number): DmData {
  return mapCampaign(data, id, (c) => ({ ...c, name: cleanName(name, c.name), updatedAt: now }));
}

export function setCampaignNotes(data: DmData, id: string, notes: string, now: number): DmData {
  return mapCampaign(data, id, (c) => ({ ...c, notes: notes.slice(0, 20000), updatedAt: now }));
}

export function deleteCampaign(data: DmData, id: string): DmData {
  const campaigns = data.campaigns.filter((c) => c.id !== id);
  const activeCampaignId =
    data.activeCampaignId === id ? (campaigns[0]?.id ?? null) : data.activeCampaignId;
  return { ...data, campaigns, activeCampaignId };
}

export function setActiveCampaign(data: DmData, id: string): DmData {
  return data.campaigns.some((c) => c.id === id) ? { ...data, activeCampaignId: id } : data;
}

// ------------------------------------------------------------------- party

export type AddMemberOutcome = 'added' | 'refreshed';

/**
 * Add an imported character to the campaign's party. Share links carry no
 * stable identity (the importer strips the id), so a snapshot whose name
 * matches an existing imported member (ignoring case) refreshes that member
 * instead of adding a duplicate. Pass `replaceMemberId` to refresh a specific
 * member whatever its name.
 */
export function addImportedMember(
  data: DmData,
  campaignId: string,
  input: { id: string; character: Character; now: number; replaceMemberId?: string },
): { data: DmData; outcome: AddMemberOutcome; memberId: string } {
  const campaign = data.campaigns.find((c) => c.id === campaignId);
  const name = cleanName(input.character.name, 'Unnamed character');
  const existing = campaign?.party.find(
    (m) =>
      m.id === input.replaceMemberId ||
      (input.replaceMemberId === undefined &&
        m.source === 'imported' &&
        m.name.trim().toLowerCase() === name.toLowerCase()),
  );
  if (existing) {
    const next = mapCampaign(data, campaignId, (c) => ({
      ...c,
      updatedAt: input.now,
      party: c.party.map((m) =>
        m.id === existing.id
          ? { ...m, name, source: 'imported', character: input.character, manual: undefined, updatedAt: input.now }
          : m,
      ),
    }));
    return { data: next, outcome: 'refreshed', memberId: existing.id };
  }
  const member: DmPartyMember = {
    id: input.id,
    name,
    source: 'imported',
    character: input.character,
    addedAt: input.now,
    updatedAt: input.now,
  };
  const next = mapCampaign(data, campaignId, (c) => ({ ...c, party: [...c.party, member], updatedAt: input.now }));
  return { data: next, outcome: 'added', memberId: member.id };
}

export function clampManualStats(stats: DmManualStats): DmManualStats {
  const int = (n: number, min: number, max: number) =>
    Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : min;
  const hpMax = int(stats.hpMax, 1, 9999);
  return {
    classLabel: stats.classLabel.trim().slice(0, 60),
    level: int(stats.level, 1, 20),
    ac: int(stats.ac, 0, 40),
    hpMax,
    hpCurrent: Math.min(hpMax, int(stats.hpCurrent, 0, 9999)),
    passivePerception: int(stats.passivePerception, 0, 40),
    passiveInsight: int(stats.passiveInsight, 0, 40),
    passiveInvestigation: int(stats.passiveInvestigation, 0, 40),
    spellSaveDc: stats.spellSaveDc === null ? null : int(stats.spellSaveDc, 0, 40),
    speed: int(stats.speed, 0, 500),
    darkvisionFt: int(stats.darkvisionFt, 0, 500),
    languages: stats.languages.map((l) => l.trim()).filter(Boolean).slice(0, 30),
    conditions: stats.conditions.map((l) => l.trim()).filter(Boolean).slice(0, 30),
  };
}

export function addManualMember(
  data: DmData,
  campaignId: string,
  input: { id: string; name: string; stats: DmManualStats; now: number },
): DmData {
  const member: DmPartyMember = {
    id: input.id,
    name: cleanName(input.name, 'Unnamed member'),
    source: 'manual',
    manual: clampManualStats(input.stats),
    addedAt: input.now,
    updatedAt: input.now,
  };
  return mapCampaign(data, campaignId, (c) => ({ ...c, party: [...c.party, member], updatedAt: input.now }));
}

export function updateManualMember(
  data: DmData,
  campaignId: string,
  memberId: string,
  input: { name: string; stats: DmManualStats; now: number },
): DmData {
  return mapCampaign(data, campaignId, (c) => ({
    ...c,
    updatedAt: input.now,
    party: c.party.map((m) =>
      m.id === memberId && m.source === 'manual'
        ? { ...m, name: cleanName(input.name, m.name), manual: clampManualStats(input.stats), updatedAt: input.now }
        : m,
    ),
  }));
}

export function removeMember(data: DmData, campaignId: string, memberId: string, now: number): DmData {
  return mapCampaign(data, campaignId, (c) => ({
    ...c,
    updatedAt: now,
    party: c.party.filter((m) => m.id !== memberId),
  }));
}

// -------------------------------------------------------------------- stats

export interface MemberStats {
  id: string;
  name: string;
  /** "Elf · Rogue 4 · Level 4" style line. */
  identity: string;
  level: number;
  source: 'imported' | 'manual';
  ac: Breakdown;
  /** Null when the hit point maximum is unknown (no class chosen yet). */
  hp: { current: number; max: Breakdown; temp: number } | null;
  passivePerception: Breakdown;
  passiveInsight: Breakdown;
  passiveInvestigation: Breakdown;
  /** Null for a member who does not cast. */
  spellSaveDc: Breakdown | null;
  speed: Breakdown;
  /** Total is the range in feet; 0 means no Darkvision. */
  darkvision: Breakdown;
  languages: string[];
  conditions: string[];
}

function entered(value: number): Breakdown {
  return { total: value, components: [{ label: 'Entered by the DM', value }] };
}

function conditionNames(character: Character): string[] {
  const names = activeConditionIds(character)
    .map((id) => getCondition(id)?.name ?? id)
    .filter((n) => !n.toLowerCase().startsWith('exhaustion'));
  const exhaustion = exhaustionLevelOf(character);
  if (exhaustion > 0) names.push(`Exhaustion ${exhaustion}`);
  return names;
}

function importedStats(member: DmPartyMember, character: Character): MemberStats {
  const cls = resolveClass(character);
  const entry = primaryClass(character);
  const species = resolveSpecies(character);
  const classLabel = cls ? `${cls.name}${entry?.level ? ` ${entry.level}` : ''}` : 'No class';
  const hpMax = hitPointMaxOf(character);
  const current = effectiveHp(character);
  return {
    id: member.id,
    name: member.name,
    identity: `${species?.name ?? 'No species'} · ${classLabel} · Level ${character.level}`,
    level: character.level,
    source: 'imported',
    ac: characterArmorClassBreakdown(character),
    hp:
      hpMax === undefined || current === undefined
        ? null
        : { current, max: characterHitPointMaxBreakdown(character), temp: effectiveTempHp(character) },
    passivePerception: passivePerceptionBreakdown(character),
    passiveInsight: passiveSkillBreakdown(character, 'insight'),
    passiveInvestigation: passiveSkillBreakdown(character, 'investigation'),
    spellSaveDc: spellSaveDcBreakdown(character) ?? null,
    speed: speedBreakdown(character),
    darkvision: darkvisionBreakdown(character),
    languages: knownLanguages(character),
    conditions: conditionNames(character),
  };
}

function manualStats(member: DmPartyMember, m: DmManualStats): MemberStats {
  return {
    id: member.id,
    name: member.name,
    identity: `${m.classLabel || 'No class given'} · Level ${m.level}`,
    level: m.level,
    source: 'manual',
    ac: entered(m.ac),
    hp: { current: m.hpCurrent, max: entered(m.hpMax), temp: 0 },
    passivePerception: entered(m.passivePerception),
    passiveInsight: entered(m.passiveInsight),
    passiveInvestigation: entered(m.passiveInvestigation),
    spellSaveDc: m.spellSaveDc === null ? null : entered(m.spellSaveDc),
    speed: entered(m.speed),
    darkvision: entered(m.darkvisionFt),
    languages: m.languages,
    conditions: m.conditions,
  };
}

/** The numbers a DM checks for one party member. Never throws on a stored member. */
export function memberStats(member: DmPartyMember): MemberStats | undefined {
  try {
    if (member.source === 'imported' && member.character) return importedStats(member, member.character);
    if (member.source === 'manual' && member.manual) return manualStats(member, member.manual);
  } catch (err) {
    console.warn('Could not read party member stats:', err);
  }
  return undefined;
}

// ------------------------------------------------------------------ summary

export interface PartySummary {
  size: number;
  /** Total is the sum of every member's level; one component per member. */
  levels: Breakdown;
  /** The sum divided by the party size, rounded down. */
  averageLevel: number;
  /** Members with no Darkvision. */
  withoutDarkvision: string[];
  /** Languages every member knows. */
  sharedLanguages: string[];
  /** Languages at least one member knows. */
  allLanguages: string[];
}

export function partySummary(stats: MemberStats[]): PartySummary {
  const size = stats.length;
  const sum = stats.reduce((acc, s) => acc + s.level, 0);
  const averageLevel = size === 0 ? 0 : Math.floor(sum / size);
  const seen = new Map<string, string>();
  for (const s of stats) for (const l of s.languages) if (!seen.has(l.toLowerCase())) seen.set(l.toLowerCase(), l);
  const shared = [...seen.entries()]
    .filter(([key]) => size > 0 && stats.every((s) => s.languages.some((l) => l.toLowerCase() === key)))
    .map(([, label]) => label);
  return {
    size,
    levels: {
      total: sum,
      components: stats.map((s) => ({ label: s.name, value: s.level })),
      note: size === 0 ? undefined : `${sum} ÷ ${size} members = ${averageLevel} (rounded down)`,
    },
    averageLevel,
    withoutDarkvision: stats.filter((s) => s.darkvision.total <= 0).map((s) => s.name),
    sharedLanguages: shared,
    allLanguages: [...seen.values()],
  };
}
