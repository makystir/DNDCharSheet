import { afterEach, describe, expect, it } from 'vitest';
import { CLASS_CATALOG } from '../../data/classes';
import type { ClassFeature } from '../../data/classes';
import { BLANK_CHARACTER } from '../../types/character';
import type { Character, ClassEntry } from '../../types/character';
import {
  classFeaturesByLevel,
  classFeaturesByLevelTagged,
  entrySubclass,
  resolveSubclass,
  resolveSubclasses,
} from '../classes';
import { fightingStyleSlots, applyFightingStyle } from '../feats';
import { classAlwaysPreparedSpells } from '../spellcasting';

// Structural tests for how subclass features flow through the class logic. They
// inject a synthetic feature into a real subclass (and restore it afterwards) so
// they stay valid whatever the catalog contains.

const PROBE: ClassFeature = {
  name: 'Probe Feature',
  level: 5,
  effect: 'Synthetic probe used only by this test.',
  source: 'test',
};

const injected: Array<{ features: ClassFeature[] }> = [];
function inject(sub: { features: ClassFeature[] }, feature: ClassFeature): void {
  sub.features.push(feature);
  injected.push(sub);
}
afterEach(() => {
  for (const sub of injected.splice(0)) {
    sub.features = sub.features.filter((f) => f.name !== PROBE.name && !f.name.startsWith('Probe '));
  }
});

function character(classes: ClassEntry[]): Character {
  return {
    ...BLANK_CHARACTER,
    level: classes.reduce((n, c) => n + c.level, 0),
    classes,
  };
}

const berserker = CLASS_CATALOG.barbarian.subclasses.find((s) => s.id === 'berserker')!;
const champion = CLASS_CATALOG.fighter.subclasses.find((s) => s.id === 'champion')!;

describe('subclass resolution across class entries', () => {
  it('resolveSubclass reads only the primary class (documented)', () => {
    const c = character([
      { id: 'fighter', level: 3 },
      { id: 'barbarian', level: 3, subclassId: 'berserker' },
    ]);
    expect(resolveSubclass(c)).toBeUndefined();
  });

  it('resolveSubclasses finds a subclass chosen on a non-primary class', () => {
    const c = character([
      { id: 'fighter', level: 3 },
      { id: 'barbarian', level: 3, subclassId: 'berserker' },
    ]);
    const found = resolveSubclasses(c);
    expect(found.map((f) => f.subclass.id)).toEqual(['berserker']);
    expect(found[0].data.id).toBe('barbarian');
  });

  it('gates the subclass on the entry level, not the character level', () => {
    const entry: ClassEntry = { id: 'barbarian', level: 2, subclassId: 'berserker' };
    expect(entrySubclass(entry)).toBeUndefined();
    expect(entrySubclass({ ...entry, level: 3 })?.id).toBe('berserker');
  });
});

describe('subclass features in the class feature views', () => {
  it('classFeaturesByLevel includes a chosen non-primary subclass feature', () => {
    inject(berserker, PROBE);
    const c = character([
      { id: 'fighter', level: 3 },
      { id: 'barbarian', level: 5, subclassId: 'berserker' },
    ]);
    const names = (classFeaturesByLevel(c).get(5) ?? []).map((f) => f.name);
    expect(names).toContain('Probe Feature');
  });

  it('omits subclass features when no subclass is chosen', () => {
    inject(berserker, PROBE);
    const c = character([{ id: 'barbarian', level: 5 }]);
    const names = [...classFeaturesByLevel(c).values()].flat().map((f) => f.name);
    expect(names).not.toContain('Probe Feature');
  });

  it('classFeaturesByLevelTagged gates by class level and tags the subclass', () => {
    inject(berserker, PROBE);
    const at = (level: number): Character =>
      character([{ id: 'barbarian', level, subclassId: 'berserker' }]);
    const reached = classFeaturesByLevelTagged(at(5)).get(5) ?? [];
    const probe = reached.find((t) => t.feature.name === 'Probe Feature');
    expect(probe?.subclassName).toBe(berserker.name);
    expect(probe?.classId).toBe('barbarian');
    const early = [...classFeaturesByLevelTagged(at(4)).values()].flat();
    expect(early.some((t) => t.feature.name === 'Probe Feature')).toBe(false);
  });
});

describe('structured subclass mechanics hooks', () => {
  it('a subclass grantsFightingStyle feature adds a second Fighting Style slot', () => {
    inject(champion, { ...PROBE, name: 'Probe Style', level: 7, grantsFightingStyle: true });
    const c = character([{ id: 'fighter', level: 7, subclassId: 'champion' }]);
    const slots = fightingStyleSlots(c);
    expect(slots.map((s) => s.key)).toEqual(['fighter', 'fighter:subclass']);
    const lower = character([{ id: 'fighter', level: 6, subclassId: 'champion' }]);
    expect(fightingStyleSlots(lower).map((s) => s.key)).toEqual(['fighter']);
    const picked = applyFightingStyle(c, 'fighter:subclass', 'archery', 1);
    expect(fightingStyleSlots(picked).find((s) => s.key === 'fighter:subclass')?.filled?.featId).toBe('archery');
    expect(fightingStyleSlots(picked).find((s) => s.key === 'fighter')?.filled).toBeUndefined();
  });

  it('subclass grantedSpells that are alwaysPrepared feed classAlwaysPreparedSpells at the class level', () => {
    const oath = CLASS_CATALOG.paladin.subclasses[0];
    inject(oath, {
      ...PROBE,
      name: 'Probe Spells',
      level: 3,
      grantedSpells: [{ level: 3, spells: ['bless'], alwaysPrepared: true }],
    });
    const entry: ClassEntry = { id: 'paladin', level: 3, subclassId: oath.id as ClassEntry['subclassId'] };
    expect(classAlwaysPreparedSpells(entry)).toContain('bless');
    expect(classAlwaysPreparedSpells({ ...entry, level: 2 })).not.toContain('bless');
  });
});
