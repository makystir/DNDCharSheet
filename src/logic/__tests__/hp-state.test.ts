import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character } from '../../types/character';
import {
  applyDamage,
  applyDamageToCharacter,
  applyHealing,
  applyHealingToCharacter,
  deathSaveAdvance,
  deathSaveOutcome,
  derivedConditionIds,
  deriveLifeStatus,
  effectiveConditionIds,
  effectiveHp,
  grantTempHp,
  grantTempHpToCharacter,
  hitPointMaxOf,
  hpStateOf,
  knockOut,
  lifeStatus,
  resolveDeathSave,
  setCurrentHp,
  stabilize,
  type HpState,
} from '../hit-points-state';
import { addCondition, setExhaustion } from '../conditions';
import { formatEquation } from '../breakdown';
import {
  DAMAGE_CASES,
  DEATH_SAVE_CASES,
  HEAL_CASES,
  LIFE_STATUS_CASES,
  TEMP_GRANT_CASES,
} from './hp-golden';

const NONE = { successes: 0, failures: 0 };

/** A character with a manual Hit Point maximum (no class needed). */
function withMax(max: number | undefined, patch: Partial<Character> = {}): Character {
  const c = createCharacter('Tester');
  return { ...c, ...(max === undefined ? {} : { hpMax: max }), ...patch };
}

function state(patch: Partial<HpState> = {}): HpState {
  return { max: 20, hp: 20, temp: 0, deathSaves: NONE, stable: false, dead: false, ...patch };
}

// ─── Golden harness ──────────────────────────────────────────────────────────

describe('golden DAMAGE_CASES', () => {
  for (const row of DAMAGE_CASES) {
    it(row.name, () => {
      const i = row.input;
      const before = state({
        max: i.max,
        hp: i.hp,
        temp: i.temp,
        deathSaves: i.deathSaves ?? NONE,
        stable: i.stable ?? false,
      });
      const r = applyDamage(
        before,
        {
          amount: i.amount,
          flat: i.flat,
          resistance: i.resistance,
          vulnerability: i.vulnerability,
          immune: i.immune,
          crit: i.crit,
        },
        { absorbedCountsAsDamage: i.absorbedCountsAsDamage },
      );
      const e = row.expect;
      expect(r.damageDealt).toBe(e.damageDealt);
      expect(r.tempAbsorbed).toBe(e.tempAbsorbed);
      expect(r.hpLost).toBe(e.hpLost);
      expect(r.next.hp).toBe(e.hp);
      expect(r.next.temp).toBe(e.temp);
      expect(r.remainder).toBe(e.remainder);
      expect(r.instantDeath).toBe(e.instantDeath);
      expect(r.next.deathSaves).toEqual(e.deathSaves);
      expect(r.next.stable).toBe(e.stable);
      expect(r.next.dead).toBe(e.dead);
      expect(r.atZero).toBe(e.atZero);
      expect(r.tookDamage).toBe(e.tookDamage);
      // Breakdown contract: components sum to the displayed damage.
      expect(r.breakdown.total).toBe(e.damageDealt);
      expect(r.breakdown.components.reduce((s, c) => s + c.value, 0)).toBe(r.breakdown.total);
    });
  }
});

describe('golden HEAL_CASES', () => {
  for (const row of HEAL_CASES) {
    it(row.name, () => {
      const i = row.input;
      const r = applyHealing(
        state({ max: i.max, hp: i.hp, temp: i.temp, deathSaves: i.deathSaves ?? NONE, stable: i.stable ?? false }),
        i.amount,
      );
      const e = row.expect;
      expect(r.next.hp).toBe(e.hp);
      expect(r.next.temp).toBe(e.temp);
      expect(r.next.deathSaves).toEqual(e.deathSaves);
      expect(r.next.stable).toBe(e.stable);
      expect(r.next.hp === 0 && !r.next.dead).toBe(e.atZero);
      expect(r.regained).toBe(e.regained);
    });
  }
});

describe('golden TEMP_GRANT_CASES', () => {
  for (const row of TEMP_GRANT_CASES) {
    it(row.name, () => {
      expect(grantTempHp(row.current, row.offered, row.choice)).toBe(row.expectTemp);
      // Through a character: Temp HP never change current HP.
      const c = withMax(20, { currentHp: row.hp, tempHp: row.current });
      const next = grantTempHpToCharacter(c, row.offered, row.choice);
      expect(next).not.toBeNull();
      expect(next?.tempHp ?? 0).toBe(row.expectTemp);
      expect(effectiveHp(next as Character)).toBe(row.expectHp);
    });
  }
});

describe('golden DEATH_SAVE_CASES', () => {
  for (const row of DEATH_SAVE_CASES) {
    it(row.name, () => {
      const roll = deathSaveOutcome(row.d20, row.modifier);
      expect(roll.outcome).toBe(row.expect.outcome);
      const adv = deathSaveAdvance(row.before, roll.outcome);
      expect(adv.saves).toEqual(row.expect.after);
      expect(adv.stable).toBe(row.expect.stable);
      expect(adv.dead).toBe(row.expect.dead);
      expect(adv.hp).toBe(row.expect.hp);
    });
  }
});

describe('golden LIFE_STATUS_CASES', () => {
  for (const row of LIFE_STATUS_CASES) {
    it(`${row.name} (pure)`, () => {
      expect(
        deriveLifeStatus({
          max: row.input.max,
          hp: row.input.hp,
          stable: row.input.stable,
          deadFlag: row.input.deadFlag,
          exhaustion: row.input.exhaustion,
        }),
      ).toBe(row.expect);
    });
    it(`${row.name} (character)`, () => {
      const c = withMax(row.input.max, {
        currentHp: row.input.hp,
        ...(row.input.stable ? { deathSaves: { successes: 0, failures: 0, stable: true } } : {}),
        ...(row.input.deadFlag ? { dead: true } : {}),
        ...(row.input.exhaustion ? { exhaustionLevel: row.input.exhaustion } : {}),
      });
      expect(lifeStatus(c)).toBe(row.expect);
    });
  }
});

// ─── The harness fails closed ────────────────────────────────────────────────

describe('golden harness fails closed (mutation checks)', () => {
  /** A deliberately wrong pipeline: Resistance BEFORE the flat adjustment. */
  function wrongOrderDamage(amount: number, flat: number, resistance: boolean): number {
    const halved = resistance ? Math.floor(amount / 2) : amount;
    return Math.max(0, halved + flat);
  }

  it('the order rows would catch Resistance applied before the flat adjustment', () => {
    const row = DAMAGE_CASES.find((r) => r.name.startsWith('Order matters'));
    expect(row).toBeDefined();
    const i = row!.input;
    const mutant = wrongOrderDamage(i.amount, i.flat ?? 0, i.resistance === true);
    expect(mutant).not.toBe(row!.expect.damageDealt);
    // ...while the real function reproduces the golden value.
    const real = applyDamage(state({ max: i.max, hp: i.hp }), {
      amount: i.amount,
      flat: i.flat,
      resistance: i.resistance,
    });
    expect(real.damageDealt).toBe(row!.expect.damageDealt);
  });

  it('perturbing a golden input changes the result (Resistance toggle)', () => {
    const row = DAMAGE_CASES.find((r) => r.name.startsWith('Resistance rounds DOWN'))!;
    const i = row.input;
    const base = applyDamage(state({ max: i.max, hp: i.hp }), { amount: i.amount, resistance: true });
    const perturbed = applyDamage(state({ max: i.max, hp: i.hp }), { amount: i.amount, resistance: false });
    expect(base.damageDealt).toBe(row.expect.damageDealt);
    expect(perturbed.damageDealt).not.toBe(row.expect.damageDealt);
  });

  it('perturbing the Massive Damage input by one flips the verdict', () => {
    const dies = DAMAGE_CASES.find((r) => r.name.startsWith('PHB Massive Damage'))!.input;
    const live = applyDamage(state({ max: dies.max, hp: dies.hp }), { amount: dies.amount - 1 });
    expect(live.instantDeath).toBe(false);
  });

  it('a natural 20 judged on the total instead of the die would differ from the golden row', () => {
    const row = DEATH_SAVE_CASES.find((r) => r.name.startsWith('Exhaustion 5 (-10): a natural 20'))!;
    // Mutant: judge nat 20 by the total (10) as an ordinary success.
    const mutantTotal = row.d20 + row.modifier;
    expect(mutantTotal).toBeLessThan(20);
    expect(deathSaveOutcome(row.d20, row.modifier).outcome).toBe('regain-hp');
  });
});

// ─── Own unit tests (not enumerated by the golden table) ─────────────────────

describe('applyDamage details', () => {
  it('explains the arithmetic with components that sum to the damage dealt', () => {
    const r = applyDamage(state({ max: 40, hp: 40 }), {
      amount: 28,
      flat: -5,
      resistance: true,
      vulnerability: true,
    });
    expect(r.damageDealt).toBe(22);
    expect(formatEquation(r.breakdown)).toBe(
      '28 (Damage rolled) - 5 (Flat adjustment) + 0 (Cannot go below 0) - 12 (Resistance (halved, round down)) + 11 (Vulnerability (doubled)) + 0 (Immunity (none taken)) = 22',
    );
    expect(r.breakdown.note).toContain('HP lost 22');
  });

  it('sanitises non-finite and negative amounts to 0', () => {
    expect(applyDamage(state(), { amount: Number.NaN }).damageDealt).toBe(0);
    expect(applyDamage(state(), { amount: -4 }).damageDealt).toBe(0);
    expect(applyDamage(state(), { amount: 5.9 }).damageDealt).toBe(5);
  });

  it('does not mutate its input state', () => {
    const before = state({ hp: 7, temp: 3 });
    const frozen = JSON.stringify(before);
    applyDamage(before, { amount: 9 });
    expect(JSON.stringify(before)).toBe(frozen);
  });

  it('a dead creature is unchanged', () => {
    const dead = state({ hp: 0, dead: true });
    const r = applyDamage(dead, { amount: 9 });
    expect(r.next).toBe(dead);
    expect(r.tookDamage).toBe(false);
    expect(r.atZero).toBe(false);
  });

  it('caps the failure tally at 3 when a Critical Hit lands on two failures', () => {
    const r = applyDamage(state({ max: 30, hp: 0, deathSaves: { successes: 0, failures: 2 } }), {
      amount: 3,
      crit: true,
    });
    expect(r.next.deathSaves.failures).toBe(3);
    expect(r.next.dead).toBe(true);
  });

  it('the D4 flag is respected for tookDamage when HP is lost too', () => {
    const r = applyDamage(state({ hp: 0, temp: 2 }), { amount: 5 }, { absorbedCountsAsDamage: false });
    // 3 leftover damage still counts even with the strict reading.
    expect(r.tookDamage).toBe(true);
    expect(r.failuresAdded).toBe(1);
  });

  it('the D4 flag off: damage fully absorbed above 0 HP is not damage taken', () => {
    const on = applyDamage(state({ temp: 5 }), { amount: 3 });
    const off = applyDamage(state({ temp: 5 }), { amount: 3 }, { absorbedCountsAsDamage: false });
    expect(on.tookDamage).toBe(true);
    expect(off.tookDamage).toBe(false);
  });

  it('Stable ends when a Stable creature takes damage, but immunity keeps it Stable', () => {
    const stable = state({ hp: 0, stable: true });
    expect(applyDamage(stable, { amount: 4 }).next.stable).toBe(false);
    expect(applyDamage(stable, { amount: 4, immune: true }).next.stable).toBe(true);
  });
});

describe('applyHealing / grantTempHp details', () => {
  it('healing a dead creature does nothing', () => {
    const dead = state({ hp: 0, dead: true });
    expect(applyHealing(dead, 5).next).toBe(dead);
  });

  it('healing at full HP regains 0 and leaves the state alone', () => {
    const full = state();
    const r = applyHealing(full, 5);
    expect(r.regained).toBe(0);
    expect(r.next).toBe(full);
  });

  it('sanitises negative amounts', () => {
    expect(applyHealing(state({ hp: 5 }), -3).regained).toBe(0);
    expect(grantTempHp(-4, -2)).toBe(0);
  });
});

describe('deathSaveOutcome details', () => {
  it('rejects a d20 outside 1..20', () => {
    expect(() => deathSaveOutcome(0)).toThrow(RangeError);
    expect(() => deathSaveOutcome(21)).toThrow(RangeError);
    expect(() => deathSaveOutcome(10.5)).toThrow(RangeError);
  });

  it('breakdown components sum to the total', () => {
    const roll = deathSaveOutcome(12, -4);
    expect(roll.total).toBe(8);
    expect(roll.breakdown.components.reduce((s, c) => s + c.value, 0)).toBe(roll.breakdown.total);
  });
});

describe('character-level HP state', () => {
  it('absent currentHp follows the maximum and is written back to absent at max', () => {
    const c = withMax(30);
    expect(effectiveHp(c)).toBe(30);
    const hit = applyDamageToCharacter(c, { amount: 10 })!;
    expect(hit.character.currentHp).toBe(20);
    const healed = applyHealingToCharacter(hit.character, 99)!;
    expect(healed.character.currentHp).toBeUndefined();
    expect('currentHp' in healed.character).toBe(false);
    // A raised maximum carries an absent currentHp up with it.
    expect(effectiveHp({ ...healed.character, hpMax: 40 })).toBe(40);
    // But a stored value does not move.
    expect(effectiveHp({ ...hit.character, hpMax: 40 })).toBe(20);
  });

  it('clamps down when the maximum drops', () => {
    const c = withMax(30, { currentHp: 25 });
    expect(effectiveHp({ ...c, hpMax: 12 })).toBe(12);
    expect(effectiveHp({ ...c, currentHp: -4 })).toBe(0);
  });

  it('never invents a maximum when none is set', () => {
    const c = withMax(undefined);
    expect(hitPointMaxOf(c)).toBeUndefined();
    expect(effectiveHp(c)).toBeUndefined();
    expect(hpStateOf(c)).toBeUndefined();
    expect(applyDamageToCharacter(c, { amount: 5 })).toBeNull();
    expect(applyHealingToCharacter(c, 5)).toBeNull();
    expect(grantTempHpToCharacter(c, 5)).toBeNull();
    expect(setCurrentHp(c, 5)).toBeNull();
    expect(knockOut(c)).toBeNull();
    expect(lifeStatus(c)).toBe('healthy');
  });

  it('absent fields mean full HP, 0 temp, 0/0 saves, not dead', () => {
    const c = withMax(10);
    const s = hpStateOf(c)!;
    expect(s).toEqual({ max: 10, hp: 10, temp: 0, deathSaves: NONE, stable: false, dead: false });
    expect(lifeStatus(c)).toBe('healthy');
  });

  it('does not mutate the input character', () => {
    const c = withMax(10, { currentHp: 6, tempHp: 2 });
    const frozen = JSON.stringify(c);
    applyDamageToCharacter(c, { amount: 4 });
    applyHealingToCharacter(c, 2);
    grantTempHpToCharacter(c, 9);
    setCurrentHp(c, 1);
    knockOut(c);
    expect(JSON.stringify(c)).toBe(frozen);
  });

  it('writes tempHp back to absent when depleted', () => {
    const c = withMax(10, { tempHp: 3 });
    const r = applyDamageToCharacter(c, { amount: 3 })!;
    expect('tempHp' in r.character).toBe(false);
  });

  it('dropping to 0 records no failure; later damage records one; death sets the flag', () => {
    let c = withMax(12, { currentHp: 4 });
    c = applyDamageToCharacter(c, { amount: 4 })!.character;
    expect(c.currentHp).toBe(0);
    expect(lifeStatus(c)).toBe('making-death-saves');
    expect(c.deathSaves).toBeUndefined();
    c = applyDamageToCharacter(c, { amount: 1 })!.character;
    expect(c.deathSaves).toEqual({ successes: 0, failures: 1 });
    c = applyDamageToCharacter(c, { amount: 1, crit: true })!.character;
    expect(c.dead).toBe(true);
    expect(lifeStatus(c)).toBe('dead');
    expect(applyDamageToCharacter(c, { amount: 1 })).toBeNull();
    expect(applyHealingToCharacter(c, 5)).toBeNull();
  });

  it('healing from 0 clears death saves and Stable', () => {
    const c = withMax(12, { currentHp: 0, deathSaves: { successes: 2, failures: 1, stable: true } });
    const r = applyHealingToCharacter(c, 2)!;
    expect(r.character.currentHp).toBe(2);
    expect(r.character.deathSaves).toBeUndefined();
  });

  it('Temp HP at 0 HP do not wake the character', () => {
    const c = withMax(12, { currentHp: 0 });
    const next = grantTempHpToCharacter(c, 5)!;
    expect(next.tempHp).toBe(5);
    expect(lifeStatus(next)).toBe('making-death-saves');
  });

  it('setCurrentHp clamps, and raising from 0 resets the saves', () => {
    const c = withMax(12, { currentHp: 0, deathSaves: { successes: 1, failures: 1 } });
    expect(setCurrentHp(c, 99)!.currentHp).toBeUndefined(); // clamped to max, absent
    const up = setCurrentHp(c, 3)!;
    expect(up.currentHp).toBe(3);
    expect(up.deathSaves).toBeUndefined();
    expect(setCurrentHp(withMax(12), -5)!.currentHp).toBe(0);
  });

  it('exhaustion level 6 is dead without writing the flag; lowering it un-kills', () => {
    const c = withMax(12, { exhaustionLevel: 6 });
    expect(lifeStatus(c)).toBe('dead');
    expect(c.dead).toBeUndefined();
    expect(applyDamageToCharacter(c, { amount: 1 })).toBeNull();
    expect(lifeStatus(setExhaustion(c, 5))).toBe('healthy');
  });

  it('a Hit Point maximum of 0 is dead', () => {
    expect(lifeStatus(withMax(0))).toBe('dead');
  });
});

describe('resolveDeathSave / stabilize', () => {
  const atZero = () => withMax(12, { currentHp: 0 });

  it('only applies while making Death Saving Throws', () => {
    expect(resolveDeathSave(withMax(12), 15)).toBeNull();
    expect(resolveDeathSave(stabilize(atZero())!, 15)).toBeNull();
    expect(stabilize(withMax(12))).toBeNull();
  });

  it('a success records one success; three make the character Stable', () => {
    let c = atZero();
    c = resolveDeathSave(c, 12)!.character;
    expect(c.deathSaves).toEqual({ successes: 1, failures: 0 });
    c = resolveDeathSave(c, 12)!.character;
    const third = resolveDeathSave(c, 12)!;
    expect(third.advance.stable).toBe(true);
    expect(lifeStatus(third.character)).toBe('stable');
    expect(third.character.deathSaves).toEqual({ successes: 0, failures: 0, stable: true });
  });

  it('a natural 20 regains 1 HP and clears the saves', () => {
    const c = { ...atZero(), deathSaves: { successes: 1, failures: 2 } };
    const r = resolveDeathSave(c, 20)!;
    expect(r.character.currentHp).toBe(1);
    expect(r.character.deathSaves).toBeUndefined();
    expect(lifeStatus(r.character)).toBe('bloodied');
  });

  it('three failures set the dead flag', () => {
    let c = atZero();
    c = resolveDeathSave(c, 2)!.character;
    c = resolveDeathSave(c, 2)!.character;
    const last = resolveDeathSave(c, 2)!;
    expect(last.character.dead).toBe(true);
  });

  it('applies Exhaustion to the roll as a visible component (D1)', () => {
    const c = { ...atZero(), exhaustionLevel: 2 }; // -4
    const r = resolveDeathSave(c, 13)!; // 13 - 4 = 9 fails
    expect(r.roll.outcome).toBe('failure');
    expect(r.roll.total).toBe(9);
    expect(r.roll.breakdown.total).toBe(9);
    expect(r.roll.breakdown.components.map((x) => x.label)).toContain('Exhaustion -4');
  });

  it('a natural 1 / 20 is judged on the raw die under Exhaustion', () => {
    const c = { ...atZero(), exhaustionLevel: 5 };
    expect(resolveDeathSave(c, 20)!.roll.outcome).toBe('regain-hp');
    expect(resolveDeathSave(c, 1)!.roll.outcome).toBe('critical-failure');
  });

  it('stabilize makes the character Stable at 0 HP', () => {
    const c = stabilize({ ...atZero(), deathSaves: { successes: 1, failures: 1 } })!;
    expect(c.currentHp).toBe(0);
    expect(c.deathSaves).toEqual({ successes: 0, failures: 0, stable: true });
    expect(lifeStatus(c)).toBe('stable');
  });
});

describe('derived Unconscious (D2) and knockOut', () => {
  it('at 0 HP the effective set includes Unconscious, Incapacitated and Prone, never stored', () => {
    const c = withMax(12, { currentHp: 0 });
    expect(effectiveConditionIds(c)).toEqual(['incapacitated', 'prone', 'unconscious']);
    expect(derivedConditionIds(c)).toEqual(['incapacitated', 'prone', 'unconscious']);
    expect(c.conditions).toBeUndefined();
    const hit = applyDamageToCharacter(withMax(12, { currentHp: 2 }), { amount: 2 })!.character;
    expect(hit.conditions).toBeUndefined();
    expect(effectiveConditionIds(hit)).toContain('unconscious');
  });

  it('Stable creatures still have it; the healthy and the dead do not', () => {
    expect(effectiveConditionIds(stabilize(withMax(12, { currentHp: 0 }))!)).toContain('unconscious');
    expect(effectiveConditionIds(withMax(12))).toEqual([]);
    expect(effectiveConditionIds(withMax(12, { currentHp: 0, dead: true }))).toEqual([]);
  });

  it('merges with stored conditions in PHB order without duplicating', () => {
    let c = withMax(12, { currentHp: 0 });
    c = addCondition(c, 'prone');
    c = addCondition(c, 'poisoned');
    expect(effectiveConditionIds(c)).toEqual(['incapacitated', 'poisoned', 'prone', 'unconscious']);
    expect(derivedConditionIds(c)).toEqual(['incapacitated', 'unconscious']);
  });

  it('healing from 0 removes the derived set because it was never stored', () => {
    const c = withMax(12, { currentHp: 0 });
    const healed = applyHealingToCharacter(c, 3)!.character;
    expect(effectiveConditionIds(healed)).toEqual([]);
  });

  it('knockOut leaves 1 HP, writes Unconscious ending at a Short Rest, and clears the saves', () => {
    const c = withMax(12, { currentHp: 7, deathSaves: { successes: 1, failures: 0 } });
    const k = knockOut(c)!;
    expect(k.currentHp).toBe(1);
    expect(k.deathSaves).toBeUndefined();
    expect(k.conditions).toEqual([{ id: 'unconscious', note: 'Knocked out', ends: 'Short Rest' }]);
    expect(lifeStatus(k)).toBe('bloodied');
    // Stored Unconscious is in the effective set, with no double counting.
    expect(effectiveConditionIds(k)).toEqual(['unconscious']);
  });

  it('knockOut on a character with a maximum of 1 leaves it at max (absent)', () => {
    const k = knockOut(withMax(1))!;
    expect(k.currentHp).toBeUndefined();
  });

  it('knockOut refuses a dead character', () => {
    expect(knockOut(withMax(12, { dead: true }))).toBeNull();
  });
});
