import { describe, it, expect } from 'vitest';
import type { InventoryItem } from '../../types/character';
import { incrementDose, decrementDose } from '../consumables';

function doseItem(current: number, max: number): InventoryItem {
  return { id: 'i1', kind: 'equipment', name: 'Antitoxin', quantity: 1, currentDoses: current, maxDoses: max };
}

describe('incrementDose', () => {
  it('increments by one', () => {
    expect(incrementDose(doseItem(1, 3)).currentDoses).toBe(2);
  });

  it('caps at maxDoses', () => {
    expect(incrementDose(doseItem(3, 3)).currentDoses).toBe(3);
  });

  it('treats absent doses as 0 (caps at absent max 0)', () => {
    const item: InventoryItem = { id: 'i', kind: 'equipment', name: 'x', quantity: 1 };
    expect(incrementDose(item).currentDoses).toBe(0);
  });

  it('is pure (does not mutate the input)', () => {
    const item = doseItem(1, 3);
    incrementDose(item);
    expect(item.currentDoses).toBe(1);
  });
});

describe('decrementDose', () => {
  it('decrements by one', () => {
    expect(decrementDose(doseItem(2, 3)).currentDoses).toBe(1);
  });

  it('floors at 0', () => {
    expect(decrementDose(doseItem(0, 3)).currentDoses).toBe(0);
  });

  it('treats absent doses as 0 (floors at 0)', () => {
    const item: InventoryItem = { id: 'i', kind: 'equipment', name: 'x', quantity: 1 };
    expect(decrementDose(item).currentDoses).toBe(0);
  });

  it('is pure (does not mutate the input)', () => {
    const item = doseItem(2, 3);
    decrementDose(item);
    expect(item.currentDoses).toBe(2);
  });
});
