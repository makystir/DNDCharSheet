import { describe, it, expect } from 'vitest';
import type { RNG } from '../random';
import { generateRandomCharacter } from '../personal-details-generation';
import { getSpell } from '../../data/spells';
import type { ClassId } from '../../data/classes';
import { pendingSetupChoices } from '../starting-choices';
import { pickStartingSpells, startingSpellPools } from '../starting-spells';
import { STARTING_CHOICES } from './starting-choices-golden';

/** Small deterministic RNG (mulberry32). */
function seededRng(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROWS = STARTING_CHOICES.map((r) => [r.classId, r] as const);

describe('generateRandomCharacter: starting spells', () => {
  it.each(ROWS)('%s picks the starting-choices counts from its own list', (classId, row) => {
    for (let seed = 1; seed <= 15; seed++) {
      const c = generateRandomCharacter(seededRng(seed), { classId: classId as ClassId });
      const stored = c.spellcasting?.byClass?.[classId as ClassId];
      if (row.spells === null) {
        expect(c.spellcasting).toBeUndefined();
        continue;
      }
      expect(stored).toBeDefined();
      const cantrips = stored?.cantrips ?? [];
      const prepared = stored?.prepared ?? [];
      expect(cantrips).toHaveLength(row.spells.cantrips);
      expect(prepared).toHaveLength(row.spells.prepared);
      expect(new Set(cantrips).size).toBe(cantrips.length);
      expect(new Set(prepared).size).toBe(prepared.length);
      for (const id of cantrips) {
        expect(getSpell(id)?.level).toBe(0);
        expect(getSpell(id)?.classes).toContain(classId);
      }
      for (const id of prepared) {
        expect(getSpell(id)?.level).toBe(1);
        expect(getSpell(id)?.classes).toContain(classId);
      }
      if (row.spells.spellbook !== null) {
        const book = stored?.spellbook ?? [];
        expect(book).toHaveLength(row.spells.spellbook);
        expect(new Set(book).size).toBe(book.length);
        expect(prepared.every((id) => book.includes(id))).toBe(true);
        for (const id of book) expect(getSpell(id)?.level).toBe(1);
      } else {
        expect(stored?.spellbook).toBeUndefined();
      }
      // Nothing else in spellcasting is touched.
      expect(Object.keys(c.spellcasting ?? {})).toEqual(['byClass']);
      // The generated character has nothing left to finish.
      expect(pendingSetupChoices(c)).toEqual([]);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateRandomCharacter(seededRng(11), { classId: 'wizard' });
    const b = generateRandomCharacter(seededRng(11), { classId: 'wizard' });
    expect(a.spellcasting).toEqual(b.spellcasting);
  });

});

describe('startingSpellPools / pickStartingSpells', () => {
  it('returns undefined for non-casters', () => {
    expect(startingSpellPools('fighter')).toBeUndefined();
    expect(pickStartingSpells('fighter', seededRng(1))).toBeUndefined();
  });

  it('offers only level 0 cantrips and level 1 leveled spells', () => {
    const pools = startingSpellPools('wizard')!;
    expect(pools.cantrips.every((s) => s.level === 0)).toBe(true);
    expect(pools.leveled.length).toBeGreaterThan(6);
    expect(pools.leveled.every((s) => s.level === 1)).toBe(true);
  });
});
