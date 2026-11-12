import type { Ability, SkillId } from '../types/character';
import { ABILITIES, SKILLS } from '../types/character';
import { getClass } from '../data/classes';
import { EQUIPMENT_CATALOG } from '../data/equipment';
import { LANGUAGE_INFO } from '../data/rules-text';
import { classGuidance, recommendedArray } from './class-guidance';

/**
 * Information and suggestions for the character-creation wizard, so a player new
 * to D&D learns what each option means before choosing it. Everything here is
 * either a short paraphrase of the Player's Handbook (2024) with its line
 * citation, or derived from data the app already holds. Suggestions are only
 * ever shown; the player still makes every choice.
 */

// ─── Class overview (PHB 2024 "Class Overview" table, L1305-1320) ─────────────

export type ClassComplexity = 'Low' | 'Average' | 'High';

export interface ClassOverviewRow {
  /** The table's "Likes ..." column. */
  likes: string;
  /** The table's "Complexity" column. */
  complexity: ClassComplexity;
}

/** PHB 2024 "Class Overview" table (Docs/PlayersHandbook.md L1305-1320), transcribed. */
export const CLASS_OVERVIEW: Record<string, ClassOverviewRow> = {
  barbarian: { likes: 'Battle', complexity: 'Average' },
  bard: { likes: 'Performing', complexity: 'High' },
  cleric: { likes: 'Gods', complexity: 'Average' },
  druid: { likes: 'Nature', complexity: 'High' },
  fighter: { likes: 'Weapons', complexity: 'Low' },
  monk: { likes: 'Unarmed combat', complexity: 'High' },
  paladin: { likes: 'Defense', complexity: 'Average' },
  ranger: { likes: 'Survival', complexity: 'Average' },
  rogue: { likes: 'Stealth', complexity: 'Low' },
  sorcerer: { likes: 'Power', complexity: 'High' },
  warlock: { likes: 'Occult lore', complexity: 'High' },
  wizard: { likes: 'Spell books', complexity: 'Average' },
};

export const CLASS_OVERVIEW_SOURCE = 'PHB 2024 "Class Overview" table';

/** Class ids the PHB rates Low complexity, in table order (the easiest to learn). */
export function lowComplexityClasses(): string[] {
  return Object.entries(CLASS_OVERVIEW)
    .filter(([, row]) => row.complexity === 'Low')
    .map(([id]) => id);
}

// ─── Species (PHB 2024 chapter 4 species introductions) ──────────────────────

export interface SpeciesInfo {
  /** A short paraphrase of the species' introduction (not verbatim). */
  summary: string;
  source: string;
}

/**
 * One-line paraphrases of each species' introduction in PHB 2024 chapter 4
 * ("Character Origins: Species Descriptions", Docs/PlayersHandbook.md).
 */
export const SPECIES_INFO: Record<string, SpeciesInfo> = {
  aasimar: {
    summary: 'Mortals with a spark of the Upper Planes in their souls, which they can fan into light, healing, and heavenly fury.',
    source: 'PHB 2024 "Aasimar" (L8001)',
  },
  dragonborn: {
    summary: 'Descendants of chromatic and metallic dragons. A dragon ancestor sets the damage of their breath weapon and what they resist.',
    source: 'PHB 2024 "Dragonborn" (L8039)',
  },
  dwarf: {
    summary: 'Raised from the earth by a god of the forge: at home with stone and metal, tough as mountains, and living about 350 years.',
    source: 'PHB 2024 "Dwarf" (L8075)',
  },
  elf: {
    summary: 'Folk created by the god Corellon. Each elf belongs to a lineage (Drow, High Elf, or Wood Elf) that shapes their magic.',
    source: 'PHB 2024 "Elf" (L8097)',
  },
  gnome: {
    summary: 'Small, clever, magical folk made by gods of invention, illusion, and life underground, split into forest and rock gnomes.',
    source: 'PHB 2024 "Gnome" (L8157)',
  },
  goliath: {
    summary: 'Towering descendants of giants who carry a giant ancestor\'s boon and can briefly grow close to giant size.',
    source: 'PHB 2024 "Goliath" (L8179)',
  },
  halfling: {
    summary: 'Small folk who love home and community, many with a brave, adventurous streak. Their size helps them slip through crowds and tight spaces.',
    source: 'PHB 2024 "Halfling" (L8209)',
  },
  human: {
    summary: 'Found across the multiverse, as varied as they are numerous, and known for their ambition and resourcefulness.',
    source: 'PHB 2024 "Human" (L8235)',
  },
  orc: {
    summary: 'Children of the god Gruumsh, gifted with endurance, determination, and the ability to see in the dark.',
    source: 'PHB 2024 "Orc" (L8261)',
  },
  tiefling: {
    summary: 'Linked by blood to a devil, demon, or other Fiend. The fiendish legacy brings power but does not decide their morals.',
    source: 'PHB 2024 "Tiefling" (L8287)',
  },
};

/**
 * Standard languages a species' own people speak, read from the language
 * origins (PHB 2024 "Standard Languages" table; data/rules-text.ts
 * LANGUAGE_INFO): a language whose origin is the species, e.g. Dwarvish for a
 * dwarf. Empty when no standard language originates with the species.
 */
const SPECIES_ORIGIN_NAME: Record<string, string> = {
  dwarf: 'Dwarves',
  elf: 'Elves',
  gnome: 'Gnomes',
  halfling: 'Halflings',
  orc: 'Orcs',
};

export function speciesLanguageSuggestions(speciesId: string | undefined): string[] {
  const origin = speciesId ? SPECIES_ORIGIN_NAME[speciesId] : undefined;
  if (!origin) return [];
  return Object.entries(LANGUAGE_INFO)
    .filter(([, info]) => info.kind === 'standard' && info.origin === origin)
    .map(([id]) => id);
}

// ─── Alignment (PHB 2024 "The Nine Alignments", L1856-1879) ───────────────────

/** Short paraphrases of each alignment (PHB 2024 L1862-1879; Unaligned L1848). */
export const ALIGNMENT_INFO: Record<string, { summary: string; source: string }> = {
  'Lawful Good': {
    summary: 'Tries to do the right thing as society expects, like someone who fights injustice and protects the innocent.',
    source: 'PHB 2024 "The Nine Alignments" (L1862)',
  },
  'Neutral Good': {
    summary: 'Does the best they can, working within rules without feeling bound by them, like a kindly person who helps those in need.',
    source: 'PHB 2024 "The Nine Alignments" (L1864)',
  },
  'Chaotic Good': {
    summary: 'Follows their conscience with little care for what others expect, like a rebel who robs a cruel baron to help the poor.',
    source: 'PHB 2024 "The Nine Alignments" (L1866)',
  },
  'Lawful Neutral': {
    summary: 'Acts by law, tradition, or a personal code, unswayed by those in need or by the temptations of evil.',
    source: 'PHB 2024 "The Nine Alignments" (L1868)',
  },
  'True Neutral': {
    summary: 'Avoids moral questions and takes no sides, doing what seems best at the time.',
    source: 'PHB 2024 "The Nine Alignments" (L1870)',
  },
  'Chaotic Neutral': {
    summary: 'Follows their whims and values personal freedom above all, like a scoundrel living by their wits.',
    source: 'PHB 2024 "The Nine Alignments" (L1872)',
  },
  'Lawful Evil': {
    summary: 'Methodically takes what they want within a code of tradition, loyalty, or order, like a scheming, exploitative aristocrat.',
    source: 'PHB 2024 "The Nine Alignments" (L1874)',
  },
  'Neutral Evil': {
    summary: 'Untroubled by the harm they cause while chasing their desires, like a criminal who robs as they please.',
    source: 'PHB 2024 "The Nine Alignments" (L1876)',
  },
  'Chaotic Evil': {
    summary: 'Acts with arbitrary violence driven by hatred or bloodlust, like a villain bent on vengeance and havoc.',
    source: 'PHB 2024 "The Nine Alignments" (L1878)',
  },
  Unaligned: {
    summary: 'No alignment at all. In the PHB this is for creatures that lack rational thought, such as animals.',
    source: 'PHB 2024 "Unaligned Creatures" (L1848)',
  },
};

/** PHB 2024 L1854: player characters are assumed not to be evil; check with the DM first. */
export const EVIL_ALIGNMENT_NOTE = 'D&D assumes player characters aren\'t evil. Check with your DM before playing an evil character (PHB 2024 L1854).';

export const isEvilAlignment = (alignment: string): boolean => alignment.endsWith(' Evil');

// ─── Ability score methods (PHB 2024 "Generate Your Scores", L1670-1678) ──────

export const ABILITY_METHOD_INFO: Record<'standard-array' | 'point-buy' | 'roll', string> = {
  'standard-array': 'Use six fixed scores (15, 14, 13, 12, 10, 8) and decide where each goes. Quick, and the PHB suggests where to put each score for your class (the "Use recommended array" button).',
  'point-buy': 'Spend 27 points to buy each score from 8 to 15; higher scores cost more. Lets you fine-tune exactly where your strengths are.',
  roll: 'Roll four six-sided dice six times, keeping the highest three each time. You might roll higher or lower than the other methods.',
};

export const ABILITY_METHOD_SOURCE = 'PHB 2024 "Generate Your Scores" (L1670-1678). Your DM might prefer a particular method.';

// ─── Details prompts (PHB 2024 "Imagine Your Past and Present", L1614-1623) ───

export const PAST_PROMPTS: readonly string[] = [
  'Who raised you?',
  'Who was your dearest childhood friend?',
  'Did you grow up with a pet?',
  'Have you fallen in love? If so, with whom?',
  'Did you join an organization, such as a guild or religion? Are you still a member?',
  'What in your past inspires you to go adventuring now?',
];

export const PAST_PROMPTS_SOURCE = 'PHB 2024 "Imagine Your Past and Present" (L1614-1623)';

// ─── Suggestions derived from the class ─────────────────────────────────────

/**
 * A suggested background ability increase: +2 on the background ability the
 * class most wants and +1 on the next, ranked by the class's PHB "Standard Array
 * by Class" placement (class-guidance.ts). Null without a class or when none of
 * the three background abilities ranks above the others (never happens with
 * PHB data). The background rule (+2/+1 or +1/+1/+1) is PHB 2024 L1720 and L7810.
 */
export function suggestedBackgroundIncrease(
  classId: string | undefined,
  backgroundAbilities: readonly Ability[],
): { plusTwo: Ability; plusOne: Ability } | null {
  const ranks = recommendedArray(classId);
  if (!ranks || backgroundAbilities.length < 2) return null;
  const ordered = [...backgroundAbilities].sort(
    (a, b) => ranks[b] - ranks[a] || ABILITIES.indexOf(a) - ABILITIES.indexOf(b),
  );
  return { plusTwo: ordered[0], plusOne: ordered[1] };
}

/**
 * The spellcasting ability to suggest for a species spell trait (Aasimar's
 * Light Bearer, elf and gnome lineages, tiefling legacy: Int, Wis, or Cha):
 * the class's own spellcasting ability when it is one of the options, otherwise
 * the option the class ranks highest in its Standard Array placement.
 */
export function suggestedSpeciesSpellAbility(
  classId: string | undefined,
  options: readonly string[],
): { ability: Ability; reason: 'class-spellcasting' | 'highest-score' } | null {
  const guidance = classGuidance(classId);
  if (!guidance) return null;
  const casting = guidance.spellcastingAbility;
  if (casting && options.includes(casting)) return { ability: casting, reason: 'class-spellcasting' };
  const ranks = recommendedArray(classId);
  const abilities = options.filter((o): o is Ability => (ABILITIES as readonly string[]).includes(o));
  if (!ranks || abilities.length === 0) return null;
  const best = [...abilities].sort((a, b) => ranks[b] - ranks[a])[0];
  return { ability: best, reason: 'highest-score' };
}

/**
 * Skills in `options` that use one of the class's primary abilities (PHB 2024
 * Core <Class> Traits), so the player is good at them from the start.
 */
export function skillsUsingPrimaryAbility(classId: string | undefined, options: readonly SkillId[]): SkillId[] {
  const primary = getClass(classId)?.primaryAbilities ?? [];
  if (primary.length === 0) return [];
  return options.filter((id) => {
    const skill = SKILLS.find((s) => s.id === id);
    return skill !== undefined && (primary as readonly string[]).includes(skill.ability);
  });
}

// ─── Tool choices for "choose a kind" background tools ──────────────────────

export interface ToolChoice {
  name: string;
  /** What the tool lets you do, when the catalog has it. */
  description?: string;
}

/** PHB 2024 "Gaming Set" variants (L9870-9878). */
const GAMING_SETS: ToolChoice[] = [
  { name: 'Dice Set' },
  { name: 'Dragonchess Set' },
  { name: 'Playing Cards' },
  { name: 'Three-Dragon Ante Set' },
];
const GAMING_SET_NOTE = 'Gaming Set (Wisdom); Utilize: discern whether someone is cheating (DC 10), or win the game (DC 20).';

/**
 * The specific tools a background's "choose one kind of ..." tool proficiency
 * can resolve to: every Artisan's Tools and Musical Instrument in the equipment
 * catalog (PHB 2024 L9662-9862 and L9890-9896), and the four Gaming Set variants
 * (PHB 2024 L9870-9878). Sorted by name.
 */
export function toolChoicesFor(category: 'gaming-set' | 'artisans-tools' | 'musical-instrument'): ToolChoice[] {
  if (category === 'gaming-set') return GAMING_SETS.map((t) => ({ ...t, description: GAMING_SET_NOTE }));
  const items = Object.values(EQUIPMENT_CATALOG).filter((e) =>
    category === 'artisans-tools'
      ? e.kind === 'tool' && (e.description ?? '').startsWith("Artisan's Tools")
      : e.id.startsWith('instrument-'),
  );
  return items
    .map((e) => ({ name: e.name, description: e.description }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
