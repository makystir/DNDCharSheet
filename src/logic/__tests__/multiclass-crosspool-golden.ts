/**
 * GOLDEN TABLE for Stage M5 (multiclassing: display) — the one DETERMINISTIC
 * rules piece of the final stage: Warlock Pact Magic / Spellcasting CROSS-POOL
 * casting (PHB 2024 L2168). The rest of M5 is UI display (judged by review).
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md L2168) BEFORE the M5 cross-pool logic is implemented.
 * The implementer must make the real function reproduce every row and MUST NOT
 * edit this file. If a row looks wrong, STOP and flag it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists.
 *
 * Source — PHB 2024 "Pact Magic" multiclass paragraph (L2168):
 *  "If you have the Pact Magic feature from the Warlock class and the
 *   Spellcasting feature, you can use the spell slots you gain from Pact Magic
 *   to cast spells you have prepared from classes with the Spellcasting feature,
 *   and you can use the spell slots you gain from the Spellcasting feature to
 *   cast Warlock spells you have prepared."
 *
 * So when a character has BOTH pools, they are INTERCHANGEABLE FOR CASTING: a
 * prepared spell of level L is castable if EITHER pool has an UNEXPENDED slot of
 * level >= L. (The pools are still tracked/recovered separately — Pact Magic on
 * a Short or Long Rest, Spellcasting on a Long Rest — M3; this rule is only
 * about which slots may cast which prepared spells.) When the character has only
 * ONE of the two pools, casting uses that pool as normal (no cross-pool).
 *
 * The deterministic helper under test: highestCastableSpellLevel(character) and
 * a castability check — given the two pools' available (unexpended) slot levels,
 * the highest spell level the character can currently cast is the max slot level
 * available across BOTH pools (when both exist). Pact Magic slots are all one
 * level (the Warlock's pact slot level); Spellcasting slots are the per-level
 * combined vector (M3). A prepared spell of level L is castable iff
 * L <= that highest available level AND a slot of level >= L is unexpended in
 * at least one pool.
 */

export type ClassId =
  | 'barbarian' | 'bard' | 'cleric' | 'druid' | 'fighter' | 'monk'
  | 'paladin' | 'ranger' | 'rogue' | 'sorcerer' | 'warlock' | 'wizard';

// ─── Highest castable spell level across both pools (highestCastableSpellLevel) ─
// Inputs: the Spellcasting (combined) slot vector's available levels and the
// Pact Magic available slot level (0 = none). `spellcastingSlots` is per spell
// level 1..9 (available/unexpended counts). `pactLevel` = the pact slot level
// with >=1 unexpended pact slot (0 = no pact pool or all expended).
// Expect = the highest spell level castable using EITHER pool.
export interface HighestCastableCase {
  name: string;
  cite: string;
  hasSpellcasting: boolean;
  hasPact: boolean;
  /** Available (unexpended) Spellcasting slots per spell level 1..9. */
  spellcastingSlots: number[];
  /** Pact slot level with >=1 unexpended slot (0 = none). */
  pactLevel: number;
  expect: number;
}

export const HIGHEST_CASTABLE_CASES: HighestCastableCase[] = [
  {
    name: 'Spellcasting only: highest = top non-empty Spellcasting level',
    cite: 'single pool: Spellcasting',
    hasSpellcasting: true,
    hasPact: false,
    spellcastingSlots: [4, 3, 2, 0, 0, 0, 0, 0, 0], // up to level 3
    pactLevel: 0,
    expect: 3,
  },
  {
    name: 'Pact only: highest = pact slot level',
    cite: 'single pool: Pact Magic',
    hasSpellcasting: false,
    hasPact: true,
    spellcastingSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    pactLevel: 3,
    expect: 3,
  },
  {
    name: 'Both pools: pact level 5 above Spellcasting top 3 → highest 5 (cross-pool lifts it)',
    cite: 'PHB L2168: either pool\u2019s slots cast your prepared spells',
    hasSpellcasting: true,
    hasPact: true,
    spellcastingSlots: [4, 3, 2, 0, 0, 0, 0, 0, 0], // Spellcasting up to 3
    pactLevel: 5, // high-level Warlock pact slots
    expect: 5,
  },
  {
    name: 'Both pools: Spellcasting top 6 above pact 2 → highest 6',
    cite: 'the max available slot level across both pools',
    hasSpellcasting: true,
    hasPact: true,
    spellcastingSlots: [4, 3, 3, 3, 2, 1, 0, 0, 0], // up to level 6
    pactLevel: 2,
    expect: 6,
  },
  {
    name: 'Both pools but pact expended (pactLevel 0) → only Spellcasting counts',
    cite: 'an expended pool offers no slot',
    hasSpellcasting: true,
    hasPact: true,
    spellcastingSlots: [4, 3, 0, 0, 0, 0, 0, 0, 0], // up to level 2
    pactLevel: 0, // all pact slots expended
    expect: 2,
  },
  {
    name: 'No pools → 0',
    cite: 'non-caster / all expended',
    hasSpellcasting: false,
    hasPact: false,
    spellcastingSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    pactLevel: 0,
    expect: 0,
  },
];

// ─── Is a prepared spell castable right now (canCastPreparedSpell) ───────────
// A prepared spell of level `spellLevel` (1..9; 0 = cantrip, always castable) is
// castable iff at least one pool has an unexpended slot of level >= spellLevel.
// When BOTH pools exist, a Warlock-prepared spell may use a Spellcasting slot
// and a Spellcasting-class-prepared spell may use a Pact slot (PHB L2168). The
// helper does not care which CLASS prepared the spell for castability — only
// whether some available slot (either pool) is high enough.
export interface CanCastCase {
  name: string;
  cite: string;
  spellLevel: number; // 0 = cantrip
  spellcastingSlots: number[]; // available per level 1..9
  pactLevel: number; // pact slot level with an unexpended slot (0 = none)
  expect: boolean;
}

export const CAN_CAST_CASES: CanCastCase[] = [
  { name: 'Cantrip always castable', cite: 'cantrips use no slot', spellLevel: 0, spellcastingSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0], pactLevel: 0, expect: true },
  { name: 'Level 1 with a level-1 Spellcasting slot', cite: 'own-pool cast', spellLevel: 1, spellcastingSlots: [2, 0, 0, 0, 0, 0, 0, 0, 0], pactLevel: 0, expect: true },
  { name: 'Level 3 with only a level-2 slot → not castable', cite: 'no slot >= spell level', spellLevel: 3, spellcastingSlots: [4, 3, 0, 0, 0, 0, 0, 0, 0], pactLevel: 0, expect: false },
  { name: 'Level 3 castable via a higher (level-4) Spellcasting slot', cite: 'a higher slot casts a lower spell', spellLevel: 3, spellcastingSlots: [4, 3, 3, 1, 0, 0, 0, 0, 0], pactLevel: 0, expect: true },
  { name: 'Level 4 Warlock-prepared spell castable via a level-5 PACT slot (cross-pool)', cite: 'PHB L2168: pact slot casts a prepared spell', spellLevel: 4, spellcastingSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0], pactLevel: 5, expect: true },
  { name: 'Level 5 Spellcasting-prepared spell castable via a level-5 pact slot (cross-pool)', cite: 'PHB L2168: either pool\u2019s slots cast your prepared spells', spellLevel: 5, spellcastingSlots: [4, 3, 3, 0, 0, 0, 0, 0, 0], pactLevel: 5, expect: true },
  { name: 'Level 6 with top slot 5 in both pools → not castable', cite: 'no pool has a slot >= 6', spellLevel: 6, spellcastingSlots: [4, 3, 3, 3, 2, 0, 0, 0, 0], pactLevel: 5, expect: false },
];
