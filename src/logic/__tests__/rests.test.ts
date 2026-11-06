import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { SpellId } from '../../data/spells';
import type { Character, SpellcastingState } from '../../types/character';
import { sumComponents } from './breakdown-helpers';
import {
  INTERRUPTION_TRIGGERS,
  hitDiceAvailable,
  longRest,
  longRestGapAdvisory,
  longRestHoursRequired,
  rechargeResources,
  restInterruptOutcome,
  shortRest,
  type RestResult,
} from '../rests';
import { effectiveHp, effectiveTempHp } from '../hit-points-state';
import { exhaustionLevelOf, setExhaustion } from '../conditions';
import {
  INTERRUPTION_CASES,
  INTERRUPTION_TRIGGERS as GOLDEN_TRIGGERS,
  LONG_REST_CASES,
  LONG_REST_GAP_CASES,
  LONG_REST_HOURS_CASES,
  SHORT_REST_CASES,
  type LongRestCase,
  type ShortRestCase,
} from './rest-golden';

const HIT_DIE_CLASS: Record<number, string> = { 6: 'sorcerer', 8: 'warlock', 10: 'fighter', 12: 'barbarian' };

function spellcasting(
  slots: Record<number, number> | undefined,
  pact: number | undefined,
  arcanum?: boolean,
): SpellcastingState | undefined {
  if (slots === undefined && pact === undefined && !arcanum) return undefined;
  const state: SpellcastingState = {};
  if (slots !== undefined) state.slotsExpended = { ...slots };
  if (pact !== undefined) state.pactSlotsExpended = pact;
  if (arcanum) state.mysticArcanaExpended = { 6: true };
  return state;
}

function shortCharacter(i: ShortRestCase['input']): Character {
  const c: Character = {
    ...createCharacter('Tester'),
    level: i.hitDiceTotal,
    classes: [{ id: HIT_DIE_CLASS[i.hitDie] as never, level: i.hitDiceTotal }],
    hpMax: i.max,
    abilities: { ...createCharacter('Tester').abilities, con: 10 + 2 * i.conMod },
  };
  if (i.hp < i.max) c.currentHp = i.hp;
  if (i.hitDiceSpent > 0) c.hitDiceSpent = i.hitDiceSpent;
  const sc = spellcasting(i.slotsExpended, i.pactSlotsExpended);
  if (sc) c.spellcasting = sc;
  return c;
}

function longCharacter(i: LongRestCase['input']): Character {
  let c: Character = {
    ...createCharacter('Tester'),
    level: i.hitDiceTotal,
    hpMax: i.max,
  };
  if (i.hp < i.max) c.currentHp = i.hp;
  if (i.hitDiceSpent > 0) c.hitDiceSpent = i.hitDiceSpent;
  if (i.tempHp > 0) c.tempHp = i.tempHp;
  if (i.exhaustion > 0) c = setExhaustion(c, i.exhaustion);
  const sc = spellcasting(i.slotsExpended, i.pactSlotsExpended, i.arcanumUsed);
  if (sc) c.spellcasting = sc;
  if (i.concentrating) c.concentration = { spellId: 'bless' as SpellId };
  if (i.dead) c.dead = true;
  return c;
}

/** Observable fields of a Short Rest result, for comparison with the golden row. */
function shortObserved(result: RestResult) {
  return {
    outcome: result.outcome,
    error: result.error,
    hp: effectiveHp(result.character),
    hitDiceSpent: result.character.hitDiceSpent ?? 0,
    rolled: result.rolled ?? [],
    hpGained: result.hpGained ?? 0,
    pactSlotsExpended: result.character.spellcasting?.pactSlotsExpended ?? 0,
    slotsExpended: { ...(result.character.spellcasting?.slotsExpended ?? {}) },
  };
}

function shortMismatches(row: ShortRestCase, result: RestResult): string[] {
  const seen = shortObserved(result);
  const out: string[] = [];
  const e = row.expect;
  if (seen.outcome !== e.outcome) out.push('outcome');
  if (seen.error !== e.error) out.push('error');
  if (seen.hp !== e.hp) out.push('hp');
  if (seen.hitDiceSpent !== e.hitDiceSpent) out.push('hitDiceSpent');
  if (JSON.stringify(seen.rolled) !== JSON.stringify(e.rolled)) out.push('rolled');
  if (seen.hpGained !== e.hpGained) out.push('hpGained');
  if (seen.pactSlotsExpended !== e.pactSlotsExpended) out.push('pactSlotsExpended');
  if (JSON.stringify(seen.slotsExpended) !== JSON.stringify(e.slotsExpended)) out.push('slotsExpended');
  return out;
}

function longObserved(result: RestResult) {
  const c = result.character;
  return {
    outcome: result.outcome,
    error: result.error,
    hp: effectiveHp(c),
    hitDiceSpent: c.hitDiceSpent ?? 0,
    tempHp: effectiveTempHp(c),
    exhaustion: exhaustionLevelOf(c),
    slotsExpended: { ...(c.spellcasting?.slotsExpended ?? {}) },
    pactSlotsExpended: c.spellcasting?.pactSlotsExpended ?? 0,
    arcanumUsed: Object.values(c.spellcasting?.mysticArcanaExpended ?? {}).some(Boolean),
    concentrating: c.concentration !== undefined,
  };
}

function longMismatches(row: LongRestCase, result: RestResult): string[] {
  const seen = longObserved(result);
  const e = row.expect;
  const out: string[] = [];
  for (const key of ['outcome', 'error', 'hp', 'hitDiceSpent', 'tempHp', 'exhaustion', 'pactSlotsExpended', 'arcanumUsed', 'concentrating'] as const) {
    if (seen[key] !== e[key]) out.push(key);
  }
  if (JSON.stringify(seen.slotsExpended) !== JSON.stringify(e.slotsExpended)) out.push('slotsExpended');
  return out;
}

const NOW = 1_700_000_000_000;

describe('golden SHORT_REST_CASES', () => {
  for (const row of SHORT_REST_CASES) {
    it(row.name, () => {
      const c = shortCharacter(row.input);
      const before = JSON.stringify(c);
      const result = shortRest(c, { rolls: row.input.rolls, interrupted: row.input.interrupted });
      expect(shortMismatches(row, result)).toEqual([]);
      expect(JSON.stringify(c)).toBe(before); // no input mutation
      if (result.outcome === 'completed' && result.breakdown) {
        expect(sumComponents(result.breakdown)).toBe(result.breakdown.total);
        expect(result.breakdown.total).toBe(row.expect.rolled.reduce((a, b) => a + b, 0));
      }
    });
  }

  it('shows per-die components and an explicit minimum-1 floor only where applied', () => {
    const row = SHORT_REST_CASES.find((r) => r.name.startsWith('Minimum 1 applies per die'))!;
    const result = shortRest(shortCharacter(row.input), { rolls: row.input.rolls });
    const labels = result.breakdown!.components.map((c) => c.label);
    expect(labels).toContain('d6 roll (die 1)');
    expect(labels).toContain('Con mod (die 1)');
    expect(labels).toContain('Minimum 1 (die 1)'); // face 2 + Con -3 = -1 -> floored to 1
    expect(labels).not.toContain('Minimum 1 (die 2)'); // face 6 + Con -3 = 3
    expect(result.breakdown!.components.find((c) => c.label === 'Minimum 1 (die 1)')?.value).toBe(2);
  });

  it('notes the HP cap when healing exceeds the maximum', () => {
    const row = SHORT_REST_CASES.find((r) => r.name.startsWith('Healing is capped'))!;
    const result = shortRest(shortCharacter(row.input), { rolls: row.input.rolls });
    expect(result.breakdown!.total).toBe(10);
    expect(result.hpGained).toBe(2);
    expect(result.breakdown!.note).toMatch(/Capped at the Hit Point maximum/);
  });

  it('zero dice yields a zero-component breakdown', () => {
    const row = SHORT_REST_CASES.find((r) => r.name.startsWith('Spending zero dice'))!;
    const result = shortRest(shortCharacter(row.input), { rolls: [] });
    expect(result.breakdown).toMatchObject({ total: 0, components: [{ label: 'No Hit Dice spent', value: 0 }] });
  });

  it('rejects spending a die with no class (unknown Hit Die), but a zero-dice rest still completes', () => {
    const noClass: Character = { ...createCharacter('T'), hpMax: 20, currentHp: 10 };
    expect(shortRest(noClass, { rolls: [3] }).error).toBe('no-hit-die');
    expect(shortRest(noClass, { rolls: [] }).outcome).toBe('completed');
  });

  it('a dead character cannot Short Rest', () => {
    const c = { ...shortCharacter(SHORT_REST_CASES[0].input), dead: true };
    expect(shortRest(c, { rolls: [] }).error).toBe('dead');
  });

  it('a rejected or interrupted rest returns the very same character', () => {
    const c = shortCharacter(SHORT_REST_CASES[0].input);
    expect(shortRest(c, { rolls: [9] }).character).toBe(c);
    expect(shortRest(c, { rolls: [5], interrupted: true }).character).toBe(c);
  });

  it('clears pactSlotsExpended without deleting the rest of spellcasting', () => {
    const c: Character = { ...shortCharacter(SHORT_REST_CASES[0].input), spellcasting: { slotsExpended: { 1: 1 }, pactSlotsExpended: 2, byClass: { warlock: { cantrips: ['light' as SpellId] } } } };
    const out = shortRest(c, { rolls: [] }).character;
    expect(out.spellcasting).toEqual({ slotsExpended: { 1: 1 }, byClass: { warlock: { cantrips: ['light'] } } });
  });

  it('reports hit dice available from level and spent', () => {
    expect(hitDiceAvailable({ ...createCharacter('T'), level: 5, hitDiceSpent: 2 })).toBe(3);
    expect(hitDiceAvailable({ ...createCharacter('T'), level: 3, hitDiceSpent: 9 })).toBe(0);
    expect(hitDiceAvailable({ ...createCharacter('T'), level: 3 })).toBe(3);
  });

  it('absent hitDiceSpent counts as 0 and the field is written when dice are spent', () => {
    const row = SHORT_REST_CASES[0];
    const c = shortCharacter(row.input);
    expect(c.hitDiceSpent).toBeUndefined();
    expect(shortRest(c, { rolls: [5] }).character.hitDiceSpent).toBe(1);
  });
});

describe('golden LONG_REST_CASES', () => {
  for (const row of LONG_REST_CASES) {
    it(row.name, () => {
      const c = longCharacter(row.input);
      const before = JSON.stringify(c);
      const result = longRest(c, { now: NOW });
      expect(longMismatches(row, result)).toEqual([]);
      expect(JSON.stringify(c)).toBe(before);
      if (row.expect.outcome === 'completed') {
        expect(result.character.lastLongRestAt).toBe(NOW);
        // Absent-field defaults: reset fields are removed, not stored as zero.
        expect(result.character.hitDiceSpent).toBeUndefined();
        expect(result.character.tempHp).toBeUndefined();
        expect(result.character.deathSaves).toBeUndefined();
        expect(result.character.currentHp).toBeUndefined();
        if (row.expect.exhaustion === 0) expect(result.character.exhaustionLevel).toBeUndefined();
      } else {
        expect(result.character).toBe(c);
        expect(result.character.lastLongRestAt).toBeUndefined();
      }
    });
  }

  it('does not set lastLongRestAt when no clock value is given', () => {
    const c = { ...longCharacter(LONG_REST_CASES[0].input), lastLongRestAt: 5 };
    expect(longRest(c).character.lastLongRestAt).toBe(5);
  });

  it('never blocks on the 16-hour wait (D5)', () => {
    const c = { ...longCharacter(LONG_REST_CASES[0].input), lastLongRestAt: NOW - 1000 };
    const out = longRest(c, { now: NOW });
    expect(out.outcome).toBe('completed');
    expect(out.character.lastLongRestAt).toBe(NOW);
  });

  it('clears death-save counters and Stable, and leaves other conditions alone', () => {
    const c: Character = {
      ...longCharacter(LONG_REST_CASES[0].input),
      hpMax: 30,
      currentHp: 5,
      deathSaves: { successes: 1, failures: 2 },
      conditions: [{ id: 'poisoned' }],
    };
    const out = longRest(c).character;
    expect(out.deathSaves).toBeUndefined();
    expect(out.conditions).toEqual([{ id: 'poisoned' }]);
  });

  it('completes at full state without an HP maximum', () => {
    const c: Character = { ...createCharacter('T'), tempHp: 3, hitDiceSpent: 1 };
    const out = longRest(c).character;
    expect(out.tempHp).toBeUndefined();
    expect(out.hitDiceSpent).toBeUndefined();
  });

  it('exhaustion level 6 is death and cannot rest', () => {
    const c = setExhaustion(longCharacter(LONG_REST_CASES[1].input), 6);
    expect(longRest(c).error).toBe('dead');
  });
});

describe('rechargeResources extension point (D11)', () => {
  it('returns the very same character for both kinds', () => {
    const c = createCharacter('T');
    expect(rechargeResources(c, 'short')).toBe(c);
    expect(rechargeResources(c, 'long')).toBe(c);
  });
});

describe('golden INTERRUPTION_CASES / LONG_REST_HOURS_CASES / INTERRUPTION_TRIGGERS', () => {
  for (const row of INTERRUPTION_CASES) {
    it(row.name, () => {
      expect(restInterruptOutcome(row.kind, row.hoursCompleted)).toBe(row.expect);
    });
  }
  for (const row of LONG_REST_HOURS_CASES) {
    it(`${row.interruptions} interruption(s) need ${row.expectHours} hours`, () => {
      expect(longRestHoursRequired(row.interruptions)).toBe(row.expectHours);
    });
  }
  it('lists the interruption triggers per kind (as sets)', () => {
    expect(new Set(INTERRUPTION_TRIGGERS.short)).toEqual(new Set(GOLDEN_TRIGGERS.short));
    expect(new Set(INTERRUPTION_TRIGGERS.long)).toEqual(new Set(GOLDEN_TRIGGERS.long));
    expect(INTERRUPTION_TRIGGERS.short).toHaveLength(GOLDEN_TRIGGERS.short.length);
    expect(INTERRUPTION_TRIGGERS.long).toHaveLength(GOLDEN_TRIGGERS.long.length);
  });
  it('treats bad interruption counts as zero', () => {
    expect(longRestHoursRequired(-2)).toBe(8);
    expect(longRestHoursRequired(Number.NaN)).toBe(8);
  });
});

describe('golden LONG_REST_GAP_CASES (D5 advisory)', () => {
  for (const row of LONG_REST_GAP_CASES) {
    it(row.name, () => {
      expect(longRestGapAdvisory(row.last, row.now)).toBe(row.expectAdvisory);
    });
  }
});

describe('fail-closed: the golden harness catches a wrong implementation', () => {
  function firstFailing<T>(rows: T[], bad: (row: T) => boolean): number {
    return rows.filter(bad).length;
  }

  it('a Short Rest that also restored standard slots fails a row', () => {
    const failing = firstFailing(SHORT_REST_CASES, (row) => {
      const real = shortRest(shortCharacter(row.input), { rolls: row.input.rolls, interrupted: row.input.interrupted });
      const spellcasting = real.character.spellcasting ? { ...real.character.spellcasting } : undefined;
      if (spellcasting) delete spellcasting.slotsExpended;
      return shortMismatches(row, { ...real, character: { ...real.character, spellcasting } }).length > 0;
    });
    expect(failing).toBeGreaterThan(0);
  });

  it('a Short Rest that did not restore Pact slots fails a row', () => {
    const failing = firstFailing(SHORT_REST_CASES, (row) => {
      if (row.input.pactSlotsExpended === undefined) return false;
      const real = shortRest(shortCharacter(row.input), { rolls: row.input.rolls, interrupted: row.input.interrupted });
      const c = shortCharacter(row.input);
      return shortMismatches(row, { ...real, character: c }).length > 0;
    });
    expect(failing).toBeGreaterThan(0);
  });

  it('a Short Rest with no per-die minimum fails a row', () => {
    const failing = firstFailing(SHORT_REST_CASES, (row) => {
      if (row.expect.outcome !== 'completed') return false;
      const conMod = (shortCharacter(row.input).abilities.con - 10) / 2;
      const rolled = row.input.rolls.map((f) => f + conMod); // mutant: no floor
      const real = shortRest(shortCharacter(row.input), { rolls: row.input.rolls });
      return shortMismatches(row, { ...real, rolled }).length > 0;
    });
    expect(failing).toBeGreaterThan(0);
  });

  it('a Short Rest applying the minimum to the sum, not per die, fails a row', () => {
    const row = SHORT_REST_CASES.find((r) => r.name.startsWith('Minimum 1 applies per die'))!;
    const real = shortRest(shortCharacter(row.input), { rolls: row.input.rolls });
    const sumFloored = [Math.max(1, row.input.rolls[0] - 3 + row.input.rolls[1] - 3)];
    expect(shortMismatches(row, { ...real, rolled: sumFloored })).toContain('rolled');
  });

  it('a Long Rest returning only half the Hit Dice fails a row', () => {
    const failing = firstFailing(LONG_REST_CASES, (row) => {
      if (row.expect.outcome !== 'completed') return false;
      const real = longRest(longCharacter(row.input));
      const half = Math.floor(row.input.hitDiceSpent / 2);
      const character = { ...real.character, ...(half > 0 ? { hitDiceSpent: half } : {}) };
      return longMismatches(row, { ...real, character }).length > 0;
    });
    expect(failing).toBeGreaterThan(0);
  });

  it('a Long Rest that keeps Temp HP, exhaustion, slots or Concentration fails a row', () => {
    const mutate: Array<(c: Character, input: LongRestCase['input']) => Character> = [
      (c, i) => ({ ...c, ...(i.tempHp > 0 ? { tempHp: i.tempHp } : {}) }),
      (c, i) => (i.exhaustion > 0 ? setExhaustion(c, i.exhaustion) : c),
      (c, i) => ({ ...c, spellcasting: i.slotsExpended ? { slotsExpended: i.slotsExpended } : c.spellcasting }),
      (c, i) => ({ ...c, ...(i.concentrating ? { concentration: { spellId: 'bless' as SpellId } } : {}) }),
    ];
    for (const mutant of mutate) {
      const failing = firstFailing(LONG_REST_CASES, (row) => {
        if (row.expect.outcome !== 'completed') return false;
        const real = longRest(longCharacter(row.input));
        return longMismatches(row, { ...real, character: mutant(real.character, row.input) }).length > 0;
      });
      expect(failing).toBeGreaterThan(0);
    }
  });

  it('a Long Rest allowed at 0 HP or when dead fails a row', () => {
    const rejected = LONG_REST_CASES.filter((r) => r.expect.outcome === 'rejected');
    expect(rejected.length).toBeGreaterThan(0);
    for (const row of rejected) {
      const c = longCharacter(row.input);
      const mutant: RestResult = { outcome: 'completed', character: { ...c, currentHp: row.input.max } };
      expect(longMismatches(row, mutant).length).toBeGreaterThan(0);
    }
  });

  it('perturbing a golden input changes the result', () => {
    const row = SHORT_REST_CASES[0];
    const base = shortRest(shortCharacter(row.input), { rolls: row.input.rolls });
    const higher = shortRest(shortCharacter(row.input), { rolls: [row.input.rolls[0] + 1] });
    expect(higher.hpGained).not.toBe(base.hpGained);
    const lowerCon = shortRest(shortCharacter({ ...row.input, conMod: row.input.conMod - 2 }), { rolls: row.input.rolls });
    expect(lowerCon.hpGained).not.toBe(base.hpGained);
    expect(shortRest(shortCharacter(row.input), { rolls: row.input.rolls, interrupted: true }).outcome).not.toBe(base.outcome);

    const long = LONG_REST_CASES[0];
    const a = longRest(longCharacter(long.input));
    const b = longRest(longCharacter({ ...long.input, hp: 0 }));
    expect(b.outcome).not.toBe(a.outcome);
  });

  it('interruption and gap mutants fail a row', () => {
    const wrongShort = INTERRUPTION_CASES.filter((r) => r.kind === 'short' && 'short-rest' !== r.expect);
    expect(wrongShort.length).toBeGreaterThan(0);
    // Mutant: a Long Rest interrupted after 0.5h still grants a Short Rest.
    expect(INTERRUPTION_CASES.some((r) => r.kind === 'long' && r.hoursCompleted < 1 && r.expect === 'none')).toBe(true);
    // Mutant gap rule "<=" vs "<" at exactly 16h must be distinguishable by a row.
    expect(LONG_REST_GAP_CASES.some((r) => r.last !== undefined && r.now - r.last === 16 * 3_600_000 && !r.expectAdvisory)).toBe(true);
    expect(LONG_REST_GAP_CASES.some((r) => r.last !== undefined && r.now < r.last && r.expectAdvisory)).toBe(true);
  });
});
