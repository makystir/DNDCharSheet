import { describe, it, expect } from 'vitest';
import {
  SPECIES_CATALOG,
  SPECIES_LIST,
  getSpecies,
} from '../species';
import type { SpeciesData } from '../species';

const EXPECTED_IDS = [
  'aasimar',
  'dragonborn',
  'dwarf',
  'elf',
  'gnome',
  'goliath',
  'halfling',
  'human',
  'orc',
  'tiefling',
] as const;

describe('SPECIES_CATALOG', () => {
  // Test 1: all ten present, alphabetical, Humanoid.
  it('has the ten PHB (2024) species keyed alphabetically', () => {
    expect(SPECIES_LIST.length).toBe(10);
    expect(SPECIES_LIST.map((s) => s.id)).toEqual([...EXPECTED_IDS]);
  });

  it('every species is Humanoid (PHB 2024 "Parts of a Species")', () => {
    for (const s of SPECIES_LIST) {
      expect(s.creatureType).toBe('Humanoid');
    }
  });

  // Test 2: transcribed mechanical values from the PHB.
  it.each<[string, Partial<SpeciesData>]>([
    ['aasimar', { size: 'choice', baseSpeedFt: 30, darkvisionFt: 60 }],
    ['dragonborn', { size: 'medium', baseSpeedFt: 30, darkvisionFt: 60 }],
    ['dwarf', { size: 'medium', baseSpeedFt: 30, darkvisionFt: 120 }],
    ['elf', { size: 'medium', baseSpeedFt: 30, darkvisionFt: 60 }],
    ['gnome', { size: 'small', baseSpeedFt: 30, darkvisionFt: 60 }],
    ['goliath', { size: 'medium', baseSpeedFt: 35, darkvisionFt: 0 }],
    ['halfling', { size: 'small', baseSpeedFt: 30, darkvisionFt: 0 }],
    ['human', { size: 'choice', baseSpeedFt: 30, darkvisionFt: 0 }],
    ['orc', { size: 'medium', baseSpeedFt: 30, darkvisionFt: 120 }],
    ['tiefling', { size: 'choice', baseSpeedFt: 30, darkvisionFt: 60 }],
  ])('%s has the transcribed size/speed/darkvision', (id, expected) => {
    const s = getSpecies(id)!;
    expect(s.size).toBe(expected.size);
    expect(s.baseSpeedFt).toBe(expected.baseSpeedFt);
    expect(s.darkvisionFt).toBe(expected.darkvisionFt);
  });

  it('encodes the Wood Elf speed (35) and Drow darkvision (120) lineage overrides', () => {
    const elf = getSpecies('elf')!;
    const lineage = elf.choices?.find((c) => c.kind === 'elvenLineage');
    const wood = lineage?.options.find((o) => o.id === 'woodElf');
    const drow = lineage?.options.find((o) => o.id === 'drow');
    expect(wood?.note).toMatch(/35/);
    expect(drow?.note).toMatch(/120/);
  });

  it('encodes Dwarven Toughness as +1 HP per level', () => {
    const dwarf = getSpecies('dwarf')!;
    const toughness = dwarf.traits.find((t) => t.name === 'Dwarven Toughness');
    expect(toughness?.mechanics?.hpPerLevel).toBe(1);
  });

  // Test 10 (data side): grantedLanguages is empty for all ten (2024 rule).
  it('grants no species languages (2024: languages come from character creation)', () => {
    for (const s of SPECIES_LIST) {
      expect(s.grantedLanguages).toEqual([]);
    }
  });

  // FR-9 data guard: no species carries any ability-score field.
  it('has no ability-score field on any species or trait (no species ASI in 2024)', () => {
    for (const s of SPECIES_LIST) {
      for (const key of Object.keys(s)) {
        // Guard against a stray ability-score-increase field on the entry.
        expect(key).not.toMatch(/scoreIncrease|abilityScore|^asi$/i);
      }
      // The data must not encode an ability-score-increase mechanic anywhere.
      const serialized = JSON.stringify(s);
      expect(serialized).not.toMatch(/abilityScoreIncrease/i);
    }
  });

  // Test 3: every entry and trait has a non-empty source citation.
  it('every species and every trait carries a non-empty source citation', () => {
    for (const s of SPECIES_LIST) {
      expect(s.source.trim().length).toBeGreaterThan(0);
      for (const trait of s.traits) {
        expect(trait.source.trim().length).toBeGreaterThan(0);
      }
    }
  });

  // Test 4: every species has an srd classification; flag non-srd-safe.
  it('classifies every species for SRD and flags all non-srd-safe ones', () => {
    const flagged: string[] = [];
    for (const s of SPECIES_LIST) {
      expect(['srd-safe', 'non-srd', 'uncertain']).toContain(s.srd);
      if (s.srd !== 'srd-safe') flagged.push(s.id);
    }
    // Conservative default: nothing is confirmed srd-safe, so all ten are
    // flagged for the user to review before redistribution.
    expect(flagged).toEqual([...EXPECTED_IDS]);
    expect(SPECIES_LIST.some((s) => s.srd === 'srd-safe')).toBe(false);
  });

  // Test 5: no-verbatim heuristic — no over-long effect strings.
  it('keeps every trait effect a short paraphrase (no verbatim PHB prose)', () => {
    for (const s of SPECIES_LIST) {
      for (const trait of s.traits) {
        expect(trait.effect.length).toBeLessThanOrEqual(240);
        expect(trait.effect.trim().length).toBeGreaterThan(0);
      }
    }
  });

  // Test 6: species-with-choices cover exactly the sub-choice fields they need.
  it('declares the sub-choices each species requires', () => {
    const kinds = (id: string) =>
      (getSpecies(id)!.choices ?? []).map((c) => c.kind).sort();
    expect(kinds('aasimar')).toEqual(['size']);
    expect(kinds('dragonborn')).toEqual(['draconicAncestry']);
    expect(kinds('dwarf')).toEqual([]);
    expect(kinds('elf')).toEqual(
      ['elvenLineage', 'keenSensesSkill', 'spellcastingAbility'].sort(),
    );
    expect(kinds('gnome')).toEqual(['gnomishLineage', 'spellcastingAbility'].sort());
    expect(kinds('goliath')).toEqual(['giantAncestry']);
    expect(kinds('halfling')).toEqual([]);
    expect(kinds('human')).toEqual(['size', 'skillfulSkill'].sort());
    expect(kinds('orc')).toEqual([]);
    expect(kinds('tiefling')).toEqual(
      ['fiendishLegacy', 'size', 'spellcastingAbility'].sort(),
    );
  });

  it('each choice spec writes to a matching SpeciesSelection field', () => {
    for (const s of SPECIES_LIST) {
      for (const choice of s.choices ?? []) {
        // field and kind match for every spec except where kind is a generic
        // alias of the field; here they are intentionally identical.
        expect(choice.field).toBe(choice.kind);
        expect(choice.options).toBeDefined();
      }
    }
  });

  it('getSpecies tolerates unknown/undefined ids', () => {
    expect(getSpecies(undefined)).toBeUndefined();
    expect(getSpecies('not-a-species')).toBeUndefined();
    expect(getSpecies('dwarf')).toBe(SPECIES_CATALOG.dwarf);
  });
});
