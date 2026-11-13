import type { RNG } from './random';
import { pick } from './random';
import { ALIGNMENT_TRAITS, FLAWS, IDEALS, QUIRKS, type AlignmentPart } from '../data/personality-tables';
import {
  ALIGNMENT_COLOR,
  ALIGNMENT_FLAWS,
  ALIGNMENT_LONG_TERM_GOALS,
  DEMEANOR_TEMPLATES,
  GENERIC_OPENERS,
  GENERIC_PASTS,
  LONG_TERM_GOALS,
  MANNERS,
  MORE_FLAWS,
  MORE_IDEALS,
  SHORT_TERM_GOALS,
} from '../data/description-tables';
import { CLASS_DESCRIPTION_TABLES, type ClassDescriptionTables, type DescriptionClassId } from '../data/description-class-tables';
import {
  SPECIES_DESCRIPTION_TABLES,
  type DescriptionSpeciesId,
  type SpeciesDescriptionTables,
} from '../data/description-species-tables';
import type { Character, SpeciesSelection } from '../types/character';

/**
 * The character description generator (flavor only: no game mechanic, and
 * the player edits every field freely). It writes a short description plus
 * an ideal, a flaw, a short-term goal and a long-term goal, shaped by the
 * character's class and alignment:
 *  - the description opens with a class-specific sentence, then two
 *    personality traits from the PHB 2024 "Personality Traits by Alignment"
 *    table (personality-tables.ts) woven into a demeanor sentence, a
 *    formative past (class or general), how the alignment shows day to day,
 *    a habit and a mannerism;
 *  - ideals, flaws and goals mix class, alignment and general pools.
 * The pools are large enough that the number of distinct results runs into
 * the trillions (see descriptionCombinations), so two characters, even of the
 * same class and alignment, read differently.
 */

export interface DescriptionContext {
  name?: string;
  gender?: 'male' | 'female' | 'neutral';
  classId?: string;
  alignment?: string;
  /** Species catalog id, e.g. 'dwarf'. */
  speciesId?: string;
  /** The species' lineage / ancestry / legacy id, e.g. 'woodElf', 'red', 'infernal'. */
  lineage?: string;
}

/** The lineage-type sub-choice of a species selection (Dragonborn, Elf, Gnome, Goliath, Tiefling). */
export function speciesLineage(species: SpeciesSelection | undefined): string | undefined {
  if (!species) return undefined;
  return species.draconicAncestry ?? species.elvenLineage ?? species.gnomishLineage ?? species.giantAncestry ?? species.fiendishLegacy;
}

/** The generator context for a saved character. */
export function descriptionContextFor(character: Character, classId?: string): DescriptionContext {
  return {
    name: character.name,
    gender: character.gender,
    classId,
    alignment: character.alignment,
    speciesId: character.species?.id,
    lineage: speciesLineage(character.species),
  };
}

export interface GeneratedProfile {
  description: string;
  ideal: string;
  flaw: string;
  shortTermGoal: string;
  longTermGoal: string;
}

const ALL_PARTS = Object.keys(ALIGNMENT_TRAITS) as AlignmentPart[];

/**
 * The parts of an alignment the PHB 2024 "Personality Traits by Alignment"
 * table is keyed by (L1886-1896): "Lawful Good" is Lawful + Good, "Neutral
 * Good" is Neutral + Good, "True Neutral" is Neutral. Unaligned (or none) has
 * no parts.
 */
export function alignmentParts(alignment: string | undefined): AlignmentPart[] {
  if (!alignment || alignment === 'Unaligned') return [];
  if (alignment === 'True Neutral' || alignment === 'Neutral') return ['Neutral'];
  const parts = alignment.split(' ').filter((p): p is AlignmentPart => p in ALIGNMENT_TRAITS);
  return [...new Set(parts)];
}

function speciesTables(speciesId: string | undefined): SpeciesDescriptionTables | undefined {
  return speciesId && speciesId in SPECIES_DESCRIPTION_TABLES
    ? SPECIES_DESCRIPTION_TABLES[speciesId as DescriptionSpeciesId]
    : undefined;
}

/** The heritage sentences for a species, plus its lineage lines when that lineage is known. */
function heritagePool(ctx: DescriptionContext): { heritages: readonly string[]; lineage: readonly string[] } | undefined {
  const sp = speciesTables(ctx.speciesId);
  if (!sp) return undefined;
  return { heritages: sp.heritages, lineage: (ctx.lineage && sp.lineages?.[ctx.lineage]) || [] };
}

function classTables(classId: string | undefined): ClassDescriptionTables | undefined {
  return classId && classId in CLASS_DESCRIPTION_TABLES
    ? CLASS_DESCRIPTION_TABLES[classId as DescriptionClassId]
    : undefined;
}

/** Parts to draw alignment-flavoured content from (all parts when unaligned). */
function partsFor(ctx: DescriptionContext): AlignmentPart[] {
  const parts = alignmentParts(ctx.alignment);
  return parts.length > 0 ? parts : ALL_PARTS;
}

const FALLBACK_NAME = 'this adventurer';

/** Fill the name / pronoun / trait tokens of one template. */
/** Brackets around a verb that must agree with "they" when the subject becomes "they". */
const VERB_OPEN = '\u0002';
const VERB_CLOSE = '\u0003';
const VERB_MARK = new RegExp(`${VERB_OPEN}([a-z]+)${VERB_CLOSE}`, 'g');

/**
 * `{s:has}` in a template marks a SECOND verb that shares the subject ("{N}
 * gestures wildly and {s:has} knocked over a tankard"). With keepMarks the marker
 * survives until varyNameRepeats knows whether the subject became "they" (then
 * the verb is conjugated: "they have"); otherwise it becomes the plain word.
 */
function fill(template: string, ctx: DescriptionContext, traits: [string, string] = ['', '']): string {
  return fillWith(template, ctx, traits, false);
}

function fillWith(template: string, ctx: DescriptionContext, traits: [string, string], keepMarks: boolean): string {
  const name = ctx.name?.trim() || FALLBACK_NAME;
  const p =
    ctx.gender === 'male'
      ? { their: 'his', them: 'him', themself: 'himself' }
      : ctx.gender === 'female'
        ? { their: 'her', them: 'her', themself: 'herself' }
        : { their: 'their', them: 'them', themself: 'themself' };
  const t1 = traits[0].toLowerCase();
  const t2 = traits[1].toLowerCase();
  const text = template
    .replaceAll('{N}', name)
    .replaceAll('{Their}', p.their.charAt(0).toUpperCase() + p.their.slice(1))
    .replaceAll('{their}', p.their)
    .replaceAll('{themself}', p.themself)
    .replaceAll('{them}', p.them)
    .replaceAll('{T1}', t1.charAt(0).toUpperCase() + t1.slice(1))
    .replaceAll('{t1}', t1)
    .replaceAll('{t2}', t2)
    .replace(/\{s:([a-z]+)\}/g, (_m, w: string) => (keepMarks ? `${VERB_OPEN}${w}${VERB_CLOSE}` : w));
  // A sentence that starts with the fallback name gets a capital letter.
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Two different personality traits for the alignment (one from each half when it has two). */
function traitsFor(rng: RNG, ctx: DescriptionContext): [string, string] {
  const parts = alignmentParts(ctx.alignment);
  if (parts.length === 2) {
    return [pick(rng, [...ALIGNMENT_TRAITS[parts[0]]]), pick(rng, [...ALIGNMENT_TRAITS[parts[1]]])];
  }
  const pool = parts.length === 1 ? [...ALIGNMENT_TRAITS[parts[0]]] : ALL_PARTS.flatMap((p) => [...ALIGNMENT_TRAITS[p]]);
  const first = pick(rng, pool);
  const rest = pool.filter((t) => t !== first);
  return [first, rest.length > 0 ? pick(rng, rest) : first];
}

/** The character description paragraph. */
export function generateDescription(rng: RNG, ctx: DescriptionContext): string {
  const cls = classTables(ctx.classId);
  const sp = speciesTables(ctx.speciesId);
  const heritage = heritagePool(ctx);
  const traits = traitsFor(rng, ctx);
  const opener = pick(rng, [...(cls?.openers ?? GENERIC_OPENERS)]);
  const demeanor = pick(rng, [...DEMEANOR_TEMPLATES]);
  // Heritage: a lineage / ancestry line half the time when one is known,
  // otherwise a line about the species.
  const heritageLine = heritage
    ? heritage.lineage.length > 0 && rng() < 0.5
      ? pick(rng, [...heritage.lineage])
      : pick(rng, [...heritage.heritages])
    : undefined;
  // Formative past: class (35%), species (20%) or general.
  const pastRoll = rng();
  const past =
    cls && pastRoll < 0.35
      ? pick(rng, [...cls.pasts])
      : sp && pastRoll < 0.55
        ? pick(rng, [...sp.pasts])
        : pick(rng, [...GENERIC_PASTS]);
  const color = pick(rng, [...ALIGNMENT_COLOR[pick(rng, partsFor(ctx))]]);
  const quirk = pick(rng, [...QUIRKS]);
  // Mannerism: a species one about a third of the time.
  const manner = sp && rng() < 0.3 ? pick(rng, [...sp.manners]) : pick(rng, [...MANNERS]);
  const parts = [opener, demeanor, ...(heritageLine ? [heritageLine] : []), past, color, quirk, manner];
  const sentences = parts.map((s) => fillWith(s, ctx, traits, true));
  return varyNameRepeats(sentences, ctx).join(' ');
}

/** Adverbs that can sit between "they" and its verb ("they always keep"). */
const ADVERBS = new Set([
  'always', 'never', 'often', 'sometimes', 'usually', 'still', 'also', 'just', 'even', 'barely', 'hardly',
  'almost', 'only', 'already', 'ever', 'once', 'soon', 'now', 'then', 'not',
]);

const IRREGULAR_THEY: Record<string, string> = { is: 'are', has: 'have', was: 'were', does: 'do', goes: 'go' };

/**
 * A third-person singular verb as it reads after "they" ("turns" -> "turn",
 * "has" -> "have", "is" -> "are"). Past tense and modal verbs ("ran", "can",
 * "would") already agree and come back unchanged.
 */
export function theyVerb(word: string): string {
  const lower = word.toLowerCase();
  if (lower in IRREGULAR_THEY) return IRREGULAR_THEY[lower];
  if (lower.length > 4 && lower.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (/(ch|sh|ss|x|z)es$/.test(lower) || (lower.endsWith('oes') && lower.length > 4)) return word.slice(0, -2);
  if (lower.endsWith('s') && !/(ss|us|is)$/.test(lower)) return word.slice(0, -1);
  return word;
}

/** Conjugate the verb that follows "they": skip adverbs, then fix the first real word. */
function conjugateAfterThey(rest: string): string {
  let i = 0;
  const WORD = /^(\s+)([A-Za-z']+)/;
  for (;;) {
    const m = WORD.exec(rest.slice(i));
    if (!m) return rest;
    const word = m[2];
    const lower = word.toLowerCase();
    if (ADVERBS.has(lower) || lower.endsWith('ly')) {
      i += m[0].length;
      continue;
    }
    const start = i + m[1].length;
    return rest.slice(0, start) + theyVerb(word) + rest.slice(start + word.length);
  }
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Keep the paragraph from repeating the name. The first sentence introduces
 * the character by name; after that every mention becomes a pronoun: "Vip
 * turns" -> "she turns", "Vip's legacy" -> "her legacy", and for "they"
 * characters the verb is conjugated ("Vip has" -> "they have"). One later
 * sentence (the fourth or after) may keep its name as a reminder.
 */
function varyNameRepeats(sentences: string[], ctx: DescriptionContext): string[] {
  const name = ctx.name?.trim();
  // No name: nothing to swap, and no subject became "they", so verbs stay as written.
  if (!name) return sentences.map((s) => s.replace(VERB_MARK, '$1'));
  const subject = ctx.gender === 'male' ? 'he' : ctx.gender === 'female' ? 'she' : 'they';
  const possessive = ctx.gender === 'male' ? 'his' : ctx.gender === 'female' ? 'her' : 'their';
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  const mention = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(name)}(?:'s)?(?![\\p{L}\\p{N}])`, 'gu');
  let keptReminder = false;
  const MARK = '\u0001';

  /** Replace every mention except the first `keep` ones with a pronoun. */
  const swap = (sentence: string, keep: number): string => {
    let seen = 0;
    // Whether the sentence's FIRST mention (its subject) became "they": then every
    // verb marked {s:...} in the sentence agrees with "they".
    let subjectIsThey = false;
    const replaced = sentence.replace(mention, (match, offset: number) => {
      seen += 1;
      if (seen <= keep) return match;
      const isPossessive = match.endsWith("'s");
      const word = isPossessive ? possessive : subject;
      const out = offset === 0 ? cap(word) : word;
      if (seen === 1 && !isPossessive && subject === 'they') subjectIsThey = true;
      // After "they", the verb that follows must be conjugated (done below).
      return !isPossessive && subject === 'they' ? out + MARK : out;
    });
    const settle = (text: string) => text.replace(VERB_MARK, (_m, w: string) => (subjectIsThey ? theyVerb(w) : w));
    if (!replaced.includes(MARK)) return settle(replaced);
    const [head, ...pieces] = replaced.split(MARK);
    return settle(head + pieces.map(conjugateAfterThey).join(''));
  };

  return sentences.map((sentence, i) => {
    // The introduction keeps its first mention; any later one becomes a pronoun.
    if (i === 0) return swap(sentence, 1);
    const startsWithName = sentence.startsWith(`${name} `) || sentence.startsWith(`${name}'s `);
    // One later sentence (the fourth or after) may start with the name again.
    const keep = startsWithName && i >= 3 && !keptReminder ? 1 : 0;
    if (keep) keptReminder = true;
    return swap(sentence, keep);
  });
}

/** An ideal: mostly from the alignment, sometimes from the class. */
export function generateIdeal(rng: RNG, ctx: DescriptionContext): string {
  const cls = classTables(ctx.classId);
  if (cls && rng() < 0.35) return fill(pick(rng, [...cls.ideals]), ctx);
  const part = pick(rng, partsFor(ctx));
  return fill(pick(rng, [...IDEALS[part], ...MORE_IDEALS[part]]), ctx);
}

/** A flaw: general, alignment-shadow or class-specific. */
export function generateFlaw(rng: RNG, ctx: DescriptionContext): string {
  const cls = classTables(ctx.classId);
  const roll = rng();
  if (cls && roll < 0.2) return fill(pick(rng, [...cls.flaws]), ctx);
  if (roll < 0.45) return fill(pick(rng, [...ALIGNMENT_FLAWS[pick(rng, partsFor(ctx))]]), ctx);
  return fill(pick(rng, [...FLAWS, ...MORE_FLAWS]), ctx);
}

/** A short-term goal: something for the next few adventures. */
export function generateShortTermGoal(rng: RNG, ctx: DescriptionContext): string {
  const cls = classTables(ctx.classId);
  const sp = speciesTables(ctx.speciesId);
  const roll = rng();
  if (cls && roll < 0.3) return fill(pick(rng, [...cls.shortTermGoals]), ctx);
  if (sp && roll < 0.45) return fill(pick(rng, [...sp.shortTermGoals]), ctx);
  return fill(pick(rng, [...SHORT_TERM_GOALS]), ctx);
}

/** A long-term goal: the ambition of a lifetime. */
export function generateLongTermGoal(rng: RNG, ctx: DescriptionContext): string {
  const cls = classTables(ctx.classId);
  const sp = speciesTables(ctx.speciesId);
  const roll = rng();
  if (cls && roll < 0.25) return fill(pick(rng, [...cls.longTermGoals]), ctx);
  if (sp && roll < 0.4) return fill(pick(rng, [...sp.longTermGoals]), ctx);
  if (roll < 0.6) return fill(pick(rng, [...ALIGNMENT_LONG_TERM_GOALS[pick(rng, partsFor(ctx))]]), ctx);
  return fill(pick(rng, [...LONG_TERM_GOALS]), ctx);
}

/** All five fields at once. */
export function generateProfile(rng: RNG, ctx: DescriptionContext): GeneratedProfile {
  return {
    description: generateDescription(rng, ctx),
    ideal: generateIdeal(rng, ctx),
    flaw: generateFlaw(rng, ctx),
    shortTermGoal: generateShortTermGoal(rng, ctx),
    longTermGoal: generateLongTermGoal(rng, ctx),
  };
}

/**
 * How many different profiles the generator can produce for a context (the
 * product of the pool sizes it draws from), as a bigint. Used by the tests to
 * pin the variety; a lower bound, since it ignores trait order.
 */
export function descriptionCombinations(ctx: DescriptionContext): bigint {
  const cls = classTables(ctx.classId);
  const sp = speciesTables(ctx.speciesId);
  const heritage = heritagePool(ctx);
  const parts = partsFor(ctx);
  const n = (x: number) => BigInt(x);
  const sumParts = (rec: Record<AlignmentPart, readonly string[]>) => parts.reduce((s, p) => s + rec[p].length, 0);
  const traitPairs = alignmentParts(ctx.alignment).length === 2
    ? ALIGNMENT_TRAITS[parts[0]].length * ALIGNMENT_TRAITS[parts[1]].length
    : 4 * 3;
  const description =
    n((cls?.openers ?? GENERIC_OPENERS).length) *
    n(traitPairs) *
    n(DEMEANOR_TEMPLATES.length) *
    n(heritage ? heritage.heritages.length + heritage.lineage.length : 1) *
    n(GENERIC_PASTS.length + (cls?.pasts.length ?? 0) + (sp?.pasts.length ?? 0)) *
    n(sumParts(ALIGNMENT_COLOR)) *
    n(QUIRKS.length) *
    n(MANNERS.length + (sp?.manners.length ?? 0));
  const ideals = n(parts.reduce((s, p) => s + IDEALS[p].length + MORE_IDEALS[p].length, 0) + (cls?.ideals.length ?? 0));
  const flaws = n(FLAWS.length + MORE_FLAWS.length + sumParts(ALIGNMENT_FLAWS) + (cls?.flaws.length ?? 0));
  const shortGoals = n(SHORT_TERM_GOALS.length + (cls?.shortTermGoals.length ?? 0) + (sp?.shortTermGoals.length ?? 0));
  const longGoals = n(
    LONG_TERM_GOALS.length + sumParts(ALIGNMENT_LONG_TERM_GOALS) + (cls?.longTermGoals.length ?? 0) + (sp?.longTermGoals.length ?? 0),
  );
  return description * ideals * flaws * shortGoals * longGoals;
}
