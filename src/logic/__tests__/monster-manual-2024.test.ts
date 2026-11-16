import { describe, it, expect } from 'vitest';
import raw from '../../data/monsters.json';
import { MONSTER_MANUAL_2024_LIST } from '../../data/monster-manual-2024';
import {
  builtInMonsters,
  combatantFromLibrary,
  filterMonsters,
  fromMonsterManual2024Entry,
  libraryMonsters,
} from '../dm-library';
import { emptyDmData } from '../dm-campaign';

const mm = () => builtInMonsters().filter((m) => m.origin === 'monster-manual');

describe('Monster Manual 2024 creature list', () => {
  it('carries every entry of monsters.json', () => {
    expect(MONSTER_MANUAL_2024_LIST).toHaveLength(502);
    expect(MONSTER_MANUAL_2024_LIST).toHaveLength(raw.length);
    expect(new Set(MONSTER_MANUAL_2024_LIST.map((e) => e.name)).size).toBe(502);
  });

  it('converts every entry without throwing, with unique keys', () => {
    const list = MONSTER_MANUAL_2024_LIST.map(fromMonsterManual2024Entry);
    expect(list).toHaveLength(502);
    expect(new Set(list.map((m) => m.key)).size).toBe(502);
    for (const m of list) {
      expect(m.addable).toBe(true);
      expect(m.ac).not.toBeNull();
      expect(m.hpAverage).not.toBeNull();
      expect(m.crValue).not.toBeNull();
    }
  });

  it('copies printed numbers for a known entry (Aboleth)', () => {
    const e = raw.find((x) => x.name === 'Aboleth')!;
    const m = mm().find((x) => x.name === 'Aboleth')!;
    expect(m.ac).toBe(e.ac);
    expect(m.hpAverage).toBe(e.hp.avg);
    expect(m.hpDice).toBe(e.hp.dice);
    expect(m.cr).toBe(e.cr);
    expect(m.xp).toBe(e.xp);
    expect(m.initiativeMod).toBe(e.initiative.mod);
    expect(m.abilities.str).toBe(e.abilities.str.score);
    expect(m.conSaveMod).toBe(e.abilities.con.save);
    expect(m.source).toBe(`Monster Manual 2024, p.${e.page}`);
    expect(m.speed).toBe('10 ft., swim 40 ft.');
    expect(m.legendaryUses).toBe(3);
    expect(m.legendaryUsesInLair).toBe(4);
    expect(m.saves.dex).toBe(3);
    expect(m.saves.cha).toBeUndefined();
  });

  it('keeps usage, attack and save detail in the descriptions', () => {
    const m = mm().find((x) => x.name === 'Aboleth')!;
    const tentacle = m.actions.find((a) => a.name === 'Tentacle')!;
    expect(tentacle.description).toContain('+9');
    expect(tentacle.description).toContain('2d6 + 5');
    expect(m.actions.find((a) => a.name.startsWith('Dominate Mind'))!.name).toContain('2/Day');
    expect(m.actions.find((a) => a.name === 'Consume Memories')!.description).toContain('DC 16');
    expect(m.legendaryActions.length).toBeGreaterThan(0);
  });

  it('keeps lair actions and reads legendary uses from the stat block', () => {
    const withLair = mm().filter((m) => (m.lairActions ?? []).length > 0);
    expect(withLair.length).toBeGreaterThan(0);
    for (const m of mm()) {
      const e = raw.find((x) => x.name === m.name)!;
      expect(m.lairActions ?? []).toHaveLength(e.lairActions.length);
      expect(m.legendaryActions).toHaveLength(e.legendaryActions.length);
      expect(m.legendaryUses > 0).toBe(e.legendaryActions.length > 0);
    }
  });

  it('is in the library alongside the existing sources and filters by origin', () => {
    const builtInCount = builtInMonsters().length;
    const lib = libraryMonsters(emptyDmData());
    expect(lib.length).toBe(builtInCount);
    expect(lib.length).toBeGreaterThanOrEqual(502 + builtInMonsters().filter((m) => m.origin !== 'monster-manual').length);
    expect(filterMonsters(lib, { origin: 'monster-manual' })).toHaveLength(raw.length);
  });

  it('builds a usable combatant for every entry', () => {
    for (const m of mm()) {
      const e = raw.find((x) => x.name === m.name)!;
      const c = combatantFromLibrary(m, 'id')!;
      expect(c).toBeDefined();
      expect(c.ac).toBe(e.ac);
      expect(c.hp.max).toBe(e.hp.avg);
      expect(c.initiativeMod).toBe(e.initiative.mod);
      expect(c.cr).toBe(e.cr);
      expect(c.xp).toBe(e.xp);
      expect(c.conSaveMod).toBe(e.abilities.con.save);
      expect(c.resistances).toBe(((e as { resistances?: string[] }).resistances ?? []).join('; '));
      expect(c.vulnerabilities).toBe(((e as { vulnerabilities?: string[] }).vulnerabilities ?? []).join('; '));
      expect(c.immunities).toBe(((e as { damageImmunities?: string[] }).damageImmunities ?? []).join('; '));
      expect(c.sourceLabel).toBe(`${e.name} (Monster Manual 2024, p.${e.page})`);
      expect(c.legendary?.max).toBe(m.legendaryActions.length > 0 ? m.legendaryUses : undefined);
    }
  });

  it('keeps same-named NPC and creature entries as separate rows', () => {
    const lib = builtInMonsters();
    const spiders = lib.filter((m) => m.name === 'Giant Spider');
    expect(spiders.length).toBeGreaterThan(1);
    expect(new Set(spiders.map((m) => m.origin)).size).toBe(spiders.length);
  });
});
