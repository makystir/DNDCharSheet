/**
 * GOLDEN TABLE for Stage A6b: feats, Ability Score Improvements, effective ability
 * scores, and the feat-selection rules.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md) BEFORE the logic is implemented. The implementer must
 * make the real functions reproduce every row and MUST NOT edit this file. If a row
 * looks wrong, flag it in the summary instead of changing it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. A harness in the
 * implementer's tests maps each row to the real API.
 *
 * Sources (PHB 2024, Docs/PlayersHandbook.md):
 *  - Parts of a Feat (L8356): Category (Origin/General/Fighting Style/Epic Boon),
 *    Prerequisite (a minimum level, an ability-score minimum, and/or a class needing
 *    >= 1 level), Benefit, Repeatable.
 *  - Feat List table (L8372-8448): the feats and their categories; a '*' marks a
 *    repeatable feat (Ability Score Improvement, Elemental Adept, Magic Initiate,
 *    Skilled).
 *  - Ability Score Improvement feat (L8558): General, Level 4+, repeatable. Increase
 *    one score by 2 OR two scores by 1; cannot raise a score above 20.
 *  - General feats with an Ability Score Increase (e.g. Actor L8568: Cha 13+, +1 Cha
 *    to max 20; Resilient L8874: +1 to a chosen ability to max 20).
 *  - Epic Boon feats (L9124+): Level 19+; "Increase one ability score of your choice
 *    by 1, to a maximum of 30."
 *  - Origin feats (L8454+): no level prerequisite (granted by Backgrounds); most have
 *    no ability increase (Alert, Savage Attacker, Skilled, Tough).
 *  - The effective ability score = base score + the sum of the increases recorded on
 *    the feats the character has taken, clamped per the feat that granted each
 *    increase (20 for General/ASI; 30 for Epic Boon). The BASE scores are never
 *    mutated (auditable + reversible).
 *
 * TRANCHE NOTE: A6b lands the MECHANISM against a FIRST TRANCHE of feats (the ones in
 * TRANCHE_FEATS below); the remaining ~80 Feat List entries are backfilled later. The
 * catalog oracle (CATALOG_ORACLE) asserts the tranche entries are present and
 * well-formed; the FULL-list completeness check is deferred to the backfill.
 *
 * Rows tagged `interpretation` are orchestrator-approved readings where the PHB does
 * not state the point verbatim.
 */

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type FeatCategory = 'origin' | 'general' | 'fighting-style' | 'epic-boon';

// ─── The first-tranche feats the catalog must contain (id, category, key facts) ──
export interface TrancheFeatRow {
  id: string;
  name: string;
  category: FeatCategory;
  repeatable: boolean;
  /** Minimum character level, or undefined (Origin feats have none; General = 4; Epic Boon = 19). */
  minLevel?: number;
  /** Ability-score prerequisite(s), e.g. { cha: 13 } for Actor. */
  abilityMin?: Partial<Record<Ability, number>>;
  /** How the feat raises scores, matching FeatData.abilityIncrease. undefined = none. */
  abilityIncrease?:
    | { kind: 'choose-one'; amount: 2; max: 20 }   // ASI option A
    | { kind: 'choose-two'; amount: 1; max: 20 }    // ASI option B
    | { kind: 'fixed'; ability: Ability; amount: 1; max: 20 }       // e.g. Actor +1 Cha
    | { kind: 'choose-one'; abilities: Ability[]; amount: 1; max: 20 }    // e.g. Resilient +1 to a chosen ability
    | { kind: 'epic-boon'; abilities: Ability[]; amount: 1; max: 30 };    // Epic Boon +1 to max 30
  cite: string;
}

/**
 * The ASI feat carries BOTH options; the selection records which the player chose.
 * Modeled as kind 'asi' in the real data so the picker can offer +2-one or +1+1-two;
 * this golden row pins its identity, category, repeatable flag and level gate.
 */
export const TRANCHE_FEATS: TrancheFeatRow[] = [
  // The ASI feat (its two options are validated by ASI_ALLOCATION_CASES, not a single abilityIncrease shape).
  { id: 'ability-score-improvement', name: 'Ability Score Improvement', category: 'general', repeatable: true, minLevel: 4, cite: 'PHB 2024 L8558' },
  // Origin feats (no level prereq; most have no ability increase).
  { id: 'alert', name: 'Alert', category: 'origin', repeatable: false, cite: 'PHB 2024 L8458' },
  { id: 'savage-attacker', name: 'Savage Attacker', category: 'origin', repeatable: false, cite: 'PHB 2024 L8528' },
  { id: 'skilled', name: 'Skilled', category: 'origin', repeatable: true, cite: 'PHB 2024 L8532' },
  { id: 'tough', name: 'Tough', category: 'origin', repeatable: false, cite: 'PHB 2024 L8550' },
  // General feats with a clean Ability Score Increase.
  { id: 'actor', name: 'Actor', category: 'general', repeatable: false, minLevel: 4, abilityMin: { cha: 13 }, abilityIncrease: { kind: 'fixed', ability: 'cha', amount: 1, max: 20 }, cite: 'PHB 2024 L8568' },
  { id: 'resilient', name: 'Resilient', category: 'general', repeatable: false, minLevel: 4, abilityIncrease: { kind: 'choose-one', abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'], amount: 1, max: 20 }, cite: 'PHB 2024 L8874' },
  // An Epic Boon (level 19+, +1 to max 30).
  { id: 'boon-of-combat-prowess', name: 'Boon of Combat Prowess', category: 'epic-boon', repeatable: false, minLevel: 19, abilityIncrease: { kind: 'epic-boon', abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'], amount: 1, max: 30 }, cite: 'PHB 2024 L9130' },
];

// ─── Catalog oracle (A4-style; applied to the real FEAT_CATALOG) ─────────────
export const CATALOG_ORACLE = {
  /** Every tranche id must exist in the catalog. */
  requiredIds: TRANCHE_FEATS.map((f) => f.id),
  /** The '*' feats in the Feat List table are repeatable. */
  repeatableIds: ['ability-score-improvement', 'elemental-adept', 'magic-initiate', 'skilled'],
  /** Valid categories. */
  categories: ['origin', 'general', 'fighting-style', 'epic-boon'] as FeatCategory[],
  /** Every catalog entry must carry a non-empty PHB citation. */
  requireCitation: true,
  /** Origin feats must NOT have a minLevel; General feats that gate carry minLevel 4; Epic Boon 19. */
  originHasNoMinLevel: true,
};

// ─── Ability Score Improvement: allocation validity + caps ───────────────────
export interface AsiAllocationCase {
  name: string;
  cite: string;
  /** The allocation the player entered for the ASI feat. */
  alloc: Partial<Record<Ability, number>>;
  /** Effective scores BEFORE this allocation (to check the max-20 cap). */
  before: Partial<Record<Ability, number>>;
  expect: { valid: boolean; reason?: string };
}

export const ASI_ALLOCATION_CASES: AsiAllocationCase[] = [
  { name: '+2 to one ability is valid', cite: 'ASI feat', alloc: { str: 2 }, before: { str: 14 }, expect: { valid: true } },
  { name: '+1 to two abilities is valid', cite: 'ASI feat', alloc: { dex: 1, con: 1 }, before: { dex: 14, con: 12 }, expect: { valid: true } },
  { name: '+2 split as +1+1 to the SAME ability is NOT how it works (must be two abilities)', cite: 'ASI feat: one by 2, or two by 1', alloc: { str: 1 }, before: { str: 14 }, expect: { valid: false, reason: 'incomplete' } },
  { name: '+1 to three abilities is invalid', cite: 'ASI feat: one by 2 or two by 1', alloc: { str: 1, dex: 1, con: 1 }, before: { str: 10, dex: 10, con: 10 }, expect: { valid: false, reason: 'too-many' } },
  { name: '+2 to one and +1 to another is invalid (over budget)', cite: 'ASI feat', alloc: { str: 2, dex: 1 }, before: { str: 10, dex: 10 }, expect: { valid: false, reason: 'too-many' } },
  { name: '+3 to one is invalid', cite: 'ASI feat', alloc: { str: 3 }, before: { str: 10 }, expect: { valid: false, reason: 'too-many' } },
  { name: 'Cannot raise above 20 (+2 onto 19)', cite: 'ASI feat: cannot increase above 20', alloc: { str: 2 }, before: { str: 19 }, expect: { valid: false, reason: 'over-cap' } },
  { name: '+1 onto 19 to reach exactly 20 is valid (as the +1+1 option, paired with another)', cite: 'ASI feat', alloc: { str: 1, dex: 1 }, before: { str: 19, dex: 10 }, expect: { valid: true } },
  { name: '+1 onto 20 is over the cap', cite: 'ASI feat: cannot increase above 20', alloc: { str: 1, dex: 1 }, before: { str: 20, dex: 10 }, expect: { valid: false, reason: 'over-cap' } },
  { name: '+2 onto 18 reaches exactly 20 (valid)', cite: 'ASI feat', alloc: { con: 2 }, before: { con: 18 }, expect: { valid: true } },
  { name: 'An empty allocation is incomplete', cite: 'ASI feat', alloc: {}, before: { str: 10 }, expect: { valid: false, reason: 'incomplete' } },
];

// ─── Feat prerequisite checks (against EFFECTIVE scores + level) ─────────────
export interface PrereqCase {
  name: string;
  cite: string;
  /** Present on rows that encode an orchestrator-approved reading, not verbatim PHB. */
  interpretation?: string;
  featId: string;
  /** The character's level. */
  level: number;
  /** The character's EFFECTIVE ability scores at check time. */
  scores: Partial<Record<Ability, number>>;
  /** Feats already taken (for repeatable / already-taken checks). */
  taken?: string[];
  expect: { ok: boolean; reason?: 'level' | 'ability' | 'already-taken' };
}

export const PREREQ_CASES: PrereqCase[] = [
  { name: 'ASI needs level 4 (level 3 fails)', cite: 'ASI: Level 4+', featId: 'ability-score-improvement', level: 3, scores: {}, expect: { ok: false, reason: 'level' } },
  { name: 'ASI at level 4 is allowed', cite: 'ASI: Level 4+', featId: 'ability-score-improvement', level: 4, scores: {}, expect: { ok: true } },
  { name: 'ASI is repeatable: taking it again is allowed', cite: 'ASI: Repeatable', featId: 'ability-score-improvement', level: 8, scores: {}, taken: ['ability-score-improvement'], expect: { ok: true } },
  { name: 'Actor needs Charisma 13 (Cha 12 fails)', cite: 'Actor: Cha 13+', featId: 'actor', level: 4, scores: { cha: 12 }, expect: { ok: false, reason: 'ability' } },
  { name: 'Actor with Charisma 13 at level 4 is allowed', cite: 'Actor: Level 4+, Cha 13+', featId: 'actor', level: 4, scores: { cha: 13 }, expect: { ok: true } },
  { name: 'Actor Cha 13 but level 3 fails on level', cite: 'Actor: Level 4+', featId: 'actor', level: 3, scores: { cha: 15 }, expect: { ok: false, reason: 'level' } },
  { name: 'A non-repeatable feat already taken cannot be taken again', cite: 'Parts of a Feat: Repeatable (default once)', featId: 'actor', level: 8, scores: { cha: 15 }, taken: ['actor'], expect: { ok: false, reason: 'already-taken' } },
  { name: 'Resilient (no ability prereq, Level 4+) at level 4 is allowed', cite: 'Resilient: Level 4+', featId: 'resilient', level: 4, scores: { con: 10 }, expect: { ok: true } },
  { name: 'An Origin feat has no level prereq (allowed at level 1)', cite: 'Origin feats: no level prerequisite', featId: 'alert', level: 1, scores: {}, expect: { ok: true } },
  { name: 'Epic Boon needs level 19 (level 18 fails)', cite: 'Epic Boon: Level 19+', featId: 'boon-of-combat-prowess', level: 18, scores: {}, expect: { ok: false, reason: 'level' } },
  { name: 'Epic Boon at level 19 is allowed', cite: 'Epic Boon: Level 19+', featId: 'boon-of-combat-prowess', level: 19, scores: {}, expect: { ok: true } },
  { name: 'Actor ability prereq reads EFFECTIVE Cha (12 base + a +1 feat = 13 passes)', cite: 'Prerequisite checks effective scores', interpretation: 'A feat that already raised Cha to 13 satisfies a later Cha-13 prereq.', featId: 'actor', level: 8, scores: { cha: 13 }, expect: { ok: true } },
];

// ─── Effective ability scores (base + recorded feat increases, capped) ───────
export interface EffectiveScoreCase {
  name: string;
  cite: string;
  /** Present on rows that encode an orchestrator-approved reading, not verbatim PHB. */
  interpretation?: string;
  base: Record<Ability, number>;
  /** Feat increases taken, each with its cap (20 general / 30 epic boon). */
  increases: { ability: Ability; amount: number; max: number }[];
  expect: Record<Ability, number>;
}

const B = (over: Partial<Record<Ability, number>>): Record<Ability, number> => ({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...over });

export const EFFECTIVE_SCORE_CASES: EffectiveScoreCase[] = [
  { name: 'No feats: effective equals base', cite: 'Effective scores', base: B({ str: 15 }), increases: [], expect: B({ str: 15 }) },
  { name: 'ASI +2 Str: 15 -> 17', cite: 'ASI feat', base: B({ str: 15 }), increases: [{ ability: 'str', amount: 2, max: 20 }], expect: B({ str: 17 }) },
  { name: 'Two increases to the same ability sum (16 +2 then +1 = 19)', cite: 'ASI feats stack', base: B({ con: 16 }), increases: [{ ability: 'con', amount: 2, max: 20 }, { ability: 'con', amount: 1, max: 20 }], expect: B({ con: 19 }) },
  { name: 'A general-cap increase does not exceed 20 (19 +2 clamps to 20)', cite: 'ASI: max 20', base: B({ str: 19 }), increases: [{ ability: 'str', amount: 2, max: 20 }], expect: B({ str: 20 }) },
  { name: 'Multiple increases clamp at 20 overall (18 +2 +2 = 20, not 22)', cite: 'ASI: max 20', base: B({ str: 18 }), increases: [{ ability: 'str', amount: 2, max: 20 }, { ability: 'str', amount: 2, max: 20 }], expect: B({ str: 20 }) },
  { name: 'An Epic Boon raises the cap to 30 (20 +1 = 21)', cite: 'Epic Boon: max 30', base: B({ str: 20 }), increases: [{ ability: 'str', amount: 1, max: 30 }], expect: B({ str: 21 }) },
  { name: 'Epic Boon clamps at 30 (30 +1 stays 30)', cite: 'Epic Boon: max 30', base: B({ str: 30 }), increases: [{ ability: 'str', amount: 1, max: 30 }], expect: B({ str: 30 }) },
  { name: 'Increases to different abilities are independent', cite: 'Effective scores', base: B({ dex: 14, con: 12 }), increases: [{ ability: 'dex', amount: 1, max: 20 }, { ability: 'con', amount: 1, max: 20 }], expect: B({ dex: 15, con: 13 }) },
  { name: 'A general +2 then an epic +1 on the same ability: 19 -> 20 (cap 20) -> 21 (cap 30)', cite: 'Mixed caps apply per increase cumulatively', interpretation: 'Each increase is applied in order and clamped to the running value under ITS cap; a later epic-boon increase can carry the total above 20.', base: B({ str: 19 }), increases: [{ ability: 'str', amount: 2, max: 20 }, { ability: 'str', amount: 1, max: 30 }], expect: B({ str: 21 }) },
];

// ─── The ability-score breakdown (Base + each feat source = effective) ───────
export interface AbilityBreakdownCase {
  name: string;
  cite: string;
  ability: Ability;
  base: number;
  /** Each contributing feat increase, as it should appear as a breakdown component. */
  sources: { label: string; value: number }[];
  expectTotal: number;
}

export const ABILITY_BREAKDOWN_CASES: AbilityBreakdownCase[] = [
  { name: 'No feats: just Base', cite: 'calculated-totals', ability: 'str', base: 15, sources: [], expectTotal: 15 },
  { name: 'Base 15 + ASI +2', cite: 'ASI feat', ability: 'str', base: 15, sources: [{ label: 'Ability Score Improvement', value: 2 }], expectTotal: 17 },
  { name: 'Base 14 + Actor +1', cite: 'Actor', ability: 'cha', base: 14, sources: [{ label: 'Actor', value: 1 }], expectTotal: 15 },
  // Base 18 + ASI +2 reaches the cap exactly (20); the component sums to the total.
  { name: 'Base 18 + ASI +2 = 20 (at the cap)', cite: 'ASI feats; cap 20', ability: 'con', base: 18, sources: [{ label: 'Ability Score Improvement', value: 2 }], expectTotal: 20 },
  // Base 19 + ASI +2 would be 21 but the cap clamps to 20; the APPLIED component is
  // +1 (not +2) so components still sum to the total, and the note explains the clamp.
  { name: 'Base 19 + ASI (+2 requested, clamped to +1) = 20, with a cap note', cite: 'ASI feats; cannot exceed 20', ability: 'str', base: 19, sources: [{ label: 'Ability Score Improvement (capped at 20)', value: 1 }], expectTotal: 20 },
];
