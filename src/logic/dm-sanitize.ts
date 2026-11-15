/**
 * Defensive reading of stored or imported DM data. Anything wrong-typed is
 * dropped or coerced, and every imported character is re-validated through the
 * same path a share link takes, so stat calculations never see a bad shape.
 */
import type { DmCampaign, DmData, DmManualStats, DmPartyMember } from '../types/dm';
import { clampManualStats, DEFAULT_MANUAL_STATS, emptyDmData } from './dm-campaign';
import { validateSharedPayload } from './share-validate';

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sanitizeManual(raw: unknown): DmManualStats | undefined {
  if (!isRecord(raw)) return undefined;
  const d = DEFAULT_MANUAL_STATS;
  return clampManualStats({
    classLabel: str(raw.classLabel),
    level: num(raw.level, d.level),
    ac: num(raw.ac, d.ac),
    hpMax: num(raw.hpMax, d.hpMax),
    hpCurrent: num(raw.hpCurrent, d.hpCurrent),
    passivePerception: num(raw.passivePerception, d.passivePerception),
    passiveInsight: num(raw.passiveInsight, d.passiveInsight),
    passiveInvestigation: num(raw.passiveInvestigation, d.passiveInvestigation),
    spellSaveDc: raw.spellSaveDc === null || raw.spellSaveDc === undefined ? null : num(raw.spellSaveDc, 0),
    speed: num(raw.speed, d.speed),
    darkvisionFt: num(raw.darkvisionFt, 0),
    languages: strList(raw.languages),
    conditions: strList(raw.conditions),
  });
}

function sanitizeMember(raw: unknown): DmPartyMember | undefined {
  if (!isRecord(raw)) return undefined;
  const id = str(raw.id);
  if (id === '') return undefined;
  const base = {
    id,
    name: str(raw.name, 'Unnamed member').slice(0, 80) || 'Unnamed member',
    addedAt: num(raw.addedAt, 0),
    updatedAt: num(raw.updatedAt, 0),
  };
  if (raw.source === 'imported') {
    const validated = validateSharedPayload(JSON.stringify(raw.character ?? null));
    if (!validated.ok) return undefined;
    return { ...base, source: 'imported', character: validated.character };
  }
  if (raw.source === 'manual') {
    const manual = sanitizeManual(raw.manual);
    return manual ? { ...base, source: 'manual', manual } : undefined;
  }
  return undefined;
}

function sanitizeCampaign(raw: unknown): DmCampaign | undefined {
  if (!isRecord(raw)) return undefined;
  const id = str(raw.id);
  if (id === '') return undefined;
  const party = (Array.isArray(raw.party) ? raw.party : [])
    .map(sanitizeMember)
    .filter((m): m is DmPartyMember => m !== undefined);
  return {
    id,
    name: str(raw.name, 'Campaign').slice(0, 80) || 'Campaign',
    notes: str(raw.notes).slice(0, 20000),
    party,
    createdAt: num(raw.createdAt, 0),
    updatedAt: num(raw.updatedAt, 0),
  };
}

/** Turn untrusted parsed JSON into valid DM data. Never throws. */
export function sanitizeDmData(raw: unknown): DmData {
  if (!isRecord(raw)) return emptyDmData();
  const campaigns = (Array.isArray(raw.campaigns) ? raw.campaigns : [])
    .map(sanitizeCampaign)
    .filter((c): c is DmCampaign => c !== undefined);
  const wanted = str(raw.activeCampaignId);
  return {
    v: 1,
    campaigns,
    activeCampaignId: campaigns.some((c) => c.id === wanted) ? wanted : (campaigns[0]?.id ?? null),
  };
}

/** Parse a JSON string of DM data (a stored value or an imported file). */
export function parseDmData(json: string): { ok: true; data: DmData } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!isRecord(raw) || !Array.isArray(raw.campaigns)) {
    return { ok: false, error: 'That file does not look like Dungeon Master data.' };
  }
  return { ok: true, data: sanitizeDmData(raw) };
}
