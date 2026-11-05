import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Character } from '../../types/character';
import { useUndoStack } from '../useUndoStack';

/** A minimal character carrying a `name` marker so snapshots are distinguishable. */
function snap(name: string): Character {
  return {
    _v: 1,
    id: 'c1',
    name,
    level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('useUndoStack', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useUndoStack());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('push then undo returns the snapshot (LIFO) and enables redo', () => {
    const { result } = renderHook(() => useUndoStack());
    act(() => {
      result.current.push(snap('a'));
      result.current.push(snap('b'));
    });
    expect(result.current.canUndo).toBe(true);

    let undone: Character | null = null;
    act(() => {
      undone = result.current.undo();
    });
    expect(undone!.name).toBe('b');
    expect(result.current.canRedo).toBe(true);

    let redone: Character | null = null;
    act(() => {
      redone = result.current.redo();
    });
    expect(redone!.name).toBe('b');
    expect(result.current.canRedo).toBe(false);
  });

  it('undo on an empty stack returns null', () => {
    const { result } = renderHook(() => useUndoStack());
    let undone: Character | null = snap('x');
    act(() => {
      undone = result.current.undo();
    });
    expect(undone).toBeNull();
  });

  it('a new push clears the redo branch', () => {
    const { result } = renderHook(() => useUndoStack());
    act(() => {
      result.current.push(snap('a'));
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);
    act(() => {
      result.current.push(snap('b'));
    });
    expect(result.current.canRedo).toBe(false);
  });

  it('drops the oldest entry past the cap', () => {
    const { result } = renderHook(() => useUndoStack(2));
    act(() => {
      result.current.push(snap('1'));
      result.current.push(snap('2'));
      result.current.push(snap('3'));
    });
    const returns: (Character | null)[] = [];
    act(() => {
      returns.push(result.current.undo());
      returns.push(result.current.undo());
      returns.push(result.current.undo());
    });
    expect(returns.map((r) => r?.name ?? null)).toEqual(['3', '2', null]);
  });

  it('clear empties the stack', () => {
    const { result } = renderHook(() => useUndoStack());
    act(() => {
      result.current.push(snap('a'));
    });
    expect(result.current.canUndo).toBe(true);
    act(() => {
      result.current.clear();
    });
    expect(result.current.canUndo).toBe(false);
  });
});
