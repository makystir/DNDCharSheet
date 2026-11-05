/**
 * Golden-table harness for Stage B7: the roll-log summary + payload, the unified
 * event log (rotate / filter), and the undo stack.
 *
 * Maps EVERY row of the golden table (dice-log-golden.ts — authored by the
 * orchestrator from the PHB 2024 d20 Test rules + the WFRP event-log/undo
 * contracts, NEVER edited here) onto the real logic and asserts each expected
 * field. The golden file is pure data with no imports; this harness is the only
 * place it is wired to the code.
 *
 * Plus structural tests for behaviour the golden does not enumerate: appendEvent
 * adds one at the tail with an id+timestamp and never mutates the input;
 * clearEventLog empties only the event log; normaliseEventLog maps absent/
 * malformed input to [].
 */
import { describe, it, expect } from 'vitest';
import type { Character, LogCategory, LogEvent } from '../../types/character';
import { rollSummary, toRollPayload } from '../roll-log';
import {
  appendEvent,
  clearEventLog,
  filterByCategory,
  normaliseEventLog,
  rotate,
} from '../event-log';
import { createUndoStack } from '../undo';
import {
  FILTER_CASES,
  ROLL_SUMMARY_CASES,
  ROTATE_CASES,
  UNDO_CASES,
} from './dice-log-golden';

/** Build a synthetic LogEvent carrying a numeric marker in its payload. */
function makeEvent(category: string, marker: number): LogEvent {
  return {
    id: `evt-${marker}`,
    timestamp: 1_000 + marker,
    category: category as LogCategory,
    type: `${category}.test`,
    summary: `event ${marker}`,
    payload: { marker },
  };
}

/** A minimal character carrying the given event log. */
function charWithLog(events: LogEvent[]): Character {
  return {
    _v: 1,
    id: 'c1',
    name: 'Tester',
    level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    eventLog: events,
    createdAt: 0,
    updatedAt: 0,
  };
}

// ─── ROLL_SUMMARY_CASES → rollSummary + toRollPayload ────────────────────────
describe('roll-log: rollSummary (golden ROLL_SUMMARY_CASES)', () => {
  it.each(ROLL_SUMMARY_CASES)('$name', (c) => {
    const result = rollSummary({
      label: c.label,
      natural: c.natural,
      total: c.total,
      mode: c.mode,
      dc: c.dc,
    });
    expect(result.total).toBe(c.expect.total);
    expect(result.natural).toBe(c.expect.natural);
    expect(result.isCrit).toBe(c.expect.isCrit);
    expect(result.isFumble).toBe(c.expect.isFumble);
    expect(result.passed).toBe(c.expect.passed);
    expect(result.summary).toBe(c.expect.summary);
  });

  it.each(ROLL_SUMMARY_CASES)('toRollPayload: $name', (c) => {
    const payload = toRollPayload({
      label: c.label,
      natural: c.natural,
      total: c.total,
      mode: c.mode,
      dc: c.dc,
    });
    expect(payload.name).toBe(c.label);
    expect(payload.total).toBe(c.expect.total);
    expect(payload.natural).toBe(c.expect.natural);
    expect(payload.mode).toBe(c.mode);
    expect(payload.isCrit).toBe(c.expect.isCrit);
    expect(payload.isFumble).toBe(c.expect.isFumble);
    if (c.dc === undefined) {
      expect(payload.dc).toBeUndefined();
      expect(payload.passed).toBeUndefined();
    } else {
      expect(payload.dc).toBe(c.dc);
      expect(payload.passed).toBe(c.expect.passed);
    }
  });
});

// ─── ROTATE_CASES → rotate ───────────────────────────────────────────────────
describe('event-log: rotate (golden ROTATE_CASES)', () => {
  it.each(ROTATE_CASES)('$name', (c) => {
    const events: LogEvent[] = Array.from({ length: c.length }, (_unused, i) =>
      makeEvent('roll', i),
    );
    const result = rotate(events, c.cap);
    expect(result.length).toBe(c.expect.resultLength);
    if (c.expect.resultLength === 0) {
      expect(c.expect.firstKept).toBe(-1);
      expect(c.expect.lastKept).toBe(-1);
    } else {
      expect(result[0].payload.marker).toBe(c.expect.firstKept);
      expect(result[result.length - 1].payload.marker).toBe(c.expect.lastKept);
    }
    // New array, input untouched.
    expect(result).not.toBe(events);
    expect(events.length).toBe(c.length);
  });
});

// ─── FILTER_CASES → filterByCategory ─────────────────────────────────────────
describe('event-log: filterByCategory (golden FILTER_CASES)', () => {
  it.each(FILTER_CASES)('$name', (c) => {
    const events = c.eventCategories.map((cat, i) => makeEvent(cat, i));
    const selected = new Set<LogCategory>(c.selected as LogCategory[]);
    const result = filterByCategory(events, selected);
    expect(result.map((e) => e.payload.marker)).toEqual(c.expectIndices);
  });
});

// ─── UNDO_CASES → createUndoStack ────────────────────────────────────────────
describe('undo: createUndoStack (golden UNDO_CASES)', () => {
  it.each(UNDO_CASES)('$name', (c) => {
    const stack = createUndoStack<number>(c.cap);
    const undoReturns: (number | null)[] = [];
    const redoReturns: (number | null)[] = [];
    for (const op of c.ops) {
      if (op.op === 'push') {
        stack.push(op.value as number);
      } else if (op.op === 'undo') {
        undoReturns.push(stack.undo());
      } else {
        redoReturns.push(stack.redo());
      }
    }
    expect(undoReturns).toEqual(c.expect.undoReturns);
    expect(redoReturns).toEqual(c.expect.redoReturns);
    expect(stack.undoDepth()).toBe(c.expect.finalUndoDepth);
    expect(stack.redoDepth()).toBe(c.expect.finalRedoDepth);
  });
});

// ─── Structural tests (not in the golden) ────────────────────────────────────
describe('event-log: structural invariants', () => {
  it('appendEvent adds one event at the tail with an id + timestamp', () => {
    const before = charWithLog([makeEvent('roll', 0)]);
    const after = appendEvent(before, {
      category: 'roll',
      type: 'roll.generic',
      summary: 'a roll',
      payload: { x: 1 },
    });
    expect(after.eventLog).toHaveLength(2);
    const added = after.eventLog![1];
    expect(added.summary).toBe('a roll');
    expect(typeof added.id).toBe('string');
    expect(added.id.length).toBeGreaterThan(0);
    expect(typeof added.timestamp).toBe('number');
    expect(added.payload).toEqual({ x: 1 });
  });

  it('appendEvent does not mutate the input character or its log', () => {
    const existing = [makeEvent('roll', 0)];
    const before = charWithLog(existing);
    appendEvent(before, { category: 'roll', type: 'roll.generic', summary: 's' });
    expect(before.eventLog).toBe(existing);
    expect(existing).toHaveLength(1);
  });

  it('appendEvent on a character with no log starts a new log', () => {
    const before = charWithLog([]);
    delete before.eventLog;
    const after = appendEvent(before, {
      category: 'roll',
      type: 'roll.generic',
      summary: 's',
    });
    expect(after.eventLog).toHaveLength(1);
  });

  it('appendEvent defaults payload to {}', () => {
    const after = appendEvent(charWithLog([]), {
      category: 'roll',
      type: 'roll.generic',
      summary: 's',
    });
    expect(after.eventLog![0].payload).toEqual({});
  });

  it('clearEventLog empties only the event log', () => {
    const before = charWithLog([makeEvent('roll', 0), makeEvent('combat', 1)]);
    before.name = 'Keep Me';
    const after = clearEventLog(before);
    expect(after.eventLog).toEqual([]);
    expect(after.name).toBe('Keep Me');
    expect(after.abilities).toBe(before.abilities);
  });

  it('normaliseEventLog maps absent/malformed input to []', () => {
    expect(normaliseEventLog(undefined)).toEqual([]);
    // Malformed (non-array) persisted value.
    expect(normaliseEventLog('nope' as unknown as LogEvent[])).toEqual([]);
    const events = [makeEvent('roll', 0)];
    expect(normaliseEventLog(events)).toEqual(events);
  });

  it('filterByCategory with an empty set returns all (new copy)', () => {
    const events = [makeEvent('roll', 0), makeEvent('combat', 1)];
    const result = filterByCategory(events, new Set());
    expect(result).toEqual(events);
    expect(result).not.toBe(events);
  });
});
