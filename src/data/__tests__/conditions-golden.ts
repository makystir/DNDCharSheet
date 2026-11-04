/**
 * GOLDEN FIXTURE for the conditions catalog (Stage A4).
 *
 * Ids plus key numeric facts transcribed from the PHB 2024 Rules Glossary
 * (Docs/PlayersHandbook.md). Independent of src/data/conditions.ts so a drift
 * in the catalog fails the oracle rather than silently updating the fixture.
 * Only a TYPE is imported from the catalog (no values).
 */
import type { ConditionMechanics } from '../conditions';

export const GOLDEN_CONDITION_IDS = [
  'blinded',
  'charmed',
  'deafened',
  'exhaustion',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
] as const;

/** PHB L1201-1206: the glossary table lists exactly 15 conditions. */
export const GOLDEN_CONDITION_COUNT = 15;

/** PHB L21022-21028 numeric facts. */
export const GOLDEN_EXHAUSTION = {
  maxLevel: 6,
  deathLevel: 6,
  d20PenaltyPerLevel: 2,
  speedPenaltyPerLevel: 5,
  longRestReduction: 1,
} as const;

/**
 * Per-condition golden record, hand-derived from the PHB glossary entries
 * (line ranges in each comment) and INDEPENDENT of the catalog's prose.
 *  - mechanics: exactly the operative rules the PHB entry specifies (an absent
 *    key means the entry specifies nothing of that kind);
 *  - effectCount: exact number of `effects` lines (catches added/dropped rules);
 *  - endsWhen: word-bounded tokens the removal text must contain, or null when
 *    the PHB gives the catalog no removal text to record.
 * Conditions applied via `implies` are in GOLDEN_IMPLIES below.
 */
export interface GoldenCondition {
  mechanics: ConditionMechanics;
  effectCount: number;
  endsWhen: RegExp[] | null;
}

export const GOLDEN_CONDITIONS: Record<(typeof GOLDEN_CONDITION_IDS)[number], GoldenCondition> = {
  // L20679-20681: can't see, auto-fail sight checks; attacks against Adv, own attacks Disadv
  blinded: {
    mechanics: {
      cannotSee: true,
      autoFailChecksRequiring: 'sight',
      attacksAgainst: 'advantage',
      ownAttacks: 'disadvantage',
    },
    effectCount: 3,
    endsWhen: null,
  },
  // L20816-20818: cannot attack/harm the charmer; charmer has social Advantage
  charmed: {
    mechanics: { cannotHarmCharmer: true, charmerSocialAdvantage: true },
    effectCount: 2,
    endsWhen: null,
  },
  // L20943: can't hear, auto-fail hearing checks
  deafened: {
    mechanics: { cannotHear: true, autoFailChecksRequiring: 'hearing' },
    effectCount: 1,
    endsWhen: null,
  },
  // L21022-21028: cumulative, die at 6, -2 x level D20, -5 ft x level Speed, Long Rest -1
  exhaustion: {
    mechanics: {
      cumulativeLevels: true,
      deathLevel: GOLDEN_EXHAUSTION.deathLevel,
      d20PenaltyPerLevel: GOLDEN_EXHAUSTION.d20PenaltyPerLevel,
      speedPenaltyPerLevel: GOLDEN_EXHAUSTION.speedPenaltyPerLevel,
      longRestRemovesLevels: GOLDEN_EXHAUSTION.longRestReduction,
    },
    effectCount: 5,
    endsWhen: [/\blong rest\b/i, /\b1 level\b/i, /\bends\b/i, /\b0\b/],
  },
  // L21064-21068: Disadvantage on checks and attacks while source in line of sight; no approach
  frightened: {
    mechanics: {
      abilityChecks: 'disadvantage-while-source-in-sight',
      ownAttacks: 'disadvantage-while-source-in-sight',
      cannotApproachSource: true,
    },
    effectCount: 3,
    endsWhen: null,
  },
  // L21074-21078 and escape rules L21092: Disadvantage vs non-grappler, Speed 0, drag costs +1 ft
  grappled: {
    mechanics: {
      ownAttacks: 'disadvantage-vs-non-grappler',
      speedZero: true,
      grapplerDragExtraFeet: 1,
    },
    effectCount: 3,
    endsWhen: [
      /\baction\b/i,
      /\bathletics\b/i,
      /\bacrobatics\b/i,
      /\bescape dc\b/i,
      /\bincapacitated\b/i,
      /\brange\b/i,
    ],
  },
  // L21188-21192: no actions, concentration broken, can't speak, Initiative Disadvantage
  incapacitated: {
    mechanics: {
      noActions: true,
      concentrationBroken: true,
      cannotSpeak: true,
      initiative: 'disadvantage',
    },
    effectCount: 4,
    endsWhen: null,
  },
  // L21265-21269: Initiative Advantage; unseen by seen-target effects; equipment hidden;
  // attacks against Disadvantage, own attacks Advantage (not vs creatures that can see you)
  invisible: {
    mechanics: {
      initiative: 'advantage',
      immuneToSeenTargetEffects: true,
      equipmentConcealed: true,
      attacksAgainst: 'disadvantage-unless-seen',
      ownAttacks: 'advantage-unless-seen',
    },
    effectCount: 5,
    endsWhen: null,
  },
  // L21348-21356 (Incapacitated via implies)
  paralyzed: {
    mechanics: {
      speedZero: true,
      autoFailStrDexSaves: true,
      attacksAgainst: 'advantage',
      critWithin5ft: true,
    },
    effectCount: 5,
    endsWhen: null,
  },
  // L21374-21382 (Incapacitated via implies)
  petrified: {
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
    effectCount: 8,
    endsWhen: null,
  },
  // L21394: Disadvantage on attack rolls and ability checks
  poisoned: {
    mechanics: { ownAttacks: 'disadvantage', abilityChecks: 'disadvantage' },
    effectCount: 1,
    endsWhen: null,
  },
  // L21410-21412: crawl or half-Speed stand, no stand at Speed 0, own Disadvantage,
  // attacks against Adv within 5 ft else Disadv; standing up ends it
  prone: {
    mechanics: {
      onlyCrawlOrStand: true,
      standCostFractionOfSpeed: 0.5,
      cannotStandAtSpeedZero: true,
      ownAttacks: 'disadvantage',
      attacksAgainst: 'advantage-within-5ft-else-disadvantage',
    },
    effectCount: 4,
    endsWhen: [/\bstand up\b/i, /\bhalf\b/i, /\bspeed\b/i],
  },
  // L21436-21440
  restrained: {
    mechanics: {
      speedZero: true,
      attacksAgainst: 'advantage',
      ownAttacks: 'disadvantage',
      dexSaves: 'disadvantage',
    },
    effectCount: 4,
    endsWhen: null,
  },
  // L21615-21619 (Incapacitated via implies)
  stunned: {
    mechanics: { autoFailStrDexSaves: true, attacksAgainst: 'advantage' },
    effectCount: 3,
    endsWhen: null,
  },
  // L21701-21709 (Incapacitated and Prone via implies)
  unconscious: {
    mechanics: {
      dropsHeld: true,
      remainsProneAfter: true,
      speedZero: true,
      attacksAgainst: 'advantage',
      autoFailStrDexSaves: true,
      critWithin5ft: true,
    },
    effectCount: 7,
    endsWhen: null,
  },
};

/** Implied conditions: Paralyzed L21348, Petrified L21376, Stunned L21615, Unconscious L21701. */
export const GOLDEN_IMPLIES: Record<string, string[]> = {
  blinded: [],
  charmed: [],
  deafened: [],
  exhaustion: [],
  frightened: [],
  grappled: [],
  incapacitated: [],
  invisible: [],
  paralyzed: ['incapacitated'],
  petrified: ['incapacitated'],
  poisoned: [],
  prone: [],
  restrained: [],
  stunned: ['incapacitated'],
  unconscious: ['incapacitated', 'prone'],
};
