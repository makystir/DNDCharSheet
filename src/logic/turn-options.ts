/**
 * What a character can do on a turn, for the Combat page reference.
 *
 * STANDARD ACTIONS: the PHB 2024 Actions table (Docs/PlayersHandbook.md L590-605),
 * paraphrased. Every creature can take these.
 * BONUS ACTIONS: you have one only when a feature, spell or other ability says so
 * (PHB 2024 "Bonus Actions", L617-623). Listed here: the prepared spells and
 * cantrips whose casting time is a Bonus Action. Class features that use a Bonus
 * Action are not tagged in the class data yet, so they are not listed (never
 * guessed from effect text).
 * REACTIONS: logic/reactions.ts `availableReactions` (Opportunity Attack, tagged
 * features, feats, reaction spells).
 */

import type { Character } from '../types/character';
import { getSpell } from '../data/spells';
import { knownSpellsByClass } from './known-spells';

export interface StandardAction {
  name: string;
  summary: string;
}

/** PHB 2024 "Actions" table (L590-605), in printed order, paraphrased. */
export const STANDARD_ACTIONS: readonly StandardAction[] = [
  { name: 'Attack', summary: 'Attack with a weapon or an Unarmed Strike.' },
  { name: 'Dash', summary: 'Gain extra movement equal to your Speed for the rest of the turn.' },
  { name: 'Disengage', summary: "Your movement doesn't provoke Opportunity Attacks for the rest of the turn." },
  {
    name: 'Dodge',
    summary:
      'Until your next turn starts, attacks against you have Disadvantage and you make Dexterity saves with Advantage. Lost if you are Incapacitated or your Speed is 0.',
  },
  { name: 'Help', summary: "Help another creature's ability check or attack roll, or give first aid." },
  { name: 'Hide', summary: 'Make a Dexterity (Stealth) check.' },
  {
    name: 'Influence',
    summary:
      "Make a Charisma (Deception, Intimidation, Performance or Persuasion) or Wisdom (Animal Handling) check to change a creature's attitude.",
  },
  { name: 'Magic', summary: 'Cast a spell, use a magic item, or use a magical feature.' },
  { name: 'Ready', summary: 'Prepare to take an action in response to a trigger you choose.' },
  { name: 'Search', summary: 'Make a Wisdom (Insight, Medicine, Perception or Survival) check.' },
  { name: 'Study', summary: 'Make an Intelligence (Arcana, History, Investigation, Nature or Religion) check.' },
  { name: 'Utilize', summary: 'Use a nonmagical object.' },
];

export const STANDARD_ACTIONS_SOURCE = 'PHB 2024 "Actions" table (Docs/PlayersHandbook.md L590-605)';

export interface BonusActionSpell {
  id: string;
  name: string;
  level: number;
  /** The casting time as printed, e.g. "Bonus Action, which you take immediately after...". */
  castingTime: string;
  className: string;
}

/** Known cantrips and prepared spells with a Bonus Action casting time, cantrips first. */
export function bonusActionSpells(character: Character): BonusActionSpell[] {
  const out: BonusActionSpell[] = [];
  const seen = new Set<string>();
  for (const k of knownSpellsByClass(character)) {
    for (const id of [...k.cantrips, ...k.prepared]) {
      const spell = getSpell(id);
      if (!spell || seen.has(id) || !/^Bonus Action/i.test(spell.castingTime)) continue;
      seen.add(id);
      out.push({ id, name: spell.name, level: spell.level, castingTime: spell.castingTime, className: k.className });
    }
  }
  return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}
