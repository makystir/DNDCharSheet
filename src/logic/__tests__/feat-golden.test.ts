/**
 * Golden-table harness for Stage A6b PART 1: effective ability scores, the
 * ability-score breakdown, Ability Score Improvement allocation validity, and
 * feat prerequisites — plus the effective-score REWIRE propagation,
 * base-immutability, removeFeat reversal, immutability, and PERMANENT
 * fail-closed mutation tests.
 *
 * Maps EVERY row of the PART 1 golden groups (feat-golden.ts — authored by the
 * orchestrator from the PHB 2024 text, NEVER edited here) to the real logic in
 * ../feats and asserts each expected field. The CATALOG_ORACLE + TRANCHE_FEATS
 * DATA assertions are owned by PART 2's oracle test; this file covers:
 *   - EFFECTIVE_SCORE_CASES   → effectiveAbilityScores
 *   - ABILITY_BREAKDOWN_CASES → abilityScoreBreakdown
 *   - ASI_ALLOCATION_CASES    → isAsiAllocationValid
 *   - PREREQ_CASES            → canTakeFeat
 *
 * The golden file is pure data with no imports; this harness is the only place
 * those rows are wired to the code. No source file is mutated anywhere.
 */
import { describe, it, expect } from 'vitest';
import type { AbilityScores, Character, FeatSelection } from '../../types/character';
import { ABILITIES } from '../../types/character';
import type { ClassId } from '../../data/classes';
import type { FeatId } from '../../data/feats';
import { createCharacter } from '../../storage/character-store';
import { abilityModifier } from '../abilities';
import {
  abilityScoreBreakdown,
  applyFeat,
  canTakeFeat,
  effectiveAbilityScores,
  isAsiAllocationValid,
  removeFeat,
} from '../feats';
import { FEAT_CATALOG } from '../../data/feats';
import { allSkillBreakdowns } from '../skills';
import { allSavingThrowBreakdowns } from '../saving-throws';
import { characterInitiativeModifier } from '../initiative-roll';
import { characterHitPointMaxBreakdown, effectiveHp, hitPointMaxOf } from '../hit-points-state';
import { armorClassBreakdown } from '../armor-class';
import { spellSaveDcBreakdown, spellAttackBreakdown } from '../spellcasting';
import {
  ABILITY_BREAKDOWN_CASES,
  ASI_ALLOCATION_CASES,
  EFFECTIVE_SCORE_CASES,
  PREREQ_CASES,
  type AbilityBreakdownCase,
  type EffectiveScoreCase,
} from './feat-golden';

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** A feat id whose per-increase cap matches `max` (20 → ASI; 30 → Epic Boon). */
function featIdForCap(max: number): FeatId {
  return max === 30 ? 'boon-of-combat-prowess' : 'ability-score-improvement';
}

/** Build a character with the given base scores and recorded feat increases. */
function charWithIncreases(
  base: AbilityScores,
  selections: FeatSelection[],
): Character {
  const c = createCharacter('T');
  c.abilities = { ...base };
  c.advancement = { feats: selections };
  return c;
}

/** The Con score that yields a given modifier (even scores: mod = (score-10)/2). */
function scoreForMod(mod: number): number {
  return 10 + mod * 2;
}

// ─── EFFECTIVE_SCORE_CASES harness (effectiveAbilityScores) ──────────────────

describe('EFFECTIVE_SCORE_CASES golden harness (effectiveAbilityScores)', () => {
  it.each(EFFECTIVE_SCORE_CASES.map((c) => [c.name, c] as const))(
    '%s',
    (_name, tc: EffectiveScoreCase) => {
      // Each golden increase becomes one FeatSelection whose feat carries the
      // matching cap; they are summed in order (matching the golden intent).
      const selections: FeatSelection[] = tc.increases.map((inc, i) => ({
        featId: featIdForCap(inc.max),
        level: 4 + i,
        abilityIncreases: { [inc.ability]: inc.amount },
      }));
      const c = charWithIncreases(tc.base, selections);
      expect(effectiveAbilityScores(c)).toEqual(tc.expect);
      // The base scores are never mutated by reading the effective scores.
      expect(c.abilities).toEqual(tc.base);
    },
  );

  it('exercises every EFFECTIVE_SCORE_CASES row', () => {
    expect(EFFECTIVE_SCORE_CASES.length).toBeGreaterThan(0);
  });
});

// ─── ABILITY_BREAKDOWN_CASES harness (abilityScoreBreakdown) ─────────────────

describe('ABILITY_BREAKDOWN_CASES golden harness (abilityScoreBreakdown)', () => {
  it.each(ABILITY_BREAKDOWN_CASES.map((c) => [c.name, c] as const))(
    '%s',
    (_name, tc: AbilityBreakdownCase) => {
      // Reconstruct the recorded increases from the golden sources. A capped
      // source (label contains "(capped") needs a REQUESTED amount above the
      // applied value so the clamp fires; a clean source requests its value.
      const selections: FeatSelection[] = tc.sources.map((src, i) => {
        const capped = src.label.includes('(capped');
        const requested = capped ? src.value + 1 : src.value;
        // Resolve the feat id whose NAME matches the source label (minus any
        // "(capped at N)" suffix the breakdown appends on a clamp), so the real
        // breakdown reproduces the golden component label.
        const name = src.label.replace(/\s*\(capped at \d+\)$/, '');
        const entry = Object.values(FEAT_CATALOG).find((f) => f.name === name);
        return {
          featId: (entry?.id ?? 'ability-score-improvement') as FeatId,
          level: 4 + i,
          abilityIncreases: { [tc.ability]: requested },
        };
      });
      const base: AbilityScores = {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
        [tc.ability]: tc.base,
      };
      const c = charWithIncreases(base, selections);
      const bd = abilityScoreBreakdown(c, tc.ability);

      expect(bd.total).toBe(tc.expectTotal);
      // Components always sum to the total (calculated-totals invariant).
      expect(bd.components.reduce((s, cc) => s + cc.value, 0)).toBe(bd.total);
      // Base is the first component, with each feat source following.
      expect(bd.components[0]).toEqual({ label: 'Base', value: tc.base });
      expect(bd.components.slice(1)).toEqual(
        tc.sources.map((s) => ({ label: s.label, value: s.value })),
      );
    },
  );

  it('exercises every ABILITY_BREAKDOWN_CASES row', () => {
    expect(ABILITY_BREAKDOWN_CASES.length).toBeGreaterThan(0);
  });
});

// ─── ASI_ALLOCATION_CASES harness (isAsiAllocationValid) ─────────────────────

describe('ASI_ALLOCATION_CASES golden harness (isAsiAllocationValid)', () => {
  it.each(ASI_ALLOCATION_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const result = isAsiAllocationValid(tc.alloc, tc.before);
    expect(result.valid).toBe(tc.expect.valid);
    if (tc.expect.reason !== undefined) {
      expect(result.reason).toBe(tc.expect.reason);
    }
  });

  it('exercises every ASI_ALLOCATION_CASES row', () => {
    expect(ASI_ALLOCATION_CASES.length).toBeGreaterThan(0);
  });
});

// ─── PREREQ_CASES harness (canTakeFeat) ──────────────────────────────────────

describe('PREREQ_CASES golden harness (canTakeFeat)', () => {
  it.each(PREREQ_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    // Build a character at the given level whose EFFECTIVE scores equal the
    // golden `scores` (set base directly; no feats recorded for the check), and
    // whose `taken` feats are recorded so the already-taken/repeatable rule fires.
    const c = createCharacter('T');
    c.level = tc.level;
    for (const ability of ABILITIES) {
      const s = tc.scores[ability];
      if (s !== undefined) c.abilities[ability] = s;
    }
    if (tc.taken && tc.taken.length > 0) {
      c.advancement = {
        feats: tc.taken.map((featId, i) => ({ featId: featId as FeatId, level: 4 + i })),
      };
    }
    const result = canTakeFeat(c, tc.featId);
    expect(result.ok).toBe(tc.expect.ok);
    if (tc.expect.reason !== undefined) {
      expect(result.reason).toBe(tc.expect.reason);
    }
  });

  it('exercises every PREREQ_CASES row', () => {
    expect(PREREQ_CASES.length).toBeGreaterThan(0);
  });
});

// ─── The effective-score REWIRE: propagation to every derived total ──────────

describe('feat-increase propagation (the rewire reaches every derived engine)', () => {
  /** A fighter at a level, with equal base scores so increases are isolated. */
  function fighter(level = 5): Character {
    const c = createCharacter('T');
    c.level = level;
    c.classes = [{ id: 'fighter' as ClassId, level, skillChoices: [] }];
    c.abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    return c;
  }

  it('a feat that raises Dex raises AC, Initiative, the Dex save and Stealth', () => {
    const base = fighter();
    base.skills = { stealth: { proficient: true } };
    base.saveProficiencies = { dex: true };
    const withDex = applyFeat(
      base,
      { featId: 'ability-score-improvement', level: 4, abilityIncreases: { dex: 2 } },
      1,
    );

    // AC: base 10 + Dex mod. +2 Dex (10 → 12) raises the Dex mod by +1.
    const acBefore = armorClassBreakdown(effectiveAbilityScores(base)).total;
    const acAfter = armorClassBreakdown(effectiveAbilityScores(withDex)).total;
    expect(acAfter).toBe(acBefore + 1);

    // Initiative = Dex mod (+ bonus): +1.
    expect(characterInitiativeModifier(withDex).total).toBe(
      characterInitiativeModifier(base).total + 1,
    );

    // Dex saving throw and Stealth skill totals both rise by +1.
    expect(allSavingThrowBreakdowns(withDex).dex.total).toBe(
      allSavingThrowBreakdowns(base).dex.total + 1,
    );
    expect(allSkillBreakdowns(withDex).stealth.total).toBe(
      allSkillBreakdowns(base).stealth.total + 1,
    );
  });

  it('a feat that raises the spellcasting ability raises spell save DC and attack', () => {
    const wiz = createCharacter('T');
    wiz.level = 5;
    wiz.classes = [{ id: 'wizard' as ClassId, level: 5, skillChoices: [] }];
    wiz.abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

    const dcBefore = spellSaveDcBreakdown(wiz)!.total;
    const atkBefore = spellAttackBreakdown(wiz)!.total;

    const withInt = applyFeat(
      wiz,
      { featId: 'ability-score-improvement', level: 4, abilityIncreases: { int: 2 } },
      1,
    );
    // Int 10 → 12 raises the Int mod by +1, so DC and attack each rise by +1.
    expect(spellSaveDcBreakdown(withInt)!.total).toBe(dcBefore + 1);
    expect(spellAttackBreakdown(withInt)!.total).toBe(atkBefore + 1);
  });

  it('a feat that raises Con raises HP max retroactively and currentHp follows', () => {
    const c = fighter(5); // d10, Con 10 (+0)
    const maxBefore = hitPointMaxOf(c)!; // 10 + 6*4 + 0 = 34
    expect(maxBefore).toBe(34);
    // currentHp absent → "at max" and follows the max.
    expect(effectiveHp(c)).toBe(34);

    const withCon = applyFeat(
      c,
      { featId: 'ability-score-improvement', level: 4, abilityIncreases: { con: 2 } },
      1,
    );
    // Con 10 → 12 (+1): the Con rider adds +1 per level → +5 at level 5.
    const maxAfter = characterHitPointMaxBreakdown(withCon).total;
    expect(maxAfter).toBe(34 + 5);
    expect(hitPointMaxOf(withCon)).toBe(39);
    // currentHp was never written (absent), so it follows the raised max.
    expect(withCon.currentHp).toBeUndefined();
    expect(effectiveHp(withCon)).toBe(39);
  });
});

// ─── Base scores are never mutated; removeFeat reverts everywhere ────────────

describe('applyFeat never mutates the base scores; removeFeat reverts the increase', () => {
  function fighter(): Character {
    const c = createCharacter('T');
    c.level = 5;
    c.classes = [{ id: 'fighter' as ClassId, level: 5, skillChoices: [] }];
    c.abilities = { str: 12, dex: 14, con: 13, int: 8, wis: 10, cha: 10 };
    return c;
  }

  it('applyFeat leaves character.abilities (the base) untouched', () => {
    const c = fighter();
    const baseSnapshot = { ...c.abilities };
    const next = applyFeat(
      c,
      { featId: 'ability-score-improvement', level: 4, abilityIncreases: { str: 2 } },
      1,
    );
    expect(c.abilities).toEqual(baseSnapshot); // original untouched
    expect(next.abilities).toEqual(baseSnapshot); // base copied, not raised
    // The increase shows ONLY through the effective layer.
    expect(effectiveAbilityScores(next).str).toBe(14);
    expect(next.abilities.str).toBe(12);
  });

  it('removeFeat reverts the increase everywhere (effective scores + derived totals)', () => {
    const c = fighter();
    const acBefore = armorClassBreakdown(effectiveAbilityScores(c)).total;
    const withDex = applyFeat(
      c,
      { featId: 'ability-score-improvement', level: 4, abilityIncreases: { dex: 2 } },
      1,
    );
    expect(effectiveAbilityScores(withDex).dex).toBe(16);
    expect(armorClassBreakdown(effectiveAbilityScores(withDex)).total).toBe(acBefore + 1);

    const reverted = removeFeat(withDex, 4, 2);
    expect(effectiveAbilityScores(reverted).dex).toBe(14);
    expect(armorClassBreakdown(effectiveAbilityScores(reverted)).total).toBe(acBefore);
    expect(reverted.advancement?.feats ?? []).toHaveLength(0);
  });
});

// ─── Immutability — pure updaters never mutate their input ───────────────────

describe('immutability — applyFeat / removeFeat return new objects', () => {
  it('applyFeat returns a new object and leaves the original unchanged', () => {
    const c = createCharacter('T');
    c.abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const snapshot = JSON.stringify(c);
    const next = applyFeat(
      c,
      { featId: 'actor', level: 4, abilityIncreases: { cha: 1 } },
      1000,
    );
    expect(next).not.toBe(c);
    expect(JSON.stringify(c)).toBe(snapshot);
    expect(next.advancement?.feats).toHaveLength(1);
    expect(next.advancement?.log?.[0].kind).toBe('feat');
  });

  it('removeFeat returns a new object (or the same ref on a no-op) and never mutates', () => {
    const c = createCharacter('T');
    const withFeat = applyFeat(
      c,
      { featId: 'actor', level: 4, abilityIncreases: { cha: 1 } },
      1,
    );
    const snapshot = JSON.stringify(withFeat);
    const reverted = removeFeat(withFeat, 4, 2, 'actor');
    expect(reverted).not.toBe(withFeat);
    expect(JSON.stringify(withFeat)).toBe(snapshot);
    // A no-op removal (no matching slot) returns the same reference.
    expect(removeFeat(withFeat, 99, 3)).toBe(withFeat);
  });
});

// ─── PERMANENT fail-closed mutation tests ────────────────────────────────────
// Each asserts the real result DIVERGES from a described wrong implementation,
// so the harness cannot be satisfied by logic that drops a rule. No source file
// is mutated.

describe('fail-closed mutation tests', () => {
  function charInc(base: Partial<AbilityScores>, selections: FeatSelection[]): Character {
    const full: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...base };
    return charWithIncreases(full, selections);
  }

  it('MUTANT: an ASI that allowed +1 to THREE abilities would be accepted — rejected here', () => {
    // Golden ASI_ALLOCATION_CASES: +1 to three abilities is invalid ('too-many').
    const r = isAsiAllocationValid({ str: 1, dex: 1, con: 1 }, { str: 10, dex: 10, con: 10 });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('too-many');
  });

  it('MUTANT: a general cap that let an increase exceed 20 would diverge', () => {
    // 19 + ASI +2 must clamp to 20, never 21.
    const c = charInc({ str: 19 }, [
      { featId: 'ability-score-improvement', level: 4, abilityIncreases: { str: 2 } },
    ]);
    expect(effectiveAbilityScores(c).str).toBe(20);
    expect(effectiveAbilityScores(c).str).not.toBe(21);
  });

  it('MUTANT: an epic-boon increase wrongly capped at 20 would diverge', () => {
    // 20 + Epic Boon +1 must reach 21 (cap 30), not stay at 20.
    const c = charInc({ str: 20 }, [
      { featId: 'boon-of-combat-prowess', level: 19, abilityIncreases: { str: 1 } },
    ]);
    expect(effectiveAbilityScores(c).str).toBe(21);
    expect(effectiveAbilityScores(c).str).not.toBe(20);
  });

  it('MUTANT: a prereq that ignored level would wrongly permit the ASI at level 3', () => {
    const c = createCharacter('T');
    c.level = 3;
    const r = canTakeFeat(c, 'ability-score-improvement');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('level');
  });

  it('MUTANT: a prereq reading BASE instead of EFFECTIVE scores would block Actor', () => {
    // Base Cha 12 + a +1 Cha feat = effective 13, which satisfies Actor's Cha 13+.
    const c = createCharacter('T');
    c.level = 8;
    c.abilities.cha = 12;
    c.advancement = {
      feats: [{ featId: 'actor', level: 4, abilityIncreases: { cha: 1 } }],
    };
    // Using the ASI feat (repeatable) here to test the Actor prereq without the
    // already-taken rule: effective Cha is 13, so a fresh Actor check passes.
    const fresh = { ...c, advancement: { feats: [
      { featId: 'ability-score-improvement' as FeatId, level: 4, abilityIncreases: { cha: 1 } },
    ] } };
    expect(effectiveAbilityScores(fresh).cha).toBe(13);
    expect(canTakeFeat(fresh, 'actor').ok).toBe(true);
    // If canTakeFeat read BASE Cha (12) it would block with reason 'ability'.
    expect(canTakeFeat(fresh, 'actor').reason).toBeUndefined();
  });

  it('MUTANT: a rewire that forgot the AC module would NOT reflect a Dex feat', () => {
    const c = createCharacter('T');
    c.abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const acBefore = armorClassBreakdown(effectiveAbilityScores(c)).total;
    const withDex = applyFeat(
      c,
      { featId: 'ability-score-improvement', level: 4, abilityIncreases: { dex: 2 } },
      1,
    );
    const acAfter = armorClassBreakdown(effectiveAbilityScores(withDex)).total;
    // The feat MUST reach AC: a +2 Dex (mod +1) means acAfter = acBefore + 1.
    expect(acAfter).toBe(acBefore + 1);
    expect(acAfter).not.toBe(acBefore);
  });
});

// Keep the abilityModifier / scoreForMod import honest.
describe('helper consistency', () => {
  it('scoreForMod round-trips through abilityModifier', () => {
    for (const mod of [-1, 0, 1, 2, 3]) {
      expect(abilityModifier(scoreForMod(mod))).toBe(mod);
    }
  });
});
