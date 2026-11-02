import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { AbilityScores } from '../../types/character';
import type { HitDie } from '../../data/classes';
import { abilityModifier } from '../abilities';
import { hitPointMaxBreakdown } from '../hit-points';

function scoresWithCon(con: number): AbilityScores {
  return { str: 10, dex: 10, con, int: 10, wis: 10, cha: 10 };
}

const HIT_DICE: HitDie[] = [6, 8, 10, 12];

// PHB 2024 "Fixed Hit Points by Class" (line ~2016): 7/6/5/4 = (die/2)+1.
function fixedPerLevel(hitDie: HitDie): number {
  return hitDie / 2 + 1;
}

/**
 * Reference RAW HP max (no override, no rolled variant), with the per-level
 * minimum-1 floor applied to the whole per-level gain (PHB 2024 line ~2014)
 * and Dwarven Toughness added on top (PHB 2024 "Dwarven Toughness").
 */
function expectedFixedHp(
  hitDie: HitDie,
  level: number,
  con: number,
  hpPerLevel = 0,
): number {
  const conMod = abilityModifier(con);
  let total = Math.max(1, hitDie + conMod); // Level 1: max die + Con, floored.
  for (let l = 2; l <= level; l++) {
    total += Math.max(1, fixedPerLevel(hitDie) + conMod);
  }
  return total + hpPerLevel * level;
}

function sumComponents(components: { value: number }[]): number {
  return components.reduce((s, c) => s + c.value, 0);
}

describe('hitPointMaxBreakdown — no class (Stage-3 fallback)', () => {
  it('finite hpMax: total is the entered value; Con component is conMod × level', () => {
    const scores = scoresWithCon(14); // +2
    const bd = hitPointMaxBreakdown({ scores, level: 3, hpMax: 30 });
    expect(bd.total).toBe(30);
    const conComp = bd.components.find((c) => c.label === 'Con mod × level');
    expect(conComp?.value).toBe(2 * 3); // +6
    const residual = bd.components.find(
      (c) => c.label === 'HP from Hit Dice (derived)',
    );
    expect(residual?.value).toBe(30 - 6);
    expect(sumComponents(bd.components)).toBe(30);
  });

  it('negative Con mod: residual is labelled derived, not "entered"', () => {
    const scores = scoresWithCon(6); // -2
    const bd = hitPointMaxBreakdown({ scores, level: 4, hpMax: 10 });
    const conContribution = -2 * 4; // -8
    const residual = bd.components.find(
      (c) => c.label === 'HP from Hit Dice (derived)',
    );
    expect(residual?.value).toBe(10 - conContribution); // 18, larger than entered 10
    expect(sumComponents(bd.components)).toBe(10);
  });

  it('undefined hpMax: total 0 with a single "not set" component', () => {
    const bd = hitPointMaxBreakdown({
      scores: scoresWithCon(14),
      level: 5,
      hpMax: undefined,
    });
    expect(bd.total).toBe(0);
    expect(bd.components).toEqual([{ label: 'HP max — not set', value: 0 }]);
  });

  it('property: finite hpMax → total === hpMax and Con component === conMod × level', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 400 }),
        (con, level, hpMax) => {
          const bd = hitPointMaxBreakdown({
            scores: scoresWithCon(con),
            level,
            hpMax,
          });
          expect(bd.total).toBe(hpMax);
          const conComp = bd.components.find((c) => c.label === 'Con mod × level');
          expect(conComp?.value).toBe(abilityModifier(con) * level);
          expect(sumComponents(bd.components)).toBe(hpMax);
        },
      ),
    );
  });

  describe('Dwarven Toughness (hpPerLevel) — no class', () => {
    it('Dwarf + hpMax set → appends a "Dwarven Toughness" component of 1×level', () => {
      const scores = scoresWithCon(14); // +2
      const level = 5;
      const bd = hitPointMaxBreakdown({ scores, level, hpMax: 50, hpPerLevel: 1 });
      expect(bd.total).toBe(50);
      expect(bd.components.map((c) => c.label)).toEqual([
        'HP from Hit Dice (derived)',
        'Con mod × level',
        'Dwarven Toughness',
      ]);
      expect(
        bd.components.find((c) => c.label === 'Dwarven Toughness')?.value,
      ).toBe(1 * level);
      expect(sumComponents(bd.components)).toBe(50);
    });

    it('non-Dwarf (no/zero hpPerLevel) output is exactly two components', () => {
      const scores = scoresWithCon(14);
      const bd = hitPointMaxBreakdown({ scores, level: 5, hpMax: 50 });
      expect(bd.components.map((c) => c.label)).toEqual([
        'HP from Hit Dice (derived)',
        'Con mod × level',
      ]);
      const bdZero = hitPointMaxBreakdown({
        scores,
        level: 5,
        hpMax: 50,
        hpPerLevel: 0,
      });
      expect(bdZero.components.map((c) => c.label)).toEqual([
        'HP from Hit Dice (derived)',
        'Con mod × level',
      ]);
    });

    it('Dwarf with hpMax unset returns the "not set" branch (no Toughness)', () => {
      const bd = hitPointMaxBreakdown({
        scores: scoresWithCon(14),
        level: 5,
        hpMax: undefined,
        hpPerLevel: 1,
      });
      expect(bd.total).toBe(0);
      expect(bd.components).toEqual([{ label: 'HP max — not set', value: 0 }]);
    });
  });
});

describe('hitPointMaxBreakdown — RAW with a class', () => {
  it('level 1: HP == max Hit Die + Con mod for every die size', () => {
    const con = 14; // +2
    for (const hitDie of HIT_DICE) {
      const bd = hitPointMaxBreakdown({
        scores: scoresWithCon(con),
        level: 1,
        hitDie,
      });
      expect(bd.total).toBe(hitDie + 2);
      // Level 1 has no "levels 2-L" component.
      expect(bd.components.find((c) => c.label.startsWith('Levels 2-L'))).toBeUndefined();
      expect(sumComponents(bd.components)).toBe(bd.total);
    }
  });

  it('level L>1: HP == maxDie + fixed×(L-1) + Con×L (+ Dwarven Toughness)', () => {
    const con = 14; // +2
    const level = 5;
    for (const hitDie of HIT_DICE) {
      const bd = hitPointMaxBreakdown({
        scores: scoresWithCon(con),
        level,
        hitDie,
      });
      expect(bd.total).toBe(expectedFixedHp(hitDie, level, con));
      expect(sumComponents(bd.components)).toBe(bd.total);

      const dwarf = hitPointMaxBreakdown({
        scores: scoresWithCon(con),
        level,
        hitDie,
        hpPerLevel: 1,
      });
      expect(dwarf.total).toBe(expectedFixedHp(hitDie, level, con, 1));
      expect(
        dwarf.components.find((c) => c.label === 'Dwarven Toughness')?.value,
      ).toBe(level);
      expect(sumComponents(dwarf.components)).toBe(dwarf.total);
    }
  });

  it('property: RAW HP max matches the floored reference across levels/dice/Con', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...HIT_DICE),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 30 }),
        fc.boolean(),
        (hitDie, level, con, dwarf) => {
          const hpPerLevel = dwarf ? 1 : 0;
          const bd = hitPointMaxBreakdown({
            scores: scoresWithCon(con),
            level,
            hitDie,
            hpPerLevel,
          });
          const expected = expectedFixedHp(hitDie, level, con, hpPerLevel);
          expect(bd.total).toBe(expected);
          expect(sumComponents(bd.components)).toBe(bd.total);

          // The naive (un-floored) sum tells us whether the floor must fire.
          const conMod = abilityModifier(con);
          const naive =
            hitDie +
            conMod +
            (fixedPerLevel(hitDie) + conMod) * Math.max(0, level - 1) +
            hpPerLevel * level;
          const floorComp = bd.components.find(
            (c) => c.label === 'Minimum-HP floor (PHB)',
          );
          if (expected > naive) {
            expect(floorComp?.value).toBe(expected - naive);
          } else {
            expect(floorComp).toBeUndefined();
          }
        },
      ),
    );
  });

  it('minimum-HP floor fires with a large negative Con mod (component present)', () => {
    // Con 1 → -5. At a d6 class, per-level fixed gain is 4; 4 + (-5) = -1 → floored to 1.
    const bd = hitPointMaxBreakdown({
      scores: scoresWithCon(1),
      level: 3,
      hitDie: 6,
    });
    const floorComp = bd.components.find(
      (c) => c.label === 'Minimum-HP floor (PHB)',
    );
    expect(floorComp).toBeDefined();
    expect(floorComp!.value).toBeGreaterThan(0);
    expect(bd.total).toBe(expectedFixedHp(6, 3, 1));
    expect(sumComponents(bd.components)).toBe(bd.total);
  });
});

describe('hitPointMaxBreakdown — rolled-HP variant', () => {
  it('rolled off (default) equals the fixed computation', () => {
    const scores = scoresWithCon(14);
    const fixed = hitPointMaxBreakdown({ scores, level: 5, hitDie: 10 });
    const explicitlyOff = hitPointMaxBreakdown({
      scores,
      level: 5,
      hitDie: 10,
      rolledHp: false,
      rolledHpTotal: 30,
    });
    expect(explicitlyOff.total).toBe(fixed.total);
    expect(explicitlyOff.components.map((c) => c.label)).toEqual(
      fixed.components.map((c) => c.label),
    );
  });

  it('rolled on swaps the fixed component for "Rolled HP (levels 2-L)" and still sums', () => {
    const scores = scoresWithCon(14); // +2
    const level = 5;
    const rolledHpTotal = 27;
    const bd = hitPointMaxBreakdown({
      scores,
      level,
      hitDie: 10,
      rolledHp: true,
      rolledHpTotal,
    });
    const labels = bd.components.map((c) => c.label);
    expect(labels).toContain('Rolled HP (levels 2-L)');
    expect(labels.find((l) => l.startsWith('Levels 2-L'))).toBeUndefined();
    expect(
      bd.components.find((c) => c.label === 'Rolled HP (levels 2-L)')?.value,
    ).toBe(rolledHpTotal);
    // Level 1 (10) + rolled (27) + Con×level (2×5=10) = 47.
    expect(bd.total).toBe(10 + rolledHpTotal + 2 * level);
    expect(sumComponents(bd.components)).toBe(bd.total);
  });

  it('rolled on falls back to fixed when no rolled total is supplied', () => {
    const scores = scoresWithCon(14);
    const fixed = hitPointMaxBreakdown({ scores, level: 4, hitDie: 8 });
    const noTotal = hitPointMaxBreakdown({
      scores,
      level: 4,
      hitDie: 8,
      rolledHp: true,
    });
    expect(noTotal.total).toBe(fixed.total);
    expect(noTotal.components.map((c) => c.label)).toEqual(
      fixed.components.map((c) => c.label),
    );
  });
});

describe('hitPointMaxBreakdown — manual override precedence', () => {
  it('override supersedes the computed total with the computed value in note', () => {
    const scores = scoresWithCon(14);
    const computed = hitPointMaxBreakdown({ scores, level: 5, hitDie: 10 });
    const overridden = hitPointMaxBreakdown({
      scores,
      level: 5,
      hitDie: 10,
      hpMax: 99,
    });
    expect(overridden.total).toBe(99);
    expect(overridden.components).toEqual([{ label: 'Manual override', value: 99 }]);
    expect(overridden.note).toContain(String(computed.total));
    expect(overridden.note).toContain('superseded by manual override');
    expect(overridden.note).toContain('fixed levels 2-L');
  });

  // Test 14b: override wins whether rolledHp is on or off; the note reflects
  // the active mode's computed value.
  it('override precedence: note shows ROLLED computed when rolledHp on, FIXED when off', () => {
    const scores = scoresWithCon(14); // +2
    const level = 5;
    const rolledHpTotal = 27;

    const fixedComputed = hitPointMaxBreakdown({ scores, level, hitDie: 10 }).total;
    const rolledComputed = hitPointMaxBreakdown({
      scores,
      level,
      hitDie: 10,
      rolledHp: true,
      rolledHpTotal,
    }).total;
    expect(rolledComputed).not.toBe(fixedComputed);

    const overrideRolledOn = hitPointMaxBreakdown({
      scores,
      level,
      hitDie: 10,
      hpMax: 100,
      rolledHp: true,
      rolledHpTotal,
    });
    expect(overrideRolledOn.total).toBe(100);
    expect(overrideRolledOn.note).toContain(String(rolledComputed));
    expect(overrideRolledOn.note).toContain('rolled levels 2-L');

    const overrideRolledOff = hitPointMaxBreakdown({
      scores,
      level,
      hitDie: 10,
      hpMax: 100,
      rolledHp: false,
    });
    expect(overrideRolledOff.total).toBe(100);
    expect(overrideRolledOff.note).toContain(String(fixedComputed));
    expect(overrideRolledOff.note).toContain('fixed levels 2-L');
  });
});
