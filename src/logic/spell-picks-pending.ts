/**
 * Newly owed spell picks, for the Advancement "Choices Pending" list.
 *
 * Cantrips, spellbook and prepared counts come straight from `pendingSetupChoices`
 * (src/logic/starting-choices.ts) so no cap is recomputed here; the same function
 * feeds the Overview "Finish setting up" card, so both surfaces always agree. Class
 * skills are NOT included (they are not a spell pick and never change on level up).
 *
 * Mystic Arcanum (PHB 2024 "Warlock: Mystic Arcanum"): a level 6 spell at Warlock 11,
 * 7 at 13, 8 at 15, 9 at 17 (data: MYSTIC_ARCANUM_LEVELS, by Warlock level). Each
 * arcanum spell level not yet chosen in `spellcasting.mysticArcana` is one owed pick.
 * Pure.
 */
import type { Character } from '../types/character';
import { MYSTIC_ARCANUM_LEVELS } from '../data/spell-progression';
import { allClasses } from './classes';
import { pendingSetupChoices } from './starting-choices';
import type { PendingItem } from './starting-choices';

export type SpellPickKind = 'cantrips' | 'spellbook' | 'prepared' | 'mystic-arcanum';

export interface SpellPickItem {
  kind: SpellPickKind;
  have: number;
  need: number;
  /** Set only for multiclass characters (or Mystic Arcanum), naming the class. */
  className?: string;
  /** Mystic Arcanum only: the spell level (6/7/8/9) still to choose. */
  spellLevel?: number;
}

/** Spell levels of Mystic Arcanum granted at the character's Warlock level(s). */
function arcanumSpellLevels(character: Character): number[] {
  const warlock = allClasses(character).find((e) => e.id === 'warlock');
  if (!warlock) return [];
  return [...(MYSTIC_ARCANUM_LEVELS[warlock.level] ?? [])];
}

/** The spell picks still owed: cantrips, spellbook, prepared and Mystic Arcanum, in that order. */
export function pendingSpellPicks(character: Character): SpellPickItem[] {
  const items: SpellPickItem[] = pendingSetupChoices(character)
    .filter((item: PendingItem) => item.kind !== 'class-skills')
    .map((item) => ({
      kind: item.kind as Exclude<PendingItem['kind'], 'class-skills'>,
      have: item.have,
      need: item.need,
      ...(item.className ? { className: item.className } : {}),
    }));
  const chosen = character.spellcasting?.mysticArcana ?? {};
  for (const spellLevel of arcanumSpellLevels(character)) {
    if (chosen[spellLevel] === undefined) {
      items.push({ kind: 'mystic-arcanum', have: 0, need: 1, className: 'Warlock', spellLevel });
    }
  }
  return items;
}

/** Display label for an item, e.g. "Wizard spellbook spells" or "Level 6 Mystic Arcanum". */
export function spellPickLabel(item: SpellPickItem): string {
  const base: Record<Exclude<SpellPickKind, 'mystic-arcanum'>, string> = {
    cantrips: 'Cantrips',
    spellbook: 'Spellbook spells',
    prepared: 'Prepared spells',
  };
  if (item.kind === 'mystic-arcanum') return `Level ${item.spellLevel} Mystic Arcanum spell`;
  return item.className ? `${item.className} ${base[item.kind].toLowerCase()}` : base[item.kind];
}
