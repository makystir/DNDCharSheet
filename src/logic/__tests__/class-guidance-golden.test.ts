/**
 * Harness for the CLASS GUIDANCE golden table (class-guidance-golden.ts).
 *
 * Maps every row of all four golden groups onto the real, deterministic
 * class-guidance API (src/logic/class-guidance.ts) and asserts the implemented
 * functions reproduce the pinned values exactly. The golden is orchestrator-
 * authored from the PHB 2024 text and MUST NOT be edited here — the harness only
 * consumes it. Every row in every group is consumed.
 */

import { describe, it, expect } from 'vitest';
import {
  RECOMMENDED_ARRAY_CASES,
  STANDARD_ARRAY_MULTISET,
  CLASS_GUIDANCE_CASES,
  ABILITY_HINT_CASES,
  BACKGROUND_FIT_CASES,
  type Ability,
} from './class-guidance-golden';
import {
  recommendedArray,
  classGuidance,
  abilityHints,
  suggestedBackgrounds,
} from '../class-guidance';

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Sorted multiset of the six recommended scores, for permutation checks. */
function sortedScores(scores: Record<Ability, number>): number[] {
  return ABILITIES.map((a) => scores[a]).sort((x, y) => x - y);
}

describe('class-guidance golden: recommendedArray (PHB Standard Array by Class)', () => {
  it.each(RECOMMENDED_ARRAY_CASES)(
    '$classId → $cite',
    ({ classId, scores }) => {
      const actual = recommendedArray(classId);
      expect(actual).toEqual(scores);
      // Per-row self-check: the six scores are exactly a permutation of the
      // standard array 15/14/13/12/10/8.
      expect(sortedScores(actual!)).toEqual([...STANDARD_ARRAY_MULTISET].sort((x, y) => x - y));
    },
  );
});

describe('class-guidance golden: classGuidance (class overview facts)', () => {
  it.each(CLASS_GUIDANCE_CASES)('$classId → $cite', ({ classId, expect: e }) => {
    const actual = classGuidance(classId);
    expect(actual).toBeDefined();
    expect(actual!.primaryAbilities).toEqual(e.primaryAbilities);
    expect(actual!.primaryIsOr).toBe(e.primaryIsOr);
    expect(actual!.savingThrows).toEqual(e.savingThrows);
    expect(actual!.hitDie).toBe(e.hitDie);
    expect(actual!.spellcastingAbility).toBe(e.spellcastingAbility);
  });
});

describe('class-guidance golden: abilityHints (per-ability placement tags)', () => {
  it.each(ABILITY_HINT_CASES)(
    '$classId → $cite',
    ({ classId, primaryPlacement, dumpPlacement, saveAbilities }) => {
      const actual = abilityHints(classId);
      expect(actual).toBeDefined();
      expect(actual!.primaryPlacement).toBe(primaryPlacement);
      expect(actual!.dumpPlacement).toBe(dumpPlacement);
      expect(actual!.saveAbilities).toEqual(saveAbilities);
    },
  );
});

describe('class-guidance golden: suggestedBackgrounds (Ability Scores and Backgrounds)', () => {
  it.each(BACKGROUND_FIT_CASES)('$classId → $cite', ({ classId, suggested }) => {
    const actual = suggestedBackgrounds(classId);
    // Order is not significant — compare as a set.
    expect([...actual].sort()).toEqual([...suggested].sort());
  });
});

describe('class-guidance: tolerant of unknown/empty ids (never throws)', () => {
  it('returns undefined / [] for an unknown or empty classId', () => {
    expect(recommendedArray(undefined)).toBeUndefined();
    expect(recommendedArray('')).toBeUndefined();
    expect(recommendedArray('not-a-class')).toBeUndefined();
    expect(classGuidance(undefined)).toBeUndefined();
    expect(classGuidance('not-a-class')).toBeUndefined();
    expect(abilityHints(undefined)).toBeUndefined();
    expect(abilityHints('not-a-class')).toBeUndefined();
    expect(suggestedBackgrounds(undefined)).toEqual([]);
    expect(suggestedBackgrounds('not-a-class')).toEqual([]);
  });
});
