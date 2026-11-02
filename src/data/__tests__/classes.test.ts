import { describe, it, expect } from 'vitest';
import { CLASS_CATALOG, CLASS_LIST, getClass } from '../classes';
import type { ClassData } from '../classes';

// The classes shipped with full level-1-to-20 feature lists this stage.
const FULL_FEATURE_CLASSES = ['barbarian', 'cleric', 'rogue', 'wizard'] as const;

// All twelve classes, alphabetical (declaration) order.
const EXPECTED_IDS = [
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
] as const;

/**
 * Per-class fixtures transcribed from PHB 2024 Chapter 3 so the tests assert
 * against known values rather than whatever the data happens to contain.
 * Every subclassLevel is read from each "<Class> Subclass" Features-table row
 * (all twelve 2024 classes select at level 3 — confirmed per class, NOT a ===3
 * default).
 */
const FIXTURES: Record<
  string,
  { hitDie: number; subclassLevel: number }
> = {
  barbarian: { hitDie: 12, subclassLevel: 3 },
  bard: { hitDie: 8, subclassLevel: 3 },
  cleric: { hitDie: 8, subclassLevel: 3 },
  druid: { hitDie: 8, subclassLevel: 3 },
  fighter: { hitDie: 10, subclassLevel: 3 },
  monk: { hitDie: 8, subclassLevel: 3 },
  paladin: { hitDie: 10, subclassLevel: 3 },
  ranger: { hitDie: 10, subclassLevel: 3 },
  rogue: { hitDie: 8, subclassLevel: 3 },
  sorcerer: { hitDie: 6, subclassLevel: 3 },
  warlock: { hitDie: 8, subclassLevel: 3 },
  wizard: { hitDie: 6, subclassLevel: 3 },
};

/** ASI-marker fixtures per full-feature class (ASI rows + level-19 Epic Boon). */
const ASI_MARKER_LEVELS: Record<string, number[]> = {
  barbarian: [4, 8, 12, 16, 19],
  cleric: [4, 8, 12, 16, 19],
  rogue: [4, 8, 10, 12, 16, 19],
  wizard: [4, 8, 12, 16, 19],
};

describe('CLASS_CATALOG', () => {
  it('has the twelve PHB (2024) classes keyed alphabetically', () => {
    expect(CLASS_LIST.length).toBe(12);
    expect(CLASS_LIST.map((c) => c.id)).toEqual([...EXPECTED_IDS]);
  });

  it('keys each class under its own id', () => {
    for (const id of EXPECTED_IDS) {
      expect(CLASS_CATALOG[id].id).toBe(id);
    }
  });

  it.each(EXPECTED_IDS)('%s has a valid Hit Die in {6,8,10,12}', (id) => {
    const c = getClass(id)!;
    expect([6, 8, 10, 12]).toContain(c.hitDie);
    expect(c.hitDie).toBe(FIXTURES[id].hitDie);
  });

  it.each(EXPECTED_IDS)('%s has exactly two saving throws', (id) => {
    const c = getClass(id)!;
    expect(c.savingThrows).toHaveLength(2);
    expect(new Set(c.savingThrows).size).toBe(2);
  });

  it.each(EXPECTED_IDS)('%s declares a skill choice with count and from', (id) => {
    const c = getClass(id)!;
    expect(c.skillChoices.count).toBeGreaterThanOrEqual(1);
    const from = c.skillChoices.from;
    if (from !== 'any') {
      expect(Array.isArray(from)).toBe(true);
      expect(from.length).toBeGreaterThanOrEqual(c.skillChoices.count);
    }
  });

  it.each(EXPECTED_IDS)('%s has a non-empty source citation', (id) => {
    const c = getClass(id)!;
    expect(c.source.trim().length).toBeGreaterThan(0);
  });

  it.each(EXPECTED_IDS)('%s subclassLevel is a present integer >= 1 matching the fixture', (id) => {
    const c = getClass(id)!;
    expect(Number.isInteger(c.subclassLevel)).toBe(true);
    expect(c.subclassLevel).toBeGreaterThanOrEqual(1);
    // Asserted against the per-class fixture, not a hard-coded === 3.
    expect(c.subclassLevel).toBe(FIXTURES[id].subclassLevel);
  });

  it('classifies every class and subclass for SRD and flags them all (none srd-safe)', () => {
    const flagged: string[] = [];
    for (const c of CLASS_LIST) {
      expect(['non-srd', 'uncertain']).toContain(c.srd);
      expect(c.srd).not.toBe('srd-safe');
      flagged.push(c.id);
      for (const sub of c.subclasses) {
        expect(['non-srd', 'uncertain']).toContain(sub.srd);
        expect(sub.srd).not.toBe('srd-safe');
      }
    }
    // Conservative default: every class is flagged for user review.
    expect(flagged).toEqual([...EXPECTED_IDS]);
    expect(CLASS_LIST.some((c) => (c.srd as string) === 'srd-safe')).toBe(false);
  });

  it('every class and subclass carries a non-empty source citation', () => {
    for (const c of CLASS_LIST) {
      expect(c.source.trim().length).toBeGreaterThan(0);
      for (const sub of c.subclasses) {
        expect(sub.source.trim().length).toBeGreaterThan(0);
      }
      for (const f of c.features) {
        expect(f.source.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every feature effect a short paraphrase (<=300 chars, no verbatim PHB sentence)', () => {
    // A couple of exact PHB sentences that must NOT appear verbatim.
    const knownPhbSentences = [
      'You can imbue yourself with a primal power called Rage, a force that grants you extraordinary might and resilience.',
      'You gain Expertise in two of your skill proficiencies of your choice.',
    ];
    for (const c of CLASS_LIST) {
      for (const f of c.features) {
        expect(f.effect.length).toBeLessThanOrEqual(300);
        expect(f.effect.trim().length).toBeGreaterThan(0);
        for (const sentence of knownPhbSentences) {
          expect(f.effect).not.toBe(sentence);
        }
      }
    }
  });

  it('ships exactly the four full-feature classes; the rest are names-only', () => {
    for (const c of CLASS_LIST) {
      if ((FULL_FEATURE_CLASSES as readonly string[]).includes(c.id)) {
        expect(c.features.length).toBeGreaterThan(0);
      } else {
        expect(c.features).toEqual([]);
      }
    }
  });

  it.each(FULL_FEATURE_CLASSES)('%s has ASI-marker features at exactly the fixture levels', (id) => {
    const c = getClass(id)!;
    const asiLevels = c.features
      .filter((f) => f.kind === 'asi-marker')
      .map((f) => f.level)
      .sort((a, b) => a - b);
    expect(asiLevels).toEqual(ASI_MARKER_LEVELS[id]);
  });

  it('marks the level-19 Epic Boon as an asi-marker on Barbarian and Fighter-style full classes', () => {
    // Spot-check Barbarian (full) — Fighter is names-only this stage, so the
    // Epic Boon assertion is spot-checked on the full-feature classes that
    // include it.
    for (const id of ['barbarian', 'wizard'] as const) {
      const c = getClass(id)!;
      const epicBoon = c.features.find((f) => f.level === 19);
      expect(epicBoon?.name).toBe('Epic Boon');
      expect(epicBoon?.kind).toBe('asi-marker');
    }
  });

  it('spot-checks Barbarian ASI levels at 4/8/12/16', () => {
    const barb = getClass('barbarian')!;
    for (const level of [4, 8, 12, 16]) {
      const f = barb.features.find((x) => x.level === level && x.kind === 'asi-marker');
      expect(f).toBeDefined();
    }
  });

  it('marks the subclass-selection feature with kind subclass-choice', () => {
    for (const id of FULL_FEATURE_CLASSES) {
      const c = getClass(id)!;
      const choice = c.features.find((f) => f.kind === 'subclass-choice');
      expect(choice).toBeDefined();
      expect(choice?.level).toBe(c.subclassLevel);
    }
  });

  it.each(EXPECTED_IDS)('%s lists four subclasses by name with empty features', (id) => {
    const c = getClass(id)!;
    expect(c.subclasses.length).toBe(4);
    for (const sub of c.subclasses) {
      expect(sub.name.trim().length).toBeGreaterThan(0);
      expect(sub.features).toEqual([]);
    }
  });

  it('getClass tolerates unknown/undefined ids', () => {
    expect(getClass(undefined)).toBeUndefined();
    expect(getClass('not-a-class')).toBeUndefined();
    expect(getClass('wizard')).toBe(CLASS_CATALOG.wizard as ClassData);
  });
});
