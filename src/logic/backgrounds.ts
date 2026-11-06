/**
 * Background application (D&D 5.5e / 2024), Stage A7 PART 1 — PURE logic.
 *
 * Applies a 2024 background to a character through the audited A6b
 * effective-score layer: the background's Origin feat plus the chosen ability
 * allocation are recorded as a single FeatSelection on advancement.feats[] (so
 * effectiveAbilityScores sums the increases and the BASE `abilities` is never
 * mutated). The two skill proficiencies are merged (expertise preserved), the
 * tool proficiency + choices are recorded on the additive-optional
 * `backgroundSelection` field, and the equipment choice is resolved into
 * inventory + coins. Nothing mutates its input.
 *
 * PHB 2024 "Parts of a Background" (Docs/PlayersHandbook.md L7806-7820) and
 * "Adjust Ability Scores" (L1718-1720): increase one of the three listed
 * abilities by 2 and another by 1, OR increase all three by 1; none above 20.
 */

import type { Ability, Character, FeatSelection } from '../types/character';
import { getBackground, type BackgroundId } from '../data/backgrounds';
import { applyFeat, effectiveAbilityScores } from './feats';
import { resolveEquipment, resolveEquipmentRandom, type ResolvedItem } from './equipment-resolver';
import { applyCurrencyDelta, ZERO_CURRENCY, type CurrencyAmount } from './currency';
import type { RNG } from './random';

/** A single ability increase the player allocated from the background. */
export interface BackgroundAbilityAllocation {
  ability: Ability;
  amount: number;
}

/**
 * Whether an ability allocation is a legal background allocation (PHB 2024
 * "Parts of a Background" L7810 / "Adjust Ability Scores" L1718): the increases
 * fall ONLY on the background's three listed abilities, the shape is exactly
 * +2/+1 on two distinct abilities OR +1/+1/+1 on all three, and no resulting
 * score exceeds 20. `before` (optional) supplies the EFFECTIVE pre-allocation
 * scores for the max-20 check; when omitted the shape is validated but the cap
 * check is skipped (the catalog/golden shape cases don't pin starting scores).
 */
export function isBackgroundAbilityAllocationValid(
  abilities: readonly Ability[],
  allocation: readonly BackgroundAbilityAllocation[],
  before?: Partial<Record<Ability, number>>,
): boolean {
  const allowed = new Set(abilities);

  // Every allocated ability must be one of the background's three, with a
  // positive integer amount, and no ability may be allocated twice.
  const seen = new Set<Ability>();
  for (const { ability, amount } of allocation) {
    if (!allowed.has(ability)) return false;
    if (!Number.isInteger(amount) || amount < 1) return false;
    if (seen.has(ability)) return false;
    seen.add(ability);
  }

  // Shape: +2 then +1 on two distinct abilities, OR +1 on each of all three.
  const amounts = allocation.map((a) => a.amount).sort((x, y) => y - x);
  const isTwoOne = amounts.length === 2 && amounts[0] === 2 && amounts[1] === 1;
  const isOneOneOne = amounts.length === 3 && amounts.every((v) => v === 1);
  if (!isTwoOne && !isOneOneOne) return false;

  // PHB 2024 L1720: none of these increases can raise a score above 20.
  if (before) {
    for (const { ability, amount } of allocation) {
      const start = before[ability];
      if (start !== undefined && start + amount > 20) return false;
    }
  }

  return true;
}

/** Choices made when applying a background. */
export interface BackgroundChoices {
  /** The +2/+1 or +1/+1/+1 ability allocation across the background's three abilities. */
  abilityAllocation: BackgroundAbilityAllocation[];
  /**
   * The resolved tool proficiency id. For a specific-tool background this is the
   * catalog id; for a category background (Gaming Set / Artisan's Tools /
   * Musical Instrument) it is the player's chosen tool. Optional (may be chosen
   * later in the UI).
   */
  toolProficiency?: string;
  /** Equipment option: 'A' = the package (+ its GP), 'B' = 50 GP. PHB 2024 L7820. */
  equipmentChoice: 'A' | 'B';
  /**
   * When provided, choice-bearing package entries (e.g. "Gaming Set (any)") are
   * resolved to concrete items via this RNG (resolveEquipmentRandom); otherwise
   * the default resolver is used and unresolved choices are dropped from the
   * granted inventory (the UI resolves them separately).
   */
  rng?: RNG;
}

/** Option B's flat gold. PHB 2024 "Parts of a Background" (L7820). */
const OPTION_B_GOLD = 50;

/**
 * Apply a background to a character, returning a NEW Character (never mutates).
 *
 * (a) Records the Origin feat + the chosen ability allocation as ONE
 *     FeatSelection at `level: 0` (a sentinel that is never an asi-marker slot,
 *     so featSlotAssignments never binds it) via applyFeat — reusing the A6b
 *     effective-score path, so base `abilities` stays untouched.
 * (b) Sets the two skill proficiencies to proficient, merging so existing
 *     expertise is preserved.
 * (c) Records the tool proficiency + equipment choice on `backgroundSelection`.
 * (d) Resolves the equipment choice into inventory + coins (option A = package
 *     items + package GP; option B = 50 GP).
 *
 * An unknown background id returns the character unchanged.
 */
export function applyBackground(
  character: Character,
  backgroundId: BackgroundId,
  choices: BackgroundChoices,
  timestamp: number,
): Character {
  const bg = getBackground(backgroundId);
  if (!bg) return character;

  // (a) Origin feat + ability allocation as a single A6b feat selection.
  const abilityIncreases: Partial<Record<Ability, number>> = {};
  for (const { ability, amount } of choices.abilityAllocation) {
    abilityIncreases[ability] = (abilityIncreases[ability] ?? 0) + amount;
  }
  const selection: FeatSelection = {
    featId: bg.originFeatId,
    level: 0, // sentinel: background feat occupies no asi-marker slot.
    abilityIncreases,
    choices: {
      skills: [...bg.skills],
      tools: choices.toolProficiency ? [choices.toolProficiency] : undefined,
      notes: `Background: ${bg.name}`,
    },
  };
  let next = applyFeat(character, selection, timestamp);

  // (b) Skill proficiencies — merge, preserving any existing expertise.
  const skills = { ...(next.skills ?? {}) };
  for (const skillId of bg.skills) {
    skills[skillId] = { ...skills[skillId], proficient: true };
  }
  next = { ...next, skills };

  // (c) Structured background selection record (tool + choices + equipment),
  // plus the free-text `background` label the Personal Details card shows. The
  // structured `backgroundSelection` carries the mechanics; `background` is the
  // human-readable name (editable notes). Only fill it when empty so a manual
  // edit is never overwritten (on a fresh creation character it is always
  // empty, so the chosen background's name shows up as the user expects).
  const hasBackgroundNote = (next.background ?? '').trim().length > 0;
  next = {
    ...next,
    ...(hasBackgroundNote ? {} : { background: bg.name }),
    backgroundSelection: {
      id: backgroundId,
      abilities: choices.abilityAllocation.map((a) => ({ ...a })),
      toolProficiency: choices.toolProficiency,
      equipmentChoice: choices.equipmentChoice,
    },
  };

  // (d) Equipment resolution into inventory + coins.
  const currentCoins: CurrencyAmount = next.coins ?? { ...ZERO_CURRENCY };
  if (choices.equipmentChoice === 'B') {
    next = {
      ...next,
      coins: applyCurrencyDelta(currentCoins, { ...ZERO_CURRENCY, gp: OPTION_B_GOLD }),
    };
  } else {
    const resolve = (entry: string): ResolvedItem[] =>
      choices.rng ? resolveEquipmentRandom(entry, choices.rng) : resolveEquipment(entry);
    const resolved = bg.equipment.packageItems.flatMap(resolve);
    const granted = resolved
      .filter((r) => r.kind !== 'choice')
      .map((r) => (r as Exclude<ResolvedItem, { kind: 'choice' }>).item);
    next = {
      ...next,
      inventory: [...(next.inventory ?? []), ...granted],
      coins: applyCurrencyDelta(currentCoins, { ...ZERO_CURRENCY, gp: bg.equipment.packageGold }),
    };
  }

  return next;
}

/**
 * The EFFECTIVE pre-allocation scores helper, for callers (e.g. the wizard) that
 * want to validate an allocation against the max-20 cap before applying it.
 * Re-exported here so the background layer owns the convenience.
 */
export function effectiveScoresBeforeBackground(
  character: Character,
): Partial<Record<Ability, number>> {
  return effectiveAbilityScores(character);
}
