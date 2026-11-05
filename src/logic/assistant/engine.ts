import type { Character } from '../../types/character';
import type { Suggestion, SuggestionContext, SuggestionSource } from './types';
import { advancementSuggestions } from './rules/advancement';
import { encumbranceSuggestions } from './rules/encumbrance';
import { restSuggestions } from './rules/rest';
import { combatSuggestions } from './rules/combat';
import { fileBackupSuggestions } from './rules/file-backup';
import { orderSuggestions } from './ordering';

/**
 * Pure, deterministic, side-effect-free engine entry point (Stage B8). Composes
 * the D&D rule modules then orders the result. It never mutates the character,
 * writes storage, navigates, opens a dialog, or touches the network. Every
 * module REUSES existing derived logic (A2 encumbrance, A5 HP/rests/conditions,
 * A6c advisor, B3 backup reminder) and emits only serializable descriptors.
 */
export function getSuggestions(
  character: Character | undefined,
  context: SuggestionContext,
): Suggestion[] {
  if (!character) return []; // absent sheet -> [], never throws
  const raw = [
    ...advancementSuggestions(character),
    ...encumbranceSuggestions(character),
    ...restSuggestions(character),
    ...combatSuggestions(character),
    // File-backup nudge: now/lastBackupAt come from the shell-built context so
    // the engine performs no storage read / Date.now() at eval time. The module
    // reads them off `context` and never falls back to the clock.
    ...fileBackupSuggestions(character, context),
  ];
  return orderSuggestions(raw, context); // deterministic
}

/**
 * The deterministic default source — the permanent offline fallback. Always
 * synchronous; sync callers narrow the `SuggestionSource` union with an
 * `Array.isArray` guard, whose sync branch is the only path taken today.
 */
export const deterministicSuggestionSource: SuggestionSource = {
  getSuggestions(character, context): Suggestion[] {
    return getSuggestions(character, context);
  },
};
