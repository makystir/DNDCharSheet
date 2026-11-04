import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, CombatState, Combatant } from '../../types/character';
import {
  activeCombatant,
  addCombatant,
  advanceTurn,
  canMoveWithinTie,
  endCombat,
  isCharacterTurn,
  moveCombatant,
  moveWithinTie,
  nextTurn,
  previousTurn,
  removeCombatant,
  sortByInitiative,
  startCombat,
} from '../initiative-order';
import { freshTurn } from '../turn-economy';
import {
  ROSTER_EDIT_CASES,
  SORT_CASES,
  TIE_MOVE_CASES,
  TURN_ADVANCE_CASES,
  type Combatant as GoldenCombatant,
  type RosterEditCase,
  type SortCase,
  type TieMoveCase,
  type TurnAdvanceCase,
} from './initiative-golden';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

const named = (list: GoldenCombatant[]): Combatant[] =>
  list.map((c) => ({ id: c.id, name: c.id.toUpperCase(), initiative: c.initiative }));
const ids = (list: { id: string }[]) => list.map((c) => c.id);

function combatOf(roster: GoldenCombatant[], activeIndex: number, round: number): CombatState {
  return { inCombat: true, round, combatants: named(roster), activeIndex, turn: freshTurn() };
}

type SortFn = (list: GoldenCombatant[]) => GoldenCombatant[];
type TieFn = (list: GoldenCombatant[], id: string, dir: 'up' | 'down') => GoldenCombatant[];
type AdvanceFn = (combat: CombatState, dir: 'next' | 'previous') => CombatState;
type AddFn = (combat: CombatState, c: Combatant) => CombatState;
type RemoveFn = (combat: CombatState, id: string) => CombatState;

function sortMismatches(fn: SortFn, row: SortCase): string[] {
  return ids(fn(row.input)).join() === row.expectIds.join() ? [] : ['order'];
}

function tieMismatches(fn: TieFn, row: TieMoveCase): string[] {
  return ids(fn(row.input, row.moveId, row.direction)).join() === row.expectIds.join() ? [] : ['order'];
}

function advanceMismatches(fn: AdvanceFn, row: TurnAdvanceCase): string[] {
  const roster = Array.from({ length: row.before.count }, (_, i) => ({ id: `c${i}`, initiative: 20 - i }));
  const got = fn(combatOf(roster, row.before.activeIndex, row.before.round), row.direction);
  const out: string[] = [];
  if (got.activeIndex !== row.after.activeIndex) out.push('activeIndex');
  if (got.round !== row.after.round) out.push('round');
  return out;
}

function rosterMismatches(add: AddFn, remove: RemoveFn, row: RosterEditCase): string[] {
  const before = combatOf(row.roster, row.activeIndex, row.round);
  const got =
    row.edit.kind === 'add'
      ? add(before, { id: row.edit.combatant.id, name: 'New', initiative: row.edit.combatant.initiative })
      : remove(before, row.edit.id);
  const out: string[] = [];
  if (ids(got.combatants).join() !== row.expect.ids.join()) out.push('ids');
  if (got.activeIndex !== row.expect.activeIndex) out.push('activeIndex');
  if (got.round !== row.expect.round) out.push('round');
  return out;
}

const realSort: SortFn = (list) => sortByInitiative(list);
const realTie: TieFn = (list, id, dir) => moveWithinTie(list, id, dir);

describe('golden: SORT_CASES', () => {
  for (const row of SORT_CASES) {
    it(`${row.name} [${row.cite}]`, () => {
      expect(sortMismatches(realSort, row)).toEqual([]);
    });
  }
});

describe('golden: TIE_MOVE_CASES', () => {
  for (const row of TIE_MOVE_CASES) {
    it(`${row.name} [${row.cite}]`, () => {
      expect(tieMismatches(realTie, row)).toEqual([]);
    });
  }
});

describe('golden: TURN_ADVANCE_CASES', () => {
  for (const row of TURN_ADVANCE_CASES) {
    it(`${row.name} [${row.cite}]`, () => {
      expect(advanceMismatches(advanceTurn, row)).toEqual([]);
    });
  }
});

describe('golden: ROSTER_EDIT_CASES', () => {
  for (const row of ROSTER_EDIT_CASES) {
    it(`${row.name}`, () => {
      expect(rosterMismatches(addCombatant, removeCombatant, row)).toEqual([]);
    });
  }
});

// ─── The harness fails closed ────────────────────────────────────────────────
const failing = <T extends { name: string }>(rows: T[], mismatches: (row: T) => string[]) =>
  rows.filter((row) => mismatches(row).length > 0).map((row) => row.name);

describe('fails closed: ordering mutants', () => {
  it('auto-breaking ties (here by Dexterity-like reverse id) is caught', () => {
    // A tiebreaker of ANY kind violates "ties are never auto-broken".
    const tieBreaking: SortFn = (list) =>
      [...list].sort((a, b) => b.initiative - a.initiative || b.id.localeCompare(a.id));
    const caught = failing(SORT_CASES, (row) => sortMismatches(tieBreaking, row));
    expect(caught).toContain('A tie keeps insertion order (players decide, so no automatic tiebreak)');
    expect(caught).toContain('All tied keeps the given order');
  });

  it('sorting ascending is caught', () => {
    const ascending: SortFn = (list) => [...list].sort((a, b) => a.initiative - b.initiative);
    expect(failing(SORT_CASES, (row) => sortMismatches(ascending, row)).length).toBeGreaterThan(0);
  });

  it('an unstable-style reversal of ties is caught', () => {
    const reversedTies: SortFn = (list) =>
      [...list].reverse().sort((a, b) => b.initiative - a.initiative);
    expect(failing(SORT_CASES, (row) => sortMismatches(reversedTies, row)).length).toBeGreaterThan(0);
  });

  it('a tie move that crosses a different Initiative is caught', () => {
    const crossing: TieFn = (list, id, dir) => {
      const i = list.findIndex((c) => c.id === id);
      const j = dir === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    };
    const caught = failing(TIE_MOVE_CASES, (row) => tieMismatches(crossing, row));
    expect(caught).toContain('Cannot move up across a different Initiative');
    expect(caught).toContain('A combatant with a unique Initiative cannot move');
  });

  it('a tie move that does nothing is caught', () => {
    const inert: TieFn = (list) => list;
    expect(failing(TIE_MOVE_CASES, (row) => tieMismatches(inert, row)).length).toBeGreaterThan(0);
  });
});

describe('fails closed: turn advance mutants', () => {
  it('not wrapping the round on the last combatant is caught', () => {
    const noRound: AdvanceFn = (c, d) => {
      const got = advanceTurn(c, d);
      return d === 'next' ? { ...got, round: c.round } : got;
    };
    expect(failing(TURN_ADVANCE_CASES, (row) => advanceMismatches(noRound, row)).length).toBeGreaterThan(0);
  });

  it('going back before round 1 is caught', () => {
    const noFloor: AdvanceFn = (c, d) => {
      if (d === 'previous' && c.activeIndex === 0 && c.round <= 1) {
        return { ...c, activeIndex: c.combatants.length - 1, round: 0 };
      }
      return advanceTurn(c, d);
    };
    expect(failing(TURN_ADVANCE_CASES, (row) => advanceMismatches(noFloor, row))).toContain(
      'Cannot go back before round 1',
    );
  });
});

describe('fails closed: roster edit mutants', () => {
  it('incrementing the round when the ACTIVE last combatant is removed is caught', () => {
    const roundBump: RemoveFn = (c, id) => {
      const got = removeCombatant(c, id);
      const removedActive = c.combatants[c.activeIndex]?.id === id;
      return removedActive && got.activeIndex === 0 && c.activeIndex > 0 ? { ...got, round: got.round + 1 } : got;
    };
    const caught = failing(ROSTER_EDIT_CASES, (row) => rosterMismatches(addCombatant, roundBump, row));
    expect(caught).toContain('Remove the ACTIVE last combatant: wraps to 0 without advancing the round');
  });

  it('an add that never shifts the active index is caught', () => {
    const noShift: AddFn = (c, n) => ({ ...addCombatant(c, n), activeIndex: c.activeIndex });
    const caught = failing(ROSTER_EDIT_CASES, (row) => rosterMismatches(noShift, removeCombatant, row));
    expect(caught).toContain('Add one that sorts BEFORE the active combatant: active index shifts');
  });

  it('a remove that never shifts the active index is caught', () => {
    const noShift: RemoveFn = (c, id) => ({ ...removeCombatant(c, id), activeIndex: c.activeIndex });
    const caught = failing(ROSTER_EDIT_CASES, (row) => rosterMismatches(addCombatant, noShift, row));
    expect(caught).toContain('Remove one BEFORE the active combatant: active index shifts down');
  });

  it('a new combatant placed BEFORE an equal Initiative (unstable tie) is caught', () => {
    const tieFirst: AddFn = (c, n) => {
      const at = c.combatants.findIndex((x) => x.initiative <= n.initiative);
      const index = at < 0 ? c.combatants.length : at;
      const combatants = [...c.combatants.slice(0, index), n, ...c.combatants.slice(index)];
      return { ...c, combatants, activeIndex: index <= c.activeIndex ? c.activeIndex + 1 : c.activeIndex };
    };
    const caught = failing(ROSTER_EDIT_CASES, (row) => rosterMismatches(tieFirst, removeCombatant, row));
    expect(caught).toContain('A new combatant tied with an existing one goes AFTER it (stable)');
  });

  it('perturbing a golden input changes the result', () => {
    const row = ROSTER_EDIT_CASES.find((r) => r.name.startsWith('Remove the ACTIVE last'))!;
    const base = combatOf(row.roster, row.activeIndex, row.round);
    const removed = removeCombatant(base, 'c');
    const notActive = removeCombatant({ ...base, activeIndex: 0 }, 'c');
    expect(removed.activeIndex).toBe(0);
    expect(notActive.activeIndex).toBe(0);
    expect(removed.combatants).toHaveLength(2);
    // Moving the active marker off the last combatant changes the outcome of the same removal.
    const middle = removeCombatant({ ...base, activeIndex: 1 }, 'c');
    expect(middle.activeIndex).toBe(1);
    expect(middle.activeIndex).not.toBe(removed.activeIndex);
  });
});

// ─── Behaviour the golden table does not enumerate ──────────────────────────
describe('nextTurn / previousTurn (index helpers)', () => {
  it('wrap and return 0 for an empty roster', () => {
    expect(nextTurn(2, 3)).toBe(0);
    expect(nextTurn(0, 0)).toBe(0);
    expect(nextTurn(0, -1)).toBe(0);
    expect(previousTurn(0, 3)).toBe(2);
    expect(previousTurn(2, 3)).toBe(1);
    expect(previousTurn(0, 0)).toBe(0);
  });
});

describe('startCombat', () => {
  const base: Character = createCharacter('Tester');
  const roster: Combatant[] = [
    { id: 'goblin', name: 'Goblin', initiative: 9 },
    { id: 'me', name: 'Tester', initiative: 17, isCharacter: true },
    { id: 'orc', name: 'Orc', initiative: 9 },
  ];

  it('sorts the roster, starts at round 1 with the first combatant active', () => {
    const started = startCombat(base, roster);
    expect(started.combat?.inCombat).toBe(true);
    expect(started.combat?.round).toBe(1);
    expect(started.combat?.activeIndex).toBe(0);
    expect(ids(started.combat!.combatants)).toEqual(['me', 'goblin', 'orc']);
    expect(started.combat?.turn).toEqual(freshTurn());
  });

  it('does not mutate the character or the roster', () => {
    const frozenChar = deepFreeze({ ...base });
    const frozenRoster = deepFreeze(roster.map((c) => ({ ...c })));
    expect(() => startCombat(frozenChar, frozenRoster)).not.toThrow();
    expect(base.combat).toBeUndefined();
  });

  it('keeps ids unique (first duplicate wins) and a single character entry', () => {
    const started = startCombat(base, [
      { id: 'a', name: 'A', initiative: 5, isCharacter: true },
      { id: 'a', name: 'Dup', initiative: 9 },
      { id: 'b', name: 'B', initiative: 5, isCharacter: true },
    ]);
    const list = started.combat!.combatants;
    expect(ids(list)).toEqual(['a', 'b']);
    expect(list.filter((c) => c.isCharacter).map((c) => c.id)).toEqual(['a']);
  });

  it('an empty roster starts an empty combat at round 1', () => {
    const started = startCombat(base, []);
    expect(started.combat).toMatchObject({ inCombat: true, round: 1, activeIndex: 0, combatants: [] });
  });
});

describe('endCombat', () => {
  it('removes the combat field, including every turn flag', () => {
    const started = startCombat(createCharacter('Tester'), [{ id: 'me', name: 'Me', initiative: 10, isCharacter: true }]);
    const spent = {
      ...started,
      combat: { ...started.combat!, turn: { ...freshTurn(), actionUsed: true, reactionUsed: true, movementUsed: 30 } },
    };
    const ended = endCombat(spent);
    expect('combat' in ended).toBe(false);
    expect(spent.combat).toBeDefined();
  });

  it('returns the same character when there is no combat (absent = not in combat)', () => {
    const c = createCharacter('Tester');
    expect(endCombat(c)).toBe(c);
  });

  it('a new combat after an ended one starts fresh', () => {
    const c = createCharacter('Tester');
    const again = startCombat(endCombat(startCombat(c, [{ id: 'a', name: 'A', initiative: 1 }])), []);
    expect(again.combat?.round).toBe(1);
  });
});

describe('combat state helpers', () => {
  const roster: Combatant[] = [
    { id: 'a', name: 'a', initiative: 15 },
    { id: 'me', name: 'me', initiative: 12, isCharacter: true },
    { id: 'b', name: 'b', initiative: 12 },
  ];
  const combat = (): CombatState => ({
    inCombat: true,
    round: 1,
    combatants: roster.map((r) => ({ ...r })),
    activeIndex: 0,
    turn: freshTurn(),
  });

  it('activeCombatant and isCharacterTurn follow the active index', () => {
    const c = combat();
    expect(activeCombatant(c)?.id).toBe('a');
    expect(isCharacterTurn(c)).toBe(false);
    expect(isCharacterTurn({ ...c, activeIndex: 1 })).toBe(true);
    expect(activeCombatant({ ...c, combatants: [] })).toBeUndefined();
    expect(isCharacterTurn({ ...c, combatants: [] })).toBe(false);
  });

  it('entering the character\'s turn resets the turn state, including the Reaction', () => {
    const spent = { ...combat(), turn: { ...freshTurn(), reactionUsed: true, actionUsed: true, movementUsed: 10, dashes: 1 } };
    const onMe = advanceTurn(spent, 'next');
    expect(onMe.activeIndex).toBe(1);
    expect(onMe.turn).toEqual(freshTurn());
  });

  it('entering another combatant\'s turn leaves a spent Reaction spent', () => {
    const spent = { ...combat(), activeIndex: 1, turn: { ...freshTurn(), reactionUsed: true } };
    const onB = advanceTurn(spent, 'next');
    expect(onB.activeIndex).toBe(2);
    expect(onB.turn.reactionUsed).toBe(true);
  });

  it('removing the active combatant hands the turn to the next one and resets if it is the character', () => {
    const c = { ...combat(), turn: { ...freshTurn(), reactionUsed: true } };
    const afterRemoval = removeCombatant(c, 'a');
    expect(afterRemoval.activeIndex).toBe(0);
    expect(activeCombatant(afterRemoval)?.id).toBe('me');
    expect(afterRemoval.turn).toEqual(freshTurn());
  });

  it('advancing an empty roster returns the same state', () => {
    const empty: CombatState = { ...combat(), combatants: [] };
    expect(advanceTurn(empty, 'next')).toBe(empty);
  });

  it('addCombatant ignores a duplicate id and a second character entry (ids stay unique)', () => {
    const c = combat();
    expect(addCombatant(c, { id: 'a', name: 'Dup', initiative: 99 })).toBe(c);
    expect(addCombatant(c, { id: 'z', name: 'Me again', initiative: 99, isCharacter: true })).toBe(c);
    const grown = addCombatant(c, { id: 'z', name: 'Z', initiative: 1 });
    expect(new Set(ids(grown.combatants)).size).toBe(grown.combatants.length);
  });

  it('adding to an empty roster keeps the active index at 0', () => {
    const empty: CombatState = { ...combat(), combatants: [], activeIndex: 0 };
    const grown = addCombatant(empty, { id: 'z', name: 'Z', initiative: 4 });
    expect(grown.activeIndex).toBe(0);
    expect(ids(grown.combatants)).toEqual(['z']);
  });

  it('moveCombatant keeps the active turn on the same combatant', () => {
    const c = { ...combat(), activeIndex: 1 }; // me is active
    const moved = moveCombatant(c, 'b', 'up'); // b and me swap
    expect(ids(moved.combatants)).toEqual(['a', 'b', 'me']);
    expect(activeCombatant(moved)?.id).toBe('me');
    expect(moveCombatant(c, 'a', 'down')).toBe(c); // crosses a different Initiative
    expect(canMoveWithinTie(c.combatants, 'b', 'up')).toBe(true);
    expect(canMoveWithinTie(c.combatants, 'a', 'down')).toBe(false);
  });

  it('no operation mutates its input', () => {
    const c = deepFreeze(combat());
    expect(() => {
      advanceTurn(c, 'next');
      advanceTurn(c, 'previous');
      addCombatant(c, { id: 'z', name: 'Z', initiative: 13 });
      removeCombatant(c, 'a');
      moveCombatant(c, 'b', 'up');
    }).not.toThrow();
    const list = deepFreeze(roster.map((r) => ({ ...r })));
    expect(() => {
      sortByInitiative(list);
      moveWithinTie(list, 'b', 'up');
    }).not.toThrow();
  });
});
