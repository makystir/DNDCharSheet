import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALIGNMENTS } from '../../types/character';
import { CLASS_LIST } from '../../data/classes';
import { SPECIES_LIST } from '../../data/species';
import {
  ALIGNMENT_INFO,
  CLASS_OVERVIEW,
  SPECIES_INFO,
  isEvilAlignment,
  lowComplexityClasses,
  skillsUsingPrimaryAbility,
  speciesLanguageSuggestions,
  suggestedBackgroundIncrease,
  suggestedSpeciesSpellAbility,
  toolChoicesFor,
} from '../creation-guidance';

const PHB = resolve(__dirname, '../../../Docs/PlayersHandbook.md');
const phbLines = existsSync(PHB) ? readFileSync(PHB, 'utf8').split(/\r?\n/) : [];
/** 1-based PHB line, as cited (L1234). */
const line = (n: number) => phbLines[n - 1] ?? '';
const citedLine = (source: string) => Number(/\(L(\d+)/.exec(source)?.[1]);

describe('class overview (PHB 2024 "Class Overview" table)', () => {
  it('has a row for every class', () => {
    expect(Object.keys(CLASS_OVERVIEW).sort()).toEqual(CLASS_LIST.map((c) => c.id).sort());
  });

  it.skipIf(!existsSync(PHB))('matches every row of the PHB table', () => {
    const start = phbLines.findIndex((l) => /^\| Class\s+\| Likes/.test(l));
    expect(start).toBeGreaterThan(-1);
    const rows = new Map<string, { likes: string; complexity: string }>();
    for (const l of phbLines.slice(start + 2, start + 14)) {
      const cells = l.split('|').map((c) => c.trim());
      rows.set(cells[1].toLowerCase(), { likes: cells[2], complexity: cells[4] });
    }
    for (const [id, row] of Object.entries(CLASS_OVERVIEW)) {
      expect(rows.get(id), id).toEqual(row);
    }
  });

  it('names Fighter and Rogue as the Low-complexity classes', () => {
    expect(lowComplexityClasses()).toEqual(['fighter', 'rogue']);
  });
});

describe('species summaries', () => {
  it('cover every species', () => {
    expect(Object.keys(SPECIES_INFO).sort()).toEqual(SPECIES_LIST.map((s) => s.id).sort());
  });

  it.skipIf(!existsSync(PHB))("cite the line of that species' PHB introduction", () => {
    for (const s of SPECIES_LIST) {
      const n = citedLine(SPECIES_INFO[s.id].source);
      // The introduction sits just below the species heading.
      const above = [1, 2, 3, 4].map((k) => line(n - k));
      expect(above, s.id).toContain(`## ${s.name.toUpperCase()}`);
      // ...and is a paragraph naming the species (allowing for the scan's blank-line drift).
      const intro = [n - 1, n, n + 1, n + 2].map(line).find((l) => l.length > 40) ?? '';
      // Stem match so plurals count (dwarf / dwarves, elf / elves).
      expect(intro.toLowerCase(), s.id).toContain(s.name.toLowerCase().slice(0, -1));
    }
  });
});

describe('alignment summaries', () => {
  it('cover every alignment the app offers', () => {
    for (const a of ALIGNMENTS) expect(ALIGNMENT_INFO[a], a).toBeDefined();
  });

  it.skipIf(!existsSync(PHB))('cite the PHB line describing that alignment', () => {
    for (const a of ALIGNMENTS) {
      const text = line(citedLine(ALIGNMENT_INFO[a].source));
      if (a === 'Unaligned') expect(text).toMatch(/lack the capacity for rational thought/);
      else if (a === 'True Neutral') expect(text).toMatch(/^Neutral \(N\)\./);
      else expect(text.startsWith(`${a} (`), a).toBe(true);
    }
  });

  it('flags only the three evil alignments', () => {
    expect(ALIGNMENTS.filter(isEvilAlignment)).toEqual(['Lawful Evil', 'Neutral Evil', 'Chaotic Evil']);
  });
});

describe('suggestions', () => {
  it('puts +2 and +1 on the background abilities the class ranks highest', () => {
    // Fighter Standard Array: Str 15, Dex 14, Con 13 (PHB "Standard Array by Class", L1709).
    expect(suggestedBackgroundIncrease('fighter', ['str', 'dex', 'con'])).toEqual({ plusTwo: 'str', plusOne: 'dex' });
    // Wizard: Int 15 first.
    expect(suggestedBackgroundIncrease('wizard', ['str', 'dex', 'int'])).toEqual({ plusTwo: 'int', plusOne: 'dex' });
    expect(suggestedBackgroundIncrease(undefined, ['str', 'dex', 'con'])).toBeNull();
  });

  it("suggests the class's spellcasting ability for a species spell trait", () => {
    expect(suggestedSpeciesSpellAbility('wizard', ['int', 'wis', 'cha'])).toEqual({ ability: 'int', reason: 'class-spellcasting' });
    expect(suggestedSpeciesSpellAbility('cleric', ['int', 'wis', 'cha'])).toEqual({ ability: 'wis', reason: 'class-spellcasting' });
    // A non-caster gets the option it scores highest in.
    const fighter = suggestedSpeciesSpellAbility('fighter', ['int', 'wis', 'cha']);
    expect(fighter?.reason).toBe('highest-score');
    expect(suggestedSpeciesSpellAbility('', ['int'])).toBeNull();
  });

  it('suggests the standard language of a species\' own people', () => {
    expect(speciesLanguageSuggestions('dwarf')).toEqual(['dwarvish']);
    expect(speciesLanguageSuggestions('elf')).toEqual(['elvish']);
    expect(speciesLanguageSuggestions('human')).toEqual([]);
    expect(speciesLanguageSuggestions(undefined)).toEqual([]);
  });

  it('finds the class skills that use a primary ability', () => {
    // Rogue: Dexterity.
    expect(skillsUsingPrimaryAbility('rogue', ['acrobatics', 'athletics', 'stealth', 'sleightOfHand'])).toEqual([
      'acrobatics',
      'stealth',
      'sleightOfHand',
    ]);
    expect(skillsUsingPrimaryAbility('nope', ['acrobatics'])).toEqual([]);
  });
});

describe('tool choices', () => {
  it('lists the four PHB Gaming Set variants', () => {
    expect(toolChoicesFor('gaming-set').map((t) => t.name)).toEqual([
      'Dice Set',
      'Dragonchess Set',
      'Playing Cards',
      'Three-Dragon Ante Set',
    ]);
  });

  it("lists all 17 Artisan's Tools and the 10 Musical Instruments, with what each does", () => {
    const artisan = toolChoicesFor('artisans-tools');
    expect(artisan).toHaveLength(17);
    expect(artisan.every((t) => t.description?.startsWith("Artisan's Tools"))).toBe(true);
    expect(toolChoicesFor('musical-instrument')).toHaveLength(10);
  });
});
