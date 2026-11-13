import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALIGNMENTS } from '../../types/character';
import { CLASS_LIST } from '../../data/classes';
import { BACKGROUND_LIST } from '../../data/backgrounds';
import { ALIGNMENT_TRAITS, FLAWS, IDEALS, QUIRKS } from '../../data/personality-tables';
import * as GENERIC from '../../data/description-tables';
import { CLASS_DESCRIPTION_TABLES } from '../../data/description-class-tables';
import { SPECIES_DESCRIPTION_TABLES } from '../../data/description-species-tables';
import { SPECIES_LIST } from '../../data/species';
import { createCharacter } from '../../storage/character-store';
import { alignmentParts, generateRandomCharacter } from '../personal-details-generation';
import {
  descriptionCombinations,
  descriptionContextFor,
  generateDescription,
  generateIdeal,
  generateProfile,
} from '../character-description';
import { createSeededRng } from '../random';
import { trainingTooltip, suggestedBackgroundIncrease } from '../creation-guidance';
import { entryItem } from '../starting-equipment';
import { resolveItemTooltip } from '../tooltip-content';

const PHB = resolve(__dirname, '../../../Docs/PlayersHandbook.md');

/** Every string pool the description generator draws from, with a label. */
function allPools(): [string, readonly string[]][] {
  const pools: [string, readonly string[]][] = [
    ['QUIRKS', QUIRKS],
    ['FLAWS', FLAWS],
    ['GENERIC_OPENERS', GENERIC.GENERIC_OPENERS],
    ['DEMEANOR_TEMPLATES', GENERIC.DEMEANOR_TEMPLATES],
    ['GENERIC_PASTS', GENERIC.GENERIC_PASTS],
    ['MANNERS', GENERIC.MANNERS],
    ['MORE_FLAWS', GENERIC.MORE_FLAWS],
    ['SHORT_TERM_GOALS', GENERIC.SHORT_TERM_GOALS],
    ['LONG_TERM_GOALS', GENERIC.LONG_TERM_GOALS],
  ];
  for (const [k, v] of Object.entries(IDEALS)) pools.push([`IDEALS.${k}`, v]);
  for (const rec of ['ALIGNMENT_COLOR', 'MORE_IDEALS', 'ALIGNMENT_FLAWS', 'ALIGNMENT_LONG_TERM_GOALS'] as const) {
    for (const [k, v] of Object.entries(GENERIC[rec])) pools.push([`${rec}.${k}`, v]);
  }
  for (const [cls, t] of Object.entries(CLASS_DESCRIPTION_TABLES)) {
    for (const [k, v] of Object.entries(t)) pools.push([`${cls}.${k}`, v as readonly string[]]);
  }
  for (const [sp, t] of Object.entries(SPECIES_DESCRIPTION_TABLES)) {
    for (const [k, v] of Object.entries(t)) {
      if (k === 'lineages') {
        for (const [l, lines] of Object.entries(v as Record<string, readonly string[]>)) pools.push([`${sp}.lineage.${l}`, lines]);
      } else pools.push([`${sp}.${k}`, v as readonly string[]]);
    }
  }
  return pools;
}

/** Fill tokens the way a neutral-gender character named Mira would get them. */
const fillMira = (s: string) =>
  s.replaceAll('{N}', 'Mira').replaceAll('{Their}', 'Their').replaceAll('{their}', 'their').replaceAll('{themself}', 'themself').replaceAll('{them}', 'them');

describe('species in character descriptions', () => {
  it('gives every species its own heritages, pasts, manners and goals', () => {
    for (const sp of SPECIES_LIST) {
      const t = SPECIES_DESCRIPTION_TABLES[sp.id as keyof typeof SPECIES_DESCRIPTION_TABLES];
      expect(t, sp.id).toBeDefined();
      expect(t.heritages.length, sp.id).toBeGreaterThanOrEqual(10);
      expect(t.pasts.length, sp.id).toBeGreaterThanOrEqual(5);
      expect(t.manners.length, sp.id).toBeGreaterThanOrEqual(5);
      expect(t.shortTermGoals.length, sp.id).toBeGreaterThanOrEqual(4);
      expect(t.longTermGoals.length, sp.id).toBeGreaterThanOrEqual(5);
    }
  });

  it('has lines for every lineage, ancestry and legacy the species catalog offers', () => {
    const lineageKinds = ['draconicAncestry', 'elvenLineage', 'gnomishLineage', 'giantAncestry', 'fiendishLegacy'];
    for (const sp of SPECIES_LIST) {
      for (const choice of sp.choices ?? []) {
        if (!lineageKinds.includes(choice.kind)) continue;
        for (const option of choice.options) {
          const lines = SPECIES_DESCRIPTION_TABLES[sp.id as keyof typeof SPECIES_DESCRIPTION_TABLES].lineages?.[option.id];
          expect(lines?.length ?? 0, `${sp.id} ${option.id}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('puts a heritage line for the species into every description, and the lineage across rolls', () => {
    for (const sp of SPECIES_LIST) {
      const t = SPECIES_DESCRIPTION_TABLES[sp.id as keyof typeof SPECIES_DESCRIPTION_TABLES];
      const lineageId = t.lineages ? Object.keys(t.lineages)[0] : undefined;
      const heritageLines = t.heritages.map(fillMira);
      const lineageLines = lineageId ? (t.lineages?.[lineageId] ?? []).map(fillMira) : [];
      let sawLineage = false;
      for (let seed = 1; seed <= 40; seed++) {
        const d = generateDescription(createSeededRng(seed), { name: 'Mira', gender: 'neutral', speciesId: sp.id, lineage: lineageId });
        const has = (lines: string[]) => lines.some((l) => d.includes(l.slice(5, 45)));
        expect(has(heritageLines) || has(lineageLines), `${sp.id}: ${d}`).toBe(true);
        if (has(lineageLines)) sawLineage = true;
      }
      if (lineageId) expect(sawLineage, sp.id).toBe(true);
    }
  });

  it('uses the lineage of a saved character', () => {
    const c = { ...createCharacter('Mira'), species: { id: 'elf' as const, elvenLineage: 'woodElf' as const } };
    expect(descriptionContextFor(c, 'ranger')).toMatchObject({ speciesId: 'elf', lineage: 'woodElf', classId: 'ranger' });
  });
});

const ALIGNMENT_OPTIONS = [...ALIGNMENTS, undefined];
const GENDERS = ['male', 'female', 'neutral'] as const;

describe('character description tables', () => {
  it('are large and free of duplicates', () => {
    expect(QUIRKS.length).toBeGreaterThanOrEqual(100);
    expect(FLAWS.length + GENERIC.MORE_FLAWS.length).toBeGreaterThanOrEqual(100);
    expect(GENERIC.GENERIC_PASTS.length).toBeGreaterThanOrEqual(50);
    expect(GENERIC.MANNERS.length).toBeGreaterThanOrEqual(40);
    expect(GENERIC.DEMEANOR_TEMPLATES.length).toBeGreaterThanOrEqual(20);
    expect(GENERIC.SHORT_TERM_GOALS.length).toBeGreaterThanOrEqual(50);
    expect(GENERIC.LONG_TERM_GOALS.length).toBeGreaterThanOrEqual(50);
    for (const [label, list] of allPools()) expect(new Set(list).size, label).toBe(list.length);
    for (const part of Object.keys(IDEALS) as (keyof typeof IDEALS)[]) {
      expect(IDEALS[part].length + GENERIC.MORE_IDEALS[part].length, part).toBeGreaterThanOrEqual(25);
    }
  });

  it('give every class its own openers, pasts, ideals, flaws and goals', () => {
    for (const cls of CLASS_LIST) {
      const t = CLASS_DESCRIPTION_TABLES[cls.id as keyof typeof CLASS_DESCRIPTION_TABLES];
      expect(t, cls.id).toBeDefined();
      expect(t.openers.length, cls.id).toBeGreaterThanOrEqual(10);
      expect(t.pasts.length, cls.id).toBeGreaterThanOrEqual(6);
      expect(t.ideals.length, cls.id).toBeGreaterThanOrEqual(6);
      expect(t.flaws.length, cls.id).toBeGreaterThanOrEqual(5);
      expect(t.shortTermGoals.length, cls.id).toBeGreaterThanOrEqual(8);
      expect(t.longTermGoals.length, cls.id).toBeGreaterThanOrEqual(8);
    }
  });

  it('only use the tokens the generator fills in', () => {
    const allowed = new Set(['N', 'their', 'Their', 'them', 'themself', 't1', 't2', 'T1']);
    for (const [label, list] of allPools()) {
      for (const s of list) {
        for (const m of s.matchAll(/\{(\w+)\}/g)) expect(allowed.has(m[1]), `${label}: ${s}`).toBe(true);
      }
    }
    // Only the demeanor templates may use the trait tokens.
    for (const [label, list] of allPools().filter(([l]) => l !== 'DEMEANOR_TEMPLATES')) {
      for (const s of list) expect(/\{[tT][12]\}/.test(s), `${label}: ${s}`).toBe(false);
    }
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

describe('character description generator', () => {
  it('splits each alignment into the PHB table parts', () => {
    expect(alignmentParts('Lawful Good')).toEqual(['Lawful', 'Good']);
    expect(alignmentParts('Neutral Good')).toEqual(['Neutral', 'Good']);
    expect(alignmentParts('True Neutral')).toEqual(['Neutral']);
    expect(alignmentParts('Unaligned')).toEqual([]);
    expect(alignmentParts(undefined)).toEqual([]);
  });

  it('leaves no token unfilled for any class, alignment or gender, and names the character', () => {
    let seed = 1;
    for (const cls of [...CLASS_LIST.map((c) => c.id), undefined]) {
      for (const alignment of ALIGNMENT_OPTIONS) {
        for (const gender of GENDERS) {
          const p = generateProfile(createSeededRng(seed++), { name: 'Mira', gender, classId: cls, alignment });
          for (const v of Object.values(p)) {
            expect(v, `${cls} ${alignment} ${gender}`).not.toMatch(/[{}]/);
            expect(v.length).toBeGreaterThan(10);
            expect(v.charAt(0)).toBe(v.charAt(0).toUpperCase());
          }
          expect(p.description.startsWith('Mira ')).toBe(true);
        }
      }
    }
    // Without a name the fallback still reads as a sentence.
    const unnamed = generateDescription(createSeededRng(3), { classId: 'wizard' });
    expect(unnamed.startsWith('This adventurer ')).toBe(true);
  });

  it('opens with a sentence for the character\u2019s class', () => {
    for (const cls of CLASS_LIST) {
      // Compare up to a second mention of the name (which becomes a pronoun).
      const openers = CLASS_DESCRIPTION_TABLES[cls.id as keyof typeof CLASS_DESCRIPTION_TABLES].openers.map((o) => {
        const second = o.indexOf('{N}', 1);
        return (second === -1 ? o : o.slice(0, second))
          .replaceAll('{N}', 'Mira')
          .replaceAll('{their}', 'their')
          .replaceAll('{them}', 'them')
          .replaceAll('{themself}', 'themself');
      });
      for (let seed = 1; seed <= 10; seed++) {
        const d = generateDescription(createSeededRng(seed), { name: 'Mira', gender: 'neutral', classId: cls.id, alignment: 'Lawful Good' });
        expect(openers.some((o) => d.startsWith(o)), `${cls.id}: ${d}`).toBe(true);
      }
    }
  });

  it('uses the right pronouns', () => {
    const many = (gender: 'male' | 'female') =>
      Array.from({ length: 200 }, (_, i) => generateDescription(createSeededRng(i + 1), { name: 'Ash', gender, classId: 'rogue' })).join(' ');
    expect(many('male')).toMatch(/\b(his|him|himself|His)\b/);
    expect(many('male')).not.toMatch(/\b(her|herself|Her)\b/);
    expect(many('female')).toMatch(/\b(her|herself|Her)\b/);
    expect(many('female')).not.toMatch(/\b(him|himself|His)\b/);
  });

  it('takes ideals from the alignment or the class', () => {
    const fill = (s: string) => s.replaceAll('{N}', 'Mira').replaceAll('{their}', 'their').replaceAll('{them}', 'them').replaceAll('{themself}', 'themself');
    const allowed = new Set(
      [...IDEALS.Lawful, ...IDEALS.Evil, ...GENERIC.MORE_IDEALS.Lawful, ...GENERIC.MORE_IDEALS.Evil, ...CLASS_DESCRIPTION_TABLES.warlock.ideals].map(fill),
    );
    for (let seed = 1; seed <= 200; seed++) {
      const ideal = generateIdeal(createSeededRng(seed), { name: 'Mira', classId: 'warlock', alignment: 'Lawful Evil' });
      expect(allowed.has(ideal), ideal).toBe(true);
    }
  });

  it('weaves two alignment traits into the description', () => {
    const lower = (xs: readonly string[]) => xs.map((x) => x.toLowerCase());
    for (let seed = 1; seed <= 50; seed++) {
      const d = generateDescription(createSeededRng(seed), { name: 'Mira', classId: 'fighter', alignment: 'Chaotic Evil' }).toLowerCase();
      expect(lower(ALIGNMENT_TRAITS.Chaotic).some((t) => d.includes(t)), d).toBe(true);
      expect(lower(ALIGNMENT_TRAITS.Evil).some((t) => d.includes(t)), d).toBe(true);
    }
  });

  it('has trillions of combinations for every class and alignment', () => {
    for (const cls of [...CLASS_LIST.map((c) => c.id), undefined]) {
      for (const alignment of ALIGNMENT_OPTIONS) {
        expect(descriptionCombinations({ classId: cls, alignment }) > 10n ** 15n, `${cls} ${alignment}`).toBe(true);
      }
    }
  });

  it('never repeats across 5,000 characters of the same class, alignment and name', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 5000; seed++) {
      const p = generateProfile(createSeededRng(seed), { name: 'Mira', gender: 'female', classId: 'paladin', alignment: 'Lawful Good' });
      seen.add(p.description);
    }
    expect(seen.size).toBe(5000);
  });

  it('is deterministic for a seed', () => {
    const ctx = { name: 'Mira', classId: 'bard', alignment: 'Chaotic Good' };
    expect(generateProfile(createSeededRng(7), ctx)).toEqual(generateProfile(createSeededRng(7), ctx));
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
      // Description, ideal, flaw and both goals are all filled in.
      for (const field of ['personality', 'ideal', 'flaw', 'shortTermGoal', 'longTermGoal'] as const) {
        expect(c[field], `${seed} ${field}`).toBeTruthy();
      }
      expect(c.personality?.startsWith(c.name)).toBe(true);
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
