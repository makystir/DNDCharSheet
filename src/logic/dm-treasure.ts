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
import type { DmEncounter } from '../types/dm';
import { countsForXp } from './dm-balance';
import { crToNumber } from './dm-library';
import { XP_BY_CR } from '../data/xp-tables';
import {
  ART_OBJECTS,
  COIN_VALUE_GP,
  GEMSTONES,
  HOARD_TREASURE,
  INDIVIDUAL_TREASURE,
  TRADE_BARS,
  type TreasureTheme,
  type CoinKind,
  type DiceSpec,
  type HoardRow,
  type IndividualRow,
  type ValueTable,
} from '../data/treasure-tables';

import { ARCANA_RAW } from '../data/random-magic-items/arcana';
import { ARMAMENTS_RAW } from '../data/random-magic-items/armaments';
import { IMPLEMENTS_RAW } from '../data/random-magic-items/implements';
import { RELICS_RAW } from '../data/random-magic-items/relics';
import { FLAGGED_NOTE, resolveMagicItem, type ResolvedMagicItem } from './magic-item-resolve';

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

// ------------------------------------------------------ random magic items
//
// DMG 2024 "Random Magic Items" (chapter 7, pp.326-331, Docs/DungeonMastersGuide.md
// L12649): the tables are sorted first by treasure theme, then by item rarity. "If
// an item isn't associated with a theme, roll 1d4 to decide which table to roll on
// next: on a 1, roll on the Arcana tables; on a 2, Armaments; on a 3, Implements;
// on a 4, Relics." Each table is a d100. Which rarity to roll is the DM's choice
// ("Awarding Magic Items" guidelines), so it is an input here, not derived from CR.

export type MagicTier = 'common' | 'uncommon' | 'rare' | 'veryRare' | 'legendary';

export const MAGIC_TIERS: readonly { id: MagicTier; label: string }[] = [
  { id: 'common', label: 'Common' },
  { id: 'uncommon', label: 'Uncommon' },
  { id: 'rare', label: 'Rare' },
  { id: 'veryRare', label: 'Very Rare' },
  { id: 'legendary', label: 'Legendary' },
];

/** The 1d4 order of the themes: 1 Arcana, 2 Armaments, 3 Implements, 4 Relics. */
export const MAGIC_THEME_ORDER: readonly TreasureTheme[] = ['arcana', 'armaments', 'implements', 'relics'];

const MAGIC_TABLES: Record<TreasureTheme, Record<MagicTier, string>> = {
  arcana: ARCANA_RAW,
  armaments: ARMAMENTS_RAW,
  implements: IMPLEMENTS_RAW,
  relics: RELICS_RAW,
};

export interface MagicTableRow {
  lo: number;
  hi: number;
  /** The item as printed in the table. */
  name: string;
}

/** Parse "<d100 range> <item>" lines; 00 means 100. */
export function parseMagicTable(raw: string): MagicTableRow[] {
  return raw
    .trim()
    .split('\n')
    .map((line) => {
      const m = /^(\d\d)(?:-(\d\d))? (.+)$/.exec(line.trim());
      if (!m) throw new Error(`Unparseable magic item table line: "${line}"`);
      const num = (s: string) => (s === '00' ? 100 : Number(s));
      return { lo: num(m[1]), hi: m[2] ? num(m[2]) : num(m[1]), name: m[3].trim() };
    });
}

const PARSED: Partial<Record<string, MagicTableRow[]>> = {};

/** The rows of one Random Magic Items table. */
export function magicItemTable(theme: TreasureTheme, tier: MagicTier): MagicTableRow[] {
  const key = `${theme}:${tier}`;
  return (PARSED[key] ??= parseMagicTable(MAGIC_TABLES[theme][tier]));
}

export interface RolledMagicItem {
  theme: TreasureTheme;
  tier: MagicTier;
  /** The 1d4 that chose the theme, or null when the DM chose the theme. */
  themeRoll: number | null;
  /** The d100 rolled on the table (1-100). */
  d100: number;
  /** The table entry with its description, or a flag when no source has one. */
  item: ResolvedMagicItem;
}

/** Roll one magic item: pick the theme (1d4 when none is given), then roll the d100 for the rarity. */
export function rollMagicItem(rng: RNG, tier: MagicTier, theme?: TreasureTheme): RolledMagicItem {
  const themeRoll = theme ? null : rollDie(rng, 4);
  const chosen = theme ?? MAGIC_THEME_ORDER[(themeRoll ?? 1) - 1];
  const d100 = rollDie(rng, 100);
  const row = magicItemTable(chosen, tier).find((r) => d100 >= r.lo && d100 <= r.hi);
  if (!row) throw new Error(`No ${chosen} ${tier} table row for ${d100}`);
  return { theme: chosen, tier, themeRoll, d100, item: resolveMagicItem(row.name) };
}

export const MAX_MAGIC_ITEMS = 20;

export function rollMagicItems(rng: RNG, count: number, tier: MagicTier, theme?: TreasureTheme): RolledMagicItem[] {
  const n = Math.min(MAX_MAGIC_ITEMS, Math.max(0, Math.trunc(count)));
  return Array.from({ length: n }, () => rollMagicItem(rng, tier, theme));
}

/** Short one-line summary of a resolved item: rarity, category and attunement. */
export function magicItemMeta(item: ResolvedMagicItem): string {
  if (item.status === 'flagged') return FLAGGED_NOTE;
  const kind = item.typeDetail ? `${item.category} (${item.typeDetail})` : item.category;
  const attune = item.requiresAttunement
    ? item.attunementCondition
      ? `requires attunement by ${item.attunementCondition}`
      : 'requires attunement'
    : 'no attunement';
  return `${kind}, ${item.rarity}, ${attune}`;
}

/** Journal lines for rolled magic items. */
export function magicItemsText(rolled: RolledMagicItem[]): string[] {
  return rolled.map((r) => `${r.item.name}: ${magicItemMeta(r.item)}`);
}

// ------------------------------------------------------------- journal text

export function moneyText(formed: FormedMoney): string[] {
  const lines = formed.lines.map((l) => l.text);
  if (formed.leftoverGp > 0 || lines.length === 0) lines.push(`${formed.leftoverGp.toLocaleString()} GP in coins`);
  return lines;
}

// ------------------------------------------------------- from an encounter
export interface EncounterCrGroup {
  /** The CR as printed on the combatant, e.g. "1/4". */
  cr: string;
  /** How many counted monsters have this CR. */
  count: number;
}

export interface EncounterTreasureSource {
  groups: EncounterCrGroup[];
  /** Counted monsters with no usable CR (for example a custom monster without one), left out of the groups. */
  skipped: number;
}

/**
 * The CRs of the monsters in an ended encounter that count as overcome (the same
 * test the XP award uses, `countsForXp`), grouped by CR from lowest to highest.
 * This only gathers inputs for the DMG 2024 tables above. Which table to roll
 * (individual, or a hoard for the leader's CR) stays the DM's choice.
 */
export function encounterTreasureSource(enc: DmEncounter): EncounterTreasureSource {
  const counts = new Map<string, number>();
  let skipped = 0;
  for (const c of enc.combatants) {
    if (c.kind !== 'monster' || !countsForXp(c)) continue;
    const cr = c.cr?.trim();
    if (!cr || !(cr in XP_BY_CR)) {
      skipped++;
      continue;
    }
    counts.set(cr, (counts.get(cr) ?? 0) + 1);
  }
  const groups = [...counts.entries()]
    .sort((a, b) => (crToNumber(a[0]) ?? 0) - (crToNumber(b[0]) ?? 0))
    .map(([cr, count]) => ({ cr, count }));
  return { groups, skipped };
}
