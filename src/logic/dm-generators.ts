/**
 * Improvisation generators for the Dungeon Master: a quick NPC, and tavern and
 * shop names with an owner. The NPC reuses the same name, appearance and
 * character-description generators the character wizard uses, so an NPC reads
 * like a player's character. Nothing here is a game rule. The flavor tables are
 * written for this app (see data/dm-flavor-tables.ts and data/name-tables.ts).
 *
 * Every function takes an RNG, so results are repeatable under a fixed seed.
 */
import type { DmData, DmNote } from '../types/dm';
import { ALIGNMENTS, type Alignment } from '../types/character';
import type { ClassId } from '../data/classes';
import { SPECIES_LIST, getSpecies, type SpeciesId } from '../data/species';
import { SPECIES_DESCRIPTION_TABLES, type DescriptionSpeciesId } from '../data/description-species-tables';
import {
  SHOP_ADJECTIVES,
  SHOP_TYPES,
  TAVERN_ADJECTIVES,
  TAVERN_NOUNS,
  TAVERN_PAIRS,
  type ShopType,
} from '../data/dm-flavor-tables';
import type { NameGender } from '../data/name-tables';
import { generateAge, generateAppearance, generateName, type GeneratedAppearance } from './personal-details-generation';
import { generateDescription, generateFlaw, generateIdeal, generateLongTermGoal, generateShortTermGoal } from './character-description';
import { pick as pickFrom, type RNG } from './random';

/** \pick\ for a read-only list. */
function pick<T>(rng: RNG, list: readonly T[]): T {
  return pickFrom(rng, [...list]);
}
import { saveNote, uniqueTitle } from './dm-journal';

export interface NpcOptions {
  /** A species id, or undefined for a random one. */
  species?: SpeciesId;
  gender?: NameGender;
  alignment?: Alignment;
  /** Class flavor for the description (how they carry themselves), or undefined for none. */
  classId?: ClassId;
  /** The DM's own words, such as "blacksmith". Shown in the heading only. */
  role?: string;
  /** Use this name instead of generating one. */
  name?: string;
}

export interface GeneratedNpc {
  species: SpeciesId;
  speciesName: string;
  /** A lineage or ancestry (for example "Wood Elf"), when the species has them. */
  lineage?: string;
  /** The lineage's id, kept so a re-roll stays in the same ancestry. */
  lineageId?: string;
  gender: NameGender;
  name: string;
  age: string;
  appearance: GeneratedAppearance;
  alignment: Alignment;
  classId?: ClassId;
  role: string;
  description: string;
  ideal: string;
  flaw: string;
  shortTermGoal: string;
  longTermGoal: string;
}

const GENDERS: readonly NameGender[] = ['male', 'female', 'neutral'];

/** "woodElf" -> "Wood Elf", "red" -> "Red". */
export function prettyLineage(id: string): string {
  const spaced = id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The species the description generator has tables for. */
export function npcSpecies(): readonly SpeciesId[] {
  return SPECIES_LIST.map((s) => s.id).filter((id): id is SpeciesId => id in SPECIES_DESCRIPTION_TABLES);
}

function pickLineage(species: SpeciesId, rng: RNG): string | undefined {
  const lineages = SPECIES_DESCRIPTION_TABLES[species as DescriptionSpeciesId]?.lineages;
  const ids = lineages ? Object.keys(lineages) : [];
  return ids.length > 0 ? pick(rng, ids) : undefined;
}

function contextOf(npc: Pick<GeneratedNpc, 'name' | 'gender' | 'classId' | 'alignment' | 'species'> & { lineageId?: string }) {
  return {
    name: npc.name,
    gender: npc.gender,
    classId: npc.classId,
    alignment: npc.alignment,
    speciesId: npc.species,
    lineage: npc.lineageId,
  };
}

export function generateNpc(rng: RNG, options: NpcOptions = {}): GeneratedNpc {
  const species = options.species ?? pick(rng, npcSpecies());
  const gender = options.gender ?? pick(rng, GENDERS);
  const alignment = options.alignment ?? pick(rng, [...ALIGNMENTS]);
  const name = options.name?.trim() || generateName(species, gender, rng);
  const lineageId = pickLineage(species, rng);
  const ctx = contextOf({ name, gender, classId: options.classId, alignment, species, lineageId });
  const npc: GeneratedNpc = {
    species,
    speciesName: getSpecies(species)?.name ?? species,
    lineage: lineageId ? prettyLineage(lineageId) : undefined,
    lineageId,
    gender,
    name,
    age: generateAge(species, rng),
    appearance: generateAppearance(species, gender, rng),
    alignment,
    classId: options.classId,
    role: (options.role ?? '').trim().slice(0, 60),
    description: generateDescription(rng, ctx),
    ideal: generateIdeal(rng, ctx),
    flaw: generateFlaw(rng, ctx),
    shortTermGoal: generateShortTermGoal(rng, ctx),
    longTermGoal: generateLongTermGoal(rng, ctx),
  };
  return npc;
}

export type NpcPart = 'name' | 'look' | 'description' | 'ideal' | 'flaw' | 'goals';

export const NPC_PARTS: readonly { part: NpcPart; label: string }[] = [
  { part: 'name', label: 'name' },
  { part: 'look', label: 'age and looks' },
  { part: 'description', label: 'description' },
  { part: 'ideal', label: 'ideal' },
  { part: 'flaw', label: 'flaw' },
  { part: 'goals', label: 'goals' },
];

/**
 * Roll one part of an NPC again and keep the rest. A new name also rewrites the
 * description, because the description says the name.
 */
export function rerollNpcPart(rng: RNG, npc: GeneratedNpc, part: NpcPart): GeneratedNpc {
  const ctxFor = (name: string) => contextOf({ ...npc, name, lineageId: npc.lineageId });
  switch (part) {
    case 'name': {
      const name = generateName(npc.species, npc.gender, rng);
      return { ...npc, name, description: generateDescription(rng, ctxFor(name)) };
    }
    case 'look':
      return { ...npc, age: generateAge(npc.species, rng), appearance: generateAppearance(npc.species, npc.gender, rng) };
    case 'description':
      return { ...npc, description: generateDescription(rng, ctxFor(npc.name)) };
    case 'ideal':
      return { ...npc, ideal: generateIdeal(rng, ctxFor(npc.name)) };
    case 'flaw':
      return { ...npc, flaw: generateFlaw(rng, ctxFor(npc.name)) };
    case 'goals':
      return {
        ...npc,
        shortTermGoal: generateShortTermGoal(rng, ctxFor(npc.name)),
        longTermGoal: generateLongTermGoal(rng, ctxFor(npc.name)),
      };
  }
}

const GENDER_WORD: Record<NameGender, string> = { male: 'male', female: 'female', neutral: 'nonbinary' };

/** The one-line heading: "Mira, dwarf blacksmith". */
export function npcHeadline(npc: GeneratedNpc): string {
  const species = npc.speciesName.toLowerCase();
  const lineage = (npc.lineage ?? '').toLowerCase();
  // "Wood Elf" already names the species; "Red" does not.
  const people = lineage === '' ? species : lineage.includes(species) ? lineage : `${lineage} ${species}`;
  const kind = [people, npc.role.toLowerCase()].filter(Boolean).join(' ');
  return `${npc.name}, ${kind}`;
}

/** Plain text for a journal entry. */
export function npcJournalBody(npc: GeneratedNpc, extra = ''): string {
  const a = npc.appearance;
  const lines = [
    `${npc.speciesName}${npc.lineage ? ` (${npc.lineage})` : ''}, ${GENDER_WORD[npc.gender]}, age ${npc.age}.${npc.role ? ` ${npc.role.charAt(0).toUpperCase()}${npc.role.slice(1)}.` : ''}`,
    `Alignment: ${npc.alignment}.`,
    `Looks: height ${a.height}, weight ${a.weight}, ${a.eyes.toLowerCase()} eyes, ${a.hair.toLowerCase()} hair, ${a.skin.toLowerCase()} skin.`,
    '',
    npc.description,
    '',
    `Ideal: ${npc.ideal}`,
    `Flaw: ${npc.flaw}`,
    `Short-term goal: ${npc.shortTermGoal}`,
    `Long-term goal: ${npc.longTermGoal}`,
  ];
  if (extra) lines.splice(1, 0, extra);
  return lines.join('\n');
}

// ----------------------------------------------------------- tavern and shop

export function generateTavernName(rng: RNG): string {
  const form = Math.floor(rng() * 3);
  if (form === 0) return `The ${pick(rng, TAVERN_ADJECTIVES)} ${pick(rng, TAVERN_NOUNS)}`;
  if (form === 1) return `The ${pick(rng, TAVERN_PAIRS)}`;
  const first = pick(rng, TAVERN_NOUNS);
  const second = pick(
    rng,
    TAVERN_NOUNS.filter((n) => n !== first),
  );
  return `The ${first} & ${second}`;
}

export function shopTypeById(id: string): ShopType {
  return SHOP_TYPES.find((t) => t.id === id) ?? SHOP_TYPES[0];
}

/** A shop name for a trade. The owner's name is used for some forms ("Mira's Smithy"). */
export function generateShopName(rng: RNG, typeId: string, ownerFirstName?: string): string {
  const type = shopTypeById(typeId);
  const form = Math.floor(rng() * (ownerFirstName ? 3 : 2));
  if (form === 0) return `The ${pick(rng, SHOP_ADJECTIVES)} ${pick(rng, type.nouns)}`;
  if (form === 1) return `The ${pick(rng, type.words)} & ${pick(rng, type.nouns)}`;
  return `${ownerFirstName}'s ${pick(rng, type.nouns)}`;
}

// ------------------------------------------------------------- saving to the journal

/** The first word of a name: \"Mira Vance\" -> \"Mira\". */
export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

export interface PlaceInput {
  kind: 'tavern' | 'shop';
  name: string;
  /** For a shop, the trade ("Blacksmith"). */
  trade?: string;
}

/** Add an NPC to a campaign's journal. Returns the title it was saved under. */
export function saveNpcToJournal(
  data: DmData,
  campaignId: string,
  npc: GeneratedNpc,
  ids: { npc: string },
  now: number,
): { data: DmData; title: string } {
  const journal = data.campaigns.find((c) => c.id === campaignId)?.journal ?? [];
  const title = uniqueTitle(journal, npc.name);
  const note: DmNote = {
    id: ids.npc,
    kind: 'npc',
    title,
    body: npcJournalBody(npc),
    status: 'open',
    sessionNumber: null,
    createdAt: now,
    updatedAt: now,
  };
  return { data: saveNote(data, campaignId, note, now), title };
}

/**
 * Add a tavern or shop and its owner to the journal, each linking to the other
 * with `[[Title]]`. Titles are made unique first, so the links always point at
 * what was saved.
 */
export function savePlaceWithOwner(
  data: DmData,
  campaignId: string,
  place: PlaceInput,
  owner: GeneratedNpc,
  ids: { place: string; owner: string },
  now: number,
): { data: DmData; placeTitle: string; ownerTitle: string } {
  const journal = data.campaigns.find((c) => c.id === campaignId)?.journal ?? [];
  const ownerTitle = uniqueTitle(journal, owner.name);
  const placeTitle = uniqueTitle([...journal, { id: ids.owner, title: ownerTitle } as DmNote], place.name);
  const what = place.kind === 'tavern' ? 'tavern' : `${(place.trade ?? 'shop').toLowerCase()} shop`;
  const ownerNote: DmNote = {
    id: ids.owner,
    kind: 'npc',
    title: ownerTitle,
    body: npcJournalBody(owner, `Owns [[${placeTitle}]].`),
    status: 'open',
    sessionNumber: null,
    createdAt: now,
    updatedAt: now,
  };
  const placeNote: DmNote = {
    id: ids.place,
    kind: 'location',
    title: placeTitle,
    body: `A ${what}.\nOwner: [[${ownerTitle}]].\n`,
    status: 'open',
    sessionNumber: null,
    createdAt: now,
    updatedAt: now,
  };
  let next = saveNote(data, campaignId, ownerNote, now);
  next = saveNote(next, campaignId, placeNote, now);
  return { data: next, placeTitle, ownerTitle };
}

