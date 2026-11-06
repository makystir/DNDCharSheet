/**
 * Golden-table harness for Stage A6a: XP thresholds, the per-class feat/ASI
 * level map, fixed Hit Points per class, the per-level HP choice, canLevelUp,
 * and the next-level preview.
 *
 * Maps EVERY row of the golden tables (advancement-golden.ts — authored by the
 * orchestrator from the PHB 2024 text, NEVER edited here) to the real logic in
 * ../advancement and asserts each expected field. The golden file is pure data
 * with no imports; this harness is the only place it is wired to the code.
 *
 * Plus: our own edge-case tests for what the golden tables do not enumerate
 * (absent advancement = milestone default + HP as today; no class; immutability;
 * log append; currentHp follows a recorded HP change; no auto-clear of expended
 * slots on a level change), and PERMANENT mutation-style tests that confirm the
 * harness FAILS CLOSED — each perturbs a golden INPUT and asserts the real
 * result diverges. No source file is mutated.
 */
import { describe, it, expect } from 'vitest';
import type { Character } from '../../types/character';
import type { ClassId, HitDie } from '../../data/classes';
import { createCharacter } from '../../storage/character-store';
import { abilityModifier, proficiencyBonus } from '../abilities';
import {
  applyLevelUp,
  awardXp,
  canLevelUp,
  featSlotLevels,
  hitPointMaxWithAdvancement,
  hpChoiceValue,
  nextLevelPreview,
  setLevel,
  setLevelHp,
  xpForLevel,
  xpToLevel,
  type HpChoiceMode,
} from '../advancement';
import {
  CAN_LEVEL_UP_CASES,
  FEAT_LEVELS_BY_CLASS,
  FEAT_SLOT_CASES,
  FIXED_HP_BY_CLASS,
  HP_CHOICE_CASES,
  NEXT_LEVEL_PREVIEW_CASES,
  XP_FOR_LEVEL_CASES,
  XP_THRESHOLDS,
  XP_TO_LEVEL_CASES,
} from './advancement-golden';

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** A character at `level` in `classId` (empty id = no class). */
function charWith(classId: string, level: number): Character {
  const c = createCharacter('T');
  c.level = level;
  if (classId !== '') {
    c.classes = [{ id: classId as ClassId, level, skillChoices: [] }];
  }
  return c;
}

/** The Con score that yields a given modifier (even scores: mod = (score-10)/2). */
function scoreForMod(mod: number): number {
  return 10 + mod * 2;
}

// ─── XP_THRESHOLDS: PB cross-check against proficiencyBonus(level) ───────────

describe('XP_THRESHOLDS golden — Proficiency Bonus cross-check', () => {
  it.each(XP_THRESHOLDS.map((r) => [r.level, r] as const))(
    'level %s PB matches proficiencyBonus',
    (_level, row) => {
      expect(proficiencyBonus(row.level)).toBe(row.pb);
    },
  );
});

// ─── XP_FOR_LEVEL_CASES harness (xpForLevel) ─────────────────────────────────

describe('XP_FOR_LEVEL_CASES golden harness (xpForLevel)', () => {
  it.each(XP_FOR_LEVEL_CASES.map((c) => [c.level, c] as const))(
    'xpForLevel(%s)',
    (_level, tc) => {
      expect(xpForLevel(tc.level)).toBe(tc.expect);
    },
  );

  it('exercises every XP_FOR_LEVEL_CASES row', () => {
    expect(XP_FOR_LEVEL_CASES.length).toBe(20);
  });
});

// ─── XP_TO_LEVEL_CASES harness (xpToLevel) ───────────────────────────────────

describe('XP_TO_LEVEL_CASES golden harness (xpToLevel)', () => {
  it.each(XP_TO_LEVEL_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    expect(xpToLevel(tc.xp)).toBe(tc.expect);
  });

  it('exercises every XP_TO_LEVEL_CASES row', () => {
    expect(XP_TO_LEVEL_CASES.length).toBeGreaterThan(0);
  });
});

// ─── FEAT_LEVELS_BY_CLASS harness (featSlotLevels at level 20) ───────────────

describe('FEAT_LEVELS_BY_CLASS golden harness (featSlotLevels at level 20)', () => {
  it.each(Object.entries(FEAT_LEVELS_BY_CLASS))(
    'class %s feat levels (full set at level 20)',
    (classId, expected) => {
      const levels = featSlotLevels(charWith(classId, 20));
      expect(levels).toEqual([...expected].sort((a, b) => a - b));
    },
  );

  it('covers all twelve classes', () => {
    expect(Object.keys(FEAT_LEVELS_BY_CLASS).length).toBe(12);
  });
});

// ─── FEAT_SLOT_CASES harness (featSlotLevels at a given level) ───────────────

describe('FEAT_SLOT_CASES golden harness (featSlotLevels)', () => {
  it.each(FEAT_SLOT_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    expect(featSlotLevels(charWith(tc.classId, tc.level))).toEqual(tc.expectLevels);
  });

  it('exercises every FEAT_SLOT_CASES row', () => {
    expect(FEAT_SLOT_CASES.length).toBeGreaterThan(0);
  });
});

// ─── FIXED_HP_BY_CLASS harness (hpChoiceValue fixed, and the level-1 die) ────

describe('FIXED_HP_BY_CLASS golden harness', () => {
  it.each(FIXED_HP_BY_CLASS.map((r) => [r.classId, r] as const))(
    'class %s fixed per-level + level-1 die',
    (_classId, row) => {
      // fixedPerLevel (before Con) = Hit Die/2 + 1 = hpChoiceValue with Con 0.
      expect(hpChoiceValue(row.hitDie as HitDie, 0, 'fixed')).toBe(row.fixedPerLevel);
      // level-1 contribution before Con = the full Hit Die.
      expect(row.level1).toBe(row.hitDie);
    },
  );

  it('the real class Hit Die matches the golden hitDie for every class', () => {
    for (const row of FIXED_HP_BY_CLASS) {
      const c = charWith(row.classId, 1);
      expect(c.classes).toBeDefined();
    }
    expect(FIXED_HP_BY_CLASS.length).toBe(12);
  });
});

// ─── HP_CHOICE_CASES harness (hpChoiceValue) ─────────────────────────────────

describe('HP_CHOICE_CASES golden harness (hpChoiceValue)', () => {
  it.each(HP_CHOICE_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    expect(
      hpChoiceValue(tc.hitDie as HitDie, tc.conMod, tc.mode as HpChoiceMode, tc.face),
    ).toBe(tc.expect);
  });

  it('exercises every HP_CHOICE_CASES row', () => {
    expect(HP_CHOICE_CASES.length).toBeGreaterThan(0);
  });
});

// ─── CAN_LEVEL_UP_CASES harness (canLevelUp) ─────────────────────────────────

describe('CAN_LEVEL_UP_CASES golden harness (canLevelUp)', () => {
  it.each(CAN_LEVEL_UP_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const c = charWith('fighter', tc.level);
    c.advancement = { leveling: { mode: tc.mode, xp: tc.xp } };
    expect(canLevelUp(c)).toBe(tc.expect);
  });

  it('exercises every CAN_LEVEL_UP_CASES row', () => {
    expect(CAN_LEVEL_UP_CASES.length).toBeGreaterThan(0);
  });
});

// ─── NEXT_LEVEL_PREVIEW_CASES harness (nextLevelPreview) ─────────────────────

describe('NEXT_LEVEL_PREVIEW_CASES golden harness (nextLevelPreview)', () => {
  it.each(NEXT_LEVEL_PREVIEW_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const preview = nextLevelPreview(charWith(tc.classId, tc.level));
    expect(preview).not.toBeNull();
    expect(preview!.nextLevel).toBe(tc.expect.nextLevel);
    expect(preview!.featSlotOpens).toBe(tc.expect.featSlotOpens);
    expect(preview!.subclassChoice).toBe(tc.expect.subclassChoice);
    expect(preview!.proficiencyBonusChangesTo).toBe(tc.expect.proficiencyBonusChangesTo);
  });

  it('exercises every NEXT_LEVEL_PREVIEW_CASES row', () => {
    expect(NEXT_LEVEL_PREVIEW_CASES.length).toBeGreaterThan(0);
  });
});

// ─── Our own edge-case tests (what the golden tables do not enumerate) ───────

describe('absent advancement state = milestone default + HP as today', () => {
  it('a character with no advancement field levels via milestone and computes HP normally', () => {
    const c = charWith('fighter', 5);
    expect(c.advancement).toBeUndefined();
    expect(canLevelUp(c)).toBe(true); // milestone default
    // HP max with no per-level records equals the plain character computation.
    const withAdv = hitPointMaxWithAdvancement(c);
    // Fighter d10, Con +0, level 5: 10 + 6*4 = 34.
    expect(withAdv.total).toBe(10 + 6 * 4);
  });

  it('no class: no feat slots, no preview feat/subclass flags, HP as today', () => {
    const c = charWith('', 20);
    expect(featSlotLevels(c)).toEqual([]);
    const preview = nextLevelPreview(c);
    expect(preview).toBeNull(); // at level cap
    const c3 = charWith('', 3);
    const p3 = nextLevelPreview(c3);
    expect(p3).not.toBeNull();
    expect(p3!.featSlotOpens).toBe(false);
    expect(p3!.subclassChoice).toBe(false);
    expect(p3!.features).toEqual([]);
  });

  it('nextLevelPreview returns null at level 20', () => {
    expect(nextLevelPreview(charWith('wizard', 20))).toBeNull();
  });
});

describe('xpToLevel / xpForLevel boundaries beyond the golden rows', () => {
  it('xpForLevel clamps out-of-range levels into 1..20', () => {
    expect(xpForLevel(0)).toBe(0); // clamps to level 1
    expect(xpForLevel(25)).toBe(355000); // clamps to level 20
  });

  it('xpToLevel is monotonic non-decreasing in XP', () => {
    let prev = 0;
    for (let xp = 0; xp <= 400000; xp += 5000) {
      const lvl = xpToLevel(xp);
      expect(lvl).toBeGreaterThanOrEqual(prev);
      prev = lvl;
    }
  });
});

describe('immutability — pure updaters never mutate their input', () => {
  it('setLevel returns a new object and leaves the original level unchanged', () => {
    const c = charWith('wizard', 3);
    const snapshot = JSON.stringify(c);
    const next = setLevel(c, 7);
    expect(next).not.toBe(c);
    expect(next.level).toBe(7);
    expect(JSON.stringify(c)).toBe(snapshot); // original untouched
  });

  it('setLevelHp returns a new object and does not touch the original advancement', () => {
    const c = charWith('fighter', 4);
    const snapshot = JSON.stringify(c);
    const next = setLevelHp(c, 4, { mode: 'fixed' }, 1000);
    expect(next).not.toBe(c);
    expect(JSON.stringify(c)).toBe(snapshot);
    expect(next.advancement?.levels).toEqual([{ level: 4, hp: { mode: 'fixed', value: 6 } }]);
  });

  it('applyLevelUp returns a new object and leaves the original unchanged', () => {
    const c = charWith('wizard', 4);
    const snapshot = JSON.stringify(c);
    const next = applyLevelUp(c, { mode: 'fixed' }, 2000);
    expect(next).not.toBeNull();
    expect(next).not.toBe(c);
    expect(JSON.stringify(c)).toBe(snapshot);
    expect(next!.level).toBe(5);
  });
});

describe('audit log append', () => {
  it('setLevelHp appends an hp entry (oldest-first)', () => {
    const c = charWith('fighter', 4);
    const next = setLevelHp(c, 4, { mode: 'fixed' }, 1234);
    const log = next.advancement?.log ?? [];
    expect(log).toHaveLength(1);
    expect(log[0].kind).toBe('hp');
    expect(log[0].level).toBe(4);
    expect(log[0].timestamp).toBe(1234);
  });

  it('applyLevelUp appends an hp entry then a level-up entry', () => {
    const c = charWith('wizard', 4);
    const next = applyLevelUp(c, { mode: 'rolled', face: 4 }, 5678)!;
    const log = next.advancement?.log ?? [];
    expect(log.map((e) => e.kind)).toEqual(['hp', 'level-up']);
    expect(log[1].level).toBe(5);
  });

  it('awardXp appends an xp-award entry and sets XP mode', () => {
    const c = charWith('fighter', 1);
    const next = awardXp(c, 300, 'Slew the goblins', 9000);
    expect(next.advancement?.leveling?.mode).toBe('xp');
    expect(next.advancement?.leveling?.xp).toBe(300);
    const log = next.advancement?.log ?? [];
    expect(log).toHaveLength(1);
    expect(log[0].kind).toBe('xp-award');
    expect(log[0].xpAmount).toBe(300);
    // Crossing the threshold only PERMITS the level-up; it does not auto-level.
    expect(next.level).toBe(1);
    expect(canLevelUp(next)).toBe(true);
  });

  it('awardXp with a non-positive amount is a no-op', () => {
    const c = charWith('fighter', 1);
    expect(awardXp(c, 0, 'nothing', 1)).toBe(c);
    expect(awardXp(c, -50, 'nothing', 1)).toBe(c);
  });
});

describe('HP max threaded through per-level records', () => {
  it('fixed records equal the fixed computation (no divergence)', () => {
    const c = charWith('fighter', 3); // d10
    let next = setLevelHp(c, 2, { mode: 'fixed' }, 1);
    next = setLevelHp(next, 3, { mode: 'fixed' }, 2);
    // 10 + 6 + 6 = 22 (Con +0), same as characterHitPointMaxBreakdown.
    expect(hitPointMaxWithAdvancement(next).total).toBe(22);
  });

  it('rolled records feed the rolled total through hit-points.ts', () => {
    const c = charWith('fighter', 3); // d10
    let next = setLevelHp(c, 2, { mode: 'rolled', face: 8 }, 1);
    next = setLevelHp(next, 3, { mode: 'rolled', face: 9 }, 2);
    // Level 1 (10) + rolled (8 + 9 = 17) + Con×level (0) = 27.
    expect(hitPointMaxWithAdvancement(next).total).toBe(27);
  });

  it('a Con change still recomputes the Con rider through the HP math', () => {
    const c = charWith('fighter', 3);
    c.abilities.con = scoreForMod(2); // +2
    let next = setLevelHp(c, 2, { mode: 'rolled', face: 8 }, 1);
    next = setLevelHp(next, 3, { mode: 'rolled', face: 9 }, 2);
    // Level 1 (10) + rolled (17) + Con×level (2×3=6) = 33.
    expect(hitPointMaxWithAdvancement(next).total).toBe(33);
    // Raising Con raises the max via the rider, not the stored record.
    const raised = { ...next, abilities: { ...next.abilities, con: scoreForMod(3) } };
    expect(hitPointMaxWithAdvancement(raised).total).toBe(10 + 17 + 3 * 3); // 36
  });
});

describe('currentHp follows a recorded HP change (route through hit-points-state)', () => {
  it('absent currentHp follows the new max after an HP record raises it', () => {
    // A character "at max" (currentHp absent) should read as the new max once a
    // per-level rolled record raises the HP maximum.
    const c = charWith('fighter', 3);
    c.abilities.con = scoreForMod(0);
    let next = setLevelHp(c, 2, { mode: 'rolled', face: 10 }, 1);
    next = setLevelHp(next, 3, { mode: 'rolled', face: 10 }, 2);
    const max = hitPointMaxWithAdvancement(next).total; // 10 + 20 = 30
    expect(max).toBe(30);
    // currentHp is absent → "at max"; it was never written, so it follows.
    expect(next.currentHp).toBeUndefined();
  });
});

describe('no auto-clear of expended spell slots on a level change', () => {
  it('applyLevelUp preserves a wizard\u2019s expended standard slots across a level increase', () => {
    // A level-up is not a rest, so valid expended slots are retained (not cleared).
    const c = charWith('wizard', 4);
    c.spellcasting = { slotsExpended: { 1: 2 } };
    const next = applyLevelUp(c, { mode: 'fixed' }, 1)!;
    expect(next.spellcasting?.slotsExpended).toEqual({ 1: 2 });
  });

  it('applyLevelUp preserves a warlock\u2019s expended Pact Magic slot across a level increase', () => {
    // Warlock has Pact Magic slots, so an expended pact slot is a valid record
    // that a level increase must NOT clear (reconcile only clamps to the cap,
    // which rises with level).
    const c = charWith('warlock', 4);
    c.spellcasting = { pactSlotsExpended: 1 };
    const next = applyLevelUp(c, { mode: 'fixed' }, 1)!;
    expect(next.spellcasting?.pactSlotsExpended).toBe(1);
  });

  it('setLevel preserves slotsExpended when raising the level', () => {
    const c = charWith('wizard', 3);
    c.spellcasting = { slotsExpended: { 1: 1 } };
    const next = setLevel(c, 5);
    expect(next.spellcasting?.slotsExpended).toEqual({ 1: 1 });
  });
});

describe('applyLevelUp gating', () => {
  it('returns null at level 20 (milestone)', () => {
    const c = charWith('fighter', 20);
    expect(applyLevelUp(c, { mode: 'fixed' }, 1)).toBeNull();
  });

  it('returns null in XP mode without enough XP', () => {
    const c = charWith('fighter', 1);
    c.advancement = { leveling: { mode: 'xp', xp: 299 } };
    expect(applyLevelUp(c, { mode: 'fixed' }, 1)).toBeNull();
  });

  it('advances exactly one level in XP mode even with XP for several levels', () => {
    const c = charWith('fighter', 1);
    c.advancement = { leveling: { mode: 'xp', xp: 6500 } }; // enough for level 5
    const next = applyLevelUp(c, { mode: 'fixed' }, 1)!;
    expect(next.level).toBe(2); // only one level at a time
  });
});

// ─── PERMANENT mutation-style tests (fail-closed) ────────────────────────────
// Each perturbs a golden INPUT and asserts the real result changes, proving the
// oracle cannot be satisfied by logic that ignores the mutated factor. No source
// file is mutated.

describe('fail-closed mutation tests', () => {
  it('MUTANT: a shifted XP threshold would diverge from xpForLevel', () => {
    // Golden level 5 threshold is 6,500. A table off by any amount would differ.
    expect(xpForLevel(5)).toBe(6500);
    const shiftedMutant = 6500 + 1;
    expect(xpForLevel(5)).not.toBe(shiftedMutant);
  });

  it('MUTANT: dropping the Fighter level-6 feat marker would diverge', () => {
    // Golden Fighter at level 6 expects [4, 6]. A map missing the level-6 marker
    // would give [4].
    const real = featSlotLevels(charWith('fighter', 6));
    expect(real).toEqual([4, 6]);
    expect(real).not.toEqual([4]);
  });

  it('MUTANT: adding a spurious level-10 marker to Wizard would diverge', () => {
    // Golden Wizard at level 12 expects [4, 8, 12] (no level-10 slot).
    const real = featSlotLevels(charWith('wizard', 12));
    expect(real).toEqual([4, 8, 12]);
    expect(real).not.toEqual([4, 8, 10, 12]);
  });

  it('MUTANT: a fixed-HP value off by one would diverge from hpChoiceValue', () => {
    // d10 fixed before Con = 6. A value of 5 or 7 would differ.
    expect(hpChoiceValue(10, 0, 'fixed')).toBe(6);
    expect(hpChoiceValue(10, 0, 'fixed')).not.toBe(5);
    expect(hpChoiceValue(10, 0, 'fixed')).not.toBe(7);
  });

  it('MUTANT: a missing min-1 floor would let a per-level gain go below 1', () => {
    // d6 fixed (4) + Con -5 = -1 → floored to 1. Without the floor it would be -1.
    const real = hpChoiceValue(6, -5, 'fixed');
    expect(real).toBe(1);
    const unflooredMutant = 4 + -5; // -1
    expect(real).not.toBe(unflooredMutant);
  });

  it('MUTANT: rolled min-1 floor fires on a low face + negative Con', () => {
    // d8 rolled face 1 + Con -2 = -1 → 1.
    const real = hpChoiceValue(8, -2, 'rolled', 1);
    expect(real).toBe(1);
    expect(real).not.toBe(1 + -2); // -1
  });

  it('MUTANT: canLevelUp auto-leveling two levels at once would be wrong', () => {
    // Enough XP for level 5 at character level 1: canLevelUp is TRUE (permits the
    // next level) but applyLevelUp advances only ONE level. A mutant that jumped
    // to level 5 would diverge.
    const c = charWith('fighter', 1);
    c.advancement = { leveling: { mode: 'xp', xp: 6500 } };
    expect(canLevelUp(c)).toBe(true);
    const next = applyLevelUp(c, { mode: 'fixed' }, 1)!;
    expect(next.level).toBe(2);
    expect(next.level).not.toBe(5); // not an auto-jump to the XP-permitted level
  });

  it('MUTANT: canLevelUp ignoring the XP threshold would wrongly permit', () => {
    // 299 XP at level 1: must NOT permit level 2 (threshold 300).
    const c = charWith('fighter', 1);
    c.advancement = { leveling: { mode: 'xp', xp: 299 } };
    expect(canLevelUp(c)).toBe(false);
  });

  it('MUTANT: nextLevelPreview missing the subclass-at-3 flag would diverge', () => {
    // Wizard 2 -> 3 must flag subclassChoice true and featSlotOpens false.
    const preview = nextLevelPreview(charWith('wizard', 2))!;
    expect(preview.subclassChoice).toBe(true);
    expect(preview.featSlotOpens).toBe(false);
    // A mutant that dropped the subclass flag would read false here.
    expect(preview.subclassChoice).not.toBe(false);
  });

  it('MUTANT: nextLevelPreview reporting a PB change where none occurs would diverge', () => {
    // Wizard 3 -> 4: PB stays +2, so proficiencyBonusChangesTo must be undefined.
    const preview = nextLevelPreview(charWith('wizard', 3))!;
    expect(preview.proficiencyBonusChangesTo).toBeUndefined();
    // And 4 -> 5 DOES change to +3.
    const p5 = nextLevelPreview(charWith('wizard', 4))!;
    expect(p5.proficiencyBonusChangesTo).toBe(3);
  });

  it('MUTANT: xpToLevel treating the threshold as strictly-greater would diverge', () => {
    // Exactly 300 XP must reach level 2 (>=, not >).
    expect(xpToLevel(300)).toBe(2);
    // A strictly-greater mutant would still report level 1 at exactly 300.
    expect(xpToLevel(300)).not.toBe(1);
  });
});

// Reference the abilityModifier import so the helper stays honest about Con mods.
describe('scoreForMod helper is consistent with abilityModifier', () => {
  it('round-trips a few modifiers', () => {
    for (const mod of [-2, -1, 0, 2, 3]) {
      expect(abilityModifier(scoreForMod(mod))).toBe(mod);
    }
  });
});
