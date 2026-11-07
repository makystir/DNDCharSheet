/**
 * D&D 5.5e (2024) conditions catalog.
 *
 * Ported IN STRUCTURE from PWACharSheet's src/data/conditions.ts (a flat array
 * of named condition records with description / effects / removal text); the
 * CONTENT is fresh, PARAPHRASED from the PHB 2024 Rules Glossary.
 *
 * SOURCING / RULES COMPLIANCE
 * ---------------------------
 * The PHB 2024 "Conditions" glossary entry (Docs/PlayersHandbook.md L1197-1216)
 * lists exactly 15 conditions: Blinded, Charmed, Deafened, Exhaustion,
 * Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified,
 * Poisoned, Prone, Restrained, Stunned, Unconscious. There is no discrepancy
 * from the expected 15. Each entry carries a `// PHB 2024` line citation to its
 * own glossary entry (rules-compliance rule 7). Mechanical VALUES (5 feet, x10 weight, -2 x level, ...) are
 * transcribed exactly; the prose in `description` / `effects` / `endsWhen` is
 * written in our own words and is NOT a copy of the PHB sentences.
 *
 * `mechanics` holds the same rules as machine-checkable flags. It is compared
 * against an independent, hand-derived golden fixture by the completeness
 * oracle (src/data/__tests__/conditions-oracle.test.ts), which also checks that
 * the prose and the flags cannot silently diverge.
 *
 * NO STACKING (PHB L1214-1216): a condition is had or not had; multiple
 * sources do not worsen it. Exhaustion is the sole exception (cumulative).
 * "Some conditions apply other conditions" (L1208) is captured by `implies`.
 *
 * DURATION (PHB L1210-1212): a condition lasts for the duration given by the
 * effect that imposed it, or until countered. That is imposed per effect, so
 * the catalog stores only the PHB's own removal rule (`endsWhen`) where the
 * glossary gives one; per-instance durations are a free-text note on the
 * character (see ActiveCondition.ends).
 */

/** The 15 condition ids (PHB 2024 Rules Glossary, L1197-1206). */
export type ConditionId =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'exhaustion'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious';

/**
 * Structured, machine-checkable form of a condition's operative rules. Every
 * field is optional: an absent field means the PHB entry specifies nothing of
 * that kind (so `undefined` is meaningful and the oracle compares the whole
 * object). Conditions applied through `implies` are NOT repeated here.
 */
export interface ConditionMechanics {
  cannotSee?: boolean;
  cannotHear?: boolean;
  /** Ability checks that require this sense fail automatically. */
  autoFailChecksRequiring?: 'sight' | 'hearing';
  speedZero?: boolean;
  autoFailStrDexSaves?: boolean;
  dexSaves?: 'disadvantage';
  /** Effect on attack rolls made AGAINST the creature. */
  attacksAgainst?:
    | 'advantage'
    | 'disadvantage'
    | 'disadvantage-unless-seen'
    | 'advantage-within-5ft-else-disadvantage';
  /** Effect on the creature's OWN attack rolls. */
  ownAttacks?:
    | 'advantage'
    | 'disadvantage'
    | 'advantage-unless-seen'
    | 'disadvantage-while-source-in-sight'
    | 'disadvantage-vs-non-grappler';
  abilityChecks?: 'disadvantage' | 'disadvantage-while-source-in-sight';
  /** Hits within 5 feet are automatically Critical Hits. */
  critWithin5ft?: boolean;
  initiative?: 'advantage' | 'disadvantage';
  noActions?: boolean;
  concentrationBroken?: boolean;
  cannotSpeak?: boolean;
  cannotHarmCharmer?: boolean;
  charmerSocialAdvantage?: boolean;
  cannotApproachSource?: boolean;
  /** Extra feet of movement the grappler pays per foot moved while dragging. */
  grapplerDragExtraFeet?: number;
  onlyCrawlOrStand?: boolean;
  /** Fraction of Speed spent to stand up (rounded down). */
  standCostFractionOfSpeed?: number;
  cannotStandAtSpeedZero?: boolean;
  immuneToSeenTargetEffects?: boolean;
  equipmentConcealed?: boolean;
  becomesInanimate?: boolean;
  weightMultiplier?: number;
  ceasesAging?: boolean;
  resistanceAllDamage?: boolean;
  immuneToPoisoned?: boolean;
  dropsHeld?: boolean;
  remainsProneAfter?: boolean;
  cumulativeLevels?: boolean;
  deathLevel?: number;
  d20PenaltyPerLevel?: number;
  speedPenaltyPerLevel?: number;
  longRestRemovesLevels?: number;
}

/** A single condition entry. */
export interface ConditionData {
  id: ConditionId;
  name: string;
  /** One-sentence paraphrased summary. */
  description: string;
  /** Operative rules, as short paraphrased strings (one rule per line). */
  effects: string[];
  /** The same rules as structured flags (see ConditionMechanics). */
  mechanics: ConditionMechanics;
  /** How the condition ends / is countered, where the PHB glossary says so. */
  endsWhen?: string;
  /** Conditions this one also applies (read-only derived information). */
  implies: ConditionId[];
  /** Per-entry PHB 2024 citation (glossary entry + markdown line). */
  source: string;
}

export const CONDITIONS: ConditionData[] = [
  {
    id: 'blinded',
    name: 'Blinded',
    description: 'You have no sight, which spoils your attacks and makes you easy to hit.',
    effects: [
      'You cannot see, so any ability check that relies on sight fails automatically.',
      'Attacks against you have advantage.',
      'Your attacks have disadvantage.',
    ],
    mechanics: {
      cannotSee: true,
      autoFailChecksRequiring: 'sight',
      attacksAgainst: 'advantage',
      ownAttacks: 'disadvantage',
    },
    implies: [],
    // PHB 2024 "Blinded [Condition]" (Docs/PlayersHandbook.md L20675-20681)
    source: 'PHB 2024 "Blinded" (Docs/PlayersHandbook.md L20675-20681)',
  },
  {
    id: 'charmed',
    name: 'Charmed',
    description: 'Another creature, the charmer, has bewitched you.',
    effects: [
      'You cannot attack the charmer, or aim damaging abilities or magical effects at it.',
      'The charmer has advantage on any ability check to interact with you socially.',
    ],
    mechanics: { cannotHarmCharmer: true, charmerSocialAdvantage: true },
    implies: [],
    // PHB 2024 "Charmed [Condition]" (L20812-20818)
    source: 'PHB 2024 "Charmed" (Docs/PlayersHandbook.md L20812-20818)',
  },
  {
    id: 'deafened',
    name: 'Deafened',
    description: 'You have no hearing.',
    effects: ['You cannot hear, so any ability check that relies on hearing fails automatically.'],
    mechanics: { cannotHear: true, autoFailChecksRequiring: 'hearing' },
    implies: [],
    // PHB 2024 "Deafened [Condition]" (L20939-20943)
    source: 'PHB 2024 "Deafened" (Docs/PlayersHandbook.md L20939-20943)',
  },
  {
    id: 'exhaustion',
    name: 'Exhaustion',
    description:
      'A cumulative condition tracked in levels (1 to 6) that lowers your D20 Tests and Speed and kills you at level 6.',
    effects: [
      'Cumulative: each time you receive it you gain 1 Exhaustion level.',
      'If you reach Exhaustion level 6, you die.',
      'Each D20 Test you make is lowered by 2 for every Exhaustion level.',
      'Your Speed is lowered by 5 feet for every Exhaustion level.',
      'Each Long Rest you finish removes 1 Exhaustion level.',
    ],
    mechanics: {
      cumulativeLevels: true,
      deathLevel: 6,
      d20PenaltyPerLevel: 2,
      speedPenaltyPerLevel: 5,
      longRestRemovesLevels: 1,
    },
    endsWhen: 'Each Long Rest removes 1 level, and the condition ends once your level reaches 0.',
    implies: [],
    // PHB 2024 "Exhaustion [Condition]" (L21018-21028)
    source: 'PHB 2024 "Exhaustion" (Docs/PlayersHandbook.md L21018-21028)',
  },
  {
    id: 'frightened',
    name: 'Frightened',
    description: 'You are gripped by fear of one particular source.',
    effects: [
      'Your ability checks have disadvantage while the source of your fear is in your line of sight.',
      'Your attacks have disadvantage while the source of your fear is in your line of sight.',
      'You cannot voluntarily move closer to the source of your fear.',
    ],
    mechanics: {
      abilityChecks: 'disadvantage-while-source-in-sight',
      ownAttacks: 'disadvantage-while-source-in-sight',
      cannotApproachSource: true,
    },
    implies: [],
    // PHB 2024 "Frightened [Condition]" (L21062-21068)
    source: 'PHB 2024 "Frightened" (Docs/PlayersHandbook.md L21062-21068)',
  },
  {
    id: 'grappled',
    name: 'Grappled',
    description: 'Another creature has you in its hold.',
    effects: [
      'Your attacks have disadvantage against any target other than the grappler.',
      'Your Speed drops to 0 and cannot be increased.',
      'The grappler can drag or carry you, but each foot of its movement costs it 1 extra foot, unless you are Tiny or at least two sizes smaller than it.',
    ],
    mechanics: {
      ownAttacks: 'disadvantage-vs-non-grappler',
      speedZero: true,
      grapplerDragExtraFeet: 1,
    },
    endsWhen:
      'You break free by using your action on a Strength (Athletics) or Dexterity (Acrobatics) check against the escape DC. It also ends if the grappler becomes Incapacitated or the grapple\u2019s range is exceeded.',
    implies: [],
    // PHB 2024 "Grappled [Condition]" (L21070-21078); escape rules "Grappling" (L21092)
    source: 'PHB 2024 "Grappled" (Docs/PlayersHandbook.md L21070-21078, L21092)',
  },
  {
    id: 'incapacitated',
    name: 'Incapacitated',
    description: 'You are unable to act.',
    effects: [
      'You cannot take actions, Bonus Actions, or Reactions.',
      'Your Concentration ends.',
      'You cannot speak.',
      'If you roll Initiative while Incapacitated, the roll has disadvantage.',
    ],
    mechanics: {
      noActions: true,
      concentrationBroken: true,
      cannotSpeak: true,
      initiative: 'disadvantage',
    },
    implies: [],
    // PHB 2024 "Incapacitated [Condition]" (L21184-21192)
    source: 'PHB 2024 "Incapacitated" (Docs/PlayersHandbook.md L21184-21192)',
  },
  {
    id: 'invisible',
    name: 'Invisible',
    description: 'You cannot be seen without special means.',
    effects: [
      'If you roll Initiative while Invisible, the roll has advantage.',
      'Effects that require their target to be seen do not affect you, unless the effect\u2019s creator can somehow see you.',
      'Your worn and carried equipment is concealed as well.',
      // PHB 2024 "Attacks Affected" (L21267): the "can somehow see you" carve-out
      // removes BOTH benefits against that creature, not just your own advantage.
      'Attacks against you have disadvantage, except from a creature that can somehow see you.',
      'Your attacks have advantage, except against a creature that can somehow see you.',
    ],
    mechanics: {
      initiative: 'advantage',
      immuneToSeenTargetEffects: true,
      equipmentConcealed: true,
      attacksAgainst: 'disadvantage-unless-seen',
      ownAttacks: 'advantage-unless-seen',
    },
    implies: [],
    // PHB 2024 "Invisible [Condition]" (L21261-21269)
    source: 'PHB 2024 "Invisible" (Docs/PlayersHandbook.md L21261-21269)',
  },
  {
    id: 'paralyzed',
    name: 'Paralyzed',
    description: 'You cannot move or act and are very exposed to nearby attackers.',
    effects: [
      'You also have the Incapacitated condition.',
      'Your Speed drops to 0 and cannot be increased.',
      'You automatically fail Strength and Dexterity saving throws.',
      'Attacks against you have advantage.',
      'A hit against you is automatically a Critical Hit when the attacker is within 5 feet.',
    ],
    mechanics: {
      speedZero: true,
      autoFailStrDexSaves: true,
      attacksAgainst: 'advantage',
      critWithin5ft: true,
    },
    implies: ['incapacitated'],
    // PHB 2024 "Paralyzed [Condition]" (L21344-21356)
    source: 'PHB 2024 "Paralyzed" (Docs/PlayersHandbook.md L21344-21356)',
  },
  {
    id: 'petrified',
    name: 'Petrified',
    description: 'You are turned into a solid, lifeless substance, usually stone.',
    effects: [
      'You and any nonmagical objects you wear or carry turn into a solid inanimate substance, usually stone.',
      'Your weight becomes 10 times normal, and you stop aging.',
      'You also have the Incapacitated condition.',
      'Your Speed drops to 0 and cannot be increased.',
      'Attacks against you have advantage.',
      'You automatically fail Strength and Dexterity saving throws.',
      'You have resistance to all damage.',
      'You are immune to the Poisoned condition.',
    ],
    mechanics: {
      becomesInanimate: true,
      weightMultiplier: 10,
      ceasesAging: true,
      speedZero: true,
      attacksAgainst: 'advantage',
      autoFailStrDexSaves: true,
      resistanceAllDamage: true,
      immuneToPoisoned: true,
    },
    implies: ['incapacitated'],
    // PHB 2024 "Petrified [Condition]" (L21370-21382)
    source: 'PHB 2024 "Petrified" (Docs/PlayersHandbook.md L21370-21382)',
  },
  {
    id: 'poisoned',
    name: 'Poisoned',
    description: 'Toxins hamper your performance.',
    effects: ['Your attacks and ability checks have disadvantage.'],
    mechanics: { ownAttacks: 'disadvantage', abilityChecks: 'disadvantage' },
    implies: [],
    // PHB 2024 "Poisoned [Condition]" (L21390-21394)
    source: 'PHB 2024 "Poisoned" (Docs/PlayersHandbook.md L21390-21394)',
  },
  {
    id: 'prone',
    name: 'Prone',
    description: 'You are lying on the ground.',
    effects: [
      'Your only movement options are to crawl, or to stand up by spending half your Speed (rounded down).',
      'You cannot stand up if your Speed is 0.',
      'Your attacks have disadvantage.',
      'Attacks against you have advantage if the attacker is within 5 feet, and disadvantage if it is farther away.',
    ],
    mechanics: {
      onlyCrawlOrStand: true,
      standCostFractionOfSpeed: 0.5,
      cannotStandAtSpeedZero: true,
      ownAttacks: 'disadvantage',
      attacksAgainst: 'advantage-within-5ft-else-disadvantage',
    },
    endsWhen: 'You stand up by spending half your Speed (rounded down).',
    implies: [],
    // PHB 2024 "Prone [Condition]" (L21406-21412); countered by standing up (L1212)
    source: 'PHB 2024 "Prone" (Docs/PlayersHandbook.md L21406-21412, L1212)',
  },
  {
    id: 'restrained',
    name: 'Restrained',
    description: 'You are bound or otherwise held fast.',
    effects: [
      'Your Speed drops to 0 and cannot be increased.',
      'Attacks against you have advantage.',
      'Your attacks have disadvantage.',
      'You have disadvantage on Dexterity saving throws.',
    ],
    mechanics: {
      speedZero: true,
      attacksAgainst: 'advantage',
      ownAttacks: 'disadvantage',
      dexSaves: 'disadvantage',
    },
    implies: [],
    // PHB 2024 "Restrained [Condition]" (L21432-21440)
    source: 'PHB 2024 "Restrained" (Docs/PlayersHandbook.md L21432-21440)',
  },
  {
    id: 'stunned',
    name: 'Stunned',
    description: 'You are dazed and cannot act.',
    effects: [
      'You also have the Incapacitated condition.',
      'You automatically fail Strength and Dexterity saving throws.',
      'Attacks against you have advantage.',
    ],
    mechanics: { autoFailStrDexSaves: true, attacksAgainst: 'advantage' },
    implies: ['incapacitated'],
    // PHB 2024 "Stunned [Condition]" (L21611-21619)
    source: 'PHB 2024 "Stunned" (Docs/PlayersHandbook.md L21611-21619)',
  },
  {
    id: 'unconscious',
    name: 'Unconscious',
    description: 'You are knocked out and unaware of your surroundings.',
    effects: [
      'You also have the Incapacitated and Prone conditions.',
      'You drop whatever you are holding.',
      'When this condition ends, you remain Prone.',
      'Your Speed drops to 0 and cannot be increased.',
      'Attacks against you have advantage.',
      'You automatically fail Strength and Dexterity saving throws.',
      'A hit against you is automatically a Critical Hit when the attacker is within 5 feet.',
    ],
    mechanics: {
      dropsHeld: true,
      remainsProneAfter: true,
      speedZero: true,
      attacksAgainst: 'advantage',
      autoFailStrDexSaves: true,
      critWithin5ft: true,
    },
    implies: ['incapacitated', 'prone'],
    // PHB 2024 "Unconscious [Condition]" (L21697-21709)
    source: 'PHB 2024 "Unconscious" (Docs/PlayersHandbook.md L21697-21709)',
  },
];

/** Look up a condition by id; undefined for an unknown id. */
export function getCondition(id: string): ConditionData | undefined {
  return CONDITIONS.find((c) => c.id === id);
}

/** True when `id` is one of the 15 PHB condition ids. */
export function isConditionId(id: string): id is ConditionId {
  return CONDITIONS.some((c) => c.id === id);
}

// â”€â”€ Exhaustion level track â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Structured Exhaustion rules (PHB 2024 "Exhaustion [Condition]",
 * Docs/PlayersHandbook.md L21018-21028):
 *  - cumulative levels; you die if your level is 6 (L21022)
 *  - D20 Tests are reduced by 2 x level (L21024)
 *  - Speed is reduced by 5 ft x level (L21026)
 *  - a Long Rest removes 1 level; the condition ends at level 0 (L21028)
 */
export const EXHAUSTION = {
  /** Highest level; reaching it is fatal. */
  maxLevel: 6,
  /** Level at which the creature dies. */
  deathLevel: 6,
  /** D20 Test reduction per level. */
  d20PenaltyPerLevel: 2,
  /** Speed reduction (feet) per level. */
  speedPenaltyPerLevel: 5,
  /** Levels removed by finishing a Long Rest. */
  longRestReduction: 1,
  source: 'PHB 2024 "Exhaustion" (Docs/PlayersHandbook.md L21018-21028)',
} as const;

/** One row of the Exhaustion track. */
export interface ExhaustionLevelData {
  level: number;
  /** Reduction applied to D20 Test rolls (a positive magnitude). */
  d20Penalty: number;
  /** Reduction to Speed, in feet (a positive magnitude). */
  speedPenaltyFt: number;
  /** True when this level is fatal. */
  fatal: boolean;
}

/** The full 1..6 track, derived from the EXHAUSTION constants. */
export const EXHAUSTION_TRACK: ExhaustionLevelData[] = Array.from(
  { length: EXHAUSTION.maxLevel },
  (_, i) => {
    const level = i + 1;
    return {
      level,
      d20Penalty: level * EXHAUSTION.d20PenaltyPerLevel,
      speedPenaltyFt: level * EXHAUSTION.speedPenaltyPerLevel,
      fatal: level >= EXHAUSTION.deathLevel,
    };
  },
);

// â”€â”€ Badge colours (ported from PWA data/condition-colors.ts) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Badge colours; text/background pairs keep >= 4.5:1 contrast (WCAG AA). */
export interface ConditionColor {
  bg: string;
  text: string;
  hue: number;
}

export const CONDITION_COLORS: Record<ConditionId, ConditionColor> = {
  blinded: { bg: '#374151', text: '#fff', hue: 215 },
  charmed: { bg: '#be185d', text: '#fff', hue: 330 },
  deafened: { bg: '#475569', text: '#fff', hue: 215 },
  exhaustion: { bg: '#9a3412', text: '#fff', hue: 25 },
  frightened: { bg: '#6d28d9', text: '#fff', hue: 263 },
  grappled: { bg: '#78350f', text: '#fff', hue: 30 },
  incapacitated: { bg: '#334155', text: '#fff', hue: 215 },
  invisible: { bg: '#0e7490', text: '#fff', hue: 190 },
  paralyzed: { bg: '#ca8a04', text: '#000', hue: 45 },
  petrified: { bg: '#57534e', text: '#fff', hue: 30 },
  poisoned: { bg: '#166534', text: '#fff', hue: 142 },
  prone: { bg: '#6b7280', text: '#fff', hue: 220 },
  restrained: { bg: '#92400e', text: '#fff', hue: 30 },
  stunned: { bg: '#a16207', text: '#fff', hue: 45 },
  unconscious: { bg: '#111827', text: '#fff', hue: 220 },
};

/** Fallback colour for an unknown condition id. */
export const CONDITION_COLOR_FALLBACK: ConditionColor = {
  bg: '#6b7280',
  text: '#fff',
  hue: 220,
};

/**
 * Badge opacity for a stackable condition by level (Exhaustion is the only
 * stackable D&D condition). Ported from the PWA helper: 1.0 for non-stackable
 * or level <= 1, otherwise scaling from 0.5 up to 1.0 at max level.
 */
export function getConditionIntensity(
  level: number,
  maxLevel: number,
  isStackable: boolean,
): number {
  if (!isStackable || level <= 1 || maxLevel <= 1) return 1.0;
  const MIN_OPACITY = 0.5;
  return MIN_OPACITY + (level / maxLevel) * (1.0 - MIN_OPACITY);
}
