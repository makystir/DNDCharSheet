/**
 * Owed-pick COUNT golden + oracle for class-feature choices. Pins exact
 * cardinality per class and level (incl. multiclass), "one too many" rows,
 * repeatable vs once-only entries and invocation prerequisite eligibility.
 * Golden: class-choice-counts-golden.ts (authored from the PHB, not the code).
 */
import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, ClassChoiceKey, ClassEntry } from '../../types/character';
import { INVOCATION_CATALOG } from '../../data/invocations';
import {
  CLASS_CHOICE_GRANTS,
  choiceOwed,
  choiceStatus,
  formatInvocationEntry,
  invocationEligibility,
  parseInvocationEntry,
  pendingClassChoices,
  pendingCreationChoices,
  removeClassChoice,
  sanitizeClassChoices,
  setClassChoice,
  toggleClassChoice,
} from '../class-choices';
import { multiclassPickStatus, pendingMulticlassPicks } from '../multiclass-picks';
import {
  GOLDEN_INVOCATION_COUNT,
  GOLDEN_MULTICLASS_PICK_ROWS,
  GOLDEN_MULTICLASS_ROWS,
  GOLDEN_OWED_GROUP_COUNT,
  GOLDEN_SPELL_PICK_ROWS,
  GOLDEN_SUBCLASS_GATE_ROWS,
  INVOCATION_PREREQ_GOLDEN,
  OWED_GOLDEN,
} from './class-choice-counts-golden';

function make(classes: Array<{ id: string; level: number; subclassId?: string }>): Character {
  const c = createCharacter('Choices');
  const total = classes.reduce((s, e) => s + e.level, 0);
  return {
    ...c,
    level: total,
    classes: classes as unknown as ClassEntry[],
  };
}

const key = (k: string): ClassChoiceKey => k as ClassChoiceKey;

describe('owed counts per class and level (golden)', () => {
  it('pins the number of choice groups', () => {
    expect(OWED_GOLDEN).toHaveLength(GOLDEN_OWED_GROUP_COUNT);
    expect(CLASS_CHOICE_GRANTS).toHaveLength(GOLDEN_OWED_GROUP_COUNT);
    expect(CLASS_CHOICE_GRANTS.map((g) => g.key).sort()).toEqual(OWED_GOLDEN.map((r) => r.key).sort());
  });

  for (const row of OWED_GOLDEN) {
    it(`${row.key}: exact owed count at every class level 1..20`, () => {
      expect(row.owedByLevel).toHaveLength(20);
      for (let level = 1; level <= 20; level++) {
        const c = make([{ id: row.classId, level, subclassId: row.subclassId }]);
        expect(choiceOwed(c, key(row.key)), `${row.key} @ L${level}`).toBe(row.owedByLevel[level - 1]);
      }
    });
  }

  it('a character without the class owes nothing', () => {
    const c = make([{ id: 'fighter', level: 20, subclassId: 'champion' }]);
    for (const g of CLASS_CHOICE_GRANTS) expect(choiceOwed(c, g.key), g.key).toBe(0);
  });

  for (const row of GOLDEN_SUBCLASS_GATE_ROWS) {
    it(`${row.key}: owes 0 for the wrong subclass (${row.wrongSubclassId}) and with none`, () => {
      expect(choiceOwed(make([{ id: row.classId, level: row.level, subclassId: row.wrongSubclassId }]), key(row.key))).toBe(0);
      expect(choiceOwed(make([{ id: row.classId, level: row.level }]), key(row.key))).toBe(0);
    });
  }
});

describe('multiclass: each class uses its own class level (golden)', () => {
  GOLDEN_MULTICLASS_ROWS.forEach((row, i) => {
    it(`row ${i}: ${row.classes.map((c) => `${c.id} ${c.level}`).join(' / ')}`, () => {
      const c = make(row.classes);
      for (const [k, owed] of Object.entries(row.owed)) {
        expect(choiceOwed(c, key(k)), k).toBe(owed);
      }
    });
  });

  it('invocation level prerequisite uses the WARLOCK level, not the character level', () => {
    const c = make([{ id: 'fighter', level: 10 }, { id: 'warlock', level: 4 }]);
    expect(c.level).toBe(14);
    expect(invocationEligibility(c, 'eldritch-smite', ['pact-of-the-blade']).ok).toBe(false);
    const c5 = make([{ id: 'fighter', level: 10 }, { id: 'warlock', level: 5 }]);
    expect(invocationEligibility(c5, 'eldritch-smite', ['pact-of-the-blade']).ok).toBe(true);
  });
});

describe('invocation prerequisite eligibility (golden)', () => {
  it('pins the invocation count and the golden matches the catalog ids', () => {
    expect(INVOCATION_PREREQ_GOLDEN).toHaveLength(GOLDEN_INVOCATION_COUNT);
    expect(Object.keys(INVOCATION_CATALOG).sort()).toEqual(INVOCATION_PREREQ_GOLDEN.map((p) => p.id).sort());
  });

  for (const p of INVOCATION_PREREQ_GOLDEN) {
    it(`${p.id}: level ${p.minLevel}${p.requires ? ` + ${p.requires}` : ''}${p.repeatable ? ', repeatable' : ''}`, () => {
      const held = p.requires ? [p.requires] : [];
      const at = (level: number): Character => make([{ id: 'warlock', level }]);
      expect(invocationEligibility(at(p.minLevel), p.id, held).ok).toBe(true);
      expect(invocationEligibility(at(20), p.id, held).ok).toBe(true);
      if (p.minLevel > 1) {
        const below = invocationEligibility(at(p.minLevel - 1), p.id, held);
        expect(below.ok).toBe(false);
        expect(below.reasons.join(' ')).toContain(`${p.minLevel}`);
      }
      if (p.requires) {
        expect(invocationEligibility(at(20), p.id, []).ok).toBe(false);
      }
      expect(INVOCATION_CATALOG[p.id].repeatable).toBe(p.repeatable);
    });
  }

  it('a non-Warlock never satisfies even a level 1 invocation', () => {
    expect(invocationEligibility(make([{ id: 'fighter', level: 20 }]), 'eldritch-mind', []).ok).toBe(false);
  });

  it('an unknown invocation is not eligible', () => {
    expect(invocationEligibility(make([{ id: 'warlock', level: 20 }]), 'nope', []).ok).toBe(false);
  });
});

describe('chosen / remaining / over (one too many)', () => {
  it('Warlock 5 owes 5: five valid picks are complete, six is one over and still valid', () => {
    const five = ['armor-of-shadows', 'eldritch-mind', 'devils-sight', 'fiendish-vigor', 'mask-of-many-faces'];
    const base = make([{ id: 'warlock', level: 5 }]);
    const exact = setClassChoice(base, 'warlock.invocations', five);
    const s5 = choiceStatus(exact).find((s) => s.key === 'warlock.invocations')!;
    expect([s5.owed, s5.chosen, s5.remaining, s5.over]).toEqual([5, 5, 0, 0]);

    const six = setClassChoice(base, 'warlock.invocations', [...five, 'misty-visions']);
    const s6 = choiceStatus(six).find((s) => s.key === 'warlock.invocations')!;
    expect([s6.owed, s6.chosen, s6.remaining, s6.over]).toEqual([5, 6, 0, 1]);
    expect(s6.invalid).toEqual([]);
    expect(pendingClassChoices(six).some((s) => s.key === 'warlock.invocations')).toBe(false);
  });

  it('Warlock 5 holding two picks has three remaining', () => {
    const c = setClassChoice(make([{ id: 'warlock', level: 5 }]), 'warlock.invocations', ['armor-of-shadows', 'eldritch-mind']);
    const s = choiceStatus(c).find((x) => x.key === 'warlock.invocations')!;
    expect([s.owed, s.chosen, s.remaining, s.over]).toEqual([5, 2, 3, 0]);
  });

  it('Sorcerer 2 owes 2 Metamagic; three picks is one over', () => {
    const base = make([{ id: 'sorcerer', level: 2 }]);
    const c = setClassChoice(base, 'sorcerer.metamagic', ['careful-spell', 'distant-spell', 'empowered-spell']);
    const s = choiceStatus(c).find((x) => x.key === 'sorcerer.metamagic')!;
    expect([s.owed, s.chosen, s.remaining, s.over]).toEqual([2, 3, 0, 1]);
  });

  it('a group with picks but nothing owed (class removed) is reported over, never deleted', () => {
    const c = setClassChoice(make([{ id: 'fighter', level: 5 }]), 'sorcerer.metamagic', ['careful-spell']);
    const s = choiceStatus(c).find((x) => x.key === 'sorcerer.metamagic')!;
    expect([s.owed, s.chosen, s.remaining, s.over]).toEqual([0, 1, 0, 1]);
    expect(c.classChoices?.['sorcerer.metamagic']).toEqual(['careful-spell']);
  });

  it('single pick groups: Cleric 1 owes Divine Order; picking clears pending', () => {
    const base = make([{ id: 'cleric', level: 1 }]);
    expect(pendingClassChoices(base).map((s) => s.key)).toEqual(['cleric.divineOrder']);
    expect(pendingCreationChoices(base).map((s) => s.key)).toEqual(['cleric.divineOrder']);
    const picked = setClassChoice(base, 'cleric.divineOrder', ['protector']);
    expect(pendingClassChoices(picked)).toEqual([]);
    const both = setClassChoice(base, 'cleric.divineOrder', ['protector', 'thaumaturge']);
    const s = choiceStatus(both)[0];
    expect([s.owed, s.chosen, s.remaining, s.over]).toEqual([1, 2, 0, 1]);
  });

  it('pendingCreationChoices covers only level-1 groups (Warlock 1, Druid 1, Cleric 1)', () => {
    const c = make([{ id: 'warlock', level: 7 }]);
    expect(pendingClassChoices(c).map((s) => s.key)).toEqual(['warlock.invocations']);
    expect(pendingCreationChoices(c).map((s) => s.key)).toEqual(['warlock.invocations']);
    const sorc = make([{ id: 'sorcerer', level: 2 }]);
    expect(pendingClassChoices(sorc).map((s) => s.key)).toEqual(['sorcerer.metamagic']);
    expect(pendingCreationChoices(sorc)).toEqual([]);
  });

  it('Battle Master 7 owes 5 maneuvers; Champion 7 owes none', () => {
    expect(choiceOwed(make([{ id: 'fighter', level: 7, subclassId: 'battleMaster' }]), 'fighter.maneuvers')).toBe(5);
    expect(choiceOwed(make([{ id: 'fighter', level: 7, subclassId: 'champion' }]), 'fighter.maneuvers')).toBe(0);
  });
});

describe('once-only vs repeatable and validity', () => {
  const warlock = (level: number): Character => make([{ id: 'warlock', level }]);

  it('a repeated once-only entry counts once (duplicate)', () => {
    const c = setClassChoice(make([{ id: 'sorcerer', level: 10 }]), 'sorcerer.metamagic', ['careful-spell', 'careful-spell']);
    const s = choiceStatus(c).find((x) => x.key === 'sorcerer.metamagic')!;
    expect(s.chosen).toBe(1);
    expect(s.duplicates).toEqual(['careful-spell']);
    expect(s.remaining).toBe(3);
  });

  it('Agonizing Blast twice with the SAME cantrip counts once; with a DIFFERENT cantrip counts twice', () => {
    const same = setClassChoice(warlock(2), 'warlock.invocations', ['agonizing-blast#eldritch-blast', 'agonizing-blast#eldritch-blast']);
    const sSame = choiceStatus(same)[0];
    expect([sSame.chosen, sSame.duplicates.length, sSame.invalid.length]).toEqual([1, 1, 0]);

    const diff = setClassChoice(warlock(2), 'warlock.invocations', ['agonizing-blast#eldritch-blast', 'agonizing-blast#fire-bolt']);
    const sDiff = choiceStatus(diff)[0];
    expect([sDiff.chosen, sDiff.duplicates.length, sDiff.invalid.length]).toEqual([2, 0, 0]);
  });

  it('Lessons of the First Ones repeats with different Origin feats', () => {
    const c = setClassChoice(warlock(2), 'warlock.invocations', ['lessons-of-the-first-ones#alert', 'lessons-of-the-first-ones#tough']);
    expect(choiceStatus(c)[0].chosen).toBe(2);
  });

  it('a non-repeatable invocation with a parameter is invalid; so is an empty parameter', () => {
    const c = setClassChoice(warlock(5), 'warlock.invocations', ['eldritch-mind#x', 'agonizing-blast#']);
    const s = choiceStatus(c)[0];
    expect(s.chosen).toBe(0);
    expect(s.invalid).toEqual(['eldritch-mind#x', 'agonizing-blast#']);
  });

  it('unknown ids are invalid, kept in the list and never counted', () => {
    const c = setClassChoice(make([{ id: 'sorcerer', level: 2 }]), 'sorcerer.metamagic', ['careful-spell', 'made-up']);
    const s = choiceStatus(c)[0];
    expect([s.chosen, s.remaining]).toEqual([1, 1]);
    expect(s.invalid).toEqual(['made-up']);
    expect(c.classChoices?.['sorcerer.metamagic']).toEqual(['careful-spell', 'made-up']);
  });

  it('an invocation whose prerequisite fails is invalid but kept (Eldritch Smite at Warlock 4)', () => {
    const c = setClassChoice(warlock(4), 'warlock.invocations', ['pact-of-the-blade', 'eldritch-smite']);
    const s = choiceStatus(c)[0];
    expect(s.chosen).toBe(1);
    expect(s.invalid).toEqual(['eldritch-smite']);
    // At Warlock 5 with the Pact of the Blade it is valid.
    const ok = setClassChoice(warlock(5), 'warlock.invocations', ['pact-of-the-blade', 'eldritch-smite']);
    expect(choiceStatus(ok)[0].invalid).toEqual([]);
    expect(choiceStatus(ok)[0].chosen).toBe(2);
  });

  it('prerequisite invocations may be listed after the dependent one', () => {
    const c = setClassChoice(warlock(12), 'warlock.invocations', ['devouring-blade', 'thirsting-blade', 'pact-of-the-blade']);
    const s = choiceStatus(c)[0];
    expect(s.invalid).toEqual([]);
    expect(s.chosen).toBe(3);
  });

  it('Devouring Blade needs Warlock 12 AND Thirsting Blade', () => {
    const noReq = setClassChoice(warlock(12), 'warlock.invocations', ['devouring-blade']);
    expect(choiceStatus(noReq)[0].invalid).toEqual(['devouring-blade']);
    const low = setClassChoice(warlock(11), 'warlock.invocations', ['thirsting-blade', 'pact-of-the-blade', 'devouring-blade']);
    expect(choiceStatus(low)[0].invalid).toEqual(['devouring-blade']);
  });

  it('spell groups reject empty ids', () => {
    const base = make([{ id: 'wizard', level: 18 }]);
    const c = setClassChoice(
      { ...base, spellcasting: { byClass: { wizard: { spellbook: ['magic-missile'] } } } } as unknown as Character,
      'wizard.spellMastery',
      ['magic-missile', ''],
    );
    const s = choiceStatus(c)[0];
    expect([s.owed, s.chosen, s.remaining]).toEqual([2, 1, 1]);
    expect(s.invalid).toEqual(['']);
  });

  describe('Wizard spell picks are validated against the spellbook, level and casting time (golden)', () => {
    for (const row of GOLDEN_SPELL_PICK_ROWS) {
      it(row.name, () => {
        const base = make([{ id: 'wizard', level: row.level }]);
        const withBook = {
          ...base,
          spellcasting: { byClass: { wizard: { spellbook: [...row.spellbook] } } },
        } as unknown as Character;
        const c = setClassChoice(withBook, row.key, row.picks);
        const s = choiceStatus(c).find((x) => x.key === row.key)!;
        expect(s.chosen).toBe(row.chosen);
        expect(s.invalid).toEqual(row.invalid);
        expect(s.remaining).toBe(2 - row.chosen);
        expect(s.over).toBe(0);
      });
    }
  });

  it('skill and tool groups are limited to their lists', () => {
    const bk = setClassChoice(make([{ id: 'barbarian', level: 3 }]), 'barbarian.primalKnowledge', ['arcana']);
    expect(choiceStatus(bk)[0].invalid).toEqual(['arcana']); // not on the Barbarian skill list
    const bk2 = setClassChoice(make([{ id: 'barbarian', level: 3 }]), 'barbarian.primalKnowledge', ['athletics']);
    expect(choiceStatus(bk2)[0].invalid).toEqual([]);
    const tool = setClassChoice(make([{ id: 'fighter', level: 3, subclassId: 'battleMaster' }]), 'fighter.studentOfWarTool', ['smiths-tools']);
    expect(choiceStatus(tool).find((s) => s.key === 'fighter.studentOfWarTool')!.chosen).toBe(1);
  });
});

describe('multiclass skill / instrument picks (golden)', () => {
  for (const row of GOLDEN_MULTICLASS_PICK_ROWS) {
    it(`${row.initial} then ${row.added}`, () => {
      const c = make([{ id: row.initial, level: 1 }, { id: row.added, level: 1 }]);
      const picks = multiclassPickStatus(c).map((p) => [p.kind, p.owed] as const);
      expect(picks).toEqual(row.picks);
      expect(pendingMulticlassPicks(c)).toHaveLength(row.picks.length);
    });
  }

  it('skill picks come from ClassEntry.skillChoices and the class list', () => {
    const base = make([{ id: 'fighter', level: 1 }, { id: 'ranger', level: 1 }]);
    const withSkill: Character = {
      ...base,
      classes: [base.classes![0], { ...base.classes![1], skillChoices: ['stealth'] }],
    };
    const p = multiclassPickStatus(withSkill)[0];
    expect([p.chosen, p.remaining, p.over]).toEqual([1, 0, 0]);
    // A skill outside the Ranger list does not count.
    const off: Character = {
      ...base,
      classes: [base.classes![0], { ...base.classes![1], skillChoices: ['arcana'] }],
    };
    expect(multiclassPickStatus(off)[0].chosen).toBe(0);
    // Two picks: one over.
    const two: Character = {
      ...base,
      classes: [base.classes![0], { ...base.classes![1], skillChoices: ['stealth', 'nature'] }],
    };
    expect(multiclassPickStatus(two)[0].over).toBe(1);
  });

  it('Bard instrument lives in classChoices and satisfies the pick', () => {
    const base = make([{ id: 'fighter', level: 1 }, { id: 'bard', level: 1 }]);
    const picked = setClassChoice(base, 'bard.multiclassInstrument', ['lute']);
    const p = multiclassPickStatus(picked).find((x) => x.kind === 'instrument')!;
    expect([p.owed, p.chosen, p.remaining, p.over]).toEqual([1, 1, 0, 0]);
  });

  it('Bard as the INITIAL class owes no multiclass pick', () => {
    expect(multiclassPickStatus(make([{ id: 'bard', level: 5 }]))).toEqual([]);
  });
});

describe('mutators', () => {
  const base = make([{ id: 'sorcerer', level: 2 }]);

  it('setClassChoice never mutates and removes the key and field when emptied', () => {
    const snapshot = JSON.stringify(base);
    const a = setClassChoice(base, 'sorcerer.metamagic', ['careful-spell']);
    expect(JSON.stringify(base)).toBe(snapshot);
    expect(base.classChoices).toBeUndefined();
    expect(a.classChoices).toEqual({ 'sorcerer.metamagic': ['careful-spell'] });
    const b = setClassChoice(a, 'sorcerer.metamagic', []);
    expect('classChoices' in b).toBe(false);
  });

  it('toggle adds beyond the owed count (never capped) and removes on the second toggle', () => {
    let c = base;
    for (const id of ['careful-spell', 'distant-spell', 'empowered-spell']) c = toggleClassChoice(c, 'sorcerer.metamagic', id);
    expect(c.classChoices?.['sorcerer.metamagic']).toHaveLength(3);
    c = toggleClassChoice(c, 'sorcerer.metamagic', 'distant-spell');
    expect(c.classChoices?.['sorcerer.metamagic']).toEqual(['careful-spell', 'empowered-spell']);
  });

  it('removeClassChoice drops one entry and keeps other groups', () => {
    let c = setClassChoice(base, 'sorcerer.metamagic', ['careful-spell']);
    c = setClassChoice(c, 'warlock.invocations', ['eldritch-mind']);
    const r = removeClassChoice(c, 'sorcerer.metamagic', 'careful-spell');
    expect(r.classChoices).toEqual({ 'warlock.invocations': ['eldritch-mind'] });
  });
});

describe('invocation entry encoding', () => {
  it('round-trips id#param', () => {
    expect(parseInvocationEntry('agonizing-blast#fire-bolt')).toEqual({ id: 'agonizing-blast', param: 'fire-bolt' });
    expect(parseInvocationEntry('eldritch-mind')).toEqual({ id: 'eldritch-mind' });
    expect(formatInvocationEntry('agonizing-blast', 'fire-bolt')).toBe('agonizing-blast#fire-bolt');
    expect(formatInvocationEntry('eldritch-mind')).toBe('eldritch-mind');
  });
});

describe('sanitizeClassChoices (untrusted input)', () => {
  it('keeps valid groups and drops everything else', () => {
    const out = sanitizeClassChoices({
      'sorcerer.metamagic': ['careful-spell', 5, '', 'x'.repeat(65), null],
      'unknown.key': ['a'],
      'warlock.invocations': 'not-an-array',
      __proto__: { 'cleric.divineOrder': ['protector'] },
    });
    expect(out).toEqual({ 'sorcerer.metamagic': ['careful-spell'] });
  });

  it('caps group size and returns undefined for empty or non-object input', () => {
    const big = Array.from({ length: 100 }, (_, i) => `m${i}`);
    expect(sanitizeClassChoices({ 'sorcerer.metamagic': big })?.['sorcerer.metamagic']).toHaveLength(40);
    expect(sanitizeClassChoices({})).toBeUndefined();
    expect(sanitizeClassChoices({ 'sorcerer.metamagic': [] })).toBeUndefined();
    expect(sanitizeClassChoices(null)).toBeUndefined();
    expect(sanitizeClassChoices('x')).toBeUndefined();
    expect(sanitizeClassChoices([])).toBeUndefined();
  });
});
