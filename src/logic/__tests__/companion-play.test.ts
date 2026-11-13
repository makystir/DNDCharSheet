import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, CompanionRecord } from '../../types/character';
import {
  availableSlots,
  combatAllies,
  companionRestPlan,
  companionsLongRest,
  companionSuggestions,
  primalCompanionMissing,
  revivePrimalCompanion,
  swapPrimalBeast,
} from '../companion-play';
import { slotLevels } from '../spell-slot-spend';

function ranger(level = 5, wis = 16): Character {
  const c = createCharacter('Ranger');
  return { ...c, level, abilities: { ...c.abilities, wis }, classes: [{ id: 'ranger', level, subclassId: 'beastMaster' }] };
}

const primal: CompanionRecord = { id: 'p1', creatureId: 'beast-of-the-land', origin: 'primal-companion', nickname: 'Ash' };

describe('combatAllies', () => {
  it('lists active allies with HP, AC (with its breakdown) and the first attack; dismissed ones are left out', () => {
    const c: Character = {
      ...ranger(5, 16),
      companions: [primal, { id: 'cat', creatureId: 'cat', origin: 'pet', dismissed: true }],
      hirelings: [{ id: 'h1', name: 'Smith', kind: 'skilled', units: 1, stats: { ac: 16, hpMax: 11 } }],
    };
    const allies = combatAllies(c);
    expect(allies.map((a) => a.name)).toEqual(['Ash', 'Smith']);
    const ash = allies[0];
    expect(ash.tab).toBe('creatures');
    // Beast of the Land: AC 13 + Wis +3; HP 5 + 5 x Ranger level (PHB Beast Master).
    expect(ash.ac?.text).toBe('16');
    expect(ash.ac?.breakdown?.total).toBe(16);
    expect(ash.hp).toEqual({ current: 30, max: 30 });
    expect(ash.attack?.name).toBe("Beast's Strike");
    expect(allies[1]).toMatchObject({ tab: 'people', ac: { text: '16' }, hp: { current: 11, max: 11 }, attack: null });
  });
});

describe('companionsLongRest', () => {
  it('restores HP, clears Temp HP and lowers Exhaustion by 1, skipping anyone at 0 HP and dismissed creatures', () => {
    const c: Character = {
      ...ranger(5, 16),
      companions: [
        { ...primal, hp: 10, tempHp: 4, exhaustionLevel: 2 },
        { id: 'w', creatureId: 'wolf', origin: 'pet', nickname: 'Down', hp: 0 },
        { id: 'd', creatureId: 'owl', origin: 'pet', dismissed: true, hp: 1 },
      ],
      hirelings: [{ id: 'h1', name: 'Smith', kind: 'skilled', units: 1, stats: { hpMax: 11 }, hp: 3, exhaustionLevel: 1 }],
    };
    expect(companionRestPlan(c)).toEqual({ resting: ['Ash', 'Smith'], atZero: ['Down'] });
    const next = companionsLongRest(c);
    expect(next.companions?.[0]).toEqual({ ...primal, exhaustionLevel: 1 });
    expect(next.companions?.[1].hp).toBe(0);
    expect(next.companions?.[2].hp).toBe(1);
    expect(next.hirelings?.[0]).toEqual({ id: 'h1', name: 'Smith', kind: 'skilled', units: 1, stats: { hpMax: 11 } });
  });

  it('returns the same character when nobody can rest', () => {
    const c = createCharacter('Alone');
    expect(companionsLongRest(c)).toBe(c);
  });
});

describe('Primal Companion revive and swap', () => {
  it('revives a beast at 0 HP by expending the chosen slot, restoring all its HP', () => {
    const c: Character = { ...ranger(5, 16), companions: [{ ...primal, hp: 0 }] };
    const slots = availableSlots(c);
    expect(slots[0]).toEqual({ kind: 'standard', level: 1 });
    const next = revivePrimalCompanion(c, 'p1', { kind: 'standard', level: 2 });
    expect(next).not.toBeNull();
    expect(next?.companions?.[0].hp).toBeUndefined();
    expect(slotLevels(next as Character).find((s) => s.level === 2)?.expended).toBe(1);
  });

  it('refuses to revive a beast that is not at 0 HP, or without that slot', () => {
    const alive: Character = { ...ranger(5, 16), companions: [primal] };
    expect(revivePrimalCompanion(alive, 'p1', { kind: 'standard', level: 1 })).toBeNull();
    const down: Character = { ...ranger(5, 16), companions: [{ ...primal, hp: 0 }] };
    expect(revivePrimalCompanion(down, 'p1', { kind: 'standard', level: 5 })).toBeNull();
  });

  it('summons a different beast fresh, keeping the nickname', () => {
    const c: Character = { ...ranger(5, 16), companions: [{ ...primal, hp: 3, tempHp: 2, conditions: [{ id: 'prone' }], appearance: 'grey wolf' }] };
    const next = swapPrimalBeast(c, 'p1', 'beast-of-the-sky');
    expect(next?.companions?.[0]).toEqual({ id: 'p1', creatureId: 'beast-of-the-sky', origin: 'primal-companion', nickname: 'Ash', appearance: 'grey wolf' });
    expect(swapPrimalBeast(c, 'p1', 'wolf')).toBeNull();
    expect(swapPrimalBeast(c, 'p1', 'beast-of-the-land')).toBeNull();
  });
});

describe('companionSuggestions', () => {
  it('suggests the Primal Companion to a Beast Master until one is added', () => {
    expect(companionSuggestions(ranger(3)).map((s) => s.origin)).toContain('primal-companion');
    expect(primalCompanionMissing(ranger(3))).toBe(true);
    expect(primalCompanionMissing({ ...ranger(3), companions: [primal] })).toBe(false);
    expect(primalCompanionMissing(ranger(2))).toBe(false);
  });

  it('suggests Find Steed to a level 5 Paladin and Pact of the Chain to a Warlock with it', () => {
    const paladin: Character = { ...createCharacter('Pal'), level: 5, classes: [{ id: 'paladin', level: 5 }] };
    expect(companionSuggestions(paladin).map((s) => s.origin)).toEqual(['find-steed']);
    const warlock: Character = {
      ...createCharacter('Lock'),
      level: 3,
      classes: [{ id: 'warlock', level: 3 }],
      classChoices: { 'warlock.invocations': ['pact-of-the-chain'] },
    };
    expect(companionSuggestions(warlock).map((s) => s.origin)).toEqual(['pact-of-the-chain']);
    expect(companionSuggestions(createCharacter('Nobody'))).toEqual([]);
  });
});
