/**
 * Treasure rolls for the Dungeon Master, from the Dungeon Master's Guide 2024
 * (see data/treasure-tables.ts for the tables and the readings to confirm).
 *
 * RULES (DMG 2024, Docs/DungeonMastersGuide.md):
 *  - Individual treasure (L4873-4889): roll by the monster's CR, or use the
 *    printed average. For a group of similar creatures, roll once and multiply
 *    by the number of creatures.
 *  - Treasure hoards (L4891-4908): use the row for the monster's CR, or for a
 *    group, the CR of its leader. A creature fond of treasure (a dragon): roll
 *    twice, or roll once and double the total.
 *  - Quest rewards (L4910): roll once on the hoard table, using the characters'
 *    level as the CR.
 *  - Monetary treasure can take the form of coins, trade bars, trade goods,
 *    gems or art objects (L4914-4916).
 *
 * Splitting a hoard's value into gems, art objects or bars is the DM's choice,
 * not a book rule. `formMoney` fills one form as far as it can, largest first,
 * and leaves the rest as coins.
 *
 * Dividing rounds down (PHB 2024 "Round Down", Docs/PlayersHandbook.md L255).
 */
import type { Breakdown } from './breakdown';
import { rollDie } from './dice';
import type { RNG } from './random';
import {
  ART_OBJECTS,
  COIN_VALUE_GP,
  GEMSTONES,
  HOARD_TREASURE,
  INDIVIDUAL_TREASURE,
  TRADE_BARS,
  type CoinKind,
  type DiceSpec,
  type HoardRow,
  type IndividualRow,
  type ValueTable,
} from '../data/treasure-tables';

export const MAX_ITEMS_PER_FORM = 500;

export function specText(spec: DiceSpec): string {
  const plus = spec.plus === 0 ? '' : spec.plus > 0 ? ` + ${spec.plus}` : ` - ${-spec.plus}`;
  const dice = `${spec.count}d${spec.sides}${plus}`;
  return spec.times === 1 ? dice : spec.plus === 0 ? `${dice} × ${spec.times.toLocaleString()}` : `(${dice}) × ${spec.times.toLocaleString()}`;
}

export interface SpecResult {
  /** The faces rolled (empty when the average was used). */
  faces: number[];
  total: number;
  breakdown: Breakdown;
}

function build(label: string, base: number, spec: DiceSpec, detail: string, extra: { label: string; factor: number }[] = []): SpecResult {
  const components = [{ label: detail, value: base }];
  if (spec.times !== 1) components.push({ label: `× ${spec.times.toLocaleString()}`, value: base * (spec.times - 1) });
  let total = base * spec.times;
  for (const e of extra) {
    components.push({ label: `× ${e.factor} creatures`, value: total * (e.factor - 1) });
    total *= e.factor;
  }
  return { faces: [], total, breakdown: { total, components, note: label } };
}

/** Roll a dice spec: (the dice + the bonus) times the multiplier, times any number of creatures. */
export function rollSpec(rng: RNG, spec: DiceSpec, factor = 1): SpecResult {
  const faces = Array.from({ length: spec.count }, () => rollDie(rng, spec.sides));
  const sum = faces.reduce((s, f) => s + f, 0);
  const base = Math.max(0, sum + spec.plus);
  const detail = `${specText({ ...spec, times: 1 })} rolled (${faces.join(' + ')}${spec.plus ? `, ${spec.plus > 0 ? '+' : '-'} ${Math.abs(spec.plus)}` : ''})`;
  const r = build(specText(spec), base, spec, detail, factor > 1 ? [{ label: '', factor }] : []);
  return { ...r, faces };
}

/** The average of a dice spec, rounded down, as the book prints it. */
export function averageSpec(spec: DiceSpec, factor = 1): SpecResult {
  const base = Math.max(0, Math.floor((spec.count * (spec.sides + 1)) / 2 + spec.plus));
  return build(specText(spec), base, spec, `Average of ${specText({ ...spec, times: 1 })} (rounded down)`, factor > 1 ? [{ label: '', factor }] : []);
}

export function individualRow(cr: number): IndividualRow {
  const c = Math.max(0, cr);
  return INDIVIDUAL_TREASURE.find((r) => c >= r.min && c <= r.max) ?? INDIVIDUAL_TREASURE[INDIVIDUAL_TREASURE.length - 1];
}

export function hoardRow(cr: number): HoardRow {
  const c = Math.max(0, cr);
  return HOARD_TREASURE.find((r) => c >= r.min && c <= r.max) ?? HOARD_TREASURE[HOARD_TREASURE.length - 1];
}

export interface IndividualResult {
  row: IndividualRow;
  creatures: number;
  coin: CoinKind;
  /** Coins of that kind. */
  coins: number;
  valueGp: number;
  roll: SpecResult;
}

/** Individual treasure for one creature, or for a group (one roll times the number of creatures). */
export function rollIndividual(rng: RNG, cr: number, creatures = 1, useAverage = false): IndividualResult {
  const row = individualRow(cr);
  const n = Math.min(1000, Math.max(1, Math.trunc(creatures)));
  const roll = useAverage ? averageSpec(row.dice, n) : rollSpec(rng, row.dice, n);
  return { row, creatures: n, coin: row.coin, coins: roll.total, valueGp: roll.total * COIN_VALUE_GP[row.coin], roll };
}

export interface HoardResult {
  row: HoardRow;
  /** 1, or 2 for a creature fond of treasure. */
  repeats: number;
  money: SpecResult[];
  items: SpecResult[];
  totalGp: number;
  magicItems: number;
}

/** A treasure hoard. `repeats: 2` rolls the whole row twice, for a creature fond of treasure. */
export function rollHoard(rng: RNG, cr: number, options: { repeats?: 1 | 2; useAverage?: boolean } = {}): HoardResult {
  const row = hoardRow(cr);
  const repeats = options.repeats ?? 1;
  const money: SpecResult[] = [];
  const items: SpecResult[] = [];
  for (let i = 0; i < repeats; i++) {
    money.push(options.useAverage ? averageSpec(row.dice) : rollSpec(rng, row.dice));
    items.push(options.useAverage ? averageSpec(row.magicItems) : rollSpec(rng, row.magicItems));
  }
  return {
    row,
    repeats,
    money,
    items,
    totalGp: money.reduce((s, m) => s + m.total, 0),
    magicItems: items.reduce((s, m) => s + m.total, 0),
  };
}

// ------------------------------------------------------------ forms of money

export type MoneyForm = { kind: 'coins' } | { kind: 'gems'; value: number } | { kind: 'art'; value: number } | { kind: 'bars' };

export interface FormLine {
  text: string;
  valueGp: number;
}

export interface FormedMoney {
  lines: FormLine[];
  /** What is left over, in GP coins. */
  leftoverGp: number;
}

function group(names: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return counts;
}

function fromTable(rng: RNG, totalGp: number, table: ValueTable): FormedMoney {
  const count = Math.min(MAX_ITEMS_PER_FORM, Math.floor(totalGp / table.value));
  const names = Array.from({ length: count }, () => table.items[rollDie(rng, table.items.length) - 1]);
  const lines = [...group(names).entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, n]) => ({ text: `${n} × ${name}, ${table.value.toLocaleString()} GP each`, valueGp: n * table.value }));
  return { lines, leftoverGp: totalGp - count * table.value };
}

/** Show a GP value as coins, gems, art objects or trade bars (the DM's choice of form). */
export function formMoney(rng: RNG, totalGp: number, form: MoneyForm): FormedMoney {
  const total = Math.max(0, Math.floor(totalGp));
  if (form.kind === 'coins') return { lines: [], leftoverGp: total };
  if (form.kind === 'gems') {
    const table = GEMSTONES.find((t) => t.value === form.value) ?? GEMSTONES[0];
    return fromTable(rng, total, table);
  }
  if (form.kind === 'art') {
    const table = ART_OBJECTS.find((t) => t.value === form.value) ?? ART_OBJECTS[0];
    return fromTable(rng, total, table);
  }
  let left = total;
  const lines: FormLine[] = [];
  for (const bar of [...TRADE_BARS].sort((a, b) => b.valueGp - a.valueGp)) {
    const n = Math.min(MAX_ITEMS_PER_FORM, Math.floor(left / bar.valueGp));
    if (n > 0) {
      lines.push({ text: `${n} × ${bar.name}, ${bar.valueGp} GP each`, valueGp: n * bar.valueGp });
      left -= n * bar.valueGp;
    }
  }
  return { lines, leftoverGp: left };
}

/** Roll `count` items from a gem or art table, grouped by name. */
export function rollItems(rng: RNG, kind: 'gems' | 'art', value: number, count: number): FormedMoney {
  const table = (kind === 'gems' ? GEMSTONES : ART_OBJECTS).find((t) => t.value === value);
  if (!table) return { lines: [], leftoverGp: 0 };
  const n = Math.min(MAX_ITEMS_PER_FORM, Math.max(0, Math.trunc(count)));
  return fromTable(rng, n * table.value, table);
}

// ------------------------------------------------------------- journal text

export function moneyText(formed: FormedMoney): string[] {
  const lines = formed.lines.map((l) => l.text);
  if (formed.leftoverGp > 0 || lines.length === 0) lines.push(`${formed.leftoverGp.toLocaleString()} GP in coins`);
  return lines;
}
