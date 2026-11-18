/**
 * Generators that roll the Dungeon Master's Guide 2024 tables transcribed in
 * src/data/dmg-*.ts. Every result line is a table row exactly as printed; the
 * only computed value is the Weather "1d4 x 10 degrees" shift (DMG 2024 p.38).
 */
import type { DmData, DmNote } from '../types/dm';
import type { Breakdown } from './breakdown';
import { saveNote, uniqueTitle } from './dm-journal';
import type { RNG } from './random';
import {
  ADVENTURE_CLIMAX_RAW,
  HAPPENSTANCE_HOOKS_RAW,
  PATRON_HOOKS_RAW,
  SITUATIONS_L11_16_RAW,
  SITUATIONS_L17_20_RAW,
  SITUATIONS_L1_4_RAW,
  SITUATIONS_L5_10_RAW,
  SUPERNATURAL_HOOKS_RAW,
} from '../data/dmg-adventure-seed';
import { DUNGEON_QUIRKS_RAW, STATES_OF_RUIN_RAW } from '../data/dmg-dungeon';
import { MONSTER_PERSONALITY_RAW, MONSTER_RELATIONSHIPS_RAW } from '../data/dmg-monster-behavior';
import { NPC_APPEARANCE_RAW, NPC_SECRETS_RAW } from '../data/dmg-npc-details';
import {
  SETTLEMENT_CALAMITIES_RAW,
  SETTLEMENT_CLAIMS_TO_FAME_RAW,
  SETTLEMENT_DEFINING_TRAITS_RAW,
  SETTLEMENT_LEADERS_RAW,
  SETTLEMENT_SIZES,
} from '../data/dmg-settlement';
import { WEATHER_TEMPERATURE, WEATHER_WIND_PRECIPITATION } from '../data/dmg-weather';

export interface TableRow {
  lo: number;
  hi: number;
  text: string;
}

/** Parse a "<lo>-<hi> <text>" / "<nn> <text>" table (00 = 100). */
export function parseRawTable(raw: string): TableRow[] {
  return raw
    .trim()
    .split('\n')
    .map((line) => {
      const m = /^(\d\d)(?:-(\d\d))? (.+)$/.exec(line.trim());
      if (!m) throw new Error(`Unparseable table line: "${line}"`);
      const lo = Number(m[1]);
      const hi = m[2] ? (m[2] === '00' ? 100 : Number(m[2])) : lo;
      return { lo, hi, text: m[3] };
    });
}

/** The die size of a table: the highest number it covers. */
function dieOf(rows: readonly { hi: number }[]): number {
  return rows[rows.length - 1].hi;
}

function rollDie(rng: RNG, die: number): number {
  return Math.floor(rng() * die) + 1;
}

/** One rolled line of a generated result. */
export interface RolledPart {
  key: string;
  label: string;
  /** Table name and die, such as "Defining Traits (d20)". */
  source: string;
  roll: number;
  text: string;
  /** Weather temperature only: how the "1d4 x 10 degrees" shift was computed. */
  shift?: { d4: number; direction: 'colder' | 'hotter'; breakdown: Breakdown };
}

export type DmgGeneratorId = 'settlement' | 'adventure' | 'dungeon' | 'npcDetails' | 'weather' | 'monster';

export interface DmgOptions {
  /** Settlement: a chosen size (not rolled), or '' for none. */
  size?: (typeof SETTLEMENT_SIZES)[number]['size'] | '';
  /** Adventure seed: the party's tier. */
  tier?: AdventureTier;
  /** Adventure seed: which hooks table to use. */
  hook?: HookKind;
}

export type AdventureTier = '1-4' | '5-10' | '11-16' | '17-20';
export type HookKind = 'patron' | 'supernatural' | 'happenstance';

export const ADVENTURE_TIERS: readonly { id: AdventureTier; label: string }[] = [
  { id: '1-4', label: 'Levels 1-4' },
  { id: '5-10', label: 'Levels 5-10' },
  { id: '11-16', label: 'Levels 11-16' },
  { id: '17-20', label: 'Levels 17-20' },
];
export const HOOK_KINDS: readonly { id: HookKind; label: string }[] = [
  { id: 'patron', label: 'Patron hook' },
  { id: 'supernatural', label: 'Supernatural hook' },
  { id: 'happenstance', label: 'Happenstance hook' },
];

interface TableDef {
  key: string;
  label: string;
  /** DMG 2024 printed page, for the source line. */
  page: number;
  rows: TableRow[];
}

const table = (key: string, label: string, page: number, raw: string): TableDef => ({
  key,
  label,
  page,
  rows: parseRawTable(raw),
});

const SETTLEMENT_TABLES = [
  table('trait', 'Defining trait', 93, SETTLEMENT_DEFINING_TRAITS_RAW),
  table('claim', 'Claim to fame', 94, SETTLEMENT_CLAIMS_TO_FAME_RAW),
  table('calamity', 'Current calamity', 94, SETTLEMENT_CALAMITIES_RAW),
  table('leader', 'Local leader', 94, SETTLEMENT_LEADERS_RAW),
];
const SITUATIONS: Record<AdventureTier, TableDef> = {
  '1-4': table('situation', 'Adventure situation', 107, SITUATIONS_L1_4_RAW),
  '5-10': table('situation', 'Adventure situation', 107, SITUATIONS_L5_10_RAW),
  '11-16': table('situation', 'Adventure situation', 108, SITUATIONS_L11_16_RAW),
  '17-20': table('situation', 'Adventure situation', 108, SITUATIONS_L17_20_RAW),
};
const HOOKS: Record<HookKind, TableDef> = {
  patron: table('hook', 'Patron hook', 111, PATRON_HOOKS_RAW),
  supernatural: table('hook', 'Supernatural hook', 111, SUPERNATURAL_HOOKS_RAW),
  happenstance: table('hook', 'Happenstance hook', 111, HAPPENSTANCE_HOOKS_RAW),
};
const CLIMAX = table('climax', 'Adventure climax', 120, ADVENTURE_CLIMAX_RAW);
const DUNGEON_TABLES = [
  table('quirk', 'Dungeon quirk', 65, DUNGEON_QUIRKS_RAW),
  table('ruin', 'State of ruin', 67, STATES_OF_RUIN_RAW),
];
const NPC_TABLES = [
  table('appearance', 'Appearance', 86, NPC_APPEARANCE_RAW),
  table('secret', 'Secret', 88, NPC_SECRETS_RAW),
];
const MONSTER_TABLES = [
  table('personality', 'Monster personality', 117, MONSTER_PERSONALITY_RAW),
  table('relationship', 'Monster relationship', 117, MONSTER_RELATIONSHIPS_RAW),
];

function tablesFor(id: DmgGeneratorId, opts: DmgOptions): TableDef[] {
  switch (id) {
    case 'settlement':
      return SETTLEMENT_TABLES;
    case 'adventure':
      return [SITUATIONS[opts.tier ?? '1-4'], HOOKS[opts.hook ?? 'patron'], CLIMAX];
    case 'dungeon':
      return DUNGEON_TABLES;
    case 'npcDetails':
      return NPC_TABLES;
    case 'monster':
      return MONSTER_TABLES;
    case 'weather':
      return [];
  }
}

function rollTableDef(rng: RNG, def: TableDef): RolledPart {
  const die = dieOf(def.rows);
  const roll = rollDie(rng, die);
  const row = def.rows.find((r) => roll >= r.lo && roll <= r.hi);
  if (!row) throw new Error(`No row for ${def.label} roll ${roll}`);
  return { key: def.key, label: def.label, source: `DMG 2024 p.${def.page}, d${die}`, roll, text: row.text };
}

const WEATHER_PARTS = ['temperature', 'wind', 'precipitation'] as const;
type WeatherKey = (typeof WEATHER_PARTS)[number];
const WEATHER_LABELS: Record<WeatherKey, string> = { temperature: 'Temperature', wind: 'Wind', precipitation: 'Precipitation' };

/** DMG 2024 p.38: each of temperature, wind and precipitation is its own d20 roll. */
function rollWeatherPart(rng: RNG, key: WeatherKey): RolledPart {
  const roll = rollDie(rng, 20);
  const source = 'DMG 2024 p.38, d20';
  if (key === 'temperature') {
    const row = WEATHER_TEMPERATURE.find((r) => roll >= r.lo && roll <= r.hi);
    if (!row) throw new Error(`No weather row for ${roll}`);
    if (!row.shift) return { key, label: WEATHER_LABELS[key], source, roll, text: row.text };
    const d4 = rollDie(rng, 4);
    const amount = d4 * row.shift.multiplier;
    return {
      key,
      label: WEATHER_LABELS[key],
      source,
      roll,
      text: `${amount} degrees Fahrenheit ${row.shift.direction}`,
      shift: {
        d4,
        direction: row.shift.direction,
        breakdown: {
          total: amount,
          components: [{ label: `1d4 rolled ${d4}, times ${row.shift.multiplier}`, value: amount }],
          note: `${row.shift.dice} (${d4}) x ${row.shift.multiplier} = ${amount} degrees Fahrenheit`,
        },
      },
    };
  }
  const row = WEATHER_WIND_PRECIPITATION.find((r) => roll >= r.lo && roll <= r.hi);
  if (!row) throw new Error(`No weather row for ${roll}`);
  return { key, label: WEATHER_LABELS[key], source, roll, text: key === 'wind' ? row.wind : row.precipitation };
}

/** The part keys a generator produces, in display order. */
export function dmgPartKeys(id: DmgGeneratorId, opts: DmgOptions = {}): string[] {
  return id === 'weather' ? [...WEATHER_PARTS] : tablesFor(id, opts).map((t) => t.key);
}

/** Roll one part again (or for the first time). */
export function rollDmgPart(rng: RNG, id: DmgGeneratorId, key: string, opts: DmgOptions = {}): RolledPart {
  if (id === 'weather') return rollWeatherPart(rng, key as WeatherKey);
  const def = tablesFor(id, opts).find((t) => t.key === key);
  if (!def) throw new Error(`Unknown part ${key} for ${id}`);
  return rollTableDef(rng, def);
}

/** Roll every part of a generator. */
export function rollDmgGenerator(rng: RNG, id: DmgGeneratorId, opts: DmgOptions = {}): RolledPart[] {
  return dmgPartKeys(id, opts).map((key) => rollDmgPart(rng, id, key, opts));
}

export function settlementSize(size: string) {
  return SETTLEMENT_SIZES.find((s) => s.size === size);
}

/** Plain-text lines for the journal and for copying. */
export function dmgResultLines(id: DmgGeneratorId, parts: readonly RolledPart[], opts: DmgOptions = {}): string[] {
  const lines: string[] = [];
  if (id === 'settlement') {
    const s = settlementSize(opts.size ?? '');
    if (s) lines.push(`Size: ${s.size}, population ${s.population}, most expensive item for sale about ${s.maxGp.toLocaleString('en-US')} GP (DMG 2024 p.93)`);
  }
  for (const p of parts) lines.push(`${p.label}: ${p.text}`);
  return lines;
}

export const DMG_GENERATOR_TITLES: Record<DmgGeneratorId, string> = {
  settlement: 'Settlement',
  adventure: 'Adventure seed',
  dungeon: 'Dungeon',
  npcDetails: 'NPC details',
  weather: 'Weather',
  monster: 'Monster behavior',
};

/** Save a result to a campaign's journal as a plain note. */
export function saveDmgResultToJournal(
  data: DmData,
  campaignId: string,
  id: DmgGeneratorId,
  parts: readonly RolledPart[],
  opts: DmgOptions,
  noteId: string,
  now: number,
): { data: DmData; title: string } {
  const journal = data.campaigns.find((c) => c.id === campaignId)?.journal ?? [];
  const title = uniqueTitle(journal, DMG_GENERATOR_TITLES[id]);
  const note: DmNote = {
    id: noteId,
    kind: 'note',
    title,
    body: dmgResultLines(id, parts, opts).join('\n'),
    status: 'open',
    sessionNumber: null,
    createdAt: now,
    updatedAt: now,
  };
  return { data: saveNote(data, campaignId, note, now), title };
}
