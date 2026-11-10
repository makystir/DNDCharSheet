import { describe, it, expect } from 'vitest';
import {
  ALIGNMENT_CODE_LABEL,
  DEITY_REFERENCE,
  PANTHEON_LABELS,
} from '../deity-reference';
import type { DeityPantheon } from '../deity-reference';
import { DEITY_LIST } from '../deities';

const DOMAINS = ['Death', 'Knowledge', 'Life', 'Light', 'Nature', 'Tempest', 'Trickery', 'War'];

describe('DEITY_REFERENCE', () => {
  it('has the pantheon sizes of the supplied reference (99 gods)', () => {
    const count = (p: DeityPantheon) => DEITY_REFERENCE.filter((d) => d.pantheon === p).length;
    // Realms: 26 greater + 21 lesser + 4 elemental lords. Greyhawk 16. Racial and dragon 11.
    // Dragonlance: 7 good + 7 neutral + 7 evil.
    expect(count('forgotten-realms')).toBe(51);
    expect(count('greyhawk')).toBe(16);
    expect(count('racial')).toBe(11);
    expect(count('dragonlance')).toBe(21);
    expect(DEITY_REFERENCE).toHaveLength(99);
  });

  it('has unique ids and names and only valid alignments and domains', () => {
    expect(new Set(DEITY_REFERENCE.map((d) => d.id)).size).toBe(99);
    expect(new Set(DEITY_REFERENCE.map((d) => d.name)).size).toBe(99);
    for (const d of DEITY_REFERENCE) {
      expect(ALIGNMENT_CODE_LABEL[d.alignment], d.name).toBeDefined();
      expect(PANTHEON_LABELS[d.pantheon]).toBeDefined();
      for (const dm of d.domains) expect(DOMAINS, d.name).toContain(dm);
      expect(d.title.length, d.name).toBeGreaterThan(0);
      expect(d.description.length, d.name).toBeGreaterThan(0);
    }
  });

  it('pins alignments and domains from the printed tables', () => {
    const by = (n: string) => DEITY_REFERENCE.find((d) => d.name === n)!;
    expect(by('Mystra')).toMatchObject({ alignment: 'NG', domains: ['Knowledge'] });
    expect(by('Sel\u00fbne')).toMatchObject({ alignment: 'CG', domains: ['Knowledge', 'Life'] });
    expect(by('Bane').alignment).toBe('LE');
    expect(by('Tempus').alignment).toBe('N');
    expect(by('Wee Jas')).toMatchObject({ alignment: 'LN', domains: ['Death', 'Knowledge'] });
    expect(by('Lolth')).toMatchObject({ alignment: 'CE', domains: ['Trickery'] });
    expect(by('Bahamut')).toMatchObject({ alignment: 'LG', domains: ['Life', 'War'] });
    expect(by('Ubtao').domains).toEqual(['Knowledge', 'Life', 'Nature']);
    expect(by('Nuitari').domains).toEqual([]);
    expect(by('Morgion').alignment).toBe('NE');
  });

  it('every Greyhawk reference god is also in the 2024 DMG catalog', () => {
    const dmg = new Set(DEITY_LIST.map((d) => d.name.toLowerCase()));
    for (const d of DEITY_REFERENCE.filter((x) => x.pantheon === 'greyhawk')) {
      const name = d.name === 'St. Cuthbert' ? 'cuthbert' : d.name.toLowerCase();
      expect(dmg.has(name), d.name).toBe(true);
    }
  });
});
