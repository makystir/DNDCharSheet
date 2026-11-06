import { describe, it, expect } from 'vitest';
import { runMigration, migrateCharacter, MIGRATIONS } from '../migration';
import { BLANK_CHARACTER, CURRENT_VERSION } from '../../types/character';
import type { Character } from '../../types/character';

/**
 * Tests for the versioned schema-migration runner (Stage B2). This is the
 * data-integrity core, so it is tested hard: no-op at the current version, the
 * legacy / no-`_v` upgrade, unknown & future version handling, malformed input,
 * and idempotence.
 */

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    ...structuredClone(BLANK_CHARACTER),
    id: 'abc',
    name: 'Migratee',
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

describe('runMigration: no-op at current version', () => {
  it('leaves a CURRENT_VERSION record unchanged (identity at v1)', () => {
    const char = makeChar({ _v: CURRENT_VERSION });
    const result = runMigration(char);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.character).toEqual(char);
    expect(result.character._v).toBe(CURRENT_VERSION);
    expect(result.from).toBe(CURRENT_VERSION);
    expect(result.to).toBe(CURRENT_VERSION);
  });

  it('does not mutate the input object', () => {
    const char = makeChar({ _v: CURRENT_VERSION });
    const snapshot = structuredClone(char);
    runMigration(char);
    expect(char).toEqual(snapshot);
  });
});

describe('runMigration: legacy / missing _v', () => {
  // This app never shipped a v0 schema; its earliest persisted shape IS v1
  // (single-class + flat spellcasting). So a record with no _v is treated as
  // v1 (LEGACY_VERSION = 1) and STILL runs through MIGRATIONS[1] — it must be
  // reshaped to v2, not merely stamped to current with its v1 shape intact.
  it('treats a record with no _v as v1 and runs the v1→v2 reshape', () => {
    const legacy = makeChar();
    // Remove _v to simulate a legacy record.
    delete (legacy as Partial<Character>)._v;
    const result = runMigration(legacy);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.character._v).toBe(CURRENT_VERSION);
    expect(result.from).toBe(1);
    // All other fields preserved.
    expect(result.character.name).toBe('Migratee');
  });

  it('a no-_v record WITH a single class is reshaped to classes[] (not skipped)', () => {
    const legacy = makeChar({
      class: { id: 'cleric', level: 3 },
      level: 3,
    } as unknown as Partial<Character>);
    delete (legacy as Partial<Character>)._v;
    const result = runMigration(legacy);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const migrated = result.character as unknown as Record<string, unknown>;
    expect(migrated._v).toBe(CURRENT_VERSION);
    expect(migrated.classes).toEqual([{ id: 'cleric', level: 3 }]);
    expect('class' in migrated).toBe(false);
  });

  it('treats a non-numeric _v as v1 and reshapes', () => {
    const weird = { ...makeChar(), _v: 'one' as unknown as number };
    const result = runMigration(weird);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.from).toBe(1);
    expect(result.character._v).toBe(CURRENT_VERSION);
  });
});

describe('runMigration: future / unknown version', () => {
  it('does not downgrade a record from a newer app version', () => {
    const future = makeChar({ _v: CURRENT_VERSION + 5 });
    const result = runMigration(future);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // The runner never down-migrates; the record keeps its higher version.
    expect(result.character._v).toBe(CURRENT_VERSION + 5);
    expect(result.from).toBe(CURRENT_VERSION + 5);
  });
});

describe('runMigration: malformed input (total, never throws)', () => {
  it('returns a typed failure for null', () => {
    const result = runMigration(null);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/character object/i);
  });

  it('returns a typed failure for an array', () => {
    const result = runMigration([1, 2, 3]);
    expect(result.success).toBe(false);
  });

  it('returns a typed failure for a primitive', () => {
    expect(runMigration(42).success).toBe(false);
    expect(runMigration('nope').success).toBe(false);
    expect(runMigration(undefined).success).toBe(false);
  });

  it('upgrades a sparse object (only _v present) without throwing', () => {
    const result = runMigration({ _v: 0 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.character._v).toBe(CURRENT_VERSION);
  });
});

describe('runMigration: idempotence', () => {
  it('runMigration(runMigration(x)) deep-equals runMigration(x)', () => {
    const inputs: unknown[] = [
      makeChar({ _v: CURRENT_VERSION }),
      (() => {
        const c = makeChar();
        delete (c as Partial<Character>)._v;
        return c;
      })(),
      makeChar({ _v: CURRENT_VERSION + 2 }),
      { _v: 0, name: 'sparse', level: 1, abilities: {} },
      // A v2-shaped record (classes[] + byClass spellcasting) must stay stable:
      // at CURRENT_VERSION it is already current, so a second run is a no-op.
      makeChar({
        _v: 2,
        level: 3,
        classes: [{ id: 'wizard', level: 3 }],
        spellcasting: { byClass: { wizard: { cantrips: ['fire-bolt'] } }, slotsExpended: { 1: 1 } },
      }),
    ];
    for (const input of inputs) {
      const once = runMigration(input);
      expect(once.success).toBe(true);
      if (!once.success) continue;
      const twice = runMigration(once.character);
      expect(twice.success).toBe(true);
      if (!twice.success) continue;
      expect(twice.character).toEqual(once.character);
    }
  });
});

describe('migrateCharacter (read-path convenience)', () => {
  it('returns a CURRENT_VERSION character for a legacy record', () => {
    const legacy = makeChar();
    delete (legacy as Partial<Character>)._v;
    const migrated = migrateCharacter(legacy);
    expect(migrated._v).toBe(CURRENT_VERSION);
    expect(migrated.name).toBe('Migratee');
  });

  it('is an identity no-op for a current-version character', () => {
    const char = makeChar({ _v: CURRENT_VERSION });
    expect(migrateCharacter(char)).toEqual(char);
  });
});

describe('MIGRATIONS framework invariant', () => {
  it('registers the first real step (v1 → v2) at CURRENT_VERSION 2', () => {
    // Stage M1 ("Multiclassing") is the first breaking change: MIGRATIONS[1]
    // upgrades a v1 record to v2 and must be a function.
    expect(CURRENT_VERSION).toBeGreaterThanOrEqual(2);
    expect(MIGRATIONS[1], 'missing migration step from v1').toBeTypeOf('function');
  });

  it('has a registered step for every intermediate version from v1 up', () => {
    // Guards against a future CURRENT_VERSION bump that forgets to add its step.
    // v0 (pre-_v legacy) is the lowest version and is bridged by stamping, so a
    // step is required only from v1 upward (the first versioned schema).
    for (let v = 1; v < CURRENT_VERSION; v++) {
      expect(MIGRATIONS[v], `missing migration step from v${v}`).toBeTypeOf('function');
    }
  });
});
