import { describe, it, expect } from 'vitest';
import {
  SETTLEMENT_DEFINING_TRAITS_RAW,
  SETTLEMENT_CLAIMS_TO_FAME_RAW,
  SETTLEMENT_CALAMITIES_RAW,
  SETTLEMENT_LEADERS_RAW,
  SETTLEMENT_SIZES,
} from '../dmg-settlement';
import * as seed from '../dmg-adventure-seed';

// DMG 2024 tables (printed pages cited in each data module). Each table must
// cover 1..die exactly once, with no gaps or overlaps and non-empty entries.
function parse(raw: string): { lo: number; hi: number; text: string }[] {
  return raw
    .trim()
    .split('\n')
    .map((line) => {
      const m = /^(\d\d)(?:-(\d\d))? (.+)$/.exec(line.trim());
      if (!m) throw new Error(`Unparseable line: "${line}"`);
      return { lo: Number(m[1]), hi: m[2] ? Number(m[2]) : Number(m[1]), text: m[3] };
    });
}

const TABLES: { name: string; raw: string; die: number; rows: number }[] = [
  { name: 'Settlement Defining Traits (p.93)', raw: SETTLEMENT_DEFINING_TRAITS_RAW, die: 20, rows: 11 },
  { name: 'Settlement Claims to Fame (p.94)', raw: SETTLEMENT_CLAIMS_TO_FAME_RAW, die: 20, rows: 20 },
  { name: 'Settlement Current Calamities (p.94)', raw: SETTLEMENT_CALAMITIES_RAW, die: 12, rows: 12 },
  { name: 'Settlement Local Leaders (p.94)', raw: SETTLEMENT_LEADERS_RAW, die: 12, rows: 12 },
  { name: 'Situations L1-4 (p.107)', raw: seed.SITUATIONS_L1_4_RAW, die: 20, rows: 20 },
  { name: 'Situations L5-10 (p.107)', raw: seed.SITUATIONS_L5_10_RAW, die: 20, rows: 20 },
  { name: 'Situations L11-16 (p.108)', raw: seed.SITUATIONS_L11_16_RAW, die: 12, rows: 12 },
  { name: 'Situations L17-20 (p.108)', raw: seed.SITUATIONS_L17_20_RAW, die: 10, rows: 10 },
  { name: 'Patron Hooks (p.111)', raw: seed.PATRON_HOOKS_RAW, die: 6, rows: 6 },
  { name: 'Supernatural Hooks (p.111)', raw: seed.SUPERNATURAL_HOOKS_RAW, die: 6, rows: 6 },
  { name: 'Happenstance Hooks (p.111)', raw: seed.HAPPENSTANCE_HOOKS_RAW, die: 6, rows: 6 },
  { name: 'Adventure Climax (p.120)', raw: seed.ADVENTURE_CLIMAX_RAW, die: 10, rows: 10 },
];

describe('DMG 2024 Group A generator tables', () => {
  for (const t of TABLES) {
    it(`${t.name} covers 1-${t.die} exactly once`, () => {
      const rows = parse(t.raw);
      expect(rows).toHaveLength(t.rows);
      let next = 1;
      for (const r of rows) {
        expect(r.lo).toBe(next);
        expect(r.hi).toBeGreaterThanOrEqual(r.lo);
        expect(r.text.trim().length).toBeGreaterThan(0);
        next = r.hi + 1;
      }
      expect(next - 1).toBe(t.die);
    });
  }

  it('Settlements by Size has Village, Town, City (p.93)', () => {
    expect(SETTLEMENT_SIZES.map((s) => [s.size, s.maxGp])).toEqual([
      ['Village', 20],
      ['Town', 2000],
      ['City', 200000],
    ]);
  });
});
