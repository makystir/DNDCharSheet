/**
 * The spells a character actually has, per spellcasting class: known cantrips and
 * prepared spells. This is what the Spells page Summary lists, so a player can see
 * their whole spell set at a glance.
 *
 * Nothing here is a rule: the required cantrips, always-prepared spells, legality
 * checks and per-class buckets come from logic/spellcasting.ts, the same sources
 * the Prepared tab uses, so the two views always agree.
 */

import type { Character } from '../types/character';
import { allClasses } from './classes';
import {
  classAlwaysPreparedSpells,
  classRequiredCantrips,
  entryIsSpellcaster,
  illegalSpellSelections,
} from './spellcasting';
import { getClass } from '../data/classes';
import { getSpell } from '../data/spells';
import type { SpellId } from '../data/spells';

export interface KnownClassSpells {
  classId: string;
  className: string;
  /** Known cantrips, required ones included, alphabetical. */
  cantrips: SpellId[];
  /** Prepared spells (feature-granted ones included), by level then name. */
  prepared: SpellId[];
  /** The prepared spells a class or subclass feature always grants. */
  alwaysPrepared: SpellId[];
}

function byName(a: SpellId, b: SpellId): number {
  return (getSpell(a)?.name ?? a).localeCompare(getSpell(b)?.name ?? b);
}

/** Known cantrips and prepared spells for each spellcasting class the character has. */
export function knownSpellsByClass(character: Character): KnownClassSpells[] {
  const illegal = illegalSpellSelections(character);
  return allClasses(character)
    .filter(entryIsSpellcaster)
    .map((entry) => {
      const bucket = character.spellcasting?.byClass?.[entry.id] ?? {};
      const illegalKeys = new Set(
        illegal.filter((i) => i.classId === entry.id).map((i) => `${i.kind}:${i.id}`),
      );
      const required = classRequiredCantrips(entry);
      const always = classAlwaysPreparedSpells(entry, character);

      const storedCantrips = (bucket.cantrips ?? []).filter((id) => !illegalKeys.has(`cantrip:${id}`));
      const cantrips = [...new Set([...required, ...storedCantrips])].filter((id) => getSpell(id));

      const chosen = (bucket.prepared ?? []).filter(
        (id) => !always.includes(id) && !illegalKeys.has(`prepared:${id}`),
      );
      const prepared = [...new Set([...always, ...chosen])]
        .filter((id) => getSpell(id))
        .sort((a, b) => (getSpell(a)!.level - getSpell(b)!.level) || byName(a, b));

      return {
        classId: entry.id,
        className: getClass(entry.id)?.name ?? entry.id,
        cantrips: cantrips.sort(byName),
        prepared,
        alwaysPrepared: always,
      };
    });
}
