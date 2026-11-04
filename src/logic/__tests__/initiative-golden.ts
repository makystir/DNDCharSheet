/**
 * GOLDEN TABLE for Stage A5c: Initiative, turn order, and the action economy.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 text
 * (Docs/PlayersHandbook.md) BEFORE the logic is implemented. The implementer
 * must make the real functions reproduce every row and MUST NOT edit this file.
 * If a row looks wrong, flag it in the summary instead of changing it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. A harness in
 * the implementer's tests maps each row to the real API.
 *
 * Sources (PHB 2024 section headings / approximate lines):
 *  - "Initiative" (~L870-883): everyone makes a Dexterity check; a surprised
 *    combatant has Disadvantage on the roll; the check total is the Initiative
 *    count; order is highest to lowest and stays the same every round; on a tie
 *    the players decide among tied characters, the DM among tied monsters, and
 *    the DM decides a monster-versus-character tie. There is NO surprise round.
 *  - Invisible [Condition] (~L21261): Advantage on the Initiative roll.
 *  - Incapacitated [Condition] (~L21184): Disadvantage on the Initiative roll, and
 *    you can't take any action, Bonus Action, or Reaction.
 *  - Advantage/Disadvantage (~L472-492): they never stack, and any mix of the two
 *    cancels to neither, even with unequal numbers of sources.
 *  - Exhaustion (decision D1): a D20 Test roll is reduced by 2 x Exhaustion level.
 *    Initiative is a Dexterity check, so it is a D20 Test.
 *  - "Your Turn" (~L885): move up to your Speed and take one action, in either order;
 *    one free object interaction per turn, a second needs the Utilize action.
 *  - Bonus Action (~L20695): at most one per turn. Reaction (~L21414): once taken, no
 *    other Reaction until the START of your next turn. Dash: extra movement equal to
 *    your Speed for the rest of the turn.
 *
 * CONVENTIONS (orchestrator-approved; NOT stated by the PHB):
 *  - The turn tracker is ADVISORY ("guidance, never gate"): using something a second
 *    time (a feature such as Action Surge can legitimately grant it) records a
 *    WARNING but still updates the state. Warnings never block.
 *  - Removing or adding a combatant mid-combat keeps the active turn pointing at the
 *    same combatant. Removing the ACTIVE combatant makes the next combatant active
 *    (index stays; wraps to 0 past the end WITHOUT incrementing the round).
 *  - Combatant ties are NEVER auto-broken: a stable descending sort keeps insertion
 *    order, and the user reorders manually within a tie group only.
 */

// ─── Initiative roll mode ────────────────────────────────────────────────────
export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export interface InitiativeModeCase {
  name: string;
  cite: string;
  input: {
    /** Stored condition ids (implied conditions are NOT pre-expanded). */
    storedConditions: string[];
    max: number;
    hp: number;
    /** The user marks the combatant as surprised by the start of combat. */
    surprised?: boolean;
    /** Manual sources (feats and features are not modelled). */
    manualAdvantage?: boolean;
    manualDisadvantage?: boolean;
  };
  expect: {
    mode: RollMode;
    /** Source names, for the tooltip. Compare as SETS. */
    advantageFrom: string[];
    disadvantageFrom: string[];
  };
}

export const INITIATIVE_MODE_CASES: InitiativeModeCase[] = [
  { name: 'Nothing applies: normal', cite: 'Initiative', input: { storedConditions: [], max: 20, hp: 20 }, expect: { mode: 'normal', advantageFrom: [], disadvantageFrom: [] } },
  { name: 'Surprised: Disadvantage', cite: 'Initiative: Surprise', input: { storedConditions: [], max: 20, hp: 20, surprised: true }, expect: { mode: 'disadvantage', advantageFrom: [], disadvantageFrom: ['surprised'] } },
  { name: 'Stored Incapacitated: Disadvantage', cite: 'Incapacitated: Surprised', input: { storedConditions: ['incapacitated'], max: 20, hp: 20 }, expect: { mode: 'disadvantage', advantageFrom: [], disadvantageFrom: ['incapacitated'] } },
  { name: 'Paralyzed implies Incapacitated: Disadvantage', cite: 'Paralyzed + Incapacitated', input: { storedConditions: ['paralyzed'], max: 20, hp: 20 }, expect: { mode: 'disadvantage', advantageFrom: [], disadvantageFrom: ['incapacitated'] } },
  { name: 'Stunned implies Incapacitated: Disadvantage', cite: 'Stunned + Incapacitated', input: { storedConditions: ['stunned'], max: 20, hp: 20 }, expect: { mode: 'disadvantage', advantageFrom: [], disadvantageFrom: ['incapacitated'] } },
  { name: 'Knocked out (stored Unconscious) implies Incapacitated: Disadvantage', cite: 'Unconscious + Incapacitated', input: { storedConditions: ['unconscious'], max: 20, hp: 1 }, expect: { mode: 'disadvantage', advantageFrom: [], disadvantageFrom: ['incapacitated'] } },
  { name: 'At 0 HP the derived Unconscious (decision D2) implies Incapacitated: Disadvantage', cite: 'Falling Unconscious + Incapacitated', input: { storedConditions: [], max: 20, hp: 0 }, expect: { mode: 'disadvantage', advantageFrom: [], disadvantageFrom: ['incapacitated'] } },
  { name: 'Prone does not affect Initiative', cite: 'Prone [Condition]', input: { storedConditions: ['prone'], max: 20, hp: 20 }, expect: { mode: 'normal', advantageFrom: [], disadvantageFrom: [] } },
  { name: 'Invisible: Advantage', cite: 'Invisible: Surprise', input: { storedConditions: ['invisible'], max: 20, hp: 20 }, expect: { mode: 'advantage', advantageFrom: ['invisible'], disadvantageFrom: [] } },
  { name: 'Surprised and Incapacitated do not stack: still just Disadvantage', cite: 'Advantage/Disadvantage: They Don\'t Stack', input: { storedConditions: ['incapacitated'], max: 20, hp: 20, surprised: true }, expect: { mode: 'disadvantage', advantageFrom: [], disadvantageFrom: ['surprised', 'incapacitated'] } },
  { name: 'Invisible and Surprised cancel to normal', cite: 'Advantage/Disadvantage: any mix cancels', input: { storedConditions: ['invisible'], max: 20, hp: 20, surprised: true }, expect: { mode: 'normal', advantageFrom: ['invisible'], disadvantageFrom: ['surprised'] } },
  { name: 'Invisible and Incapacitated cancel to normal', cite: 'Advantage/Disadvantage: any mix cancels', input: { storedConditions: ['invisible', 'incapacitated'], max: 20, hp: 20 }, expect: { mode: 'normal', advantageFrom: ['invisible'], disadvantageFrom: ['incapacitated'] } },
  { name: 'One Advantage cancels even several Disadvantages', cite: 'Advantage/Disadvantage: even with unequal numbers of sources', input: { storedConditions: ['invisible', 'incapacitated'], max: 20, hp: 20, surprised: true }, expect: { mode: 'normal', advantageFrom: ['invisible'], disadvantageFrom: ['surprised', 'incapacitated'] } },
  { name: 'A manual Advantage source gives Advantage', cite: 'Advantage/Disadvantage', input: { storedConditions: [], max: 20, hp: 20, manualAdvantage: true }, expect: { mode: 'advantage', advantageFrom: ['manual'], disadvantageFrom: [] } },
  { name: 'A manual Advantage cancels Surprised', cite: 'Advantage/Disadvantage', input: { storedConditions: [], max: 20, hp: 20, surprised: true, manualAdvantage: true }, expect: { mode: 'normal', advantageFrom: ['manual'], disadvantageFrom: ['surprised'] } },
  { name: 'A manual Disadvantage source gives Disadvantage', cite: 'Advantage/Disadvantage', input: { storedConditions: [], max: 20, hp: 20, manualDisadvantage: true }, expect: { mode: 'disadvantage', advantageFrom: [], disadvantageFrom: ['manual'] } },
];

// ─── Initiative roll total ───────────────────────────────────────────────────
export interface InitiativeRollCase {
  name: string;
  cite: string;
  mode: RollMode;
  /** The d20 face(s) drawn: one for normal, two for advantage / disadvantage. */
  faces: number[];
  /** Initiative modifier before the roll (Dexterity modifier plus any bonus). */
  bonus: number;
  /** Exhaustion level; the roll is reduced by 2 x level (decision D1). */
  exhaustion: number;
  expect: { used: number; total: number };
}

export const INITIATIVE_ROLL_CASES: InitiativeRollCase[] = [
  { name: 'Normal: d20 12 + 3', cite: 'Initiative: a Dexterity check', mode: 'normal', faces: [12], bonus: 3, exhaustion: 0, expect: { used: 12, total: 15 } },
  { name: 'Advantage keeps the higher face (4, 17) + 2', cite: 'Advantage', mode: 'advantage', faces: [4, 17], bonus: 2, exhaustion: 0, expect: { used: 17, total: 19 } },
  { name: 'Disadvantage keeps the lower face (4, 17) + 2', cite: 'Disadvantage', mode: 'disadvantage', faces: [4, 17], bonus: 2, exhaustion: 0, expect: { used: 4, total: 6 } },
  { name: 'Exhaustion 2 (-4) reduces the roll: 10 + 3 - 4 = 9', cite: 'Exhaustion: D20 Tests Affected', mode: 'normal', faces: [10], bonus: 3, exhaustion: 2, expect: { used: 10, total: 9 } },
  { name: 'A negative modifier is allowed: d20 5 + (-1) = 4', cite: 'Initiative', mode: 'normal', faces: [5], bonus: -1, exhaustion: 0, expect: { used: 5, total: 4 } },
  { name: 'A natural 20 on a Dexterity check has no special effect: 20 + (-5) = 15', cite: 'Rolling 20 or 1 (attack rolls only)', mode: 'normal', faces: [20], bonus: -5, exhaustion: 0, expect: { used: 20, total: 15 } },
  { name: 'Advantage with Exhaustion 1: higher face 14, +4, -2 = 16', cite: 'Advantage + Exhaustion', mode: 'advantage', faces: [14, 6], bonus: 4, exhaustion: 1, expect: { used: 14, total: 16 } },
];

// ─── Initiative order ────────────────────────────────────────────────────────
export interface Combatant {
  id: string;
  initiative: number;
}

export interface SortCase {
  name: string;
  cite: string;
  input: Combatant[];
  /** Expected ids, highest Initiative first; ties keep INSERTION order (stable sort). */
  expectIds: string[];
}

export const SORT_CASES: SortCase[] = [
  { name: 'Highest first', cite: 'Initiative Order', input: [{ id: 'a', initiative: 10 }, { id: 'b', initiative: 15 }, { id: 'c', initiative: 3 }], expectIds: ['b', 'a', 'c'] },
  { name: 'A tie keeps insertion order (players decide, so no automatic tiebreak)', cite: 'Initiative: Ties', input: [{ id: 'a', initiative: 10 }, { id: 'b', initiative: 15 }, { id: 'c', initiative: 10 }], expectIds: ['b', 'a', 'c'] },
  { name: 'All tied keeps the given order', cite: 'Initiative: Ties', input: [{ id: 'x', initiative: 8 }, { id: 'y', initiative: 8 }, { id: 'z', initiative: 8 }], expectIds: ['x', 'y', 'z'] },
  { name: 'Negative Initiative sorts below positive', cite: 'Initiative Order', input: [{ id: 'a', initiative: -1 }, { id: 'b', initiative: 3 }, { id: 'c', initiative: 0 }], expectIds: ['b', 'c', 'a'] },
  { name: 'Empty roster', cite: 'Initiative Order', input: [], expectIds: [] },
];

export interface TieMoveCase {
  name: string;
  cite: string;
  /** Roster already in Initiative order. */
  input: Combatant[];
  moveId: string;
  direction: 'up' | 'down';
  /** Expected ids after the move; unchanged when the move would cross a different Initiative. */
  expectIds: string[];
}

export const TIE_MOVE_CASES: TieMoveCase[] = [
  { name: 'Move the last of three tied combatants up', cite: 'Initiative: Ties (players decide)', input: [{ id: 'a', initiative: 12 }, { id: 'b', initiative: 12 }, { id: 'c', initiative: 12 }], moveId: 'c', direction: 'up', expectIds: ['a', 'c', 'b'] },
  { name: 'Move the first of three tied combatants down', cite: 'Initiative: Ties (players decide)', input: [{ id: 'a', initiative: 12 }, { id: 'b', initiative: 12 }, { id: 'c', initiative: 12 }], moveId: 'a', direction: 'down', expectIds: ['b', 'a', 'c'] },
  { name: 'Cannot move up across a different Initiative', cite: 'Initiative Order (only ties are reorderable)', input: [{ id: 'x', initiative: 15 }, { id: 'a', initiative: 12 }, { id: 'b', initiative: 12 }], moveId: 'a', direction: 'up', expectIds: ['x', 'a', 'b'] },
  { name: 'Cannot move down across a different Initiative', cite: 'Initiative Order (only ties are reorderable)', input: [{ id: 'a', initiative: 12 }, { id: 'b', initiative: 12 }, { id: 'y', initiative: 5 }], moveId: 'b', direction: 'down', expectIds: ['a', 'b', 'y'] },
  { name: 'A combatant with a unique Initiative cannot move', cite: 'Initiative Order', input: [{ id: 'a', initiative: 15 }, { id: 'b', initiative: 10 }], moveId: 'a', direction: 'down', expectIds: ['a', 'b'] },
  { name: 'Unknown id leaves the order untouched', cite: 'Initiative Order', input: [{ id: 'a', initiative: 12 }, { id: 'b', initiative: 12 }], moveId: 'zzz', direction: 'up', expectIds: ['a', 'b'] },
];

// ─── Turn advance ────────────────────────────────────────────────────────────
export interface TurnAdvanceCase {
  name: string;
  cite: string;
  direction: 'next' | 'previous';
  before: { activeIndex: number; count: number; round: number };
  after: { activeIndex: number; round: number };
}

export const TURN_ADVANCE_CASES: TurnAdvanceCase[] = [
  { name: 'Next within the round', cite: 'Take Turns', direction: 'next', before: { activeIndex: 0, count: 3, round: 1 }, after: { activeIndex: 1, round: 1 } },
  { name: 'Next from the last combatant starts the next round', cite: 'Take Turns: when everyone has had a turn, the round ends', direction: 'next', before: { activeIndex: 2, count: 3, round: 1 }, after: { activeIndex: 0, round: 2 } },
  { name: 'A single combatant starts a new round every turn', cite: 'Take Turns', direction: 'next', before: { activeIndex: 0, count: 1, round: 4 }, after: { activeIndex: 0, round: 5 } },
  { name: 'Empty roster: nothing changes', cite: 'Take Turns', direction: 'next', before: { activeIndex: 0, count: 0, round: 1 }, after: { activeIndex: 0, round: 1 } },
  { name: 'Previous within the round', cite: 'Take Turns (undo a mis-click)', direction: 'previous', before: { activeIndex: 1, count: 3, round: 1 }, after: { activeIndex: 0, round: 1 } },
  { name: 'Previous from the first combatant goes back a round', cite: 'Take Turns (undo a mis-click)', direction: 'previous', before: { activeIndex: 0, count: 3, round: 2 }, after: { activeIndex: 2, round: 1 } },
  { name: 'Cannot go back before round 1', cite: 'Take Turns', direction: 'previous', before: { activeIndex: 0, count: 3, round: 1 }, after: { activeIndex: 0, round: 1 } },
];

// ─── Roster edits keep the active turn on the same combatant ─────────────────
export interface RosterEditCase {
  name: string;
  interpretation: string;
  /** Roster already in Initiative order. */
  roster: Combatant[];
  activeIndex: number;
  round: number;
  edit: { kind: 'add'; combatant: Combatant } | { kind: 'remove'; id: string };
  expect: { ids: string[]; activeIndex: number; round: number };
}

const APP_RULE = 'App behavior, not a PHB rule (see the CONVENTIONS in the header).';

export const ROSTER_EDIT_CASES: RosterEditCase[] = [
  { name: 'Add one that sorts BEFORE the active combatant: active index shifts', interpretation: APP_RULE, roster: [{ id: 'a', initiative: 15 }, { id: 'b', initiative: 10 }], activeIndex: 1, round: 2, edit: { kind: 'add', combatant: { id: 'c', initiative: 20 } }, expect: { ids: ['c', 'a', 'b'], activeIndex: 2, round: 2 } },
  { name: 'Add one that sorts BETWEEN: active index shifts only if it lands before', interpretation: APP_RULE, roster: [{ id: 'a', initiative: 15 }, { id: 'b', initiative: 10 }], activeIndex: 1, round: 1, edit: { kind: 'add', combatant: { id: 'c', initiative: 12 } }, expect: { ids: ['a', 'c', 'b'], activeIndex: 2, round: 1 } },
  { name: 'Add one that sorts AFTER the active combatant: active index unchanged', interpretation: APP_RULE, roster: [{ id: 'a', initiative: 15 }, { id: 'b', initiative: 10 }], activeIndex: 1, round: 1, edit: { kind: 'add', combatant: { id: 'c', initiative: 5 } }, expect: { ids: ['a', 'b', 'c'], activeIndex: 1, round: 1 } },
  { name: 'A new combatant tied with an existing one goes AFTER it (stable)', interpretation: APP_RULE, roster: [{ id: 'a', initiative: 15 }, { id: 'b', initiative: 10 }], activeIndex: 0, round: 1, edit: { kind: 'add', combatant: { id: 'c', initiative: 10 } }, expect: { ids: ['a', 'b', 'c'], activeIndex: 0, round: 1 } },
  { name: 'Remove one BEFORE the active combatant: active index shifts down', interpretation: APP_RULE, roster: [{ id: 'a', initiative: 15 }, { id: 'b', initiative: 10 }, { id: 'c', initiative: 5 }], activeIndex: 1, round: 3, edit: { kind: 'remove', id: 'a' }, expect: { ids: ['b', 'c'], activeIndex: 0, round: 3 } },
  { name: 'Remove one AFTER the active combatant: active index unchanged', interpretation: APP_RULE, roster: [{ id: 'a', initiative: 15 }, { id: 'b', initiative: 10 }, { id: 'c', initiative: 5 }], activeIndex: 0, round: 1, edit: { kind: 'remove', id: 'c' }, expect: { ids: ['a', 'b'], activeIndex: 0, round: 1 } },
  { name: 'Remove the ACTIVE combatant: the next one becomes active (same index)', interpretation: APP_RULE, roster: [{ id: 'a', initiative: 15 }, { id: 'b', initiative: 10 }, { id: 'c', initiative: 5 }], activeIndex: 1, round: 1, edit: { kind: 'remove', id: 'b' }, expect: { ids: ['a', 'c'], activeIndex: 1, round: 1 } },
  { name: 'Remove the ACTIVE last combatant: wraps to 0 without advancing the round', interpretation: APP_RULE, roster: [{ id: 'a', initiative: 15 }, { id: 'b', initiative: 10 }, { id: 'c', initiative: 5 }], activeIndex: 2, round: 2, edit: { kind: 'remove', id: 'c' }, expect: { ids: ['a', 'b'], activeIndex: 0, round: 2 } },
  { name: 'Removing the only combatant leaves an empty roster at index 0', interpretation: APP_RULE, roster: [{ id: 'a', initiative: 15 }], activeIndex: 0, round: 1, edit: { kind: 'remove', id: 'a' }, expect: { ids: [], activeIndex: 0, round: 1 } },
  { name: 'Removing an unknown id changes nothing', interpretation: APP_RULE, roster: [{ id: 'a', initiative: 15 }, { id: 'b', initiative: 10 }], activeIndex: 1, round: 1, edit: { kind: 'remove', id: 'zzz' }, expect: { ids: ['a', 'b'], activeIndex: 1, round: 1 } },
];

// ─── Action economy (the character's own turn) ───────────────────────────────
/**
 * Events applied in order to the character's own turn state.
 *  start-turn   : the character's turn begins (resets everything INCLUDING the Reaction)
 *  other-turn   : another combatant's turn begins (changes NOTHING; a Reaction stays spent)
 *  action       : the character takes its action
 *  dash         : the Dash action (uses the action AND adds one Speed's worth of movement)
 *  bonus        : the character takes a Bonus Action
 *  reaction     : the character takes a Reaction
 *  interact     : a free object interaction
 *  move:N       : the character moves N feet
 */
export type TurnEvent = 'start-turn' | 'other-turn' | 'action' | 'dash' | 'bonus' | 'reaction' | 'interact' | `move:${number}`;

export type TurnWarning =
  | 'action-already-used'
  | 'bonus-already-used'
  | 'reaction-already-used'
  | 'interaction-needs-utilize'
  | 'over-speed'
  | 'incapacitated';

export interface TurnCase {
  name: string;
  cite: string;
  /** The character's Speed in feet (A5e will wire armour and exhaustion penalties in). */
  speed: number;
  /** The character is Incapacitated (advisory warning only; state still updates). */
  incapacitated?: boolean;
  events: TurnEvent[];
  expect: {
    actionUsed: boolean;
    bonusUsed: boolean;
    reactionUsed: boolean;
    objectInteractionUsed: boolean;
    movementUsed: number;
    dashes: number;
    /** Speed x (1 + dashes). */
    movementAllowance: number;
    /** max(0, allowance - movementUsed). */
    remainingMovement: number;
    /** All warnings raised across the events, in order, duplicates removed. */
    warnings: TurnWarning[];
  };
}

const FRESH = { actionUsed: false, bonusUsed: false, reactionUsed: false, objectInteractionUsed: false, movementUsed: 0, dashes: 0 };

export const TURN_CASES: TurnCase[] = [
  { name: 'A fresh turn: nothing used, full movement', cite: 'Your Turn', speed: 30, events: ['start-turn'], expect: { ...FRESH, movementAllowance: 30, remainingMovement: 30, warnings: [] } },
  { name: 'Taking the action marks it used', cite: 'Your Turn: one action', speed: 30, events: ['start-turn', 'action'], expect: { ...FRESH, actionUsed: true, movementAllowance: 30, remainingMovement: 30, warnings: [] } },
  { name: 'A second action warns but still records (Action Surge exists)', cite: 'Actions: one action per turn', speed: 30, events: ['start-turn', 'action', 'action'], expect: { ...FRESH, actionUsed: true, movementAllowance: 30, remainingMovement: 30, warnings: ['action-already-used'] } },
  { name: 'Bonus Action marks it used', cite: 'Bonus Actions', speed: 30, events: ['start-turn', 'bonus'], expect: { ...FRESH, bonusUsed: true, movementAllowance: 30, remainingMovement: 30, warnings: [] } },
  { name: 'A second Bonus Action warns', cite: 'Bonus Actions: only one Bonus Action on your turn', speed: 30, events: ['start-turn', 'bonus', 'bonus'], expect: { ...FRESH, bonusUsed: true, movementAllowance: 30, remainingMovement: 30, warnings: ['bonus-already-used'] } },
  { name: 'Reaction marks it used', cite: 'Reactions', speed: 30, events: ['start-turn', 'reaction'], expect: { ...FRESH, reactionUsed: true, movementAllowance: 30, remainingMovement: 30, warnings: [] } },
  { name: 'A second Reaction before your next turn warns', cite: 'Reactions: can\'t take another until the start of your next turn', speed: 30, events: ['start-turn', 'reaction', 'reaction'], expect: { ...FRESH, reactionUsed: true, movementAllowance: 30, remainingMovement: 30, warnings: ['reaction-already-used'] } },
  { name: 'The Reaction stays spent through OTHER combatants\' turns', cite: 'Reaction: until the start of your next turn', speed: 30, events: ['start-turn', 'reaction', 'other-turn', 'other-turn'], expect: { ...FRESH, reactionUsed: true, movementAllowance: 30, remainingMovement: 30, warnings: [] } },
  { name: 'The Reaction refreshes at the start of the character\'s next turn', cite: 'Reaction: until the start of your next turn', speed: 30, events: ['start-turn', 'reaction', 'other-turn', 'start-turn'], expect: { ...FRESH, movementAllowance: 30, remainingMovement: 30, warnings: [] } },
  { name: 'Movement accumulates (10 + 15 = 25 of 30)', cite: 'Movement and Position: deduct each part of your move', speed: 30, events: ['start-turn', 'move:10', 'move:15'], expect: { ...FRESH, movementUsed: 25, movementAllowance: 30, remainingMovement: 5, warnings: [] } },
  { name: 'Moving past your Speed warns; remaining is 0, never negative', cite: 'Your Turn: move a distance up to your Speed', speed: 30, events: ['start-turn', 'move:40'], expect: { ...FRESH, movementUsed: 40, movementAllowance: 30, remainingMovement: 0, warnings: ['over-speed'] } },
  { name: 'Dash uses the action and doubles the movement allowance', cite: 'Dash [Action]: extra movement equal to your Speed', speed: 30, events: ['start-turn', 'dash', 'move:40'], expect: { ...FRESH, actionUsed: true, movementUsed: 40, dashes: 1, movementAllowance: 60, remainingMovement: 20, warnings: [] } },
  { name: 'A second Dash (Action Surge) warns about the action but still adds movement', cite: 'Dash + Actions', speed: 30, events: ['start-turn', 'dash', 'dash'], expect: { ...FRESH, actionUsed: true, dashes: 2, movementAllowance: 90, remainingMovement: 90, warnings: ['action-already-used'] } },
  { name: 'One free object interaction is fine', cite: 'Interacting with Things', speed: 30, events: ['start-turn', 'interact'], expect: { ...FRESH, objectInteractionUsed: true, movementAllowance: 30, remainingMovement: 30, warnings: [] } },
  { name: 'A second object interaction needs the Utilize action', cite: 'Interacting with Things: a second object needs the Utilize action', speed: 30, events: ['start-turn', 'interact', 'interact'], expect: { ...FRESH, objectInteractionUsed: true, movementAllowance: 30, remainingMovement: 30, warnings: ['interaction-needs-utilize'] } },
  { name: 'Speed 0 cannot move: any movement warns', cite: 'Your Turn + Speed 0', speed: 0, events: ['start-turn', 'move:5'], expect: { ...FRESH, movementUsed: 5, movementAllowance: 0, remainingMovement: 0, warnings: ['over-speed'] } },
  { name: 'A new turn resets everything, including the Reaction and Dash', cite: 'Your Turn + Reaction', speed: 30, events: ['start-turn', 'dash', 'bonus', 'reaction', 'move:30', 'interact', 'start-turn'], expect: { ...FRESH, movementAllowance: 30, remainingMovement: 30, warnings: [] } },
  { name: 'Incapacitated: taking an action warns but still records', cite: 'Incapacitated: Inactive (can\'t take any action, Bonus Action, or Reaction)', speed: 30, incapacitated: true, events: ['start-turn', 'action'], expect: { ...FRESH, actionUsed: true, movementAllowance: 30, remainingMovement: 30, warnings: ['incapacitated'] } },
  { name: 'Incapacitated: Bonus Action and Reaction each warn once (duplicates removed)', cite: 'Incapacitated: Inactive', speed: 30, incapacitated: true, events: ['start-turn', 'bonus', 'reaction', 'action'], expect: { ...FRESH, actionUsed: true, bonusUsed: true, reactionUsed: true, movementAllowance: 30, remainingMovement: 30, warnings: ['incapacitated'] } },
];

// ─── Start-of-turn Death Saving Throw prompt (ties A5a to the tracker) ───────
export interface DeathSavePromptCase {
  name: string;
  cite: string;
  input: { activeIsCharacter: boolean; hp: number; stable?: boolean; dead?: boolean };
  expect: boolean;
}

export const DEATH_SAVE_PROMPT_CASES: DeathSavePromptCase[] = [
  { name: 'The character\'s turn starts at 0 HP: prompt a Death Saving Throw', cite: 'Death Saving Throws: whenever you start your turn with 0 Hit Points', input: { activeIsCharacter: true, hp: 0 }, expect: true },
  { name: 'At 1 HP: no prompt', cite: 'Death Saving Throws', input: { activeIsCharacter: true, hp: 1 }, expect: false },
  { name: 'Stable at 0 HP: no prompt', cite: 'Stabilizing a Character: a Stable creature doesn\'t make Death Saving Throws', input: { activeIsCharacter: true, hp: 0, stable: true }, expect: false },
  { name: 'Dead: no prompt', cite: 'Character Demise', input: { activeIsCharacter: true, hp: 0, dead: true }, expect: false },
  { name: 'It is someone else\'s turn: no prompt', cite: 'Death Saving Throws: start YOUR turn', input: { activeIsCharacter: false, hp: 0 }, expect: false },
];
