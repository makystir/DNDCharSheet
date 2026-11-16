import { describe, it, expect } from 'vitest';
import {
  ART_OBJECTS,
  COIN_VALUE_GP,
  GEMSTONES,
  HOARD_TREASURE,
  INDIVIDUAL_TREASURE,
  TRADE_BARS,
  TRADE_GOODS,
  TREASURE_THEMES,
  type DiceSpec,
} from '../../data/treasure-tables';
import { createSeededRng, type RNG } from '../random';
import {
  MAX_ITEMS_PER_FORM,
  averageSpec,
  formMoney,
  hoardRow,
  individualRow,
  moneyText,
  rollHoard,
  rollIndividual,
  rollItems,
  rollSpec,
  specText,
} from '../dm-treasure';

/** An RNG that gives the same die face every time: face f on a d(sides) comes from (f - 0.5) / sides. */
const always = (face: number, sides: number): RNG => () => (face - 0.5) / sides;

describe('the tables agree with the averages the book prints', () => {
  const mean = (d: DiceSpec) => Math.floor(((d.count * (d.sides + 1)) / 2 + d.plus) * d.times);

  it('individual treasure', () => {
    for (const r of INDIVIDUAL_TREASURE) expect(mean(r.dice), r.label).toBe(r.printedAverage);
  });

  it('hoard money', () => {
    for (const r of HOARD_TREASURE) expect(mean(r.dice), r.label).toBe(r.printedAverage);
  });

  it('cover every Challenge Rating from 0 to 30 once, in order', () => {
    for (const rows of [INDIVIDUAL_TREASURE, HOARD_TREASURE]) {
      expect(rows[0].min).toBe(0);
      expect(rows[rows.length - 1].max).toBe(30);
      rows.forEach((r, i) => {
        if (i > 0) expect(r.min).toBe(rows[i - 1].max + 1);
      });
    }
  });

  it('hoards are richer with a higher CR, and magic items never go down', () => {
    for (let i = 1; i < HOARD_TREASURE.length; i++) {
      expect(HOARD_TREASURE[i].printedAverage).toBeGreaterThan(HOARD_TREASURE[i - 1].printedAverage);
      expect(mean(HOARD_TREASURE[i].magicItems)).toBeGreaterThanOrEqual(mean(HOARD_TREASURE[i - 1].magicItems));
    }
  });

  it('gem and art tables have one entry per die face, with the book\'s tiers', () => {
    expect(GEMSTONES.map((t) => [t.value, t.items.length])).toEqual([
      [10, 12],
      [50, 12],
      [100, 10],
      [500, 6],
      [1000, 8],
      [5000, 4],
    ]);
    expect(ART_OBJECTS.map((t) => [t.value, t.items.length])).toEqual([
      [25, 10],
      [250, 10],
      [750, 10],
      [2500, 10],
      [7500, 10],
    ]);
    for (const t of [...GEMSTONES, ...ART_OBJECTS]) {
      expect(new Set(t.items).size).toBe(t.items.length);
      for (const name of t.items) expect(name).not.toMatch(/ {2}|[|£]|^\s|\s$/);
    }
  });

  it('keeps trade bars consistent with the trade goods prices', () => {
    // Silver is 5 GP a pound and gold 50 GP a pound in Trade Goods.
    expect(TRADE_GOODS.some((g) => g.cost === '5 GP' && g.goods.includes('silver'))).toBe(true);
    expect(TRADE_GOODS.some((g) => g.cost === '50 GP' && g.goods.includes('gold'))).toBe(true);
    expect(TRADE_BARS).toEqual([
      { name: '2-pound silver bar', valueGp: 10 },
      { name: '5-pound silver bar', valueGp: 25 },
      { name: '5-pound gold bar', valueGp: 250 },
    ]);
    expect(COIN_VALUE_GP).toEqual({ GP: 1, PP: 10 });
    expect(TREASURE_THEMES.map((t) => t.id)).toEqual(['arcana', 'armaments', 'implements', 'relics']);
  });
});

describe('rolling dice specs', () => {
  it('adds the bonus, then multiplies, and explains each step so the parts add up', () => {
    const r = rollSpec(always(5, 6), { count: 3, sides: 6, plus: 0, times: 1 });
    expect(r).toMatchObject({ faces: [5, 5, 5], total: 15 });
    const x = rollSpec(always(4, 8), { count: 2, sides: 8, plus: 0, times: 10 });
    expect(x.total).toBe(80);
    expect(x.breakdown.components.reduce((s, c) => s + c.value, 0)).toBe(80);
    const m = rollSpec(always(2, 4), { count: 1, sides: 4, plus: -1, times: 1 });
    expect(m.total).toBe(1);
    expect(rollSpec(always(1, 4), { count: 1, sides: 4, plus: -1, times: 1 }).total).toBe(0);
  });

  it('multiplies by the number of creatures after the dice', () => {
    const r = rollSpec(always(4, 8), { count: 2, sides: 8, plus: 0, times: 10 }, 3);
    expect(r.total).toBe(240);
    expect(r.breakdown.components.reduce((s, c) => s + c.value, 0)).toBe(240);
    expect(r.breakdown.components.map((c) => c.label).join(' ')).toContain('3 creatures');
  });

  it('keeps every roll inside the possible range', () => {
    const rng = createSeededRng(11);
    for (let i = 0; i < 300; i++) {
      const r = rollSpec(rng, { count: 2, sides: 10, plus: 0, times: 10 });
      expect(r.total).toBeGreaterThanOrEqual(20);
      expect(r.total).toBeLessThanOrEqual(200);
      expect(r.total % 10).toBe(0);
    }
  });

  it('uses the printed average, rounded down', () => {
    expect(averageSpec({ count: 3, sides: 6, plus: 0, times: 1 }).total).toBe(10);
    expect(averageSpec({ count: 8, sides: 10, plus: 0, times: 100 }).total).toBe(4400);
    expect(averageSpec({ count: 1, sides: 4, plus: -1, times: 1 }).total).toBe(1);
    expect(averageSpec({ count: 1, sides: 6, plus: 0, times: 1 }).total).toBe(3);
  });

  it('writes the dice the way the book does', () => {
    expect(specText({ count: 3, sides: 6, plus: 0, times: 1 })).toBe('3d6');
    expect(specText({ count: 2, sides: 8, plus: 0, times: 10 })).toBe('2d8 × 10');
    expect(specText({ count: 1, sides: 4, plus: -1, times: 1 })).toBe('1d4 - 1');
  });
});

describe('individual treasure', () => {
  it('picks the row for the CR, including the fractions', () => {
    expect(individualRow(0.125).label).toBe('CR 0-4');
    expect(individualRow(4).label).toBe('CR 0-4');
    expect(individualRow(5).label).toBe('CR 5-10');
    expect(individualRow(16).label).toBe('CR 11-16');
    expect(individualRow(17).label).toBe('CR 17+');
    expect(individualRow(30).label).toBe('CR 17+');
  });

  it('values platinum at 10 GP, and a group is one roll times the number of creatures', () => {
    const one = rollIndividual(always(5, 10), 12, 1);
    expect(one).toMatchObject({ coin: 'PP', coins: 100, valueGp: 1000 });
    const group = rollIndividual(always(5, 10), 12, 4);
    expect(group).toMatchObject({ coins: 400, valueGp: 4000, creatures: 4 });
  });

  it('can use the average', () => {
    expect(rollIndividual(createSeededRng(1), 7, 1, true).coins).toBe(90);
    expect(rollIndividual(createSeededRng(1), 1, 1, true).coins).toBe(10);
    expect(rollIndividual(createSeededRng(1), 20, 2, true)).toMatchObject({ coins: 1800, valueGp: 18000 });
  });
});

describe('treasure hoards', () => {
  it('picks the row for the CR', () => {
    expect(hoardRow(3).label).toBe('CR 0-4');
    expect(hoardRow(9).label).toBe('CR 5-10');
    expect(hoardRow(13).label).toBe('CR 11-16');
    expect(hoardRow(25).label).toBe('CR 17+');
  });

  it('rolls money and a number of magic items', () => {
    const h = rollHoard(createSeededRng(3), 9);
    expect(h.totalGp).toBeGreaterThanOrEqual(800);
    expect(h.totalGp).toBeLessThanOrEqual(8000);
    expect(h.magicItems).toBeGreaterThanOrEqual(1);
    expect(h.magicItems).toBeLessThanOrEqual(3);
    expect(h.repeats).toBe(1);
  });

  it('rolls the whole row twice for a creature fond of treasure', () => {
    const rng = always(5, 10);
    const once = rollHoard(rng, 9);
    const twice = rollHoard(rng, 9, { repeats: 2 });
    expect(twice.repeats).toBe(2);
    expect(twice.money).toHaveLength(2);
    expect(twice.totalGp).toBe(once.totalGp * 2);
    expect(twice.magicItems).toBe(once.magicItems * 2);
  });

  it('can use the average, which matches the printed figures', () => {
    for (const r of HOARD_TREASURE) {
      expect(rollHoard(createSeededRng(1), r.min, { useAverage: true }).totalGp).toBe(r.printedAverage);
    }
  });

  it('never gives a negative number of magic items', () => {
    const rng = createSeededRng(5);
    for (let i = 0; i < 200; i++) expect(rollHoard(rng, 2).magicItems).toBeGreaterThanOrEqual(0);
  });
});

describe('taking the money in another form', () => {
  it('leaves coins alone', () => {
    expect(formMoney(createSeededRng(1), 4400, { kind: 'coins' })).toEqual({ lines: [], leftoverGp: 4400 });
    expect(moneyText({ lines: [], leftoverGp: 4400 })).toEqual(['4,400 GP in coins']);
  });

  it('fills with gems of one value and keeps the change in coins', () => {
    const f = formMoney(createSeededRng(2), 1050, { kind: 'gems', value: 100 });
    const worth = f.lines.reduce((s, l) => s + l.valueGp, 0);
    expect(worth).toBe(1000);
    expect(f.leftoverGp).toBe(50);
    expect(f.lines.reduce((s, l) => s + Number(l.text.split(' × ')[0]), 0)).toBe(10);
    const names = GEMSTONES.find((t) => t.value === 100)!.items;
    for (const l of f.lines) expect(names.some((nme) => l.text.includes(nme))).toBe(true);
  });

  it('does the same for art objects, and for a value too small for one item', () => {
    const f = formMoney(createSeededRng(2), 800, { kind: 'art', value: 250 });
    expect(f.lines.reduce((s, l) => s + l.valueGp, 0)).toBe(750);
    expect(f.leftoverGp).toBe(50);
    expect(formMoney(createSeededRng(2), 100, { kind: 'art', value: 7500 })).toEqual({ lines: [], leftoverGp: 100 });
  });

  it('uses the biggest trade bars first', () => {
    const f = formMoney(createSeededRng(1), 600, { kind: 'bars' });
    expect(f.lines.map((l) => l.text)).toEqual(['2 × 5-pound gold bar, 250 GP each', '4 × 5-pound silver bar, 25 GP each']);
    expect(f.lines.reduce((s, l) => s + l.valueGp, 0) + f.leftoverGp).toBe(600);
    expect(f.leftoverGp).toBe(0);
    expect(formMoney(createSeededRng(1), 37, { kind: 'bars' }).lines.map((l) => l.text)).toEqual(['1 × 5-pound silver bar, 25 GP each', '1 × 2-pound silver bar, 10 GP each']);
  });

  it('never loses or invents value, whatever the form', () => {
    const rng = createSeededRng(7);
    for (const total of [0, 9, 10, 99, 4400, 36000]) {
      for (const form of [
        { kind: 'coins' as const },
        { kind: 'bars' as const },
        { kind: 'gems' as const, value: 50 },
        { kind: 'art' as const, value: 750 },
      ]) {
        const f = formMoney(rng, total, form);
        expect(f.lines.reduce((s, l) => s + l.valueGp, 0) + f.leftoverGp, `${total} ${form.kind}`).toBe(total);
      }
    }
  });

  it('caps a very long list and leaves the rest as coins', () => {
    const f = formMoney(createSeededRng(1), 1_000_000, { kind: 'gems', value: 10 });
    expect(f.lines.reduce((s, l) => s + Number(l.text.split(' × ')[0]), 0)).toBe(MAX_ITEMS_PER_FORM);
    expect(f.leftoverGp).toBe(1_000_000 - MAX_ITEMS_PER_FORM * 10);
  });

  it('rolls a number of gems or art objects by name', () => {
    const f = rollItems(createSeededRng(4), 'gems', 500, 5);
    expect(f.lines.reduce((s, l) => s + Number(l.text.split(' × ')[0]), 0)).toBe(5);
    expect(f.leftoverGp).toBe(0);
    expect(rollItems(createSeededRng(4), 'art', 12345, 3)).toEqual({ lines: [], leftoverGp: 0 });
    expect(rollItems(createSeededRng(4), 'gems', 10, 0).lines).toEqual([]);
  });
});
