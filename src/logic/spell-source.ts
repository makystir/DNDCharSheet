import type { SpellData } from '../data/spells';

/**
 * Where a player finds a spell in print. Every spell in the catalog is
 * transcribed from the Player's Handbook (2024), Chapter 7 "Spells", in the
 * "Spell Descriptions" section, where spells are listed in alphabetical order
 * (see src/data/spells.ts, generated from Docs/PlayersHandbook.md).
 *
 * Page numbers are not given: the in-repo PHB text has almost no page markers,
 * so a page can't be confirmed from the project's sources (rules-compliance:
 * never invent). See the open point in the Spells work notes.
 */
export const SPELL_BOOK = "Player's Handbook (2024)";
export const SPELL_CHAPTER = 'Chapter 7: Spells';
export const SPELL_SECTION = 'Spell Descriptions';

/** One-line citation, e.g. "Player's Handbook (2024), Chapter 7: Spells, Spell Descriptions (alphabetical): Fireball". */
export function spellSourceCitation(spell: Pick<SpellData, 'name'>): string {
  return `${SPELL_BOOK}, ${SPELL_CHAPTER}, ${SPELL_SECTION} (alphabetical): ${spell.name}`;
}

/** The note shown above spell lists that print full spell text. */
export const SPELL_SOURCE_NOTE = `Full spell text from the ${SPELL_BOOK}, ${SPELL_CHAPTER}, "${SPELL_SECTION}", where spells are listed alphabetically.`;
