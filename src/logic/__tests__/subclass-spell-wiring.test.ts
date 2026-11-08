import { describe, expect, it } from 'vitest';
import { CLASS_CATALOG as RAW_CLASS_CATALOG } from '../../data/classes';
import type { SubclassData } from '../../data/classes';
import { getSpell } from '../../data/spells';
import type { ClassEntry } from '../../types/character';
import { BLANK_CHARACTER } from '../../types/character';
import type { Character } from '../../types/character';
import { classAlwaysPreparedSpells, classRequiredCantrips, entryIsSpellcaster } from '../spellcasting';
import { fightingStyleSlots, applyFightingStyle } from '../feats';
import { classFeaturesByLevel, classFeaturesByLevelTagged } from '../classes';
import { nextLevelPreview } from '../advancement';
import { buildFeatures } from '../../components/layout/printLayoutGenerators';

// Real-catalog wiring checks: subclass-granted spells, subclass spellcasting
// (Eldritch Knight / Arcane Trickster) and the Champion's extra Fighting Style.

// Widened view of the const catalog so tests can iterate it by string class id.
const CLASS_CATALOG: Record<string, { subclasses: readonly SubclassData[] }> = RAW_CLASS_CATALOG;
function entry(id: string, level: number, subclassId?: string): ClassEntry {
  return { id, level, subclassId } as unknown as ClassEntry;
}
function character(classes: ClassEntry[]): Character {
  return { ...BLANK_CHARACTER, level: classes.reduce((n, c) => n + c.level, 0), classes };
}

describe('every always-prepared subclass grant resolves in the spell catalog', () => {
  it('has a catalog entry for each granted spell id', () => {
    const missing: string[] = [];
    for (const [classId, data] of Object.entries(CLASS_CATALOG)) {
      for (const sub of data.subclasses) {
        for (const f of sub.features) {
          const ids = [
            ...(f.grantedSpells ?? []).flatMap((g) => g.spells),
            ...Object.values(f.choiceSpells ?? {}).flatMap((rows) => rows.flatMap((r) => r.spells)),
          ];
          for (const id of ids) if (!getSpell(id)) missing.push(`${classId}/${sub.id}/${f.name}: ${id}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('subclass always-prepared spells reach classAlwaysPreparedSpells', () => {
  it('Life Domain grants its list gated by Cleric level', () => {
    const at = (level: number) => classAlwaysPreparedSpells(entry('cleric', level, 'life'));
    expect(at(3)).toEqual(expect.arrayContaining(['aid', 'bless', 'cure-wounds', 'lesser-restoration']));
    expect(at(3)).not.toContain('revivify');
    expect(at(5)).toEqual(expect.arrayContaining(['mass-healing-word', 'revivify']));
    expect(at(9)).toEqual(expect.arrayContaining(['greater-restoration', 'mass-cure-wounds']));
    expect(at(2)).not.toContain('aid');
  });

  it('every Cleric domain and Paladin oath with a spell grant is wired at level 20', () => {
    for (const classId of ['cleric', 'paladin']) {
      for (const sub of CLASS_CATALOG[classId].subclasses) {
        const expected = sub.features
          .flatMap((f) => f.grantedSpells ?? [])
          .filter((g) => g.alwaysPrepared)
          .flatMap((g) => g.spells);
        expect(expected.length, `${classId}/${sub.id}`).toBeGreaterThan(0);
        const got = classAlwaysPreparedSpells(entry(classId, 20, sub.id));
        for (const id of expected) expect(got, `${classId}/${sub.id}: ${id}`).toContain(id);
      }
    }
  });

  it('a subclass is not applied before the subclass level or without a choice', () => {
    expect(classAlwaysPreparedSpells(entry('cleric', 3))).not.toContain('aid');
  });
});

describe('Eldritch Knight and Arcane Trickster spellcasting', () => {
  it('Eldritch Knight casts only from level 3 with the subclass', () => {
    expect(entryIsSpellcaster(entry('fighter', 2, 'eldritchKnight'))).toBe(false);
    expect(entryIsSpellcaster(entry('fighter', 3, 'eldritchKnight'))).toBe(true);
    expect(entryIsSpellcaster(entry('fighter', 3, 'champion'))).toBe(false);
  });

  it('Arcane Trickster casts from level 3 and always knows Mage Hand', () => {
    expect(entryIsSpellcaster(entry('rogue', 2, 'arcaneTrickster'))).toBe(false);
    expect(entryIsSpellcaster(entry('rogue', 3, 'arcaneTrickster'))).toBe(true);
    expect(classRequiredCantrips(entry('rogue', 3, 'arcaneTrickster'))).toEqual(['mage-hand']);
    expect(classRequiredCantrips(entry('rogue', 3, 'thief'))).toEqual([]);
  });
});

describe('Champion Additional Fighting Style (real data)', () => {
  it('adds a second Fighting Style slot at Fighter level 7', () => {
    const champ = (level: number) => character([entry('fighter', level, 'champion')]);
    expect(fightingStyleSlots(champ(6)).map((s) => s.key)).toEqual(['fighter']);
    const slots = fightingStyleSlots(champ(7));
    expect(slots.map((s) => s.key)).toEqual(['fighter', 'fighter:subclass']);
    expect(slots[1].subclassFeature).toBe('Additional Fighting Style');
    expect(slots[1].featureLevel).toBe(7);
  });

  it('other Fighter subclasses and no subclass get only one slot', () => {
    for (const sub of ['battleMaster', 'eldritchKnight', 'psiWarrior', undefined]) {
      expect(fightingStyleSlots(character([entry('fighter', 7, sub)])).map((s) => s.key)).toEqual(['fighter']);
    }
  });

  it('records the pick against the subclass slot', () => {
    const c = applyFightingStyle(character([entry('fighter', 7, 'champion')]), 'fighter:subclass', 'defense', 1);
    expect(fightingStyleSlots(c).find((s) => s.key === 'fighter:subclass')?.filled?.featId).toBe('defense');
  });

  it('no other PHB subclass feature grants a Fighting Style or feat', () => {
    const grants: string[] = [];
    for (const [classId, data] of Object.entries(CLASS_CATALOG)) {
      for (const sub of data.subclasses) {
        for (const f of sub.features) {
          if (f.grantsFightingStyle || f.grantsFeat) grants.push(`${classId}/${sub.id}/${f.name}`);
        }
      }
    }
    expect(grants).toEqual(['fighter/champion/Additional Fighting Style']);
  });
});

describe('subclass features appear in the feature views (real data)', () => {
  it('Champion features show in classFeaturesByLevel and the tagged view at level 7', () => {
    const c = character([entry('fighter', 7, 'champion')]);
    const names = (m: Map<number, { name: string }[]>) => [...m.values()].flat().map((f) => f.name);
    expect(names(classFeaturesByLevel(c))).toContain('Additional Fighting Style');
    const tagged = [...classFeaturesByLevelTagged(c).values()].flat();
    const t = tagged.find((x) => x.feature.name === 'Additional Fighting Style');
    expect(t?.subclassName).toBe('Champion');
    const early = [...classFeaturesByLevelTagged(character([entry('fighter', 6, 'champion')])).values()].flat();
    expect(early.some((x) => x.feature.name === 'Additional Fighting Style')).toBe(false);
  });
});

describe('subclass features reach the advancement preview and print sheet (real data)', () => {
  it('nextLevelPreview for a Champion at Fighter 6 lists Additional Fighting Style', () => {
    const c = character([entry('fighter', 6, 'champion')]);
    expect(nextLevelPreview(c)?.features).toContain('Additional Fighting Style');
  });

  it('buildFeatures prints reached subclass features with the subclass in the source', () => {
    const rows = buildFeatures(character([entry('fighter', 7, 'champion')]));
    const row = rows.find((r) => r.name === 'Additional Fighting Style');
    expect(row?.source).toBe('Fighter (Champion) 7');
    expect(buildFeatures(character([entry('fighter', 6, 'champion')])).some((r) => r.name === 'Additional Fighting Style')).toBe(false);
  });
});

describe('no subclass grants Expertise (PHB 2024)', () => {
  it('leaves grantsExpertise unset on every subclass feature', () => {
    const found: string[] = [];
    for (const [classId, data] of Object.entries(CLASS_CATALOG)) {
      for (const sub of data.subclasses) {
        for (const f of sub.features) if (f.grantsExpertise) found.push(`${classId}/${sub.id}/${f.name}`);
      }
    }
    expect(found).toEqual([]);
  });
});
