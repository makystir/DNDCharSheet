/**
 * Creature stat block catalog (D&D 5.5e / 2024) for permanent / long-lived
 * companions: Primal Companion beasts, familiar forms, steeds, every Beast in
 * PHB Appendix B, plus the Skeleton and Zombie (Animate Dead; an open point).
 *
 * EXCLUDED on purpose (user decision): the temporary Summon * spirit stat
 * blocks, Giant Insect, Animated Object and Conjure * creatures.
 *
 * CONVENTIONS (match data/feats.ts / data/classes.ts):
 *  - One keyed record (CREATURE_CATALOG) plus an ordered CREATURE_LIST. Ids are
 *    kebab-case strings (`CreatureId`) so persisted companion records can
 *    reference them.
 *  - `source.line` is the 1-based line of Docs/PlayersHandbook.md as numbered by
 *    the grep/read tools (the heading line, or the "Size Type, Alignment" line
 *    where the OCR lost the heading). PowerShell Get-Content numbers ~1 lower.
 *  - Descriptions are PARAPHRASED (rules-compliance rule 6); every number, die,
 *    DC, reach/range, damage type and attack bonus is exact.
 *  - Ability modifiers are derived as floor((score - 10) / 2), which matches
 *    every printed modifier fragment in the OCR. Where a score is unreadable
 *    but a modifier is printed, `score` is null and `mod` carries the printed
 *    value. Where neither is readable both are null. NOTHING is invented; every
 *    null is listed in .agents/tasks/creatures-catalog/findings-catalog.md.
 *  - SAVES (Stage 1c): the printed SAVE column carries real values. A save is
 *    the ability modifier, or modifier + Proficiency Bonus when the creature is
 *    proficient (`saveProficient`). Modelled explicitly, e.g. Camel CON +5,
 *    Mastiff WIS +3, Mule STR +4, Crocodile CON +3.
 *  - SOURCES (Stage 1c): the Appendix A animals (and the Riding Horse) are read
 *    from the printed pages of the Monster Manual 2024 PDF (`source.printedPage`
 *    / `pdfPage`; printed = PDF - 3). PHB-only creatures cite the PHB line and,
 *    where the MM has the same block in its A-Z section, `mmCrossCheck`. Where
 *    the two books differ for a PHB-sourced creature the PHB value is kept
 *    (listed in .agents/tasks/creatures-catalog/findings-1c.md).
 *  - The Otherworldly Steed (Find Steed) scales with the spell level; see
 *    `resolveOtherworldlySteed` in src/logic/primal-companion.ts.
 *
 * Primal Companion beasts (PHB Ranger: Beast Master, "Level 3: Primal
 * Companion") scale with the Ranger's level, Wisdom modifier and Proficiency
 * Bonus: their AC / HP / attack are formula descriptors here and are resolved by
 * `src/logic/primal-companion.ts`.
 */

import type { Ability } from '../types/character';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Catalog group. A creature has one primary group; `forms` lists every use. */
export type CreatureKind = 'primal-companion' | 'familiar' | 'steed' | 'animal' | 'undead';

export type CreatureSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge';

export interface CreatureAbility {
  /** Printed score, or null when the OCR lost it. */
  score: number | null;
  /** Modifier: derived from the score, or the printed value when the score is lost. */
  mod: number | null;
  /** Saving throw bonus as printed: `mod`, or `mod` + Proficiency Bonus when `saveProficient`. */
  save: number | null;
  /** True when the creature is proficient in this saving throw. */
  saveProficient: boolean;
}

export type CreatureAbilities = Record<Ability, CreatureAbility>;

export interface CreatureSpeeds {
  walk?: number;
  climb?: number;
  swim?: number;
  fly?: number;
  burrow?: number;
}

/**
 * Armor Class: a printed number, or a formula: the Primal Companion
 * (`base + ability modifier`) or the Otherworldly Steed (`base + perSpellLevel x spell level`).
 */
export type CreatureArmorClass =
  | number
  | null
  | { base: number; plusAbility: Ability }
  | { base: number; perSpellLevel: number };

/** Hit Points: printed average + dice, or a level-scaled formula. */
export type CreatureHitPoints =
  | { average: number | null; dice: string | null }
  | {
      /** HP = base + perLevel x level; Hit Dice = level x d(hitDie). `level` is the Ranger or spell level. */
      formula: { base: number; perLevel: number; hitDie: number; levelSource: 'ranger-level' | 'spell-level' };
    };

export interface CreatureDamage {
  /** Printed average (e.g. 5 for "5 (1d4 + 3)"); null when not printed. */
  average: number | null;
  /** Dice expression with spaces removed ("1d4+3"); flat damage is a plain number ("1"). */
  dice: string;
  type: string;
  /** Primal Companion: the damage also adds this ability modifier of the Ranger. */
  plusAbilityOfOwner?: Ability;
  /** Otherworldly Steed: the damage also adds the level of the spell that summoned it. */
  plusSpellLevel?: boolean;
  /** Primal Companion: the type is chosen when the beast is summoned (e.g. "Bludgeoning, Piercing or Slashing"). */
  typeChoice?: string[];
}

export interface CreatureAttackInfo {
  kind: 'melee' | 'ranged';
  /** Printed attack roll bonus; null for the formula attack of Primal Companions. */
  bonus: number | null;
  /** Primal Companion / Otherworldly Steed: "Bonus equals your spell attack modifier". */
  bonusFormula?: 'spell-attack-modifier';
  reachFt?: number;
  /** Normal / long range in feet. */
  rangeFt?: [number, number];
}

export interface CreatureSave {
  ability: Ability;
  /** Printed DC; null when the DC equals the owner's spell save DC (`dcFormula`). */
  dc: number | null;
  /** Primal Companion grapple / Otherworldly Steed Fell Glare: the DC equals your spell save DC. */
  dcFormula?: 'spell-save-dc';
}

/** A trait, action, bonus action or reaction. */
export interface CreatureFeature {
  name: string;
  /** Paraphrased description; numbers are exact. */
  description: string;
  attack?: CreatureAttackInfo;
  save?: CreatureSave;
  damage?: CreatureDamage[];
  /** Otherworldly Steed Healing Touch: HP regained. */
  healing?: { dice: string; plusSpellLevel?: boolean };
  /** e.g. "Recharge 6", "Recharge 5-6", "1/Day", "2/Day". */
  usage?: string;
}

export interface CreatureSenses {
  blindsightFt?: number;
  darkvisionFt?: number;
  passivePerception: number | null;
}

export interface CreatureChallenge {
  /** "0", "1/8", "1/4", "1/2", "1", "4", ... or "None" (Primal Companion). null when unreadable. */
  cr: string | null;
  xp: number | null;
  /** Proficiency Bonus as printed (+2), or null when it equals the owner's. */
  proficiencyBonus: number | null;
  /** The PB note as printed, paraphrased. */
  pbNote: string;
}

export interface CreatureForms {
  /** Eligible as a Find Familiar / Pact of the Chain familiar form. */
  familiar: boolean;
  /** Eligible as the Wild Companion (Druid) familiar form: the normal Find Familiar forms. */
  wildCompanion: boolean;
  /** A steed stat block (Find Steed's Otherworldly Steed, Phantom Steed's Riding Horse). */
  steed: boolean;
  /** Appears in the Mounts and Other Animals table (PHB Equipment). */
  mount: boolean;
}

/**
 * Where a record comes from. Monster Manual records cite the printed page and
 * the PDF page (printed = PDF - 3); PHB records cite the markdown line.
 */
export interface CreatureSource {
  book: 'PHB 2024' | 'Monster Manual 2024';
  section: string;
  /** PHB: 1-based line of Docs/PlayersHandbook.md (grep numbering). */
  line?: number;
  /** MM-sourced animals that also appear in PHB Appendix B: the PHB line (OCR text, superseded by the MM page). */
  phbLine?: number;
  printedPage?: number;
  pdfPage?: number;
  /** PHB-sourced creature with the same block in the MM A-Z section. */
  mmCrossCheck?: { printedPage: number; pdfPage: number };
}

export interface CreatureStatBlock {
  id: string;
  name: string;
  kind: CreatureKind;
  size: CreatureSize | null;
  /** Creature type: Beast, Fiend, Dragon, Fey, Celestial, Aberration, Undead. */
  creatureType: string | null;
  /** Parenthetical subtype, e.g. 'Devil', 'Demon'. */
  subtype?: string;
  alignment: string | null;
  ac: CreatureArmorClass;
  /** Printed Initiative; modifier equals the Dexterity modifier. null for formula-scaled beasts. */
  initiative: { modifier: number; score: number } | null;
  hp: CreatureHitPoints;
  speeds: CreatureSpeeds | null;
  abilities: CreatureAbilities;
  /** Skill bonuses as printed, e.g. { Perception: 3 }. */
  skills: Record<string, number>;
  damageVulnerabilities: string[];
  damageResistances: string[];
  damageImmunities: string[];
  conditionImmunities: string[];
  senses: CreatureSenses | null;
  /** Printed languages text, paraphrased where it is prose. */
  languages: string | null;
  challenge: CreatureChallenge;
  /** Equipment line (Skeleton). */
  gear: string[];
  traits: CreatureFeature[];
  actions: CreatureFeature[];
  bonusActions: CreatureFeature[];
  reactions: CreatureFeature[];
  source: CreatureSource;
  forms: CreatureForms;
  /** Mounts and Other Animals table row (PHB L10393-L10401). */
  mountTable?: { carryingCapacityLb: number; costGp: number };
  /** Short notes on OCR repairs / inferences / displaced text (also in the findings file). */
  notes?: string[];
}

// ─── Builders ────────────────────────────────────────────────────────────────

const ABILITY_ORDER: readonly Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** floor((score - 10) / 2), PHB "Ability Scores". */
function scoreMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Ability input: a printed score, `{ mod }` when only the modifier survived the OCR, or null when nothing did. */
type AbilityIn = number | { mod: number } | null;

function abilities(...values: [AbilityIn, AbilityIn, AbilityIn, AbilityIn, AbilityIn, AbilityIn]): CreatureAbilities {
  const out = {} as CreatureAbilities;
  ABILITY_ORDER.forEach((key, i) => {
    const v = values[i];
    if (v === null) out[key] = { score: null, mod: null, save: null, saveProficient: false };
    else if (typeof v === 'number') out[key] = { score: v, mod: scoreMod(v), save: scoreMod(v), saveProficient: false };
    else out[key] = { score: null, mod: v.mod, save: v.mod, saveProficient: false };
  });
  return out;
}

/** Mark saving throws as proficient: save = modifier + Proficiency Bonus (the creature's PB). */
function proficientSaves(base: CreatureAbilities, pb: number, ...keys: Ability[]): CreatureAbilities {
  const out = { ...base };
  for (const k of keys) {
    const a = base[k];
    if (a.mod === null) throw new Error(`Cannot make ${k} proficient: no modifier`);
    out[k] = { ...a, save: a.mod + pb, saveProficient: true };
  }
  return out;
}

const dmg = (dice: string, type: string, average: number | null = null): CreatureDamage => ({ average, dice, type });

function melee(name: string, bonus: number, damage: CreatureDamage[], description: string, usage?: string): CreatureFeature {
  return { name, description, attack: { kind: 'melee', bonus, reachFt: 5 }, damage, ...(usage ? { usage } : {}) };
}

function ranged(name: string, bonus: number, rangeFt: [number, number], damage: CreatureDamage[], description: string): CreatureFeature {
  return { name, description, attack: { kind: 'ranged', bonus, rangeFt }, damage };
}

function saveAction(name: string, ability: Ability, dc: number, damage: CreatureDamage[] | undefined, description: string, usage?: string): CreatureFeature {
  return { name, description, save: { ability, dc }, ...(damage ? { damage } : {}), ...(usage ? { usage } : {}) };
}

function feature(name: string, description: string, usage?: string): CreatureFeature {
  return { name, description, ...(usage ? { usage } : {}) };
}

const PB2 = (cr: string, xp: number): CreatureChallenge => ({ cr, xp, proficiencyBonus: 2, pbNote: 'PB +2' });

const initiative = (modifier: number): { modifier: number; score: number } => ({ modifier, score: 10 + modifier });

const NO_FORMS: CreatureForms = { familiar: false, wildCompanion: false, steed: false, mount: false };

/**
 * PDF page of the Monster Manual 2024 (Appendix A: Animals) that holds each
 * Appendix A block; printed page = PDF page - 3. Read as page images in Stage 1c.
 */
const MM_ANIMAL_PDF_PAGE: Readonly<Record<string, number>> = {
  ape: 351, badger: 352, bat: 352, 'black-bear': 352, boar: 353, 'brown-bear': 353, camel: 354, cat: 354,
  'constrictor-snake': 354, crab: 354, crocodile: 355, 'dire-wolf': 355, 'draft-horse': 355, elephant: 356, elk: 356,
  frog: 357, 'giant-badger': 357, 'giant-crab': 359, 'giant-goat': 360, 'giant-seahorse': 362, 'giant-spider': 362,
  'giant-weasel': 364, goat: 365, hawk: 365, lion: 367, lizard: 367, mastiff: 368, mule: 368, octopus: 368, owl: 369,
  panther: 369, pony: 370, rat: 370, raven: 371, 'reef-shark': 371, 'riding-horse': 371, scorpion: 372, spider: 372,
  tiger: 374, 'venomous-snake': 375, warhorse: 376, weasel: 376, wolf: 376,
};

/** PDF page of the same block in the MM A-Z section, for PHB-sourced creatures (values cross-checked). */
const MM_CROSSCHECK_PDF_PAGE: Readonly<Record<string, number>> = {
  imp: 180, pseudodragon: 252, quasit: 255, 'slaad-tadpole': 287, 'sphinx-of-wonder': 294, sprite: 301, skeleton: 285, zombie: 349,
};

interface CreatureInput extends Partial<Omit<CreatureStatBlock, 'id' | 'name' | 'kind' | 'source' | 'abilities' | 'forms'>> {
  id: string;
  name: string;
  kind: CreatureKind;
  /** PHB markdown line (omit for creatures that have no PHB text block). */
  line?: number;
  section?: string;
  abilities: CreatureAbilities;
  forms?: Partial<CreatureForms>;
}

function buildSource(id: string, line: number | undefined, section: string | undefined): CreatureSource {
  const mmPdf = MM_ANIMAL_PDF_PAGE[id];
  if (mmPdf !== undefined) {
    return {
      book: 'Monster Manual 2024', section: 'Appendix A: Animals', printedPage: mmPdf - 3, pdfPage: mmPdf,
      ...(line !== undefined ? { phbLine: line } : {}),
    };
  }
  const cross = MM_CROSSCHECK_PDF_PAGE[id];
  return {
    book: 'PHB 2024', section: section ?? 'Appendix B: Creature Stat Blocks', ...(line !== undefined ? { line } : {}),
    ...(cross !== undefined ? { mmCrossCheck: { printedPage: cross - 3, pdfPage: cross } } : {}),
  };
}

function mk(input: CreatureInput): CreatureStatBlock {
  const { line, section, forms, ...rest } = input;
  return {
    size: null,
    creatureType: null,
    alignment: null,
    ac: null,
    initiative: null,
    hp: { average: null, dice: null },
    speeds: null,
    skills: {},
    damageVulnerabilities: [],
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    senses: null,
    languages: null,
    challenge: { cr: null, xp: null, proficiencyBonus: null, pbNote: '' },
    gear: [],
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    ...rest,
    source: buildSource(rest.id, line, section),
    forms: { ...NO_FORMS, ...forms },
  };
}

const MELEE_TEXT = 'Melee attack, reach 5 ft.';

// Frequently repeated PHB trait text (paraphrased).
const PACK_TACTICS = (who: string): CreatureFeature =>
  feature('Pack Tactics', `Advantage on an attack roll against a creature if at least one of the ${who}'s allies is within 5 feet of the target and that ally doesn't have the Incapacitated condition.`);
const AMPHIBIOUS = (who: string): CreatureFeature => feature('Amphibious', `The ${who} can breathe air and water.`);
const MAGIC_RESISTANCE = (who: string): CreatureFeature =>
  feature('Magic Resistance', `The ${who} has Advantage on saving throws against spells and other magical effects.`);
const SPIDER_CLIMB = feature('Spider Climb', 'Can climb difficult surfaces, including ceilings, without making an ability check.');
const WEB_WALKER = (clause: string): CreatureFeature =>
  feature('Web Walker', `Ignores movement restrictions caused by webs, and ${clause} knows where any other creature touching the same web is.`);
const FLYBY = (who: string): CreatureFeature => feature('Flyby', `The ${who} doesn't provoke Opportunity Attacks when it flies out of an enemy's reach.`);
const SHAPE_SHIFT_NOTE = 'Its statistics are the same in each form except Speed. Equipment it wears or carries is not transformed.';

// ─── Catalog ─────────────────────────────────────────────────────────────────

const PRIMAL_SECTION = 'Ranger: Beast Master, Level 3: Primal Companion';
const PRIMAL_BOND = feature('Primal Bond', 'Add your Proficiency Bonus to any ability check or saving throw the beast makes.');
const PRIMAL_SENSES = (darkvisionFt: number): CreatureSenses => ({ darkvisionFt, passivePerception: 12 });
const PRIMAL_CHALLENGE: CreatureChallenge = { cr: 'None', xp: 0, proficiencyBonus: null, pbNote: "PB equals your Proficiency Bonus" };
const PRIMAL_AC: CreatureArmorClass = { base: 13, plusAbility: 'wis' };
const PRIMAL_LANGUAGES = 'Understands the languages you know';

const PRIMAL: CreatureStatBlock[] = [
  mk({
    id: 'beast-of-the-land', name: 'Beast of the Land', kind: 'primal-companion', line: 5611, section: PRIMAL_SECTION,
    size: 'Medium', creatureType: 'Beast', alignment: 'Neutral',
    ac: PRIMAL_AC,
    hp: { formula: { base: 5, perLevel: 5, hitDie: 8, levelSource: 'ranger-level' } },
    speeds: { walk: 40, climb: 40 },
    abilities: abilities(14, 14, 15, 8, 14, 11),
    senses: PRIMAL_SENSES(60), languages: PRIMAL_LANGUAGES, challenge: PRIMAL_CHALLENGE,
    traits: [PRIMAL_BOND],
    actions: [{
      name: "Beast's Strike",
      description: "Melee attack using your spell attack modifier, reach 5 ft. Deals 1d8 + 2 plus your Wisdom modifier damage of a type you pick when summoning it (Bludgeoning, Piercing or Slashing). If the beast moved at least 20 feet straight toward the target before the hit, the target takes an extra 1d6 damage of the same type and has the Prone condition if it is Large or smaller.",
      attack: { kind: 'melee', bonus: null, bonusFormula: 'spell-attack-modifier', reachFt: 5 },
      damage: [
        { average: null, dice: '1d8+2', type: 'Bludgeoning, Piercing or Slashing (chosen at summoning)', plusAbilityOfOwner: 'wis', typeChoice: ['Bludgeoning', 'Piercing', 'Slashing'] },
        { average: null, dice: '1d6', type: 'same type (charge: 20+ ft. straight toward the target)' },
      ],
    }],
    notes: ['Ability table read from fragments: STR 14, DEX 14, CON 15, INT 8, WIS 14, CHA 11; mods +2/+2/+2/-1/+2/+0 match.'],
  }),
  mk({
    id: 'beast-of-the-sea', name: 'Beast of the Sea', kind: 'primal-companion', line: 5662, section: PRIMAL_SECTION,
    size: 'Medium', creatureType: 'Beast', alignment: 'Neutral',
    ac: PRIMAL_AC,
    hp: { formula: { base: 5, perLevel: 5, hitDie: 8, levelSource: 'ranger-level' } },
    speeds: { walk: 5, swim: 60 },
    abilities: abilities(14, 14, 15, 8, 14, 11),
    senses: PRIMAL_SENSES(90), languages: PRIMAL_LANGUAGES, challenge: PRIMAL_CHALLENGE,
    traits: [AMPHIBIOUS('beast'), PRIMAL_BOND],
    actions: [{
      name: "Beast's Strike",
      description: "Melee attack using your spell attack modifier, reach 5 ft. Deals 1d6 + 2 plus your Wisdom modifier damage of a type you pick when summoning it (Bludgeoning or Piercing), and the target has the Grappled condition (escape DC equals your spell save DC).",
      attack: { kind: 'melee', bonus: null, bonusFormula: 'spell-attack-modifier', reachFt: 5 },
      damage: [{ average: null, dice: '1d6+2', type: 'Bludgeoning or Piercing (chosen at summoning)', plusAbilityOfOwner: 'wis', typeChoice: ['Bludgeoning', 'Piercing'] }],
    }],
    notes: ['The STR line is OCR-garbled ("Sn 14"); STR 14 read with its +2 mod. Remaining table matches the Beast of the Land.'],
  }),
  mk({
    id: 'beast-of-the-sky', name: 'Beast of the Sky', kind: 'primal-companion', line: 5638, section: PRIMAL_SECTION,
    size: 'Small', creatureType: 'Beast', alignment: 'Neutral',
    ac: PRIMAL_AC,
    hp: { formula: { base: 4, perLevel: 4, hitDie: 6, levelSource: 'ranger-level' } },
    speeds: { walk: 10, fly: 60 },
    abilities: abilities(6, 16, 13, 8, 14, 11),
    senses: PRIMAL_SENSES(60), languages: PRIMAL_LANGUAGES, challenge: PRIMAL_CHALLENGE,
    traits: [FLYBY('beast'), PRIMAL_BOND],
    actions: [{
      name: "Beast's Strike",
      description: "Melee attack using your spell attack modifier, reach 5 ft. Deals 1d4 + 3 plus your Wisdom modifier Slashing damage.",
      attack: { kind: 'melee', bonus: null, bonusFormula: 'spell-attack-modifier', reachFt: 5 },
      damage: [{ average: null, dice: '1d4+3', type: 'Slashing', plusAbilityOfOwner: 'wis' }],
    }],
    notes: ['OCR "CON l3 / +l / +l" and "CHA 11 / +O / +O" repaired as 13 (+1) and 11 (+0).'],
  }),
];

const FAMILIAR_WILD = { familiar: true, wildCompanion: true } as const;

const ANIMALS_AND_OTHERS: CreatureStatBlock[] = [
  mk({
    id: 'ape', name: 'Ape', kind: 'animal', line: 17996,
    size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, initiative: initiative(2), hp: { average: 19, dice: '3d8+6' },
    speeds: { walk: 30, climb: 30 }, abilities: abilities(16, 14, 14, 6, 12, 7),
    skills: { Athletics: 5, Perception: 3 }, senses: { passivePerception: 13 }, languages: 'None', challenge: PB2('1/2', 100),
    actions: [
      feature('Multiattack', 'Makes two Fist attacks.'),
      melee('Fist', 5, [dmg('1d4+3', 'Bludgeoning', 5)], `${MELEE_TEXT} 5 (1d4 + 3) Bludgeoning damage.`),
      { ...ranged('Rock', 5, [25, 50], [dmg('2d6+3', 'Bludgeoning', 10)], 'Ranged attack, range 25/50 ft. 10 (2d6 + 3) Bludgeoning damage.'), usage: 'Recharge 6' },
    ],
  }),
  mk({
    id: 'badger', name: 'Badger', kind: 'animal', line: 18058, forms: { familiar: true },
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 11, initiative: initiative(0), hp: { average: 5, dice: '1d4+3' },
    speeds: { walk: 20, burrow: 5 }, abilities: abilities(10, 11, 16, 2, 12, 5),
    skills: { Perception: 3 }, damageResistances: ['Poison'], senses: { darkvisionFt: 30, passivePerception: 13 }, languages: 'None', challenge: PB2('0', 10),
    actions: [melee('Bite', 2, [dmg('1', 'Piercing', 1)], `${MELEE_TEXT} 1 Piercing damage.`)],
    notes: ['CR 0 Beast: eligible as a Find Familiar form through "another Beast that has a Challenge Rating of 0" (not named in the list).'],
  }),
  mk({
    id: 'bat', name: 'Bat', kind: 'animal', line: 18130, forms: FAMILIAR_WILD,
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, initiative: initiative(2), hp: { average: 1, dice: '1d4-1' },
    speeds: { walk: 5, fly: 30 }, abilities: abilities(2, 15, 8, 2, 12, 4),
    senses: { blindsightFt: 60, passivePerception: 11 }, languages: 'None', challenge: PB2('0', 10),
    actions: [melee('Bite', 4, [dmg('1', 'Piercing', 1)], `${MELEE_TEXT} 1 Piercing damage.`)],
    notes: ['Printed as a single-line code fence in the OCR; fully readable.'],
  }),
  mk({
    id: 'black-bear', name: 'Black Bear', kind: 'animal', line: 18134,
    size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 11, initiative: initiative(1), hp: { average: 19, dice: '3d8+6' },
    speeds: { walk: 30, climb: 30, swim: 30 }, abilities: abilities(15, 12, 14, 2, 12, 7),
    skills: { Perception: 5 }, senses: { darkvisionFt: 60, passivePerception: 15 }, languages: 'None', challenge: PB2('1/2', 100),
    actions: [
      feature('Multiattack', 'Makes two Rend attacks.'),
      melee('Rend', 4, [dmg('1d6+2', 'Slashing', 5)], `${MELEE_TEXT} 5 (1d6 + 2) Slashing damage.`),
    ],
    notes: ['Printed as a single-line code fence; Rend reach prints as "reach: 5 ." (OCR), taken as 5 ft. like every melee attack in the appendix.'],
  }),
  mk({
    id: 'boar', name: 'Boar', kind: 'animal', line: 18138,
    size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 11, initiative: initiative(0), hp: { average: 13, dice: '2d8+4' },
    speeds: { walk: 40 }, abilities: abilities(13, 11, 14, 2, 9, 5),
    senses: { passivePerception: 9 }, languages: 'None', challenge: PB2('1/4', 50),
    traits: [feature('Bloodied Fury', 'While Bloodied, the boar has Advantage on attack rolls.')],
    actions: [melee('Gore', 3, [dmg('1d6+1', 'Piercing', 4), dmg('1d6', 'Piercing', 3)],
      `${MELEE_TEXT} 4 (1d6 + 1) Piercing damage. If the target is Medium or smaller and the boar moved at least 20 feet straight toward it immediately before the hit, the target takes an extra 3 (1d6) Piercing damage and has the Prone condition.`)],
    notes: ['MM p. 350 (PDF 353): CHA 5 (-3) fills the previously unreadable CHA; the Prone clause reads "Medium or smaller" (the OCR text said Large).'],
  }),
  mk({
    id: 'brown-bear', name: 'Brown Bear', kind: 'animal', line: 18178,
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 11, initiative: initiative(1), hp: { average: 22, dice: '3d10+6' },
    speeds: { walk: 40, climb: 30 }, abilities: abilities(17, 12, 15, 2, 13, 7),
    skills: { Perception: 3 }, senses: { darkvisionFt: 60, passivePerception: 13 }, languages: 'None', challenge: PB2('1', 200),
    actions: [
      feature('Multiattack', 'Makes one Bite attack and one Claw attack.'),
      melee('Bite', 5, [dmg('1d8+3', 'Piercing', 7)], `${MELEE_TEXT} 7 (1d8 + 3) Piercing damage.`),
      melee('Claw', 5, [dmg('1d4+3', 'Slashing', 5)], `${MELEE_TEXT} 5 (1d4 + 3) Slashing damage, and the target has the Prone condition if it is Large or smaller.`),
    ],
    notes: ['MM p. 350 (PDF 353): CHA 7 (-2) resolves the OCR ambiguity (5 vs 7); the Claw Prone clause reads "Large or smaller".'],
  }),
  mk({
    id: 'camel', name: 'Camel', kind: 'animal', line: 18254, forms: { mount: true },
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 10, initiative: initiative(-1), hp: { average: 17, dice: '2d10+6' },
    speeds: { walk: 50 }, abilities: proficientSaves(abilities(15, 8, 17, 2, 11, 5), 2, 'con'),
    senses: { darkvisionFt: 60, passivePerception: 10 }, languages: 'None', challenge: PB2('1/8', 25),
    actions: [melee('Bite', 4, [dmg('1d4+2', 'Bludgeoning', 4)], `${MELEE_TEXT} 4 (1d4 + 2) Bludgeoning damage.`)],
    mountTable: { carryingCapacityLb: 450, costGp: 50 },
  }),
  mk({
    id: 'cat', name: 'Cat', kind: 'animal', line: 18302, forms: FAMILIAR_WILD,
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, initiative: initiative(2), hp: { average: 2, dice: '1d4' },
    speeds: { walk: 40, climb: 40 }, abilities: proficientSaves(abilities(3, 15, 10, 3, 12, 7), 2, 'dex'),
    skills: { Perception: 3, Stealth: 4 }, senses: { darkvisionFt: 60, passivePerception: 13 }, languages: 'None', challenge: PB2('0', 10),
    traits: [feature('Jumper', "The cat's jump distance is figured from its Dexterity instead of its Strength.")],
    actions: [melee('Scratch', 4, [dmg('1', 'Slashing', 1)], `${MELEE_TEXT} 1 Slashing damage.`)],
  }),
  mk({
    id: 'constrictor-snake', name: 'Constrictor Snake', kind: 'animal', line: 18356,
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 13, initiative: initiative(2), hp: { average: 13, dice: '2d10+2' },
    speeds: { walk: 30, swim: 30 }, abilities: abilities(15, 14, 12, 1, 10, 3),
    skills: { Perception: 2, Stealth: 4 }, senses: { blindsightFt: 10, passivePerception: 12 }, languages: 'None', challenge: PB2('1/4', 50),
    actions: [
      melee('Bite', 4, [dmg('1d8+2', 'Piercing', 6)], `${MELEE_TEXT} 6 (1d8 + 2) Piercing damage.`),
      saveAction('Constrict', 'str', 12, [dmg('3d4', 'Bludgeoning', 7)], 'Strength save, DC 12, one Medium or smaller creature the snake can see within 5 feet. Failure: 7 (3d4) Bludgeoning damage and the target has the Grappled condition (escape DC 12).'),
    ],
    notes: ['The OCR interleaves this block with the Crocodile (L18356-L18530); split by Init/DEX/Speed/HP. INT score 1 is derived (printed mod -5 only fits score 1).'],
  }),
  mk({
    id: 'crab', name: 'Crab', kind: 'animal', line: 18458, forms: { familiar: true },
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 11, initiative: initiative(0), hp: { average: 3, dice: '1d4+1' },
    speeds: { walk: 20, swim: 20 }, abilities: abilities(6, 11, 12, 1, 8, 2),
    skills: { Stealth: 2 }, senses: { blindsightFt: 30, passivePerception: 9 }, languages: 'None', challenge: PB2('0', 10),
    traits: [AMPHIBIOUS('crab')],
    actions: [melee('Claw', 2, [dmg('1', 'Bludgeoning', 1)], `${MELEE_TEXT} 1 Bludgeoning damage.`)],
    notes: [
      'MM p. 351 (PDF 354): STR 6 (-2) fills the previously unreadable STR. CR 0 Beast: eligible via "another Beast that has a Challenge Rating of 0".',
    ],
  }),
  mk({
    id: 'crocodile', name: 'Crocodile', kind: 'animal', line: 18351,
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, initiative: initiative(0), hp: { average: 13, dice: '2d10+2' },
    speeds: { walk: 20, swim: 30 }, abilities: proficientSaves(abilities(15, 10, 13, 2, 10, 5), 2, 'con'),
    skills: { Stealth: 2 }, senses: { passivePerception: 10 }, languages: 'None', challenge: PB2('1/2', 100),
    traits: [feature('Hold Breath', 'The crocodile can hold its breath for 1 hour.')],
    actions: [melee('Bite', 4, [dmg('1d8+2', 'Piercing', 6)], `${MELEE_TEXT} 6 (1d8 + 2) Piercing damage. If the target is Medium or smaller, it has the Grappled condition (escape DC 12) and, while Grappled, the Restrained condition.`)],
    notes: ['MM p. 352 (PDF 355): AC 12 and HP 13 (2d10 + 2) fill the previously unreadable fields; CON save +3 is proficient (+1 + PB 2).'],
  }),
  mk({
    id: 'dire-wolf', name: 'Dire Wolf', kind: 'animal', line: 18530,
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 14, initiative: initiative(2), hp: { average: 22, dice: '3d10+6' },
    speeds: { walk: 50 }, abilities: abilities(17, 15, 15, 3, 12, 7),
    skills: { Perception: 5, Stealth: 4 }, senses: { darkvisionFt: 60, passivePerception: 15 }, languages: 'None', challenge: PB2('1', 200),
    traits: [PACK_TACTICS('wolf')],
    actions: [melee('Bite', 5, [dmg('1d10+3', 'Piercing', 8)], `${MELEE_TEXT} 8 (1d10 + 3) Piercing damage, and the target has the Prone condition if it is Large or smaller.`)],
  }),
  mk({
    id: 'draft-horse', name: 'Draft Horse', kind: 'animal', line: 18600, forms: { mount: true },
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 10, initiative: initiative(0), hp: { average: 15, dice: '2d10+4' },
    speeds: { walk: 40 }, abilities: abilities(18, 10, 15, 2, 11, 7),
    senses: { passivePerception: 10 }, languages: 'None', challenge: PB2('1/4', 50),
    actions: [melee('Hooves', 6, [dmg('1d4+4', 'Bludgeoning', 6)], `${MELEE_TEXT} 6 (1d4 + 4) Bludgeoning damage.`)],
    mountTable: { carryingCapacityLb: 540, costGp: 50 },
  }),
  mk({
    id: 'elephant', name: 'Elephant', kind: 'animal', line: 18650, forms: { mount: true },
    size: 'Huge', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, initiative: initiative(-1), hp: { average: 76, dice: '8d12+24' },
    speeds: { walk: 40 }, abilities: abilities(22, 9, 17, 3, 11, 6),
    senses: { passivePerception: 10 }, languages: 'None', challenge: PB2('4', 1100),
    actions: [
      feature('Multiattack', 'Makes two Gore attacks.'),
      melee('Gore', 8, [dmg('2d8+6', 'Piercing', 15)], `${MELEE_TEXT} 15 (2d8 + 6) Piercing damage. If the target is Huge or smaller and the elephant moved at least 20 feet straight toward it immediately before the hit, the target also has the Prone condition.`),
    ],
    bonusActions: [saveAction('Trample', 'dex', 16, [dmg('2d10+6', 'Bludgeoning', 17)], 'Dexterity save, DC 16, one creature within 5 feet that has the Prone condition. Failure: 17 (2d10 + 6) Bludgeoning damage. Success: half damage.')],
    mountTable: { carryingCapacityLb: 1320, costGp: 200 },
  }),
  mk({
    id: 'elk', name: 'Elk', kind: 'animal', line: 18705,
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 10, initiative: initiative(0), hp: { average: 11, dice: '2d10' },
    speeds: { walk: 50 }, abilities: abilities(16, 10, 11, 2, 10, 6),
    skills: { Perception: 2 }, senses: { darkvisionFt: 60, passivePerception: 12 }, languages: 'None', challenge: PB2('1/4', 50),
    actions: [melee('Ram', 5, [dmg('1d6+3', 'Bludgeoning', 6), dmg('1d6', 'Bludgeoning', 3)],
      `${MELEE_TEXT} 6 (1d6 + 3) Bludgeoning damage. If the elk moved at least 20 feet straight toward the target immediately before the hit, the target takes an extra 3 (1d6) Bludgeoning damage and has the Prone condition if it is Large or smaller.`)],
    notes: ['MM p. 353 (PDF 356): the Ram Prone clause reads "Large or smaller" (the OCR text said Huge).'],
  }),
  mk({
    id: 'frog', name: 'Frog', kind: 'animal', line: 18756, forms: FAMILIAR_WILD,
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 11, initiative: initiative(1), hp: { average: 1, dice: '1d4-1' },
    speeds: { walk: 20, swim: 20 }, abilities: abilities(1, 13, 8, 1, 8, 3),
    skills: { Perception: 1, Stealth: 3 }, senses: { darkvisionFt: 30, passivePerception: 11 }, languages: 'None', challenge: PB2('0', 10),
    traits: [AMPHIBIOUS('frog'), feature('Standing Leap', "The frog's Long Jump is up to 10 feet and its High Jump up to 5 feet, with or without a running start.")],
    actions: [melee('Bite', 3, [dmg('1', 'Piercing', 1)], `${MELEE_TEXT} 1 Piercing damage.`)],
    notes: ['INT score 1 derived from the printed mod -5.'],
  }),
  mk({
    id: 'giant-badger', name: 'Giant Badger', kind: 'animal', line: 18816,
    size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 13, initiative: initiative(0), hp: { average: 15, dice: '2d8+6' },
    speeds: { walk: 30, burrow: 10 }, abilities: abilities(13, 10, 17, 2, 12, 5),
    skills: { Perception: 3 }, damageResistances: ['Poison'], senses: { darkvisionFt: 60, passivePerception: 13 }, languages: 'None', challenge: PB2('1/4', 50),
    actions: [melee('Bite', 3, [dmg('2d4+1', 'Piercing', 6)], `${MELEE_TEXT} 6 (2d4 + 1) Piercing damage.`)],
  }),
  mk({
    id: 'giant-crab', name: 'Giant Crab', kind: 'animal', line: 18882,
    size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 15, initiative: initiative(1), hp: { average: 13, dice: '3d8' },
    speeds: { walk: 30, swim: 30 }, abilities: abilities(13, 13, 11, 1, 9, 3),
    skills: { Stealth: 3 }, senses: { blindsightFt: 30, passivePerception: 9 }, languages: 'None', challenge: PB2('1/8', 25),
    traits: [AMPHIBIOUS('crab')],
    actions: [melee('Claw', 3, [dmg('1d6+1', 'Bludgeoning', 4)], `${MELEE_TEXT} 4 (1d6 + 1) Bludgeoning damage. If the target is Medium or smaller, it has the Grappled condition (escape DC 11). The crab has two claws, each able to grapple one target.`)],
    notes: ['INT score 1 derived from the printed mod -5. CR line prints "(25 XP; PB +2)".'],
  }),
  mk({
    id: 'giant-goat', name: 'Giant Goat', kind: 'animal', line: 18946,
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 11, initiative: initiative(1), hp: { average: 19, dice: '3d10+3' },
    speeds: { walk: 40, climb: 30 }, abilities: proficientSaves(abilities(17, 12, 12, 3, 12, 6), 2, 'str'),
    skills: { Perception: 3 }, senses: { darkvisionFt: 60, passivePerception: 13 }, languages: 'None', challenge: PB2('1/2', 100),
    actions: [melee('Ram', 5, [dmg('1d6+3', 'Bludgeoning', 6), dmg('2d4', 'Bludgeoning', 5)],
      `${MELEE_TEXT} 6 (1d6 + 3) Bludgeoning damage. If the target is Large or smaller and the goat moved at least 20 feet straight toward it immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and has the Prone condition.`)],
    notes: ['MM p. 357 (PDF 360): DEX is 12 (+1), not 13; STR save +5 is proficient; Prone clause "Large or smaller".'],
  }),
  mk({
    id: 'giant-seahorse', name: 'Giant Seahorse', kind: 'animal', line: 18992,
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 14, initiative: initiative(1), hp: { average: 16, dice: '3d10' },
    speeds: { walk: 5, swim: 40 }, abilities: abilities(15, 12, 11, 2, 12, 5),
    senses: { passivePerception: 11 }, languages: 'None', challenge: PB2('1/2', 100),
    traits: [feature('Water Breathing', 'The seahorse can breathe only underwater.')],
    actions: [melee('Ram', 4, [dmg('2d6+2', 'Bludgeoning', 9), dmg('2d8+2', 'Bludgeoning', 11)],
      `${MELEE_TEXT} 9 (2d6 + 2) Bludgeoning damage, or 11 (2d8 + 2) Bludgeoning damage if it moved at least 20 feet straight toward the target immediately before the hit.`)],
    bonusActions: [feature('Bubble Dash', 'While underwater, the seahorse moves up to half its Swim Speed without provoking Opportunity Attacks.')],
  }),
  mk({
    id: 'giant-weasel', name: 'Giant Weasel', kind: 'animal', line: 19058,
    size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 13, initiative: initiative(3), hp: { average: 9, dice: '2d8' },
    speeds: { walk: 40, climb: 30 }, abilities: abilities(11, 17, 10, 4, 12, 5),
    skills: { Acrobatics: 5, Perception: 3, Stealth: 5 }, senses: { darkvisionFt: 60, passivePerception: 13 }, languages: 'None', challenge: PB2('1/8', 25),
    actions: [melee('Bite', 5, [dmg('1d4+3', 'Piercing', 5)], `${MELEE_TEXT} 5 (1d4 + 3) Piercing damage.`)],
    notes: ['MM p. 361 (PDF 364): AC 13 and HP 9 (2d8) fill the previously unreadable fields.'],
  }),
  mk({
    id: 'goat', name: 'Goat', kind: 'animal', line: 19079, forms: { familiar: true },
    size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 10, initiative: initiative(0), hp: { average: 4, dice: '1d8' },
    speeds: { walk: 40, climb: 30 }, abilities: proficientSaves(abilities(11, 10, 11, 2, 10, 5), 2, 'str'),
    skills: { Perception: 2 }, senses: { darkvisionFt: 60, passivePerception: 12 }, languages: 'None', challenge: PB2('0', 10),
    actions: [melee('Ram', 2, [dmg('1', 'Bludgeoning', 1), dmg('1d4', 'Bludgeoning', 2)],
      `${MELEE_TEXT} 1 Bludgeoning damage, or 2 (1d4) Bludgeoning damage if the goat moved at least 20 feet straight toward the target immediately before the hit.`)],
    notes: [
      'The Ram text is displaced by the OCR to after the Giant Spider\'s Web action (L19170); identified by "the goat deals".',
      'CR 0 Beast: eligible via "another Beast that has a Challenge Rating of 0".',
    ],
  }),
  mk({
    id: 'giant-spider', name: 'Giant Spider', kind: 'animal', line: 19127,
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 14, initiative: initiative(3), hp: { average: 26, dice: '4d10+4' },
    speeds: { walk: 30, climb: 30 }, abilities: abilities(14, 16, 12, 2, 11, 4),
    skills: { Perception: 4, Stealth: 7 }, senses: { darkvisionFt: 60, passivePerception: 14 }, languages: 'None', challenge: PB2('1', 200),
    traits: [SPIDER_CLIMB, WEB_WALKER('it')],
    actions: [
      melee('Bite', 5, [dmg('1d8+3', 'Piercing', 7), dmg('2d6', 'Poison', 7)], `${MELEE_TEXT} 7 (1d8 + 3) Piercing damage plus 7 (2d6) Poison damage.`),
      saveAction('Web', 'dex', 13, undefined, 'Dexterity save, DC 13, one creature the spider can see within 60 feet. Failure: the target has the Restrained condition until the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Poison and Psychic damage).', 'Recharge 5-6'),
    ],
    notes: ['Perception +4 with WIS 11 (+0) is expertise (2 x PB), consistent with Passive Perception 14.'],
  }),
  mk({
    id: 'hawk', name: 'Hawk', kind: 'animal', line: 19181, forms: FAMILIAR_WILD,
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 13, initiative: initiative(3), hp: { average: 1, dice: '1d4-1' },
    speeds: { walk: 10, fly: 60 }, abilities: abilities(5, 16, 8, 2, 14, 6),
    skills: { Perception: 6 }, senses: { passivePerception: 16 }, languages: 'None', challenge: PB2('0', 10),
    actions: [melee('Talons', 5, [dmg('1', 'Slashing', 1)], `${MELEE_TEXT} 1 Slashing damage.`)],
    notes: ['MM p. 362 (PDF 365): STR 5, INT 2, CHA 6 fill the previously unreadable scores.'],
  }),
  mk({
    id: 'lion', name: 'Lion', kind: 'animal', line: 19309,
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, initiative: initiative(2), hp: { average: 22, dice: '4d10' },
    speeds: { walk: 50 }, abilities: abilities(17, 15, 11, 3, 12, 8),
    skills: { Perception: 3, Stealth: 4 }, senses: { darkvisionFt: 60, passivePerception: 13 }, languages: 'None', challenge: PB2('1', 200),
    traits: [PACK_TACTICS('lion'), feature('Running Leap', 'With a 10-foot running start, the lion can Long Jump up to 25 feet.')],
    actions: [
      feature('Multiattack', 'Makes two Rend attacks. It can replace one of them with a use of Roar.'),
      melee('Rend', 5, [dmg('1d8+3', 'Slashing', 7)], `${MELEE_TEXT} 7 (1d8 + 3) Slashing damage.`),
      saveAction('Roar', 'wis', 11, undefined, "Wisdom save, DC 11, one creature within 15 feet. Failure: the target has the Frightened condition until the start of the lion's next turn."),
    ],
  }),
  mk({
    id: 'owl', name: 'Owl', kind: 'animal', line: 19391, forms: FAMILIAR_WILD,
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 11, initiative: initiative(1), hp: { average: 1, dice: '1d4-1' },
    speeds: { walk: 5, fly: 60 }, abilities: abilities(3, 13, 8, 2, 12, 7),
    skills: { Perception: 5, Stealth: 5 }, senses: { darkvisionFt: 120, passivePerception: 15 }, languages: 'None', challenge: PB2('0', 10),
    traits: [FLYBY('owl')],
    actions: [melee('Talons', 3, [dmg('1', 'Slashing', 1)], `${MELEE_TEXT} 1 Slashing damage.`)],
    notes: ['MM p. 366 (PDF 369): CHA 7 (-2) corrects the OCR-inferred CHA 6.'],
  }),
  mk({
    id: 'pony', name: 'Pony', kind: 'animal', line: 19395, forms: { mount: true },
    size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 10, initiative: initiative(0), hp: { average: 11, dice: '2d8+2' },
    speeds: { walk: 40 }, abilities: proficientSaves(abilities(15, 10, 13, 2, 11, 7), 2, 'str'),
    senses: { passivePerception: 10 }, languages: 'None', challenge: PB2('1/8', 25),
    actions: [melee('Hooves', 4, [dmg('1d4+2', 'Bludgeoning', 4)], `${MELEE_TEXT} 4 (1d4 + 2) Bludgeoning damage.`)],
    mountTable: { carryingCapacityLb: 225, costGp: 30 },
    notes: ['Interleaved with the Owl in the OCR; split by AC/Speed/HP/Init.'],
  }),
  mk({
    id: 'panther', name: 'Panther', kind: 'animal', line: 19503,
    size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 13, initiative: initiative(3), hp: { average: 13, dice: '3d8' },
    speeds: { walk: 50, climb: 40 }, abilities: abilities(14, 16, 10, 3, 14, 7),
    skills: { Perception: 4, Stealth: 7 }, senses: { darkvisionFt: 60, passivePerception: 14 }, languages: 'None', challenge: PB2('1/4', 50),
    actions: [melee('Rend', 5, [dmg('1d6+3', 'Slashing', 6)], `${MELEE_TEXT} 6 (1d6 + 3) Slashing damage.`)],
    bonusActions: [feature('Nimble Escape', 'The panther takes the Disengage or Hide action.')],
    notes: ['MM p. 366 (PDF 369) replaces the OCR block: AC 13, Init +3, DEX 16, INT 3, Stealth +7 and a Rend / Nimble Escape action list (the OCR had Pounce / Prowl).'],
  }),
  mk({
    id: 'rat', name: 'Rat', kind: 'animal', line: 19691, forms: FAMILIAR_WILD,
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 10, initiative: initiative(0), hp: { average: 1, dice: '1d4-1' },
    speeds: { walk: 20, climb: 20 }, abilities: abilities(2, 11, 9, 2, 10, 4),
    skills: { Perception: 2 }, senses: { darkvisionFt: 30, passivePerception: 12 }, languages: 'None', challenge: PB2('0', 10),
    traits: [feature('Agile', "The rat doesn't provoke Opportunity Attacks when it moves out of an enemy's reach.")],
    actions: [melee('Bite', 2, [dmg('1', 'Piercing', 1)], `${MELEE_TEXT} 1 Piercing damage.`)],
  }),
  mk({
    id: 'raven', name: 'Raven', kind: 'animal', line: 19747, forms: FAMILIAR_WILD,
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, initiative: initiative(2), hp: { average: 2, dice: '1d4' },
    speeds: { walk: 10, fly: 50 }, abilities: abilities(2, 14, 10, 5, 13, 6),
    skills: { Perception: 3 }, senses: { passivePerception: 13 }, languages: 'None', challenge: PB2('0', 10),
    traits: [feature('Mimicry', 'The raven can mimic simple sounds it has heard, such as a whisper or a chitter. A hearer can tell the sounds are imitations with a successful DC 10 Wisdom (Insight) check.')],
    actions: [melee('Beak', 4, [dmg('1', 'Piercing', 1)], `${MELEE_TEXT} 1 Piercing damage.`)],
    notes: ['Speed prints "10 t." (OCR); read as 10 ft.'],
  }),
  mk({
    id: 'reef-shark', name: 'Reef Shark', kind: 'animal', line: 19809,
    size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, initiative: initiative(2), hp: { average: 22, dice: '4d8+4' },
    speeds: { walk: 5, swim: 30 }, abilities: abilities(14, 15, 13, 1, 10, 4),
    skills: { Perception: 2 }, senses: { blindsightFt: 30, passivePerception: 12 }, languages: 'None', challenge: PB2('1/2', 100),
    traits: [PACK_TACTICS('shark'), feature('Water Breathing', 'The shark can breathe only underwater.')],
    actions: [melee('Bite', 4, [dmg('2d4+2', 'Piercing', 7)], `${MELEE_TEXT} 7 (2d4 + 2) Piercing damage.`)],
    notes: ['INT score 1 derived from the printed mod -5.'],
  }),
  mk({
    id: 'scorpion', name: 'Scorpion', kind: 'animal', line: 19921, forms: { familiar: true },
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 11, initiative: initiative(0), hp: { average: 1, dice: '1d4-1' },
    speeds: { walk: 10 }, abilities: abilities(2, 11, 8, 1, 8, 2),
    senses: { blindsightFt: 10, passivePerception: 9 }, languages: 'None', challenge: PB2('0', 10),
    actions: [melee('Sting', 2, [dmg('1', 'Piercing', 1), dmg('1d6', 'Poison', 3)], `${MELEE_TEXT} 1 Piercing damage plus 3 (1d6) Poison damage.`)],
    notes: ['MM p. 369 (PDF 372): CON 8 (-1) fills the previously unreadable CON. CR 0 Beast: eligible via "another Beast that has a Challenge Rating of 0".'],
  }),
  mk({
    id: 'spider', name: 'Spider', kind: 'animal', line: 20125, forms: FAMILIAR_WILD,
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, initiative: initiative(2), hp: { average: 1, dice: '1d4-1' },
    speeds: { walk: 20, climb: 20 }, abilities: abilities(2, 14, 8, 1, 10, 2),
    skills: { Stealth: 4 }, senses: { darkvisionFt: 30, passivePerception: 10 }, languages: 'None', challenge: PB2('0', 10),
    traits: [SPIDER_CLIMB, WEB_WALKER('the spider')],
    actions: [melee('Bite', 4, [dmg('1', 'Piercing', 1), dmg('1d4', 'Poison', 2)], `${MELEE_TEXT} 1 Piercing damage plus 2 (1d4) Poison damage.`)],
    notes: ['INT score 1 derived from the printed mod -5.'],
  }),
  mk({
    id: 'tiger', name: 'Tiger', kind: 'animal', line: 20179,
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 13, initiative: initiative(3), hp: { average: 30, dice: '4d10+8' },
    speeds: { walk: 40 }, abilities: abilities(17, 16, 14, 3, 12, 8),
    skills: { Perception: 3, Stealth: 7 }, senses: { darkvisionFt: 60, passivePerception: 13 }, languages: 'None', challenge: PB2('1', 200),
    actions: [melee('Rend', 5, [dmg('2d6+3', 'Slashing', 10)], `${MELEE_TEXT} 10 (2d6 + 3) Slashing damage, and the target has the Prone condition if it is Large or smaller.`)],
    bonusActions: [feature('Nimble Escape', 'The tiger takes the Disengage or Hide action.')],
    notes: ['MM p. 371 (PDF 374) replaces the OCR block: HP 30 (4d10 + 8) (the OCR had 22 / 3d10 + 6) and a single Rend attack plus Nimble Escape (the OCR had Multiattack / Pounce / Prowl).'],
  }),
  mk({
    id: 'venomous-snake', name: 'Venomous Snake', kind: 'animal', line: 20277, forms: { familiar: true },
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, initiative: initiative(2), hp: { average: 5, dice: '2d4' },
    speeds: { walk: 30, swim: 30 }, abilities: abilities(2, 15, 11, 1, 10, 3),
    senses: { blindsightFt: 10, passivePerception: 10 }, languages: 'None', challenge: PB2('1/8', 25),
    actions: [melee('Bite', 4, [dmg('1d4+2', 'Piercing', 4), dmg('1d6', 'Poison', 3)], `${MELEE_TEXT} 4 (1d4 + 2) Piercing damage plus 3 (1d6) Poison damage.`)],
    notes: ['Pact of the Chain special form (PHB L7044). INT score 1 derived from the printed mod -5.'],
  }),
  mk({
    id: 'warhorse', name: 'Warhorse', kind: 'animal', line: 20333, forms: { mount: true },
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 11, initiative: initiative(1), hp: { average: 19, dice: '3d10+3' },
    speeds: { walk: 60 }, abilities: proficientSaves(abilities(18, 12, 13, 2, 12, 7), 2, 'wis'),
    senses: { passivePerception: 11 }, languages: 'None', challenge: PB2('1/2', 100),
    actions: [melee('Hooves', 6, [dmg('2d4+4', 'Bludgeoning', 9), dmg('2d4', 'Bludgeoning', 5)],
      `${MELEE_TEXT} 9 (2d4 + 4) Bludgeoning damage. If the target is Large or smaller and the horse moved at least 20 feet straight toward it immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and has the Prone condition.`)],
    mountTable: { carryingCapacityLb: 540, costGp: 400 },
    notes: ['MM p. 373 (PDF 376): WIS save +3 is proficient; Prone clause "Large or smaller" (the OCR text said Huge).'],
  }),
  mk({
    id: 'wolf', name: 'Wolf', kind: 'animal', line: 20381,
    size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, initiative: initiative(2), hp: { average: 11, dice: '2d8+2' },
    speeds: { walk: 40 }, abilities: abilities(14, 15, 12, 3, 12, 6),
    skills: { Perception: 5, Stealth: 4 }, senses: { darkvisionFt: 60, passivePerception: 15 }, languages: 'None', challenge: PB2('1/4', 50),
    traits: [PACK_TACTICS('wolf')],
    actions: [melee('Bite', 4, [dmg('1d6+2', 'Piercing', 5)], `${MELEE_TEXT} 5 (1d6 + 2) Piercing damage, and the target has the Prone condition if it is Medium or smaller.`)],
  }),
  mk({
    id: 'weasel', name: 'Weasel', kind: 'animal', line: 20441, forms: FAMILIAR_WILD,
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 13, initiative: initiative(3), hp: { average: 1, dice: '1d4-1' },
    speeds: { walk: 30, climb: 30 }, abilities: abilities(3, 16, 8, 2, 12, 3),
    skills: { Acrobatics: 5, Perception: 3, Stealth: 5 }, senses: { darkvisionFt: 60, passivePerception: 13 }, languages: 'None', challenge: PB2('0', 10),
    actions: [melee('Bite', 5, [dmg('1', 'Piercing', 1)], `${MELEE_TEXT} 1 Piercing damage.`)],
    notes: ['MM p. 373 (PDF 376) confirms the Bite (+5, reach 5 ft., 1 Piercing) that was only inferred from displaced OCR text.'],
  }),
];

const FAMILIAR_SPECIAL: CreatureStatBlock[] = [
  mk({
    id: 'imp', name: 'Imp', kind: 'familiar', line: 19231, forms: { familiar: true },
    size: 'Tiny', creatureType: 'Fiend', subtype: 'Devil', alignment: 'Lawful Evil', ac: 13, initiative: initiative(3), hp: { average: 21, dice: '6d4+6' },
    speeds: { walk: 20, fly: 40 }, abilities: abilities(6, 17, 13, 11, 12, 14),
    skills: { Deception: 4, Insight: 3, Stealth: 5 }, damageResistances: ['Cold'], damageImmunities: ['Fire', 'Poison'], conditionImmunities: ['Poisoned'],
    senses: { darkvisionFt: 120, passivePerception: 11 }, languages: 'Common, Infernal', challenge: PB2('1', 200),
    traits: [
      feature('Devil\'s Sight', "Magical Darkness doesn't impede the imp's Darkvision."),
      MAGIC_RESISTANCE('imp'),
    ],
    actions: [
      melee('Sting', 5, [dmg('1d6+3', 'Piercing', 6), dmg('2d6', 'Poison', 7)], `${MELEE_TEXT} 6 (1d6 + 3) Piercing damage plus 7 (2d6) Poison damage.`),
      feature('Invisibility', 'The imp casts Invisibility on itself, needing no spell components and using Charisma as the spellcasting ability.'),
      feature('Shape-Shift', `The imp shape-shifts into a rat (Speed 20 ft.), a raven (Speed 20 ft., Fly 60 ft.) or a spider (Speed 20 ft., Climb 20 ft.), or returns to its true form. ${SHAPE_SHIFT_NOTE}`),
    ],
    notes: [
      'MM p. 177 (PDF 180) confirms Invisibility and Shape-Shift are Actions.',
      "PHB-vs-MM: the PHB text lists a separate Devil's Sight trait; the MM folds that clause into Darkvision and prints only Magic Resistance. PHB kept.",
    ],
  }),
  mk({
    id: 'pseudodragon', name: 'Pseudodragon', kind: 'familiar', line: 19495, forms: { familiar: true },
    size: 'Tiny', creatureType: 'Dragon', alignment: 'Neutral Good', ac: 14, initiative: initiative(2), hp: { average: 10, dice: '3d4+3' },
    speeds: { walk: 15, fly: 60 }, abilities: abilities(6, 15, 13, 10, 12, 10),
    skills: { Perception: 5, Stealth: 4 }, senses: { blindsightFt: 10, darkvisionFt: 60, passivePerception: 15 },
    languages: "Understands Common and Draconic but can't speak", challenge: PB2('1/4', 50),
    traits: [MAGIC_RESISTANCE('pseudodragon')],
    actions: [
      feature('Multiattack', 'Makes two Bite attacks.'),
      melee('Bite', 4, [dmg('1d4+2', 'Piercing', 4)], `${MELEE_TEXT} 4 (1d4 + 2) Piercing damage.`),
      saveAction('Sting', 'con', 12, [dmg('2d4+2', 'Poison', 5)], 'Constitution save, DC 12, one creature the pseudodragon can see within 5 feet. Failure: 5 (2d4 + 2) Poison damage and the target has the Poisoned condition for 1 hour. Failure by 5 or more: the Poisoned target is also Unconscious until it takes damage or another creature uses an action to shake it awake.'),
    ],
    notes: [
      'Perception +5 with WIS 12 (+1) is expertise (+1 + 4), consistent with Passive Perception 15.',
      'PHB-vs-MM: Sting damage is 5 (2d4 + 2) in the PHB text (kept) and 5 (2d4) in the MM (p. 249, PDF 252).',
    ],
  }),
  mk({
    id: 'quasit', name: 'Quasit', kind: 'familiar', line: 19635, forms: { familiar: true },
    size: 'Tiny', creatureType: 'Fiend', subtype: 'Demon', alignment: 'Chaotic Evil', ac: 13, initiative: initiative(3), hp: { average: 25, dice: '10d4' },
    speeds: { walk: 40 }, abilities: abilities(5, 17, 10, 7, 10, 10),
    skills: { Stealth: 5 }, damageResistances: ['Cold', 'Fire', 'Lightning'], damageImmunities: ['Poison'], conditionImmunities: ['Poisoned'],
    senses: { darkvisionFt: 120, passivePerception: 10 }, languages: 'Abyssal, Common', challenge: PB2('1', 200),
    traits: [MAGIC_RESISTANCE('quasit')],
    actions: [
      melee('Rend', 5, [dmg('1d4+3', 'Slashing', 5)], `${MELEE_TEXT} 5 (1d4 + 3) Slashing damage, and the target has the Poisoned condition until the start of the quasit's next turn.`),
      feature('Invisibility', 'The quasit casts Invisibility on itself, needing no spell components and using Charisma as the spellcasting ability.'),
      saveAction('Scare', 'wis', 10, undefined, 'Wisdom save, DC 10, one creature within 20 feet. Failure: the target has the Frightened condition and repeats the save at the end of each of its turns, ending the effect on a success. After 1 minute it succeeds automatically.', '1/Day'),
      feature('Shape-Shift', `The quasit shape-shifts into a bat (Speed 10 ft., Fly 40 ft.), a centipede (Speed 40 ft., Climb 40 ft.) or a toad (Speed 40 ft., Swim 40 ft.), or returns to its true form. ${SHAPE_SHIFT_NOTE}`),
    ],
  }),
  mk({
    id: 'slaad-tadpole', name: 'Slaad Tadpole', kind: 'familiar', line: 20021, forms: { familiar: true },
    size: 'Tiny', creatureType: 'Aberration', alignment: 'Chaotic Neutral', ac: 12, initiative: initiative(2), hp: { average: 7, dice: '3d4' },
    speeds: { walk: 30, burrow: 10 }, abilities: abilities(7, 15, 10, 3, 5, 3),
    skills: { Stealth: 4 }, damageResistances: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
    senses: { darkvisionFt: 60, passivePerception: 7 }, languages: "Understands Slaad but can't speak", challenge: PB2('1/8', 25),
    traits: [MAGIC_RESISTANCE('slaad')],
    actions: [melee('Bite', 4, [dmg('1d6+2', 'Piercing', 5)], `${MELEE_TEXT} 5 (1d6 + 2) Piercing damage.`)],
  }),
  mk({
    id: 'sphinx-of-wonder', name: 'Sphinx of Wonder', kind: 'familiar', line: 20073, forms: { familiar: true },
    size: 'Tiny', creatureType: 'Celestial', alignment: 'Lawful Good', ac: 13, initiative: initiative(3), hp: { average: 24, dice: '7d4+7' },
    speeds: { walk: 20, fly: 40 }, abilities: abilities(6, 17, 13, 15, 12, 11),
    skills: { Arcana: 4, Religion: 4, Stealth: 5 }, damageResistances: ['Necrotic', 'Psychic', 'Radiant'],
    senses: { darkvisionFt: 60, passivePerception: 11 }, languages: 'Celestial, Common', challenge: PB2('1', 200),
    traits: [MAGIC_RESISTANCE('sphinx')],
    actions: [melee('Rend', 5, [dmg('1d4+3', 'Slashing', 5), dmg('2d6', 'Radiant', 7)], `${MELEE_TEXT} 5 (1d4 + 3) Slashing damage plus 7 (2d6) Radiant damage.`)],
    reactions: [feature('Burst of Ingenuity', 'Trigger: the sphinx or another creature within 30 feet makes an ability check or a saving throw. Response: the sphinx adds 2 to the roll.', '2/Day')],
    notes: ['MM p. 291 (PDF 294): STR 6 (-2) fills the previously unreadable STR.'],
  }),
  mk({
    id: 'sprite', name: 'Sprite', kind: 'familiar', line: 20217, forms: { familiar: true },
    size: 'Tiny', creatureType: 'Fey', alignment: 'Neutral Good', ac: 15, initiative: initiative(4), hp: { average: 10, dice: '4d4' },
    speeds: { walk: 10, fly: 40 }, abilities: abilities(3, 18, 10, 14, 13, 11),
    skills: { Perception: 3, Stealth: 8 }, senses: { passivePerception: 13 }, languages: 'Common, Elvish, Sylvan', challenge: PB2('1/4', 50),
    actions: [
      melee('Needle Sword', 6, [dmg('1d4+4', 'Piercing', 6)], `${MELEE_TEXT} 6 (1d4 + 4) Piercing damage.`),
      ranged('Enchanting Bow', 6, [40, 160], [dmg('1', 'Piercing', 1)], 'Ranged attack, range 40/160 ft. 1 Piercing damage, and the target has the Charmed condition until the start of the sprite\'s next turn.'),
      saveAction('Heart Sight', 'cha', 10, undefined, "Charisma save, DC 10, one creature within 5 feet the sprite can see. Celestials, Fiends and Undead automatically fail. Failure: the sprite learns the target's emotions and alignment."),
      feature('Invisibility', 'The sprite casts Invisibility on itself, needing no spell components and using Charisma as the spellcasting ability.'),
    ],
  }),
];

const STEEDS: CreatureStatBlock[] = [
  mk({
    id: 'riding-horse', name: 'Riding Horse', kind: 'steed', line: 19871, forms: { steed: true, mount: true },
    size: 'Large', creatureType: 'Beast', alignment: 'Unaligned', ac: 11, initiative: initiative(1), hp: { average: 13, dice: '2d10+2' },
    speeds: { walk: 60 }, abilities: abilities(16, 13, 12, 2, 11, 7),
    senses: { passivePerception: 10 }, languages: 'None', challenge: PB2('1/4', 50),
    actions: [melee('Hooves', 5, [dmg('1d8+3', 'Bludgeoning', 7)], `${MELEE_TEXT} 7 (1d8 + 3) Bludgeoning damage.`)],
    mountTable: { carryingCapacityLb: 480, costGp: 75 },
    notes: ['This is the stat block the Phantom Steed spell uses (PHB L15238; Speed becomes 100 ft. for that spell). Find Steed uses the Otherworldly Steed instead.'],
  }),
  mk({
    id: 'otherworldly-steed', name: 'Otherworldly Steed', kind: 'steed', line: 13135, section: 'Spell: Find Steed (PHB p. 273; stat block printed as an image)',
    forms: { steed: true },
    size: 'Large', creatureType: 'Celestial, Fey, or Fiend (chosen when the spell is cast)', alignment: 'Neutral',
    ac: { base: 10, perSpellLevel: 1 },
    hp: { formula: { base: 5, perLevel: 10, hitDie: 10, levelSource: 'spell-level' } },
    speeds: { walk: 60, fly: 60 },
    abilities: abilities(18, 12, 14, 6, 12, 8),
    senses: { passivePerception: 11 }, languages: 'Telepathy 1 mile (works only with you)',
    challenge: { cr: 'None', xp: 0, proficiencyBonus: null, pbNote: 'PB equals your Proficiency Bonus' },
    traits: [feature('Life Bond', 'When you regain Hit Points from a level 1+ spell, the steed regains the same number of Hit Points if it is within 5 feet of you.')],
    actions: [{
      name: 'Otherworldly Slam',
      description: "Melee attack using your spell attack modifier, reach 5 ft. Deals 1d8 plus the spell's level damage: Radiant (Celestial), Psychic (Fey) or Necrotic (Fiend).",
      attack: { kind: 'melee', bonus: null, bonusFormula: 'spell-attack-modifier', reachFt: 5 },
      damage: [{ average: null, dice: '1d8', type: 'Radiant (Celestial), Psychic (Fey) or Necrotic (Fiend)', plusSpellLevel: true, typeChoice: ['Radiant', 'Psychic', 'Necrotic'] }],
    }],
    bonusActions: [
      {
        name: 'Fell Glare',
        description: 'Fiend only. Wisdom save (DC equals your spell save DC), one creature the steed can see within 60 feet. Failure: the target has the Frightened condition until the end of your next turn.',
        save: { ability: 'wis', dc: null, dcFormula: 'spell-save-dc' },
        usage: 'Recharges after a Long Rest',
      },
      feature('Fey Step', 'Fey only. The steed, with its rider, teleports to an unoccupied space of your choice up to 60 feet from itself.', 'Recharges after a Long Rest'),
      {
        name: 'Healing Touch',
        description: "Celestial only. One creature within 5 feet of the steed regains Hit Points equal to 2d8 plus the spell's level.",
        healing: { dice: '2d8', plusSpellLevel: true },
        usage: 'Recharges after a Long Rest',
      },
    ],
    notes: [
      'Printed values supplied by the user (Stage 1c brief); the stat block is an image in the PHB markdown and is not in the MM. Fly Speed 60 ft. requires a level 4+ spell (resolved in src/logic/primal-companion.ts).',
      'Saves equal the modifiers; the PB of the steed equals the summoner\'s Proficiency Bonus.',
    ],
  }),
];

const UNDEAD: CreatureStatBlock[] = [
  mk({
    id: 'skeleton', name: 'Skeleton', kind: 'undead', line: 19969, forms: { familiar: true },
    size: 'Medium', creatureType: 'Undead', alignment: 'Lawful Evil', ac: 13, initiative: initiative(3), hp: { average: 13, dice: '2d8+4' },
    speeds: { walk: 30 }, abilities: abilities(10, 16, 15, 6, 8, 5),
    damageVulnerabilities: ['Bludgeoning'], damageImmunities: ['Poison'], conditionImmunities: ['Exhaustion', 'Poisoned'], gear: ['Shortbow', 'Shortsword'],
    senses: { darkvisionFt: 60, passivePerception: 9 }, languages: "Understands the languages it knew in life but can't speak", challenge: PB2('1/4', 50),
    actions: [
      melee('Shortsword', 5, [dmg('1d6+3', 'Piercing', 6)], `${MELEE_TEXT} 6 (1d6 + 3) Piercing damage.`),
      ranged('Shortbow', 5, [80, 320], [dmg('1d6+3', 'Piercing', 6)], 'Ranged attack, range 80/320 ft. 6 (1d6 + 3) Piercing damage.'),
    ],
    notes: [
      'Animate Dead creature (PHB L10965, open point) and a Pact of the Chain special familiar form (L7044).',
      'PHB-vs-MM (PHB kept): AC 13 in the PHB text, 14 in the MM (p. 282, PDF 285); languages "languages it knew in life" vs MM "Common plus one other language".',
    ],
  }),
  mk({
    id: 'zombie', name: 'Zombie', kind: 'undead', line: 20503,
    size: 'Medium', creatureType: 'Undead', alignment: 'Neutral Evil', ac: 8, initiative: initiative(-2), hp: { average: 15, dice: '2d8+6' },
    speeds: { walk: 20 }, abilities: proficientSaves(abilities(13, 6, 16, 3, 6, 5), 2, 'wis'),
    damageImmunities: ['Poison'], conditionImmunities: ['Exhaustion', 'Poisoned'],
    senses: { darkvisionFt: 60, passivePerception: 8 }, languages: "Understands the languages it knew in life but can't speak", challenge: PB2('1/4', 50),
    traits: [feature('Undead Fortitude', 'If damage reduces the zombie to 0 Hit Points, it makes a Constitution saving throw with a DC of 5 plus the damage taken, unless the damage is Radiant or from a Critical Hit. On a success it drops to 1 Hit Point instead.')],
    actions: [melee('Slam', 3, [dmg('1d6+1', 'Bludgeoning', 4)], `${MELEE_TEXT} 4 (1d6 + 1) Bludgeoning damage.`)],
    notes: [
      'Animate Dead creature (PHB L10965, open point). The stray "Bite +5, 1 Piercing" in the OCR text under this block is NOT the zombie\'s (it is the Weasel\'s).',
      'WIS save +0 is proficient (-2 + PB 2); the MM (p. 346, PDF 349) prints the same +0.',
      'PHB-vs-MM (PHB kept): Slam 4 (1d6 + 1) in the PHB text, 5 (1d8 + 1) in the MM; languages as for the Skeleton.',
    ],
  }),
];

// Blocks that were absent from the PHB OCR; transcribed from MM 2024 Appendix A page images (and the user screenshots).
const FORMERLY_MISSING: CreatureStatBlock[] = [
  mk({
    id: 'lizard', name: 'Lizard', kind: 'animal', forms: FAMILIAR_WILD,
    size: 'Tiny', creatureType: 'Beast', alignment: 'Unaligned', ac: 10, initiative: initiative(0), hp: { average: 2, dice: '1d4' },
    speeds: { walk: 20, climb: 20 }, abilities: abilities(2, 11, 10, 1, 8, 3),
    senses: { darkvisionFt: 30, passivePerception: 9 }, languages: 'None', challenge: PB2('0', 10),
    traits: [SPIDER_CLIMB],
    actions: [melee('Bite', 2, [dmg('1', 'Piercing', 1)], `${MELEE_TEXT} 1 Piercing damage.`)],
    notes: ['Absent from the PHB OCR; read from MM p. 364 (PDF 367). Named Find Familiar form.'],
  }),
  mk({
    id: 'mastiff', name: 'Mastiff', kind: 'animal', forms: { mount: true },
    size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, initiative: initiative(2), hp: { average: 5, dice: '1d8+1' },
    speeds: { walk: 40 }, abilities: proficientSaves(abilities(13, 14, 12, 3, 12, 7), 2, 'wis'),
    skills: { Perception: 5 }, senses: { darkvisionFt: 60, passivePerception: 15 }, languages: 'None', challenge: PB2('1/8', 25),
    actions: [melee('Bite', 3, [dmg('1d6+1', 'Piercing', 4)], `${MELEE_TEXT} 4 (1d6 + 1) Piercing damage, and the target has the Prone condition if it is Medium or smaller.`)],
    mountTable: { carryingCapacityLb: 195, costGp: 25 },
    notes: ['Absent from the PHB OCR; read from MM p. 365 (PDF 368). WIS save +3 is proficient (+1 + PB 2).'],
  }),
  mk({
    id: 'mule', name: 'Mule', kind: 'animal', forms: { mount: true },
    size: 'Medium', creatureType: 'Beast', alignment: 'Unaligned', ac: 10, initiative: initiative(0), hp: { average: 11, dice: '2d8+2' },
    speeds: { walk: 40 }, abilities: proficientSaves(abilities(14, 10, 13, 2, 10, 5), 2, 'str'),
    senses: { passivePerception: 10 }, languages: 'None', challenge: PB2('1/8', 25),
    traits: [feature('Beast of Burden', 'The mule counts as one size larger when determining its carrying capacity.')],
    actions: [melee('Hooves', 4, [dmg('1d4+2', 'Bludgeoning', 4)], `${MELEE_TEXT} 4 (1d4 + 2) Bludgeoning damage.`)],
    mountTable: { carryingCapacityLb: 420, costGp: 8 },
    notes: ['Absent from the PHB OCR; read from MM p. 365 (PDF 368). STR save +4 is proficient (+2 + PB 2).'],
  }),
  mk({
    id: 'octopus', name: 'Octopus', kind: 'animal', forms: FAMILIAR_WILD,
    size: 'Small', creatureType: 'Beast', alignment: 'Unaligned', ac: 12, initiative: initiative(2), hp: { average: 3, dice: '1d6' },
    speeds: { walk: 5, swim: 30 }, abilities: abilities(4, 15, 11, 3, 10, 4),
    skills: { Perception: 2, Stealth: 6 }, senses: { darkvisionFt: 30, passivePerception: 12 }, languages: 'None', challenge: PB2('0', 10),
    traits: [
      feature('Compression', 'The octopus can move through a space as narrow as 1 inch without expending extra movement to squeeze through it.'),
      feature('Water Breathing', 'The octopus can breathe only underwater.'),
    ],
    actions: [melee('Tentacles', 4, [dmg('1', 'Bludgeoning', 1)], `${MELEE_TEXT} 1 Bludgeoning damage.`)],
    reactions: [feature('Ink Cloud', 'Trigger: a creature ends its turn within 5 feet of the octopus while it is underwater. Response: the octopus releases ink that fills a 5-foot Cube centered on itself, then moves up to its Swim Speed. The Cube is Heavily Obscured for 1 minute or until a strong current or similar effect disperses the ink.', '1/Day')],
    notes: ['Absent from the PHB OCR; read from MM p. 365 (PDF 368). Named Find Familiar form.'],
  }),
];

/** Every catalogued creature, grouped: Primal Companion, familiar forms, steeds, animals (A-Z), undead. */
export const CREATURE_LIST: readonly CreatureStatBlock[] = [
  ...PRIMAL,
  ...FAMILIAR_SPECIAL,
  ...STEEDS,
  ...[...ANIMALS_AND_OTHERS, ...FORMERLY_MISSING].sort((a, b) => a.name.localeCompare(b.name)),
  ...UNDEAD,
];

export const CREATURE_CATALOG: Readonly<Record<string, CreatureStatBlock>> = Object.fromEntries(
  CREATURE_LIST.map((c) => [c.id, c]),
);

export type CreatureId = string;

/** Group display order and labels. */
export const CREATURE_KINDS: readonly { kind: CreatureKind; label: string }[] = [
  { kind: 'primal-companion', label: 'Primal Companions' },
  { kind: 'familiar', label: 'Familiars' },
  { kind: 'steed', label: 'Steeds' },
  { kind: 'animal', label: 'Animals' },
  { kind: 'undead', label: 'Undead' },
];

export function creaturesByKind(kind: CreatureKind): CreatureStatBlock[] {
  return CREATURE_LIST.filter((c) => c.kind === kind);
}
