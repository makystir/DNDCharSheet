import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SKILLS } from '../../types/character';
import type { AbilityScores } from '../../types/character';
import { abilityModifier, proficiencyBonus } from '../abilities';
import {
  skillModifier,
  skillModifierBreakdown,
  getSkillTraining,
  allSkillBreakdowns,
} from '../skills';
import { createCharacter } from '../../storage/character-store';

const SCORES: AbilityScores = { str: 10, dex: 14, con: 12, int: 16, wis: 13, cha: 8 };

describe('SKILLS table', () => {
  it('has the 18 canonical 2024 skills', () => {
    expect(SKILLS.length).toBe(18);
  });

  it('pairs skills with their PHB governing abilities', () => {
    const byId = Object.fromEntries(SKILLS.map((s) => [s.id, s.ability]));
    expect(byId.athletics).toBe('str');
    expect(byId.stealth).toBe('dex');
    expect(byId.arcana).toBe('int');
    expect(byId.perception).toBe('wis');
    expect(byId.persuasion).toBe('cha');
  });
});

describe('skillModifierBreakdown', () => {
  // Stealth is Dex-based; at level 1 PB is +2, Dex 14 → +2.
  it('untrained: ability mod only', () => {
    const bd = skillModifierBreakdown(SCORES, 1, 'stealth', {});
    expect(bd.total).toBe(2);
    expect(bd.components.map((c) => c.value)).toEqual([2, 0, 0]);
  });

  it('proficient: ability mod + PB', () => {
    const bd = skillModifierBreakdown(SCORES, 1, 'stealth', { proficient: true });
    expect(bd.total).toBe(4); // +2 Dex + 2 PB
    expect(bd.components.map((c) => c.value)).toEqual([2, 2, 0]);
  });

  it('proficient + expertise: ability mod + 2×PB', () => {
    const bd = skillModifierBreakdown(SCORES, 1, 'stealth', {
      proficient: true,
      expertise: true,
    });
    expect(bd.total).toBe(6); // +2 Dex + 2 PB + 2 PB
    expect(bd.components.map((c) => c.value)).toEqual([2, 2, 2]);
  });

  it('expertise without proficiency adds nothing (no PB to double)', () => {
    const bd = skillModifierBreakdown(SCORES, 1, 'stealth', { expertise: true });
    expect(bd.total).toBe(2);
    expect(bd.components.map((c) => c.value)).toEqual([2, 0, 0]);
  });

  it('property: total === abilityMod + (prof?PB:0) + (prof&&exp?PB:0) and components sum to total', () => {
    fc.assert(
      fc.property(
        fc.record({
          str: fc.integer({ min: 1, max: 30 }),
          dex: fc.integer({ min: 1, max: 30 }),
          con: fc.integer({ min: 1, max: 30 }),
          int: fc.integer({ min: 1, max: 30 }),
          wis: fc.integer({ min: 1, max: 30 }),
          cha: fc.integer({ min: 1, max: 30 }),
        }),
        fc.integer({ min: 1, max: 20 }),
        fc.constantFrom(...SKILLS.map((s) => s.id)),
        fc.boolean(),
        fc.boolean(),
        (scores, level, skillId, proficient, expertise) => {
          const skill = SKILLS.find((s) => s.id === skillId)!;
          const abilityMod = abilityModifier(scores[skill.ability]);
          const pb = proficiencyBonus(level);
          const expected =
            abilityMod +
            (proficient ? pb : 0) +
            (proficient && expertise ? pb : 0);
          const bd = skillModifierBreakdown(scores, level, skillId, {
            proficient,
            expertise,
          });
          expect(bd.total).toBe(expected);
          expect(skillModifier(scores, level, skillId, { proficient, expertise })).toBe(
            expected,
          );
          const sum = bd.components.reduce((s, c) => s + c.value, 0);
          expect(sum).toBe(bd.total);
        },
      ),
    );
  });
});

describe('getSkillTraining', () => {
  it('defaults absent entries to untrained', () => {
    const c = createCharacter('T');
    expect(getSkillTraining(c, 'arcana')).toEqual({
      proficient: false,
      expertise: false,
    });
  });
});

describe('allSkillBreakdowns', () => {
  it('returns a breakdown for every canonical skill', () => {
    const c = createCharacter('T');
    const all = allSkillBreakdowns(c);
    expect(Object.keys(all).length).toBe(18);
    for (const skill of SKILLS) {
      expect(all[skill.id]).toBeDefined();
    }
  });

  it('ignores stray/stale stored keys (iterates canonical list)', () => {
    const c = createCharacter('T');
    // Inject a bogus key; it must not throw or appear.
    (c.skills as Record<string, unknown>).bogus = { proficient: true };
    const all = allSkillBreakdowns(c);
    expect(Object.keys(all).length).toBe(18);
    expect((all as Record<string, unknown>).bogus).toBeUndefined();
  });
});
