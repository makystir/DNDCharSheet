/**
 * Encumbrance & carrying-capacity rules (D&D 5.5e / 2024).
 *
 * The carrying-capacity and coin-weight FORMULAE are fresh, built from the 2024
 * PHB and cited inline. The `formatEncumbrance` formatter and the severity-band
 * SHAPE are ported from PWACharSheet's src/logic/encumbrance.ts; the WFRP-only
 * rules (worn −1, horse/backpack house rules) are dropped. Every public total
 * returns a Breakdown so the UI can show how it was derived (calculated-totals
 * steering); because carrying capacity is a PRODUCT (Str × multiplier), not a
 * sum, it is modelled as a single additive component with the arithmetic in the
 * non-additive `note`, exactly as armor-class.ts carries non-additive facts in
 * `note` (Breakdown invariant: components sum to total).
 */

import type { ArmorData } from '../data/armor';
import { getArmor } from '../data/armor';
import type { EquipmentData } from '../data/equipment';
import { effectiveStack, getEquipment } from '../data/equipment';
import type { WeaponData } from '../data/weapons';
import { getWeapon } from '../data/weapons';
import type { Character, InventoryItem } from '../types/character';
import type { Breakdown } from './breakdown';
import type { CurrencyAmount } from './currency';
import { ZERO_CURRENCY } from './currency';
import { effectiveAbilityScores } from './feats';

/**
 * Catalog getters the carried-weight math needs, injected so the function stays
 * pure and testable (mirrors how armor/weapon lookups are passed as data).
 * Defaults wire the real A1 catalogs.
 */
export interface EncumbranceCatalogs {
  getWeapon: (id: string) => WeaponData | undefined;
  getArmor: (id: string) => ArmorData | undefined;
  getEquipment: (id: string) => EquipmentData | undefined;
}

/** The real A1 catalogs — the default lookup set. */
export const DEFAULT_CATALOGS: EncumbranceCatalogs = {
  getWeapon,
  getArmor,
  getEquipment,
};

// ───────────────────────────── Carrying capacity ───────────────────────────

/**
 * Carry-weight multiplier by creature size.
 * PHB 2024 "Carrying Capacity" table (Docs/PlayersHandbook.md L20786-20800):
 *   Tiny ×7.5, Small/Medium ×15, Large ×30, Huge ×60, Gargantuan ×120.
 */
// PHB 2024 "Carrying Capacity" (L20786-20800): Carry = Str × size multiplier.
export const CARRY_MULTIPLIER = {
  tiny: 7.5,
  small: 15,
  medium: 15,
  large: 30,
  huge: 60,
  gargantuan: 120,
} as const;

export type CarrySize = keyof typeof CARRY_MULTIPLIER;

/**
 * The carry multiplier for a character.
 *
 * The current species model (src/data/species.ts: CreatureSize = 'small' |
 * 'medium') only ever yields a ×15 creature, so Small/Medium is the only
 * reachable value today. The larger/smaller rows and the Goliath "Powerful
 * Build" one-size-larger rule (PHB 2024 L8202) are NOT reachable from the
 * current data — they are FLAGGED, not implemented, to avoid inventing a value
 * the data cannot supply (rules-compliance rule 1). The multiplier is still
 * parameterised so a future species-size/Powerful-Build pass can feed it.
 */
// PHB 2024 "Carrying Capacity" (L20786-20800): Small/Medium use ×15.
export function carrySizeFor(_character: Character): CarrySize {
  // Species data today exposes only small/medium, both ×15. When species size
  // widens (and Powerful Build is modelled), resolve the size here.
  return 'medium';
}

/**
 * Carrying capacity in pounds = Strength score × size multiplier.
 * PHB 2024 "Carrying Capacity" (L20757): "Your size and Strength score
 * determine the maximum weight in pounds that you can carry" — Small/Medium =
 * Str × 15.
 *
 * Breakdown: a product, not a sum, so it is a SINGLE component carrying the
 * total, with the arithmetic in `note` (Breakdown invariant: components sum to
 * total; non-additive facts go in `note`).
 */
// PHB 2024 "Carrying Capacity" (L20757 + L20786-20800): Carry = Str × multiplier.
export function carryingCapacityBreakdown(character: Character): Breakdown {
  const str = effectiveAbilityScores(character).str;
  const size = carrySizeFor(character);
  const multiplier = CARRY_MULTIPLIER[size];
  const total = str * multiplier;
  const sizeLabel = size === 'small' || size === 'medium' ? 'Small/Medium' : capitalize(size);

  return {
    total,
    components: [{ label: `Str ${str} × ${multiplier}`, value: total }],
    note: `Strength ${str} × ${multiplier} (${sizeLabel}) = ${total} lb`,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────── Coin weight ───────────────────────────────

/** The total number of coins across all five denominations. */
export function totalCoins(coins: CurrencyAmount): number {
  return coins.pp + coins.gp + coins.ep + coins.sp + coins.cp;
}

/**
 * Coin weight in pounds = floor(total coins ÷ 50).
 * PHB 2024 "Coins" (Docs/PlayersHandbook.md L9266): "A coin weighs about a
 * third of an ounce, so fifty coins weigh a pound." The PHB gives a per-50
 * whole-pound figure, so partial pounds floor (matching the ported WFRP
 * calculateCoinWeight, which floored at its own per-200 divisor).
 *
 * Breakdown: one component per denomination CARRIED (count of coins, not
 * weight), which sum to the total coin count — the ÷50 conversion to pounds is
 * the non-additive fact, placed in `note` (components are coin counts, the
 * total shown by CoinWeightBreakdownContent is the weight; see §3.3). To keep
 * the Breakdown invariant honest (components must sum to `total`), `total` here
 * is the WEIGHT and the components are scaled — instead we expose the coin
 * counts and weight separately via CoinWeightBreakdown below for the tooltip,
 * and keep this Breakdown's components summing to the coin COUNT with the
 * weight in `note`.
 */
// PHB 2024 "Coins" (L9266): 50 coins = 1 lb; coin weight = floor(total / 50).
export function coinWeightLb(coins: CurrencyAmount): number {
  return Math.floor(totalCoins(coins) / 50);
}

/**
 * Breakdown for coin weight. Because the displayed total is a WEIGHT but the
 * additive components are COIN COUNTS (which sum to the coin total, not the
 * weight), the Breakdown reports the coin COUNT total with per-denomination
 * components (invariant honoured: counts sum to the count total) and puts the
 * ÷50 → pounds conversion in `note`. The weight itself is surfaced via
 * `coinWeightLb` / the CoinWeightBreakdownContent tooltip body.
 */
// PHB 2024 "Coins" (L9266): per-denomination counts; ÷50 conversion in note.
export function coinWeightBreakdown(coins: CurrencyAmount): Breakdown {
  const count = totalCoins(coins);
  const weight = coinWeightLb(coins);
  return {
    total: count,
    components: [
      { label: 'PP', value: coins.pp },
      { label: 'GP', value: coins.gp },
      { label: 'EP', value: coins.ep },
      { label: 'SP', value: coins.sp },
      { label: 'CP', value: coins.cp },
    ],
    note: `${count} coins ÷ 50 (PHB: 50 coins = 1 lb) = ${weight} lb`,
  };
}

// ───────────────────────────── Carried weight ──────────────────────────────

/** Read the coin purse off a character; absent = no coins carried. */
export function characterCoins(character: Character): CurrencyAmount {
  // Stage A3 persists the coin purse on Character.coins (additive-optional, no
  // CURRENT_VERSION bump). Absent = carries no coins (a valid prior state), so
  // fall back to ZERO_CURRENCY.
  return character.coins ?? ZERO_CURRENCY;
}

/**
 * The effective weight (lb) contributed by a single inventory item.
 * - weapons/armor: catalog weightLb × quantity (instance weightLb override wins).
 * - equipment: effectiveStack() so an ammunition BUNDLE is not overcounted (a
 *   20-arrow stack weighs 1 lb, not 20× — A1 ammunition unit contract).
 * - custom item with no catalog entry: instance weightLb × quantity (0 if unset).
 */
function itemWeight(item: InventoryItem, catalogs: EncumbranceCatalogs): number {
  const qty = item.quantity > 0 ? item.quantity : 0;

  if (item.kind === 'weapon') {
    const data = item.catalogId ? catalogs.getWeapon(item.catalogId) : undefined;
    const per = item.weightLb ?? data?.weightLb ?? 0;
    return per * qty;
  }
  if (item.kind === 'armor') {
    const data = item.catalogId ? catalogs.getArmor(item.catalogId) : undefined;
    const per = item.weightLb ?? data?.weightLb ?? 0;
    return per * qty;
  }
  // equipment
  const data = item.catalogId ? catalogs.getEquipment(item.catalogId) : undefined;
  if (data && item.weightLb === undefined) {
    // Use the A1 proportional helper so ammunition bundles are not overcounted.
    return effectiveStack(data, qty).weightLb;
  }
  const per = item.weightLb ?? data?.weightLb ?? 0;
  return per * qty;
}

/**
 * Carried-weight breakdown: Σ(item weight) grouped into Weapons / Armor /
 * Other gear / Coins, summing to the total. PHB 2024 Chapter 6 "Equipment"
 * (item weights) + "Coins" (L9266, coin weight).
 */
// PHB 2024 "Equipment" (item weights) + "Coins" (L9266, coin weight).
export function carriedWeightBreakdown(
  character: Character,
  catalogs: EncumbranceCatalogs = DEFAULT_CATALOGS,
): Breakdown {
  const inventory = character.inventory ?? [];

  let weapons = 0;
  let armor = 0;
  let gear = 0;
  for (const item of inventory) {
    const w = itemWeight(item, catalogs);
    if (item.kind === 'weapon') weapons += w;
    else if (item.kind === 'armor') armor += w;
    else gear += w;
  }

  const coins = coinWeightLb(characterCoins(character));
  const total = weapons + armor + gear + coins;

  return {
    total,
    components: [
      { label: 'Weapons', value: weapons },
      { label: 'Armor', value: armor },
      { label: 'Other gear', value: gear },
      { label: 'Coins', value: coins },
    ],
  };
}

// ───────────────────────────── Severity / bands ────────────────────────────

/**
 * Encumbrance severity level.
 *
 * RAW 2024: there are only two states — within capacity ('neutral') or over it
 * ('over'). The 2024 PHB has NO Encumbered/Heavily-Encumbered band rule (see
 * the HouseRules.variantEncumbrance note). The 'encumbered'/'heavilyEncumbered'
 * values are reachable ONLY when the opt-in variant house rule is enabled.
 */
export type EncumbranceLevel = 'neutral' | 'over' | 'encumbered' | 'heavilyEncumbered';

/**
 * Classify encumbrance severity.
 *
 * DEFAULT (RAW 2024, `variantEnabled` false/absent): binary — 'over' when the
 * carried weight exceeds the carrying capacity, else 'neutral'. PHB 2024
 * "Carrying Capacity" (L20753-20800) defines only the capacity; exceeding it is
 * an over-capacity condition with no graduated bands.
 *
 * VARIANT (`variantEnabled` true — opt-in house rule only): the 2014-era
 * Encumbered (> Str×5) / Heavily Encumbered (> Str×10) bands. These are NOT
 * 2024 RAW (see HouseRules.variantEncumbrance); they are gated entirely behind
 * the flag and require the user to supply the 2014 source. The thresholds are
 * derived from the Strength score so they are not authored as 2024 values.
 */
// PHB 2024 "Carrying Capacity" (L20753-20800): RAW is binary over/under.
export function getEncumbranceLevel(
  current: number,
  capacity: number,
  strengthScore?: number,
  variantEnabled = false,
): EncumbranceLevel {
  // Variant bands (OPT-IN, NOT 2024 RAW — 2014 "Variant: Encumbrance"). Only
  // reachable when the house rule is on AND a Strength score is supplied.
  if (variantEnabled && strengthScore !== undefined) {
    // 2014 variant thresholds (require a cited 2014 source; NOT in the 2024 book).
    const heavilyEncumberedAt = strengthScore * 10;
    const encumberedAt = strengthScore * 5;
    if (current > heavilyEncumberedAt) return 'heavilyEncumbered';
    if (current > encumberedAt) return 'encumbered';
    // Still flag plain over-capacity even under the variant.
    if (capacity > 0 && current > capacity) return 'over';
    return 'neutral';
  }

  // RAW 2024 default: binary over/under.
  if (capacity > 0 && current > capacity) return 'over';
  return 'neutral';
}

/**
 * Format encumbrance for display, e.g. "12 / 210 lb".
 * Ported from PWACharSheet's formatEncumbrance; the " lb" unit suffix is added
 * for D&D (PHB weights are in pounds).
 */
export function formatEncumbrance(current: number, max: number): string {
  return `${current} / ${max} lb`;
}
