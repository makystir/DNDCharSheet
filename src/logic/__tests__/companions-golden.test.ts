import { describe, it, expect } from 'vitest';
import { CREATURE_CATALOG } from '../../data/creatures';
import {
  BARDING_COST_FACTOR,
  BARDING_WEIGHT_FACTOR,
  COMPANION_CAPS,
  HIRELING_UNITS_MAX,
  LOYALTY_CHANGES,
  LOYALTY_MAX,
  LOYALTY_MIN,
  VEHICLE_PULL_FACTOR,
  addTrackedCondition,
  adjustLoyalty,
  applyTrackedDamage,
  applyTrackedHealing,
  bardingCostGp,
  bardingWeightLb,
  canAddRecord,
  capacityStatus,
  clampHirelingUnits,
  clampLoyalty,
  creatureHasBeastOfBurden,
  derivedCarryingCapacityLb,
  effectiveLoyalty,
  effectiveRatePerUnitCp,
  effectiveTrackedHp,
  formatCopper,
  giveTrackedTempHp,
  hirelingCostBreakdown,
  hirelingRatePerUnitCp,
  hirelingTotalCp,
  hirelingUnitName,
  hirelingsTotalCp,
  isAtZeroHp,
  isBelowMinimumRate,
  loyaltyBand,
  loyaltyMaximum,
  loyaltyStart,
  mountCapacity,
  mountingCostFt,
  npcChallengeRatingCheck,
  npcMaxChallengeRating,
  removeTrackedCondition,
  sidekickDefaultStartLevel,
  sidekickLevelUp,
  sidekickMaxHp,
  sizeCarryMultiplier,
  sizeOneLarger,
  splitCopper,
  storedHpFor,
  vehicleLoad,
  vehiclePullLimitLb,
  type CarrySize,
  type HirelingKind,
  type TrackedConditionsState,
} from '../companions';
import {
  AT_ZERO_ROWS,
  BARDING_ROWS,
  CAPACITY_STATUS_ROWS,
  CAPS,
  CAP_ROWS,
  CONDITION_SCENARIOS,
  CUSTOM_RATE_ROWS,
  DAMAGE_ROWS,
  DERIVED_CAPACITY_ROWS,
  EFFECTIVE_HP_ROWS,
  HEAL_ROWS,
  HIRELING_COST_ROWS,
  HIRELING_RATE_ROWS,
  LOYALTY_ADJUST_ROWS,
  LOYALTY_BAND_ROWS,
  LOYALTY_BOUNDS,
  LOYALTY_CHANGE_ROWS,
  LOYALTY_CLAMP_ROWS,
  LOYALTY_EFFECTIVE_ROWS,
  LOYALTY_MAX_ROWS,
  MOUNTING_COST_ROWS,
  NPC_CR_ROWS,
  NPC_MAX_CR_ROWS,
  RUNNING_TOTAL_ROWS,
  SIDEKICK_LEVEL_UP_ROWS,
  SIDEKICK_MAX_HP_ROWS,
  SIDEKICK_START_LEVEL_ROWS,
  SIZE_MULTIPLIER_ROWS,
  SIZE_STEP_ROWS,
  SPLIT_COPPER_ROWS,
  STORED_HP_ROWS,
  SYNTHETIC_MOUNT_ROWS,
  TABLE_ANIMAL_ROWS,
  TEMP_HP_ROWS,
  UNIT_CLAMP_ROWS,
  VEHICLE_LOAD_ROWS,
  VEHICLE_PULL_ROWS,
} from './companions-golden';

const size = (s: string) => s as CarrySize;

describe('companions golden: hirelings (PHB L10530-10533)', () => {
  it.each(HIRELING_RATE_ROWS)('rate $kind = $rateCp CP per $unit ($printed)', (r) => {
    expect(hirelingRatePerUnitCp(r.kind)).toBe(r.rateCp);
    expect(hirelingUnitName(r.kind)).toBe(r.unit);
  });

  it.each(HIRELING_COST_ROWS)('$name', (r) => {
    expect(hirelingTotalCp({ kind: r.kind, units: r.units })).toBe(r.totalCp);
  });

  it.each(HIRELING_COST_ROWS)('breakdown sums to the total: $name', (r) => {
    const b = hirelingCostBreakdown({ kind: r.kind, units: r.units });
    expect(b.total).toBe(r.totalCp);
    expect(b.components.reduce((s, c) => s + c.value, 0)).toBe(b.total);
  });

  it.each(UNIT_CLAMP_ROWS)('units: $name', (r) => {
    expect(clampHirelingUnits(r.input)).toBe(r.expected);
  });

  it('the unit cap constant is 99999', () => {
    expect(HIRELING_UNITS_MAX).toBe(99999);
  });

  it.each(CUSTOM_RATE_ROWS)('custom rate: $name', (r) => {
    const h = { kind: r.kind as HirelingKind, units: r.units, customRateCp: r.customRateCp };
    expect(effectiveRatePerUnitCp(h)).toBe(r.effectiveRateCp);
    expect(hirelingTotalCp(h)).toBe(r.totalCp);
    expect(isBelowMinimumRate(h)).toBe(r.belowMinimum);
  });

  it.each(RUNNING_TOTAL_ROWS)('running total: $name', (r) => {
    const list = r.hirelings.map((h) => ({ ...h }));
    expect(hirelingsTotalCp(list)).toBe(r.totalCp);
    expect(formatCopper(r.totalCp)).toBe(r.formatted);
  });

  it.each(SPLIT_COPPER_ROWS)('splitCopper($cp)', (r) => {
    expect(splitCopper(r.cp)).toEqual({ gp: r.gp, sp: r.sp, cp: r.rest });
    expect(formatCopper(r.cp)).toBe(r.formatted);
  });
});

describe('companions golden: carrying capacity (PHB L20795-20800, L10392-10401)', () => {
  it.each(SIZE_MULTIPLIER_ROWS)('multiplier for $size = $multiplier', (r) => {
    expect(sizeCarryMultiplier(size(r.size))).toBe(r.multiplier);
  });

  it.each(SIZE_STEP_ROWS)('one size larger than $size is $larger', (r) => {
    expect(sizeOneLarger(size(r.size))).toBe(r.larger);
  });

  it.each(DERIVED_CAPACITY_ROWS)('$name', (r) => {
    expect(derivedCarryingCapacityLb(r.str, size(r.size), { oneSizeLarger: r.oneSizeLarger })).toBe(r.capacityLb);
  });

  describe('the eight Mounts and Other Animals table rows', () => {
    it.each(TABLE_ANIMAL_ROWS)('$name: stat block matches, derived == printed', (r) => {
      const c = CREATURE_CATALOG[r.id];
      expect(c, `catalog creature ${r.id}`).toBeDefined();
      expect(c.size).toBe(r.size);
      expect(c.abilities.str.score).toBe(r.str);
      expect(c.mountTable?.carryingCapacityLb).toBe(r.tableCapacityLb);
      expect(c.mountTable?.costGp).toBe(r.costGp);
      expect(creatureHasBeastOfBurden(c)).toBe(r.beastOfBurden);
      // Derivation (with the trait step for the Mule) reproduces the printed value.
      expect(derivedCarryingCapacityLb(r.str, size(r.size), { oneSizeLarger: r.beastOfBurden })).toBe(r.tableCapacityLb);
    });

    it.each(TABLE_ANIMAL_ROWS)('$name: mountCapacity() returns the table value, no second size step', (r) => {
      const cap = mountCapacity(CREATURE_CATALOG[r.id]);
      expect(cap.capacityLb).toBe(r.tableCapacityLb);
      expect(cap.source).toBe('table');
      // The Mule's table value already includes Beast of Burden: it is never applied on top.
      expect(cap.beastOfBurdenApplied).toBe(false);
      expect(cap.breakdown.total).toBe(r.tableCapacityLb);
      expect(cap.breakdown.components.reduce((s, x) => s + x.value, 0)).toBe(cap.breakdown.total);
    });

    it('the Mule would be 210 lb without the trait and 420 with it (the double-step trap)', () => {
      expect(derivedCarryingCapacityLb(14, 'Medium', { oneSizeLarger: false })).toBe(210);
      expect(derivedCarryingCapacityLb(14, 'Medium', { oneSizeLarger: true })).toBe(420);
      expect(mountCapacity(CREATURE_CATALOG.mule).capacityLb).toBe(420);
    });
  });

  it.each(SYNTHETIC_MOUNT_ROWS)('derived mountCapacity: $name', (r) => {
    const cap = mountCapacity({
      size: r.size,
      abilities: { str: { score: r.str } },
      traits: r.traits.map((name) => ({ name })),
    });
    expect(cap.capacityLb).toBe(r.capacityLb);
    expect(cap.source).toBe(r.source);
    expect(cap.beastOfBurdenApplied).toBe(r.beastOfBurdenApplied);
    expect(cap.breakdown.components.reduce((s, x) => s + x.value, 0)).toBe(cap.breakdown.total);
    expect(cap.breakdown.total).toBe(r.capacityLb ?? 0);
  });
});

describe('companions golden: vehicles and carried weight (PHB L10378)', () => {
  it('the vehicle factor is 5', () => {
    expect(VEHICLE_PULL_FACTOR).toBe(5);
  });

  it.each(VEHICLE_PULL_ROWS)('$name', (r) => {
    expect(vehiclePullLimitLb(r.capacitiesLb)).toBe(r.limitLb);
  });

  it.each(VEHICLE_LOAD_ROWS)('$name', (r) => {
    expect(vehicleLoad(r.capacitiesLb, r.vehicleWeightLb, r.cargoLb)).toEqual({
      limitLb: r.limitLb,
      usedLb: r.usedLb,
      remainingLb: r.remainingLb,
      overByLb: r.overByLb,
      over: r.over,
    });
  });

  it.each(CAPACITY_STATUS_ROWS)('$name', (r) => {
    expect(capacityStatus(r.carriedLb, r.capacityLb)).toEqual({
      remainingLb: r.remainingLb,
      overByLb: r.overByLb,
      over: r.over,
    });
  });
});

describe('companions golden: barding and mounting (PHB L10384, L1037)', () => {
  it('factors are 4 and 2', () => {
    expect(BARDING_COST_FACTOR).toBe(4);
    expect(BARDING_WEIGHT_FACTOR).toBe(2);
  });

  it.each(BARDING_ROWS)('$name', (r) => {
    expect(bardingCostGp(r.normalCostGp)).toBe(r.costGp);
    expect(bardingWeightLb(r.normalWeightLb)).toBe(r.weightLb);
  });

  it.each(MOUNTING_COST_ROWS)('mounting at Speed $speedFt ft costs $costFt ft', (r) => {
    expect(mountingCostFt(r.speedFt)).toBe(r.costFt);
  });
});

describe('companions golden: NPC party members (DMG L3557)', () => {
  it.each(NPC_MAX_CR_ROWS)('level $level -> max CR $maxCr', (r) => {
    expect(npcMaxChallengeRating(r.level)).toBe(r.maxCr);
  });

  it.each(NPC_CR_ROWS)('$name', (r) => {
    const res = npcChallengeRatingCheck(r.cr, r.level);
    expect(res.status).toBe(r.status);
    expect(res.cr).toBe(r.parsedCr);
    expect(res.maxCr).toBe(npcMaxChallengeRating(r.level));
    if (r.status === 'exceeds') expect(res.message).toMatch(/above half/i);
    if (r.status !== 'exceeds') expect(res.message).toBe('');
  });
});

describe('companions golden: Loyalty (DMG L3577-3584)', () => {
  it('the scale is 0 to 20', () => {
    expect(LOYALTY_MIN).toBe(LOYALTY_BOUNDS.min);
    expect(LOYALTY_MAX).toBe(LOYALTY_BOUNDS.max);
  });

  it.each(LOYALTY_MAX_ROWS)('$name', (r) => {
    const max = loyaltyMaximum(r.charisma, r.override);
    expect(max).toBe(r.max);
    expect(loyaltyStart(max)).toBe(r.start);
  });

  it.each(LOYALTY_CLAMP_ROWS)('clamp $score on max $max -> $expected', (r) => {
    expect(clampLoyalty(r.score, r.max)).toBe(r.expected);
  });

  it.each(LOYALTY_ADJUST_ROWS)('$name', (r) => {
    expect(adjustLoyalty(r.score, r.delta, r.max)).toBe(r.expected);
  });

  it.each(LOYALTY_EFFECTIVE_ROWS)('$name', (r) => {
    expect(effectiveLoyalty(r.stored, r.max)).toBe(r.expected);
  });

  it.each(LOYALTY_BAND_ROWS)('score $score is $band', (r) => {
    expect(loyaltyBand(r.score)).toBe(r.band);
  });

  it('LOYALTY_CHANGES lists exactly the three rule changes', () => {
    expect(LOYALTY_CHANGES.map((c) => ({ id: c.id, dice: c.dice, sign: c.sign }))).toEqual(
      LOYALTY_CHANGE_ROWS.map((c) => ({ id: c.id, dice: c.dice, sign: c.sign })),
    );
    for (const row of LOYALTY_CHANGE_ROWS) {
      const m = /^(\d+)d(\d+)$/.exec(row.dice)!;
      const n = Number(m[1]);
      const faces = Number(m[2]);
      expect(Math.min(row.sign * n, row.sign * n * faces)).toBe(row.minChange);
      expect(Math.max(row.sign * n, row.sign * n * faces)).toBe(row.maxChange);
    }
  });
});

describe('companions golden: tracked hit points (PHB L1133, L1183, L1191, L1194)', () => {
  it.each(DAMAGE_ROWS)('damage: $name', (r) => {
    expect(applyTrackedDamage({ max: r.max, hp: r.hp, temp: r.temp }, r.amount)).toEqual({
      hp: r.hpAfter,
      temp: r.tempAfter,
      tempAbsorbed: r.tempAbsorbed,
      hpLost: r.hpLost,
      overkill: r.overkill,
      atZero: r.atZero,
    });
  });

  it.each(HEAL_ROWS)('heal: $name', (r) => {
    expect(applyTrackedHealing({ max: r.max, hp: r.hp, temp: r.temp }, r.amount)).toEqual({
      hp: r.hpAfter,
      temp: r.temp,
      regained: r.regained,
    });
  });

  it.each(TEMP_HP_ROWS)('temp HP: $name', (r) => {
    expect(giveTrackedTempHp(r.current, r.offered, r.choice)).toBe(r.expected);
  });

  it.each(STORED_HP_ROWS)('storedHpFor($hp, $max)', (r) => {
    expect(storedHpFor(r.hp, r.max)).toBe(r.stored);
  });

  it.each(EFFECTIVE_HP_ROWS)('effective HP: $name', (r) => {
    expect(effectiveTrackedHp(r.stored, r.max)).toBe(r.expected);
  });

  it.each(AT_ZERO_ROWS)('isAtZeroHp($hp)', (r) => {
    expect(isAtZeroHp(r.hp)).toBe(r.atZero);
  });
});

describe('companions golden: tracked conditions (PHB L1214, Exhaustion)', () => {
  it.each(CONDITION_SCENARIOS)('$name', (s) => {
    let t: TrackedConditionsState = {};
    for (const step of s.steps) {
      t = step.op === 'add' ? addTrackedCondition(t, step.id) : removeTrackedCondition(t, step.id);
    }
    if (s.conditions === undefined) expect('conditions' in t).toBe(false);
    else expect((t.conditions ?? []).map((c) => c.id)).toEqual(s.conditions);
    if (s.exhaustionLevel === undefined) expect('exhaustionLevel' in t).toBe(false);
    else expect(t.exhaustionLevel).toBe(s.exhaustionLevel);
  });

  it('does not mutate the input state', () => {
    const before: TrackedConditionsState = { conditions: [{ id: 'blinded' }], exhaustionLevel: 2 };
    const snapshot = JSON.stringify(before);
    addTrackedCondition(before, 'poisoned');
    addTrackedCondition(before, 'exhaustion');
    removeTrackedCondition(before, 'blinded');
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('companions golden: sidekick hit points (Tasha L6956, 2014 rules)', () => {
  it.each(SIDEKICK_MAX_HP_ROWS)('$name', (r) => {
    const levelUps = r.gains.map((hpGained, i) => ({ level: i + 2, roll: 1, hpGained }));
    expect(sidekickMaxHp({ baseHpMax: r.baseHpMax, levelUps })).toBe(r.maxHp);
  });

  it.each(SIDEKICK_LEVEL_UP_ROWS)('$name', (r) => {
    const rec = { level: r.level, baseHpMax: r.baseHpMax, levelUps: [] as { level: number; roll: number; hpGained: number }[] };
    const next = sidekickLevelUp(rec, r.roll, r.conMod, r.hitDie);
    if (r.newLevel === null) {
      expect(next).toBeNull();
      return;
    }
    expect(next).not.toBeNull();
    expect(next!.level).toBe(r.newLevel);
    expect(next!.levelUps).toEqual([{ level: r.newLevel, roll: r.roll, hpGained: r.hpGained }]);
    expect(sidekickMaxHp(next!)).toBe(r.maxHpAfter);
    // The input record is not mutated.
    expect(rec.levelUps).toEqual([]);
    expect(rec.level).toBe(r.level);
  });

  it.each(SIDEKICK_START_LEVEL_ROWS)('character level $characterLevel -> start level $startLevel', (r) => {
    expect(sidekickDefaultStartLevel(r.characterLevel)).toBe(r.startLevel);
  });
});

describe('companions golden: cardinality caps', () => {
  it('cap constants', () => {
    expect(COMPANION_CAPS).toEqual(CAPS);
  });

  it.each(CAP_ROWS)('$kind with $count existing: can add = $canAdd', (r) => {
    expect(canAddRecord(r.kind, r.count)).toBe(r.canAdd);
  });
});
