/**
 * GOLDEN TABLE: the Gods of Greyhawk deity catalog (D&D 2024).
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the Dungeon
 * Master's Guide (2024) text (Docs/DungeonMastersGuide.md, "GODS OF GREYHAWK"
 * table at L~5873) BEFORE the deity catalog is implemented. The implementer
 * must make the real DEITIES data reproduce every row and MUST NOT edit this
 * file. If a row looks wrong, STOP and flag it in the summary instead of
 * changing it.
 *
 * DATA ONLY (no imports) so it compiles before the catalog exists. A harness in
 * the implementer's tests maps each row onto the real DEITIES export.
 *
 * Source (DMG 2024, Docs/DungeonMastersGuide.md, "Gods of Greyhawk" table):
 * the table columns are Name & Epithet, Home Plane, Typical Worshipers, and
 * Symbol. The 2024 table carries NO alignment and NO cleric-domain columns, so
 * the catalog models exactly those four columns plus a rank marker from the
 * table footnote ("*Greater god  †Demigod"; unmarked rows are lesser gods).
 * Nothing here is invented (rules-compliance rule 1): every value is a direct
 * transcription of a table cell, with obvious OCR artifacts corrected (noted
 * per row where it applies).
 *
 * The `id` is a lowercase slug of the name (no epithet), used as the catalog
 * key and the DERIVED DeityId union. The stored character `faith` value stays a
 * free-text STRING (the deity name or any homebrew text) — the catalog only
 * powers the suggestion dropdown + the overview hint, so no persisted shape
 * changes.
 */

/** A deity's rank in the Greyhawk pantheon (DMG table footnote). */
export type DeityRank = 'greater' | 'lesser' | 'demigod';

export interface DeityGoldenCase {
  /** Catalog key: lowercase slug of the name (no epithet). */
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
  /** Symbol column (OCR artifacts corrected). */
  symbol: string;
}

/**
 * All 27 Gods of Greyhawk, in the DMG table's printed order. Epithets and
 * symbols are transcribed verbatim from the table cells, with clear OCR slips
 * repaired (e.g. a stray leading quote or a joined word) — the repairs are the
 * only edits and change no meaning.
 */
export const DEITY_CASES: DeityGoldenCase[] = [
  { id: 'beory', name: 'Beory', epithet: 'Heart of Oerth', rank: 'greater', homePlane: 'Material Plane', worshipers: 'Farmers, herders', symbol: 'Green disk' },
  { id: 'berei', name: 'Berei', epithet: 'of the Hearth', rank: 'lesser', homePlane: 'Bytopia', worshipers: 'Families, farmers', symbol: 'Sheaf of wheat stalks' },
  { id: 'boccob', name: 'Boccob', epithet: 'the Uncaring, Archmage of the Gods', rank: 'greater', homePlane: 'Outlands', worshipers: 'Sages, spellcasters, seers', symbol: 'Eye within a pentagram' },
  { id: 'celestian', name: 'Celestian', epithet: 'the Far Wanderer', rank: 'lesser', homePlane: 'Astral Plane', worshipers: 'Wanderers, astronomers', symbol: 'Arc of seven stars inside a circle' },
  { id: 'cuthbert', name: 'Cuthbert', epithet: 'of the Cudgel', rank: 'lesser', homePlane: 'Arcadia', worshipers: 'Practical, honest folk', symbol: 'Circle at the center of a starburst of lines' },
  { id: 'ehlonna', name: 'Ehlonna', epithet: 'of the Forests', rank: 'lesser', homePlane: 'Beastlands', worshipers: 'Hunters, foragers', symbol: 'Unicorn horn' },
  { id: 'erythnul', name: 'Erythnul', epithet: 'the Many', rank: 'lesser', homePlane: 'Pandemonium', worshipers: 'Raiders, bandits, berserkers', symbol: 'Blood drop' },
  { id: 'fharlanghn', name: 'Fharlanghn', epithet: 'the Dweller on the Horizon', rank: 'lesser', homePlane: 'Outlands', worshipers: 'Travelers', symbol: 'Circle crossed by a curved horizon line' },
  { id: 'heironeous', name: 'Heironeous', epithet: 'the Invincible', rank: 'lesser', homePlane: 'Mount Celestia', worshipers: 'Knights, soldiers', symbol: 'Lightning bolt' },
  { id: 'hextor', name: 'Hextor', epithet: 'Scourge of Battle', rank: 'lesser', homePlane: 'Acheron', worshipers: 'Soldiers, tyrants', symbol: 'Six down-pointing arrows in a fan' },
  { id: 'incabulos', name: 'Incabulos', epithet: 'the Black Rider', rank: 'greater', homePlane: 'Hades', worshipers: 'Necromancers, those who seek to ward off illness', symbol: 'Reptilian eye within a horizontal diamond' },
  { id: 'istus', name: 'Istus', epithet: 'Weaver of Our Fate', rank: 'greater', homePlane: 'Mechanus', worshipers: 'Seers, advisers', symbol: 'Spindle with three strands' },
  { id: 'iuz', name: 'Iuz', epithet: 'the Evil', rank: 'demigod', homePlane: 'Material Plane', worshipers: 'His subjects and allies', symbol: 'Grinning human skull' },
  { id: 'kord', name: 'Kord', epithet: 'the Brawler', rank: 'lesser', homePlane: 'Ysgard', worshipers: 'Athletes, berserkers', symbol: 'Spears and maces radiating from a point' },
  { id: 'nerull', name: 'Nerull', epithet: 'the Reaper', rank: 'greater', homePlane: 'Carceri', worshipers: 'Murderers, necromancers', symbol: 'Skull with a scythe' },
  { id: 'obad-hai', name: 'Obad-Hai', epithet: 'the Shalm', rank: 'lesser', homePlane: 'Outlands', worshipers: 'Hunters, gatherers, hermits', symbol: 'Oak leaf and acorn' },
  { id: 'olidammara', name: 'Olidammara', epithet: 'the Laughing', rank: 'lesser', homePlane: 'Ysgard', worshipers: 'Revelers, gamblers, pranksters', symbol: 'Laughing mask' },
  { id: 'pelor', name: 'Pelor', epithet: 'the Radiant Sun', rank: 'greater', homePlane: 'Elysium', worshipers: 'Healers, the compassionate', symbol: 'Sun' },
  { id: 'pholtus', name: 'Pholtus', epithet: 'of the Blinding Light', rank: 'lesser', homePlane: 'Arcadia', worshipers: 'Judges, lawyers, arbiters', symbol: 'Silver sun partially eclipsed by a crescent moon' },
  { id: 'ralishaz', name: 'Ralishaz', epithet: 'the Unlooked For', rank: 'lesser', homePlane: 'Limbo', worshipers: 'Gamblers', symbol: 'Three bone fate-casting sticks' },
  { id: 'rao', name: 'Rao', epithet: 'the Mediator', rank: 'greater', homePlane: 'Mount Celestia', worshipers: 'Mediators, sages, scientists', symbol: 'White heart' },
  { id: 'syrul', name: 'Syrul', epithet: 'Oathbreaker', rank: 'lesser', homePlane: 'Gehenna', worshipers: 'Liars, charlatans, traitors', symbol: 'Forked tongue' },
  { id: 'tharizdun', name: 'Tharizdun', epithet: 'the Eater of Worlds', rank: 'lesser', homePlane: 'Imprisoned demiplane', worshipers: 'Nihilistic cultists', symbol: 'Spiral rune' },
  { id: 'trithereon', name: 'Trithereon', epithet: 'the Summoner', rank: 'lesser', homePlane: 'Arborea', worshipers: 'Rebels, individualists', symbol: 'Triskelion' },
  { id: 'ulaa', name: 'Ulaa', epithet: 'the Bejeweled', rank: 'lesser', homePlane: 'Arcadia', worshipers: 'Miners, jewelers, quarriers', symbol: 'Ruby-hearted mountain' },
  { id: 'vecna', name: 'Vecna', epithet: 'the Whispered One', rank: 'lesser', homePlane: 'Unknown', worshipers: 'Necromancers, undead, those who keep or unearth secrets', symbol: 'An eye in the palm of a left hand' },
  { id: 'wee-jas', name: 'Wee Jas', epithet: 'the Witch', rank: 'lesser', homePlane: 'Acheron', worshipers: 'Spellcasters, advisers', symbol: 'Red skull in front of a fireball' },
];

/**
 * Catalog structural invariants the oracle test asserts for the whole catalog,
 * so a transcription slip (missing deity, dropped column) fails loudly.
 */
export interface DeityCatalogOracle {
  /** Exactly these 27 deity ids must be present, in this order. */
  requiredIds: string[];
  /** Total number of deities in the Greyhawk table. */
  count: number;
  /** Every deity has a non-empty name, homePlane, worshipers, and symbol. */
  requiredNonEmptyFields: ('name' | 'homePlane' | 'worshipers' | 'symbol')[];
}

export const DEITY_CATALOG_ORACLE: DeityCatalogOracle = {
  requiredIds: [
    'beory', 'berei', 'boccob', 'celestian', 'cuthbert', 'ehlonna', 'erythnul',
    'fharlanghn', 'heironeous', 'hextor', 'incabulos', 'istus', 'iuz', 'kord',
    'nerull', 'obad-hai', 'olidammara', 'pelor', 'pholtus', 'ralishaz', 'rao',
    'syrul', 'tharizdun', 'trithereon', 'ulaa', 'vecna', 'wee-jas',
  ],
  count: 27,
  requiredNonEmptyFields: ['name', 'homePlane', 'worshipers', 'symbol'],
};
