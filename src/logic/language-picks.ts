/**
 * Post-creation feature-language picks (Rogue L1 "Thieves' Cant": one language of
 * choice; Ranger L2 "Deft Explorer": two languages of choice — PHB 2024,
 * Docs/PlayersHandbook.md L5873-5898 and L5411-5419; "Choose Languages" L1627:
 * "Your class and other features might also give you languages").
 *
 * SINGLE SOURCE OF TRUTH for how many feature-language picks are owed. The
 * Advancement page "Choices Pending" list (and any other surface that needs the
 * count) must call {@link languagePicksStatus} rather than recomputing. The
 * count itself comes from featureLanguageGrants (logic/languages.ts), which
 * reads the class feature rows in src/data/classes.ts per class level.
 * All functions are pure.
 */

import type { Character } from '../types/character';
import {
  COMMON_LANGUAGE,
  LANGUAGES,
  featureLanguageGrants,
} from './languages';

export interface LanguagePicksStatus {
  /** Feature "choose N" picks granted by the reached class features. */
  owed: number;
  /** Distinct valid picks made (non-empty, not Common, not an automatic grant). */
  chosen: number;
  /** Picks still to make: max(0, owed - chosen). */
  remaining: number;
  /** Picks beyond the grant: max(0, chosen - owed). A warning, never a block. */
  over: number;
  /** Automatic grants (e.g. 'thieves-cant'): known without a pick. */
  fixed: string[];
}

const norm = (l: string): string => l.trim().toLowerCase();

/** The distinct, valid feature picks stored on the character (lowercased). */
function validPicks(character: Character, fixed: string[]): string[] {
  const fixedKeys = new Set(fixed.map(norm));
  const seen = new Set<string>();
  for (const raw of character.languages?.granted ?? []) {
    const key = norm(raw);
    if (key.length === 0 || key === COMMON_LANGUAGE || fixedKeys.has(key)) continue;
    seen.add(key);
  }
  return [...seen];
}

/**
 * Owed / chosen / remaining / over for the character's feature-language picks.
 * Multiclass-aware (each class grants at its own level). PHB 2024 (Rogue L1
 * "Thieves' Cant"; Ranger L2 "Deft Explorer").
 */
export function languagePicksStatus(character: Character): LanguagePicksStatus {
  const { fixed, chooseCount } = featureLanguageGrants(character);
  const chosen = validPicks(character, fixed).length;
  return {
    owed: chooseCount,
    chosen,
    remaining: Math.max(0, chooseCount - chosen),
    over: Math.max(0, chosen - chooseCount),
    fixed,
  };
}

/**
 * The standard languages the feature picker offers: Common is implicit and
 * automatic grants are not picks (neither is in LANGUAGES); a language already
 * taken at creation is hidden unless it is already a feature pick (so it can be
 * unticked). PHB 2024 Standard Languages table (L1631).
 */
export function featureLanguageOptions(character: Character): string[] {
  const { fixed } = featureLanguageGrants(character);
  const picks = new Set(validPicks(character, fixed));
  const creation = new Set((character.languages?.chosen ?? []).map(norm));
  const fixedKeys = new Set(fixed.map(norm));
  return LANGUAGES.filter(
    (l) => !fixedKeys.has(l) && l !== COMMON_LANGUAGE && (picks.has(l) || !creation.has(l)),
  );
}
