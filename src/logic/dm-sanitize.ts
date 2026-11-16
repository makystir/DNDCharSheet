/**
 * Defensive reading of stored or imported DM data. Anything wrong-typed is
 * dropped or coerced, and every imported character is re-validated through the
 * same path a share link takes, so stat calculations never see a bad shape.
 */
import type {
  DmAward,
  DmAwardSource,
  DmCampaign,
  DmCombatCondition,
  DmCombatant,
  DmCustomMonster,
  DmData,
  DmEncounter,
  DmManualStats,
  DmMonsterEntry,
  DmNote,
  DmPartyMember,
} from '../types/dm';
import { CONDITIONS } from '../data/conditions';
import { MAX_COMBATANTS, MAX_LOG_LINES } from './dm-encounter';
import { clampManualStats, DEFAULT_MANUAL_STATS, emptyDmData } from './dm-campaign';
import { ABILITY_KEYS, blankCustomMonster } from './dm-library';
import { MAX_BODY, MAX_NOTES, MAX_TITLE, NOTE_KINDS, QUEST_STATUSES } from './dm-journal';
import { cleanLabel, MAX_AWARDS, MAX_LABEL, validateAward } from './dm-awards';
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

function int(v: unknown, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(num(v, fallback))));
}

const CONDITION_IDS = new Set<string>(CONDITIONS.map((c) => c.id).filter((id) => id !== 'exhaustion'));

function sanitizeCombatant(raw: unknown): DmCombatant | undefined {
  if (!isRecord(raw)) return undefined;
  const id = str(raw.id);
  if (id === '' || !isRecord(raw.hp)) return undefined;
  const max = int(raw.hp.max, 1, 1, 99999);
  const hp = int(raw.hp.hp, max, 0, max);
  const saves = isRecord(raw.hp.deathSaves) ? raw.hp.deathSaves : {};
  const conditions: DmCombatCondition[] = (Array.isArray(raw.conditions) ? raw.conditions : []).flatMap((x) => {
    if (!isRecord(x) || typeof x.id !== 'string' || !CONDITION_IDS.has(x.id)) return [];
    const rounds = typeof x.rounds === 'number' && Number.isInteger(x.rounds) && x.rounds >= 1 ? Math.min(x.rounds, 99999) : undefined;
    const cond = { id: x.id as DmCombatCondition['id'] };
    return [rounds === undefined ? cond : { ...cond, rounds }];
  });
  const conc = isRecord(raw.concentration) ? raw.concentration : {};
  const out: DmCombatant = {
    id,
    name: str(raw.name, 'Creature').slice(0, 60) || 'Creature',
    kind: raw.kind === 'pc' ? 'pc' : 'monster',
    sourceLabel: str(raw.sourceLabel).slice(0, 120),
    ac: int(raw.ac, 10, 0, 99),
    hp: {
      max,
      hp,
      temp: int(raw.hp.temp, 0, 0, 99999),
      deathSaves: { successes: int(saves.successes, 0, 0, 3), failures: int(saves.failures, 0, 0, 3) },
      stable: raw.hp.stable === true,
      dead: raw.hp.dead === true,
    },
    initiative: raw.initiative === null || raw.initiative === undefined ? null : int(raw.initiative, 0, -20, 60),
    initiativeMod: int(raw.initiativeMod, 0, -20, 40),
    surprised: raw.surprised === true,
    resistances: str(raw.resistances).slice(0, 200),
    vulnerabilities: str(raw.vulnerabilities).slice(0, 200),
    immunities: str(raw.immunities).slice(0, 200),
    conditions,
    concentration: { active: conc.active === true, label: str(conc.label).slice(0, 60) },
    concentrationDcs: (Array.isArray(raw.concentrationDcs) ? raw.concentrationDcs : [])
      .filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
      .map((x) => int(x, 10, 1, 30))
      .slice(0, 20),
    diesLikeCharacter: raw.diesLikeCharacter === true,
    notes: str(raw.notes).slice(0, 1000),
  };
  if (isRecord(raw.legendary)) {
    const max = int(raw.legendary.max, 0, 0, 20);
    if (max > 0) out.legendary = { max, used: int(raw.legendary.used, 0, 0, max) };
  }
  if (typeof raw.memberId === 'string') out.memberId = raw.memberId;
  if (typeof raw.groupId === 'string') out.groupId = raw.groupId;
  if (typeof raw.cr === 'string' && raw.cr.trim() !== '') out.cr = raw.cr.trim().slice(0, 8);
  if (typeof raw.xp === 'number' && Number.isFinite(raw.xp)) out.xp = int(raw.xp, 0, 0, 1000000);
  if (typeof raw.xpCounts === 'boolean') out.xpCounts = raw.xpCounts;
  if (typeof raw.conSaveMod === 'number' && Number.isFinite(raw.conSaveMod)) out.conSaveMod = int(raw.conSaveMod, 0, -20, 40);
  return out;
}

function sanitizeEncounter(raw: unknown): DmEncounter | undefined {
  if (!isRecord(raw)) return undefined;
  const id = str(raw.id);
  if (id === '') return undefined;
  const combatants = (Array.isArray(raw.combatants) ? raw.combatants : [])
    .map(sanitizeCombatant)
    .filter((c): c is DmCombatant => c !== undefined)
    .slice(0, MAX_COMBATANTS);
  const status = raw.status === 'running' || raw.status === 'ended' ? raw.status : 'setup';
  const activeId = typeof raw.activeId === 'string' && combatants.some((c) => c.id === raw.activeId) ? raw.activeId : null;
  return {
    id,
    name: str(raw.name, 'Encounter').slice(0, 80) || 'Encounter',
    status,
    round: status === 'setup' ? 0 : int(raw.round, 1, 1, 9999),
    activeId: status === 'running' ? activeId : null,
    combatants,
    log: strList(raw.log).slice(-MAX_LOG_LINES),
    createdAt: num(raw.createdAt, 0),
    updatedAt: num(raw.updatedAt, 0),
  };
}
function sanitizeEntries(v: unknown): DmMonsterEntry[] {
  return (Array.isArray(v) ? v : [])
    .flatMap((x) =>
      isRecord(x) && (typeof x.name === 'string' || typeof x.description === 'string')
        ? [{ name: str(x.name).slice(0, 80), description: str(x.description).slice(0, 2000) }]
        : [],
    )
    .slice(0, 40);
}

function sanitizeMonster(raw: unknown): DmCustomMonster | undefined {
  if (!isRecord(raw)) return undefined;
  const id = str(raw.id);
  if (id === '') return undefined;
  const base = blankCustomMonster(id, num(raw.createdAt, 0));
  const scores = isRecord(raw.abilities) ? raw.abilities : {};
  const abilities = { ...base.abilities };
  for (const a of ABILITY_KEYS) abilities[a] = int(scores[a], 10, 1, 30);
  const saves = (Array.isArray(raw.saveProficiencies) ? raw.saveProficiencies : []).filter(
    (x): x is DmCustomMonster['saveProficiencies'][number] => typeof x === 'string' && (ABILITY_KEYS as readonly string[]).includes(x),
  );
  const text = (v: unknown, max: number) => str(v).slice(0, max);
  return {
    ...base,
    name: text(raw.name, 80).trim() || 'Monster',
    size: text(raw.size, 20) || base.size,
    creatureType: text(raw.creatureType, 40) || base.creatureType,
    alignment: text(raw.alignment, 40),
    cr: text(raw.cr, 8),
    ac: int(raw.ac, 10, 0, 40),
    hpMax: int(raw.hpMax, 1, 1, 9999),
    hpDice: text(raw.hpDice, 30),
    speed: text(raw.speed, 120),
    abilities,
    saveProficiencies: [...new Set(saves)],
    proficiencyBonus: int(raw.proficiencyBonus, 2, 0, 9),
    initiativeMod: int(raw.initiativeMod, 0, -10, 30),
    skills: text(raw.skills, 200),
    senses: text(raw.senses, 200),
    languages: text(raw.languages, 200),
    resistances: text(raw.resistances, 200),
    vulnerabilities: text(raw.vulnerabilities, 200),
    immunities: text(raw.immunities, 200),
    conditionImmunities: text(raw.conditionImmunities, 200),
    traits: sanitizeEntries(raw.traits),
    actions: sanitizeEntries(raw.actions),
    bonusActions: sanitizeEntries(raw.bonusActions),
    reactions: sanitizeEntries(raw.reactions),
    legendaryActions: sanitizeEntries(raw.legendaryActions),
    legendaryUses: int(raw.legendaryUses, 0, 0, 10),
    basedOn: text(raw.basedOn, 160),
    createdAt: num(raw.createdAt, 0),
    updatedAt: num(raw.updatedAt, 0),
  };
}
function sanitizeNote(raw: unknown): DmNote | undefined {
  if (!isRecord(raw)) return undefined;
  const id = str(raw.id);
  if (id === '') return undefined;
  const kind = NOTE_KINDS.find((k) => k === raw.kind) ?? 'note';
  const status = QUEST_STATUSES.find((s) => s === raw.status) ?? 'open';
  return {
    id,
    kind,
    title: str(raw.title).replace(/[[\]\n]/g, ' ').trim().slice(0, MAX_TITLE) || 'Untitled',
    body: str(raw.body).slice(0, MAX_BODY),
    status,
    sessionNumber: kind === 'session' ? int(raw.sessionNumber, 1, 1, 9999) : null,
    createdAt: num(raw.createdAt, 0),
    updatedAt: num(raw.updatedAt, 0),
  };
}
const AWARD_SOURCES: readonly DmAwardSource[] = ['fight', 'major', 'minor', 'noncombat', 'manual', 'level'];

function sanitizeAward(raw: unknown): DmAward | undefined {
  if (!isRecord(raw)) return undefined;
  const source = AWARD_SOURCES.find((s) => s === raw.source);
  if (source === undefined || typeof raw.createdAt !== 'number' || !Number.isFinite(raw.createdAt)) return undefined;
  const checked = validateAward({
    t: 'award',
    k: raw.kind,
    n: raw.amount,
    i: raw.id,
    l: typeof raw.label === 'string' ? cleanLabel(raw.label).slice(0, MAX_LABEL) : '',
  });
  if (!checked.ok) return undefined;
  const { kind, amount, id, label } = checked.award;
  return { id, kind, amount, label, source, createdAt: raw.createdAt };
}

function sanitizeCampaign(raw: unknown): DmCampaign | undefined {
  if (!isRecord(raw)) return undefined;
  const id = str(raw.id);
  if (id === '') return undefined;
  const party = (Array.isArray(raw.party) ? raw.party : [])
    .map(sanitizeMember)
    .filter((m): m is DmPartyMember => m !== undefined);
  const encounters = (Array.isArray(raw.encounters) ? raw.encounters : [])
    .map(sanitizeEncounter)
    .filter((e): e is DmEncounter => e !== undefined);
  const journal = (Array.isArray(raw.journal) ? raw.journal : [])
    .map(sanitizeNote)
    .filter((n): n is DmNote => n !== undefined)
    .slice(0, MAX_NOTES);
  const awards = (Array.isArray(raw.awards) ? raw.awards : [])
    .map(sanitizeAward)
    .filter((a): a is DmAward => a !== undefined)
    // A repeated ID would give duplicate React keys and two history rows for one code: keep the first.
    .filter((a, i, all) => all.findIndex((b) => b.id === a.id) === i)
    .slice(-MAX_AWARDS);
  const wantedEncounter = str(raw.activeEncounterId);
  return {
    id,
    name: str(raw.name, 'Campaign').slice(0, 80) || 'Campaign',
    notes: str(raw.notes).slice(0, 20000),
    party,
    encounters,
    journal,
    awards,
    activeEncounterId: encounters.some((e) => e.id === wantedEncounter) ? wantedEncounter : null,
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
  const customMonsters = (Array.isArray(raw.customMonsters) ? raw.customMonsters : [])
    .map(sanitizeMonster)
    .filter((m): m is DmCustomMonster => m !== undefined)
    .slice(0, 500);
  const wanted = str(raw.activeCampaignId);
  return {
    v: 1,
    campaigns,
    customMonsters,
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
