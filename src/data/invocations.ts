/**
 * Warlock Eldritch Invocation catalog (D&D 5.5e / 2024).
 *
 * Source: PHB 2024 Warlock "Eldritch Invocation Options"
 * (Docs/PlayersHandbook.md L6904-L7078). Prerequisites are transcribed exactly;
 * `summary` text is paraphrased. Pact of the Blade / Chain / Tome are
 * invocations. Pinned by data/__tests__/invocations-golden.ts +
 * invocations-oracle.test.ts.
 */

import type { OwnUses } from './classes';

export type InvocationCantripRequirement = 'damage' | 'damage-attack-roll';
export type InvocationParam = 'cantrip' | 'origin-feat';

export interface InvocationData {
  id: string;
  name: string;
  /** "Level N+ Warlock" prerequisite (1 when there is none). */
  minLevel: number;
  /** Another invocation that must already be known. */
  requiresInvocation?: string;
  /** Needs a known Warlock cantrip that deals damage (optionally via an attack roll). */
  requiresCantrip?: InvocationCantripRequirement;
  /** Eldritch Spear: the chosen cantrip needs a range of 10+ feet. */
  cantripMinRangeFeet?: number;
  /** "Repeatable": can be taken again with a different parameter. */
  repeatable: boolean;
  /** What a repeat varies by: a cantrip or an Origin feat. */
  param?: InvocationParam;
  /** Paraphrased description. */
  summary: string;
  /** Limited-use pool (D1 resource tracking); the tracker id is `warlock.invocation-<id>`. */
  uses?: OwnUses;
  source: string;
}

const src = (name: string, line: number): string => `PHB 2024 "${name}" (L${line})`;

type Extra = Partial<Pick<InvocationData, 'requiresInvocation' | 'requiresCantrip' | 'cantripMinRangeFeet' | 'repeatable' | 'param' | 'uses'>>;
const inv = (id: string, name: string, line: number, minLevel: number, summary: string, extra: Extra = {}): InvocationData => ({
  id,
  name,
  minLevel,
  repeatable: false,
  ...extra,
  summary,
  source: src(name, line),
});

const LIST: InvocationData[] = [
  inv('agonizing-blast', 'Agonizing Blast', 6908, 2, 'Pick a known damaging Warlock cantrip; add your Charisma modifier to its damage rolls. Repeat with a different cantrip.', {
    requiresCantrip: 'damage',
    repeatable: true,
    param: 'cantrip',
  }),
  inv('armor-of-shadows', 'Armor of Shadows', 6916, 1, 'Cast Mage Armor on yourself without a spell slot.'),
  inv('ascendant-step', 'Ascendant Step', 6920, 5, 'Cast Levitate on yourself without a spell slot.'),
  inv('devils-sight', "Devil's Sight", 6926, 2, 'See normally in Dim Light and Darkness, magical or not, out to 120 feet.'),
  inv('devouring-blade', 'Devouring Blade', 6932, 12, 'Thirsting Blade grants two extra attacks instead of one.', { requiresInvocation: 'thirsting-blade' }),
  inv('eldritch-mind', 'Eldritch Mind', 6938, 1, 'Advantage on Constitution saves to maintain Concentration.'),
  inv('eldritch-smite', 'Eldritch Smite', 6942, 5, 'Once per turn on a pact weapon hit, spend a Pact Magic slot for extra Force damage (1d8 plus 1d8 per slot level) and possibly knock the target Prone.', {
    requiresInvocation: 'pact-of-the-blade',
  }),
  inv('eldritch-spear', 'Eldritch Spear', 6948, 2, 'Pick a known damaging Warlock cantrip with range 10+ feet; its range grows by 30 feet times your Warlock level. Repeat with a different cantrip.', {
    requiresCantrip: 'damage',
    cantripMinRangeFeet: 10,
    repeatable: true,
    param: 'cantrip',
  }),
  inv('fiendish-vigor', 'Fiendish Vigor', 6956, 2, 'Cast False Life on yourself without a slot, always getting the maximum Temporary Hit Points.'),
  inv('gaze-of-two-minds', 'Gaze of Two Minds', 6962, 5, 'Touch a willing creature and perceive through its senses, maintaining the link with Bonus Actions.'),
  inv('gift-of-the-depths', 'Gift of the Depths', 6968, 5, 'Breathe underwater, gain a Swim Speed equal to your Speed, and cast Water Breathing once per Long Rest for free.', {
    uses: { count: 1, recharge: 'long-rest' }, // PHB L6968-6972
  }),
  inv('gift-of-the-protectors', 'Gift of the Protectors', 6974, 9, 'A page in your Book of Shadows lists names (up to your Charisma modifier) whose bearers drop to 1 Hit Point instead of 0 once per Long Rest.', {
    requiresInvocation: 'pact-of-the-tome',
    uses: { count: 1, recharge: 'long-rest' }, // PHB L6974-6980: modelled as one use ("until you finish a Long Rest")
  }),
  inv('investment-of-the-chain-master', 'Investment of the Chain Master', 6984, 5, 'Your Find Familiar familiar gains a Fly or Swim Speed, quick attacks, radiant/necrotic damage options, your spell save DC and a Resistance reaction.', {
    requiresInvocation: 'pact-of-the-chain',
  }),
  inv('lessons-of-the-first-ones', 'Lessons of the First Ones', 6998, 2, 'Gain one Origin feat of your choice. Repeat with a different Origin feat.', {
    repeatable: true,
    param: 'origin-feat',
  }),
  inv('lifedrinker', 'Lifedrinker', 7004, 9, 'Once per turn on a pact weapon hit, add 1d6 Necrotic, Psychic or Radiant damage and spend a Hit Point Die to heal.', {
    requiresInvocation: 'pact-of-the-blade',
  }),
  inv('mask-of-many-faces', 'Mask of Many Faces', 7010, 2, 'Cast Disguise Self without a spell slot.'),
  inv('master-of-myriad-forms', 'Master of Myriad Forms', 7016, 5, 'Cast Alter Self without a spell slot.'),
  inv('misty-visions', 'Misty Visions', 7020, 2, 'Cast Silent Image without a spell slot.'),
  inv('one-with-shadows', 'One with Shadows', 7024, 5, 'In Dim Light or Darkness, cast Invisibility on yourself without a spell slot.'),
  inv('otherworldly-leap', 'Otherworldly Leap', 7028, 2, 'Cast Jump on yourself without a spell slot.'),
  inv('pact-of-the-blade', 'Pact of the Blade', 7032, 1, 'Conjure or bond a pact weapon as a Bonus Action; you are proficient with it, can use it as a focus, and may attack with Charisma and choose Necrotic, Psychic or Radiant damage.'),
  inv('pact-of-the-chain', 'Pact of the Chain', 7040, 1, 'Learn Find Familiar and cast it as a Magic action for free, with special familiar forms; your familiar can attack in place of one of your attacks.'),
  inv('pact-of-the-tome', 'Pact of the Tome', 7048, 1, 'Conjure a Book of Shadows after a rest holding three cantrips and two level 1 ritual spells from any class list; it serves as a focus.'),
  inv('repelling-blast', 'Repelling Blast', 7056, 2, 'Pick a known Warlock cantrip that needs an attack roll; on a hit you can push a Large or smaller creature up to 10 feet. Repeat with a different cantrip.', {
    requiresCantrip: 'damage-attack-roll',
    repeatable: true,
    param: 'cantrip',
  }),
  inv('thirsting-blade', 'Thirsting Blade', 7064, 5, 'Gain Extra Attack for your pact weapon only: attack twice with it when you take the Attack action.', {
    requiresInvocation: 'pact-of-the-blade',
  }),
  inv('visions-of-distant-realms', 'Visions of Distant Realms', 7068, 9, 'Cast Arcane Eye without a spell slot.'),
  inv('whispers-of-the-grave', 'Whispers of the Grave', 7072, 7, 'Cast Speak with Dead without a spell slot.'),
  inv('witch-sight', 'Witch Sight', 7076, 15, 'Gain Truesight out to 30 feet.'),
];

export const INVOCATION_CATALOG: Record<string, InvocationData> = Object.fromEntries(LIST.map((i) => [i.id, i]));
export type InvocationId = keyof typeof INVOCATION_CATALOG;
export const INVOCATION_LIST: InvocationData[] = LIST;

export function getInvocation(id: string): InvocationData | undefined {
  return INVOCATION_CATALOG[id];
}
