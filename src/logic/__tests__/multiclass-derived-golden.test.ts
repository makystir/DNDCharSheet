/**
 * Stage M2 golden HARNESS: maps every row of multiclass-derived-golden.ts onto
 * the real per-class derived engines over the M1 `classes[]` model. Build
 * multiclass characters by setting `classes: [...]` directly (M4 adds the UI).
 *
 * The golden data file is the SOURCE OF TRUTH and is never edited here; this
 * harness only reproduces each row:
 *  - HIT_DICE_POOL_CASES   → hitDiceByDieType(character)
 *  - HP_MAX_CASES          → characterHitPointMaxBreakdown(character).total (fixed)
 *  - FEAT_SLOT_CASES       → featSlotLevels(character).length (the slot COUNT)
 *  - MULTICLASS_PROF_CASES → CLASS_CATALOG[id].multiclassProficiencies
 */
import { describe, it, expect } from 'vitest';
import {
  HIT_DICE_POOL_CASES,
  HP_MAX_CASES,
  FEAT_SLOT_CASES,
  MULTICLASS_PROF_CASES,
  type ClassId,
} from './multiclass-derived-golden';
import { BLANK_CHARACTER } from '../../types/character';
import type { Character, ClassEntry } from '../../types/character';
import { hitDiceByDieType } from '../classes';
import { featSlotLevels } from '../advancement';
import { characterHitPointMaxBreakdown } from '../hit-points-state';
import { CLASS_CATALOG } from '../../data/classes';

/** A character with the given ordered class entries (first = initial class). */
function charWithClasses(entries: ClassEntry[], conScore = 10): Character {
  const totalLevel = entries.reduce((s, e) => s + e.level, 0);
  return {
    ...BLANK_CHARACTER,
    level: totalLevel,
    abilities: { ...BLANK_CHARACTER.abilities, con: conScore },
    classes: entries,
  };
}

/** A Con SCORE that produces the given modifier (floor((score-10)/2)). */
function conScoreFor(conMod: number): number {
  return 10 + conMod * 2;
}

describe('HIT_DICE_POOL_CASES → hitDiceByDieType', () => {
  it.each(HIT_DICE_POOL_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const entries = (Object.entries(tc.classLevels) as [ClassId, number][]).map(
      ([id, level]) => ({ id, level, skillChoices: [] }),
    );
    expect(hitDiceByDieType(charWithClasses(entries))).toEqual(tc.expect);
  });
});

describe('HP_MAX_CASES → characterHitPointMaxBreakdown (fixed mode)', () => {
  it.each(HP_MAX_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const entries = tc.classOrder.map(({ id, level }) => ({ id, level, skillChoices: [] }));
    const character = charWithClasses(entries, conScoreFor(tc.conMod));
    expect(characterHitPointMaxBreakdown(character).total).toBe(tc.expectTotal);
  });
});

describe('FEAT_SLOT_CASES → featSlotLevels count', () => {
  it.each(FEAT_SLOT_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const entries = (Object.entries(tc.classLevels) as [ClassId, number][]).map(
      ([id, level]) => ({ id, level, skillChoices: [] }),
    );
    expect(featSlotLevels(charWithClasses(entries)).length).toBe(tc.expectCount);
  });
});

describe('MULTICLASS_PROF_CASES → CLASS_CATALOG multiclassProficiencies', () => {
  it.each(MULTICLASS_PROF_CASES.map((c) => [c.classId, c] as const))(
    'class %s multiclass proficiencies',
    (_classId, tc) => {
      const mc = CLASS_CATALOG[tc.classId].multiclassProficiencies;
      // Compare as plain structures (the catalog uses `as const` readonly arrays).
      expect({
        armor: [...mc.armor],
        martialWeapons: mc.martialWeapons,
        skills: mc.skills,
        tools: [...mc.tools],
      }).toEqual(tc.expect);
    },
  );
});
