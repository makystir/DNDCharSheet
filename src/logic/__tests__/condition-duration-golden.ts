/**
 * GOLDEN TABLE: structured condition durations (Stage E).
 *
 * AUTHORSHIP RULE: written BEFORE logic/condition-duration.ts. The implementer
 * must make the logic reproduce every row and MUST NOT edit this file to fit.
 *
 * DATA ONLY (no imports). The harness in condition-duration-golden.test.ts maps
 * each scenario onto a real Character and replays its steps.
 *
 * RULES BASIS (PHB 2024, Docs/PlayersHandbook.md):
 *  - Conditions "Duration" (L1210-1212): a condition lasts for the duration
 *    specified by the effect that imposed it, or until it is countered. The PHB
 *    defines NO generic condition duration, so this is bookkeeping only: the
 *    user chooses a duration, and the app only ever removes a condition when
 *    that user-chosen duration runs out (or the matching rest / Concentration
 *    event happens).
 *  - A combat round is about 6 seconds (L863), so 1 minute = 60 / 6 = 10 rounds
 *    and 1 hour = 600 rounds. (The PHB gives the 6-second round; the 10-round
 *    minute is arithmetic on it, not a quoted sentence.)
 *  - Short Rest (L21475-21490) and Long Rest (L21240-21262): a rest ends the
 *    durations that say "until a Short/Long Rest". A completed Long Rest also
 *    confers what a Short Rest does for this purpose (user-directed rule: a
 *    Long Rest ends both rest-based kinds; a Short Rest never ends "until Long
 *    Rest"). Interrupted / rejected rests end nothing.
 *  - Concentration (L20767-20777): a "while concentrating" duration ends when
 *    Concentration ends, whatever the reason.
 *
 * AUTOMATIC EXPIRY HAPPENS ONLY WHEN: the initiative tracker advances a round
 * (round / minute / hour durations), a rest completes (rest durations), or
 * Concentration ends (concentration durations). Manual and duration-less
 * conditions are never touched. With no running tracker nothing ticks.
 */

export type GoldenDurationKind =
  | 'rounds'
  | 'minutes'
  | 'hours'
  | 'short-rest'
  | 'long-rest'
  | 'concentration'
  | 'manual';

export interface GoldenConditionSpec {
  id: string;
  /** Absent = a plain condition with no structured duration (legacy / manual). */
  duration?: { kind: GoldenDurationKind; amount?: number };
  /** Legacy free-text note on how it ends. */
  ends?: string;
}

export type GoldenEvent =
  | { type: 'manual-tick'; id: string }
  | { type: 'round'; rounds: number }
  | { type: 'rest'; rest: 'short' | 'long' }
  | { type: 'end-concentration' };

export interface GoldenRemaining {
  id: string;
  /** Remaining rounds of a timed duration; absent for any other kind. */
  rounds?: number;
  /** Duration kind kept on the condition ('none' = no structured duration). */
  kind: GoldenDurationKind | 'none';
}

export interface GoldenStep {
  event: GoldenEvent;
  /** Exactly the conditions left after the event, in their original order. */
  remaining: GoldenRemaining[];
  /** Ids of every condition that has expired so far, in order (event-log rows). */
  expiredSoFar: string[];
}

export interface DurationScenario {
  name: string;
  /** Is the initiative tracker running (character.combat.inCombat)? */
  tracker: boolean;
  /** Is the character concentrating? */
  concentrating: boolean;
  conditions: GoldenConditionSpec[];
  steps: GoldenStep[];
}

const r = (id: string, rounds: number, kind: 'rounds' | 'minutes' | 'hours' = 'rounds'): GoldenRemaining => ({
  id,
  rounds,
  kind,
});
const k = (id: string, kind: GoldenRemaining['kind']): GoldenRemaining => ({ id, kind });

export const DURATION_SCENARIOS: DurationScenario[] = [
  // â”€â”€ Manual tick-down â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    name: 'manual tick: 3 rounds counts down 3 -> 2 -> 1 -> expires at 0',
    tracker: false,
    concentrating: false,
    conditions: [{ id: 'poisoned', duration: { kind: 'rounds', amount: 3 } }],
    steps: [
      { event: { type: 'manual-tick', id: 'poisoned' }, remaining: [r('poisoned', 2)], expiredSoFar: [] },
      { event: { type: 'manual-tick', id: 'poisoned' }, remaining: [r('poisoned', 1)], expiredSoFar: [] },
      { event: { type: 'manual-tick', id: 'poisoned' }, remaining: [], expiredSoFar: ['poisoned'] },
    ],
  },
  {
    name: 'manual tick works without a running tracker and ignores a manual-kind condition',
    tracker: false,
    concentrating: false,
    conditions: [
      { id: 'blinded', duration: { kind: 'manual' } },
      { id: 'charmed', duration: { kind: 'rounds', amount: 1 } },
    ],
    steps: [
      { event: { type: 'manual-tick', id: 'blinded' }, remaining: [k('blinded', 'manual'), r('charmed', 1)], expiredSoFar: [] },
      { event: { type: 'manual-tick', id: 'charmed' }, remaining: [k('blinded', 'manual')], expiredSoFar: ['charmed'] },
    ],
  },
  {
    name: 'manual tick on a legacy free-text condition changes nothing',
    tracker: false,
    concentrating: false,
    conditions: [{ id: 'frightened', ends: 'save ends' }],
    steps: [{ event: { type: 'manual-tick', id: 'frightened' }, remaining: [k('frightened', 'none')], expiredSoFar: [] }],
  },
  {
    name: 'manual tick on a rest-based duration changes nothing',
    tracker: false,
    concentrating: false,
    conditions: [{ id: 'unconscious', duration: { kind: 'short-rest' } }],
    steps: [{ event: { type: 'manual-tick', id: 'unconscious' }, remaining: [k('unconscious', 'short-rest')], expiredSoFar: [] }],
  },
  {
    name: 'manual tick on an unknown id changes nothing',
    tracker: false,
    concentrating: false,
    conditions: [{ id: 'poisoned', duration: { kind: 'rounds', amount: 2 } }],
    steps: [{ event: { type: 'manual-tick', id: 'blinded' }, remaining: [r('poisoned', 2)], expiredSoFar: [] }],
  },

  // â”€â”€ Round advance (tracker running) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    name: 'round advance ticks every timed condition once and leaves manual / legacy / rest ones alone',
    tracker: true,
    concentrating: false,
    conditions: [
      { id: 'poisoned', duration: { kind: 'rounds', amount: 3 } },
      { id: 'blinded', duration: { kind: 'manual' } },
      { id: 'charmed', ends: 'until the caster dies' },
      { id: 'deafened', duration: { kind: 'rounds', amount: 1 } },
      { id: 'restrained', duration: { kind: 'long-rest' } },
      { id: 'prone' },
    ],
    steps: [
      {
        event: { type: 'round', rounds: 1 },
        remaining: [
          r('poisoned', 2),
          k('blinded', 'manual'),
          k('charmed', 'none'),
          k('restrained', 'long-rest'),
          k('prone', 'none'),
        ],
        expiredSoFar: ['deafened'],
      },
      {
        event: { type: 'round', rounds: 1 },
        remaining: [r('poisoned', 1), k('blinded', 'manual'), k('charmed', 'none'), k('restrained', 'long-rest'), k('prone', 'none')],
        expiredSoFar: ['deafened'],
      },
      {
        event: { type: 'round', rounds: 1 },
        remaining: [k('blinded', 'manual'), k('charmed', 'none'), k('restrained', 'long-rest'), k('prone', 'none')],
        expiredSoFar: ['deafened', 'poisoned'],
      },
    ],
  },
  {
    name: 'a multi-round advance ticks by that many rounds and cannot go below zero',
    tracker: true,
    concentrating: false,
    conditions: [
      { id: 'poisoned', duration: { kind: 'rounds', amount: 5 } },
      { id: 'blinded', duration: { kind: 'rounds', amount: 2 } },
    ],
    steps: [
      { event: { type: 'round', rounds: 3 }, remaining: [r('poisoned', 2)], expiredSoFar: ['blinded'] },
      { event: { type: 'round', rounds: 9 }, remaining: [], expiredSoFar: ['blinded', 'poisoned'] },
    ],
  },
  {
    name: 'a zero-round advance changes nothing',
    tracker: true,
    concentrating: false,
    conditions: [{ id: 'poisoned', duration: { kind: 'rounds', amount: 2 } }],
    steps: [{ event: { type: 'round', rounds: 0 }, remaining: [r('poisoned', 2)], expiredSoFar: [] }],
  },

  // â”€â”€ Minutes / hours converted at 10 rounds per minute â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    name: '1 minute is 10 rounds: ten single-round advances expire it, nine do not',
    tracker: true,
    concentrating: false,
    conditions: [{ id: 'frightened', duration: { kind: 'minutes', amount: 1 } }],
    steps: [
      { event: { type: 'round', rounds: 1 }, remaining: [r('frightened', 9, 'minutes')], expiredSoFar: [] },
      { event: { type: 'round', rounds: 8 }, remaining: [r('frightened', 1, 'minutes')], expiredSoFar: [] },
      { event: { type: 'round', rounds: 1 }, remaining: [], expiredSoFar: ['frightened'] },
    ],
  },
  {
    name: '2 minutes is 20 rounds',
    tracker: true,
    concentrating: false,
    conditions: [{ id: 'frightened', duration: { kind: 'minutes', amount: 2 } }],
    steps: [
      { event: { type: 'round', rounds: 19 }, remaining: [r('frightened', 1, 'minutes')], expiredSoFar: [] },
      { event: { type: 'round', rounds: 1 }, remaining: [], expiredSoFar: ['frightened'] },
    ],
  },
  {
    name: '1 hour is 600 rounds',
    tracker: true,
    concentrating: false,
    conditions: [{ id: 'charmed', duration: { kind: 'hours', amount: 1 } }],
    steps: [
      { event: { type: 'round', rounds: 599 }, remaining: [r('charmed', 1, 'hours')], expiredSoFar: [] },
      { event: { type: 'round', rounds: 1 }, remaining: [], expiredSoFar: ['charmed'] },
    ],
  },
  {
    name: 'manual tick on a minutes duration removes one round (10 -> 9)',
    tracker: false,
    concentrating: false,
    conditions: [{ id: 'frightened', duration: { kind: 'minutes', amount: 1 } }],
    steps: [{ event: { type: 'manual-tick', id: 'frightened' }, remaining: [r('frightened', 9, 'minutes')], expiredSoFar: [] }],
  },

  // â”€â”€ No running tracker: nothing ticks automatically â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    name: 'no running tracker: a round advance ticks nothing',
    tracker: false,
    concentrating: false,
    conditions: [
      { id: 'poisoned', duration: { kind: 'rounds', amount: 1 } },
      { id: 'frightened', duration: { kind: 'minutes', amount: 1 } },
    ],
    steps: [
      { event: { type: 'round', rounds: 1 }, remaining: [r('poisoned', 1), r('frightened', 10, 'minutes')], expiredSoFar: [] },
      { event: { type: 'round', rounds: 50 }, remaining: [r('poisoned', 1), r('frightened', 10, 'minutes')], expiredSoFar: [] },
    ],
  },

  // â”€â”€ Rests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    name: 'Short Rest ends "until a Short Rest" only; Long Rest and timed ones remain',
    tracker: false,
    concentrating: false,
    conditions: [
      { id: 'unconscious', duration: { kind: 'short-rest' } },
      { id: 'restrained', duration: { kind: 'long-rest' } },
      { id: 'poisoned', duration: { kind: 'rounds', amount: 4 } },
      { id: 'blinded', duration: { kind: 'manual' } },
      { id: 'prone' },
    ],
    steps: [
      {
        event: { type: 'rest', rest: 'short' },
        remaining: [k('restrained', 'long-rest'), r('poisoned', 4), k('blinded', 'manual'), k('prone', 'none')],
        expiredSoFar: ['unconscious'],
      },
    ],
  },
  {
    name: 'Long Rest ends both "until a Short Rest" and "until a Long Rest"',
    tracker: false,
    concentrating: false,
    conditions: [
      { id: 'unconscious', duration: { kind: 'short-rest' } },
      { id: 'restrained', duration: { kind: 'long-rest' } },
      { id: 'poisoned', duration: { kind: 'rounds', amount: 4 } },
      { id: 'blinded', duration: { kind: 'manual' } },
      { id: 'prone' },
    ],
    steps: [
      {
        event: { type: 'rest', rest: 'long' },
        remaining: [r('poisoned', 4), k('blinded', 'manual'), k('prone', 'none')],
        expiredSoFar: ['unconscious', 'restrained'],
      },
    ],
  },
  {
    name: 'Short Rest then Long Rest: the Long Rest condition survives the first, not the second',
    tracker: false,
    concentrating: false,
    conditions: [{ id: 'restrained', duration: { kind: 'long-rest' } }],
    steps: [
      { event: { type: 'rest', rest: 'short' }, remaining: [k('restrained', 'long-rest')], expiredSoFar: [] },
      { event: { type: 'rest', rest: 'long' }, remaining: [], expiredSoFar: ['restrained'] },
    ],
  },
  {
    name: 'a rest does not need a running tracker and does not tick round-based durations',
    tracker: true,
    concentrating: false,
    conditions: [{ id: 'poisoned', duration: { kind: 'rounds', amount: 1 } }],
    steps: [
      { event: { type: 'rest', rest: 'short' }, remaining: [r('poisoned', 1)], expiredSoFar: [] },
      { event: { type: 'rest', rest: 'long' }, remaining: [r('poisoned', 1)], expiredSoFar: [] },
    ],
  },

  // â”€â”€ Concentration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    name: 'ending Concentration expires only the concentration-linked conditions',
    tracker: true,
    concentrating: true,
    conditions: [
      { id: 'charmed', duration: { kind: 'concentration' } },
      { id: 'poisoned', duration: { kind: 'rounds', amount: 5 } },
      { id: 'blinded', duration: { kind: 'manual' } },
      { id: 'frightened', ends: 'save ends' },
      { id: 'restrained', duration: { kind: 'long-rest' } },
    ],
    steps: [
      {
        event: { type: 'end-concentration' },
        remaining: [r('poisoned', 5), k('blinded', 'manual'), k('frightened', 'none'), k('restrained', 'long-rest')],
        expiredSoFar: ['charmed'],
      },
    ],
  },
  {
    name: 'a concentration-linked condition is not ticked by rounds or rests',
    tracker: true,
    concentrating: true,
    conditions: [{ id: 'charmed', duration: { kind: 'concentration' } }],
    steps: [
      { event: { type: 'round', rounds: 20 }, remaining: [k('charmed', 'concentration')], expiredSoFar: [] },
      { event: { type: 'rest', rest: 'short' }, remaining: [k('charmed', 'concentration')], expiredSoFar: [] },
      { event: { type: 'manual-tick', id: 'charmed' }, remaining: [k('charmed', 'concentration')], expiredSoFar: [] },
      { event: { type: 'end-concentration' }, remaining: [], expiredSoFar: ['charmed'] },
    ],
  },

  // â”€â”€ Mixed / legacy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    name: 'mixed: rounds, minutes, rests, concentration and legacy through a whole fight',
    tracker: true,
    concentrating: true,
    conditions: [
      { id: 'poisoned', duration: { kind: 'rounds', amount: 2 } },
      { id: 'frightened', duration: { kind: 'minutes', amount: 1 } },
      { id: 'charmed', duration: { kind: 'concentration' } },
      { id: 'unconscious', duration: { kind: 'short-rest' } },
      { id: 'restrained', duration: { kind: 'long-rest' } },
      { id: 'blinded', ends: 'until dispelled' },
    ],
    steps: [
      {
        event: { type: 'round', rounds: 2 },
        remaining: [
          r('frightened', 8, 'minutes'),
          k('charmed', 'concentration'),
          k('unconscious', 'short-rest'),
          k('restrained', 'long-rest'),
          k('blinded', 'none'),
        ],
        expiredSoFar: ['poisoned'],
      },
      {
        event: { type: 'end-concentration' },
        remaining: [r('frightened', 8, 'minutes'), k('unconscious', 'short-rest'), k('restrained', 'long-rest'), k('blinded', 'none')],
        expiredSoFar: ['poisoned', 'charmed'],
      },
      {
        event: { type: 'rest', rest: 'short' },
        remaining: [r('frightened', 8, 'minutes'), k('restrained', 'long-rest'), k('blinded', 'none')],
        expiredSoFar: ['poisoned', 'charmed', 'unconscious'],
      },
      {
        event: { type: 'rest', rest: 'long' },
        remaining: [r('frightened', 8, 'minutes'), k('blinded', 'none')],
        expiredSoFar: ['poisoned', 'charmed', 'unconscious', 'restrained'],
      },
    ],
  },
  {
    name: 'legacy free-text-only conditions are never touched by any event',
    tracker: true,
    concentrating: true,
    conditions: [
      { id: 'poisoned', ends: '1 minute' },
      { id: 'blinded' },
    ],
    steps: [
      { event: { type: 'round', rounds: 100 }, remaining: [k('poisoned', 'none'), k('blinded', 'none')], expiredSoFar: [] },
      { event: { type: 'rest', rest: 'long' }, remaining: [k('poisoned', 'none'), k('blinded', 'none')], expiredSoFar: [] },
      { event: { type: 'end-concentration' }, remaining: [k('poisoned', 'none'), k('blinded', 'none')], expiredSoFar: [] },
      { event: { type: 'manual-tick', id: 'poisoned' }, remaining: [k('poisoned', 'none'), k('blinded', 'none')], expiredSoFar: [] },
    ],
  },
];

// â”€â”€ Import / share sanitising â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SanitizeRow {
  name: string;
  /** Untrusted `conditions` array as it would arrive in an import / share. */
  input: unknown;
  /** Is the (imported) character concentrating? */
  concentrating: boolean;
  /** Expected sanitised array. */
  expected: unknown[];
}

export const SANITIZE_ROWS: SanitizeRow[] = [
  {
    name: 'legacy entries with only id / note / ends pass through unchanged',
    concentrating: false,
    input: [{ id: 'poisoned', ends: 'save ends', note: 'spider' }, { id: 'blinded' }],
    expected: [{ id: 'poisoned', ends: 'save ends', note: 'spider' }, { id: 'blinded' }],
  },
  {
    name: 'valid timed, rest, manual durations are kept',
    concentrating: false,
    input: [
      { id: 'poisoned', duration: { kind: 'rounds', rounds: 5 } },
      { id: 'frightened', duration: { kind: 'minutes', rounds: 10 } },
      { id: 'charmed', duration: { kind: 'hours', rounds: 600 } },
      { id: 'unconscious', duration: { kind: 'short-rest' } },
      { id: 'restrained', duration: { kind: 'long-rest' } },
      { id: 'blinded', duration: { kind: 'manual' } },
    ],
    expected: [
      { id: 'poisoned', duration: { kind: 'rounds', rounds: 5 } },
      { id: 'frightened', duration: { kind: 'minutes', rounds: 10 } },
      { id: 'charmed', duration: { kind: 'hours', rounds: 600 } },
      { id: 'unconscious', duration: { kind: 'short-rest' } },
      { id: 'restrained', duration: { kind: 'long-rest' } },
      { id: 'blinded', duration: { kind: 'manual' } },
    ],
  },
  {
    name: 'a negative, zero, fractional, NaN-like or huge round count drops the duration but keeps the condition',
    concentrating: false,
    input: [
      { id: 'poisoned', ends: 'a', duration: { kind: 'rounds', rounds: -3 } },
      { id: 'blinded', ends: 'b', duration: { kind: 'rounds', rounds: 0 } },
      { id: 'charmed', ends: 'c', duration: { kind: 'minutes', rounds: 2.5 } },
      { id: 'deafened', ends: 'd', duration: { kind: 'hours', rounds: 1e12 } },
      { id: 'frightened', ends: 'e', duration: { kind: 'rounds', rounds: '5' } },
      { id: 'prone', ends: 'f', duration: { kind: 'rounds', rounds: null } },
    ],
    expected: [
      { id: 'poisoned', ends: 'a' },
      { id: 'blinded', ends: 'b' },
      { id: 'charmed', ends: 'c' },
      { id: 'deafened', ends: 'd' },
      { id: 'frightened', ends: 'e' },
      { id: 'prone', ends: 'f' },
    ],
  },
  {
    name: 'the maximum allowed count (30 days = 432000 rounds) is kept, one more is dropped',
    concentrating: false,
    input: [
      { id: 'poisoned', duration: { kind: 'hours', rounds: 432000 } },
      { id: 'blinded', duration: { kind: 'hours', rounds: 432001 } },
    ],
    expected: [{ id: 'poisoned', duration: { kind: 'hours', rounds: 432000 } }, { id: 'blinded' }],
  },
  {
    name: 'bad shapes drop the duration: unknown kind, missing rounds, string, array, null, number',
    concentrating: true,
    input: [
      { id: 'poisoned', duration: { kind: 'forever', rounds: 5 } },
      { id: 'blinded', duration: { kind: 'rounds' } },
      { id: 'charmed', duration: 'rounds' },
      { id: 'deafened', duration: [1, 2] },
      { id: 'frightened', duration: null },
      { id: 'prone', duration: 7 },
      { id: 'restrained', duration: {} },
    ],
    expected: [
      { id: 'poisoned' },
      { id: 'blinded' },
      { id: 'charmed' },
      { id: 'deafened' },
      { id: 'frightened' },
      { id: 'prone' },
      { id: 'restrained' },
    ],
  },
  {
    name: 'extra properties on a duration are stripped; rest / manual kinds carry no rounds',
    concentrating: false,
    input: [
      { id: 'poisoned', duration: { kind: 'rounds', rounds: 4, evil: '<script>', __proto__: { x: 1 } } },
      { id: 'blinded', duration: { kind: 'short-rest', rounds: 99 } },
    ],
    expected: [
      { id: 'poisoned', duration: { kind: 'rounds', rounds: 4 } },
      { id: 'blinded', duration: { kind: 'short-rest' } },
    ],
  },
  {
    name: 'a concentration link survives only while the character is concentrating',
    concentrating: true,
    input: [{ id: 'charmed', duration: { kind: 'concentration' } }],
    expected: [{ id: 'charmed', duration: { kind: 'concentration' } }],
  },
  {
    name: 'a concentration link is dropped when the character is not concentrating',
    concentrating: false,
    input: [{ id: 'charmed', ends: 'x', duration: { kind: 'concentration' } }],
    expected: [{ id: 'charmed', ends: 'x' }],
  },
  {
    name: 'non-array input becomes an empty array; non-object entries are left for existing handling',
    concentrating: false,
    input: 'nope',
    expected: [],
  },
];
