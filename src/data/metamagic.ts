/**
 * Sorcerer Metamagic option catalog (D&D 5.5e / 2024).
 *
 * Source: PHB 2024 Sorcerer "Metamagic Options" (Docs/PlayersHandbook.md
 * L6373-L6428). Costs are transcribed exactly; `summary` text is paraphrased.
 * Pinned by data/__tests__/metamagic-golden.ts + metamagic-oracle.test.ts.
 */

export interface MetamagicData {
  id: string;
  name: string;
  /** Sorcery Point cost. */
  cost: number;
  /**
   * True when the option's text lets it be used on a casting that already uses
   * a different Metamagic option (PHB L6345-6346: one option per spell "unless
   * otherwise noted").
   */
  stacksWithOtherOption: boolean;
  /** Paraphrased description. */
  summary: string;
  source: string;
}

const src = (name: string, line: number): string => `PHB 2024 "${name}" (L${line})`;

export const METAMAGIC_CATALOG: Record<string, MetamagicData> = {
  'careful-spell': {
    id: 'careful-spell',
    name: 'Careful Spell',
    cost: 1,
    stacksWithOtherOption: false,
    summary:
      'When a spell forces saving throws, shield some of the targets: up to your Charisma modifier (minimum one) of them automatically succeed, and take no damage even from a half-damage save.',
    source: src('Careful Spell', 6377),
  },
  'distant-spell': {
    id: 'distant-spell',
    name: 'Distant Spell',
    cost: 1,
    stacksWithOtherOption: false,
    summary: 'Double the range of a spell with a range of 5 feet or more, or turn a Touch range into 30 feet.',
    source: src('Distant Spell', 6381),
  },
  'empowered-spell': {
    id: 'empowered-spell',
    name: 'Empowered Spell',
    cost: 1,
    stacksWithOtherOption: true,
    summary:
      'Reroll up to your Charisma modifier (minimum one) of a spell’s damage dice and keep the new results. Can be added to a casting that already uses another Metamagic option.',
    source: src('Empowered Spell', 6387),
  },
  'extended-spell': {
    id: 'extended-spell',
    name: 'Extended Spell',
    cost: 1,
    stacksWithOtherOption: false,
    summary:
      'Double the duration of a spell lasting 1 minute or longer, up to 24 hours. If it needs Concentration, you have Advantage on saves to maintain it.',
    source: src('Extended Spell', 6393),
  },
  'heightened-spell': {
    id: 'heightened-spell',
    name: 'Heightened Spell',
    cost: 2,
    stacksWithOtherOption: false,
    summary: 'When a spell forces a saving throw, one target has Disadvantage on its save against that spell.',
    source: src('Heightened Spell', 6399),
  },
  'quickened-spell': {
    id: 'quickened-spell',
    name: 'Quickened Spell',
    cost: 2,
    stacksWithOtherOption: false,
    summary:
      'Change a spell with an action casting time into a Bonus Action. Not allowed if you already cast a level 1+ spell this turn, and you cannot cast one afterward this turn.',
    source: src('Quickened Spell', 6405),
  },
  'seeking-spell': {
    id: 'seeking-spell',
    name: 'Seeking Spell',
    cost: 1,
    stacksWithOtherOption: true,
    summary:
      'If you miss with a spell attack roll, reroll the d20 and use the new roll. Can be added to a casting that already uses another Metamagic option.',
    source: src('Seeking Spell', 6409),
  },
  'subtle-spell': {
    id: 'subtle-spell',
    name: 'Subtle Spell',
    cost: 1,
    stacksWithOtherOption: false,
    summary:
      'Cast a spell without Verbal, Somatic or Material components, except Material components that are consumed or have a stated cost.',
    source: src('Subtle Spell', 6417),
  },
  'transmuted-spell': {
    id: 'transmuted-spell',
    name: 'Transmuted Spell',
    cost: 1,
    stacksWithOtherOption: false,
    summary:
      'Swap a spell’s damage type among Acid, Cold, Fire, Lightning, Poison and Thunder for another type on that list.',
    source: src('Transmuted Spell', 6421),
  },
  'twinned-spell': {
    id: 'twinned-spell',
    name: 'Twinned Spell',
    cost: 1,
    stacksWithOtherOption: false,
    summary:
      'For a spell that targets an extra creature when cast with a higher-level slot (such as Charm Person), raise its effective spell level by 1.',
    source: src('Twinned Spell', 6425),
  },
};

export type MetamagicId = keyof typeof METAMAGIC_CATALOG;
export const METAMAGIC_LIST: MetamagicData[] = Object.values(METAMAGIC_CATALOG);

export function getMetamagic(id: string): MetamagicData | undefined {
  return METAMAGIC_CATALOG[id];
}
