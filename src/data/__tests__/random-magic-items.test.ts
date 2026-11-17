import { describe, it, expect } from 'vitest';
import { ARCANA_RAW } from '../random-magic-items/arcana';
import { ARMAMENTS_RAW } from '../random-magic-items/armaments';
import { IMPLEMENTS_RAW } from '../random-magic-items/implements';
import { RELICS_RAW } from '../random-magic-items/relics';
import { DMG_MAGIC_ITEMS } from '../dmg-magic-items';
import { MAGIC_ITEMS } from '../magic-items';
import { FLAGGED_NOTE, resolveMagicItem, splitName } from '../../logic/magic-item-resolve';

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

describe('every random magic item entry is resolved or explicitly flagged', () => {
  const entries: { where: string; name: string }[] = [];
  for (const [category, tables] of Object.entries(CATEGORIES)) {
    for (const tier of TIERS) {
      for (const r of parse((tables as Record<string, string>)[tier])) entries.push({ where: `${category} ${tier}`, name: r.item });
    }
  }

  it('covers all 20 tables', () => {
    expect(entries.length).toBeGreaterThan(300);
  });

  it('never leaves a silent gap or an invented description', () => {
    for (const e of entries) {
      const r = resolveMagicItem(e.name);
      const ctx = `${e.where}: ${e.name}`;
      if (r.status === 'flagged') {
        expect(r.description, ctx).toBeNull();
        expect(r.rarity, ctx).toBeNull();
        expect(r.source, ctx).toBe(FLAGGED_NOTE);
      } else {
        expect(r.description && r.description.length > 20, ctx).toBe(true);
        expect(r.catalogName, ctx).toBeTruthy();
        expect(r.rarity, ctx).toBeTruthy();
        expect(r.category, ctx).toBeTruthy();
        expect(typeof r.requiresAttunement, ctx).toBe('boolean');
        expect(r.source, ctx).toMatch(r.status === 'srd' ? /^SRD 5\.2\.1/ : /^DMG 2024 p\.\d+/);
      }
    }
  });

  it('every resolved entry points at a real catalog item', () => {
    const srdNames = new Set(MAGIC_ITEMS.map((i) => i.name));
    const dmgNames = new Set(DMG_MAGIC_ITEMS.map((i) => i.name));
    for (const e of entries) {
      const r = resolveMagicItem(e.name);
      if (r.status === 'srd') expect(srdNames.has(r.catalogName!), e.name).toBe(true);
      if (r.status === 'dmg') expect(dmgNames.has(r.catalogName!), e.name).toBe(true);
    }
  });

  it('flags an unknown item instead of inventing a description', () => {
    const r = resolveMagicItem('Totally Made Up Trinket');
    expect(r).toMatchObject({ status: 'flagged', description: null, catalogName: null, source: FLAGGED_NOTE });
  });

  it('resolves printed variants to their base entry', () => {
    expect(resolveMagicItem('Belt of Giant Strength (cloud)')).toMatchObject({ status: 'srd', catalogName: 'Belt of Giant Strength', variant: 'cloud' });
    expect(resolveMagicItem('Armor, +2')).toMatchObject({ status: 'srd', catalogName: 'Armor, +1, +2, or +3', variant: '+2' });
    expect(resolveMagicItem('Potion of Healing (greater)')).toMatchObject({ status: 'srd', catalogName: 'Potions of Healing' });
    expect(resolveMagicItem('Wraps of Unarmed Power, +3')).toMatchObject({ status: 'dmg', catalogName: 'Wraps of Unarmed Power' });
    expect(splitName('Figurine of Wondrous Power (obsidian steed)').base).toBe('Figurine of Wondrous Power');
  });

  it('DMG-sourced entries carry a printed page in the Magic Items A-Z range', () => {
    for (const i of DMG_MAGIC_ITEMS) {
      expect(i.page, i.name).toBeGreaterThanOrEqual(226);
      expect(i.page, i.name).toBeLessThanOrEqual(326);
      expect(i.description.length, i.name).toBeGreaterThan(20);
    }
    expect(new Set(DMG_MAGIC_ITEMS.map((i) => i.id)).size).toBe(DMG_MAGIC_ITEMS.length);
  });
});
