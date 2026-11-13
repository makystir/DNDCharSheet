/**
 * Golden oracle for Stage M1 (multiclassing: model + migration).
 *
 * Consumes the three ORCHESTRATOR-authored golden groups in
 * ./multiclass-migration-golden (which this test MUST NOT edit) and asserts:
 *  (a) MIGRATION_V1_V2_CASES — runMigration(v1) deep-equals v2, plus the
 *      derived idempotence (a v2 result run through runMigration again is
 *      unchanged).
 *  (b) TOTAL_LEVEL_CASES — totalLevel(character) === Σ class-entry levels.
 *  (c) PRIMARY_CLASS_CASES — primaryClass/allClasses semantics.
 *
 * Model + migration are behaviour-neutral for single-class (PHB 2024
 * "Multiclassing"): the v1 single `class` becomes a one-element `classes[]` and
 * the flat spellcasting selections move under `byClass[classId]`.
 */

import { describe, it, expect } from 'vitest';
import { MIGRATIONS, runMigration } from '../../storage/migration';
import { createCharacter } from '../../storage/character-store';
import { primaryClass, allClasses, totalLevel } from '../classes';
import type { Character, ClassEntry } from '../../types/character';
import type { ClassId } from '../../data/classes';
import {
  MIGRATION_V1_V2_CASES,
  TOTAL_LEVEL_CASES,
  PRIMARY_CLASS_CASES,
} from './multiclass-migration-golden';

// Distinct valid ClassIds to synthesise well-formed multi-entry `classes[]`
// arrays for the TOTAL_LEVEL_CASES (the ids themselves are irrelevant to the
// level sum; only the count + per-entry level matter).
const DISTINCT_CLASS_IDS: ClassId[] = ['fighter', 'wizard', 'rogue', 'cleric', 'bard'];

describe('MIGRATION_V1_V2_CASES — MIGRATIONS[1](v1) deep-equals v2 + idempotence', () => {
  it.each(MIGRATION_V1_V2_CASES)('$name', (c) => {
    // The v1 -> v2 step itself must produce the expected v2 record exactly.
    // (CURRENT_VERSION has since moved past 2, so the full pipeline also runs
    // the later steps; those are checked below as a composition.)
    expect(MIGRATIONS[1]({ ...(c.v1 as Record<string, unknown>) })).toEqual(c.v2);

    // The full pipeline from v1 lands where the pipeline from v2 lands.
    const result = runMigration(c.v1);
    const fromV2 = runMigration(c.v2);
    expect(result.success).toBe(true);
    expect(fromV2.success).toBe(true);
    if (!result.success || !fromV2.success) return;
    expect(result.character).toEqual(fromV2.character);

    // Derived idempotence (golden's note): a second migration of the result is
    // a no-op — runMigration(runMigration(v1)) deep-equals runMigration(v1).
    const again = runMigration(result.character);
    expect(again.success).toBe(true);
    if (!again.success) return;
    expect(again.character).toEqual(result.character);
  });
});

describe('TOTAL_LEVEL_CASES — totalLevel === Σ class-entry levels', () => {
  it.each(TOTAL_LEVEL_CASES)('$name', (c) => {
    const classes: ClassEntry[] = c.classLevels.map((level, i) => ({
      id: DISTINCT_CLASS_IDS[i % DISTINCT_CLASS_IDS.length],
      level,
    }));
    const character: Character = {
      ...createCharacter('T'),
      level: c.expectedTotal,
      ...(classes.length > 0 ? { classes } : {}),
    };
    expect(totalLevel(character)).toBe(c.expectedTotal);
  });
});

describe('PRIMARY_CLASS_CASES — primaryClass / allClasses semantics', () => {
  it.each(PRIMARY_CLASS_CASES)('$name', (c) => {
    const classes: ClassEntry[] = c.classIds.map((id) => ({ id: id as ClassId, level: 1 }));
    const character: Character = {
      ...createCharacter('T'),
      ...(classes.length > 0 ? { classes } : {}),
    };
    expect(primaryClass(character)?.id ?? null).toBe(c.expectedPrimary);
    expect(allClasses(character).length).toBe(c.expectedAllCount);
  });
});
