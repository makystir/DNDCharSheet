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
 * STAGE D2 (subclass / feat / species / Fighting Style / class-choice reactions):
 * the second half of this file (SUBCLASS_REACTIONS ... EXTRA_SCENARIOS) was
 * derived from a fresh read of EVERY "take a Reaction" / "as a Reaction" line of
 * the PHB (grep of Docs/PlayersHandbook.md for "Reaction"), BEFORE the data was
 * tagged. Each source line is cited next to its row. Borderline decisions:
 *  INCLUDED: Guided Strike (L3540-3542, a Reaction only when it benefits ANOTHER
 *    creature), Sentinel Guardian (L8910, an Opportunity Attack is a Reaction,
 *    L1029), Rage of the Gods Revivification (L2673) and Living Legend's
 *    Saving Throw Reroll (L5205) (Reactions inside an activated form), Psionic
 *    Power's Protective Field (L4439), Misty Escape (L7212, Misty Step cast as a
 *    Reaction), Investment of the Chain Master's Resistance (L6996).
 *  EXCLUDED (the Reaction belongs to ANOTHER creature, or is a rider on a
 *    Reaction/spell that is already listed): Commander's Strike (L4275) and
 *    Maneuvering Attack (L4291) (companion's Reaction), Valor Combat Inspiration
 *    Defense (L3085, the die holder's Reaction), Beast Master companion (L5587),
 *    Pact of the Chain familiar attack (L7046), Mantle of Inspiration movement
 *    (L3031), Relentless Avenger (L5295, a rider on an Opportunity Attack),
 *    Divine Intervention (Magic action), Fount of Moonlight's Blinding rider
 *    (L13423, a spell effect, not a Casting Time Reaction), Mage Slayer (no
 *    Reaction text), Lucky / Boon of Fate (not Reactions).
 *  SPENT: a reaction whose use expends a tracked pool is 'no-uses' when that pool
 *    has none left. A feature whose own `uses` merely ACTIVATES a form (Living
 *    Legend L5199, Rage of the Gods L2665) is NOT greyed by it. Battle Master
 *    Relentless (L4259, level 15) lets a maneuver ignore an empty pool.
 *
 * WHAT IS NOT MODELED (deliberately; do not add rows for these): Absorb Elements
 * (not in the catalog), the Ready action, whether an activated form (Rage, Rage
 * of the Gods, Living Legend) is currently active, species uses (Giant Ancestry
 * is not a tracker), and Fount of Moonlight style spell-effect Reactions.
 *
 * APP-PRESENTATION CHOICES (not RAW; flagged so they are not mistaken for rules):
 *  - Entries are always LISTED, and marked unavailable with a reason rather than
 *    hidden: the user chose "show greyed" for no-slot spells, and the same
 *    treatment is used for spent/incapacitated.
 *  - When several reasons apply, precedence is: incapacitated > spent > no-uses > no-slot.
 *  - Order is not pinned except that Opportunity Attack is always first; compare
 *    the rest as a set keyed by name.
 *
 * A spell is "castable" when it is prepared (or known, for known-spell casters)
 * AND the character has an expendable slot of the spell's level or higher. A
 * Wizard's spellbook-only spells are NOT castable until prepared. Warlock Pact
 * Magic slots count as slots of their (single) slot level.
 */

export type ReactionKind =
  | 'universal'
  | 'class-feature'
  | 'subclass-feature'
  | 'feat'
  | 'fighting-style'
  | 'species'
  | 'class-choice'
  | 'spell';
/** 'spent' = the Reaction itself is used; 'no-uses' = the feature's limited-use pool is empty. */
export type ReactionUnavailable = 'incapacitated' | 'spent' | 'no-uses' | 'no-slot';

export interface ExpectedReaction {
  name: string;
  kind: ReactionKind;
  /** Absent = available now. */
  unavailable?: ReactionUnavailable;
}

export interface ReactionScenario {
  name: string;
  cite: string;
  /** Classes in order; level is the level IN THAT CLASS; `subclass` is the chosen subclass id. */
  classes: { id: string; level: number; subclass?: string }[];
  /** Feat ids taken (any category, in order; duplicates allowed). */
  feats?: string[];
  /** Species id plus the Goliath Giant Ancestry choice. */
  species?: { id: string; giantAncestry?: string };
  /** Class-choice picks, e.g. { 'fighter.maneuvers': ['parry'] }. */
  classChoices?: Record<string, string[]>;
  /** Limited-use tracker id -> uses SPENT (99 = all spent; the app clamps to the maximum). */
  resourcesSpent?: Record<string, number>;
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
    cite: 'App precedence: incapacitated > spent > no-uses > no-slot',
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
    cite: 'App precedence: incapacitated > spent > no-uses > no-slot',
    classes: [{ id: 'wizard', level: 5 }],
    prepared: ['shield'],
    slotsAvailable: { 1: 0, 2: 0, 3: 0 },
    reactionUsed: true,
    conditions: ['incapacitated'],
    expected: [oaWith('incapacitated'), { name: 'Shield', kind: 'spell', unavailable: 'incapacitated' }],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// STAGE D2: subclass / feat / species / Fighting Style / class-choice reactions
// ════════════════════════════════════════════════════════════════════════════

/** A subclass feature that is a Reaction (every row cites its PHB lines). */
export interface SubclassReactionSpec {
  classId: string;
  subclass: string;
  /** A DIFFERENT subclass of the same class, to prove the reaction is subclass-specific. */
  other: string;
  /** Class level at which the subclass feature is gained. */
  level: number;
  /** The entry name the Reactions card shows. */
  name: string;
  /** The PHB feature name, when the card names the sub-ability (Protective Field, Revivification ...). */
  featureName?: string;
  cite: string;
  /**
   * Tracker whose empty pool greys the reaction ('no-uses'), when the Reaction
   * itself expends a use.
   */
  spends?: string;
  /** A tracker that, even when empty, must NOT grey the reaction (it only activates a form). */
  activationOnly?: string;
}

export const SUBCLASS_REACTIONS: SubclassReactionSpec[] = [
  { classId: 'barbarian', subclass: 'berserker', other: 'wildHeart', level: 10, name: 'Retaliation', cite: 'Berserker Level 10: Retaliation (L2567-2569)' },
  { classId: 'barbarian', subclass: 'worldTree', other: 'berserker', level: 6, name: 'Branches of the Tree', cite: 'World Tree Level 6: Branches of the Tree (L2629)' },
  {
    classId: 'barbarian', subclass: 'zealot', other: 'berserker', level: 14, name: 'Rage of the Gods: Revivification', featureName: 'Rage of the Gods',
    cite: 'Zealot Level 14: Rage of the Gods, Revivification (L2665-2673): expends a use of Rage',
    spends: 'barbarian.rage', activationOnly: 'barbarian.rage-of-the-gods',
  },
  { classId: 'bard', subclass: 'dance', other: 'lore', level: 6, name: 'Inspiring Movement', cite: 'Dance Level 6: Inspiring Movement (L2999-3003)', spends: 'bard.bardic-inspiration' },
  { classId: 'bard', subclass: 'lore', other: 'dance', level: 3, name: 'Cutting Words', cite: 'Lore Level 3: Cutting Words (L3061-3063)', spends: 'bard.bardic-inspiration' },
  { classId: 'cleric', subclass: 'light', other: 'life', level: 3, name: 'Warding Flare', cite: 'Light Level 3: Warding Flare (L3471-3473)', spends: 'cleric.warding-flare' },
  { classId: 'cleric', subclass: 'war', other: 'life', level: 3, name: 'Guided Strike', cite: 'War Level 3: Guided Strike (L3540-3542), Reaction only for another creature', spends: 'cleric.channel-divinity' },
  { classId: 'druid', subclass: 'stars', other: 'land', level: 6, name: 'Cosmic Omen', cite: 'Stars Level 6: Cosmic Omen (L4064-4072)', spends: 'druid.cosmic-omen' },
  { classId: 'fighter', subclass: 'psiWarrior', other: 'champion', level: 3, name: 'Psionic Power: Protective Field', featureName: 'Psionic Power', cite: 'Psi Warrior Level 3: Protective Field (L4439)', spends: 'fighter.psionic-energy-dice' },
  { classId: 'paladin', subclass: 'glory', other: 'devotion', level: 15, name: 'Glorious Defense', cite: 'Glory Level 15: Glorious Defense (L5193-5195)', spends: 'paladin.glorious-defense' },
  {
    classId: 'paladin', subclass: 'glory', other: 'devotion', level: 20, name: 'Living Legend: Saving Throw Reroll', featureName: 'Living Legend',
    cite: 'Glory Level 20: Living Legend, Saving Throw Reroll (L5199-5205)', activationOnly: 'paladin.living-legend',
  },
  { classId: 'paladin', subclass: 'vengeance', other: 'devotion', level: 15, name: 'Soul of Vengeance', cite: 'Vengeance Level 15: Soul of Vengeance (L5297-5299)' },
  { classId: 'ranger', subclass: 'feyWanderer', other: 'hunter', level: 7, name: 'Beguiling Twist', cite: 'Fey Wanderer Level 7: Beguiling Twist (L5747-5751)' },
  { classId: 'ranger', subclass: 'gloomStalker', other: 'hunter', level: 15, name: 'Shadowy Dodge', cite: 'Gloom Stalker Level 15: Shadowy Dodge (L5813-5815)' },
  { classId: 'ranger', subclass: 'hunter', other: 'gloomStalker', level: 15, name: "Superior Hunter's Defense", cite: "Hunter Level 15: Superior Hunter's Defense (L5841)" },
  { classId: 'rogue', subclass: 'arcaneTrickster', other: 'thief', level: 17, name: 'Spell Thief', cite: 'Arcane Trickster Level 17: Spell Thief (L6058-6062)', spends: 'rogue.spell-thief' },
  { classId: 'sorcerer', subclass: 'clockwork', other: 'draconic', level: 3, name: 'Restore Balance', cite: 'Clockwork Level 3: Restore Balance (L6620-6622)', spends: 'sorcerer.restore-balance' },
  { classId: 'sorcerer', subclass: 'wildMagic', other: 'draconic', level: 6, name: 'Bend Luck', cite: 'Wild Magic Level 6: Bend Luck (L6711-6713): spends 1 Sorcery Point', spends: 'sorcerer.sorcery-points' },
  { classId: 'warlock', subclass: 'archfey', other: 'fiend', level: 6, name: 'Misty Escape', cite: 'Archfey Level 6: Misty Escape (L7210-7212)' },
  { classId: 'warlock', subclass: 'archfey', other: 'fiend', level: 10, name: 'Beguiling Defenses', cite: 'Archfey Level 10: Beguiling Defenses (L7220-7224)', spends: 'warlock.beguiling-defenses' },
  { classId: 'wizard', subclass: 'abjurer', other: 'evoker', level: 6, name: 'Projected Ward', cite: 'Abjurer Level 6: Projected Ward (L7672-7674)' },
  { classId: 'wizard', subclass: 'illusionist', other: 'evoker', level: 10, name: 'Illusory Self', cite: 'Illusionist Level 10: Illusory Self (L7776-7778)', spends: 'wizard.illusory-self' },
];

/** The base-class Reactions again (Countercharm L2824, Deflect Attacks L4591, Slow Fall L4603, Uncanny Dodge L5959). */
const BASE_CLASS_REACTIONS: { classId: string; level: number; name: string }[] = [
  { classId: 'bard', level: 7, name: 'Countercharm' },
  { classId: 'monk', level: 3, name: 'Deflect Attacks' },
  { classId: 'monk', level: 4, name: 'Slow Fall' },
  { classId: 'rogue', level: 5, name: 'Uncanny Dodge' },
];

/** The entries a character with these class entries must show (derived from the two tables above). */
function expectedFor(classes: { id: string; level: number; subclass?: string }[]): ExpectedReaction[] {
  const out: ExpectedReaction[] = [OA];
  for (const c of classes) {
    for (const b of BASE_CLASS_REACTIONS) {
      if (b.classId === c.id && c.level >= b.level) out.push({ name: b.name, kind: 'class-feature' });
    }
    for (const s of SUBCLASS_REACTIONS) {
      // A subclass is gained at level 3 in every class (Features tables), so a level below 3 never has one.
      if (s.classId === c.id && s.subclass === c.subclass && c.level >= 3 && c.level >= s.level) {
        out.push({ name: s.name, kind: 'subclass-feature' });
      }
    }
  }
  return out;
}

/** Same expectation with one named entry replaced by `unavailable`. */
const withReason = (list: ExpectedReaction[], name: string, reason: ReactionUnavailable): ExpectedReaction[] =>
  list.map((e) => (e.name === name ? { ...e, unavailable: reason } : e));

const SUBCLASS_SCENARIOS: ReactionScenario[] = SUBCLASS_REACTIONS.flatMap((s) => {
  const cls = (level: number, subclass: string | undefined) => [{ id: s.classId, level, ...(subclass ? { subclass } : {}) }];
  const rows: ReactionScenario[] = [
    {
      name: `${s.name}: present at level ${s.level} with ${s.subclass}`,
      cite: s.cite,
      classes: cls(s.level, s.subclass),
      expected: expectedFor(cls(s.level, s.subclass)),
    },
    {
      name: `${s.name}: absent one level earlier (${s.level - 1})`,
      cite: s.cite,
      classes: cls(s.level - 1, s.subclass),
      expected: expectedFor(cls(s.level - 1, s.subclass)),
    },
    {
      name: `${s.name}: absent with a different subclass (${s.other})`,
      cite: s.cite,
      classes: cls(s.level, s.other),
      expected: expectedFor(cls(s.level, s.other)),
    },
    {
      name: `${s.name}: absent with no subclass chosen`,
      cite: s.cite,
      classes: cls(s.level, undefined),
      expected: expectedFor(cls(s.level, undefined)),
    },
    {
      name: `${s.name}: greyed (incapacitated) when Stunned`,
      cite: `${s.cite}; Stunned includes Incapacitated`,
      classes: cls(s.level, s.subclass),
      conditions: ['stunned'],
      expected: expectedFor(cls(s.level, s.subclass)).map((e) => ({ ...e, unavailable: 'incapacitated' as const })),
    },
    {
      name: `${s.name}: greyed (spent) when the Reaction is already used`,
      cite: `${s.cite}; Reactions L627`,
      classes: cls(s.level, s.subclass),
      reactionUsed: true,
      expected: expectedFor(cls(s.level, s.subclass)).map((e) => ({ ...e, unavailable: 'spent' as const })),
    },
  ];
  if (s.spends) {
    rows.push({
      name: `${s.name}: greyed (no uses) when ${s.spends} is fully spent`,
      cite: `${s.cite}; limited use`,
      classes: cls(s.level, s.subclass),
      resourcesSpent: { [s.spends]: 99 },
      expected: withReason(expectedFor(cls(s.level, s.subclass)), s.name, 'no-uses'),
    });
  }
  if (s.activationOnly) {
    rows.push({
      name: `${s.name}: NOT greyed when only the activation pool ${s.activationOnly} is spent`,
      cite: `${s.cite}; the pool activates the form, the Reaction does not cost it`,
      classes: cls(s.level, s.subclass),
      resourcesSpent: { [s.activationOnly]: 99 },
      expected: expectedFor(cls(s.level, s.subclass)),
    });
  }
  return rows;
});

const all = (list: ExpectedReaction[], reason: ReactionUnavailable): ExpectedReaction[] => list.map((e) => ({ ...e, unavailable: reason }));

const EXTRA_SCENARIOS: ReactionScenario[] = [
  // ── Per-use pools: exact counts ───────────────────────────────────────────
  {
    name: 'Psi Warrior 3 (4 dice): one die left, Protective Field still available',
    cite: 'Psionic Power: Psionic Energy Dice 4d6 at level 3 (L4420-4437); Protective Field expends one die (L4439)',
    classes: [{ id: 'fighter', level: 3, subclass: 'psiWarrior' }],
    resourcesSpent: { 'fighter.psionic-energy-dice': 3 },
    expected: [OA, { name: 'Psionic Power: Protective Field', kind: 'subclass-feature' }],
  },
  {
    name: 'Psi Warrior 3 (4 dice): all four spent, Protective Field greyed (no uses)',
    cite: 'Protective Field expends one Psionic Energy Die (L4439)',
    classes: [{ id: 'fighter', level: 3, subclass: 'psiWarrior' }],
    resourcesSpent: { 'fighter.psionic-energy-dice': 4 },
    expected: [OA, { name: 'Psionic Power: Protective Field', kind: 'subclass-feature', unavailable: 'no-uses' }],
  },
  {
    name: 'Zealot 14: Revivification needs a Rage use; the Rage of the Gods pool being spent does not matter',
    cite: 'Rage of the Gods: Revivification expends a use of Rage (L2673)',
    classes: [{ id: 'barbarian', level: 14, subclass: 'zealot' }],
    resourcesSpent: { 'barbarian.rage': 99, 'barbarian.rage-of-the-gods': 99 },
    expected: [OA, { name: 'Rage of the Gods: Revivification', kind: 'subclass-feature', unavailable: 'no-uses' }],
  },
  {
    name: 'Zealot 14 with Rages left: available even though Rage of the Gods itself is used up',
    cite: 'Rage of the Gods (L2665-2667): once per Long Rest to ASSUME the form; Revivification is a Reaction inside it',
    classes: [{ id: 'barbarian', level: 14, subclass: 'zealot' }],
    resourcesSpent: { 'barbarian.rage-of-the-gods': 1 },
    expected: [OA, { name: 'Rage of the Gods: Revivification', kind: 'subclass-feature' }],
  },
  {
    name: 'Wild Magic 6 / Lore 3: an empty Bardic Inspiration pool greys only Cutting Words, not Bend Luck',
    cite: 'Bend Luck spends a Sorcery Point (L6713); Bardic Inspiration is a different pool',
    classes: [
      { id: 'sorcerer', level: 6, subclass: 'wildMagic' },
      { id: 'bard', level: 3, subclass: 'lore' },
    ],
    resourcesSpent: { 'bard.bardic-inspiration': 99 },
    expected: [
      OA,
      { name: 'Bend Luck', kind: 'subclass-feature' },
      { name: 'Cutting Words', kind: 'subclass-feature', unavailable: 'no-uses' },
    ],
  },
  {
    name: 'Precedence: Reaction already used outranks an empty pool',
    cite: 'App precedence: incapacitated > spent > no-uses > no-slot',
    classes: [{ id: 'cleric', level: 3, subclass: 'light' }],
    reactionUsed: true,
    resourcesSpent: { 'cleric.warding-flare': 99 },
    expected: [oaWith('spent'), { name: 'Warding Flare', kind: 'subclass-feature', unavailable: 'spent' }],
  },
  {
    name: 'Precedence: Incapacitated outranks an empty pool and a used Reaction',
    cite: 'App precedence: incapacitated > spent > no-uses > no-slot',
    classes: [{ id: 'cleric', level: 3, subclass: 'light' }],
    reactionUsed: true,
    conditions: ['incapacitated'],
    resourcesSpent: { 'cleric.warding-flare': 99 },
    expected: [oaWith('incapacitated'), { name: 'Warding Flare', kind: 'subclass-feature', unavailable: 'incapacitated' }],
  },
  {
    name: 'Cleric 3 light / Cleric pools are per class: another class with a pool of the same name is unaffected',
    cite: 'Resource pools are scoped to the class that grants them (this class\u2019s Channel Divinity, L3238-3242)',
    classes: [
      { id: 'cleric', level: 3, subclass: 'war' },
      { id: 'paladin', level: 3 },
    ],
    resourcesSpent: { 'paladin.channel-divinity': 99 },
    expected: [OA, { name: 'Guided Strike', kind: 'subclass-feature' }],
  },
  {
    name: 'Cleric 3 war: its OWN Channel Divinity empty greys Guided Strike',
    cite: 'Guided Strike expends a Channel Divinity use (L3540)',
    classes: [
      { id: 'cleric', level: 3, subclass: 'war' },
      { id: 'paladin', level: 3 },
    ],
    resourcesSpent: { 'cleric.channel-divinity': 99 },
    expected: [OA, { name: 'Guided Strike', kind: 'subclass-feature', unavailable: 'no-uses' }],
  },

  // ── Battle Master maneuvers (class-choice) ────────────────────────────────
  {
    name: 'Battle Master 3 with Parry and Riposte learned: both listed',
    cite: 'Parry (L4295), Riposte (L4303): Reactions that expend a Superiority Die',
    classes: [{ id: 'fighter', level: 3, subclass: 'battleMaster' }],
    classChoices: { 'fighter.maneuvers': ['parry', 'riposte', 'rally'] },
    expected: [OA, { name: 'Maneuver: Parry', kind: 'class-choice' }, { name: 'Maneuver: Riposte', kind: 'class-choice' }],
  },
  {
    name: 'Battle Master 3 knowing only Riposte: Parry absent',
    cite: 'Maneuvers are listed only when learned',
    classes: [{ id: 'fighter', level: 3, subclass: 'battleMaster' }],
    classChoices: { 'fighter.maneuvers': ['riposte'] },
    expected: [OA, { name: 'Maneuver: Riposte', kind: 'class-choice' }],
  },
  {
    name: 'Battle Master 3 with no maneuvers chosen: nothing',
    cite: 'Maneuvers are listed only when learned',
    classes: [{ id: 'fighter', level: 3, subclass: 'battleMaster' }],
    expected: [OA],
  },
  {
    name: 'Battle Master 3, one die left: Parry still available',
    cite: 'Combat Superiority: 4 Superiority Dice at level 3 (L4239-4241)',
    classes: [{ id: 'fighter', level: 3, subclass: 'battleMaster' }],
    classChoices: { 'fighter.maneuvers': ['parry'] },
    resourcesSpent: { 'fighter.superiority-dice': 3 },
    expected: [OA, { name: 'Maneuver: Parry', kind: 'class-choice' }],
  },
  {
    name: 'Battle Master 3, all four dice spent: Parry and Riposte greyed (no uses)',
    cite: 'Parry / Riposte expend one Superiority Die',
    classes: [{ id: 'fighter', level: 3, subclass: 'battleMaster' }],
    classChoices: { 'fighter.maneuvers': ['parry', 'riposte'] },
    resourcesSpent: { 'fighter.superiority-dice': 4 },
    expected: [
      OA,
      { name: 'Maneuver: Parry', kind: 'class-choice', unavailable: 'no-uses' },
      { name: 'Maneuver: Riposte', kind: 'class-choice', unavailable: 'no-uses' },
    ],
  },
  {
    name: 'Battle Master 14, no dice: still greyed (Relentless is level 15)',
    cite: 'Relentless Level 15 (L4259)',
    classes: [{ id: 'fighter', level: 14, subclass: 'battleMaster' }],
    classChoices: { 'fighter.maneuvers': ['parry'] },
    resourcesSpent: { 'fighter.superiority-dice': 99 },
    expected: [OA, { name: 'Maneuver: Parry', kind: 'class-choice', unavailable: 'no-uses' }],
  },
  {
    name: 'Battle Master 15, no dice: Relentless lets the maneuver use a free d8, so it stays available',
    cite: 'Relentless Level 15: once per turn roll 1d8 instead of expending a Superiority Die (L4259)',
    classes: [{ id: 'fighter', level: 15, subclass: 'battleMaster' }],
    classChoices: { 'fighter.maneuvers': ['parry'] },
    resourcesSpent: { 'fighter.superiority-dice': 99 },
    expected: [OA, { name: 'Maneuver: Parry', kind: 'class-choice' }],
  },
  {
    name: 'Champion with a stale maneuver list: no Superiority Dice, so no maneuver reactions',
    cite: 'Maneuvers belong to the Battle Master subclass (L4229-4237)',
    classes: [{ id: 'fighter', level: 3, subclass: 'champion' }],
    classChoices: { 'fighter.maneuvers': ['parry', 'riposte'] },
    expected: [OA],
  },
  {
    name: 'Battle Master 3 with companion-Reaction maneuvers only: Commander\u2019s Strike and Maneuvering Attack are not the user\u2019s Reaction',
    cite: "Commander's Strike (L4275) and Maneuvering Attack (L4291): the OTHER creature uses its Reaction",
    classes: [{ id: 'fighter', level: 3, subclass: 'battleMaster' }],
    classChoices: { 'fighter.maneuvers': ['commanders-strike', 'maneuvering-attack', 'precision-attack', 'evasive-footwork'] },
    expected: [OA],
  },
  {
    name: 'Battle Master 3 Parry: incapacitated greys it',
    cite: 'Incapacitated [Condition]',
    classes: [{ id: 'fighter', level: 3, subclass: 'battleMaster' }],
    classChoices: { 'fighter.maneuvers': ['parry'] },
    conditions: ['paralyzed'],
    expected: [oaWith('incapacitated'), { name: 'Maneuver: Parry', kind: 'class-choice', unavailable: 'incapacitated' }],
  },

  // ── Warlock invocation ────────────────────────────────────────────────────
  {
    name: 'Warlock 5 with Investment of the Chain Master: its Resistance Reaction is listed',
    cite: 'Investment of the Chain Master (Level 5+): Resistance (L6984-6996)',
    classes: [{ id: 'warlock', level: 5 }],
    classChoices: { 'warlock.invocations': ['pact-of-the-chain', 'investment-of-the-chain-master'] },
    expected: [OA, { name: 'Investment of the Chain Master: Resistance', kind: 'class-choice' }],
  },
  {
    name: 'Warlock 4 holding a stale Investment pick (needs Warlock 5): absent',
    cite: 'Investment of the Chain Master prerequisite: Level 5+ Warlock (L6984)',
    classes: [{ id: 'warlock', level: 4 }],
    classChoices: { 'warlock.invocations': ['pact-of-the-chain', 'investment-of-the-chain-master'] },
    expected: [OA],
  },
  {
    name: 'Warlock 5 with Investment but not Pact of the Chain (its prerequisite): absent',
    cite: 'Investment of the Chain Master prerequisite: Pact of the Chain Invocation (L6984)',
    classes: [{ id: 'warlock', level: 5 }],
    classChoices: { 'warlock.invocations': ['investment-of-the-chain-master'] },
    expected: [OA],
  },
  {
    name: 'Fighter 5 with the Warlock invocation key set: invocations belong only to a Warlock',
    cite: 'Eldritch Invocations are a Warlock feature (L6811)',
    classes: [{ id: 'fighter', level: 5 }],
    classChoices: { 'warlock.invocations': ['investment-of-the-chain-master'] },
    expected: [OA],
  },
  {
    name: 'Warlock 5 with Pact of the Chain and Gift of the Protectors only: familiar and tome text mention Reactions but give none',
    cite: 'Pact of the Chain familiar attack (L7046) is the familiar\u2019s Reaction; Gift of the Protectors (L6974) is not a Reaction',
    classes: [{ id: 'warlock', level: 9 }],
    classChoices: { 'warlock.invocations': ['pact-of-the-chain', 'pact-of-the-tome', 'gift-of-the-protectors'] },
    expected: [OA],
  },
  {
    name: 'Warlock 5 Investment pick is incapacitated when Unconscious',
    cite: 'Unconscious includes Incapacitated',
    classes: [{ id: 'warlock', level: 5 }],
    classChoices: { 'warlock.invocations': ['pact-of-the-chain', 'investment-of-the-chain-master'] },
    conditions: ['unconscious'],
    expected: [oaWith('incapacitated'), { name: 'Investment of the Chain Master: Resistance', kind: 'class-choice', unavailable: 'incapacitated' }],
  },

  // ── Feats (General, Epic Boon) and Fighting Style feats ───────────────────
  {
    name: 'Defensive Duelist: Parry',
    cite: 'Defensive Duelist (L8644-8652)',
    classes: [{ id: 'fighter', level: 4 }],
    feats: ['defensive-duelist'],
    expected: [OA, { name: 'Defensive Duelist: Parry', kind: 'feat' }],
  },
  {
    name: 'Polearm Master: Reactive Strike',
    cite: 'Polearm Master (L8862-8872)',
    classes: [{ id: 'fighter', level: 4 }],
    feats: ['polearm-master'],
    expected: [OA, { name: 'Polearm Master: Reactive Strike', kind: 'feat' }],
  },
  {
    name: 'Shield Master: Interpose Shield',
    cite: 'Shield Master (L8948)',
    classes: [{ id: 'fighter', level: 4 }],
    feats: ['shield-master'],
    expected: [OA, { name: 'Shield Master: Interpose Shield', kind: 'feat' }],
  },
  {
    name: 'War Caster: Reactive Spell',
    cite: 'War Caster (L9052)',
    classes: [{ id: 'wizard', level: 4 }],
    feats: ['war-caster'],
    expected: [OA, { name: 'War Caster: Reactive Spell', kind: 'feat' }],
  },
  {
    name: 'Sentinel: Guardian (an Opportunity Attack triggered by another creature, taken with a Reaction)',
    cite: 'Sentinel Guardian (L8910); Opportunity Attack takes a Reaction (L1029)',
    classes: [{ id: 'fighter', level: 4 }],
    feats: ['sentinel'],
    expected: [OA, { name: 'Sentinel: Guardian', kind: 'feat' }],
  },
  {
    name: 'Boon of Energy Resistance: Energy Redirection',
    cite: 'Boon of Energy Resistance (L9152-9160)',
    classes: [{ id: 'fighter', level: 19 }],
    feats: ['boon-of-energy-resistance'],
    expected: [OA, { name: 'Boon of Energy Resistance: Energy Redirection', kind: 'feat' }],
  },
  {
    name: 'Interception (Fighting Style feat)',
    cite: 'Interception (L9092-9094)',
    classes: [{ id: 'fighter', level: 1 }],
    feats: ['interception'],
    expected: [OA, { name: 'Interception', kind: 'fighting-style' }],
  },
  {
    name: 'Protection (Fighting Style feat)',
    cite: 'Protection (L9098-9100)',
    classes: [{ id: 'paladin', level: 2 }],
    feats: ['protection'],
    expected: [OA, { name: 'Protection', kind: 'fighting-style' }],
  },
  {
    name: 'Other Fighting Style feats (Archery, Defense, Dueling, Great Weapon Fighting) give no Reaction',
    cite: 'Fighting Style feats (L9070-9110): only Interception and Protection are Reactions',
    classes: [{ id: 'fighter', level: 1 }],
    feats: ['archery', 'defense', 'dueling', 'great-weapon-fighting'],
    expected: [OA],
  },
  {
    name: 'Feats that mention no Reaction or are not Reactions (Lucky, Mage Slayer, Alert, Boon of Fate): nothing',
    cite: 'Lucky (Luck Points, not a Reaction); Mage Slayer (L8776-8782) has no Reaction; Boon of Fate is not a Reaction',
    classes: [{ id: 'fighter', level: 19 }],
    feats: ['lucky', 'mage-slayer', 'alert', 'boon-of-fate'],
    expected: [OA],
  },
  {
    name: 'The same feat recorded twice yields ONE entry',
    cite: 'Sentinel is not repeatable; a duplicate record must not duplicate the Reaction',
    classes: [{ id: 'fighter', level: 8 }],
    feats: ['sentinel', 'sentinel'],
    expected: [OA, { name: 'Sentinel: Guardian', kind: 'feat' }],
  },
  {
    name: 'Feat reaction is greyed when the Reaction is used',
    cite: 'Reactions L627',
    classes: [{ id: 'fighter', level: 4 }],
    feats: ['shield-master'],
    reactionUsed: true,
    expected: [oaWith('spent'), { name: 'Shield Master: Interpose Shield', kind: 'feat', unavailable: 'spent' }],
  },
  {
    name: 'Feat reaction is greyed when Incapacitated',
    cite: 'Incapacitated [Condition]',
    classes: [{ id: 'fighter', level: 4 }],
    feats: ['shield-master'],
    conditions: ['incapacitated'],
    expected: [oaWith('incapacitated'), { name: 'Shield Master: Interpose Shield', kind: 'feat', unavailable: 'incapacitated' }],
  },

  // ── Species ───────────────────────────────────────────────────────────────
  {
    name: "Goliath with Stone Giant ancestry: Stone's Endurance",
    cite: "Goliath Giant Ancestry: Stone's Endurance (L8196)",
    classes: [{ id: 'fighter', level: 1 }],
    species: { id: 'goliath', giantAncestry: 'stone' },
    expected: [OA, { name: "Stone's Endurance", kind: 'species' }],
  },
  {
    name: "Goliath with Storm Giant ancestry: Storm's Thunder",
    cite: "Goliath Giant Ancestry: Storm's Thunder (L8198)",
    classes: [{ id: 'fighter', level: 1 }],
    species: { id: 'goliath', giantAncestry: 'storm' },
    expected: [OA, { name: "Storm's Thunder", kind: 'species' }],
  },
  ...(['cloud', 'fire', 'frost', 'hill'] as const).map(
    (ancestry): ReactionScenario => ({
      name: `Goliath with ${ancestry} ancestry: no Reaction (that boon is a Bonus Action or an on-hit rider)`,
      cite: 'Goliath Giant Ancestry (L8184-8198): only Stone and Storm use a Reaction',
      classes: [{ id: 'fighter', level: 1 }],
      species: { id: 'goliath', giantAncestry: ancestry },
      expected: [OA],
    }),
  ),
  {
    name: 'Goliath with no ancestry chosen yet: nothing',
    cite: 'Giant Ancestry is a choice',
    classes: [{ id: 'fighter', level: 1 }],
    species: { id: 'goliath' },
    expected: [OA],
  },
  {
    name: 'A non-Goliath with a stale giantAncestry value: nothing',
    cite: 'Giant Ancestry is a Goliath trait (L8184)',
    classes: [{ id: 'fighter', level: 1 }],
    species: { id: 'dwarf', giantAncestry: 'stone' },
    expected: [OA],
  },
  {
    name: "Stone's Endurance greyed when the Reaction is used",
    cite: 'Reactions L627',
    classes: [{ id: 'fighter', level: 1 }],
    species: { id: 'goliath', giantAncestry: 'stone' },
    reactionUsed: true,
    expected: [oaWith('spent'), { name: "Stone's Endurance", kind: 'species', unavailable: 'spent' }],
  },
  {
    name: "Storm's Thunder greyed when Incapacitated",
    cite: 'Incapacitated [Condition]',
    classes: [{ id: 'fighter', level: 1 }],
    species: { id: 'goliath', giantAncestry: 'storm' },
    conditions: ['incapacitated'],
    expected: [oaWith('incapacitated'), { name: "Storm's Thunder", kind: 'species', unavailable: 'incapacitated' }],
  },

  // ── Text mentions 'Reaction' but is NOT the character's Reaction ──────────
  {
    name: 'Valor Bard 3: Combat Inspiration Defense is the die holder\u2019s Reaction, not the Bard\u2019s',
    cite: 'Combat Inspiration: Defense (L3085)',
    classes: [{ id: 'bard', level: 3, subclass: 'valor' }],
    expected: [OA],
  },
  {
    name: 'Glamour Bard 3: Mantle of Inspiration is a Bonus Action; the Reaction in its text is the allies\u2019',
    cite: 'Mantle of Inspiration (L3031)',
    classes: [{ id: 'bard', level: 3, subclass: 'glamour' }],
    expected: [OA],
  },
  {
    name: 'Vengeance Paladin 7: Relentless Avenger is a rider on an Opportunity Attack, not its own Reaction',
    cite: 'Relentless Avenger (L5293-5295)',
    classes: [{ id: 'paladin', level: 7, subclass: 'vengeance' }],
    expected: [OA],
  },
  {
    name: 'Beast Master Ranger 11: the Primal Companion beast uses its own Reaction',
    cite: 'The Beast in Combat (L5587)',
    classes: [{ id: 'ranger', level: 11, subclass: 'beastMaster' }],
    expected: [OA],
  },
  {
    name: 'Soulknife Rogue 3: Psionic Power has no Reaction (unlike the Psi Warrior)',
    cite: 'Soulknife Psionic Power (L6110-6127)',
    classes: [{ id: 'rogue', level: 3, subclass: 'soulknife' }],
    expected: [OA],
  },
  {
    name: 'War Domain Cleric 3 only gets Guided Strike; Channel Divinity text on other subclasses gives none',
    cite: 'Life Domain Preserve Life is a Magic action',
    classes: [{ id: 'cleric', level: 3, subclass: 'life' }],
    expected: [OA],
  },

  // ── Exact SETS for multiclass / mixed characters (cardinality) ───────────
  {
    name: 'SET: Cleric 3 light / Bard 3 lore',
    cite: 'Warding Flare (L3471); Cutting Words (L3061); Countercharm needs Bard 7',
    classes: [
      { id: 'cleric', level: 3, subclass: 'light' },
      { id: 'bard', level: 3, subclass: 'lore' },
    ],
    expected: [OA, { name: 'Warding Flare', kind: 'subclass-feature' }, { name: 'Cutting Words', kind: 'subclass-feature' }],
  },
  {
    name: 'SET: Monk 4 / Rogue 5 arcane trickster / Wizard 6 abjurer',
    cite: 'Deflect Attacks L4591, Slow Fall L4603, Uncanny Dodge L5959, Projected Ward L7672',
    classes: [
      { id: 'monk', level: 4 },
      { id: 'rogue', level: 5, subclass: 'arcaneTrickster' },
      { id: 'wizard', level: 6, subclass: 'abjurer' },
    ],
    expected: [
      OA,
      { name: 'Deflect Attacks', kind: 'class-feature' },
      { name: 'Slow Fall', kind: 'class-feature' },
      { name: 'Uncanny Dodge', kind: 'class-feature' },
      { name: 'Projected Ward', kind: 'subclass-feature' },
    ],
  },
  {
    name: 'SET: Paladin 15 glory / Cleric 5 war',
    cite: 'Glorious Defense L5193; Guided Strike L3540; Living Legend needs Paladin 20',
    classes: [
      { id: 'paladin', level: 15, subclass: 'glory' },
      { id: 'cleric', level: 5, subclass: 'war' },
    ],
    expected: [OA, { name: 'Glorious Defense', kind: 'subclass-feature' }, { name: 'Guided Strike', kind: 'subclass-feature' }],
  },
  {
    name: 'SET: Warlock 10 archfey with Investment and a Pact of the Chain familiar',
    cite: 'Misty Escape L7210; Beguiling Defenses L7220; Investment L6984',
    classes: [{ id: 'warlock', level: 10, subclass: 'archfey' }],
    classChoices: { 'warlock.invocations': ['pact-of-the-chain', 'investment-of-the-chain-master'] },
    prepared: ['hellish-rebuke', 'counterspell'],
    pact: { slotLevel: 5, available: 2 },
    expected: [
      OA,
      { name: 'Misty Escape', kind: 'subclass-feature' },
      { name: 'Beguiling Defenses', kind: 'subclass-feature' },
      { name: 'Investment of the Chain Master: Resistance', kind: 'class-choice' },
      { name: 'Hellish Rebuke', kind: 'spell' },
      { name: 'Counterspell', kind: 'spell' },
    ],
  },
  {
    name: 'SET: Goliath Battle Master 7 with Shield Master, Defensive Duelist, Interception and War Caster',
    cite: "Stone's Endurance L8196; Parry L4295; Riposte L4303; feats L8648, L8948, L9052, L9094",
    classes: [{ id: 'fighter', level: 7, subclass: 'battleMaster' }],
    species: { id: 'goliath', giantAncestry: 'stone' },
    feats: ['shield-master', 'defensive-duelist', 'interception', 'war-caster'],
    classChoices: { 'fighter.maneuvers': ['parry', 'riposte', 'rally', 'precision-attack', 'trip-attack'] },
    expected: [
      OA,
      { name: "Stone's Endurance", kind: 'species' },
      { name: 'Shield Master: Interpose Shield', kind: 'feat' },
      { name: 'Defensive Duelist: Parry', kind: 'feat' },
      { name: 'Interception', kind: 'fighting-style' },
      { name: 'War Caster: Reactive Spell', kind: 'feat' },
      { name: 'Maneuver: Parry', kind: 'class-choice' },
      { name: 'Maneuver: Riposte', kind: 'class-choice' },
    ],
  },
  {
    name: 'SET: everything greyed at once (Barbarian 14 zealot, Sorcerer 6 wild magic, Sentinel, Storm Goliath) when Stunned',
    cite: 'Stunned includes Incapacitated',
    classes: [
      { id: 'barbarian', level: 14, subclass: 'zealot' },
      { id: 'sorcerer', level: 6, subclass: 'wildMagic' },
    ],
    species: { id: 'goliath', giantAncestry: 'storm' },
    feats: ['sentinel'],
    conditions: ['stunned'],
    resourcesSpent: { 'barbarian.rage': 99 },
    expected: all(
      [
        OA,
        { name: 'Rage of the Gods: Revivification', kind: 'subclass-feature' },
        { name: 'Bend Luck', kind: 'subclass-feature' },
        { name: 'Sentinel: Guardian', kind: 'feat' },
        { name: "Storm's Thunder", kind: 'species' },
      ],
      'incapacitated',
    ),
  },
  {
    name: 'SET: Bard 7 dance with a prepared Feather Fall: feature, subclass feature and spell together',
    cite: 'Countercharm L2824; Inspiring Movement L2999; Feather Fall L13079',
    classes: [{ id: 'bard', level: 7, subclass: 'dance' }],
    prepared: ['feather-fall'],
    slotsAvailable: { 1: 4, 2: 3, 3: 3, 4: 1 },
    expected: [
      OA,
      { name: 'Countercharm', kind: 'class-feature' },
      { name: 'Inspiring Movement', kind: 'subclass-feature' },
      { name: 'Feather Fall', kind: 'spell' },
    ],
  },
  {
    name: 'SET: Druid 6 stars: Cosmic Omen only',
    cite: 'Cosmic Omen L4064',
    classes: [{ id: 'druid', level: 6, subclass: 'stars' }],
    expected: [OA, { name: 'Cosmic Omen', kind: 'subclass-feature' }],
  },
];

export const ALL_REACTION_SCENARIOS: ReactionScenario[] = [...REACTION_SCENARIOS, ...SUBCLASS_SCENARIOS, ...EXTRA_SCENARIOS];

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
  /**
   * Stage D2: subclass features that must NOT be tagged although their text
   * mentions a Reaction (another creature's Reaction, or a rider).
   */
  notReactionSubclassFeatures: { classId: string; subclass: string; name: string }[];
  /** Feat ids tagged with a Reaction, with the reaction names. */
  feats: { id: string; reactions: string[] }[];
  /** Feat ids whose text mentions no Reaction of the character's own (must carry NO reaction tag). */
  notReactionFeats: string[];
  /** Goliath Giant Ancestry options tagged with a Reaction. */
  speciesOptions: { speciesId: string; optionId: string; name: string }[];
  /** Maneuver ids whose trigger is 'reaction'. */
  maneuvers: string[];
  /** Eldritch Invocation ids tagged with a Reaction. */
  invocations: { id: string; name: string }[];
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
  notReactionSubclassFeatures: [
    { classId: 'bard', subclass: 'valor', name: 'Combat Inspiration' },
    { classId: 'bard', subclass: 'glamour', name: 'Mantle of Inspiration' },
    { classId: 'paladin', subclass: 'vengeance', name: 'Relentless Avenger' },
    { classId: 'cleric', subclass: 'life', name: 'Preserve Life' },
    { classId: 'rogue', subclass: 'soulknife', name: 'Psionic Power' },
  ],
  feats: [
    { id: 'defensive-duelist', reactions: ['Defensive Duelist: Parry'] },
    { id: 'polearm-master', reactions: ['Polearm Master: Reactive Strike'] },
    { id: 'shield-master', reactions: ['Shield Master: Interpose Shield'] },
    { id: 'war-caster', reactions: ['War Caster: Reactive Spell'] },
    { id: 'sentinel', reactions: ['Sentinel: Guardian'] },
    { id: 'boon-of-energy-resistance', reactions: ['Boon of Energy Resistance: Energy Redirection'] },
    { id: 'interception', reactions: ['Interception'] },
    { id: 'protection', reactions: ['Protection'] },
  ],
  notReactionFeats: ['lucky', 'mage-slayer', 'alert', 'boon-of-fate', 'archery', 'defense', 'dueling', 'great-weapon-fighting'],
  speciesOptions: [
    { speciesId: 'goliath', optionId: 'stone', name: "Stone's Endurance" },
    { speciesId: 'goliath', optionId: 'storm', name: "Storm's Thunder" },
  ],
  maneuvers: ['parry', 'riposte'],
  invocations: [{ id: 'investment-of-the-chain-master', name: 'Investment of the Chain Master: Resistance' }],
};
