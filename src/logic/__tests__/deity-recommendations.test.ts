import { describe, it, expect } from 'vitest';
import {
  allDeityOptions,
  findDeityInfo,
  suggestDeities,
} from '../deity-recommendations';
import { CLASS_LIST } from '../../data/classes';

const evil = (name: string) => findDeityInfo(name)!.alignment!.endsWith('E');

describe('findDeityInfo', () => {
  it('merges the DMG entry with the reference lore', () => {
    const info = findDeityInfo('Cuthbert')!;
    expect(info.name).toBe('Cuthbert');
    expect(info.homePlane).toBe('Arcadia');
    expect(info.alignment).toBe('LN');
    expect(info.pantheon).toBe('greyhawk');
  });

  it('finds a god by its reference spelling and keeps the DMG name', () => {
    expect(findDeityInfo('st. cuthbert')?.name).toBe('Cuthbert');
    expect(findDeityInfo('Pelor')).toMatchObject({ name: 'Pelor', alignment: 'NG' });
  });

  it('finds gods from the other pantheons and leaves DMG-only gods without alignment', () => {
    expect(findDeityInfo('Mystra')).toMatchObject({ pantheon: 'forgotten-realms', alignment: 'NG' });
    expect(findDeityInfo('Rao')).toMatchObject({ name: 'Rao', homePlane: 'Mount Celestia' });
    expect(findDeityInfo('Rao')?.alignment).toBeUndefined();
    expect(findDeityInfo('My Homebrew God')).toBeUndefined();
    expect(findDeityInfo('')).toBeUndefined();
  });
});

describe('allDeityOptions', () => {
  it('lists each god once: 27 DMG gods plus the 83 reference gods the DMG does not list', () => {
    const options = allDeityOptions();
    expect(new Set(options.map((o) => o.name)).size).toBe(options.length);
    expect(options).toHaveLength(27 + 99 - 16);
    expect(options.some((o) => o.name === 'Cuthbert')).toBe(true);
    expect(options.some((o) => o.name === 'St. Cuthbert')).toBe(false);
    expect(options.some((o) => o.name === 'Mystra')).toBe(true);
  });
});

describe('suggestDeities', () => {
  it('suggests the dwarf god first for a lawful good dwarf Cleric', () => {
    const [first] = suggestDeities({ classId: 'cleric', speciesId: 'dwarf', alignment: 'Lawful Good' });
    expect(first.name).toBe('Moradin');
    expect(first.reasons.join(' ')).toMatch(/dwarves/);
    expect(first.reasons.join(' ')).toMatch(/matches your alignment/);
  });

  it('suggests Lolth first for a chaotic evil drow Rogue', () => {
    const [first] = suggestDeities({
      classId: 'rogue',
      speciesId: 'elf',
      speciesChoices: { elvenLineage: 'drow' },
      alignment: 'Chaotic Evil',
    });
    expect(first.name).toBe('Lolth');
  });

  it('does not offer drow gods to a non-drow elf', () => {
    const names = suggestDeities({
      classId: 'ranger',
      speciesId: 'elf',
      speciesChoices: { elvenLineage: 'woodElf' },
      alignment: 'Chaotic Good',
      limit: 50,
    }).map((s) => s.name);
    expect(names).not.toContain('Lolth');
    expect(names).toContain('Corellon Larethian');
  });

  it('matches a gold dragonborn Paladin to Bahamut', () => {
    const [first] = suggestDeities({
      classId: 'paladin',
      speciesId: 'dragonborn',
      speciesChoices: { draconicAncestry: 'gold' },
      alignment: 'Lawful Good',
    });
    expect(first.name).toBe('Bahamut');
    expect(first.reasons.join(' ')).toMatch(/gold draconic ancestry/);
  });

  it('never suggests an evil god to a character who is not evil', () => {
    for (const alignment of ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'True Neutral', 'Lawful Neutral', 'Chaotic Neutral', '', 'Unaligned']) {
      for (const cls of CLASS_LIST) {
        const out = suggestDeities({ classId: cls.id, speciesId: 'human', alignment, limit: 100 });
        for (const s of out) expect(evil(s.name), `${cls.id} ${alignment} ${s.name}`).toBe(false);
      }
    }
  });

  it('never suggests a good god to an evil character', () => {
    const out = suggestDeities({ classId: 'warlock', speciesId: 'human', alignment: 'Neutral Evil', limit: 100 });
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) expect(s.alignment.endsWith('G'), s.name).toBe(false);
  });

  it('limits suggestions to the chosen setting', () => {
    const out = suggestDeities({ classId: 'wizard', speciesId: 'human', alignment: 'Lawful Neutral', pantheon: 'dragonlance', limit: 50 });
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) expect(s.pantheon).toBe('dragonlance');
  });

  it('is deterministic and sorted by score then name', () => {
    const input = { classId: 'fighter', speciesId: 'human', alignment: 'Lawful Good', limit: 20 };
    const a = suggestDeities(input);
    expect(suggestDeities(input)).toEqual(a);
    for (let i = 1; i < a.length; i++) {
      expect(a[i - 1].score >= a[i].score).toBe(true);
    }
  });

  it('every class and species combination returns a list without throwing', () => {
    for (const cls of CLASS_LIST) {
      for (const sp of ['aasimar', 'dragonborn', 'dwarf', 'elf', 'gnome', 'goliath', 'halfling', 'human', 'orc', 'tiefling']) {
        expect(Array.isArray(suggestDeities({ classId: cls.id, speciesId: sp, alignment: 'Neutral Good' }))).toBe(true);
      }
    }
  });
});
