import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Character } from '../../../types/character';

/**
 * Holds the character in state so edits made through onChange re-render the
 * tab (like the app shell does). onState receives every emitted character.
 */
export function Stateful({
  initial,
  onState,
  children,
}: {
  initial: Character;
  onState?: (next: Character) => void;
  children: (character: Character, onChange: (next: Character) => void) => ReactNode;
}) {
  const [character, setCharacter] = useState(initial);
  const onChange = (next: Character) => {
    onState?.(next);
    setCharacter(next);
  };
  return <>{children(character, onChange)}</>;
}