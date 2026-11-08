/**
 * D1 per-use resource tracking: golden + oracle (FEAT-003).
 *
 * Golden: resources-golden.ts (authored from the PHB 2024, independent of the app values). This file maps the
 * golden vocabulary onto the app (`UsesCount`, `FeatureRecharge`) and checks:
 *  - MAX_CASES: every PHB-derived maximum at every listed level / ability / Proficiency Bonus input,
 *  - RECHARGE_CASES through shortRest / longRest and rechargeResources,
 *  - MULTICLASS_CASES, ADVERSARIAL_CASES, STALE_ID_RESTORE_CASE, SANITIZE_CASES,
 *  - CARDINALITY (exact tracker id sets per class / subclass / level, feats, invocations),
 *  - the EVERY-RECORD ORACLE over class + subclass features, allFeats() and INVOCATION_CATALOG, failing
 *    closed with `<class>/<subclass>/<feature>@L<n>` messages.
 */
import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Ability, Character, ClassEntry, FeatSelection } from '../../types/character';
import { ABILITIES } from '../../types/character';
import { CLASS_LIST, getClass } from '../../data/classes';
import type { FeatureRecharge, OwnUses, UsesCount } from '../../data/classes';
import { allFeats } from '../../data/feats';
import { INVOCATION_CATALOG } from '../../data/invocations';
import { setLevel } from '../advancement';
import { longRest, shortRest } from '../rests';
import {
  characterResources,
  clampResourcesSpent,
  rechargeResources,
  regainResource,
  resourceTrackers,
  sanitizeResourcesSpent,
  setResourceRemaining,
  spendResource,
} from '../resources';
import { sumComponents } from './breakdown-helpers';
import {
  ABILITY_SCORES_CASES,
  ADVERSARIAL_CASES,
  CLASS_COUNT_AT_20,
  CLASS_IDS_ADDED_AT,
  DIE_SIZE_BY_LEVEL,
  EXCLUSIONS,
  FEAT_ROWS,
  FEAT_TRACKER_IDS,
  INTERRUPTED_SHORT_REST_CASES,
  INVOCATION_ROWS,
  INVOCATION_TRACKER_IDS,
  LEVEL_MAX_CASES,
  LUCKY_CASES,
  MULTICLASS_CASES,
  POOL_MERGE_CASES,
  RECHARGE_CASES,
  SANITIZE_CASES,
  SANITIZE_MAX_ENTRIES,
  SANITIZE_OVERSIZE_COUNT,
  SPENDS_CASES,
  STALE_ID_RESTORE_CASE,
  SUBCLASS_CARDINALITY,
  TOTALS,
  TRACKER_ROWS,
  type GoldenClassEntry,
  type GoldenRechargeKind,
  type GoldenSteps,
  type GoldenTrackerRow,
  type MaxSpec,
} from './resources-golden';

// ─── helpers ─────────────────────────────────────────────────────────────────

interface BuildOptions {
  feats?: string[];
  abilityScores?: Partial<Record<Ability, number>>;
  resourcesSpent?: Record<string, number>;
  invocations?: string[];
}

function build(classes: readonly GoldenClassEntry[], options: BuildOptions = {}): Character {
  const base = createCharacter('Golden');
  const total = classes.reduce((sum, e) => sum + e.level, 0);
  const c: Character = {
    ...base,
    level: Math.min(20, total),
    classes: classes.map((e) => ({ id: e.classId, level: e.level, ...(e.subclassId ? { subclassId: e.subclassId } : {}) })) as unknown as ClassEntry[],
    abilities: { ...base.abilities, ...options.abilityScores },
  };
  if (options.feats) {
    c.advancement = {
      ...(c.advancement ?? {}),
      feats: options.feats.map((featId, i): FeatSelection => ({ featId, level: i }) as unknown as FeatSelection),
    } as Character['advancement'];
  }
  if (options.invocations) c.classChoices = { 'warlock.invocations': options.invocations };
  if (options.resourcesSpent) c.resourcesSpent = { ...options.resourcesSpent };
  return c;
}

/** Evaluate a golden MaxSpec independently of the app. */
function evalSpec(spec: MaxSpec, ownerLevel: number, totalLevel: number, score = 10): number {
  switch (spec.kind) {
    case 'fixed':
      return spec.value;
    case 'table': {
      let v = 0;
      for (const [level, value] of spec.rows) if (level <= ownerLevel) v = value;
      return v;
    }
    case 'multiple':
      return spec.factor * ownerLevel + (spec.offset ?? 0);
    case 'ability':
      return Math.max(spec.min, Math.floor((score - 10) / 2));
    case 'proficiency':
      return 2 + Math.floor((totalLevel - 1) / 4);
  }
}

/** Map the app's UsesCount onto the golden MaxSpec vocabulary. */
function toSpec(count: UsesCount): MaxSpec {
  if (typeof count === 'number') return { kind: 'fixed', value: count };
  switch (count.by) {
    case 'class-level':
      return { kind: 'table', rows: count.table };
    case 'class-level-multiple':
      return count.offset === undefined ? { kind: 'multiple', factor: count.factor } : { kind: 'multiple', factor: count.factor, offset: count.offset };
    case 'ability-mod':
      return { kind: 'ability', ability: count.ability, min: count.min as 1 };
    case 'proficiency-bonus':
      return { kind: 'proficiency' };
  }
}

const RECHARGE_MAP: Record<FeatureRecharge, GoldenRechargeKind> = {
  'short-rest': 'short-rest',
  'long-rest': 'long-rest',
  'short-or-long-rest': 'short-or-long-rest',
  'short-one-long-all': 'short-one-long-all',
  dawn: 'dawn',
  other: 'other',
};

const rowClasses = (row: GoldenTrackerRow, level: number): GoldenClassEntry[] => [
  { classId: row.classId!, level, ...(row.subclassId ? { subclassId: row.subclassId } : {}) },
];

/** The ids of a golden row once variants are expanded. */
const rowIds = (row: GoldenTrackerRow): string[] => (row.variants ? row.variants.map((_, i) => `${row.id}#${i}`) : [row.id]);

const ids = (c: Character): string[] => resourceTrackers(c).map((t) => t.id);

function stateOf(c: Character, id: string) {
  return characterResources(c).find((s) => s.id === id);
}

const stepValue = (steps: GoldenSteps, level: number): number => {
  let v = 0;
  for (const [l, value] of steps) if (l <= level) v = value;
  return v;
};

// ─── MAX_CASES ───────────────────────────────────────────────────────────────

describe('MAX_CASES: table and multiple pools at every owner class level', () => {
  for (const c of LEVEL_MAX_CASES) {
    const row = TRACKER_ROWS.find((r) => r.id === c.id);
    it(`${c.id} at level ${c.classLevel} = ${c.expectedMax}`, () => {
      expect(row, `${c.id}: no golden row`).toBeDefined();
      const character = build(rowClasses(row!, c.classLevel));
      const state = stateOf(character, c.id);
      // Not gained yet (expected 0) means the tracker is absent.
      expect(state?.max ?? 0).toBe(c.expectedMax);
      if (state) {
        expect(sumComponents(state.maxBreakdown)).toBe(state.max);
        expect(state.maxBreakdown.total).toBe(state.max);
      }
    });
  }
});

describe('MAX_CASES: every golden row at every class level 1..20 matches its MaxSpec', () => {
  for (const row of TRACKER_ROWS.filter((r) => r.ownerKind === 'class' || r.ownerKind === 'subclass')) {
    it(`${row.id}`, () => {
      for (let level = 1; level <= 20; level++) {
        const character = build(rowClasses(row, level));
        const expected = level >= row.fromLevel ? evalSpec(row.max, level, level, 10) : 0;
        for (const id of rowIds(row)) {
          const state = stateOf(character, id);
          expect(state?.max ?? 0, `${id} at level ${level}`).toBe(expected);
          if (state) expect(sumComponents(state.maxBreakdown), `${id} breakdown at ${level}`).toBe(state.max);
        }
      }
    });
  }
});

describe('MAX_CASES: die sizes by owner class level', () => {
  for (const [id, sizes] of Object.entries(DIE_SIZE_BY_LEVEL)) {
    const row = TRACKER_ROWS.find((r) => r.id === id)!;
    it(`${id}`, () => {
      sizes.forEach((expected, i) => {
        const state = stateOf(build(rowClasses(row, i + 1)), id);
        expect(state?.dieSize ?? 0, `${id} at level ${i + 1}`).toBe(expected);
      });
    });
  }
  for (const row of TRACKER_ROWS.filter((r) => typeof r.dieSize === 'number')) {
    it(`${row.id} fixed die d${row.dieSize}`, () => {
      const level = row.ownerKind === 'feat' ? 1 : Math.max(row.fromLevel, 1);
      const character =
        row.ownerKind === 'feat' ? build([{ classId: 'fighter', level }], { feats: [row.featId!] }) : build(rowClasses(row, level));
      expect(stateOf(character, rowIds(row)[0])?.dieSize).toBe(row.dieSize);
    });
  }
  it('step tables in the rows agree with DIE_SIZE_BY_LEVEL', () => {
    for (const row of TRACKER_ROWS) {
      const table = row.dieSize;
      if (typeof table === 'number' || table === undefined || !DIE_SIZE_BY_LEVEL[row.id]) continue;
      DIE_SIZE_BY_LEVEL[row.id].forEach((size, i) => expect(stepValue(table, i + 1), `${row.id} L${i + 1}`).toBe(size));
    }
  });
});

describe('MAX_CASES: ability-modifier pools (minimum 1) at scores 1,8,9,10,12,14,18,20,30', () => {
  const abilityRows = TRACKER_ROWS.filter((r) => r.max.kind === 'ability' && (r.ownerKind === 'class' || r.ownerKind === 'subclass'));
  for (const row of abilityRows) {
    it(`${row.id}`, () => {
      const ability = (row.max as Extract<MaxSpec, { kind: 'ability' }>).ability;
      for (const { score, expectedMax } of ABILITY_SCORES_CASES) {
        const character = build(rowClasses(row, 20), { abilityScores: { [ability]: score } });
        const state = stateOf(character, row.id);
        expect(state?.max, `${row.id} with ${ability} ${score}`).toBe(expectedMax);
        expect(sumComponents(state!.maxBreakdown)).toBe(state!.max);
      }
    });
  }
  it('feat ability increases count (effective score) and the minimum shows in the breakdown', () => {
    // Bard 1, Cha 8 (-1), a feat adding +2 Cha is not needed to prove the min component: Cha 8 -> mod -1 + min 2 = 1.
    const state = stateOf(build([{ classId: 'bard', level: 1 }], { abilityScores: { cha: 8 } }), 'bard.bardic-inspiration')!;
    expect(state.maxBreakdown.components).toEqual([
      { label: 'Charisma modifier', value: -1 },
      { label: 'Minimum of 1', value: 2 },
    ]);
    const high = stateOf(build([{ classId: 'bard', level: 1 }], { abilityScores: { cha: 16 } }), 'bard.bardic-inspiration')!;
    expect(high.maxBreakdown.components).toEqual([
      { label: 'Charisma modifier', value: 3 },
      { label: 'Minimum of 1', value: 0 },
    ]);
  });
});

describe('MAX_CASES: Lucky Luck Points = Proficiency Bonus from TOTAL level', () => {
  for (const { totalLevel, expectedMax } of LUCKY_CASES) {
    it(`total level ${totalLevel} = ${expectedMax}`, () => {
      const character = build([{ classId: 'fighter', level: totalLevel }], { feats: ['lucky'] });
      const state = stateOf(character, 'feat:lucky.luck-points')!;
      expect(state.max).toBe(expectedMax);
      expect(sumComponents(state.maxBreakdown)).toBe(expectedMax);
    });
  }
});

describe('MAX_CASES: fixed feat / invocation pools', () => {
  for (const row of [...FEAT_ROWS, ...INVOCATION_ROWS].filter((r) => r.max.kind === 'fixed')) {
    it(`${row.id} = ${(row.max as { value: number }).value}`, () => {
      const character =
        row.ownerKind === 'feat'
          ? build([{ classId: 'fighter', level: 20 }], { feats: [row.featId!] })
          : build([{ classId: 'warlock', level: 20 }], { invocations: [row.invocationId!] });
      for (const id of rowIds(row)) expect(stateOf(character, id)?.max, id).toBe((row.max as { value: number }).value);
    });
  }
});

// ─── RECHARGE_CASES ──────────────────────────────────────────────────────────

/** A real tracker whose maximum equals the golden case's `max` for each recharge kind. */
const RECHARGE_FIXTURE: Record<string, { classes: GoldenClassEntry[]; id: string }> = {
  'short-one-long-all:6': { classes: [{ classId: 'fighter', level: 5, subclassId: 'psiWarrior' }], id: 'fighter.psionic-energy-dice' },
  'short-or-long-rest:5': { classes: [{ classId: 'fighter', level: 7, subclassId: 'battleMaster' }], id: 'fighter.superiority-dice' },
  'long-rest:5': { classes: [{ classId: 'paladin', level: 1 }], id: 'paladin.lay-on-hands' },
  'long-rest:1': { classes: [{ classId: 'wizard', level: 1 }], id: 'wizard.arcane-recovery' },
  'other:3': { classes: [{ classId: 'barbarian', level: 3 }], id: 'barbarian.rage' },
  'dawn:3': { classes: [{ classId: 'barbarian', level: 3 }], id: 'barbarian.rage' },
};

/** Temporarily rewrite one catalog feature's recharge ('other' / 'dawn' have no PHB feature to test with). */
function withRecharge<T>(classId: string, featureName: string, recharge: FeatureRecharge, fn: () => T): T {
  const feature = getClass(classId)!.features.find((f) => f.name === featureName)!;
  const uses = feature.uses as OwnUses;
  const original = uses.recharge;
  uses.recharge = recharge;
  try {
    return fn();
  } finally {
    uses.recharge = original;
  }
}

describe('RECHARGE_CASES through shortRest / longRest', () => {
  for (const c of RECHARGE_CASES) {
    const fixture = RECHARGE_FIXTURE[`${c.recharge}:${c.max}`];
    const run = <T,>(fn: () => T): T => {
      if (c.recharge === 'other' || c.recharge === 'dawn') return withRecharge('barbarian', 'Rage', c.recharge, fn);
      return fn();
    };
    it(c.name, () => {
      expect(fixture, `no fixture for ${c.recharge}:${c.max}`).toBeDefined();
      run(() => {
        const start = build(fixture.classes, { resourcesSpent: { [fixture.id]: c.spentBefore } });
        expect(stateOf(start, fixture.id)!.max).toBe(c.max);
        expect(stateOf(start, fixture.id)!.recharge).toBe(c.recharge);

        const short = shortRest(start, { rolls: [] });
        expect(short.outcome).toBe('completed');
        expect(stateOf(short.character, fixture.id)!.remaining).toBe(c.remainingAfterShort);
        const shortEntry = short.resourcesRecovered?.find((r) => r.id === fixture.id);
        expect(shortEntry?.rule ?? null).toBe(c.shortRule);
        if (shortEntry) {
          expect(shortEntry.before).toBe(c.max - c.spentBefore);
          expect(shortEntry.after).toBe(c.remainingAfterShort);
          expect(shortEntry.max).toBe(c.max);
        }

        const long = longRest(start);
        expect(long.outcome).toBe('completed');
        expect(stateOf(long.character, fixture.id)!.remaining).toBe(c.remainingAfterLong);
        const longEntry = long.resourcesRecovered?.find((r) => r.id === fixture.id);
        expect(longEntry?.rule ?? null).toBe(c.longRule);
      });
    });
  }

  it("'short-rest' (unused by the PHB) regains all on a Short Rest only", () => {
    withRecharge('barbarian', 'Rage', 'short-rest', () => {
      const start = build([{ classId: 'barbarian', level: 3 }], { resourcesSpent: { 'barbarian.rage': 2 } });
      expect(stateOf(shortRest(start, { rolls: [] }).character, 'barbarian.rage')!.remaining).toBe(3);
      expect(stateOf(rechargeResources(start, 'long').character, 'barbarian.rage')!.remaining).toBe(1);
    });
  });

  for (const c of INTERRUPTED_SHORT_REST_CASES) {
    it(`an interrupted Short Rest recovers nothing (${c.recharge}, max ${c.max})`, () => {
      const fixture = RECHARGE_FIXTURE[`${c.recharge}:${c.max}`];
      const start = build(fixture.classes, { resourcesSpent: { [fixture.id]: c.spentBefore } });
      const r = shortRest(start, { rolls: [], interrupted: true });
      expect(r.outcome).toBe('interrupted');
      expect(r.character).toBe(start);
      expect(r.resourcesRecovered).toBeUndefined();
    });
  }

  it('no catalog feature uses the manual recharge kinds dawn / short-rest', () => {
    const used = new Set<string>();
    for (const row of TRACKER_ROWS) used.add(row.recharge);
    expect(used.has('dawn')).toBe(false);
    expect(used.has('short-rest')).toBe(false);
  });
});

// ─── MULTICLASS_CASES ────────────────────────────────────────────────────────

describe('MULTICLASS_CASES', () => {
  for (const c of MULTICLASS_CASES) {
    it(c.name, () => {
      const character = build(c.classes, { feats: c.feats, abilityScores: c.abilityScores });
      for (const [id, max] of Object.entries(c.expectMax)) {
        expect(stateOf(character, id)?.max, `${id} (${c.rule})`).toBe(max);
      }
      for (const id of c.expectAbsent ?? []) expect(ids(character), `${id} must be absent (${c.rule})`).not.toContain(id);
      expect(new Set(ids(character)).size, 'tracker ids are unique').toBe(ids(character).length);
    });
  }

  it('Cleric 6 / Paladin 3: two separate Channel Divinity trackers (3 and 2), never merged', () => {
    const character = build([{ classId: 'cleric', level: 6 }, { classId: 'paladin', level: 3 }]);
    const cd = characterResources(character).filter((s) => s.name === 'Channel Divinity');
    expect(cd.map((s) => [s.id, s.max])).toEqual([
      ['cleric.channel-divinity', 3],
      ['paladin.channel-divinity', 2],
    ]);
    // Spending one pool does not touch the other.
    const spent = spendResource(character, 'cleric.channel-divinity');
    expect(stateOf(spent, 'cleric.channel-divinity')!.remaining).toBe(2);
    expect(stateOf(spent, 'paladin.channel-divinity')!.remaining).toBe(2);
  });

  it('Psi Warrior 5 / Soulknife 5: Psionic Energy Dice pools are separate and independent', () => {
    const character = build([
      { classId: 'fighter', level: 5, subclassId: 'psiWarrior' },
      { classId: 'rogue', level: 5, subclassId: 'soulknife' },
    ]);
    const spent = spendResource(character, 'fighter.psionic-energy-dice', 2);
    expect(stateOf(spent, 'fighter.psionic-energy-dice')!.remaining).toBe(4);
    expect(stateOf(spent, 'rogue.psionic-energy-dice')!.remaining).toBe(6);
  });
});

// ─── ADVERSARIAL_CASES ───────────────────────────────────────────────────────

function applyOp(c: Character, op: (typeof ADVERSARIAL_CASES)[number]['steps'][number]['do']): Character {
  switch (op.op) {
    case 'spend':
      return spendResource(c, op.id, op.amount);
    case 'regain':
      return regainResource(c, op.id, op.amount);
    case 'setRemaining':
      return setResourceRemaining(c, op.id, op.remaining);
    case 'setClassLevel':
      return setLevel(c, op.level);
  }
}

describe('ADVERSARIAL_CASES', () => {
  for (const c of ADVERSARIAL_CASES) {
    it(c.name, () => {
      let current = build(c.classes, { resourcesSpent: c.spentBefore });
      c.steps.forEach((step, n) => {
        const before = current;
        current = applyOp(before, step.do);
        const label = `step ${n + 1} (${JSON.stringify(step.do)})`;
        if (step.expect.sameObject) expect(current, `${label}: same object`).toBe(before);
        for (const [id, spent] of Object.entries(step.expect.spent ?? {})) {
          expect(current.resourcesSpent?.[id] ?? 0, `${label}: spent ${id}`).toBe(spent);
        }
        for (const [id, remaining] of Object.entries(step.expect.remaining ?? {})) {
          expect(stateOf(current, id)?.remaining, `${label}: remaining ${id}`).toBe(remaining);
        }
        for (const [id, max] of Object.entries(step.expect.max ?? {})) {
          expect(stateOf(current, id)?.max, `${label}: max ${id}`).toBe(max);
        }
        // Invariant for every step: remaining is an integer in 0..max.
        for (const s of characterResources(current)) {
          expect(Number.isInteger(s.remaining) && s.remaining >= 0 && s.remaining <= s.max, `${label}: invariant ${s.id}`).toBe(true);
        }
      });
    });
  }

  it(STALE_ID_RESTORE_CASE.name, () => {
    const without = build(STALE_ID_RESTORE_CASE.baseClasses, { resourcesSpent: STALE_ID_RESTORE_CASE.resourcesSpent });
    expect(ids(without)).not.toContain(STALE_ID_RESTORE_CASE.expectHiddenWithoutWizard);
    expect(without.resourcesSpent).toEqual(STALE_ID_RESTORE_CASE.resourcesSpent);
    expect(clampResourcesSpent(without)).toBe(without);
    const withWizard = build(STALE_ID_RESTORE_CASE.withWizard, { resourcesSpent: STALE_ID_RESTORE_CASE.resourcesSpent });
    const state = stateOf(withWizard, STALE_ID_RESTORE_CASE.expectHiddenWithoutWizard)!;
    expect({ max: state.max, spent: state.spent, remaining: state.remaining }).toEqual(STALE_ID_RESTORE_CASE.expectedWithWizard);
  });

  it('stored spent above the maximum reads as clamped and clampResourcesSpent rewrites it', () => {
    const c = build([{ classId: 'fighter', level: 1 }], { resourcesSpent: { 'fighter.second-wind': 9 } });
    expect(stateOf(c, 'fighter.second-wind')).toMatchObject({ spent: 2, remaining: 0 });
    expect(clampResourcesSpent(c).resourcesSpent).toEqual({ 'fighter.second-wind': 2 });
  });

  it('regaining the last spent use removes the key, and the field when empty', () => {
    const c = build([{ classId: 'fighter', level: 1 }], { resourcesSpent: { 'fighter.second-wind': 1 } });
    expect(regainResource(c, 'fighter.second-wind').resourcesSpent).toBeUndefined();
  });

  it('spend and regain never mutate their input', () => {
    const c = build([{ classId: 'fighter', level: 1 }], { resourcesSpent: { 'fighter.second-wind': 1 } });
    const snapshot = JSON.stringify(c);
    spendResource(c, 'fighter.second-wind');
    regainResource(c, 'fighter.second-wind');
    setResourceRemaining(c, 'fighter.second-wind', 0);
    expect(JSON.stringify(c)).toBe(snapshot);
  });
});

// ─── sanitizeResourcesSpent ──────────────────────────────────────────────────

describe('SANITIZE_CASES', () => {
  for (const c of SANITIZE_CASES) {
    it(c.name, () => {
      const input = c.inputJson !== undefined ? JSON.parse(c.inputJson) : c.input;
      const out = sanitizeResourcesSpent(input);
      expect(out).toEqual(c.expected);
      expect(Object.getPrototypeOf(out ?? {})).toBe(Object.prototype);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  }
  it(`more than ${SANITIZE_MAX_ENTRIES} valid entries keeps exactly ${SANITIZE_MAX_ENTRIES}`, () => {
    const input: Record<string, number> = {};
    for (let i = 0; i < SANITIZE_OVERSIZE_COUNT; i++) input[`k${String(i).padStart(4, '0')}`] = 1;
    const out = sanitizeResourcesSpent(input)!;
    expect(Object.keys(out)).toHaveLength(SANITIZE_MAX_ENTRIES);
    expect(Object.keys(out)).toEqual(Object.keys(input).slice(0, SANITIZE_MAX_ENTRIES));
  });
});

// ─── CARDINALITY ─────────────────────────────────────────────────────────────

const unionUpTo = (added: Record<number, string[]>, level: number): string[] =>
  Object.entries(added)
    .filter(([l]) => Number(l) <= level)
    .flatMap(([, list]) => list);

describe('CARDINALITY: class trackers per level (no subclass)', () => {
  it('covers all 12 classes', () => {
    expect(Object.keys(CLASS_IDS_ADDED_AT).sort()).toEqual(CLASS_LIST.map((c) => c.id).sort());
  });
  for (const [classId, added] of Object.entries(CLASS_IDS_ADDED_AT)) {
    it(`${classId}: exact id set at every level 1..20`, () => {
      for (let level = 1; level <= 20; level++) {
        expect(ids(build([{ classId, level }])).sort(), `${classId} L${level}`).toEqual(unionUpTo(added, level).sort());
      }
    });
    it(`${classId}: ${CLASS_COUNT_AT_20[classId]} trackers at level 20`, () => {
      expect(ids(build([{ classId, level: 20 }]))).toHaveLength(CLASS_COUNT_AT_20[classId]);
    });
  }
});

describe('CARDINALITY: subclass trackers per level', () => {
  it('covers all 48 subclasses', () => {
    expect(SUBCLASS_CARDINALITY).toHaveLength(48);
    const catalog = CLASS_LIST.flatMap((c) => c.subclasses.map((s) => `${c.id}/${s.id}`)).sort();
    expect(SUBCLASS_CARDINALITY.map((s) => `${s.classId}/${s.subclassId}`).sort()).toEqual(catalog);
  });
  for (const s of SUBCLASS_CARDINALITY) {
    it(`${s.classId}/${s.subclassId}: exact ADDITIONAL ids at every level 1..20`, () => {
      for (let level = 1; level <= 20; level++) {
        const classOnly = new Set(ids(build([{ classId: s.classId, level }])));
        const added = ids(build([{ classId: s.classId, level, subclassId: s.subclassId }])).filter((id) => !classOnly.has(id));
        expect(added.sort(), `${s.classId}/${s.subclassId} L${level}`).toEqual(unionUpTo(s.addedAt, level).sort());
      }
      const classOnly = new Set(ids(build([{ classId: s.classId, level: 20 }])));
      const extra = ids(build([{ classId: s.classId, level: 20, subclassId: s.subclassId }])).filter((id) => !classOnly.has(id));
      expect(extra).toHaveLength(s.countAt20);
    });
  }
});

describe('CARDINALITY: feats and invocations', () => {
  for (const [featId, expected] of Object.entries(FEAT_TRACKER_IDS)) {
    it(`feat ${featId}`, () => {
      const c = build([{ classId: 'fighter', level: 1 }], { feats: [featId] });
      expect(ids(c).filter((id) => id.startsWith('feat:')).sort()).toEqual([...expected].sort());
    });
  }
  it('every feat in the catalog without a golden row adds no tracker', () => {
    for (const feat of allFeats()) {
      if (FEAT_TRACKER_IDS[feat.id]) continue;
      const c = build([{ classId: 'fighter', level: 1 }], { feats: [feat.id] });
      expect(ids(c).filter((id) => id.startsWith('feat:')), `feat ${feat.id}`).toEqual([]);
    }
  });
  it('a repeated feat adds an @n suffix to the n-th repeat', () => {
    const c = build([{ classId: 'fighter', level: 8 }], { feats: ['lucky', 'lucky'] });
    expect(ids(c).filter((id) => id.startsWith('feat:')).sort()).toEqual(['feat:lucky.luck-points', 'feat:lucky@1.luck-points']);
  });
  for (const [invocationId, expected] of Object.entries(INVOCATION_TRACKER_IDS)) {
    it(`invocation ${invocationId}`, () => {
      const c = build([{ classId: 'warlock', level: 9 }], { invocations: [invocationId] });
      expect(ids(c).filter((id) => id.startsWith('warlock.invocation-'))).toEqual(expected);
    });
  }
  it('an invocation id of a non-Warlock character adds nothing', () => {
    const c = build([{ classId: 'fighter', level: 9 }], { invocations: ['gift-of-the-depths'] });
    expect(ids(c).filter((id) => id.startsWith('warlock.invocation-'))).toEqual([]);
  });
});

describe('CARDINALITY: totals, pool merges and spends links', () => {
  it('golden totals match the expanded row ids', () => {
    const count = (kind: GoldenTrackerRow['ownerKind']): number =>
      TRACKER_ROWS.filter((r) => r.ownerKind === kind).reduce((n, r) => n + rowIds(r).length, 0);
    expect(count('class')).toBe(TOTALS.classIds);
    expect(count('subclass')).toBe(TOTALS.subclassIds);
    expect(count('feat')).toBe(TOTALS.featIds);
    expect(count('invocation')).toBe(TOTALS.invocationIds);
  });

  for (const m of POOL_MERGE_CASES) {
    it(`${m.id} is ONE tracker merging ${m.features.join(' + ')}`, () => {
      const trackers = resourceTrackers(build([{ classId: m.classId, level: m.level, ...(m.subclassId ? { subclassId: m.subclassId } : {}) }])).filter(
        (t) => t.id === m.id,
      );
      expect(trackers).toHaveLength(1);
      expect(trackers[0].featureNames).toEqual(expect.arrayContaining(m.features));
    });
  }

  it('Bardic Inspiration switches to Short or Long Rest at level 5 (Font of Inspiration, L2820)', () => {
    expect(stateOf(build([{ classId: 'bard', level: 4 }]), 'bard.bardic-inspiration')!.recharge).toBe('long-rest');
    expect(stateOf(build([{ classId: 'bard', level: 5 }]), 'bard.bardic-inspiration')!.recharge).toBe('short-or-long-rest');
  });

  for (const s of SPENDS_CASES) {
    it(`${s.classId}/${s.subclassId}/${s.feature} spends ${s.spends} and is never a tracker`, () => {
      const trackers = resourceTrackers(build([{ classId: s.classId, level: 20, subclassId: s.subclassId }]));
      const parent = trackers.find((t) => t.id === s.spends);
      expect(parent, `parent pool ${s.spends}`).toBeDefined();
      expect(parent!.spendsFeatures.map((f) => f.name)).toContain(s.feature);
      expect(trackers.map((t) => t.name)).not.toContain(s.feature);
    });
  }
});

// ─── EVERY-RECORD ORACLE ─────────────────────────────────────────────────────

const slug = (n: string): string => n.toLowerCase().replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

interface CatalogRecord {
  label: string;
  kind: GoldenTrackerRow['ownerKind'];
  classId?: string;
  subclassId?: string;
  featId?: string;
  invocationId?: string;
  name: string;
  level: number;
  uses?: unknown;
  text: string;
}

function catalogRecords(): CatalogRecord[] {
  const out: CatalogRecord[] = [];
  for (const cls of CLASS_LIST) {
    for (const f of cls.features) {
      out.push({ label: `${cls.id}/-/${f.name}@L${f.level}`, kind: 'class', classId: cls.id, name: f.name, level: f.level, uses: f.uses, text: f.effect });
    }
    for (const sub of cls.subclasses) {
      for (const f of sub.features) {
        out.push({
          label: `${cls.id}/${sub.id}/${f.name}@L${f.level}`,
          kind: 'subclass',
          classId: cls.id,
          subclassId: sub.id,
          name: f.name,
          level: f.level,
          uses: f.uses,
          text: f.effect,
        });
      }
    }
  }
  for (const feat of allFeats()) {
    out.push({ label: `feat/-/${feat.name}@L0`, kind: 'feat', featId: feat.id, name: feat.name, level: 0, uses: feat.uses, text: feat.effect });
  }
  for (const inv of Object.values(INVOCATION_CATALOG)) {
    out.push({ label: `warlock/invocation/${inv.name}@L${inv.minLevel}`, kind: 'invocation', classId: 'warlock', invocationId: inv.id, name: inv.name, level: inv.minLevel, uses: inv.uses, text: inv.summary });
  }
  return out;
}

const isSpends = (u: unknown): u is { spends: string } => typeof u === 'object' && u !== null && 'spends' in u;

/** Pool id helper for catalog records that own a pool. */
function poolOf(record: CatalogRecord, u: OwnUses): string {
  return u.pool ?? slug(record.name);
}

function trackerIdOf(record: CatalogRecord, u: OwnUses): string {
  if (record.kind === 'feat') return `feat:${record.featId}.${poolOf(record, u)}`;
  if (record.kind === 'invocation') return `warlock.invocation-${record.invocationId}`;
  return `${record.classId}.${poolOf(record, u)}`;
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function validateTable(label: string, table: ReadonlyArray<readonly [number, number]>, problems: string[], featureLevel?: number): void {
  if (table.length === 0) problems.push(`${label}: empty level table`);
  for (let i = 1; i < table.length; i++) {
    if (!(table[i][0] > table[i - 1][0])) problems.push(`${label}: level table is not strictly ascending`);
  }
  if (table.length > 0 && featureLevel !== undefined && table[0][0] > featureLevel) {
    problems.push(`${label}: level table starts at L${table[0][0]}, above the feature level`);
  }
}

describe('EVERY-RECORD ORACLE (fails closed, names the feature)', () => {
  const records = catalogRecords();

  it('every record with `uses` is valid and matches its golden row', () => {
    const problems: string[] = [];
    const groups = new Map<string, CatalogRecord[]>();
    const classPools = new Map<string, Set<string>>();

    for (const r of records) {
      if (r.uses === undefined) continue;
      if (isSpends(r.uses)) continue;
      const u = r.uses as OwnUses | OwnUses[];
      for (const own of Array.isArray(u) ? u : [u]) {
        if (typeof own.count === 'string') problems.push(`${r.label}: legacy string count "${own.count as string}"`);
        if (typeof own.count === 'object') {
          if (own.count.by === 'class-level') validateTable(r.label, own.count.table, problems, r.level);
          if (own.count.by === 'ability-mod' && !(own.count.min >= 1)) problems.push(`${r.label}: ability-mod min < 1`);
        }
        if (typeof own.dieSize === 'object') validateTable(`${r.label} dieSize`, own.dieSize, problems);
        if (r.kind === 'feat' && own.pool === undefined) problems.push(`${r.label}: feat pool is required`);
        const id = trackerIdOf(r, own);
        const list = groups.get(id) ?? [];
        list.push({ ...r, uses: own });
        groups.set(id, list);
        if (r.classId && r.kind !== 'feat') {
          const set = classPools.get(r.classId) ?? new Set<string>();
          set.add(poolOf(r, own));
          classPools.set(r.classId, set);
        }
      }
    }

    // spends links point at a pool of the same class.
    for (const r of records) {
      if (!isSpends(r.uses)) continue;
      const pool = r.uses.spends;
      if (!r.classId || !classPools.get(r.classId)?.has(pool)) problems.push(`${r.label}: spends unknown pool "${pool}"`);
      if (!SPENDS_CASES.some((s) => s.classId === r.classId && s.subclassId === r.subclassId && s.feature === r.name && s.spends === `${r.classId}.${pool}`)) {
        problems.push(`${r.label}: spends link has no golden SPENDS_CASES row`);
      }
    }
    for (const s of SPENDS_CASES) {
      const found = records.find((r) => r.classId === s.classId && r.subclassId === s.subclassId && r.name === s.feature && isSpends(r.uses));
      if (!found) problems.push(`${s.classId}/${s.subclassId}/${s.feature}: golden spends row has no catalog record`);
    }

    // Each catalog pool has a golden row and agrees with it.
    const expectedIds = new Set(TRACKER_ROWS.map((r) => r.id));
    for (const [id, group] of groups) {
      const sorted = [...group].sort((a, b) => a.level - b.level);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const label = `${last.label} [${id}]`;
      const row = TRACKER_ROWS.find((r) => r.id === id);
      if (!row) {
        problems.push(`${label}: no golden row (unknown tracker)`);
        continue;
      }
      const firstUses = first.uses as OwnUses;
      const lastUses = last.uses as OwnUses;
      if (row.ownerKind !== first.kind) problems.push(`${label}: owner kind ${first.kind} != golden ${row.ownerKind}`);
      if (row.subclassId !== first.subclassId) problems.push(`${label}: subclass ${first.subclassId} != golden ${row.subclassId}`);
      if (row.ownerKind === 'class' || row.ownerKind === 'subclass') {
        if (row.fromLevel !== first.level) problems.push(`${label}: first level L${first.level} != golden L${row.fromLevel}`);
      }
      if (!sameJson(toSpec(lastUses.count), row.max)) {
        problems.push(`${label}: count ${JSON.stringify(toSpec(lastUses.count))} != golden ${JSON.stringify(row.max)}`);
      }
      if (RECHARGE_MAP[firstUses.recharge] !== row.recharge) problems.push(`${label}: recharge ${firstUses.recharge} != golden ${row.recharge}`);
      // Later recharge changes.
      const changes: Array<[number, GoldenRechargeKind]> = [];
      let current = firstUses.recharge;
      for (const g of sorted.slice(1)) {
        const rc = (g.uses as OwnUses).recharge;
        if (rc !== current) {
          changes.push([g.level, RECHARGE_MAP[rc]]);
          current = rc;
        }
      }
      if (!sameJson(changes, row.rechargeFrom ?? [])) problems.push(`${label}: recharge changes ${JSON.stringify(changes)} != golden ${JSON.stringify(row.rechargeFrom ?? [])}`);
      const declared = <K extends 'unit' | 'dieSize' | 'variants' | 'alsoRestoredBy'>(k: K): OwnUses[K] | undefined =>
        [...sorted].reverse().map((g) => (g.uses as OwnUses)[k]).find((v) => v !== undefined);
      if (!sameJson(declared('unit'), row.unit)) problems.push(`${label}: unit ${JSON.stringify(declared('unit'))} != golden ${JSON.stringify(row.unit)}`);
      if (!sameJson(declared('dieSize'), row.dieSize)) problems.push(`${label}: dieSize ${JSON.stringify(declared('dieSize'))} != golden ${JSON.stringify(row.dieSize)}`);
      if (!sameJson(declared('variants'), row.variants)) problems.push(`${label}: variants ${JSON.stringify(declared('variants'))} != golden ${JSON.stringify(row.variants)}`);
      if ((declared('alsoRestoredBy') !== undefined) !== (row.alsoRestoredBy !== undefined)) problems.push(`${label}: alsoRestoredBy presence differs from golden`);
      // Features of one pool must agree on the unit.
      const units = sorted.map((g) => (g.uses as OwnUses).unit).filter((v) => v !== undefined);
      if (units.some((v) => !sameJson(v, units[0]))) problems.push(`${label}: features of one pool disagree on unit`);
      if (row.ownerKind === 'feat' && row.featId !== first.featId) problems.push(`${label}: feat id differs from golden`);
    }
    // Golden rows with no catalog record.
    for (const id of expectedIds) {
      if (!groups.has(id)) problems.push(`${id}: golden row has no catalog record (missing)`);
    }
    expect(groups.size, 'catalog pool count equals golden row count').toBe(TRACKER_ROWS.length);
    expect(problems).toEqual([]);
  });

  it('every EXCLUSIONS entry carries a reason and a PHB line', () => {
    for (const e of EXCLUSIONS) {
      expect(e.reason.length, `${e.owner}/${e.feature}`).toBeGreaterThan(10);
      expect(e.phbLines.length, `${e.owner}/${e.feature}`).toBeGreaterThan(0);
    }
  });

  it('no record mentions a Short / Long Rest recharge in its text without `uses`, unless it is in EXCLUSIONS', () => {
    const problems: string[] = [];
    const excluded = (r: CatalogRecord): boolean =>
      EXCLUSIONS.some((e) => (r.featId !== undefined && e.owner === `feat:${r.featId}`) || e.feature.toLowerCase().includes(r.name.toLowerCase()) || e.feature.toLowerCase().split(/ \/ | and |, /).some((p) => p.trim() === r.name.toLowerCase()));
    for (const r of records) {
      if (r.uses !== undefined) continue;
      if (!/(once|regain|restor|recharge|expend|until you (finish|complete)).{0,80}(short|long) rest|(short|long) rest.{0,40}(regain|restor|recharge)/i.test(r.text)) continue;
      if (excluded(r)) continue;
      problems.push(`${r.label}: text mentions a rest recharge but the record has no \`uses\` and is not in EXCLUSIONS`);
    }
    expect(problems).toEqual([]);
  });

  it('the oracle reports a clear message for an unknown tracker (fail-closed self check)', () => {
    const fake = { ...records.find((r) => r.name === 'Rage')!, uses: { count: 2, recharge: 'long-rest', pool: 'not-a-real-pool' } as OwnUses };
    const id = trackerIdOf(fake, fake.uses as OwnUses);
    expect(TRACKER_ROWS.some((r) => r.id === id)).toBe(false);
    expect(fake.label).toBe('barbarian/-/Rage@L1');
  });

  it('abilities used by ability-mod rows are valid abilities', () => {
    for (const row of TRACKER_ROWS) {
      if (row.max.kind === 'ability') expect(ABILITIES).toContain(row.max.ability);
    }
  });
});
