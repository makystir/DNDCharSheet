import { describe, it, expect } from 'vitest';
import { DUNGEON_QUIRKS_RAW, STATES_OF_RUIN_RAW } from '../dmg-dungeon';
import { NPC_APPEARANCE_RAW, NPC_SECRETS_RAW } from '../dmg-npc-details';
import { MONSTER_PERSONALITY_RAW, MONSTER_RELATIONSHIPS_RAW } from '../dmg-monster-behavior';
import { WEATHER_TEMPERATURE, WEATHER_WIND_PRECIPITATION } from '../dmg-weather';

// DMG 2024 tables (printed pages cited in each data module). Each table must
// cover 1..die exactly once, with no gaps or overlaps and non-empty entries.
function parse(raw: string): { lo: number; hi: number; text: string }[] {
  return raw
    .trim()
    .split('\n')
    .map((line) => {
      const m = /^(\d\d)(?:-(\d\d))? (.+)$/.exec(line.trim());
      if (!m) throw new Error(`Unparseable line: "${line}"`);
      const lo = Number(m[1]);
      const hi = m[2] ? (m[2] === '00' ? 100 : Number(m[2])) : lo;
      return { lo, hi, text: m[3] };
    });
}

function expectCoverage(rows: readonly { lo: number; hi: number }[], die: number, count: number) {
  expect(rows).toHaveLength(count);
  let next = 1;
  for (const r of rows) {
    expect(r.lo).toBe(next);
    expect(r.hi).toBeGreaterThanOrEqual(r.lo);
    next = r.hi + 1;
  }
  expect(next - 1).toBe(die);
}

const TABLES: { name: string; raw: string; die: number; rows: number }[] = [
  { name: 'Dungeon Quirks (p.65)', raw: DUNGEON_QUIRKS_RAW, die: 100, rows: 36 },
  { name: 'States of Ruin (p.67)', raw: STATES_OF_RUIN_RAW, die: 6, rows: 6 },
  { name: 'NPC Appearance (p.86)', raw: NPC_APPEARANCE_RAW, die: 12, rows: 12 },
  { name: 'NPC Secrets (p.88)', raw: NPC_SECRETS_RAW, die: 10, rows: 10 },
  { name: 'Monster Personality (p.117)', raw: MONSTER_PERSONALITY_RAW, die: 8, rows: 8 },
  { name: 'Monster Relationships (p.117)', raw: MONSTER_RELATIONSHIPS_RAW, die: 6, rows: 6 },
];

describe('DMG 2024 Group B generator tables', () => {
  for (const t of TABLES) {
    it(`${t.name} covers 1-${t.die} exactly once`, () => {
      const rows = parse(t.raw);
      expectCoverage(rows, t.die, t.rows);
      for (const r of rows) expect(r.text.trim().length).toBeGreaterThan(0);
    });
  }

  it('Weather Temperature covers 1-20 exactly once (p.38)', () => {
    expectCoverage(WEATHER_TEMPERATURE, 20, 3);
    for (const r of WEATHER_TEMPERATURE) expect(r.text.length).toBeGreaterThan(0);
    expect(WEATHER_TEMPERATURE.filter((r) => r.shift).map((r) => r.shift?.direction)).toEqual([
      'colder',
      'hotter',
    ]);
  });

  it('Weather Wind and Precipitation covers 1-20 exactly once (p.38)', () => {
    expectCoverage(WEATHER_WIND_PRECIPITATION, 20, 3);
    for (const r of WEATHER_WIND_PRECIPITATION) {
      expect(r.wind.length).toBeGreaterThan(0);
      expect(r.precipitation.length).toBeGreaterThan(0);
    }
  });
});
