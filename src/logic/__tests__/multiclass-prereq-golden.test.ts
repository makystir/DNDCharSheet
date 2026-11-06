/**
 * Oracle test for Stage M4 (multiclassing prerequisites + level-up invariant).
 *
 * Iterates EVERY row of the orchestrator-authored golden table
 * (multiclass-prereq-golden.ts) and asserts the real logic reproduces it. The
 * golden is DATA ONLY and must not be edited; this test imports all four groups
 * and consumes each with it.each.
 *
 * Groups:
 *  - PREREQ_SHAPE_CASES → the per-class ClassData.multiclassPrereq shape.
 *  - CAN_MULTICLASS_CASES → canMulticlassInto (the RAW check, effective scores).
 *  - MAY_MULTICLASS_CASES → mayMulticlass (the toggle-aware UI decision).
 *  - LEVELUP_INVARIANT_CASES → applyMulticlassLevel (total === Σ entry levels).
 */

import { describe, it, expect } from 'vitest';
import type { Ability, Character } from '../../types/character';
import { CLASS_CATALOG, type ClassId } from '../../data/classes';
import type { ClassData } from '../../data/classes';
import { canMulticlassInto, mayMulticlass } from '../multiclass';
import { applyMulticlassLevel } from '../advancement';
import {
  PREREQ_SHAPE_CASES,
  CAN_MULTICLASS_CASES,
  MAY_MULTICLASS_CASES,
  LEVELUP_INVARIANT_CASES,
} from './multiclass-prereq-golden';

/** A character with the given classes + effective (= base, no feats) scores. */
function buildCharacter(
  classes: ClassId[],
  scores?: Record<Ability, number>,
  allowIllegal?: boolean,
): Character {
  const character: Character = {
    _v: 2,
    id: 'test',
    name: 'Tester',
    level: classes.reduce((sum) => sum + 1, 0),
    abilities: scores ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    classes: classes.map((id) => ({ id, level: 1 })),
    createdAt: 0,
    updatedAt: 0,
  };
  if (allowIllegal !== undefined) character.houseRules = { allowIllegalMulticlass: allowIllegal };
  return character;
}

describe('multiclass prereq golden — PREREQ_SHAPE_CASES (ClassData.multiclassPrereq)', () => {
  it.each(PREREQ_SHAPE_CASES)('$classId: $cite', (c) => {
    const shape = (CLASS_CATALOG[c.classId] as ClassData).multiclassPrereq;
    expect(shape.all).toEqual(c.all);
    expect(shape.any).toEqual(c.any);
    // Exactly one of all/any per class.
    expect((shape.all === undefined) !== (shape.any === undefined)).toBe(true);
  });
});

describe('multiclass prereq golden — CAN_MULTICLASS_CASES (canMulticlassInto)', () => {
  it.each(CAN_MULTICLASS_CASES)('$name', (c) => {
    const character = buildCharacter(c.currentClasses, c.scores);
    const result = canMulticlassInto(character, c.newClass);
    expect(result.ok).toBe(c.expect.ok);
    expect(result.reason).toBe(c.expect.reason);
    if (c.expect.failing !== undefined) {
      // Compared as a set (order not significant).
      expect(new Set(result.failing)).toEqual(new Set(c.expect.failing));
    } else {
      expect(result.failing === undefined || result.failing.length === 0).toBe(true);
    }
  });
});

describe('multiclass prereq golden — MAY_MULTICLASS_CASES (mayMulticlass)', () => {
  it.each(MAY_MULTICLASS_CASES)('$name', (c) => {
    const character = buildCharacter(c.currentClasses, c.scores, c.allowIllegal);
    const result = mayMulticlass(character, c.newClass);
    expect(result.proceed).toBe(c.expect.proceed);
    expect(result.warning).toBe(c.expect.warning);
  });
});

describe('multiclass prereq golden — LEVELUP_INVARIANT_CASES (applyMulticlassLevel)', () => {
  it.each(LEVELUP_INVARIANT_CASES)('$name', (c) => {
    // Milestone mode (the default) permits a level-up below 20, so applyMulticlassLevel
    // is not gated by XP here; the invariant is what the golden pins.
    const character: Character = {
      _v: 2,
      id: 'test',
      name: 'Tester',
      level: c.before.reduce((sum, e) => sum + e.level, 0),
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      classes: c.before.map((e) => ({ id: e.id, level: e.level })),
      createdAt: 0,
      updatedAt: 0,
    };
    const next = applyMulticlassLevel(character, c.addClass, { mode: 'fixed' }, 1000);
    expect(next).not.toBeNull();
    const classes = next!.classes ?? [];
    expect(classes.map((e) => ({ id: e.id, level: e.level }))).toEqual(c.expect.classLevels);
    expect(next!.level).toBe(c.expect.total);
    // The stored total always equals the sum of entry levels (the invariant).
    expect(next!.level).toBe(classes.reduce((sum, e) => sum + e.level, 0));
  });
});
