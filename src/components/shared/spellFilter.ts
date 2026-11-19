import type { CatalogSpell, SpellSchool } from '../../data/spells';

/** The search + filter state shared by Spells > Browse and the Prepared lists. */
export interface SpellFilterState {
  query: string;
  level: 'all' | number;
  school: 'all' | SpellSchool;
  ritual: boolean;
  concentration: boolean;
}

export const EMPTY_SPELL_FILTER: SpellFilterState = {
  query: '',
  level: 'all',
  school: 'all',
  ritual: false,
  concentration: false,
};

/** True when any filter or search term is set. */
export function spellFilterActive(f: SpellFilterState): boolean {
  return f.query.trim() !== '' || f.level !== 'all' || f.school !== 'all' || f.ritual || f.concentration;
}

/** Whether a spell passes the filter (search covers name, effect text and material). */
export function matchesSpellFilter(s: CatalogSpell, f: SpellFilterState): boolean {
  const term = f.query.trim().toLowerCase();
  if (term) {
    const material = (s.components as { material?: string }).material ?? '';
    const haystack = `${s.name}\n${s.effect}\n${material}`.toLowerCase();
    if (!haystack.includes(term)) return false;
  }
  if (f.level !== 'all' && s.level !== f.level) return false;
  if (f.school !== 'all' && s.school !== f.school) return false;
  if (f.ritual && !s.ritual) return false;
  if (f.concentration && !s.concentration) return false;
  return true;
}
