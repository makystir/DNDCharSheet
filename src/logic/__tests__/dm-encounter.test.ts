import { describe, it, expect } from 'vitest';
import type { DmCombatant, DmEncounter } from '../../types/dm';
import { NPC_TEMPLATE_LIST } from '../../data/npc-templates';
import { generateRandomCharacter } from '../personal-details-generation';
import { createSeededRng, type RNG } from '../random';
import {
  addCombatants,
  addCondition,
  applyEncounterHpToParty,
  combatantFromCreature,
  combatantFromMember,
  combatantFromTemplate,
  createEncounter,
  customCombatant,
  dealDamage,
  endEncounter,
  giveTempHp,
  healCombatant,
  isDown,
  MAX_COMBATANTS,
  makeCopies,
  parseCopyCount,
  nextTurn,
  parseDamageTypes,
  previousTurn,
  recordDeathSave,
  removeCombatant,
  removeCondition,
  resolveConcentration,
  reviveCombatant,
  rollConcentrationSave,
  rollInitiatives,
  setConcentration,
  setInitiative,
  sortByInitiative,
  startEncounter,
  stabilizeCombatant,
  usableCreatures,
  saveEncounter,
  openEncounter,
  deleteEncounter,
  activeEncounter,
} from '../dm-encounter';
import {
  addImportedMember,
  addManualMember,
  createCampaign,
  DEFAULT_MANUAL_STATS,
  emptyDmData,
} from '../dm-campaign';
import { parseDmData } from '../dm-sanitize';

/** An RNG that yields the given d20 faces in order (face f is returned for rng() = (f - 0.5) / 20). */
function faces(...f: number[]): RNG {
  let i = 0;
  return () => (f[i++ % f.length] - 0.5) / 20;
}

let n = 0;
const id = () => `id${++n}`;

function mon(name: string, over: Partial<DmCombatant> = {}): DmCombatant {
  return { ...customCombatant(id(), { name, ac: 12, hpMax: 10, initiativeMod: 0 }), ...over };
}

function enc(...list: DmCombatant[]): DmEncounter {
  return addCombatants(createEncounter('e', 'Test', 1), list);
}

function started(...list: DmCombatant[]): DmEncounter {
  const r = startEncounter(enc(...list));
  if (!r.ok) throw new Error(r.error);
  return r.encounter;
}

describe('damage types in text', () => {
  it('finds the types named, ignoring case and filler words', () => {
    expect(parseDamageTypes('Fire; Poison')).toEqual(['Fire', 'Poison']);
    expect(parseDamageTypes('Bludgeoning, Piercing, and Slashing from nonmagical attacks')).toEqual([
      'Bludgeoning',
      'Piercing',
      'Slashing',
    ]);
    expect(parseDamageTypes('')).toEqual([]);
  });
});

describe('building combatants', () => {
  it('copies a Monster Manual NPC block exactly', () => {
    for (const t of NPC_TEMPLATE_LIST) {
      const c = combatantFromTemplate(t, 'x');
      expect(c.ac).toBe(t.stats.ac);
      expect(c.hp.max).toBe(t.stats.hpMax);
      expect(c.hp.hp).toBe(t.stats.hpMax);
      expect(c.initiativeMod).toBe(t.stats.initiativeMod);
      expect(c.kind).toBe('monster');
      expect(c.sourceLabel).toContain(`p.${t.page}`);
    }
  });

  it('only offers creatures with a fixed Armor Class and Hit Points', () => {
    const list = usableCreatures();
    expect(list.length).toBeGreaterThan(5);
    for (const cr of list) {
      const c = combatantFromCreature(cr, 'x');
      expect(c).toBeDefined();
      expect(c!.hp.max).toBeGreaterThan(0);
      expect(c!.ac).toBe(cr.ac);
    }
  });

  it('turns the how-many text into a count between 1 and the cap', () => {
    expect(parseCopyCount('3')).toBe(3);
    expect(parseCopyCount('')).toBe(1);
    expect(parseCopyCount('0')).toBe(1);
    expect(parseCopyCount('abc')).toBe(1);
    expect(parseCopyCount('2.9')).toBe(2);
    expect(parseCopyCount('9999')).toBe(MAX_COMBATANTS);
  });
  it('numbers copies and groups them for one Initiative roll', () => {
    let k = 0;
    const copies = makeCopies(mon('Goblin'), 3, () => `g${++k}`, true);
    expect(copies.map((c) => c.name)).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3']);
    expect(new Set(copies.map((c) => c.groupId)).size).toBe(1);
    expect(copies[0].groupId).toBeDefined();
    expect(makeCopies(mon('Ogre'), 1, id, true)[0].name).toBe('Ogre');
    expect(makeCopies(mon('Rat'), 2, id, false)[0].groupId).toBeUndefined();
    // Separate hit point pools, not one shared object.
    expect(copies[0].hp).not.toBe(copies[1].hp);
  });

  it('clamps a custom creature', () => {
    const c = customCombatant('x', { name: '   ', ac: Number.NaN, hpMax: -5, initiativeMod: 999 });
    expect(c.name).toBe('Creature');
    expect(c.hp.max).toBe(1);
    expect(c.initiativeMod).toBe(30);
  });

  it('mirrors a party member from a shared character and from hand-entered numbers', () => {
    const character = generateRandomCharacter(createSeededRng(8), {});
    let d = createCampaign(emptyDmData(), { id: 'c', name: 'T', now: 1 });
    d = addImportedMember(d, 'c', { id: 'm1', character, now: 1 }).data;
    d = addManualMember(d, 'c', {
      id: 'm2',
      name: 'Pip',
      stats: { ...DEFAULT_MANUAL_STATS, ac: 15, hpMax: 20, hpCurrent: 12 },
      now: 1,
    });
    const [a, b] = d.campaigns[0].party;
    const ca = combatantFromMember(a, 'x')!;
    expect(ca.kind).toBe('pc');
    expect(ca.memberId).toBe('m1');
    expect(ca.conSaveMod).toBeDefined();
    const cb = combatantFromMember(b, 'y')!;
    expect(cb).toMatchObject({ ac: 15, initiativeMod: 0 });
    expect(cb.hp).toMatchObject({ max: 20, hp: 12 });
  });
});

describe('initiative', () => {
  it('rolls d20 plus the modifier, and a group rolls once', () => {
    const copies = makeCopies(mon('Goblin', { initiativeMod: 2 }), 3, id, true);
    const solo = mon('Boss', { initiativeMod: -1 });
    const e = rollInitiatives(enc(...copies, solo), faces(10, 15), {});
    const byName = Object.fromEntries(e.combatants.map((c) => [c.name, c.initiative]));
    expect(byName['Goblin 1']).toBe(12);
    expect(byName['Goblin 2']).toBe(12);
    expect(byName['Goblin 3']).toBe(12);
    expect(byName['Boss']).toBe(14);
  });

  it('gives a surprised combatant Disadvantage (keeps the lower die)', () => {
    const e = rollInitiatives(enc(mon('Sleeper', { surprised: true, initiativeMod: 0 })), faces(18, 4), {});
    expect(e.combatants[0].initiative).toBe(4);
    const e2 = rollInitiatives(enc(mon('Awake')), faces(18, 4), {});
    expect(e2.combatants[0].initiative).toBe(18);
  });

  it('rolls only for monsters when asked, and skips what is already set unless rerolling', () => {
    const pc = mon('Hero', { kind: 'pc' });
    const m = mon('Orc');
    let e = rollInitiatives(enc(pc, m), faces(7), { monstersOnly: true });
    expect(e.combatants.find((c) => c.name === 'Hero')!.initiative).toBeNull();
    expect(e.combatants.find((c) => c.name === 'Orc')!.initiative).toBe(7);
    e = rollInitiatives(e, faces(19), {});
    expect(e.combatants.find((c) => c.name === 'Orc')!.initiative).toBe(7);
    expect(e.combatants.find((c) => c.name === 'Hero')!.initiative).toBe(19);
    e = rollInitiatives(e, faces(2), { reroll: true, ids: [m.id] });
    expect(e.combatants.find((c) => c.name === 'Orc')!.initiative).toBe(2);
  });

  it('will not start without Initiative for everyone, or without anyone', () => {
    expect(startEncounter(enc())).toMatchObject({ ok: false });
    const r = startEncounter(enc(mon('A'), mon('B')));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('A, B');
  });

  it('sorts highest first and keeps the current order for ties', () => {
    const a = mon('A');
    const b = mon('B');
    const c = mon('C');
    const d = mon('D');
    let e = enc(a, b, c, d);
    e = setInitiative(setInitiative(setInitiative(setInitiative(e, a.id, 10), b.id, 15), c.id, 10), d.id, 20);
    expect(sortByInitiative(e).combatants.map((x) => x.name)).toEqual(['D', 'B', 'A', 'C']);
  });
});

describe('turns and rounds', () => {
  function threeRound() {
    const a = mon('A');
    const b = mon('B');
    const c = mon('C');
    let e = enc(a, b, c);
    e = setInitiative(setInitiative(setInitiative(e, a.id, 20), b.id, 10), c.id, 5);
    const r = startEncounter(e);
    if (!r.ok) throw new Error(r.error);
    return { e: r.encounter, a, b, c };
  }

  it('starts at round 1 with the highest Initiative', () => {
    const { e, a } = threeRound();
    expect(e.status).toBe('running');
    expect(e.round).toBe(1);
    expect(e.activeId).toBe(a.id);
  });

  it('moves through the order and starts a new round after the last combatant', () => {
    let { e } = threeRound();
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      e = nextTurn(e);
      seen.push(`${e.round}:${e.combatants.find((c) => c.id === e.activeId)!.name}`);
    }
    expect(seen).toEqual(['1:B', '1:C', '2:A', '2:B']);
  });

  it('skips the dead and never loops forever when everyone is dead', () => {
    const { e: e0, b } = threeRound();
    let e = dealDamage(e0, b.id, { amount: 99 })!.encounter;
    e = nextTurn(e);
    expect(e.combatants.find((c) => c.id === e.activeId)!.name).toBe('C');
    for (const c of e.combatants) e = dealDamage(e, c.id, { amount: 99 })?.encounter ?? e;
    const same = nextTurn(e);
    expect(same.activeId).toBe(e.activeId);
  });

  it('can step back one turn, and not before round 1', () => {
    const { e: first, a } = threeRound();
    let e = first;
    expect(previousTurn(e).activeId).toBe(a.id);
    e = nextTurn(nextTurn(nextTurn(e)));
    expect(e.round).toBe(2);
    const back = previousTurn(e);
    expect(back.round).toBe(1);
    expect(back.combatants.find((c) => c.id === back.activeId)!.name).toBe('C');
  });

  it('inserts a late arrival by Initiative without moving the turn', () => {
    const { e: e0, a, b } = threeRound();
    const e1 = nextTurn(e0);
    const late = mon('Late', { initiative: 12 });
    const e2 = addCombatants(e1, [late]);
    expect(e2.combatants.map((c) => c.name)).toEqual(['A', 'Late', 'B', 'C']);
    expect(e2.activeId).toBe(b.id);
    expect(a.id).not.toBe(late.id);
  });

  it('hands the turn on when the active combatant is removed', () => {
    const { e, a } = threeRound();
    const after = removeCombatant(e, a.id);
    expect(after.combatants).toHaveLength(2);
    expect(after.activeId).toBe(after.combatants[0].id);
  });

  it('ends once, and not twice', () => {
    const { e } = threeRound();
    const done = endEncounter(e, 99);
    expect(done.status).toBe('ended');
    expect(done.activeId).toBeNull();
    expect(endEncounter(done, 100)).toBe(done);
    expect(nextTurn(done)).toBe(done);
  });
});

describe('damage and hit points', () => {
  it('kills a monster the moment it drops to 0 Hit Points (PHB Monster Death)', () => {
    const m = mon('Orc');
    const e = started(setInit(m));
    const out = dealDamage(e, m.id, { amount: 10 })!;
    expect(out.encounter.combatants[0].hp).toMatchObject({ hp: 0, dead: true });
  });

  it('lets the DM treat a monster like a character', () => {
    const m = mon('Boss', { diesLikeCharacter: true });
    const out = dealDamage(started(setInit(m)), m.id, { amount: 10 })!;
    const c = out.encounter.combatants[0];
    expect(c.hp.dead).toBe(false);
    expect(isDown(c)).toBe(true);
  });

  it('halves for Resistance (round down) then doubles for Vulnerability, and ignores Immunity', () => {
    const m = mon('Golem', { hp: { max: 100, hp: 100, temp: 0, deathSaves: { successes: 0, failures: 0 }, stable: false, dead: false } });
    const e = started(setInit(m));
    const resisted = dealDamage(e, m.id, { amount: 7, resistance: true })!;
    expect(resisted.result.damageDealt).toBe(3);
    const both = dealDamage(e, m.id, { amount: 7, resistance: true, vulnerability: true })!;
    expect(both.result.damageDealt).toBe(6);
    const immune = dealDamage(e, m.id, { amount: 7, immune: true })!;
    expect(immune.result.damageDealt).toBe(0);
    expect(immune.encounter.combatants[0].hp.hp).toBe(100);
  });

  it('spends Temp HP first and never stacks them', () => {
    const m = mon('Mage');
    let e = started(setInit(m));
    e = giveTempHp(e, m.id, 5);
    e = giveTempHp(e, m.id, 3);
    expect(e.combatants[0].hp.temp).toBe(5);
    e = giveTempHp(e, m.id, 3, 'replace');
    expect(e.combatants[0].hp.temp).toBe(3);
    const hit = dealDamage(e, m.id, { amount: 5 })!;
    expect(hit.encounter.combatants[0].hp).toMatchObject({ temp: 0, hp: 8 });
  });

  it('heals up to the maximum only', () => {
    const m = mon('Orc');
    let e = dealDamage(started(setInit(m)), m.id, { amount: 4 })!.encounter;
    e = healCombatant(e, m.id, 100);
    expect(e.combatants[0].hp.hp).toBe(10);
  });

  it('puts a player character at 0 HP on Death Saving Throws, not dead', () => {
    const pc = mon('Hero', { kind: 'pc' });
    const e = dealDamage(started(setInit(pc)), pc.id, { amount: 12 })!.encounter;
    const c = e.combatants[0];
    expect(c.hp.hp).toBe(0);
    expect(c.hp.dead).toBe(false);
    expect(isDown(c)).toBe(true);
  });

  it('records Death Saving Throws: three failures die, three successes stabilise, a natural 20 revives to 1 HP', () => {
    const pc = mon('Hero', { kind: 'pc' });
    const down = dealDamage(started(setInit(pc)), pc.id, { amount: 12 })!.encounter;

    let e = down;
    for (const d20 of [5, 3, 9]) e = recordDeathSave(e, pc.id, d20);
    expect(e.combatants[0].hp.dead).toBe(true);

    e = down;
    for (const d20 of [12, 15, 10]) e = recordDeathSave(e, pc.id, d20);
    expect(e.combatants[0].hp.stable).toBe(true);
    expect(recordDeathSave(e, pc.id, 3)).toBe(e);

    e = recordDeathSave(down, pc.id, 20);
    expect(e.combatants[0].hp.hp).toBe(1);

    e = recordDeathSave(down, pc.id, 1);
    expect(e.combatants[0].hp.deathSaves.failures).toBe(2);
    expect(recordDeathSave(down, pc.id, 0)).toBe(down);
    expect(recordDeathSave(down, pc.id, 21)).toBe(down);
  });

  it('stabilises and revives', () => {
    const pc = mon('Hero', { kind: 'pc' });
    const down = dealDamage(started(setInit(pc)), pc.id, { amount: 12 })!.encounter;
    expect(stabilizeCombatant(down, pc.id).combatants[0].hp.stable).toBe(true);
    const m = mon('Orc');
    const dead = dealDamage(started(setInit(m)), m.id, { amount: 99 })!.encounter;
    const back = reviveCombatant(dead, m.id, 3);
    expect(back.combatants[0].hp).toMatchObject({ hp: 3, dead: false });
  });

  it('ignores damage to someone already dead', () => {
    const m = mon('Orc');
    const dead = dealDamage(started(setInit(m)), m.id, { amount: 99 })!.encounter;
    expect(dealDamage(dead, m.id, { amount: 1 })).toBeUndefined();
  });
});

describe('concentration', () => {
  const big = { max: 1000, hp: 1000, temp: 0, deathSaves: { successes: 0, failures: 0 }, stable: false, dead: false };

  it('queues a Constitution save: DC is 10 or half the damage, whichever is higher, up to 30', () => {
    const m = mon('Mage', { hp: big });
    let e = setConcentration(started(setInit(m)), m.id, true, 'Hold Person');
    let out = dealDamage(e, m.id, { amount: 8 })!;
    expect(out.concentrationDc).toBe(10);
    expect(out.encounter.combatants[0].concentrationDcs).toEqual([10]);
    out = dealDamage(out.encounter, m.id, { amount: 30 })!;
    expect(out.concentrationDc).toBe(15);
    expect(out.encounter.combatants[0].concentrationDcs).toEqual([10, 15]);
    e = out.encounter;
    out = dealDamage(e, m.id, { amount: 90 })!;
    expect(out.concentrationDc).toBe(30);
  });

  it('asks for no save when the creature is not concentrating or took no damage', () => {
    const m = mon('Mage', { hp: big });
    const e = started(setInit(m));
    expect(dealDamage(e, m.id, { amount: 20 })!.concentrationDc).toBeNull();
    const conc = setConcentration(e, m.id, true);
    expect(dealDamage(conc, m.id, { amount: 20, immune: true })!.concentrationDc).toBeNull();
  });

  it('ends Concentration at once when the creature drops to 0 HP', () => {
    const m = mon('Mage');
    const e = setConcentration(started(setInit(m)), m.id, true, 'Fly');
    const out = dealDamage(e, m.id, { amount: 99 })!;
    expect(out.concentrationDc).toBeNull();
    expect(out.encounter.combatants[0].concentration.active).toBe(false);
    expect(out.encounter.log.join('\n')).toContain('loses Concentration');
  });

  it('resolves waiting saves one at a time', () => {
    const m = mon('Mage', { hp: big });
    let e = setConcentration(started(setInit(m)), m.id, true);
    e = dealDamage(dealDamage(e, m.id, { amount: 5 })!.encounter, m.id, { amount: 5 })!.encounter;
    e = resolveConcentration(e, m.id, true);
    expect(e.combatants[0].concentrationDcs).toHaveLength(1);
    expect(e.combatants[0].concentration.active).toBe(true);
    e = resolveConcentration(e, m.id, false);
    expect(e.combatants[0].concentration.active).toBe(false);
    expect(e.combatants[0].concentrationDcs).toEqual([]);
  });

  it('rolls the save: success when the total equals or beats the DC, no special natural 1 or 20', () => {
    const m = mon('Mage', { conSaveMod: 2, concentrationDcs: [12] });
    expect(rollConcentrationSave(m, faces(10))).toEqual({ d20: 10, total: 12, success: true });
    expect(rollConcentrationSave(m, faces(9))).toEqual({ d20: 9, total: 11, success: false });
    expect(rollConcentrationSave({ ...m, concentrationDcs: [30] }, faces(20))).toMatchObject({ total: 22, success: false });
    expect(rollConcentrationSave({ ...m, conSaveMod: undefined }, faces(10))).toBeUndefined();
    expect(rollConcentrationSave({ ...m, concentrationDcs: [] }, faces(10))).toBeUndefined();
  });
});

describe('conditions', () => {
  it('counts down timed conditions at each new round and removes them at 0', () => {
    const a = mon('A');
    const b = mon('B');
    let e = started(setInit(a, 20), setInit(b, 10));
    e = addCondition(e, a.id, 'poisoned', 2);
    e = addCondition(e, b.id, 'prone');
    expect(e.combatants[0].conditions).toEqual([{ id: 'poisoned', rounds: 2 }]);
    e = nextTurn(nextTurn(e)); // new round 2
    expect(e.round).toBe(2);
    expect(e.combatants[0].conditions).toEqual([{ id: 'poisoned', rounds: 1 }]);
    e = nextTurn(nextTurn(e)); // new round 3
    expect(e.combatants[0].conditions).toEqual([]);
    expect(e.combatants[1].conditions).toEqual([{ id: 'prone' }]);
    expect(e.log.join('\n')).toContain('A is no longer Poisoned');
  });

  it('replaces a condition of the same kind, and removes on request', () => {
    const a = mon('A');
    let e = started(setInit(a));
    e = addCondition(e, a.id, 'stunned', 3);
    e = addCondition(e, a.id, 'stunned', 1);
    expect(e.combatants[0].conditions).toEqual([{ id: 'stunned', rounds: 1 }]);
    e = removeCondition(e, a.id, 'stunned');
    expect(e.combatants[0].conditions).toEqual([]);
    expect(removeCondition(e, a.id, 'stunned')).toBe(e);
  });

  it('ignores a bad round count', () => {
    const a = mon('A');
    const e = addCondition(started(setInit(a)), a.id, 'blinded', -2);
    expect(e.combatants[0].conditions).toEqual([{ id: 'blinded' }]);
  });
});

describe('saving with a campaign', () => {
  it('saves, opens, deletes and sanitises encounters', () => {
    let d = createCampaign(emptyDmData(), { id: 'c', name: 'T', now: 1 });
    const m = mon('Orc');
    let e = started(setInit(m));
    e = setConcentration(e, m.id, true, 'Bless');
    d = saveEncounter(d, 'c', e, 5);
    d = openEncounter(d, 'c', e.id);
    expect(activeEncounter(d.campaigns[0])?.id).toBe(e.id);
    const back = parseDmData(JSON.stringify(d));
    expect(back.ok).toBe(true);
    if (back.ok) {
      const saved = back.data.campaigns[0].encounters[0];
      expect(saved.status).toBe('running');
      expect(saved.combatants[0].concentration).toEqual({ active: true, label: 'Bless' });
      expect(back.data.campaigns[0].activeEncounterId).toBe(e.id);
    }
    d = deleteEncounter(d, 'c', e.id, 9);
    expect(d.campaigns[0].encounters).toEqual([]);
    expect(d.campaigns[0].activeEncounterId).toBeNull();
  });

  it('survives damaged encounter data', () => {
    const raw = {
      campaigns: [
        {
          id: 'c',
          name: 'T',
          party: [],
          activeEncounterId: 'zzz',
          encounters: [
            'nope',
            { id: 'e1', status: 'running', round: -5, activeId: 'missing', combatants: [{ id: 'x', hp: 'bad' }, { id: 'ok', name: 'Orc', hp: { max: 10, hp: 99 }, conditions: [{ id: 'poisoned', rounds: 'x' }, { id: 'exhaustion' }, 3] }] },
          ],
        },
      ],
    };
    const out = parseDmData(JSON.stringify(raw));
    expect(out.ok).toBe(true);
    if (out.ok) {
      const e = out.data.campaigns[0].encounters[0];
      expect(e.round).toBe(1);
      expect(e.activeId).toBeNull();
      expect(e.combatants).toHaveLength(1);
      expect(e.combatants[0].hp).toMatchObject({ max: 10, hp: 10 });
      expect(e.combatants[0].conditions).toEqual([{ id: 'poisoned' }]);
      expect(out.data.campaigns[0].activeEncounterId).toBeNull();
    }
  });

  it('copies end-of-fight Hit Points onto the party cards', () => {
    const character = generateRandomCharacter(createSeededRng(9), {});
    let d = createCampaign(emptyDmData(), { id: 'c', name: 'T', now: 1 });
    d = addImportedMember(d, 'c', { id: 'm1', character, now: 1 }).data;
    d = addManualMember(d, 'c', { id: 'm2', name: 'Pip', stats: { ...DEFAULT_MANUAL_STATS, hpMax: 20, hpCurrent: 20 }, now: 1 });
    const [a, b] = d.campaigns[0].party;
    const ca = { ...combatantFromMember(a, 'ca')!, initiative: 10 };
    const cb = { ...combatantFromMember(b, 'cb')!, initiative: 5 };
    let e = started(ca, cb);
    e = dealDamage(e, 'ca', { amount: 3 })!.encounter;
    e = dealDamage(e, 'cb', { amount: 8 })!.encounter;
    const after = applyEncounterHpToParty(d, 'c', e, 7);
    const [pa, pb] = after.campaigns[0].party;
    expect(pa.character?.currentHp).toBe(ca.hp.hp - 3);
    expect(pb.manual?.hpCurrent).toBe(12);
  });
});

/** Give a combatant an Initiative so an encounter can start. */
function setInit(c: DmCombatant, value = 10): DmCombatant {
  return { ...c, initiative: value };
}
