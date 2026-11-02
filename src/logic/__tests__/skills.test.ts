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

describe('species-granted skill proficiencies', () => {
  // Test 13.
  const pbAtL1 = proficiencyBonus(1);

  it('(a) Human Skillful: chosen skill shows "Proficiency (Human: Skillful)", PB once, even with proficient:false', () => {
    const bd = skillModifierBreakdown(
      SCORES,
      1,
      'arcana',
      { proficient: false },
      'Human: Skillful',
    );
    const prof = bd.components.find((c) => c.label.startsWith('Proficiency'));
    expect(prof?.label).toBe('Proficiency (Human: Skillful)');
    expect(prof?.value).toBe(pbAtL1);
    // Int 16 → +3, plus one PB (+2) = +5. PB added once.
    expect(bd.total).toBe(abilityModifier(SCORES.int) + pbAtL1);
  });

  it('(b) Elf Keen Senses: chosen skill shows "Proficiency (Elf: Keen Senses)" identically', () => {
    const bd = skillModifierBreakdown(
      SCORES,
      1,
      'perception',
      {},
      'Elf: Keen Senses',
    );
    const prof = bd.components.find((c) => c.label.startsWith('Proficiency'));
    expect(prof?.label).toBe('Proficiency (Elf: Keen Senses)');
    expect(prof?.value).toBe(pbAtL1);
  });

  it('(c) expertise counts off effective proficiency: species-granted + proficient:false + expertise:true → Prof=PB and Exp=PB', () => {
    const bd = skillModifierBreakdown(
      SCORES,
      1,
      'survival',
      { proficient: false, expertise: true },
      'Elf: Keen Senses',
    );
    const prof = bd.components.find((c) => c.label.startsWith('Proficiency'));
    const exp = bd.components.find((c) => c.label === 'Expertise');
    expect(prof?.value).toBe(pbAtL1);
    expect(exp?.value).toBe(pbAtL1);
    // A non-granted, non-proficient skill with expertise:true still yields 0.
    const none = skillModifierBreakdown(SCORES, 1, 'stealth', {
      proficient: false,
      expertise: true,
    });
    expect(none.components.find((c) => c.label === 'Expertise')?.value).toBe(0);
  });

  it('allSkillBreakdowns surfaces both grants from the character species selection', () => {
    const elf = {
      ...createCharacter('E'),
      species: { id: 'elf' as const, keenSensesSkill: 'insight' as const },
    };
    const elfAll = allSkillBreakdowns(elf);
    expect(
      elfAll.insight.components.find((c) => c.label.startsWith('Proficiency'))
        ?.label,
    ).toBe('Proficiency (Elf: Keen Senses)');

    const human = {
      ...createCharacter('H'),
      species: { id: 'human' as const, skillfulSkill: 'athletics' as const },
    };
    const humanAll = allSkillBreakdowns(human);
    expect(
      humanAll.athletics.components.find((c) => c.label.startsWith('Proficiency'))
        ?.label,
    ).toBe('Proficiency (Human: Skillful)');
    // A non-granted skill is unchanged.
    expect(
      humanAll.stealth.components.find((c) => c.label.startsWith('Proficiency'))
        ?.label,
    ).toBe('Proficiency');
  });
});

describe('class-granted/chosen skill proficiencies (test #16)', () => {
  it('(a) a class-chosen skill shows the class source label and PB once', () => {
    const c = {
      ...createCharacter('B'),
      level: 1,
      // Barbarian's starting skill list includes Athletics (PHB 2024).
      class: { id: 'barbarian' as const, level: 1, skillChoices: ['athletics' as const] },
    };
    const all = allSkillBreakdowns(c);
    const prof = all.athletics.components.find((x) =>
      x.label.startsWith('Proficiency'),
    );
    expect(prof?.label).toBe('Proficiency (Barbarian (class))');
    expect(prof?.value).toBe(proficiencyBonus(1));
    // PB added once even if the user also toggled it.
    const toggled = {
      ...c,
      skills: { athletics: { proficient: true } },
    };
    const toggledAll = allSkillBreakdowns(toggled);
    const toggledProf = toggledAll.athletics.components.find((x) =>
      x.label.startsWith('Proficiency'),
    );
    expect(toggledProf?.value).toBe(proficiencyBonus(1));
    expect(
      toggledAll.athletics.components.reduce((s, x) => s + x.value, 0),
    ).toBe(toggledAll.athletics.total);
  });

  it('(b) a skill granted by BOTH a species trait and the class names both sources, PB once', () => {
    const c = {
      ...createCharacter('E'),
      level: 1,
      // Elf Keen Senses grants Perception; Barbarian also chooses Perception.
      species: { id: 'elf' as const, keenSensesSkill: 'perception' as const },
      class: {
        id: 'barbarian' as const,
        level: 1,
        skillChoices: ['perception' as const],
      },
    };
    const all = allSkillBreakdowns(c);
    const prof = all.perception.components.find((x) =>
      x.label.startsWith('Proficiency'),
    );
    expect(prof?.label).toBe(
      'Proficiency (Elf: Keen Senses / Barbarian (class))',
    );
    // Single PB despite two granting sources.
    expect(prof?.value).toBe(proficiencyBonus(1));
    expect(all.perception.components.reduce((s, x) => s + x.value, 0)).toBe(
      all.perception.total,
    );
  });

  it('(c) expertise is still computed off effective (class-granted) proficiency', () => {
    const c = {
      ...createCharacter('B'),
      level: 1,
      class: { id: 'barbarian' as const, level: 1, skillChoices: ['athletics' as const] },
      // Mark expertise but NOT proficient: class grant makes it effective.
      skills: { athletics: { proficient: false, expertise: true } },
    };
    const all = allSkillBreakdowns(c);
    const prof = all.athletics.components.find((x) =>
      x.label.startsWith('Proficiency'),
    );
    const exp = all.athletics.components.find((x) => x.label === 'Expertise');
    expect(prof?.value).toBe(proficiencyBonus(1));
    expect(exp?.value).toBe(proficiencyBonus(1));
    expect(all.athletics.components.reduce((s, x) => s + x.value, 0)).toBe(
      all.athletics.total,
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
