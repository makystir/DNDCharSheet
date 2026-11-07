import { describe, it, expect } from 'vitest';
import type { RNG } from '../random';
import { generateRandomCharacter } from '../personal-details-generation';
import { CLASS_CATALOG } from '../../data/classes';
import type { ClassData, ClassId } from '../../data/classes';
import { getBackground } from '../../data/backgrounds';
import { SKILLS } from '../../types/character';
import { pendingSetupChoices } from '../starting-choices';

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

const CLASS_IDS = Object.keys(CLASS_CATALOG) as ClassId[];

describe('generateRandomCharacter: class skills', () => {
  it.each(CLASS_IDS)('%s gets exactly the required count, within its list, no duplicates', (classId) => {
    const data = (CLASS_CATALOG as Record<string, ClassData>)[classId];
    const allowed: string[] =
      data.skillChoices.from === 'any' ? SKILLS.map((s) => s.id) : data.skillChoices.from;
    for (let seed = 1; seed <= 20; seed++) {
      const c = generateRandomCharacter(seededRng(seed), { classId });
      const picks = c.classes?.[0]?.skillChoices ?? [];
      expect(picks).toHaveLength(data.skillChoices.count);
      expect(new Set(picks).size).toBe(picks.length);
      expect(picks.every((s) => allowed.includes(s))).toBe(true);
      // Nothing about class skills is left to finish.
      expect(pendingSetupChoices(c).some((i) => i.kind === 'class-skills')).toBe(false);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateRandomCharacter(seededRng(7));
    const b = generateRandomCharacter(seededRng(7));
    expect(a.classes?.[0]?.skillChoices).toEqual(b.classes?.[0]?.skillChoices);
  });

  it('prefers skills not already granted by the background', () => {
    // Fighter's list overlaps the Soldier background (Athletics, Intimidation).
    const soldier = getBackground('soldier')!;
    for (let seed = 1; seed <= 30; seed++) {
      const c = generateRandomCharacter(seededRng(seed), {
        classId: 'fighter',
        backgroundId: 'soldier',
        speciesId: 'dwarf',
      });
      const picks = c.classes?.[0]?.skillChoices ?? [];
      expect(picks.some((s) => soldier.skills.includes(s))).toBe(false);
    }
  });
});
