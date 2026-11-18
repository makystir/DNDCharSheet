import { describe, it, expect } from 'vitest';
import { RANDOM_SHOPS_RAW, TAVERN_FIRST_PART_RAW, TAVERN_SECOND_PART_RAW } from '../dmg-tavern-shop';
import { parseRawTable } from '../../logic/dmg-generators';

// DMG 2024 p.94. Each table must cover 1-20 exactly once, with no gaps or overlaps.
const TABLES = [
  { name: 'Tavern Names: First Part', raw: TAVERN_FIRST_PART_RAW },
  { name: 'Tavern Names: Second Part', raw: TAVERN_SECOND_PART_RAW },
  { name: 'Random Shops', raw: RANDOM_SHOPS_RAW },
];

describe('DMG 2024 p.94 tavern and shop tables', () => {
  for (const t of TABLES) {
    it(`${t.name} covers 1-20 exactly once`, () => {
      const rows = parseRawTable(t.raw);
      expect(rows).toHaveLength(20);
      rows.forEach((r, i) => {
        expect(r.lo).toBe(i + 1);
        expect(r.hi).toBe(i + 1);
        expect(r.text.trim().length).toBeGreaterThan(0);
      });
    });
  }

  it('matches the printed first and last rows', () => {
    expect(parseRawTable(TAVERN_FIRST_PART_RAW)[0].text).toBe('The Golden');
    expect(parseRawTable(TAVERN_SECOND_PART_RAW)[0].text).toBe('Lyre');
    expect(parseRawTable(TAVERN_FIRST_PART_RAW)[19].text).toBe('The Witch and');
    expect(parseRawTable(TAVERN_SECOND_PART_RAW)[19].text).toBe('Dragon');
    expect(parseRawTable(RANDOM_SHOPS_RAW)[0].text).toBe('Pawnshop');
    expect(parseRawTable(RANDOM_SHOPS_RAW)[19].text).toBe('Scribe');
  });
});
