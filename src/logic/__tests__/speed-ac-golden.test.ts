/**
 * Golden-table harness for Stage A5e: Speed (armour Strength requirement +
 * Exhaustion) and Unarmored Defense (Barbarian / Monk).
 *
 * Maps EVERY row of SPEED_CASES, UNARMORED_DEFENSE_CASES and
 * UNARMORED_DEFENSE_BY_CLASS (speed-ac-golden.ts — authored by the orchestrator
 * from the PHB 2024 text, NEVER edited here) to the real logic and asserts each
 * expected field. The golden file is pure data with no imports; this harness is
 * the only place it is wired to the implementation.
 *
 * Plus: our own edge-case tests and PERMANENT mutation-style tests that confirm
 * the harness FAILS CLOSED — each mutates a golden INPUT and asserts the real
 * result diverges, so a regression in the logic cannot pass unnoticed.
 */
import { describe, it, expect } from 'vitest';
import type { AbilityScores, Character } from '../../types/character';
import { abilityModifier } from '../abilities';
import { combatSpeedBreakdown, speedBreakdown } from '../species';
import {
  armorClassBreakdown,
  unarmoredDefenseFor,
  type ArmorClassOptions,
  type UnarmoredDefense,
} from '../armor-class';
import { createCharacter } from '../../storage/character-store';
import type { ClassId } from '../../data/classes';
import {
  SPEED_CASES,
  UNARMORED_DEFENSE_CASES,
  UNARMORED_DEFENSE_BY_CLASS,
  type SpeedCase,
  type UnarmoredDefenseCase,
  type UnarmoredDefenseKind,
} from './speed-ac-golden';

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** A Breakdown's components must themselves sum to its total (steering). */
function sumsToTotal(bd: { total: number; components: { value: number }[] }): boolean {
  return bd.components.reduce((s, c) => s + c.value, 0) === bd.total;
}

/** Scores with the given Dex/Con/Wis (others 10). */
function scores(dex: number, con: number, wis: number): AbilityScores {
  return { str: 10, dex, con, int: 10, wis, cha: 10 };
}

/** The Unarmored Defense an A5e kind maps to (mirrors the class resolver). */
function udForKind(kind: UnarmoredDefenseKind): UnarmoredDefense | undefined {
  if (kind === 'barbarian') {
    return { ability: 'con', shieldAllowed: true, sourceLabel: 'Barbarian Unarmored Defense' };
  }
  if (kind === 'monk') {
    return { ability: 'wis', shieldAllowed: false, sourceLabel: 'Monk Unarmored Defense' };
  }
  return undefined;
}

// ─── Speed harness ───────────────────────────────────────────────────────────

/**
 * The real Speed breakdown for a golden Speed input. The golden floor row lists
 * components that sum to -10 while declaring total 0 (see FLAGGED ROWS below),
 * so the real breakdown may append a `Speed floor (minimum 0)` component to keep
 * its own components summing to the total. We therefore assert the golden's
 * expected components are an ordered PREFIX of the real components and that the
 * total matches exactly, and separately assert the real breakdown is internally
 * consistent (sums to total).
 */
function assertSpeedCase(tc: SpeedCase): void {
  const bd = combatSpeedBreakdown(tc.input);

  expect(bd.total).toBe(tc.expect.total);

  // Every golden component appears, in order, with the exact label + value.
  for (let i = 0; i < tc.expect.components.length; i += 1) {
    expect(bd.components[i]).toEqual(tc.expect.components[i]);
  }
  // The only extra component the real breakdown may add is the Speed floor,
  // and only when the raw sum went negative (golden total 0 but components < 0).
  const extra = bd.components.slice(tc.expect.components.length);
  const rawGoldenSum = tc.expect.components.reduce((s, c) => s + c.value, 0);
  if (rawGoldenSum < tc.expect.total) {
    expect(extra).toEqual([
      { label: 'Speed floor (minimum 0)', value: tc.expect.total - rawGoldenSum },
    ]);
  } else {
    expect(extra).toEqual([]);
  }

  // The real breakdown is internally consistent regardless of the golden's own
  // (deliberately flagged) non-summing floor row.
  expect(sumsToTotal(bd)).toBe(true);
  // Speed is never negative (floor at 0).
  expect(bd.total).toBeGreaterThanOrEqual(0);
}

describe('SPEED_CASES golden harness (combatSpeedBreakdown)', () => {
  it.each(SPEED_CASES.map((tc) => [tc.name, tc] as const))('%s', (_name, tc) => {
    assertSpeedCase(tc);
  });

  it('exercises every SPEED_CASES row', () => {
    expect(SPEED_CASES.length).toBeGreaterThan(0);
  });
});

// ─── Unarmored Defense harness ───────────────────────────────────────────────

/**
 * Derives the chosen base source from the real AC breakdown's component labels,
 * so the harness checks the golden's `chosen.source` against the implementation
 * rather than against itself.
 */
function sourceFromComponents(
  labels: string[],
  armorWorn: boolean,
): 'armor' | 'unarmored' | 'barbarian' | 'monk' {
  if (armorWorn) return 'armor';
  if (labels.some((l) => l.includes('Barbarian Unarmored Defense'))) return 'barbarian';
  if (labels.some((l) => l.includes('Monk Unarmored Defense'))) return 'monk';
  return 'unarmored';
}

function assertUnarmoredDefenseCase(tc: UnarmoredDefenseCase): void {
  const { input, expect: want } = tc;
  const sc = scores(input.dex, input.con, input.wis);
  const shield = input.shield
    ? ({ id: 'shield', name: 'Shield', category: 'shield', baseAc: 2, addsDex: false, stealthDisadvantage: false, weightLb: 6, costGp: 10, srd: false, source: 'test' } as const)
    : undefined;

  let bd;
  if (input.armorWorn) {
    // A worn suit disables Unarmored Defense entirely. Model the worn armour as
    // a light suit whose base + applied Dex reproduce the golden's armorBase +
    // armorAppliedDex (addsDex with no cap → full Dex applied).
    const appliedDex = input.armorAppliedDex ?? 0;
    const armor = {
      id: 'golden-armor',
      name: 'Worn Armor',
      category: 'light' as const,
      baseAc: input.armorBase ?? 10,
      addsDex: true,
      stealthDisadvantage: false,
      weightLb: 0,
      costGp: 0,
      srd: false,
      source: 'test',
    };
    // The golden's armorAppliedDex is the Dex the armour contributes; a light
    // suit applies the full Dex mod, so the harness only uses armour rows whose
    // appliedDex equals the Dex mod of the input (true for every golden row).
    expect(abilityModifier(input.dex)).toBe(appliedDex);
    const options: ArmorClassOptions = {
      armor,
      shield,
      unarmoredDefense: udForKind(input.kind),
    };
    bd = armorClassBreakdown(sc, undefined, options);
  } else {
    const options: ArmorClassOptions = {
      shield,
      unarmoredDefense: udForKind(input.kind),
    };
    bd = armorClassBreakdown(sc, undefined, options);
  }

  // shieldBonus = the Shield component (0 when a Shield does not apply).
  const shieldComponent = bd.components.find((c) => c.label === 'Shield');
  const shieldBonus = shieldComponent?.value ?? 0;
  expect(shieldBonus).toBe(want.shieldBonus);

  // total = chosen base + shieldBonus.
  expect(bd.total).toBe(want.total);

  // chosen.source inferred from component labels.
  const labels = bd.components.map((c) => c.label);
  expect(sourceFromComponents(labels, Boolean(input.armorWorn))).toBe(want.chosen.source);

  // chosen.base = pre-shield base = total - shieldBonus (and = sum of non-shield
  // additive components).
  expect(bd.total - shieldBonus).toBe(want.chosen.base);

  // The real breakdown is internally consistent.
  expect(sumsToTotal(bd)).toBe(true);
}

describe('UNARMORED_DEFENSE_CASES golden harness (armorClassBreakdown)', () => {
  it.each(UNARMORED_DEFENSE_CASES.map((tc) => [tc.name, tc] as const))('%s', (_name, tc) => {
    assertUnarmoredDefenseCase(tc);
  });

  it('exercises every UNARMORED_DEFENSE_CASES row', () => {
    expect(UNARMORED_DEFENSE_CASES.length).toBeGreaterThan(0);
  });
});

// ─── UNARMORED_DEFENSE_BY_CLASS harness ──────────────────────────────────────

function charWithClass(classId: string): Character {
  const c = createCharacter('T');
  // The golden keys are all valid ClassIds; cast the plain string accordingly.
  // Unknown ids resolve to no class (unarmoredDefenseFor tolerates that).
  c.class = { id: classId as ClassId, level: c.level, skillChoices: [] };
  return c;
}

describe('UNARMORED_DEFENSE_BY_CLASS golden harness (unarmoredDefenseFor)', () => {
  it.each(Object.entries(UNARMORED_DEFENSE_BY_CLASS))('class %s resolves per the golden', (classId, row) => {
    const ud = unarmoredDefenseFor(charWithClass(classId));
    if (row.kind === 'none') {
      expect(ud).toBeUndefined();
      return;
    }
    expect(ud).toBeDefined();
    expect(ud?.ability).toBe(row.ability);
    expect(ud?.shieldAllowed).toBe(row.shieldAllowed);
  });

  it('Draconic Sorcerer (Cha) is a known exclusion: the Sorcerer class grants no Unarmored Defense here', () => {
    // D9: Draconic Sorcerer UD is a SUBCLASS feature, out of A5e scope. The base
    // Sorcerer class grants none, which the golden encodes as kind 'none'.
    expect(UNARMORED_DEFENSE_BY_CLASS.sorcerer.kind).toBe('none');
    expect(unarmoredDefenseFor(charWithClass('sorcerer'))).toBeUndefined();
  });
});

// ─── Our own edge-case tests ─────────────────────────────────────────────────

describe('Speed — edge cases', () => {
  it('no species, no penalties → 30 ft single base component (speedBreakdown)', () => {
    const c = createCharacter('T');
    const bd = speedBreakdown(c);
    expect(bd.total).toBe(30);
    expect(bd.components).toEqual([{ label: 'Base speed', value: 30 }]);
  });

  it('speedBreakdown resolves the worn armour Strength requirement from the catalog', () => {
    const c = createCharacter('T');
    c.abilities.str = 12;
    c.inventory = [{ id: 'a1', kind: 'armor', catalogId: 'chain-mail', quantity: 1 }];
    c.equipped = { armorItemId: 'a1' };
    const bd = speedBreakdown(c);
    expect(bd.total).toBe(20); // 30 - 10 (Str 13 > 12)
    expect(bd.components).toContainEqual({
      label: 'Armor Strength requirement (Str 13)',
      value: -10,
    });
  });

  it('a catalog-less custom worn armour invents no Strength requirement (no penalty)', () => {
    const c = createCharacter('T');
    c.abilities.str = 1;
    c.inventory = [{ id: 'a1', kind: 'armor', name: 'Custom Plate', quantity: 1 }];
    c.equipped = { armorItemId: 'a1' };
    const bd = speedBreakdown(c);
    expect(bd.total).toBe(30);
    expect(bd.components).toEqual([{ label: 'Base speed', value: 30 }]);
  });

  it('armour Str penalty + Exhaustion stack and the components sum to the total', () => {
    const c = createCharacter('T');
    c.abilities.str = 10;
    c.exhaustionLevel = 2;
    c.inventory = [{ id: 'a1', kind: 'armor', catalogId: 'plate-armor', quantity: 1 }];
    c.equipped = { armorItemId: 'a1' };
    const bd = speedBreakdown(c);
    expect(bd.total).toBe(10); // 30 - 10 - 10
    expect(sumsToTotal(bd)).toBe(true);
  });

  it('Speed floors at 0 and the components still sum to the (floored) total', () => {
    const bd = combatSpeedBreakdown({ baseSpeed: 30, str: 8, armorStrengthRequirement: 15, exhaustion: 6 });
    expect(bd.total).toBe(0);
    expect(sumsToTotal(bd)).toBe(true);
    expect(bd.components.at(-1)).toEqual({ label: 'Speed floor (minimum 0)', value: 10 });
  });

  it('Str exactly equal to the requirement applies no penalty (compare scores, >)', () => {
    const bd = combatSpeedBreakdown({ baseSpeed: 30, str: 13, armorStrengthRequirement: 13, exhaustion: 0 });
    expect(bd.total).toBe(30);
    expect(bd.components).toEqual([{ label: 'Base speed', value: 30 }]);
  });
});

describe('Unarmored Defense — edge cases', () => {
  const sc = scores;

  it('no class, no armour → plain 10 + Dex', () => {
    const bd = armorClassBreakdown(sc(14, 16, 16), undefined, {});
    expect(bd.total).toBe(12);
    expect(bd.components[0]).toEqual({ label: 'Base', value: 10 });
  });

  it('a non-UD class in no armour → plain 10 + Dex (no ability mod added)', () => {
    const c = createCharacter('T');
    c.class = { id: 'fighter' as ClassId, level: 1, skillChoices: [] };
    const bd = armorClassBreakdown(c.abilities, undefined, {
      unarmoredDefense: unarmoredDefenseFor(c),
    });
    expect(bd.total).toBe(10); // Dex 10 → +0
    expect(bd.components.some((x) => x.label.includes('Unarmored Defense'))).toBe(false);
  });

  it('Monk without a Shield uses Wis; with a Shield loses UD but keeps the +2', () => {
    const ud = udForKind('monk');
    const without = armorClassBreakdown(sc(16, 10, 14), undefined, { unarmoredDefense: ud });
    expect(without.total).toBe(15); // 10 + 3 + 2
    const withShield = armorClassBreakdown(sc(16, 10, 14), undefined, {
      unarmoredDefense: ud,
      shield: { id: 'shield', name: 'Shield', category: 'shield', baseAc: 2, addsDex: false, stealthDisadvantage: false, weightLb: 6, costGp: 10, srd: false, source: 't' },
    });
    expect(withShield.total).toBe(15); // 10 + 3 + 2 (UD lost, +2 shield)
    expect(withShield.components.some((x) => x.label === 'Wisdom mod')).toBe(false);
    expect(withShield.note).toMatch(/Shield/);
  });

  it('worn armour disables Unarmored Defense even for a Barbarian', () => {
    const armor = { id: 'a', name: 'Chain Shirt', category: 'medium' as const, baseAc: 13, addsDex: true, dexCap: 2, stealthDisadvantage: false, weightLb: 20, costGp: 50, srd: false, source: 't' };
    const bd = armorClassBreakdown(sc(14, 18, 10), undefined, {
      armor,
      unarmoredDefense: udForKind('barbarian'),
    });
    expect(bd.total).toBe(15); // 13 + 2 (Dex), no Con
    expect(bd.components.some((x) => x.label === 'Constitution mod')).toBe(false);
  });

  it('manual override still supersedes Unarmored Defense; the note names the UD computed value', () => {
    const bd = armorClassBreakdown(sc(14, 16, 10), 20, { unarmoredDefense: udForKind('barbarian') });
    expect(bd.total).toBe(20);
    expect(bd.components).toEqual([{ label: 'Manual override', value: 20 }]);
    expect(bd.note).toMatch(/Computed AC = 15/); // 10 + 2 + 3
  });
});

// ─── PERMANENT mutation-style tests (fail-closed) ────────────────────────────
// These perturb a golden INPUT and assert the real result changes, proving the
// oracle cannot be satisfied by a logic that ignores the mutated factor. They
// do NOT mutate any source file.

describe('fail-closed mutation tests', () => {
  it('MUTANT: armour Str penalty that SCALES with the shortfall would diverge', () => {
    // Golden "Plate (Str 15) with Str 8" expects a flat -10 (total 20). A mutant
    // that scaled the penalty with the shortfall (15-8=7) would NOT give -10.
    const real = combatSpeedBreakdown({ baseSpeed: 30, str: 8, armorStrengthRequirement: 15, exhaustion: 0 });
    expect(real.total).toBe(20); // flat -10
    const scaledMutantTotal = 30 - (15 - 8); // 23 — a scaling penalty
    expect(real.total).not.toBe(scaledMutantTotal);
  });

  it('MUTANT: letting Speed go negative would diverge from the 0 floor', () => {
    const real = combatSpeedBreakdown({ baseSpeed: 30, str: 8, armorStrengthRequirement: 15, exhaustion: 6 });
    expect(real.total).toBe(0);
    const unflooredMutantTotal = 30 - 10 - 30; // -10
    expect(real.total).not.toBe(unflooredMutantTotal);
  });

  it('MUTANT: Monk keeping Unarmored Defense with a Shield would raise the total', () => {
    const ud = udForKind('monk');
    const shield = { id: 'shield', name: 'Shield', category: 'shield' as const, baseAc: 2, addsDex: false, stealthDisadvantage: false, weightLb: 6, costGp: 10, srd: false, source: 't' };
    const real = armorClassBreakdown(scores(16, 10, 14), undefined, { unarmoredDefense: ud, shield });
    expect(real.total).toBe(15); // UD LOST: 10 + 3 + 2
    const mutantKeepsUd = 10 + 3 + 2 + 2; // 17 — Wis mod wrongly kept
    expect(real.total).not.toBe(mutantKeepsUd);
  });

  it('MUTANT: adding Con instead of Wis for a Monk would diverge', () => {
    // Monk Dex 16, Con 18 (+4), Wis 14 (+2): correct UD uses Wis (+2) → 15.
    const ud = udForKind('monk');
    const real = armorClassBreakdown(scores(16, 18, 14), undefined, { unarmoredDefense: ud });
    expect(real.total).toBe(15); // 10 + 3 + 2 (Wis)
    const mutantUsesCon = 10 + 3 + 4; // 17 — Con wrongly used
    expect(real.total).not.toBe(mutantUsesCon);
  });

  it('MUTANT: applying Unarmored Defense while armour is worn would raise the total', () => {
    // Golden "Only One Base AC": Barbarian in light armour base 11 + Dex 2 = 13,
    // NOT UD 16. A mutant that applied UD over worn armour would give 16.
    const armor = { id: 'a', name: 'Light', category: 'light' as const, baseAc: 11, addsDex: true, stealthDisadvantage: false, weightLb: 0, costGp: 0, srd: false, source: 't' };
    const real = armorClassBreakdown(scores(14, 18, 10), undefined, {
      armor,
      unarmoredDefense: udForKind('barbarian'),
    });
    expect(real.total).toBe(13); // armour base 11 + Dex 2
    const mutantAppliesUd = 10 + 2 + 4; // 16 — UD wrongly applied over armour
    expect(real.total).not.toBe(mutantAppliesUd);
  });
});
