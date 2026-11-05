/**
 * Event-log mirror helpers (Stage B7).
 *
 * A mirror maps a just-resolved authoritative result to an `appendEvent` call on
 * the unified event log. Mirrors are DISPLAY / AUDIT ONLY: they run AFTER the
 * authoritative write, are pure (return a NEW character, never mutate), and
 * NEVER read the log back to reconstruct mechanics. Summary construction is
 * wrapped so a formatting failure degrades to a generic summary rather than
 * throwing into the source path (a mirror must never break the real write).
 *
 * Ported from PWACharSheet's event-log-mirrors pattern. Only the roll mirror is
 * wired this stage — DND's HP/rest/level-up call sites surface their own Toast
 * and do not have a cheap payload that maps cleanly, so those mirrors are
 * intentionally omitted (the task explicitly allows this).
 */
import type { Character, RollEventPayload } from '../types/character';
import { appendEvent } from './event-log';
import { rollSummary } from './roll-log';

/**
 * Mirror a resolved d20 roll into the event log as a `category: 'roll'` event.
 *
 * Builds the summary via {@link rollSummary} so the log entry and the roll
 * dialog's summary line cannot disagree. Pure: returns a NEW character with the
 * roll event appended; never reads the log back.
 */
export function mirrorRoll(character: Character, payload: RollEventPayload): Character {
  let summary: string;
  try {
    summary = rollSummary({
      label: payload.name,
      natural: payload.natural,
      total: payload.total,
      mode: payload.mode,
      dc: payload.dc,
    }).summary;
  } catch {
    // Fallback: never let a summary-formatting error break the roll write.
    summary = `${payload.name}: ${payload.total}`;
  }

  return appendEvent(character, {
    category: 'roll',
    type: 'roll.generic',
    summary,
    payload: payload as unknown as Record<string, unknown>,
  });
}
