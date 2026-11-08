/**
 * Circle of the Land spells: harness for circle-land-golden.ts (rows authored from
 * the PHB first; never edited here). Wires the chosen land type (class choice
 * 'druid.landType') into the always-prepared mechanism and the pending logic.
 */
import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, ClassEntry } from '../../types/character';
import { getSpell, SPELL_CATALOG } from '../../data/spells';
import { setClassChoice, choiceStatus, pendingClassChoices } from '../class-choices';
import { alwaysPreparedSpells, classAlwaysPreparedSpells, classPreparedCount } from '../spellcasting';
import { pendingSetupChoices } from '../starting-choices';
import { landSpellIds, landTypeOptions } from '../class-choice-effects';
import {
  DRUIDIC_ALWAYS_PREPARED,
  LANDS,
  LAND_SPELLS_AT_LEVEL_20,
  LAND_SPOT_ROWS,
  LAND_SWAP_ROWS,
  LAND_TABLES,
  expectedLandSpells,
} from './circle-land-golden';
import type { GoldenLand } from './circle-land-golden';

function druid(level: number, land?: string, subclassId: string | null = 'land'): Character {
  const base = createCharacter('Land');
  const entry = { id: 'druid', level, ...(subclassId ? { subclassId } : {}) } as unknown as ClassEntry;
  const c: Character = { ...base, level, classes: [entry] };
  return land === undefined ? c : setClassChoice(c, 'druid.landType' as never, [land]);
}

const sorted = (ids: readonly string[]): string[] => [...ids].sort();
const entryOf = (c: Character): ClassEntry => c.classes![0];

describe('Circle of the Land: granted spells = exactly the chosen land, levels reached', () => {
  for (const land of LANDS) {
    it(`${land}: every Druid level 1..20`, () => {
      for (let level = 1; level <= 20; level++) {
        const c = druid(level, land);
        const want = level >= 3 ? [DRUIDIC_ALWAYS_PREPARED, ...expectedLandSpells(land, level)] : [DRUIDIC_ALWAYS_PREPARED];
        expect(sorted(classAlwaysPreparedSpells(entryOf(c), c)), `${land} @ L${level}`).toEqual(sorted(want));
        // Single-class aggregate used by the Spells page agrees.
        expect(sorted(alwaysPreparedSpells(c)), `${land} @ L${level} (aggregate)`).toEqual(sorted(want));
      }
    });
  }

  it('hand-written spot rows (spell level not yet reached is never granted)', () => {
    for (const row of LAND_SPOT_ROWS) {
      const c = druid(row.level, row.land);
      expect(sorted(classAlwaysPreparedSpells(entryOf(c), c)), row.name).toEqual(sorted([DRUIDIC_ALWAYS_PREPARED, ...row.spells]));
    }
  });

  it('the level-20 table is 6 spells per land and all ids exist in the catalog', () => {
    for (const land of LANDS) {
      const ids = LAND_TABLES[land].flatMap(([, s]) => [...s]);
      expect(ids, land).toHaveLength(LAND_SPELLS_AT_LEVEL_20);
      for (const id of ids) expect(getSpell(id as never), `${land}: ${id}`).toBeDefined();
    }
  });

  it('changing the land swaps the whole granted set', () => {
    for (const row of LAND_SWAP_ROWS) {
      const before = druid(row.level, row.from);
      const after = setClassChoice(before, 'druid.landType' as never, [row.to]);
      const was = classAlwaysPreparedSpells(entryOf(before), before);
      const now = classAlwaysPreparedSpells(entryOf(after), after);
      for (const id of row.gone) {
        expect(was, `${row.from}->${row.to} before ${id}`).toContain(id);
        expect(now, `${row.from}->${row.to} after ${id}`).not.toContain(id);
      }
      for (const id of row.gained) {
        expect(was, `${row.from}->${row.to} before ${id}`).not.toContain(id);
        expect(now, `${row.from}->${row.to} after ${id}`).toContain(id);
      }
      expect(now).toContain(DRUIDIC_ALWAYS_PREPARED);
    }
  });

  it('grants nothing without a land, with an unknown land, without the Land subclass, or in another class', () => {
    expect(classAlwaysPreparedSpells(entryOf(druid(9)), druid(9))).toEqual([DRUIDIC_ALWAYS_PREPARED]);
    const bogus = druid(9, 'desert');
    expect(classAlwaysPreparedSpells(entryOf(bogus), bogus)).toEqual([DRUIDIC_ALWAYS_PREPARED]);
    const moon = druid(9, 'arid', 'moon');
    expect(classAlwaysPreparedSpells(entryOf(moon), moon)).not.toContain('fireball');
    const noSub = druid(9, 'arid', null);
    expect(classAlwaysPreparedSpells(entryOf(noSub), noSub)).not.toContain('fireball');
    // Multiclass: the land belongs to the Druid entry only (its own class level).
    const multi: Character = {
      ...setClassChoice(createCharacter('Multi'), 'druid.landType' as never, ['arid']),
      level: 8,
      classes: [
        { id: 'cleric', level: 5 },
        { id: 'druid', level: 3, subclassId: 'land' },
      ] as unknown as ClassEntry[],
    };
    const [cleric, dr] = multi.classes!;
    expect(classAlwaysPreparedSpells(cleric, multi)).not.toContain('burning-hands');
    expect(sorted(classAlwaysPreparedSpells(dr, multi))).toEqual(sorted([DRUIDIC_ALWAYS_PREPARED, 'blur', 'burning-hands', 'fire-bolt']));
    // Gated at the DRUID level (3), not the character level (8): no Fireball.
    expect(classAlwaysPreparedSpells(dr, multi)).not.toContain('fireball');
  });

  it('exposes the four land options with their spells for the picker', () => {
    expect(landTypeOptions().map((o) => o.id)).toEqual(['arid', 'polar', 'temperate', 'tropical']);
    expect(landSpellIds('polar', 5)).toEqual(expectedLandSpells('polar' as GoldenLand, 5));
  });
});

describe('Circle of the Land: Choices Pending', () => {
  it('is pending (1 owed) from Druid 3 with the Land subclass until a land is chosen', () => {
    expect(pendingClassChoices(druid(2)).map((s) => s.key)).not.toContain('druid.landType');
    const pending = pendingClassChoices(druid(3));
    const land = pending.find((s) => s.key === 'druid.landType');
    expect(land).toMatchObject({ owed: 1, chosen: 0, remaining: 1 });
    const done = druid(3, 'tropical');
    expect(pendingClassChoices(done).map((s) => s.key)).not.toContain('druid.landType');
    const status = choiceStatus(done).find((s) => s.key === 'druid.landType');
    expect(status).toMatchObject({ chosen: 1, remaining: 0, entries: ['tropical'] });
    // Not owed for another subclass.
    expect(pendingClassChoices(druid(10, undefined, 'moon')).map((s) => s.key)).not.toContain('druid.landType');
  });

  it('an unknown land id is invalid, not counted', () => {
    const status = choiceStatus(druid(3, 'desert')).find((s) => s.key === 'druid.landType');
    expect(status).toMatchObject({ chosen: 0, remaining: 1, invalid: ['desert'] });
  });
});

describe('Circle of the Land: does not count against the prepared cap', () => {
  const ordinary = SPELL_CATALOG.filter(
    (s) => s.level >= 1 && s.level <= 2 && s.classes.some((c: string) => c === 'druid') && !LANDS.some((l) => LAND_TABLES[l].some(([, ids]) => ids.includes(s.id as string))),
  ).map((s) => s.id);

  it('the cap is the same with or without a land', () => {
    for (const level of [3, 5, 9, 17]) {
      expect(classPreparedCount(entryOf(druid(level, 'polar')))).toBe(classPreparedCount(entryOf(druid(level))));
    }
  });

  it('a hand-picked land spell no longer fills a prepared slot; ordinary picks still do', () => {
    const base = druid(3, 'polar');
    const need = classPreparedCount(entryOf(base));
    expect(need).toBeGreaterThanOrEqual(2);
    expect(ordinary.length).toBeGreaterThanOrEqual(need);
    const cantrips: string[] = [];
    const withPrepared = (c: Character, prepared: string[]): Character => ({
      ...c,
      spellcasting: { byClass: { druid: { prepared: prepared as never, cantrips: cantrips as never } } },
    });
    const preparedItem = (c: Character) => pendingSetupChoices(c).find((i) => i.kind === 'prepared');
    const full = ordinary.slice(0, need);
    // Exactly `need` ordinary picks: complete, with or without the land.
    expect(preparedItem(withPrepared(base, full))).toBeUndefined();
    // Swap one ordinary pick for a land spell (Fog Cloud is on the Druid list): short by one.
    const swapped = [...full.slice(0, need - 1), 'fog-cloud'];
    expect(preparedItem(withPrepared(base, swapped))).toMatchObject({ have: need - 1, need });
    // Without a land, the same pick is an ordinary prepared spell and counts.
    expect(preparedItem(withPrepared(druid(3), swapped))).toBeUndefined();
  });
});
