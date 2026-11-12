/**
 * The Combat page's quick rules: a searchable list of the rules a player looks up
 * mid-fight. Most entries reuse the app's existing, already-cited rules tooltips
 * (turn, attack, hit point and rest rules, conditions, weapon properties and
 * masteries), so the wording matches every other tooltip in the app. A few entries
 * that had no tooltip yet are paraphrased here from the PHB 2024, each with its
 * line citation (rules-compliance rules 5 and 6). Nothing here changes a rule.
 */

import type { TooltipContent } from './tooltip-content';
import {
  ATTACK_RULE_TOOLTIP_KEYS,
  HP_RULE_TOOLTIP_KEYS,
  REST_RULE_TOOLTIP_KEYS,
  TURN_RULE_TOOLTIP_KEYS,
  resolveAttackRuleTooltip,
  resolveConditionTooltip,
  resolveHitPointRuleTooltip,
  resolveRestRuleTooltip,
  resolveTurnRuleTooltip,
  resolveWeaponMasteryTooltip,
  resolveWeaponPropertyTooltip,
} from './tooltip-content';
import { CONDITIONS } from '../data/conditions';
import type { MasteryProperty, WeaponProperty } from '../data/weapons';
import { WEAPON_MASTERY_TEXT, WEAPON_PROPERTY_TEXT } from '../data/weapons';

export type QuickRuleGroup = 'Combat' | 'Attacks' | 'Movement' | 'Hit points and rests' | 'Conditions' | 'Weapons';

export const QUICK_RULE_GROUPS: readonly QuickRuleGroup[] = [
  'Combat',
  'Attacks',
  'Movement',
  'Hit points and rests',
  'Conditions',
  'Weapons',
];

export interface QuickRule {
  id: string;
  group: QuickRuleGroup;
  content: TooltipContent;
}

const PHB = 'Docs/PlayersHandbook.md';

/** Rules with no tooltip elsewhere in the app, paraphrased from the PHB 2024. */
const EXTRA: QuickRule[] = [
  {
    id: 'opportunity-attack',
    group: 'Combat',
    content: {
      title: 'Opportunity Attack',
      sections: [
        {
          label: 'Rule',
          text: 'When a creature you can see leaves your reach, you can take your Reaction to make one melee attack (a weapon or an Unarmed Strike) against it, right before it leaves.',
        },
        {
          label: 'Avoiding one',
          text: "Taking the Disengage action avoids it. So does teleporting, or being moved without using your movement, action, Bonus Action or Reaction (for example being thrown by an explosion).",
        },
        { label: 'Source', text: `PHB 2024 "Opportunity Attacks" (${PHB} L1023-1029, L21340-21342)` },
      ],
    },
  },
  {
    id: 'unseen',
    group: 'Attacks',
    content: {
      title: 'Unseen Attackers and Targets',
      sections: [
        { label: "Target you can't see", text: "Disadvantage on the attack roll. If the target isn't where you aimed, you miss." },
        { label: "Target can't see you", text: 'Advantage on attack rolls against it.' },
        { label: 'Hidden', text: 'Attacking gives away your location, hit or miss.' },
        { label: 'Source', text: `PHB 2024 "Unseen Attackers and Targets" (${PHB} L983-987)` },
      ],
    },
  },
  {
    id: 'range',
    group: 'Attacks',
    content: {
      title: 'Ranged Attacks',
      sections: [
        {
          label: 'Range',
          text: 'With two ranges (for example a Longbow), attacks past the normal range have Disadvantage, and you cannot attack past the long range.',
        },
        {
          label: 'In close combat',
          text: "A ranged attack roll has Disadvantage while you are within 5 feet of an enemy who can see you and isn't Incapacitated.",
        },
        { label: 'Source', text: `PHB 2024 "Range" and "Ranged Attacks in Close Combat" (${PHB} L1005-1013)` },
      ],
    },
  },
  {
    id: 'unarmed-strike',
    group: 'Attacks',
    content: {
      title: 'Unarmed Strike: Damage, Grapple or Shove',
      sections: [
        { label: 'Damage', text: 'Attack roll with Strength modifier + Proficiency Bonus. On a hit: 1 + Strength modifier Bludgeoning damage.' },
        {
          label: 'Grapple',
          text: 'The target makes a Strength or Dexterity save (its choice) against 8 + your Strength modifier + Proficiency Bonus, or has the Grappled condition. It must be no more than one size larger than you, and you need a free hand.',
        },
        {
          label: 'Shove',
          text: 'Same save and DC; on a failure you push it 5 feet away or knock it Prone. It must be no more than one size larger than you.',
        },
        { label: 'Source', text: `PHB 2024 "Unarmed Strike" (${PHB} L21683-21690)` },
      ],
    },
  },
  {
    id: 'help',
    group: 'Combat',
    content: {
      title: 'Help [Action]',
      sections: [
        {
          label: 'Ability check',
          text: 'Pick one of your skill or tool proficiencies and an ally near enough to help: their next check with it has Advantage. Lost if not used before your next turn starts.',
        },
        {
          label: 'Attack roll',
          text: 'Distract an enemy within 5 feet: the next attack roll by one of your allies against it has Advantage. Lost when your next turn starts.',
        },
        { label: 'Source', text: `PHB 2024 "Help [Action]" (${PHB} L21110-21116)` },
      ],
    },
  },
  {
    id: 'hide',
    group: 'Combat',
    content: {
      title: 'Hide [Action]',
      sections: [
        {
          label: 'Rule',
          text: "Make a DC 15 Dexterity (Stealth) check while Heavily Obscured or behind Three-Quarters or Total Cover, and out of every enemy's line of sight.",
        },
        {
          label: 'On a success',
          text: 'You have the Invisible condition. Your check total is the DC for a Wisdom (Perception) check to find you.',
        },
        {
          label: 'It ends when',
          text: 'You make a sound louder than a whisper, an enemy finds you, you make an attack roll, or you cast a spell with a Verbal component.',
        },
        { label: 'Source', text: `PHB 2024 "Hide [Action]" (${PHB} L21126-21132)` },
      ],
    },
  },
  {
    id: 'difficult-terrain',
    group: 'Movement',
    content: {
      title: 'Difficult Terrain',
      sections: [
        { label: 'Rule', text: 'Every foot of movement in it costs 1 extra foot (5 feet costs 10). It does not stack.' },
        {
          label: 'Examples',
          text: "A creature that isn't Tiny or your ally, furniture your size or larger, heavy snow, ice, rubble or undergrowth.",
        },
        { label: 'Source', text: `PHB 2024 "Difficult Terrain" (${PHB} L20967-20973)` },
      ],
    },
  },
  {
    id: 'break-up-move',
    group: 'Movement',
    content: {
      title: 'Breaking Up Your Move',
      sections: [
        {
          label: 'Rule',
          text: 'You can split your movement around your action, Bonus Action or Reaction: with a Speed of 30 feet, move 10, act, then move 20.',
        },
        { label: 'Dropping Prone', text: "Going Prone on your turn costs no action or Speed (not possible while your Speed is 0)." },
        { label: 'Source', text: `PHB 2024 "Breaking Up Your Move" and "Dropping Prone" (${PHB} L936-942)` },
      ],
    },
  },
  {
    id: 'falling',
    group: 'Movement',
    content: {
      title: 'Falling',
      sections: [
        {
          label: 'Rule',
          text: '1d6 Bludgeoning damage for every 10 feet fallen (at most 20d6), and you land Prone unless you take no damage.',
        },
        {
          label: 'Into water',
          text: 'Use your Reaction for a DC 15 Strength (Athletics) or Dexterity (Acrobatics) check to enter feet or head first; on a success the damage is halved.',
        },
        { label: 'Source', text: `PHB 2024 "Falling [Hazard]" (${PHB} L21044-21046)` },
      ],
    },
  },
];

function collect(): QuickRule[] {
  const out: QuickRule[] = [];
  const push = (id: string, group: QuickRuleGroup, content: TooltipContent | null) => {
    if (content) out.push({ id, group, content });
  };
  for (const k of TURN_RULE_TOOLTIP_KEYS) push(`turn:${k}`, 'Combat', resolveTurnRuleTooltip(k));
  for (const k of ATTACK_RULE_TOOLTIP_KEYS) push(`attack:${k}`, 'Attacks', resolveAttackRuleTooltip(k));
  for (const k of HP_RULE_TOOLTIP_KEYS) push(`hp:${k}`, 'Hit points and rests', resolveHitPointRuleTooltip(k));
  for (const k of REST_RULE_TOOLTIP_KEYS) push(`rest:${k}`, 'Hit points and rests', resolveRestRuleTooltip(k));
  for (const c of CONDITIONS) push(`condition:${c.id}`, 'Conditions', resolveConditionTooltip(c.id));
  for (const p of Object.keys(WEAPON_PROPERTY_TEXT) as WeaponProperty[]) {
    push(`property:${p}`, 'Weapons', resolveWeaponPropertyTooltip(p));
  }
  for (const m of Object.keys(WEAPON_MASTERY_TEXT) as MasteryProperty[]) {
    push(`mastery:${m}`, 'Weapons', resolveWeaponMasteryTooltip(m));
  }
  out.push(...EXTRA);
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

let cache: QuickRule[] | undefined;

/** Every quick rule, grouped in QUICK_RULE_GROUPS order, alphabetical by title within a group. */
export function quickRules(): QuickRule[] {
  if (!cache) {
    cache = collect().sort(
      (a, b) =>
        QUICK_RULE_GROUPS.indexOf(a.group) - QUICK_RULE_GROUPS.indexOf(b.group) ||
        a.content.title.localeCompare(b.content.title),
    );
  }
  return cache;
}

/** Rules whose title or text contains every word of the query (case-insensitive). */
export function searchQuickRules(query: string, rules: readonly QuickRule[] = quickRules()): QuickRule[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rules];
  return rules.filter((r) => {
    const hay = `${r.content.title} ${r.content.sections.map((s) => `${s.label} ${s.text}`).join(' ')}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
