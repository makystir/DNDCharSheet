import { describe, it, expect } from 'vitest';
import { NPC_TEMPLATE_LIST } from '../../data/npc-templates';
import { CREATURE_LIST } from '../../data/creatures';
import { MONSTER_MANUAL_2024_LIST } from '../../data/monster-manual-2024';
import { abilityModifier } from '../abilities';
import {
  blankCustomMonster,
  builtInMonsters,
  combatantFromLibrary,
  crOptions,
  crToNumber,
  customFromLibrary,
  deleteCustomMonster,
  filterMonsters,
  fromMonsterManual2024Entry,
  libraryCombatants,
  libraryMonsters,
  notAddableMessage,
  saveCustomMonster,
  typeOf,
  typeOptions,
} from '../dm-library';
import {
  addCombatants,
  addCondition,
  canTakeLegendary,
  createEncounter,
  dealDamage,
  makeCopies,
  nextTurn,
  resetLegendary,
  spendLegendaryAction,
  startEncounter,
} from '../dm-encounter';
import { emptyDmData } from '../dm-campaign';
import { parseDmData } from '../dm-sanitize';

describe('Challenge Rating text', () => {
  it('reads whole numbers and fractions, and nothing else', () => {
    expect(crToNumber('0')).toBe(0);
    expect(crToNumber('1/8')).toBe(0.125);
    expect(crToNumber('1/2')).toBe(0.5);
    expect(crToNumber('10')).toBe(10);
    expect(crToNumber('None')).toBeNull();
    expect(crToNumber('')).toBeNull();
    expect(crToNumber(null)).toBeNull();
    expect(crToNumber('1/0')).toBeNull();
  });
});

describe('built-in library', () => {
  const all = builtInMonsters();

  it('carries every NPC block and every non-Primal-Companion creature, with unique keys', () => {
    expect(all.filter((m) => m.origin === 'npc')).toHaveLength(NPC_TEMPLATE_LIST.length);
    expect(all.filter((m) => m.origin === 'creature')).toHaveLength(CREATURE_LIST.filter((c) => c.kind !== 'primal-companion').length);
    expect(new Set(all.map((m) => m.key)).size).toBe(all.length);
  });

  it('copies printed numbers exactly for the NPC blocks', () => {
    for (const t of NPC_TEMPLATE_LIST) {
      const m = all.find((x) => x.key === `npc:${t.id}`)!;
      expect(m.ac).toBe(t.stats.ac);
      expect(m.hpAverage).toBe(t.stats.hpMax);
      expect(m.hpDice).toBe(t.hpDice);
      expect(m.cr).toBe(t.stats.cr);
      expect(m.source).toBe(`Monster Manual 2024, p.${t.page}`);
      expect(m.addable).toBe(true);
    }
  });

  it('works out a saving throw as modifier plus Proficiency Bonus, only where proficient', () => {
    let checked = 0;
    for (const t of NPC_TEMPLATE_LIST) {
      const m = all.find((x) => x.key === `npc:${t.id}`)!;
      for (const a of t.stats.saveProficiencies ?? []) {
        const score = t.stats.abilities?.[a];
        if (score === undefined || t.stats.proficiencyBonus === undefined) continue;
        expect(m.saves[a]).toBe(abilityModifier(score) + t.stats.proficiencyBonus);
        checked++;
      }
      for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
        if (!(t.stats.saveProficiencies ?? []).includes(a)) expect(m.saves[a]).toBeUndefined();
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('cites the right book for each creature and marks the unusable ones', () => {
    for (const c of CREATURE_LIST.filter((x) => x.kind !== 'primal-companion')) {
      const m = all.find((x) => x.key === `creature:${c.id}`)!;
      expect(m.source.startsWith(c.source.book)).toBe(true);
      const fixed = typeof c.ac === 'number' && 'average' in c.hp && typeof c.hp.average === 'number' && c.hp.average > 0;
      expect(m.addable).toBe(fixed);
    }
  });

  it('turns an addable monster into a combatant, and refuses one without fixed numbers', () => {
    const goblin = all.find((m) => m.addable && m.origin === 'npc')!;
    const c = combatantFromLibrary(goblin, 'x')!;
    expect(c.ac).toBe(goblin.ac);
    expect(c.hp.max).toBe(goblin.hpAverage);
    const bad = all.find((m) => !m.addable);
    if (bad) expect(combatantFromLibrary(bad, 'y')).toBeUndefined();
  });

  it('builds numbered, grouped copies for the add flows and refuses a creature without fixed numbers', () => {
    const goblin = all.find((m) => m.addable && m.origin === 'npc')!;
    let k = 0;
    const copies = libraryCombatants(goblin, 3, true, () => `id${++k}`)!;
    expect(copies).toHaveLength(3);
    expect(copies.map((c) => c.name)).toEqual([1, 2, 3].map((i) => `${goblin.name} ${i}`));
    expect(new Set(copies.map((c) => c.groupId)).size).toBe(1);
    expect(libraryCombatants(goblin, 1, true, () => 'solo')![0].id).toBe('solo');
    const bad = all.find((m) => !m.addable);
    if (bad) expect(libraryCombatants(bad, 2, true, () => 'z')).toBeUndefined();
    expect(notAddableMessage('Ooze')).toBe('Ooze has no fixed Armor Class or Hit Points, so it cannot be added to an encounter.');
  });
});

describe('Monster Manual 2024 origin', () => {
  it('adds every monsters.json creature as its own origin', () => {
    const all = libraryMonsters({ customMonsters: [] });
    const mm = filterMonsters(all, { origin: 'monster-manual' });
    expect(mm).toHaveLength(MONSTER_MANUAL_2024_LIST.length);
    expect(all.length).toBeGreaterThanOrEqual(MONSTER_MANUAL_2024_LIST.length + NPC_TEMPLATE_LIST.length);
  });

  it('maps a sample entry and reads legendary uses from the data', () => {
    const entry = MONSTER_MANUAL_2024_LIST.find((e) => e.legendaryActions.length > 0)!;
    const m = fromMonsterManual2024Entry(entry);
    expect(m.origin).toBe('monster-manual');
    expect(m.ac).toBe(entry.ac);
    expect(m.hpAverage).toBe(entry.hp.avg);
    expect(m.legendaryUses).toBe(entry.legendaryActionUses?.normal);
    expect(m.legendaryUses).toBeGreaterThan(0);
  });

  it('every creature with legendary actions prints its uses', () => {
    for (const e of MONSTER_MANUAL_2024_LIST) {
      if (e.legendaryActions.length > 0) expect(e.legendaryActionUses?.normal, e.name).toBeGreaterThan(0);
    }
  });
});

describe('search and filters', () => {
  const all = libraryMonsters(emptyDmData());

  it('matches names ignoring case, and combines filters', () => {
    const guards = filterMonsters(all, { query: 'GUARD' });
    expect(guards.length).toBeGreaterThan(0);
    expect(guards.every((m) => m.name.toLowerCase().includes('guard'))).toBe(true);
    const cr = guards[0].cr!;
    expect(filterMonsters(all, { query: 'guard', cr }).every((m) => m.cr === cr)).toBe(true);
    expect(filterMonsters(all, { query: 'zzzz-no-such' })).toEqual([]);
    expect(filterMonsters(all, {})).toHaveLength(all.length);
  });

  it('filters by type and source', () => {
    const types = typeOptions(all);
    expect(types).toContain('Humanoid');
    expect(filterMonsters(all, { type: 'humanoid' }).every((m) => typeOf(m).toLowerCase() === 'humanoid')).toBe(true);
    expect(filterMonsters(all, { origin: 'npc' })).toHaveLength(NPC_TEMPLATE_LIST.length);
    expect(filterMonsters(all, { origin: 'custom' })).toEqual([]);
  });

  it('lists Challenge Ratings lowest first with fractions in place', () => {
    const opts = crOptions(all);
    const values = opts.map((o) => crToNumber(o) ?? Number.POSITIVE_INFINITY);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(opts.indexOf('1/8')).toBeLessThan(opts.indexOf('1'));
  });

  it('is sorted by name', () => {
    const names = all.map((m) => m.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe('custom monsters', () => {
  it('copies a library monster into an editable one, keeping its numbers', () => {
    const src = builtInMonsters().find((m) => m.origin === 'npc' && Object.keys(m.saves).length > 0)!;
    const copy = customFromLibrary(src, 'c1', 5);
    expect(copy.ac).toBe(src.ac);
    expect(copy.hpMax).toBe(src.hpAverage);
    expect(copy.cr).toBe(src.cr);
    expect(copy.actions).toEqual(src.actions);
    expect(copy.actions[0]).not.toBe(src.actions[0]);
    expect(copy.saveProficiencies.sort()).toEqual(Object.keys(src.saves).sort());
    expect(copy.basedOn).toContain(src.name);
    expect(copy.name).toBe(src.name);
  });

  it('saves, lists, finds and deletes', () => {
    let d = emptyDmData();
    const m = { ...blankCustomMonster('m1', 1), name: 'Ash Drake', cr: '3', legendaryUses: 2 };
    d = saveCustomMonster(d, m, 9);
    d = saveCustomMonster(d, { ...m, name: 'Ash Drake II' }, 10);
    expect(d.customMonsters).toHaveLength(1);
    expect(d.customMonsters[0]).toMatchObject({ name: 'Ash Drake II', updatedAt: 10 });
    const entry = libraryMonsters(d).find((x) => x.customId === 'm1')!;
    expect(entry.origin).toBe('custom');
    expect(filterMonsters(libraryMonsters(d), { origin: 'custom' })).toHaveLength(1);
    d = deleteCustomMonster(d, 'm1');
    expect(d.customMonsters).toEqual([]);
  });

  it('gives the combatant the monster\'s legendary uses and defences', () => {
    const m = { ...blankCustomMonster('m1', 1), name: 'Wyrmling', ac: 17, hpMax: 60, legendaryUses: 3, resistances: 'Fire', initiativeMod: 2 };
    const lib = libraryMonsters(saveCustomMonster(emptyDmData(), m, 1)).find((x) => x.customId === 'm1')!;
    const c = combatantFromLibrary(lib, 'x')!;
    expect(c).toMatchObject({ ac: 17, initiativeMod: 2, resistances: 'Fire' });
    expect(c.legendary).toEqual({ max: 3, used: 0 });
    expect(c.hp.max).toBe(60);
    const plain = libraryMonsters(saveCustomMonster(emptyDmData(), { ...m, id: 'm2', legendaryUses: 0 }, 1)).find((x) => x.customId === 'm2')!;
    expect(combatantFromLibrary(plain, 'y')!.legendary).toBeUndefined();
  });

  it('survives damaged saved monsters', () => {
    const raw = {
      campaigns: [],
      customMonsters: [
        'nope',
        { id: 'a', name: 'Ok', abilities: { str: 99, dex: 'x' }, saveProficiencies: ['str', 'bogus'], traits: [{ name: 'T', description: 'D' }, 5], legendaryUses: 99, cr: '1/2' },
        { name: 'no id' },
      ],
    };
    const out = parseDmData(JSON.stringify(raw));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.customMonsters).toHaveLength(1);
      const m = out.data.customMonsters[0];
      expect(m.abilities.str).toBe(30);
      expect(m.abilities.dex).toBe(10);
      expect(m.saveProficiencies).toEqual(['str']);
      expect(m.traits).toEqual([{ name: 'T', description: 'D' }]);
      expect(m.legendaryUses).toBe(10);
    }
  });

  it('keeps old saved data working (no customMonsters yet)', () => {
    const out = parseDmData(JSON.stringify({ v: 1, campaigns: [] }));
    expect(out.ok && out.data.customMonsters).toEqual([]);
  });
});

describe('legendary actions in an encounter', () => {
  function dragon() {
    const m = { ...blankCustomMonster('m1', 1), name: 'Wyrm', hpMax: 100, legendaryUses: 3 };
    const lib = libraryMonsters(saveCustomMonster(emptyDmData(), m, 1)).find((x) => x.customId === 'm1')!;
    const base = combatantFromLibrary(lib, 'w')!;
    const other = { ...combatantFromLibrary(lib, 'o')!, name: 'Other', legendary: undefined, initiative: 5 };
    const e = addCombatants(createEncounter('e', 'T', 1), [{ ...base, initiative: 20 }, other]);
    const r = startEncounter(e);
    if (!r.ok) throw new Error(r.error);
    return r.encounter;
  }

  it('spends one use at a time up to the maximum', () => {
    let e = dragon();
    for (let i = 1; i <= 3; i++) {
      e = spendLegendaryAction(e, 'w');
      expect(e.combatants[0].legendary).toEqual({ max: 3, used: i });
    }
    expect(canTakeLegendary(e.combatants[0])).toBe(false);
    expect(spendLegendaryAction(e, 'w')).toBe(e);
  });

  it('refills every use at the start of its own turn, and on request', () => {
    let e = dragon();
    e = spendLegendaryAction(spendLegendaryAction(e, 'w'), 'w');
    e = nextTurn(e); // Other's turn: still spent
    expect(e.combatants[0].legendary!.used).toBe(2);
    e = nextTurn(e); // back to the Wyrm
    expect(e.combatants[0].legendary!.used).toBe(0);
    e = resetLegendary(spendLegendaryAction(e, 'w'), 'w');
    expect(e.combatants[0].legendary!.used).toBe(0);
  });

  it('is not allowed while Incapacitated, at 0 HP, or defeated', () => {
    let e = dragon();
    expect(canTakeLegendary(e.combatants[0])).toBe(true);
    const stunned = addCondition(e, 'w', 'stunned');
    expect(canTakeLegendary(stunned.combatants[0])).toBe(false);
    expect(spendLegendaryAction(stunned, 'w')).toBe(stunned);
    const para = addCondition(e, 'w', 'paralyzed');
    expect(canTakeLegendary(para.combatants[0])).toBe(false);
    const poisoned = addCondition(e, 'w', 'poisoned');
    expect(canTakeLegendary(poisoned.combatants[0])).toBe(true);
    e = dealDamage(e, 'w', { amount: 500 })!.encounter;
    expect(canTakeLegendary(e.combatants[0])).toBe(false);
  });

  it('copies of a legendary monster each keep their own uses', () => {
    const lib = libraryMonsters(saveCustomMonster(emptyDmData(), { ...blankCustomMonster('m1', 1), legendaryUses: 2 }, 1)).find((x) => x.customId === 'm1')!;
    let k = 0;
    const copies = makeCopies(combatantFromLibrary(lib, 'x')!, 2, () => `c${++k}`, true);
    expect(copies[0].legendary).toEqual({ max: 2, used: 0 });
    expect(copies[0].legendary).not.toBe(copies[1].legendary);
  });
});
