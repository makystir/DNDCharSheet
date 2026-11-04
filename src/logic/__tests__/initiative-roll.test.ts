import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character } from '../../types/character';
import type { ConditionId } from '../../data/conditions';
import { addCondition, setExhaustion } from '../conditions';
import { formatEquation } from '../breakdown';
import { sumComponents } from './breakdown-helpers';
import {
  characterInitiativeModifier,
  hasIncapacitated,
  initiativeRoll,
  initiativeRollMode,
  resolveInitiativeRoll,
  rollInitiative,
  type InitiativeModeInput,
  type InitiativeModeResult,
  type InitiativeRoll,
} from '../initiative-roll';
import {
  INITIATIVE_MODE_CASES,
  INITIATIVE_ROLL_CASES,
  type InitiativeModeCase,
  type InitiativeRollCase,
} from './initiative-golden';

function modeCharacter(i: InitiativeModeCase['input']): Character {
  let c: Character = { ...createCharacter('Tester'), hpMax: i.max };
  if (i.hp < i.max) c.currentHp = i.hp;
  for (const id of i.storedConditions) c = addCondition(c, id as ConditionId);
  return c;
}

function modeInput(i: InitiativeModeCase['input']): InitiativeModeInput {
  return {
    surprised: i.surprised,
    manualAdvantage: i.manualAdvantage,
    manualDisadvantage: i.manualDisadvantage,
  };
}

type ModeFn = (character: Character, input: InitiativeModeInput) => InitiativeModeResult;
type RollFn = (faces: number[], mode: InitiativeRollCase['mode'], bonus: number, exhaustion: number) => InitiativeRoll;

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Every field the golden row asserts; an empty list means the row passes. */
function modeMismatches(fn: ModeFn, row: InitiativeModeCase): string[] {
  const got = fn(modeCharacter(row.input), modeInput(row.input));
  const out: string[] = [];
  if (got.mode !== row.expect.mode) out.push('mode');
  if (!sameSet(got.advantageFrom, row.expect.advantageFrom)) out.push('advantageFrom');
  if (!sameSet(got.disadvantageFrom, row.expect.disadvantageFrom)) out.push('disadvantageFrom');
  return out;
}

function rollMismatches(fn: RollFn, row: InitiativeRollCase): string[] {
  const got = fn(row.faces, row.mode, row.bonus, row.exhaustion);
  const out: string[] = [];
  if (got.used !== row.expect.used) out.push('used');
  if (got.total !== row.expect.total) out.push('total');
  if (sumComponents(got.breakdown) !== got.total) out.push('breakdown-sum');
  if (got.breakdown.total !== got.total) out.push('breakdown-total');
  return out;
}

const realMode: ModeFn = (c, input) => initiativeRollMode(c, input);
const realRoll: RollFn = (faces, mode, bonus, exhaustion) => initiativeRoll(faces, mode, bonus, exhaustion);

describe('golden: INITIATIVE_MODE_CASES', () => {
  for (const row of INITIATIVE_MODE_CASES) {
    it(`${row.name} [${row.cite}]`, () => {
      expect(modeMismatches(realMode, row)).toEqual([]);
    });
  }
});

describe('golden: INITIATIVE_ROLL_CASES', () => {
  for (const row of INITIATIVE_ROLL_CASES) {
    it(`${row.name} [${row.cite}]`, () => {
      expect(rollMismatches(realRoll, row)).toEqual([]);
    });
  }
});

// ─── The harness fails closed ────────────────────────────────────────────────
// Each mutant is a deliberately wrong implementation run through the SAME
// comparators as the real code. Every one must fail at least one golden row.
// No source file is hand-mutated.

function failingRows<T extends { name: string }>(rows: T[], mismatches: (row: T) => string[]): string[] {
  return rows.filter((row) => mismatches(row).length > 0).map((row) => row.name);
}

describe('fails closed: Initiative mode mutants', () => {
  const flagged = (fn: ModeFn) => failingRows(INITIATIVE_MODE_CASES, (row) => modeMismatches(fn, row));

  it('Advantage that stacks (counts sources instead of cancelling) is caught', () => {
    const stacking: ModeFn = (c, input) => {
      const real = initiativeRollMode(c, input);
      const mode =
        real.advantageFrom.length > real.disadvantageFrom.length
          ? 'advantage'
          : real.disadvantageFrom.length > real.advantageFrom.length
            ? 'disadvantage'
            : 'normal';
      return { ...real, mode };
    };
    const caught = flagged(stacking);
    expect(caught).toContain('One Advantage cancels even several Disadvantages');
  });

  it('Disadvantage that wins a mix is caught', () => {
    const disWins: ModeFn = (c, input) => {
      const real = initiativeRollMode(c, input);
      return { ...real, mode: real.disadvantageFrom.length > 0 ? 'disadvantage' : real.mode };
    };
    expect(flagged(disWins).length).toBeGreaterThan(0);
  });

  it('ignoring implied conditions (Paralyzed, Stunned, Unconscious) is caught', () => {
    const noImplied: ModeFn = (c, input) => {
      const real = initiativeRollMode(c, input);
      const stored = (c.conditions ?? []).some((x) => x.id === 'incapacitated');
      return stored
        ? real
        : { mode: input.surprised ? 'disadvantage' : 'normal', advantageFrom: [], disadvantageFrom: input.surprised ? ['surprised'] : [] };
    };
    const caught = flagged(noImplied);
    expect(caught).toContain('Paralyzed implies Incapacitated: Disadvantage');
    expect(caught).toContain('Stunned implies Incapacitated: Disadvantage');
  });

  it('ignoring the derived 0-HP Unconscious (decision D2) is caught', () => {
    const noDerived: ModeFn = (c, input) => {
      // Rebuild the character at full HP so only stored conditions can speak.
      const full = { ...c };
      delete full.currentHp;
      return initiativeRollMode(full, input);
    };
    expect(flagged(noDerived)).toContain(
      'At 0 HP the derived Unconscious (decision D2) implies Incapacitated: Disadvantage',
    );
  });

  it('treating Prone as a Disadvantage source is caught', () => {
    const proneBad: ModeFn = (c, input) => {
      const real = initiativeRollMode(c, input);
      const prone = (c.conditions ?? []).some((x) => x.id === 'prone');
      return prone ? { ...real, mode: 'disadvantage', disadvantageFrom: ['prone' as never] } : real;
    };
    expect(flagged(proneBad)).toContain('Prone does not affect Initiative');
  });

  it('dropping Invisible or the manual sources is caught', () => {
    const noInvisible: ModeFn = (c, input) => {
      const real = initiativeRollMode(c, input);
      return { ...real, mode: 'normal', advantageFrom: [] };
    };
    const caught = flagged(noInvisible);
    expect(caught).toContain('Invisible: Advantage');
    expect(caught).toContain('A manual Advantage source gives Advantage');
  });

  it('perturbing a golden input changes the result', () => {
    // Surprised only -> add Invisible: Disadvantage becomes a cancel to normal.
    const surprised = INITIATIVE_MODE_CASES.find((r) => r.name === 'Surprised: Disadvantage')!;
    const perturbed = { ...surprised.input, storedConditions: ['invisible'] };
    const before = realMode(modeCharacter(surprised.input), modeInput(surprised.input));
    const after = realMode(modeCharacter(perturbed), modeInput(perturbed));
    expect(before.mode).toBe('disadvantage');
    expect(after.mode).toBe('normal');
    // Full HP -> 0 HP flips a normal row to Disadvantage.
    const normal = INITIATIVE_MODE_CASES[0];
    const down = { ...normal.input, hp: 0 };
    expect(realMode(modeCharacter(normal.input), modeInput(normal.input)).mode).toBe('normal');
    expect(realMode(modeCharacter(down), modeInput(down)).mode).toBe('disadvantage');
  });
});

describe('fails closed: Initiative roll mutants', () => {
  const flagged = (fn: RollFn) => failingRows(INITIATIVE_ROLL_CASES, (row) => rollMismatches(fn, row));

  it('ignoring Exhaustion (decision D1) is caught', () => {
    const noExhaustion: RollFn = (f, m, b) => initiativeRoll(f, m, b, 0);
    expect(flagged(noExhaustion)).toContain('Exhaustion 2 (-4) reduces the roll: 10 + 3 - 4 = 9');
  });

  it('Advantage keeping the lower face, or Disadvantage the higher, is caught', () => {
    const swapped: RollFn = (f, m, b, e) =>
      initiativeRoll(f, m === 'advantage' ? 'disadvantage' : m === 'disadvantage' ? 'advantage' : m, b, e);
    const caught = flagged(swapped);
    expect(caught).toContain('Advantage keeps the higher face (4, 17) + 2');
    expect(caught).toContain('Disadvantage keeps the lower face (4, 17) + 2');
  });

  it('a natural 20 that auto-succeeds is caught', () => {
    const nat20: RollFn = (f, m, b, e) => {
      const real = initiativeRoll(f, m, b, e);
      return real.used === 20 ? { ...real, total: 99 } : real;
    };
    expect(flagged(nat20)).toContain(
      'A natural 20 on a Dexterity check has no special effect: 20 + (-5) = 15',
    );
  });

  it('a breakdown that does not sum to the total is caught', () => {
    const lying: RollFn = (f, m, b, e) => {
      const real = initiativeRoll(f, m, b, e);
      return { ...real, breakdown: { ...real.breakdown, components: real.breakdown.components.slice(0, 1) } };
    };
    expect(flagged(lying).length).toBeGreaterThan(0);
  });

  it('perturbing a golden input changes the result', () => {
    const row = INITIATIVE_ROLL_CASES[0];
    const base = realRoll(row.faces, row.mode, row.bonus, row.exhaustion);
    expect(realRoll(row.faces, row.mode, row.bonus + 1, row.exhaustion).total).toBe(base.total + 1);
    expect(realRoll(row.faces, row.mode, row.bonus, row.exhaustion + 1).total).toBe(base.total - 2);
    expect(realRoll([row.faces[0] + 1], row.mode, row.bonus, row.exhaustion).total).toBe(base.total + 1);
  });
});

// ─── Behaviour the golden table does not enumerate ──────────────────────────
describe('initiativeRoll', () => {
  it('lists the d20, the modifier and the Exhaustion line (zero shown too)', () => {
    const roll = initiativeRoll([12], 'normal', 3, 0);
    expect(roll.breakdown.components.map((c) => c.label)).toEqual([
      'd20 roll',
      'Initiative modifier',
      'Exhaustion (none)',
    ]);
    expect(roll.breakdown.components.map((c) => c.value)).toEqual([12, 3, 0]);
  });

  it('shows the Dexterity modifier and bonus separately when given a Breakdown', () => {
    const c = { ...createCharacter('Tester'), initiativeBonus: 2 };
    c.abilities = { ...c.abilities, dex: 16 };
    const roll = initiativeRoll([10], 'normal', characterInitiativeModifier(c), 1);
    expect(roll.breakdown.components.map((x) => x.label)).toEqual([
      'd20 roll',
      'Dex mod',
      'Bonus',
      'Exhaustion -2',
    ]);
    expect(roll.total).toBe(10 + 3 + 2 - 2);
    expect(sumComponents(roll.breakdown)).toBe(roll.total);
    expect(formatEquation(roll.breakdown)).toContain('Dex mod');
  });

  it('notes the faces rolled and the one kept under Advantage', () => {
    const roll = initiativeRoll([4, 17], 'advantage', 0, 0);
    expect(roll.rolls).toEqual([4, 17]);
    expect(roll.breakdown.note).toMatch(/4 and 17/);
    expect(initiativeRoll([9], 'normal', 0, 0).breakdown.note).toBeUndefined();
  });

  it('throws when the faces do not match the mode or are off the die', () => {
    expect(() => initiativeRoll([5], 'advantage', 0, 0)).toThrow(RangeError);
    expect(() => initiativeRoll([5, 6], 'normal', 0, 0)).toThrow(RangeError);
    expect(() => initiativeRoll([21], 'normal', 0, 0)).toThrow(RangeError);
    expect(() => initiativeRoll([0], 'normal', 0, 0)).toThrow(RangeError);
  });

  it('does not mutate a Breakdown modifier it is given', () => {
    const modifier = Object.freeze({
      total: 3,
      components: Object.freeze([Object.freeze({ label: 'Dex mod', value: 3 })]),
    }) as never;
    expect(() => initiativeRoll([10], 'normal', modifier, 0)).not.toThrow();
  });
});

describe('character-level rolling', () => {
  function dexCharacter(dex: number): Character {
    const c = createCharacter('Tester');
    return { ...c, hpMax: 20, abilities: { ...c.abilities, dex } };
  }

  it('rollInitiative draws the faces from the injected RNG (face = floor(r * 20) + 1)', () => {
    const c = dexCharacter(14); // +2
    const draws = [0.5, 0.0]; // faces 11 then 1
    let i = 0;
    const rng = () => draws[i++];
    const roll = rollInitiative(c, rng, { manualAdvantage: true });
    expect(roll.mode).toBe('advantage');
    expect(roll.rolls).toEqual([11, 1]);
    expect(roll.used).toBe(11);
    expect(roll.total).toBe(13);
  });

  it('uses one die for a normal roll', () => {
    let calls = 0;
    const roll = rollInitiative(dexCharacter(10), () => (calls++, 0.95));
    expect(calls).toBe(1);
    expect(roll.used).toBe(20);
    expect(roll.total).toBe(20);
  });

  it('resolveInitiativeRoll applies the mode, Dex modifier, bonus and Exhaustion (D1)', () => {
    let c = dexCharacter(12); // +1
    c = { ...c, initiativeBonus: 1 };
    c = setExhaustion(c, 2);
    const roll = resolveInitiativeRoll(c, [8, 15], { manualDisadvantage: true });
    expect(roll.mode).toBe('disadvantage');
    expect(roll.used).toBe(8);
    expect(roll.total).toBe(8 + 1 + 1 - 4);
    expect(roll.breakdown.components.some((x) => x.label === 'Exhaustion -4' && x.value === -4)).toBe(true);
  });

  it('a character at 0 HP rolls with Disadvantage (D2)', () => {
    const c = { ...dexCharacter(10), currentHp: 0 };
    expect(resolveInitiativeRoll(c, [3, 18]).used).toBe(3);
  });

  it('does not mutate the character', () => {
    const c = Object.freeze({ ...dexCharacter(10) });
    expect(() => initiativeRollMode(c, { surprised: true })).not.toThrow();
  });
});

describe('hasIncapacitated', () => {
  it('is false for a healthy character and true at 0 HP', () => {
    const c: Character = { ...createCharacter('Tester'), hpMax: 20 };
    expect(hasIncapacitated(c)).toBe(false);
    expect(hasIncapacitated({ ...c, currentHp: 0 })).toBe(true);
  });

  it('is true for a stored Paralyzed character', () => {
    const c = addCondition({ ...createCharacter('Tester'), hpMax: 20 }, 'paralyzed');
    expect(hasIncapacitated(c)).toBe(true);
  });
});
