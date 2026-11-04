import { useEffect } from 'react';
import type { Character } from '../types/character';
import { getSpell } from '../data/spells';
import { endConcentrationIfBroken } from '../logic/concentration';

/**
 * Ends Concentration the moment the character's state breaks it (Stage A5b):
 * Incapacitated (including the Unconscious a character gains at 0 Hit Points) or
 * dead. PHB 2024 "Concentration" (Docs/PlayersHandbook.md L20777). The rule is
 * logic/concentration.ts endConcentrationIfBroken; this hook only applies it
 * and announces it through `notify` (the app Toast).
 *
 * Mounted once at the app shell so it also covers changes made on other tabs
 * (a condition added on the Character page, say). Idempotent: once the field is
 * cleared there is nothing left to end.
 */
export function useConcentrationAutoEnd(
  character: Character | undefined,
  onChange: (next: Character) => void,
  notify: (message: string) => void,
): void {
  useEffect(() => {
    if (!character) return;
    const { character: next, reason } = endConcentrationIfBroken(character);
    if (reason === null) return;
    const spellId = character.concentration?.spellId;
    const name = spellId ? (getSpell(spellId)?.name ?? spellId) : 'the spell';
    onChange(next);
    notify(
      reason === 'dead'
        ? `Concentration on ${name} ended: the character is dead.`
        : `Concentration on ${name} ended: the character is Incapacitated.`,
    );
  }, [character, onChange, notify]);
}
