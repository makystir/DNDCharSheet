/**
 * Content-tooltip resolvers for inventory items (Stage A1 data layer).
 *
 * Ported IN STRUCTURE from PWACharSheet's src/logic/tooltip-content.ts: the
 * `TooltipContent` shape ({ title, sections[] }) and the resolve*Tooltip →
 * TooltipContent | null contract are retained; the data is retargeted to the
 * D&D 5.5e (2024) catalogs built in this stage (weapons/armor/equipment) plus
 * the weapon property/mastery definitions.
 *
 * SCOPE: A1 supplies the DATA resolvers only. Blueprint §2.6/§4.5 defer the
 * RENDERING (wiring these into the shared Tooltip component on weapon cards,
 * armor rows, gear cards, and property chips) to A3. This module is the A1
 * deliverable the review (finding #5) requires so A3 has a data seam to consume.
 *
 * Every string surfaced here is a short PHB-cited paraphrase carried on the
 * catalogs / property tables (never long verbatim PHB prose — rules-compliance
 * rule 5).
 */

import type { InventoryItem } from '../types/character';
import {
  getWeapon,
  WEAPON_PROPERTY_TEXT,
  WEAPON_MASTERY_TEXT,
  type WeaponData,
  type WeaponProperty,
  type MasteryProperty,
} from '../data/weapons';
import {
  getArmor,
  ARMOR_TRAINING_TEXT,
  SHIELD_TRAINING_TEXT,
  type ArmorData,
  type ArmorCategory,
} from '../data/armor';
import { getEquipment, type EquipmentData } from '../data/equipment';
import { EXHAUSTION, EXHAUSTION_TRACK, getCondition } from '../data/conditions';
import { getFeat, type FeatCategory } from '../data/feats';
import { ABILITY_NAMES, type Ability } from '../types/character';

/** Structured content for a tooltip popover (same shape as the PWA source). */
export interface TooltipContent {
  title: string;
  sections: { label: string; text: string }[];
}

/** Title-case a property/mastery enum value for display ("two-handed" → "Two-Handed"). */
function titleCase(value: string): string {
  return value
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('-');
}

/** Human-readable range summary for a weapon that has numeric ranges. */
function rangeText(w: WeaponData): string | null {
  if (w.normalRange === undefined || w.longRange === undefined) return null;
  return `${w.normalRange}/${w.longRange} ft`;
}

/**
 * Tooltip content for a single weapon PROPERTY, from the PHB-cited definition
 * table. Returns null for an unknown property.
 */
export function resolveWeaponPropertyTooltip(
  property: WeaponProperty,
): TooltipContent | null {
  const text = WEAPON_PROPERTY_TEXT[property];
  if (!text) return null;
  return { title: titleCase(property), sections: [{ label: 'Property', text }] };
}

/**
 * A single property "chip" for a weapon card: its display label and the tooltip
 * content, resolved WITH the owning weapon's context so a conditional exception
 * is carried onto the chip (finding #4), not only the whole-weapon tooltip.
 */
export interface WeaponPropertyChip {
  /** Chip label, e.g. "Two-Handed (unless mounted)" for the Lance. */
  label: string;
  /** Tooltip content for the chip (null when the property has no definition). */
  tooltip: TooltipContent | null;
}

/**
 * Resolve the property chips for a weapon WITH its context (finding #4). The
 * context-free `resolveWeaponPropertyTooltip` is kept for callers that only
 * have a bare property, but weapon cards must render chips through this so the
 * Lance's Two-Handed "unless mounted" exception shows on the chip label AND its
 * tooltip — not just in the whole-weapon tooltip. The base property definition
 * is preserved; the conditional only appends the exception.
 */
export function resolveWeaponPropertyChips(w: WeaponData): WeaponPropertyChip[] {
  return w.properties.map((p) => {
    const cond = w.conditionalProperties?.find((c) => c.property === p);
    const base = resolveWeaponPropertyTooltip(p);
    if (!cond) return { label: titleCase(p), tooltip: base };
    const label = `${titleCase(p)} (unless ${cond.unlessCondition})`;
    // Append the exception to the base property explanation so the chip tooltip
    // reads the full conditional rule (PHB 2024 Weapons table, Lance L9412).
    const tooltip: TooltipContent | null = base
      ? {
          title: label,
          sections: [
            ...base.sections,
            {
              label: 'Exception',
              text: `This weapon does not require two hands while ${cond.unlessCondition}.`,
            },
          ],
        }
      : null;
    return { label, tooltip };
  });
}

/**
 * Tooltip content for a single weapon MASTERY property, from the PHB-cited
 * definition table. Returns null for an unknown mastery.
 */
export function resolveWeaponMasteryTooltip(
  mastery: MasteryProperty,
): TooltipContent | null {
  const text = WEAPON_MASTERY_TEXT[mastery];
  if (!text) return null;
  return { title: `${titleCase(mastery)} (Mastery)`, sections: [{ label: 'Mastery', text }] };
}

/**
 * Tooltip content for a weapon inventory item: its damage, properties, mastery,
 * and range. Returns null when the item is not a catalog weapon (a custom
 * weapon with no catalogId is handled by the UI stage).
 */
/**
 * Render a weapon's property list for display, applying any machine-readable
 * conditional exception (finding #4). The only 2024 case is the Lance's
 * Two-Handed "unless mounted", which renders as "Two-Handed (unless mounted)"
 * rather than an unconditional "Two-Handed", so the tooltip never states a
 * restriction the PHB qualifies.
 */
function propertyLabels(w: WeaponData): string[] {
  return w.properties.map((p) => {
    const cond = w.conditionalProperties?.find((c) => c.property === p);
    return cond ? `${titleCase(p)} (unless ${cond.unlessCondition})` : titleCase(p);
  });
}

export function resolveWeaponTooltip(item: InventoryItem): TooltipContent | null {
  if (item.kind !== 'weapon' || !item.catalogId) return null;
  const w = getWeapon(item.catalogId);
  if (!w) return null;

  const labels = propertyLabels(w);
  const propList = labels.length > 0 ? labels.join(', ') : 'None';
  const damage = w.properties.includes('versatile') && w.versatileDice
    ? `${w.damageDice} ${w.damageType} (${w.versatileDice} two-handed)`
    : `${w.damageDice} ${w.damageType}`;

  const sections: TooltipContent['sections'] = [
    { label: 'Category', text: `${titleCase(w.category)} ${titleCase(w.range)}` },
    { label: 'Damage', text: damage },
    { label: 'Properties', text: propList },
    { label: 'Mastery', text: `${titleCase(w.mastery)} — ${WEAPON_MASTERY_TEXT[w.mastery]}` },
  ];
  // Ranged/thrown weapons: surface the ammunition type and the numeric range so
  // the Ammunition property's "listed type" is actually listed (finding #4).
  const range = rangeText(w);
  if (w.ammunitionType) {
    sections.push({ label: 'Ammunition', text: w.ammunitionType });
  }
  if (range) sections.push({ label: 'Range', text: range });

  return { title: item.name ?? w.name, sections };
}

/** Human-readable Dex-to-AC rule for an armor category. */
function dexText(a: ArmorData): string {
  if (a.category === 'shield') return 'Shield grants a flat +2 to AC.';
  if (!a.addsDex) return 'No Dexterity modifier is added to AC (heavy armor).';
  if (a.dexCap !== undefined) return `Add your Dexterity modifier (maximum +${a.dexCap}).`;
  return 'Add your full Dexterity modifier.';
}

const ARMOR_CATEGORY_LABEL: Record<ArmorCategory, string> = {
  light: 'Light Armor',
  medium: 'Medium Armor',
  heavy: 'Heavy Armor',
  shield: 'Shield',
};

/**
 * Tooltip content for an armor inventory item: base AC, Dex rule, Strength
 * requirement, and stealth. Returns null when the item is not a catalog armor.
 */
export function resolveArmorTooltip(item: InventoryItem): TooltipContent | null {
  if (item.kind !== 'armor' || !item.catalogId) return null;
  const a = getArmor(item.catalogId);
  if (!a) return null;

  const sections: TooltipContent['sections'] = [
    { label: 'Category', text: ARMOR_CATEGORY_LABEL[a.category] },
    {
      label: a.category === 'shield' ? 'AC Bonus' : 'Base AC',
      text: a.category === 'shield' ? `+${a.baseAc}` : String(a.baseAc),
    },
    { label: 'Dexterity', text: dexText(a) },
  ];
  if (a.strengthRequirement !== undefined) {
    sections.push({
      label: 'Strength',
      text: `Requires Strength ${a.strengthRequirement}; your Speed drops 10 feet while wearing it with less.`,
    });
  }
  sections.push({
    label: 'Stealth',
    text: a.stealthDisadvantage
      ? 'Disadvantage on Dexterity (Stealth) checks.'
      : 'No Stealth penalty.',
  });
  // Universal armor/shield training prerequisite (finding #4): a number is never
  // shown without the rule that gates it.
  sections.push({
    label: 'Training',
    text: a.category === 'shield' ? SHIELD_TRAINING_TEXT : ARMOR_TRAINING_TEXT,
  });

  return { title: item.name ?? a.name, sections };
}

/**
 * Tooltip content for a general equipment inventory item, from its catalog
 * `description`. Returns null when the item is not a catalog equipment entry or
 * carries no description (a custom item with no catalog entry).
 */
export function resolveItemTooltip(item: InventoryItem): TooltipContent | null {
  if (item.kind !== 'equipment' || !item.catalogId) return null;
  const e: EquipmentData | undefined = getEquipment(item.catalogId);
  if (!e || !e.description) return null;
  return { title: item.name ?? e.name, sections: [{ label: 'Description', text: e.description }] };
}

/**
 * Tooltip content for a PHB 2024 condition (Stage A4), from the conditions
 * catalog. Takes a condition id (e.g. 'paralyzed'). Returns null for an unknown
 * id. Ported from the PWA resolveConditionTooltip contract (title + labelled
 * sections), retargeted at the D&D conditions.
 */
export function resolveConditionTooltip(conditionId: string): TooltipContent | null {
  const c = getCondition(conditionId);
  if (!c) return null;
  const sections: { label: string; text: string }[] = [
    { label: 'Description', text: c.description },
    { label: 'Effects', text: c.effects.join(' ') },
  ];
  if (c.endsWhen) sections.push({ label: 'Ends', text: c.endsWhen });
  if (c.implies.length > 0) {
    sections.push({
      label: 'Also applies',
      text: c.implies.map((id) => getCondition(id)?.name ?? id).join(', '),
    });
  }
  return { title: c.name, sections };
}

/**
 * Tooltip content for a single Exhaustion level (1..6). Returns null for a
 * level outside the track. PHB 2024 "Exhaustion" (L21018-21028).
 */
export function resolveExhaustionLevelTooltip(level: number): TooltipContent | null {
  const row = EXHAUSTION_TRACK.find((r) => r.level === level);
  if (!row) return null;
  const sections: { label: string; text: string }[] = [
    { label: 'D20 Tests', text: `Rolls are reduced by ${row.d20Penalty} (2 \u00d7 level ${row.level}).` },
    { label: 'Speed', text: `Speed is reduced by ${row.speedPenaltyFt} feet (5 ft \u00d7 level ${row.level}).` },
  ];
  if (row.fatal) {
    sections.push({ label: 'Death', text: `You die at Exhaustion level ${EXHAUSTION.deathLevel}.` });
  }
  sections.push({
    label: 'Removal',
    text: 'Finishing a Long Rest removes 1 level; the condition ends at level 0.',
  });
  return { title: `Exhaustion level ${row.level}`, sections };
}

/** Keys of the Hit Point rule tooltips (Stage A5a). */
export const HP_RULE_TOOLTIP_KEYS = [
  'bloodied',
  'stable',
  'temp-hp',
  'death-saves',
  'massive-damage',
] as const;

export type HpRuleTooltipKey = (typeof HP_RULE_TOOLTIP_KEYS)[number];

const HP_RULE_TOOLTIPS: Record<HpRuleTooltipKey, TooltipContent> = {
  bloodied: {
    title: 'Bloodied',
    sections: [
      {
        label: 'Rule',
        text: 'You are Bloodied while you have half your Hit Points or fewer. It has no game effect on its own, but other effects can key off it.',
      },
      { label: 'Source', text: 'PHB 2024 "Hit Points" (Docs/PlayersHandbook.md L1079)' },
    ],
  },
  stable: {
    title: 'Stable',
    sections: [
      {
        label: 'Rule',
        text: 'A Stable creature is at 0 Hit Points but makes no Death Saving Throws. It still has the Unconscious condition.',
      },
      {
        label: 'Ends',
        text: 'It stops being Stable when it takes damage and then makes Death Saving Throws again. If it is not healed, it regains 1 Hit Point after 1d4 hours.',
      },
      {
        label: 'How',
        text: 'Become Stable with a third Death Saving Throw success, or when someone takes the Help action and succeeds on a DC 10 Wisdom (Medicine) check.',
      },
      { label: 'Source', text: 'PHB 2024 "Stabilizing a Character" (L1176-1177)' },
    ],
  },
  'temp-hp': {
    title: 'Temporary Hit Points',
    sections: [
      {
        label: 'Buffer',
        text: 'Temporary Hit Points are lost first when you take damage; leftover damage carries over to your Hit Points.',
      },
      {
        label: 'No stacking',
        text: 'They cannot be added together. When you receive more, you choose to keep what you have or take the new amount.',
      },
      {
        label: 'Not Hit Points',
        text: 'They are not Hit Points: healing cannot restore them, receiving them is not healing, and they do not wake you at 0 Hit Points.',
      },
      { label: 'Duration', text: 'They last until depleted or until you finish a Long Rest.' },
      { label: 'Source', text: 'PHB 2024 "Temporary Hit Points" (L1179-1193)' },
    ],
  },
  'death-saves': {
    title: 'Death Saving Throws',
    sections: [
      {
        label: 'When',
        text: 'Make one whenever you start your turn with 0 Hit Points. It is a d20 that is not tied to an ability score.',
      },
      {
        label: 'Result',
        text: 'A 10 or higher succeeds; otherwise it fails. Three successes make you Stable; three failures mean death. They need not be consecutive.',
      },
      {
        label: 'Natural 1 / 20',
        text: 'A natural 1 counts as two failures. A natural 20 regains 1 Hit Point. These are judged on the die itself.',
      },
      {
        label: 'Damage at 0 HP',
        text: 'Any damage is one failure, or two from a Critical Hit. Damage equal to or above your Hit Point maximum kills you.',
      },
      {
        label: 'Reset',
        text: 'Both tallies reset when you regain any Hit Points or become Stable.',
      },
      {
        label: 'Exhaustion',
        text: 'The PHB does not say outright that a Death Saving Throw is a D20 Test. This app treats it as one, so Exhaustion reduces the roll by 2 per level.',
      },
      { label: 'Source', text: 'PHB 2024 "Death Saving Throws" (L1155-1171)' },
    ],
  },
  'massive-damage': {
    title: 'Massive Damage',
    sections: [
      {
        label: 'Rule',
        text: 'When damage reduces a character to 0 Hit Points and damage remains, the character dies if the remainder equals or exceeds their Hit Point maximum.',
      },
      {
        label: 'Temporary Hit Points',
        text: 'The PHB does not say how Temporary Hit Points interact. This app spends them first; what is left after they and your Hit Points are used up is the remainder.',
      },
      { label: 'Source', text: 'PHB 2024 "Instant Death" (L1145)' },
    ],
  },
};

/**
 * Tooltip content for a Hit Point rule term (Bloodied, Stable, Temporary Hit
 * Points, Death Saving Throws, Massive Damage). Short PHB-cited paraphrases.
 * Returns null for an unknown key.
 */
export function resolveHitPointRuleTooltip(key: string): TooltipContent | null {
  return Object.hasOwn(HP_RULE_TOOLTIPS, key) ? HP_RULE_TOOLTIPS[key as HpRuleTooltipKey] : null;
}

/** Keys of the Concentration and rest rule tooltips (Stage A5b). */
export const REST_RULE_TOOLTIP_KEYS = ['concentration', 'short-rest', 'long-rest'] as const;

export type RestRuleTooltipKey = (typeof REST_RULE_TOOLTIP_KEYS)[number];

const REST_RULE_TOOLTIPS: Record<RestRuleTooltipKey, TooltipContent> = {
  concentration: {
    title: 'Concentration',
    sections: [
      {
        label: 'Rule',
        text: 'Some spells need Concentration to stay active. If you lose it, the effect ends. You can end it at any time with no action.',
      },
      {
        label: 'Another effect',
        text: 'You lose Concentration the moment you start casting another spell that requires it.',
      },
      {
        label: 'Damage',
        text: 'When you take damage, make a Constitution saving throw. The DC is 10 or half the damage taken (round down), whichever is higher, up to 30.',
      },
      {
        label: 'Incapacitated or dead',
        text: 'It ends if you have the Incapacitated condition or you die. Unconscious, Paralyzed, Petrified and Stunned all include Incapacitated.',
      },
      {
        label: 'This app',
        text: 'Exhaustion reduces the save roll by 2 per level. A natural 1 or 20 has no special effect on a saving throw. Damage absorbed by Temporary Hit Points counts, unless you turn that off.',
      },
      { label: 'Source', text: 'PHB 2024 "Concentration" (Docs/PlayersHandbook.md L20767-20777)' },
    ],
  },
  'short-rest': {
    title: 'Short Rest',
    sections: [
      {
        label: 'Rule',
        text: 'A Short Rest is 1 hour of light downtime. You need at least 1 Hit Point to start it.',
      },
      {
        label: 'Hit Point Dice',
        text: 'You may spend one or more Hit Point Dice. For each, roll the die, add your Constitution modifier, and regain that many Hit Points (minimum 1 per die). You can decide on another die after each roll.',
      },
      {
        label: 'Recharge',
        text: 'Warlock Pact Magic spell slots return. Standard spell slots do not. Features that a Short Rest recharges recharge as their descriptions say.',
      },
      {
        label: 'Interruptions',
        text: 'Rolling Initiative, casting a spell other than a cantrip, or taking any damage stops it, and an interrupted Short Rest gives no benefits.',
      },
      {
        label: 'Source',
        text: 'PHB 2024 "Short Rest" (L21475-21490); Warlock "Pact Magic" (L6854)',
      },
    ],
  },
  'long-rest': {
    title: 'Long Rest',
    sections: [
      {
        label: 'Rule',
        text: 'A Long Rest is at least 8 hours, with at least 6 of sleep and no more than 2 of light activity. You need at least 1 Hit Point to start it, and you have the Unconscious condition while you sleep.',
      },
      {
        label: 'Benefits',
        text: 'You regain all lost Hit Points and all spent Hit Point Dice. Your Exhaustion level drops by 1. Temporary Hit Points are lost. Spell slots, Pact Magic slots and Mystic Arcanum return.',
      },
      {
        label: '16 hours',
        text: 'You must wait at least 16 hours before starting another. This app only warns you; it never blocks a rest.',
      },
      {
        label: 'Interruptions',
        text: 'Rolling Initiative, casting a spell other than a cantrip, taking any damage, or 1 hour of walking or other exertion stops it. If you rested at least 1 hour first, you gain the benefits of a Short Rest. Resuming costs 1 extra hour per interruption.',
      },
      {
        label: 'Concentration',
        text: 'Sleeping makes you Unconscious, which includes Incapacitated, so a Long Rest ends Concentration. The PHB does not state this in one sentence.',
      },
      {
        label: 'Source',
        text: 'PHB 2024 "Long Rest" (L21240-21262, L21296-21306); "Temporary Hit Points" (L1179-1193); Warlock "Mystic Arcanum" (L6892)',
      },
    ],
  },
};

/**
 * Tooltip content for Concentration, Short Rest or Long Rest (short PHB-cited
 * paraphrases). Returns null for an unknown key.
 */
export function resolveRestRuleTooltip(key: string): TooltipContent | null {
  return Object.hasOwn(REST_RULE_TOOLTIPS, key) ? REST_RULE_TOOLTIPS[key as RestRuleTooltipKey] : null;
}

/** Keys of the Initiative and action economy rule tooltips (Stage A5c). */
export const TURN_RULE_TOOLTIP_KEYS = [
  'initiative',
  'surprise',
  'action',
  'bonus-action',
  'reaction',
  'dash',
] as const;

export type TurnRuleTooltipKey = (typeof TURN_RULE_TOOLTIP_KEYS)[number];

const TURN_RULE_TOOLTIPS: Record<TurnRuleTooltipKey, TooltipContent> = {
  initiative: {
    title: 'Initiative',
    sections: [
      {
        label: 'Rule',
        text: 'When combat starts, everyone makes a Dexterity check. The total is your Initiative count, and turns go from the highest count to the lowest. The order stays the same every round.',
      },
      {
        label: 'Ties',
        text: 'The players decide the order among tied characters. The DM decides among tied monsters, and in a tie between a monster and a player character. This app never breaks a tie for you; use the arrows to reorder tied entries.',
      },
      {
        label: 'Advantage and Disadvantage',
        text: 'Being surprised or Incapacitated gives Disadvantage on the roll. Being Invisible gives Advantage. They never stack, and any mix of the two cancels to a normal roll.',
      },
      {
        label: 'This app',
        text: 'Exhaustion reduces the roll by 2 per level. A natural 1 or 20 has no special effect on a Dexterity check. Feats and features that add to Initiative are not modelled; use the Initiative bonus.',
      },
      { label: 'Source', text: 'PHB 2024 "Initiative" (Docs/PlayersHandbook.md L870-879); Incapacitated, Invisible and "Advantage/Disadvantage" (L472-487)' },
    ],
  },
  surprise: {
    title: 'Surprise',
    sections: [
      {
        label: 'Rule',
        text: 'A combatant caught unawares by the start of combat is surprised and has Disadvantage on its Initiative roll. For example, a foe who does not know an ambusher is about to attack is surprised.',
      },
      {
        label: 'No surprise round',
        text: 'There is no separate surprise round in the 2024 rules. A surprised combatant still takes its turn in Initiative order.',
      },
      {
        label: 'Related',
        text: 'If you are Incapacitated when you roll Initiative, you also have Disadvantage. Disadvantage from several sources is still just Disadvantage.',
      },
      { label: 'Source', text: 'PHB 2024 "Surprise" (L21625-21628); "Initiative" (L875)' },
    ],
  },
  action: {
    title: 'Action',
    sections: [
      {
        label: 'Rule',
        text: 'On your turn you can move up to your Speed and take one action, in either order. You can take only one action at a time.',
      },
      {
        label: 'Choices',
        text: 'Attack, Dash, Disengage, Dodge, Help, Hide, Influence, Magic, Ready, Search, Study and Utilize, plus any actions your features give you.',
      },
      {
        label: 'Free interaction',
        text: 'You can interact with one object for free during your move or action. A second object needs the Utilize action.',
      },
      {
        label: 'This app',
        text: 'The tracker only advises. If a feature gives you another action, you can record it and the warning is just a reminder.',
      },
      { label: 'Source', text: 'PHB 2024 "Actions" (L586-613); "Your Turn" (L880-897)' },
    ],
  },
  'bonus-action': {
    title: 'Bonus Action',
    sections: [
      {
        label: 'Rule',
        text: 'A special action you can take on a turn when a class feature, spell or other rule says you can. Without such a rule you have no Bonus Action.',
      },
      {
        label: 'Limit',
        text: 'You can take only one Bonus Action on your turn, so choose if you have several. You choose when to take it unless its timing is specified.',
      },
      {
        label: 'Incapacitated',
        text: 'Anything that stops you taking actions also stops Bonus Actions, such as the Incapacitated condition.',
      },
      { label: 'Source', text: 'PHB 2024 "Bonus Actions" (L615-621); glossary "Bonus Action" (L20695)' },
    ],
  },
  reaction: {
    title: 'Reaction',
    sections: [
      {
        label: 'Rule',
        text: 'An instant response to a trigger. You can take one on your own turn or on someone else\'s. The Opportunity Attack is a Reaction every creature has.',
      },
      {
        label: 'Limit',
        text: 'Once you take a Reaction you cannot take another until the start of your next turn. Other combatants\' turns do not refresh it.',
      },
      {
        label: 'Timing',
        text: 'A Reaction happens right after its trigger, unless its description says otherwise. If it interrupts a turn, that creature carries on afterwards.',
      },
      { label: 'Source', text: 'PHB 2024 "Reactions" (L623-629); glossary "Reaction" (L21417)' },
    ],
  },
  dash: {
    title: 'Dash',
    sections: [
      {
        label: 'Rule',
        text: 'When you take the Dash action you gain extra movement for the rest of the turn, equal to your Speed after any modifiers.',
      },
      {
        label: 'Example',
        text: 'With a Speed of 30 feet you can move up to 60 feet this turn. If your Speed is reduced to 15 feet, you can move up to 30 feet.',
      },
      {
        label: 'Special speeds',
        text: 'With a Fly or Swim Speed you can use that speed instead each time you Dash.',
      },
      {
        label: 'This app',
        text: 'Dash uses your action and adds one Speed to the movement allowance. The tracker uses the Speed you give it; Speed penalties are not applied yet.',
      },
      { label: 'Source', text: 'PHB 2024 "Dash [Action]" (L20925-20931)' },
    ],
  },
};

/**
 * Tooltip content for Initiative, Surprise, Action, Bonus Action, Reaction or
 * Dash (short PHB-cited paraphrases). Returns null for an unknown key.
 */
export function resolveTurnRuleTooltip(key: string): TooltipContent | null {
  return Object.hasOwn(TURN_RULE_TOOLTIPS, key) ? TURN_RULE_TOOLTIPS[key as TurnRuleTooltipKey] : null;
}

/** Keys of the weapon attack rule tooltips (Stage A5d). */
export const ATTACK_RULE_TOOLTIP_KEYS = ['attack-roll', 'critical-hit', 'cover', 'weapon-mastery'] as const;

export type AttackRuleTooltipKey = (typeof ATTACK_RULE_TOOLTIP_KEYS)[number];

const ATTACK_RULE_TOOLTIPS: Record<AttackRuleTooltipKey, TooltipContent> = {
  'attack-roll': {
    title: 'Attack Roll',
    sections: [
      {
        label: 'Rule',
        text: 'Roll a d20 and add your attack bonus. The attack hits if the total equals or exceeds the target\u2019s Armor Class.',
      },
      {
        label: 'Bonus',
        text: 'Use Strength for melee weapons and Unarmed Strikes, Dexterity for ranged weapons. Finesse lets you choose. Add your Proficiency Bonus if you are proficient with the weapon.',
      },
      {
        label: '20 and 1',
        text: 'A natural 20 always hits and is a Critical Hit. A natural 1 always misses. This applies to attack rolls only, and is judged on the die, not the total.',
      },
      {
        label: 'Advantage and Disadvantage',
        text: 'They never stack, and any mix of the two cancels to a normal roll. This app suggests sources; you choose which apply.',
      },
      {
        label: 'This app',
        text: 'Exhaustion reduces the roll by 2 per level and is shown as its own line.',
      },
      { label: 'Source', text: 'PHB 2024 "Attack Rolls" (Docs/PlayersHandbook.md L432-492)' },
    ],
  },
  'critical-hit': {
    title: 'Critical Hit',
    sections: [
      {
        label: 'Rule',
        text: 'Roll all of the attack\u2019s damage dice twice and add them together, then add your modifiers as normal.',
      },
      {
        label: 'Modifiers',
        text: 'Ability modifiers and flat bonuses are added once, not doubled. A fixed damage amount with no dice stays the same.',
      },
      { label: 'Source', text: 'PHB 2024 "Critical Hits" (L1087-1100) and "Critical Hit" (L20857)' },
    ],
  },
  cover: {
    title: 'Cover',
    sections: [
      {
        label: 'Rule',
        text: 'Half Cover gives the target +2 to AC and Dexterity saving throws. Three-Quarters Cover gives +5. Total Cover means the target cannot be targeted directly.',
      },
      {
        label: 'No stacking',
        text: 'If the target has several kinds of cover, only the most protective degree applies. They are not added together.',
      },
      { label: 'Source', text: 'PHB 2024 "Cover" (L977-1000)' },
    ],
  },
  'weapon-mastery': {
    title: 'Weapon Mastery',
    sections: [
      {
        label: 'Rule',
        text: 'Every weapon has a mastery property, but you can use it only if a feature of yours unlocks it. Weapon Mastery lets you pick a number of weapon kinds and use their properties.',
      },
      {
        label: 'Who has it',
        text: 'Barbarians, Fighters, Paladins, Rangers and Rogues. Other classes have no Weapon Mastery, so every mastery stays locked.',
      },
      {
        label: 'This app',
        text: 'A mastery is usable only when your class unlocks it and you chose that weapon. Features from species, feats or subclasses that unlock masteries are not modelled.',
      },
      { label: 'Source', text: 'PHB 2024 "Mastery Properties" (L9351-9352)' },
    ],
  },
};

/**
 * Tooltip content for Attack Roll, Critical Hit, Cover or Weapon Mastery (short
 * PHB-cited paraphrases). Returns null for an unknown key.
 */
export function resolveAttackRuleTooltip(key: string): TooltipContent | null {
  return Object.hasOwn(ATTACK_RULE_TOOLTIPS, key) ? ATTACK_RULE_TOOLTIPS[key as AttackRuleTooltipKey] : null;
}

/** Why a Weapon Mastery chip is locked (Stage A5d, decision D8). */
const MASTERY_LOCK_TEXT: Record<string, string> = {
  'no-class': 'No class is selected, so no feature unlocks weapon masteries.',
  'no-feature': 'Your class has no Weapon Mastery feature. Only Barbarians, Fighters, Paladins, Rangers and Rogues have one.',
  'not-chosen': 'You have not chosen this weapon for Weapon Mastery. Pick it in your mastery list to unlock its property.',
  'not-eligible': 'Your class cannot use Weapon Mastery with this weapon (for example, Barbarians need a melee weapon and Rogues need one they are proficient with).',
  'over-cap': 'You have chosen more weapons than your level allows, so this one is past the limit. Remove another to use it.',
};

/**
 * Tooltip for a LOCKED Weapon Mastery chip, naming the reason (D8). Returns null for an
 * unknown reason.
 */
export function resolveMasteryLockedTooltip(reason: string): TooltipContent | null {
  if (!Object.hasOwn(MASTERY_LOCK_TEXT, reason)) return null;
  return {
    title: 'Weapon Mastery locked',
    sections: [
      { label: 'Why', text: MASTERY_LOCK_TEXT[reason] },
      {
        label: 'Rule',
        text: 'A mastery property is usable only by a character who has a feature, such as Weapon Mastery, that unlocks it.',
      },
      { label: 'Source', text: 'PHB 2024 "Mastery Properties" (L9351-9352)' },
    ],
  };
}

/** Human-readable category label for a feat tooltip. */
const FEAT_CATEGORY_LABEL: Record<FeatCategory, string> = {
  origin: 'Origin Feat',
  general: 'General Feat',
  'fighting-style': 'Fighting Style Feat',
  'epic-boon': 'Epic Boon Feat',
};

/** Format a feat's prerequisite as a single human-readable string, or null if none. */
function featPrerequisiteText(feat: ReturnType<typeof getFeat>): string | null {
  const prereq = feat?.prerequisite;
  if (!prereq) return null;
  const parts: string[] = [];
  if (prereq.minLevel !== undefined) parts.push(`Level ${prereq.minLevel}+`);
  if (prereq.abilityMin) {
    for (const ability of Object.keys(prereq.abilityMin) as Ability[]) {
      const min = prereq.abilityMin[ability];
      if (min !== undefined) parts.push(`${ABILITY_NAMES[ability]} ${min}+`);
    }
  }
  if (prereq.abilityAnyOf) {
    const names = prereq.abilityAnyOf.abilities.map((a) => ABILITY_NAMES[a]).join(' or ');
    parts.push(`${names} ${prereq.abilityAnyOf.min}+`);
  }
  if (prereq.armorTraining) {
    const kind = prereq.armorTraining;
    parts.push(kind === 'shield' ? 'Shield Training' : `${kind.charAt(0).toUpperCase()}${kind.slice(1)} Armor Training`);
  }
  if (prereq.spellcasting === 'spellcasting-or-pact-magic') parts.push('Spellcasting or Pact Magic feature');
  if (prereq.spellcasting === 'spellcasting') parts.push('Spellcasting feature');
  if (prereq.fightingStyleFeature) parts.push('Fighting Style feature');
  if (prereq.note) parts.push(prereq.note);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Tooltip content for a feat (Stage A6b), from the FEAT_CATALOG entry: its
 * category, prerequisite (when any), paraphrased benefit, and repeatable flag.
 * Returns null for an unknown feat id. PART 1 wires this to the data/feats.ts
 * shape; PART 2 backfills the catalog so more ids resolve with no change here.
 */
export function resolveFeatTooltip(featId: string): TooltipContent | null {
  const feat = getFeat(featId);
  if (!feat) return null;
  const sections: { label: string; text: string }[] = [
    { label: 'Category', text: FEAT_CATEGORY_LABEL[feat.category] },
  ];
  const prereq = featPrerequisiteText(feat);
  if (prereq) sections.push({ label: 'Prerequisite', text: prereq });
  sections.push({ label: 'Benefit', text: feat.effect });
  if (feat.repeatable) {
    sections.push({ label: 'Repeatable', text: 'You can take this feat more than once.' });
  }
  sections.push({ label: 'Source', text: feat.source });
  return { title: feat.name, sections };
}