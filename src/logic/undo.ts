/**
 * Undo utilities (Stage B7). Pure and React-free.
 *
 * Two parts:
 *  - `removeAtIndex` / `restoreAtIndex` — list helpers used by the undo toast.
 *  - `createUndoStack<T>` — a bounded LIFO undo/redo stack. This pure core is
 *    what the B7 golden (UNDO_CASES) drives op-by-op; the React hook
 *    (useUndoStack) wraps it over whole-`Character` snapshots.
 *
 * Undo is app behaviour, not a PHB mechanic, so no game rule is cited here.
 */

/**
 * Returns a new array with the item at `index` removed.
 * Does not mutate the input array.
 */
export function removeAtIndex<T>(list: T[], index: number): T[] {
  return [...list.slice(0, index), ...list.slice(index + 1)];
}

/**
 * Returns a new array with `item` inserted at the given `index`.
 * Does not mutate the input array.
 */
export function restoreAtIndex<T>(list: T[], item: T, index: number): T[] {
  return [...list.slice(0, index), item, ...list.slice(index)];
}

/** A bounded LIFO undo/redo stack over values of type `T`. */
export interface UndoStack<T> {
  /**
   * Push a new value onto the undo stack. Clears the redo stack (a new action
   * discards the redo branch) and drops the OLDEST entry when over `cap`.
   */
  push(value: T): void;
  /** Pop the most-recent undo entry to the redo stack; returns it (null if empty). */
  undo(): T | null;
  /** Pop the most-recent redo entry back to the undo stack; returns it (null if empty). */
  redo(): T | null;
  /** Current undo-stack depth. */
  undoDepth(): number;
  /** Current redo-stack depth. */
  redoDepth(): number;
  /** Empty both the undo and redo branches. */
  clear(): void;
}

/**
 * Create a bounded LIFO undo/redo stack (Stage B7 golden UNDO_CASES contract).
 *
 * - `push(v)` appends `v` to the undo stack, CLEARS the redo stack, and when the
 *   undo stack exceeds `cap` drops the OLDEST entry (so a push past the cap makes
 *   the earliest entry unreachable).
 * - `undo()` moves the newest undo entry onto the redo stack and returns its
 *   value; returns `null` when there is nothing to undo.
 * - `redo()` moves the newest redo entry back onto the undo stack and returns its
 *   value; returns `null` when there is nothing to redo.
 *
 * Internally both stacks store newest-at-the-end for O(1) push/pop.
 */
export function createUndoStack<T>(cap: number): UndoStack<T> {
  const undoList: T[] = [];
  let redoList: T[] = [];

  return {
    push(value: T): void {
      undoList.push(value);
      // A new action discards any redo branch.
      redoList = [];
      // Bounded: drop the oldest when over the cap.
      if (undoList.length > cap) {
        undoList.splice(0, undoList.length - cap);
      }
    },
    undo(): T | null {
      if (undoList.length === 0) return null;
      const value = undoList.pop() as T;
      redoList.push(value);
      return value;
    },
    redo(): T | null {
      if (redoList.length === 0) return null;
      const value = redoList.pop() as T;
      undoList.push(value);
      return value;
    },
    undoDepth(): number {
      return undoList.length;
    },
    redoDepth(): number {
      return redoList.length;
    },
    clear(): void {
      undoList.length = 0;
      redoList = [];
    },
  };
}
