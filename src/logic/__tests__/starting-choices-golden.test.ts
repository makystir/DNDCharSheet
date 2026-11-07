import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, ClassSpellcasting, SkillId } from '../../types/character';
import { SKILLS } from '../../types/character';
import { CLASS_CATALOG } from '../../data/classes';
import type { ClassData, ClassId } from '../../data/classes';
import { SPELL_CATALOG } from '../../data/spells';
import type { SpellId } from '../../data/spells';
import { savingThrowProficiency } from '../saving-throws';
import { pendingSetupChoices, startingChoicesFor } from '../starting-choices';
import {
  PENDING_SETUP_CASES,
  SAVE_DISPLAY_CASES,
  STARTING_CHOICES,
} from './starting-choices-golden';
import type { Ability, PendingSetupCase } from './starting-choices-golden';

/** Maps a PHB-printed skill name to the app's SkillId by name. */
function skillIdByName(name: string): SkillId {
  const found = SKILLS.find((s) => s.name === name);
  if (!found) throw new Error(`Unknown skill name: ${name}`);
  return found.id;
}

const sortIds = (ids: readonly string[]) => [...ids].sort();

describe('STARTING_CHOICES: class data', () => {
  it.each(STARTING_CHOICES.map((row) => [row.classId, row] as const))('%s', (_id, row) => {
    const data = (CLASS_CATALOG as Record<string, ClassData>)[row.classId];
    expect(data).toBeDefined();
    expect(data.savingThrows).toEqual(row.savingThrows);
    expect(data.skillChoices.count).toBe(row.skills.count);
    if (row.skills.from === 'any') {
      expect(data.skillChoices.from).toBe('any');
    } else {
      expect(data.skillChoices.from).not.toBe('any');
      expect(sortIds(data.skillChoices.from as SkillId[])).toEqual(
        sortIds(row.skills.from.map(skillIdByName)),
      );
    }
  });

  it('covers all twelve classes', () => {
    expect(sortIds(STARTING_CHOICES.map((r) => r.classId))).toEqual(
      sortIds(Object.keys(CLASS_CATALOG)),
    );
  });
});

describe('STARTING_CHOICES: startingChoicesFor helper', () => {
  it.each(STARTING_CHOICES.map((row) => [row.classId, row] as const))('%s', (_id, row) => {
    const actual = startingChoicesFor(row.classId);
    expect(actual).toBeDefined();
    expect(actual?.savingThrows).toEqual(row.savingThrows);
    expect(actual?.skills.count).toBe(row.skills.count);
    if (row.skills.from === 'any') {
      expect(actual?.skills.from).toBe('any');
    } else {
      expect(sortIds(actual?.skills.from as SkillId[])).toEqual(
        sortIds(row.skills.from.map(skillIdByName)),
      );
    }
    expect(actual?.spells).toEqual(row.spells);
  });

  it('returns undefined for an unknown class', () => {
    expect(startingChoicesFor('artificer')).toBeUndefined();
  });
});

describe('SAVE_DISPLAY_CASES: savingThrowProficiency', () => {
  it.each(SAVE_DISPLAY_CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const base = createCharacter('Saves');
    const character: Character = {
      ...base,
      classes: c.classes.map((k) => ({ id: k.id as ClassId, level: k.level })),
      level: Math.max(1, c.classes.reduce((sum, k) => sum + k.level, 0)),
      saveProficiencies: Object.fromEntries(c.manual.map((a) => [a, true])),
    };
    for (const [ability, source] of Object.entries(c.expected) as [Ability, string | null][]) {
      const actual = savingThrowProficiency(character, ability);
      expect(actual.source, ability).toBe(source);
      expect(actual.proficient, ability).toBe(source !== null);
    }
  });

  it('names the class for a class-granted save', () => {
    const wizard: Character = { ...createCharacter('W'), classes: [{ id: 'wizard', level: 1 }] };
    expect(savingThrowProficiency(wizard, 'int').classLabel).toBe('Wizard');
    expect(savingThrowProficiency(wizard, 'str').classLabel).toBeUndefined();
  });
});

/** The class spell list ids at a level, for building valid picks. */
function spellsFor(classId: string, level: number, count: number): SpellId[] {
  return SPELL_CATALOG.filter((s) => s.level === level && s.classes.some((k) => k === classId))
    .slice(0, count)
    .map((s) => s.id as SpellId);
}

/** Builds a real level-1 Character for a pending-setup case. */
function buildCharacter(c: PendingSetupCase): Character {
  const data = (CLASS_CATALOG as Record<string, ClassData>)[c.classId];
  const skillList: SkillId[] =
    data.skillChoices.from === 'any' ? SKILLS.map((s) => s.id) : data.skillChoices.from;
  const classId = c.classId as ClassId;
  const character: Character = {
    ...createCharacter('Pending'),
    level: 1,
    classes: [{ id: classId, level: 1, skillChoices: skillList.slice(0, c.classSkillsChosen) }],
  };
  const perClass: ClassSpellcasting = {};
  if (c.cantripsChosen) perClass.cantrips = spellsFor(c.classId, 0, c.cantripsChosen);
  if (c.spellbookChosen) perClass.spellbook = spellsFor(c.classId, 1, c.spellbookChosen);
  if (c.preparedChosen) {
    // A Wizard prepares from its spellbook; other classes from the class list.
    perClass.prepared = spellsFor(c.classId, 1, c.preparedChosen);
  }
  if (Object.keys(perClass).length > 0) {
    character.spellcasting = { byClass: { [classId]: perClass } };
  }
  return character;
}

describe('PENDING_SETUP_CASES: pendingSetupChoices', () => {
  it.each(PENDING_SETUP_CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const actual = pendingSetupChoices(buildCharacter(c));
    expect(actual.map(({ kind, have, need }) => ({ kind, have, need }))).toEqual(c.expected);
    // Single-class characters carry no class label.
    expect(actual.every((item) => item.className === undefined)).toBe(true);
  });
});

describe('pendingSetupChoices: beyond the golden', () => {
  it('ignores skills that are not on the class list and duplicates', () => {
    const fighter: Character = {
      ...createCharacter('F'),
      classes: [{ id: 'fighter', level: 1, skillChoices: ['arcana', 'athletics', 'athletics'] }],
    };
    expect(pendingSetupChoices(fighter)).toEqual([{ kind: 'class-skills', have: 1, need: 2 }]);
  });

  it('does not count prepared spells that are not on the class list', () => {
    const paladin: Character = {
      ...createCharacter('P'),
      classes: [{ id: 'paladin', level: 1, skillChoices: ['athletics', 'insight'] }],
    };
    const wizardOnly = spellsFor('wizard', 1, 80).filter(
      (id) => !SPELL_CATALOG.find((s) => s.id === id)?.classes.some((k) => k === 'paladin'),
    );
    paladin.spellcasting = { byClass: { paladin: { prepared: wizardOnly.slice(0, 2) } } };
    expect(pendingSetupChoices(paladin)).toEqual([{ kind: 'prepared', have: 0, need: 2 }]);
  });

  it('uses the caps at the current level (Wizard 3 needs 8 in the spellbook)', () => {
    const wizard: Character = {
      ...createCharacter('W3'),
      level: 3,
      classes: [{ id: 'wizard', level: 3, skillChoices: ['arcana', 'history'] }],
    };
    const items = pendingSetupChoices(wizard);
    expect(items.find((i) => i.kind === 'spellbook')).toMatchObject({ have: 0, need: 10 });
  });

  it('produces one labelled item per class per group for a multiclass caster', () => {
    const multi: Character = {
      ...createCharacter('Multi'),
      level: 2,
      classes: [
        { id: 'cleric', level: 1, skillChoices: ['history', 'insight'] },
        { id: 'wizard', level: 1 },
      ],
    };
    const items = pendingSetupChoices(multi);
    expect(items.map((i) => [i.kind, i.classId])).toEqual([
      ['cantrips', 'cleric'],
      ['cantrips', 'wizard'],
      ['spellbook', 'wizard'],
      ['prepared', 'cleric'],
      ['prepared', 'wizard'],
    ]);
    expect(items.every((i) => i.className !== undefined)).toBe(true);
  });

  it('does not ask a Fighter or Rogue for spells before they gain Spellcasting', () => {
    for (const id of ['fighter', 'rogue'] as const) {
      const c: Character = {
        ...createCharacter(id),
        classes: [{ id, level: 1, skillChoices: ['athletics', 'acrobatics', 'insight', 'stealth'] }],
      };
      expect(pendingSetupChoices(c).filter((i) => i.kind !== 'class-skills')).toEqual([]);
    }
  });
});
