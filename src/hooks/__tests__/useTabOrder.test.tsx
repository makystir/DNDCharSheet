import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTabOrder } from '../useTabOrder';
import { loadTabOrder } from '../../logic/tab-order-store';

const DEFAULT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'skills', label: 'Skills & Saves' },
  { id: 'species', label: 'Species' },
  { id: 'class', label: 'Class & Features' },
];

function setup() {
  return renderHook(() => useTabOrder({ pageKey: 'character', defaultTabs: DEFAULT_TABS }));
}

beforeEach(() => {
  localStorage.clear();
});

describe('useTabOrder', () => {
  it('starts in default order when nothing is stored', () => {
    const { result } = setup();
    expect(result.current.orderedTabs.map((t) => t.id)).toEqual([
      'overview',
      'skills',
      'species',
      'class',
    ]);
    expect(result.current.isDefaultOrder).toBe(true);
    expect(result.current.isEditMode).toBe(false);
  });

  it('moveRight / moveLeft reorder the tabs and clear isDefaultOrder', () => {
    const { result } = setup();
    act(() => result.current.moveRight(0));
    expect(result.current.orderedTabs.map((t) => t.id)).toEqual([
      'skills',
      'overview',
      'species',
      'class',
    ]);
    expect(result.current.isDefaultOrder).toBe(false);

    act(() => result.current.moveLeft(1));
    expect(result.current.orderedTabs.map((t) => t.id)).toEqual([
      'overview',
      'skills',
      'species',
      'class',
    ]);
    expect(result.current.isDefaultOrder).toBe(true);
  });

  it('does not move past the boundaries', () => {
    const { result } = setup();
    act(() => result.current.moveLeft(0));
    act(() => result.current.moveRight(3));
    expect(result.current.orderedTabs.map((t) => t.id)).toEqual([
      'overview',
      'skills',
      'species',
      'class',
    ]);
  });

  it('toggleEditMode flips edit mode and persists the order on exit', () => {
    const { result } = setup();
    act(() => result.current.toggleEditMode());
    expect(result.current.isEditMode).toBe(true);
    act(() => result.current.moveRight(0));
    act(() => result.current.toggleEditMode());
    expect(result.current.isEditMode).toBe(false);
    expect(loadTabOrder('character')).toEqual(['skills', 'overview', 'species', 'class']);
  });

  it('resetOrder clears storage and restores defaults', () => {
    const { result } = setup();
    act(() => result.current.moveRight(0));
    act(() => result.current.resetOrder());
    expect(result.current.orderedTabs.map((t) => t.id)).toEqual([
      'overview',
      'skills',
      'species',
      'class',
    ]);
    expect(result.current.isDefaultOrder).toBe(true);
    expect(loadTabOrder('character')).toBeNull();
  });

  it('honours a stored valid custom order on mount', () => {
    localStorage.setItem('tabOrder:character', JSON.stringify(['class', 'species', 'skills', 'overview']));
    const { result } = setup();
    expect(result.current.orderedTabs.map((t) => t.id)).toEqual([
      'class',
      'species',
      'skills',
      'overview',
    ]);
  });

  it('reconciles a stored order with an unknown ID (dropped) on mount', () => {
    localStorage.setItem(
      'tabOrder:character',
      JSON.stringify(['skills', 'ghost', 'overview', 'species', 'class']),
    );
    const { result } = setup();
    expect(result.current.orderedTabs.map((t) => t.id)).toEqual([
      'skills',
      'overview',
      'species',
      'class',
    ]);
    // Reconciliation re-persists the cleaned order.
    expect(loadTabOrder('character')).toEqual(['skills', 'overview', 'species', 'class']);
  });
});
