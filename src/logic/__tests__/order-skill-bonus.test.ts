/**
 * Harness for order-skill-bonus-golden.ts (rows authored from the PHB first; never
 * edited here): Cleric Thaumaturge / Druid Magician Intelligence-check bonus as its
 * own labelled component of the skill breakdown.
 */
import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, ClassEntry, SkillId } from '../../types/character';
import { setClassChoice } from '../class-choices';
import { allSkillBreakdowns } from '../skills';
import { passivePerceptionBreakdown } from '../passive-checks';
import {
  COVERED,
  GOLDEN_INT,
  GOLDEN_LEVEL,
  NEVER_COVERED,
  NEVER_COVERED_TOTALS,
  ORDER_BONUS_ROWS,
  PASSIVE_PERCEPTION_WIS16_PROF,
} from './order-skill-bonus-golden';
import type { OrderBonusRow } from './order-skill-bonus-golden';

type Training = 'untrained' | 'proficient' | 'expertise';

function build(classId: 'cleric' | 'druid', order: string | undefined, wis: number, training: Training, skill: SkillId): Character {
  const base = createCharacter('Order');
  const c: Character = {
    ...base,
    level: GOLDEN_LEVEL,
    classes: [{ id: classId, level: GOLDEN_LEVEL }] as unknown as ClassEntry[],
    abilities: { str: 10, dex: 10, con: 10, int: GOLDEN_INT, wis, cha: 10 },
    skills: { [skill]: { proficient: training !== 'untrained', expertise: training === 'expertise' } },
  };
  const key = classId === 'cleric' ? 'cleric.divineOrder' : 'druid.primalOrder';
  return order === undefined ? c : setClassChoice(c, key, [order]);
}

const bonusComponents = (c: Character, skill: SkillId) =>
  allSkillBreakdowns(c)[skill].components.filter((x) => /Thaumaturge|Magician/.test(x.label));

const CASES = [
  { classId: 'cleric', order: 'thaumaturge', covered: COVERED.thaumaturge, label: 'Cleric Thaumaturge', uncovered: 'nature' },
  { classId: 'druid', order: 'magician', covered: COVERED.magician, label: 'Druid Magician', uncovered: 'religion' },
] as const;

describe('Thaumaturge / Magician: Wisdom-modifier bonus to Intelligence skill checks', () => {
  for (const kase of CASES) {
    describe(kase.label, () => {
      for (const row of ORDER_BONUS_ROWS) {
        for (const training of ['untrained', 'proficient', 'expertise'] as const) {
          it(`Wis ${row.wis} (${row.wisMod}), ${training}: bonus ${row.bonus}`, () => {
            for (const skill of kase.covered) {
              const c = build(kase.classId, kase.order, row.wis, training, skill as SkillId);
              const b = allSkillBreakdowns(c)[skill as SkillId];
              const comps = bonusComponents(c, skill as SkillId);
              // Its own labelled component naming the source, shown even at the minimum +1.
              expect(comps, `${skill}`).toEqual([{ label: expect.stringContaining(kase.label), value: row.bonus }]);
              expect(b.total, `${skill} total`).toBe((row as OrderBonusRow)[training]);
              expect(b.components.reduce((n, x) => n + x.value, 0)).toBe(b.total);
            }
          });
        }
      }

      it('the other order choice (Protector / Warden) and no choice get nothing', () => {
        const none = kase.classId === 'cleric' ? 'protector' : 'warden';
        for (const order of [none, undefined]) {
          const c = build(kase.classId, order, 16, 'untrained', 'arcana');
          expect(bonusComponents(c, 'arcana')).toEqual([]);
          expect(allSkillBreakdowns(c).arcana.total).toBe(2);
        }
      });

      it('the other skills do not get it', () => {
        const c = build(kase.classId, kase.order, 16, 'untrained', 'arcana');
        const all = allSkillBreakdowns(c);
        for (const id of NEVER_COVERED) {
          expect(all[id as SkillId].total, id).toBe(NEVER_COVERED_TOTALS[id]);
          expect(all[id as SkillId].components.some((x) => /Thaumaturge|Magician/.test(x.label)), id).toBe(false);
        }
        // The Int skill the PHB list for THIS order omits.
        expect(bonusComponents(c, kase.uncovered as SkillId)).toEqual([]);
      });

      it('does not touch passive Perception (Wisdom (Perception))', () => {
        const c = build(kase.classId, kase.order, 16, 'proficient', 'perception');
        expect(passivePerceptionBreakdown(c).total).toBe(PASSIVE_PERCEPTION_WIS16_PROF);
      });
    });
  }

  it('a choice stored for a class the character does not have gives nothing', () => {
    const c = setClassChoice(build('druid', undefined, 16, 'untrained', 'arcana'), 'cleric.divineOrder', ['thaumaturge']);
    expect(bonusComponents(c, 'arcana')).toEqual([]);
  });

  it('Cleric Thaumaturge + Druid Magician each add their own component to Arcana (distinct features)', () => {
    let c = build('cleric', 'thaumaturge', 16, 'untrained', 'arcana');
    c = { ...c, level: 10, classes: [{ id: 'cleric', level: 5 }, { id: 'druid', level: 5 }] as unknown as ClassEntry[] };
    c = setClassChoice(c, 'druid.primalOrder', ['magician']);
    const comps = bonusComponents(c, 'arcana');
    expect(comps.map((x) => x.value)).toEqual([3, 3]);
    expect(comps.map((x) => x.label).sort()).toEqual([expect.stringContaining('Cleric Thaumaturge'), expect.stringContaining('Druid Magician')]);
  });
});
