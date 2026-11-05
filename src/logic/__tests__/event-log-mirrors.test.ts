/**
 * Focused tests for the Stage B7 roll mirror: it appends exactly one `roll`
 * event whose summary matches the roll-log, and never mutates the input.
 */
import { describe, it, expect } from 'vitest';
import type { Character, RollEventPayload } from '../../types/character';
import { mirrorRoll } from '../event-log-mirrors';

function blankChar(): Character {
  return {
    _v: 1,
    id: 'c1',
    name: 'Tester',
    level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('mirrorRoll', () => {
  it('appends exactly one roll event with the roll-log summary', () => {
    const payload: RollEventPayload = {
      name: 'Stealth',
      total: 15,
      natural: 12,
      mode: 'normal',
      dc: 15,
      isCrit: false,
      isFumble: false,
      passed: true,
    };
    const after = mirrorRoll(blankChar(), payload);
    expect(after.eventLog).toHaveLength(1);
    const event = after.eventLog![0];
    expect(event.category).toBe('roll');
    expect(event.type).toBe('roll.generic');
    expect(event.summary).toBe('Stealth: 15 vs DC 15 — hit');
    expect(event.payload).toEqual(payload as unknown as Record<string, unknown>);
  });

  it('does not mutate the input character', () => {
    const before = blankChar();
    const payload: RollEventPayload = {
      name: 'Initiative',
      total: 20,
      natural: 17,
      mode: 'advantage',
      isCrit: false,
      isFumble: false,
    };
    mirrorRoll(before, payload);
    expect(before.eventLog).toBeUndefined();
  });

  it('flags a natural 20 as a crit in the summary', () => {
    const payload: RollEventPayload = {
      name: 'Wild Magic d20',
      total: 20,
      natural: 20,
      mode: 'normal',
      isCrit: true,
      isFumble: false,
    };
    const after = mirrorRoll(blankChar(), payload);
    expect(after.eventLog![0].summary).toBe('Wild Magic d20: 20 — crit!');
  });
});
