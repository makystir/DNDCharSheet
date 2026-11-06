/**
 * GOLDEN TABLE for Stage M2 (multiclassing: per-class derived stats) — HP (pooled
 * Hit Dice by die type, exactly one level-1 max-die term), feat/ASI slot union
 * per class, and the reduced multiclass proficiency subset for non-initial
 * classes.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md) + the shipped src/data/classes.ts rows, BEFORE the
 * M2 logic is implemented. The implementer must make the real functions
 * reproduce every row and MUST NOT edit this file. If a row looks wrong, STOP
 * and flag it in the summary.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. A harness maps
 * each row onto the real API over the M1 classes[] model.
 *
 * Sources (PHB 2024; per-class data re-verified against src/data/classes.ts):
 *  - HIT POINTS / HIT DICE (PHB "Multiclassing: Hit Points" L2094): you get a
 *    class's LEVEL-1 HP only when total level is 1 — i.e. across the whole
 *    character there is exactly ONE "level-1 = max die + Con" term (from the
 *    FIRST/initial class); every other class level (and every level past 1 of
 *    the first class) adds that class's PER-LEVEL HP (fixed = die/2+1, or rolled)
 *    + Con, min 1. Hit Dice are POOLED BY DIE TYPE: sum each class's level into
 *    its die bucket; different die types are tracked separately. Hit dice by
 *    class (from classes.ts): Barbarian d12; Fighter/Paladin/Ranger d10;
 *    Bard/Cleric/Druid/Monk/Rogue d8; Sorcerer/Warlock/Wizard d6.
 *  - FEAT / ASI SLOTS (PHB "Multiclassing: Class Features" + each class's ASI
 *    rows): ASI markers are PER CLASS. A multiclass character's feat/ASI slots
 *    are the UNION of each class's asi-marker levels, each evaluated at THAT
 *    class's own level — NOT the single-class count at the total level. From
 *    classes.ts: standard asi-marker levels 4/8/12/16/19; Fighter also 6 and 14;
 *    Rogue also 10. (Level 19 is the Epic Boon slot.)
 *  - MULTICLASS PROFICIENCIES (PHB ch.3 each class's "As a Multiclass Character"
 *    entry): a class taken as a NON-INITIAL class grants only a REDUCED subset of
 *    its starting proficiencies. Transcribed per class below. The INITIAL class
 *    (classes[0]) still grants its FULL starting proficiencies (unchanged from
 *    single-class); only classes[1..] use the reduced subset.
 *
 * All functions are pure. character.level is the stored TOTAL (M1).
 */

export type ClassId =
  | 'barbarian' | 'bard' | 'cleric' | 'druid' | 'fighter' | 'monk'
  | 'paladin' | 'ranger' | 'rogue' | 'sorcerer' | 'warlock' | 'wizard';

export type HitDie = 6 | 8 | 10 | 12;

// ─── Hit Dice pooled by die type (hitDiceByDieType) ──────────────────────────
// Sum each class's level into its die-type bucket (PHB L2094). classLevels maps
// a class id to its level; expect maps a die face to the pooled count.
export interface HitDicePoolCase {
  name: string;
  cite: string;
  classLevels: Partial<Record<ClassId, number>>;
  expect: Partial<Record<HitDie, number>>;
}

export const HIT_DICE_POOL_CASES: HitDicePoolCase[] = [
  {
    name: 'Single-class Fighter 5 → five d10',
    cite: 'single class, one die bucket',
    classLevels: { fighter: 5 },
    expect: { 10: 5 },
  },
  {
    name: 'Fighter 5 / Paladin 5 → ten d10 (same die type pooled)',
    cite: 'PHB L2094: same die type pools',
    classLevels: { fighter: 5, paladin: 5 },
    expect: { 10: 10 },
  },
  {
    name: 'Cleric 5 / Paladin 5 → five d8 + five d10 (different die types tracked separately)',
    cite: 'PHB L2094: different die types separate',
    classLevels: { cleric: 5, paladin: 5 },
    expect: { 8: 5, 10: 5 },
  },
  {
    name: 'Barbarian 3 / Wizard 2 → three d12 + two d6',
    cite: 'd12 + d6 buckets',
    classLevels: { barbarian: 3, wizard: 2 },
    expect: { 12: 3, 6: 2 },
  },
  {
    name: 'Rogue 4 / Bard 3 / Monk 1 → eight d8 (all d8 pooled)',
    cite: 'three d8 classes pool into one bucket',
    classLevels: { rogue: 4, bard: 3, monk: 1 },
    expect: { 8: 8 },
  },
];

// ─── HP maximum with exactly one level-1 term (hitPointMax, FIXED HP) ─────────
// PHB L2094: exactly ONE "level-1 = max die + Con" term across the character
// (from the initial class, classes[0]); every other class level adds the fixed
// per-level HP (die/2 + 1) + Con, min 1. Fixed-HP mode (the default, no rolled
// records). conMod is applied per level. The golden pins the total for a given
// multiclass build + Con modifier; the harness builds the character (initial =
// the first entry) and asserts hitPointMaxOf / the breakdown total.
export interface HpMaxCase {
  name: string;
  cite: string;
  /** Ordered class entries; the FIRST is the initial class (its level-1 term). */
  classOrder: { id: ClassId; level: number }[];
  conMod: number;
  expectTotal: number;
}

export const HP_MAX_CASES: HpMaxCase[] = [
  {
    // Fighter d10 initial: L1 = 10 + Con; +4 levels of d10 fixed (6 each) + Con.
    // Con +2: (10+2) + 4*(6+2) = 12 + 32 = 44.
    name: 'Single-class Fighter 5, Con +2 → 44 (baseline, unchanged from single-class)',
    cite: 'one L1 max-die term + 4 fixed levels',
    classOrder: [{ id: 'fighter', level: 5 }],
    conMod: 2,
    expectTotal: 44,
  },
  {
    // Fighter 3 (initial) / Wizard 2, Con +1. Initial L1 = 10 (d10) + 1.
    // Fighter levels 2,3: 2 * (6 + 1) = 14. Wizard 2 levels: d6 fixed = 6/2+1 = 4
    // each → 2 * (4 + 1) = 10. Total = 11 + 14 + 10 = 35.
    name: 'Fighter 3 (initial) / Wizard 2, Con +1 → 35',
    cite: 'one L1 term (Fighter d10) + per-level fixed for the rest',
    classOrder: [{ id: 'fighter', level: 3 }, { id: 'wizard', level: 2 }],
    conMod: 1,
    expectTotal: 35,
  },
  {
    // Wizard 2 (initial) / Fighter 3, Con +1 — SAME classes, initial swapped.
    // Initial L1 = 6 (d6 max) + 1 = 7. Wizard level 2: (4 + 1) = 5. Fighter 3
    // levels: 3 * (6 + 1) = 21. Total = 7 + 5 + 21 = 33. (Lower than the
    // Fighter-initial build — the one L1 max-die term depends on the initial class.)
    name: 'Wizard 2 (initial) / Fighter 3, Con +1 → 33 (initial-class L1 term differs)',
    cite: 'the single L1 max-die term comes from the INITIAL class',
    classOrder: [{ id: 'wizard', level: 2 }, { id: 'fighter', level: 3 }],
    conMod: 1,
    expectTotal: 33,
  },
  {
    // Barbarian 1 (initial) / Cleric 1, Con +3. Initial L1 = 12 (d12) + 3 = 15.
    // Cleric 1 level (not the character's first overall): d8 fixed = 8/2+1 = 5,
    // + 3 = 8. Total = 15 + 8 = 23. (Only the initial class gets the max-die L1;
    // the second class's FIRST level still uses the per-level fixed value.)
    name: 'Barbarian 1 (initial) / Cleric 1, Con +3 → 23 (second class L1 uses fixed, not max die)',
    cite: 'PHB L2094: level-1 HP only when TOTAL level is 1 (initial class only)',
    classOrder: [{ id: 'barbarian', level: 1 }, { id: 'cleric', level: 1 }],
    conMod: 3,
    expectTotal: 23,
  },
  {
    // Min-1 floor: Wizard 1 (initial) / Sorcerer 1, Con -3. Initial L1 =
    // max(1, 6 + (-3)) = 3. Sorcerer 1: d6 fixed 4 + (-3) = 1 (floored at min 1).
    // Total = 3 + 1 = 4.
    name: 'Wizard 1 (initial) / Sorcerer 1, Con -3 → 4 (per-level min-1 floor applies)',
    cite: 'per-level gain floored at a minimum of 1',
    classOrder: [{ id: 'wizard', level: 1 }, { id: 'sorcerer', level: 1 }],
    conMod: -3,
    expectTotal: 4,
  },
];

// ─── Feat/ASI slot union per class (featSlotLevels over multiclass) ──────────
// The feat/ASI slots are the UNION of each class's asi-marker levels, each at
// that class's OWN level. classLevels maps class → level; expectCount is the
// total number of feat/ASI slots open. (Each class contributes its asi-marker
// rows whose level <= that class's level.)
export interface FeatSlotCase {
  name: string;
  cite: string;
  classLevels: Partial<Record<ClassId, number>>;
  expectCount: number;
}

export const FEAT_SLOT_CASES: FeatSlotCase[] = [
  {
    name: 'Single-class Wizard 8 → 4,8 = 2 slots (unchanged from single-class)',
    cite: 'standard ASI at 4 and 8',
    classLevels: { wizard: 8 },
    expectCount: 2,
  },
  {
    name: 'Fighter 6 / Rogue 4 → Fighter {4,6} + Rogue {4} = 3 slots',
    cite: 'PHB: ASI markers per class; union, each at its own level',
    classLevels: { fighter: 6, rogue: 4 },
    expectCount: 3,
  },
  {
    // A single-class level-10 character has only 2 ASIs (4, 8). The SAME 10
    // levels split Fighter 6 / Rogue 4 grants 3 (Fighter 4+6, Rogue 4) — the
    // union is NOT the single-class total-level count.
    name: 'Fighter 5 / Wizard 5 → Fighter {4} + Wizard {4} = 2 slots (not the level-10 single count)',
    cite: 'union of per-class markers, not total-level lookup',
    classLevels: { fighter: 5, wizard: 5 },
    expectCount: 2,
  },
  {
    name: 'Rogue 10 / Fighter 6 → Rogue {4,8,10} + Fighter {4,6} = 5 slots',
    cite: 'Rogue extra at 10; Fighter extra at 6',
    classLevels: { rogue: 10, fighter: 6 },
    expectCount: 5,
  },
  {
    name: 'Barbarian 3 / Cleric 3 → no class has reached level 4 → 0 slots',
    cite: 'no asi-marker reached in either class',
    classLevels: { barbarian: 3, cleric: 3 },
    expectCount: 0,
  },
];

// ─── Reduced multiclass proficiencies (non-initial class) ────────────────────
// PHB 2024 ch.3 "As a Multiclass Character" per class. When a class is taken as
// a NON-INITIAL class (classes[1..]), it grants ONLY this reduced subset. The
// INITIAL class (classes[0]) still grants its FULL starting proficiencies.
// The golden pins the reduced subset per class as the REQUIRED SHAPE. Fields:
//   armor: armor-training categories granted (e.g. 'light','medium','shields')
//   martialWeapons: true if Martial weapon proficiency is granted
//   skills: number of skills chosen from that class's list (0 if none)
//   tools: specific tool/instrument grants (free text ids; '' none)
// (Values transcribed VERBATIM from each class's multiclass entry, cited.)
export interface MulticlassProfCase {
  classId: ClassId;
  cite: string;
  expect: {
    armor: string[]; // 'light' | 'medium' | 'shields' (heavy never granted on multiclass)
    martialWeapons: boolean;
    skills: number;
    tools: string[]; // e.g. ['thieves-tools'] or ['musical-instrument'] (choice markers)
  };
}

export const MULTICLASS_PROF_CASES: MulticlassProfCase[] = [
  // Barbarian (L2407): Martial weapons + Shields.
  { classId: 'barbarian', cite: 'PHB Barbarian multiclass (L2407)', expect: { armor: ['shields'], martialWeapons: true, skills: 0, tools: [] } },
  // Bard (L2716): 1 skill (choice), 1 Musical Instrument (choice), Light armor.
  { classId: 'bard', cite: 'PHB Bard multiclass (L2716)', expect: { armor: ['light'], martialWeapons: false, skills: 1, tools: ['musical-instrument'] } },
  // Cleric (L3158): Light + Medium armor, Shields.
  { classId: 'cleric', cite: 'PHB Cleric multiclass (L3158)', expect: { armor: ['light', 'medium', 'shields'], martialWeapons: false, skills: 0, tools: [] } },
  // Druid (L3606): Light armor, Shields.
  { classId: 'druid', cite: 'PHB Druid multiclass (L3606)', expect: { armor: ['light', 'shields'], martialWeapons: false, skills: 0, tools: [] } },
  // Fighter (L4137): Martial weapons, Light + Medium armor, Shields.
  { classId: 'fighter', cite: 'PHB Fighter multiclass (L4137)', expect: { armor: ['light', 'medium', 'shields'], martialWeapons: true, skills: 0, tools: [] } },
  // Monk (L4509): nothing beyond the Hit Point Die.
  { classId: 'monk', cite: 'PHB Monk multiclass (L4509)', expect: { armor: [], martialWeapons: false, skills: 0, tools: [] } },
  // Paladin (L4844): Martial weapons, Light + Medium armor, Shields.
  { classId: 'paladin', cite: 'PHB Paladin multiclass (L4844)', expect: { armor: ['light', 'medium', 'shields'], martialWeapons: true, skills: 0, tools: [] } },
  // Ranger (L5364): Martial weapons, 1 skill from Ranger list, Light + Medium armor, Shields.
  { classId: 'ranger', cite: 'PHB Ranger multiclass (L5364)', expect: { armor: ['light', 'medium', 'shields'], martialWeapons: true, skills: 1, tools: [] } },
  // Rogue (L5875): 1 skill from Rogue list, Thieves' Tools, Light armor.
  { classId: 'rogue', cite: 'PHB Rogue multiclass (L5875)', expect: { armor: ['light'], martialWeapons: false, skills: 1, tools: ['thieves-tools'] } },
  // Sorcerer (L6253): nothing beyond the Hit Point Die.
  { classId: 'sorcerer', cite: 'PHB Sorcerer multiclass (L6253)', expect: { armor: [], martialWeapons: false, skills: 0, tools: [] } },
  // Warlock (L6782): Light armor only.
  { classId: 'warlock', cite: 'PHB Warlock multiclass (L6782)', expect: { armor: ['light'], martialWeapons: false, skills: 0, tools: [] } },
  // Wizard (L7389): nothing beyond the Hit Point Die.
  { classId: 'wizard', cite: 'PHB Wizard multiclass (L7389)', expect: { armor: [], martialWeapons: false, skills: 0, tools: [] } },
];
