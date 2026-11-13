import { vi } from 'vitest';
import { createCharacter } from '../../../storage/character-store';
import type { Character } from '../../../types/character';
import type { UndoSink } from '../useRecordList';

export const undoStub = (): UndoSink => ({ show: vi.fn() });

/** A level-`level` Ranger (Beast Master unless told otherwise) with the given Wisdom score. */
export function rangerCharacter(level: number, wis = 16, subclassId: 'beastMaster' | 'hunter' = 'beastMaster'): Character {
  const c = createCharacter('Ranger');
  return { ...c, level, abilities: { ...c.abilities, wis }, classes: [{ id: 'ranger', level, subclassId }] };
}

export function plainCharacter(patch: Partial<Character> = {}): Character {
  return { ...createCharacter('Tester'), ...patch };
}

export function withHouseRule(c: Character, rule: 'sidekicks' | 'loyalty', on = true): Character {
  return { ...c, houseRules: { ...c.houseRules, [rule]: on } };
}

/** Records every character the tab emits so a test can assert on the latest one. */
export function track(latest: { current: Character }): (c: Character) => void {
  return (c) => {
    latest.current = c;
  };
}
