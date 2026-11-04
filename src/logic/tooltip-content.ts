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
