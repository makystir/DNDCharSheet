/**
 * GOLDEN TABLE: "available reactions" for the Overview Reactions card.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md) BEFORE the reactions logic is implemented. The
 * implementer must make `availableReactions(character)` reproduce every row and
 * MUST NOT edit this file. If a row looks wrong, STOP and flag it in the summary
 * instead of changing it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. A harness in the
 * implementer's tests maps each scenario onto a real Character (classes[],
 * spellcasting prepared lists / spellbook, slot expenditure, conditions, HP,
 * combat turn state) and compares the result to `expected`.
 *
 * Sources (PHB 2024, Docs/PlayersHandbook.md; line numbers verified against the
 * file when this table was written):
 *  - Reactions rule (L620-623): a Reaction is an instant response to a trigger;
 *    you can't take another until the start of your next turn.
 *  - Opportunity Attacks (L1020-1023): when a creature you can see leaves your
 *    reach, take a Reaction to make one melee attack. Universal to every creature.
 *  - Class features that are Reactions (the ONLY four in the app's class data):
 *      Bard 7   Countercharm      (L2824)
 *      Monk 3   Deflect Attacks   (L4591)   [Monk 13 Deflect Energy only widens
 *                                           Deflect Attacks; it is NOT a separate
 *                                           reaction]
 *      Monk 4   Slow Fall         (L4603)
 *      Rogue 5  Uncanny Dodge     (L5959)
 *    Cleric 10 Divine Intervention is a Magic action, NOT a Reaction.
 *  - Reaction-cast spells in the app's spell catalog (castingTime begins with
 *    "Reaction"): Feather Fall L1 (Bard, Sorcerer, Wizard; L13079), Hellish
 *    Rebuke L1 (Warlock; L13955), Shield L1 (Sorcerer, Wizard; L16031),
 *    Counterspell L3 (Sorcerer, Warlock, Wizard; L12170).
 *  - Incapacitated [Condition]: you can't take any action, Bonus Action, or
 *    Reaction. Paralyzed, Petrified, Stunned and Unconscious each include
 *    Incapacitated (verified in the glossary entries).
 *
 * WHAT IS NOT MODELED (deliberately; do not add rows for these): subclass
 * reactions (subclass feature lists are empty in the data), feat reactions,
 * species reactions, Absorb Elements (not in the catalog), and the Ready action.
 *
 * APP-PRESENTATION CHOICES (not RAW; flagged so they are not mistaken for rules):
 *  - Entries are always LISTED, and marked unavailable with a reason rather than
 *    hidden: the user chose "show greyed" for no-slot spells, and the same
 *    treatment is used for spent/incapacitated.
 *  - When several reasons apply, precedence is: incapacitated > spent > no-slot.
 *  - Order is not pinned except that Opportunity Attack is always first; compare
 *    the rest as a set keyed by name.
 *
 * A spell is "castable" when it is prepared (or known, for known-spell casters)
 * AND the character has an expendable slot of the spell's level or higher. A
 * Wizard's spellbook-only spells are NOT castable until prepared. Warlock Pact
 * Magic slots count as slots of their (single) slot level.
 */

export type ReactionKind = 'universal' | 'class-feature' | 'spell';
export type ReactionUnavailable = 'incapacitated' | 'spent' | 'no-slot';

export interface ExpectedReaction {
  name: string;
  kind: ReactionKind;
  /** Absent = available now. */
  unavailable?: ReactionUnavailable;
}

export interface ReactionScenario {
  name: string;
  cite: string;
  /** Classes in order; level is the level IN THAT CLASS. */
  classes: { id: string; level: number }[];
  /** Spell ids the character has prepared (or knows, for known-spell casters). */
  prepared?: string[];
  /** Spell ids in a Wizard's spellbook but NOT prepared. */
  spellbookOnly?: string[];
  /** Unexpended regular spell slots by spell level (absent level = 0). */
  slotsAvailable?: Record<number, number>;
  /** Warlock Pact Magic: the slot level and how many are unexpended. */
  pact?: { slotLevel: number; available: number };
  /** Condition ids currently applied (named conditions). */
  conditions?: string[];
  /** When set to 0 the character is at 0 HP (Unconscious). Absent = healthy. */
  currentHp?: number;
  /** combat.turn.reactionUsed. */
  reactionUsed?: boolean;
  expected: ExpectedReaction[];
}

const OA: ExpectedReaction = { name: 'Opportunity Attack', kind: 'universal' };
const oaWith = (reason: ReactionUnavailable): ExpectedReaction => ({ ...OA, unavailable: reason });

/** Wizard 5th level slots: 4 / 3 / 2. */
const WIZ5_SLOTS = { 1: 4, 2: 3, 3: 2 };

export const REACTION_SCENARIOS: ReactionScenario[] = [
  // ── Universal only ────────────────────────────────────────────────────────
  {
    name: 'No class at all: only the universal Opportunity Attack',
    cite: 'Opportunity Attacks L1020-1023',
    classes: [],
    expected: [OA],
  },
  {
    name: 'Fighter 20: no reaction features in the data, only Opportunity Attack',
    cite: 'Opportunity Attacks L1020-1023',
    classes: [{ id: 'fighter', level: 20 }],
    expected: [OA],
  },
  {
    name: 'Cleric 10: Divine Intervention is a Magic action, not a Reaction',
    cite: 'Cleric Divine Intervention (Magic action); Reactions L620-623',
    classes: [{ id: 'cleric', level: 10 }],
    expected: [OA],
  },

  // ── Class features: level gates ───────────────────────────────────────────
  {
    name: 'Rogue 4: Uncanny Dodge not yet gained',
    cite: 'Rogue Level 5: Uncanny Dodge (L5959)',
    classes: [{ id: 'rogue', level: 4 }],
    expected: [OA],
  },
  {
    name: 'Rogue 5: Uncanny Dodge appears',
    cite: 'Rogue Level 5: Uncanny Dodge (L5959)',
    classes: [{ id: 'rogue', level: 5 }],
    expected: [OA, { name: 'Uncanny Dodge', kind: 'class-feature' }],
  },
  {
    name: 'Monk 2: no reaction features yet',
    cite: 'Monk Level 3: Deflect Attacks (L4591)',
    classes: [{ id: 'monk', level: 2 }],
    expected: [OA],
  },
  {
    name: 'Monk 3: Deflect Attacks appears',
    cite: 'Monk Level 3: Deflect Attacks (L4591)',
    classes: [{ id: 'monk', level: 3 }],
    expected: [OA, { name: 'Deflect Attacks', kind: 'class-feature' }],
  },
  {
    name: 'Monk 4: Slow Fall joins Deflect Attacks',
    cite: 'Monk Level 4: Slow Fall (L4603)',
    classes: [{ id: 'monk', level: 4 }],
    expected: [
      OA,
      { name: 'Deflect Attacks', kind: 'class-feature' },
      { name: 'Slow Fall', kind: 'class-feature' },
    ],
  },
  {
    name: 'Monk 13: Deflect Energy only widens Deflect Attacks, it is not its own reaction',
    cite: 'Monk Level 13: Deflect Energy',
    classes: [{ id: 'monk', level: 13 }],
    expected: [
      OA,
      { name: 'Deflect Attacks', kind: 'class-feature' },
      { name: 'Slow Fall', kind: 'class-feature' },
    ],
  },
  {
    name: 'Bard 6: Countercharm not yet gained',
    cite: 'Bard Level 7: Countercharm (L2824)',
    classes: [{ id: 'bard', level: 6 }],
    expected: [OA],
  },
  {
    name: 'Bard 7: Countercharm appears',
    cite: 'Bard Level 7: Countercharm (L2824)',
    classes: [{ id: 'bard', level: 7 }],
    expected: [OA, { name: 'Countercharm', kind: 'class-feature' }],
  },

  // ── Multiclass: each feature gates on its OWN class level, not total level ─
  {
    name: 'Monk 2 / Rogue 5: only the Rogue feature (Monk 2 is below 3)',
    cite: 'Per-class feature levels',
    classes: [
      { id: 'monk', level: 2 },
      { id: 'rogue', level: 5 },
    ],
    expected: [OA, { name: 'Uncanny Dodge', kind: 'class-feature' }],
  },
  {
    name: 'Monk 3 / Rogue 5: both classes contribute',
    cite: 'Per-class feature levels',
    classes: [
      { id: 'monk', level: 3 },
      { id: 'rogue', level: 5 },
    ],
    expected: [
      OA,
      { name: 'Deflect Attacks', kind: 'class-feature' },
      { name: 'Uncanny Dodge', kind: 'class-feature' },
    ],
  },
  {
    name: 'Monk 2 / Rogue 2 (total level 4): Slow Fall needs MONK level 4, so absent',
    cite: 'Per-class feature levels (total level is irrelevant)',
    classes: [
      { id: 'monk', level: 2 },
      { id: 'rogue', level: 2 },
    ],
    expected: [OA],
  },

  // ── Reaction-cast spells ──────────────────────────────────────────────────
  {
    name: 'Wizard 5, prepared Shield + Counterspell + Feather Fall, slots available: all castable',
    cite: 'Shield L16031; Counterspell L12170; Feather Fall L13079',
    classes: [{ id: 'wizard', level: 5 }],
    prepared: ['shield', 'counterspell', 'feather-fall'],
    slotsAvailable: WIZ5_SLOTS,
    expected: [
      OA,
      { name: 'Shield', kind: 'spell' },
      { name: 'Counterspell', kind: 'spell' },
      { name: 'Feather Fall', kind: 'spell' },
    ],
  },
  {
    name: 'Wizard 5, all 3rd-level slots spent: Counterspell greyed (no slot), the 1st-level spells still castable',
    cite: 'Counterspell is Level 3 (L12170); needs a slot of level 3 or higher',
    classes: [{ id: 'wizard', level: 5 }],
    prepared: ['shield', 'counterspell', 'feather-fall'],
    slotsAvailable: { 1: 4, 2: 3, 3: 0 },
    expected: [
      OA,
      { name: 'Shield', kind: 'spell' },
      { name: 'Counterspell', kind: 'spell', unavailable: 'no-slot' },
      { name: 'Feather Fall', kind: 'spell' },
    ],
  },
  {
    name: 'Wizard 5, only 3rd-level slots left: Shield is still castable with a higher-level slot',
    cite: 'Casting a spell using a higher-level slot',
    classes: [{ id: 'wizard', level: 5 }],
    prepared: ['shield'],
    slotsAvailable: { 1: 0, 2: 0, 3: 1 },
    expected: [OA, { name: 'Shield', kind: 'spell' }],
  },
  {
    name: 'Wizard 5, no slots at all: Shield greyed (no slot)',
    cite: 'Spell slots',
    classes: [{ id: 'wizard', level: 5 }],
    prepared: ['shield'],
    slotsAvailable: { 1: 0, 2: 0, 3: 0 },
    expected: [OA, { name: 'Shield', kind: 'spell', unavailable: 'no-slot' }],
  },
  {
    name: 'Wizard 5, Counterspell only in the spellbook (not prepared): it is NOT listed',
    cite: 'Wizard prepares spells from the spellbook; only prepared spells can be cast',
    classes: [{ id: 'wizard', level: 5 }],
    prepared: ['shield'],
    spellbookOnly: ['counterspell', 'feather-fall'],
    slotsAvailable: WIZ5_SLOTS,
    expected: [OA, { name: 'Shield', kind: 'spell' }],
  },
  {
    name: 'Wizard 5, no reaction spells prepared: Opportunity Attack only',
    cite: 'Reaction-cast spells are listed only when prepared/known',
    classes: [{ id: 'wizard', level: 5 }],
    prepared: [],
    slotsAvailable: WIZ5_SLOTS,
    expected: [OA],
  },
  {
    name: 'Warlock 5 with Pact Magic slots (level 3): Hellish Rebuke and Counterspell castable',
    cite: 'Hellish Rebuke L13955; Counterspell L12170; Pact Magic slots',
    classes: [{ id: 'warlock', level: 5 }],
    prepared: ['hellish-rebuke', 'counterspell'],
    pact: { slotLevel: 3, available: 2 },
    expected: [
      OA,
      { name: 'Hellish Rebuke', kind: 'spell' },
      { name: 'Counterspell', kind: 'spell' },
    ],
  },
  {
    name: 'Warlock 5 with no Pact slots left: both greyed (no slot)',
    cite: 'Pact Magic slots',
    classes: [{ id: 'warlock', level: 5 }],
    prepared: ['hellish-rebuke', 'counterspell'],
    pact: { slotLevel: 3, available: 0 },
    expected: [
      OA,
      { name: 'Hellish Rebuke', kind: 'spell', unavailable: 'no-slot' },
      { name: 'Counterspell', kind: 'spell', unavailable: 'no-slot' },
    ],
  },
  {
    name: 'Bard 7: Countercharm (feature) plus Feather Fall (spell) together',
    cite: 'Countercharm L2824; Feather Fall L13079 (Bard list)',
    classes: [{ id: 'bard', level: 7 }],
    prepared: ['feather-fall'],
    slotsAvailable: { 1: 4, 2: 3, 3: 3, 4: 1 },
    expected: [
      OA,
      { name: 'Countercharm', kind: 'class-feature' },
      { name: 'Feather Fall', kind: 'spell' },
    ],
  },

  // ── Reaction already spent ────────────────────────────────────────────────
  {
    name: 'Reaction already used this round: every entry is spent (Rogue 5)',
    cite: 'Reactions L622: no second Reaction until the start of your next turn',
    classes: [{ id: 'rogue', level: 5 }],
    reactionUsed: true,
    expected: [oaWith('spent'), { name: 'Uncanny Dodge', kind: 'class-feature', unavailable: 'spent' }],
  },
  {
    name: 'Reaction used with a spell prepared: the spell is spent too (not just no-slot)',
    cite: 'Reactions L622',
    classes: [{ id: 'wizard', level: 5 }],
    prepared: ['shield'],
    slotsAvailable: WIZ5_SLOTS,
    reactionUsed: true,
    expected: [oaWith('spent'), { name: 'Shield', kind: 'spell', unavailable: 'spent' }],
  },
  {
    name: 'Reaction used AND no slot: spent outranks no-slot',
    cite: 'App precedence: incapacitated > spent > no-slot',
    classes: [{ id: 'wizard', level: 5 }],
    prepared: ['shield'],
    slotsAvailable: { 1: 0, 2: 0, 3: 0 },
    reactionUsed: true,
    expected: [oaWith('spent'), { name: 'Shield', kind: 'spell', unavailable: 'spent' }],
  },

  // ── Incapacitated (directly, via an including condition, or at 0 HP) ──────
  {
    name: 'Incapacitated: every entry unavailable (Rogue 5)',
    cite: 'Incapacitated [Condition]: you can\u2019t take any action, Bonus Action, or Reaction',
    classes: [{ id: 'rogue', level: 5 }],
    conditions: ['incapacitated'],
    expected: [oaWith('incapacitated'), { name: 'Uncanny Dodge', kind: 'class-feature', unavailable: 'incapacitated' }],
  },
  {
    name: 'Paralyzed includes Incapacitated',
    cite: 'Paralyzed [Condition] includes Incapacitated',
    classes: [{ id: 'rogue', level: 5 }],
    conditions: ['paralyzed'],
    expected: [oaWith('incapacitated'), { name: 'Uncanny Dodge', kind: 'class-feature', unavailable: 'incapacitated' }],
  },
  {
    name: 'Petrified includes Incapacitated',
    cite: 'Petrified [Condition] includes Incapacitated',
    classes: [{ id: 'rogue', level: 5 }],
    conditions: ['petrified'],
    expected: [oaWith('incapacitated'), { name: 'Uncanny Dodge', kind: 'class-feature', unavailable: 'incapacitated' }],
  },
  {
    name: 'Stunned includes Incapacitated',
    cite: 'Stunned [Condition] includes Incapacitated',
    classes: [{ id: 'rogue', level: 5 }],
    conditions: ['stunned'],
    expected: [oaWith('incapacitated'), { name: 'Uncanny Dodge', kind: 'class-feature', unavailable: 'incapacitated' }],
  },
  {
    name: 'Unconscious includes Incapacitated',
    cite: 'Unconscious [Condition] includes Incapacitated',
    classes: [{ id: 'rogue', level: 5 }],
    conditions: ['unconscious'],
    expected: [oaWith('incapacitated'), { name: 'Uncanny Dodge', kind: 'class-feature', unavailable: 'incapacitated' }],
  },
  {
    name: 'At 0 HP the character is Unconscious (Incapacitated): all unavailable',
    cite: 'Dropping to 0 Hit Points: Unconscious; Unconscious includes Incapacitated',
    classes: [{ id: 'rogue', level: 5 }],
    currentHp: 0,
    expected: [oaWith('incapacitated'), { name: 'Uncanny Dodge', kind: 'class-feature', unavailable: 'incapacitated' }],
  },
  {
    name: 'Poisoned does NOT block Reactions',
    cite: 'Poisoned [Condition] does not include Incapacitated',
    classes: [{ id: 'rogue', level: 5 }],
    conditions: ['poisoned'],
    expected: [OA, { name: 'Uncanny Dodge', kind: 'class-feature' }],
  },
  {
    name: 'Prone does NOT block Reactions',
    cite: 'Prone [Condition] does not include Incapacitated',
    classes: [{ id: 'rogue', level: 5 }],
    conditions: ['prone'],
    expected: [OA, { name: 'Uncanny Dodge', kind: 'class-feature' }],
  },
  {
    name: 'Incapacitated outranks spent and no-slot (all three apply)',
    cite: 'App precedence: incapacitated > spent > no-slot',
    classes: [{ id: 'wizard', level: 5 }],
    prepared: ['shield'],
    slotsAvailable: { 1: 0, 2: 0, 3: 0 },
    reactionUsed: true,
    conditions: ['incapacitated'],
    expected: [oaWith('incapacitated'), { name: 'Shield', kind: 'spell', unavailable: 'incapacitated' }],
  },
];

/**
 * Catalog invariants: exactly these reaction-tagged class features and these
 * reaction-cast spells exist in the app data. The oracle test asserts the real
 * tags/castingTimes agree, so a data slip (an extra or missing reaction) fails
 * loudly.
 */
export interface ReactionCatalogOracle {
  /** class id, feature name, class level at which it is gained. */
  classFeatures: { classId: string; name: string; level: number }[];
  /** spell id, display name, spell level. */
  spells: { id: string; name: string; level: number }[];
  /** Features that mention Reactions in text but must NOT be tagged. */
  notReactionFeatures: { classId: string; name: string }[];
}

export const REACTION_CATALOG_ORACLE: ReactionCatalogOracle = {
  classFeatures: [
    { classId: 'bard', name: 'Countercharm', level: 7 },
    { classId: 'monk', name: 'Deflect Attacks', level: 3 },
    { classId: 'monk', name: 'Slow Fall', level: 4 },
    { classId: 'rogue', name: 'Uncanny Dodge', level: 5 },
  ],
  spells: [
    { id: 'feather-fall', name: 'Feather Fall', level: 1 },
    { id: 'hellish-rebuke', name: 'Hellish Rebuke', level: 1 },
    { id: 'shield', name: 'Shield', level: 1 },
    { id: 'counterspell', name: 'Counterspell', level: 3 },
  ],
  notReactionFeatures: [
    { classId: 'cleric', name: 'Divine Intervention' },
    { classId: 'monk', name: 'Deflect Energy' },
  ],
};
