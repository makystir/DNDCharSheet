import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, SkillId } from '../../types/character';
import { SKILLS } from '../../types/character';
import { abilityModifier, proficiencyBonus } from '../abilities';
import { effectiveAbilityScores } from '../feats';
import { allSkillBreakdowns, effectiveSkillTraining } from '../skills';

/** The proficiency part of a skill's breakdown, as allSkillBreakdowns computes it. */
function breakdownProficiency(character: Character, id: SkillId) {
  const b = allSkillBreakdowns(character)[id];
  const prof = b.components.find((c) => c.label.startsWith('Proficiency'))!.value;
  const exp = b.components.find((c) => c.label === 'Expertise')!.value;
  return { proficient: prof > 0, expertise: exp > 0 };
}

const base = (): Character => ({
  ...createCharacter('Tester'),
  level: 1,
  classes: [{ id: 'wizard', level: 1, skillChoices: ['arcana'] }],
  species: { id: 'human', skillfulSkill: 'insight' },
  skills: {
    history: { proficient: true },
    religion: { expertise: true },
    arcana: { proficient: true, expertise: true },
  },
});

describe('effectiveSkillTraining', () => {
  it('class-granted skill: proficient, source class, labelled', () => {
    const t = effectiveSkillTraining({ ...base(), skills: {} }, 'arcana');
    expect(t).toMatchObject({ proficient: true, expertise: false, source: 'class', sourceLabel: 'Wizard (class)' });
  });

  it('species-granted skill: proficient, source species, labelled', () => {
    const t = effectiveSkillTraining(base(), 'insight');
    expect(t).toMatchObject({ proficient: true, source: 'species', sourceLabel: 'Human (species)' });
  });

  it('stored flag only: manual, no label', () => {
    const t = effectiveSkillTraining(base(), 'history');
    expect(t).toEqual({ proficient: true, expertise: false, source: 'manual' });
  });

  it('nothing: not proficient, no source', () => {
    expect(effectiveSkillTraining(base(), 'stealth')).toEqual({
      proficient: false,
      expertise: false,
      source: null,
    });
  });

  it('expertise without proficiency does not count', () => {
    const t = effectiveSkillTraining(base(), 'religion');
    expect(t.proficient).toBe(false);
    expect(t.expertise).toBe(false);
  });

  it('expertise on a granted skill counts off the effective proficiency', () => {
    const t = effectiveSkillTraining(base(), 'arcana');
    expect(t).toMatchObject({ proficient: true, expertise: true, source: 'class' });
  });

  it('a skill granted by both class and species names both and prefers class', () => {
    const c: Character = {
      ...base(),
      classes: [{ id: 'wizard', level: 1, skillChoices: ['insight'] }],
    };
    const t = effectiveSkillTraining(c, 'insight');
    expect(t.source).toBe('class');
    expect(t.sourceLabel).toBe('Human (species) / Wizard (class)');
  });

  it('agrees with the proficiency component of allSkillBreakdowns for every skill', () => {
    const variants: Character[] = [
      base(),
      { ...base(), skills: {} },
      { ...base(), classes: [{ id: 'wizard', level: 1, skillChoices: ['insight', 'history'] }] },
      { ...base(), species: { id: 'elf', keenSensesSkill: 'perception' } },
    ];
    for (const c of variants) {
      for (const skill of SKILLS) {
        const eff = effectiveSkillTraining(c, skill.id);
        const fromBreakdown = breakdownProficiency(c, skill.id);
        expect({ id: skill.id, proficient: eff.proficient, expertise: eff.expertise }).toEqual({
          id: skill.id,
          ...fromBreakdown,
        });
        // The modifier equals ability mod plus the effective bonuses.
        const mod = abilityModifier(effectiveAbilityScores(c)[skill.ability]);
        const pb = proficiencyBonus(c.level);
        expect(allSkillBreakdowns(c)[skill.id].total).toBe(
          mod + (eff.proficient ? pb : 0) + (eff.expertise ? pb : 0),
        );
      }
    }
  });
});
