/**
 * Language model (D&D 5.5e / 2024), Stage A7 PART 1.
 *
 * In 2024 a species grants NO fixed languages: you know Common and choose
 * additional languages at creation, and a background's narrative/Origin feat
 * may contribute one (PHB 2024 "Choose Languages", Docs/PlayersHandbook.md
 * L1294). This module models that invariant: Common is ALWAYS known, appears
 * first, and is never duplicated; chosen + granted languages are unioned and
 * de-duplicated. All functions are pure.
 */

import type { Character } from '../types/character';

/** The always-known base language (stored/compared lowercase). PHB 2024 L1294. */
export const COMMON_LANGUAGE = 'common';

/**
 * How many additional languages a character CHOOSES at creation beyond Common.
 *
 * PHB 2024 "Choose Languages" (Docs/PlayersHandbook.md L1627): "Your character
 * knows at least three languages: Common plus two languages you roll or choose
 * from the Standard Languages table." So creation grants Common + exactly TWO
 * chosen standard languages. ("Your class and other features might also give
 * you languages" — those are feature-driven grants applied elsewhere, NOT free
 * picks in the creation wizard, so the wizard caps the player's choice at this
 * number.)
 */
export const CREATION_LANGUAGE_CHOICES = 2;

/**
 * Whether a set of chosen (non-Common) creation languages is valid: no more than
 * CREATION_LANGUAGE_CHOICES, none of them Common (Common is implicit), and no
 * duplicates. Pure. PHB 2024 "Choose Languages" (L1627).
 */
export function isLanguageSelectionValid(
  chosen: string[],
  max: number = CREATION_LANGUAGE_CHOICES,
): boolean {
  const keys = chosen.map((l) => l.trim().toLowerCase()).filter((k) => k.length > 0);
  if (keys.length > max) return false;
  if (keys.some((k) => k === COMMON_LANGUAGE)) return false;
  return new Set(keys).size === keys.length;
}

/**
 * The standard-language option list the creation UI offers (PHB 2024 "Languages"
 * table). Common is implicit (always known) and is intentionally NOT repeated
 * here as a choosable option. Values are lowercase ids; the UI title-cases them.
 */
// PHB 2024 "Languages" table (standard languages). Common is always known.
export const LANGUAGES: string[] = [
  'common-sign-language',
  'draconic',
  'dwarvish',
  'elvish',
  'giant',
  'gnomish',
  'goblin',
  'halfling',
  'orc',
];

/**
 * Resolve the set of known languages: Common first (always, never duplicated),
 * then the union of `chosen` and any `granted` languages, de-duplicated while
 * preserving first-seen order. Comparison is case-insensitive on the stored
 * lowercase id; Common supplied again in either list is dropped.
 * PHB 2024 "Choose Languages" (L1294).
 */
export function resolveLanguages(chosen: string[], granted?: string[]): string[] {
  const result: string[] = [COMMON_LANGUAGE];
  const seen = new Set<string>([COMMON_LANGUAGE]);
  for (const lang of [...chosen, ...(granted ?? [])]) {
    const key = lang.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    result.push(lang.trim());
  }
  return result;
}

/**
 * The languages a character knows: Common plus their chosen languages (PHB 2024
 * "Choose Languages", L1294). Reads the additive-optional `languages.chosen`
 * field; absent = just Common.
 */
export function knownLanguages(character: Character): string[] {
  return resolveLanguages(character.languages?.chosen ?? []);
}
