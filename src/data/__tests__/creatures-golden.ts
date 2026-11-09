/**
 * GOLDEN FIXTURE for the companion creature stat block catalog (Stage 1c).
 *
 * Authored from the PRINTED PAGES of the Monster Manual 2024 PDF
 * (Docs/DnD 5e 2024 Monster Manual Alternate Cover.pdf, Appendix A: Animals,
 * printed page = PDF page - 3), read as page images, plus the PHB 2024 text for
 * the creatures that are not in the MM Animals appendix (Primal Companion
 * beasts, the Imp/Pseudodragon/Quasit/Slaad Tadpole/Sphinx of Wonder/Sprite
 * familiar forms, Skeleton, Zombie, Otherworldly Steed). Independent of
 * src/data/creatures.ts: nothing is imported from the app.
 *
 * SAVES: the printed SAVE column carries real values. A save equals the
 * ability modifier, or modifier + Proficiency Bonus when the creature is
 * proficient. `printedSaves` lists ONLY the abilities whose printed save
 * differs from the modifier (the proficient ones); every other save equals the
 * modifier.
 *
 * PRECEDENCE (rules-compliance): PHB 2024 > DMG 2024 > Tasha's > Monster
 * Manual 2024. Where the PHB text and the MM differ for a PHB-sourced
 * creature, the PHB value is kept and the difference is recorded in
 * `conflicts` (and in findings-1c.md). For the Appendix A animals the MM page
 * is the source and wins over the earlier OCR-based golden.
 *
 * Findings: .agents/tasks/creatures-catalog/findings-1c.md
 */

export type GoldenCreatureGroup = 'primal-companion' | 'familiar' | 'steed' | 'animal' | 'undead';

export type GoldenCreatureUsage =
  | 'primal-companion'
  /** Named in the Find Familiar form list (PHB). */
  | 'familiar-normal'
  /** A Beast with CR 0 not named in the list ("or another Beast that has a Challenge Rating of 0"). */
  | 'familiar-cr0'
  /** Pact of the Chain special form (PHB). */
  | 'familiar-special'
  | 'find-steed'
  | 'phantom-steed'
  /** Listed in the Mounts and Other Animals table (PHB). */
  | 'mounts-table'
  | 'animate-dead';

export type GoldenSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge';
export type GoldenAbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export interface GoldenSpeeds {
  walk: number;
  climb?: number;
  fly?: number;
  swim?: number;
  burrow?: number;
}

export interface GoldenAbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface GoldenSource {
  book: 'MM' | 'PHB';
  /** PHB: 1-based line of Docs/PlayersHandbook.md (grep numbering). */
  line?: number;
  /** MM: printed page number and PDF page (printed = PDF - 3). */
  printedPage?: number;
  pdfPage?: number;
  /** PHB-sourced creature that also has a block in the MM A-Z section. */
  mmCrossCheck?: { printedPage: number; pdfPage: number };
}

export interface GoldenAttack {
  name: string;
  /** 'save' = no attack roll: a saving throw action (Trample, Constrict, Sting, Web ...). */
  kind: 'melee' | 'ranged' | 'save';
  bonus: number | null;
  saveDc?: number;
  saveAbility?: GoldenAbilityKey;
  /** Normal damage dice, spaces removed. Flat damage is a plain number string ("1"); "0" = no damage. */
  damage: string;
  damageType: string;
  /** Extra damage of other types that is part of the same Hit (e.g. Poison on a Spider bite). */
  extraDamage?: ReadonlyArray<{ dice: string; type: string }>;
  reach?: number;
  range?: string;
  /** Conditional rider (charge damage, grapple, Prone ...). Required when the catalog lists rider damage. */
  note?: string;
}

export interface GoldenCreature {
  id: string;
  name: string;
  group: GoldenCreatureGroup;
  usage: ReadonlyArray<GoldenCreatureUsage>;
  source: GoldenSource;
  size: GoldenSize;
  type: string;
  subtype?: string;
  alignment: string;
  ac: number;
  hp: { avg: number; dice: string };
  initiative: number;
  speeds: GoldenSpeeds;
  abilities: GoldenAbilityScores;
  /** Printed saves that differ from the modifier (proficient saves). */
  printedSaves?: Partial<Record<GoldenAbilityKey, number>>;
  skills: ReadonlyArray<string>;
  resistances?: ReadonlyArray<string>;
  vulnerabilities?: ReadonlyArray<string>;
  immunities?: ReadonlyArray<string>;
  senses: string;
  passivePerception: number;
  languages: string;
  cr: string;
  xp: number;
  traitNames: ReadonlyArray<string>;
  /** Action names; a printed usage suffix such as "(Recharge 6)" is allowed. */
  actionNames: ReadonlyArray<string>;
  bonusActionNames?: ReadonlyArray<string>;
  reactionNames?: ReadonlyArray<string>;
  attacks: ReadonlyArray<GoldenAttack>;
  mountTable?: { carryingCapacityLb: number; costGp: number };
  /** PHB-vs-MM differences (PHB value kept). */
  conflicts?: ReadonlyArray<string>;
  notes?: ReadonlyArray<string>;
}

const mm = (pdf: number): GoldenSource => ({ book: 'MM', printedPage: pdf - 3, pdfPage: pdf });
const phb = (line: number, mmPdf?: number): GoldenSource => ({
  book: 'PHB',
  line,
  ...(mmPdf ? { mmCrossCheck: { printedPage: mmPdf - 3, pdfPage: mmPdf } } : {}),
});

const bite = (bonus: number, dmg: string, type = 'Piercing', extra: Partial<GoldenAttack> = {}): GoldenAttack => ({
  name: 'Bite', kind: 'melee', bonus, damage: dmg, damageType: type, reach: 5, ...extra,
});

/**
 * Every in-scope creature except the three Primal Companion blocks and the
 * Otherworldly Steed, which are formula-scaled (see below).
 */
export const GOLDEN_CREATURES: ReadonlyArray<GoldenCreature> = [
  // ---- ANIMALS (MM 2024, Appendix A: Animals) ----
  {
    id: 'ape', name: 'Ape', group: 'animal', usage: [], source: mm(351),
    size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: 12, hp: { avg: 19, dice: '3d8+6' }, initiative: 2,
    speeds: { walk: 30, climb: 30 }, abilities: { str: 16, dex: 14, con: 14, int: 6, wis: 12, cha: 7 },
    skills: ['Athletics +5', 'Perception +3'], senses: 'Passive Perception 13', passivePerception: 13, languages: 'None', cr: '1/2', xp: 100,
    traitNames: [], actionNames: ['Multiattack', 'Fist', 'Rock (Recharge 6)'],
    attacks: [
      { name: 'Fist', kind: 'melee', bonus: 5, damage: '1d4+3', damageType: 'Bludgeoning', reach: 5 },
      { name: 'Rock', kind: 'ranged', bonus: 5, damage: '2d6+3', damageType: 'Bludgeoning', range: '25/50 ft.', note: 'Recharge 6' },
    ],
  },
  {
    id: 'badger', name: 'Badger', group: 'animal', usage: ['familiar-cr0'], source: mm(352),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 11, hp: { avg: 5, dice: '1d4+3' }, initiative: 0,
    speeds: { walk: 20, burrow: 5 }, abilities: { str: 10, dex: 11, con: 16, int: 2, wis: 12, cha: 5 },
    skills: ['Perception +3'], resistances: ['Poison'], senses: 'Darkvision 30 ft., Passive Perception 13', passivePerception: 13, languages: 'None', cr: '0', xp: 10,
    traitNames: [], actionNames: ['Bite'], attacks: [bite(2, '1')],
  },
  {
    id: 'bat', name: 'Bat', group: 'animal', usage: ['familiar-normal'], source: mm(352),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 12, hp: { avg: 1, dice: '1d4-1' }, initiative: 2,
    speeds: { walk: 5, fly: 30 }, abilities: { str: 2, dex: 15, con: 8, int: 2, wis: 12, cha: 4 },
    skills: [], senses: 'Blindsight 60 ft., Passive Perception 11', passivePerception: 11, languages: 'None', cr: '0', xp: 10,
    traitNames: [], actionNames: ['Bite'], attacks: [bite(4, '1')],
  },
  {
    id: 'black-bear', name: 'Black Bear', group: 'animal', usage: [], source: mm(352),
    size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: 11, hp: { avg: 19, dice: '3d8+6' }, initiative: 1,
    speeds: { walk: 30, climb: 30, swim: 30 }, abilities: { str: 15, dex: 12, con: 14, int: 2, wis: 12, cha: 7 },
    skills: ['Perception +5'], senses: 'Darkvision 60 ft., Passive Perception 15', passivePerception: 15, languages: 'None', cr: '1/2', xp: 100,
    traitNames: [], actionNames: ['Multiattack', 'Rend'],
    attacks: [{ name: 'Rend', kind: 'melee', bonus: 4, damage: '1d6+2', damageType: 'Slashing', reach: 5 }],
  },
  {
    id: 'boar', name: 'Boar', group: 'animal', usage: [], source: mm(353),
    size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: 11, hp: { avg: 13, dice: '2d8+4' }, initiative: 0,
    speeds: { walk: 40 }, abilities: { str: 13, dex: 11, con: 14, int: 2, wis: 9, cha: 5 },
    skills: [], senses: 'Passive Perception 9', passivePerception: 9, languages: 'None', cr: '1/4', xp: 50,
    traitNames: ['Bloodied Fury'], actionNames: ['Gore'],
    attacks: [{
      name: 'Gore', kind: 'melee', bonus: 3, damage: '1d6+1', damageType: 'Piercing', reach: 5,
      note: 'If the target is Medium or smaller and the boar moved 20+ ft. straight toward it: extra 1d6 Piercing and Prone',
    }],
  },
  {
    id: 'brown-bear', name: 'Brown Bear', group: 'animal', usage: [], source: mm(353),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 11, hp: { avg: 22, dice: '3d10+6' }, initiative: 1,
    speeds: { walk: 40, climb: 30 }, abilities: { str: 17, dex: 12, con: 15, int: 2, wis: 13, cha: 7 },
    skills: ['Perception +3'], senses: 'Darkvision 60 ft., Passive Perception 13', passivePerception: 13, languages: 'None', cr: '1', xp: 200,
    traitNames: [], actionNames: ['Multiattack', 'Bite', 'Claw'],
    attacks: [
      bite(5, '1d8+3'),
      { name: 'Claw', kind: 'melee', bonus: 5, damage: '1d4+3', damageType: 'Slashing', reach: 5, note: 'Prone if Large or smaller' },
    ],
  },
  {
    id: 'camel', name: 'Camel', group: 'animal', usage: ['mounts-table'], source: mm(354),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 10, hp: { avg: 17, dice: '2d10+6' }, initiative: -1,
    speeds: { walk: 50 }, abilities: { str: 15, dex: 8, con: 17, int: 2, wis: 11, cha: 5 }, printedSaves: { con: 5 },
    skills: [], senses: 'Darkvision 60 ft., Passive Perception 10', passivePerception: 10, languages: 'None', cr: '1/8', xp: 25,
    traitNames: [], actionNames: ['Bite'], attacks: [bite(4, '1d4+2', 'Bludgeoning')],
    mountTable: { carryingCapacityLb: 450, costGp: 50 },
    notes: ['CON 17 (+3) with a printed save of +5: verified on the page image at 1.6x.'],
  },
  {
    id: 'cat', name: 'Cat', group: 'animal', usage: ['familiar-normal'], source: mm(354),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 12, hp: { avg: 2, dice: '1d4' }, initiative: 2,
    speeds: { walk: 40, climb: 40 }, abilities: { str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7 }, printedSaves: { dex: 4 },
    skills: ['Perception +3', 'Stealth +4'], senses: 'Darkvision 60 ft., Passive Perception 13', passivePerception: 13, languages: 'None', cr: '0', xp: 10,
    traitNames: ['Jumper'], actionNames: ['Scratch'],
    attacks: [{ name: 'Scratch', kind: 'melee', bonus: 4, damage: '1', damageType: 'Slashing', reach: 5 }],
  },
  {
    id: 'constrictor-snake', name: 'Constrictor Snake', group: 'animal', usage: [], source: mm(354),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 13, hp: { avg: 13, dice: '2d10+2' }, initiative: 2,
    speeds: { walk: 30, swim: 30 }, abilities: { str: 15, dex: 14, con: 12, int: 1, wis: 10, cha: 3 },
    skills: ['Perception +2', 'Stealth +4'], senses: 'Blindsight 10 ft., Passive Perception 12', passivePerception: 12, languages: 'None', cr: '1/4', xp: 50,
    traitNames: [], actionNames: ['Bite', 'Constrict'],
    attacks: [
      bite(4, '1d8+2'),
      { name: 'Constrict', kind: 'save', bonus: null, saveDc: 12, saveAbility: 'str', damage: '3d4', damageType: 'Bludgeoning', note: 'Medium or smaller creature within 5 ft.; Grappled (escape DC 12)' },
    ],
  },
  {
    id: 'crab', name: 'Crab', group: 'animal', usage: ['familiar-cr0'], source: mm(354),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 11, hp: { avg: 3, dice: '1d4+1' }, initiative: 0,
    speeds: { walk: 20, swim: 20 }, abilities: { str: 6, dex: 11, con: 12, int: 1, wis: 8, cha: 2 },
    skills: ['Stealth +2'], senses: 'Blindsight 30 ft., Passive Perception 9', passivePerception: 9, languages: 'None', cr: '0', xp: 10,
    traitNames: ['Amphibious'], actionNames: ['Claw'],
    attacks: [{ name: 'Claw', kind: 'melee', bonus: 2, damage: '1', damageType: 'Bludgeoning', reach: 5 }],
  },
  {
    id: 'crocodile', name: 'Crocodile', group: 'animal', usage: [], source: mm(355),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 12, hp: { avg: 13, dice: '2d10+2' }, initiative: 0,
    speeds: { walk: 20, swim: 30 }, abilities: { str: 15, dex: 10, con: 13, int: 2, wis: 10, cha: 5 }, printedSaves: { con: 3 },
    skills: ['Stealth +2'], senses: 'Passive Perception 10', passivePerception: 10, languages: 'None', cr: '1/2', xp: 100,
    traitNames: ['Hold Breath'], actionNames: ['Bite'],
    attacks: [{
      name: 'Bite', kind: 'melee', bonus: 4, damage: '1d8+2', damageType: 'Piercing', reach: 5,
      note: 'If the target is Medium or smaller: Grappled (escape DC 12); while Grappled it has the Restrained condition',
    }],
  },
  {
    id: 'dire-wolf', name: 'Dire Wolf', group: 'animal', usage: [], source: mm(355),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 14, hp: { avg: 22, dice: '3d10+6' }, initiative: 2,
    speeds: { walk: 50 }, abilities: { str: 17, dex: 15, con: 15, int: 3, wis: 12, cha: 7 },
    skills: ['Perception +5', 'Stealth +4'], senses: 'Darkvision 60 ft., Passive Perception 15', passivePerception: 15, languages: 'None', cr: '1', xp: 200,
    traitNames: ['Pack Tactics'], actionNames: ['Bite'], attacks: [bite(5, '1d10+3', 'Piercing', { note: 'Prone if Large or smaller' })],
  },
  {
    id: 'draft-horse', name: 'Draft Horse', group: 'animal', usage: ['mounts-table'], source: mm(355),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 10, hp: { avg: 15, dice: '2d10+4' }, initiative: 0,
    speeds: { walk: 40 }, abilities: { str: 18, dex: 10, con: 15, int: 2, wis: 11, cha: 7 },
    skills: [], senses: 'Passive Perception 10', passivePerception: 10, languages: 'None', cr: '1/4', xp: 50,
    traitNames: [], actionNames: ['Hooves'],
    attacks: [{ name: 'Hooves', kind: 'melee', bonus: 6, damage: '1d4+4', damageType: 'Bludgeoning', reach: 5 }],
    mountTable: { carryingCapacityLb: 540, costGp: 50 },
  },
  {
    id: 'elephant', name: 'Elephant', group: 'animal', usage: ['mounts-table'], source: mm(356),
    size: 'Huge', type: 'Beast', alignment: 'Unaligned', ac: 12, hp: { avg: 76, dice: '8d12+24' }, initiative: -1,
    speeds: { walk: 40 }, abilities: { str: 22, dex: 9, con: 17, int: 3, wis: 11, cha: 6 },
    skills: [], senses: 'Passive Perception 10', passivePerception: 10, languages: 'None', cr: '4', xp: 1100,
    traitNames: [], actionNames: ['Multiattack', 'Gore'], bonusActionNames: ['Trample'],
    attacks: [
      { name: 'Gore', kind: 'melee', bonus: 8, damage: '2d8+6', damageType: 'Piercing', reach: 5, note: 'Prone if Huge or smaller and the elephant moved 20+ ft. straight toward the target' },
      { name: 'Trample', kind: 'save', bonus: null, saveDc: 16, saveAbility: 'dex', damage: '2d10+6', damageType: 'Bludgeoning', note: 'Creature within 5 ft. with Prone; half damage on a success' },
    ],
    mountTable: { carryingCapacityLb: 1320, costGp: 200 },
  },
  {
    id: 'elk', name: 'Elk', group: 'animal', usage: [], source: mm(356),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 10, hp: { avg: 11, dice: '2d10' }, initiative: 0,
    speeds: { walk: 50 }, abilities: { str: 16, dex: 10, con: 11, int: 2, wis: 10, cha: 6 },
    skills: ['Perception +2'], senses: 'Darkvision 60 ft., Passive Perception 12', passivePerception: 12, languages: 'None', cr: '1/4', xp: 50,
    traitNames: [], actionNames: ['Ram'],
    attacks: [{ name: 'Ram', kind: 'melee', bonus: 5, damage: '1d6+3', damageType: 'Bludgeoning', reach: 5, note: 'If Large or smaller and the elk moved 20+ ft. straight toward the target: extra 1d6 Bludgeoning and Prone' }],
  },
  {
    id: 'frog', name: 'Frog', group: 'animal', usage: ['familiar-normal'], source: mm(357),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 11, hp: { avg: 1, dice: '1d4-1' }, initiative: 1,
    speeds: { walk: 20, swim: 20 }, abilities: { str: 1, dex: 13, con: 8, int: 1, wis: 8, cha: 3 },
    skills: ['Perception +1', 'Stealth +3'], senses: 'Darkvision 30 ft., Passive Perception 11', passivePerception: 11, languages: 'None', cr: '0', xp: 10,
    traitNames: ['Amphibious', 'Standing Leap'], actionNames: ['Bite'], attacks: [bite(3, '1')],
  },
  {
    id: 'giant-badger', name: 'Giant Badger', group: 'animal', usage: [], source: mm(357),
    size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: 13, hp: { avg: 15, dice: '2d8+6' }, initiative: 0,
    speeds: { walk: 30, burrow: 10 }, abilities: { str: 13, dex: 10, con: 17, int: 2, wis: 12, cha: 5 },
    skills: ['Perception +3'], resistances: ['Poison'], senses: 'Darkvision 60 ft., Passive Perception 13', passivePerception: 13, languages: 'None', cr: '1/4', xp: 50,
    traitNames: [], actionNames: ['Bite'], attacks: [bite(3, '2d4+1')],
  },
  {
    id: 'giant-crab', name: 'Giant Crab', group: 'animal', usage: [], source: mm(359),
    size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: 15, hp: { avg: 13, dice: '3d8' }, initiative: 1,
    speeds: { walk: 30, swim: 30 }, abilities: { str: 13, dex: 13, con: 11, int: 1, wis: 9, cha: 3 },
    skills: ['Stealth +3'], senses: 'Blindsight 30 ft., Passive Perception 9', passivePerception: 9, languages: 'None', cr: '1/8', xp: 25,
    traitNames: ['Amphibious'], actionNames: ['Claw'],
    attacks: [{ name: 'Claw', kind: 'melee', bonus: 3, damage: '1d6+1', damageType: 'Bludgeoning', reach: 5, note: 'Medium or smaller: Grappled (escape DC 11); two claws, each can grapple one target' }],
  },
  {
    id: 'giant-goat', name: 'Giant Goat', group: 'animal', usage: [], source: mm(360),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 11, hp: { avg: 19, dice: '3d10+3' }, initiative: 1,
    speeds: { walk: 40, climb: 30 }, abilities: { str: 17, dex: 12, con: 12, int: 3, wis: 12, cha: 6 }, printedSaves: { str: 5 },
    skills: ['Perception +3'], senses: 'Darkvision 60 ft., Passive Perception 13', passivePerception: 13, languages: 'None', cr: '1/2', xp: 100,
    traitNames: [], actionNames: ['Ram'],
    attacks: [{ name: 'Ram', kind: 'melee', bonus: 5, damage: '1d6+3', damageType: 'Bludgeoning', reach: 5, note: 'If Large or smaller and the goat moved 20+ ft. straight toward the target: extra 2d4 Bludgeoning and Prone' }],
  },
  {
    id: 'giant-seahorse', name: 'Giant Seahorse', group: 'animal', usage: [], source: mm(362),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 14, hp: { avg: 16, dice: '3d10' }, initiative: 1,
    speeds: { walk: 5, swim: 40 }, abilities: { str: 15, dex: 12, con: 11, int: 2, wis: 12, cha: 5 },
    skills: [], senses: 'Passive Perception 11', passivePerception: 11, languages: 'None', cr: '1/2', xp: 100,
    traitNames: ['Water Breathing'], actionNames: ['Ram'], bonusActionNames: ['Bubble Dash'],
    attacks: [{ name: 'Ram', kind: 'melee', bonus: 4, damage: '2d6+2', damageType: 'Bludgeoning', reach: 5, note: '2d8+2 Bludgeoning instead if it moved 20+ ft. straight toward the target' }],
  },
  {
    id: 'giant-spider', name: 'Giant Spider', group: 'animal', usage: [], source: mm(362),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 14, hp: { avg: 26, dice: '4d10+4' }, initiative: 3,
    speeds: { walk: 30, climb: 30 }, abilities: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
    skills: ['Perception +4', 'Stealth +7'], senses: 'Darkvision 60 ft., Passive Perception 14', passivePerception: 14, languages: 'None', cr: '1', xp: 200,
    traitNames: ['Spider Climb', 'Web Walker'], actionNames: ['Bite', 'Web (Recharge 5-6)'],
    attacks: [
      bite(5, '1d8+3', 'Piercing', { extraDamage: [{ dice: '2d6', type: 'Poison' }] }),
      { name: 'Web', kind: 'save', bonus: null, saveDc: 13, saveAbility: 'dex', damage: '0', damageType: 'none', note: 'Restrained until the web is destroyed (AC 10; HP 5)' },
    ],
  },
  {
    id: 'giant-weasel', name: 'Giant Weasel', group: 'animal', usage: [], source: mm(364),
    size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: 13, hp: { avg: 9, dice: '2d8' }, initiative: 3,
    speeds: { walk: 40, climb: 30 }, abilities: { str: 11, dex: 17, con: 10, int: 4, wis: 12, cha: 5 },
    skills: ['Acrobatics +5', 'Perception +3', 'Stealth +5'], senses: 'Darkvision 60 ft., Passive Perception 13', passivePerception: 13, languages: 'None', cr: '1/8', xp: 25,
    traitNames: [], actionNames: ['Bite'], attacks: [bite(5, '1d4+3')],
  },
  {
    id: 'goat', name: 'Goat', group: 'animal', usage: ['familiar-cr0'], source: mm(365),
    size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: 10, hp: { avg: 4, dice: '1d8' }, initiative: 0,
    speeds: { walk: 40, climb: 30 }, abilities: { str: 11, dex: 10, con: 11, int: 2, wis: 10, cha: 5 }, printedSaves: { str: 2 },
    skills: ['Perception +2'], senses: 'Darkvision 60 ft., Passive Perception 12', passivePerception: 12, languages: 'None', cr: '0', xp: 10,
    traitNames: [], actionNames: ['Ram'],
    attacks: [{ name: 'Ram', kind: 'melee', bonus: 2, damage: '1', damageType: 'Bludgeoning', reach: 5, note: '2 (1d4) Bludgeoning instead if it moved 20+ ft. straight toward the target' }],
  },
  {
    id: 'hawk', name: 'Hawk', group: 'animal', usage: ['familiar-normal'], source: mm(365),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 13, hp: { avg: 1, dice: '1d4-1' }, initiative: 3,
    speeds: { walk: 10, fly: 60 }, abilities: { str: 5, dex: 16, con: 8, int: 2, wis: 14, cha: 6 },
    skills: ['Perception +6'], senses: 'Passive Perception 16', passivePerception: 16, languages: 'None', cr: '0', xp: 10,
    traitNames: [], actionNames: ['Talons'],
    attacks: [{ name: 'Talons', kind: 'melee', bonus: 5, damage: '1', damageType: 'Slashing', reach: 5 }],
  },
  {
    id: 'lion', name: 'Lion', group: 'animal', usage: [], source: mm(367),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 12, hp: { avg: 22, dice: '4d10' }, initiative: 2,
    speeds: { walk: 50 }, abilities: { str: 17, dex: 15, con: 11, int: 3, wis: 12, cha: 8 },
    skills: ['Perception +3', 'Stealth +4'], senses: 'Darkvision 60 ft., Passive Perception 13', passivePerception: 13, languages: 'None', cr: '1', xp: 200,
    traitNames: ['Pack Tactics', 'Running Leap'], actionNames: ['Multiattack', 'Rend', 'Roar'],
    attacks: [
      { name: 'Rend', kind: 'melee', bonus: 5, damage: '1d8+3', damageType: 'Slashing', reach: 5 },
      { name: 'Roar', kind: 'save', bonus: null, saveDc: 11, saveAbility: 'wis', damage: '0', damageType: 'none', note: 'Creature within 15 ft.; Frightened until the start of the lion\'s next turn' },
    ],
  },
  {
    id: 'lizard', name: 'Lizard', group: 'animal', usage: ['familiar-normal'], source: mm(367),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 10, hp: { avg: 2, dice: '1d4' }, initiative: 0,
    speeds: { walk: 20, climb: 20 }, abilities: { str: 2, dex: 11, con: 10, int: 1, wis: 8, cha: 3 },
    skills: [], senses: 'Darkvision 30 ft., Passive Perception 9', passivePerception: 9, languages: 'None', cr: '0', xp: 10,
    traitNames: ['Spider Climb'], actionNames: ['Bite'], attacks: [bite(2, '1')],
    notes: ['Matches the user screenshot values in the Stage 1c brief.'],
  },
  {
    id: 'mastiff', name: 'Mastiff', group: 'animal', usage: ['mounts-table'], source: mm(368),
    size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: 12, hp: { avg: 5, dice: '1d8+1' }, initiative: 2,
    speeds: { walk: 40 }, abilities: { str: 13, dex: 14, con: 12, int: 3, wis: 12, cha: 7 }, printedSaves: { wis: 3 },
    skills: ['Perception +5'], senses: 'Darkvision 60 ft., Passive Perception 15', passivePerception: 15, languages: 'None', cr: '1/8', xp: 25,
    traitNames: [], actionNames: ['Bite'], attacks: [bite(3, '1d6+1', 'Piercing', { note: 'Prone if Medium or smaller' })],
    mountTable: { carryingCapacityLb: 195, costGp: 25 },
  },
  {
    id: 'mule', name: 'Mule', group: 'animal', usage: ['mounts-table'], source: mm(368),
    size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: 10, hp: { avg: 11, dice: '2d8+2' }, initiative: 0,
    speeds: { walk: 40 }, abilities: { str: 14, dex: 10, con: 13, int: 2, wis: 10, cha: 5 }, printedSaves: { str: 4 },
    skills: [], senses: 'Passive Perception 10', passivePerception: 10, languages: 'None', cr: '1/8', xp: 25,
    traitNames: ['Beast of Burden'], actionNames: ['Hooves'],
    attacks: [{ name: 'Hooves', kind: 'melee', bonus: 4, damage: '1d4+2', damageType: 'Bludgeoning', reach: 5 }],
    mountTable: { carryingCapacityLb: 420, costGp: 8 },
  },
  {
    id: 'octopus', name: 'Octopus', group: 'animal', usage: ['familiar-normal'], source: mm(368),
    size: 'Small', type: 'Beast', alignment: 'Unaligned', ac: 12, hp: { avg: 3, dice: '1d6' }, initiative: 2,
    speeds: { walk: 5, swim: 30 }, abilities: { str: 4, dex: 15, con: 11, int: 3, wis: 10, cha: 4 },
    skills: ['Perception +2', 'Stealth +6'], senses: 'Darkvision 30 ft., Passive Perception 12', passivePerception: 12, languages: 'None', cr: '0', xp: 10,
    traitNames: ['Compression', 'Water Breathing'], actionNames: ['Tentacles'], reactionNames: ['Ink Cloud (1/Day)'],
    attacks: [{ name: 'Tentacles', kind: 'melee', bonus: 4, damage: '1', damageType: 'Bludgeoning', reach: 5 }],
  },
  {
    id: 'owl', name: 'Owl', group: 'animal', usage: ['familiar-normal'], source: mm(369),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 11, hp: { avg: 1, dice: '1d4-1' }, initiative: 1,
    speeds: { walk: 5, fly: 60 }, abilities: { str: 3, dex: 13, con: 8, int: 2, wis: 12, cha: 7 },
    skills: ['Perception +5', 'Stealth +5'], senses: 'Darkvision 120 ft., Passive Perception 15', passivePerception: 15, languages: 'None', cr: '0', xp: 10,
    traitNames: ['Flyby'], actionNames: ['Talons'],
    attacks: [{ name: 'Talons', kind: 'melee', bonus: 3, damage: '1', damageType: 'Slashing', reach: 5 }],
  },
  {
    id: 'panther', name: 'Panther', group: 'animal', usage: [], source: mm(369),
    size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: 13, hp: { avg: 13, dice: '3d8' }, initiative: 3,
    speeds: { walk: 50, climb: 40 }, abilities: { str: 14, dex: 16, con: 10, int: 3, wis: 14, cha: 7 },
    skills: ['Perception +4', 'Stealth +7'], senses: 'Darkvision 60 ft., Passive Perception 14', passivePerception: 14, languages: 'None', cr: '1/4', xp: 50,
    traitNames: [], actionNames: ['Rend'], bonusActionNames: ['Nimble Escape'],
    attacks: [{ name: 'Rend', kind: 'melee', bonus: 5, damage: '1d6+3', damageType: 'Slashing', reach: 5 }],
  },
  {
    id: 'pony', name: 'Pony', group: 'animal', usage: ['mounts-table'], source: mm(370),
    size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: 10, hp: { avg: 11, dice: '2d8+2' }, initiative: 0,
    speeds: { walk: 40 }, abilities: { str: 15, dex: 10, con: 13, int: 2, wis: 11, cha: 7 }, printedSaves: { str: 4 },
    skills: [], senses: 'Passive Perception 10', passivePerception: 10, languages: 'None', cr: '1/8', xp: 25,
    traitNames: [], actionNames: ['Hooves'],
    attacks: [{ name: 'Hooves', kind: 'melee', bonus: 4, damage: '1d4+2', damageType: 'Bludgeoning', reach: 5 }],
    mountTable: { carryingCapacityLb: 225, costGp: 30 },
  },
  {
    id: 'rat', name: 'Rat', group: 'animal', usage: ['familiar-normal'], source: mm(370),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 10, hp: { avg: 1, dice: '1d4-1' }, initiative: 0,
    speeds: { walk: 20, climb: 20 }, abilities: { str: 2, dex: 11, con: 9, int: 2, wis: 10, cha: 4 },
    skills: ['Perception +2'], senses: 'Darkvision 30 ft., Passive Perception 12', passivePerception: 12, languages: 'None', cr: '0', xp: 10,
    traitNames: ['Agile'], actionNames: ['Bite'], attacks: [bite(2, '1')],
  },
  {
    id: 'raven', name: 'Raven', group: 'animal', usage: ['familiar-normal'], source: mm(371),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 12, hp: { avg: 2, dice: '1d4' }, initiative: 2,
    speeds: { walk: 10, fly: 50 }, abilities: { str: 2, dex: 14, con: 10, int: 5, wis: 13, cha: 6 },
    skills: ['Perception +3'], senses: 'Passive Perception 13', passivePerception: 13, languages: 'None', cr: '0', xp: 10,
    traitNames: ['Mimicry'], actionNames: ['Beak'],
    attacks: [{ name: 'Beak', kind: 'melee', bonus: 4, damage: '1', damageType: 'Piercing', reach: 5 }],
  },
  {
    id: 'reef-shark', name: 'Reef Shark', group: 'animal', usage: [], source: mm(371),
    size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: 12, hp: { avg: 22, dice: '4d8+4' }, initiative: 2,
    speeds: { walk: 5, swim: 30 }, abilities: { str: 14, dex: 15, con: 13, int: 1, wis: 10, cha: 4 },
    skills: ['Perception +2'], senses: 'Blindsight 30 ft., Passive Perception 12', passivePerception: 12, languages: 'None', cr: '1/2', xp: 100,
    traitNames: ['Pack Tactics', 'Water Breathing'], actionNames: ['Bite'], attacks: [bite(4, '2d4+2')],
  },
  {
    id: 'scorpion', name: 'Scorpion', group: 'animal', usage: ['familiar-cr0'], source: mm(372),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 11, hp: { avg: 1, dice: '1d4-1' }, initiative: 0,
    speeds: { walk: 10 }, abilities: { str: 2, dex: 11, con: 8, int: 1, wis: 8, cha: 2 },
    skills: [], senses: 'Blindsight 10 ft., Passive Perception 9', passivePerception: 9, languages: 'None', cr: '0', xp: 10,
    traitNames: [], actionNames: ['Sting'],
    attacks: [{ name: 'Sting', kind: 'melee', bonus: 2, damage: '1', damageType: 'Piercing', reach: 5, extraDamage: [{ dice: '1d6', type: 'Poison' }] }],
  },
  {
    id: 'spider', name: 'Spider', group: 'animal', usage: ['familiar-normal'], source: mm(372),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 12, hp: { avg: 1, dice: '1d4-1' }, initiative: 2,
    speeds: { walk: 20, climb: 20 }, abilities: { str: 2, dex: 14, con: 8, int: 1, wis: 10, cha: 2 },
    skills: ['Stealth +4'], senses: 'Darkvision 30 ft., Passive Perception 10', passivePerception: 10, languages: 'None', cr: '0', xp: 10,
    traitNames: ['Spider Climb', 'Web Walker'], actionNames: ['Bite'], attacks: [bite(4, '1', 'Piercing', { extraDamage: [{ dice: '1d4', type: 'Poison' }] })],
  },
  {
    id: 'tiger', name: 'Tiger', group: 'animal', usage: [], source: mm(374),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 13, hp: { avg: 30, dice: '4d10+8' }, initiative: 3,
    speeds: { walk: 40 }, abilities: { str: 17, dex: 16, con: 14, int: 3, wis: 12, cha: 8 },
    skills: ['Perception +3', 'Stealth +7'], senses: 'Darkvision 60 ft., Passive Perception 13', passivePerception: 13, languages: 'None', cr: '1', xp: 200,
    traitNames: [], actionNames: ['Rend'], bonusActionNames: ['Nimble Escape'],
    attacks: [{ name: 'Rend', kind: 'melee', bonus: 5, damage: '2d6+3', damageType: 'Slashing', reach: 5, note: 'Prone if Large or smaller' }],
  },
  {
    id: 'venomous-snake', name: 'Venomous Snake', group: 'animal', usage: ['familiar-special'], source: mm(375),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 12, hp: { avg: 5, dice: '2d4' }, initiative: 2,
    speeds: { walk: 30, swim: 30 }, abilities: { str: 2, dex: 15, con: 11, int: 1, wis: 10, cha: 3 },
    skills: [], senses: 'Blindsight 10 ft., Passive Perception 10', passivePerception: 10, languages: 'None', cr: '1/8', xp: 25,
    traitNames: [], actionNames: ['Bite'], attacks: [bite(4, '1d4+2', 'Piercing', { extraDamage: [{ dice: '1d6', type: 'Poison' }] })],
  },
  {
    id: 'warhorse', name: 'Warhorse', group: 'animal', usage: ['mounts-table'], source: mm(376),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 11, hp: { avg: 19, dice: '3d10+3' }, initiative: 1,
    speeds: { walk: 60 }, abilities: { str: 18, dex: 12, con: 13, int: 2, wis: 12, cha: 7 }, printedSaves: { wis: 3 },
    skills: [], senses: 'Passive Perception 11', passivePerception: 11, languages: 'None', cr: '1/2', xp: 100,
    traitNames: [], actionNames: ['Hooves'],
    attacks: [{ name: 'Hooves', kind: 'melee', bonus: 6, damage: '2d4+4', damageType: 'Bludgeoning', reach: 5, note: 'If Large or smaller and the horse moved 20+ ft. straight toward the target: extra 2d4 Bludgeoning and Prone' }],
    mountTable: { carryingCapacityLb: 540, costGp: 400 },
  },
  {
    id: 'weasel', name: 'Weasel', group: 'animal', usage: ['familiar-normal'], source: mm(376),
    size: 'Tiny', type: 'Beast', alignment: 'Unaligned', ac: 13, hp: { avg: 1, dice: '1d4-1' }, initiative: 3,
    speeds: { walk: 30, climb: 30 }, abilities: { str: 3, dex: 16, con: 8, int: 2, wis: 12, cha: 3 },
    skills: ['Acrobatics +5', 'Perception +3', 'Stealth +5'], senses: 'Darkvision 60 ft., Passive Perception 13', passivePerception: 13, languages: 'None', cr: '0', xp: 10,
    traitNames: [], actionNames: ['Bite'], attacks: [bite(5, '1')],
  },
  {
    id: 'wolf', name: 'Wolf', group: 'animal', usage: [], source: mm(376),
    size: 'Medium', type: 'Beast', alignment: 'Unaligned', ac: 12, hp: { avg: 11, dice: '2d8+2' }, initiative: 2,
    speeds: { walk: 40 }, abilities: { str: 14, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    skills: ['Perception +5', 'Stealth +4'], senses: 'Darkvision 60 ft., Passive Perception 15', passivePerception: 15, languages: 'None', cr: '1/4', xp: 50,
    traitNames: ['Pack Tactics'], actionNames: ['Bite'], attacks: [bite(4, '1d6+2', 'Piercing', { note: 'Prone if Medium or smaller' })],
  },

  // ---- FAMILIAR SPECIAL FORMS (PHB 2024; MM A-Z cross-check) ----
  {
    id: 'imp', name: 'Imp', group: 'familiar', usage: ['familiar-special'], source: phb(19231, 180),
    size: 'Tiny', type: 'Fiend', subtype: 'Devil', alignment: 'Lawful Evil', ac: 13, hp: { avg: 21, dice: '6d4+6' }, initiative: 3,
    speeds: { walk: 20, fly: 40 }, abilities: { str: 6, dex: 17, con: 13, int: 11, wis: 12, cha: 14 },
    skills: ['Deception +4', 'Insight +3', 'Stealth +5'], resistances: ['Cold'], immunities: ['Fire', 'Poison', 'Poisoned'],
    senses: 'Darkvision 120 ft., Passive Perception 11', passivePerception: 11, languages: 'Common, Infernal', cr: '1', xp: 200,
    traitNames: ["Devil's Sight", 'Magic Resistance'], actionNames: ['Sting', 'Invisibility', 'Shape-Shift'],
    attacks: [{ name: 'Sting', kind: 'melee', bonus: 5, damage: '1d6+3', damageType: 'Piercing', reach: 5, extraDamage: [{ dice: '2d6', type: 'Poison' }] }],
    conflicts: ["PHB lists a separate Devil's Sight trait; the MM prints one trait (Magic Resistance) and folds the magical-Darkness clause into Darkvision. PHB kept."],
  },
  {
    id: 'pseudodragon', name: 'Pseudodragon', group: 'familiar', usage: ['familiar-special'], source: phb(19495, 252),
    size: 'Tiny', type: 'Dragon', alignment: 'Neutral Good', ac: 14, hp: { avg: 10, dice: '3d4+3' }, initiative: 2,
    speeds: { walk: 15, fly: 60 }, abilities: { str: 6, dex: 15, con: 13, int: 10, wis: 12, cha: 10 },
    skills: ['Perception +5', 'Stealth +4'], senses: 'Blindsight 10 ft., Darkvision 60 ft., Passive Perception 15', passivePerception: 15,
    languages: "Understands Common and Draconic but can't speak", cr: '1/4', xp: 50,
    traitNames: ['Magic Resistance'], actionNames: ['Multiattack', 'Bite', 'Sting'],
    attacks: [
      bite(4, '1d4+2'),
      { name: 'Sting', kind: 'save', bonus: null, saveDc: 12, saveAbility: 'con', damage: '2d4+2', damageType: 'Poison', note: 'Creature within 5 ft.; Failure: Poisoned for 1 hour; failure by 5+: also Unconscious until it takes damage or is shaken awake' },
    ],
    conflicts: ['Sting damage: PHB text 2d4 + 2 (kept); MM prints 5 (2d4) with no flat bonus.'],
  },
  {
    id: 'quasit', name: 'Quasit', group: 'familiar', usage: ['familiar-special'], source: phb(19635, 255),
    size: 'Tiny', type: 'Fiend', subtype: 'Demon', alignment: 'Chaotic Evil', ac: 13, hp: { avg: 25, dice: '10d4' }, initiative: 3,
    speeds: { walk: 40 }, abilities: { str: 5, dex: 17, con: 10, int: 7, wis: 10, cha: 10 },
    skills: ['Stealth +5'], resistances: ['Cold', 'Fire', 'Lightning'], immunities: ['Poison', 'Poisoned'],
    senses: 'Darkvision 120 ft., Passive Perception 10', passivePerception: 10, languages: 'Abyssal, Common', cr: '1', xp: 200,
    traitNames: ['Magic Resistance'], actionNames: ['Rend', 'Invisibility', 'Scare (1/Day)', 'Shape-Shift'],
    attacks: [
      { name: 'Rend', kind: 'melee', bonus: 5, damage: '1d4+3', damageType: 'Slashing', reach: 5, note: "Target has the Poisoned condition until the start of the quasit's next turn" },
      { name: 'Scare (1/Day)', kind: 'save', bonus: null, saveDc: 10, saveAbility: 'wis', damage: '0', damageType: 'none', range: '20 ft.', note: 'Frightened; repeats the save at the end of each turn; automatic success after 1 minute' },
    ],
  },
  {
    id: 'slaad-tadpole', name: 'Slaad Tadpole', group: 'familiar', usage: ['familiar-special'], source: phb(20021, 287),
    size: 'Tiny', type: 'Aberration', alignment: 'Chaotic Neutral', ac: 12, hp: { avg: 7, dice: '3d4' }, initiative: 2,
    speeds: { walk: 30, burrow: 10 }, abilities: { str: 7, dex: 15, con: 10, int: 3, wis: 5, cha: 3 },
    skills: ['Stealth +4'], resistances: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
    senses: 'Darkvision 60 ft., Passive Perception 7', passivePerception: 7, languages: "Understands Slaad but can't speak", cr: '1/8', xp: 25,
    traitNames: ['Magic Resistance'], actionNames: ['Bite'], attacks: [bite(4, '1d6+2')],
  },
  {
    id: 'sphinx-of-wonder', name: 'Sphinx of Wonder', group: 'familiar', usage: ['familiar-special'], source: phb(20073, 294),
    size: 'Tiny', type: 'Celestial', alignment: 'Lawful Good', ac: 13, hp: { avg: 24, dice: '7d4+7' }, initiative: 3,
    speeds: { walk: 20, fly: 40 }, abilities: { str: 6, dex: 17, con: 13, int: 15, wis: 12, cha: 11 },
    skills: ['Arcana +4', 'Religion +4', 'Stealth +5'], resistances: ['Necrotic', 'Psychic', 'Radiant'],
    senses: 'Darkvision 60 ft., Passive Perception 11', passivePerception: 11, languages: 'Celestial, Common', cr: '1', xp: 200,
    traitNames: ['Magic Resistance'], actionNames: ['Rend'], reactionNames: ['Burst of Ingenuity (2/Day)'],
    attacks: [{ name: 'Rend', kind: 'melee', bonus: 5, damage: '1d4+3', damageType: 'Slashing', reach: 5, extraDamage: [{ dice: '2d6', type: 'Radiant' }] }],
  },
  {
    id: 'sprite', name: 'Sprite', group: 'familiar', usage: ['familiar-special'], source: phb(20217, 301),
    size: 'Tiny', type: 'Fey', alignment: 'Neutral Good', ac: 15, hp: { avg: 10, dice: '4d4' }, initiative: 4,
    speeds: { walk: 10, fly: 40 }, abilities: { str: 3, dex: 18, con: 10, int: 14, wis: 13, cha: 11 },
    skills: ['Perception +3', 'Stealth +8'], senses: 'Passive Perception 13', passivePerception: 13, languages: 'Common, Elvish, Sylvan', cr: '1/4', xp: 50,
    traitNames: [], actionNames: ['Needle Sword', 'Enchanting Bow', 'Heart Sight', 'Invisibility'],
    attacks: [
      { name: 'Needle Sword', kind: 'melee', bonus: 6, damage: '1d4+4', damageType: 'Piercing', reach: 5 },
      { name: 'Enchanting Bow', kind: 'ranged', bonus: 6, damage: '1', damageType: 'Piercing', range: '40/160 ft.', note: "Target has the Charmed condition until the start of the sprite's next turn" },
      { name: 'Heart Sight', kind: 'save', bonus: null, saveDc: 10, saveAbility: 'cha', damage: '0', damageType: 'none', note: 'Creature within 5 ft.; Celestials, Fiends and Undead auto-fail; the sprite learns emotions and alignment' },
    ],
  },

  // ---- STEED (Riding Horse; Phantom Steed) ----
  {
    id: 'riding-horse', name: 'Riding Horse', group: 'steed', usage: ['phantom-steed', 'mounts-table'], source: mm(371),
    size: 'Large', type: 'Beast', alignment: 'Unaligned', ac: 11, hp: { avg: 13, dice: '2d10+2' }, initiative: 1,
    speeds: { walk: 60 }, abilities: { str: 16, dex: 13, con: 12, int: 2, wis: 11, cha: 7 },
    skills: [], senses: 'Passive Perception 10', passivePerception: 10, languages: 'None', cr: '1/4', xp: 50,
    traitNames: [], actionNames: ['Hooves'],
    attacks: [{ name: 'Hooves', kind: 'melee', bonus: 5, damage: '1d8+3', damageType: 'Bludgeoning', reach: 5 }],
    mountTable: { carryingCapacityLb: 480, costGp: 75 },
    notes: ['Phantom Steed (PHB) uses this block with Speed 100 ft.; the PHB Appendix B block (L19871) has the same numbers.'],
  },

  // ---- UNDEAD (Animate Dead; PHB 2024, MM A-Z cross-check) ----
  {
    id: 'skeleton', name: 'Skeleton', group: 'undead', usage: ['animate-dead', 'familiar-special'], source: phb(19969, 285),
    size: 'Medium', type: 'Undead', alignment: 'Lawful Evil', ac: 13, hp: { avg: 13, dice: '2d8+4' }, initiative: 3,
    speeds: { walk: 30 }, abilities: { str: 10, dex: 16, con: 15, int: 6, wis: 8, cha: 5 },
    skills: [], vulnerabilities: ['Bludgeoning'], immunities: ['Poison', 'Exhaustion', 'Poisoned'],
    senses: 'Darkvision 60 ft., Passive Perception 9', passivePerception: 9,
    languages: "Understands the languages it knew in life but can't speak", cr: '1/4', xp: 50,
    traitNames: [], actionNames: ['Shortsword', 'Shortbow'],
    attacks: [
      { name: 'Shortsword', kind: 'melee', bonus: 5, damage: '1d6+3', damageType: 'Piercing', reach: 5 },
      { name: 'Shortbow', kind: 'ranged', bonus: 5, damage: '1d6+3', damageType: 'Piercing', range: '80/320 ft.' },
    ],
    conflicts: [
      'AC: PHB text 13 (kept); MM p. 282 prints 14.',
      'Languages: PHB text "languages it knew in life" (kept); MM prints "Common plus one other language".',
    ],
  },
  {
    id: 'zombie', name: 'Zombie', group: 'undead', usage: ['animate-dead'], source: phb(20503, 349),
    size: 'Medium', type: 'Undead', alignment: 'Neutral Evil', ac: 8, hp: { avg: 15, dice: '2d8+6' }, initiative: -2,
    speeds: { walk: 20 }, abilities: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 }, printedSaves: { wis: 0 },
    skills: [], immunities: ['Poison', 'Exhaustion', 'Poisoned'],
    senses: 'Darkvision 60 ft., Passive Perception 8', passivePerception: 8,
    languages: "Understands the languages it knew in life but can't speak", cr: '1/4', xp: 50,
    traitNames: ['Undead Fortitude'], actionNames: ['Slam'],
    attacks: [{ name: 'Slam', kind: 'melee', bonus: 3, damage: '1d6+1', damageType: 'Bludgeoning', reach: 5 }],
    conflicts: [
      'Slam damage: PHB text 4 (1d6 + 1) (kept); MM p. 346 prints 5 (1d8 + 1).',
      'Languages: PHB text "languages it knew in life" (kept); MM prints "Common plus one other language".',
    ],
    notes: ['WIS 6 (-2) with a printed save of +0 is a proficient save (-2 + PB 2); the MM prints the same +0.'],
  },
];

// ---- PRIMAL COMPANION (Beast Master Ranger, PHB 2024) ----

export interface GoldenPrimalCompanion {
  id: string;
  name: string;
  group: 'primal-companion';
  /** PHB line of the `## BEAST OF THE ...` heading. */
  line: number;
  size: GoldenSize;
  type: 'Beast';
  alignment: 'Neutral';
  /** AC = acBase + the Ranger's Wisdom modifier. */
  acBase: 13;
  /** HP = hpBase + hpPerLevel x Ranger level; Hit Dice are d8s/d6s, one per Ranger level. */
  hpBase: number;
  hpPerLevel: number;
  hitDie: 6 | 8;
  speeds: GoldenSpeeds;
  abilities: GoldenAbilityScores;
  senses: string;
  passivePerception: number;
  languages: string;
  traitNames: ReadonlyArray<string>;
  actionNames: ReadonlyArray<string>;
  strike: {
    dice: string;
    flatBonus: number;
    plusOwnerWisMod: true;
    damageTypes: ReadonlyArray<string>;
    typeChosenOnSummon: boolean;
    riders: ReadonlyArray<string>;
  };
  notes?: ReadonlyArray<string>;
}

export const GOLDEN_PRIMAL_COMPANIONS: ReadonlyArray<GoldenPrimalCompanion> = [
  {
    id: 'beast-of-the-land', name: 'Beast of the Land', group: 'primal-companion', line: 5611,
    size: 'Medium', type: 'Beast', alignment: 'Neutral', acBase: 13, hpBase: 5, hpPerLevel: 5, hitDie: 8,
    speeds: { walk: 40, climb: 40 }, abilities: { str: 14, dex: 14, con: 15, int: 8, wis: 14, cha: 11 },
    senses: 'Darkvision 60 ft., Passive Perception 12', passivePerception: 12, languages: 'Understands the languages you know',
    traitNames: ['Primal Bond'], actionNames: ["Beast's Strike"],
    strike: {
      dice: '1d8', flatBonus: 2, plusOwnerWisMod: true, damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'], typeChosenOnSummon: true,
      riders: ['If it moved 20+ ft. straight toward the target: extra 1d6 damage of the same type, and Prone if Large or smaller'],
    },
    notes: ['Saves not verifiable from the MM (the Primal Companion blocks are PHB only); treated as equal to the modifier.'],
  },
  {
    id: 'beast-of-the-sky', name: 'Beast of the Sky', group: 'primal-companion', line: 5638,
    size: 'Small', type: 'Beast', alignment: 'Neutral', acBase: 13, hpBase: 4, hpPerLevel: 4, hitDie: 6,
    speeds: { walk: 10, fly: 60 }, abilities: { str: 6, dex: 16, con: 13, int: 8, wis: 14, cha: 11 },
    senses: 'Darkvision 60 ft., Passive Perception 12', passivePerception: 12, languages: 'Understands the languages you know',
    traitNames: ['Flyby', 'Primal Bond'], actionNames: ["Beast's Strike"],
    strike: { dice: '1d4', flatBonus: 3, plusOwnerWisMod: true, damageTypes: ['Slashing'], typeChosenOnSummon: false, riders: [] },
  },
  {
    id: 'beast-of-the-sea', name: 'Beast of the Sea', group: 'primal-companion', line: 5662,
    size: 'Medium', type: 'Beast', alignment: 'Neutral', acBase: 13, hpBase: 5, hpPerLevel: 5, hitDie: 8,
    speeds: { walk: 5, swim: 60 }, abilities: { str: 14, dex: 14, con: 15, int: 8, wis: 14, cha: 11 },
    senses: 'Darkvision 90 ft., Passive Perception 12', passivePerception: 12, languages: 'Understands the languages you know',
    traitNames: ['Amphibious', 'Primal Bond'], actionNames: ["Beast's Strike"],
    strike: {
      dice: '1d6', flatBonus: 2, plusOwnerWisMod: true, damageTypes: ['Bludgeoning', 'Piercing'], typeChosenOnSummon: true,
      riders: ['Target has the Grappled condition (escape DC equals your spell save DC)'],
    },
  },
];

/**
 * Hand-worked examples (PHB): AC = 13 + WIS mod; HP = base + per-level x Ranger
 * level; attack bonus = spell attack modifier = PB + WIS mod; Beast's Strike
 * damage = dice + flat + WIS mod. PB by level: 1-4 +2, 5-8 +3, 9-12 +4, 13-16 +5, 17-20 +6.
 */
export interface GoldenPrimalExample {
  rangerLevel: number;
  wisMod: number;
  pb: number;
  ac: number;
  hp: { land: number; sky: number; sea: number };
  hitDice: { land: string; sky: string; sea: string };
  attackBonus: number;
  strike: { land: string; sky: string; sea: string };
}

export const GOLDEN_PRIMAL_EXAMPLES: ReadonlyArray<GoldenPrimalExample> = [
  { rangerLevel: 3, wisMod: 3, pb: 2, ac: 16, hp: { land: 20, sky: 16, sea: 20 }, hitDice: { land: '3d8', sky: '3d6', sea: '3d8' }, attackBonus: 5, strike: { land: '1d8+5', sky: '1d4+6', sea: '1d6+5' } },
  { rangerLevel: 5, wisMod: 4, pb: 3, ac: 17, hp: { land: 30, sky: 24, sea: 30 }, hitDice: { land: '5d8', sky: '5d6', sea: '5d8' }, attackBonus: 7, strike: { land: '1d8+6', sky: '1d4+7', sea: '1d6+6' } },
  { rangerLevel: 11, wisMod: 4, pb: 4, ac: 17, hp: { land: 60, sky: 48, sea: 60 }, hitDice: { land: '11d8', sky: '11d6', sea: '11d8' }, attackBonus: 8, strike: { land: '1d8+6', sky: '1d4+7', sea: '1d6+6' } },
  { rangerLevel: 20, wisMod: 5, pb: 6, ac: 18, hp: { land: 105, sky: 84, sea: 105 }, hitDice: { land: '20d8', sky: '20d6', sea: '20d8' }, attackBonus: 11, strike: { land: '1d8+7', sky: '1d4+8', sea: '1d6+7' } },
  { rangerLevel: 3, wisMod: -1, pb: 2, ac: 12, hp: { land: 20, sky: 16, sea: 20 }, hitDice: { land: '3d8', sky: '3d6', sea: '3d8' }, attackBonus: 1, strike: { land: '1d8+1', sky: '1d4+2', sea: '1d6+1' } },
];

// ---- OTHERWORLDLY STEED (Find Steed, PHB 2024 p. 273; not in the MM) ----

export interface GoldenOtherworldlySteed {
  id: 'otherworldly-steed';
  name: string;
  group: 'steed';
  /** PHB line of the Find Steed spell (the stat block itself is an image). */
  line: number;
  size: 'Large';
  /** Chosen each time the spell is cast. */
  creatureTypes: ReadonlyArray<string>;
  alignment: 'Neutral';
  /** AC = acBase + acPerSpellLevel x spell level. */
  acBase: number;
  acPerSpellLevel: number;
  /** HP = hpBase + hpPerSpellLevel x spell level; Hit Dice = d10s equal to the spell level. */
  hpBase: number;
  hpPerSpellLevel: number;
  hitDie: number;
  speeds: GoldenSpeeds;
  /** Fly speed requires a spell of at least this level. */
  flyMinSpellLevel: number;
  abilities: GoldenAbilityScores;
  senses: string;
  passivePerception: number;
  languages: string;
  traitNames: ReadonlyArray<string>;
  actionNames: ReadonlyArray<string>;
  bonusActionNames: ReadonlyArray<string>;
  slam: { dice: string; plusSpellLevel: true; reach: 5; typeByCreatureType: Readonly<Record<string, string>> };
  healingTouch: { dice: string; plusSpellLevel: true };
}

export const GOLDEN_OTHERWORLDLY_STEED: GoldenOtherworldlySteed = {
  id: 'otherworldly-steed', name: 'Otherworldly Steed', group: 'steed', line: 13135,
  size: 'Large', creatureTypes: ['Celestial', 'Fey', 'Fiend'], alignment: 'Neutral',
  acBase: 10, acPerSpellLevel: 1, hpBase: 5, hpPerSpellLevel: 10, hitDie: 10,
  speeds: { walk: 60, fly: 60 }, flyMinSpellLevel: 4,
  abilities: { str: 18, dex: 12, con: 14, int: 6, wis: 12, cha: 8 },
  senses: 'Passive Perception 11', passivePerception: 11, languages: 'Telepathy 1 mile (works only with you)',
  traitNames: ['Life Bond'], actionNames: ['Otherworldly Slam'], bonusActionNames: ['Fell Glare', 'Fey Step', 'Healing Touch'],
  slam: { dice: '1d8', plusSpellLevel: true, reach: 5, typeByCreatureType: { Celestial: 'Radiant', Fey: 'Psychic', Fiend: 'Necrotic' } },
  healingTouch: { dice: '2d8', plusSpellLevel: true },
};

export interface GoldenSteedExample {
  spellLevel: number;
  ac: number;
  hp: number;
  hitDice: string;
  /** Slam damage expression for the Celestial form, e.g. "1d8+2". */
  slamDamage: string;
  healing: string;
  hasFly: boolean;
}

export const GOLDEN_STEED_EXAMPLES: ReadonlyArray<GoldenSteedExample> = [
  { spellLevel: 2, ac: 12, hp: 25, hitDice: '2d10', slamDamage: '1d8+2', healing: '2d8+2', hasFly: false },
  { spellLevel: 3, ac: 13, hp: 35, hitDice: '3d10', slamDamage: '1d8+3', healing: '2d8+3', hasFly: false },
  { spellLevel: 4, ac: 14, hp: 45, hitDice: '4d10', slamDamage: '1d8+4', healing: '2d8+4', hasFly: true },
  { spellLevel: 9, ac: 19, hp: 95, hitDice: '9d10', slamDamage: '1d8+9', healing: '2d8+9', hasFly: true },
];

// ---- CARDINALITY ----

export const GOLDEN_GROUP_COUNTS: Record<GoldenCreatureGroup, number> = {
  'primal-companion': 3,
  familiar: 6,
  steed: 2,
  animal: 42,
  undead: 2,
};
/** 3 + 6 + 2 + 42 + 2. */
export const GOLDEN_CREATURE_COUNT = 55;

// ---- EXCLUDED (summoned, temporary) ----

export interface GoldenExcludedCreature {
  name: string;
  line: number;
  spell: string;
  reason: string;
}

export const GOLDEN_EXCLUDED_SUMMONED: ReadonlyArray<GoldenExcludedCreature> = [
  { name: 'Aberrant Spirit', line: 16507, spell: 'Summon Aberration', reason: 'Temporary spirit; Concentration up to 1 hour' },
  { name: 'Bestial Spirit', line: 16581, spell: 'Summon Beast', reason: 'Temporary spirit; Concentration up to 1 hour' },
  { name: 'Celestial Spirit', line: 16635, spell: 'Summon Celestial', reason: 'Temporary spirit; Concentration up to 1 hour' },
  { name: 'Construct Spirit', line: 16706, spell: 'Summon Construct', reason: 'Temporary spirit; Concentration up to 1 hour' },
  { name: 'Draconic Spirit', line: 16745, spell: 'Summon Dragon', reason: 'Temporary spirit; Concentration up to 1 hour' },
  { name: 'Elemental Spirit', line: 16799, spell: 'Summon Elemental', reason: 'Temporary spirit; Concentration up to 1 hour' },
  { name: 'Fey Spirit', line: 16851, spell: 'Summon Fey', reason: 'Temporary spirit; Concentration up to 1 hour' },
  { name: 'Fiendish Spirit', line: 16894, spell: 'Summon Fiend', reason: 'Temporary spirit; Concentration up to 1 hour' },
  { name: 'Undead Spirit', line: 16945, spell: 'Summon Undead', reason: 'Temporary spirit; Concentration up to 1 hour' },
  { name: 'Giant Insect', line: 13543, spell: 'Giant Insect', reason: 'Temporary transformation for the spell duration' },
  { name: 'Animated Object', line: 10997, spell: 'Animate Objects', reason: 'Objects animated for the spell duration' },
];
