import { describe, it, expect } from 'vitest';
import { MONSTER_MANUAL_2024_LIST } from '../../data/monster-manual-2024';
import {
  addCombatants,
  combatantFromMonsterManual,
  createEncounter,
  customCombatant,
  dealDamage,
  duplicateCombatant,
  duplicateEncounter,
  setLegendaryInLair,
  spendLegendaryAction,
  startEncounter,
} from '../dm-encounter';
import { sanitizeDmData } from '../dm-sanitize';
import { createCampaign, emptyDmData } from '../dm-campaign';
import { saveEncounter } from '../dm-encounter';

let n = 0;
const id = () => `id${++n}`;
const entry = (name: string) => MONSTER_MANUAL_2024_LIST.find((e) => e.name === name)!;

describe('legendary uses come from the stat block', () => {
  it('reads the printed count and the in-lair count (Aboleth: 3, 4 in Lair)', () => {
    const c = combatantFromMonsterManual(entry('Aboleth'), 'a');
    expect(c.legendary).toEqual({ max: 3, used: 0 });
    expect(c.legendaryLair).toEqual({ normal: 3, inLair: 4, active: false });
  });

  it('reads the count for every creature with legendary actions, without a default', () => {
    for (const e of MONSTER_MANUAL_2024_LIST.filter((x) => x.legendaryActions.length > 0)) {
      const c = combatantFromMonsterManual(e, 'x');
      expect(c.legendary?.max, e.name).toBe(e.legendaryActionUses?.normal);
    }
  });

  it('gives no legendary tracker when the entry prints no count', () => {
    const e = { ...entry('Aboleth'), legendaryActionUses: undefined };
    expect(combatantFromMonsterManual(e, 'a').legendary).toBeUndefined();
  });

  it('toggles In Lair, changing the maximum and keeping used within it', () => {
    let enc = addCombatants(createEncounter('e', 'T', 1), [{ ...combatantFromMonsterManual(entry('Aboleth'), 'a'), initiative: 5 }]);
    const started = startEncounter(enc);
    if (!started.ok) throw new Error(started.error);
    enc = started.encounter;
    enc = setLegendaryInLair(enc, 'a', true);
    expect(enc.combatants[0].legendary).toEqual({ max: 4, used: 0 });
    enc = spendLegendaryAction(enc, 'a');
    enc = spendLegendaryAction(enc, 'a');
    enc = spendLegendaryAction(enc, 'a');
    enc = spendLegendaryAction(enc, 'a');
    expect(enc.combatants[0].legendary).toEqual({ max: 4, used: 4 });
    enc = setLegendaryInLair(enc, 'a', false);
    expect(enc.combatants[0].legendary).toEqual({ max: 3, used: 3 });
    expect(enc.combatants[0].legendaryLair?.active).toBe(false);
  });

  it('ignores the toggle for a creature without an in-lair count', () => {
    const base = customCombatant('c', { name: 'X', ac: 10, hpMax: 5, initiativeMod: 0 });
    const enc = addCombatants(createEncounter('e', 'T', 1), [{ ...base, legendary: { max: 2, used: 0 } }]);
    expect(setLegendaryInLair(enc, 'c', true)).toBe(enc);
  });

  it('survives the sanitizer, and old saves without the field still load', () => {
    const enc = addCombatants(createEncounter('e', 'T', 1), [combatantFromMonsterManual(entry('Aboleth'), 'a')]);
    const lair = setLegendaryInLair(enc, 'a', true);
    let d = createCampaign(emptyDmData(), { id: 'c', name: 'C', now: 1 });
    d = saveEncounter(d, 'c', lair, 1);
    const back = sanitizeDmData(JSON.parse(JSON.stringify(d))).campaigns[0].encounters[0].combatants[0];
    expect(back.legendary).toEqual({ max: 4, used: 0 });
    expect(back.legendaryLair).toEqual({ normal: 3, inLair: 4, active: true });

    const old = JSON.parse(JSON.stringify(d));
    delete old.campaigns[0].encounters[0].combatants[0].legendaryLair;
    const loaded = sanitizeDmData(old).campaigns[0].encounters[0].combatants[0];
    expect(loaded.legendaryLair).toBeUndefined();
    expect(loaded.legendary?.max).toBe(4);
  });
});

describe('duplicating', () => {
  const goblin = () => customCombatant('g1', { name: 'Goblin', ac: 13, hpMax: 7, initiativeMod: 2 });

  it('adds one fresh numbered copy of a combatant', () => {
    let enc = addCombatants(createEncounter('e', 'T', 1), [goblin()]);
    enc = dealDamage(enc, 'g1', { amount: 4 })!.encounter;
    enc = duplicateCombatant(enc, 'g1', id);
    expect(enc.combatants.map((c) => c.name)).toEqual(['Goblin', 'Goblin 2']);
    expect(enc.combatants[1].hp.hp).toBe(7);
    expect(enc.combatants[1].id).not.toBe('g1');
    enc = duplicateCombatant(enc, enc.combatants[1].id, id);
    expect(enc.combatants.map((c) => c.name)).toEqual(['Goblin', 'Goblin 2', 'Goblin 3']);
  });

  it('does not duplicate a player character', () => {
    const pc = { ...goblin(), kind: 'pc' as const };
    const enc = addCombatants(createEncounter('e', 'T', 1), [pc]);
    expect(duplicateCombatant(enc, 'g1', id)).toBe(enc);
  });

  it('copies an encounter back to setup at full Hit Points with new ids', () => {
    let enc = addCombatants(createEncounter('e', 'Ambush', 1), [
      { ...goblin(), initiative: 12, groupId: 'grp' },
      { ...goblin(), id: 'g2', name: 'Goblin 2', initiative: 12, groupId: 'grp' },
    ]);
    enc = dealDamage(enc, 'g1', { amount: 99 })!.encounter;
    const started = startEncounter(enc);
    if (!started.ok) throw new Error(started.error);
    const copy = duplicateEncounter({ ...started.encounter, log: ['x'] }, id, 5);
    expect(copy.name).toBe('Ambush (copy)');
    expect(copy.status).toBe('setup');
    expect(copy.round).toBe(0);
    expect(copy.activeId).toBeNull();
    expect(copy.log).toEqual([]);
    expect(copy.id).not.toBe('e');
    expect(copy.combatants).toHaveLength(2);
    expect(copy.combatants.every((c) => c.hp.hp === 7 && !c.hp.dead && c.initiative === null)).toBe(true);
    expect(copy.combatants.some((c) => c.id === 'g1' || c.id === 'g2')).toBe(false);
    expect(copy.combatants[0].groupId).toBe(copy.combatants[1].groupId);
    expect(copy.combatants[0].groupId).not.toBe('grp');
  });
});
