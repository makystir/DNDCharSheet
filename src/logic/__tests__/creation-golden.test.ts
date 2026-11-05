/**
 * Golden-table harness for Stage A7 (character creation): ability-score
 * generation, point-buy, 4d6 rolls, backgrounds (catalog + application +
 * ability allocation), languages, and the flavor-generator mechanism contract.
 *
 * Maps EVERY group of the A7 golden (creation-golden.ts — authored by the
 * orchestrator from the PHB 2024 text, NEVER edited here) onto the real logic
 * and asserts each row. The golden is pure data with no imports; this harness
 * is the only place those rows are wired to code.
 */
import { describe, it, expect } from 'vitest';
import type { Ability } from '../../types/character';
import { ABILITIES, SKILLS } from '../../types/character';
import type { RNG } from '../random';
import {
  standardArray,
  pointBuyCost,
  pointBuyTotalCost,
  isPointBuyValid,
  rollAbilityScore,
} from '../ability-score-generation';
import {
  applyBackground,
  isBackgroundAbilityAllocationValid,
  type BackgroundAbilityAllocation,
} from '../backgrounds';
import { effectiveAbilityScores, characterFeats } from '../feats';
import { resolveLanguages } from '../languages';
import {
  generateName,
  generateAppearance,
  generateAge,
  generateRandomCharacter,
} from '../personal-details-generation';
import { ageRangeFor } from '../../data/name-tables';
import {
  BACKGROUND_CATALOG,
  getBackground,
  type BackgroundId,
} from '../../data/backgrounds';
import { getFeat } from '../../data/feats';
import { SPECIES_LIST, type SpeciesId } from '../../data/species';
import { createCharacter } from '../../storage/character-store';
import {
  STANDARD_ARRAY_EXPECTED,
  POINT_BUY_COST_CASES,
  POINT_BUY_ALLOCATION_CASES,
  ROLL_CASES,
  BACKGROUND_CASES,
  BACKGROUND_ABILITY_CASES,
  BACKGROUND_CATALOG_ORACLE,
  LANGUAGE_CASES,
  GENERATOR_CONTRACT,
} from './creation-golden';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * A scripted RNG that yields each of `faces` in order mapped into its d6 bucket
 * so `Math.floor(rng()*6)+1 === face`. Maps a face f to (f-0.5)/6 (the golden's
 * agreed mapping). Throws if drained, so an over-consuming roll fails loudly.
 */
function scriptedD6Rng(faces: number[]): RNG {
  let i = 0;
  return () => {
    if (i >= faces.length) throw new Error('scriptedD6Rng drained');
    const f = faces[i++];
    return (f - 0.5) / 6;
  };
}

/** A deterministic linear-congruential RNG for the generator contract tests. */
function seededRng(seed: number): RNG {
  let state = seed >>> 0;
  return () => {
    // Numerical Recipes LCG; returns a float in [0,1).
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** kebab-case a camelCase skill id, e.g. sleightOfHand -> sleight-of-hand. */
function toKebab(id: string): string {
  return id.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Normalize a golden skill token (kebab) to the catalog camelCase SkillId. */
function toCamelSkill(token: string): string {
  const match = SKILLS.find((s) => s.id === token || toKebab(s.id) === token);
  return match ? match.id : token;
}

// ─── Standard Array ──────────────────────────────────────────────────────────

describe('STANDARD_ARRAY_EXPECTED (standardArray)', () => {
  it('matches the PHB fixed six scores, highest-first', () => {
    expect(standardArray()).toEqual(STANDARD_ARRAY_EXPECTED);
  });
});

// ─── Point-buy cost per score ────────────────────────────────────────────────

describe('POINT_BUY_COST_CASES (pointBuyCost)', () => {
  it.each(POINT_BUY_COST_CASES.map((c) => [c.name, c] as const))(
    '%s',
    (_name, tc) => {
      expect(pointBuyCost(tc.score)).toBe(tc.cost);
    },
  );
});

// ─── Point-buy total + validity ──────────────────────────────────────────────

describe('POINT_BUY_ALLOCATION_CASES (pointBuyTotalCost / isPointBuyValid)', () => {
  it.each(POINT_BUY_ALLOCATION_CASES.map((c) => [c.name, c] as const))(
    '%s',
    (_name, tc) => {
      expect(pointBuyTotalCost(tc.scores)).toBe(tc.totalCost);
      expect(isPointBuyValid(tc.scores)).toBe(tc.valid);
    },
  );
});

// ─── 4d6-drop-lowest under a scripted RNG ────────────────────────────────────

describe('ROLL_CASES (rollAbilityScore)', () => {
  it.each(ROLL_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const rng = scriptedD6Rng([...tc.faces]);
    expect(rollAbilityScore(rng)).toBe(tc.expected);
  });
});

// ─── Background catalog data rows (BACKGROUND_CASES) + application ───────────

describe('BACKGROUND_CASES (catalog data + applyBackground)', () => {
  it.each(BACKGROUND_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const bg = getBackground(tc.backgroundId);
    expect(bg).toBeDefined();
    if (!bg) return;

    // Catalog abilities, in PHB order.
    expect(bg.abilities).toEqual(tc.abilities);
    // Origin feat id.
    expect(bg.originFeatId).toBe(tc.originFeatId);
    // Skills (normalize golden kebab to catalog camelCase).
    expect([...bg.skills].sort()).toEqual(tc.skills.map(toCamelSkill).sort());
    // Tool: a specific tool id OR a category marker.
    const toolToken = bg.tool.id ?? bg.tool.category;
    expect(toolToken).toBe(tc.tool);
    // Package gold.
    expect(bg.equipment.packageGold).toBe(tc.packageGold);

    // applyBackground effects: increase recorded, origin feat present, skills proficient.
    const base = createCharacter('T');
    const allocation: BackgroundAbilityAllocation[] = [
      { ability: tc.abilities[0], amount: 2 },
      { ability: tc.abilities[1], amount: 1 },
    ];
    const baseScores = { ...base.abilities };
    const applied = applyBackground(
      base,
      tc.backgroundId as BackgroundId,
      { abilityAllocation: allocation, equipmentChoice: 'B' },
      1000,
    );

    // Base scores never mutated.
    expect(base.abilities).toEqual(baseScores);
    expect(applied.abilities).toEqual(baseScores);
    // Effective scores reflect the +2/+1.
    const eff = effectiveAbilityScores(applied);
    expect(eff[tc.abilities[0]]).toBe(baseScores[tc.abilities[0]] + 2);
    expect(eff[tc.abilities[1]]).toBe(baseScores[tc.abilities[1]] + 1);
    // The origin feat is recorded as a level-0 (no-slot) feat selection.
    const feats = characterFeats(applied);
    expect(feats.some((f) => f.featId === tc.originFeatId && f.level === 0)).toBe(true);
    // Both skills are now proficient.
    for (const skill of tc.skills.map(toCamelSkill)) {
      expect(applied.skills?.[skill as keyof typeof applied.skills]?.proficient).toBe(true);
    }
    // Option B grants exactly 50 GP.
    expect(applied.coins?.gp).toBe(50);
  });
});

// ─── Background ability allocation validity ──────────────────────────────────

describe('BACKGROUND_ABILITY_CASES (isBackgroundAbilityAllocationValid)', () => {
  it.each(BACKGROUND_ABILITY_CASES.map((c) => [c.name, c] as const))(
    '%s',
    (_name, tc) => {
      expect(
        isBackgroundAbilityAllocationValid(tc.abilities, tc.allocation),
      ).toBe(tc.valid);
    },
  );
});

// ─── Catalog structural invariants for ALL 16 backgrounds ────────────────────

describe('BACKGROUND_CATALOG_ORACLE (every background)', () => {
  it('contains exactly the 16 required ids', () => {
    const ids = Object.keys(BACKGROUND_CATALOG).sort();
    expect(ids).toEqual([...BACKGROUND_CATALOG_ORACLE.requiredIds].sort());
  });

  it.each(BACKGROUND_CATALOG_ORACLE.requiredIds)(
    '%s has 3 abilities / 2 skills / 1 tool / 1 resolvable origin feat / option-B 50 GP',
    (id) => {
      const bg = getBackground(id);
      expect(bg).toBeDefined();
      if (!bg) return;
      expect(bg.abilities).toHaveLength(BACKGROUND_CATALOG_ORACLE.abilitiesPerBackground);
      expect(bg.skills).toHaveLength(BACKGROUND_CATALOG_ORACLE.skillsPerBackground);
      // Exactly one tool: either a specific id OR a category, never both/neither.
      const hasId = typeof bg.tool.id === 'string';
      const hasCategory = typeof bg.tool.category === 'string';
      expect(hasId !== hasCategory).toBe(true);
      // Exactly one origin feat that resolves in FEAT_CATALOG and is an Origin feat.
      const feat = getFeat(bg.originFeatId);
      expect(feat).toBeDefined();
      expect(feat?.category).toBe('origin');
      // Option B is 50 GP (asserted through applyBackground on a fresh character).
      const applied = applyBackground(
        createCharacter('T'),
        id as BackgroundId,
        {
          abilityAllocation: [
            { ability: bg.abilities[0], amount: 2 },
            { ability: bg.abilities[1], amount: 1 },
          ],
          equipmentChoice: 'B',
        },
        1,
      );
      expect(applied.coins?.gp).toBe(BACKGROUND_CATALOG_ORACLE.equipmentOptionBGold);
    },
  );
});

// ─── Languages ───────────────────────────────────────────────────────────────

describe('LANGUAGE_CASES (resolveLanguages)', () => {
  it.each(LANGUAGE_CASES.map((c) => [c.name, c] as const))('%s', (_name, tc) => {
    const resolved = resolveLanguages(tc.chosen);
    expect([...resolved].sort()).toEqual([...tc.expectedSet].sort());
    // Common is always present and never duplicated.
    expect(resolved.filter((l) => l === 'common')).toHaveLength(1);
    expect(resolved).toContain('common');
  });
});

// ─── Generator mechanism contract ────────────────────────────────────────────

describe('GENERATOR_CONTRACT (flavor generators)', () => {
  const species = SPECIES_LIST.map((s) => s.id);
  const genders = GENERATOR_CONTRACT.genders as ('male' | 'female' | 'neutral')[];

  it('supports exactly the contract genders', () => {
    expect([...genders].sort()).toEqual(['female', 'male', 'neutral']);
  });

  it.each(species.flatMap((sp) => genders.map((g) => [sp, g] as const)))(
    '%s/%s has >= minimum distinct names and non-empty generated fields',
    (sp: SpeciesId, g) => {
      // Enumerate the pool by sampling a single long RNG stream; assert >= floor.
      const seen = new Set<string>();
      const stream = seededRng(1);
      for (let i = 0; i < 4000; i++) {
        seen.add(generateName(sp, g, stream));
      }
      // User requirement "> 200": the pool must be STRICTLY greater than the
      // contract floor (i.e. at least 201 distinct names per species × gender).
      expect(seen.size).toBeGreaterThan(GENERATOR_CONTRACT.minNamesPerSpeciesGender);

      // Every generated field is non-empty for this combo.
      const rng = seededRng(42);
      expect(generateName(sp, g, rng).length).toBeGreaterThan(0);
      const app = generateAppearance(sp, g, rng);
      for (const field of [app.eyes, app.hair, app.skin, app.height, app.weight]) {
        expect(field.length).toBeGreaterThan(0);
      }

      // Age generator: non-empty and within the species' NON-RAW band. Sample
      // many draws so the in-range invariant is exercised, not just one value.
      const range = ageRangeFor(sp);
      const ageStream = seededRng(99);
      for (let i = 0; i < 2000; i++) {
        const ageStr = generateAge(sp, ageStream);
        expect(ageStr.length).toBeGreaterThan(0);
        const age = Number(ageStr);
        expect(Number.isInteger(age)).toBe(true);
        expect(age).toBeGreaterThanOrEqual(range.min);
        expect(age).toBeLessThanOrEqual(range.max);
      }
    },
  );

  it('is deterministic: same seed → identical name, appearance, and character', () => {
    const sp = species[0];
    const g = genders[0];
    expect(generateName(sp, g, seededRng(7))).toBe(generateName(sp, g, seededRng(7)));
    expect(generateAppearance(sp, g, seededRng(9))).toEqual(
      generateAppearance(sp, g, seededRng(9)),
    );
    expect(generateAge(sp, seededRng(11))).toBe(generateAge(sp, seededRng(11)));
    // Full character: compare the deterministic content (id/timestamps vary).
    const stripVolatile = (c: ReturnType<typeof generateRandomCharacter>) => {
      const items = c as unknown as Record<string, unknown>;
      const copy = JSON.parse(JSON.stringify(items)) as Record<string, unknown>;
      delete copy.id;
      delete copy.createdAt;
      delete copy.updatedAt;
      // Advancement log timestamps derive from the wall-clock createdAt (not
      // the RNG), so strip them: determinism here is about the injected RNG.
      const adv = copy.advancement as Record<string, unknown> | undefined;
      if (adv && Array.isArray(adv.log)) {
        adv.log = (adv.log as Record<string, unknown>[]).map((e) => {
          const { timestamp: _ts, ...rest } = e;
          return rest;
        });
      }
      // Inventory item ids are random UUIDs; strip them too.
      if (Array.isArray(copy.inventory)) {
        copy.inventory = (copy.inventory as Record<string, unknown>[]).map((it) => {
          const { id: _id, ...rest } = it;
          return rest;
        });
      }
      return copy;
    };
    const a = generateRandomCharacter(seededRng(123));
    const b = generateRandomCharacter(seededRng(123));
    expect(stripVolatile(a)).toEqual(stripVolatile(b));
  });

  it('species-varying fields actually differ across at least two species', () => {
    for (const field of GENERATOR_CONTRACT.speciesVaryingFields) {
      const samples = species.map((sp) => {
        if (field === 'name') return firstPool(sp, 'neutral');
        if (field === 'height') return heightSample(sp);
        if (field === 'weight') return weightSample(sp);
        if (field === 'age') return ageSample(sp);
        return appearancePool(sp, field as 'eyes' | 'hair' | 'skin');
      });
      const distinct = new Set(samples.map((s) => JSON.stringify(s)));
      expect(distinct.size).toBeGreaterThanOrEqual(2);
    }
  });

  it('gender-varying fields differ across at least two genders', () => {
    for (const field of GENERATOR_CONTRACT.genderVaryingFields) {
      expect(field).toBe('name'); // only name varies by gender in this model
      const sp = species[0];
      const pools = genders.map((g) => firstPool(sp, g));
      const distinct = new Set(pools.map((p) => JSON.stringify(p)));
      expect(distinct.size).toBeGreaterThanOrEqual(2);
    }
  });

  // Field-pool samplers read the generator output surface, not the raw tables,
  // so the test exercises the real accessors the generators use.
  function firstPool(sp: SpeciesId, g: 'male' | 'female' | 'neutral'): string[] {
    const seen = new Set<string>();
    const stream = seededRng(1);
    for (let i = 0; i < 2000; i++) seen.add(generateName(sp, g, stream));
    return [...seen].sort();
  }
  function appearancePool(sp: SpeciesId, field: 'eyes' | 'hair' | 'skin'): string[] {
    const seen = new Set<string>();
    const stream = seededRng(1);
    for (let i = 0; i < 2000; i++) seen.add(generateAppearance(sp, 'neutral', stream)[field]);
    return [...seen].sort();
  }
  function heightSample(sp: SpeciesId): string[] {
    const seen = new Set<string>();
    const stream = seededRng(1);
    for (let i = 0; i < 2000; i++) seen.add(generateAppearance(sp, 'neutral', stream).height);
    return [...seen].sort();
  }
  function weightSample(sp: SpeciesId): string[] {
    const seen = new Set<string>();
    const stream = seededRng(1);
    for (let i = 0; i < 2000; i++) seen.add(generateAppearance(sp, 'neutral', stream).weight);
    return [...seen].sort();
  }
  function ageSample(sp: SpeciesId): string[] {
    const seen = new Set<string>();
    const stream = seededRng(1);
    for (let i = 0; i < 2000; i++) seen.add(generateAge(sp, stream));
    return [...seen].sort();
  }
});

// Keep the ABILITIES import honest (used to keep the Ability type in scope for
// the harness's typed helpers above).
describe('harness sanity', () => {
  it('knows the six abilities', () => {
    expect(ABILITIES).toHaveLength(6);
    const _a: Ability = 'str';
    expect(_a).toBe('str');
  });
});
