/**
 * GOLDEN TABLE for Stage M3 (multiclassing: spellcasting) — the combined
 * Multiclass Spellcaster slot table, the caster-level weighting, the combined
 * slot vector, the single-spellcasting-class special case, and per-class spell
 * save DC / attack.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md L2119-2165) + the shipped FULL_CASTER_SLOTS and
 * SPELLCASTING_DESCRIPTORS in src/data/spell-progression.ts, BEFORE the M3 logic
 * is implemented. The implementer must make the real functions reproduce every
 * row and MUST NOT edit this file. If a row looks wrong, STOP and flag it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists.
 *
 * Sources (PHB 2024; re-verified against src/data/spell-progression.ts):
 *  - Multiclass Spellcaster: Spell Slots per Spell Level (PHB L2128-2155). The
 *    OCR of that table is MANGLED; the RAW table is the standard full-caster
 *    grid, which the codebase already holds VERBATIM as FULL_CASTER_SLOTS. So
 *    the combined multiclass slots = FULL_CASTER_SLOTS[combinedCasterLevel].
 *    MULTICLASS_SLOT_TABLE_CASES pins the reconstructed table == FULL_CASTER_SLOTS.
 *  - Combined caster level (PHB L2156-2163 "Spell Slots"):
 *      + ALL levels in FULL casters: Bard, Cleric, Druid, Sorcerer, Wizard.
 *      + ceil(level / 2) per HALF caster: Paladin, Ranger (round UP), applied
 *        PER CLASS before summing.
 *      + floor(level / 3) per THIRD caster: Fighter (Eldritch Knight subclass) /
 *        Rogue (Arcane Trickster subclass), round DOWN, per class.
 *      - Warlock Pact Magic levels are EXCLUDED entirely (separate pool).
 *    Then look up FULL_CASTER_SLOTS[that total] for the leveled slots.
 *    PHB worked example (L2163): Ranger 4 / Sorcerer 3 → counts as level 5 →
 *    four level-1, three level-2, two level-3 slots (== FULL_CASTER_SLOTS[5]).
 *  - Single Spellcasting class (PHB L2122): "If you multiclass but have the
 *    Spellcasting feature from only one class, follow the rules for that class."
 *    So a Fighter(non-EK) / Wizard uses the WIZARD single-class table at the
 *    Wizard level, NOT the combined level. A class counts as "having the
 *    Spellcasting feature" only if its feature is ACTIVE (EK/AT only from the
 *    subclass's casting level 3). WARLOCK Pact Magic is NOT a "Spellcasting
 *    feature" for this count (it is Pact Magic) — so Warlock + one Spellcasting
 *    class = "one Spellcasting class" → that class's own table.
 *  - Spells Prepared / DC / attack (PHB L2119): prepared PER CLASS as a
 *    single-classed member; each spell tied to its class's ability; save DC =
 *    8 + PB(total level) + mod(that class's ability); attack = PB + that mod.
 *    PB is by TOTAL character level (unchanged). One DC/attack per casting class.
 *
 * All functions pure. character.level is the stored TOTAL (M1).
 */

export type ClassId =
  | 'barbarian' | 'bard' | 'cleric' | 'druid' | 'fighter' | 'monk'
  | 'paladin' | 'ranger' | 'rogue' | 'sorcerer' | 'warlock' | 'wizard';

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

// ─── The combined slot table equals FULL_CASTER_SLOTS ────────────────────────
// A single structural assertion: the reconstructed Multiclass Spellcaster table
// is byte-identical to FULL_CASTER_SLOTS[1..20]. The harness asserts the
// implementation's combined-slot lookup for caster level N equals
// FULL_CASTER_SLOTS[N] for every N in 1..20, and spot-checks these rows.
export interface SlotTableRow {
  casterLevel: number;
  /** Slots per spell level 1..9 (the FULL_CASTER_SLOTS[level] 1..9 tail). */
  slots: number[];
}

export const MULTICLASS_SLOT_TABLE_CASES: SlotTableRow[] = [
  { casterLevel: 1, slots: [2, 0, 0, 0, 0, 0, 0, 0, 0] },
  { casterLevel: 3, slots: [4, 2, 0, 0, 0, 0, 0, 0, 0] },
  { casterLevel: 5, slots: [4, 3, 2, 0, 0, 0, 0, 0, 0] }, // the PHB worked example
  { casterLevel: 10, slots: [4, 3, 3, 3, 2, 0, 0, 0, 0] },
  { casterLevel: 20, slots: [4, 3, 3, 3, 3, 2, 2, 1, 1] },
];

// ─── Combined caster level (combinedCasterLevel) ─────────────────────────────
// Per-class levels + each class's subclass (for EK/AT third-caster detection).
// expect = the combined caster level that indexes FULL_CASTER_SLOTS.
export interface CombinedLevelCase {
  name: string;
  cite: string;
  classes: { id: ClassId; level: number; subclassId?: string }[];
  expect: number;
}

export const COMBINED_CASTER_LEVEL_CASES: CombinedLevelCase[] = [
  {
    name: 'Ranger 4 / Sorcerer 3 → 2 (half, round up) + 3 (full) = 5 (PHB example)',
    cite: 'PHB L2163 worked example',
    classes: [{ id: 'ranger', level: 4 }, { id: 'sorcerer', level: 3 }],
    expect: 5,
  },
  {
    name: 'Cleric 5 / Wizard 5 → 5 + 5 = 10 (both full)',
    cite: 'full casters: all levels',
    classes: [{ id: 'cleric', level: 5 }, { id: 'wizard', level: 5 }],
    expect: 10,
  },
  {
    name: 'Paladin 5 / Ranger 5 → ceil(5/2)+ceil(5/2) = 3+3 = 6 (per-class round up)',
    cite: 'half casters round UP per class, then sum',
    classes: [{ id: 'paladin', level: 5 }, { id: 'ranger', level: 5 }],
    expect: 6,
  },
  {
    name: 'Paladin 1 / Druid 1 → ceil(1/2)=1 + 1 = 2',
    cite: 'half caster at level 1 contributes 1',
    classes: [{ id: 'paladin', level: 1 }, { id: 'druid', level: 1 }],
    expect: 2,
  },
  {
    name: 'Eldritch Knight Fighter 6 / Wizard 2 → floor(6/3)=2 + 2 = 4',
    cite: 'third caster (EK) floor, per class',
    classes: [{ id: 'fighter', level: 6, subclassId: 'eldritchKnight' }, { id: 'wizard', level: 2 }],
    expect: 4,
  },
  {
    name: 'Arcane Trickster Rogue 3 / Sorcerer 4 → floor(3/3)=1 + 4 = 5',
    cite: 'third caster (AT) floor',
    classes: [{ id: 'rogue', level: 3, subclassId: 'arcaneTrickster' }, { id: 'sorcerer', level: 4 }],
    expect: 5,
  },
  {
    name: 'Non-EK Fighter 5 / Wizard 3 → Fighter contributes 0 (not a caster) → 3',
    cite: 'a non-caster subclass Fighter adds nothing',
    classes: [{ id: 'fighter', level: 5, subclassId: 'champion' }, { id: 'wizard', level: 3 }],
    expect: 3,
  },
  {
    name: 'Warlock 5 / Sorcerer 4 → Warlock EXCLUDED → 4',
    cite: 'Warlock Pact Magic is not counted in the combined level',
    classes: [{ id: 'warlock', level: 5 }, { id: 'sorcerer', level: 4 }],
    expect: 4,
  },
  {
    name: 'EK Fighter 2 / Wizard 1 → floor(2/3)=0 + 1 = 1 (EK below floor contributes 0)',
    cite: 'floor(2/3)=0; and EK has no Spellcasting until Fighter 3 anyway',
    classes: [{ id: 'fighter', level: 2, subclassId: 'eldritchKnight' }, { id: 'wizard', level: 1 }],
    expect: 1,
  },
];

// ─── Combined slot vector (multiclassSpellSlots) ─────────────────────────────
// For a MULTI-spellcasting-class character, the slot vector =
// FULL_CASTER_SLOTS[combinedCasterLevel], slots per spell level 1..9.
export interface CombinedSlotsCase {
  name: string;
  cite: string;
  classes: { id: ClassId; level: number; subclassId?: string }[];
  /** Expected slots per spell level 1..9. */
  slots: number[];
}

export const COMBINED_SLOTS_CASES: CombinedSlotsCase[] = [
  {
    name: 'Ranger 4 / Sorcerer 3 (CL 5) → [4,3,2,0,0,0,0,0,0]',
    cite: 'PHB worked example: FULL_CASTER_SLOTS[5]',
    classes: [{ id: 'ranger', level: 4 }, { id: 'sorcerer', level: 3 }],
    slots: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  },
  {
    name: 'Cleric 5 / Wizard 5 (CL 10) → [4,3,3,3,2,0,0,0,0]',
    cite: 'FULL_CASTER_SLOTS[10]',
    classes: [{ id: 'cleric', level: 5 }, { id: 'wizard', level: 5 }],
    slots: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  },
  {
    name: 'Paladin 6 / Sorcerer 6 (CL 3+6=9) → [4,3,3,3,1,0,0,0,0]',
    cite: 'ceil(6/2)=3 + 6 = 9; FULL_CASTER_SLOTS[9]',
    classes: [{ id: 'paladin', level: 6 }, { id: 'sorcerer', level: 6 }],
    slots: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  },
];

// ─── Single-spellcasting-class special case (effectiveSpellSlots) ────────────
// PHB L2122: if only ONE class has an active Spellcasting feature, use THAT
// class's own single-class table at THAT class's level — NOT the combined level.
// Warlock Pact Magic is a SEPARATE pool and is never the "one Spellcasting
// class" for this purpose (its slots come from PACT_MAGIC, not the combined
// table). isCombined = whether the combined multiclass table applies.
export interface SingleCasterCase {
  name: string;
  cite: string;
  classes: { id: ClassId; level: number; subclassId?: string }[];
  /** True = use the combined multiclass table; false = one class's own table. */
  isCombined: boolean;
  /** Expected leveled slots per spell level 1..9 (the Spellcasting slots; Pact
   *  Magic is tracked separately and not reflected here). */
  slots: number[];
}

export const SINGLE_CASTER_CASES: SingleCasterCase[] = [
  {
    name: 'Champion Fighter 5 / Wizard 3 → only Wizard casts → Wizard table at 3',
    cite: 'PHB L2122: one Spellcasting class → its own table',
    classes: [{ id: 'fighter', level: 5, subclassId: 'champion' }, { id: 'wizard', level: 3 }],
    isCombined: false,
    slots: [4, 2, 0, 0, 0, 0, 0, 0, 0], // FULL_CASTER_SLOTS[3]
  },
  {
    name: 'Barbarian 4 / Cleric 2 → only Cleric casts → Cleric (full) table at 2',
    cite: 'one Spellcasting class → its own table',
    classes: [{ id: 'barbarian', level: 4 }, { id: 'cleric', level: 2 }],
    isCombined: false,
    slots: [3, 0, 0, 0, 0, 0, 0, 0, 0], // FULL_CASTER_SLOTS[2]
  },
  {
    name: 'Warlock 5 / Sorcerer 3 → Warlock is Pact (not counted) → one Spellcasting class (Sorcerer) → Sorcerer table at 3',
    cite: 'Warlock Pact Magic separate; Sorcerer is the lone Spellcasting class',
    classes: [{ id: 'warlock', level: 5 }, { id: 'sorcerer', level: 3 }],
    isCombined: false,
    slots: [4, 2, 0, 0, 0, 0, 0, 0, 0], // FULL_CASTER_SLOTS[3] (Sorcerer 3); Warlock pact slots are separate
  },
  {
    name: 'Cleric 5 / Wizard 5 → TWO Spellcasting classes → combined table (CL 10)',
    cite: 'two Spellcasting classes → the combined multiclass table',
    classes: [{ id: 'cleric', level: 5 }, { id: 'wizard', level: 5 }],
    isCombined: true,
    slots: [4, 3, 3, 3, 2, 0, 0, 0, 0], // FULL_CASTER_SLOTS[10]
  },
  {
    name: 'Ranger 4 / Sorcerer 3 → TWO Spellcasting classes → combined (CL 5)',
    cite: 'half + full both Spellcasting → combined',
    classes: [{ id: 'ranger', level: 4 }, { id: 'sorcerer', level: 3 }],
    isCombined: true,
    slots: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  },
  {
    name: 'EK Fighter 3 / Wizard 3 → two Spellcasting classes → combined (floor(3/3)=1 + 3 = 4)',
    cite: 'EK active at Fighter 3 → a Spellcasting class; combined CL 4',
    classes: [{ id: 'fighter', level: 3, subclassId: 'eldritchKnight' }, { id: 'wizard', level: 3 }],
    isCombined: true,
    slots: [4, 3, 0, 0, 0, 0, 0, 0, 0], // FULL_CASTER_SLOTS[4]
  },
];

// ─── Per-class spell save DC / attack (per-class) ────────────────────────────
// PHB L2119: each class's DC = 8 + PB(total level) + mod(that class's ability);
// attack = PB + that mod. PB is by TOTAL character level. One pair per casting
// class. abilityScores are the EFFECTIVE scores (post-feat). The harness builds
// a multiclass character at the given total level with the given scores and
// asserts the per-class DC/attack.
export interface PerClassDcCase {
  name: string;
  cite: string;
  totalLevel: number; // drives PB = 2 + floor((level-1)/4)
  classes: { id: ClassId; level: number; subclassId?: string }[];
  scores: Record<Ability, number>;
  /** Expected { classId, dc, attack } per casting class. */
  expect: { classId: ClassId; dc: number; attack: number }[];
}

export const PER_CLASS_DC_CASES: PerClassDcCase[] = [
  {
    // Total level 10 → PB +4. Cleric uses Wis 16 (+3): DC 8+4+3=15, atk 4+3=7.
    // Wizard uses Int 18 (+4): DC 8+4+4=16, atk 4+4=8.
    name: 'Cleric 5 / Wizard 5 (PB+4): per-class DC/attack by each class\u2019s ability',
    cite: 'PHB L2119: DC 8+PB+mod(class ability); PB by total level',
    totalLevel: 10,
    classes: [{ id: 'cleric', level: 5 }, { id: 'wizard', level: 5 }],
    scores: { str: 10, dex: 12, con: 14, int: 18, wis: 16, cha: 10 },
    expect: [
      { classId: 'cleric', dc: 15, attack: 7 },
      { classId: 'wizard', dc: 16, attack: 8 },
    ],
  },
  {
    // Total level 7 → PB +3. Ranger uses Wis 14 (+2): DC 8+3+2=13, atk 3+2=5.
    // Sorcerer uses Cha 16 (+3): DC 8+3+3=14, atk 3+3=6.
    name: 'Ranger 4 / Sorcerer 3 (PB+3): Wis-based + Cha-based DCs',
    cite: 'each prepared spell uses its class ability',
    totalLevel: 7,
    classes: [{ id: 'ranger', level: 4 }, { id: 'sorcerer', level: 3 }],
    scores: { str: 10, dex: 14, con: 12, int: 10, wis: 14, cha: 16 },
    expect: [
      { classId: 'ranger', dc: 13, attack: 5 },
      { classId: 'sorcerer', dc: 14, attack: 6 },
    ],
  },
  {
    // Warlock DC uses Cha; it is still a per-class DC even though its slots are
    // Pact Magic. Total level 6 → PB +3. Warlock Cha 18 (+4): DC 8+3+4=15, atk 7.
    name: 'Warlock 6 (Pact) still has a per-class Cha DC',
    cite: 'Pact Magic separate slots, but DC is still 8+PB+Cha mod',
    totalLevel: 6,
    classes: [{ id: 'warlock', level: 6 }],
    scores: { str: 10, dex: 12, con: 14, int: 10, wis: 10, cha: 18 },
    expect: [{ classId: 'warlock', dc: 15, attack: 7 }],
  },
];
