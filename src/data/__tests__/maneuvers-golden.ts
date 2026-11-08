/**
 * GOLDEN FIXTURE for the Fighter Battle Master maneuver catalog (Stage 3).
 *
 * Authored ONLY from the PHB 2024 (Docs/PlayersHandbook.md, Fighter subclass
 * Battle Master "COMBAT SUPERIORITY" L4235-L4243 and "MANEUVER OPTIONS"
 * L4265-L4309). Independent of src/data/maneuvers.ts: nothing is imported from
 * the app.
 *
 * LINE NUMBERS are 1-based lines of the option's paragraph as counted by
 * PowerShell `Get-Content`.
 *
 * Cardinality: exactly 20 maneuvers. None has a point cost (each expends one
 * Superiority Die). Counts known: 3 at Fighter level 3, +2 at levels 7, 10 and
 * 15 (L4235-L4237): 3 / 5 / 7 / 9.
 *
 * `trigger` says when the PHB text lets the maneuver be used:
 *  - 'hit' = when you hit a creature with an attack roll
 *  - 'miss' = when you miss with an attack roll
 *  - 'ability-check' = when you make an ability check / Initiative roll
 *  - 'bonus-action' = used as a Bonus Action
 *  - 'reaction' = used as a Reaction
 *  - 'attack-action' = in place of an attack when you take the Attack action
 *  - 'turn' = when you are within 5 feet of a creature on your turn
 * `save` is the ability of the saving throw the TARGET makes, if any.
 */
export type GoldenManeuverTrigger =
  | 'hit'
  | 'miss'
  | 'ability-check'
  | 'bonus-action'
  | 'reaction'
  | 'attack-action'
  | 'turn';

export interface GoldenManeuver {
  id: string;
  name: string;
  trigger: GoldenManeuverTrigger;
  save?: 'str' | 'wis';
  line: number;
}

export const GOLDEN_MANEUVER_COUNT = 20;

/** [fighterLevel, cumulativeManeuvers] for Battle Master (L4235-L4237). */
export const GOLDEN_MANEUVER_OWED_STEPS: ReadonlyArray<readonly [level: number, owed: number]> = [
  [3, 3],
  [7, 5],
  [10, 7],
  [15, 9],
];

const m = (
  id: string,
  name: string,
  line: number,
  trigger: GoldenManeuverTrigger,
  save?: 'str' | 'wis',
): GoldenManeuver => (save ? { id, name, line, trigger, save } : { id, name, line, trigger });

export const MANEUVERS_GOLDEN: readonly GoldenManeuver[] = [
  m('ambush', 'Ambush', 4269, 'ability-check'),
  m('bait-and-switch', 'Bait and Switch', 4271, 'turn'),
  m('commanders-strike', "Commander's Strike", 4275, 'attack-action'),
  m('commanding-presence', 'Commanding Presence', 4277, 'ability-check'),
  m('disarming-attack', 'Disarming Attack', 4279, 'hit', 'str'),
  m('distracting-strike', 'Distracting Strike', 4281, 'hit'),
  m('evasive-footwork', 'Evasive Footwork', 4283, 'bonus-action'),
  m('feinting-attack', 'Feinting Attack', 4285, 'bonus-action'),
  m('goading-attack', 'Goading Attack', 4287, 'hit', 'wis'),
  m('lunging-attack', 'Lunging Attack', 4289, 'bonus-action'),
  m('maneuvering-attack', 'Maneuvering Attack', 4291, 'hit'),
  m('menacing-attack', 'Menacing Attack', 4293, 'hit', 'wis'),
  m('parry', 'Parry', 4295, 'reaction'),
  m('precision-attack', 'Precision Attack', 4297, 'miss'),
  m('pushing-attack', 'Pushing Attack', 4299, 'hit', 'str'),
  m('rally', 'Rally', 4301, 'bonus-action'),
  m('riposte', 'Riposte', 4303, 'reaction'),
  m('sweeping-attack', 'Sweeping Attack', 4305, 'hit'),
  m('tactical-assessment', 'Tactical Assessment', 4307, 'ability-check'),
  m('trip-attack', 'Trip Attack', 4309, 'hit', 'str'),
];
