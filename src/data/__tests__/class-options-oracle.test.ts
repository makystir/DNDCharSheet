/**
 * ORACLE test for the small class-feature option sets (Stage 3), compared with
 * the independently authored golden (./class-options-golden.ts, from the PHB
 * 2024). Fails closed: messages name `<set>/<id>.<field>`; cardinalities are
 * asserted separately; the subclass option picks are cross-checked against the
 * `choices` already declared on the matching features in src/data/classes.ts,
 * and tool ids against src/data/equipment.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  ARTISANS_TOOLS,
  BLESSED_STRIKES_OPTIONS,
  DIVINE_ORDER_OPTIONS,
  ELEMENTAL_FURY_OPTIONS,
  MUSICAL_INSTRUMENTS,
  PRIMAL_ORDER_OPTIONS,
  SUBCLASS_PICK_OPTIONS,
  type OrderOption,
  type SimpleOption,
  type SubclassPickKey,
  type ToolOption,
} from '../class-options';
import { CLASS_CATALOG } from '../classes';
import { getEquipment } from '../equipment';
import {
  ARTISANS_TOOLS_GOLDEN,
  BLESSED_STRIKES_GOLDEN,
  DIVINE_ORDER_GOLDEN,
  ELEMENTAL_FURY_GOLDEN,
  GOLDEN_ARTISANS_TOOLS_COUNT,
  GOLDEN_BARBARIAN_SKILL_LIST,
  GOLDEN_FIGHTER_SKILL_LIST,
  GOLDEN_MUSICAL_INSTRUMENT_COUNT,
  MUSICAL_INSTRUMENTS_GOLDEN,
  PRIMAL_ORDER_GOLDEN,
  SUBCLASS_PICKS_GOLDEN,
  type GoldenOrderOption,
  type GoldenSimpleOption,
  type GoldenToolOption,
} from './class-options-golden';

function checkSet<T extends { id: string; source: string }, G extends { id: string; line: number }>(
  label: string,
  have: readonly T[],
  want: readonly G[],
  compare: (r: T, g: G) => void,
): void {
  describe(label, () => {
    it(`has exactly ${want.length} options (cardinality)`, () => {
      expect(have).toHaveLength(want.length);
    });
    it('has no missing and no extra records (by name)', () => {
      const w = want.map((g) => g.id).sort();
      const h = have.map((r) => r.id).sort();
      expect(w.filter((id) => !h.includes(id)), `${label} missing`).toEqual([]);
      expect(h.filter((id) => !w.includes(id)), `${label} extra`).toEqual([]);
    });
    for (const g of want) {
      it(`${g.id} matches the PHB`, () => {
        const r = have.find((x) => x.id === g.id);
        expect(r, `${label}/${g.id} exists`).toBeDefined();
        if (!r) return;
        expect(r.source, `${label}/${g.id}.source cites L${g.line}`).toContain(`L${g.line}`);
        compare(r, g);
      });
    }
  });
}

const cmpOrder = (r: OrderOption, g: GoldenOrderOption): void => {
  expect(r.name, `${g.id}.name`).toBe(g.name);
  expect(r.weapons, `${g.id}.weapons`).toEqual(g.weapons);
  expect(r.armor, `${g.id}.armor`).toEqual(g.armor);
  expect(r.extraCantrips, `${g.id}.extraCantrips`).toBe(g.extraCantrips);
  expect(r.skillBonusSkills, `${g.id}.skillBonusSkills`).toEqual(g.skillBonusSkills);
  expect(r.summary.trim().length, `${g.id}.summary`).toBeGreaterThan(10);
};
const cmpSimple = (r: SimpleOption, g: GoldenSimpleOption): void => {
  expect(r.name, `${g.id}.name`).toBe(g.name);
  expect(r.dice, `${g.id}.dice`).toEqual(g.dice);
  expect(r.summary.trim().length, `${g.id}.summary`).toBeGreaterThan(10);
};
const cmpTool = (r: ToolOption, g: GoldenToolOption): void => {
  expect(r.name, `${g.id}.name`).toBe(g.name);
  expect(r.equipmentId, `${g.id}.equipmentId`).toBe(g.equipmentId);
  expect(getEquipment(r.equipmentId), `${g.id} equipment record ${r.equipmentId} exists`).toBeDefined();
};

describe('Class option catalogs oracle', () => {
  checkSet('Divine Order', DIVINE_ORDER_OPTIONS, DIVINE_ORDER_GOLDEN, cmpOrder);
  checkSet('Primal Order', PRIMAL_ORDER_OPTIONS, PRIMAL_ORDER_GOLDEN, cmpOrder);
  checkSet('Blessed Strikes', BLESSED_STRIKES_OPTIONS, BLESSED_STRIKES_GOLDEN, cmpSimple);
  checkSet('Elemental Fury', ELEMENTAL_FURY_OPTIONS, ELEMENTAL_FURY_GOLDEN, cmpSimple);
  checkSet("Artisan's Tools", ARTISANS_TOOLS, ARTISANS_TOOLS_GOLDEN, cmpTool);
  checkSet('Musical Instruments', MUSICAL_INSTRUMENTS, MUSICAL_INSTRUMENTS_GOLDEN, cmpTool);

  for (const key of Object.keys(SUBCLASS_PICKS_GOLDEN) as SubclassPickKey[]) {
    checkSet(`Subclass pick ${key}`, SUBCLASS_PICK_OPTIONS[key], SUBCLASS_PICKS_GOLDEN[key], cmpSimple);
  }

  it('pins the set sizes', () => {
    expect(ARTISANS_TOOLS).toHaveLength(GOLDEN_ARTISANS_TOOLS_COUNT);
    expect(MUSICAL_INSTRUMENTS).toHaveLength(GOLDEN_MUSICAL_INSTRUMENT_COUNT);
    expect(Object.keys(SUBCLASS_PICK_OPTIONS).sort()).toEqual(Object.keys(SUBCLASS_PICKS_GOLDEN).sort());
  });

  it('Divine/Primal Order grants: Protector/Warden give Martial weapons, Thaumaturge/Magician one cantrip', () => {
    for (const o of [...DIVINE_ORDER_OPTIONS, ...PRIMAL_ORDER_OPTIONS]) {
      const battle = o.id === 'protector' || o.id === 'warden';
      expect(o.weapons.length > 0, `${o.id} weapons`).toBe(battle);
      expect(o.extraCantrips, `${o.id} extraCantrips`).toBe(battle ? 0 : 1);
    }
  });

  describe('cross-checks against classes.ts', () => {
    const optionNames = (opts: { name: string }[]): string[] => opts.map((o) => o.name).sort();

    function choiceOptions(cls: 'ranger' | 'barbarian' | 'sorcerer', sub: string, key: string): string[] {
      const sc = (CLASS_CATALOG[cls].subclasses as Array<{ id: string; features: Array<{ choices?: Array<{ key: string; options: string[] }> }> }>).find(
        (s) => s.id === sub,
      );
      const choice = sc?.features.flatMap((f) => f.choices ?? []).find((c) => c.key === key);
      return [...(choice?.options ?? [])].sort();
    }

    it("Hunter's Prey and Defensive Tactics options equal the Hunter feature choices", () => {
      expect(optionNames(SUBCLASS_PICK_OPTIONS.huntersPrey)).toEqual(choiceOptions('ranger', 'hunter', 'hunters-prey'));
      expect(optionNames(SUBCLASS_PICK_OPTIONS.defensiveTactics)).toEqual(choiceOptions('ranger', 'hunter', 'defensive-tactics'));
    });
    it('Aspect of the Wilds and Elemental Affinity options equal the subclass feature choices', () => {
      expect(optionNames(SUBCLASS_PICK_OPTIONS.aspectOfTheWilds)).toEqual(choiceOptions('barbarian', 'wildHeart', 'aspect-of-the-wilds'));
      expect(optionNames(SUBCLASS_PICK_OPTIONS.elementalAffinity)).toEqual(choiceOptions('sorcerer', 'draconic', 'elemental-affinity'));
    });
    it('Primal Companion and Glamour skill options equal the Ranger subclass choices', () => {
      expect(optionNames(SUBCLASS_PICK_OPTIONS.primalCompanion)).toEqual(choiceOptions('ranger', 'beastMaster', 'beast'));
      expect(optionNames(SUBCLASS_PICK_OPTIONS.glamourSkill)).toEqual(choiceOptions('ranger', 'feyWanderer', 'glamour-skill'));
    });
    it('the Barbarian and Fighter level-1 skill lists match the PHB (Primal Knowledge, Student of War)', () => {
      const barb = CLASS_CATALOG.barbarian.skillChoices.from;
      const fight = CLASS_CATALOG.fighter.skillChoices.from;
      expect([...(barb as string[])].sort()).toEqual([...GOLDEN_BARBARIAN_SKILL_LIST].sort());
      expect([...(fight as string[])].sort()).toEqual([...GOLDEN_FIGHTER_SKILL_LIST].sort());
    });
  });
});
