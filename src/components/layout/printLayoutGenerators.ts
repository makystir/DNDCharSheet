/**
 * Print-sheet section-data builders (Stage B9).
 *
 * Bucket-1 port of PWACharSheet's print-layout data generators, re-themed and
 * re-bound to the D&D model. Every number on the printed sheet is produced here
 * by reading an EXISTING src/logic derived function's TOTAL — this module
 * RECOMPUTES NOTHING. It is a pure presentation adapter: it shapes the derived
 * totals into plain data the read-only PrintLayout renders, and it carries no
 * React, no storage, and no rules math of its own (so no PHB citation applies).
 *
 * The print sheet shows the totals as plain numbers (not the Breakdown
 * tooltips) as the stage brief directs — the calculated-total-tooltip steering
 * is explicitly exempted for the PRINT sheet only — but the totals it displays
 * still come from the same logic functions the on-screen sheet uses, so the
 * printout can never drift from the live sheet.
 */

import type { Ability, Character, SkillId } from '../../types/character';
import { ABILITIES, ABILITY_NAMES, ABILITY_ABBR, SKILLS } from '../../types/character';
import {
  abilityModifier,
  proficiencyBonus,
} from '../../logic/abilities';
import { effectiveAbilityScores, characterFeats } from '../../logic/feats';
import { characterArmorClassBreakdown } from '../../logic/armor-class';
import { getArmor } from '../../data/armor';
import { getWeapon } from '../../data/weapons';
import { getEquipment } from '../../data/equipment';
import { getFeat } from '../../data/feats';
import { getBackground } from '../../data/backgrounds';
import { getSpell } from '../../data/spells';
import { characterHitPointMaxBreakdown, effectiveHp } from '../../logic/hit-points-state';
import { initiativeBreakdown } from '../../logic/initiative';
import { passivePerceptionBreakdown } from '../../logic/passive-checks';
import { speedBreakdown, resolveSpecies, speciesTraits } from '../../logic/species';
import { allSavingThrowBreakdowns, savingThrowProficiency } from '../../logic/saving-throws';
import { allSkillBreakdowns, getSkillTraining } from '../../logic/skills';
import {
  isSpellcaster,
  anySpellcaster,
  spellSaveDcBreakdown,
  spellAttackBreakdown,
  spellcastingAbility,
  spellSlots,
  pactMagicSlots,
  cantripsKnown,
  preparedCount,
  effectiveSpellSlots,
  pactMagicSlotsForClass,
  perClassSpellcasting,
} from '../../logic/spellcasting';
import {
  primaryClass,
  allClasses,
  resolveClass,
  resolveClasses,
} from '../../logic/classes';
import { knownLanguages } from '../../logic/languages';
import { activeConditionIds, exhaustionLevelOf } from '../../logic/conditions';
import { equippedWeapons, weaponAttackProfile, unarmedStrike } from '../../logic/attacks';
import {
  carryingCapacityBreakdown,
  carriedWeightBreakdown,
  characterCoins,
} from '../../logic/encumbrance';
import type { InventoryItem } from '../../types/character';
import type { CurrencyAmount } from '../../logic/currency';

/** Format a signed modifier, e.g. 3 → "+3", -1 → "-1". */
export function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** Display name for an inventory item (instance override, else catalog, else kind fallback). */
export function inventoryItemName(item: InventoryItem): string {
  if (item.name) return item.name;
  if (item.kind === 'weapon' && item.catalogId) return getWeapon(item.catalogId)?.name ?? 'Weapon';
  if (item.kind === 'armor' && item.catalogId) return getArmor(item.catalogId)?.name ?? 'Armor';
  if (item.kind === 'equipment' && item.catalogId) return getEquipment(item.catalogId)?.name ?? 'Item';
  return item.kind === 'weapon' ? 'Weapon' : item.kind === 'armor' ? 'Armor' : 'Item';
}

// ── Section shapes ───────────────────────────────────────────────────────────

export interface IdentitySection {
  name: string;
  species: string;
  classAndLevel: string;
  background: string;
  alignment: string;
  languages: string;
}

export interface AbilityRow {
  ability: Ability;
  name: string;
  abbr: string;
  score: number;
  modifier: number;
  saveModifier: number;
  saveProficient: boolean;
}

export interface CoreStat {
  label: string;
  value: string;
}

export interface SkillRow {
  id: SkillId;
  name: string;
  ability: string;
  modifier: number;
  proficient: boolean;
  expertise: boolean;
}

export interface SaveRow {
  ability: Ability;
  name: string;
  modifier: number;
  proficient: boolean;
}

export interface AttackRow {
  name: string;
  attackBonus: number;
  damage: string;
  proficient: boolean;
}

export interface SpellSlotRow {
  /** Spell level (1-9), or 0 for the Warlock Pact Magic row. */
  level: number;
  label: string;
  count: number;
}

/** One caster class's spell DC / attack for the multiclass print block. */
export interface SpellClassRow {
  className: string;
  ability: string;
  saveDc: number;
  attackBonus: number;
}

export interface SpellsSection {
  saveDc: number | undefined;
  attackBonus: number | undefined;
  ability: string | undefined;
  cantripsKnown: number;
  preparedCount: number;
  slots: SpellSlotRow[];
  cantrips: string[];
  prepared: string[];
  /**
   * Per-class spell DC / attack, one row per ACTIVE caster class (Stage M5).
   * Present (length >= 1) ONLY for a multiclass caster (2+ classes); undefined
   * for a single-class caster, whose single DC/attack stay in saveDc/attackBonus
   * — so the single-class print block is identical to the pre-M5 output.
   */
  perClass?: SpellClassRow[];
}

export interface InventoryRow {
  name: string;
  quantity: number;
}

export interface CurrencyRow {
  label: string;
  value: number;
}

export interface InventorySection {
  items: InventoryRow[];
  carried: number;
  capacity: number;
  currency: CurrencyRow[];
}

export interface FeatureRow {
  name: string;
  source: string;
  detail: string;
}

export interface PrintSheetData {
  identity: IdentitySection;
  abilities: AbilityRow[];
  coreStats: CoreStat[];
  /** Heroic Inspiration (PHB 2024): read-only on the sheet; set on the Overview. */
  heroicInspiration: boolean;
  skills: SkillRow[];
  saves: SaveRow[];
  attacks: AttackRow[];
  /** Present only for a spellcaster — matches the app's conditional Spells visibility. */
  spells: SpellsSection | undefined;
  inventory: InventorySection;
  features: FeatureRow[];
  conditions: string[];
}

// ── Builders ─────────────────────────────────────────────────────────────────

/** Identity: name, species, class + level, background, alignment, languages. */
export function buildIdentity(character: Character): IdentitySection {
  const species = resolveSpecies(character);
  const cls = resolveClass(character);
  // Multiclass (Stage M5): list every class as "<Class> <level>" joined by
  // " / " (e.g. "Fighter 3 / Wizard 2"). A single-class character yields one
  // entry — "Fighter 5" — identical to the pre-M5 output. PHB 2024 "Multiclassing".
  const resolved = resolveClasses(character);
  const classAndLevel =
    resolved.length > 0
      ? resolved.map(({ entry, data }) => `${data.name} ${entry.level}`).join(' / ')
      : cls
        ? `${cls.name} ${primaryClass(character)?.level ?? character.level}`
        : 'No class';
  // Resolve a structured (wizard-created) background to its display name the
  // same way CharacterPage does — getBackground(id)?.name — so the printed
  // sheet shows "Acolyte" rather than the lowercase "acolyte" id slug. Fall
  // back to the free-text background when there is no structured selection.
  const background =
    getBackground(character.backgroundSelection?.id)?.name ??
    character.background ??
    '';
  return {
    name: character.name || 'Unnamed Character',
    species: species?.name ?? 'No species',
    classAndLevel,
    background,
    alignment: character.alignment ?? '',
    languages: knownLanguages(character).join(', '),
  };
}

/** The six abilities: effective score, modifier, and save (total + proficiency marker). */
export function buildAbilities(character: Character): AbilityRow[] {
  const scores = effectiveAbilityScores(character);
  const saves = allSavingThrowBreakdowns(character);
  return ABILITIES.map((ability) => ({
    ability,
    name: ABILITY_NAMES[ability],
    abbr: ABILITY_ABBR[ability],
    score: scores[ability],
    modifier: abilityModifier(scores[ability]),
    saveModifier: saves[ability].total,
    saveProficient: savingThrowProficiency(character, ability).proficient,
  }));
}

/** Proficiency bonus, AC, HP max (+ current), speed, initiative, passive Perception. */
export function buildCoreStats(character: Character): CoreStat[] {
  const effScores = effectiveAbilityScores(character);
  const ac = characterArmorClassBreakdown(character);
  const hpMax = characterHitPointMaxBreakdown(character);
  const currentHp = effectiveHp(character);
  const speed = speedBreakdown(character);
  const initiative = initiativeBreakdown(effScores, character.initiativeBonus);
  const passivePerception = passivePerceptionBreakdown(character);

  const hpValue =
    currentHp !== undefined ? `${currentHp} / ${hpMax.total}` : `${hpMax.total}`;

  return [
    { label: 'Proficiency Bonus', value: signed(proficiencyBonus(character.level)) },
    { label: 'Armor Class', value: `${ac.total}` },
    { label: 'Hit Points', value: hpValue },
    { label: 'Speed', value: `${speed.total} ft` },
    { label: 'Initiative', value: signed(initiative.total) },
    { label: 'Passive Perception', value: `${passivePerception.total}` },
  ];
}

/** All skills with their modifier total + proficiency / expertise markers. */
export function buildSkills(character: Character): SkillRow[] {
  const breakdowns = allSkillBreakdowns(character);
  return SKILLS.map((skill) => {
    const training = getSkillTraining(character, skill.id);
    return {
      id: skill.id,
      name: skill.name,
      ability: ABILITY_ABBR[skill.ability],
      modifier: breakdowns[skill.id].total,
      proficient: training.proficient ?? false,
      expertise: training.expertise ?? false,
    };
  });
}

/** Saving throws: the total for each ability + a proficiency marker. */
export function buildSaves(character: Character): SaveRow[] {
  const saves = allSavingThrowBreakdowns(character);
  return ABILITIES.map((ability) => ({
    ability,
    name: ABILITY_NAMES[ability],
    modifier: saves[ability].total,
    proficient: savingThrowProficiency(character, ability).proficient,
  }));
}

/**
 * Attacks/weapons: the attack bonus + damage for each equipped weapon (from the
 * A5 attack logic), plus the always-available Unarmed Strike.
 */
export function buildAttacks(character: Character): AttackRow[] {
  const rows: AttackRow[] = [];
  for (const { item, weapon } of equippedWeapons(character)) {
    const profile = weaponAttackProfile(character, item);
    if (!profile) continue;
    const flat = profile.damage.flat;
    const damage =
      flat === 0 ? profile.damage.dice : `${profile.damage.dice} ${signed(flat)}`;
    rows.push({
      name: inventoryItemName(item),
      attackBonus: profile.attack.breakdown.total,
      damage: `${damage} ${weapon.damageType}`,
      proficient: profile.proficiency.proficient,
    });
  }
  // Unarmed Strike — always available (PHB 2024). Bind to the A5 helper's totals.
  const unarmed = unarmedStrike(effectiveAbilityScores(character), proficiencyBonus(character.level));
  rows.push({
    name: 'Unarmed Strike',
    attackBonus: unarmed.attack.total,
    damage: `${unarmed.damage.total} bludgeoning`,
    proficient: true,
  });
  return rows;
}

/**
 * Spells section — built ONLY for a spellcaster (matches the app's conditional
 * Spells visibility: non-casters return undefined). Every number is a direct
 * read of a spellcasting.ts total; nothing is recomputed here.
 */
export function buildSpells(character: Character): SpellsSection | undefined {
  // Visibility matches the app's Spells route guard (App.tsx) and the on-screen
  // SpellSlotSummary: render for ANY active caster, not only a caster PRIMARY
  // class — so a Fighter 3 / Wizard 2 (non-caster primary) still prints its
  // Spells section (PHB 2024 "Multiclassing"). A single-class caster is
  // unchanged (anySpellcaster === isSpellcaster when there is one class).
  if (!anySpellcaster(character)) return undefined;

  const isMulticlass = allClasses(character).length >= 2;

  // Top-line DC / attack / ability. These are the PRIMARY class's values for a
  // single-class caster (unchanged). For a multiclass whose primary class is a
  // non-caster, the primary-based resolvers return undefined; fall back to the
  // first ACTIVE caster class so the summary line is populated (the per-class
  // table below still lists every caster class). PHB 2024 "Multiclassing".
  const perClassSummaries = perClassSpellcasting(character);
  const primaryIsCaster = isSpellcaster(character);
  const ability = primaryIsCaster
    ? spellcastingAbility(character)
    : perClassSummaries[0]?.ability;
  const dcTotal = primaryIsCaster
    ? spellSaveDcBreakdown(character)?.total
    : perClassSummaries[0]?.saveDc.total;
  const atkTotal = primaryIsCaster
    ? spellAttackBreakdown(character)?.total
    : perClassSummaries[0]?.attack.total;

  // Slots: the combined Spellcasting pool + the separate Pact Magic pool
  // (Stage M5). For a single-class caster effectiveSpellSlots === spellSlots and
  // pactMagicSlotsForClass === pactMagicSlots, so the output is unchanged; the
  // multiclass-aware functions are used only for 2+ classes. A combined caster
  // can have BOTH a leveled pool and a pact pool, so both are listed.
  const slots: SpellSlotRow[] = [];
  const vector = isMulticlass ? effectiveSpellSlots(character) : spellSlots(character);
  const pact = isMulticlass ? pactMagicSlotsForClass(character) : pactMagicSlots(character);
  if (vector) {
    for (let level = 1; level < vector.length; level++) {
      const count = vector[level] ?? 0;
      if (count > 0) slots.push({ level, label: `Level ${level}`, count });
    }
  }
  if (pact && pact.slots > 0) {
    slots.push({ level: 0, label: `Pact Magic (level ${pact.slotLevel})`, count: pact.slots });
  }

  // Per-class DC / attack (Stage M5) — only for a multiclass caster; a
  // single-class caster keeps its single DC/attack in saveDc/attackBonus.
  const perClassRows: SpellClassRow[] | undefined = isMulticlass
    ? perClassSummaries.map((s) => ({
        className: s.className,
        ability: ABILITY_NAMES[s.ability],
        saveDc: s.saveDc.total,
        attackBonus: s.attack.total,
      }))
    : undefined;

  // Per-class selections live under spellcasting.byClass[classId]. A single-
  // class caster reads the PRIMARY class's bucket (unchanged). A multiclass
  // caster aggregates every active caster class's cantrips/prepared into the
  // flat print lists (PHB 2024 "Multiclassing").
  const spellNames = (ids: readonly string[] | undefined): string[] =>
    (ids ?? []).flatMap((id) => {
      const name = getSpell(id)?.name;
      return name !== undefined ? [name as string] : [];
    });
  let cantrips: string[];
  let prepared: string[];
  if (isMulticlass) {
    const byClass = character.spellcasting?.byClass ?? {};
    const casterIds = perClassSummaries.map((s) => s.classId);
    cantrips = casterIds.flatMap((id) => spellNames(byClass[id]?.cantrips));
    prepared = casterIds.flatMap((id) => spellNames(byClass[id]?.prepared));
  } else {
    const primaryId = primaryClass(character)?.id;
    const perClass = primaryId ? character.spellcasting?.byClass?.[primaryId] : undefined;
    cantrips = spellNames(perClass?.cantrips);
    prepared = spellNames(perClass?.prepared);
  }

  // Cantrip / prepared COUNTS: the primary class's caps for a single-class
  // caster (unchanged). For a multiclass each class prepares as a single-classed
  // member of itself (PHB 2024 "Multiclassing: Spellcasting"), so sum each
  // active caster's own cap from the M3 per-class summaries.
  const cantripsKnownTotal = isMulticlass
    ? perClassSummaries.reduce((sum, s) => sum + s.cantripsKnown, 0)
    : cantripsKnown(character);
  const preparedCountTotal = isMulticlass
    ? perClassSummaries.reduce((sum, s) => sum + s.preparedCount, 0)
    : preparedCount(character);

  return {
    saveDc: dcTotal,
    attackBonus: atkTotal,
    ability: ability ? ABILITY_NAMES[ability] : undefined,
    cantripsKnown: cantripsKnownTotal,
    preparedCount: preparedCountTotal,
    slots,
    cantrips,
    prepared,
    perClass: perClassRows,
  };
}

/** Inventory + encumbrance + currency: item list, carried vs capacity, coin purse. */
export function buildInventory(character: Character): InventorySection {
  const items = (character.inventory ?? []).map((item) => ({
    name: inventoryItemName(item),
    quantity: item.quantity,
  }));
  const carried = carriedWeightBreakdown(character).total;
  const capacity = carryingCapacityBreakdown(character).total;
  const coins: CurrencyAmount = characterCoins(character);
  const currency: CurrencyRow[] = [
    { label: 'PP', value: coins.pp },
    { label: 'GP', value: coins.gp },
    { label: 'EP', value: coins.ep },
    { label: 'SP', value: coins.sp },
    { label: 'CP', value: coins.cp },
  ];
  return { items, carried, capacity, currency };
}

/** Features: class features gained up to the character's level + species traits + feats. */
export function buildFeatures(character: Character): FeatureRow[] {
  const rows: FeatureRow[] = [];

  // Class features grouped BY CLASS (Stage M5), each gated at THAT class's own
  // level (PHB 2024 "Multiclassing"). For a single-class character this is the
  // one class's features gained up to its level, with source "<Class> <level>"
  // — identical to the pre-M5 output. The feature VALUES are unchanged.
  for (const { entry, data } of resolveClasses(character)) {
    const gained = [...data.features]
      .filter((f) => f.level <= entry.level)
      .sort((a, b) => a.level - b.level);
    for (const feature of gained) {
      rows.push({
        name: feature.name,
        source: `${data.name} ${feature.level}`,
        detail: feature.effect,
      });
    }
  }

  for (const trait of speciesTraits(character)) {
    const species = resolveSpecies(character);
    rows.push({ name: trait.name, source: species?.name ?? 'Species', detail: trait.effect });
  }

  for (const feat of characterFeats(character)) {
    const data = getFeat(feat.featId);
    rows.push({
      name: data?.name ?? feat.featId,
      source: `Feat (level ${feat.level})`,
      detail: data?.effect ?? '',
    });
  }

  return rows;
}

/** Active conditions (PHB names), plus Exhaustion when the level is above 0. */
export function buildConditions(character: Character): string[] {
  const names = activeConditionIds(character).map((id) => conditionLabel(id));
  const exhaustion = exhaustionLevelOf(character);
  if (exhaustion > 0) names.push(`Exhaustion ${exhaustion}`);
  return names;
}

/** Title-case a condition id for display (e.g. 'prone' → 'Prone'). */
function conditionLabel(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * The complete print-sheet data for a character: every section bound to the
 * existing derived functions. `spells` is present ONLY for a spellcaster, so
 * the PrintLayout omits the Spells section for a non-caster — matching the
 * app's conditional Spells route/nav visibility.
 */
export function buildPrintSheetData(character: Character): PrintSheetData {
  return {
    identity: buildIdentity(character),
    abilities: buildAbilities(character),
    coreStats: buildCoreStats(character),
    heroicInspiration: character.heroicInspiration === true,
    skills: buildSkills(character),
    saves: buildSaves(character),
    attacks: buildAttacks(character),
    spells: buildSpells(character),
    inventory: buildInventory(character),
    features: buildFeatures(character),
    conditions: buildConditions(character),
  };
}
