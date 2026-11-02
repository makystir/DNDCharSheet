import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { passiveCheck, passivePerceptionBreakdown } from '../passive-checks';
import { skillModifier } from '../skills';
import { getSkillTraining } from '../skills';
import { createCharacter } from '../../storage/character-store';

describe('passiveCheck', () => {
  it('is 10 + the check modifier', () => {
    expect(passiveCheck(0)).toBe(10);
    expect(passiveCheck(4)).toBe(14);
    expect(passiveCheck(-2)).toBe(8);
  });
});

describe('passivePerceptionBreakdown', () => {
  it('matches the PHB worked example: Wis 15 + Perception proficiency at level 1 → 14', () => {
    // PHB 2024 (~line 1918): Wis 15 (+2) + proficiency (+2) → Passive Perception 14.
    const c = {
      ...createCharacter('T'),
      level: 1,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 15, cha: 10 },
      skills: { perception: { proficient: true } },
    };
    const bd = passivePerceptionBreakdown(c);
    expect(bd.total).toBe(14);
    expect(bd.components[0]).toEqual({ label: 'Base', value: 10 });
  });

  it('property: total === 10 + Perception check modifier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 20 }),
        fc.boolean(),
        fc.boolean(),
        (wis, level, proficient, expertise) => {
          const c = {
            ...createCharacter('T'),
            level,
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis, cha: 10 },
            skills: { perception: { proficient, expertise } },
          };
          const perceptionMod = skillModifier(
            c.abilities,
            c.level,
            'perception',
            getSkillTraining(c, 'perception'),
          );
          const bd = passivePerceptionBreakdown(c);
          expect(bd.total).toBe(10 + perceptionMod);
          expect(bd.components.reduce((s, x) => s + x.value, 0)).toBe(bd.total);
        },
      ),
    );
  });
});
