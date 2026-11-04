import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { SpellId } from '../../data/spells';
import type { Character } from '../../types/character';
import { sumComponents } from './breakdown-helpers';
import {
  concentrationCheck,
  concentrationSave,
  constitutionSaveBreakdown,
  endConcentration,
  endConcentrationIfBroken,
  resolveConcentrationSave,
  shouldEndConcentration,
  startConcentration,
} from '../concentration';
import { setExhaustion } from '../conditions';
import { effectiveConditionIds } from '../hit-points-state';
import {
  CONCENTRATION_DC_CASES,
  CONCENTRATION_END_CASES,
  CONCENTRATION_SAVE_CASES,
  CONCENTRATION_START_CASES,
  type ConcentrationDcCase,
  type ConcentrationEndCase,
  type ConcentrationSaveCase,
} from './rest-golden';

const spell = (id: string): SpellId => id as SpellId;

/** Map a golden END row to a real character. */
function endCharacter(i: ConcentrationEndCase['input']): Character {
  let c: Character = { ...createCharacter('Tester'), hpMax: i.max };
  if (i.hp < i.max) c.currentHp = i.hp;
  if (i.concentrating) c.concentration = { spellId: spell('bless') };
  if (i.storedConditions.length > 0) {
    c.conditions = i.storedConditions.map((id) => ({ id: id as never }));
  }
  if (i.dead) c.dead = true;
  if (i.exhaustion) c = setExhaustion(c, i.exhaustion);
  return c;
}

// The comparators return every mismatch, so the same code that passes the real
// functions can be shown to FAIL a mutant (fail-closed proof below).
function dcMismatches(row: ConcentrationDcCase, actual: ReturnType<typeof concentrationCheck>): string[] {
  const out: string[] = [];
  if (actual.required !== row.required) out.push('required');
  if (actual.dc !== row.dc) out.push('dc');
  if (row.required) {
    const total = actual.breakdown?.total;
    if (total !== row.dc) out.push('breakdown total');
    if (actual.breakdown && sumComponents(actual.breakdown) !== actual.breakdown.total) out.push('breakdown sum');
    if (!actual.breakdown) out.push('breakdown missing');
  } else if (actual.breakdown !== undefined) {
    out.push('breakdown present');
  }
  return out;
}

function saveMismatches(row: ConcentrationSaveCase, actual: ReturnType<typeof concentrationSave>): string[] {
  const out: string[] = [];
  if (actual.total !== row.expect.total) out.push('total');
  if (actual.success !== row.expect.success) out.push('success');
  if (sumComponents(actual.breakdown) !== actual.breakdown.total) out.push('breakdown sum');
  return out;
}

describe('golden CONCENTRATION_DC_CASES', () => {
  for (const row of CONCENTRATION_DC_CASES) {
    it(`damage ${row.damage}`, () => {
      expect(dcMismatches(row, concentrationCheck(row.damage))).toEqual([]);
    });
  }

  it('shows the three DC steps, including zero and a negative cap step', () => {
    const low = concentrationCheck(5).breakdown!;
    expect(low.components.map((c) => c.value)).toEqual([10, 0, 0]);
    const mid = concentrationCheck(30).breakdown!;
    expect(mid.components.map((c) => c.value)).toEqual([10, 5, 0]);
    const capped = concentrationCheck(100).breakdown!;
    expect(capped.components.map((c) => c.value)).toEqual([10, 40, -20]);
    expect(capped.total).toBe(30);
  });

  it('treats negative, fractional and non-finite damage safely', () => {
    expect(concentrationCheck(-5).required).toBe(false);
    expect(concentrationCheck(Number.NaN).required).toBe(false);
    expect(concentrationCheck(23.9).dc).toBe(11);
  });
});

describe('golden CONCENTRATION_SAVE_CASES', () => {
  for (const row of CONCENTRATION_SAVE_CASES) {
    it(row.name, () => {
      const result = concentrationSave(row.d20, row.saveMod, row.exhaustion, row.dc);
      expect(saveMismatches(row, result)).toEqual([]);
    });
  }

  it('shows Exhaustion as its own component, even at zero', () => {
    const none = concentrationSave(10, 3, 0, 10).breakdown;
    expect(none.components.map((c) => c.label)).toContain('Exhaustion (none)');
    const two = concentrationSave(10, 3, 2, 10).breakdown;
    expect(two.components.find((c) => c.label.startsWith('Exhaustion'))?.value).toBe(-4);
  });

  it('rejects a d20 that is not 1..20', () => {
    expect(() => concentrationSave(0, 0, 0, 10)).toThrow(RangeError);
    expect(() => concentrationSave(21, 0, 0, 10)).toThrow(RangeError);
    expect(() => concentrationSave(1.5, 0, 0, 10)).toThrow(RangeError);
  });
});

describe('golden CONCENTRATION_END_CASES', () => {
  for (const row of CONCENTRATION_END_CASES) {
    it(row.name, () => {
      expect(shouldEndConcentration(endCharacter(row.input))).toBe(row.expect);
    });
  }

  it('is null when not concentrating whatever the conditions', () => {
    const c = { ...createCharacter('T'), hpMax: 10, currentHp: 0 };
    expect(shouldEndConcentration(c)).toBeNull();
  });

  it('uses the derived 0-HP Unconscious from effectiveConditionIds without storing it', () => {
    const c = endCharacter({ concentrating: true, storedConditions: [], max: 20, hp: 0 });
    expect(c.conditions).toBeUndefined();
    expect(effectiveConditionIds(c)).toContain('incapacitated');
    expect(shouldEndConcentration(c)).toBe('incapacitated');
  });

  it('a Stable creature at 0 HP is still Incapacitated', () => {
    const c = { ...endCharacter({ concentrating: true, storedConditions: [], max: 20, hp: 0 }), deathSaves: { successes: 0, failures: 0, stable: true } };
    expect(shouldEndConcentration(c)).toBe('incapacitated');
  });

  it('endConcentrationIfBroken clears the field with the reason and does not mutate', () => {
    const c = endCharacter({ concentrating: true, storedConditions: ['stunned'], max: 20, hp: 20 });
    const before = JSON.stringify(c);
    const out = endConcentrationIfBroken(c);
    expect(out.reason).toBe('incapacitated');
    expect('concentration' in out.character).toBe(false);
    expect(JSON.stringify(c)).toBe(before);
  });

  it('endConcentrationIfBroken leaves a healthy concentrator untouched (same object)', () => {
    const c = endCharacter({ concentrating: true, storedConditions: ['prone'], max: 20, hp: 20 });
    const out = endConcentrationIfBroken(c);
    expect(out.reason).toBeNull();
    expect(out.character).toBe(c);
  });

  it('endConcentration removes the field and is a no-op when absent', () => {
    const c = endCharacter({ concentrating: true, storedConditions: [], max: 20, hp: 20 });
    expect('concentration' in endConcentration(c)).toBe(false);
    const idle = createCharacter('T');
    expect(endConcentration(idle)).toBe(idle);
  });
});

describe('golden CONCENTRATION_START_CASES', () => {
  for (const row of CONCENTRATION_START_CASES) {
    it(row.name, () => {
      const base = createCharacter('Tester');
      const c: Character = row.current ? { ...base, concentration: { spellId: spell(row.current) } } : base;
      const before = JSON.stringify(c);
      const out = startConcentration(c, spell(row.starting), row.startingRequiresConcentration);
      expect(out.character.concentration?.spellId).toBe(row.expect.concentration);
      expect(out.endedPrevious).toBe(row.expect.endedPrevious);
      expect(JSON.stringify(c)).toBe(before);
    });
  }

  it('re-casting the spell already concentrated on ends nothing', () => {
    const c = { ...createCharacter('T'), concentration: { spellId: spell('bless') } };
    const out = startConcentration(c, spell('bless'), true);
    expect(out.endedPrevious).toBeUndefined();
    expect(out.character.concentration?.spellId).toBe('bless');
  });
});

describe('character-level Concentration save (D1, D7)', () => {
  it('uses the Constitution save breakdown and a visible Exhaustion component', () => {
    let c: Character = createCharacter('T');
    c = { ...c, abilities: { ...c.abilities, con: 14 }, saveProficiencies: { con: true } };
    c = setExhaustion(c, 1);
    const con = constitutionSaveBreakdown(c);
    const result = resolveConcentrationSave(c, 10, 12);
    expect(result.total).toBe(10 + con.total - 2);
    expect(sumComponents(result.breakdown)).toBe(result.total);
    expect(result.breakdown.components.some((x) => x.label.startsWith('Exhaustion'))).toBe(true);
    expect(result.breakdown.components.some((x) => x.label === 'Constitution mod')).toBe(true);
  });
});

describe('fail-closed: the golden harness catches a wrong implementation', () => {
  // Mutant DC functions: each is shown to disagree with at least one golden row,
  // so a regression like it cannot pass the table.
  const mutants: Record<string, (damage: number) => number> = {
    'no floor of 10': (d) => Math.min(30, Math.floor(d / 2)),
    'no cap of 30': (d) => Math.max(10, Math.floor(d / 2)),
    'rounds half up': (d) => Math.min(30, Math.max(10, Math.ceil(d / 2))),
    'full damage': (d) => Math.min(30, Math.max(10, d)),
  };
  for (const [name, mutant] of Object.entries(mutants)) {
    it(`DC mutant "${name}" fails at least one row`, () => {
      const failures = CONCENTRATION_DC_CASES.filter((row) => {
        if (!row.required) return false;
        const actual = { required: true, dc: mutant(row.damage), breakdown: { total: mutant(row.damage), components: [] } };
        return dcMismatches(row, actual).includes('dc');
      });
      expect(failures.length).toBeGreaterThan(0);
    });
  }

  it('a breakdown whose components do not sum to the DC is detected', () => {
    const row = CONCENTRATION_DC_CASES.find((r) => r.damage === 100)!;
    const real = concentrationCheck(100);
    const broken = { ...real, breakdown: { ...real.breakdown!, components: real.breakdown!.components.slice(0, 2) } };
    expect(dcMismatches(row, broken)).toContain('breakdown sum');
  });

  it('save mutant with natural-20 auto success fails a row', () => {
    const failing = CONCENTRATION_SAVE_CASES.filter((row) => {
      const real = concentrationSave(row.d20, row.saveMod, row.exhaustion, row.dc);
      const mutant = row.d20 === 20 ? { ...real, success: true } : real;
      return saveMismatches(row, mutant).length > 0;
    });
    expect(failing.length).toBeGreaterThan(0);
  });

  it('save mutant ignoring Exhaustion fails a row', () => {
    const failing = CONCENTRATION_SAVE_CASES.filter((row) => {
      const real = concentrationSave(row.d20, row.saveMod, 0, row.dc);
      return saveMismatches(row, real).length > 0;
    });
    expect(failing.length).toBeGreaterThan(0);
  });

  it('save mutant using > instead of >= fails a row', () => {
    const failing = CONCENTRATION_SAVE_CASES.filter((row) => {
      const real = concentrationSave(row.d20, row.saveMod, row.exhaustion, row.dc);
      return saveMismatches(row, { ...real, success: real.total > row.dc }).length > 0;
    });
    expect(failing.length).toBeGreaterThan(0);
  });

  it('perturbing a golden input changes the result', () => {
    const base = CONCENTRATION_SAVE_CASES[0];
    const a = concentrationSave(base.d20, base.saveMod, base.exhaustion, base.dc);
    expect(concentrationSave(base.d20 - 4, base.saveMod, base.exhaustion, base.dc).success).not.toBe(a.success);
    expect(concentrationCheck(40).dc).not.toBe(concentrationCheck(60).dc);
  });

  it('a perturbed END row changes the answer (dead flag / stored Stunned)', () => {
    const healthy = CONCENTRATION_END_CASES[0];
    expect(shouldEndConcentration(endCharacter(healthy.input))).toBeNull();
    expect(shouldEndConcentration(endCharacter({ ...healthy.input, storedConditions: ['stunned'] }))).toBe('incapacitated');
    expect(shouldEndConcentration(endCharacter({ ...healthy.input, dead: true }))).toBe('dead');
    expect(shouldEndConcentration(endCharacter({ ...healthy.input, hp: 0 }))).toBe('incapacitated');
  });
});
