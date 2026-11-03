import { describe, it, expect } from 'vitest';
import {
  CANTRIPS_KNOWN,
  FULL_CASTER_SLOTS,
  HALF_CASTER_SLOTS,
  PACT_MAGIC,
  PREPARED_COUNT,
  SPELLCASTING_DESCRIPTORS,
  THIRD_CASTER_SLOTS,
  slotTableForKind,
} from '../spell-progression';

describe('SPELLCASTING_DESCRIPTORS', () => {
  it('covers exactly the ten caster class entries (no Barbarian/Monk)', () => {
    expect(Object.keys(SPELLCASTING_DESCRIPTORS).sort()).toEqual(
      ['bard', 'cleric', 'druid', 'fighter', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'].sort(),
    );
    expect(SPELLCASTING_DESCRIPTORS.barbarian).toBeUndefined();
    expect(SPELLCASTING_DESCRIPTORS.monk).toBeUndefined();
  });

  it('marks subclass casters with casting level 3 + Wizard list + NO school restriction', () => {
    const ek = SPELLCASTING_DESCRIPTORS.fighter!;
    expect(ek.kind).toBe('third');
    expect(ek.subclassCastingLevel).toBe(3);
    expect(ek.subclassId).toBe('eldritchKnight');
    expect(ek.spellListClassId).toBe('wizard');
    // 2024 removed the 2014 EK school restriction; must be unset.
    expect(ek.allowedSchools).toBeUndefined();

    const at = SPELLCASTING_DESCRIPTORS.rogue!;
    expect(at.kind).toBe('third');
    expect(at.subclassCastingLevel).toBe(3);
    expect(at.subclassId).toBe('arcaneTrickster');
    expect(at.spellListClassId).toBe('wizard');
    expect(at.allowedSchools).toBeUndefined();
  });

  it('only Wizard uses a spellbook', () => {
    expect(SPELLCASTING_DESCRIPTORS.wizard!.usesSpellbook).toBe(true);
    for (const id of ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'paladin', 'ranger'] as const) {
      expect(SPELLCASTING_DESCRIPTORS[id]!.usesSpellbook).toBe(false);
    }
  });
});

describe('slot grids are 1-indexed by level with a placeholder at 0', () => {
  it('full caster grid has 21 rows (0..20), each a 10-entry vector', () => {
    expect(FULL_CASTER_SLOTS.length).toBe(21);
    for (const row of FULL_CASTER_SLOTS) expect(row.length).toBe(10);
  });

  it('full caster matches the printed PHB rows at spot levels', () => {
    expect(FULL_CASTER_SLOTS[1].slice(1)).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(FULL_CASTER_SLOTS[5].slice(1)).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
    expect(FULL_CASTER_SLOTS[11].slice(1)).toEqual([4, 3, 3, 3, 2, 1, 0, 0, 0]);
    expect(FULL_CASTER_SLOTS[20].slice(1)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
  });

  it('half caster tops out at spell level 5', () => {
    expect(HALF_CASTER_SLOTS.length).toBe(21);
    for (const row of HALF_CASTER_SLOTS) expect(row.length).toBe(6);
    expect(HALF_CASTER_SLOTS[1].slice(1)).toEqual([2, 0, 0, 0, 0]);
    expect(HALF_CASTER_SLOTS[5].slice(1)).toEqual([4, 2, 0, 0, 0]);
    expect(HALF_CASTER_SLOTS[20].slice(1)).toEqual([4, 3, 3, 3, 2]);
  });

  it('third caster has no slots at levels 1-2 and reaches spell level 4 at levels 19-20', () => {
    // PHB 2024 Eldritch Knight Spellcasting table (~p.52): the printed table has
    // a 4th-level column (1 slot at Fighter levels 19-20). Vectors are 5 wide
    // (index 0 placeholder + spell levels 1-4).
    expect(THIRD_CASTER_SLOTS.length).toBe(21);
    for (const row of THIRD_CASTER_SLOTS) expect(row.length).toBe(5);
    expect(THIRD_CASTER_SLOTS[1].slice(1)).toEqual([0, 0, 0, 0]);
    expect(THIRD_CASTER_SLOTS[2].slice(1)).toEqual([0, 0, 0, 0]);
    expect(THIRD_CASTER_SLOTS[3].slice(1)).toEqual([2, 0, 0, 0]);
    expect(THIRD_CASTER_SLOTS[7].slice(1)).toEqual([4, 2, 0, 0]);
    expect(THIRD_CASTER_SLOTS[13].slice(1)).toEqual([4, 3, 2, 0]);
    expect(THIRD_CASTER_SLOTS[16].slice(1)).toEqual([4, 3, 3, 0]);
    // The level-4 slot that the earlier 3-wide table dropped:
    expect(THIRD_CASTER_SLOTS[19].slice(1)).toEqual([4, 3, 3, 1]);
    expect(THIRD_CASTER_SLOTS[20].slice(1)).toEqual([4, 3, 3, 1]);
  });

  it('slotTableForKind returns the right grid; pact has none', () => {
    expect(slotTableForKind('full')).toBe(FULL_CASTER_SLOTS);
    expect(slotTableForKind('half')).toBe(HALF_CASTER_SLOTS);
    expect(slotTableForKind('third')).toBe(THIRD_CASTER_SLOTS);
    expect(slotTableForKind('pact')).toBeUndefined();
  });
});

describe('PACT_MAGIC (Warlock-only slot model)', () => {
  it('has 21 rows and matches the printed Warlock Features table at spot levels', () => {
    expect(PACT_MAGIC.length).toBe(21);
    expect(PACT_MAGIC[1]).toEqual({ slots: 1, slotLevel: 1 });
    expect(PACT_MAGIC[2]).toEqual({ slots: 2, slotLevel: 1 });
    expect(PACT_MAGIC[5]).toEqual({ slots: 2, slotLevel: 3 });
    expect(PACT_MAGIC[11]).toEqual({ slots: 3, slotLevel: 5 });
    expect(PACT_MAGIC[17]).toEqual({ slots: 4, slotLevel: 5 });
    expect(PACT_MAGIC[20]).toEqual({ slots: 4, slotLevel: 5 });
  });
});

describe('CANTRIPS_KNOWN / PREPARED_COUNT columns', () => {
  it('cover casters that have those columns', () => {
    // Cantrips: Paladin/Ranger absent (no cantrips in 2024).
    expect(CANTRIPS_KNOWN.paladin).toBeUndefined();
    expect(CANTRIPS_KNOWN.ranger).toBeUndefined();
    expect(CANTRIPS_KNOWN.wizard![1]).toBe(3);
    expect(CANTRIPS_KNOWN.sorcerer![1]).toBe(4);
    // Prepared: present for all casters incl. half/third.
    expect(PREPARED_COUNT.paladin![1]).toBe(2);
    expect(PREPARED_COUNT.ranger![20]).toBe(15);
    expect(PREPARED_COUNT.fighter![3]).toBe(3);
    expect(PREPARED_COUNT.rogue![20]).toBe(13);
  });

  it('every column array has 21 entries (0..20)', () => {
    for (const table of [CANTRIPS_KNOWN, PREPARED_COUNT]) {
      for (const [, arr] of Object.entries(table)) {
        expect(arr!.length).toBe(21);
      }
    }
  });
});
