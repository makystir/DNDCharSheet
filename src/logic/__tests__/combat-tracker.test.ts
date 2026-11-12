import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character } from '../../types/character';
import {
  MAX_EFFECTS,
  addEffect,
  advanceEffects,
  extendEffect,
  removeEffect,
  sanitizeEffects,
  tickEffect,
} from '../combat-effects';
import {
  beginFight,
  currentRound,
  endFight,
  initiativeResult,
  isInFight,
  nextRound,
  recordInitiative,
} from '../combat-round';
import { saveConditionEffects } from '../save-conditions';
import { importFromJSON } from '../../storage/export-import';

const base = (): Character => createCharacter('Tester');

describe('combat effects', () => {
  it('adds, trims and bounds an effect', () => {
    const c = addEffect(base(), { name: '  Bless  ', rounds: 10, note: ' +1d4 ' }, 'a');
    expect(c.effects).toEqual([{ id: 'a', name: 'Bless', rounds: 10, note: '+1d4' }]);
  });

  it('refuses a blank name, a bad round count, and a full list', () => {
    const c = base();
    expect(addEffect(c, { name: '   ' }, 'a')).toBe(c);
    expect(addEffect(c, { name: 'X', rounds: 0 }, 'a')).toBe(c);
    expect(addEffect(c, { name: 'X', rounds: 1.5 }, 'a')).toBe(c);
    let full = c;
    for (let i = 0; i < MAX_EFFECTS; i += 1) full = addEffect(full, { name: `E${i}` }, `id${i}`);
    expect(addEffect(full, { name: 'one more' }, 'z')).toBe(full);
  });

  it('counts effects down together and removes those that reach 0', () => {
    let c = addEffect(base(), { name: 'Bless', rounds: 1 }, 'a');
    c = addEffect(c, { name: 'Rage', rounds: 3 }, 'b');
    c = addEffect(c, { name: 'Mage Armor' }, 'c');
    const r = advanceEffects(c, 1);
    expect(r.expired).toEqual(['Bless']);
    expect(r.character.effects).toEqual([
      { id: 'b', name: 'Rage', rounds: 2 },
      { id: 'c', name: 'Mage Armor' },
    ]);
    expect(r.character.eventLog?.some((e) => e.type === 'effect-expired')).toBe(true);
  });

  it('removes the field when the last effect goes', () => {
    const c = addEffect(base(), { name: 'Bless', rounds: 1 }, 'a');
    expect('effects' in tickEffect(c, 'a').character).toBe(false);
    expect('effects' in removeEffect(c, 'a')).toBe(false);
  });

  it('ticks and extends a single effect, and ignores one with no timer', () => {
    let c = addEffect(base(), { name: 'Rage', rounds: 3 }, 'a');
    c = addEffect(c, { name: 'Mage Armor' }, 'b');
    expect(tickEffect(c, 'a').character.effects?.[0].rounds).toBe(2);
    expect(extendEffect(c, 'a').effects?.[0].rounds).toBe(4);
    expect(tickEffect(c, 'b').character).toBe(c);
    expect(extendEffect(c, 'b')).toBe(c);
  });

  it('sanitizes untrusted effects', () => {
    expect(sanitizeEffects('nope')).toBeUndefined();
    expect(sanitizeEffects([])).toBeUndefined();
    expect(
      sanitizeEffects([
        { id: 'a', name: ' Bless ', rounds: 4, note: 'x' },
        { id: 'a', name: 'duplicate id' },
        { id: 'b', name: '', rounds: 2 },
        { id: 'c', name: 'Bad rounds', rounds: -3 },
        { id: 5, name: 'bad id' },
        null,
        'x',
      ]),
    ).toEqual([
      { id: 'a', name: 'Bless', rounds: 4, note: 'x' },
      { id: 'c', name: 'Bad rounds' },
    ]);
    expect(sanitizeEffects(Array.from({ length: 50 }, (_, i) => ({ id: `i${i}`, name: 'n' })))).toHaveLength(MAX_EFFECTS);
  });

  it('is dropped or cleaned when a character is imported', () => {
    const json = JSON.stringify({
      ...base(),
      effects: [
        { id: 'a', name: 'Bless', rounds: 2 },
        { id: 'b', name: 'x'.repeat(500), rounds: 99999999 },
      ],
    });
    const out = importFromJSON(json);
    expect(out.success).toBe(true);
    expect(out.character?.effects).toHaveLength(2);
    expect(out.character?.effects?.[0]).toEqual({ id: 'a', name: 'Bless', rounds: 2 });
    expect(out.character?.effects?.[1].name).toHaveLength(60);
    expect(out.character?.effects?.[1].rounds).toBeUndefined();
    const bad = importFromJSON(JSON.stringify({ ...base(), effects: 'oops' }));
    expect(bad.character && 'effects' in bad.character).toBe(false);
  });
});

describe('fight tracker', () => {
  it('starts at round 1 and only once', () => {
    const c = beginFight(base());
    expect(isInFight(c)).toBe(true);
    expect(currentRound(c)).toBe(1);
    expect(beginFight(c)).toBe(c);
    expect(currentRound(base())).toBe(0);
  });

  it('Next round starts a fight at round 1 if none is on, then adds a round each time', () => {
    const first = nextRound(base());
    expect(first.round).toBe(1);
    const second = nextRound(first.character);
    expect(second.round).toBe(2);
    expect(second.character.combat?.tickedThroughRound).toBe(2);
  });

  it('Next round ticks timed conditions and effects and lists what ended', () => {
    let c = beginFight({
      ...base(),
      conditions: [
        { id: 'poisoned' as const, duration: { kind: 'rounds' as const, rounds: 1 } },
        { id: 'blinded' as const, duration: { kind: 'long-rest' as const } },
      ],
    });
    c = addEffect(c, { name: 'Bless', rounds: 1 }, 'a');
    const r = nextRound(c);
    expect(r.expired).toEqual(['Poisoned', 'Bless']);
    expect(r.character.conditions).toEqual([{ id: 'blinded', duration: { kind: 'long-rest' } }]);
  });

  it('keeps and clears the initiative result', () => {
    const c = recordInitiative(base(), 17.9);
    expect(isInFight(c)).toBe(true);
    expect(initiativeResult(c)).toBe(17);
    expect(recordInitiative(base(), Number.NaN).combat).toBeUndefined();
    const over = endFight(c);
    expect(over.combat).toBeUndefined();
    expect(initiativeResult(over)).toBeUndefined();
  });
});

describe('saveConditionEffects', () => {
  it('reads auto-fail and Disadvantage from the condition catalog', () => {
    const c: Character = { ...base(), conditions: [{ id: 'restrained' }, { id: 'stunned' }] };
    const dex = saveConditionEffects(c, 'dex');
    expect(dex.autoFailFrom).toEqual(['Stunned']);
    expect(dex.disadvantageFrom).toEqual(['Restrained']);
    expect(saveConditionEffects(c, 'str').autoFailFrom).toEqual(['Stunned']);
    expect(saveConditionEffects(c, 'str').disadvantageFrom).toEqual([]);
    expect(saveConditionEffects(c, 'wis')).toEqual({ autoFailFrom: [], disadvantageFrom: [] });
  });

  it('includes conditions implied by 0 HP (Unconscious)', () => {
    const c: Character = { ...base(), currentHp: 0, level: 1, classes: [{ id: 'fighter', level: 1 }] };
    expect(saveConditionEffects(c, 'dex').autoFailFrom.length).toBeGreaterThan(0);
  });
});
