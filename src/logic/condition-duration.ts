/**
 * Structured condition durations (Stage E).
 *
 * BOOKKEEPING ONLY. The PHB defines no generic duration for a condition: "A
 * condition lasts either for a duration specified by the effect that imposed
 * the condition or until the condition is countered" (Docs/PlayersHandbook.md
 * "Conditions: Duration", L1210-1212). So the user chooses a duration for a
 * condition and this module only ever removes that condition when THAT duration
 * runs out. It never adds a condition, never changes what a condition does, and
 * never touches an Exhaustion level (a level, not a timed condition) or a
 * condition that has no structured duration (legacy free-text `ends`, or
 * `manual`).
 *
 * DURATION KINDS and where each one ticks / expires:
 *  - rounds / minutes / hours (TIMED): `rounds` holds the REMAINING combat
 *    rounds. It goes down by 1 per manual tick (Combat tab), and by 1 each time
 *    the Combat page's Next round starts a new round (advanceRounds). When it reaches 0 the condition is removed.
 *    Conversion: "A round represents about 6 seconds in the game world"
 *    (PHB "The Order of Combat", L863), so 1 minute = 60 / 6 = 10 rounds and
 *    1 hour = 600 rounds. INTERPRETATION: the PHB states the 6-second round,
 *    not a "10 rounds = 1 minute" sentence; the 10 is that arithmetic.
 *  - short-rest: expires when a Short Rest completes ("Short Rest", L21475-21490).
 *  - long-rest: expires when a Long Rest completes ("Long Rest", L21240-21262).
 *    A completed Long Rest ends BOTH rest kinds (user-directed: the PHB does not
 *    say a Long Rest "also finishes" a Short Rest for duration purposes, but a
 *    character that has had the longer rest is rested at least as much).
 *    Interrupted or rejected rests end nothing (rests.ts only calls this on
 *    completed rests).
 *  - concentration: linked to the Concentration state; expires whenever
 *    Concentration ends for any reason ("Concentration", L20767-20777),
 *    including starting a different Concentration spell. It can only be set
 *    while concentrating.
 *  - manual: the old free-text behaviour; never expires by itself.
 *
 * AUTOMATIC TICKING happens ONLY while a fight is on (`character.combat.inCombat`),
 * when the Combat page's Next round button moves to the next round
 * (logic/combat-round.ts `nextRound`, which calls `advanceRounds`). Without a fight
 * on, nothing ticks automatically; the manual tick still works.
 *
 * Every function is pure and returns the input object when nothing changes.
 * Expiry removes the condition and appends a 'condition-expired' event-log
 * entry (category 'combat').
 */
import type { ActiveCondition, Character, ConditionDuration, ConditionDurationKind } from '../types/character';
import { getCondition } from '../data/conditions';
import type { Breakdown, BreakdownComponent } from './breakdown';
import { appendEvent } from './event-log';

/** PHB L863: a round is about 6 seconds, so 60 / 6 rounds in a minute. */
export const ROUNDS_PER_MINUTE = 10;
/** 60 minutes x 10 rounds. */
export const ROUNDS_PER_HOUR = 60 * ROUNDS_PER_MINUTE;
/**
 * Sanity bound for imported / typed durations: 30 days of rounds. An app limit
 * to keep untrusted numbers sane, not a rules value.
 */
export const MAX_DURATION_ROUNDS = 30 * 24 * ROUNDS_PER_HOUR;

const TIMED_KINDS: readonly ConditionDurationKind[] = ['rounds', 'minutes', 'hours'];
const ALL_KINDS: readonly ConditionDurationKind[] = [
  ...TIMED_KINDS,
  'short-rest',
  'long-rest',
  'concentration',
  'manual',
];

type TrackedId = ActiveCondition['id'];

export function isTimedKind(kind: ConditionDurationKind): boolean {
  return TIMED_KINDS.includes(kind);
}

/** True for a timed duration (rounds / minutes / hours) with a valid remaining count. */
export function isTimed(duration: ConditionDuration | undefined): duration is ConditionDuration & { rounds: number } {
  return duration !== undefined && isTimedKind(duration.kind) && isValidRounds(duration.rounds);
}

function isValidRounds(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_DURATION_ROUNDS;
}

/** Remaining rounds of a timed duration, or undefined for any other kind. */
export function remainingRounds(duration: ConditionDuration | undefined): number | undefined {
  return isTimed(duration) ? duration.rounds : undefined;
}

/**
 * Build a duration from a user-facing amount in the kind's own unit. Timed
 * kinds need a whole amount >= 1 (converted to rounds); other kinds ignore the
 * amount. Returns undefined for invalid input or a value over the sanity bound.
 */
export function durationFromAmount(kind: ConditionDurationKind, amount?: number): ConditionDuration | undefined {
  if (!ALL_KINDS.includes(kind)) return undefined;
  if (!isTimedKind(kind)) return { kind };
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1) return undefined;
  const factor = kind === 'rounds' ? 1 : kind === 'minutes' ? ROUNDS_PER_MINUTE : ROUNDS_PER_HOUR;
  const rounds = amount * factor;
  return isValidRounds(rounds) ? { kind, rounds } : undefined;
}

function conditionName(id: string): string {
  return getCondition(id as TrackedId)?.name ?? id;
}

// ── Display ────────────────────────────────────────────────────────────────

/** The label of a duration kind (the unit name for the timed kinds). */
export function durationKindLabel(kind: ConditionDurationKind): string {
  switch (kind) {
    case 'rounds':
      return 'Rounds';
    case 'minutes':
      return 'Minutes';
    case 'hours':
      return 'Hours';
    case 'short-rest':
      return 'Until a Short Rest';
    case 'long-rest':
      return 'Until a Long Rest';
    case 'concentration':
      return 'While concentrating';
    case 'manual':
      return 'Manual (no timer)';
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Human text for the remaining time, e.g. "1 min 3 rounds left" or "Until a Long Rest". */
export function describeDuration(duration: ConditionDuration | undefined): string | null {
  if (!duration) return null;
  if (!isTimed(duration)) return durationKindLabel(duration.kind);
  const r = duration.rounds;
  if (duration.kind === 'rounds') return `${plural(r, 'round', 'rounds')} left`;
  const hours = Math.floor(r / ROUNDS_PER_HOUR);
  const minutes = Math.floor((r % ROUNDS_PER_HOUR) / ROUNDS_PER_MINUTE);
  const rounds = r % ROUNDS_PER_MINUTE;
  const parts: string[] = [];
  if (hours > 0) parts.push(plural(hours, 'hr', 'hr'));
  if (minutes > 0) parts.push(plural(minutes, 'min', 'min'));
  if (rounds > 0 || parts.length === 0) parts.push(plural(rounds, 'round', 'rounds'));
  return `${parts.join(' ')} left`;
}

/**
 * Breakdown of the remaining rounds for the tooltip (components sum to the
 * total, zero parts included). Null when the duration is not timed.
 */
export function durationBreakdown(duration: ConditionDuration | undefined): Breakdown | null {
  if (!isTimed(duration)) return null;
  const r = duration.rounds;
  if (duration.kind === 'rounds') {
    return { total: r, components: [{ label: 'Rounds remaining', value: r }] };
  }
  const components: BreakdownComponent[] = [];
  let rest = r;
  if (duration.kind === 'hours') {
    const hours = Math.floor(rest / ROUNDS_PER_HOUR);
    components.push({ label: `${hours} hr x ${ROUNDS_PER_HOUR} rounds`, value: hours * ROUNDS_PER_HOUR });
    rest -= hours * ROUNDS_PER_HOUR;
  }
  const minutes = Math.floor(rest / ROUNDS_PER_MINUTE);
  components.push({
    label: `${minutes} min x ${ROUNDS_PER_MINUTE} rounds (a round is about 6 seconds)`,
    value: minutes * ROUNDS_PER_MINUTE,
  });
  components.push({ label: 'Extra rounds', value: rest - minutes * ROUNDS_PER_MINUTE });
  return { total: r, components };
}

// ── Setting a duration ─────────────────────────────────────────────────────

function withConditions(character: Character, conditions: ActiveCondition[]): Character {
  if (conditions.length === 0) {
    const { conditions: _removed, ...rest } = character;
    void _removed;
    return rest;
  }
  return { ...character, conditions };
}

/**
 * Set (or clear with undefined) the structured duration on an active condition.
 * An invalid duration, an unknown id, or a concentration link while the
 * character is not concentrating changes nothing.
 */
export function setConditionDuration(
  character: Character,
  id: TrackedId,
  duration: ConditionDuration | undefined,
): Character {
  const list = character.conditions ?? [];
  if (!list.some((c) => c.id === id)) return character;
  if (duration !== undefined) {
    const clean = sanitizeDuration(duration, character.concentration !== undefined);
    if (!clean) return character;
    duration = clean;
  }
  return {
    ...character,
    conditions: list.map((c) => {
      if (c.id !== id) return c;
      const next: ActiveCondition = { ...c };
      if (duration) next.duration = duration;
      else delete next.duration;
      return next;
    }),
  };
}

// ── Expiry ─────────────────────────────────────────────────────────────────

interface ExpiryResult {
  character: Character;
  expired: TrackedId[];
}

function expireWhere(
  character: Character,
  shouldExpire: (c: ActiveCondition) => boolean,
  reason: string,
  reasonCode: string,
): ExpiryResult {
  const list = character.conditions ?? [];
  const gone = list.filter(shouldExpire);
  if (gone.length === 0) return { character, expired: [] };
  let next = withConditions(
    character,
    list.filter((c) => !gone.includes(c)),
  );
  for (const c of gone) {
    next = appendEvent(next, {
      category: 'combat',
      type: 'condition-expired',
      summary: `${conditionName(c.id)} ended: ${reason}.`,
      payload: { conditionId: c.id, reason: reasonCode },
    });
  }
  return { character: next, expired: gone.map((c) => c.id) };
}

/** Take `rounds` off every timed condition; expire those that reach 0. */
function tick(character: Character, rounds: number, only?: TrackedId): ExpiryResult {
  if (!Number.isInteger(rounds) || rounds < 1) return { character, expired: [] };
  const list = character.conditions ?? [];
  const targets = (c: ActiveCondition) => (only === undefined || c.id === only) && isTimed(c.duration);
  if (!list.some(targets)) return { character, expired: [] };
  const ticked = list.map((c) => {
    if (!targets(c)) return c;
    const left = Math.max(0, (c.duration as { rounds: number }).rounds - rounds);
    return { ...c, duration: { ...c.duration!, rounds: left } };
  });
  // Expire on 0 (a ticked duration with rounds 0 is never kept).
  return expireWhere(
    { ...character, conditions: ticked },
    (c) => isTimedKind(c.duration?.kind ?? 'manual') && c.duration?.rounds === 0,
    'its duration ran out',
    'duration',
  );
}

/** Manual tick-down: one round off one timed condition. Other kinds are unchanged. */
export function tickConditionManually(character: Character, id: TrackedId): Character {
  return tick(character, 1, id).character;
}

/**
 * Tick every timed condition by `rounds`, but ONLY while a fight is on. Manual / rest / concentration / duration-less conditions are
 * untouched.
 */
export function advanceRounds(character: Character, rounds: number): Character {
  if (character.combat?.inCombat !== true) return character;
  return tick(character, rounds).character;
}

/** Expire the rest-based durations a COMPLETED rest ends (Long ends both kinds). */
export function expireOnRest(character: Character, rest: 'short' | 'long'): Character {
  const label = rest === 'short' ? 'the Short Rest finished' : 'the Long Rest finished';
  return expireWhere(
    character,
    (c) => c.duration?.kind === 'short-rest' || (rest === 'long' && c.duration?.kind === 'long-rest'),
    label,
    rest === 'short' ? 'short-rest' : 'long-rest',
  ).character;
}

/** Expire every Concentration-linked condition (call when Concentration has ended). */
export function expireOnConcentrationEnd(character: Character): Character {
  return expireWhere(
    character,
    (c) => c.duration?.kind === 'concentration',
    'Concentration ended',
    'concentration',
  ).character;
}


// ── Untrusted input ────────────────────────────────────────────────────────

/** A clean copy of a duration, or undefined when it is not valid. */
function sanitizeDuration(value: unknown, concentrating: boolean): ConditionDuration | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const kind = raw.kind;
  if (typeof kind !== 'string' || !ALL_KINDS.includes(kind as ConditionDurationKind)) return undefined;
  const k = kind as ConditionDurationKind;
  if (isTimedKind(k)) return isValidRounds(raw.rounds) ? { kind: k, rounds: raw.rounds } : undefined;
  if (k === 'concentration' && !concentrating) return undefined;
  return { kind: k };
}

/** True only for a well-formed concentration value (an object with a string spellId). */
export function isConcentrating(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { spellId?: unknown }).spellId === 'string'
  );
}

/**
 * Sanitise the `conditions` array of an imported / shared character: only the
 * `duration` of each object entry is validated (bad shapes, unknown kinds,
 * non-integer / <= 0 / over-bound round counts, and a Concentration link on a
 * character that is not concentrating are dropped). Everything else on an entry
 * is left exactly as it was, so legacy saves load unchanged. Non-array input
 * becomes [].
 */
export function sanitizeConditionDurations(value: unknown, concentrating: boolean): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    const source = entry as Record<string, unknown>;
    if (!('duration' in source)) return entry;
    const { duration, ...rest } = source;
    const clean = sanitizeDuration(duration, concentrating);
    return clean ? { ...rest, duration: clean } : rest;
  });
}
