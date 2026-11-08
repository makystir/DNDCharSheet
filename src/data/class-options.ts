/**
 * Small fixed class-feature option sets (D&D 5.5e / 2024): Cleric Divine Order
 * and Blessed Strikes, Druid Primal Order and Elemental Fury, subclass option
 * picks, and the Artisan's Tools / Musical Instrument lists.
 *
 * Sources: PHB 2024 (Docs/PlayersHandbook.md), cited per record. Mechanical
 * values are transcribed exactly; `summary` text is paraphrased. Pinned by
 * data/__tests__/class-options-golden.ts + class-options-oracle.test.ts.
 */

export interface OrderOption {
  id: string;
  name: string;
  /** Weapon proficiency categories granted ('martial'). */
  weapons: string[];
  /** Armor training granted ('heavy' | 'medium'). */
  armor: string[];
  /** Extra cantrips known from the class list. */
  extraCantrips: number;
  /** Skills receiving a Wisdom-modifier bonus (minimum +1); empty when none. */
  skillBonusSkills: string[];
  summary: string;
  source: string;
}

export interface SimpleOption {
  id: string;
  name: string;
  /** Extra-damage dice for damage riders: base and improved (and the level). */
  dice?: { base: string; improved: string; improvedAtLevel: number };
  summary: string;
  source: string;
}

export interface ToolOption {
  id: string;
  name: string;
  /** Id of the matching item in src/data/equipment.ts. */
  equipmentId: string;
  source: string;
}

const opt = (id: string, name: string, line: number, summary: string, dice?: SimpleOption['dice']): SimpleOption => ({
  id,
  name,
  ...(dice ? { dice } : {}),
  summary,
  source: `PHB 2024 "${name}" (L${line})`,
});

export const DIVINE_ORDER_OPTIONS: OrderOption[] = [
  {
    id: 'protector',
    name: 'Protector',
    weapons: ['martial'],
    armor: ['heavy'],
    extraCantrips: 0,
    skillBonusSkills: [],
    summary: 'Battle-trained: proficiency with Martial weapons and training with Heavy armor.',
    source: 'PHB 2024 Cleric "Divine Order: Protector" (L3232)',
  },
  {
    id: 'thaumaturge',
    name: 'Thaumaturge',
    weapons: [],
    armor: [],
    extraCantrips: 1,
    skillBonusSkills: ['arcana', 'religion'],
    summary: 'Know one extra Cleric cantrip, and add your Wisdom modifier (minimum +1) to Intelligence (Arcana or Religion) checks.',
    source: 'PHB 2024 Cleric "Divine Order: Thaumaturge" (L3234)',
  },
];

export const PRIMAL_ORDER_OPTIONS: OrderOption[] = [
  {
    id: 'warden',
    name: 'Warden',
    weapons: ['martial'],
    armor: ['medium'],
    extraCantrips: 0,
    skillBonusSkills: [],
    summary: 'Battle-trained: proficiency with Martial weapons and training with Medium armor.',
    source: 'PHB 2024 Druid "Primal Order: Warden" (L3668)',
  },
  {
    id: 'magician',
    name: 'Magician',
    weapons: [],
    armor: [],
    extraCantrips: 1,
    skillBonusSkills: ['arcana', 'nature'],
    summary: 'Know one extra Druid cantrip, and add your Wisdom modifier (minimum +1) to Intelligence (Arcana or Nature) checks.',
    source: 'PHB 2024 Druid "Primal Order: Magician" (L3670)',
  },
];

export const BLESSED_STRIKES_OPTIONS: SimpleOption[] = [
  opt('divine-strike', 'Divine Strike', 3264, 'Once per turn on a weapon hit, add 1d8 Necrotic or Radiant damage (2d8 from Cleric level 14).', {
    base: '1d8',
    improved: '2d8',
    improvedAtLevel: 14,
  }),
  opt('potent-spellcasting', 'Potent Spellcasting', 3266, 'Add your Wisdom modifier to the damage of Cleric cantrips (extra reach at Cleric level 14).'),
];

export const ELEMENTAL_FURY_OPTIONS: SimpleOption[] = [
  opt('potent-spellcasting', 'Potent Spellcasting', 3726, 'Add your Wisdom modifier to the damage of Druid cantrips (extra reach at Druid level 15).'),
  opt('primal-strike', 'Primal Strike', 3728, 'Once per turn on a weapon or Beast-form hit, add 1d8 Cold, Fire, Lightning or Thunder damage (2d8 from Druid level 15).', {
    base: '1d8',
    improved: '2d8',
    improvedAtLevel: 15,
  }),
];

export type SubclassPickKey =
  | 'huntersPrey'
  | 'defensiveTactics'
  | 'primalCompanion'
  | 'aspectOfTheWilds'
  | 'elementalAffinity'
  | 'glamourSkill';

export const SUBCLASS_PICK_OPTIONS: Record<SubclassPickKey, SimpleOption[]> = {
  huntersPrey: [
    opt('colossus-slayer', 'Colossus Slayer', 5827, 'Extra 1d8 damage once per turn against a target that is missing Hit Points.'),
    opt('horde-breaker', 'Horde Breaker', 5829, 'Once per turn, make an extra attack with the same weapon against a different creature near the first target.'),
  ],
  defensiveTactics: [
    opt('escape-the-horde', 'Escape the Horde', 5835, 'Opportunity Attacks against you have Disadvantage.'),
    opt('multiattack-defense', 'Multiattack Defense', 5837, 'After a creature hits you, it has Disadvantage on its other attack rolls against you this turn.'),
  ],
  primalCompanion: [
    opt('beast-of-the-land', 'Beast of the Land', 5583, 'Summon a land-dwelling primal beast companion.'),
    opt('beast-of-the-sea', 'Beast of the Sea', 5583, 'Summon a water-dwelling primal beast companion.'),
    opt('beast-of-the-sky', 'Beast of the Sky', 5583, 'Summon a flying primal beast companion.'),
  ],
  aspectOfTheWilds: [
    opt('owl', 'Owl', 2595, 'Darkvision 60 feet (or +60 feet if you already have it).'),
    opt('panther', 'Panther', 2597, 'Climb Speed equal to your Speed.'),
    opt('salmon', 'Salmon', 2599, 'Swim Speed equal to your Speed.'),
  ],
  elementalAffinity: [
    opt('acid', 'Acid', 6679, 'Resistance to Acid damage and add Charisma modifier to one damage roll of Acid spells.'),
    opt('cold', 'Cold', 6679, 'Resistance to Cold damage and add Charisma modifier to one damage roll of Cold spells.'),
    opt('fire', 'Fire', 6679, 'Resistance to Fire damage and add Charisma modifier to one damage roll of Fire spells.'),
    opt('lightning', 'Lightning', 6679, 'Resistance to Lightning damage and add Charisma modifier to one damage roll of Lightning spells.'),
    opt('poison', 'Poison', 6679, 'Resistance to Poison damage and add Charisma modifier to one damage roll of Poison spells.'),
  ],
  glamourSkill: [
    opt('deception', 'Deception', 5745, 'Gain proficiency in Deception.'),
    opt('performance', 'Performance', 5745, 'Gain proficiency in Performance.'),
    opt('persuasion', 'Persuasion', 5745, 'Gain proficiency in Persuasion.'),
  ],
};

const tool = (id: string, name: string, line: number, equipmentId: string): ToolOption => ({
  id,
  name,
  equipmentId,
  source: `PHB 2024 "${name}" (L${line})`,
});

/** The 17 Artisan's Tools (PHB 2024 L9662-L9862); each needs a separate proficiency. */
export const ARTISANS_TOOLS: ToolOption[] = [
  tool('alchemists-supplies', "Alchemist's Supplies", 9668, 'alchemists-supplies'),
  tool('brewers-supplies', "Brewer's Supplies", 9680, 'brewers-supplies'),
  tool('calligraphers-supplies', "Calligrapher's Supplies", 9690, 'calligraphers-supplies'),
  tool('carpenters-tools', "Carpenter's Tools", 9704, 'carpenters-tools'),
  tool('cartographers-tools', "Cartographer's Tools", 9712, 'cartographers-tools'),
  tool('cobblers-tools', "Cobbler's Tools", 9720, 'cobblers-tools'),
  tool('cooks-utensils', "Cook's Utensils", 9730, 'cooks-utensils'),
  tool('glassblowers-tools', "Glassblower's Tools", 9742, 'glassblowers-tools'),
  tool('jewelers-tools', "Jeweler's Tools", 9750, 'jewelers-tools'),
  tool('leatherworkers-tools', "Leatherworker's Tools", 9760, 'leatherworkers-tools'),
  tool('masons-tools', "Mason's Tools", 9772, 'masons-tools'),
  tool('painters-supplies', "Painter's Supplies", 9780, 'painters-supplies'),
  tool('potters-tools', "Potter's Tools", 9790, 'potters-tools'),
  tool('smiths-tools', "Smith's Tools", 9800, 'smiths-tools'),
  tool('tinkers-tools', "Tinker's Tools", 9822, 'tinkers-tools'),
  tool('weavers-tools', "Weaver's Tools", 9832, 'weavers-tools'),
  tool('woodcarvers-tools', "Woodcarver's Tools", 9840, 'woodcarvers-tools'),
];

const instrument = (id: string, name: string): ToolOption => tool(id, name, 9896, `instrument-${id}`);

/** The 10 Musical Instrument variants (PHB 2024 L9896). */
export const MUSICAL_INSTRUMENTS: ToolOption[] = [
  instrument('bagpipes', 'Bagpipes'),
  instrument('drum', 'Drum'),
  instrument('dulcimer', 'Dulcimer'),
  instrument('flute', 'Flute'),
  instrument('horn', 'Horn'),
  instrument('lute', 'Lute'),
  instrument('lyre', 'Lyre'),
  instrument('pan-flute', 'Pan Flute'),
  instrument('shawm', 'Shawm'),
  instrument('viol', 'Viol'),
];
