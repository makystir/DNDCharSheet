/**
 * The single pure module owning the unified event log (Stage B7).
 *
 * The event log (`character.eventLog`) is a per-character, append-only stream of
 * structured `LogEvent` records. It is display/audit only and is NEVER read to
 * reconstruct mechanics (XP totals, HP, advancement, undo).
 *
 * Storage convention: events are stored oldest-first (append order); the
 * timeline reverses for display. `appendEvent` is therefore a cheap push +
 * tail-trim.
 *
 * Ported near-verbatim from PWACharSheet's src/logic/event-log.ts; the stream is
 * system-agnostic (only the category/type values are D&D).
 */
import type { Character, LogCategory, LogEvent } from '../types/character';
import { generateUUID } from './uuid';

/**
 * Maximum number of active LogEvents retained before rotation.
 *
 * Bounds localStorage/IndexedDB growth while keeping enough history to be
 * useful. Single tunable constant.
 */
export const EVENT_LOG_CAP = 200;

/** Input to {@link appendEvent}; `payload` is optional and defaults to `{}`. */
export interface AppendEventInput {
  category: LogCategory;
  type: string;
  summary: string;
  payload?: Record<string, unknown>;
}

/**
 * Enforce the cap, keeping the most-recent events. Pure.
 *
 * Events are stored oldest-first, so the most-recent are at the tail; rotation
 * drops from the front. Returns a new array (never mutates the input).
 */
export function rotate(events: LogEvent[], cap: number = EVENT_LOG_CAP): LogEvent[] {
  if (events.length <= cap) {
    return events.slice();
  }
  return events.slice(events.length - cap);
}

/**
 * Append an event to a character's event log. Returns a NEW character; never
 * mutates the input.
 *
 * Assigns a unique `id` and a `timestamp` of now, appends preserving order,
 * then applies {@link rotate} to enforce the cap.
 */
export function appendEvent(character: Character, input: AppendEventInput): Character {
  const event: LogEvent = {
    id: generateUUID(),
    timestamp: Date.now(),
    category: input.category,
    type: input.type,
    summary: input.summary,
    payload: input.payload ?? {},
  };
  const nextLog = rotate([...(character.eventLog ?? []), event]);
  return { ...character, eventLog: nextLog };
}

/**
 * Return the log rotated to the cap, defaulting non-array/undefined input to an
 * empty array. Pure — never mutates its input.
 *
 * Used on character load/import: absent or malformed persisted logs become `[]`,
 * and oversized imported logs are trimmed to the cap via {@link rotate}.
 */
export function normaliseEventLog(
  events: LogEvent[] | undefined,
  cap: number = EVENT_LOG_CAP,
): LogEvent[] {
  if (!Array.isArray(events)) {
    return [];
  }
  return rotate(events, cap);
}

/**
 * Filter events to those whose category is in the given set. Pure.
 *
 * An empty or undefined set means "no filter" and returns all events (a new
 * array copy). Otherwise returns the subset whose `category` is selected,
 * preserving order.
 */
export function filterByCategory(
  events: LogEvent[],
  categories?: Set<LogCategory>,
): LogEvent[] {
  if (!categories || categories.size === 0) {
    return events.slice();
  }
  return events.filter((event) => categories.has(event.category));
}

/**
 * Return a NEW character with an emptied event log. Only `eventLog` is cleared;
 * all other fields are left untouched (the spread carries them over). Never
 * mutates the input.
 */
export function clearEventLog(character: Character): Character {
  return { ...character, eventLog: [] };
}
