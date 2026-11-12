import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALIGNMENTS } from '../../types/character';
import { CLASS_LIST } from '../../data/classes';
import { BACKGROUND_LIST } from '../../data/backgrounds';
import { ALIGNMENT_TRAITS, BONDS, FLAWS, IDEALS, QUIRKS } from '../../data/personality-tables';
import { alignmentParts, generatePersonality, generateRandomCharacter } from '../personal-details-generation';
import { createSeededRng } from '../random';
import { trainingTooltip, suggestedBackgroundIncrease } from '../creation-guidance';
import { entryItem } from '../starting-equipment';
import { resolveItemTooltip } from '../tooltip-content';

const PHB = resolve(__dirname, '../../../Docs/PlayersHandbook.md');

describe('personality tables', () => {
  it('are large and free of duplicates', () => {
    expect(QUIRKS.length).toBeGreaterThanOrEqual(100);
    expect(BONDS.length).toBeGreaterThanOrEqual(50);
    expect(FLAWS.length).toBeGreaterThanOrEqual(50);
    for (const list of [QUIRKS, BONDS, FLAWS, ...Object.values(IDEALS)]) {
      expect(new Set(list).size).toBe(list.length);
    }
    for (const ideals of Object.values(IDEALS)) expect(ideals.length).toBeGreaterThanOrEqual(12);
  });

  it.skipIf(!existsSync(PHB))('take the alignment traits from the PHB table, row by row', () => {
    const lines = readFileSync(PHB, 'utf8').split(/\r?\n/);
    const start = lines.findIndex((l) => /^\| Alignment\s+\| ld4/.test(l));
    expect(start).toBeGreaterThan(-1);
    for (const l of lines.slice(start + 2, start + 7)) {
      const cells = l.split('|').map((c) => c.trim());
      const part = cells[1] as keyof typeof ALIGNMENT_TRAITS;
      expect(ALIGNMENT_TRAITS[part].join(' '), part).toBe(cells[3]);
    }
  });
});

describe('personality generator', () => {
  it('splits each alignment into the PHB table parts', () => {
    expect(alignmentParts('Lawful Good')).toEqual(['Lawful', 'Good']);
    expect(alignmentParts('Neutral Good')).toEqual(['Neutral', 'Good']);
    expect(alignmentParts('True Neutral')).toEqual(['Neutral']);
    expect(alignmentParts('Unaligned')).toEqual([]);
    expect(alignmentParts(undefined)).toEqual([]);
  });

  it('uses one trait from each half of the alignment and an ideal that fits it', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const text = generatePersonality(createSeededRng(seed), 'Lawful Evil');
      const [first, second] = text.split('. ')[0].split(' and ');
      expect(ALIGNMENT_TRAITS.Lawful).toContain(first);
      expect(ALIGNMENT_TRAITS.Evil.map((t) => t.toLowerCase())).toContain(second);
      const ideal = /Ideal: (.*?) Bond:/.exec(text)?.[1];
      expect([...IDEALS.Lawful, ...IDEALS.Evil]).toContain(ideal);
      expect(text).toMatch(/Bond: .+ Flaw: .+/);
    }
  });

  it('gives two different Neutral traits for True Neutral', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const [a, b] = generatePersonality(createSeededRng(seed), 'True Neutral').split('. ')[0].split(' and ');
      expect(ALIGNMENT_TRAITS.Neutral).toContain(a);
      expect(a.toLowerCase()).not.toBe(b);
    }
  });

  it('is deterministic for a seed and varied across seeds', () => {
    expect(generatePersonality(createSeededRng(7), 'Chaotic Good')).toBe(generatePersonality(createSeededRng(7), 'Chaotic Good'));
    const many = new Set(Array.from({ length: 50 }, (_, i) => generatePersonality(createSeededRng(i + 1))));
    expect(many.size).toBe(50);
  });
});

describe('random character completeness', () => {
  it('puts the background +2/+1 where the class needs it, and fills tools and languages', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const c = generateRandomCharacter(createSeededRng(seed));
      const classId = c.classes?.[0].id ?? '';
      const bg = BACKGROUND_LIST.find((b) => b.id === c.backgroundSelection?.id)!;
      const want = suggestedBackgroundIncrease(classId, bg.abilities)!;
      expect(c.backgroundSelection?.abilities).toEqual([
        { ability: want.plusTwo, amount: 2 },
        { ability: want.plusOne, amount: 1 },
      ]);
      expect(c.languages?.chosen).toHaveLength(2);
      expect(c.backgroundSelection?.toolProficiency, `${bg.id} tool`).toBeTruthy();
      if (c.species?.id === 'dwarf') expect(c.languages?.chosen).toContain('dwarvish');
      if (classId === 'rogue') expect(c.languages?.granted).toHaveLength(1);
      expect(alignmentParts(c.alignment).length === 0 || c.personality?.includes('Ideal:')).toBe(true);
    }
  });
});

describe('training and equipment explanations', () => {
  it('explains every armor training and weapon proficiency a class lists', () => {
    for (const cls of CLASS_LIST) {
      for (const entry of [...cls.armorTraining, ...cls.weaponProficiencies]) {
        expect(trainingTooltip(entry), `${cls.id}: ${entry}`).not.toBeNull();
      }
    }
    expect(trainingTooltip('Shields')?.sections[0].text).toContain('+2');
  });

  it("finds a pack's contents for its tooltip", () => {
    const item = entryItem("Explorer's Pack");
    expect(item?.catalogId).toBe('explorers-pack');
    expect(resolveItemTooltip(item!)?.sections.map((s) => s.text).join(' ')).toContain('Bedroll');
  });
});

describe('alignment list sanity', () => {
  it('every alignment the app offers splits into known parts or none', () => {
    for (const a of ALIGNMENTS) {
      for (const part of alignmentParts(a)) expect(ALIGNMENT_TRAITS[part]).toBeDefined();
    }
  });
});
