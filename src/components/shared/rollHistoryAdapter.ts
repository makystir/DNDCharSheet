import type { D20Mode } from '../../logic/dice';
import type { LogEvent, RollEventPayload } from '../../types/character';
import { filterByCategory } from '../../logic/event-log';

/**
 * Adapter: unified event log → RollHistoryPanel display shape (Stage B7).
 *
 * Roll history lives in `character.eventLog` as `category: 'roll'` events; this
 * module maps those events into the d20 display entry the panel consumes. The
 * event log is stored oldest-first; the panel expects newest-first, so
 * `rollEventsToHistory` reverses the filtered list.
 *
 * Reshaped from the WFRP adapter's d100/SL fields to the d20 `RollEventPayload`.
 */

/** Category set used to source roll history from the unified event log. */
const ROLL_CATEGORY = new Set<LogEvent['category']>(['roll']);

/** A single roll shown in the history panel (d20-reshaped). */
export interface RollHistoryEntry {
  /** Stable id (the source event's id). */
  id: string;
  /** What was rolled. */
  name: string;
  /** The total (die + modifiers + exhaustion). */
  total: number;
  /** The raw kept d20 face. */
  natural: number;
  /** How the d20 was rolled. */
  mode: D20Mode;
  /** Optional DC/AC. */
  dc?: number;
  /** natural === 20. */
  isCrit: boolean;
  /** natural === 1. */
  isFumble: boolean;
  /** total >= dc when a dc is present. */
  passed?: boolean;
  /** When the roll was recorded (epoch ms). */
  timestamp: number;
}

/** A valid D20Mode, defaulting to 'normal' for a malformed persisted value. */
function readMode(value: unknown): D20Mode {
  return value === 'advantage' || value === 'disadvantage' ? value : 'normal';
}

/**
 * Adapt a single roll-category `LogEvent` into a display entry. Reads the payload
 * defensively (the log is untrusted persisted data), falling back to sensible
 * defaults for any missing field.
 */
export function rollEventToHistoryEntry(event: LogEvent): RollHistoryEntry {
  const p = event.payload as Partial<RollEventPayload>;
  const entry: RollHistoryEntry = {
    id: event.id,
    name: typeof p.name === 'string' ? p.name : '',
    total: typeof p.total === 'number' ? p.total : 0,
    natural: typeof p.natural === 'number' ? p.natural : 0,
    mode: readMode(p.mode),
    isCrit: Boolean(p.isCrit),
    isFumble: Boolean(p.isFumble),
    timestamp: event.timestamp,
  };
  if (typeof p.dc === 'number') {
    entry.dc = p.dc;
    entry.passed = typeof p.passed === 'boolean' ? p.passed : undefined;
  }
  return entry;
}

/**
 * Map an event log (oldest-first) to the roll-history display list
 * (newest-first). Filters to `category: 'roll'` events, adapts each, and reverses
 * so the most recent roll appears first.
 */
export function rollEventsToHistory(events: LogEvent[]): RollHistoryEntry[] {
  return filterByCategory(events, ROLL_CATEGORY).map(rollEventToHistoryEntry).reverse();
}
