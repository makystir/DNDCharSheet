import { describe, it, expect } from 'vitest';
import { ALIGNMENTS } from '../../types/character';
import { CLASS_LIST } from '../../data/classes';
import { SHOP_TYPES } from '../../data/dm-flavor-tables';
import { createSeededRng } from '../random';
import { createCampaign, emptyDmData } from '../dm-campaign';
import { backlinks, outgoingLinks, resolveLink } from '../dm-journal';
import {
  firstName,
  generateNpc,
  generateShopName,
  generateTavernName,
  npcHeadline,
  npcJournalBody,
  npcSpecies,
  prettyLineage,
  rerollNpcPart,
  saveNpcToJournal,
  savePlaceWithOwner,
  type GeneratedNpc,
} from '../dm-generators';

const rng = (seed: number) => createSeededRng(seed);
const GENDERS = ['male', 'female', 'neutral'] as const;

function everyText(npc: GeneratedNpc): string[] {
  const a = npc.appearance;
  return [npc.name, npc.age, a.eyes, a.hair, a.skin, a.height, a.weight, npc.description, npc.ideal, npc.flaw, npc.shortTermGoal, npc.longTermGoal];
}

describe('quick NPC', () => {
  it('is repeatable under a seed and differs between seeds', () => {
    expect(generateNpc(rng(5))).toEqual(generateNpc(rng(5)));
    const names = new Set(Array.from({ length: 30 }, (_, i) => generateNpc(rng(i + 1)).name));
    expect(names.size).toBeGreaterThan(10);
  });

  it('keeps what the DM chose and fills in the rest', () => {
    const npc = generateNpc(rng(2), { species: 'dwarf', gender: 'female', alignment: 'Lawful Good', classId: 'cleric', role: '  Blacksmith ' });
    expect(npc).toMatchObject({ species: 'dwarf', speciesName: 'Dwarf', gender: 'female', alignment: 'Lawful Good', classId: 'cleric', role: 'Blacksmith' });
    expect(npc.name.length).toBeGreaterThan(0);
    expect(generateNpc(rng(2), { name: ' Vip ' }).name).toBe('Vip');
  });

  it('works for every species, gender and class flavor with no unfinished text', () => {
    for (const species of npcSpecies()) {
      for (const gender of GENDERS) {
        for (let seed = 1; seed <= 4; seed++) {
          const npc = generateNpc(rng(seed), { species, gender, classId: CLASS_LIST[seed % CLASS_LIST.length].id });
          for (const text of everyText(npc)) {
            expect(text.trim().length, `${species}/${gender}`).toBeGreaterThan(0);
            expect(text, `${species}/${gender}: ${text}`).not.toMatch(/[{}]|undefined|NaN/);
            expect(text.includes('\u0002') || text.includes('\u0003')).toBe(false);
          }
          expect(npc.description).toContain(npc.name);
        }
      }
    }
  });

  it('covers every species the description generator has tables for', () => {
    expect(npcSpecies()).toHaveLength(10);
    expect(npcSpecies()).toContain('human');
  });

  it('gives an ancestry to the species that have one, and keeps it when a part is rolled again', () => {
    const elf = generateNpc(rng(3), { species: 'elf' });
    expect(elf.lineageId).toBeDefined();
    expect(elf.lineage).toBe(prettyLineage(elf.lineageId as string));
    const again = rerollNpcPart(rng(9), elf, 'description');
    expect(again.lineageId).toBe(elf.lineageId);
    const human = generateNpc(rng(3), { species: 'human' });
    expect(human.lineage === undefined || typeof human.lineage === 'string').toBe(true);
  });

  it('writes a heading from species, ancestry and role', () => {
    const npc = generateNpc(rng(1), { species: 'dwarf', role: 'Blacksmith', name: 'Brenna' });
    expect(npcHeadline({ ...npc, lineage: undefined })).toBe('Brenna, dwarf blacksmith');
    expect(npcHeadline({ ...npc, lineage: 'Wood Elf', speciesName: 'Elf', role: '' })).toBe('Brenna, wood elf');
    expect(npcHeadline({ ...npc, lineage: 'Red', speciesName: 'Dragonborn', role: 'guard' })).toBe('Brenna, red dragonborn guard');
  });
});

describe('rolling one part again', () => {
  const base = generateNpc(rng(7), { species: 'human', gender: 'male', alignment: 'Neutral Good', classId: 'rogue', role: 'ferryman' });

  it('changes only that part', () => {
    const same = (a: GeneratedNpc, b: GeneratedNpc, keys: (keyof GeneratedNpc)[]) => keys.forEach((k) => expect(a[k]).toEqual(b[k]));
    const ideal = rerollNpcPart(rng(100), base, 'ideal');
    same(ideal, base, ['name', 'age', 'appearance', 'description', 'flaw', 'shortTermGoal', 'longTermGoal', 'species', 'alignment', 'role']);
    const flaw = rerollNpcPart(rng(101), base, 'flaw');
    same(flaw, base, ['name', 'ideal', 'description', 'appearance']);
    const goals = rerollNpcPart(rng(102), base, 'goals');
    same(goals, base, ['name', 'ideal', 'flaw', 'description']);
    const look = rerollNpcPart(rng(103), base, 'look');
    same(look, base, ['name', 'ideal', 'flaw', 'description', 'shortTermGoal']);
  });

  it('writes the new name into the description when the name is rolled again', () => {
    const named = rerollNpcPart(rng(55), base, 'name');
    expect(named.name).not.toBe(base.name);
    expect(named.description).toContain(named.name);
    expect(named.description).not.toContain(base.name);
    expect(named.ideal).toBe(base.ideal);
  });

  it('keeps the same species and gender', () => {
    for (const part of ['name', 'look', 'description', 'ideal', 'flaw', 'goals'] as const) {
      const next = rerollNpcPart(rng(8), base, part);
      expect(next).toMatchObject({ species: 'human', gender: 'male', alignment: 'Neutral Good', classId: 'rogue' });
    }
  });
});

describe('journal text', () => {
  it('reads as plain lines and creates no links by accident', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const body = npcJournalBody(generateNpc(rng(seed), { role: 'cook' }));
      expect(body).not.toMatch(/\[\[|\]\]/);
      expect(body).toMatch(/Ideal: /);
      expect(body).toMatch(/Long-term goal: /);
      expect(body.split('\n')[0]).toMatch(/age \d+/);
    }
  });

  it('adds an extra line under the first one', () => {
    expect(npcJournalBody(generateNpc(rng(1)), 'Owns [[X]].').split('\n')[1]).toBe('Owns [[X]].');
  });
});

describe('tavern and shop names', () => {
  it('makes "The ..." tavern names in several shapes', () => {
    const names = Array.from({ length: 60 }, (_, i) => generateTavernName(rng(i + 1)));
    for (const n of names) {
      expect(n).toMatch(/^The [A-Z]/);
      expect(n).not.toMatch(/undefined/);
    }
    expect(new Set(names).size).toBeGreaterThan(30);
    expect(names.some((n) => n.includes(' and '))).toBe(true);
    expect(names.some((n) => n.includes(' & '))).toBe(true);
    for (const n of names.filter((x) => x.includes(' & '))) {
      const [a, b] = n.replace('The ', '').split(' & ');
      expect(a).not.toBe(b);
    }
  });

  it('names a shop for its trade, and uses the owner only when given one', () => {
    for (const type of SHOP_TYPES) {
      const without = Array.from({ length: 20 }, (_, i) => generateShopName(rng(i + 1), type.id));
      for (const n of without) {
        expect(n).toMatch(/^The /);
        expect(n).not.toContain("'s");
        expect([...type.nouns, ...type.words].some((w) => n.includes(w))).toBe(true);
      }
      const withOwner = Array.from({ length: 40 }, (_, i) => generateShopName(rng(i + 1), type.id, 'Mira'));
      expect(withOwner.some((n) => n.startsWith("Mira's "))).toBe(true);
    }
  });

  it('falls back to the first trade for an unknown one', () => {
    expect(generateShopName(rng(1), 'nonsense')).toMatch(/^The /);
  });

  it('takes the first word of a name', () => {
    expect(firstName('Mira Vance')).toBe('Mira');
    expect(firstName('  Vip ')).toBe('Vip');
  });
});

describe('saving to the journal', () => {
  const base = () => createCampaign(emptyDmData(), { id: 'c', name: 'T', now: 1 });

  it('saves an NPC with a unique title', () => {
    const npc = generateNpc(rng(1), { name: 'Mira' });
    const a = saveNpcToJournal(base(), 'c', npc, { npc: 'n1' }, 5);
    const b = saveNpcToJournal(a.data, 'c', npc, { npc: 'n2' }, 6);
    expect(a.title).toBe('Mira');
    expect(b.title).toBe('Mira 2');
    expect(b.data.campaigns[0].journal.map((n) => n.kind)).toEqual(['npc', 'npc']);
    expect(b.data.campaigns[0].journal[0].body).toContain('Ideal: ');
  });

  it('saves a place and its owner as two entries that link to each other', () => {
    const owner = generateNpc(rng(4), { name: 'Brenna', role: 'innkeeper' });
    const r = savePlaceWithOwner(base(), 'c', { kind: 'tavern', name: 'The Gilded Lantern' }, owner, { place: 'p', owner: 'o' }, 9);
    const journal = r.data.campaigns[0].journal;
    expect(journal).toHaveLength(2);
    const place = journal.find((n) => n.id === 'p')!;
    const person = journal.find((n) => n.id === 'o')!;
    expect(place).toMatchObject({ kind: 'location', title: 'The Gilded Lantern' });
    expect(person).toMatchObject({ kind: 'npc', title: 'Brenna' });
    expect(resolveLink(journal, outgoingLinks(place)[0])?.id).toBe('o');
    expect(resolveLink(journal, outgoingLinks(person)[0])?.id).toBe('p');
    expect(backlinks(journal, place).map((n) => n.id)).toEqual(['o']);
    expect(backlinks(journal, person).map((n) => n.id)).toEqual(['p']);
  });

  it('keeps the links right when the titles are already taken', () => {
    const owner = generateNpc(rng(4), { name: 'Brenna' });
    const place = { kind: 'shop' as const, name: "Brenna's Smithy", trade: 'Blacksmith' };
    const first = savePlaceWithOwner(base(), 'c', place, owner, { place: 'p1', owner: 'o1' }, 9);
    const second = savePlaceWithOwner(first.data, 'c', place, owner, { place: 'p2', owner: 'o2' }, 10);
    const journal = second.data.campaigns[0].journal;
    expect(new Set(journal.map((n) => n.title.toLowerCase())).size).toBe(4);
    const p2 = journal.find((n) => n.id === 'p2')!;
    const o2 = journal.find((n) => n.id === 'o2')!;
    expect(resolveLink(journal, outgoingLinks(p2)[0])?.id).toBe('o2');
    expect(resolveLink(journal, outgoingLinks(o2)[0])?.id).toBe('p2');
    expect(p2.body).toContain('blacksmith shop');
  });

  it('can give every alignment', () => {
    const seen = new Set(Array.from({ length: 80 }, (_, i) => generateNpc(rng(i + 1)).alignment));
    expect(seen.size).toBeGreaterThan(5);
    for (const a of seen) expect(ALIGNMENTS).toContain(a);
  });
});
