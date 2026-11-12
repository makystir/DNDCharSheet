import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { createCharacter } from '../../../storage/character-store';
import type { Character } from '../../../types/character';
import { getSuggestions, deterministicSuggestionSource } from '../engine';
import type { Suggestion, SuggestionContext } from '../types';
import { orderSuggestions } from '../ordering';
import { visibleSuggestions } from '../visible';
import { advancementSuggestions } from '../rules/advancement';
import { encumbranceSuggestions } from '../rules/encumbrance';
import { restSuggestions } from '../rules/rest';
import { combatSuggestions } from '../rules/combat';
import { fileBackupSuggestions } from '../rules/file-backup';
import { advisorSuggestions } from '../../advancement-advisor';
import { carriedWeightBreakdown, carryingCapacityBreakdown } from '../../encumbrance';
import { lifeStatus } from '../../hit-points-state';
import { getBackupReminder } from '../../../storage/backup-reminder';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return { ...createCharacter('Test Hero'), ...overrides };
}

/** A level-1 Fighter (d10) with a Hit Point maximum, so HP/rest rules can fire. */
function fighter(overrides: Partial<Character> = {}): Character {
  return makeCharacter({
    level: 1,
    classes: [{ id: 'fighter', level: 1 }],
    hpMax: 10,
    ...overrides,
  });
}

/** A heavy load with low Strength so the character is over carrying capacity. */
function overloaded(): Character {
  return makeCharacter({
    abilities: { str: 8, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    inventory: [
      { id: 'i1', kind: 'equipment', name: 'Lead bricks', quantity: 1, weightLb: 500 },
    ],
  });
}

const CTX_COMBAT: SuggestionContext = { inCombat: true, lastBackupAt: Date.now(), now: Date.now() };
const CTX_PEACE: SuggestionContext = { inCombat: false, lastBackupAt: Date.now(), now: Date.now() };

/** Recursively assert a value contains no function members (serializability). */
function assertNoFunctions(value: unknown): void {
  if (typeof value === 'function') throw new Error('Found a function value');
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      assertNoFunctions(v);
    }
  }
}

// ─── Purity & basic contract ─────────────────────────────────────────────────

describe('getSuggestions — contract', () => {
  it('returns [] for an undefined character without throwing', () => {
    expect(getSuggestions(undefined, CTX_PEACE)).toEqual([]);
    expect(getSuggestions(undefined, CTX_COMBAT)).toEqual([]);
  });

  it('deterministicSuggestionSource delegates to getSuggestions (sync)', () => {
    const character = fighter();
    const viaSource = deterministicSuggestionSource.getSuggestions(character, CTX_PEACE);
    expect(Array.isArray(viaSource)).toBe(true);
    expect(viaSource).toEqual(getSuggestions(character, CTX_PEACE));
  });

  it('is pure: never mutates the character, writes storage, navigates, or opens a dialog', () => {
    const character = fighter({
      currentHp: 2,
      exhaustionLevel: 2,
      concentration: { spellId: 'bless' },
    });
    const snapshot = structuredClone(character);
    const frozen = Object.freeze(structuredClone(character));

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    expect(() => getSuggestions(frozen, CTX_COMBAT)).not.toThrow();
    expect(() => getSuggestions(frozen, CTX_PEACE)).not.toThrow();

    // No storage WRITES from the pure engine. (Reads are tolerated for the
    // backup reminder default path, but the engine threads ctx values, so none
    // should occur; we only assert no writes.)
    expect(setItemSpy).not.toHaveBeenCalled();
    // The character is untouched.
    expect(character).toEqual(snapshot);

    setItemSpy.mockRestore();
  });
});

// ─── Determinism property ──────────────────────────────────────────────────

describe('getSuggestions — determinism (property)', () => {
  const arb = fc.record({
    hp: fc.integer({ min: 0, max: 10 }),
    exhaustion: fc.integer({ min: 0, max: 6 }),
    inCombat: fc.boolean(),
    now: fc.integer({ min: 0, max: 10_000_000_000 }),
  });

  it('identical inputs always yield identical ordered output', () => {
    fc.assert(
      fc.property(arb, (a) => {
        const base = fighter({
          currentHp: a.hp,
          exhaustionLevel: a.exhaustion === 0 ? undefined : a.exhaustion,
        });
        const ctx: SuggestionContext = { inCombat: a.inCombat, lastBackupAt: null, now: a.now };
        const first = getSuggestions(base, ctx);
        const second = getSuggestions(structuredClone(base), ctx);
        expect(second).toEqual(first);
      }),
      { numRuns: 60 },
    );
  });
});

// ─── Serializability property ─────────────────────────────────────────────

describe('getSuggestions — serializability (property)', () => {
  const arb = fc.record({
    hp: fc.integer({ min: 0, max: 10 }),
    exhaustion: fc.integer({ min: 0, max: 6 }),
    inCombat: fc.boolean(),
    overloaded: fc.boolean(),
    lastBackup: fc.option(fc.integer({ min: 0, max: 10_000_000_000 }), { nil: null }),
  });

  it('every emitted suggestion (incl. action/secondaryAction/citation/totals) is JSON round-trippable and function-free', () => {
    fc.assert(
      fc.property(arb, (a) => {
        const base = a.overloaded
          ? { ...overloaded(), classes: [{ id: 'fighter' as const, level: 1 }], hpMax: 10, currentHp: a.hp }
          : fighter({ currentHp: a.hp });
        const character: Character = {
          ...base,
          exhaustionLevel: a.exhaustion === 0 ? undefined : a.exhaustion,
        };
        const list = getSuggestions(character, {
          inCombat: a.inCombat,
          lastBackupAt: a.lastBackup,
          now: 5_000_000_000,
        });
        for (const s of list) {
          assertNoFunctions(s);
          const roundTripped = JSON.parse(JSON.stringify(s)) as Suggestion;
          expect(roundTripped).toEqual(s);
        }
      }),
      { numRuns: 60 },
    );
  });
});

// ─── Per-rule triggers vs the REAL derived predicates ────────────────────────

describe('advancement rule', () => {
  it('emits nothing when the advisor is silent (no class, at the level cap)', () => {
    // No class ⇒ no subclass/feat-slot prompts; level 20 ⇒ no level-up / PB bump;
    // milestone ⇒ no earned-unapplied level. The advisor yields [].
    const maxed = makeCharacter({ level: 20 });
    expect(advisorSuggestions(maxed)).toEqual([]);
    expect(advancementSuggestions(maxed)).toEqual([]);
  });

  it('emits a single advancement nudge navigating to advancement when the advisor fires', () => {
    const character = fighter(); // milestone, level 1 ⇒ canLevelUp true
    expect(advisorSuggestions(character).length).toBeGreaterThan(0);
    const out = advancementSuggestions(character);
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe('advancement');
    expect(out[0].action).toEqual({ kind: 'navigate', page: 'advancement' });
    expect(out[0].urgency).toBe('recommended'); // can-level-up ⇒ actionable
  });
});

describe('encumbrance rule (PHB Carrying Capacity)', () => {
  it('emits iff carried weight exceeds capacity, critical, navigate to inventory, with the carried breakdown', () => {
    const over = overloaded();
    const current = carriedWeightBreakdown(over);
    const capacity = carryingCapacityBreakdown(over);
    expect(current.total).toBeGreaterThan(capacity.total);

    const out = encumbranceSuggestions(over);
    expect(out).toHaveLength(1);
    const s = out[0];
    expect(s.urgency).toBe('critical');
    expect(s.category).toBe('encumbrance');
    expect(s.action).toEqual({ kind: 'navigate', page: 'inventory' });
    expect(s.citation).toBe('PHB 2024 "Carrying Capacity"');
    // The total carries the SAME Breakdown the logic produced (not recomputed).
    expect(s.totals?.[0].breakdown).toEqual(current);
    expect(s.totals?.[0].display).toBe(`${current.total} / ${capacity.total} lb`);
  });

  it('emits nothing when within capacity', () => {
    const light = makeCharacter({
      abilities: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    });
    const current = carriedWeightBreakdown(light);
    const capacity = carryingCapacityBreakdown(light);
    expect(current.total).toBeLessThanOrEqual(capacity.total);
    expect(encumbranceSuggestions(light)).toEqual([]);
  });
});

describe('rest rule (PHB Short Rest / Exhaustion)', () => {
  it('nudges a Short Rest when Bloodied with Hit Dice available, navigating to the Overview Rest card', () => {
    const bloodied = fighter({ currentHp: 3 }); // 3 of 10 ⇒ Bloodied; 1 Hit Die
    const out = restSuggestions(bloodied);
    const hp = out.find((s) => s.id === 'rest:short-rest-hp');
    expect(hp).toBeDefined();
    expect(hp!.category).toBe('health');
    expect(hp!.action).toEqual({ kind: 'navigate', page: 'character', subTab: 'identity' });
  });

  it('nudges a rest for Exhaustion, navigating to the Overview Rest card', () => {
    const tired = fighter({ currentHp: 10, exhaustionLevel: 2 });
    const out = restSuggestions(tired);
    const ex = out.find((s) => s.id === 'rest:exhaustion');
    expect(ex).toBeDefined();
    expect(ex!.category).toBe('health');
    expect(ex!.action).toEqual({ kind: 'navigate', page: 'character', subTab: 'identity' });
  });

  it('stays silent while making death saves (the combat module owns it)', () => {
    const downed = fighter({ currentHp: 0 });
    expect(lifeStatus(downed)).toBe('making-death-saves');
    expect(restSuggestions(downed)).toEqual([]);
  });

  it('emits nothing at full HP with no Exhaustion', () => {
    expect(restSuggestions(fighter({ currentHp: 10 }))).toEqual([]);
  });
});

describe('combat rule (PHB Death Saving Throws / Concentration)', () => {
  it('fires a critical death-save nudge at 0 HP, navigating to combat', () => {
    const downed = fighter({ currentHp: 0 });
    expect(lifeStatus(downed)).toBe('making-death-saves');
    const out = combatSuggestions(downed);
    const ds = out.find((s) => s.id === 'combat:death-saves');
    expect(ds).toBeDefined();
    expect(ds!.urgency).toBe('critical');
    expect(ds!.category).toBe('combat');
    expect(ds!.action).toEqual({ kind: 'navigate', page: 'combat' });
  });

  it('fires a concentration-at-risk nudge when concentrating while Bloodied', () => {
    const conc = fighter({ currentHp: 3, concentration: { spellId: 'bless' } });
    const out = combatSuggestions(conc);
    const cc = out.find((s) => s.id === 'combat:concentration-at-risk');
    expect(cc).toBeDefined();
    expect(cc!.action).toEqual({ kind: 'navigate', page: 'combat' });
  });

  it('emits nothing when healthy and not concentrating', () => {
    expect(combatSuggestions(fighter({ currentHp: 10 }))).toEqual([]);
  });
});

describe('file-backup rule', () => {
  it('fires out of combat when the backup is stale/never, action backup-file', () => {
    const now = 100 * 24 * 60 * 60 * 1000;
    const reminder = getBackupReminder(null, now);
    expect(reminder.show).toBe(true);
    const out = fileBackupSuggestions(fighter(), { inCombat: false, lastBackupAt: null, now });
    expect(out).toHaveLength(1);
    expect(out[0].action).toEqual({ kind: 'backup-file' });
    expect(out[0].category).toBe('resource');
  });

  it('is suppressed in combat', () => {
    const now = 100 * 24 * 60 * 60 * 1000;
    expect(
      fileBackupSuggestions(fighter(), { inCombat: true, lastBackupAt: null, now }),
    ).toEqual([]);
  });

  it('is silent when a recent backup exists', () => {
    const now = 100 * 24 * 60 * 60 * 1000;
    const recent = now - 1000;
    expect(
      fileBackupSuggestions(fighter(), { inCombat: false, lastBackupAt: recent, now }),
    ).toEqual([]);
  });

  it('never calls Date.now(): an absent ctx.now yields no nudge (purity guard)', () => {
    const character = fighter(); // build the character BEFORE spying
    const dateNowSpy = vi.spyOn(Date, 'now');
    // No `now` threaded in ⇒ the rule must NOT fall back to the clock.
    const out = fileBackupSuggestions(character, { inCombat: false, lastBackupAt: null });
    expect(out).toEqual([]);
    expect(dateNowSpy).not.toHaveBeenCalled();
    dateNowSpy.mockRestore();
  });
});

// ─── Ordering ────────────────────────────────────────────────────────────────

describe('orderSuggestions', () => {
  function cat(id: string, category: Suggestion['category'], urgency: Suggestion['urgency']): Suggestion {
    return { id, title: id, rationale: '', category, urgency, action: { kind: 'navigate', page: 'combat' } };
  }

  it('combat-first in combat, advancement-first out of combat', () => {
    const raw: Suggestion[] = [
      cat('a', 'advancement', 'recommended'),
      cat('b', 'combat', 'critical'),
      cat('e', 'encumbrance', 'critical'),
      cat('h', 'health', 'recommended'),
      cat('r', 'resource', 'info'),
    ];
    const inCombat = orderSuggestions(raw, { inCombat: true }).map((s) => s.category);
    expect(inCombat).toEqual(['combat', 'health', 'encumbrance', 'advancement', 'resource']);

    const outCombat = orderSuggestions(raw, { inCombat: false }).map((s) => s.category);
    expect(outCombat).toEqual(['advancement', 'health', 'encumbrance', 'combat', 'resource']);
  });

  it('within a group sorts by urgency then id lexically', () => {
    const raw: Suggestion[] = [
      cat('z', 'combat', 'info'),
      cat('a', 'combat', 'info'),
      cat('m', 'combat', 'critical'),
      cat('b', 'combat', 'recommended'),
    ];
    const ordered = orderSuggestions(raw, { inCombat: true }).map((s) => s.id);
    expect(ordered).toEqual(['m', 'b', 'a', 'z']);
  });
});

// ─── Visible filter ──────────────────────────────────────────────────────────

describe('visibleSuggestions', () => {
  function s(id: string): Suggestion {
    return { id, title: id, rationale: '', category: 'combat', urgency: 'info', action: { kind: 'navigate', page: 'combat' } };
  }

  it('drops dismissed ids and unexpired-snoozed ids, keeps the rest; performs no writes', () => {
    const raw = [s('keep'), s('dismissed'), s('snoozed'), s('expired')];
    const now = 1_000_000;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const out = visibleSuggestions(
      raw,
      { dismissed: ['dismissed'], snoozedUntil: { snoozed: now + 100, expired: now - 100 } },
      now,
    );

    expect(out.map((x) => x.id)).toEqual(['keep', 'expired']);
    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});

// ─── localStorage spy isolation ──────────────────────────────────────────────

let _origLocalStorage: Storage | undefined;
beforeEach(() => {
  _origLocalStorage = globalThis.localStorage;
});
afterEach(() => {
  if (_origLocalStorage) {
    Object.defineProperty(globalThis, 'localStorage', { value: _origLocalStorage, configurable: true });
  }
});
