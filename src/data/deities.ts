/**
 * Deity catalog: the Gods of Greyhawk (D&D 2024).
 *
 * Transcribed from the Dungeon Master's Guide (2024) "GODS OF GREYHAWK" table
 * (Docs/DungeonMastersGuide.md, L~5873). The 2024 table lists four columns —
 * Name & Epithet, Home Plane, Typical Worshipers, and Symbol — plus a rank
 * marker from the footnote ("*Greater god  †Demigod"; unmarked rows are lesser
 * gods). The table carries NO alignment and NO cleric-domain columns, so this
 * catalog models exactly those columns (rules-compliance rule 1: never invent
 * data; transcribe only what the book prints).
 *
 * The stored character `faith` value stays free-text, so homebrew / other-
 * setting deities remain allowed; this catalog only powers the suggestion
 * dropdown and the overview hint.
 *
 * CONVENTIONS (match data/backgrounds.ts):
 *  - One keyed `as const satisfies Record<string, DeityData>` record; the
 *    DeityId union is DERIVED from it so the shape cannot drift.
 *  - `id` is a lowercase slug of the name (no epithet).
 */

/** A deity's rank in the Greyhawk pantheon (DMG table footnote). */
export type DeityRank = 'greater' | 'lesser' | 'demigod';

/** One deity's profile (DMG 2024 "Gods of Greyhawk" table columns). */
export interface DeityData {
  /** Catalog key: lowercase slug of the name (no epithet), e.g. 'pelor'. */
  id: string;
  /** Name as printed (no epithet), e.g. 'Pelor'. */
  name: string;
  /** The epithet as printed, e.g. 'the Radiant Sun'. */
  epithet: string;
  /** Rank from the table footnote (* greater, † demigod, unmarked = lesser). */
  rank: DeityRank;
  /** Home Plane column. */
  homePlane: string;
  /** Typical Worshipers column. */
  worshipers: string;
  /** Symbol column. */
  symbol: string;
}

/**
 * The 27 Gods of Greyhawk, in the DMG table's printed order.
 * DMG 2024 "Gods of Greyhawk" table (Docs/DungeonMastersGuide.md L~5873).
 */
export const DEITIES = {
  beory: { id: 'beory', name: 'Beory', epithet: 'Heart of Oerth', rank: 'greater', homePlane: 'Material Plane', worshipers: 'Farmers, herders', symbol: 'Green disk' },
  berei: { id: 'berei', name: 'Berei', epithet: 'of the Hearth', rank: 'lesser', homePlane: 'Bytopia', worshipers: 'Families, farmers', symbol: 'Sheaf of wheat stalks' },
  boccob: { id: 'boccob', name: 'Boccob', epithet: 'the Uncaring, Archmage of the Gods', rank: 'greater', homePlane: 'Outlands', worshipers: 'Sages, spellcasters, seers', symbol: 'Eye within a pentagram' },
  celestian: { id: 'celestian', name: 'Celestian', epithet: 'the Far Wanderer', rank: 'lesser', homePlane: 'Astral Plane', worshipers: 'Wanderers, astronomers', symbol: 'Arc of seven stars inside a circle' },
  cuthbert: { id: 'cuthbert', name: 'Cuthbert', epithet: 'of the Cudgel', rank: 'lesser', homePlane: 'Arcadia', worshipers: 'Practical, honest folk', symbol: 'Circle at the center of a starburst of lines' },
  ehlonna: { id: 'ehlonna', name: 'Ehlonna', epithet: 'of the Forests', rank: 'lesser', homePlane: 'Beastlands', worshipers: 'Hunters, foragers', symbol: 'Unicorn horn' },
  erythnul: { id: 'erythnul', name: 'Erythnul', epithet: 'the Many', rank: 'lesser', homePlane: 'Pandemonium', worshipers: 'Raiders, bandits, berserkers', symbol: 'Blood drop' },
  fharlanghn: { id: 'fharlanghn', name: 'Fharlanghn', epithet: 'the Dweller on the Horizon', rank: 'lesser', homePlane: 'Outlands', worshipers: 'Travelers', symbol: 'Circle crossed by a curved horizon line' },
  heironeous: { id: 'heironeous', name: 'Heironeous', epithet: 'the Invincible', rank: 'lesser', homePlane: 'Mount Celestia', worshipers: 'Knights, soldiers', symbol: 'Lightning bolt' },
  hextor: { id: 'hextor', name: 'Hextor', epithet: 'Scourge of Battle', rank: 'lesser', homePlane: 'Acheron', worshipers: 'Soldiers, tyrants', symbol: 'Six down-pointing arrows in a fan' },
  incabulos: { id: 'incabulos', name: 'Incabulos', epithet: 'the Black Rider', rank: 'greater', homePlane: 'Hades', worshipers: 'Necromancers, those who seek to ward off illness', symbol: 'Reptilian eye within a horizontal diamond' },
  istus: { id: 'istus', name: 'Istus', epithet: 'Weaver of Our Fate', rank: 'greater', homePlane: 'Mechanus', worshipers: 'Seers, advisers', symbol: 'Spindle with three strands' },
  iuz: { id: 'iuz', name: 'Iuz', epithet: 'the Evil', rank: 'demigod', homePlane: 'Material Plane', worshipers: 'His subjects and allies', symbol: 'Grinning human skull' },
  kord: { id: 'kord', name: 'Kord', epithet: 'the Brawler', rank: 'lesser', homePlane: 'Ysgard', worshipers: 'Athletes, berserkers', symbol: 'Spears and maces radiating from a point' },
  nerull: { id: 'nerull', name: 'Nerull', epithet: 'the Reaper', rank: 'greater', homePlane: 'Carceri', worshipers: 'Murderers, necromancers', symbol: 'Skull with a scythe' },
  'obad-hai': { id: 'obad-hai', name: 'Obad-Hai', epithet: 'the Shalm', rank: 'lesser', homePlane: 'Outlands', worshipers: 'Hunters, gatherers, hermits', symbol: 'Oak leaf and acorn' },
  olidammara: { id: 'olidammara', name: 'Olidammara', epithet: 'the Laughing', rank: 'lesser', homePlane: 'Ysgard', worshipers: 'Revelers, gamblers, pranksters', symbol: 'Laughing mask' },
  pelor: { id: 'pelor', name: 'Pelor', epithet: 'the Radiant Sun', rank: 'greater', homePlane: 'Elysium', worshipers: 'Healers, the compassionate', symbol: 'Sun' },
  pholtus: { id: 'pholtus', name: 'Pholtus', epithet: 'of the Blinding Light', rank: 'lesser', homePlane: 'Arcadia', worshipers: 'Judges, lawyers, arbiters', symbol: 'Silver sun partially eclipsed by a crescent moon' },
  ralishaz: { id: 'ralishaz', name: 'Ralishaz', epithet: 'the Unlooked For', rank: 'lesser', homePlane: 'Limbo', worshipers: 'Gamblers', symbol: 'Three bone fate-casting sticks' },
  rao: { id: 'rao', name: 'Rao', epithet: 'the Mediator', rank: 'greater', homePlane: 'Mount Celestia', worshipers: 'Mediators, sages, scientists', symbol: 'White heart' },
  syrul: { id: 'syrul', name: 'Syrul', epithet: 'Oathbreaker', rank: 'lesser', homePlane: 'Gehenna', worshipers: 'Liars, charlatans, traitors', symbol: 'Forked tongue' },
  tharizdun: { id: 'tharizdun', name: 'Tharizdun', epithet: 'the Eater of Worlds', rank: 'lesser', homePlane: 'Imprisoned demiplane', worshipers: 'Nihilistic cultists', symbol: 'Spiral rune' },
  trithereon: { id: 'trithereon', name: 'Trithereon', epithet: 'the Summoner', rank: 'lesser', homePlane: 'Arborea', worshipers: 'Rebels, individualists', symbol: 'Triskelion' },
  ulaa: { id: 'ulaa', name: 'Ulaa', epithet: 'the Bejeweled', rank: 'lesser', homePlane: 'Arcadia', worshipers: 'Miners, jewelers, quarriers', symbol: 'Ruby-hearted mountain' },
  vecna: { id: 'vecna', name: 'Vecna', epithet: 'the Whispered One', rank: 'lesser', homePlane: 'Unknown', worshipers: 'Necromancers, undead, those who keep or unearth secrets', symbol: 'An eye in the palm of a left hand' },
  'wee-jas': { id: 'wee-jas', name: 'Wee Jas', epithet: 'the Witch', rank: 'lesser', homePlane: 'Acheron', worshipers: 'Spellcasters, advisers', symbol: 'Red skull in front of a fireball' },
} as const satisfies Record<string, DeityData>;

/** A valid deity catalog key, e.g. 'pelor'. Derived so the shape can't drift. */
export type DeityId = keyof typeof DEITIES;

/** A deity entry whose `id` is narrowed to the literal DeityId union. */
export type DeityEntry = DeityData & { id: DeityId };

/** The catalog as an array, in the DMG table's printed (declaration) order. */
export const DEITY_LIST: readonly DeityEntry[] = Object.values(
  DEITIES,
) as readonly DeityEntry[];

/** Looks up a deity by id, tolerating an unknown/absent id (returns undefined). */
export function getDeity(id: string | undefined): DeityData | undefined {
  if (id === undefined) return undefined;
  return (DEITIES as Record<string, DeityData>)[id];
}
