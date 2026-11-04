/**
 * CATALOG ORACLE for Stage A6b PART 2: the FEAT_CATALOG data (first tranche).
 *
 * A4-style oracle: this harness wires the orchestrator-authored golden rows
 * (feat-golden.ts — NEVER edited here) to the real data in ../../data/feats and
 * asserts the catalog is well-formed. PART 1's feat-golden.test.ts owns the
 * LOGIC golden groups (effective scores, breakdown, ASI allocation, prereqs);
 * this file owns the DATA assertions the golden table delegates to PART 2:
 *   - CATALOG_ORACLE  → FEAT_CATALOG shape (required ids, repeatable flags,
 *                       valid categories, citation + srd + paraphrase, Origin
 *                       feats carry no minLevel).
 *   - TRANCHE_FEATS   → each tranche row matches its catalog entry (category,
 *                       repeatable, minLevel, abilityMin, abilityIncrease).
 *
 * The golden file is pure data with no imports; this harness is the only place
 * those rows are wired to the data. No source file is mutated anywhere.
 */
import { describe, it, expect } from 'vitest';
import { FEAT_CATALOG, getFeat, allFeats } from '../../data/feats';
import type { FeatData, FeatId } from '../../data/feats';
import { CATALOG_ORACLE, TRANCHE_FEATS } from './feat-golden';
import type { TrancheFeatRow } from './feat-golden';

// ─── CATALOG_ORACLE: the catalog shape ──────────────────────────────────────

describe('CATALOG_ORACLE — FEAT_CATALOG is well-formed', () => {
  it('every required tranche id is present in the catalog', () => {
    for (const id of CATALOG_ORACLE.requiredIds) {
      expect(getFeat(id), `missing feat id: ${id}`).toBeDefined();
    }
  });

  it('every entry is keyed by its own id (no key/id drift)', () => {
    for (const [key, feat] of Object.entries(FEAT_CATALOG)) {
      expect(feat.id).toBe(key);
    }
  });

  it("repeatable flags match the Feat List table's '*' marks", () => {
    const repeatable = new Set(CATALOG_ORACLE.repeatableIds);
    for (const feat of allFeats()) {
      // Only assert the repeatable truth for ids the golden list pins; other
      // (future backfill) entries are not constrained here.
      if (repeatable.has(feat.id)) {
        expect(feat.repeatable, `${feat.id} should be repeatable`).toBe(true);
      } else if (CATALOG_ORACLE.requiredIds.includes(feat.id)) {
        // A pinned, non-'*' tranche feat must NOT be repeatable.
        expect(feat.repeatable ?? false, `${feat.id} should not be repeatable`).toBe(false);
      }
    }
    // Each repeatable id the oracle lists that EXISTS in the catalog is flagged.
    for (const id of CATALOG_ORACLE.repeatableIds) {
      const feat = getFeat(id);
      if (feat) expect(feat.repeatable).toBe(true);
    }
  });

  it('every entry has a valid category', () => {
    for (const feat of allFeats()) {
      expect(CATALOG_ORACLE.categories).toContain(feat.category);
    }
  });

  it('every entry carries a non-empty PHB citation and an srd flag', () => {
    expect(CATALOG_ORACLE.requireCitationAndSrd).toBe(true);
    for (const feat of allFeats()) {
      expect(feat.source.trim().length, `${feat.id} needs a citation`).toBeGreaterThan(0);
      expect(feat.source, `${feat.id} citation should name the PHB`).toContain('PHB 2024');
      expect(['non-srd', 'uncertain'], `${feat.id} srd flag`).toContain(feat.srd);
    }
  });

  it('every entry has a non-empty paraphrased effect (content-tooltips: named rules content)', () => {
    for (const feat of allFeats()) {
      expect(feat.effect.trim().length, `${feat.id} needs a paraphrased effect`).toBeGreaterThan(0);
    }
  });

  it('Origin feats carry no minLevel; General gates at 4, Epic Boon at 19', () => {
    expect(CATALOG_ORACLE.originHasNoMinLevel).toBe(true);
    for (const feat of allFeats()) {
      const minLevel = feat.prerequisite?.minLevel;
      if (feat.category === 'origin') {
        expect(minLevel, `Origin feat ${feat.id} must have no minLevel`).toBeUndefined();
      } else if (feat.category === 'general' && minLevel !== undefined) {
        expect(minLevel, `General feat ${feat.id} level gate`).toBe(4);
      } else if (feat.category === 'epic-boon' && minLevel !== undefined) {
        expect(minLevel, `Epic Boon feat ${feat.id} level gate`).toBe(19);
      }
    }
  });
});

// ─── TRANCHE_FEATS: each golden row matches its catalog entry ────────────────

describe('TRANCHE_FEATS — each golden row matches the catalog entry', () => {
  it.each(TRANCHE_FEATS.map((f) => [f.id, f] as const))(
    '%s matches the catalog',
    (_id, row: TrancheFeatRow) => {
      const feat = getFeat(row.id);
      expect(feat, `missing feat ${row.id}`).toBeDefined();
      const f = feat as FeatData;

      expect(f.name).toBe(row.name);
      expect(f.category).toBe(row.category);
      expect(f.repeatable ?? false).toBe(row.repeatable);
      expect(f.prerequisite?.minLevel).toBe(row.minLevel);

      // Ability-score prerequisite (e.g. Actor Cha 13+).
      if (row.abilityMin) {
        expect(f.prerequisite?.abilityMin).toEqual(row.abilityMin);
      } else {
        expect(f.prerequisite?.abilityMin).toBeUndefined();
      }

      // Ability increase. The ASI feat carries kind:'asi' in the data (its
      // two options are validated by isAsiAllocationValid, so the golden row
      // leaves abilityIncrease undefined); every other row pins the concrete
      // shape the catalog must grant.
      if (row.abilityIncrease === undefined) {
        if (row.id === 'ability-score-improvement') {
          expect(f.abilityIncrease).toEqual({ kind: 'asi' });
        } else {
          expect(f.abilityIncrease).toBeUndefined();
        }
      } else {
        expect(f.abilityIncrease).toEqual(row.abilityIncrease);
      }
    },
  );

  it('exercises every TRANCHE_FEATS row', () => {
    expect(TRANCHE_FEATS.length).toBe(CATALOG_ORACLE.requiredIds.length);
    expect(TRANCHE_FEATS.length).toBeGreaterThan(0);
  });
});

// ─── The FeatId union is derived from the data (cannot drift) ────────────────

describe('FeatId union is derived from FEAT_CATALOG', () => {
  it('each catalog key is assignable to FeatId, and getFeat round-trips', () => {
    for (const key of Object.keys(FEAT_CATALOG)) {
      const id = key as FeatId;
      expect(getFeat(id)?.id).toBe(key);
    }
  });

  it('getFeat returns undefined for an unknown id (never throws)', () => {
    expect(getFeat('not-a-real-feat')).toBeUndefined();
  });
});
