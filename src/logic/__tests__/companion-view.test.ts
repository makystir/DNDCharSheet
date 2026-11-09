import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, ClassEntry } from '../../types/character';
import {
  primalCompanionOwner,
  resolveLiveOtherworldlySteed,
  resolveLivePrimalCompanion,
  steedCastingEntry,
} from '../companion-view';

function ranger(level: number, wis: number, subclassId: 'beastMaster' | 'hunter' | undefined = 'beastMaster'): Character {
  const c = createCharacter('Ranger');
  const entry: ClassEntry = { id: 'ranger', level, ...(subclassId ? { subclassId } : {}) };
  return { ...c, level, abilities: { ...c.abilities, wis }, classes: [entry] };
}

function paladin(level: number, cha: number): Character {
  const c = createCharacter('Paladin');
  return { ...c, level, abilities: { ...c.abilities, cha }, classes: [{ id: 'paladin', level }] };
}

describe('primalCompanionOwner', () => {
  it('reads Ranger level, Wisdom modifier and Proficiency Bonus from the character', () => {
    const owner = primalCompanionOwner(ranger(5, 16));
    expect(owner).toMatchObject({ rangerLevel: 5, wisdomModifier: 3, proficiencyBonus: 3, isBeastMaster: true, ok: true });
    expect(owner.warning).toBeUndefined();
  });

  it('is not ok below Ranger level 3 and explains why', () => {
    const owner = primalCompanionOwner(ranger(2, 16));
    expect(owner.ok).toBe(false);
    expect(owner.warning).toMatch(/level 3/);
  });

  it('is not ok for a non-Ranger', () => {
    const owner = primalCompanionOwner(paladin(5, 16));
    expect(owner).toMatchObject({ rangerLevel: 0, ok: false, isBeastMaster: false });
  });

  it('warns but still computes for a Ranger who is not a Beast Master', () => {
    const owner = primalCompanionOwner(ranger(5, 16, 'hunter'));
    expect(owner.ok).toBe(true);
    expect(owner.isBeastMaster).toBe(false);
    expect(owner.warning).toMatch(/not a Beast Master/);
  });

  it('counts only the Ranger levels of a multiclass character', () => {
    const c = createCharacter('Multi');
    const multi: Character = {
      ...c,
      level: 8,
      abilities: { ...c.abilities, wis: 14 },
      classes: [
        { id: 'ranger', level: 5, subclassId: 'beastMaster' },
        { id: 'fighter', level: 3 },
      ],
    };
    expect(primalCompanionOwner(multi)).toMatchObject({ rangerLevel: 5, proficiencyBonus: 3, wisdomModifier: 2 });
  });
});

describe('resolveLivePrimalCompanion (live numbers)', () => {
  it('Beast of the Land at Ranger 5, Wis +3: AC 16, HP 30, attack +6, DC 14', () => {
    const live = resolveLivePrimalCompanion(ranger(5, 16), 'beast-of-the-land');
    expect(live).not.toBeNull();
    expect(live?.armorClass).toEqual({ total: 16, components: [{ label: 'Base', value: 13 }, { label: 'Wisdom mod', value: 3 }] });
    expect(live?.hitPoints.total).toBe(30);
    expect(live?.hitPoints.components.reduce((s, c) => s + c.value, 0)).toBe(30);
    expect(live?.hitDice.total).toBe(5);
    expect(live?.attackBonus.total).toBe(6);
    expect(live?.spellSaveDc.total).toBe(14);
    expect(live?.primalBond.total).toBe(3);
    expect(live?.stats.exceptionalTraining).toBe(false);
  });

  it('updates when the Ranger levels up (upgrades at 7, 11, 15) and when Wisdom changes', () => {
    const at5 = resolveLivePrimalCompanion(ranger(5, 16), 'beast-of-the-land');
    const at7 = resolveLivePrimalCompanion(ranger(7, 16), 'beast-of-the-land');
    const at11 = resolveLivePrimalCompanion(ranger(11, 16), 'beast-of-the-land');
    const at15 = resolveLivePrimalCompanion(ranger(15, 16), 'beast-of-the-land');
    expect(at7?.hitPoints.total).toBe(40);
    expect(at7?.stats.exceptionalTraining).toBe(true);
    expect(at7?.stats.bestialFury).toBe(false);
    expect(at11?.stats.bestialFury).toBe(true);
    expect(at11?.stats.strikesPerCommand).toBe(2);
    expect(at15?.stats.shareSpells).toBe(true);
    expect(at15?.attackBonus.total).toBeGreaterThan(at5!.attackBonus.total);
    const wis20 = resolveLivePrimalCompanion(ranger(5, 20), 'beast-of-the-land');
    expect(wis20?.armorClass.total).toBe(18);
    expect(wis20?.strikeDamageBonus.total).toBe(at5!.strikeDamageBonus.total + 2);
  });

  it('Beast of the Sky uses the 4 + 4 x level HP formula', () => {
    expect(resolveLivePrimalCompanion(ranger(5, 16), 'beast-of-the-sky')?.hitPoints.total).toBe(24);
  });

  it('every breakdown sums to its total', () => {
    const live = resolveLivePrimalCompanion(ranger(9, 18), 'beast-of-the-sea');
    for (const b of [live!.armorClass, live!.hitPoints, live!.hitDice, live!.attackBonus, live!.strikeDamageBonus, live!.spellSaveDc, live!.primalBond]) {
      expect(b.components.reduce((s, c) => s + c.value, 0)).toBe(b.total);
    }
    expect(live?.stats.strike.grappleEscapeDc).toBe(live?.spellSaveDc.total);
  });

  it('returns null (no invented numbers) below Ranger level 3', () => {
    expect(resolveLivePrimalCompanion(ranger(2, 16), 'beast-of-the-land')).toBeNull();
    expect(resolveLivePrimalCompanion(paladin(5, 16), 'beast-of-the-land')).toBeNull();
  });
});

describe('resolveLiveOtherworldlySteed', () => {
  it('scales with the slot level and uses the owner spellcasting for attack and DC', () => {
    const live = resolveLiveOtherworldlySteed(paladin(5, 16), { spellSlotLevel: 3, steedType: 'Celestial' });
    expect(live.spellLevel).toBe(3);
    expect(live.armorClass.total).toBe(13);
    expect(live.hitPoints.total).toBe(35);
    expect(live.hitPoints.components.reduce((s, c) => s + c.value, 0)).toBe(35);
    expect(live.hasSpellcasting).toBe(true);
    expect(live.attackBonus?.total).toBe(6);
    expect(live.spellSaveDc?.total).toBe(14);
    expect(live.stats.speeds.fly).toBeUndefined();
    expect(live.stats.healingTouch).toEqual({ dice: '2d8', flat: 3 });
    expect(live.slamBonus.total).toBe(3);
  });

  it('gains the Fly Speed from a level 4 slot and changes with the owner Charisma', () => {
    const low = resolveLiveOtherworldlySteed(paladin(5, 16), { spellSlotLevel: 4, steedType: 'Fiend' });
    const high = resolveLiveOtherworldlySteed(paladin(5, 20), { spellSlotLevel: 4, steedType: 'Fiend' });
    expect(low.stats.speeds.fly).toBeGreaterThan(0);
    expect(high.attackBonus!.total).toBe(low.attackBonus!.total + 2);
    expect(high.stats.fellGlare?.dc).toBe(high.spellSaveDc!.total);
  });

  it('clamps the slot level to 2-9 and defaults to 2 / the first type, flagging the assumed type', () => {
    expect(resolveLiveOtherworldlySteed(paladin(5, 16), { spellSlotLevel: 12 }).spellLevel).toBe(9);
    expect(resolveLiveOtherworldlySteed(paladin(5, 16), { spellSlotLevel: 0 }).spellLevel).toBe(2);
    const dflt = resolveLiveOtherworldlySteed(paladin(5, 16), {});
    expect(dflt.spellLevel).toBe(2);
    expect(dflt.typeAssumed).toBe(true);
    expect(dflt.creatureType).toBe('Celestial');
  });

  it('still resolves AC and HP without a spellcasting class, with attack and DC unavailable', () => {
    const c = createCharacter('Fighter');
    const fighter: Character = { ...c, level: 5, classes: [{ id: 'fighter', level: 5 }] };
    const live = resolveLiveOtherworldlySteed(fighter, { spellSlotLevel: 2, steedType: 'Fey' });
    expect(live.hasSpellcasting).toBe(false);
    expect(live.attackBonus).toBeNull();
    expect(live.spellSaveDc).toBeNull();
    expect(live.armorClass.total).toBe(12);
    expect(live.hitPoints.total).toBe(25);
  });
});

describe('steedCastingEntry', () => {
  it('prefers the chosen class, else the first spellcasting class', () => {
    const c = createCharacter('Multi');
    const multi: Character = {
      ...c,
      level: 10,
      classes: [
        { id: 'paladin', level: 5 },
        { id: 'ranger', level: 5, subclassId: 'beastMaster' },
      ],
    };
    expect(steedCastingEntry(multi, 'ranger')?.id).toBe('ranger');
    expect(steedCastingEntry(multi)?.id).toBe('paladin');
    expect(steedCastingEntry(multi, 'wizard')?.id).toBe('paladin');
  });
});
