/**
 * Fighter Battle Master maneuver catalog (D&D 5.5e / 2024).
 *
 * Source: PHB 2024 Fighter subclass Battle Master "Maneuver Options"
 * (Docs/PlayersHandbook.md L4265-L4309). `trigger` and `save` are transcribed
 * from the rules text; `summary` is paraphrased. Pinned by
 * data/__tests__/maneuvers-golden.ts + maneuvers-oracle.test.ts.
 */

export type ManeuverTrigger = 'hit' | 'miss' | 'ability-check' | 'bonus-action' | 'reaction' | 'attack-action' | 'turn';

export interface ManeuverData {
  id: string;
  name: string;
  /** When the maneuver can be used. */
  trigger: ManeuverTrigger;
  /** Ability of the saving throw the target makes, if any. */
  save?: 'str' | 'wis';
  /** Paraphrased description. */
  summary: string;
  source: string;
}

const man = (
  id: string,
  name: string,
  line: number,
  trigger: ManeuverTrigger,
  summary: string,
  save?: 'str' | 'wis',
): ManeuverData => ({
  id,
  name,
  trigger,
  ...(save ? { save } : {}),
  summary,
  source: `PHB 2024 Battle Master "${name}" (L${line})`,
});

const LIST: ManeuverData[] = [
  man('ambush', 'Ambush', 4269, 'ability-check', 'Add a Superiority Die to a Dexterity (Stealth) check or Initiative roll unless Incapacitated.'),
  man('bait-and-switch', 'Bait and Switch', 4271, 'turn', 'Swap places with a willing creature within 5 feet without provoking; you or it gains an AC bonus equal to the die roll until your next turn.'),
  man('commanders-strike', "Commander's Strike", 4275, 'attack-action', 'Give up one attack so a companion uses its Reaction to attack, adding the die to the damage.'),
  man('commanding-presence', 'Commanding Presence', 4277, 'ability-check', 'Add a Superiority Die to a Charisma (Intimidation, Performance or Persuasion) check.'),
  man('disarming-attack', 'Disarming Attack', 4279, 'hit', 'Add the die to damage; the target must make a Strength save or drop an object you choose.', 'str'),
  man('distracting-strike', 'Distracting Strike', 4281, 'hit', 'Add the die to damage; the next attack on the target by someone else before your next turn has Advantage.'),
  man('evasive-footwork', 'Evasive Footwork', 4283, 'bonus-action', 'Take Disengage as a Bonus Action and add the die roll to your AC until your next turn.'),
  man('feinting-attack', 'Feinting Attack', 4285, 'bonus-action', 'Feint against a creature within 5 feet to gain Advantage on your next attack against it this turn, adding the die to damage on a hit.'),
  man('goading-attack', 'Goading Attack', 4287, 'hit', 'Add the die to damage; the target must make a Wisdom save or have Disadvantage on attacks against anyone but you until the end of your next turn.', 'wis'),
  man('lunging-attack', 'Lunging Attack', 4289, 'bonus-action', 'Take Dash as a Bonus Action; add the die to melee damage if you moved 5+ feet in a straight line first.'),
  man('maneuvering-attack', 'Maneuvering Attack', 4291, 'hit', 'Add the die to damage and let a friendly creature use its Reaction to move half its Speed without provoking from the target.'),
  man('menacing-attack', 'Menacing Attack', 4293, 'hit', 'Add the die to damage; the target must make a Wisdom save or be Frightened until the end of your next turn.', 'wis'),
  man('parry', 'Parry', 4295, 'reaction', 'Reduce melee damage against you by the die roll plus your Strength or Dexterity modifier.'),
  man('precision-attack', 'Precision Attack', 4297, 'miss', 'Add the die to a missed attack roll, possibly turning it into a hit.'),
  man('pushing-attack', 'Pushing Attack', 4299, 'hit', 'Add the die to damage; a Large or smaller target must make a Strength save or be pushed up to 15 feet.', 'str'),
  man('rally', 'Rally', 4301, 'bonus-action', 'An ally within 30 feet gains Temporary Hit Points equal to the die roll plus half your Fighter level.'),
  man('riposte', 'Riposte', 4303, 'reaction', 'When a creature misses you in melee, make a melee attack against it and add the die to damage on a hit.'),
  man('sweeping-attack', 'Sweeping Attack', 4305, 'hit', 'Deal the die roll as damage to a second creature near the target if the original attack roll would hit it.'),
  man('tactical-assessment', 'Tactical Assessment', 4307, 'ability-check', 'Add the die to an Intelligence (History or Investigation) or Wisdom (Insight) check.'),
  man('trip-attack', 'Trip Attack', 4309, 'hit', 'Add the die to damage; a Large or smaller target must make a Strength save or fall Prone.', 'str'),
];

export const MANEUVER_CATALOG: Record<string, ManeuverData> = Object.fromEntries(LIST.map((m) => [m.id, m]));
export type ManeuverId = keyof typeof MANEUVER_CATALOG;
export const MANEUVER_LIST: ManeuverData[] = LIST;

export function getManeuver(id: string): ManeuverData | undefined {
  return MANEUVER_CATALOG[id];
}
