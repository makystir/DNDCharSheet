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
import { resolveClass } from './classes';
import type { ClassFeature } from '../data/classes';

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
 * The fixed, auto-granted language id for a base-class feature, keyed by the
 * feature's printed name, plus how many languages that feature lets the player
 * choose. Anchored to the actual feature ROWS in src/data/classes.ts (matched
 * by name + gated on the feature's level there) — this is a small mapping from
 * "this feature grants a language" to the mechanical effect, because the effect
 * text in classes.ts is prose, NOT a parallel table of which classes/levels
 * grant languages (classes.ts stays the source of truth for that).
 *
 *  - Rogue L1 "Thieves' Cant" (PHB 2024 "Rogue: Thieves' Cant"): "You know
 *    Thieves' Cant plus one other language of your choice." → fixed
 *    'thieves-cant' + choose 1.
 *  - Ranger L2 "Deft Explorer" (PHB 2024 "Ranger: Deft Explorer"): "...learn
 *    two languages of your choice." → no fixed grant + choose 2.
 *
 * 'thieves-cant' is intentionally NOT in LANGUAGES: it is an auto-grant, never a
 * creation or feature "choose" option.
 */
const FEATURE_LANGUAGE_GRANTS: Record<string, { fixed: string[]; chooseCount: number }> = {
  // PHB 2024 "Rogue: Thieves' Cant"
  "Thieves' Cant": { fixed: ['thieves-cant'], chooseCount: 1 },
  // PHB 2024 "Ranger: Deft Explorer"
  'Deft Explorer': { fixed: [], chooseCount: 2 },
};

/**
 * The feature-driven language grant for a single-class character at its current
 * level: the FIXED auto-granted ids and how many languages the player CHOOSES
 * from features. Derived by scanning the character's base-class feature rows in
 * src/data/classes.ts for a language-granting feature the character has REACHED
 * (feature.level <= character level), so classes.ts stays the source of truth
 * for which class/level grants what. Multiclassing is out of scope (single
 * class). A class/level with no reached language feature yields
 * { fixed: [], chooseCount: 0 }. PHB 2024 (Rogue L1 "Thieves' Cant"; Ranger L2
 * "Deft Explorer").
 */
export function featureLanguageGrants(
  character: Character,
): { fixed: string[]; chooseCount: number } {
  const cls = resolveClass(character);
  if (!cls) return { fixed: [], chooseCount: 0 };
  const fixed: string[] = [];
  let chooseCount = 0;
  for (const feature of cls.features as ClassFeature[]) {
    const grant = FEATURE_LANGUAGE_GRANTS[feature.name];
    // Gate on the character having REACHED the feature's level (classes.ts row).
    if (!grant || feature.level > character.level) continue;
    for (const id of grant.fixed) {
      if (!fixed.includes(id)) fixed.push(id);
    }
    chooseCount += grant.chooseCount;
  }
  return { fixed, chooseCount };
}

/**
 * Whether a set of feature "choose N" language picks is valid for the
 * character's class/level: at most `chooseCount` picks, none Common, none a
 * fixed auto-grant id (those are automatic, not a pick), and no duplicates. A
 * class/level whose chooseCount is 0 (no reached language feature) rejects any
 * pick. Pure. PHB 2024 (Rogue L1 "Thieves' Cant"; Ranger L2 "Deft Explorer").
 */
export function isFeatureLanguageSelectionValid(
  character: Character,
  granted: string[],
): boolean {
  const { fixed, chooseCount } = featureLanguageGrants(character);
  const keys = granted.map((l) => l.trim().toLowerCase()).filter((k) => k.length > 0);
  if (keys.length > chooseCount) return false;
  if (keys.some((k) => k === COMMON_LANGUAGE)) return false;
  const fixedKeys = new Set(fixed.map((f) => f.trim().toLowerCase()));
  if (keys.some((k) => fixedKeys.has(k))) return false;
  return new Set(keys).size === keys.length;
}

/**
 * The languages a character knows: Common (always first, never duplicated) plus
 * the creation `chosen` languages, the stored feature `granted` picks, and the
 * fixed auto-grants from the character's base-class features — unioned and
 * de-duplicated (PHB 2024 "Choose Languages", L1294; Rogue L1 "Thieves' Cant";
 * Ranger L2 "Deft Explorer"). Reads the additive-optional `languages.chosen`
 * and `languages.granted` fields; absent = just Common. A grant below its
 * feature level does not apply: if the feature is not reached (chooseCount 0)
 * the stored `granted` picks are ignored, and granted picks are capped at
 * chooseCount so a stale over-long list cannot leak extra languages.
 */
export function knownLanguages(character: Character): string[] {
  const chosen = character.languages?.chosen ?? [];
  const { fixed, chooseCount } = featureLanguageGrants(character);
  const grantedPicks = (character.languages?.granted ?? []).slice(0, chooseCount);
  return resolveLanguages(chosen, [...grantedPicks, ...fixed]);
}
