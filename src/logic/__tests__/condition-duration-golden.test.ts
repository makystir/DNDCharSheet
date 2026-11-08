import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { ActiveCondition, Character, ConditionDuration } from '../../types/character';
import type { SpellId } from '../../data/spells';
import {
  advanceCombatTurn,
  advanceRounds,
  durationFromAmount,
  expireOnConcentrationEnd,
  expireOnRest,
  isConcentrating,
  sanitizeConditionDurations,
  setConditionDuration,
  tickConditionManually,
} from '../condition-duration';
import { startCombat } from '../initiative-order';
import { endConcentration, endConcentrationIfBroken, startConcentration } from '../concentration';
import { shortRest, longRest } from '../rests';
import { importFromJSON } from '../../storage/export-import';
import { validateSharedPayload } from '../share-validate';
import {
  DURATION_SCENARIOS,
  SANITIZE_ROWS,
  type DurationScenario,
  type GoldenEvent,
  type GoldenRemaining,
} from './condition-duration-golden';

const SPELL = 'bless' as SpellId;

function buildCharacter(s: DurationScenario): Character {
  let c: Character = { ...createCharacter('Golden'), conditions: [] };
  for (const spec of s.conditions) {
    const entry = { id: spec.id } as ActiveCondition;
    if (spec.ends !== undefined) entry.ends = spec.ends;
    c.conditions = [...(c.conditions ?? []), entry];
  }
  if (s.concentrating) c = { ...c, concentration: { spellId: SPELL } };
  // Durations go in through the public setter (it enforces the concentration link).
  for (const spec of s.conditions) {
    if (!spec.duration) continue;
    const duration: ConditionDuration | undefined = durationFromAmount(spec.duration.kind, spec.duration.amount);
    c = setConditionDuration(c, spec.id as ActiveCondition['id'], duration);
  }
  if (s.tracker) {
    c = startCombat(c, [
      { id: 'me', name: 'Me', initiative: 15, isCharacter: true },
      { id: 'foe', name: 'Foe', initiative: 10 },
    ]);
  }
  return c;
}

function apply(c: Character, event: GoldenEvent): Character {
  switch (event.type) {
    case 'manual-tick':
      return tickConditionManually(c, event.id as ActiveCondition['id']);
    case 'round':
      return advanceRounds(c, event.rounds);
    case 'rest':
      return expireOnRest(c, event.rest);
    case 'end-concentration':
      return expireOnConcentrationEnd(endConcentration(c));
  }
}

function project(c: Character): GoldenRemaining[] {
  return (c.conditions ?? []).map((cond) => {
    const d = cond.duration;
    if (!d) return { id: cond.id, kind: 'none' as const };
    const timed = d.kind === 'rounds' || d.kind === 'minutes' || d.kind === 'hours';
    return timed ? { id: cond.id, rounds: d.rounds, kind: d.kind } : { id: cond.id, kind: d.kind };
  });
}

function expiredIds(c: Character): string[] {
  return (c.eventLog ?? [])
    .filter((e) => e.type === 'condition-expired')
    .map((e) => String(e.payload.conditionId));
}

describe('condition durations: golden scenarios', () => {
  it.each(DURATION_SCENARIOS.map((s) => [s.name, s] as const))('%s', (_name, scenario) => {
    let c = buildCharacter(scenario);
    scenario.steps.forEach((step) => {
      c = apply(c, step.event);
      expect(project(c)).toEqual(step.remaining);
      expect(expiredIds(c)).toEqual(step.expiredSoFar);
    });
  });
});

describe('condition durations: expiry never touches other conditions', () => {
  it('conditions without a structured duration keep their exact objects through every event', () => {
    const base = buildCharacter({
      name: 'x',
      tracker: true,
      concentrating: true,
      conditions: [
        { id: 'poisoned', duration: { kind: 'rounds', amount: 1 } },
        { id: 'blinded', ends: 'legacy', },
      ],
      steps: [],
    });
    const legacy = base.conditions?.find((x) => x.id === 'blinded');
    let c = advanceRounds(base, 5);
    c = expireOnRest(c, 'long');
    c = expireOnConcentrationEnd(endConcentration(c));
    expect(c.conditions).toEqual([legacy]);
    expect(c.conditions?.[0]).toBe(legacy);
  });

  it('an expiry log entry names the condition and why it ended', () => {
    const c = advanceRounds(
      buildCharacter({
        name: 'x',
        tracker: true,
        concentrating: false,
        conditions: [{ id: 'poisoned', duration: { kind: 'rounds', amount: 1 } }],
        steps: [],
      }),
      1,
    );
    const entry = c.eventLog?.find((e) => e.type === 'condition-expired');
    expect(entry?.category).toBe('combat');
    expect(entry?.summary).toBe('Poisoned ended: its duration ran out.');
  });

  it('removing the last condition removes the conditions field', () => {
    const c = advanceRounds(
      buildCharacter({
        name: 'x',
        tracker: true,
        concentrating: false,
        conditions: [{ id: 'poisoned', duration: { kind: 'rounds', amount: 1 } }],
        steps: [],
      }),
      1,
    );
    expect('conditions' in c).toBe(false);
  });
});

describe('condition durations: wiring into the real tracker, rests and Concentration', () => {
  const timedFightScenario: DurationScenario = {
    name: 'wiring',
    tracker: true,
    concentrating: false,
    conditions: [
      { id: 'poisoned', duration: { kind: 'rounds', amount: 2 } },
      { id: 'blinded', duration: { kind: 'manual' } },
      { id: 'charmed', ends: 'legacy' },
    ],
    steps: [],
  };

  it('advanceCombatTurn ticks only when the round number goes up', () => {
    let c = buildCharacter(timedFightScenario);
    // Roster: Me (active), Foe. Next -> Foe (same round 1): no tick.
    let out = advanceCombatTurn(c, 'next');
    expect(out.character.combat?.round).toBe(1);
    expect(project(out.character)[0]).toEqual({ id: 'poisoned', rounds: 2, kind: 'rounds' });
    // Next again wraps to round 2: ticks once.
    out = advanceCombatTurn(out.character, 'next');
    expect(out.character.combat?.round).toBe(2);
    expect(project(out.character)[0]).toEqual({ id: 'poisoned', rounds: 1, kind: 'rounds' });
    expect(out.expired).toEqual([]);
    // Two more turns -> round 3: expires.
    out = advanceCombatTurn(advanceCombatTurn(out.character, 'next').character, 'next');
    expect(out.character.combat?.round).toBe(3);
    expect(out.expired).toEqual(['poisoned']);
    expect(project(out.character).map((p) => p.id)).toEqual(['blinded', 'charmed']);
    c = out.character;
    // Previous never restores or ticks.
    const back = advanceCombatTurn(c, 'previous');
    expect(back.expired).toEqual([]);
    expect(project(back.character).map((p) => p.id)).toEqual(['blinded', 'charmed']);
  });

  it('advanceCombatTurn with no tracker returns the character unchanged', () => {
    const c = buildCharacter({ ...timedFightScenario, tracker: false });
    const out = advanceCombatTurn(c, 'next');
    expect(out.character).toBe(c);
    expect(out.expired).toEqual([]);
  });

  it('a Short Rest ends a short-rest condition and a Long Rest ends a long-rest one (real rests)', () => {
    let c = buildCharacter({
      name: 'x',
      tracker: false,
      concentrating: false,
      conditions: [
        { id: 'unconscious', duration: { kind: 'short-rest' } },
        { id: 'restrained', duration: { kind: 'long-rest' } },
      ],
      steps: [],
    });
    const interrupted = shortRest(c, { rolls: [], interrupted: true });
    expect(interrupted.character.conditions).toHaveLength(2);
    const short = shortRest(c, { rolls: [] });
    expect(short.outcome).toBe('completed');
    expect(short.character.conditions?.map((x) => x.id)).toEqual(['restrained']);
    c = short.character;
    const long = longRest(c);
    expect(long.outcome).toBe('completed');
    expect(long.character.conditions).toBeUndefined();
  });

  it('a Long Rest also ends the Concentration-linked conditions (it ends Concentration)', () => {
    const c = buildCharacter({
      name: 'x',
      tracker: false,
      concentrating: true,
      conditions: [{ id: 'charmed', duration: { kind: 'concentration' } }],
      steps: [],
    });
    const long = longRest(c);
    expect(long.character.concentration).toBeUndefined();
    expect(long.character.conditions).toBeUndefined();
  });

  it('starting a different Concentration spell expires the previous spell links', () => {
    const c = buildCharacter({
      name: 'x',
      tracker: false,
      concentrating: true,
      conditions: [{ id: 'charmed', duration: { kind: 'concentration' } }],
      steps: [],
    });
    const same = startConcentration(c, SPELL, true);
    expect(same.character.conditions).toHaveLength(1);
    const other = startConcentration(c, 'hold-person' as SpellId, true);
    expect(other.endedPrevious).toBe(SPELL);
    expect(other.character.conditions).toBeUndefined();
  });

  it('a concentration link cannot be set while not concentrating', () => {
    const c = buildCharacter({ name: 'x', tracker: false, concentrating: false, conditions: [{ id: 'charmed' }], steps: [] });
    const out = setConditionDuration(c, 'charmed', { kind: 'concentration' });
    expect(out.conditions?.[0].duration).toBeUndefined();
  });

  it('setConditionDuration with undefined clears the structured duration only', () => {
    let c = buildCharacter({
      name: 'x',
      tracker: false,
      concentrating: false,
      conditions: [{ id: 'poisoned', ends: 'note', duration: { kind: 'rounds', amount: 3 } }],
      steps: [],
    });
    c = setConditionDuration(c, 'poisoned', undefined);
    expect(c.conditions).toEqual([{ id: 'poisoned', ends: 'note' }]);
  });
});

describe('condition durations: import / share sanitising', () => {
  it.each(SANITIZE_ROWS.map((r) => [r.name, r] as const))('%s', (_name, row) => {
    expect(sanitizeConditionDurations(row.input, row.concentrating)).toEqual(row.expected);
  });

  it('importFromJSON sanitises untrusted durations and leaves legacy saves loading unchanged', () => {
    const base = createCharacter('Imp');
    const payload = {
      ...base,
      conditions: [
        { id: 'poisoned', ends: 'save ends' },
        { id: 'blinded', duration: { kind: 'rounds', rounds: -4 } },
        { id: 'charmed', duration: { kind: 'rounds', rounds: 7 } },
      ],
    };
    const out = importFromJSON(JSON.stringify(payload));
    expect(out.success).toBe(true);
    expect(out.character?.conditions).toEqual([
      { id: 'poisoned', ends: 'save ends' },
      { id: 'blinded' },
      { id: 'charmed', duration: { kind: 'rounds', rounds: 7 } },
    ]);
  });

  it('a shared payload is sanitised the same way', () => {
    const base = createCharacter('Shared');
    const result = validateSharedPayload(
      JSON.stringify({ ...base, conditions: [{ id: 'blinded', duration: { kind: 'rounds', rounds: 1e15 } }] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.character.conditions).toEqual([{ id: 'blinded' }]);
  });
});

describe('condition durations: review fixes', () => {
  const fight = (): Character =>
    buildCharacter({
      name: 'x',
      tracker: true,
      concentrating: false,
      conditions: [{ id: 'poisoned', duration: { kind: 'rounds', amount: 3 } }],
      steps: [],
    });
  const rounds = (c: Character) => project(c)[0];

  it('next, previous, next over one round boundary ticks once (high-water round)', () => {
    let c = fight();
    c = advanceCombatTurn(advanceCombatTurn(c, 'next').character, 'next').character; // round 2
    expect(c.combat?.round).toBe(2);
    expect(rounds(c)).toEqual({ id: 'poisoned', rounds: 2, kind: 'rounds' });
    c = advanceCombatTurn(c, 'previous').character; // back to Foe, round 1
    expect(c.combat?.round).toBe(1);
    expect(rounds(c)).toEqual({ id: 'poisoned', rounds: 2, kind: 'rounds' });
    c = advanceCombatTurn(c, 'next').character; // round 2 again: no second tick
    expect(c.combat?.round).toBe(2);
    expect(rounds(c)).toEqual({ id: 'poisoned', rounds: 2, kind: 'rounds' });
    // Reaching round 3 for the first time ticks again.
    c = advanceCombatTurn(advanceCombatTurn(c, 'next').character, 'next').character;
    expect(c.combat?.round).toBe(3);
    expect(rounds(c)).toEqual({ id: 'poisoned', rounds: 1, kind: 'rounds' });
  });

  it('a one-combatant roster ticks on every Next', () => {
    let c = buildCharacter({
      name: 'x',
      tracker: false,
      concentrating: false,
      conditions: [{ id: 'poisoned', duration: { kind: 'rounds', amount: 2 } }],
      steps: [],
    });
    c = startCombat(c, [{ id: 'me', name: 'Me', initiative: 15, isCharacter: true }]);
    c = advanceCombatTurn(c, 'next').character;
    expect(c.combat?.round).toBe(2);
    expect(rounds(c)).toEqual({ id: 'poisoned', rounds: 1, kind: 'rounds' });
    const out = advanceCombatTurn(c, 'next');
    expect(out.expired).toEqual(['poisoned']);
  });

  it('an empty roster changes nothing and ticks nothing', () => {
    const c = fight();
    const empty: Character = { ...c, combat: { ...c.combat!, combatants: [], activeIndex: 0 } };
    const out = advanceCombatTurn(empty, 'next');
    expect(out.character).toBe(empty);
    expect(out.expired).toEqual([]);
  });

  describe('Concentration ending through the real paths', () => {
    const linked = (extra: Partial<Character> = {}): Character => ({
      ...buildCharacter({
        name: 'x',
        tracker: false,
        concentrating: true,
        conditions: [
          { id: 'charmed', duration: { kind: 'concentration' } },
          { id: 'blinded', duration: { kind: 'manual' } },
        ],
        steps: [],
      }),
      ...extra,
    });

    it('endConcentration alone expires the linked condition and logs it', () => {
      const c = endConcentration(linked());
      expect(c.concentration).toBeUndefined();
      expect(c.conditions?.map((x) => x.id)).toEqual(['blinded']);
      expect(expiredIds(c)).toEqual(['charmed']);
    });

    it('endConcentrationIfBroken: Incapacitated', () => {
      const c = linked();
      const withCond: Character = { ...c, conditions: [...(c.conditions ?? []), { id: 'incapacitated' } as ActiveCondition] };
      const out = endConcentrationIfBroken(withCond);
      expect(out.reason).toBe('incapacitated');
      expect(out.character.concentration).toBeUndefined();
      expect(expiredIds(out.character)).toEqual(['charmed']);
    });

    it('endConcentrationIfBroken: 0 HP', () => {
      const c = linked();
      const out = endConcentrationIfBroken({ ...c, hpMax: 10, currentHp: 0 });
      expect(out.reason).not.toBeNull();
      expect(out.character.concentration).toBeUndefined();
      expect(expiredIds(out.character)).toEqual(['charmed']);
    });

    it('endConcentrationIfBroken: dead', () => {
      const out = endConcentrationIfBroken(linked({ dead: true } as Partial<Character>));
      expect(out.reason).toBe('dead');
      expect(expiredIds(out.character)).toEqual(['charmed']);
    });

    it('endConcentrationIfBroken leaves a healthy concentrating character alone', () => {
      const c = linked();
      const out = endConcentrationIfBroken(c);
      expect(out.reason).toBeNull();
      expect(out.character).toBe(c);
    });
  });

  it('a malformed concentration value does not keep a concentration link on import', () => {
    expect(isConcentrating(null)).toBe(false);
    expect(isConcentrating('bless')).toBe(false);
    expect(isConcentrating({})).toBe(false);
    expect(isConcentrating({ spellId: 'bless' })).toBe(true);
  });
});



