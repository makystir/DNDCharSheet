/**
 * GOLDEN FIXTURE for the small fixed class-feature option sets (Stage 3):
 * Cleric Divine Order and Blessed Strikes, Druid Primal Order and Elemental
 * Fury, the subclass option picks (Hunter's Prey, Defensive Tactics, Beast
 * Master Primal Companion, Wild Heart Aspect of the Wilds, Draconic Elemental
 * Affinity, Fey Wanderer Otherworldly Glamour), the skill lists the Barbarian
 * Primal Knowledge and Battle Master Student of War picks draw from, and the
 * Artisan's Tools / Musical Instrument lists.
 *
 * Authored ONLY from the PHB 2024 (Docs/PlayersHandbook.md). Independent of
 * src/data/class-options.ts: nothing is imported from the app. LINE NUMBERS are
 * 1-based `Get-Content` lines of the option's paragraph.
 *
 * Divine Order (L3228-L3234): Protector = Martial weapon proficiency + Heavy
 * armor training; Thaumaturge = one extra Cleric cantrip + a bonus to
 * Intelligence (Arcana or Religion) checks equal to Wisdom modifier (min +1).
 * Primal Order (L3664-L3670): Warden = Martial weapons + Medium armor training;
 * Magician = one extra Druid cantrip + bonus to Intelligence (Arcana or Nature)
 * checks equal to Wisdom modifier (min +1).
 * Blessed Strikes (L3260-L3274): Divine Strike (1d8, 2d8 at Cleric 14) or
 * Potent Spellcasting. Elemental Fury (L3722-L3734): Potent Spellcasting or
 * Primal Strike (1d8, 2d8 at Druid 15).
 * Artisan's Tools: 17 (PHB L9662-L9862); Musical Instruments: 10 variants
 * (PHB L9896). `equipmentId` is the id in src/data/equipment.ts.
 */
export interface GoldenOrderOption {
  id: string;
  name: string;
  weapons: string[];
  armor: string[];
  extraCantrips: number;
  /** Skills that receive a Wisdom-modifier bonus (min +1); empty when none. */
  skillBonusSkills: string[];
  line: number;
}

export const DIVINE_ORDER_GOLDEN: readonly GoldenOrderOption[] = [
  { id: 'protector', name: 'Protector', weapons: ['martial'], armor: ['heavy'], extraCantrips: 0, skillBonusSkills: [], line: 3232 },
  { id: 'thaumaturge', name: 'Thaumaturge', weapons: [], armor: [], extraCantrips: 1, skillBonusSkills: ['arcana', 'religion'], line: 3234 },
];

export const PRIMAL_ORDER_GOLDEN: readonly GoldenOrderOption[] = [
  { id: 'warden', name: 'Warden', weapons: ['martial'], armor: ['medium'], extraCantrips: 0, skillBonusSkills: [], line: 3668 },
  { id: 'magician', name: 'Magician', weapons: [], armor: [], extraCantrips: 1, skillBonusSkills: ['arcana', 'nature'], line: 3670 },
];

export interface GoldenSimpleOption {
  id: string;
  name: string;
  line: number;
  /** Extra-damage dice when the option is a damage rider (base, improved). */
  dice?: { base: string; improved: string; improvedAtLevel: number };
}

export const BLESSED_STRIKES_GOLDEN: readonly GoldenSimpleOption[] = [
  { id: 'divine-strike', name: 'Divine Strike', line: 3264, dice: { base: '1d8', improved: '2d8', improvedAtLevel: 14 } },
  { id: 'potent-spellcasting', name: 'Potent Spellcasting', line: 3266 },
];

export const ELEMENTAL_FURY_GOLDEN: readonly GoldenSimpleOption[] = [
  { id: 'potent-spellcasting', name: 'Potent Spellcasting', line: 3726 },
  { id: 'primal-strike', name: 'Primal Strike', line: 3728, dice: { base: '1d8', improved: '2d8', improvedAtLevel: 15 } },
];

export type GoldenSubclassPickKey =
  | 'huntersPrey'
  | 'defensiveTactics'
  | 'primalCompanion'
  | 'aspectOfTheWilds'
  | 'elementalAffinity'
  | 'glamourSkill';

export const SUBCLASS_PICKS_GOLDEN: Record<GoldenSubclassPickKey, readonly GoldenSimpleOption[]> = {
  huntersPrey: [
    { id: 'colossus-slayer', name: 'Colossus Slayer', line: 5827 },
    { id: 'horde-breaker', name: 'Horde Breaker', line: 5829 },
  ],
  defensiveTactics: [
    { id: 'escape-the-horde', name: 'Escape the Horde', line: 5835 },
    { id: 'multiattack-defense', name: 'Multiattack Defense', line: 5837 },
  ],
  primalCompanion: [
    { id: 'beast-of-the-land', name: 'Beast of the Land', line: 5583 },
    { id: 'beast-of-the-sea', name: 'Beast of the Sea', line: 5583 },
    { id: 'beast-of-the-sky', name: 'Beast of the Sky', line: 5583 },
  ],
  aspectOfTheWilds: [
    { id: 'owl', name: 'Owl', line: 2595 },
    { id: 'panther', name: 'Panther', line: 2597 },
    { id: 'salmon', name: 'Salmon', line: 2599 },
  ],
  elementalAffinity: [
    { id: 'acid', name: 'Acid', line: 6679 },
    { id: 'cold', name: 'Cold', line: 6679 },
    { id: 'fire', name: 'Fire', line: 6679 },
    { id: 'lightning', name: 'Lightning', line: 6679 },
    { id: 'poison', name: 'Poison', line: 6679 },
  ],
  glamourSkill: [
    { id: 'deception', name: 'Deception', line: 5745 },
    { id: 'performance', name: 'Performance', line: 5745 },
    { id: 'persuasion', name: 'Persuasion', line: 5745 },
  ],
};

/** Barbarian level-1 skill list (Primal Knowledge, L2493-L2495; list L2388). */
export const GOLDEN_BARBARIAN_SKILL_LIST: readonly string[] = [
  'animalHandling',
  'athletics',
  'intimidation',
  'nature',
  'perception',
  'survival',
];

/** Fighter level-1 skill list (Student of War, L4249; list L4094). */
export const GOLDEN_FIGHTER_SKILL_LIST: readonly string[] = [
  'acrobatics',
  'animalHandling',
  'athletics',
  'history',
  'insight',
  'intimidation',
  'persuasion',
  'perception',
  'survival',
];

export interface GoldenToolOption {
  id: string;
  name: string;
  equipmentId: string;
  line: number;
}

export const GOLDEN_ARTISANS_TOOLS_COUNT = 17;
export const ARTISANS_TOOLS_GOLDEN: readonly GoldenToolOption[] = [
  { id: 'alchemists-supplies', name: "Alchemist's Supplies", equipmentId: 'alchemists-supplies', line: 9668 },
  { id: 'brewers-supplies', name: "Brewer's Supplies", equipmentId: 'brewers-supplies', line: 9680 },
  { id: 'calligraphers-supplies', name: "Calligrapher's Supplies", equipmentId: 'calligraphers-supplies', line: 9690 },
  { id: 'carpenters-tools', name: "Carpenter's Tools", equipmentId: 'carpenters-tools', line: 9704 },
  { id: 'cartographers-tools', name: "Cartographer's Tools", equipmentId: 'cartographers-tools', line: 9712 },
  { id: 'cobblers-tools', name: "Cobbler's Tools", equipmentId: 'cobblers-tools', line: 9720 },
  { id: 'cooks-utensils', name: "Cook's Utensils", equipmentId: 'cooks-utensils', line: 9730 },
  { id: 'glassblowers-tools', name: "Glassblower's Tools", equipmentId: 'glassblowers-tools', line: 9742 },
  { id: 'jewelers-tools', name: "Jeweler's Tools", equipmentId: 'jewelers-tools', line: 9750 },
  { id: 'leatherworkers-tools', name: "Leatherworker's Tools", equipmentId: 'leatherworkers-tools', line: 9760 },
  { id: 'masons-tools', name: "Mason's Tools", equipmentId: 'masons-tools', line: 9772 },
  { id: 'painters-supplies', name: "Painter's Supplies", equipmentId: 'painters-supplies', line: 9780 },
  { id: 'potters-tools', name: "Potter's Tools", equipmentId: 'potters-tools', line: 9790 },
  { id: 'smiths-tools', name: "Smith's Tools", equipmentId: 'smiths-tools', line: 9800 },
  { id: 'tinkers-tools', name: "Tinker's Tools", equipmentId: 'tinkers-tools', line: 9822 },
  { id: 'weavers-tools', name: "Weaver's Tools", equipmentId: 'weavers-tools', line: 9832 },
  { id: 'woodcarvers-tools', name: "Woodcarver's Tools", equipmentId: 'woodcarvers-tools', line: 9840 },
];

export const GOLDEN_MUSICAL_INSTRUMENT_COUNT = 10;
export const MUSICAL_INSTRUMENTS_GOLDEN: readonly GoldenToolOption[] = [
  { id: 'bagpipes', name: 'Bagpipes', equipmentId: 'instrument-bagpipes', line: 9896 },
  { id: 'drum', name: 'Drum', equipmentId: 'instrument-drum', line: 9896 },
  { id: 'dulcimer', name: 'Dulcimer', equipmentId: 'instrument-dulcimer', line: 9896 },
  { id: 'flute', name: 'Flute', equipmentId: 'instrument-flute', line: 9896 },
  { id: 'horn', name: 'Horn', equipmentId: 'instrument-horn', line: 9896 },
  { id: 'lute', name: 'Lute', equipmentId: 'instrument-lute', line: 9896 },
  { id: 'lyre', name: 'Lyre', equipmentId: 'instrument-lyre', line: 9896 },
  { id: 'pan-flute', name: 'Pan Flute', equipmentId: 'instrument-pan-flute', line: 9896 },
  { id: 'shawm', name: 'Shawm', equipmentId: 'instrument-shawm', line: 9896 },
  { id: 'viol', name: 'Viol', equipmentId: 'instrument-viol', line: 9896 },
];
