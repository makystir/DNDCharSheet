import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, SkillId } from '../../types/character';
import { ABILITIES, SKILLS } from '../../types/character';
import { SPELL_CATALOG } from '../../data/spells';
import { BACKGROUND_LIST } from '../../data/backgrounds';
import { LANGUAGES } from '../languages';
import { ABILITY_INFO, LANGUAGE_INFO, SKILL_INFO, VITAL_INFO } from '../../data/rules-text';
import {
  resolveAbilityTooltip,
  resolveBackgroundTooltip,
  resolveLanguageTooltip,
  resolveSaveTooltip,
  resolveSkillTooltip,
  resolveSpellTooltip,
  resolveVitalTooltip,
} from '../tooltip-content';

/**
 * PHB 2024 Skills table (Docs/PlayersHandbook.md L535-554): each skill's ability,
 * transcribed independently of the app's SKILLS table so a wrong pairing fails.
 */
const PHB_SKILL_ABILITY: Record<SkillId, string> = {
  acrobatics: 'Dexterity',
  animalHandling: 'Wisdom',
  arcana: 'Intelligence',
  athletics: 'Strength',
  deception: 'Charisma',
  history: 'Intelligence',
  insight: 'Wisdom',
  intimidation: 'Charisma',
  investigation: 'Intelligence',
  medicine: 'Wisdom',
  nature: 'Intelligence',
  perception: 'Wisdom',
  performance: 'Charisma',
  persuasion: 'Charisma',
  religion: 'Intelligence',
  sleightOfHand: 'Dexterity',
  stealth: 'Dexterity',
  survival: 'Wisdom',
};

/** PHB 2024 Saving Throw Examples table (L412-419). */
const PHB_SAVE_USE: Record<string, string> = {
  str: 'physically resist direct force',
  dex: "dodge out of harm's way",
  con: 'endure a toxic hazard',
  int: 'recognize an illusion as fake',
  wis: 'resist a mental assault',
  cha: 'assert your identity',
};

function section(tip: { sections: { label: string; text: string }[] } | null, label: string): string | undefined {
  return tip?.sections.find((s) => s.label === label)?.text;
}

describe('skill tooltips (PHB Skills table)', () => {
  it('has a tooltip for all 18 skills with the PHB ability', () => {
    expect(SKILLS).toHaveLength(18);
    for (const skill of SKILLS) {
      const tip = resolveSkillTooltip(skill.id);
      expect(tip, skill.id).not.toBeNull();
      expect(section(tip, 'Ability'), `${skill.id} ability`).toBe(PHB_SKILL_ABILITY[skill.id]);
      expect(tip?.title, `${skill.id} title`).toBe(`${skill.name} (${PHB_SKILL_ABILITY[skill.id]})`);
      expect(SKILL_INFO[skill.id].uses.length, `${skill.id} uses`).toBeGreaterThan(10);
    }
  });

  it("shows the character's training: not proficient, proficient, expertise", () => {
    const base: Character = createCharacter('Tester');
    expect(section(resolveSkillTooltip('stealth', base), 'Your training')).toBe('Not proficient');
    const proficient: Character = { ...base, skills: { stealth: { proficient: true } } };
    expect(section(resolveSkillTooltip('stealth', proficient), 'Your training')).toBe('Proficient');
    const expert: Character = { ...base, skills: { stealth: { proficient: true, expertise: true } } };
    expect(section(resolveSkillTooltip('stealth', expert), 'Your training')).toMatch(/^Expertise/);
  });

  it('returns null for an unknown skill id', () => {
    expect(resolveSkillTooltip('nonsense' as SkillId)).toBeNull();
  });
});

describe('ability and saving throw tooltips (PHB Ability Descriptions / Saving Throw Examples)', () => {
  it('describes what each save is used for', () => {
    for (const ability of ABILITIES) {
      const save = resolveSaveTooltip(ability);
      expect(section(save, 'Use')?.toLowerCase(), ability).toContain(PHB_SAVE_USE[ability]);
      expect(ABILITY_INFO[ability].saveTo.toLowerCase(), ability).toBe(PHB_SAVE_USE[ability]);
    }
  });

  it('lists exactly the skills that use an ability', () => {
    const skillsFor = (a: string) => SKILLS.filter((s) => PHB_SKILL_ABILITY[s.id] === a).length;
    expect(skillsFor('Strength')).toBe(1);
    expect(skillsFor('Dexterity')).toBe(3);
    expect(skillsFor('Constitution')).toBe(0);
    expect(skillsFor('Intelligence')).toBe(5);
    expect(skillsFor('Wisdom')).toBe(5);
    expect(skillsFor('Charisma')).toBe(4);
    expect(section(resolveAbilityTooltip('dex'), 'Skills')).toBe('Acrobatics, Sleight of Hand, Stealth');
    expect(section(resolveAbilityTooltip('con'), 'Skills')).toBeUndefined();
  });

  it('reports save proficiency from the initial class', () => {
    const wizard: Character = { ...createCharacter('Wiz'), classes: [{ id: 'wizard', level: 1 }] };
    expect(section(resolveSaveTooltip('int', wizard), 'Your training')).toMatch(/^Proficient \(Wizard\)/);
    expect(section(resolveSaveTooltip('str', wizard), 'Your training')).toBe('Not proficient.');
  });
});

describe('spell tooltips', () => {
  it('resolve for every catalog spell with level, timing, range, components and duration', () => {
    for (const spell of SPELL_CATALOG) {
      const tip = resolveSpellTooltip(spell.id);
      expect(tip, spell.id).not.toBeNull();
      expect(section(tip, 'Source'), spell.id).toBe(
        `Player's Handbook (2024), Chapter 7: Spells, Spell Descriptions (alphabetical): ${spell.name}`,
      );
      for (const label of ['Level', 'Casting time', 'Range', 'Components', 'Duration', 'Effect']) {
        expect(section(tip, label), `${spell.id} ${label}`).toBeTruthy();
      }
      expect(tip?.title).toBe(spell.name);
    }
    expect(resolveSpellTooltip('not-a-spell')).toBeNull();
  });

  it('flags Concentration and Ritual, and labels cantrips', () => {
    expect(section(resolveSpellTooltip('fireball'), 'Level')).toBe('Level 3 Evocation');
    expect(section(resolveSpellTooltip('fire-bolt'), 'Level')).toMatch(/^Cantrip/);
    const concentration = SPELL_CATALOG.find((s) => s.concentration);
    const ritual = SPELL_CATALOG.find((s) => s.ritual);
    expect(section(resolveSpellTooltip(concentration!.id), 'Tags')).toContain('Concentration');
    expect(section(resolveSpellTooltip(ritual!.id), 'Tags')).toContain('Ritual');
  });
});

describe('background, language and vital tooltips', () => {
  it('resolves every background with its ability scores, skills and origin feat', () => {
    for (const bg of BACKGROUND_LIST) {
      const tip = resolveBackgroundTooltip(bg.id);
      expect(tip?.title, bg.id).toBe(bg.name);
      expect(section(tip, 'Ability scores')?.split(', '), bg.id).toHaveLength(3);
      expect(section(tip, 'Skill proficiencies')?.split(', '), bg.id).toHaveLength(2);
      expect(section(tip, 'Origin feat'), bg.id).toBeTruthy();
    }
    expect(resolveBackgroundTooltip('nope')).toBeNull();
    expect(resolveBackgroundTooltip(undefined)).toBeNull();
  });

  it('knows every creation language, Common, and Thieves\u2019 Cant, each with an origin', () => {
    for (const id of [...LANGUAGES, 'common', 'thieves-cant']) {
      const tip = resolveLanguageTooltip(id);
      expect(tip, id).not.toBeNull();
      expect(section(tip, 'Origin'), id).toBeTruthy();
    }
    expect(LANGUAGE_INFO.elvish.origin).toBe('Elves');
    expect(LANGUAGE_INFO.abyssal.kind).toBe('rare');
    expect(LANGUAGE_INFO.dwarvish.kind).toBe('standard');
    expect(resolveLanguageTooltip('klingon')).toBeNull();
  });

  it('describes each Overview vital, with the Passive Perception formula', () => {
    for (const id of Object.keys(VITAL_INFO) as (keyof typeof VITAL_INFO)[]) {
      expect(section(resolveVitalTooltip(id), 'What it is'), id).toBeTruthy();
    }
    expect(section(resolveVitalTooltip('passivePerception'), 'Formula')).toContain('10 +');
  });
});
