/**
 * GOLDEN FIXTURE for the Warlock Eldritch Invocation catalog (Stage 3).
 *
 * Authored ONLY from the PHB 2024 (Docs/PlayersHandbook.md, Warlock
 * "ELDRITCH INVOCATION OPTIONS", L6904-L7078, and the Warlock Features table
 * L6829-L6852). It is independent of src/data/invocations.ts: nothing is
 * imported from the app.
 *
 * LINE NUMBERS are 1-based lines of the invocation's `## NAME` heading as
 * counted by PowerShell `Get-Content`.
 *
 * Cardinality: exactly 28 invocations. Pact of the Blade, Pact of the Chain and
 * Pact of the Tome ARE invocations (they have no prerequisite).
 *
 * `minLevel` is the "Level N+ Warlock" prerequisite (1 when there is none).
 * `requiresInvocation` is a named invocation prerequisite (the PHB writes
 * "Pact of the Blade", "Pact of the Blade Invocation" and "Pact of the Tome
 * Invocation" interchangeably: same invocation).
 * `requiresCantrip`: 'damage' = "a Warlock Cantrip That Deals Damage";
 * 'damage-attack-roll' = "... That Deals Damage via an Attack Roll".
 * `repeatable`: the only invocations whose text says "Repeatable"; each repeat
 * takes a different parameter (`param`): a cantrip, or an Origin feat.
 * Everything else cannot be taken twice (L6819).
 *
 * Invocations known by Warlock level (Features table, L6833-L6852; the OCR
 * prints "l" for 1; prose L6811 confirms one at level 1):
 *   L1:1  L2-4:3  L5-6:5  L7-8:6  L9-11:7  L12-14:8  L15-17:9  L18-20:10
 */
export type GoldenCantripRequirement = 'damage' | 'damage-attack-roll';
export type GoldenInvocationParam = 'cantrip' | 'origin-feat';

export interface GoldenInvocation {
  id: string;
  name: string;
  minLevel: number;
  requiresInvocation?: string;
  requiresCantrip?: GoldenCantripRequirement;
  /** Eldritch Spear only: the chosen cantrip must have a range of 10+ feet. */
  cantripMinRangeFeet?: number;
  repeatable: boolean;
  param?: GoldenInvocationParam;
  line: number;
}

export const GOLDEN_INVOCATION_COUNT = 28;

/** [warlockLevel, cumulativeInvocations] (Warlock Features table). */
export const GOLDEN_INVOCATION_OWED_STEPS: ReadonlyArray<readonly [level: number, owed: number]> = [
  [1, 1],
  [2, 3],
  [5, 5],
  [7, 6],
  [9, 7],
  [12, 8],
  [15, 9],
  [18, 10],
];

const inv = (
  id: string,
  name: string,
  line: number,
  minLevel: number,
  extra: Partial<Omit<GoldenInvocation, 'id' | 'name' | 'line' | 'minLevel' | 'repeatable'>> & { repeatable?: boolean } = {},
): GoldenInvocation => ({ id, name, minLevel, line, repeatable: false, ...extra });

export const INVOCATIONS_GOLDEN: readonly GoldenInvocation[] = [
  inv('agonizing-blast', 'Agonizing Blast', 6908, 2, { requiresCantrip: 'damage', repeatable: true, param: 'cantrip' }),
  inv('armor-of-shadows', 'Armor of Shadows', 6916, 1),
  inv('ascendant-step', 'Ascendant Step', 6920, 5),
  inv('devils-sight', "Devil's Sight", 6926, 2),
  inv('devouring-blade', 'Devouring Blade', 6932, 12, { requiresInvocation: 'thirsting-blade' }),
  inv('eldritch-mind', 'Eldritch Mind', 6938, 1),
  inv('eldritch-smite', 'Eldritch Smite', 6942, 5, { requiresInvocation: 'pact-of-the-blade' }),
  inv('eldritch-spear', 'Eldritch Spear', 6948, 2, { requiresCantrip: 'damage', cantripMinRangeFeet: 10, repeatable: true, param: 'cantrip' }),
  inv('fiendish-vigor', 'Fiendish Vigor', 6956, 2),
  inv('gaze-of-two-minds', 'Gaze of Two Minds', 6962, 5),
  inv('gift-of-the-depths', 'Gift of the Depths', 6968, 5),
  inv('gift-of-the-protectors', 'Gift of the Protectors', 6974, 9, { requiresInvocation: 'pact-of-the-tome' }),
  inv('investment-of-the-chain-master', 'Investment of the Chain Master', 6984, 5, { requiresInvocation: 'pact-of-the-chain' }),
  inv('lessons-of-the-first-ones', 'Lessons of the First Ones', 6998, 2, { repeatable: true, param: 'origin-feat' }),
  inv('lifedrinker', 'Lifedrinker', 7004, 9, { requiresInvocation: 'pact-of-the-blade' }),
  inv('mask-of-many-faces', 'Mask of Many Faces', 7010, 2),
  inv('master-of-myriad-forms', 'Master of Myriad Forms', 7016, 5),
  inv('misty-visions', 'Misty Visions', 7020, 2),
  inv('one-with-shadows', 'One with Shadows', 7024, 5),
  inv('otherworldly-leap', 'Otherworldly Leap', 7028, 2),
  inv('pact-of-the-blade', 'Pact of the Blade', 7032, 1),
  inv('pact-of-the-chain', 'Pact of the Chain', 7040, 1),
  inv('pact-of-the-tome', 'Pact of the Tome', 7048, 1),
  inv('repelling-blast', 'Repelling Blast', 7056, 2, { requiresCantrip: 'damage-attack-roll', repeatable: true, param: 'cantrip' }),
  inv('thirsting-blade', 'Thirsting Blade', 7064, 5, { requiresInvocation: 'pact-of-the-blade' }),
  inv('visions-of-distant-realms', 'Visions of Distant Realms', 7068, 9),
  inv('whispers-of-the-grave', 'Whispers of the Grave', 7072, 7),
  inv('witch-sight', 'Witch Sight', 7076, 15),
];

export const GOLDEN_REPEATABLE_INVOCATION_IDS: readonly string[] = [
  'agonizing-blast',
  'eldritch-spear',
  'lessons-of-the-first-ones',
  'repelling-blast',
];
