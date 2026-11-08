import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, ClassSpellcasting } from '../../types/character';
import { CLASS_LIST } from '../../data/classes';
import type { ClassId } from '../../data/classes';
import { SPELL_CATALOG } from '../../data/spells';
import type { SpellId } from '../../data/spells';
import {
  classAlwaysPreparedSpells,
  entryIsSpellcaster,
  illegalSpellSelections,
  removeIllegalSpellSelections,
} from '../spellcasting';
import { startingSpellPools } from '../starting-spells';

const id = (s: string) => s as SpellId;

function make(
  classId: string,
  level: number,
  bucket: ClassSpellcasting,
  subclassId?: string,
): Character {
  return {
    ...createCharacter('Tester'),
    level,
    classes: [{ id: classId as ClassId, level, ...(subclassId ? { subclassId } : {}) }] as Character['classes'],
    spellcasting: { byClass: { [classId]: bucket } },
  } as Character;
}

const flagged = (c: Character) => illegalSpellSelections(c).map((i) => `${i.kind}:${i.id}`).sort();

/**
 * Legality rows, derived from the PHB facts (not from the implementation):
 *  - spells come from the class's own list (Bard 2743-2749, Cleric 3171-3177, ...);
 *  - cantrips are level 0 and from the class cantrip list; a leveled spell is never a cantrip;
 *  - a spell must be of a level the class has slots for (Cleric 1: level 1 only);
 *  - Bard Magical Secrets (L2830) widens PREPARED spells from Bard 10 to the Bard, Cleric,
 *    Druid and Wizard lists, but not cantrips;
 *  - Eldritch Knight / Arcane Trickster use the Wizard list (L4347, L6011);
 *  - a Wizard prepares only from its spellbook (L7445).
 */
describe('spell selection legality: class lists', () => {
  it('accepts class-list spells and flags other lists', () => {
    expect(flagged(make('cleric', 1, { cantrips: [id('sacred-flame')], prepared: [id('cure-wounds'), id('bless')] }))).toEqual([]);
    expect(flagged(make('cleric', 1, { cantrips: [id('fire-bolt')], prepared: [id('magic-missile')] }))).toEqual([
      'cantrip:fire-bolt',
      'prepared:magic-missile',
    ]);
  });

  it('flags a spell above the highest level the class has slots for', () => {
    expect(flagged(make('cleric', 1, { prepared: [id('aid')] }))).toEqual(['prepared:aid']);
    expect(flagged(make('cleric', 3, { prepared: [id('aid')] }))).toEqual([]);
  });

  it('flags a leveled spell stored as a cantrip, and a cantrip stored as prepared', () => {
    expect(flagged(make('cleric', 1, { cantrips: [id('bless')], prepared: [id('sacred-flame')] }))).toEqual([
      'cantrip:bless',
      'prepared:sacred-flame',
    ]);
  });

  it('Paladin and Ranger have no cantrips, so any stored cantrip is illegal', () => {
    expect(flagged(make('paladin', 2, { cantrips: [id('sacred-flame')] }))).toEqual(['cantrip:sacred-flame']);
    expect(flagged(make('ranger', 2, { cantrips: [id('guidance')] }))).toEqual(['cantrip:guidance']);
  });

  it('Bard Magical Secrets widens prepared spells from Bard 10, never cantrips', () => {
    expect(flagged(make('bard', 9, { prepared: [id('fireball')] }))).toEqual(['prepared:fireball']);
    expect(flagged(make('bard', 10, { prepared: [id('fireball')] }))).toEqual([]);
    expect(flagged(make('bard', 10, { cantrips: [id('fire-bolt')] }))).toEqual(['cantrip:fire-bolt']);
  });

  it('Eldritch Knight and Arcane Trickster use the Wizard list', () => {
    expect(flagged(make('fighter', 3, { prepared: [id('shield')] }, 'eldritchKnight'))).toEqual([]);
    expect(flagged(make('fighter', 3, { prepared: [id('cure-wounds')] }, 'eldritchKnight'))).toEqual(['prepared:cure-wounds']);
    expect(flagged(make('rogue', 3, { cantrips: [id('mage-hand')], prepared: [id('shield')] }, 'arcaneTrickster'))).toEqual([]);
  });

  it('a Wizard may prepare only spells in the spellbook', () => {
    const book = [id('shield'), id('magic-missile')];
    expect(flagged(make('wizard', 1, { spellbook: book, prepared: [id('shield')] }))).toEqual([]);
    expect(flagged(make('wizard', 1, { spellbook: book, prepared: [id('sleep')] }))).toEqual(['prepared:sleep']);
    expect(flagged(make('wizard', 1, { spellbook: [id('cure-wounds')] }))).toEqual(['spellbook:cure-wounds']);
  });

  it('flags everything stored for a class the character no longer has or that cannot cast', () => {
    const fighter = make('fighter', 5, {}, 'champion');
    const withStale: Character = {
      ...fighter,
      spellcasting: { byClass: { wizard: { cantrips: [id('fire-bolt')], spellbook: [id('shield')], prepared: [id('shield')] } } },
    };
    expect(flagged(withStale)).toEqual(['cantrip:fire-bolt', 'prepared:shield', 'spellbook:shield']);
    // A Fighter who is not a subclass caster has nothing legal to store either.
    expect(flagged(make('fighter', 5, { prepared: [id('shield')] }, 'champion'))).toEqual(['prepared:shield']);
  });

  it('never flags feature spells that are always prepared, even when off the class list', () => {
    let checked = 0;
    for (const cls of CLASS_LIST) {
      for (const sub of [undefined, ...cls.subclasses.map((s) => s.id)]) {
        const c = make(cls.id, 20, {}, sub);
        const entry = c.classes![0];
        if (!entryIsSpellcaster(entry)) continue;
        const always = classAlwaysPreparedSpells(entry, c);
        if (always.length === 0) continue;
        checked += 1;
        expect(flagged({ ...c, spellcasting: { byClass: { [cls.id]: { prepared: always } } } }), `${cls.id}/${sub}`).toEqual([]);
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe('removeIllegalSpellSelections', () => {
  it('removes only the illegal entries and never mutates its input', () => {
    const c = make('cleric', 1, { cantrips: [id('sacred-flame'), id('fire-bolt')], prepared: [id('cure-wounds'), id('fireball')] });
    const before = JSON.stringify(c);
    const cleaned = removeIllegalSpellSelections(c);
    expect(JSON.stringify(c)).toBe(before);
    expect(cleaned.spellcasting?.byClass?.cleric).toEqual({ cantrips: [id('sacred-flame')], prepared: [id('cure-wounds')] });
    expect(flagged(cleaned)).toEqual([]);
  });

  it('returns the same character when nothing is illegal, and drops emptied buckets', () => {
    const ok = make('cleric', 1, { prepared: [id('bless')] });
    expect(removeIllegalSpellSelections(ok)).toBe(ok);
    const bad = make('cleric', 1, { prepared: [id('fireball')] });
    expect(removeIllegalSpellSelections(bad).spellcasting?.byClass?.cleric).toBeUndefined();
  });
});

describe('every starting pool offered in the creation wizard is legal for its class', () => {
  it('cantrip and level 1 pools contain only spells on the class list at a castable level', () => {
    let casters = 0;
    for (const cls of CLASS_LIST) {
      const pools = startingSpellPools(cls.id);
      if (!pools) continue;
      casters += 1;
      expect(pools.cantrips.every((s) => s.level === 0), `${cls.id} cantrips`).toBe(true);
      expect(pools.leveled.every((s) => s.level === 1), `${cls.id} level 1`).toBe(true);
      for (const s of [...pools.cantrips, ...pools.leveled]) {
        expect((s.classes as readonly string[]).includes(cls.id), `${cls.id} offered ${s.name}`).toBe(true);
      }
      // Storing the whole pool as picks is legal; it must never exceed the class list.
      const bucket: ClassSpellcasting = {
        cantrips: pools.cantrips.map((s) => s.id),
        spellbook: cls.id === 'wizard' ? pools.leveled.map((s) => s.id) : undefined,
        prepared: pools.leveled.map((s) => s.id),
      };
      expect(flagged(make(cls.id, 1, bucket)), cls.id).toEqual([]);
    }
    // Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard all cast at level 1.
    expect(casters).toBe(8);
  });

  it('PHB cantrip counts per class (Bard 13 and Cleric 9, from the printed lists)', () => {
    expect(startingSpellPools('bard')?.cantrips).toHaveLength(13);
    expect(startingSpellPools('cleric')?.cantrips).toHaveLength(9);
    // The catalog tags every spell with at least one casting class.
    expect(SPELL_CATALOG.every((s) => s.classes.length > 0)).toBe(true);
  });
});
