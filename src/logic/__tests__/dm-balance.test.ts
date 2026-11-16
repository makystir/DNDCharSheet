import { describe, it, expect } from 'vitest';
import { NPC_TEMPLATE_LIST } from '../../data/npc-templates';
import { CREATURE_LIST } from '../../data/creatures';
import { XP_BUDGET_PER_CHARACTER, XP_BY_CR } from '../../data/xp-tables';
import {
  balanceNotes,
  difficultyFit,
  encounterXp,
  fitLabel,
  xpAward,
  xpBudget,
  xpForCr,
} from '../dm-balance';
import { combatantFromCreature, combatantFromTemplate, customCombatant } from '../dm-encounter';
import { crToNumber } from '../dm-library';
import type { DmCombatant } from '../../types/dm';

const mon = (name: string, xp?: number, cr?: string, label = 'Custom'): DmCombatant => ({
  ...customCombatant(name, { name, ac: 10, hpMax: 10, initiativeMod: 0 }),
  sourceLabel: label,
  ...(xp !== undefined ? { xp } : {}),
  ...(cr !== undefined ? { cr } : {}),
});

describe('XP tables', () => {
  it('has a budget row for each of the 20 levels, rising by level and by difficulty', () => {
    expect(XP_BUDGET_PER_CHARACTER).toHaveLength(20);
    XP_BUDGET_PER_CHARACTER.forEach((row, i) => {
      expect(row.low).toBeLessThan(row.moderate);
      expect(row.moderate).toBeLessThan(row.high);
      if (i > 0) {
        const prev = XP_BUDGET_PER_CHARACTER[i - 1];
        expect(row.low).toBeGreaterThan(prev.low);
        expect(row.moderate).toBeGreaterThan(prev.moderate);
        expect(row.high).toBeGreaterThan(prev.high);
      }
    });
  });

  it('has XP for CR 0, the fractions and 1 to 30, rising with CR', () => {
    const order = ['0', '1/8', '1/4', '1/2', ...Array.from({ length: 30 }, (_, i) => String(i + 1))];
    expect(Object.keys(XP_BY_CR)).toHaveLength(order.length);
    let prev = -1;
    for (const cr of order) {
      const xp = XP_BY_CR[cr];
      expect(xp, cr).toBeDefined();
      if (cr !== '0') expect(xp).toBeGreaterThan(prev);
      prev = xp;
    }
  });

  it('agrees with the DMG worked examples', () => {
    // Example 1: low, four level 1 characters = 200 XP; Bugbear Warrior (CR 1) = 200, Giant Wasp (CR 1/2) = 100, Twig Blight (CR 1/8) = 25.
    expect(xpBudget(Array(4).fill({ name: 'A', level: 1 }), 'low').total).toBe(200);
    expect(xpForCr('1')).toBe(200);
    expect(2 * (xpForCr('1/2') as number)).toBe(200);
    expect(6 * (xpForCr('1/8') as number)).toBe(150);
    // Example 2: moderate, five level 3 characters = 1,125 XP; 2 Nothics (CR 2) and 9 Stirges (CR 1/8); Wight (CR 3), Warhorse Skeleton (CR 1/2), 6 Skeletons (CR 1/4).
    expect(xpBudget(Array(5).fill({ name: 'A', level: 3 }), 'moderate').total).toBe(1125);
    expect(2 * (xpForCr('2') as number) + 9 * (xpForCr('1/8') as number)).toBe(1125);
    expect((xpForCr('3') as number) + (xpForCr('1/2') as number) + 6 * (xpForCr('1/4') as number)).toBe(1100);
    // Example 3: high, six level 15 characters = 46,800 XP; 2 Adult Red Dragons (CR 17), 2 Fire Giants (CR 9) = 46,000.
    expect(xpBudget(Array(6).fill({ name: 'A', level: 15 }), 'high').total).toBe(46800);
    expect(2 * (xpForCr('17') as number) + 2 * (xpForCr('9') as number)).toBe(46000);
  });

  it('matches the XP printed on every Monster Manual NPC block and creature', () => {
    for (const t of NPC_TEMPLATE_LIST) {
      const cr = t.stats.cr;
      if (cr === undefined || t.stats.xp === undefined) continue;
      // CR 0 is printed "0 or 10": 10 for a creature that can attack.
      if (cr === '0') expect([0, 10]).toContain(t.stats.xp);
      else expect(t.stats.xp, `${t.name} CR ${cr}`).toBe(XP_BY_CR[cr]);
    }
    for (const c of CREATURE_LIST) {
      const { cr, xp } = c.challenge;
      if (cr === null || xp === null || !(cr in XP_BY_CR) || cr === '0') continue;
      expect(xp, `${c.name} CR ${cr}`).toBe(XP_BY_CR[cr]);
    }
  });

  it('looks up a CR, and returns null for text that is not in the table', () => {
    expect(xpForCr('1/4')).toBe(50);
    expect(xpForCr(' 5 ')).toBe(1800);
    expect(xpForCr('31')).toBeNull();
    expect(xpForCr('')).toBeNull();
    expect(xpForCr(null)).toBeNull();
    expect(xpForCr('toString')).toBeNull();
  });
});

describe('budgets', () => {
  it('adds each character\'s own budget, so mixed levels work', () => {
    const b = xpBudget(
      [
        { name: 'Ann', level: 3 },
        { name: 'Bo', level: 5 },
      ],
      'moderate',
    );
    expect(b.total).toBe(225 + 750);
    expect(b.components).toEqual([
      { label: 'Ann (level 3)', value: 225 },
      { label: 'Bo (level 5)', value: 750 },
    ]);
    expect(b.components.reduce((s, c) => s + c.value, 0)).toBe(b.total);
  });

  it('keeps a level in range and handles an empty party', () => {
    expect(xpBudget([{ name: 'X', level: 0 }], 'low').total).toBe(50);
    expect(xpBudget([{ name: 'X', level: 99 }], 'high').total).toBe(22000);
    expect(xpBudget([], 'low').total).toBe(0);
  });
});

describe('encounter XP and where it sits', () => {
  it('adds the creatures\' XP with no multiplier, and lists the ones without a value', () => {
    const x = encounterXp([mon('A', 100), mon('B', 50), mon('C'), { ...mon('Hero', 999), kind: 'pc' }]);
    expect(x.total.total).toBe(150);
    expect(x.unknown).toEqual(['C']);
    expect(x.total.components).toEqual([
      { label: 'A', value: 100 },
      { label: 'B', value: 50 },
    ]);
  });

  it('names the lowest budget that covers the XP', () => {
    const b = { low: 200, moderate: 300, high: 400 };
    expect(difficultyFit(0, b)).toBe('low');
    expect(difficultyFit(200, b)).toBe('low');
    expect(difficultyFit(201, b)).toBe('moderate');
    expect(difficultyFit(400, b)).toBe('high');
    expect(difficultyFit(401, b)).toBe('over');
    expect(difficultyFit(10, { low: 0, moderate: 0, high: 0 })).toBe('none');
    expect(fitLabel('moderate')).toBe('Fits the Moderate budget');
    expect(fitLabel('over')).toBe('Over the High budget');
  });
});

describe('advice from the DMG troubleshooting list', () => {
  const party = [
    { name: 'A', level: 1 },
    { name: 'B', level: 4 },
  ];
  const cr = (c: DmCombatant) => crToNumber(c.cr);

  it('warns about more than two creatures per character, and about a high CR', () => {
    const many = Array.from({ length: 5 }, (_, i) => mon(`Rat ${i}`, 10, '1/8'));
    const notes = balanceNotes(party, many, cr);
    expect(notes.some((n) => n.includes('More than two creatures per character') && n.includes('level 1 or 2'))).toBe(true);
    expect(balanceNotes(party, [mon('Ogre', 450, '2')], cr).some((n) => n.includes('Powerful Creatures'))).toBe(true);
    expect(balanceNotes(party, [mon('Rat', 10, '1/8')], cr)).toEqual([]);
  });

  it('warns about 0 XP creatures and too many stat blocks', () => {
    expect(balanceNotes(party, [mon('Mouse', 0, '0')], cr).some((n) => n.includes('0 XP'))).toBe(true);
    const blocks = ['a', 'b', 'c', 'd'].map((l) => mon(l, 10, '1/8', l));
    expect(balanceNotes(party, blocks, cr).some((n) => n.includes('4 different stat blocks'))).toBe(true);
  });

  it('says nothing without a party', () => {
    expect(balanceNotes([], [mon('Ogre', 450, '2')], cr)).toEqual([]);
  });
});

describe('awarding XP', () => {
  it('divides evenly among the characters and rounds down', () => {
    const a = xpAward([mon('A', 100), mon('B', 50)], 4);
    expect(a.total.total).toBe(150);
    expect(a.share.total).toBe(37);
    expect(xpAward([mon('A', 100)], 0).share.total).toBe(100);
    expect(xpAward([], 3).share.total).toBe(0);
    expect(xpAward([mon('A')], 3).total.total).toBe(0);
  });
});

describe('XP on new combatants', () => {
  it('copies the printed XP and CR from a Monster Manual block', () => {
    for (const t of NPC_TEMPLATE_LIST) {
      const c = combatantFromTemplate(t, 'x');
      expect(c.cr).toBe(t.stats.cr);
      expect(c.xp).toBe(t.stats.xp);
    }
  });

  it('gives creatures their XP, falling back to the CR table', () => {
    for (const cr of CREATURE_LIST) {
      const c = combatantFromCreature(cr, 'x');
      if (!c) continue;
      const expected = cr.challenge.xp ?? xpForCr(cr.challenge.cr) ?? undefined;
      expect(c.xp).toBe(expected);
    }
  });

  it('takes a custom creature\'s CR and XP', () => {
    const c = customCombatant('x', { name: 'Thing', ac: 10, hpMax: 5, initiativeMod: 0, cr: '1/2', xp: 100 });
    expect(c).toMatchObject({ cr: '1/2', xp: 100 });
    expect(customCombatant('y', { name: 'T', ac: 1, hpMax: 1, initiativeMod: 0 }).xp).toBeUndefined();
  });
});
