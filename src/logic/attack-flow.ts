/**
 * Glue for the guided Attack Flow (Stage A5d, UI part 2): the ad-hoc target, the attack
 * plan for one pass, the Advantage / Disadvantage source list and its resolved mode, the
 * damage result Breakdown, the Light extra attack candidates and the advisory turn events.
 *
 * No rule is invented here. Every rule lives in attacks.ts, weapon-mastery.ts, dice.ts,
 * conditions.ts and turn-economy.ts; this module only composes them so the component
 * holds no rule. Everything is pure.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md; 1-indexed lines):
 *  - Attack Rolls (L432-492), Cover (L977-1000), Advantage / Disadvantage (L472-492),
 *    Critical Hits (L1087-1100), Unarmed Strike (L21683-21690): see attacks.ts.
 *  - Attacks against a creature: the "attacksAgainst" effects of the Blinded, Invisible,
 *    Paralyzed, Prone, Restrained, Stunned and Unconscious entries of the Conditions
 *    glossary (L1197-1216; catalog src/data/conditions.ts). They are offered as manual
 *    toggles for the TARGET, never applied automatically.
 *  - Light (L9312): the extra attack is a Bonus Action; Nick (L9366) is informational.
 *  - Turn economy: Attack action = "action" event, Light extra attack = "bonus" event.
 *    The tracker is advisory and never blocks (turn-economy.ts).
 */
import type { Character, InventoryItem } from '../types/character';
import { CONDITIONS, getCondition } from '../data/conditions';
import type { WeaponData } from '../data/weapons';
import { abilityModifier, proficiencyBonus } from './abilities';
import { effectiveAbilityScores } from './feats';
import {
  attackSuggestions,
  attackerConditionSuggestions,
  coverAc,
  damageTotal,
  equippedWeapons,
  lightExtraStatus,
  resolveAttackMode,
  unarmedStrike,
  weaponAttackProfile,
  type AttackKind,
  type AttackSuggestionContext,
  type CoverDegree,
  type CoverResult,
  type EquippedWeapon,
  type WeaponDamage,
} from './attacks';
import type { Breakdown, BreakdownComponent } from './breakdown';
import { exhaustionLevelOf } from './conditions';
import type { D20Mode } from './dice';
import { applyCharacterTurnEvent, type TurnEvent, type TurnWarning } from './turn-economy';

/** The id used for an Unarmed Strike (it is not an inventory item). */
export const UNARMED_ATTACK_ID = 'unarmed';

// ─── The ad-hoc target ───────────────────────────────────────────────────────

export type CoverChoice = 'none' | CoverDegree;

/**
 * The opponent is an AD-HOC input (no monsters, no HP): an Armor Class and a degree of
 * cover. `ac` is undefined until the player types one, so the app never judges a roll
 * against an invented number.
 */
export interface AttackTarget {
  ac?: number;
  cover: CoverChoice;
}

export const DEFAULT_ATTACK_TARGET: AttackTarget = { cover: 'none' };

/** Parse a typed Armor Class: a whole number 0 or more, else undefined. */
export function parseTargetAc(raw: string): number | undefined {
  if (!/^\s*\d+\s*$/.test(raw)) return undefined;
  return Number.parseInt(raw, 10);
}

/** Cover-adjusted AC for the ad-hoc target (undefined while no AC is entered). */
export function targetCover(target: AttackTarget): CoverResult | undefined {
  if (target.ac === undefined) return undefined;
  return coverAc(target.ac, target.cover === 'none' ? [] : [target.cover]);
}

// ─── The attack plan for one pass ────────────────────────────────────────────

export interface AttackOptions {
  abilityChoice?: 'str' | 'dex';
  twoHanded?: boolean;
  thrown?: boolean;
  kind?: AttackKind;
}

export interface AttackPlan {
  id: string;
  name: string;
  unarmed: boolean;
  item?: InventoryItem;
  weapon?: WeaponData;
  /** The attack bonus Breakdown (ability modifier, Proficiency, Magic / other). */
  attackBonus: Breakdown;
  /** The ability modifier used for the attack (Graze and Topple use it). */
  abilityMod: number;
  damage: WeaponDamage;
  /** Exhaustion level for the d20 (decision D1). */
  exhaustion: number;
  proficient: boolean;
  proficiencyReason?: string;
}

/**
 * Everything the flow needs for one attack: for an inventory weapon, `weaponAttackProfile`;
 * for an Unarmed Strike, `unarmedStrike` (always proficient; damage is a fixed 1 plus the
 * Strength modifier, floored at 0, so there are no dice to double).
 */
export function buildAttackPlan(character: Character, weaponId: string, options: AttackOptions = {}): AttackPlan | undefined {
  const exhaustion = exhaustionLevelOf(character);
  if (weaponId === UNARMED_ATTACK_ID) {
    const scores = effectiveAbilityScores(character);
    const strike = unarmedStrike(scores, proficiencyBonus(character.level));
    const mod = abilityModifier(scores.str);
    const flat: Breakdown = { total: mod, components: [{ label: 'Strength mod', value: mod }] };
    return {
      id: UNARMED_ATTACK_ID,
      name: 'Unarmed Strike',
      unarmed: true,
      attackBonus: strike.attack,
      abilityMod: mod,
      damage: { dice: '1', flat: mod, breakdown: flat, damageType: 'bludgeoning' },
      exhaustion,
      proficient: true,
    };
  }
  const entry = equippedWeapons(character).find((candidate) => candidate.item.id === weaponId);
  if (!entry) return undefined;
  const profile = weaponAttackProfile(character, entry.item, options);
  if (!profile) return undefined;
  return {
    id: entry.item.id,
    name: entry.weapon.name,
    unarmed: false,
    item: entry.item,
    weapon: entry.weapon,
    attackBonus: profile.attack.breakdown,
    abilityMod: profile.attack.abilityMod,
    damage: profile.damage,
    exhaustion,
    proficient: profile.proficiency.proficient,
    proficiencyReason: profile.proficiency.reason,
  };
}

// ─── Advantage / Disadvantage sources ────────────────────────────────────────

export interface AttackSource {
  /** Stable id used for the user's toggle. */
  id: string;
  side: 'advantage' | 'disadvantage';
  label: string;
  /** Present when the effect depends on the situation. */
  situational?: string;
  origin: 'rule' | 'attacker-condition' | 'target-condition' | 'manual';
}

const RULE_LABELS: Record<string, string> = {
  'beyond-normal-range': 'Target is beyond the weapon\u2019s normal range',
  'ranged-in-close-combat': 'Ranged attack with an enemy within 5 feet that can see you',
  'heavy-weapon': 'Heavy weapon and the attack ability score is below 13',
  'target-unseen': 'You cannot see the target',
  'attacker-unseen': 'The target cannot see you',
};

/** Disadvantage / Advantage the PLAYER can claim from a feature, spell or ally the app does not model. */
export const MANUAL_ADVANTAGE_ID = 'manual:advantage';
export const MANUAL_DISADVANTAGE_ID = 'manual:disadvantage';

export interface AttackSourceContext {
  /** Distance in feet; only matters for ranged and thrown attacks. */
  distanceFt?: number;
  hostileAdjacentSeesYou?: boolean;
  targetUnseen?: boolean;
  attackerUnseen?: boolean;
  thrown?: boolean;
}

export interface AttackSourceList {
  sources: AttackSource[];
  /** The target is beyond the weapon's long range: the attack cannot be made. */
  blocked: boolean;
}

/** Manual toggles for the TARGET's defensive conditions, from the conditions catalog. */
export function targetConditionSources(): AttackSource[] {
  const out: AttackSource[] = [];
  for (const condition of CONDITIONS) {
    const effect = condition.mechanics.attacksAgainst;
    if (effect === undefined) continue;
    const crit = condition.mechanics.critWithin5ft
      ? ' Within 5 feet, a hit is automatically a Critical Hit (not applied for you).'
      : undefined;
    const base = { origin: 'target-condition' as const };
    const label = `Target is ${condition.name}`;
    switch (effect) {
      case 'advantage':
        out.push({ ...base, id: `target-condition:${condition.id}`, side: 'advantage', label, situational: crit?.trim() });
        break;
      case 'disadvantage':
        out.push({ ...base, id: `target-condition:${condition.id}`, side: 'disadvantage', label });
        break;
      case 'disadvantage-unless-seen':
        out.push({ ...base, id: `target-condition:${condition.id}`, side: 'disadvantage', label, situational: 'Not if you can somehow see the target.' });
        break;
      case 'advantage-within-5ft-else-disadvantage':
        out.push({ ...base, id: `target-condition:${condition.id}:near`, side: 'advantage', label: `${label}, and you are within 5 feet` });
        out.push({ ...base, id: `target-condition:${condition.id}:far`, side: 'disadvantage', label: `${label}, and you are farther than 5 feet` });
        break;
    }
  }
  return out;
}

/**
 * The full list of Advantage / Disadvantage sources to offer as toggles: the rule
 * suggestions for the weapon and situation (`attackSuggestions`), the attacker's own
 * conditions (`attackerConditionSuggestions`), the target's defensive conditions and two
 * manual sources. These are SUGGESTIONS: nothing is applied until the player ticks it.
 */
export function attackSourceList(character: Character, plan: AttackPlan, context: AttackSourceContext): AttackSourceList {
  const sources: AttackSource[] = [];
  let blocked = false;

  const flowScores = effectiveAbilityScores(character);
  const ctx: AttackSuggestionContext = {
    str: flowScores.str,
    dex: flowScores.dex,
    thrown: context.thrown,
    distanceFt: context.distanceFt,
    hostileAdjacentSeesYou: context.hostileAdjacentSeesYou,
    targetUnseen: context.targetUnseen,
    attackerUnseen: context.attackerUnseen,
  };
  if (plan.weapon) {
    const suggested = attackSuggestions(plan.weapon, ctx);
    blocked = suggested.blocked;
    for (const id of suggested.disadvantageFrom) sources.push({ id: `rule:${id}`, side: 'disadvantage', label: RULE_LABELS[id] ?? id, origin: 'rule' });
    for (const id of suggested.advantageFrom) sources.push({ id: `rule:${id}`, side: 'advantage', label: RULE_LABELS[id] ?? id, origin: 'rule' });
  } else {
    // Unarmed Strike has no weapon properties or range: only the unseen rules apply.
    if (context.targetUnseen === true) sources.push({ id: 'rule:target-unseen', side: 'disadvantage', label: RULE_LABELS['target-unseen'], origin: 'rule' });
    if (context.attackerUnseen === true) sources.push({ id: 'rule:attacker-unseen', side: 'advantage', label: RULE_LABELS['attacker-unseen'], origin: 'rule' });
  }

  for (const suggestion of attackerConditionSuggestions(character)) {
    const name = getCondition(suggestion.conditionId)?.name ?? suggestion.conditionId;
    sources.push({
      id: suggestion.source,
      side: suggestion.side,
      label: `You have the ${name} condition`,
      situational: suggestion.situational,
      origin: 'attacker-condition',
    });
  }
  sources.push(...targetConditionSources());
  sources.push(
    { id: MANUAL_ADVANTAGE_ID, side: 'advantage', label: 'Advantage from another source (feature, spell or ally)', origin: 'manual' },
    { id: MANUAL_DISADVANTAGE_ID, side: 'disadvantage', label: 'Disadvantage from another source', origin: 'manual' },
  );
  return { sources, blocked };
}

export interface ResolvedAttackMode {
  mode: D20Mode;
  advantageFrom: string[];
  disadvantageFrom: string[];
  /** Both sides have a source, so they cancel (any mix cancels; nothing stacks). */
  cancelled: boolean;
}

/** The roll mode for the sources the player ticked. L472-492. */
export function resolveSelectedMode(sources: readonly AttackSource[], selectedIds: readonly string[]): ResolvedAttackMode {
  const chosen = sources.filter((source) => selectedIds.includes(source.id));
  const advantageFrom = chosen.filter((source) => source.side === 'advantage').map((source) => source.label);
  const disadvantageFrom = chosen.filter((source) => source.side === 'disadvantage').map((source) => source.label);
  return {
    mode: resolveAttackMode(advantageFrom, disadvantageFrom),
    advantageFrom,
    disadvantageFrom,
    cancelled: advantageFrom.length > 0 && disadvantageFrom.length > 0,
  };
}

// ─── Damage result ───────────────────────────────────────────────────────────

const DICE_TERM = /^(\d+)d(\d+)$/i;

/** The lowest and highest total the dice expression can make; a fixed amount is its own value. */
export function diceRange(dice: string): { count: number; min: number; max: number } {
  const text = dice.trim();
  if (/^\d+$/.test(text)) return { count: 0, min: Number(text), max: Number(text) };
  const match = DICE_TERM.exec(text);
  if (!match) throw new Error(`diceRange(): unsupported dice expression "${dice}"`);
  const count = Number(match[1]);
  return { count, min: count, max: count * Number(match[2]) };
}

export interface DamageOutcome {
  /** The dice that were rolled (doubled on a Critical Hit). */
  dice: string;
  diceTotal: number;
  flat: number;
  total: number;
  damageType: WeaponDamage['damageType'];
  critical: boolean;
  /** Dice, then the flat components, then the 0 floor; components sum to the total. */
  breakdown: Breakdown;
}

/**
 * Damage once the dice total is known (rolled or typed in): dice doubled on a Critical
 * Hit, the flat modifier added once, never below 0. PHB 2024 "Damage Rolls" (L1081-1086),
 * "Critical Hits" (L1087-1100). `diceTotal` must lie in the dice's range.
 */
export function damageOutcome(damage: WeaponDamage, rolledDice: string, diceTotal: number, critical: boolean): DamageOutcome {
  const total = damageTotal(diceTotal, damage.flat);
  const fixed = /^\d+$/.test(rolledDice.trim());
  const components: BreakdownComponent[] = [
    { label: fixed ? 'Fixed damage' : critical ? `${rolledDice} (Critical Hit, dice doubled)` : `${rolledDice} roll`, value: diceTotal },
    ...damage.breakdown.components.map((c) => ({ ...c })),
    { label: 'Cannot go below 0', value: total - (diceTotal + damage.flat) },
  ];
  const breakdown: Breakdown = { total, components };
  if (critical) breakdown.note = 'Critical Hit: the damage dice are rolled twice; modifiers are added once.';
  if (damage.breakdown.note) breakdown.note = [breakdown.note, damage.breakdown.note].filter(Boolean).join(' ');
  return { dice: rolledDice, diceTotal, flat: damage.flat, total, damageType: damage.damageType, critical, breakdown };
}

// ─── Light extra attack ──────────────────────────────────────────────────────

export interface LightExtraOptions {
  /** Equipped weapons that could make the extra attack. */
  candidates: EquippedWeapon[];
  /** Why none can (or the Light property is missing on the main weapon). */
  reason?: string;
}

/**
 * Equipped weapons that can make the Light extra attack after an Attack action made with
 * `main`: a different Light weapon, the main weapon also Light (`lightExtraStatus`).
 * Returns undefined when the main weapon is not Light (nothing to offer).
 */
export function lightExtraOptions(character: Character, mainItemId: string): LightExtraOptions | undefined {
  const all = equippedWeapons(character);
  const main = all.find((entry) => entry.item.id === mainItemId);
  if (!main || !main.weapon.properties.includes('light')) return undefined;
  const candidates = all.filter(
    (entry) => lightExtraStatus({ itemId: main.item.id, weapon: main.weapon }, { itemId: entry.item.id, weapon: entry.weapon }, true).available,
  );
  if (candidates.length > 0) return { candidates };
  return { candidates, reason: 'The extra attack needs a different equipped Light weapon.' };
}

// ─── Turn events (advisory) ──────────────────────────────────────────────────

export interface RecordedEvent {
  character: Character;
  warnings: TurnWarning[];
}

/**
 * Record a turn event only while a combat is running. Outside combat nothing is recorded
 * and the same character comes back. Never blocks (turn-economy.ts is advisory).
 */
export function recordAttackEvent(character: Character, event: Extract<TurnEvent, 'action' | 'bonus'>): RecordedEvent {
  if (!character.combat?.inCombat) return { character, warnings: [] };
  return applyCharacterTurnEvent(character, event);
}
