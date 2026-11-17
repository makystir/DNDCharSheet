import { describe, it, expect } from 'vitest';
import { ARCANA_RAW } from '../random-magic-items/arcana';
import { ARMAMENTS_RAW } from '../random-magic-items/armaments';
import { IMPLEMENTS_RAW } from '../random-magic-items/implements';
import { RELICS_RAW } from '../random-magic-items/relics';

// DMG 2024 pp.326-331: Random Magic Items tables, each a d100 table (00 = 100).
const CATEGORIES = {
  Arcana: ARCANA_RAW,
  Armaments: ARMAMENTS_RAW,
  Implements: IMPLEMENTS_RAW,
  Relics: RELICS_RAW,
} as const;

const TIERS = ['common', 'uncommon', 'rare', 'veryRare', 'legendary'] as const;

function parse(raw: string): { lo: number; hi: number; item: string }[] {
  return raw
    .trim()
    .split('\n')
    .map((line) => {
      const m = /^(\d\d)(?:-(\d\d))? (.+)$/.exec(line.trim());
      if (!m) throw new Error(`Unparseable line: "${line}"`);
      const n = (s: string) => (s === '00' ? 100 : Number(s));
      return { lo: n(m[1]), hi: m[2] ? n(m[2]) : n(m[1]), item: m[3] };
    });
}

describe('DMG 2024 random magic item tables', () => {
  for (const [category, tables] of Object.entries(CATEGORIES)) {
    it(`${category} has all five tiers`, () => {
      expect(Object.keys(tables).sort()).toEqual([...TIERS].sort());
    });
    for (const tier of TIERS) {
      it(`${category} ${tier} covers 01-00 exactly once`, () => {
        const rows = parse((tables as Record<string, string>)[tier]);
        let next = 1;
        for (const r of rows) {
          expect(r.lo, `${r.item} starts at ${r.lo}`).toBe(next);
          expect(r.hi).toBeGreaterThanOrEqual(r.lo);
          next = r.hi + 1;
        }
        expect(next).toBe(101);
      });
    }
  }
});

