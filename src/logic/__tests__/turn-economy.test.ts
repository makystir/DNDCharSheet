import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, TurnState } from '../../types/character';
import { addCondition } from '../conditions';
import { sumComponents } from './breakdown-helpers';
import { advanceTurn, startCombat } from '../initiative-order';
import {
  applyCharacterTurnEvent,
  applyTurnEvent,
  applyTurnEvents,
  freshTurn,
  movementAllowance,
  movementAllowanceBreakdown,
  remainingMovement,
  remainingMovementBreakdown,
  shouldPromptDeathSave,
  shouldPromptDeathSaveFor,
  turnContextOf,
  type TurnContext,
  type TurnEvent,
  type TurnStep,
  type TurnWarning,
} from '../turn-economy';
import { TURN_RULE_TOOLTIP_KEYS, resolveTurnRuleTooltip } from '../tooltip-content';
import {
  DEATH_SAVE_PROMPT_CASES,
  TURN_CASES,
  type DeathSavePromptCase,
  type TurnCase,
} from './initiative-golden';

type RunFn = (events: TurnEvent[], context: TurnContext) => TurnStep;

const real: RunFn = (events, context) => applyTurnEvents(freshTurn(), events, context);

function turnMismatches(
  run: RunFn,
  row: TurnCase,
  remainingFn: (speed: number, turn: TurnState) => number = remainingMovement,
): string[] {
  const got = run(row.events, { speed: row.speed, incapacitated: row.incapacitated });
  const e = row.expect;
  const out: string[] = [];
  const flags: (keyof TurnState)[] = [
    'actionUsed',
    'bonusUsed',
    'reactionUsed',
    'objectInteractionUsed',
    'movementUsed',
    'dashes',
  ];
  for (const key of flags) if (got.turn[key] !== e[key]) out.push(key);
  if (movementAllowance(row.speed, got.turn.dashes) !== e.movementAllowance) out.push('movementAllowance');
  if (remainingFn(row.speed, got.turn) !== e.remainingMovement) out.push('remainingMovement');
  if (got.warnings.join() !== e.warnings.join()) out.push('warnings');
  const allowance = movementAllowanceBreakdown(row.speed, got.turn.dashes);
  if (allowance.total !== e.movementAllowance || sumComponents(allowance) !== allowance.total) {
    out.push('allowance-breakdown');
  }
  const remaining = remainingMovementBreakdown(row.speed, got.turn);
  if (remaining.total !== e.remainingMovement || sumComponents(remaining) !== remaining.total) {
    out.push('remaining-breakdown');
  }
  return out;
}

function deathSaveMismatches(fn: typeof shouldPromptDeathSave, row: DeathSavePromptCase): string[] {
  return fn(row.input) === row.expect ? [] : ['prompt'];
}

describe('golden: TURN_CASES', () => {
  for (const row of TURN_CASES) {
    it(`${row.name} [${row.cite}]`, () => {
      expect(turnMismatches(real, row)).toEqual([]);
    });
  }
});

describe('golden: DEATH_SAVE_PROMPT_CASES', () => {
  for (const row of DEATH_SAVE_PROMPT_CASES) {
    it(`${row.name} [${row.cite}]`, () => {
      expect(deathSaveMismatches(shouldPromptDeathSave, row)).toEqual([]);
    });
  }
});

// ─── The harness fails closed ────────────────────────────────────────────────
const failing = <T extends { name: string }>(rows: T[], mismatches: (row: T) => string[]) =>
  rows.filter((row) => mismatches(row).length > 0).map((row) => row.name);

/** A runner that folds events one at a time through a (possibly mutated) reducer. */
function runner(
  step: (turn: TurnState, event: TurnEvent, context: TurnContext) => TurnStep,
): RunFn {
  return (events, context) => {
    let turn = freshTurn();
    const warnings: TurnWarning[] = [];
    for (const event of events) {
      const out = step(turn, event, context);
      turn = out.turn;
      for (const w of out.warnings) if (!warnings.includes(w)) warnings.push(w);
    }
    return { turn, warnings };
  };
}

describe('fails closed: turn economy mutants', () => {
  it('the control runner (unmutated) passes every row, so the mutant runs are comparable', () => {
    expect(failing(TURN_CASES, (row) => turnMismatches(runner(applyTurnEvent), row))).toEqual([]);
  });

  it('resetting the Reaction on another combatant\'s turn is caught', () => {
    const mutant = runner((turn, event, ctx) => {
      const out = applyTurnEvent(turn, event, ctx);
      return event === 'other-turn' ? { ...out, turn: { ...out.turn, reactionUsed: false } } : out;
    });
    const caught = failing(TURN_CASES, (row) => turnMismatches(mutant, row));
    expect(caught).toContain('The Reaction stays spent through OTHER combatants\' turns');
  });

  it('never refreshing the Reaction on the character\'s own turn is caught', () => {
    const mutant = runner((turn, event, ctx) => {
      const out = applyTurnEvent(turn, event, ctx);
      return event === 'start-turn' ? { ...out, turn: { ...out.turn, reactionUsed: turn.reactionUsed } } : out;
    });
    const caught = failing(TURN_CASES, (row) => turnMismatches(mutant, row));
    expect(caught).toContain('The Reaction refreshes at the start of the character\'s next turn');
  });

  it('a gate that refuses a second use (state not updated on a warning) is caught', () => {
    const mutant = runner((turn, event, ctx) => {
      const out = applyTurnEvent(turn, event, ctx);
      return out.warnings.length > 0 ? { turn, warnings: out.warnings } : out;
    });
    const caught = failing(TURN_CASES, (row) => turnMismatches(mutant, row));
    expect(caught).toContain('Moving past your Speed warns; remaining is 0, never negative');
    expect(caught).toContain('Incapacitated: taking an action warns but still records');
  });

  it('a Dash that does not add movement, or does not use the action, is caught', () => {
    const noMovement = runner((turn, event, ctx) => {
      const out = applyTurnEvent(turn, event, ctx);
      return event === 'dash' ? { ...out, turn: { ...out.turn, dashes: turn.dashes } } : out;
    });
    const noAction = runner((turn, event, ctx) => {
      const out = applyTurnEvent(turn, event, ctx);
      return event === 'dash' ? { ...out, turn: { ...out.turn, actionUsed: turn.actionUsed } } : out;
    });
    expect(failing(TURN_CASES, (row) => turnMismatches(noMovement, row)).length).toBeGreaterThan(0);
    expect(failing(TURN_CASES, (row) => turnMismatches(noAction, row)).length).toBeGreaterThan(0);
  });

  it('dropping the over-speed or Incapacitated warnings is caught', () => {
    const quiet = (drop: TurnWarning) =>
      runner((turn, event, ctx) => {
        const out = applyTurnEvent(turn, event, ctx);
        return { ...out, warnings: out.warnings.filter((w) => w !== drop) };
      });
    expect(failing(TURN_CASES, (row) => turnMismatches(quiet('over-speed'), row)).length).toBeGreaterThan(0);
    expect(failing(TURN_CASES, (row) => turnMismatches(quiet('incapacitated'), row)).length).toBeGreaterThan(0);
  });

  it('repeating a warning instead of removing duplicates is caught', () => {
    const noDedupe: RunFn = (events, ctx) => {
      let turn = freshTurn();
      const warnings: TurnWarning[] = [];
      for (const event of events) {
        const out = applyTurnEvent(turn, event, ctx);
        turn = out.turn;
        warnings.push(...out.warnings);
      }
      return { turn, warnings };
    };
    expect(failing(TURN_CASES, (row) => turnMismatches(noDedupe, row))).toContain(
      'Incapacitated: Bonus Action and Reaction each warn once (duplicates removed)',
    );
  });

  it('a remaining movement that can go negative is caught', () => {
    const negative = (speed: number, turn: TurnState) => speed * (1 + turn.dashes) - turn.movementUsed;
    const caught = failing(TURN_CASES, (row) => turnMismatches(real, row, negative));
    expect(caught).toContain('Moving past your Speed warns; remaining is 0, never negative');
  });

  it('a mutant that prompts for a Death Saving Throw on someone else\'s turn, when Stable or dead is caught', () => {
    const anyTurn: typeof shouldPromptDeathSave = (i) => i.hp <= 0;
    const ignoresStable: typeof shouldPromptDeathSave = (i) => i.activeIsCharacter && i.dead !== true && i.hp <= 0;
    const ignoresDead: typeof shouldPromptDeathSave = (i) => i.activeIsCharacter && i.stable !== true && i.hp <= 0;
    const caught = (fn: typeof shouldPromptDeathSave) =>
      failing(DEATH_SAVE_PROMPT_CASES, (row) => deathSaveMismatches(fn, row));
    expect(caught(anyTurn)).toContain('It is someone else\'s turn: no prompt');
    expect(caught(ignoresStable)).toContain('Stable at 0 HP: no prompt');
    expect(caught(ignoresDead)).toContain('Dead: no prompt');
  });

  it('perturbing a golden input changes the result', () => {
    const row = TURN_CASES.find((r) => r.name.startsWith('Moving past your Speed'))!;
    const base = real(row.events, { speed: row.speed });
    const faster = real(row.events, { speed: row.speed + 10 });
    expect(base.warnings).toEqual(['over-speed']);
    expect(faster.warnings).toEqual([]);
    const slow = TURN_CASES.find((r) => r.name === 'Taking the action marks it used')!;
    const incap = real(slow.events, { speed: slow.speed, incapacitated: true });
    expect(incap.warnings).toEqual(['incapacitated']);
    expect(real(slow.events, { speed: slow.speed }).warnings).toEqual([]);
  });
});

// ─── Behaviour the golden table does not enumerate ──────────────────────────
describe('turn reducer details', () => {
  const ctx: TurnContext = { speed: 30 };

  it('does not mutate the previous turn state', () => {
    const turn = Object.freeze({ ...freshTurn() });
    expect(() => applyTurnEvents(turn, ['action', 'bonus', 'move:10', 'dash', 'start-turn'], ctx)).not.toThrow();
    expect(turn).toEqual(freshTurn());
  });

  it('other-turn returns the same state object', () => {
    const turn = freshTurn();
    expect(applyTurnEvent(turn, 'other-turn', ctx).turn).toBe(turn);
  });

  it('ignores malformed move events and negative distances', () => {
    expect(applyTurnEvent(freshTurn(), 'move:abc' as TurnEvent, ctx).turn.movementUsed).toBe(0);
    expect(applyTurnEvent(freshTurn(), 'move:-10', ctx).turn.movementUsed).toBe(0);
    expect(applyTurnEvent(freshTurn(), 'move:0', ctx).warnings).toEqual([]);
  });

  it('reaching exactly the allowance is not over Speed', () => {
    const out = applyTurnEvents(freshTurn(), ['move:30'], ctx);
    expect(out.warnings).toEqual([]);
    expect(remainingMovement(30, out.turn)).toBe(0);
  });

  it('a Dash after moving past Speed does not retroactively warn', () => {
    const out = applyTurnEvents(freshTurn(), ['dash', 'move:50'], ctx);
    expect(out.warnings).toEqual([]);
  });

  it('Incapacitated also warns before a repeat-use warning, and only once', () => {
    const out = applyTurnEvents(freshTurn(), ['action', 'action'], { speed: 30, incapacitated: true });
    expect(out.warnings).toEqual(['incapacitated', 'action-already-used']);
  });

  it('movement and free interaction never raise the Incapacitated warning', () => {
    const out = applyTurnEvents(freshTurn(), ['move:10', 'interact'], { speed: 30, incapacitated: true });
    expect(out.warnings).toEqual([]);
  });

  it('breakdowns list every component, zeros included, and sum to the total', () => {
    const none = movementAllowanceBreakdown(30, 0);
    expect(none.components.map((c) => c.value)).toEqual([30, 0]);
    const dashed = movementAllowanceBreakdown(30, 2);
    expect(dashed.components.map((c) => c.value)).toEqual([30, 60]);
    expect(dashed.total).toBe(90);
    const over = remainingMovementBreakdown(30, { ...freshTurn(), movementUsed: 40 });
    expect(over.components.map((c) => c.value)).toEqual([30, -40, 10]);
    expect(over.total).toBe(0);
    expect(sumComponents(over)).toBe(0);
    const fresh = remainingMovementBreakdown(30, freshTurn());
    expect(fresh.components.map((c) => c.value)).toEqual([30, 0, 0]);
  });

  it('Speed 0 or a non-finite Speed gives a zero allowance', () => {
    expect(movementAllowance(0, 3)).toBe(0);
    expect(movementAllowance(Number.NaN, 1)).toBe(0);
  });
});

describe('character-level helpers', () => {
  const base: Character = { ...createCharacter('Tester'), hpMax: 20 };
  const inCombat = (c: Character) =>
    startCombat(c, [
      { id: 'me', name: 'Tester', initiative: 15, isCharacter: true },
      { id: 'orc', name: 'Orc', initiative: 10 },
    ]);

  it('turnContextOf reads Speed and Incapacitated', () => {
    expect(turnContextOf(base)).toEqual({ speed: 30, incapacitated: false });
    expect(turnContextOf({ ...base, currentHp: 0 }).incapacitated).toBe(true);
    expect(turnContextOf(addCondition(base, 'stunned')).incapacitated).toBe(true);
  });

  it('applyCharacterTurnEvent returns the character unchanged when not in combat', () => {
    const out = applyCharacterTurnEvent(base, 'action');
    expect(out.character).toBe(base);
    expect(out.warnings).toEqual([]);
  });

  it('applyCharacterTurnEvent updates the combat turn and warns, without mutating', () => {
    const c = Object.freeze(inCombat(base));
    const first = applyCharacterTurnEvent(c, 'action');
    expect(first.character.combat?.turn.actionUsed).toBe(true);
    expect(c.combat?.turn.actionUsed).toBe(false);
    const second = applyCharacterTurnEvent(first.character, 'action');
    expect(second.warnings).toEqual(['action-already-used']);
    expect(second.character.combat?.turn.actionUsed).toBe(true);
  });

  it('applyCharacterTurnEvent warns when Incapacitated but still records', () => {
    const c = inCombat(addCondition(base, 'paralyzed'));
    const out = applyCharacterTurnEvent(c, 'reaction');
    expect(out.warnings).toEqual(['incapacitated']);
    expect(out.character.combat?.turn.reactionUsed).toBe(true);
  });

  it('a Reaction survives the orc\'s turn and refreshes on the character\'s next turn', () => {
    let c = inCombat(base);
    c = applyCharacterTurnEvent(c, 'reaction').character;
    c = { ...c, combat: advanceTurn(c.combat!, 'next') }; // orc's turn
    expect(c.combat?.turn.reactionUsed).toBe(true);
    c = { ...c, combat: advanceTurn(c.combat!, 'next') }; // round 2, my turn
    expect(c.combat?.round).toBe(2);
    expect(c.combat?.turn.reactionUsed).toBe(false);
  });

  it('shouldPromptDeathSaveFor needs the character\'s own turn at 0 HP, not Stable or dead', () => {
    const down = { ...base, currentHp: 0 };
    expect(shouldPromptDeathSaveFor(down)).toBe(false); // not in combat
    const mine = inCombat(down);
    expect(shouldPromptDeathSaveFor(mine)).toBe(true);
    const theirs = { ...mine, combat: advanceTurn(mine.combat!, 'next') };
    expect(shouldPromptDeathSaveFor(theirs)).toBe(false);
    expect(shouldPromptDeathSaveFor({ ...mine, deathSaves: { successes: 0, failures: 0, stable: true } })).toBe(false);
    expect(shouldPromptDeathSaveFor({ ...mine, dead: true })).toBe(false);
    expect(shouldPromptDeathSaveFor(inCombat(base))).toBe(false); // healthy
  });
});

describe('resolveTurnRuleTooltip', () => {
  for (const key of TURN_RULE_TOOLTIP_KEYS) {
    it(`${key} has a title, rule text and a PHB source`, () => {
      const tip = resolveTurnRuleTooltip(key);
      expect(tip).not.toBeNull();
      expect(tip!.title.length).toBeGreaterThan(0);
      expect(tip!.sections.find((s) => s.label === 'Source')?.text).toMatch(/PHB 2024/);
      expect(tip!.sections.length).toBeGreaterThan(2);
    });
  }

  it('covers Initiative, Surprise, Action, Bonus Action, Reaction and Dash', () => {
    expect([...TURN_RULE_TOOLTIP_KEYS].sort()).toEqual(
      ['action', 'bonus-action', 'dash', 'initiative', 'reaction', 'surprise'],
    );
  });

  it('states there is no surprise round', () => {
    expect(resolveTurnRuleTooltip('surprise')!.sections.some((s) => /no separate surprise round/i.test(s.text))).toBe(true);
  });

  it('returns null for an unknown or inherited key', () => {
    expect(resolveTurnRuleTooltip('nope')).toBeNull();
    expect(resolveTurnRuleTooltip('toString')).toBeNull();
    expect(resolveTurnRuleTooltip('')).toBeNull();
  });
});
