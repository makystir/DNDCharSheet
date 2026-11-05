import { useCallback, useState } from 'react';
import type { Character } from '../types/character';
import { createUndoStack, type UndoStack } from '../logic/undo';

/**
 * React wrapper over the pure {@link createUndoStack} (Stage B7), holding
 * whole-`Character` snapshots.
 *
 * DND's single edit path is a whole-`Character` `handleChange` (there is no
 * field-path `update`), so the undo stack stores pre-edit character snapshots
 * rather than field diffs. Reverting an edit replays the snapshot through the
 * edit path — the event log is NEVER read to reconstruct state.
 *
 * The pure stack is a mutable object held in state (lazy-initialised, never
 * reassigned except on `clear`/cap change) so the memoised callbacks stay
 * stable. `canUndo` / `canRedo` are mirrored into state and refreshed after each
 * mutation, so they are plain render values (no ref reads during render).
 */
export interface UseUndoStackResult {
  push: (snapshot: Character) => void;
  undo: () => Character | null;
  redo: () => Character | null;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
}

const DEFAULT_MAX_SIZE = 10;

export function useUndoStack(maxSize: number = DEFAULT_MAX_SIZE): UseUndoStackResult {
  // The pure stack lives in state so it is stable across renders and only ever
  // read/mutated inside callbacks (never during render). Lazy-initialised.
  const [stack] = useState<UndoStack<Character>>(() => createUndoStack<Character>(maxSize));
  const [depths, setDepths] = useState({ undo: 0, redo: 0 });

  const sync = useCallback(() => {
    setDepths({ undo: stack.undoDepth(), redo: stack.redoDepth() });
  }, [stack]);

  const push = useCallback(
    (snapshot: Character) => {
      stack.push(snapshot);
      sync();
    },
    [stack, sync],
  );

  const undo = useCallback((): Character | null => {
    const snapshot = stack.undo();
    sync();
    return snapshot;
  }, [stack, sync]);

  const redo = useCallback((): Character | null => {
    const snapshot = stack.redo();
    sync();
    return snapshot;
  }, [stack, sync]);

  const clear = useCallback(() => {
    stack.clear();
    sync();
  }, [stack, sync]);

  return {
    push,
    undo,
    redo,
    canUndo: depths.undo > 0,
    canRedo: depths.redo > 0,
    clear,
  };
}
